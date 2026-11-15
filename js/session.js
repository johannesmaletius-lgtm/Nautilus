/* Seegang – Partie-Sitzungen.
 * HostSession rechnet die Partie (lokal, allein oder als Online-Gastgeber),
 * RemoteSession reicht Aktionen an einen Gastgeber weiter. Beide liefern der
 * Oberfläche über onUpdate({view, events, viewer, seats, fresh}) den Spielverlauf. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};
  const E = SG.Engine;
  const SAVE_KEY = 'seegang.save';

  /* seats: Array[4] aus {kind:'human'|'ai'|'remote', name, conn?} oder null (unbesetzt im Duell) */
  class HostSession {
    constructor(cfg) {
      this.mode = cfg.mode;
      this.seats = cfg.seats;
      this.net = cfg.net || null;       // {send(connId,msg)}
      this.online = !!cfg.net;
      this.onUpdate = () => {};
      this.state = cfg.state || null;
      this.viewer = cfg.viewer !== undefined ? cfg.viewer : this.firstLocal();
      this.aiTimer = null;
      this.dead = false;
    }
    get isHost() { return true; }
    locals() { return this.seats.map((s, i) => (s && s.kind === 'human' ? i : -1)).filter(i => i >= 0); }
    firstLocal() { const l = this.locals(); return l.length ? l[0] : (this.mode === 'duel' ? 0 : 0); }
    seatInfo() { return this.seats.map(s => (s ? { kind: s.kind, name: s.name, off: s.kind === 'remote' && !s.conn } : null)); }

    start() {
      let events = [];
      if (!this.state) {
        const g = E.newGame({ mode: this.mode });
        this.state = g.state; events = g.events;
      }
      this.emit(events, true);
    }
    restart() {
      clearTimeout(this.aiTimer);
      const g = E.newGame({ mode: this.mode });
      this.state = g.state;
      this.viewer = this.firstLocal();
      this.emit(g.events, true);
    }

    nextViewer() {
      const st = this.state, locals = this.locals();
      if (!locals.length) return this.viewer;
      if (st.phase === 'exchange') {
        if (locals.includes(this.viewer) && st.give[this.viewer] === null) return this.viewer;
        const open = locals.find(s => st.give[s] === null);
        return open !== undefined ? open : this.viewer;
      }
      if (st.phase === 'play' && locals.includes(st.turn)) return st.turn;
      return locals.includes(this.viewer) ? this.viewer : locals[0];
    }

    emit(events, fresh) {
      const before = this.viewer;
      this.viewer = this.nextViewer();
      const seats = this.seatInfo();
      if (this.net) {
        this.seats.forEach((s, i) => {
          if (s && s.kind === 'remote' && s.conn) {
            this.net.send(s.conn, { t: 'update', view: E.view(this.state, i), events: E.eventsFor(events, i), seats, fresh: !!fresh, you: i });
          }
        });
      }
      this.save();
      this.onUpdate({
        view: E.view(this.state, this.viewer),
        events: E.eventsFor(events, fresh ? this.viewer : before),
        viewer: this.viewer, seats, fresh: !!fresh,
      });
    }
    /* Einem (wieder) verbundenen Mitspieler den aktuellen Stand schicken */
    sendState(seat) {
      const s = this.seats[seat];
      if (this.net && s && s.conn && this.state) {
        this.net.send(s.conn, { t: 'update', view: E.view(this.state, seat), events: [], seats: this.seatInfo(), fresh: true, you: seat });
      }
    }
    refreshSeats() { this.onUpdate({ view: E.view(this.state, this.viewer), events: [], viewer: this.viewer, seats: this.seatInfo(), fresh: false, soft: true }); }

    act(action, seat) {
      if (seat === undefined) seat = this.viewer;
      const r = E.apply(this.state, seat, action);
      if (!r.ok) return r;
      this.emit(r.events, false);
      return r;
    }

    /* Wird von der Oberfläche aufgerufen, sobald alle Animationen gelaufen sind. */
    idle() {
      if (this.dead) return;
      clearTimeout(this.aiTimer);
      const st = this.state;
      if (!st || st.phase === 'over') return;
      const isBot = i => { const s = this.seats[i]; return s && (s.kind === 'ai' || (s.kind === 'remote' && !s.conn)); };
      if (st.phase === 'exchange') {
        const bot = st.seats.find(i => isBot(i) && st.give[i] === null);
        if (bot !== undefined) {
          this.aiTimer = setTimeout(() => { if (!this.dead) this.act(SG.AI.choose(E.view(st, bot), bot), bot); }, 260 * (SG.speed || 1));
        }
        return;
      }
      if (st.phase === 'play' && isBot(st.turn)) {
        const seat = st.turn;
        const delay = (st.seven ? 380 : 620 + Math.random() * 420) * (SG.speed || 1);
        this.aiTimer = setTimeout(() => {
          if (this.dead || this.state.turn !== seat || this.state.phase !== 'play') return;
          const a = SG.AI.choose(E.view(this.state, seat), seat);
          if (a) this.act(a, seat);
        }, delay);
      }
    }

    save() {
      if (this.online) return;
      try {
        if (this.state.phase === 'over') localStorage.removeItem(SAVE_KEY);
        else localStorage.setItem(SAVE_KEY, JSON.stringify({ mode: this.mode, seats: this.seats, state: this.state, viewer: this.viewer }));
      } catch (e) {}
    }
    leave() { this.dead = true; clearTimeout(this.aiTimer); }
    static saved() {
      try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        return s && s.state && s.state.v === 1 && s.state.phase !== 'over' ? s : null;
      } catch (e) { return null; }
    }
    static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  }

  class RemoteSession {
    constructor(conn) {
      this.conn = conn;
      this.online = true;
      this.onUpdate = () => {};
      this.viewer = 0;
    }
    get isHost() { return false; }
    receive(msg) {
      this.viewer = msg.you;
      this.onUpdate({ view: msg.view, events: msg.events, viewer: msg.you, seats: msg.seats, fresh: msg.fresh });
    }
    act(action) { this.conn.send({ t: 'act', action }); return { ok: true }; }
    idle() {}
    restart() {}
    leave() { try { this.conn.close(); } catch (e) {} }
  }

  SG.HostSession = HostSession;
  SG.RemoteSession = RemoteSession;
})(window);
