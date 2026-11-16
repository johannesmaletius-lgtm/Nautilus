# Seefahrt

Ein Kartenspiel um Wind, Hai und Heimathafen – als Web-App für Handy, Tablet und Desktop.
Allein gegen den Computer, zu mehreren an einem Gerät oder online mit Raum-Code.

Seefahrt gehört zur Familie der klassischen Karten-Laufspiele: Karten bewegen die Schiffe, Partner sitzen sich gegenüber,
wer getroffen wird, muss zurück in die Werft – und der Weiße Hai zieht unberechenbar seine Kreise.

Reines HTML, CSS und Vanilla JavaScript – kein Framework, kein Build-Schritt.

## Starten

Die App ist statisch. Jeder Webserver genügt:

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen. Für GitHub Pages reicht es, den Ordner als Seite zu veröffentlichen.
`index.html` lässt sich auch direkt per Doppelklick öffnen; der Online-Modus braucht aber eine `http(s)`-Adresse.

## Spielregeln (Kurzfassung)

- Jede Flotte hat vier Schiffe. Sie laufen aus der **Werft** aufs **Startfeld** aus, fahren im Uhrzeigersinn um den Ring (64 Felder)
  und über das eigene Startfeld in den **Heimathafen** (vier Liegeplätze).
- **Zwei Teams** (2 gegen 2, Partner gegenüber) oder **Duell** (1 gegen 1). Es gewinnt, wer zuerst alle Schiffe im Hafen hat.
- 104 Karten, jede Runde **fünf Handkarten**. Im Teamspiel geht zu Rundenbeginn verdeckt eine Karte an den Partner.
- Zugzwang: Wer spielen kann, muss. Wer keine Karte spielen kann, wirft eine Karte ab und behält den Rest.
- **Kein Schiff darf übersprungen werden** (außer mit der 7). Wer auf einem besetzten Feld landet, schlägt das Schiff dort.
  Ein frisch ausgelaufenes Schiff auf seinem Startfeld ist geschützt.
- Hafen: mit passender Schrittzahl auf jeden freien Liegeplatz, nicht überspringen; zu viele Schritte → vorbeifahren.
  Im Hafen darf man später weiter nach hinten fahren; dort ist man sicher.
- **Der Weiße Hai** erscheint mit dem ersten Lotsen ein Feld hinter dem Startfeld dieses Spielers. Jedes Mal, wenn alle einmal
  an der Reihe waren, wird gewürfelt; der Hai schwimmt weiter und schlägt alles auf seinem Weg.
- **Buchten:** Neben den Feldern in der Mitte zwischen den Startfeldern liegt außen je eine Bucht. Wer genau auf so einem Feld
  landen würde, darf in die Bucht einlaufen und ist dort vor dem Hai, vor dem Schlagen und vor dem Kurswechsel sicher.
- Was im Hafen liegt, bleibt dort – auch der Lotse holt es nicht heraus.
- Liegt die eigene Flotte komplett im Hafen, zieht man die Schiffe des Partners.
- Tippt man eine Karte an, die gerade nicht geht, nennt das Spiel den Grund.

| Karte | Anzahl | Wirkung |
|---|---|---|
| 1 Ablegen · 12 Volle Kraft voraus | je 10 | Schiff läuft aus – oder 1 bzw. 12 Felder |
| 2, 3, 6, 9, 10 | je 6 | so viele Felder vorwärts |
| 4 Kurskorrektur | 7 | vier Felder rückwärts, auch rückwärts in den Hafen |
| 5 Gemeinsame Fahrt | 6 | fünf Schritte auf eigene und Partnerschiffe verteilen |
| 7 Freie Passage | 7 | sieben Felder, alle Schiffe auf dem Weg werden geschlagen |
| 8 Unterbrechung | 6 | acht Felder – oder der nächste Spieler setzt aus und wirft eine Karte ab |
| Kurswechsel | 7 | zwei beliebige Schiffe auf dem Ring (oder Schiff und Hai) tauschen die Plätze |
| Lotse | 6 | letzten Zug zurücknehmen, dann die Karte selbst nutzen |
| Entern | 4 | Karten des linken Nachbarn ansehen und eine für ihn spielen |
| Weißer Hai | 3 | Hai schwimmt zum nächsten Schiff und schlägt es |
| Handel | 3 | verdeckt eine Karte mit dem Partner tauschen, dann ist der Zug vorbei |
| Sturmfront | 3 | alle Hände wandern nach rechts, dann noch eine Karte spielen |
| Weitblick | 2 | man sieht bis Rundenende die Karten aller anderen |

Die ausführlichen Regeln stehen im Spiel unter „Spielregeln“.

## Aufbau

```
index.html      Gerüst und Bildschirme
css/style.css   Gestaltung (Papier, Drucktinte, Karten, Animationen)
js/engine.js    Spielregeln – reine Logik, läuft auch in Node
js/ai.js        Computergegner (bewertet jede erlaubte Aktion auf einer Kopie des Spielfelds)
js/board.js     Spielfeld als SVG: Geometrie, Figuren, Markierungen, Bewegungen
js/cards.js     Spielkarten als DOM-Elemente
js/session.js   Partie-Sitzungen: Gastgeber (rechnet die Partie) und Mitspieler
js/net.js       Online-Verbindung über WebRTC (PeerJS)
js/app.js       Oberfläche: Menüs, Spieltisch, Eingabe, Ablauf der Animationen
js/rules.js     Regeltext
js/sound.js     Töne per WebAudio
test/           Zufalls- und KI-Partien gegen die Regel-Engine
```

- **Zustand:** `engine.js` hält die ganze Partie in einem serialisierbaren Objekt. `apply(state, platz, aktion)` prüft und führt aus
  und liefert eine Liste von Ereignissen (`play`, `move`, `swap`, `deal` …), die die Oberfläche der Reihe nach animiert.
- **Verdeckte Karten:** Die Oberfläche bekommt nur die Sicht eines Platzes (`view`), fremde Handkarten sind darin nur als Anzahl enthalten.
- **Online:** Der Gastgeber rechnet die Partie in seinem Browser und schickt jedem Mitspieler dessen Sicht. Die Browser verbinden sich
  direkt per WebRTC; für den Verbindungsaufbau wird die öffentliche PeerJS-Vermittlung genutzt, einen eigenen Server gibt es nicht.
  Bricht eine Verbindung ab, übernimmt der Computer den Platz, bis der Mitspieler mit demselben Raum-Code zurückkommt.
  Der Gastgeber muss die Seite geöffnet lassen. Mit `?peer=host:port` lässt sich ein eigener PeerJS-Server angeben.
- **Speichern:** Lokale Partien werden nach jedem Zug im `localStorage` gesichert und lassen sich im Menü fortsetzen.

## Tests

```bash
node test/engine.test.js
```

Spielt zufällige und KI-gesteuerte Partien bis zum Ende und prüft dabei die Invarianten (kein Feld doppelt besetzt, kein Schiff auf dem Hai, Kartenzahl bleibt 104 …) sowie gezielte Regelfälle (7, 5, 8, 4 rückwärts, Lotse, Hai, Kurswechsel, Entern, Sturmfront, Handel, Weitblick, Abwerfen, Hafeneinfahrt und Fahrt im Hafen).

Die Spielfiguren (`assets/fig-*.webp`, auch der Hai) sind aus Fotos der Figuren freigestellt und haben eine feine dunkle Kontur,
damit sie sich vom Brett und voneinander abheben. Sie sind knapp so breit wie der Feldabstand auf dem Ring, bleiben aufrecht,
auch wenn sich der Tisch zur Sicht des jeweiligen Spielers dreht, und zeigen mit dem Bug in Fahrtrichtung.
Besondere Züge haben eigene Animationen (`js/board.js`): Stapellauf beim Auslaufen, Kanonenschuss und Kentern beim Schlagen,
Sprung und Biss des Hais, die Wende bei der 4 und der Freudensprung im Heimathafen. Die Motive der Sonderkarten und der 4 (`assets/card-*.webp`)
sind aus den Kartenentwürfen ausgeschnitten und als Druckfarbe auf transparentem Grund gespeichert.

## Fremdmaterial

- Schriften: Fraunces und Figtree (SIL Open Font License)
- PeerJS (MIT-Lizenz), siehe `vendor/peerjs-LICENSE`
