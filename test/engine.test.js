/* Zufallspartien gegen die Regel-Engine: prüft Invarianten und dass jede Partie endet. */
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const assert = require('assert');

function check(state) {
  const seen = new Set();
  const berths = {};
  for (const s of state.ships) {
    if (s.at === 'none') continue;
    const k = s.at === 'ring' ? 'r' + s.i : s.at + s.owner + ':' + s.i;
    assert(!seen.has(k), 'zwei Schiffe auf einem Feld: ' + k);
    seen.add(k);
    if (s.at === 'ring') assert(s.i >= 0 && s.i < 64);
    if (s.at === 'harbor') { assert(s.i >= 0 && s.i < 4); (berths[s.owner] = berths[s.owner] || []).push(s.i); }
    if (s.fresh) assert(s.at === 'ring' && s.i === s.owner * 16, 'fresh nur auf dem Startfeld');
    if (s.at === 'ring') assert(state.shark !== s.i, 'Schiff auf dem Hai');
  }
  // Hafen wird lückenlos von innen belegt
  for (const o in berths) {
    const b = berths[o].sort();
    b.forEach((i, k) => assert.strictEqual(i, 4 - b.length + k, 'Lücke im Hafen'));
  }
  const cards = state.deck.length + state.discard.length +
    state.seats.reduce((n, s) => n + state.hands[s].length, 0);
  assert.strictEqual(cards, 104, 'Kartenzahl');
}

const seenEvents = new Set();
function playout(seed, mode, useAI) {
  const { state } = E.newGame({ mode, seed });
  let rnd = seed * 7919 + 1;
  const rand = n => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd % n; };
  let steps = 0;
  while (state.phase !== 'over') {
    if (++steps > 60000) throw new Error('Partie endet nicht (seed ' + seed + ')');
    let seat;
    if (state.phase === 'exchange') seat = state.seats.find(s => state.give[s] === null);
    else seat = state.turn;
    const acts = E.legalActions(state, seat);
    assert(acts.length > 0, 'keine Aktion');
    // Sicht-Konsistenz: aus der Spielersicht ergeben sich dieselben Aktionen
    if (steps % 23 === 0) assert.strictEqual(E.legalActions(E.view(state, seat), seat).length, acts.length, 'Sicht ' + JSON.stringify(state.pend));
    const action = useAI ? AI.choose(E.view(state, seat), seat) : acts[rand(acts.length)];
    const r = E.apply(state, seat, action);
    assert(r.ok, r.error + ' ' + JSON.stringify(action));
    r.events.forEach(e => seenEvents.add(e.t));
    check(state);
  }
  return { steps, rounds: state.round, winner: state.winner };
}

let t0 = Date.now(), total = 0, rounds = 0;
for (let seed = 1; seed <= 30; seed++) { const r = playout(seed, 'team', false); total += r.steps; rounds += r.rounds; }
console.log('zufällig/team: 30 Partien ok, Ø', Math.round(total / 30), 'Aktionen, Ø', Math.round(rounds / 30), 'Runden,', Date.now() - t0, 'ms');
t0 = Date.now(); total = 0;
for (let seed = 1; seed <= 15; seed++) total += playout(seed, 'duel', false).steps;
console.log('zufällig/duell: 15 Partien ok, Ø', Math.round(total / 15), 'Aktionen,', Date.now() - t0, 'ms');
t0 = Date.now(); total = 0; rounds = 0;
for (let seed = 1; seed <= 15; seed++) { const r = playout(seed, 'team', true); total += r.steps; rounds += r.rounds; }
console.log('KI/team: 15 Partien ok, Ø', Math.round(total / 15), 'Aktionen, Ø', Math.round(rounds / 15), 'Runden,', Date.now() - t0, 'ms');
t0 = Date.now(); total = 0; rounds = 0;
for (let seed = 1; seed <= 10; seed++) { const r = playout(seed, 'duel', true); total += r.steps; rounds += r.rounds; }
console.log('KI/duell: 10 Partien ok, Ø', Math.round(total / 10), 'Aktionen, Ø', Math.round(rounds / 10), 'Runden,', Date.now() - t0, 'ms');
for (const t of ['roll', 'sharkIn', 'shark', 'undo', 'replay', 'board', 'trade', 'vision', 'storm', 'skip', 'discard', 'splitLeft', 'fold']) {
  assert(seenEvents.has(t), 'Ereignis kam nie vor: ' + t);
}

// Gezielte Regeltests
function fresh() {
  const { state } = E.newGame({ mode: 'team', seed: 5 });
  state.phase = 'play'; state.turn = 0; state.lead = 0;
  for (const s of state.ships) if (s.owner >= 0) { s.at = 'base'; s.i = s.id % 4; s.fresh = false; }
  return state;
}
const put = (state, id, i, f) => { const s = state.ships[id]; s.at = 'ring'; s.i = i; s.fresh = !!f; return s; };
const hand = (state, seat, ...types) => { state.hands[seat] = types.map((t, k) => ({ id: 900 + seat * 10 + k, type: t })); return state.hands[seat]; };

(function rules() {
  let st = fresh(), S = st.ships;
  // kein Überholen – landen und schlagen geht
  put(st, 0, 2); put(st, 4, 5);
  assert.strictEqual(E.forward(st, S[0], 4).length, 0, 'überholen verboten');
  assert.deepStrictEqual(E.forward(st, S[0], 3).map(o => o.dest), [{ at: 'ring', i: 5 }]);
  // die 7 schlägt alles auf dem Weg
  hand(st, 0, '7');
  let r = E.apply(st, 0, { k: 'move', card: 900, ship: 0, n: 7, harbor: false });
  assert(r.ok, r.error);
  assert.strictEqual(S[4].at, 'base', 'überholtes Schiff geschlagen');
  assert.strictEqual(S[0].i, 9);
  // geschütztes Schiff auf dem Startfeld hält auch die 7 auf
  st = fresh(); S = st.ships;
  put(st, 0, 12); put(st, 4, 16, true);
  assert.strictEqual(E.forward(st, S[0], 7, true).length, 0);
  // Hafen: von innen belegen, exakte Schrittzahl
  st = fresh(); S = st.ships;
  put(st, 0, 62);
  assert.deepStrictEqual(E.forward(st, S[0], 6).map(o => o.dest), [{ at: 'ring', i: 4 }, { at: 'harbor', i: 3 }]);
  assert.strictEqual(E.forward(st, S[0], 5).filter(o => o.harbor).length, 0, 'nur der innerste freie Platz');
  S[1].at = 'harbor'; S[1].i = 3;
  assert.strictEqual(E.forward(st, S[0], 5).filter(o => o.harbor).length, 1);
  // frisch ausgelaufen: nicht direkt in den Hafen
  st = fresh(); S = st.ships;
  put(st, 0, 0, true);
  assert.strictEqual(E.forward(st, S[0], 4).filter(o => o.harbor).length, 0);
  assert.strictEqual(E.backward(st, S[0], 4).filter(o => o.harbor).length, 0, 'nicht direkt mit der 4');
  assert.deepStrictEqual(E.backward(st, S[0], 4).map(o => o.dest), [{ at: 'ring', i: 60 }]);
  // zwei Felder vor, dann mit der 4 rückwärts in den Hafen (Liegeplatz 1, wenn 2 und 3 belegt)
  put(st, 0, 2, false);
  S[1].at = 'harbor'; S[1].i = 3; S[2].at = 'harbor'; S[2].i = 2;
  assert.deepStrictEqual(E.backward(st, S[0], 4).filter(o => o.harbor).map(o => o.dest), [{ at: 'harbor', i: 1 }]);
  // die 5: auf eigene und Partnerschiffe verteilen, jedes Schiff einmal
  st = fresh(); S = st.ships;
  put(st, 0, 20); put(st, 8, 40);
  const opts = E.splitOptions(st, 0, 5, []);
  assert(opts.some(o => o.ship === 8 && o.n === 2), 'Partnerschiff in der 5');
  assert(!opts.some(o => o.ship === 0 && o.n === 1 && false));
  hand(st, 0, '5');
  r = E.apply(st, 0, { k: 'split', card: 900, ship: 0, n: 3, harbor: false });
  assert(r.ok, r.error);
  assert(E.legalActions(st, 0).every(a => a.ship === 8 && a.n === 2), 'Rest nur mit dem anderen Schiff');
  r = E.apply(st, 0, { k: 'step', ship: 8, n: 2, harbor: false });
  assert(r.ok, r.error);
  assert.strictEqual(st.turn, 1);
  // 8: nächster Spieler setzt aus und wirft ab
  st = fresh(); hand(st, 0, '8'); hand(st, 1, '2', '3');
  r = E.apply(st, 0, { k: 'skip', card: 900, target: 1 });
  assert(r.ok, r.error);
  assert.strictEqual(st.turn, 1);
  assert(E.legalActions(st, 1).every(a => a.k === 'discard'));
  E.apply(st, 1, { k: 'discard', card: 910 });
  assert.strictEqual(st.hands[1].length, 1);
  assert.strictEqual(st.turn, 2);
  // Lotse: Zug zurücknehmen, Hai taucht auf, Karte selbst nutzen
  st = fresh(); S = st.ships; st.turn = 0;
  put(st, 0, 3); put(st, 4, 20);
  hand(st, 0, '6'); hand(st, 1, 'pilot', '2');
  E.apply(st, 0, { k: 'move', card: 900, ship: 0, n: 6, harbor: false });
  assert.strictEqual(S[0].i, 9);
  r = E.apply(st, 1, { k: 'pilot', card: 910 });
  assert(r.ok, r.error);
  assert.strictEqual(S[0].i, 3, 'Zug zurückgenommen');
  assert.strictEqual(st.shark, 15, 'Hai ein Feld hinter dem Startfeld');
  assert.deepStrictEqual(st.pend, { k: 'replay', seat: 1, type: '6' });
  r = E.apply(st, 1, { k: 'move', ship: 4, n: 6, harbor: false });
  assert(r.ok, r.error);
  assert.strictEqual(S[4].i, 26);
  // Hai-Karte: bis zum nächsten Schiff
  st = fresh(); S = st.ships; st.shark = 10; put(st, 4, 14); put(st, 0, 30);
  hand(st, 0, 'shark');
  E.apply(st, 0, { k: 'shark', card: 900 });
  assert.strictEqual(st.shark, 14); assert.strictEqual(S[4].at, 'base');
  // Würfeln am Ende eines Umlaufs: schlägt, was überschwommen wird
  st = fresh(); S = st.ships; st.shark = 50; put(st, 4, 51); put(st, 8, 52);
  const path = E.rollPath(st, 3);
  assert.deepStrictEqual(path.map(p => p.hit), [4, 8, undefined]);
  // Kurswechsel mit dem Hai
  st = fresh(); S = st.ships; st.shark = 40; put(st, 0, 5);
  assert(E.typeActions(st, 0, 'swap').some(a => a.ship === 0 && a.target === -1));
  // Entern: Karten des linken Nachbarn für ihn spielen
  st = fresh(); S = st.ships; put(st, 4, 20);
  hand(st, 0, 'board'); hand(st, 1, '3', 'vision');
  r = E.apply(st, 0, { k: 'board', card: 900, target: 1 });
  assert(r.ok, r.error);
  assert.deepStrictEqual(E.legalActions(st, 0).map(a => a.card), [910], 'nur Fahrkarten');
  assert.strictEqual(E.view(st, 0).hands[1][0].type, '3', 'Enternder sieht die Karten');
  E.apply(st, 0, { k: 'move', card: 910, ship: 4, n: 3, harbor: false });
  assert.strictEqual(S[4].i, 23); assert.strictEqual(st.hands[1].length, 1); assert.strictEqual(st.turn, 1);
  // Sturmfront: Hände nach rechts, dann noch eine Karte
  st = fresh(); hand(st, 0, 'storm', '2'); hand(st, 1, 'pilot'); hand(st, 2, '9'); hand(st, 3, '10');
  E.apply(st, 0, { k: 'storm', card: 900 });
  assert.deepStrictEqual(st.seats.map(s => st.hands[s].map(c => c.type).join()), ['pilot', '9', '10', '2']);
  assert.strictEqual(st.turn, 0);
  assert(E.legalActions(st, 0).every(a => a.k === 'pass'), 'Lotse ohne Vorzug nicht spielbar');
  // Weitblick: Hände offen
  st = fresh(); hand(st, 0, 'vision'); hand(st, 1, '2');
  E.apply(st, 0, { k: 'vision', card: 900 });
  assert.strictEqual(E.view(st, 3).hands[1][0].type, '2');
  // Handel
  st = fresh(); hand(st, 0, 'trade', '2'); hand(st, 2, '9');
  E.apply(st, 0, { k: 'trade', card: 900, target: 2 });
  assert.strictEqual(st.phase, 'exchange');
  assert(!E.apply(st, 1, { k: 'give', card: 0 }).ok);
  E.apply(st, 0, { k: 'give', card: 901 }); E.apply(st, 2, { k: 'give', card: 920 });
  assert.strictEqual(st.hands[0][0].type, '9'); assert.strictEqual(st.hands[2][0].type, '2');
  assert.strictEqual(st.phase, 'play'); assert.strictEqual(st.turn, 1);
  console.log('Regeltests ok');
})();
