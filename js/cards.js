/* Seefahrt – Spielkarten als DOM-Elemente. Alle Maße in em, die Größe steuert --cw am Element. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};

  const ic = (body) => '<svg viewBox="0 0 24 24" class="ic">' + body + '</svg>';
  const LINE = 'fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"';
  const ICON = {
    // Kurswechsel: zwei Bögen, die sich umkreisen
    swap: ic('<path d="M19.500 12a7.500 7.500 0 0 1-12.800 5.300M4.500 12a7.500 7.500 0 0 1 12.800-5.300" ' + LINE + '/><path d="M17.800 2.800v4h-4M6.200 21.200v-4h4" ' + LINE + '/>'),
    // Handel: zwei Pfeile gegeneinander
    trade: ic('<path d="M4 8.500h14.500M15 5l3.500 3.500L15 12M20 15.500H5.500M9 12l-3.500 3.500L9 19" ' + LINE + '/>'),
    pilot: ic('<path d="M12 1.500l2.300 8.200 8.200 2.300-8.200 2.300L12 22.500l-2.300-8.200L1.500 12l8.200-2.300z" fill="currentColor"/>'),
    // Weißer Hai: Rückenflosse über den Wellen
    shark: ic('<path d="M3.500 16.500c3.200-.6 5.600-3 7.300-6.800C12.200 6.500 14 4 16.600 2.800c-.9 3.200-1 6.700.1 9.600.6 1.700 1.700 3.100 3.300 4.100z" fill="currentColor"/><path d="M1.500 20q2.600-2.600 5.200 0t5.200 0 5.200 0 5.200 0" ' + LINE + '/>'),
    // Entern: gekreuzte Säbel
    board: ic('<path d="M5 3.500l11.500 11.500M19 3.500L7.500 15M13.800 16.800l3.800-3.800M10.200 16.800L6.400 13M16.500 15.500l3.500 3.500M7.500 15.500L4 19" ' + LINE + '/>'),
    // Weitblick: Auge
    vision: ic('<path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z" ' + LINE + '/><circle cx="12" cy="12" r="3.100" fill="currentColor"/>'),
    // Sturmfront: Wolke mit Blitz
    storm: ic('<path d="M7.500 16H6.200a4.200 4.200 0 0 1-.4-8.400 5.800 5.800 0 0 1 11.100-1.300A4.600 4.600 0 0 1 18 16" ' + LINE + '/><path d="M13 11.500l-2.800 4.800h3.400L11.200 21" ' + LINE + '/>'),
  };

  const INFO = {
    '1': { big: '1', cap: 'Ablegen', name: '1 – Ablegen', hint: 'Ein Schiff läuft aus der Werft aus – oder fährt 1 Feld vor.' },
    '2': { big: '2', cap: 'Vorstoß', name: '2 – Vorstoß', hint: '2 Felder vorwärts.' },
    '3': { big: '3', cap: 'Weiterfahrt', name: '3 – Weiterfahrt', hint: '3 Felder vorwärts.' },
    '4': { big: '4', cap: 'Kurskorrektur', name: '4 – Kurskorrektur', hint: '4 Felder vorwärts oder rückwärts.' },
    '5': { big: '5', cap: 'Gemeinsame Fahrt', name: '5 – Gemeinsame Fahrt', hint: '5 Schritte auf deine Schiffe und die deines Partners verteilen.' },
    '6': { big: '6', cap: 'Lange Fahrt', name: '6 – Lange Fahrt', hint: '6 Felder vorwärts.' },
    '7': { big: '7', cap: 'Freie Passage', name: '7 – Freie Passage', hint: '7 Felder vorwärts. Wer auf dem Weg liegt, wird geschlagen.' },
    '8': { big: '8', cap: 'Unterbrechung', name: '8 – Unterbrechung', hint: '8 Felder vorwärts – oder der nächste Spieler setzt aus.' },
    '9': { big: '9', cap: 'Volle Fahrt', name: '9 – Volle Fahrt', hint: '9 Felder vorwärts.' },
    '10': { big: '10', cap: 'Höchst&shy;geschwindigkeit', name: '10 – Höchstgeschwindigkeit', hint: '10 Felder vorwärts.' },
    '12': { big: '12', cap: 'Volle Kraft voraus', name: '12 – Volle Kraft voraus', hint: 'Ein Schiff läuft aus der Werft aus – oder fährt 12 Felder vor.' },
    swap: { title: 'Kurswechsel', icon: 'swap', short: '⇄', name: 'Kurswechsel', hint: 'Zwei beliebige Schiffe – oder ein Schiff und der Hai – tauschen die Plätze.' },
    board: { title: 'Entern', icon: 'board', short: '⚔', name: 'Entern', hint: 'Nimm die Karten deines linken Nachbarn und spiele eine davon für ihn.' },
    pilot: { title: 'Lotse', icon: 'pilot', img: 'assets/compass.webp', short: 'L', name: 'Lotse', hint: 'Der Zug davor wird zurückgenommen – danach nutzt du die Karte selbst.' },
    shark: { title: 'Weißer Hai', icon: 'shark', short: 'H', name: 'Weißer Hai', hint: 'Der Hai schwimmt bis zum nächsten Schiff und schlägt es.' },
    trade: { title: 'Handel', icon: 'trade', short: '↔', name: 'Handel', hint: 'Tausche verdeckt eine Karte mit deinem Partner.' },
    vision: { title: 'Weitblick', icon: 'vision', short: '◉', name: 'Weitblick', hint: 'Alle anderen zeigen bis zum Rundenende ihre Karten.' },
    storm: { title: 'Sturmfront', icon: 'storm', short: 'S', name: 'Sturmfront', hint: 'Alle geben ihre Karten nach rechts weiter – dann spielst du noch eine.' },
  };

  const WAVE = '<svg viewBox="0 0 60 8" class="wave"><path d="M2 5q3.500-5 7 0t7 0 7 0 7 0 7 0 7 0 7 0 7 0" fill="none" stroke="currentColor" stroke-width="1.300" stroke-linecap="round"/></svg>';

  function frontHTML(type) {
    const d = INFO[type];
    if (!d) return '';
    const idx = d.icon ? ICON[d.icon] : '<b>' + d.big + '</b>';
    let art;
    if (d.img) art = '<div class="art pic"><img src="' + d.img + '" alt="" draggable="false"></div><div class="ttl">' + d.title + '</div>';
    else if (d.icon) art = '<div class="art glyph">' + ICON[d.icon] + '</div><div class="ttl">' + d.title + '</div>';
    else {
      const long = d.cap.replace(/&shy;/g, '').length > 12;
      art = '<div class="art num' + (d.big.length > 1 ? ' two' : '') + '"><span>' + d.big + '</span></div>' + WAVE +
        '<div class="cap' + (long ? ' long' : '') + '">' + d.cap + '</div>';
    }
    return '<span class="idx tl">' + idx + '</span><span class="idx br">' + idx + '</span>' + art;
  }

  /* card: {id,type} oder null (verdeckt) */
  function el(card, opts) {
    opts = opts || {};
    const c = document.createElement('div');
    c.className = 'card' + (opts.cls ? ' ' + opts.cls : '');
    const face = card && card.type;
    if (card && card.id !== undefined) c.dataset.id = card.id;
    if (face) c.dataset.type = card.type;
    c.innerHTML = '<div class="card-in"><div class="face front">' + (face ? frontHTML(card.type) : '') +
      '</div><div class="face back"><div class="back-art"></div></div></div>';
    if (!face || opts.down) c.classList.add('down');
    return c;
  }
  function reveal(cardEl, card) {
    cardEl.dataset.type = card.type;
    if (card.id !== undefined) cardEl.dataset.id = card.id;
    cardEl.querySelector('.front').innerHTML = frontHTML(card.type);
  }
  const short = type => (INFO[type] && INFO[type].short) || type;

  SG.Cards = { INFO, ICON, el, reveal, short };
})(window);
