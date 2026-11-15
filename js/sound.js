/* Seefahrt – leise, per WebAudio erzeugte Töne (keine Audiodateien). */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};
  let ctx = null, master = null;
  let on = localStorage.getItem('seegang.sound') !== '0';

  function ensure() {
    if (!on) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq, dur, opts) {
    const c = ensure(); if (!c) return;
    opts = opts || {};
    const t = c.currentTime + (opts.at || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, opts) {
    const c = ensure(); if (!c) return;
    opts = opts || {};
    const t = c.currentTime + (opts.at || 0);
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 1800, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    f.Q.value = opts.q || 0.8;
    const g = c.createGain(); g.gain.value = opts.vol || 0.12;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  SG.Sound = {
    get on() { return on; },
    toggle() { on = !on; localStorage.setItem('seegang.sound', on ? '1' : '0'); if (on) this.tap(); return on; },
    unlock() { ensure(); },
    tap() { tone(520, 0.07, { vol: 0.05, type: 'triangle' }); },
    card() { noise(0.09, { freq: 2600, to: 900, vol: 0.10 }); },
    deal() { noise(0.05, { freq: 3200, to: 1500, vol: 0.05 }); },
    hop(i) { tone(330 + (i % 5) * 22, 0.08, { vol: 0.055, type: 'triangle' }); },
    launch() { tone(294, 0.18, { vol: 0.08, type: 'triangle' }); tone(440, 0.22, { vol: 0.07, type: 'triangle', at: 0.09 }); },
    capture() { noise(0.4, { freq: 1200, to: 260, vol: 0.16, type: 'lowpass' }); tone(220, 0.3, { to: 90, vol: 0.09 }); },
    swap() { tone(392, 0.16, { to: 587, vol: 0.06 }); tone(587, 0.16, { to: 392, vol: 0.06, at: 0.05 }); },
    whale() { tone(110, 0.9, { to: 70, vol: 0.14 }); noise(0.7, { freq: 500, to: 160, vol: 0.12, type: 'lowpass', at: 0.1 }); },
    home() { [523, 659, 784].forEach((f, i) => tone(f, 0.32, { vol: 0.07, type: 'triangle', at: i * 0.09 })); },
    turn() { tone(659, 0.12, { vol: 0.05, type: 'triangle' }); tone(880, 0.18, { vol: 0.05, type: 'triangle', at: 0.08 }); },
    fold() { noise(0.25, { freq: 1400, to: 500, vol: 0.07 }); },
    win() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { vol: 0.08, type: 'triangle', at: i * 0.13 })); },
  };
})(window);
