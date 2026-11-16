/* Seefahrt – Spielfeld (SVG): Geometrie, Figuren, Markierungen und Bewegungsanimationen. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};
  const E = SG.Engine;
  const NS = 'http://www.w3.org/2000/svg';
  const C = 500, R = 450, A0 = 135, BAY_R = 512;
  // Zeichenfläche etwas größer als der Ring, damit die Buchten außen Platz haben
  const VB0 = -44, VBW = 1088;

  const COLORS = ['#35689A', '#C4533F', '#4F7F45', '#DFA636'];
  const COLOR_NAMES = ['Blau', 'Rot', 'Grün', 'Gelb'];
  const NAVY = '#16335C', PAPER = '#FFF8EA';
  const FIELD_R = 15, START_R = 20.5;

  const sleep = ms => new Promise(r => setTimeout(r, ms * (SG.speed || 1)));
  function polar(r, deg) {
    const a = deg * Math.PI / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  }
  function pos(at, i, owner) {
    if (at === 'ring') return polar(R, A0 + i * 360 / E.RING);
    if (at === 'harbor') return polar(R - 47 * (i + 1), A0 + owner * 90);
    if (at === 'bay') return polar(BAY_R, A0 + i * 360 / E.RING);
    return polar(526, A0 + owner * 90 + (i - 1.5) * 6.7);
  }
  function mk(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  // Spielfiguren: ausgeschnittene Fotos der Schiffe, Standfläche auf der Feldmitte.
  // Die Breite bleibt knapp unter dem Feldabstand auf dem Ring (≈ 44), damit Nachbarn sich nicht verdecken.
  const FIG_W = 43, FIG_H = 54;
  const figure = seat => `assets/fig-${seat}.webp`;
  const SHARK_W = 52, SHARK_H = 52.7;
  // Die Bilddateien haben rundum 8 px Rand (bei 220 px Figurenhöhe) für die dunkle Kontur.
  const RIM = 8 / 220;
  function figImage(parent, href, w, h, foot) {
    const img = mk('image', { x: -w / 2 - h * RIM, y: -h * foot - h * RIM, width: w + 2 * h * RIM, height: h * (1 + 2 * RIM) }, parent);
    img.setAttribute('href', href);
    return img;
  }
  const WATER = '#1B5EB0', FOAM = '#FFFDF6', GOLD = '#DFA636', WOOD = '#8A5A33', CORAL = '#C9655C';

  let svg, rot, gMarks, gWake, gShips, gFx, sharkEl, sharkIn, shark;
  let ships = {};          // id -> {el, face, inner, shade, owner, f, p}
  let targets = [];        // aktuelle Tipp-Ziele
  let onMiss = null;
  let viewer = 0, rotDeg = 0;

  function build(svgEl) {
    svg = svgEl;
    svg.innerHTML = '';
    // Wasserlinie: was darunter rutscht, verschwindet (Untergehen und Auftauchen)
    const defs = mk('defs', {}, svg);
    mk('rect', { x: -110, y: -170, width: 220, height: 177 }, mk('clipPath', { id: 'sg-water' }, defs));
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
        mk('circle', { cx: x, cy: y, r: 15.5, fill: PAPER, stroke: col, 'stroke-width': 2.6 }, g);
      }
      const [ax, ay] = pos('base', 0, s), [bx, by] = pos('base', 3, s);
      mk('path', { d: `M${ax} ${ay}A526 526 0 0 1 ${bx} ${by}`, fill: 'none', stroke: col, 'stroke-width': 2, opacity: 0.5 }, g);
      for (let j = 0; j < E.FLEET; j++) {
        const [x, y] = pos('base', j, s);
        mk('circle', { cx: x, cy: y, r: 15.5, fill: '#F7ECD6', stroke: col, 'stroke-width': 2.2, 'stroke-dasharray': '4 4' }, g);
      }
    }
    // Buchten: Verstecke vor dem Hai außen am Ring
    for (const f of E.BAYS) {
      const g = mk('g', { class: 'bay' }, fields);
      const [x1, y1] = polar(R + 24, A0 + f * 360 / E.RING), [x2, y2] = polar(BAY_R - 18, A0 + f * 360 / E.RING);
      mk('line', { x1, y1, x2, y2, stroke: '#1B5EB0', 'stroke-width': 2, opacity: 0.6 }, g);
      const [bx, by] = pos('bay', f);
      mk('circle', { cx: bx, cy: by, r: 20, fill: '#DCE9F3', stroke: '#1B5EB0', 'stroke-width': 2.4 }, g);
      mk('path', { d: `M${bx - 10} ${by + 3}q2.500-4 5 0t5 0 5 0 5 0`, fill: 'none', stroke: '#1B5EB0', 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: 0.8 }, g);
    }
    // Ringfelder
    for (let i = 0; i < E.RING; i++) {
      const [x, y] = pos('ring', i);
      if (i % E.QUAD === 0) {
        const s = i / E.QUAD;
        mk('circle', { cx: x, cy: y, r: START_R, fill: PAPER, stroke: COLORS[s], 'stroke-width': 4, class: 'start', 'data-seat': s }, fields);
      } else {
        mk('circle', { cx: x, cy: y, r: FIELD_R, fill: PAPER, stroke: '#1B5EB0', 'stroke-width': 2.2 }, fields);
      }
    }
    gMarks = mk('g', { class: 'marks' }, rot);
    gWake = mk('g', { class: 'wake' }, rot);
    gShips = mk('g', { class: 'ships' }, rot);
    // Der Weiße Hai: freigestellte Figur, bleibt aufrecht wie die Schiffe
    sharkEl = mk('g', { class: 'shark', style: 'display:none' }, gShips);
    mk('circle', { class: 'guard', r: 25, fill: 'none', stroke: CORAL, 'stroke-width': 2.2, 'stroke-dasharray': '3.200 3.800' }, sharkEl);
    const sUp = mk('g', { class: 'up' }, sharkEl);
    const sShade = mk('ellipse', { class: 'shade', cx: 2, cy: 3.5, rx: 20, ry: 7, fill: 'rgba(22,51,92,.34)' }, sUp);
    const sFace = mk('g', { class: 'face' }, sUp);
    sharkIn = mk('g', { class: 'shark-in' }, sFace);
    figImage(sharkIn, 'assets/fig-shark.webp', SHARK_W, SHARK_H, 0.9);
    shark = { el: sharkEl, face: sFace, inner: sharkIn, shade: sShade, owner: -1, f: 1, p: null };
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
      c.setAttribute('r', used ? START_R : FIELD_R);
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
    // der Bug zeigt weiter in Fahrtrichtung
    for (const rec of Object.values(ships).concat(shark)) if (rec.p) setFace(rec, facing(rec.p.at, rec.p.i, rec.owner), animate ? 600 : 0);
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
  const later = (fn, ms) => setTimeout(fn, ms * (SG.speed || 1));
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- Blickrichtung ----------
   * Die Figuren stehen aufrecht, der Bug zeigt aber in Fahrtrichtung: auf dem Ring im Uhrzeigersinn
   * (oben nach rechts, unten nach links), im Hafen und in der Werft zur Mitte. 1 = Bug rechts, -1 = gespiegelt. */
  function facing(at, i, owner) {
    if (at === 'ring' || at === 'bay') {
      const a = (A0 + i * 360 / E.RING + rotDeg + 1) * Math.PI / 180;
      return -Math.sin(a) >= 0 ? 1 : -1;
    }
    return -Math.cos((A0 + owner * 90 + rotDeg) * Math.PI / 180) >= 0 ? 1 : -1;
  }
  function setFace(rec, f, dur) {
    if (rec.f === f) return;
    rec.f = f;
    rec.face.style.transition = dur ? `transform ${dur * (SG.speed || 1)}ms cubic-bezier(.5,0,.3,1)` : 'none';
    rec.face.style.transform = `scaleX(${f})`;
  }
  /* Setzt eine Figur auf ein Feld. face: 'keep' lässt den Bug, 'back' dreht ihn gegen die Fahrtrichtung. */
  function go(rec, p, dur, face) {
    rec.p = { at: p.at, i: p.i };
    place(rec.el, pos(p.at, p.i, rec.owner), dur);
    if (face === 'keep') return;
    const f = facing(p.at, p.i, rec.owner);
    setFace(rec, face === 'back' && p.at !== 'harbor' ? -f : f, dur ? 240 : 0);
  }
  const cur = rec => (rec.p ? pos(rec.p.at, rec.p.i, rec.owner) : [C, C]);
  /* Punkt h Einheiten „über“ einem Feld – auf dem Bildschirm, egal wie der Tisch gedreht ist. */
  function lift(xy, h) {
    const a = -rotDeg * Math.PI / 180;
    return [xy[0] + Math.sin(a) * h, xy[1] - Math.cos(a) * h];
  }
  /* Brettrichtung -> Richtung im aufrechten Figurenraum */
  function upVec(dx, dy) {
    const a = rotDeg * Math.PI / 180;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  }

  function ensureShip(s) {
    if (ships[s.id]) return ships[s.id];
    const el = mk('g', { class: 'ship', 'data-id': s.id }, gShips);
    mk('circle', { class: 'guard', r: 23, fill: 'none', stroke: COLORS[s.owner], 'stroke-width': 2, 'stroke-dasharray': '3.200 3.800' }, el);
    const up = mk('g', { class: 'up' }, el);
    const shade = mk('ellipse', { class: 'shade', cx: 2, cy: 3.5, rx: 18, ry: 6.5, fill: 'rgba(22,51,92,.22)' }, up);
    const face = mk('g', { class: 'face' }, up);
    const inner = mk('g', { class: 'ship-in' }, face);
    figImage(inner, figure(s.owner), FIG_W, FIG_H, 0.86);
    return (ships[s.id] = { el, face, inner, shade, owner: s.owner, f: 1, p: null });
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
      go(sh, s, 0);
      sh.el.style.opacity = '';
      sh.face.removeAttribute('clip-path');
      sh.el.classList.toggle('fresh', !!s.fresh);
      sh.el.classList.toggle('docked', s.at === 'harbor');
    }
    for (const id in ships) if (!alive.has(id)) { ships[id].el.remove(); delete ships[id]; }
    shark.face.removeAttribute('clip-path');
    if (view.shark >= 0) {
      sharkEl.style.display = '';
      go(shark, { at: 'ring', i: view.shark }, 0);
    } else sharkEl.style.display = 'none';
    sortShips();
  }

  /* ================= Effekte ================= */
  /* Aufrechte Gruppe an einem Brettpunkt; räumt sich nach ms selbst weg. */
  function fxGroup(xy, layer, ms) {
    const g = mk('g', { transform: `translate(${xy[0].toFixed(1)} ${xy[1].toFixed(1)})`, class: 'fxg' }, layer || gFx);
    later(() => g.remove(), ms + 80);
    return mk('g', { class: 'up' }, g);
  }
  function ripple(xy, color, big) {
    for (let k = 0; k < (big ? 3 : 2); k++) {
      const c = mk('circle', { cx: xy[0], cy: xy[1], r: 16, fill: 'none', stroke: color, 'stroke-width': 2.5, class: 'ripple' }, gFx);
      const a = waapi(c,
        [{ transform: 'scale(.6)', opacity: 0.85 }, { transform: `scale(${big ? 4.2 : 3})`, opacity: 0 }],
        { duration: big ? 1000 : 760, delay: k * 150, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' });
      later(() => c.remove(), (big ? 1000 : 760) + k * 150 + 60);
      if (!a) c.remove();
    }
  }
  /* Kielwasser: ein kleiner Ring bleibt hinter der fahrenden Figur zurück. */
  function wake(xy) {
    const c = mk('circle', { cx: xy[0], cy: xy[1], r: 10, fill: 'none', stroke: WATER, 'stroke-width': 2, class: 'ripple' }, gWake);
    const a = waapi(c, [{ transform: 'scale(.5)', opacity: 0.55 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 560, easing: 'ease-out', fill: 'both' });
    later(() => c.remove(), 620);
    if (!a) c.remove();
  }
  /* Ein Teilchen auf einer Wurfbahn: dx seitlich, h hoch, dy Endhöhe. */
  function particle(parent, draw, o) {
    const gx = mk('g', {}, parent);
    const node = draw(gx);
    const t = { duration: o.dur, delay: o.delay || 0, fill: 'both' };
    waapi(gx, [{ transform: 'translateX(0px)', opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.7 }, { transform: `translateX(${o.dx.toFixed(1)}px)`, opacity: o.keep ? 1 : 0 }],
      Object.assign({ easing: 'linear' }, t));
    waapi(node, [
      { transform: `translateY(0px) rotate(0deg) scale(${o.s0 || 1})`, easing: 'cubic-bezier(.15,.7,.4,1)' },
      { transform: `translateY(${(-o.h).toFixed(1)}px) rotate(${(o.spin || 0) / 2}deg) scale(1)`, offset: 0.45, easing: 'cubic-bezier(.6,0,.85,.5)' },
      { transform: `translateY(${o.dy || 0}px) rotate(${o.spin || 0}deg) scale(${o.s1 === undefined ? 0.6 : o.s1})` }], t);
  }
  /* Wasser spritzt auf. */
  function splash(xy, o) {
    o = o || {};
    const n = o.n || 9, pow = o.pow || 1, up = fxGroup(xy, gFx, 1000);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5;
      particle(up, g => mk('ellipse', { rx: rnd(2.2, 3.6), ry: rnd(3.2, 5.2), fill: FOAM, stroke: WATER, 'stroke-width': 1.2 }, g), {
        dx: t * 74 * pow + rnd(-6, 6), h: rnd(24, 44) * pow * (1 - Math.abs(t) * 0.8), dy: 5,
        dur: rnd(480, 720), delay: rnd(0, 60), s0: 0.6, s1: 0.5,
      });
    }
  }
  /* Luftblasen steigen auf, wo etwas untergegangen ist. */
  function bubbles(xy, n) {
    const up = fxGroup(xy, gFx, 1500);
    for (let k = 0; k < (n || 7); k++) {
      const c = mk('circle', { cx: rnd(-13, 13), cy: rnd(-2, 5), r: rnd(2, 4.2), fill: 'rgba(255,253,246,.8)', stroke: WATER, 'stroke-width': 1.1 }, up);
      waapi(c, [
        { transform: 'translate(0px, 6px) scale(.3)', opacity: 0 },
        { transform: `translate(${rnd(-4, 4).toFixed(1)}px, -6px) scale(1)`, opacity: 0.95, offset: 0.3 },
        { transform: `translate(${rnd(-7, 7).toFixed(1)}px, ${rnd(-34, -20).toFixed(1)}px) scale(1.25)`, opacity: 0 }],
        { duration: rnd(520, 800), delay: k * 85, easing: 'ease-out', fill: 'both' });
    }
  }
  function starPts(n, r1, r2) {
    let s = '';
    for (let k = 0; k < n * 2; k++) {
      const r = k % 2 ? r2 : r1, a = Math.PI * k / n - Math.PI / 2;
      s += (r * Math.cos(a)).toFixed(1) + ',' + (r * Math.sin(a)).toFixed(1) + ' ';
    }
    return s;
  }
  /* Einschlag: Blitz, Rauch und Splitter in der Farbe des getroffenen Schiffs. */
  function burst(xy, color, small) {
    const up = fxGroup(xy, gFx, 1000), k = small ? 0.5 : 1;
    const outer = mk('polygon', { points: starPts(9, 27 * k, 12 * k), fill: '#FFE9A8', stroke: GOLD, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, up);
    const core = mk('polygon', { points: starPts(7, 15 * k, 7 * k), fill: FOAM, stroke: '#E0763A', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, up);
    waapi(outer, [{ transform: 'scale(.15) rotate(-20deg)', opacity: 1 }, { transform: 'scale(1.1) rotate(10deg)', opacity: 1, offset: 0.4 }, { transform: 'scale(1.5) rotate(24deg)', opacity: 0 }],
      { duration: small ? 240 : 400, easing: 'ease-out', fill: 'both' });
    waapi(core, [{ transform: 'scale(.15) rotate(20deg)', opacity: 1 }, { transform: 'scale(1.2) rotate(-8deg)', opacity: 1, offset: 0.45 }, { transform: 'scale(1.1) rotate(-16deg)', opacity: 0 }],
      { duration: small ? 220 : 340, easing: 'ease-out', fill: 'both' });
    for (let j = 0; j < (small ? 3 : 4); j++) {
      const c = mk('circle', { cx: rnd(-8, 8) * k, cy: rnd(-6, 4) * k, r: rnd(6, 10) * k, fill: '#F2EADB', stroke: NAVY, 'stroke-width': 1, 'stroke-opacity': 0.45 }, up);
      waapi(c, [{ transform: 'translate(0px,0px) scale(.4)', opacity: 0 }, { opacity: 0.9, offset: 0.25 },
        { transform: `translate(${rnd(-14, 14).toFixed(1)}px, ${rnd(-30, -16).toFixed(1)}px) scale(1.7)`, opacity: 0 }],
        { duration: rnd(560, 820), delay: 60 + j * 50, easing: 'ease-out', fill: 'both' });
    }
    if (small) return;
    for (let j = 0; j < 7; j++) {
      const t = (j + 0.5) / 7 - 0.5;
      particle(up, g => mk('rect', { x: -5, y: -1.6, width: rnd(7, 11), height: 3.2, rx: 1, fill: j % 2 ? color : WOOD, stroke: NAVY, 'stroke-width': 0.8 }, g), {
        dx: t * 96 + rnd(-8, 8), h: rnd(26, 48), dy: 8, spin: rnd(-540, 540), dur: rnd(560, 820), s1: 0.8,
      });
    }
  }
  /* Funkelnde Sterne (Heimathafen erreicht). */
  function sparkle(xy, color, n) {
    const up = fxGroup(xy, gFx, 1300), cols = [GOLD, color, FOAM];
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + ((k + 0.5) / n - 0.5) * Math.PI * 1.7 + rnd(-0.12, 0.12), d = rnd(30, 60);
      const g = mk('g', {}, up);
      const st = mk('polygon', { points: starPts(4, rnd(7, 11), 2.8), fill: cols[k % 3], stroke: NAVY, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }, g);
      const t = { duration: rnd(700, 1000), delay: rnd(0, 140), fill: 'both' };
      waapi(g, [{ transform: 'translate(0px,0px)' }, { transform: `translate(${(Math.cos(a) * d).toFixed(1)}px, ${(Math.sin(a) * d).toFixed(1)}px)` }],
        Object.assign({ easing: 'cubic-bezier(.1,.7,.3,1)' }, t));
      waapi(st, [{ transform: 'scale(0) rotate(0deg)', opacity: 1 }, { transform: 'scale(1.2) rotate(90deg)', opacity: 1, offset: 0.35 },
        { transform: 'scale(.9) rotate(150deg)', opacity: 1, offset: 0.7 }, { transform: 'scale(0) rotate(220deg)', opacity: 0.8 }], t);
    }
  }
  /* Schaumbogen um die Standfläche: die Spur einer engen Wende. dir = Drehsinn. */
  function swoosh(xy, dir, big) {
    const up = fxGroup(xy, gWake, 800), dur = big ? 620 : 440;
    for (const [w, col, op] of [[6.5, WATER, 0.35], [3.2, FOAM, 1]]) {
      const el = mk('ellipse', { cx: 0, cy: 2, rx: big ? 31 : 26, ry: big ? 12 : 10, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': '46 100', opacity: op }, up);
      if (dir < 0) el.setAttribute('transform', 'scale(-1 1)');
      waapi(el, [{ strokeDashoffset: 46, opacity: 0 }, { opacity: op, offset: 0.2 }, { opacity: op, offset: 0.65 }, { strokeDashoffset: -96, opacity: 0 }],
        { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'both' });
    }
    const fx = fxGroup(xy, gFx, 800);
    for (let k = 0; k < (big ? 6 : 4); k++) {
      particle(fx, g => mk('ellipse', { rx: rnd(2, 3), ry: rnd(2.8, 4.2), fill: FOAM, stroke: WATER, 'stroke-width': 1.1 }, g), {
        dx: -dir * rnd(14, 40), h: rnd(10, 22), dy: 6, dur: rnd(380, 560), delay: 120 + k * 45, s0: 0.6, s1: 0.5,
      });
    }
  }
  /* Das Maul des Hais schnappt zu. */
  function jaws(xy) {
    const up = fxGroup(xy, gFx, 700);
    const g = mk('g', {}, up), top = mk('g', {}, g), bot = mk('g', {}, g);
    mk('path', { d: 'M-31 3Q-31 -25 0 -25Q31 -25 31 3Z', fill: NAVY }, top);
    for (let k = 0; k < 5; k++) {
      const x = -30 + k * 12;
      mk('path', { d: `M${x} 1L${x + 6} 14L${x + 12} 1Z`, fill: FOAM, stroke: NAVY, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, top);
    }
    mk('path', { d: 'M-28 -3Q-28 21 0 21Q28 21 28 -3Z', fill: NAVY }, bot);
    for (let k = 0; k < 4; k++) {
      const x = -24 + k * 12;
      mk('path', { d: `M${x} -1L${x + 6} -13L${x + 12} -1Z`, fill: FOAM, stroke: NAVY, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, bot);
    }
    const t = { duration: 600, fill: 'both' };
    waapi(g, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.16 }, { transform: 'scale(1)', opacity: 1, offset: 0.78 }, { transform: 'scale(1.25)', opacity: 0 }], t);
    waapi(top, [
      { transform: 'translateY(-34px) rotate(-14deg)', easing: 'ease-out' },
      { transform: 'translateY(-38px) rotate(-16deg)', offset: 0.2, easing: 'cubic-bezier(.7,0,1,.6)' },
      { transform: 'translateY(-1px) rotate(0deg)', offset: 0.4 },
      { transform: 'translateY(-7px) rotate(-3deg)', offset: 0.52 },
      { transform: 'translateY(-1px) rotate(0deg)', offset: 0.64 },
      { transform: 'translateY(-1px) rotate(0deg)' }], t);
    waapi(bot, [
      { transform: 'translateY(30px) rotate(12deg)', easing: 'ease-out' },
      { transform: 'translateY(34px) rotate(14deg)', offset: 0.2, easing: 'cubic-bezier(.7,0,1,.6)' },
      { transform: 'translateY(1px) rotate(0deg)', offset: 0.4 },
      { transform: 'translateY(6px) rotate(3deg)', offset: 0.52 },
      { transform: 'translateY(1px) rotate(0deg)', offset: 0.64 },
      { transform: 'translateY(1px) rotate(0deg)' }], t);
  }
  /* Der Tisch wackelt kurz. */
  function shake(pow) {
    const box = svg.parentNode, p = pow || 4;
    if (!box) return;
    waapi(box, [0, [-p, p * 0.6], [p * 0.8, -p * 0.5], [-p * 0.5, p * 0.3], [p * 0.3, 0], 0]
      .map(v => ({ transform: v ? `translate(${v[0]}px, ${v[1]}px)` : 'translate(0px, 0px)' })), { duration: 340 });
  }

  /* ---------- Bewegungen der Figur selbst ---------- */
  /* Ein Feld weit segeln: die Figur hebt sich und wiegt sich abwechselnd nach links und rechts. */
  function sail(rec, k, dur, deg) {
    const r = (k % 2 ? 1 : -1) * (deg || 6);
    waapi(rec.inner, [{ transform: 'translateY(0px) rotate(0deg) scale(1)' }, { transform: `translateY(-7px) rotate(${r}deg) scale(1.1)` }, { transform: 'translateY(0px) rotate(0deg) scale(1)' }],
      { duration: dur, easing: 'ease-in-out' });
  }
  function bump(inner, scale, dur) {
    waapi(inner, [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }],
      { duration: dur, easing: 'ease-out' });
  }
  /* Nach dem Aufsetzen schaukelt das Schiff aus. */
  function rock(rec, dur) {
    waapi(rec.inner, [0, 9, -6, 4, -2, 0].map(d => ({ transform: `rotate(${d}deg)` })), { duration: dur, easing: 'ease-out' });
  }
  /* Wende: Das Schiff legt sich in die Kurve, schwenkt den Bug herum und zieht einen Schaumbogen. */
  async function turn(rec, f, big) {
    if (rec.f === f) return;
    const dur = big ? 640 : 440, from = rec.f;
    rec.f = f;
    rec.face.style.transition = 'none';
    rec.face.style.transform = `scaleX(${f})`;
    SG.Sound.whoosh();
    swoosh(cur(rec), from, big);
    waapi(rec.face, [
      { transform: `scaleX(${from}) rotate(0deg)`, easing: 'cubic-bezier(.5,0,.8,.5)' },
      { transform: `scaleX(${from * 0.92}) rotate(${big ? 15 : 9}deg)`, offset: 0.2, easing: 'cubic-bezier(.5,0,.5,1)' },
      { transform: `scaleX(${f * 0.92}) rotate(${big ? 17 : 10}deg)`, offset: 0.64, easing: 'ease-out' },
      { transform: `scaleX(${f}) rotate(${big ? -7 : -4}deg)`, offset: 0.84, easing: 'ease-in-out' },
      { transform: `scaleX(${f}) rotate(0deg)` }], { duration: dur });
    waapi(rec.inner, [{ transform: 'translateY(0px) scale(1)' }, { transform: `translateY(${big ? -11 : -6}px) scale(${big ? 1.16 : 1.08})`, offset: 0.42 }, { transform: 'translateY(0px) scale(1)' }],
      { duration: dur, easing: 'ease-in-out' });
    if (big) later(() => ripple(cur(rec), COLORS[rec.owner] || NAVY), dur * 0.6);
    await sleep(dur);
  }

  /* ---------- Schlagen ---------- */
  /* Kanonenschuss von einem Schiff auf ein Feld: Mündungsfeuer, Kugel, Einschlag. */
  async function fire(rec, to, color) {
    const a = lift(cur(rec), FIG_H * 0.36), b = lift(to, FIG_H * 0.34);
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const muzzle = [a[0] + dx / d * 15, a[1] + dy / d * 15];
    SG.Sound.cannon();
    burst(muzzle, color, true);
    // Rückstoß
    const v = upVec(dx / d, dy / d);
    waapi(rec.inner, [{ transform: 'translate(0px,0px) rotate(0deg)' }, { transform: `translate(${(-v[0] * 7 * rec.f).toFixed(1)}px, ${(-v[1] * 7).toFixed(1)}px) rotate(${(-v[0] * rec.f * 9).toFixed(1)}deg)`, offset: 0.25 }, { transform: 'translate(0px,0px) rotate(0deg)' }],
      { duration: 380, easing: 'ease-out' });
    const dur = Math.max(190, Math.min(420, 130 + d * 1.5));
    const g = mk('g', {}, gFx), ball = mk('circle', { r: 4.4, fill: NAVY, stroke: FOAM, 'stroke-width': 1.1 }, mk('g', { class: 'up' }, g));
    const T = p => `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px)`;
    const fly = waapi(g, [{ transform: T(muzzle) }, { transform: T(b) }], { duration: dur, easing: 'linear', fill: 'both' });
    waapi(ball, [{ transform: 'translateY(0px)', easing: 'cubic-bezier(.2,.6,.5,1)' }, { transform: `translateY(${-(8 + d * 0.16).toFixed(1)}px)`, offset: 0.5, easing: 'cubic-bezier(.5,0,.8,.4)' }, { transform: 'translateY(0px)' }],
      { duration: dur, fill: 'both' });
    if (fly) await sleep(dur);
    g.remove();
    SG.Sound.boom();
    burst(b, color);
  }
  /* Ein geschlagenes Schiff verschwindet an Ort und Stelle und wird in der Werft neu aufgestellt.
   * how: 'shot' kentert und sinkt, 'bite' wird vom Hai unter Wasser gezogen, 'toss' fliegt in hohem Bogen davon. */
  async function sink(id, how) {
    const sh = ships[id]; if (!sh) return;
    const xy = cur(sh), col = COLORS[sh.owner], D = FIG_H * 1.08;
    sh.el.classList.remove('fresh', 'docked');
    let dur, frames;
    if (how === 'toss') {
      dur = 640;
      frames = [
        { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1, easing: 'cubic-bezier(.15,.7,.4,1)' },
        { transform: 'translate(-16px,-82px) rotate(-250deg) scale(.9)', opacity: 1, offset: 0.62, easing: 'ease-in' },
        { transform: 'translate(-24px,-66px) rotate(-380deg) scale(.4)', opacity: 0 }];
    } else if (how === 'bite') {
      dur = 320;
      frames = [
        { transform: 'translate(0px,0px) rotate(0deg)', easing: 'ease-out' },
        { transform: 'translate(0px,-5px) rotate(-9deg)', offset: 0.22, easing: 'cubic-bezier(.6,0,.9,.6)' },
        { transform: `translate(3px,${D}px) rotate(26deg)` }];
    } else {
      dur = 860;
      frames = [
        { transform: 'translate(0px,0px) rotate(0deg)', easing: 'ease-out' },
        { transform: 'translate(-4px,-6px) rotate(-17deg)', offset: 0.13, easing: 'ease-in-out' },
        { transform: 'translate(2px,5px) rotate(40deg)', offset: 0.46, easing: 'cubic-bezier(.5,0,.8,.6)' },
        { transform: `translate(7px,${D}px) rotate(74deg)` }];
    }
    if (how !== 'toss') sh.face.setAttribute('clip-path', 'url(#sg-water)');
    const a = waapi(sh.inner, frames, { duration: dur, fill: 'forwards' });
    const b = waapi(sh.shade, [{ opacity: 1 }, { opacity: 0 }], { duration: dur, fill: 'forwards' });
    SG.Sound.capture();
    ripple(xy, col, true);
    if (how === 'shot') { later(() => { splash(xy, { n: 8 }); bubbles(xy, 8); SG.Sound.bubbles(); }, 380); }
    await sleep(dur);
    // unter Wasser: unsichtbar in die Werft setzen …
    sh.el.style.opacity = '0';
    if (a) a.cancel();
    if (b) b.cancel();
    sh.face.removeAttribute('clip-path');
    const home = { at: 'base', i: id % E.FLEET };
    go(sh, home, 0);
    await sleep(how === 'bite' ? 380 : 180);
    // … und dort neu vom Stapel lassen
    sh.el.style.opacity = '';
    waapi(sh.inner, [{ transform: 'translateY(-16px) scale(.2)', opacity: 0 }, { transform: 'translateY(0px) scale(1.22)', opacity: 1, offset: 0.6 }, { transform: 'translateY(0px) scale(1)', opacity: 1 }],
      { duration: 460, easing: 'cubic-bezier(.2,.7,.3,1)' });
    ripple(cur(sh), col);
    await sleep(480);
  }
  const capture = id => sink(id, 'shot');

  /* ---------- Züge ---------- */
  /* o.back: mit der 4 rückwärts – das Schiff wendet, fährt zurück und dreht am Ziel wieder bei. */
  async function moveShip(id, path, o) {
    const sh = ships[id]; if (!sh) return;
    o = o || {};
    gShips.appendChild(sh.el);
    sh.el.classList.remove('fresh');
    if (o.back) await turn(sh, -sh.f, true);
    const dur = path.length > 8 ? 110 : path.length > 4 ? 130 : 155;
    const pending = [];
    for (let k = 0; k < path.length; k++) {
      const p = path[k];
      if (p.hit !== undefined && ships[p.hit]) {
        // erst die Breitseite, dann aufs frei gewordene Feld
        await fire(sh, pos(p.at, p.i, sh.owner), COLORS[ships[p.hit].owner]);
        pending.push(sink(p.hit, 'shot'));
        await sleep(560);
      }
      wake(cur(sh));
      go(sh, p, dur, o.back ? 'back' : undefined);
      sail(sh, k, dur);
      SG.Sound.hop(k);
      await sleep(dur);
    }
    const last = path[path.length - 1];
    if (o.back) { await sleep(60); await turn(sh, facing(last.at, last.i, sh.owner), false); }
    sh.el.classList.toggle('docked', last.at === 'harbor');
    await Promise.all(pending);
    sortShips();
  }

  /* Auslaufen: Stapellauf aus der Werft – Anlauf, hoher Bogen, Aufklatschen, Ausschaukeln. */
  async function launch(id, to, hit) {
    const sh = ships[id]; if (!sh) return;
    const dst = pos(to.at, to.i, sh.owner), col = COLORS[sh.owner];
    gShips.appendChild(sh.el);
    let sunk = null;
    if (hit !== undefined && ships[hit]) {
      await fire(sh, dst, COLORS[ships[hit].owner]);
      sunk = sink(hit, 'shot');
      await sleep(600);
      gShips.appendChild(sh.el);
    }
    SG.Sound.launch();
    const T = 600, pre = 150, all = pre + T * 1.2, q = pre / all, at = x => q + (1 - q) * x;
    waapi(sh.inner, [
      { transform: 'translateY(0px) rotate(0deg) scale(1,1)', easing: 'ease-out' },
      { transform: 'translateY(2px) rotate(0deg) scale(1.14,.84)', offset: q, easing: 'cubic-bezier(.2,.7,.4,1)' },
      { transform: 'translateY(-40px) rotate(-13deg) scale(1.3,1.3)', offset: at(0.42), easing: 'cubic-bezier(.6,0,.85,.5)' },
      { transform: 'translateY(0px) rotate(11deg) scale(1,1)', offset: at(0.82), easing: 'ease-out' },
      { transform: 'translateY(3px) rotate(3deg) scale(1.15,.82)', offset: at(0.9), easing: 'ease-out' },
      { transform: 'translateY(0px) rotate(0deg) scale(1,1)' }], { duration: all });
    waapi(sh.shade, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1)', opacity: 1, offset: q }, { transform: 'scale(.55)', opacity: 0.5, offset: at(0.42) }, { transform: 'scale(1)', opacity: 1, offset: at(0.82) }, { transform: 'scale(1)', opacity: 1 }], { duration: all });
    await sleep(pre);
    go(sh, to, T, 'keep');
    later(() => setFace(sh, facing(to.at, to.i, sh.owner), 300), T * 0.3);
    await sleep(T * 0.98);
    SG.Sound.splash();
    splash(dst, { n: 12, pow: 1.2 });
    ripple(dst, col, true);
    sh.el.classList.add('fresh');
    await sleep(T * 0.22);
    rock(sh, 760);
    await sleep(sunk ? 200 : 420);
    if (sunk) await sunk;
    sortShips();
  }

  /* Heimathafen erreicht: Freudensprung mit Pirouette, Sterne und ein Ring in der Flottenfarbe. */
  async function dock(id, small) {
    const sh = ships[id]; if (!sh) return;
    const xy = cur(sh), col = COLORS[sh.owner];
    sh.el.classList.add('docked');
    SG.Sound.home();
    ripple(xy, col, true);
    sparkle(lift(xy, FIG_H * 0.42), col, small ? 6 : 13);
    if (small) { rock(sh, 520); await sleep(440); return; }
    waapi(sh.inner, [
      { transform: 'translateY(0px) scale(1,1)', easing: 'ease-out' },
      { transform: 'translateY(2px) scale(1.12,.86)', offset: 0.1, easing: 'cubic-bezier(.2,.7,.4,1)' },
      { transform: 'translateY(-26px) scale(1.18,1.18)', offset: 0.4, easing: 'cubic-bezier(.6,0,.85,.5)' },
      { transform: 'translateY(0px) scale(1.1,.88)', offset: 0.66, easing: 'cubic-bezier(.2,.7,.4,1)' },
      { transform: 'translateY(-10px) scale(1,1)', offset: 0.82, easing: 'cubic-bezier(.6,0,.85,.5)' },
      { transform: 'translateY(0px) scale(1,1)' }], { duration: 900 });
    const f = sh.f;
    sh.face.style.transition = 'none';
    waapi(sh.face, [{ transform: `scaleX(${f})` }, { transform: `scaleX(${f})`, offset: 0.12, easing: 'ease-in-out' }, { transform: `scaleX(${-f})`, offset: 0.38, easing: 'ease-in-out' }, { transform: `scaleX(${f})`, offset: 0.64 }, { transform: `scaleX(${f})` }],
      { duration: 900 });
    later(() => { sparkle(lift(xy, FIG_H * 0.5), col, 7); ripple(xy, GOLD); }, 600);
    await sleep(980);
  }

  async function swap(a, posA, b, posB) {
    const A = ships[a], B = b === -1 ? shark : ships[b];
    if (!A || !B) return;
    SG.Sound.swap();
    A.el.classList.remove('fresh'); B.el.classList.remove('fresh');
    gShips.appendChild(A.el); gShips.appendChild(B.el);
    go(A, posA, 760);
    go(B, posB, 760);
    bump(A.inner, 1.7, 760); bump(B.inner, 1.7, 760);
    await sleep(780);
    ripple(pos(posA.at, posA.i, A.owner), COLORS[A.owner]);
    ripple(pos(posB.at, posB.i, B.owner), B.owner < 0 ? NAVY : COLORS[B.owner]);
    await sleep(200);
    sortShips();
  }

  /* ---------- Der Weiße Hai ---------- */
  /* Der Hai taucht auf einem Feld auf; was dort liegt, wird in die Luft geschleudert. */
  async function sharkAppear(at, hit) {
    const xy = pos('ring', at);
    go(shark, { at: 'ring', i: at }, 0);
    sharkEl.style.display = '';
    gShips.appendChild(sharkEl);
    SG.Sound.whale();
    ripple(xy, NAVY, true);
    const sunk = hit !== undefined && ships[hit] ? sink(hit, 'toss') : null;
    shark.face.setAttribute('clip-path', 'url(#sg-water)');
    waapi(sharkIn, [
      { transform: `translateY(${SHARK_H * 1.1}px) rotate(-34deg) scale(1)`, easing: 'cubic-bezier(.2,.8,.3,1)' },
      { transform: 'translateY(-30px) rotate(-14deg) scale(1.2)', offset: 0.5, easing: 'cubic-bezier(.6,0,.85,.5)' },
      { transform: 'translateY(0px) rotate(6deg) scale(1)', offset: 0.86, easing: 'ease-out' },
      { transform: 'translateY(0px) rotate(0deg) scale(1)' }], { duration: 820 });
    waapi(shark.shade, [{ opacity: 0 }, { opacity: 0.4, offset: 0.5 }, { opacity: 1 }], { duration: 820 });
    later(() => { SG.Sound.splash(); splash(xy, { n: 13, pow: 1.35 }); }, 130);
    await sleep(700);
    shark.face.removeAttribute('clip-path');
    splash(xy, { n: 8, pow: 0.9 });
    ripple(xy, NAVY);
    shake(3);
    if (sunk) await sunk; else await sleep(320);
    sortShips();
  }
  /* Der Hai springt auf ein Schiff, schnappt zu und zieht es unter Wasser. */
  async function devour(p, pending) {
    const victim = ships[p.hit], xy = pos('ring', p.i), T = 460;
    // das Opfer zittert
    waapi(victim.inner, [0, -3, 3, -3, 3, -2, 2, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 420 });
    await sleep(140);
    wake(cur(shark));
    go(shark, p, T);
    SG.Sound.whale();
    waapi(sharkIn, [
      { transform: 'translateY(0px) rotate(0deg) scale(1)', easing: 'cubic-bezier(.2,.7,.4,1)' },
      { transform: 'translateY(-48px) rotate(-24deg) scale(1.25)', offset: 0.46, easing: 'cubic-bezier(.6,0,.9,.5)' },
      { transform: 'translateY(0px) rotate(28deg) scale(1.08)', offset: 0.8, easing: 'ease-out' },
      { transform: 'translateY(2px) rotate(-8deg) scale(1.2,.9)', offset: 0.88 },
      { transform: 'translateY(0px) rotate(6deg) scale(1)', offset: 0.94 },
      { transform: 'translateY(0px) rotate(0deg) scale(1)' }], { duration: T * 1.25 });
    waapi(shark.shade, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.5)', opacity: 0.4, offset: 0.46 }, { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'scale(1)', opacity: 1 }], { duration: T * 1.25 });
    await sleep(T * 0.5);
    jaws(lift(xy, FIG_H * 0.4));
    await sleep(T * 0.24);
    SG.Sound.chomp();
    pending.push(sink(p.hit, 'bite'));
    await sleep(T * 0.26);
    splash(xy, { n: 13, pow: 1.3 });
    ripple(xy, CORAL, true);
    shake(5);
    later(() => { bubbles(xy, 8); SG.Sound.bubbles(); }, 180);
    await sleep(430);
  }
  /* Der Hai schwimmt Feld für Feld; wer auf dem Weg liegt, wird gefressen. */
  async function sharkRun(path) {
    if (!path.length) return;
    gShips.appendChild(sharkEl);
    const dur = path.length > 6 ? 125 : 190;
    const pending = [];
    for (let k = 0; k < path.length; k++) {
      const p = path[k];
      if (p.hit !== undefined && ships[p.hit]) { await devour(p, pending); continue; }
      wake(cur(shark));
      go(shark, p, dur);
      sail(shark, k, dur, 8);
      await sleep(dur);
    }
    await Promise.all(pending);
    sortShips();
  }
  /* Lotse: Figuren springen auf ihren früheren Platz zurück. */
  async function restore(moves, sharkMove) {
    const jobs = [];
    for (const m of moves) {
      const sh = ships[m.ship]; if (!sh) continue;
      gShips.appendChild(sh.el);
      sh.el.classList.toggle('fresh', !!m.fresh);
      sh.el.classList.toggle('docked', m.to.at === 'harbor');
      go(sh, m.to, 720);
      bump(sh.inner, 1.5, 720);
      jobs.push(sleep(740).then(() => ripple(pos(m.to.at, m.to.i, sh.owner), COLORS[sh.owner])));
    }
    if (sharkMove && sharkMove.from !== sharkMove.to) {
      if (sharkMove.to < 0) sharkEl.style.display = 'none';
      else { sharkEl.style.display = ''; go(shark, { at: 'ring', i: sharkMove.to }, 720); bump(sharkIn, 1.4, 720); }
    }
    if (moves.length || (sharkMove && sharkMove.from !== sharkMove.to)) SG.Sound.swap();
    await Promise.all(jobs);
    await sleep(160);
    sortShips();
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
        t.body = lift(t.xy, t.ship === -1 ? SHARK_H * 0.4 : FIG_H * 0.4);
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
    const x = VB0 + (ev.clientX - r.left) / r.width * VBW - C;
    const y = VB0 + (ev.clientY - r.top) / r.height * VBW - C;
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
    return [r.left + (C + x * Math.cos(a) - y * Math.sin(a) - VB0) / VBW * r.width,
            r.top + (C + x * Math.sin(a) + y * Math.cos(a) - VB0) / VBW * r.height];
  }

  SG.Board = {
    COLORS, COLOR_NAMES, NAVY, build, setMode, setViewer, sync, pos, screenXY,
    moveShip, launch, dock, swap, capture, sharkAppear, sharkRun, restore, ripple, sortShips, figure,
    setTargets, setSelected,
  };
})(window);
