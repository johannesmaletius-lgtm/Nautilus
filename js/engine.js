/* Seegang – Spielregeln.
 * Reine Logik ohne Darstellung. Läuft im Browser (window.SG.Engine) und in Node (module.exports).
 *
 * Spielfeld: Ring mit 64 Feldern, im Uhrzeigersinn. Platz s startet auf Feld s*16;
 * dort zweigt auch sein Heimathafen (4 Liegeplätze) ab. */
(function (root) {
  'use strict';

  const RING = 64, QUAD = 16, BERTHS = 4, FLEET = 4;
  const DEAL = [6, 5, 4, 3, 2];

  // Kartensatz: 108 Karten
  const DECK = [
    ['A', 8], ['K', 8],
    ['2', 7], ['3', 7], ['5', 7], ['6', 7], ['8', 7], ['9', 7], ['10', 7], ['12', 7],
    ['4', 8], ['7', 8],
    ['swap', 8], ['pilot', 4], ['wake', 4], ['whale', 4],
  ];
  const TYPES = DECK.map(d => d[0]);
  const PLAIN_TYPES = TYPES.filter(t => t !== 'pilot');
  const STEPS = {
    A: [1, 11], K: [13], '2': [2], '3': [3], '4': [4, -4], '5': [5], '6': [6],
    '8': [8], '9': [9], '10': [10], '12': [12],
  };

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
  function nextSeat(state, seat) {
    const s = state.seats;
    return s[(s.indexOf(seat) + 1) % s.length];
  }
  const fleet = (state, owner) => state.ships.filter(s => s.owner === owner);
  const fleetHome = (state, owner) => fleet(state, owner).every(s => s.at === 'harbor');
  function teamHome(state, t) {
    return state.ships.every(s => team(state, s.owner) !== t || s.at === 'harbor');
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
  function harborMap(state, owner) {
    const h = new Array(BERTHS).fill(null);
    for (const s of state.ships) if (s.at === 'harbor' && s.owner === owner) h[s.i] = s;
    return h;
  }
  const isBlocked = (state, ring, f) => state.whale === f || (ring[f] !== null && ring[f].fresh);

  function cloneBoard(state) {
    return {
      mode: state.mode, seats: state.seats, whale: state.whale,
      ships: state.ships.map(s => ({ id: s.id, owner: s.owner, at: s.at, i: s.i, fresh: s.fresh })),
    };
  }
  function boardKey(b) {
    let k = '' + b.whale;
    for (const s of b.ships) k += (s.at === 'ring' ? 'r' : s.at === 'harbor' ? 'h' : 'b') + s.i + (s.fresh ? 'f' : '');
    return k;
  }

  /* ---------- Zugmöglichkeiten eines Schiffs ---------- */
  function forward(state, ship, n, ring) {
    ring = ring || ringMap(state);
    const out = [];
    if (ship.at === 'harbor') {
      if (ship.i + n > BERTHS - 1) return out;
      const h = harborMap(state, ship.owner), path = [];
      for (let k = 1; k <= n; k++) {
        if (h[ship.i + k]) return out;
        path.push({ at: 'harbor', i: ship.i + k });
      }
      out.push({ harbor: true, dest: path[n - 1], path });
      return out;
    }
    if (ship.at !== 'ring') return out;
    const p = ship.i, S = startField(ship.owner);
    // auf dem Ring bleiben
    let ok = true, path = [];
    for (let k = 1; k <= n; k++) {
      const f = (p + k) % RING;
      if (isBlocked(state, ring, f)) { ok = false; break; }
      path.push({ at: 'ring', i: f });
    }
    if (ok) out.push({ harbor: false, dest: path[n - 1], path });
    // in den Heimathafen einlaufen (nicht direkt nach dem Auslaufen)
    if (!ship.fresh) {
      const d = (S - p + RING) % RING;
      if (d < n && n - d <= BERTHS) {
        ok = true; path = [];
        for (let k = 1; k <= d; k++) {
          const f = (p + k) % RING;
          if (isBlocked(state, ring, f)) { ok = false; break; }
          path.push({ at: 'ring', i: f });
        }
        if (ok) {
          const h = harborMap(state, ship.owner);
          for (let j = 0; j < n - d; j++) {
            if (h[j]) { ok = false; break; }
            path.push({ at: 'harbor', i: j });
          }
        }
        if (ok) out.push({ harbor: true, dest: path[path.length - 1], path });
      }
    }
    return out;
  }
  function backward(state, ship, n, ring) {
    if (ship.at !== 'ring') return [];
    ring = ring || ringMap(state);
    const path = [];
    for (let k = 1; k <= n; k++) {
      const f = (ship.i - k + RING) % RING;
      if (isBlocked(state, ring, f)) return [];
      path.push({ at: 'ring', i: f });
    }
    return [{ harbor: false, dest: path[n - 1], path }];
  }

  function capture(ship) { ship.at = 'base'; ship.i = ship.id % FLEET; ship.fresh = false; }

  /* Setzt ein Schiff ein Feld weiter (Baustein der 7). Gibt die ID eines geschlagenen Schiffs zurück. */
  function stepOnce(board, ship, dest) {
    let hit = null;
    if (dest.at === 'ring') {
      const other = board.ships.find(s => s !== ship && s.at === 'ring' && s.i === dest.i);
      if (other) { capture(other); hit = other.id; }
    }
    ship.at = dest.at; ship.i = dest.i; ship.fresh = false;
    return hit;
  }

  /* Kann die 7 mit `left` Restschritten noch vollständig gezogen werden? */
  function canFinish(board, seat, left, memo) {
    if (left === 0) return true;
    if (teamHome(board, team(board, seat))) return true;
    const key = boardKey(board) + '|' + left;
    if (memo.has(key)) return memo.get(key);
    let res = false;
    const ctrl = controlOwner(board, seat);
    outer:
    for (const ship of board.ships) {
      if (ship.owner !== ctrl || ship.at === 'base') continue;
      for (const opt of forward(board, ship, 1)) {
        const b2 = cloneBoard(board);
        stepOnce(b2, b2.ships[ship.id], opt.dest);
        if (canFinish(b2, seat, left - 1, memo)) { res = true; break outer; }
      }
    }
    memo.set(key, res);
    return res;
  }

  /* Alle Teilzüge (Schiff, Schrittzahl) der 7, nach denen der Rest noch aufgeht. */
  function sevenOptions(state, seat, left) {
    const memo = new Map(), out = [];
    const ctrl = controlOwner(state, seat);
    const t = team(state, seat);
    state.ships.forEach((ship, idx) => {
      if (ship.owner !== ctrl || ship.at === 'base') return;
      (function explore(board, k, path) {
        const cur = board.ships[idx];
        for (const opt of forward(board, cur, 1)) {
          const b2 = cloneBoard(board);
          const hit = stepOnce(b2, b2.ships[idx], opt.dest);
          const step = { at: opt.dest.at, i: opt.dest.i };
          if (hit !== null) step.hit = hit;
          const path2 = path.concat([step]);
          const k2 = k + 1;
          const won = teamHome(b2, t);
          if (won || canFinish(b2, seat, left - k2, memo)) {
            out.push({ ship: ship.id, n: k2, harbor: opt.dest.at === 'harbor', dest: { at: step.at, i: step.i }, path: path2 });
          }
          if (k2 < left && !won) explore(b2, k2, path2);
        }
      })(cloneBoard(state), 0, []);
    });
    return out;
  }

  /* ---------- Aktionen je Kartentyp ---------- */
  function typeActions(state, seat, type) {
    const out = [];
    const ctrl = controlOwner(state, seat);
    const ring = ringMap(state);
    const mine = state.ships.filter(s => s.owner === ctrl);

    if (type === 'A' || type === 'K') {
      const S = startField(ctrl);
      const docked = mine.find(s => s.at === 'base');
      if (docked && !(ring[S] && ring[S].fresh)) {
        out.push({ k: 'launch', ship: docked.id, dest: { at: 'ring', i: S }, path: [{ at: 'ring', i: S }] });
      }
    }
    if (STEPS[type]) {
      for (const n of STEPS[type]) {
        for (const ship of mine) {
          const opts = n > 0 ? forward(state, ship, n, ring) : backward(state, ship, -n, ring);
          for (const o of opts) out.push({ k: 'move', ship: ship.id, n, harbor: o.harbor, dest: o.dest, path: o.path });
        }
      }
    } else if (type === '7') {
      for (const o of sevenOptions(state, seat, 7)) {
        out.push({ k: 'seven', ship: o.ship, n: o.n, harbor: o.harbor, dest: o.dest, path: o.path });
      }
    } else if (type === 'swap') {
      for (const ship of mine) {
        if (ship.at !== 'ring' || ship.fresh) continue;
        for (const other of state.ships) {
          if (other.owner === ctrl || other.at !== 'ring' || other.fresh) continue;
          out.push({ k: 'swap', ship: ship.id, target: other.id });
        }
      }
    } else if (type === 'wake') {
      for (const ship of mine) {
        if (ship.at !== 'ring') continue;
        let free = 0, found = false;
        for (let k = 1; k < RING; k++) {
          const f = (ship.i + k) % RING;
          if (ring[f] !== null || state.whale === f) { found = true; break; }
          free++;
        }
        if (!found || free === 0) continue;
        const path = [];
        for (let k = 1; k <= free; k++) path.push({ at: 'ring', i: (ship.i + k) % RING });
        out.push({ k: 'wake', ship: ship.id, dest: path[free - 1], path });
      }
    } else if (type === 'whale') {
      for (let f = 0; f < RING; f++) {
        if (f % QUAD === 0 || ring[f] !== null || state.whale === f) continue;
        out.push({ k: 'whale', field: f });
      }
    }
    return out;
  }

  function cardActions(state, seat, card, cache) {
    const types = card.type === 'pilot' ? PLAIN_TYPES : [card.type];
    const out = [];
    for (const as of types) {
      let acts = cache && cache[as];
      if (!acts) { acts = typeActions(state, seat, as); if (cache) cache[as] = acts; }
      for (const a of acts) out.push(Object.assign({}, a, { card: card.id, as }));
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
    if (state.seven) {
      return sevenOptions(state, seat, state.seven.left).map(o => ({
        k: 'step', ship: o.ship, n: o.n, harbor: o.harbor, dest: o.dest, path: o.path,
      }));
    }
    const out = [], cache = {};
    for (const card of state.hands[seat]) if (card) out.push.apply(out, cardActions(state, seat, card, cache));
    if (!out.length) out.push({ k: 'fold' });
    return out;
  }

  function sameAction(a, b) {
    return a.k === b.k && a.card === b.card && a.as === b.as && a.ship === b.ship &&
      a.n === b.n && !!a.harbor === !!b.harbor && a.target === b.target && a.field === b.field;
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
      case 'move': case 'wake': {
        const from = { at: ship.at, i: ship.i };
        const path = action.path.map(p => ({ at: p.at, i: p.i }));
        const dest = path[path.length - 1];
        if (dest.at === 'ring') {
          const other = board.ships.find(s => s !== ship && s.at === 'ring' && s.i === dest.i);
          if (other) { capture(other); dest.hit = other.id; }
        }
        ship.at = dest.at; ship.i = dest.i; ship.fresh = false;
        ev.push({ t: 'move', ship: ship.id, from, path, back: action.n < 0, home: dest.at === 'harbor' && from.at !== 'harbor' });
        break;
      }
      case 'seven': case 'step': {
        const from = { at: ship.at, i: ship.i };
        const path = [];
        for (const p of action.path) {
          const hit = stepOnce(board, ship, p);
          const st = { at: p.at, i: p.i };
          if (hit !== null) st.hit = hit;
          path.push(st);
        }
        ev.push({ t: 'move', ship: ship.id, from, path, home: ship.at === 'harbor' && from.at !== 'harbor' });
        break;
      }
      case 'swap': {
        const other = board.ships[action.target];
        const a = { at: ship.at, i: ship.i }, b = { at: other.at, i: other.i };
        ship.i = b.i; other.i = a.i; ship.fresh = false; other.fresh = false;
        ev.push({ t: 'swap', a: ship.id, b: other.id, posA: b, posB: a });
        break;
      }
      case 'whale': {
        const from = board.whale;
        board.whale = action.field;
        ev.push({ t: 'whale', from, to: action.field });
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
      v: 1, mode, seats,
      seed: (opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 2 ** 31)) | 0,
      ships: [], whale: -1,
      deck: [], discard: [], hands: {},
      dealer: 0, turn: 0, round: 0, phase: 'play',
      give: {}, out: {}, seven: null, winner: null,
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
    state.dealer = opts.dealer !== undefined ? opts.dealer : seats[Math.floor(rnd(state) * seats.length)];
    const ev = [];
    startRound(state, ev);
    return { state, events: ev };
  }

  function startRound(state, ev) {
    const size = DEAL[state.round % DEAL.length];
    const need = size * state.seats.length;
    if (state.whale >= 0) { ev.push({ t: 'whaleOff', from: state.whale }); state.whale = -1; }
    if (state.deck.length < need) {
      state.deck = shuffle(state, state.deck.concat(state.discard));
      state.discard = [];
      ev.push({ t: 'reshuffle' });
    }
    const hands = {};
    for (const s of state.seats) hands[s] = [];
    for (let k = 0; k < size; k++) for (const s of state.seats) hands[s].push(state.deck.pop());
    state.hands = hands;
    state.out = {}; state.give = {}; state.seven = null;
    for (const s of state.seats) { state.out[s] = false; state.give[s] = null; }
    state.turn = nextSeat(state, state.dealer);
    state.phase = state.mode === 'team' ? 'exchange' : 'play';
    const dealt = {};
    for (const s of state.seats) dealt[s] = hands[s].slice();
    ev.push({ t: 'deal', round: state.round, size, dealer: state.dealer, hands: dealt });
    if (state.phase === 'play') ev.push({ t: 'turn', seat: state.turn });
  }

  function advance(state, ev) {
    let s = state.turn;
    for (let k = 0; k < state.seats.length; k++) {
      s = nextSeat(state, s);
      if (!state.out[s] && state.hands[s].length > 0) {
        state.turn = s;
        ev.push({ t: 'turn', seat: s });
        return;
      }
    }
    ev.push({ t: 'roundEnd', round: state.round });
    state.dealer = nextSeat(state, state.dealer);
    state.round++;
    startRound(state, ev);
  }

  function checkWin(state, seat, ev) {
    const t = team(state, seat);
    if (teamHome(state, t)) {
      state.phase = 'over'; state.winner = t; state.seven = null;
      ev.push({ t: 'win', team: t });
      return true;
    }
    return false;
  }

  /* Führt eine Aktion aus. Gibt { ok, events } oder { ok:false, error } zurück. */
  function apply(state, seat, action) {
    const ev = [];
    if (state.phase === 'over') return { ok: false, error: 'Die Partie ist beendet.' };
    if (!state.seats.includes(seat)) return { ok: false, error: 'Unbekannter Platz.' };

    if (state.phase === 'exchange') {
      if (action.k !== 'give') return { ok: false, error: 'Erst wird getauscht.' };
      if (state.give[seat] !== null) return { ok: false, error: 'Du hast schon eine Karte gewählt.' };
      const card = state.hands[seat].find(c => c.id === action.card);
      if (!card) return { ok: false, error: 'Diese Karte hast du nicht.' };
      state.give[seat] = card.id;
      ev.push({ t: 'gave', seat });
      if (state.seats.every(s => state.give[s] !== null)) {
        const got = {};
        for (const s of state.seats) {
          const p = partner(state, s);
          const idx = state.hands[s].findIndex(c => c.id === state.give[s]);
          got[p] = state.hands[s].splice(idx, 1)[0];
        }
        for (const s of state.seats) state.hands[s].push(got[s]);
        state.phase = 'play';
        ev.push({ t: 'exchanged', got });
        ev.push({ t: 'turn', seat: state.turn });
      }
      return { ok: true, events: ev };
    }

    if (seat !== state.turn) return { ok: false, error: 'Du bist nicht am Zug.' };

    if (state.seven) {
      if (action.k !== 'step') return { ok: false, error: 'Erst die 7 zu Ende ziehen.' };
      const legal = sevenOptions(state, seat, state.seven.left)
        .find(o => o.ship === action.ship && o.n === action.n && o.harbor === !!action.harbor);
      if (!legal) return { ok: false, error: 'Dieser Zug ist nicht möglich.' };
      effect(state, { k: 'step', ship: legal.ship, path: legal.path }, ev);
      state.seven.left -= legal.n;
      if (checkWin(state, seat, ev)) return { ok: true, events: ev };
      if (state.seven.left <= 0) { state.seven = null; advance(state, ev); }
      else ev.push({ t: 'sevenLeft', seat, left: state.seven.left });
      return { ok: true, events: ev };
    }

    if (action.k === 'fold') {
      const acts = legalActions(state, seat);
      if (!(acts.length === 1 && acts[0].k === 'fold')) return { ok: false, error: 'Du kannst noch eine Karte spielen.' };
      const cards = state.hands[seat].splice(0);
      state.discard.push.apply(state.discard, cards);
      state.out[seat] = true;
      ev.push({ t: 'fold', seat, cards });
      advance(state, ev);
      return { ok: true, events: ev };
    }

    const idx = state.hands[seat].findIndex(c => c.id === action.card);
    if (idx < 0) return { ok: false, error: 'Diese Karte hast du nicht.' };
    const card = state.hands[seat][idx];
    const as = card.type === 'pilot' ? action.as : card.type;
    if (!PLAIN_TYPES.includes(as)) return { ok: false, error: 'Unbekannte Karte.' };
    const legal = typeActions(state, seat, as)
      .map(a => Object.assign(a, { card: card.id, as }))
      .find(a => sameAction(a, Object.assign({}, action, { as })));
    if (!legal) return { ok: false, error: 'Dieser Zug ist nicht möglich.' };

    state.hands[seat].splice(idx, 1);
    state.discard.push(card);
    ev.push({ t: 'play', seat, card: { id: card.id, type: card.type }, as });
    effect(state, legal, ev);
    if (checkWin(state, seat, ev)) return { ok: true, events: ev };
    if (legal.k === 'seven' && legal.n < 7) {
      state.seven = { seat, left: 7 - legal.n };
      ev.push({ t: 'sevenLeft', seat, left: state.seven.left });
    } else {
      advance(state, ev);
    }
    return { ok: true, events: ev };
  }

  /* ---------- Sicht eines Platzes (verdeckte Karten der anderen) ---------- */
  function view(state, seat) {
    const v = {
      v: state.v, mode: state.mode, seats: state.seats.slice(),
      ships: state.ships.map(s => Object.assign({}, s)), whale: state.whale,
      deckN: state.deck.length,
      top: state.discard.slice(-3),
      hands: {}, dealer: state.dealer, turn: state.turn, round: state.round, phase: state.phase,
      give: {}, out: Object.assign({}, state.out),
      seven: state.seven ? Object.assign({}, state.seven) : null,
      winner: state.winner, me: seat,
    };
    for (const s of state.seats) {
      v.hands[s] = s === seat ? state.hands[s].map(c => Object.assign({}, c)) : state.hands[s].map(() => null);
      v.give[s] = s === seat ? state.give[s] : (state.give[s] !== null ? true : null);
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
    RING, QUAD, BERTHS, FLEET, DEAL, DECK, TYPES, PLAIN_TYPES, STEPS,
    newGame, apply, view, eventsFor, legalActions, cardActions, typeActions, sevenOptions,
    effect, cloneBoard, boardKey, forward, backward,
    team, partner, nextSeat, controlOwner, teamHome, fleetHome, startField, sameAction,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  root.SG = root.SG || {};
  root.SG.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
