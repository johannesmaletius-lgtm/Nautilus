/* Seefahrt – Spielregeln als Text. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {};
  const card = (type, title, text) => `<div class="rule-card"><div class="slot" data-card="${type}"></div><div><b>${title}</b><p>${text}</p></div></div>`;

  SG.rulesHTML = () => `
  <button class="close" data-close aria-label="Schließen">×</button>
  <h2>Spielregeln</h2>
  <p class="lead">Bringe deine gesamte Flotte sicher in den Heimathafen, bevor es den anderen gelingt. Doch Vorsicht: Der Weiße Hai ist dir dicht auf den Fersen!</p>

  <h3>1. Spielziel</h3>
  <p>Jeder Spieler besitzt vier Schiffe. Sie starten in der <b>Werft</b> (die gestrichelten Plätze außen), fahren einmal im Uhrzeigersinn um den Spielfeldring und laufen dann in den eigenen <b>Heimathafen</b> ein.
  Im Teamspiel bilden die beiden gegenüberliegenden Spieler eine Mannschaft. Sie gewinnt gemeinsam, sobald alle acht Schiffe beider Flotten im Hafen liegen. Im Duell genügen die eigenen vier.</p>

  <h3>2. Spielvorbereitung</h3>
  <p>Alle Schiffe stehen in der Werft, die <b>104 Karten</b> werden gemischt, der Kartengeber wird ausgelost. Der Weiße Hai wartet noch außerhalb des Spielfeldes.</p>

  <h3>3. Die Seefahrt</h3>
  <p>Zu Beginn jeder Runde erhält jeder <b>fünf Handkarten</b>. Im Teamspiel tauschen die Partner danach verdeckt je <b>eine Karte</b> – ohne Absprache.
  Der Spieler links vom Kartengeber beginnt, dann geht es im Uhrzeigersinn. Pro Zug spielt man eine Karte und führt sie aus. Die Runde endet, wenn alle ihre Karten ausgespielt haben; dann wechselt der Kartengeber.</p>
  <p><b>Zugzwang:</b> Spielbare Karten müssen eingesetzt werden – auch wenn dadurch eigene Schiffe oder die des Partners geschlagen werden. Wer keine Karte einsetzen kann, wirft die ganze Hand ab und setzt bis zur nächsten Seefahrt aus.</p>

  <h3>4. Der Weiße Hai</h3>
  <p>Sobald der erste <b>Lotse</b> gespielt wird, erscheint der Hai ein Feld hinter dem Startfeld dieses Spielers – und bleibt für den Rest des Spiels.
  Ab dann wird <b>jedes Mal, wenn alle Spieler einmal an der Reihe waren</b>, gewürfelt: Der Hai schwimmt so viele Felder im Uhrzeigersinn, und jedes Schiff auf seinem Weg wird geschlagen und muss zurück in die Werft.</p>
  <ul>
    <li>Den Hai darf man überholen, ohne ihn zu schlagen – aber nicht auf seinem Feld anhalten.</li>
    <li>Ein geschütztes Schiff auf seinem Startfeld hält auch den Hai auf: Er bleibt davor stehen.</li>
    <li>Schiffe im Heimathafen sind vor ihm sicher.</li>
  </ul>

  <h3>5. Bewegung</h3>
  <ul>
    <li><b>Auslaufen:</b> Mit einer 1 oder 12 kommt ein Schiff aus der Werft auf das eigene Startfeld. Dort ist es <b>geschützt</b> (gestrichelter Ring): Es kann weder geschlagen noch getauscht noch überholt werden – bis es weiterfährt.</li>
    <li>Alle Schiffe fahren im Uhrzeigersinn. <b>Andere Schiffe dürfen nicht übersprungen werden</b> – Ausnahme ist die 7.</li>
    <li><b>Schlagen:</b> Wer auf einem besetzten Feld landet, schlägt das Schiff dort zurück in seine Werft – auch eigene und die des Partners.</li>
    <li><b>Heimathafen:</b> Nach der Umrundung läuft ein Schiff über das eigene Startfeld in den Hafen ein. Die Schrittzahl muss <b>exakt</b> passen, und im Hafen wird nicht übersprungen. Der Hafen füllt sich von innen nach außen: Man läuft immer genau bis zum innersten freien Liegeplatz. Wer im Hafen liegt, ist sicher und wird nicht mehr bewegt, geschlagen oder getauscht.</li>
    <li>Ein frisch ausgelaufenes Schiff muss erst losfahren, bevor es in den Hafen darf.</li>
    <li><b>Rückwärts mit der 4:</b> Vom eigenen Startfeld aus darf ein Schiff vier Felder rückwärts fahren und später mit einer passenden Karte vorwärts einlaufen. Ist ein Schiff vom Startfeld aus erst ein bis drei Felder weit gefahren, kann es mit der 4 auch rückwärts über das Startfeld direkt in den Hafen fahren. Ein Schiff, das gerade erst ausgelaufen ist, darf das nicht.</li>
    <li><b>Teamunterstützung:</b> Liegen alle vier eigenen Schiffe im Hafen, spielst du mit den Schiffen deines Partners weiter.</li>
  </ul>

  <h3>6. Die Zahlenkarten</h3>
  <div class="rule-cards">
    ${card('1', '1 – Ablegen', 'Ein Schiff aus der Werft auf das Startfeld setzen – oder ein Schiff ein Feld vorwärts.')}
    ${card('2', '2, 3, 6, 9, 10', 'Vorstoß, Weiterfahrt, Lange Fahrt, Volle Fahrt, Höchstgeschwindigkeit: genau so viele Felder vorwärts.')}
    ${card('4', '4 – Kurskorrektur', 'Vier Felder vorwärts oder rückwärts – auch rückwärts in den Hafen, siehe oben.')}
    ${card('5', '5 – Gemeinsame Fahrt', 'Fünf Schritte beliebig auf deine Schiffe und die deines Partners verteilen. Jedes Schiff zieht dabei höchstens einmal, und alle fünf Schritte müssen aufgehen.')}
    ${card('7', '7 – Freie Passage', 'Ein Schiff sieben Felder vorwärts. Alle Schiffe auf dem Weg werden geschlagen – auch eigene.')}
    ${card('8', '8 – Unterbrechung', 'Ein Schiff acht Felder vorwärts – oder der nächste Spieler setzt aus und muss dafür eine Handkarte abwerfen.')}
    ${card('12', '12 – Volle Kraft voraus', 'Ein Schiff aus der Werft auf das Startfeld setzen – oder ein Schiff zwölf Felder vorwärts.')}
  </div>

  <h3>7. Die Sonderkarten</h3>
  <div class="rule-cards">
    ${card('swap', 'Kurswechsel', 'Zwei beliebige Schiffe auf dem Ring tauschen die Plätze – auch gegnerische und die des Partners. Auch der Hai kann mit einem Schiff tauschen.')}
    ${card('board', 'Entern', 'Nimm die Handkarten deines linken Nachbarn und spiele eine davon für ihn: eine Zahlenkarte, einen Kurswechsel oder den Hai. Die übrigen Karten bekommt er zurück.')}
    ${card('pilot', 'Lotse', 'Der Zug direkt davor wird rückgängig gemacht. Danach musst du die Karte, die gespielt wurde, soweit möglich selbst nutzen – bei mehreren Möglichkeiten nicht unbedingt dieselbe. Mit dem ersten Lotsen erscheint der Hai.')}
    ${card('shark', 'Weißer Hai', 'Der Hai schwimmt vorwärts bis zum nächsten Schiff und schlägt es. Solange der Hai nicht auf dem Spielfeld ist, ist die Karte wirkungslos.')}
    ${card('trade', 'Handel', 'Tausche verdeckt eine Handkarte mit deinem Partner. Im Duell wirkungslos.')}
    ${card('vision', 'Weitblick', 'Alle anderen Spieler – auch dein Partner – zeigen ihre Handkarten bis zum Ende der Runde offen.')}
    ${card('storm', 'Sturmfront', 'Jeder gibt seine Handkarten an den Spieler rechts weiter. Wer die Karte gespielt hat, darf danach noch eine Karte spielen.')}
  </div>

  <h3>8. Spielende</h3>
  <p>Im Teamspiel gewinnt die Mannschaft, sobald alle acht Schiffe sicher in den beiden Heimathäfen liegen. Im Duell gewinnt, wer zuerst alle vier Schiffe im Hafen hat. Ahoi!</p>

  <h3>Feinheiten in dieser Umsetzung</h3>
  <ul class="fine">
    <li>Der Lotse wirkt auf Züge mit Zahlenkarten, Kurswechsel und Hai. Nach Entern, Handel, Weitblick, Sturmfront, Abwerfen oder einem Würfelwurf des Hais gibt es nichts zurückzunehmen.</li>
    <li>Wirkungslose Karten (etwa der Hai, solange er nicht da ist) zählen als nicht spielbar.</li>
    <li>Kann der Spieler nach einer Sturmfront keine Karte mehr spielen, endet sein Zug ohne Strafe.</li>
    <li>Der Kartensatz: je 10 × 1 und 12, je 7 × 4 und 7, je 6 × 2, 3, 5, 6, 8, 9, 10; 7 × Kurswechsel, 6 × Lotse, 4 × Entern, je 3 × Hai, Handel, Sturmfront, 2 × Weitblick.</li>
  </ul>

  <h3>Bedienung</h3>
  <p>Tippe eine Karte an, dann ein markiertes Schiff und – wenn es mehrere Möglichkeiten gibt – das Zielfeld. Karten ohne Schiffswahl spielst du über den Knopf neben dem Hinweis. Ein zweiter Tipp auf die Karte nimmt die Auswahl zurück.</p>
  `;
})(window);
