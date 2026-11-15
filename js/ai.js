/* Seegang – Computergegner.
 * Bewertet jede erlaubte Aktion, indem er sie auf einer Kopie des Spielfelds ausführt
 * und die Lage aus Sicht des eigenen Teams einschätzt. Sieht nur, was ein Mensch auch sähe. */
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.SG.Engine;
  const RING = E.RING;

  function shipValue(board, s, ring) {
    if (s.at === 'base' || s.at === 'none') return 0;
    if (s.at === 'harbor') return 82 + s.i * 5;
    const S = E.startField(s.owner);
    const d = (S - s.i + RING) % RING;
    let v = 12 + (s.fresh ? 0 : (RING - d) * 0.9);
    // Wal liegt im Weg
    if (board.whale >= 0) {
      const wd = (board.whale - s.i + RING) % RING;
      const toGo = s.fresh ? RING : (d === 0 ? RING : d);
      if (wd > 0 && wd <= 13 && wd <= toGo) v -= 7 * (1 - wd / 20);
    }
    // Gefahr: Gegner dicht dahinter können das Schiff schlagen
    if (!s.fresh) {
      let risk = 0;
      const t = E.team(board, s.owner);
      for (let k = 1; k <= 13; k++) {
        const o = ring[(s.i - k + RING) % RING];
        if (o && E.team(board, o.owner) !== t) risk += k === 4 ? 0.05 : 0.11;
      }
      const o4 = ring[(s.i + 4) % RING];
      if (o4 && E.team(board, o4.owner) !== t) risk += 0.08;
      // auf fremdem Startfeld, solange dort noch Schiffe in der Werft liegen
      if (s.i % E.QUAD === 0) {
        const own = s.i / E.QUAD;
        if (own !== s.owner && E.team(board, own) !== t &&
            board.ships.some(x => x.owner === own && x.at === 'base')) risk += 0.2;
      }
      v *= 1 - Math.min(0.6, risk);
    }
    return v;
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

  /* Bester erreichbarer Wert, wenn noch `left` Schritte der 7 zu ziehen sind. */
  function bestSeven(board, seat, left, memo) {
    const myTeam = E.team(board, seat);
    if (left === 0 || E.teamHome(board, myTeam)) return evaluate(board, myTeam) + (E.teamHome(board, myTeam) ? 1000 : 0);
    const key = E.boardKey(board) + '|' + left;
    if (memo.has(key)) return memo.get(key);
    let best = -Infinity;
    const ctrl = E.controlOwner(board, seat);
    for (const ship of board.ships) {
      if (ship.owner !== ctrl || ship.at === 'base' || ship.at === 'none') continue;
      for (const opt of E.forward(board, ship, 1)) {
        const b2 = E.cloneBoard(board);
        E.effect(b2, { k: 'step', ship: ship.id, path: [opt.dest] }, []);
        const v = bestSeven(b2, seat, left - 1, memo);
        if (v > best) best = v;
      }
    }
    memo.set(key, best);
    return best;
  }

  const CARD_COST = { pilot: 6, whale: 1.5, swap: 0.5, wake: 0.5 };

  function scoreAction(view, seat, a, memo) {
    const myTeam = E.team(view, seat);
    const b = E.cloneBoard(view);
    E.effect(b, a, []);
    let score;
    if (E.teamHome(b, myTeam)) score = 2000;
    else if (a.k === 'seven' || a.k === 'step') {
      const left = (a.k === 'seven' ? 7 : view.seven.left) - a.n;
      score = bestSeven(b, seat, left, memo) + a.n * 0.01; // lieber wenige, lange Teilzüge
    } else score = evaluate(b, myTeam);
    if (a.card !== undefined) {
      const card = view.hands[seat].find(c => c && c.id === a.card);
      const type = card ? card.type : a.as;
      score -= CARD_COST[type] || 0;
      // Auslauf-Karten nicht verfahren, solange noch Schiffe in der Werft liegen
      if ((type === 'A' || type === 'K') && a.k !== 'launch') {
        const ctrl = E.controlOwner(view, seat);
        if (view.ships.some(s => s.owner === ctrl && s.at === 'base')) score -= 3;
      }
    }
    return score;
  }

  function chooseGive(view, seat) {
    const hand = view.hands[seat].filter(Boolean);
    const starts = hand.filter(c => c.type === 'A' || c.type === 'K');
    const pilots = hand.filter(c => c.type === 'pilot');
    if (starts.length + pilots.length >= 2 && starts.length) return { k: 'give', card: starts[0].id };
    // sonst die Karte, die mir am wenigsten nützt
    const keep = { pilot: 10, A: 9, K: 9, '7': 6, swap: 5, '4': 4, whale: 4, wake: 3 };
    let best = null, bestV = Infinity;
    for (const c of hand) {
      const v = (keep[c.type] !== undefined ? keep[c.type] : 2 + (+c.type) / 12) + Math.random() * 0.5;
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
    const seen = new Map(); // gleiche Aktion mit gleichem Kartentyp nur einmal bewerten
    let best = null, bestV = -Infinity;
    for (const a of acts) {
      let v;
      const card = a.card !== undefined ? view.hands[seat].find(c => c && c.id === a.card) : null;
      const key = (card ? card.type : '') + '|' + a.k + '|' + a.as + '|' + a.ship + '|' + a.n + '|' + a.harbor + '|' + a.target + '|' + a.field;
      if (seen.has(key)) continue;
      v = scoreAction(view, seat, a, memo) + Math.random() * 0.6;
      seen.set(key, v);
      if (v > bestV) { bestV = v; best = a; }
    }
    return best;
  }

  const AI = { choose, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  root.SG = root.SG || {};
  root.SG.AI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
