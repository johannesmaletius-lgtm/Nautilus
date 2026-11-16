/* Seefahrt – Computergegner.
 * Bewertet jede erlaubte Aktion, indem er sie auf einer Kopie des Spielfelds ausführt
 * und die Lage aus Sicht des eigenen Teams einschätzt. Sieht nur, was ein Mensch auch sähe. */
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.SG.Engine;
  const RING = E.RING;

  function shipValue(board, s, ring) {
    if (s.at === 'base' || s.at === 'none') return 0;
    if (s.at === 'harbor') return 84 + s.i * 3; // weiter hinten im Hafen ist besser: der Eingang bleibt frei
    const S = E.startField(s.owner);
    const d = (S - s.i + RING) % RING;
    let progress = s.fresh ? 0 : RING - d;
    // in der Bucht: vor dem Hai und vor anderen Schiffen sicher
    if (s.at === 'bay') return 12 + progress * 0.9 + (board.shark >= 0 ? 2 : 0.5);
    // knapp hinter dem Startfeld: mit der 4 rückwärts in den Hafen
    const k0 = (s.i - S + RING) % RING;
    if (!s.fresh && k0 >= 1 && k0 <= 3) progress = Math.max(progress, 44 - k0 * 4);
    let v = 12 + progress * 0.9;
    if (s.fresh) return v;
    let risk = 0;
    // der Hai
    if (board.shark >= 0) {
      const sd = (s.i - board.shark + RING) % RING;
      if (sd >= 1 && sd <= 6) risk += (7 - sd) / 6 * 0.3;
      let first = true;
      for (let k = 1; k < sd; k++) if (ring[(board.shark + k) % RING]) { first = false; break; }
      if (first && sd > 0) risk += 0.06;
    }
    // Gegner dicht dahinter können das Schiff schlagen (sofern niemand dazwischen liegt)
    const t = E.team(board, s.owner);
    for (let k = 1; k <= 12; k++) {
      const o = ring[(s.i - k + RING) % RING];
      if (!o) continue;
      if (E.team(board, o.owner) !== t) risk += k === 5 || k === 11 ? 0.04 : 0.1;
      break;
    }
    const o4 = ring[(s.i + 4) % RING];
    if (o4 && E.team(board, o4.owner) !== t) risk += 0.06;
    // auf fremdem Startfeld, solange dort noch Schiffe in der Werft liegen
    if (s.i % E.QUAD === 0) {
      const own = s.i / E.QUAD;
      if (own !== s.owner && E.team(board, own) !== t &&
          board.ships.some(x => x.owner === own && x.at === 'base')) risk += 0.2;
    }
    return v * (1 - Math.min(0.7, risk));
  }

  function evaluate(board, myTeam) {
    const ring = new Array(RING).fill(null);
    for (const s of board.ships) if (s.at === 'ring') ring[s.i] = s;
    let score = 0;
    for (const s of board.ships) {
      if (s.at === 'none') continue;
      const v = shipValue(board, s, ring);
      score += E.team(board, s.owner) === myTeam ? v : -v;
    }
    return score;
  }
  function winScore(board, myTeam) {
    for (const t of board.mode === 'team' ? [0, 1] : board.seats) {
      if (E.teamHome(board, t)) return t === myTeam ? 2000 : -2000;
    }
    return null;
  }

  /* Bester erreichbarer Wert, wenn von der 5 noch `left` Schritte zu verteilen sind. */
  function bestSplit(board, myTeam, persp, left, moved, memo) {
    const w = winScore(board, myTeam);
    if (w !== null) return w;
    if (left === 0) return evaluate(board, myTeam);
    const key = E.boardKey(board) + '|' + left + '|' + moved.slice().sort((a, b) => a - b).join(',');
    if (memo.has(key)) return memo.get(key);
    let best = -Infinity;
    for (const ship of E.splitShips(board, persp, moved)) {
      for (let n = 1; n <= left; n++) {
        for (const opt of E.forward(board, ship, n)) {
          const b2 = E.cloneBoard(board);
          E.effect(b2, { k: 'step', ship: ship.id, path: opt.path }, []);
          const v = bestSplit(b2, myTeam, persp, left - n, moved.concat(ship.id), memo);
          if (v > best) best = v;
        }
      }
    }
    if (best === -Infinity) best = evaluate(board, myTeam) - 30; // geht nicht auf – nicht erstrebenswert
    memo.set(key, best);
    return best;
  }

  const KEEP = { pilot: 7, '1': 8, '12': 8, '7': 6, swap: 5, '4': 5, '5': 4, board: 4, shark: 3, storm: 3, '8': 3.5, vision: 1.5, trade: 1 };
  const keepValue = c => (KEEP[c.type] !== undefined ? KEEP[c.type] : 2 + (+c.type) / 12);
  const CARD_COST = { pilot: 2, swap: 1, '7': 0.8, board: 0.5 };

  function scoreAction(view, seat, a, memo) {
    const myTeam = E.team(view, seat);
    const pend = view.pend;
    const b = E.cloneBoard(view);
    const base = () => evaluate(b, myTeam);
    let score;
    switch (a.k) {
      case 'launch': case 'move': case 'swap': case 'shark':
        E.effect(b, a, []);
        score = base();
        break;
      case 'split': case 'step': {
        E.effect(b, { k: 'step', ship: a.ship, path: a.path }, []);
        const persp = pend && pend.k === 'split' ? pend.as : pend && pend.k === 'board' ? pend.victim : seat;
        const left = a.k === 'split' ? E.SPLIT - a.n : pend.left - a.n;
        const moved = (a.k === 'split' ? [] : pend.moved).concat(a.ship);
        score = bestSplit(b, myTeam, persp, left, moved, memo);
        break;
      }
      case 'pilot':
        if (view.last) E.restore(b, view.last.snap, []);
        if (b.shark < 0) E.sharkAppear(b, seat, []);
        score = base() + 2.5;
        break;
      case 'skip': score = base() + (E.team(view, a.target) !== myTeam ? 3 : -6); break;
      case 'board': score = base() + (E.team(view, a.target) !== myTeam ? 3 : 0.5); break;
      case 'trade': score = base() + 0.3; break;
      case 'vision': score = base() + 0.2; break;
      case 'storm': score = base() + 1.2; break;
      case 'discard': case 'fold': {
        const c = view.hands[seat].find(x => x && x.id === a.card);
        return -(c ? keepValue(c) : 0);
      }
      default: score = base();
    }
    const w = winScore(b, myTeam);
    if (w !== null) score = w;
    if (a.card !== undefined && !(pend && pend.k === 'board')) {
      const card = view.hands[seat].find(c => c && c.id === a.card);
      const type = card ? card.type : null;
      score -= CARD_COST[type] || 0;
      // Auslauf-Karten nicht verfahren, solange noch Schiffe in der Werft liegen
      if ((type === '1' || type === '12') && a.k !== 'launch') {
        const ctrl = E.controlOwner(view, seat);
        if (view.ships.some(s => s.owner === ctrl && s.at === 'base')) score -= 3;
      }
    }
    return score;
  }

  function chooseGive(view, seat) {
    const hand = view.hands[seat].filter(Boolean);
    const starts = hand.filter(c => c.type === '1' || c.type === '12');
    if (starts.length >= 2) return { k: 'give', card: starts[0].id };
    // sonst die Karte, die mir am wenigsten nützt
    let best = null, bestV = Infinity;
    for (const c of hand) {
      const v = keepValue(c) + Math.random() * 0.5;
      if (v < bestV) { bestV = v; best = c; }
    }
    return { k: 'give', card: best.id };
  }

  function choose(view, seat) {
    if (view.phase === 'exchange') return chooseGive(view, seat);
    const acts = E.legalActions(view, seat);
    if (!acts.length) return null;
    if (acts.length === 1) return acts[0];
    const memo = new Map();
    const seen = new Set(); // gleiche Aktion mit gleichem Kartentyp nur einmal bewerten
    const holder = view.pend && view.pend.k === 'board' ? view.pend.victim : seat;
    let best = null, bestV = -Infinity;
    for (const a of acts) {
      const card = a.card !== undefined ? view.hands[holder].find(c => c && c.id === a.card) : null;
      const key = (card ? card.type : '') + '|' + a.k + '|' + a.ship + '|' + a.n + '|' + a.harbor + '|' + a.bay + '|' + a.target;
      if (seen.has(key)) continue;
      seen.add(key);
      const v = scoreAction(view, seat, a, memo) + Math.random() * 0.6;
      if (v > bestV) { bestV = v; best = a; }
    }
    return best;
  }

  const AI = { choose, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  root.SG = root.SG || {};
  root.SG.AI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
