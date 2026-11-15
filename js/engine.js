/* Seefahrt – Spielregeln.
 * Reine Logik ohne Darstellung. Läuft im Browser (window.SG.Engine) und in Node (module.exports).
 *
 * Spielfeld: Ring mit 64 Feldern, im Uhrzeigersinn. Platz s startet auf Feld s*16;
 * dort zweigt auch sein Heimathafen (4 Liegeplätze) ab. Liegeplatz 0 liegt am Ring, 3 ganz innen.
 * Der Weiße Hai ist eine eigene Figur auf dem Ring (state.shark, -1 = noch nicht aufgetaucht). */
(function (root) {
  'use strict';

  const RING = 64, QUAD = 16, BERTHS = 4, FLEET = 4, HAND = 5, DIE = 6, SPLIT = 5;

  // Kartensatz: 104 Karten
  const DECK = [
    ['1', 10], ['12', 10],
    ['2', 6], ['3', 6], ['5', 6], ['6', 6], ['8', 6], ['9', 6], ['10', 6],
    ['4', 7], ['7', 7],
    ['swap', 7], ['pilot', 6], ['shark', 3], ['board', 4], ['trade', 3], ['vision', 2], ['storm', 3],
  ];
  const DECK_SIZE = DECK.reduce((n, d) => n + d[1], 0);
  const TYPES = DECK.map(d => d[0]);
  const STEPS = { '1': [1], '2': [2], '3': [3], '4': [4, -4], '6': [6], '7': [7], '8': [8], '9': [9], '10': [10], '12': [12] };
  const LAUNCH = { '1': true, '12': true };
  const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12'];
  // Karten, deren Zug der Lotse zurücknehmen kann – und die man beim Entern für den anderen spielen darf
  const MOVES = new Set(NUMBERS.concat(['swap', 'shark']));

  /* ---------- Zufall (seedbar, damit Partien reproduzierbar sind) ---------- */
  function rnd(state) {
    let t = (state.seed = (state.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(state, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd(state) * (i + 1));
      const x = arr[i]; arr[i] = arr[j]; arr[j] = x;
    }
    return arr;
  }

  /* ---------- Hilfen ---------- */
  const startField = owner => owner * QUAD;
  const team = (state, seat) => (state.mode === 'team' ? seat % 2 : seat);
  const partner = (state, seat) => (state.mode === 'team' ? (seat + 2) % 4 : null);
  const teams = state => (state.mode === 'team' ? [0, 1] : state.seats.slice());
  function nextSeat(state, seat) {
    const s = state.seats;
    return s[(s.indexOf(seat) + 1) % s.length];
  }
  function prevSeat(state, seat) {
    const s = state.seats;
    return s[(s.indexOf(seat) + s.length - 1) % s.length];
  }
  const fleet = (state, owner) => state.ships.filter(s => s.owner === owner);
  const fleetHome = (state, owner) => fleet(state, owner).every(s => s.at === 'harbor');
  function teamHome(state, t) {
    return state.ships.every(s => s.owner < 0 || team(state, s.owner) !== t || s.at === 'harbor');
  }
  /* Wessen Schiffe ein Platz gerade steuert: die eigenen – oder die des Partners,
   * sobald die eigene Flotte vollständig im Hafen liegt. */
  function controlOwner(state, seat) {
    const p = partner(state, seat);
    return p !== null && fleetHome(state, seat) ? p : seat;
  }
  function ringMap(state) {
    const m = new Array(RING).fill(null);
    for (const s of state.ships) if (s.at === 'ring') m[s.i] = s;
    return m;
  }
  /* Der Hafen wird von innen nach außen belegt: Frei ist immer nur der innerste leere Liegeplatz.
   * So bleibt nie eine Lücke, die niemand mehr erreichen kann. -1 = Hafen voll. */
  function nextBerth(state, owner) {
    let n = 0;
    for (const s of state.ships) if (s.at === 'harbor' && s.owner === owner) n++;
    return BERTHS - 1 - n;
  }
  /* Nächster Platz nach `from`, der noch Karten hat und nicht aussetzt (ohne `from` selbst). */
  function nextActive(state, from) {
    let s = from;
    for (let k = 1; k < state.seats.length; k++) {
      s = nextSeat(state, s);
      if (!state.out[s] && state.hands[s] && state.hands[s].length > 0) return s;
    }
    return null;
  }

  function cloneBoard(state) {
    return {
      mode: state.mode, seats: state.seats, shark: state.shark,
      ships: state.ships.map(s => ({ id: s.id, owner: s.owner, at: s.at, i: s.i, fresh: s.fresh })),
    };
  }
  function boardKey(b) {
    let k = '' + b.shark;
    for (const s of b.ships) k += (s.at === 'ring' ? 'r' : s.at === 'harbor' ? 'h' : 'b') + s.i + (s.fresh ? 'f' : '');
    return k;
  }
  function snapshot(state) {
    return {
      ships: state.ships.map(s => ({ at: s.at, i: s.i, fresh: s.fresh })),
      shark: state.shark, skip: Object.assign({}, state.skip),
    };
  }

  /* ---------- Zugmöglichkeiten eines Schiffs ----------
   * Kein Schiff darf überholt werden (Ausnahme: die 7 schlägt alles auf dem Weg – nur ein geschütztes
   * Schiff auf seinem Startfeld hält auch sie auf). Den Hai darf man überholen, aber nicht auf ihm anhalten. */
  function forward(state, ship, n, sweep, ring) {
    const out = [];
    if (ship.at !== 'ring') return out;
    ring = ring || ringMap(state);
    const p = ship.i, S = startField(ship.owner);
    const passable = o => !o || o === ship || (sweep && !o.fresh);
    // auf dem Ring bleiben
    let ok = true, path = [];
    for (let k = 1; k <= n; k++) {
      const f = (p + k) % RING, o = ring[f];
      if (k < n ? !passable(o) : (f === state.shark || (o && o.fresh))) { ok = false; break; }
      path.push({ at: 'ring', i: f });
    }
    if (ok) out.push({ harbor: false, dest: path[n - 1], path });
    // über das eigene Startfeld in den Heimathafen – nicht direkt nach dem Auslaufen
    if (!ship.fresh) {
      const d = (S - p + RING) % RING, h = n - d;
      if (h >= 1 && h - 1 === nextBerth(state, ship.owner)) {
        ok = true; path = [];
        for (let k = 1; k <= d; k++) {
          const f = (p + k) % RING;
          if (!passable(ring[f])) { ok = false; break; }
          path.push({ at: 'ring', i: f });
        }
        if (ok) {
          for (let j = 0; j < h; j++) path.push({ at: 'harbor', i: j });
          out.push({ harbor: true, dest: path[path.length - 1], path });
        }
      }
    }
    return out;
  }
  /* Rückwärts mit der 4. Steht das Schiff ein bis drei Felder hinter seinem Startfeld (also schon
   * losgefahren), darf es rückwärts über das Startfeld in den Hafen einlaufen. */
  function backward(state, ship, n, ring) {
    const out = [];
    if (ship.at !== 'ring') return out;
    ring = ring || ringMap(state);
    const p = ship.i, S = startField(ship.owner);
    let ok = true, path = [];
    for (let k = 1; k <= n; k++) {
      const f = (p - k + RING) % RING, o = ring[f];
      if (k < n ? !!o : (f === state.shark || (o && o.fresh))) { ok = false; break; }
      path.push({ at: 'ring', i: f });
    }
    if (ok) out.push({ harbor: false, dest: path[n - 1], path });
    if (!ship.fresh) {
      const k0 = (p - S + RING) % RING, h = n - k0;
      if (k0 >= 1 && h >= 1 && h - 1 === nextBerth(state, ship.owner)) {
        ok = true; path = [];
        for (let k = 1; k <= k0; k++) {
          const f = (p - k + RING) % RING;
          if (ring[f]) { ok = false; break; }
          path.push({ at: 'ring', i: f });
        }
        if (ok) {
          for (let j = 0; j < h; j++) path.push({ at: 'harbor', i: j });
          out.push({ harbor: true, dest: path[path.length - 1], path });
        }
      }
    }
    return out;
  }

  function capture(ship) { ship.at = 'base'; ship.i = ship.id % FLEET; ship.fresh = false; }

  /* ---------- Der Weiße Hai ---------- */
  /* Hai-Karte: bis zum nächsten Schiff schwimmen und es schlagen. Ein geschütztes Schiff hält ihn auf. */
  function huntPath(board) {
    if (board.shark < 0) return [];
    const ring = ringMap(board), path = [];
    for (let k = 1; k < RING; k++) {
      const f = (board.shark + k) % RING, o = ring[f];
      if (o && o.fresh) return path;
      path.push({ at: 'ring', i: f });
      if (o) { path[path.length - 1].hit = o.id; return path; }
    }
    return [];
  }
  /* Würfelwurf: n Felder vorwärts, alles auf dem Weg wird geschlagen. */
  function rollPath(board, n) {
    const ring = ringMap(board), path = [];
    for (let k = 1; k <= n; k++) {
      const f = (board.shark + k) % RING, o = ring[f];
      if (o && o.fresh) break;
      const st = { at: 'ring', i: f };
      if (o) st.hit = o.id;
      path.push(st);
    }
    return path;
  }
  function runShark(board, path) {
    for (const p of path) if (p.hit !== undefined) capture(board.ships[p.hit]);
    if (path.length) board.shark = path[path.length - 1].i;
  }
  /* Der Hai erscheint ein Feld hinter dem Startfeld des Platzes. */
  function sharkAppear(board, seat, ev) {
    const f = (startField(seat) - 1 + RING) % RING;
    const o = board.ships.find(s => s.at === 'ring' && s.i === f);
    const e = { t: 'sharkIn', seat, at: f };
    if (o) { capture(o); e.hit = o.id; }
    board.shark = f;
    ev.push(e);
  }
  function restore(board, snap, ev) {
    const moves = [];
    board.ships.forEach((s, k) => {
      const b = snap.ships[k];
      if (s.at !== b.at || s.i !== b.i || s.fresh !== b.fresh) {
        moves.push({ ship: s.id, from: { at: s.at, i: s.i }, to: { at: b.at, i: b.i }, fresh: b.fresh });
        s.at = b.at; s.i = b.i; s.fresh = b.fresh;
      }
    });
    const sharkFrom = board.shark;
    board.shark = snap.shark;
    if (board.skip) { for (const k in board.skip) delete board.skip[k]; Object.assign(board.skip, snap.skip); }
    ev.push({ t: 'undo', moves, shark: { from: sharkFrom, to: snap.shark } });
  }

  /* ---------- Die 5: Schritte auf eigene Schiffe und die des Partners verteilen ----------
   * Jedes Schiff zieht dabei höchstens einmal; alle fünf Schritte müssen gezogen werden. */
  function splitShips(board, persp, moved) {
    const p = partner(board, persp);
    return board.ships.filter(s => (s.owner === persp || s.owner === p) && s.at === 'ring' && !moved.includes(s.id));
  }
  function canFinish(board, persp, left, moved, memo) {
    if (left === 0) return true;
    if (teamHome(board, team(board, persp))) return true;
    const key = boardKey(board) + '|' + left + '|' + moved.slice().sort((a, b) => a - b).join(',');
    if (memo.has(key)) return memo.get(key);
    let res = false;
    outer:
    for (const ship of splitShips(board, persp, moved)) {
      for (let n = 1; n <= left; n++) {
        for (const opt of forward(board, ship, n)) {
          const b2 = cloneBoard(board);
          effect(b2, { k: 'step', ship: ship.id, path: opt.path }, []);
          if (canFinish(b2, persp, left - n, moved.concat(ship.id), memo)) { res = true; break outer; }
        }
      }
    }
    memo.set(key, res);
    return res;
  }
  function splitOptions(state, persp, left, moved) {
    const memo = new Map(), out = [];
    for (const ship of splitShips(state, persp, moved)) {
      for (let n = 1; n <= left; n++) {
        for (const opt of forward(state, ship, n)) {
          const b2 = cloneBoard(state);
          effect(b2, { k: 'step', ship: ship.id, path: opt.path }, []);
          if (canFinish(b2, persp, left - n, moved.concat(ship.id), memo)) {
            out.push({ ship: ship.id, n, harbor: opt.harbor, dest: opt.dest, path: opt.path });
          }
        }
      }
    }
    return out;
  }

  /* ---------- Aktionen je Kartentyp ----------
   * persp: der Platz, für den die Karte wirkt (beim Entern der Geenterte). */
  function typeActions(state, persp, type) {
    const out = [];
    const ctrl = controlOwner(state, persp);
    const ring = ringMap(state);
    const mine = state.ships.filter(s => s.owner === ctrl);

    if (LAUNCH[type]) {
      const S = startField(ctrl);
      const docked = mine.find(s => s.at === 'base');
      if (docked && state.shark !== S && !(ring[S] && ring[S].fresh)) {
        out.push({ k: 'launch', ship: docked.id, dest: { at: 'ring', i: S }, path: [{ at: 'ring', i: S }] });
      }
    }
    if (STEPS[type]) {
      for (const n of STEPS[type]) {
        for (const ship of mine) {
          const opts = n > 0 ? forward(state, ship, n, type === '7', ring) : backward(state, ship, -n, ring);
          for (const o of opts) out.push({ k: 'move', ship: ship.id, n, harbor: o.harbor, dest: o.dest, path: o.path });
        }
      }
    }
    switch (type) {
      case '8': {
        const t = nextActive(state, persp);
        if (t !== null) out.push({ k: 'skip', target: t });
        break;
      }
      case '5':
        for (const o of splitOptions(state, persp, SPLIT, [])) out.push(Object.assign({ k: 'split' }, o));
        break;
      case 'swap': {
        const cand = state.ships.filter(s => s.at === 'ring' && !s.fresh);
        for (const a of cand) {
          for (const b of cand) if (b.owner !== a.owner) out.push({ k: 'swap', ship: a.id, target: b.id });
          if (state.shark >= 0) out.push({ k: 'swap', ship: a.id, target: -1 });
        }
        break;
      }
      case 'shark':
        if (huntPath(state).length) out.push({ k: 'shark' });
        break;
      case 'pilot':
        if (state.last) out.push({ k: 'pilot' });
        break;
      case 'board': {
        const v = nextSeat(state, persp);
        if (v !== persp && state.hands[v].length) out.push({ k: 'board', target: v });
        break;
      }
      case 'trade': {
        const p = partner(state, persp);
        if (p !== null && state.hands[p].length && state.hands[persp].length >= 2) out.push({ k: 'trade', target: p });
        break;
      }
      case 'vision':
        if (state.seats.some(s => s !== persp && !state.open[s] && state.hands[s].length)) out.push({ k: 'vision' });
        break;
      case 'storm':
        out.push({ k: 'storm' });
        break;
    }
    return out;
  }

  function cardActions(state, persp, card, cache) {
    let acts = cache && cache[card.type];
    if (!acts) { acts = typeActions(state, persp, card.type); if (cache) cache[card.type] = acts; }
    return acts.map(a => Object.assign({}, a, { card: card.id }));
  }
  /* Was der Enternde mit den Karten des Geenterten anfangen kann: nur Fahrkarten, Kurswechsel und Hai. */
  function boardActions(state, victim) {
    const out = [], cache = {};
    for (const c of state.hands[victim]) {
      if (c && MOVES.has(c.type)) out.push.apply(out, cardActions(state, victim, c, cache));
    }
    return out;
  }

  /* Alle erlaubten Aktionen des Platzes, der gerade handeln darf. */
  function legalActions(state, seat) {
    if (state.phase === 'exchange') {
      if (state.give[seat] !== null) return [];
      return (state.hands[seat] || []).filter(Boolean).map(c => ({ k: 'give', card: c.id }));
    }
    if (state.phase !== 'play' || state.turn !== seat) return [];
    const p = state.pend;
    if (p && p.k === 'split') {
      return splitOptions(state, p.as, p.left, p.moved).map(o => Object.assign({ k: 'step' }, o));
    }
    if (p && p.k === 'replay') return typeActions(state, seat, p.type);
    if (p && p.k === 'board') return boardActions(state, p.victim);
    const hand = state.hands[seat];
    const bonus = p && p.k === 'bonus';
    if (!bonus && state.skip[seat] > 0) return hand.filter(Boolean).map(c => ({ k: 'discard', card: c.id }));
    const out = [], cache = {};
    for (const card of hand) if (card) out.push.apply(out, cardActions(state, seat, card, cache));
    if (!out.length) out.push({ k: bonus ? 'pass' : 'fold' });
    return out;
  }

  function sameAction(a, b) {
    return a.k === b.k && a.card === b.card && a.ship === b.ship &&
      a.n === b.n && !!a.harbor === !!b.harbor && a.target === b.target;
  }

  /* ---------- Wirkung einer Aktion auf die Figuren (ohne Karten/Zugfolge) ---------- */
  function effect(board, action, ev) {
    const ship = action.ship !== undefined ? board.ships[action.ship] : null;
    switch (action.k) {
      case 'launch': {
        const S = startField(ship.owner);
        const other = board.ships.find(s => s.at === 'ring' && s.i === S);
        const from = { at: ship.at, i: ship.i };
        ship.at = 'ring'; ship.i = S; ship.fresh = true;
        const e = { t: 'launch', ship: ship.id, from, to: { at: 'ring', i: S } };
        if (other) { capture(other); e.hit = other.id; }
        ev.push(e);
        break;
      }
      case 'move': case 'split': case 'step': {
        const from = { at: ship.at, i: ship.i };
        const path = action.path.map(p => ({ at: p.at, i: p.i }));
        // Wer auf dem Weg liegt (nur bei der 7 möglich) oder am Ziel steht, wird geschlagen
        for (const p of path) {
          if (p.at !== 'ring') continue;
          const other = board.ships.find(s => s !== ship && s.at === 'ring' && s.i === p.i);
          if (other) { capture(other); p.hit = other.id; }
        }
        const dest = path[path.length - 1];
        ship.at = dest.at; ship.i = dest.i; ship.fresh = false;
        ev.push({ t: 'move', ship: ship.id, from, path, back: action.n < 0, home: dest.at === 'harbor' });
        break;
      }
      case 'swap': {
        if (action.target === -1) {
          const a = { at: 'ring', i: ship.i }, f = board.shark;
          board.shark = ship.i; ship.i = f;
          ev.push({ t: 'swap', a: ship.id, b: -1, posA: { at: 'ring', i: f }, posB: a });
        } else {
          const other = board.ships[action.target];
          const a = { at: ship.at, i: ship.i }, b = { at: other.at, i: other.i };
          ship.i = b.i; other.i = a.i; ship.fresh = false; other.fresh = false;
          ev.push({ t: 'swap', a: ship.id, b: other.id, posA: b, posB: a });
        }
        break;
      }
      case 'shark': {
        const from = board.shark, path = huntPath(board);
        runShark(board, path);
        ev.push({ t: 'shark', from, path });
        break;
      }
    }
  }

  /* ---------- Partieverlauf ---------- */
  function newGame(opts) {
    opts = opts || {};
    const mode = opts.mode === 'duel' ? 'duel' : 'team';
    const seats = mode === 'duel' ? [0, 2] : [0, 1, 2, 3];
    const state = {
      v: 2, mode, seats,
      seed: (opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 2 ** 31)) | 0,
      ships: [], shark: -1,
      deck: [], discard: [], hands: {},
      dealer: 0, lead: 0, turn: 0, round: 0, phase: 'play',
      give: {}, trade: null, out: {}, skip: {}, open: {},
      pend: null, last: null, winner: null,
    };
    // Schiffe: ID = Platz*4 + k; Index im Array == ID (auch im Duell, dort bleiben Lücken leer)
    for (let seat = 0; seat < 4; seat++) {
      for (let k = 0; k < FLEET; k++) {
        const id = seat * FLEET + k;
        state.ships.push(seats.includes(seat)
          ? { id, owner: seat, at: 'base', i: k, fresh: false }
          : { id, owner: -1, at: 'none', i: 0, fresh: false });
      }
    }
    let id = 0;
    for (const [type, count] of DECK) for (let k = 0; k < count; k++) state.deck.push({ id: id++, type });
    shuffle(state, state.deck);
    // Wer zuletzt am Meer war, gibt – hier entscheidet das Los
    state.dealer = opts.dealer !== undefined ? opts.dealer : seats[Math.floor(rnd(state) * seats.length)];
    const ev = [];
    startRound(state, ev);
    return { state, events: ev };
  }

  function startRound(state, ev) {
    const need = HAND * state.seats.length;
    // Karten, die noch auf der Hand liegen (etwa nach einer Sturmfront bei Aussetzenden), kommen ab
    for (const s of state.seats) if (state.hands[s]) state.discard.push.apply(state.discard, state.hands[s].splice(0));
    if (state.deck.length < need) {
      state.deck = shuffle(state, state.deck.concat(state.discard));
      state.discard = [];
      ev.push({ t: 'reshuffle' });
    }
    const hands = {};
    for (const s of state.seats) hands[s] = [];
    for (let k = 0; k < HAND; k++) for (const s of state.seats) hands[s].push(state.deck.pop());
    state.hands = hands;
    state.out = {}; state.give = {}; state.skip = {}; state.open = {};
    state.pend = null; state.last = null; state.trade = null;
    for (const s of state.seats) { state.out[s] = false; state.give[s] = null; state.skip[s] = 0; state.open[s] = false; }
    state.lead = nextSeat(state, state.dealer);
    state.turn = state.lead;
    state.phase = state.mode === 'team' ? 'exchange' : 'play';
    const dealt = {};
    for (const s of state.seats) dealt[s] = hands[s].slice();
    ev.push({ t: 'deal', round: state.round, size: HAND, dealer: state.dealer, hands: dealt });
    if (state.phase === 'play') ev.push({ t: 'turn', seat: state.turn });
  }

  /* Zug weitergeben. Wer einmal herum ist (alle waren an der Reihe), würfelt den Hai weiter. */
  function advance(state, ev) {
    state.pend = null;
    let s = state.turn, lap = false, found = null;
    for (let k = 0; k < state.seats.length; k++) {
      s = nextSeat(state, s);
      if (s === state.lead) lap = true;
      if (!state.out[s] && state.hands[s].length > 0) { found = s; break; }
    }
    if (found === null) lap = true;
    if (lap && state.shark >= 0) {
      const n = 1 + Math.floor(rnd(state) * DIE);
      const from = state.shark, path = rollPath(state, n);
      runShark(state, path);
      state.last = null;
      ev.push({ t: 'roll', value: n, from, path });
    }
    if (found !== null) {
      state.turn = found;
      ev.push({ t: 'turn', seat: found });
      return;
    }
    ev.push({ t: 'roundEnd', round: state.round });
    state.dealer = nextSeat(state, state.dealer);
    state.round++;
    startRound(state, ev);
  }

  function checkWin(state, ev) {
    for (const t of teams(state)) {
      if (teamHome(state, t)) {
        state.phase = 'over'; state.winner = t; state.pend = null;
        ev.push({ t: 'win', team: t });
        return true;
      }
    }
    return false;
  }

  /* Führt die Wirkung einer gespielten Karte aus.
   * actor: wer spielt; persp: für wen die Karte wirkt; from: 'hand' | 'board' | 'replay'. */
  function exec(state, actor, persp, type, a, ev, from) {
    const prev = state.last;
    const snap = from === 'hand' && MOVES.has(type) ? snapshot(state) : null;
    state.last = null;
    switch (a.k) {
      case 'launch': case 'move': case 'swap': case 'shark':
        effect(state, a, ev);
        break;
      case 'skip':
        state.skip[a.target] = (state.skip[a.target] || 0) + 1;
        ev.push({ t: 'skip', seat: actor, target: a.target });
        break;
      case 'split':
        effect(state, a, ev);
        if (SPLIT - a.n > 0) {
          state.pend = { k: 'split', seat: actor, as: persp, left: SPLIT - a.n, moved: [a.ship], snap };
          ev.push({ t: 'splitLeft', seat: actor, left: SPLIT - a.n });
          return;
        }
        break;
      case 'pilot': {
        restore(state, prev.snap, ev);
        if (state.shark < 0) sharkAppear(state, actor, ev);
        const T = prev.type;
        if (T === '5') {
          if (!checkWinQuiet(state) && splitOptions(state, actor, SPLIT, []).length) {
            state.pend = { k: 'split', seat: actor, as: actor, left: SPLIT, moved: [], snap: null };
            ev.push({ t: 'replay', seat: actor, type: T });
            ev.push({ t: 'splitLeft', seat: actor, left: SPLIT });
          } else ev.push({ t: 'replay', seat: actor, type: T, none: true });
        } else if (typeActions(state, actor, T).length) {
          state.pend = { k: 'replay', seat: actor, type: T };
          ev.push({ t: 'replay', seat: actor, type: T });
        } else ev.push({ t: 'replay', seat: actor, type: T, none: true });
        return;
      }
      case 'board': {
        const victim = a.target;
        if (boardActions(state, victim).length) {
          state.pend = { k: 'board', seat: actor, victim };
          ev.push({ t: 'board', seat: actor, victim });
        } else ev.push({ t: 'board', seat: actor, victim, none: true });
        return;
      }
      case 'trade': {
        const p = a.target;
        state.phase = 'exchange';
        state.trade = [actor, p];
        for (const s of state.seats) state.give[s] = s === actor || s === p ? null : -1;
        ev.push({ t: 'trade', seat: actor, partner: p });
        return;
      }
      case 'vision':
        for (const s of state.seats) if (s !== actor) state.open[s] = true;
        ev.push({ t: 'vision', seat: actor });
        return;
      case 'storm': {
        const old = state.hands, hands = {};
        for (const s of state.seats) hands[s] = old[nextSeat(state, s)];
        state.hands = hands;
        ev.push({ t: 'storm', seat: actor });
        if (hands[actor].length) {
          state.pend = { k: 'bonus', seat: actor };
          ev.push({ t: 'turn', seat: actor, bonus: true });
        }
        return;
      }
    }
    if (snap) state.last = { seat: actor, type, snap };
  }
  function checkWinQuiet(state) { return teams(state).some(t => teamHome(state, t)); }

  /* Führt eine Aktion aus. Gibt { ok, events } oder { ok:false, error } zurück. */
  function apply(state, seat, action) {
    const ev = [];
    const fail = error => ({ ok: false, error });
    if (state.phase === 'over') return fail('Die Partie ist beendet.');
    if (!state.seats.includes(seat)) return fail('Unbekannter Platz.');

    if (state.phase === 'exchange') {
      if (action.k !== 'give') return fail('Erst wird getauscht.');
      if (state.give[seat] !== null) return fail(state.give[seat] === -1 ? 'Du bist an diesem Tausch nicht beteiligt.' : 'Du hast schon eine Karte gewählt.');
      const card = state.hands[seat].find(c => c.id === action.card);
      if (!card) return fail('Diese Karte hast du nicht.');
      state.give[seat] = card.id;
      ev.push({ t: 'gave', seat });
      const traders = state.trade || state.seats;
      if (traders.every(s => state.give[s] !== null)) {
        const got = {};
        for (const s of traders) {
          const idx = state.hands[s].findIndex(c => c.id === state.give[s]);
          got[partner(state, s)] = state.hands[s].splice(idx, 1)[0];
        }
        for (const s of traders) state.hands[s].push(got[s]);
        state.phase = 'play';
        const trade = !!state.trade;
        ev.push({ t: 'exchanged', got, trade });
        state.trade = null;
        for (const s of state.seats) state.give[s] = null;
        if (trade) advance(state, ev);
        else ev.push({ t: 'turn', seat: state.turn });
      }
      return { ok: true, events: ev };
    }

    if (seat !== state.turn) return fail('Du bist nicht am Zug.');
    const legal = legalActions(state, seat).find(a => sameAction(a, action));
    if (!legal) {
      if (action.k === 'fold') return fail('Du kannst noch eine Karte spielen.');
      return fail('Dieser Zug ist nicht möglich.');
    }
    const pend = state.pend;

    if (legal.k === 'fold') {
      const cards = state.hands[seat].splice(0);
      state.discard.push.apply(state.discard, cards);
      state.out[seat] = true;
      state.last = null;
      ev.push({ t: 'fold', seat, cards });
    } else if (legal.k === 'pass') {
      state.pend = null; state.last = null;
      ev.push({ t: 'pass', seat });
    } else if (legal.k === 'discard') {
      const idx = state.hands[seat].findIndex(c => c.id === legal.card);
      const card = state.hands[seat].splice(idx, 1)[0];
      state.discard.push(card);
      state.skip[seat]--;
      state.last = null;
      ev.push({ t: 'discard', seat, card });
    } else if (pend && pend.k === 'split') {
      effect(state, legal, ev);
      pend.moved.push(legal.ship);
      pend.left -= legal.n;
      if (pend.left > 0 && !checkWinQuiet(state)) {
        ev.push({ t: 'splitLeft', seat, left: pend.left });
        return { ok: true, events: ev };
      }
      state.pend = null;
      if (pend.snap) state.last = { seat, type: '5', snap: pend.snap };
    } else if (pend && pend.k === 'replay') {
      state.pend = null;
      exec(state, seat, seat, pend.type, legal, ev, 'replay');
    } else {
      const holder = pend && pend.k === 'board' ? pend.victim : seat;
      const idx = state.hands[holder].findIndex(c => c.id === legal.card);
      const card = state.hands[holder].splice(idx, 1)[0];
      state.discard.push(card);
      state.pend = null;
      const e = { t: 'play', seat, card: { id: card.id, type: card.type } };
      if (holder !== seat) e.for = holder;
      ev.push(e);
      exec(state, seat, holder, card.type, legal, ev, holder === seat ? 'hand' : 'board');
    }

    if (checkWin(state, ev)) return { ok: true, events: ev };
    if (state.phase === 'play' && !state.pend) advance(state, ev);
    return { ok: true, events: ev };
  }

  /* ---------- Sicht eines Platzes (verdeckte Karten der anderen) ---------- */
  function view(state, seat) {
    const p = state.pend;
    const v = {
      v: state.v, mode: state.mode, seats: state.seats.slice(),
      ships: state.ships.map(s => Object.assign({}, s)), shark: state.shark,
      deckN: state.deck.length,
      top: state.discard.slice(-3),
      hands: {}, dealer: state.dealer, lead: state.lead, turn: state.turn, round: state.round, phase: state.phase,
      give: {}, trade: state.trade ? state.trade.slice() : null,
      out: Object.assign({}, state.out), skip: Object.assign({}, state.skip), open: Object.assign({}, state.open),
      pend: p ? { k: p.k, seat: p.seat, as: p.as, left: p.left, moved: p.moved ? p.moved.slice() : undefined, type: p.type, victim: p.victim } : null,
      last: state.last ? JSON.parse(JSON.stringify(state.last)) : null,
      winner: state.winner, me: seat,
    };
    for (const s of state.seats) {
      const shown = s === seat || state.open[s] || (p && p.k === 'board' && p.seat === seat && p.victim === s);
      v.hands[s] = shown ? state.hands[s].map(c => Object.assign({}, c)) : state.hands[s].map(() => null);
      v.give[s] = s === seat ? state.give[s] : (state.give[s] === null ? null : state.give[s] === -1 ? -1 : true);
    }
    return v;
  }
  function eventsFor(events, seat) {
    return events.map(e => {
      if (e.t === 'deal') {
        const hands = {};
        for (const s in e.hands) hands[s] = +s === seat ? e.hands[s] : e.hands[s].map(() => null);
        return Object.assign({}, e, { hands });
      }
      if (e.t === 'exchanged') {
        const got = {};
        if (e.got[seat]) got[seat] = e.got[seat];
        return Object.assign({}, e, { got });
      }
      return e;
    });
  }

  const Engine = {
    RING, QUAD, BERTHS, FLEET, HAND, DIE, SPLIT, DECK, DECK_SIZE, TYPES, STEPS, NUMBERS, MOVES,
    newGame, apply, view, eventsFor, legalActions, cardActions, typeActions, splitOptions, splitShips, boardActions,
    effect, cloneBoard, boardKey, forward, backward, huntPath, rollPath, restore, sharkAppear, nextBerth, nextActive,
    team, partner, nextSeat, prevSeat, controlOwner, teamHome, fleetHome, startField, sameAction,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  root.SG = root.SG || {};
  root.SG.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
