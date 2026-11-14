# Wie Merkliste und Filter im Link stehen

Feste Entscheidung: Merkliste und gespeicherte Filter werden **nur im Link** gespeichert, auf keinem Server.

## Wo im Link?

Alles steht hinter dem Zeichen `#`, zum Beispiel:

```
https://dario-lanz.github.io/forumnavi/#tag=2&thema=netz&m=d0kopj1rlsnrhvt
```

Den Teil hinter `#` schickt der Browser **nie an den Server**. Er erscheint deshalb auch in keinem
Server-Protokoll. Nur wer den Link hat, sieht die Merkliste.

| Kürzel | Bedeutung | Beispiel |
|---|---|---|
| `seite` | geöffneter Bereich | `merkliste` |
| `ansicht` | Darstellung nach Forum | `forum` |
| `tag` | Tagnummern | `1.3` |
| `ab`, `bis` | Beginn frühestens / spätestens | `1100` |
| `forum` | Forennummern | `3.12.P1` |
| `fv` | Forenveranstalter | `aeolis` |
| `thema` | Themen | `netz.speicher` |
| `sp` | Schwerpunkte | `daten-ki` |
| `q` | Suchtext | `Wasserstoff` |
| `m` | Merkliste, 5 Zeichen je Programmpunkt | `d0kopj1rls` |
| `gf` | gespeicherte Filter | `Netze%20Mittwoch~2~~~~~netz` |

## Warum ein Kurzcode je Programmpunkt?

Gemessen am 13.11.2026 mit der Demo (Basisadresse `https://dario-lanz.github.io/forumnavi/`).
„Einfach“ bedeutet: vollständige IDs mit Komma getrennt. „Kompakt“ ist die gewählte Lösung.
QR-Code mit Fehlerkorrektur M (15 % des Codes dürfen beschädigt sein).

| Merkliste | einfach | kompakt |
|---|---|---|
| 10 Programmpunkte | 178 Zeichen, QR-Version 9 | **92 Zeichen, QR-Version 6** |
| 30 Programmpunkte | 441 Zeichen, QR-Version 16 | **192 Zeichen, QR-Version 10** |
| 60 Programmpunkte | 837 Zeichen, QR-Version 23 | **342 Zeichen, QR-Version 14** |
| 100 Programmpunkte | 1.364 Zeichen, QR-Version 30 | **542 Zeichen, QR-Version 18** |
| 30 Programmpunkte und 5 gespeicherte Filter | | **490 Zeichen, QR-Version 17** |

Die IDs der Demo sind kurz (`forum-03-2`). IDs aus echten Programmen können länger sein, dann wäre der
Unterschied noch größer. Die kompakte Lösung braucht immer genau 5 Zeichen je Programmpunkt.

Je höher die QR-Version, desto feiner die Punkte und desto schwerer lässt sich der Code vom Bildschirm
abfotografieren. Ab Version 16 zeigt die App einen Hinweis und empfiehlt, den Link stattdessen per Messenger zu
schicken. **Annahme:** Ich gehe davon aus, dass Codes bis etwa Version 15 vom Laptop-Bildschirm zuverlässig
scannbar sind. Das ist nicht gemessen und sollte mit 2 oder 3 Handys getestet werden.

## Wie der Kurzcode entsteht

Aus der ID eines Programmpunkts wird eine Prüfsumme berechnet (FNV-1a) und als 5 Zeichen aus Ziffern und
Kleinbuchstaben geschrieben (rund 60 Millionen Möglichkeiten). Code: `app/js/codes.js`.

**Warum nicht einfach die laufende Nummer (1., 2., 3. Programmpunkt)?** Wenn sich das Programm ändert, würden
sich die Nummern verschieben und alte Merklisten auf falsche Vorträge zeigen. Der Kurzcode hängt nur an der ID
des Programmpunkts. Er bleibt also gleich, solange die ID gleich bleibt, auch wenn andere Punkte dazukommen
oder wegfallen.

**Zwei IDs mit gleichem Code:** Die Wahrscheinlichkeit ist bei 1.000 Programmpunkten kleiner als 1 %. Das
Prüfskript erkennt den Fall und meldet einen Fehler. Dann wird eine der beiden IDs leicht geändert.

**Entfallene Programmpunkte:** Steht ein Code in der Merkliste, den es im aktuellen Programm nicht mehr gibt,
zeigt die App einen Hinweis und bietet an, ihn zu entfernen.

## Wichtig für die IDs beim Import

Damit Merklisten über Programmänderungen hinweg funktionieren, darf sich die **ID eines Programmpunkts nicht
ändern**, wenn nur Titel, Uhrzeit oder Raum geändert werden. Darauf achtet das Vergleichsskript (Etappe 3).
