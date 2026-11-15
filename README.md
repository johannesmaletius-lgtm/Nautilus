# Seegang

Ein Kartenspiel um Wind, Wal und Heimathafen – als Web-App für Handy, Tablet und Desktop.
Allein gegen den Computer, zu mehreren an einem Gerät oder online mit Raum-Code.

Seegang ist ein eigenständiges Spiel aus der Familie der klassischen Karten-Laufspiele (Tock, Dog):
Karten bewegen die Schiffe, Partner sitzen sich gegenüber, wer überholt oder getroffen wird, muss zurück in die Werft.

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
  und am eigenen Startfeld in den **Heimathafen** (vier Liegeplätze) ein.
- **Zwei Teams** (2 gegen 2, Partner gegenüber) oder **Duell** (1 gegen 1). Es gewinnt, wer zuerst alle Schiffe im Hafen hat.
- Runden mit 6, 5, 4, 3 und 2 Handkarten. Im Teamspiel geht zu Rundenbeginn verdeckt eine Karte an den Partner.
- Zugzwang: Wer spielen kann, muss. Wer keine Karte spielen kann, wirft die Hand ab und setzt die Runde aus.
- Wer auf einem besetzten Feld landet, schlägt das Schiff dort. Ein frisch ausgelaufenes Schiff auf seinem Startfeld ist geschützt und versperrt den Weg.
- In den Hafen geht es nur vorwärts und mit passender Schrittzahl; im Hafen wird nicht übersprungen.
- Liegt die eigene Flotte komplett im Hafen, zieht man die Schiffe des Partners.

| Karte | Anzahl | Wirkung |
|---|---|---|
| Ablegen 1 · 11 | 8 | Schiff läuft aus – oder 1 bzw. 11 Felder |
| Ablegen 13 | 8 | Schiff läuft aus – oder 13 Felder |
| 2, 3, 5, 6, 8, 9, 10, 12 | je 7 | so viele Felder vorwärts |
| 4 | 8 | vier Felder vor oder zurück |
| 7 | 8 | sieben Einzelschritte, frei verteilt; Überholte werden geschlagen |
| Tausch | 8 | eigenes Schiff tauscht den Platz mit einem fremden |
| Kielwasser | 4 | Schiff schließt bis direkt hinter das nächste Schiff auf |
| Wal | 4 | Wal taucht auf einem freien Feld auf und versperrt bis Rundenende den Weg |
| Lotse | 4 | zählt als jede andere Karte |

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

Spielt zufällige und KI-gesteuerte Partien bis zum Ende und prüft dabei die Invarianten (kein Feld doppelt besetzt, Kartenzahl bleibt 108 …).

## Fremdmaterial

- Schriften: Fraunces und Figtree (SIL Open Font License)
- PeerJS (MIT-Lizenz), siehe `vendor/peerjs-LICENSE`
