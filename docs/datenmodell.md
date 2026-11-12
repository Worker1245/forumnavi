# Datenmodell: So ist ein Programm aufgebaut

Jede Veranstaltung ist **eine JSON-Datei**. Die Regeln dafür stehen in
`data/schema/event.schema.json`. Das Prüfskript kontrolliert jede Datei gegen diese Regeln.

## Ablage

```
data/events/
  demo-energietage-2027/          ein Ordner je Veranstaltung
    aktuell.json                  die veröffentlichte Fassung (liest die App)
    versionen/
      2026-11-12_01.json          jede freigegebene Fassung bleibt erhalten
    sponsoren/                    Logos der Sponsoren (SVG, PNG oder WebP)
```

Die Versionskennung lautet `JJJJ-MM-TT_NN`, also Datum plus laufende Nummer am selben Tag.
Ein Beispiel ist `2027-11-09_02` für die zweite Änderung am 9. November.

Echte Programme (z. B. Spreewind) liegen erst einmal **nur im internen Repo**. Ins öffentliche Repo
kommen sie erst nach schriftlicher Zustimmung des Veranstalters.

## Bausteine einer Veranstaltung

| Bereich | Bedeutung | Wichtigste Felder |
|---|---|---|
| `event` | Die Veranstaltung selbst | Name, Ort, Zeitzone, Beginn, Ende, `programStatus` (Programmstand), `isDemo` |
| `days` | Veranstaltungstage | Datum, Anzeigename („Dienstag, 9. November“) |
| `rooms` | Räume | Name, Etage |
| `topics` | Themen für den Filter | Bezeichnung |
| `categories` | Schwerpunkte (optional), farbig markiert, höchstens einer je Programmpunkt | Bezeichnung, Farbe |
| `organizers` | Forenveranstalter | Name, Art (Verband, Unternehmen, ...) |
| `speakers` | Referenten und Moderation | Name, Titel, Funktion, Firma |
| `forums` | Foren und Plenum | Nummer, Titel, Tag, Raum, Forenveranstalter, Moderation, Themen |
| `sessions` | Programmpunkte | Titel, Beginn, Ende, Forum, Referenten, Themen, Schwerpunkt, Status |
| `sponsors` | Sponsoren | Name, Logo-Datei, Link |
| `sponsorSlots` | Sponsorflächen | Art der Fläche, Sponsor, zugehöriges Forum oder Tag, Text |

Die Bereiche verweisen über **IDs** aufeinander. Ein Programmpunkt enthält zum Beispiel
`"forumId": "forum-03"` und nicht den ganzen Forentitel. So steht jede Angabe nur an einer Stelle:
Ändert sich ein Raum, wird er nur einmal geändert.

IDs bestehen aus Kleinbuchstaben, Ziffern und Bindestrichen (`forum-03`, `ref-017`).

## Zeiten

Zeiten stehen als **Ortszeit** der Veranstaltung im Format `2027-11-09T14:30`.
Die Zeitzone steht einmal bei `event.timezone` (`Europe/Berlin`). Der Kalenderexport rechnet
damit, damit Termine auch auf Handys mit anderer Zeitzone richtig erscheinen.

## Status von Programmpunkten

| Status | Anzeige in der App |
|---|---|
| `geplant` | normal |
| `geändert` | Hinweis „geändert“ plus `statusNote` (z. B. „Raum geändert“) |
| `entfällt` | durchgestrichen mit Hinweis, bleibt sichtbar, damit niemand vergeblich sucht |

## Sponsorflächen

| `placement` | Wo sie erscheint |
|---|---|
| `forum_presented_by` | „Forum präsentiert von ...“ beim Forum (höchstens eine je Forum) |
| `home_banner` | Banner auf der Startseite (höchstens eines) |
| `day_banner` | Banner über einem Veranstaltungstag |
| `calendar_note` | Hinweiszeile im Kalenderexport |

Logos liegen als Datei im Veranstaltungsordner. Externe Bild-Adressen sind nicht erlaubt.
So kann ein Sponsor keine Tracking-Pixel einschleusen. Details folgen in Etappe 4.

## Was das Prüfskript kontrolliert

Fehler (Datei wird nicht veröffentlicht):
* Datei entspricht nicht dem Schema (Pflichtfeld fehlt, falsches Format, unbekanntes Feld)
* doppelte IDs, Verweise auf nicht vorhandene IDs
* Ende liegt nicht nach Beginn, Datum passt nicht zum Tag des Forums
* ein Raum ist gleichzeitig von zwei Foren belegt
* mehr als eine „präsentiert von“-Fläche je Forum oder mehr als ein Startseiten-Banner
* zwei Programmpunkte ergeben denselben Link-Kurzcode (siehe `link_kodierung.md`)

Hinweise (Datei ist gültig, aber bitte prüfen):
* fehlender Raum, fehlender Forenveranstalter, Programmpunkt ohne Referenten
* Programmpunkte innerhalb eines Forums überschneiden sich
* dieselbe Person ist zur gleichen Zeit an zwei Stellen eingeplant
* mögliche Doppelung (gleicher Titel, gleicher Beginn)
* Status „geändert“ ohne Erläuterung
* Person ist angelegt, wird aber nirgends verwendet

## Befehle

Voraussetzung ist Node.js ab Version 20 (Installation siehe README).

```bash
npm run pruefen
```
prüft alle Dateien unter `data/events`.

```bash
node tools/validate.mjs pfad/zur/datei.json
```
prüft eine einzelne Datei.

```bash
npm run demo-daten
```
erzeugt die erfundene Beispielveranstaltung neu.

## Themen und Schwerpunkte: der Unterschied

* **Themen** (`topics`) sind Schlagworte. Ein Forum oder Programmpunkt kann mehrere haben.
  Sie stammen meist aus der Forenbeschreibung.
* **Schwerpunkte** (`categories`) sind eine redaktionelle Auswahl mit Farbe, z. B. „Daten und KI“.
  Je Programmpunkt höchstens einer. In der App erscheinen sie als farbiger Rand und als eigener Filter.
  Viele Programmpunkte haben keinen Schwerpunkt, das ist gewollt.
