# Änderungsprotokoll

Versionen nach Semantic Versioning: erste veröffentlichte Demo v0.1.0, Pilotversion v1.0.0.
Vor jeder neuen Version wird der alte Stand als ZIP im internen Repo unter `archive/` abgelegt und
die Version per Git-Tag markiert.

## [0.1.0] (2026-11-13)

Erste veröffentlichte Demo (Etappe 2).

### Hinzugefügt
* Web-App (`app/`): Programm nach Uhrzeit oder Forum, Filter (Tag, Uhrzeit, Schwerpunkt, Thema, Forum,
  Forenveranstalter, Freitext), Merkliste, gespeicherte Filter, Teilen per Link und QR-Code,
  Kalenderexport (einzeln, Merkliste, Filtertreffer), Programmstand auf jeder Seite, Sponsorflächen,
  Vorlagen für Impressum und Datenschutz, Offline-Betrieb
* Schwerpunkte (Kategorien mit Farbe) im Datenformat, höchstens einer je Programmpunkt
* Kompakte Link-Kodierung mit 5-stelligen Kurzcodes (`docs/link_kodierung.md`), Prüfung auf doppelte Codes
* Bauskript `tools/build.mjs`, automatische Veröffentlichung über GitHub Actions
* Push-Prüfung kontrolliert jetzt auch, ob das Repo öffentlich bzw. privat ist

### Geändert
* Beispielveranstaltung realistischer: Foren ganztägig, 11 Foren gleichzeitig, 372 Programmpunkte
  (Datenstand `2026-11-13_01`). Die Fassung `2026-11-12_01` aus Etappe 1 bleibt erhalten.

## Etappe 1 (2026-11-12, nicht veröffentlicht)

### Hinzugefügt
* JSON-Schema für Veranstaltungen, erfundene Beispielveranstaltung, Prüfskript, Datengenerator, Push-Prüfung
