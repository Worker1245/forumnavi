#!/usr/bin/env node
// Erstellt den Prüfbericht für einen Import (ohne KI, immer gleiches Ergebnis).
// Erwartet im Prüfordner:
//   kandidat.json   das ausgelesene Programm (von Claude erzeugt)
//   unsicher.json   optional: Stellen, an denen Claude beim Auslesen unsicher war
// Schreibt:
//   bericht.md      Prüfergebnis, Unsicherheiten als Prüfliste, Änderungen gegenüber der letzten Fassung
//
// Aufruf: node tools/import_bericht.mjs <pruefordner> [--vergleich <aktuell.json>]
// Ohne --vergleich wird die letzte Fassung automatisch gesucht (öffentliches, dann internes Repo).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from './validate.mjs';
import { diffPrograms, diffMarkdown } from './diff.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
if (!dir || dir.startsWith('--')) {
  console.error('Aufruf: node tools/import_bericht.mjs <pruefordner> [--vergleich <aktuell.json>]');
  process.exit(2);
}
const kandidat = join(dir, 'kandidat.json');
if (!existsSync(kandidat)) { console.error(`ABBRUCH: ${kandidat} fehlt.`); process.exit(1); }

let data;
try { data = JSON.parse(readFileSync(kandidat, 'utf8')); } catch (e) { console.error(`ABBRUCH: kandidat.json ist kein gültiges JSON: ${e.message}`); process.exit(1); }
const { errors, warnings } = validateData(data);
const unsicher = existsSync(join(dir, 'unsicher.json')) ? JSON.parse(readFileSync(join(dir, 'unsicher.json'), 'utf8')) : [];

const vi = process.argv.indexOf('--vergleich');
const candidates = vi > 0 ? [resolve(process.argv[vi + 1])] : [
  join(root, 'data/events', data.event?.id || '-', 'aktuell.json'),
  join(root, '../forumnavi-intern/data/events', data.event?.id || '-', 'aktuell.json'),
];
const previous = candidates.find((p) => existsSync(p));

const L = [];
const ev = data.event || {};
L.push(`# Prüfbericht: ${ev.name || '(ohne Namen)'}`, '');
L.push(`* Veranstaltung: \`${ev.id}\`${ev.code ? `, Code ${ev.code}` : ''}`);
L.push(`* Quelle: ${ev.programStatus?.source || '(nicht angegeben)'}`);
L.push(`* Umfang: ${data.days?.length ?? 0} Tage, ${data.forums?.length ?? 0} Foren, ${data.sessions?.length ?? 0} Programmpunkte, ${data.speakers?.length ?? 0} Personen`);
L.push(`* Echte Daten: ${ev.isDemo === true ? 'nein (Demo)' : '**ja**, öffentlich nur nach Eintrag in data/freigaben.json'}`);
L.push(`* Bericht erstellt: ${new Date().toLocaleString('de-DE', { timeZone: ev.timezone || 'Europe/Berlin' })}`, '');

L.push('## 1. Automatische Prüfung', '');
if (errors.length) {
  L.push(`**${errors.length} Fehler. So kann nicht freigegeben werden.**`, '');
  errors.forEach((e) => L.push(`* ${e}`));
} else {
  L.push('Keine Fehler.');
}
L.push('');
if (warnings.length) {
  L.push(`${warnings.length} Hinweise (Datei ist gültig, bitte prüfen):`, '');
  warnings.forEach((w) => L.push(`* [ ] ${w}`));
  L.push('');
}

L.push('## 2. Unsicherheiten beim Auslesen', '');
if (unsicher.length) {
  L.push('Bitte jede Zeile mit der Quelle vergleichen und abhaken.', '');
  for (const u of unsicher) {
    L.push(`* [ ] **${u.art || 'Sonstiges'}**${u.id ? ` (\`${u.id}\`)` : ''}: ${u.hinweis}${u.quelle ? ` _Quelle: ${u.quelle}_` : ''}`);
  }
} else {
  L.push('Keine Unsicherheiten gemeldet.');
}
L.push('');

L.push('## 3. Änderungen gegenüber der letzten Fassung', '');
if (!previous) {
  L.push('Erster Import dieser Veranstaltung, keine frühere Fassung vorhanden.');
} else if (!errors.length) {
  const prev = JSON.parse(readFileSync(previous, 'utf8'));
  L.push(diffMarkdown(diffPrograms(prev, data), { old: `${prev.event.programStatus.version} (${relative(root, previous)})`, new: 'dieser Import' }));
} else {
  L.push('Erst nach Behebung der Fehler möglich.');
}
L.push('');
L.push('## 4. Freigabe', '');
L.push('Wenn alles geprüft ist: im Chat **„Freigeben“** schreiben. Erst dann wird veröffentlicht und der Programmstand gesetzt.');

writeFileSync(join(dir, 'bericht.md'), L.join('\n') + '\n');
console.log(`Bericht: ${join(dir, 'bericht.md')}`);
console.log(`Fehler: ${errors.length}, Hinweise: ${warnings.length}, Unsicherheiten: ${unsicher.length}, Vergleich mit: ${previous ? relative(process.cwd(), previous) : '(keine frühere Fassung)'}`);
process.exit(errors.length ? 1 : 0);
