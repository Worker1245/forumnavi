# Forumnavi

Filterbares Programm für Fachveranstaltungen mit vielen parallelen Foren.
Mobil nutzbar, ohne Login, ohne Nutzerkonten. Favoriten und Filter stehen nur im Link.

**Stand:** Etappe 1 (Datenmodell und Beispieldaten). Die Web-App folgt in Etappe 2.

Alle Daten in diesem Repo sind **erfunden** (Demo). Echte Programmdaten liegen im privaten
Repo `forumnavi-intern` und kommen erst nach Zustimmung des Veranstalters hierher.

## Ordner

| Ordner | Inhalt |
|---|---|
| `app/` | Quellcode der Web-App (ab Etappe 2) |
| `data/schema/` | Regeln für das Datenformat (JSON-Schema) |
| `data/events/` | ein Ordner je Veranstaltung mit allen freigegebenen Versionen |
| `tools/` | Skripte: Prüfung, Beispieldaten, Push-Prüfung (später Vergleich, Veröffentlichung) |
| `docs/` | Anleitungen |

Intern (privates Repo `forumnavi-intern`): `import/eingang`, `import/pruefung`, `vertrieb/`, `archive/`.

## Einmalig auf dem Mac einrichten

1. **Node.js installieren:** Auf https://nodejs.org die Version „LTS“ für macOS herunterladen und installieren.
   Prüfen im Terminal:
   ```bash
   node --version
   ```
   Die Ausgabe muss mit v20 oder höher beginnen.
2. **Projekt holen** (Pfad an deinen Ordner anpassen):
   ```bash
   cd ~/"6_Arbeit/Claude Code"
   ```
   ```bash
   git clone https://github.com/Worker1245/forumnavi.git
   ```
   ```bash
   git clone https://github.com/Worker1245/forumnavi-intern.git
   ```
3. **Abhängigkeiten installieren** (einmalig und nach Updates):
   ```bash
   cd forumnavi && npm install
   ```

## Häufige Befehle

| Befehl | Wirkung |
|---|---|
| `npm run pruefen` | alle Programmdateien prüfen |
| `npm run demo-daten` | Beispielveranstaltung neu erzeugen |
| `npm run push-pruefung` | vor dem Hochladen: keine Schlüssel, keine echten Daten |

## Technische Entscheidungen (kurz begründet)

* **Node.js für alle Skripte:** Ein einziges Werkzeug für Prüfung, Vergleich und später den Bau der Web-App.
  Auf dem Mac genügt eine Installation.
* **JSON-Schema mit dem Prüfprogramm Ajv:** Ajv ist ein verbreiteter Standard für die Prüfung von JSON.
  Die Regeln stehen in einer Datei, die man lesen kann, statt versteckt im Code.
* **Eine JSON-Datei je Programmversion:** Jede Fassung bleibt erhalten. Änderungen lassen sich
  vergleichen und jederzeit zurückholen.
* **Zeiten als Ortszeit plus eine Zeitzone:** So steht es auch im gedruckten Programm. Das macht den Import einfach.

Mehr Details: [docs/datenmodell.md](docs/datenmodell.md)
