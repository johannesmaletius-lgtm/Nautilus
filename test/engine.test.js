/* Zufallspartien gegen die Regel-Engine: prüft Invarianten und dass jede Partie endet. */
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const assert = require('assert');

function check(state) {
  const seen = new Set();
  for (const s of state.ships) {
    if (s.at === 'none') continue;
    const k = s.at === 'ring' ? 'r' + s.i : s.at + s.owner + ':' + s.i;
    assert(!seen.has(k), 'zwei Schiffe auf einem Feld: ' + k);
    seen.add(k);
    if (s.at === 'ring') assert(s.i >= 0 && s.i < 64);
    if (s.at === 'harbor') assert(s.i >= 0 && s.i < 4);
    if (s.fresh) assert(s.at === 'ring' && s.i === s.owner * 16, 'fresh nur auf dem Startfeld');
    if (s.at === 'ring') assert(state.whale !== s.i, 'Schiff auf dem Wal');
  }
  const cards = state.deck.length + state.discard.length +
    state.seats.reduce((n, s) => n + state.hands[s].length, 0);
  assert.strictEqual(cards, 108, 'Kartenzahl');
}

function playout(seed, mode, useAI) {
  const { state } = E.newGame({ mode, seed });
  let rnd = seed * 7919 + 1;
  const rand = n => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd % n; };
  let steps = 0;
  while (state.phase !== 'over') {
    if (++steps > 40000) throw new Error('Partie endet nicht (seed ' + seed + ')');
    let seat, action;
    if (state.phase === 'exchange') {
      seat = state.seats.find(s => state.give[s] === null);
      const acts = E.legalActions(state, seat);
      action = useAI ? AI.choose(E.view(state, seat), seat) : acts[rand(acts.length)];
    } else {
      seat = state.turn;
      const acts = E.legalActions(state, seat);
      assert(acts.length > 0, 'keine Aktion');
      // Sicht-Konsistenz: aus der Spielersicht ergeben sich dieselben Aktionen
      if (steps % 50 === 0) assert.strictEqual(E.legalActions(E.view(state, seat), seat).length, acts.length);
      action = useAI ? AI.choose(E.view(state, seat), seat) : acts[rand(acts.length)];
    }
    const r = E.apply(state, seat, action);
    assert(r.ok, r.error + ' ' + JSON.stringify(action));
    check(state);
  }
  return { steps, rounds: state.round, winner: state.winner };
}

let t0 = Date.now(), total = 0, rounds = 0;
for (let seed = 1; seed <= 40; seed++) { const r = playout(seed, 'team', false); total += r.steps; rounds += r.rounds; }
console.log('zufällig/team: 40 Partien ok, Ø', Math.round(total / 40), 'Aktionen, Ø', Math.round(rounds / 40), 'Runden,', Date.now() - t0, 'ms');
t0 = Date.now(); total = 0;
for (let seed = 1; seed <= 20; seed++) total += playout(seed, 'duel', false).steps;
console.log('zufällig/duell: 20 Partien ok, Ø', Math.round(total / 20), 'Aktionen,', Date.now() - t0, 'ms');
t0 = Date.now(); total = 0; rounds = 0;
for (let seed = 1; seed <= 20; seed++) { const r = playout(seed, 'team', true); total += r.steps; rounds += r.rounds; }
console.log('KI/team: 20 Partien ok, Ø', Math.round(total / 20), 'Aktionen, Ø', Math.round(rounds / 20), 'Runden,', Date.now() - t0, 'ms');
t0 = Date.now(); total = 0;
for (let seed = 1; seed <= 10; seed++) total += playout(seed, 'duel', true).steps;
console.log('KI/duell: 10 Partien ok, Ø', Math.round(total / 10), 'Aktionen,', Date.now() - t0, 'ms');

// Gezielte Regeltests
(function rules() {
  const { state } = E.newGame({ mode: 'team', seed: 5 });
  state.phase = 'play'; state.turn = 0;
  const S = state.ships;
  // frisch ausgelaufenes Schiff blockiert und darf nicht in den Hafen
  S[0].at = 'ring'; S[0].i = 0; S[0].fresh = true;
  assert.strictEqual(E.forward(state, S[0], 3).length, 1);
  S[4].at = 'ring'; S[4].i = 62;
  assert.strictEqual(E.forward(state, S[4], 5).length, 0, 'an frischem Schiff kommt niemand vorbei');
  // nach einer Runde: Hafen oder weiterfahren
  S[4].i = 30; S[0].fresh = false; S[0].i = 62;
  const o = E.forward(state, S[0], 5);
  assert.deepStrictEqual(o.map(x => x.dest), [{ at: 'ring', i: 3 }, { at: 'harbor', i: 2 }]);
  assert.strictEqual(E.forward(state, S[0], 7).length, 1, '7 Felder passen nicht in den Hafen');
  // im Hafen wird nicht übersprungen
  S[1].at = 'harbor'; S[1].i = 1;
  assert.strictEqual(E.forward(state, S[0], 5).filter(x => x.harbor).length, 0);
  assert.strictEqual(E.forward(state, S[0], 3).filter(x => x.harbor).length, 1);
  // Wal versperrt den Weg
  state.whale = 63;
  assert.strictEqual(E.forward(state, S[0], 3).length, 0);
  state.whale = -1;
  // Kielwasser: bis direkt hinter das nächste Schiff
  S[4].i = 10; S[0].i = 2;
  const w = E.typeActions(state, 0, 'wake').find(a => a.ship === 0);
  assert.deepStrictEqual(w.dest, { at: 'ring', i: 9 });
  // 7 schlägt alles, was überholt wird
  state.hands[0] = [{ id: 999, type: '7' }];
  S[0].i = 8; S[4].i = 10; S[1].at = 'base'; S[1].i = 1;
  const r = E.apply(state, 0, { k: 'seven', card: 999, ship: 0, n: 7, harbor: false });
  assert(r.ok, r.error);
  assert.strictEqual(S[4].at, 'base', 'überholtes Schiff wird geschlagen');
  console.log('Regeltests ok');
})();
