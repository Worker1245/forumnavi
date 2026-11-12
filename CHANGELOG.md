# Änderungsprotokoll

Versionen nach Semantic Versioning: erste veröffentlichte Demo v0.1.0, Pilotversion v1.0.0.
Vor jeder neuen Version wird der alte Stand als ZIP im internen Repo unter `archive/` abgelegt und
die Version per Git-Tag markiert.

## [Unveröffentlicht]

### Hinzugefügt
* Etappe 1: JSON-Schema für Veranstaltungen (`data/schema/event.schema.json`)
* Erfundene Beispielveranstaltung „Demo-Energietage 2027“: 3 Tage, 33 Fachforen plus 3 Plenen,
  bis zu 6 Foren gleichzeitig, 207 Programmpunkte, 23 Forenveranstalter, 4 Sponsoren mit 8 Sponsorflächen
* Prüfskript `tools/validate.mjs` (Schema und inhaltliche Prüfungen)
* Generator `tools/generate_demo.mjs` für die Beispieldaten
* Push-Prüfung `tools/push_check.mjs` (Schlüssel, Passwörter, echte Programmdaten)
