/* Seegang – Online-Verbindung über WebRTC (PeerJS).
 * Der Gastgeber rechnet die Partie; Mitspieler verbinden sich direkt mit seinem Browser.
 * Es gibt keinen eigenen Server – nur die öffentliche PeerJS-Vermittlung für den Verbindungsaufbau. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};
  const PREFIX = 'seegang-r1-';
  const ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ';

  function peerOptions() {
    // ?peer=host:port erlaubt einen eigenen Vermittlungsserver (auch für Tests)
    const p = new URLSearchParams(location.search).get('peer');
    if (!p) return { debug: 1 };
    const [host, port] = p.split(':');
    return { host, port: +(port || 9000), path: '/', secure: false, debug: 1 };
  }
  function randomCode() {
    let c = '';
    for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return c;
  }
  const cleanCode = s => (s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

  /* Raum eröffnen. handlers: open(code), join(connId), data(connId, msg), leave(connId), error(text) */
  function host(handlers, tries) {
    tries = tries || 0;
    if (typeof Peer === 'undefined') { handlers.error('Die Online-Funktion konnte nicht geladen werden.'); return null; }
    const code = randomCode();
    const peer = new Peer(PREFIX + code, peerOptions());
    const conns = {};
    let nextId = 1, closed = false;
    const api = {
      code,
      send(connId, msg) { const c = conns[connId]; if (c && c.open) c.send(msg); },
      close() { closed = true; try { peer.destroy(); } catch (e) {} },
    };
    peer.on('open', () => handlers.open(code));
    peer.on('connection', conn => {
      const id = nextId++;
      conn.on('open', () => { conns[id] = conn; handlers.join(id); });
      conn.on('data', msg => { if (msg && typeof msg === 'object') handlers.data(id, msg); });
      const gone = () => { if (conns[id]) { delete conns[id]; handlers.leave(id); } };
      conn.on('close', gone);
      conn.on('error', gone);
    });
    peer.on('disconnected', () => { if (!closed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && tries < 5) {
        try { peer.destroy(); } catch (e) {}
        const again = host(handlers, tries + 1);
        Object.assign(api, again);
        return;
      }
      if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
        handlers.error('Keine Verbindung zum Vermittlungsserver. Prüfe deine Internetverbindung – in eingebetteten Vorschauen ist der Online-Modus gesperrt.');
      } else if (err.type !== 'peer-unavailable') {
        handlers.error('Verbindungsfehler: ' + err.type);
      }
    });
    return api;
  }

  /* Raum betreten. handlers: open(), data(msg), close(), error(text) */
  function join(code, handlers) {
    if (typeof Peer === 'undefined') { handlers.error('Die Online-Funktion konnte nicht geladen werden.'); return null; }
    const peer = new Peer(undefined, peerOptions());
    let conn = null, closed = false, opened = false;
    const timer = setTimeout(() => { if (!opened && !closed) handlers.error('Der Raum antwortet nicht. Stimmt der Code?'); }, 15000);
    peer.on('open', () => {
      conn = peer.connect(PREFIX + cleanCode(code), { reliable: true });
      conn.on('open', () => { opened = true; clearTimeout(timer); handlers.open(); });
      conn.on('data', msg => { if (msg && typeof msg === 'object') handlers.data(msg); });
      conn.on('close', () => { if (!closed) handlers.close(); });
      conn.on('error', () => { if (!closed) handlers.close(); });
    });
    peer.on('error', err => {
      clearTimeout(timer);
      if (closed) return;
      if (err.type === 'peer-unavailable') handlers.error('Diesen Raum gibt es nicht (mehr).');
      else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') handlers.error('Keine Verbindung zum Vermittlungsserver. Prüfe deine Internetverbindung – in eingebetteten Vorschauen ist der Online-Modus gesperrt.');
      else handlers.error('Verbindungsfehler: ' + err.type);
    });
    return {
      send(msg) { if (conn && conn.open) conn.send(msg); },
      close() { closed = true; clearTimeout(timer); try { peer.destroy(); } catch (e) {} },
    };
  }

  SG.Net = { host, join, cleanCode };
})(window);
