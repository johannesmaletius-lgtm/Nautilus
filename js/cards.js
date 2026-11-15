/* Seegang – Spielkarten als DOM-Elemente. Alle Maße in em, die Größe steuert --cw am Element. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};

  const ICON = {
    swap: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 8.500h14.500M15 5l3.500 3.500L15 12M20 15.500H5.500M9 12l-3.500 3.500L9 19" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pilot: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 1.500l2.300 8.200 8.200 2.300-8.200 2.300L12 22.500l-2.300-8.200L1.500 12l8.200-2.300z" fill="currentColor"/></svg>',
    wake: '<svg viewBox="0 0 24 24" class="ic"><path d="M2 9q2.500-4 5 0t5 0 5 0 5 0M2 16q2.500-4 5 0t5 0 5 0 5 0" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg>',
    whale: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 22c.3-4.500-.4-7.600-2.300-9.300C7.600 10.900 4.500 10.800 2 8.300c.2-2.600 1.700-4.300 4-4.800 3 1 5 3.200 6 6.500 1-3.300 3-5.500 6-6.500 2.300.5 3.800 2.200 4 4.800-2.500 2.500-5.600 2.600-7.700 4.400-1.900 1.700-2.600 4.800-2.300 9.300z" fill="currentColor"/></svg>',
  };

  const INFO = {
    A: { big: '1', side: '11', cap: 'Ablegen', name: 'Ablegen (1 · 11)', hint: 'Ein Schiff läuft aus der Werft aus – oder zieht 1 oder 11 Felder.' },
    K: { big: '13', cap: 'Ablegen', name: 'Ablegen (13)', hint: 'Ein Schiff läuft aus der Werft aus – oder zieht 13 Felder.' },
    '2': { big: '2', name: '2', hint: '2 Felder vorwärts.' },
    '3': { big: '3', name: '3', hint: '3 Felder vorwärts.' },
    '4': { big: '4', cap: 'vor · zurück', name: '4', hint: '4 Felder vorwärts oder rückwärts.' },
    '5': { big: '5', name: '5', hint: '5 Felder vorwärts.' },
    '6': { big: '6', name: '6', hint: '6 Felder vorwärts.' },
    '7': { big: '7', cap: 'aufteilen', name: '7', hint: '7 einzelne Schritte, frei auf deine Schiffe verteilt. Wer überholt wird, muss zurück in die Werft.' },
    '8': { big: '8', name: '8', hint: '8 Felder vorwärts.' },
    '9': { big: '9', name: '9', hint: '9 Felder vorwärts.' },
    '10': { big: '10', name: '10', hint: '10 Felder vorwärts.' },
    '12': { big: '12', name: '12', hint: '12 Felder vorwärts.' },
    swap: { title: 'Tausch', icon: 'swap', name: 'Tausch', hint: 'Eines deiner Schiffe tauscht den Platz mit einem fremden Schiff.' },
    pilot: { title: 'Lotse', icon: 'pilot', img: 'assets/compass.webp', name: 'Lotse', hint: 'Der Lotse zählt als jede beliebige Karte.' },
    wake: { title: 'Kielwasser', icon: 'wake', img: 'assets/ship.webp', name: 'Kielwasser', hint: 'Ein Schiff schließt bis direkt hinter das nächste Schiff auf.' },
    whale: { title: 'Wal', icon: 'whale', img: 'assets/whale.webp', name: 'Wal', hint: 'Der Wal taucht auf einem freien Feld auf. Bis zum Ende der Runde kommt niemand an ihm vorbei.' },
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
      art = '<div class="art num' + (d.big.length > 1 ? ' two' : '') + '"><span>' + d.big + '</span>' +
        (d.side ? '<i>' + d.side + '</i>' : '') + '</div>' + WAVE +
        (d.cap ? '<div class="cap">' + d.cap + '</div>' : '<div class="cap">&nbsp;</div>');
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

  SG.Cards = { INFO, ICON, el, reveal };
})(window);
