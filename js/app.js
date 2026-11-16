/* Seefahrt – Oberfläche: Bildschirme, Spieltisch, Eingabe und Ablauf der Animationen. */
(function () {
  'use strict';
  const SG = window.SG, E = SG.Engine, B = SG.Board, Cards = SG.Cards, Sound = SG.Sound;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms * (SG.speed || 1)));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const BOT_NAMES = ['Fiete', 'Smilla', 'Ole', 'Jonna', 'Hauke', 'Ebba', 'Tjark', 'Merle'];
  const ORDER = ['1', '12', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'swap', 'shark', 'pilot', 'board', 'trade', 'vision', 'storm'];
  const token = seat => `<img class="tok" src="${B.figure(seat)}" alt="" draggable="false">`;

  /* ================= Bildschirme ================= */
  function show(id) {
    $$('.screen').forEach(s => { s.hidden = s.id !== id; });
    document.body.dataset.screen = id;
  }
  function toast(text, ms) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('on'), ms || 2600);
  }
  function modal(html, opts) {
    const m = $('#modal'), c = $('#modal-card');
    c.className = 'modal-card' + (opts && opts.cls ? ' ' + opts.cls : '');
    c.innerHTML = html;
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('on'));
    m.onclick = e => { if (e.target === m && !(opts && opts.sticky)) closeModal(); };
    return c;
  }
  function closeModal() {
    const m = $('#modal');
    m.classList.remove('on');
    setTimeout(() => { if (!m.classList.contains('on')) m.hidden = true; }, 220);
  }
  function confirmBox(text, yes, no) {
    return new Promise(res => {
      const c = modal(`<p class="ask">${esc(text)}</p><div class="row"><button class="btn" data-a="no">${esc(no || 'Abbrechen')}</button><button class="btn primary" data-a="yes">${esc(yes || 'Ja')}</button></div>`, { sticky: true });
      c.onclick = e => { const a = e.target.closest('[data-a]'); if (a) { closeModal(); res(a.dataset.a === 'yes'); } };
    });
  }
  function showRules() {
    const c = modal(SG.rulesHTML(), { cls: 'rules' });
    $$('[data-card]', c).forEach(slot => slot.appendChild(Cards.el({ type: slot.dataset.card })));
    c.querySelector('[data-close]').onclick = closeModal;
  }

  /* ================= Aufstellung ================= */
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('seegang.prefs') || '{}'); } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('seegang.prefs', JSON.stringify(prefs)); } catch (e) {} };
  const setup = { mode: 'team', seats: [], preset: 'solo' };

  function openSetup(preset) {
    setup.preset = preset;
    setup.mode = 'team';
    const bots = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    setup.seats = [0, 1, 2, 3].map(i => {
      const human = preset === 'solo' ? i === 0 : (i === 0 || i === 2);
      return { kind: human ? 'human' : 'ai', name: human ? humanName(i) : bots[i], bot: bots[i] };
    });
    $('#setup-title').textContent = preset === 'solo' ? 'Allein gegen den Computer' : 'Gemeinsam an einem Gerät';
    renderSetup();
    show('scr-setup');
  }
  function humanName(i) {
    const key = setup.preset === 'solo' ? 'soloNames' : 'localNames';
    return (prefs[key] && prefs[key][i]) || (setup.preset === 'solo' && i === 0 ? 'Du' : 'Spieler ' + ([0, 2, 1, 3].indexOf(i) + 1));
  }
  function seatRow(i, s, opts) {
    const teamLabel = setup.mode === 'team' || opts.team ? (i % 2 === 0 ? 'Team Kaltwasser' : 'Team Abendrot') : '';
    return `<div class="seat s${i}" data-seat="${i}">
      ${token(i)}
      <div class="seat-main">${opts.input ? `<input value="${esc(s.name)}" maxlength="14" ${s.kind !== 'human' ? 'disabled' : ''} aria-label="Name">` : `<b>${esc(s.name)}</b>`}
        <small>${esc(opts.sub !== undefined ? opts.sub : teamLabel)}</small></div>
      ${opts.right || ''}
    </div>`;
  }
  function renderSetup() {
    $$('#setup-mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === setup.mode));
    const used = setup.mode === 'duel' ? [0, 2] : [0, 2, 1, 3];
    const order = setup.mode === 'duel' ? [0, 2] : [0, 2, 1, 3];
    $('#setup-seats').innerHTML = order.filter(i => used.includes(i)).map(i => {
      const s = setup.seats[i];
      return seatRow(i, s, {
        input: true,
        sub: setup.mode === 'team' ? (i % 2 === 0 ? 'Team Kaltwasser' : 'Team Abendrot') : (i === 0 ? 'Flotte Blau' : 'Flotte Grün'),
        right: `<button class="kind" data-kind="${s.kind}">${s.kind === 'human' ? 'Mensch' : 'Computer'}</button>`,
      });
    }).join('');
    const humans = used.filter(i => setup.seats[i].kind === 'human').length;
    $('#setup-note').textContent = setup.mode === 'team'
      ? 'Partner sitzen sich gegenüber. ' + (humans > 1 ? 'Vor jedem Zug wird das Gerät weitergegeben – die Handkarten bleiben verdeckt.' : '')
      : (humans > 1 ? 'Vor jedem Zug wird das Gerät weitergegeben – die Handkarten bleiben verdeckt.' : 'Jede Seite führt eine Flotte mit vier Schiffen.');
  }
  $('#setup-mode').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    setup.mode = b.dataset.mode; Sound.tap(); renderSetup();
  };
  $('#setup-seats').addEventListener('click', e => {
    const k = e.target.closest('.kind'); if (!k) return;
    const i = +k.closest('.seat').dataset.seat, s = setup.seats[i];
    s.kind = s.kind === 'human' ? 'ai' : 'human';
    s.name = s.kind === 'ai' ? s.bot : humanName(i);
    Sound.tap(); renderSetup();
  });
  $('#setup-seats').addEventListener('input', e => {
    const inp = e.target.closest('input'); if (!inp) return;
    const i = +inp.closest('.seat').dataset.seat;
    setup.seats[i].name = inp.value;
  });
  $('#setup-start').onclick = () => {
    Sound.unlock();
    const used = setup.mode === 'duel' ? [0, 2] : [0, 1, 2, 3];
    const key = setup.preset === 'solo' ? 'soloNames' : 'localNames';
    prefs[key] = prefs[key] || {};
    const seats = [0, 1, 2, 3].map(i => {
      if (!used.includes(i)) return null;
      const s = setup.seats[i];
      const name = (s.name || '').trim() || (s.kind === 'human' ? humanName(i) : s.bot);
      if (s.kind === 'human') prefs[key][i] = name;
      return { kind: s.kind, name };
    });
    savePrefs();
    startGame(new SG.HostSession({ mode: setup.mode, seats }));
  };

  /* ================= Online-Lobby ================= */
  const L = { net: null, role: null, code: '', mode: 'team', seats: [], tokens: {}, session: null, you: null };
  const myToken = (() => {
    let t = sessionStorage.getItem('seegang.token');
    if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('seegang.token', t); }
    return t;
  })();
  const onlineName = () => ($('#online-name').value || '').trim().slice(0, 14) || 'Gast';

  function openOnline(code) {
    closeOnline();
    $('#online-entry').hidden = false;
    $('#online-lobby').hidden = true;
    $('#online-msg').textContent = '';
    $('#online-name').value = prefs.onlineName || '';
    if (code) $('#online-code').value = SG.Net.cleanCode(code);
    show('scr-online');
  }
  function closeOnline() {
    if (L.net) { try { L.net.close(); } catch (e) {} }
    L.net = null; L.role = null; L.session = null; L.tokens = {}; L.you = null;
  }
  function lobbyUsed() { return L.mode === 'duel' ? [0, 2] : [0, 1, 2, 3]; }
  function lobbyPublic() {
    return { t: 'lobby', code: L.code, mode: L.mode, seats: L.seats.map(s => ({ kind: s.kind, name: s.name || '' })) };
  }
  function lobbyBroadcast() {
    L.seats.forEach((s, i) => { if (s.kind === 'remote' && s.conn) L.net.send(s.conn, Object.assign(lobbyPublic(), { you: i })); });
    renderLobby();
  }
  function renderLobby() {
    const host = L.role === 'host';
    $('#online-entry').hidden = true;
    $('#online-lobby').hidden = false;
    $('#lobby-code').textContent = L.code;
    $$('#lobby-mode button').forEach(b => { b.classList.toggle('on', b.dataset.mode === L.mode); b.disabled = !host; });
    const order = L.mode === 'duel' ? [0, 2] : [0, 2, 1, 3];
    $('#lobby-seats').innerHTML = order.map(i => {
      const s = L.seats[i];
      const mine = i === L.you;
      const name = s.kind === 'open' ? 'Frei' : s.kind === 'ai' ? 'Computer' : s.name;
      let right = '';
      if (host && (s.kind === 'open' || s.kind === 'ai')) right = `<button class="kind" data-toggle="${i}">${s.kind === 'open' ? 'Wartet …' : 'Computer'}</button>`;
      else if (!host && s.kind === 'open') right = `<button class="kind" data-sit="${i}">Hierhin</button>`;
      else if (mine) right = '<span class="you">Du</span>';
      const team = L.mode === 'team' ? (i % 2 === 0 ? 'Team Kaltwasser' : 'Team Abendrot') : (i === 0 ? 'Flotte Blau' : 'Flotte Grün');
      return `<div class="seat s${i} ${s.kind === 'open' ? 'open' : ''}" data-seat="${i}">${token(i)}<div class="seat-main"><b>${esc(name)}</b><small>${team}</small></div>${right}</div>`;
    }).join('');
    $('#lobby-note').textContent = host
      ? 'Teile den Code oder den Link. Freie Plätze übernimmt beim Start der Computer.'
      : 'Warte, bis der Gastgeber die Partie startet.';
    $('#lobby-start').hidden = !host;
  }

  $('#online-host').onclick = () => {
    Sound.unlock();
    prefs.onlineName = onlineName(); savePrefs();
    $('#online-msg').textContent = 'Raum wird eröffnet …';
    L.role = 'host'; L.mode = 'team'; L.you = 0; L.tokens = {};
    L.seats = [{ kind: 'host', name: onlineName() }, { kind: 'open' }, { kind: 'open' }, { kind: 'open' }];
    L.net = SG.Net.host({
      open(code) { L.code = code; $('#online-msg').textContent = ''; renderLobby(); },
      join() {},
      data: hostData,
      leave: hostLeave,
      error(text) { $('#online-msg').textContent = text; toast(text, 4000); },
    });
  };
  function hostData(connId, msg) {
    if (msg.t === 'hello') {
      const name = String(msg.name || 'Gast').slice(0, 14);
      const tok = String(msg.token || '');
      let seat = L.tokens[tok];
      if (L.session) {
        const s = seat !== undefined ? L.seats[seat] : null;
        if (!s || s.kind !== 'remote') { L.net.send(connId, { t: 'full' }); return; }
        s.conn = connId;
        L.session.sendState(seat);
        L.session.refreshSeats();
        toast(s.name + ' ist wieder an Bord.');
        return;
      }
      if (seat === undefined || L.seats[seat].kind !== 'open') seat = lobbyUsed().find(i => L.seats[i].kind === 'open');
      if (seat === undefined) { L.net.send(connId, { t: 'full' }); return; }
      L.seats[seat] = { kind: 'remote', name, conn: connId, token: tok };
      L.tokens[tok] = seat;
      Sound.turn();
      lobbyBroadcast();
    } else if (msg.t === 'sit' && !L.session) {
      const from = L.seats.findIndex(s => s.kind === 'remote' && s.conn === connId);
      const to = +msg.seat;
      if (from < 0 || !lobbyUsed().includes(to) || L.seats[to].kind !== 'open') return;
      L.seats[to] = L.seats[from]; L.seats[from] = { kind: 'open' };
      L.tokens[L.seats[to].token] = to;
      lobbyBroadcast();
    } else if (msg.t === 'act' && L.session) {
      const seat = L.seats.findIndex(s => s && s.kind === 'remote' && s.conn === connId);
      if (seat < 0) return;
      const r = L.session.act(msg.action, seat);
      if (!r.ok) L.session.sendState(seat);
    }
  }
  function hostLeave(connId) {
    const seat = L.seats.findIndex(s => s && s.kind === 'remote' && s.conn === connId);
    if (seat < 0) return;
    if (L.session) {
      const s = L.seats[seat];
      s.conn = null;
      toast(s.name + ' hat die Verbindung verloren – der Computer übernimmt.', 3600);
      L.session.refreshSeats();
      if (!G.busy) L.session.idle();
    } else {
      delete L.tokens[L.seats[seat].token];
      L.seats[seat] = { kind: 'open' };
      lobbyBroadcast();
    }
  }
  $('#lobby-mode').onclick = e => {
    const b = e.target.closest('button'); if (!b || L.role !== 'host') return;
    L.mode = b.dataset.mode;
    if (L.mode === 'duel') {
      // Mitspieler von den Plätzen 1/3 auf Platz 2 holen, soweit möglich
      [1, 3].forEach(i => {
        const s = L.seats[i];
        if (s.kind === 'remote' && L.seats[2].kind !== 'remote') { L.seats[2] = s; L.tokens[s.token] = 2; L.seats[i] = { kind: 'open' }; }
      });
    }
    Sound.tap(); lobbyBroadcast();
  };
  $('#lobby-seats').addEventListener('click', e => {
    const t = e.target.closest('[data-toggle]'), s = e.target.closest('[data-sit]');
    if (t && L.role === 'host') {
      const i = +t.dataset.toggle;
      L.seats[i] = { kind: L.seats[i].kind === 'open' ? 'ai' : 'open' };
      Sound.tap(); lobbyBroadcast();
    } else if (s && L.role === 'guest') {
      L.net.send({ t: 'sit', seat: +s.dataset.sit });
    }
  });
  $('#lobby-share').onclick = async () => {
    const url = location.origin + location.pathname + '?raum=' + L.code;
    const text = 'Komm an Bord – Seefahrt, Raum ' + L.code;
    try {
      if (navigator.share) { await navigator.share({ title: 'Seefahrt', text, url }); return; }
      await navigator.clipboard.writeText(url);
      toast('Link kopiert.');
    } catch (e) { toast('Raum-Code: ' + L.code); }
  };
  $('#lobby-start').onclick = () => {
    if (L.role !== 'host') return;
    Sound.unlock();
    const used = lobbyUsed();
    const bots = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    // Mitspieler auf Plätzen, die es in diesem Modus nicht gibt, können nicht mitspielen
    const seats = [0, 1, 2, 3].map(i => {
      const s = L.seats[i];
      if (!used.includes(i)) return null;
      if (s.kind === 'host') return { kind: 'human', name: s.name };
      if (s.kind === 'remote') return s;
      return { kind: 'ai', name: bots[i] };
    });
    L.seats = seats.map(s => s || { kind: 'none' });
    L.session = new SG.HostSession({ mode: L.mode, seats, net: L.net });
    startGame(L.session);
  };

  $('#online-join').onclick = () => joinRoom($('#online-code').value);
  function joinRoom(code) {
    Sound.unlock();
    code = SG.Net.cleanCode(code);
    if (code.length < 5) { $('#online-msg').textContent = 'Der Raum-Code hat fünf Buchstaben.'; return; }
    prefs.onlineName = onlineName(); savePrefs();
    $('#online-msg').textContent = 'Verbinde …';
    if (L.net) { try { L.net.close(); } catch (e) {} }
    L.role = 'guest'; L.code = code; L.session = null;
    const net = L.net = SG.Net.join(code, {
      open() { net.send({ t: 'hello', name: onlineName(), token: myToken }); },
      data(msg) {
        if (L.net !== net) return;
        if (msg.t === 'lobby') {
          L.mode = msg.mode; L.seats = msg.seats; L.you = msg.you; L.code = msg.code;
          $('#online-msg').textContent = '';
          if (document.body.dataset.screen !== 'scr-online') show('scr-online');
          renderLobby();
        } else if (msg.t === 'update') {
          if (!L.session) { L.session = new SG.RemoteSession(net); startGame(L.session, true); }
          L.session.receive(msg);
        } else if (msg.t === 'full') {
          $('#online-msg').textContent = 'In diesem Raum ist kein Platz mehr frei.';
          if (document.body.dataset.screen !== 'scr-online') openOnline(code);
        }
      },
      close() {
        if (L.net !== net) return;
        if (L.session) lostConnection(code);
        else { $('#online-msg').textContent = 'Der Raum wurde geschlossen.'; $('#online-entry').hidden = false; $('#online-lobby').hidden = true; }
      },
      error(text) {
        if (L.net !== net) return;
        if (L.session) lostConnection(code);
        else { $('#online-msg').textContent = text; $('#online-entry').hidden = false; $('#online-lobby').hidden = true; }
      },
    });
  }
  function lostConnection(code) {
    const c = modal('<h3>Verbindung verloren</h3><p class="ask">Die Verbindung zum Gastgeber ist abgerissen. Solange du fort bist, steuert der Computer deine Flotte.</p><div class="row"><button class="btn" data-a="quit">Zum Menü</button><button class="btn primary" data-a="again">Neu verbinden</button></div>', { sticky: true });
    c.onclick = e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      closeModal();
      if (a.dataset.a === 'again') { L.session = null; G.session = null; joinRoom(code); toast('Verbinde neu …'); }
      else leaveGame(true);
    };
  }

  /* ================= Spieltisch ================= */
  const G = {
    session: null, view: null, seats: [], viewer: 0,
    queue: [], busy: false, built: false,
    hand: [],               // [{card, el}]
    counts: {},             // angezeigte Kartenzahl je Platz
    sel: { card: null, ship: null },
    acts: [], open: false, giveSel: null,
    active: null,
  };
  SG.G = G;
  SG.speed = prefs.fast ? 0.55 : 1;

  function startGame(session, quiet) {
    if (G.session && G.session !== session) G.session.leave();
    G.session = session;
    G.queue = []; G.view = null; G.hand = []; G.counts = {}; G.sel = { card: null, ship: null };
    G.open = false; G.active = null;
    $('#hand').innerHTML = ''; $('#pile').innerHTML = ''; $('#fly').innerHTML = '';
    $('#status').innerHTML = '';
    closeModal(); $('#veil').hidden = true;
    if (!G.built) { B.build($('#board')); G.built = true; }
    show('scr-game');
    sizeTable();
    session.onUpdate = u => { if (G.session !== session) return; G.queue.push(u); pump(); };
    if (session.isHost) session.start();
  }

  async function leaveGame(force) {
    if (!force) {
      const online = G.session && G.session.online;
      const ok = await confirmBox(online ? 'Partie wirklich verlassen?' : 'Zurück zum Menü? Die Partie wird gespeichert.', 'Verlassen', 'Bleiben');
      if (!ok) return;
    }
    if (G.session) G.session.leave();
    G.session = null; G.queue = [];
    closeOnline();
    $('#veil').hidden = true;
    showTitle();
  }
  function showTitle() {
    $('#btn-resume').hidden = !SG.HostSession.saved();
    show('scr-title');
  }

  const name = seat => (G.seats[seat] && G.seats[seat].name) || 'Platz ' + (seat + 1);
  const relSeat = rel => (G.viewer + rel) % 4;
  const chipEl = seat => $(`.chip[data-rel="${(seat - G.viewer + 4) % 4}"]`);
  function isYou(seat) {
    if (seat !== G.viewer) return false;
    if (!G.session.isHost) return true;
    return G.session.locals().length === 1 && G.session.locals()[0] === seat;
  }
  const who = seat => (isYou(seat) ? 'Du' : name(seat));
  const verb = (seat, du, er) => (isYou(seat) ? du : er);
  function canAct() {
    if (!G.session) return false;
    if (!G.session.isHost) return true;
    const s = G.session.seats[G.viewer];
    return !!s && s.kind === 'human';
  }
  const LABEL = { swap: 'Kurswechsel', board: 'Entern', pilot: 'den Lotsen', shark: 'den Weißen Hai', trade: 'Handel', vision: 'Weitblick', storm: 'Sturmfront' };
  function cardLabel(type) {
    return /^\d+$/.test(type) ? 'die ' + type : LABEL[type] || type;
  }

  /* ---------- Größen ---------- */
  function sizeTable() {
    const hand = $('#hand'), table = $('#table'), box = $('#board-box');
    const H = window.innerHeight;
    const side = H < 540 && window.innerWidth > H * 1.3;
    document.body.classList.toggle('side', side);
    let cw, bs;
    if (side) {
      const dockW = $('.dock').clientWidth;
      cw = Math.round(Math.max(44, Math.min(92, (dockW - 24) / 4.3, H * 0.27)));
      bs = Math.min(H - $('.bar').offsetHeight - 10, table.clientWidth - 2 * 84);
    } else {
      const W = Math.min(window.innerWidth, 760);
      cw = Math.round(Math.max(52, Math.min(104, (W - 28) / 4.7, H * 0.125)));
    }
    hand.style.setProperty('--cw', cw + 'px');
    G.cw = cw;
    if (!side) {
      const wide = window.matchMedia('(min-width: 820px) and (min-aspect-ratio: 11/10)').matches;
      const availH = H - $('.bar').offsetHeight - $('.dock').offsetHeight - (wide ? 14 : 2 * 44 + 14);
      const availW = wide ? table.clientWidth - 2 * 190 : table.clientWidth - 20;
      bs = Math.min(availH, availW, 860);
    }
    bs = Math.floor(Math.max(200, bs));
    box.style.width = bs + 'px';
    $('#pile').style.setProperty('--cw', Math.max(30, Math.round(bs * 0.118)) + 'px');
    layoutHand();
  }
  window.addEventListener('resize', () => { if (!$('#scr-game').hidden) sizeTable(); });

  /* ---------- Spielerleisten ---------- */
  function renderChips(view) {
    for (let rel = 0; rel < 4; rel++) {
      const seat = relSeat(rel), el = $(`.chip[data-rel="${rel}"]`);
      if (!view.seats.includes(seat)) { el.classList.add('none'); el.innerHTML = ''; continue; }
      const info = G.seats[seat] || {};
      let sub = '';
      if (view.mode === 'team') sub = seat === G.viewer ? '' : (E.partner(view, G.viewer) === seat ? 'Partner' : '');
      if (info.kind === 'ai' && !sub) sub = 'Computer';
      if (info.off) sub = 'getrennt';
      el.className = `chip s${seat}` + (rel === 0 ? ' me' : '') + (rel >= 2 ? ' right' : '');
      el.dataset.seat = seat;
      el.style.setProperty('--c', B.COLORS[seat]);
      el.dataset.sub = sub;
      el.innerHTML = `${token(seat)}<span class="who"><b>${esc(name(seat))}</b><small></small></span><span class="minis"></span>`;
      setCount(seat, G.counts[seat] !== undefined ? G.counts[seat] : view.hands[seat].length);
      showOpen(seat, view);
      const trading = view.phase === 'exchange' && view.give[seat] !== null && view.give[seat] !== -1;
      setFlag(seat, view.out[seat] ? 'setzt aus' : view.skip[seat] > 0 ? 'muss aussetzen' : trading ? 'bereit' : '');
    }
    setActive(view.phase === 'play' ? view.turn : null);
  }
  function setCount(seat, n) {
    G.counts[seat] = n;
    const el = chipEl(seat); if (!el) return;
    const m = el.querySelector('.minis'); if (!m) return;
    while (m.children.length > n) m.lastChild.remove();
    while (m.children.length < n) m.appendChild(document.createElement('i'));
  }
  /* Weitblick (und Entern): sichtbare fremde Karten in der Spielerleiste – antippen zeigt sie groß */
  function showOpen(seat, view) {
    const el = chipEl(seat); if (!el) return;
    const m = el.querySelector('.minis'); if (!m) return;
    const cards = seat !== G.viewer ? (view.hands[seat] || []).filter(Boolean) : [];
    m.classList.toggle('open', cards.length > 0);
    el.classList.toggle('peekable', cards.length > 0);
    if (!cards.length) { $$('i', m).forEach(i => { i.className = ''; i.innerHTML = ''; }); return; }
    m.innerHTML = cards.map(c => {
      const d = Cards.INFO[c.type];
      return `<i class="mface" title="${esc(d.name)}">${d.icon ? Cards.ICON[d.icon] : esc(d.big)}</i>`;
    }).join('');
    G.counts[seat] = cards.length;
  }
  /* Karten anderer Spieler groß zeigen. groups: [{seat, cards}] */
  function peekCards(title, groups, note) {
    return new Promise(res => {
      const rows = groups.map(g => `<div class="peek-row"><div class="peek-who">${token(g.seat)}<b>${esc(name(g.seat))}</b></div><div class="peek-cards" data-seat="${g.seat}">${g.cards.length ? '' : '<span class="fine">keine Karten</span>'}</div></div>`).join('');
      const c = modal(`<h3>${esc(title)}</h3>${note ? `<p class="ask">${note}</p>` : ''}${rows}<button class="btn primary wide" data-a="ok">Weiter</button>`, { cls: 'peek' });
      groups.forEach(g => {
        const box = c.querySelector(`.peek-cards[data-seat="${g.seat}"]`);
        for (const card of g.cards) box.appendChild(Cards.el(card));
      });
      let done = false;
      const finish = () => { if (done) return; done = true; closeModal(); res(); };
      c.querySelector('[data-a="ok"]').onclick = () => { Sound.tap(); finish(); };
      $('#modal').onclick = e => { if (e.target === $('#modal')) finish(); };
    });
  }
  $$('.chip').forEach(chip => chip.addEventListener('click', () => {
    if (!G.view || !chip.classList.contains('peekable')) return;
    const seat = +chip.dataset.seat, cards = (G.view.hands[seat] || []).filter(Boolean);
    if (seat === G.viewer || !cards.length) return;
    Sound.tap();
    peekCards(`Die Karten von ${name(seat)}`, [{ seat, cards }]);
  }));
  function setActive(seat) {
    G.active = seat;
    $$('.chip').forEach(c => c.classList.toggle('active', seat !== null && +c.dataset.seat === seat && !c.classList.contains('none')));
  }
  function setFlag(seat, text) {
    const el = chipEl(seat); if (!el) return;
    const f = el.querySelector('.who small'); if (!f) return;
    f.textContent = text || el.dataset.sub || '';
    f.classList.toggle('flag', !!text);
    el.classList.toggle('out', text === 'setzt aus' || text === 'muss aussetzen');
  }

  /* ---------- Status ---------- */
  function setStatus(html, btn) {
    const s = $('#status');
    const next = `<span class="msg">${html}</span>` + (btn ? `<button class="btn small primary" id="status-btn">${esc(btn.label)}</button>` : '');
    if (s.dataset.html === next) return;
    s.dataset.html = next;
    s.innerHTML = next;
    if (btn) $('#status-btn').onclick = () => { Sound.tap(); btn.go(); };
  }

  /* ---------- Hand ---------- */
  function sortHand() {
    G.hand.sort((a, b) => ORDER.indexOf(a.card.type) - ORDER.indexOf(b.card.type) || a.card.id - b.card.id);
  }
  function handTransform(i, n, selected) {
    const hand = $('#hand');
    const W = hand.clientWidth, cw = G.cw || 80;
    const gap = n > 1 ? Math.min(cw * 0.84, (W - 20 - cw) / (n - 1)) : 0;
    const k = i - (n - 1) / 2;
    const x = k * gap, rot = selected ? 0 : k * Math.min(2.4, 11 / Math.max(1, n)), y = selected ? -cw * 0.22 : k * k * 1.1;
    return `translate(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)` + (selected ? ' scale(1.06)' : '');
  }
  function layoutHand() {
    const n = G.hand.length;
    G.hand.forEach((h, i) => {
      const sel = G.sel.card === h.card.id || G.giveSel === h.card.id;
      h.el.style.transform = handTransform(i, n, sel);
      h.el.style.zIndex = 10 + i;
      h.el.classList.toggle('sel', sel);
    });
  }
  function addHandCard(card) {
    const el = Cards.el(card);
    $('#hand').appendChild(el);
    G.hand.push({ card, el });
    sortHand();
    return el;
  }
  function syncHand(cards) {
    const types = new Map(cards.map(c => [c.id, c.type]));
    G.hand = G.hand.filter(h => { if (types.get(h.card.id) === h.card.type) return true; h.el.remove(); return false; });
    const have = new Set(G.hand.map(h => h.card.id));
    for (const c of cards) if (!have.has(c.id)) addHandCard(c);
    $$('#hand .card').forEach(el => { if (!G.hand.some(h => h.el === el)) el.remove(); });
    sortHand();
    layoutHand();
  }
  function takeHandCard(id) {
    const i = G.hand.findIndex(h => h.card.id === id);
    if (i < 0) return null;
    const h = G.hand.splice(i, 1)[0];
    return h.el;
  }
  $('#hand').addEventListener('click', e => {
    const el = e.target.closest('.card'); if (!el || !G.open) return;
    onCard(+el.dataset.id);
  });

  /* ---------- Fliegende Karten ---------- */
  function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
  function pileRect() { return rectOf($('#pile')); }
  function anim(el, frames, opts) {
    if (!el.animate) return Promise.resolve();
    const k = SG.speed || 1;
    opts = Object.assign({}, opts, { duration: (opts.duration || 0) * k, delay: (opts.delay || 0) * k });
    const a = el.animate(frames, opts);
    return Promise.race([a.finished.catch(() => {}), new Promise(r => setTimeout(r, opts.duration + opts.delay + 80))]);
  }
  /* Lässt ein Kartenelement von from nach to fliegen (Mittelpunkte in Bildschirmkoordinaten). */
  async function flyCard(el, from, to, opts) {
    opts = opts || {};
    const fly = $('#fly');
    const w = to.w, h = to.w * 1.42;
    el.style.cssText = '';
    el.classList.remove('sel', 'playable', 'dim', 'new');
    el.style.setProperty('--cw', w + 'px');
    el.classList.add('flying');
    fly.appendChild(el);
    const T = (p, s, r) => `translate(${(p.x - w / 2).toFixed(1)}px, ${(p.y - h / 2).toFixed(1)}px) scale(${s}) rotate(${r || 0}deg)`;
    const s0 = from.w / w;
    const frames = [{ transform: T(from, s0, opts.rot0 || 0), opacity: opts.fadeIn ? 0 : 1 }];
    if (opts.show) {
      const mid = { x: opts.show.x, y: opts.show.y };
      frames.push({ transform: T(mid, opts.show.s, 0), opacity: 1, offset: 0.36, easing: 'ease-in-out' });
      frames.push({ transform: T(mid, opts.show.s * 1.03, 0), opacity: 1, offset: 0.7, easing: 'cubic-bezier(.5,0,.3,1)' });
    }
    frames.push({ transform: T(to, 1, opts.rot || 0), opacity: opts.fadeOut ? 0 : 1 });
    await anim(el, frames, { duration: opts.dur || 520, easing: 'cubic-bezier(.3,.7,.25,1)', fill: 'forwards', delay: opts.delay || 0 });
  }
  function toPile(el, rot) {
    const pile = $('#pile');
    if (el.getAnimations) el.getAnimations().forEach(a => a.cancel());
    el.classList.remove('flying', 'down');
    el.style.cssText = '';
    el.style.transform = `rotate(${rot}deg)`;
    pile.appendChild(el);
    while (pile.children.length > 5) pile.firstChild.remove();
  }
  function miniFly(from, to, delay, dur) {
    const m = document.createElement('i');
    m.className = 'mini-fly';
    $('#fly').appendChild(m);
    const T = p => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    return anim(m, [{ transform: T(from) + ' scale(1.6) rotate(-40deg)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: T(to) + ' scale(1) rotate(0deg)', opacity: 1 }],
      { duration: dur || 420, delay: delay || 0, easing: 'cubic-bezier(.3,.7,.25,1)', fill: 'both' }).then(() => m.remove());
  }
  function banner(big, small) {
    const b = $('#banner');
    b.innerHTML = `<strong>${esc(big)}</strong><span>${esc(small || '')}</span>`;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  }

  /* ---------- Ereignisse abspielen ---------- */
  async function playEvents(events, u) {
    for (const e of events) {
      switch (e.t) {
        case 'reshuffle': toast('Der Stapel wird neu gemischt.'); break;
        case 'roundEnd': {
          await sleep(350);
          const pile = $('#pile');
          await Promise.all($$('.card', pile).map(c => anim(c, [{ opacity: 1 }, { opacity: 0, transform: c.style.transform + ' scale(.6)' }], { duration: 320, fill: 'forwards' })));
          pile.innerHTML = '';
          break;
        }
        case 'deal': await doDeal(e, u); break;
        case 'gave': await doGave(e, u); break;
        case 'exchanged': await doExchanged(e, u); break;
        case 'turn':
          if (e.bonus) setStatus(`<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'darfst', 'darf')} noch eine Karte spielen`);
          setActive(e.seat);
          if (isYou(e.seat) || (e.seat === u.viewer && canAct())) Sound.turn();
          await sleep(140);
          break;
        case 'play': await doPlay(e); break;
        case 'launch': await B.launch(e.ship, e.to, e.hit); break;
        case 'move':
          await B.moveShip(e.ship, e.path);
          if (e.home) { B.homeGlow(e.ship); await sleep(420); }
          break;
        case 'swap': await B.swap(e.a, e.posA, e.b, e.posB); break;
        case 'shark': await B.sharkRun(e.path); break;
        case 'roll': await doRoll(e); break;
        case 'sharkIn':
          banner('Der Weiße Hai', 'taucht auf');
          await sleep(300);
          await B.sharkAppear(e.at, e.hit);
          break;
        case 'undo':
          setStatus('Der Lotse nimmt den letzten Zug zurück');
          await B.restore(e.moves, e.shark);
          break;
        case 'replay':
          if (e.none) { setStatus(`Die ${esc(cardLabel(e.type).replace(/^die |^den /, ''))} lässt sich jetzt nicht nutzen`); await sleep(900); }
          else if (e.seat !== G.viewer) setStatus(`<b>${esc(who(e.seat))}</b> nutzt ${esc(cardLabel(e.type))} selbst`);
          break;
        case 'splitLeft':
          if (e.seat !== G.viewer) setStatus(`${esc(who(e.seat))} verteilt die 5 – noch ${e.left} ${e.left === 1 ? 'Schritt' : 'Schritte'}`);
          break;
        case 'skip':
          setStatus(`<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'lässt', 'lässt')} <b>${esc(isYou(e.target) ? 'dich' : name(e.target))}</b> aussetzen`);
          setFlag(e.target, 'muss aussetzen');
          Sound.fold();
          await sleep(700);
          break;
        case 'discard': await doDiscard(e); break;
        case 'board':
          setStatus(`<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'enterst', 'entert')} <b>${esc(isYou(e.victim) ? 'dich' : name(e.victim))}</b>` + (e.none ? ' – aber keine Karte lässt sich nutzen' : ''));
          if (e.cards && e.seat === G.viewer && canAct()) {
            await sleep(350);
            await peekCards(`Die Karten von ${name(e.victim)}`, [{ seat: e.victim, cards: e.cards }],
              e.none ? 'Keine davon lässt sich für ihn nutzen – das Entern verpufft.' : 'Spiele eine davon für ihn: eine Zahlenkarte, einen Kurswechsel oder den Hai. Die übrigen behält er.');
          }
          if (!e.none && e.seat === G.viewer && canAct()) { syncHand(u.view.hands[e.victim].filter(Boolean)); G.hand.forEach(h => h.el.classList.add('new')); }
          await sleep(e.none ? 1100 : 500);
          break;
        case 'trade':
          setStatus(`<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'handelst', 'handelt')} mit <b>${esc(isYou(e.partner) ? 'dir' : name(e.partner))}</b>`);
          await sleep(500);
          break;
        case 'vision':
          setStatus(`<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'siehst', 'sieht')} bis zum Rundenende alle Karten`);
          banner('Weitblick', e.hands && e.seat === G.viewer ? 'Du siehst alle Karten' : 'sieht alle Karten');
          for (const s of u.view.seats) showOpen(s, u.view);
          await sleep(900);
          if (e.hands && e.seat === G.viewer && canAct()) {
            const groups = u.view.seats.filter(s => s !== e.seat).map(s => ({ seat: s, cards: e.hands[s] || [] }));
            await peekCards('Weitblick', groups, 'Bis zum Ende der Runde siehst du die Karten der anderen. Tippe auf einen Spieler, um seine Karten wieder anzusehen.');
          }
          break;
        case 'storm':
          banner('Sturmfront', 'Karten nach rechts');
          Sound.fold();
          await sleep(600);
          for (const s of u.view.seats) if (s !== G.viewer) setCount(s, u.view.hands[s].length);
          syncHand((u.view.hands[G.viewer] || []).filter(Boolean));
          G.hand.forEach(h => h.el.classList.add('new'));
          setTimeout(() => G.hand.forEach(h => h.el.classList.remove('new')), 2200);
          await sleep(500);
          break;
        case 'pass':
          setStatus(`<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'kannst', 'kann')} keine weitere Karte spielen`);
          await sleep(700);
          break;
        case 'fold': await doFold(e); break;
        case 'win': await sleep(500); break;
      }
    }
  }

  async function doDeal(e, u) {
    $('#round-info').textContent = `Runde ${e.round + 1}`;
    banner(`Runde ${e.round + 1}`, `${e.size} Karten`);
    u.view.seats.forEach(s => setFlag(s, ''));
    setActive(null);
    const v = u.view;
    for (const s of v.seats) setCount(s, 0);
    syncHand([]);
    setStatus('Die Karten werden verteilt …');
    await sleep(520);
    const from = pileRect();
    const order = [];
    let s = e.dealer;
    for (let k = 0; k < v.seats.length; k++) { s = E.nextSeat(v, s); order.push(s); }
    const jobs = [];
    let t = 0;
    const mine = (e.hands[G.viewer] || []).filter(Boolean);
    for (let k = 0; k < e.size; k++) {
      for (const seat of order) {
        const delay = t; t += 58;
        if (seat === G.viewer && mine[k]) {
          jobs.push((async () => {
            await sleep(delay);
            Sound.deal();
            const el = addHandCard(mine[k]);
            layoutHand();
            const hr = rectOf($('#hand'));
            const final = el.style.transform;
            const dx = from.x - hr.x, dy = from.y - ($('#hand').getBoundingClientRect().top + 28) - G.cw * 0.71;
            await anim(el, [
              { transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(-90deg) scale(.42)`, opacity: 0 },
              { opacity: 1, offset: 0.2 },
              { transform: final, opacity: 1 }],
              { duration: 560, easing: 'cubic-bezier(.25,.75,.25,1)' });
          })());
        } else {
          const chip = chipEl(seat);
          if (!chip) continue;
          const target = rectOf(chip.querySelector('.minis'));
          jobs.push(miniFly(from, target, delay, 440).then(() => setCount(seat, (G.counts[seat] || 0) + 1)));
        }
      }
    }
    await Promise.all(jobs);
    await sleep(150);
  }

  async function doGave(e, u) {
    const p = E.partner(u.view, e.seat);
    setFlag(e.seat, 'bereit');
    if (e.seat === G.viewer) {
      const id = G.giveSel !== null ? G.giveSel : u.view.give[e.seat];
      G.giveSel = null;
      const el = takeHandCard(id);
      if (el) {
        const from = rectOf(el), chip = chipEl(p);
        const to = rectOf(chip.querySelector('.minis'));
        layoutHand();
        Sound.card();
        el.classList.add('down');
        await flyCard(el, from, { x: to.x, y: to.y, w: Math.max(26, G.cw * 0.4) }, { dur: 520, fadeOut: true });
        el.remove();
      }
    } else {
      setCount(e.seat, Math.max(0, (G.counts[e.seat] || 1) - 1));
    }
  }
  async function doExchanged(e, u) {
    const v = u.view;
    for (const s of v.seats) { setFlag(s, ''); if (s !== G.viewer) setCount(s, v.hands[s].length); }
    const got = e.got[G.viewer];
    if (got) {
      const p = E.partner(v, G.viewer), chip = chipEl(p);
      const src = rectOf(chip.querySelector('.minis'));
      Sound.card();
      const el = addHandCard(got);
      layoutHand();
      el.classList.add('new');
      const hr = rectOf($('#hand'));
      const dx = src.x - hr.x, dy = src.y - ($('#hand').getBoundingClientRect().top + 28) - G.cw * 0.71;
      await anim(el, [
        { transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.3)`, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: el.style.transform, opacity: 1 }], { duration: 620, easing: 'cubic-bezier(.25,.75,.25,1)' });
      setTimeout(() => el.classList.remove('new'), 2600);
    }
    await sleep(200);
  }

  async function doPlay(e) {
    const holder = e.for !== undefined ? e.for : e.seat;
    const label = cardLabel(e.card.type);
    setStatus(`<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'spielst', 'spielt')} ${esc(label)}` +
      (e.for !== undefined ? ` für <b>${esc(isYou(e.for) ? 'dich' : name(e.for))}</b>` : ''));
    const pile = pileRect();
    const rot = (Math.random() * 16 - 8);
    const box = rectOf($('#board-box'));
    let el = takeHandCard(e.card.id);
    Sound.card();
    if (el) {
      if (holder !== G.viewer) setCount(holder, Math.max(0, (G.counts[holder] || 1) - 1));
      const from = rectOf(el);
      layoutHand();
      await flyCard(el, { x: from.x, y: from.y, w: G.cw }, { x: pile.x, y: pile.y, w: pile.w },
        { dur: 620, rot, show: { x: box.x, y: box.y, s: 1.7 } });
    } else {
      const chip = chipEl(holder);
      const src = chip ? rectOf(chip.querySelector('.minis')) : pile;
      setCount(holder, Math.max(0, (G.counts[holder] || 1) - 1));
      el = Cards.el(e.card, { down: true });
      setTimeout(() => el.classList.remove('down'), 90);
      await flyCard(el, { x: src.x, y: src.y, w: Math.max(22, pile.w * 0.5) }, { x: pile.x, y: pile.y, w: pile.w },
        { dur: 1050, rot, show: { x: box.x, y: box.y, s: 2.3 }, fadeIn: true });
    }
    toPile(el, rot);
  }

  async function doRoll(e) {
    banner('Würfel: ' + e.value, 'Der Hai zieht weiter');
    Sound.deal();
    await sleep(900);
    await B.sharkRun(e.path);
    const hits = e.path.filter(p => p.hit !== undefined).length;
    if (hits) toast(hits === 1 ? 'Der Hai hat ein Schiff erwischt.' : `Der Hai hat ${hits} Schiffe erwischt.`);
  }
  async function doDiscard(e, text) {
    setStatus(text || `<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'setzt', 'setzt')} aus und ${verb(e.seat, 'wirfst', 'wirft')} eine Karte ab`);
    Sound.fold();
    const pile = pileRect(), rot = Math.random() * 30 - 15;
    let el = takeHandCard(e.card.id), from;
    if (el) { from = Object.assign(rectOf(el), { w: G.cw }); layoutHand(); }
    else {
      const chip = chipEl(e.seat);
      const src = chip ? rectOf(chip.querySelector('.minis')) : pile;
      from = { x: src.x, y: src.y, w: Math.max(22, pile.w * 0.5) };
      setCount(e.seat, Math.max(0, (G.counts[e.seat] || 1) - 1));
      el = Cards.el(e.card, { down: true });
      setTimeout(() => el.classList.remove('down'), 60);
    }
    await flyCard(el, from, { x: pile.x, y: pile.y, w: pile.w }, { dur: 560, rot });
    toPile(el, rot);
    setFlag(e.seat, '');
    await sleep(300);
  }
  async function doFold(e) {
    await doDiscard(e, `<b>${esc(who(e.seat))}</b> ${verb(e.seat, 'kannst', 'kann')} nicht ziehen und ${verb(e.seat, 'wirfst', 'wirft')} eine Karte ab`);
  }

  /* ---------- Gerät weitergeben ---------- */
  function passDevice(seat) {
    return new Promise(res => {
      const v = $('#veil');
      v.innerHTML = `<div class="veil-in"><img src="assets/ship.webp" alt="" draggable="false">
        <p>Das Gerät geht an</p><h2>${token(seat)} ${esc(name(seat))}</h2>
        <button class="btn primary">Ich bin ${esc(name(seat))}</button></div>`;
      v.hidden = false;
      requestAnimationFrame(() => v.classList.add('on'));
      v.querySelector('button').onclick = () => {
        Sound.tap();
        v.classList.remove('on');
        setTimeout(() => { v.hidden = true; }, 320);
        res();
      };
    });
  }

  /* ---------- Ablauf ---------- */
  async function pump() {
    if (G.busy) return;
    G.busy = true;
    try {
      while (G.queue.length) {
        const u = G.queue.shift();
        const session = G.session;
        G.seats = u.seats;
        if (u.soft) { if (G.view) renderChips(G.view); continue; }
        closeInput();
        if (u.fresh || !G.view) {
          // neue Partie oder Wiedereinstieg: Tisch frisch aufbauen
          $('#modal').classList.contains('end') && closeModal();
          G.counts = {};
          G.viewer = u.viewer;
          B.setMode(u.view);
          B.setViewer(u.viewer, false);
          const dealt = u.events.some(e => e.t === 'deal');
          const blank = dealt ? Object.assign({}, u.view, { hands: Object.fromEntries(u.view.seats.map(s => [s, []])), phase: 'deal' }) : u.view;
          $('#pile').innerHTML = '';
          G.hand.forEach(h => h.el.remove()); G.hand = [];
          B.sync(u.view);
          renderChips(blank);
          $('#round-info').textContent = `Runde ${u.view.round + 1}`;
          if (session.isHost && session.locals().length > 1 && dealt) await passDevice(u.viewer);
          if (!dealt) (u.view.top || []).forEach(c => toPile(Cards.el(c), Math.random() * 16 - 8));
        }
        await playEvents(u.events, u);
        if (G.session !== session) return;
        if (u.viewer !== G.viewer) {
          // anderer Mensch am selben Gerät: Hand verdecken, Tisch drehen
          syncHand([]);
          await passDevice(u.viewer);
          G.viewer = u.viewer;
          G.counts = {};
          renderChips(u.view);
          await B.setViewer(u.viewer, true);
        }
        G.view = u.view;
        render();
      }
    } finally {
      G.busy = false;
    }
    if (G.session) {
      if (G.queue.length) pump();
      else G.session.idle();
    }
  }

  function render() {
    const v = G.view;
    G.counts = {};
    $('#round-info').textContent = `Runde ${v.round + 1}`;
    B.sync(v);
    renderChips(v);
    syncHand(shownHand(v));
    if (!$('#pile').children.length) (v.top || []).forEach(c => toPile(Cards.el(c), Math.random() * 16 - 8));
    if (v.phase === 'over') { B.setTargets([]); showEnd(); return; }
    openInput();
  }

  /* Beim Entern hält man die Karten des Geenterten in der Hand. */
  function shownHand(v) {
    const p = v.pend;
    if (p && p.k === 'board' && p.seat === G.viewer && canAct()) return v.hands[p.victim].filter(Boolean);
    return v.hands[G.viewer].filter(Boolean);
  }

  /* ---------- Eingabe ---------- */
  function closeInput() {
    G.open = false;
    G.acts = [];
    G.sel = { card: null, ship: null };
    B.setTargets([]); B.setSelected(null);
    $$('#hand .card').forEach(c => c.classList.remove('playable', 'dim'));
    layoutHand();
  }
  function openInput() {
    const v = G.view, me = G.viewer;
    G.acts = []; G.sel = { card: null, ship: null };
    G.open = false;
    const able = canAct();
    if (v.phase === 'exchange') {
      const trade = v.trade;
      if (able && v.give[me] === null) {
        G.open = true;
        // eine schon getroffene Auswahl bleibt bestehen, auch wenn inzwischen andere abgegeben haben
        if (G.giveSel !== null && !G.hand.some(h => h.card.id === G.giveSel)) G.giveSel = null;
        showGiveStatus();
        G.hand.forEach(h => h.el.classList.add('playable'));
      } else {
        G.giveSel = null;
        setStatus(trade ? `<b>${esc(name(trade[0]))}</b> und <b>${esc(name(trade[1]))}</b> handeln …` : 'Die Karten werden getauscht …');
      }
      layoutHand();
      return;
    }
    G.giveSel = null;
    if (v.phase !== 'play') return;
    if (v.turn !== me || !able) {
      setStatus(`<b>${esc(name(v.turn))}</b> ist am Zug<span class="dots"><i></i><i></i><i></i></span>`);
      G.hand.forEach(h => h.el.classList.remove('playable', 'dim'));
      B.setTargets([]);
      return;
    }
    G.acts = E.legalActions(v, me);
    G.open = true;
    const only = G.acts.length === 1 ? G.acts[0].k : null;
    if (only === 'pass') {
      G.hand.forEach(h => h.el.classList.add('dim'));
      setStatus('Keine weitere Karte lässt sich spielen.', { label: 'Weiter', go: () => act(G.acts[0]) });
      B.setTargets([]);
      return;
    }
    const direct = boardFirst(); // Schritte, die ohne Kartenwahl gezogen werden (5 verteilen, Lotse)
    const playable = new Set(G.acts.map(a => a.card));
    G.hand.forEach(h => {
      h.el.classList.toggle('playable', !direct && playable.has(h.card.id));
      h.el.classList.toggle('dim', direct || !playable.has(h.card.id));
    });
    updateTargets();
  }
  const boardFirst = () => !!(G.view.pend && (G.view.pend.k === 'split' || G.view.pend.k === 'replay'));

  function showGiveStatus() {
    const p = E.partner(G.view, G.viewer), id = G.giveSel;
    if (id === null) setStatus(`Wähle eine Karte für <b>${esc(name(p))}</b>`);
    else setStatus(`Diese Karte geht an <b>${esc(name(p))}</b>`, { label: 'Abgeben', go: () => act({ k: 'give', card: id }) });
  }
  function onCard(id) {
    const v = G.view;
    Sound.tap();
    if (v.phase === 'exchange') {
      G.giveSel = G.giveSel === id ? null : id;
      showGiveStatus();
      layoutHand();
      return;
    }
    if (boardFirst()) return;
    if (!G.acts.some(a => a.card === id)) {
      const h = G.hand.find(x => x.card.id === id);
      if (h) { toast('Diese Karte lässt sich gerade nicht spielen.', 1600); anim(h.el, [{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '0 0' }], { duration: 260 }); }
      return;
    }
    if (G.sel.card === id) { G.sel = { card: null, ship: null }; layoutHand(); updateTargets(); return; }
    G.sel = { card: id, ship: null };
    layoutHand();
    updateTargets();
  }

  function currentActs() {
    if (boardFirst()) return G.acts;
    if (G.sel.card === null) return [];
    return G.acts.filter(a => a.card === G.sel.card);
  }
  function deselect() {
    if (boardFirst()) { if (G.sel.ship !== null) { G.sel.ship = null; updateTargets(); } return; }
    if (G.sel.card === null) return;
    G.sel = { card: null, ship: null };
    layoutHand(); updateTargets();
  }

  const PLAIN = {
    skip: a => `${name(a.target)} aussetzen lassen`, shark: () => 'Hai losschicken', pilot: () => 'Lotse rufen',
    board: () => 'Entern', trade: () => 'Handeln', vision: () => 'Karten ansehen', storm: () => 'Sturm auslösen', discard: () => 'Abwerfen', fold: () => 'Abwerfen',
  };
  function updateTargets() {
    const v = G.view, cur = currentActs(), list = [];
    const p = v.pend;
    if (!cur.length) {
      B.setTargets([], deselect); B.setSelected(null);
      if (G.open && v.phase === 'play' && v.turn === G.viewer) {
        if (p && p.k === 'board') setStatus(`<b>Du enterst ${esc(name(p.victim))}</b> – spiele eine seiner Karten für ihn`);
        else if (v.skip[G.viewer] > 0 && !(p && p.k === 'bonus')) setStatus('<b>Du setzt aus</b> – wähle eine Karte zum Abwerfen');
        else if (G.acts.length && G.acts.every(a => a.k === 'fold')) setStatus('<b>Keine Karte lässt sich spielen</b> – wähle eine Karte zum Abwerfen');
        else if (p && p.k === 'bonus') setStatus('<b>Sturmfront</b> – du darfst noch eine Karte spielen');
        else setStatus('<b>Du bist am Zug</b> – wähle eine Karte');
      }
      return;
    }
    const type = p && p.k === 'split' ? '5' : p && p.k === 'replay' ? p.type : cardType(G.sel.card);
    const info = Cards.INFO[type] || { hint: '' };
    const plain = cur.filter(a => a.ship === undefined);
    const moves = cur.filter(a => a.ship !== undefined);
    const shipIds = Array.from(new Set(moves.map(a => a.ship)));
    if (G.sel.ship !== null && !shipIds.includes(G.sel.ship)) G.sel.ship = null;
    if (shipIds.length === 1 && G.sel.ship === null && !plain.length) G.sel.ship = shipIds[0];
    let swapping = false;
    if (G.sel.ship !== null) {
      const sa = moves.filter(a => a.ship === G.sel.ship);
      const owner = v.ships[G.sel.ship].owner;
      swapping = sa[0].k === 'swap';
      // Tauschpartner zuerst: sie liegen genau auf den anderen wählbaren Schiffen und müssen beim Tippen gewinnen
      if (swapping) for (const a of sa) list.push({ kind: 'aim', ship: a.target, pick: () => act(a) });
      else for (const a of sa) list.push({ kind: 'dest', at: a.dest.at, i: a.dest.i, owner, color: B.COLORS[owner], pick: () => act(a) });
      list.push({ kind: 'self', ship: G.sel.ship, pick: () => { if (sa.length === 1) act(sa[0]); else deselectShip(); } });
    }
    const aimed = new Set(list.filter(t => t.kind === 'aim').map(t => t.ship));
    for (const id of shipIds) {
      if (id === G.sel.ship || aimed.has(id)) continue;
      list.push({ kind: 'ship', ship: id, pick: () => pickShip(id) });
    }
    B.setTargets(list, deselect);
    B.setSelected(G.sel.ship);
    // Hinweistext
    let hint;
    const lead = p && p.k === 'replay' ? `<b>Lotse:</b> Nutze ${esc(cardLabel(type))} selbst. ` : '';
    if (plain.length && (plain[0].k === 'fold' || plain[0].k === 'discard')) hint = 'Diese Karte abwerfen?';
    else if (p && p.k === 'split') hint = `<b>Noch ${p.left} ${p.left === 1 ? 'Schritt' : 'Schritte'}</b> – ` + (G.sel.ship === null ? 'wähle ein Schiff (auch eines deines Partners)' : 'wähle das Zielfeld');
    else if (swapping) hint = 'Mit wem soll getauscht werden? Auch der Hai ist möglich.';
    else if (G.sel.ship !== null) hint = `${lead}${esc(info.hint)} <b>Tippe auf das Ziel.</b>`;
    else if (moves.length) hint = `${lead}${esc(info.hint)} <b>Wähle ein Schiff${plain.length ? ' – oder' : '.'}</b>`;
    else hint = `${lead}${esc(info.hint)}`;
    const btn = plain.length ? { label: PLAIN[plain[0].k] ? PLAIN[plain[0].k](plain[0]) : 'Ausspielen', go: () => act(plain[0]) } : null;
    setStatus(hint, btn);
  }
  function cardType(id) {
    const h = G.hand.find(x => x.card.id === id);
    return h ? h.card.type : null;
  }
  function deselectShip() {
    G.sel.ship = null;
    updateTargets();
  }
  function pickShip(id) {
    const sa = currentActs().filter(a => a.ship === id);
    if (sa.length === 1 && sa[0].k !== 'swap') { act(sa[0]); return; }
    G.sel.ship = id;
    updateTargets();
  }

  function act(a) {
    if (!G.open || !G.session) return;
    const action = { k: a.k };
    for (const key of ['card', 'ship', 'n', 'harbor', 'target']) if (a[key] !== undefined) action[key] = a[key];
    if (a.k === 'give') G.giveSel = a.card;
    const keepGive = G.giveSel;
    G.open = false;
    B.setTargets([]); B.setSelected(null);
    $$('#hand .card').forEach(c => c.classList.remove('playable', 'dim'));
    G.giveSel = keepGive;
    const r = G.session.act(action);
    if (r && !r.ok) { toast(r.error || 'Das geht gerade nicht.'); openInput(); }
  }

  /* ---------- Ende ---------- */
  function showEnd() {
    const v = G.view;
    HostEndCleanup();
    const winners = v.seats.filter(s => E.team(v, s) === v.winner);
    const mine = E.team(v, G.viewer) === v.winner && canAct();
    const names = winners.map(name).join(' & ');
    Sound.win();
    const host = G.session.isHost;
    const c = modal(`<div class="end-art"><img src="assets/ship.webp" alt="" draggable="false"></div>
      <p class="kicker">${mine ? 'Heimathafen erreicht' : 'Die Partie ist entschieden'}</p>
      <h2>${esc(names)} ${winners.length > 1 ? 'gewinnen' : 'gewinnt'}</h2>
      <div class="end-toks">${winners.map(token).join('')}</div>
      <div class="row">${host ? '<button class="btn primary" data-a="again">Noch eine Partie</button>' : '<span class="fine">Der Gastgeber kann eine neue Partie starten.</span>'}<button class="btn" data-a="menu">Zum Menü</button></div>`, { cls: 'end', sticky: true });
    $('#modal').classList.add('end');
    confetti(winners.map(s => B.COLORS[s]));
    c.onclick = e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      $('#modal').classList.remove('end');
      closeModal();
      if (a.dataset.a === 'again') G.session.restart();
      else leaveGame(true);
    };
  }
  function HostEndCleanup() { if (G.session.isHost && !G.session.online) SG.HostSession.clearSave(); }
  function confetti(colors) {
    const fly = document.body;
    const cols = colors.concat(['#1B5EB0', '#F7ECD6', '#16335C']);
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.className = 'confetti';
      p.style.background = cols[i % cols.length];
      p.style.left = (Math.random() * 100) + 'vw';
      const w = 6 + Math.random() * 7;
      p.style.width = w + 'px'; p.style.height = (w * (0.4 + Math.random())) + 'px';
      fly.appendChild(p);
      const dur = 2200 + Math.random() * 2200;
      anim(p, [
        { transform: `translate(0,-8vh) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${(Math.random() * 30 - 15)}vw, 108vh) rotate(${Math.random() * 900 - 450}deg)`, opacity: 0.9 }],
        { duration: dur, delay: Math.random() * 900, easing: 'cubic-bezier(.2,.5,.6,1)', fill: 'both' }).then(() => p.remove());
    }
  }

  /* ---------- Menü ---------- */
  $('#btn-menu').onclick = () => {
    Sound.tap();
    const c = modal(`<h3>Seefahrt</h3>
      <button class="btn wide" data-a="rules">Spielregeln</button>
      <button class="btn wide" data-a="sound">Ton: ${Sound.on ? 'an' : 'aus'}</button>
      <button class="btn wide" data-a="speed">Tempo: ${prefs.fast ? 'zügig' : 'gemütlich'}</button>
      <button class="btn wide" data-a="leave">Partie verlassen</button>
      <button class="btn primary wide" data-a="back">Weiterspielen</button>`, { cls: 'menu-modal' });
    c.onclick = e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'sound') { a.textContent = 'Ton: ' + (Sound.toggle() ? 'an' : 'aus'); return; }
      if (a.dataset.a === 'speed') { prefs.fast = !prefs.fast; savePrefs(); SG.speed = prefs.fast ? 0.55 : 1; a.textContent = 'Tempo: ' + (prefs.fast ? 'zügig' : 'gemütlich'); return; }
      closeModal();
      if (a.dataset.a === 'rules') setTimeout(showRules, 240);
      if (a.dataset.a === 'leave') setTimeout(() => leaveGame(false), 240);
    };
  };
  $('#btn-rules').onclick = () => { Sound.tap(); showRules(); };

  /* ---------- Titel ---------- */
  $('.menu').addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    Sound.unlock(); Sound.tap();
    go(b.dataset.go);
  });
  $$('.back').forEach(b => { b.onclick = () => { Sound.tap(); closeOnline(); showTitle(); }; });
  function go(what) {
    if (what === 'solo' || what === 'local') openSetup(what);
    else if (what === 'online') openOnline();
    else if (what === 'rules') showRules();
    else if (what === 'resume') {
      const s = SG.HostSession.saved();
      if (!s) { showTitle(); return; }
      startGame(new SG.HostSession({ mode: s.mode, seats: s.seats, state: s.state, viewer: s.viewer }));
    }
  }

  SG.debug = { act, go, acts: () => G.acts };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && G.session && !G.busy) pump(); });

  // Einladung per Link: ?raum=CODE
  const invite = new URLSearchParams(location.search).get('raum');
  if (invite) openOnline(invite);
  else showTitle();
})();
