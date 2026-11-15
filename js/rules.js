/* Seegang – Spielregeln als Text. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};
  const card = (type, title, text) => `<div class="rule-card"><div class="slot" data-card="${type}"></div><div><b>${title}</b><p>${text}</p></div></div>`;

  SG.rulesHTML = () => `
  <button class="close" data-close aria-label="Schließen">×</button>
  <h2>Spielregeln</h2>
  <p class="lead">Bring deine Flotte einmal um den Ring und sicher in den Heimathafen – bevor es den anderen gelingt.</p>

  <h3>Ziel</h3>
  <p>Jede Flotte hat vier Schiffe. Sie starten in der <b>Werft</b> (die gestrichelten Plätze außen), fahren im Uhrzeigersinn um den Ring und laufen am eigenen <b>Startfeld</b> in den <b>Heimathafen</b> mit vier Liegeplätzen ein.
  Im Teamspiel gewinnen die Partner, die sich gegenübersitzen, gemeinsam: sobald alle acht Schiffe im Hafen liegen. Im Duell genügen die eigenen vier.</p>

  <h3>Ablauf</h3>
  <p>Gespielt wird in Runden mit <b>6, 5, 4, 3 und 2 Handkarten</b>, danach wieder von vorn. Im Teamspiel schiebt jeder zu Beginn der Runde verdeckt <b>eine Karte zum Partner</b>.
  Dann wird reihum je eine Karte gespielt und ausgeführt, bis alle Hände leer sind.</p>
  <p><b>Es herrscht Zugzwang:</b> Wer eine Karte spielen kann, muss das tun – auch wenn es wehtut. Wer keine einzige Karte spielen kann, wirft die Hand ab und setzt bis zur nächsten Runde aus.</p>

  <h3>Fahren und Schlagen</h3>
  <ul>
    <li>Landest du auf einem besetzten Feld, wird das Schiff dort <b>geschlagen</b> und muss zurück in die Werft – auch eigene und die des Partners.</li>
    <li>Andere Schiffe dürfen übersprungen werden. Ausnahme: Ein Schiff, das gerade <b>ausgelaufen</b> ist und noch auf seinem Startfeld liegt (gestrichelter Ring), ist geschützt. Es kann weder geschlagen noch getauscht noch überholt werden.</li>
    <li>In den Hafen geht es nur vorwärts und mit <b>passender Schrittzahl</b>. Im Hafen wird nicht übersprungen, und wer drin ist, ist sicher.</li>
    <li>Ein frisch ausgelaufenes Schiff muss erst losfahren, bevor es in den Hafen darf.</li>
    <li>Liegt deine ganze Flotte im Hafen, spielst du mit den Schiffen deines Partners weiter.</li>
  </ul>

  <h3>Die Karten</h3>
  <div class="rule-cards">
    ${card('A', 'Ablegen · 1 · 11', 'Ein Schiff läuft aus der Werft auf das Startfeld aus – oder ein Schiff zieht 1 oder 11 Felder.')}
    ${card('K', 'Ablegen · 13', 'Ein Schiff läuft aus – oder zieht 13 Felder.')}
    ${card('5', 'Zahlenkarten', '2, 3, 5, 6, 8, 9, 10 und 12: genau so viele Felder vorwärts.')}
    ${card('4', 'Die 4', 'Vier Felder vorwärts oder rückwärts. Rückwärts geht es nie in den Hafen.')}
    ${card('7', 'Die 7', 'Sieben einzelne Schritte, beliebig auf deine Schiffe verteilt. Jedes Schiff, das dabei überholt wird, ist geschlagen – auch eigene.')}
    ${card('swap', 'Tausch', 'Eines deiner Schiffe auf dem Ring tauscht den Platz mit einem Schiff einer anderen Flotte.')}
    ${card('wake', 'Kielwasser', 'Ein Schiff schließt auf: Es fährt vor bis direkt hinter das nächste Schiff (oder den Wal) vor ihm.')}
    ${card('whale', 'Wal', 'Der Wal taucht auf einem freien Ringfeld deiner Wahl auf. Bis zum Ende der Runde kommt niemand an ihm vorbei, und niemand kann auf ihm landen.')}
    ${card('pilot', 'Lotse', 'Der Lotse zählt als jede beliebige andere Karte.')}
  </div>

  <h3>Bedienung</h3>
  <p>Tippe eine Karte an, dann ein markiertes Schiff und – wenn es mehrere Möglichkeiten gibt – das Zielfeld. Ein zweiter Tipp auf die Karte nimmt die Auswahl zurück.</p>
  <p class="fine">Seegang ist ein eigenständiges Spiel aus der Familie der klassischen Karten-Laufspiele (Tock, Dog).</p>
  `;
})(window);
