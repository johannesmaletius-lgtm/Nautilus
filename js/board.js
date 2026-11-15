/* Seefahrt – Spielfeld (SVG): Geometrie, Figuren, Markierungen und Bewegungsanimationen. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};
  const E = SG.Engine;
  const NS = 'http://www.w3.org/2000/svg';
  const C = 500, R = 450, A0 = 135;

  const COLORS = ['#35689A', '#C4533F', '#4F7F45', '#DFA636'];
  const COLOR_NAMES = ['Blau', 'Rot', 'Grün', 'Gelb'];
  const NAVY = '#16335C', PAPER = '#FFF8EA';

  const sleep = ms => new Promise(r => setTimeout(r, ms * (SG.speed || 1)));
  function polar(r, deg) {
    const a = deg * Math.PI / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  }
  function pos(at, i, owner) {
    if (at === 'ring') return polar(R, A0 + i * 360 / E.RING);
    if (at === 'harbor') return polar(R - 47 * (i + 1), A0 + owner * 90);
    return polar(526, A0 + owner * 90 + (i - 1.5) * 6.7);
  }
  function mk(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  // Spielfiguren: ausgeschnittene Fotos der Schiffe, Standfläche auf der Feldmitte
  const FIG_H = 76, FIG_W = 60;
  const figure = seat => `assets/fig-${seat}.webp`;

  let svg, rot, gMarks, gShips, gFx, sharkEl, sharkIn;
  let ships = {};          // id -> {el, inner, owner}
  let targets = [];        // aktuelle Tipp-Ziele
  let onMiss = null;
  let viewer = 0, rotDeg = 0;

  function build(svgEl) {
    svg = svgEl;
    svg.innerHTML = '';
    rot = mk('g', { id: 'rot' }, svg);
    const deco = mk('g', { class: 'deco', filter: 'url(#rough)' }, rot);
    // Fahrrinne
    mk('circle', { cx: C, cy: C, r: R, fill: 'none', stroke: '#EFE0C2', 'stroke-width': 50 }, deco);
    mk('circle', { cx: C, cy: C, r: R + 27, fill: 'none', stroke: '#1B5EB0', 'stroke-width': 1.3, opacity: 0.45 }, deco);
    mk('circle', { cx: C, cy: C, r: R - 27, fill: 'none', stroke: '#1B5EB0', 'stroke-width': 1.3, opacity: 0.45 }, deco);
    // Gradstriche zwischen den Feldern
    for (let i = 0; i < E.RING; i++) {
      const a = A0 + (i + 0.5) * 360 / E.RING;
      const [x1, y1] = polar(R + 27, a), [x2, y2] = polar(R + (i % 4 === 3 ? 38 : 33), a);
      mk('line', { x1, y1, x2, y2, stroke: '#1B5EB0', 'stroke-width': 1.2, opacity: 0.4 }, deco);
    }
    // Kompass in der Mitte
    mk('circle', { cx: C, cy: C, r: 226, fill: 'none', stroke: '#1B5EB0', 'stroke-width': 1.2, opacity: 0.45 }, deco);
    mk('circle', { cx: C, cy: C, r: 218, fill: '#16335C' }, deco);
    const img = mk('image', { x: C - 214, y: C - 214, width: 428, height: 428, class: 'medallion' }, rot);
    img.setAttribute('href', 'assets/compass.webp');

    const fields = mk('g', { class: 'fields', filter: 'url(#rough)' }, rot);
    // Heimathäfen und Werften
    for (let s = 0; s < 4; s++) {
      const col = COLORS[s];
      const g = mk('g', { class: 'home h' + s, 'data-seat': s }, fields);
      const [sx, sy] = pos('ring', s * E.QUAD), [ex, ey] = pos('harbor', 3, s);
      mk('line', { x1: sx, y1: sy, x2: ex, y2: ey, stroke: col, 'stroke-width': 2, opacity: 0.55 }, g);
      for (let j = 0; j < E.BERTHS; j++) {
        const [x, y] = pos('harbor', j, s);
        mk('circle', { cx: x, cy: y, r: 14, fill: PAPER, stroke: col, 'stroke-width': 2.6 }, g);
      }
      const [ax, ay] = pos('base', 0, s), [bx, by] = pos('base', 3, s);
      mk('path', { d: `M${ax} ${ay}A526 526 0 0 1 ${bx} ${by}`, fill: 'none', stroke: col, 'stroke-width': 2, opacity: 0.5 }, g);
      for (let j = 0; j < E.FLEET; j++) {
        const [x, y] = pos('base', j, s);
        mk('circle', { cx: x, cy: y, r: 14, fill: '#F7ECD6', stroke: col, 'stroke-width': 2.2, 'stroke-dasharray': '4 4' }, g);
      }
    }
    // Ringfelder
    for (let i = 0; i < E.RING; i++) {
      const [x, y] = pos('ring', i);
      if (i % E.QUAD === 0) {
        const s = i / E.QUAD;
        mk('circle', { cx: x, cy: y, r: 19, fill: PAPER, stroke: COLORS[s], 'stroke-width': 4, class: 'start', 'data-seat': s }, fields);
      } else {
        mk('circle', { cx: x, cy: y, r: 13.5, fill: PAPER, stroke: '#1B5EB0', 'stroke-width': 2.2 }, fields);
      }
    }
    gMarks = mk('g', { class: 'marks' }, rot);
    gShips = mk('g', { class: 'ships' }, rot);
    // Der Weiße Hai: Rückenflosse über den Wellen
    sharkEl = mk('g', { class: 'shark', style: 'display:none' }, gShips);
    sharkIn = mk('g', { class: 'shark-in' }, sharkEl);
    mk('circle', { r: 29, fill: NAVY, stroke: '#C9655C', 'stroke-width': 3.2 }, sharkIn);
    const sUp = mk('g', { class: 'up' }, sharkIn);
    mk('path', { d: 'M-17 7C-10 3-1-9 9-27C5-15 6-3 16 7Z', fill: '#9AA6B2', stroke: PAPER, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, sUp);
    mk('path', { d: 'M-3-4C1-10 5-17 8-24', fill: 'none', stroke: '#C9D1D9', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, sUp);
    mk('path', { d: 'M-21 12q5.250-4.500 10.500 0t10.500 0 10.500 0 10.500 0', fill: 'none', stroke: PAPER, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, sUp);
    gFx = mk('g', { class: 'fx' }, rot);
    ships = {};
    targets = [];

    svg.addEventListener('click', onClick);
  }

  function setMode(view) {
    svg.querySelectorAll('.home').forEach(g => {
      g.style.display = view.seats.includes(+g.dataset.seat) ? '' : 'none';
    });
    svg.querySelectorAll('.start').forEach(c => {
      const used = view.seats.includes(+c.dataset.seat);
      c.setAttribute('stroke', used ? COLORS[+c.dataset.seat] : '#1B5EB0');
      c.setAttribute('stroke-width', used ? 4 : 2.2);
      c.setAttribute('r', used ? 19 : 13.5);
    });
  }

  function setViewer(seat, animate) {
    viewer = seat;
    // kürzesten Weg drehen
    let target = -seat * 90;
    while (target - rotDeg > 180) target -= 360;
    while (target - rotDeg < -180) target += 360;
    rotDeg = target;
    rot.style.transition = animate ? `transform ${1100 * (SG.speed || 1)}ms cubic-bezier(.6,0,.2,1)` : 'none';
    rot.style.transform = `rotate(${rotDeg}deg)`;
    // Figuren bleiben aufrecht, während sich der Tisch dreht
    rot.style.setProperty('--up', -rotDeg + 'deg');
    rot.style.setProperty('--updur', (animate ? 1100 * (SG.speed || 1) : 0) + 'ms');
    if (!animate) { sortShips(); return Promise.resolve(); }
    return sleep(1100).then(sortShips);
  }

  function place(el, xy, dur) {
    el.style.setProperty('--dur', (dur || 0) * (SG.speed || 1) + 'ms');
    el.style.transform = `translate(${xy[0].toFixed(2)}px, ${xy[1].toFixed(2)}px)`;
  }
  function waapi(el, frames, opts) {
    if (!el.animate) return null;
    const k = SG.speed || 1;
    opts.duration *= k;
    if (opts.delay) opts.delay *= k;
    return el.animate(frames, opts);
  }
  function bump(inner, scale, dur) {
    waapi(inner, [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }],
      { duration: dur, easing: 'ease-out' });
  }

  function ensureShip(s) {
    if (ships[s.id]) return ships[s.id];
    const el = mk('g', { class: 'ship', 'data-id': s.id }, gShips);
    mk('circle', { class: 'guard', r: 21.5, fill: 'none', stroke: COLORS[s.owner], 'stroke-width': 2, 'stroke-dasharray': '3.200 3.800' }, el);
    const up = mk('g', { class: 'up' }, el);
    mk('ellipse', { class: 'shade', cx: 3, cy: 5, rx: 24, ry: 8.500, fill: 'rgba(22,51,92,.22)' }, up);
    const inner = mk('g', { class: 'ship-in' }, up);
    const img = mk('image', { x: -FIG_W / 2, y: -FIG_H * 0.86, width: FIG_W, height: FIG_H }, inner);
    img.setAttribute('href', figure(s.owner));
    return (ships[s.id] = { el, inner, owner: s.owner });
  }

  /* Reihenfolge nach Bildschirmtiefe: was weiter unten steht, verdeckt das dahinter. */
  function sortShips() {
    const a = rotDeg * Math.PI / 180, re = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/;
    const items = Array.from(gShips.children).map((el, i) => {
      const m = re.exec(el.style.transform);
      const x = m ? +m[1] - C : 0, y = m ? +m[2] - C : 0;
      return { el, i, sy: x * Math.sin(a) + y * Math.cos(a) };
    });
    const sorted = items.slice().sort((p, q) => p.sy - q.sy || p.i - q.i);
    if (sorted.some((it, k) => it.i !== k)) sorted.forEach(it => gShips.appendChild(it.el));
  }

  /* Stellt alle Figuren ohne Animation auf den Stand der Sicht. */
  function sync(view) {
    const alive = new Set();
    for (const s of view.ships) {
      if (s.at === 'none') continue;
      alive.add(String(s.id));
      const sh = ensureShip(s);
      place(sh.el, pos(s.at, s.i, s.owner), 0);
      sh.el.classList.toggle('fresh', !!s.fresh);
      sh.el.classList.toggle('docked', s.at === 'harbor');
    }
    for (const id in ships) if (!alive.has(id)) { ships[id].el.remove(); delete ships[id]; }
    if (view.shark >= 0) {
      sharkEl.style.display = '';
      place(sharkEl, pos('ring', view.shark), 0);
    } else sharkEl.style.display = 'none';
    sortShips();
  }

  function ripple(xy, color, big) {
    for (let k = 0; k < (big ? 3 : 2); k++) {
      const c = mk('circle', { cx: xy[0], cy: xy[1], r: 16, fill: 'none', stroke: color, 'stroke-width': 2.5, class: 'ripple' }, gFx);
      const a = waapi(c,
        [{ transform: 'scale(.6)', opacity: 0.85 }, { transform: `scale(${big ? 4.2 : 3})`, opacity: 0 }],
        { duration: big ? 1000 : 760, delay: k * 150, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' });
      setTimeout(() => c.remove(), ((big ? 1000 : 760) + k * 150) * (SG.speed || 1) + 60);
      if (!a) c.remove();
    }
  }

  async function capture(id) {
    const sh = ships[id]; if (!sh) return;
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(sh.el.style.transform);
    if (m) ripple([+m[1], +m[2]], COLORS[sh.owner], true);
    SG.Sound.capture();
    gShips.appendChild(sh.el);
    sh.el.classList.remove('fresh');
    place(sh.el, pos('base', id % E.FLEET, sh.owner), 680);
    waapi(sh.inner, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.9)', opacity: 0.55 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 680, easing: 'ease-in-out' });
    await sleep(700);
  }

  async function moveShip(id, path) {
    const sh = ships[id]; if (!sh) return;
    gShips.appendChild(sh.el);
    sh.el.classList.remove('fresh');
    const dur = path.length > 8 ? 105 : path.length > 4 ? 125 : 150;
    const pending = [];
    for (let k = 0; k < path.length; k++) {
      const p = path[k];
      place(sh.el, pos(p.at, p.i, sh.owner), dur);
      bump(sh.inner, 1.28, dur);
      SG.Sound.hop(k);
      await sleep(dur);
      if (p.hit !== undefined) pending.push(capture(p.hit));
    }
    const last = path[path.length - 1];
    sh.el.classList.toggle('docked', last.at === 'harbor');
    await Promise.all(pending);
    sortShips();
  }

  async function launch(id, to, hit) {
    const sh = ships[id]; if (!sh) return;
    gShips.appendChild(sh.el);
    SG.Sound.launch();
    place(sh.el, pos(to.at, to.i, sh.owner), 480);
    bump(sh.inner, 1.6, 480);
    await sleep(430);
    ripple(pos(to.at, to.i, sh.owner), COLORS[sh.owner]);
    sh.el.classList.add('fresh');
    if (hit !== undefined) await capture(hit);
    else await sleep(160);
    sortShips();
  }

  async function swap(a, posA, b, posB) {
    const A = ships[a], B = b === -1 ? { el: sharkEl, inner: sharkIn, owner: -1 } : ships[b];
    if (!A || !B) return;
    SG.Sound.swap();
    A.el.classList.remove('fresh'); B.el.classList.remove('fresh');
    gShips.appendChild(A.el); gShips.appendChild(B.el);
    place(A.el, pos(posA.at, posA.i, A.owner), 760);
    place(B.el, pos(posB.at, posB.i, B.owner), 760);
    bump(A.inner, 1.7, 760); bump(B.inner, 1.7, 760);
    await sleep(780);
    ripple(pos(posA.at, posA.i, A.owner), COLORS[A.owner]);
    ripple(pos(posB.at, posB.i, B.owner), B.owner < 0 ? NAVY : COLORS[B.owner]);
    await sleep(200);
    sortShips();
  }

  /* Der Hai taucht auf einem Feld auf (und schlägt, was dort liegt). */
  async function sharkAppear(at, hit) {
    const xy = pos('ring', at);
    place(sharkEl, xy, 0);
    sharkEl.style.display = '';
    gShips.appendChild(sharkEl);
    SG.Sound.whale();
    ripple(xy, NAVY, true);
    waapi(sharkIn,
      [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.35)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 720, easing: 'cubic-bezier(.2,.7,.3,1)' });
    await sleep(500);
    if (hit !== undefined) await capture(hit);
    else await sleep(320);
    sortShips();
  }
  /* Der Hai schwimmt Feld für Feld; wer auf dem Weg liegt, wird geschlagen. */
  async function sharkRun(path) {
    if (!path.length) return;
    gShips.appendChild(sharkEl);
    const dur = path.length > 6 ? 120 : 190;
    const pending = [];
    for (let k = 0; k < path.length; k++) {
      const p = path[k];
      place(sharkEl, pos('ring', p.i), dur);
      bump(sharkIn, 1.2, dur);
      await sleep(dur);
      if (p.hit !== undefined) { SG.Sound.whale(); pending.push(capture(p.hit)); }
    }
    await Promise.all(pending);
    sortShips();
  }
  /* Lotse: Figuren springen auf ihren früheren Platz zurück. */
  async function restore(moves, shark) {
    const jobs = [];
    for (const m of moves) {
      const sh = ships[m.ship]; if (!sh) continue;
      gShips.appendChild(sh.el);
      sh.el.classList.toggle('fresh', !!m.fresh);
      sh.el.classList.toggle('docked', m.to.at === 'harbor');
      place(sh.el, pos(m.to.at, m.to.i, sh.owner), 720);
      bump(sh.inner, 1.5, 720);
      jobs.push(sleep(740).then(() => ripple(pos(m.to.at, m.to.i, sh.owner), COLORS[sh.owner])));
    }
    if (shark && shark.from !== shark.to) {
      if (shark.to < 0) sharkEl.style.display = 'none';
      else { sharkEl.style.display = ''; place(sharkEl, pos('ring', shark.to), 720); bump(sharkIn, 1.4, 720); }
    }
    if (moves.length || (shark && shark.from !== shark.to)) SG.Sound.swap();
    await Promise.all(jobs);
    await sleep(160);
    sortShips();
  }

  function homeGlow(id) {
    const sh = ships[id]; if (!sh) return;
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(sh.el.style.transform);
    if (m) ripple([+m[1], +m[2]], COLORS[sh.owner], true);
    SG.Sound.home();
  }

  /* ---------- Tipp-Ziele ---------- */
  function setTargets(list, missHandler) {
    targets = list || [];
    onMiss = missHandler || null;
    gMarks.innerHTML = '';
    for (const id in ships) ships[id].el.classList.remove('pick', 'sel', 'aim');
    for (const t of targets) {
      t.xy = t.ship !== undefined && t.kind !== 'dest' ? shipXY(t.ship) : pos(t.at, t.i, t.owner);
      if (t.ship !== undefined && t.kind !== 'dest') {
        const a = -rotDeg * Math.PI / 180;
        t.body = [t.xy[0] + Math.sin(a) * -30 * -1, t.xy[1] - Math.cos(a) * 30];
      }
      if (t.kind === 'ship' || t.kind === 'aim') {
        const sh = t.ship === -1 ? null : ships[t.ship];
        if (sh) sh.el.classList.add(t.kind === 'aim' ? 'aim' : 'pick');
        mk('circle', { cx: t.xy[0], cy: t.xy[1], r: 24, class: 'mark ' + (t.kind === 'aim' ? 'aim' : 'pick'), style: `--c:${t.kind === 'aim' ? '#C9655C' : NAVY}` }, gMarks);
      } else if (t.kind === 'dest') {
        mk('circle', { cx: t.xy[0], cy: t.xy[1], r: 9.5, class: 'mark dest-dot', style: `--c:${t.color || NAVY}` }, gMarks);
        mk('circle', { cx: t.xy[0], cy: t.xy[1], r: 21, class: 'mark dest', style: `--c:${t.color || NAVY}` }, gMarks);
      } else if (t.kind === 'field') {
        mk('circle', { cx: t.xy[0], cy: t.xy[1], r: 7, class: 'mark field-dot', style: `--c:${NAVY}` }, gMarks);
      }
    }
  }
  function setSelected(id) {
    for (const k in ships) ships[k].el.classList.toggle('sel', +k === id);
    gMarks.querySelectorAll('.mark.selring').forEach(n => n.remove());
    if (id !== null && id !== undefined && (ships[id] || id === -1)) {
      const xy = shipXY(id);
      mk('circle', { cx: xy[0], cy: xy[1], r: 24, class: 'mark selring', style: `--c:${NAVY}` }, gMarks);
    }
  }
  function shipXY(id) {
    const el = id === -1 ? sharkEl : ships[id] && ships[id].el;
    const m = el && /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform);
    return m ? [+m[1], +m[2]] : [C, C];
  }
  function toBoard(ev) {
    const r = svg.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * 1000 - C;
    const y = (ev.clientY - r.top) / r.height * 1000 - C;
    const a = -rotDeg * Math.PI / 180;
    return [C + x * Math.cos(a) - y * Math.sin(a), C + x * Math.sin(a) + y * Math.cos(a)];
  }
  function onClick(ev) {
    if (!targets.length) { if (onMiss) onMiss(); return; }
    const [x, y] = toBoard(ev);
    let best = null, bestD = 58 * 58;
    for (const t of targets) {
      let d = (t.xy[0] - x) ** 2 + (t.xy[1] - y) ** 2;
      if (t.body) d = Math.min(d, (t.body[0] - x) ** 2 + (t.body[1] - y) ** 2);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (best) { SG.Sound.tap(); best.pick(); }
    else if (onMiss) onMiss();
  }

  /* Bildschirmposition eines Spielfeldpunkts (für fliegende Karten usw.) */
  function screenXY(xy) {
    const r = svg.getBoundingClientRect();
    const a = rotDeg * Math.PI / 180;
    const x = xy[0] - C, y = xy[1] - C;
    return [r.left + (C + x * Math.cos(a) - y * Math.sin(a)) / 1000 * r.width,
            r.top + (C + x * Math.sin(a) + y * Math.cos(a)) / 1000 * r.height];
  }

  SG.Board = {
    COLORS, COLOR_NAMES, NAVY, build, setMode, setViewer, sync, pos, screenXY,
    moveShip, launch, swap, capture, sharkAppear, sharkRun, restore, homeGlow, ripple, sortShips, figure,
    setTargets, setSelected,
  };
})(window);
