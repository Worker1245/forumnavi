# Forumnavi

Filterbares Programm für Fachveranstaltungen mit vielen parallelen Foren.
Mobil nutzbar, ohne Login, ohne Nutzerkonten. Merkliste und Filter stehen nur im Link.

**Demo:** https://worker1245.github.io/forumnavi/

Alle Daten in diesem Repo sind **erfunden**. Echte Programmdaten liegen im privaten Repo
`forumnavi-intern` und kommen erst nach Zustimmung des Veranstalters hierher.

## Wer braucht was?

| Wer | Was nötig ist |
|---|---|
| **Teilnehmer** | Nur einen Browser (Handy oder Laptop). Link öffnen, fertig. Keine App, keine Installation, kein Konto. |
| **Veranstalter** | Nichts. Er liefert das Programm (PDF, Website oder Tabelle) und die Sponsorlogos. |
| **Du (Betreiber)** | Für die tägliche Arbeit nichts: Den Import erledigt Claude Code, die Website baut GitHub automatisch. Node.js brauchst du nur, wenn du Skripte selbst auf deinem Mac starten willst (siehe unten). |

## Wozu dieses öffentliche Repo?

Aus diesem Repo baut GitHub die Website und stellt sie kostenlos unter der Demo-Adresse online (GitHub Pages).
Bei einem kostenlosen GitHub-Konto geht das nur mit öffentlichen Repos. Deshalb liegt hier nur, was ohnehin
öffentlich sein darf: der Code der App und erfundene Demo-Daten.
Alles Vertrauliche (Angebote, Preise, echte Programme vor der Freigabe) liegt im privaten Repo `forumnavi-intern`.

Bei jedem Push auf `main` passiert automatisch (`.github/workflows/pages.yml`):
1. Push-Prüfung: keine Schlüssel oder Passwörter, nur Demo-Daten, Repo-Sichtbarkeit korrekt
2. Prüfung aller Programmdaten
3. Website bauen und veröffentlichen

Schlägt ein Schritt fehl, bleibt die alte Fassung online.

## Ordner

| Ordner | Inhalt |
|---|---|
| `app/` | Quellcode der Web-App (HTML, CSS, JavaScript ohne Framework) |
| `data/schema/` | Regeln für das Datenformat (JSON-Schema) |
| `data/events/` | ein Ordner je Veranstaltung mit allen freigegebenen Versionen |
| `tools/` | Skripte: Prüfung, Bauen, Beispieldaten, Push-Prüfung |
| `docs/` | Anleitungen und Begründungen |

## Funktionen der App

* Programm nach Uhrzeit oder nach Forum, gegliedert nach Tagen
* Filter: Tag, Uhrzeit, Schwerpunkt, Thema, Forum, Forenveranstalter, Freitextsuche (kombinierbar)
* Merkliste mit Stern, Hinweis bei zeitlichen Überschneidungen
* Gespeicherte Filter mit eigenem Namen
* Teilen per Link oder QR-Code
* Kalenderexport (.ics): einzelner Termin, ganze Merkliste, alle Treffer des aktuellen Filters
* Programmstand auf jeder Seite, Änderungen und entfallene Punkte deutlich markiert
* Sponsorflächen, immer als „Anzeige“ gekennzeichnet, ohne Tracking
* Funktioniert nach dem ersten Aufruf auch offline

## Optional: Skripte auf dem Mac ausführen

1. **Node.js installieren:** Auf https://nodejs.org die Version „LTS“ für macOS laden und installieren. Prüfen im Terminal:
   ```bash
   node --version
   ```
   Die Ausgabe muss mit v20 oder höher beginnen.
2. **Projekt holen:**
   ```bash
   cd ~/"6_Arbeit/Claude Code"
   ```
   ```bash
   git clone https://github.com/Worker1245/forumnavi.git
   ```
3. **Einmalig einrichten:**
   ```bash
   cd forumnavi && npm install
   ```

| Befehl | Wirkung |
|---|---|
| `npm run pruefen` | alle Programmdateien prüfen |
| `npm run bauen` | Website in den Ordner `dist/` bauen |
| `npm run vorschau` | bauen und unter http://localhost:8080 im Browser ansehen |
| `npm run push-pruefung` | vor dem Hochladen: keine Schlüssel, nur Demo-Daten |
| `npm run demo-daten` | Beispielveranstaltung neu erzeugen |

## Technische Entscheidungen (kurz begründet)

* **Kein Framework:** reines HTML, CSS und JavaScript. Die ganze App ist komprimiert rund 57 KB groß und lädt
  auch im schwachen Messe-WLAN schnell. Es gibt keine Bibliotheken, die veralten oder Sicherheitslücken mitbringen.
  Einzige Fremdbibliothek: QR-Code-Generator (MIT-Lizenz), wird nur beim Teilen geladen.
* **Zustand im Link hinter `#`:** Dieser Teil wird nie an den Server geschickt. Begründung der Kodierung und
  Messwerte: [docs/link_kodierung.md](docs/link_kodierung.md)
* **Offline-Speicher (Service Worker):** Nach dem ersten Aufruf läuft die App ohne Netz. Bei Netz wird immer
  zuerst geprüft, ob es einen neueren Programmstand gibt.
* **JSON-Schema und Prüfskript:** Jede Programmdatei wird vor dem Veröffentlichen geprüft.
  Details: [docs/datenmodell.md](docs/datenmodell.md)
