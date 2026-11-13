#!/usr/bin/env node
// Veröffentlicht eine geprüfte Programmfassung. Wird erst nach deinem ausdrücklichen "Freigeben" ausgeführt.
// 1. prüft die Datei (Abbruch bei Fehlern)
// 2. setzt Programmstand (Datum und Uhrzeit jetzt) und Versionskennung JJJJ-MM-TT_NN
// 3. legt die Fassung unter versionen/ ab und ersetzt aktuell.json
// Echte Programmdaten (isDemo: false) dürfen nur ins öffentliche Repo, wenn die Veranstaltung
// in data/freigaben.json mit schriftlicher Zustimmung des Veranstalters eingetragen ist.
//
// Aufruf: node tools/freigeben.mjs <kandidat.json> --ziel <events-ordner> [--quelle "Text"] [--hinweis "Text"] [--trotzdem]
//   --ziel     Ordner, in dem die Veranstaltungen liegen, z. B. data/events (öffentlich)
//              oder ../forumnavi-intern/data/events (intern, vor der Zustimmung)
//   --trotzdem auch veröffentlichen, wenn sich inhaltlich nichts geändert hat

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from './validate.mjs';
import { diffPrograms } from './diff.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const fail = (msg) => { console.error(`ABBRUCH: ${msg}`); process.exit(1); };

const candidatePath = process.argv[2];
const zielArg = arg('--ziel');
if (!candidatePath || candidatePath.startsWith('--') || !zielArg) {
  console.error('Aufruf: node tools/freigeben.mjs <kandidat.json> --ziel <events-ordner> [--quelle "Text"] [--hinweis "Text"] [--trotzdem]');
  process.exit(2);
}
const ziel = resolve(zielArg);
const publicTarget = ziel === resolve(root, 'data/events');

const data = JSON.parse(readFileSync(candidatePath, 'utf8'));
const { errors, warnings } = validateData(data);
if (errors.length) fail(`Die Datei hat ${errors.length} Fehler. Erst beheben:\n  ${errors.join('\n  ')}`);

const id = data.event.id;
if (publicTarget && data.event.isDemo !== true) {
  const fr = JSON.parse(readFileSync(join(root, 'data/freigaben.json'), 'utf8'));
  const entry = fr.freigaben.find((f) => f.eventId === id);
  if (!entry) fail(`"${id}" enthält echte Programmdaten und steht nicht in data/freigaben.json. Ohne schriftliche Zustimmung des Veranstalters wird nicht öffentlich veröffentlicht. Für die interne Vorschau --ziel ../forumnavi-intern/data/events verwenden.`);
  console.log(`Freigabe gefunden: ${entry.veranstalter}, Zustimmung vom ${entry.zustimmungVom} (${entry.nachweis})`);
}

// Zeitpunkt jetzt in der Zeitzone der Veranstaltung, mit Zeitverschiebung, z. B. 2026-11-13T00:40:00+01:00
function nowInZone(tz) {
  const now = new Date();
  now.setSeconds(0, 0);
  const local = now.toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T'); // 2026-11-13T00:40:00
  const offsetMin = Math.round((Date.parse(local + 'Z') - now.getTime()) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
const stand = nowInZone(data.event.timezone);
const day = stand.slice(0, 10);

const eventDir = join(ziel, id);

// Wurde die Veranstaltung vorab angelegt, gilt ihr reservierter Code
const annPath = join(eventDir, 'ankuendigung.json');
if (existsSync(annPath)) {
  const ann = JSON.parse(readFileSync(annPath, 'utf8'));
  if (!data.event.code) data.event.code = ann.code;
  if (data.event.code !== ann.code) fail(`Der Code im Import (${data.event.code}) weicht vom reservierten Code ${ann.code} ab. Der Veranstalter hat ${ann.code} schon veröffentlicht.`);
  if (data.event.listed === undefined) data.event.listed = ann.listed === true;
}
const versDir = join(eventDir, 'versionen');
mkdirSync(versDir, { recursive: true });
const sameDay = existsSync(versDir) ? readdirSync(versDir).filter((f) => f.startsWith(day + '_')).map((f) => Number(f.slice(11, 13))) : [];
const version = `${day}_${String((sameDay.length ? Math.max(...sameDay) : 0) + 1).padStart(2, '0')}`;

// Unverändert gegenüber der aktuellen Fassung?
const currentPath = join(eventDir, 'aktuell.json');
if (existsSync(currentPath)) {
  const cur = JSON.parse(readFileSync(currentPath, 'utf8'));
  const d = diffPrograms(cur, data);
  const strip = (x) => JSON.stringify({ ...x, $schema: undefined, event: { ...x.event, programStatus: undefined } });
  const total = d.added.length + d.changed.length + d.removed.length + d.forumChanges.length + (d.sponsorsChanged ? 1 : 0);
  if (strip(cur) === strip(data) && !process.argv.includes('--trotzdem')) fail('Keine Änderungen gegenüber der aktuellen Fassung. Nichts veröffentlicht.');
  console.log(`Änderungen gegenüber ${cur.event.programStatus.version}: ${d.added.length} neu, ${d.changed.length} geändert, ${d.removed.length} entfallen${total ? '' : ' (nur Metadaten geändert)'}`);
}

data.event.programStatus = {
  date: stand,
  version,
  ...(arg('--quelle') || data.event.programStatus?.source ? { source: arg('--quelle') || data.event.programStatus.source } : {}),
  ...(arg('--hinweis') ? { note: arg('--hinweis') } : {}),
};

const schemaFile = join(root, 'data/schema/event.schema.json');
const withSchema = (file) => JSON.stringify({ $schema: relative(dirname(file), schemaFile).split('\\').join('/'), ...Object.fromEntries(Object.entries(data).filter(([k]) => k !== '$schema')) }, null, 2) + '\n';
const versFile = join(versDir, `${version}.json`);
writeFileSync(versFile, withSchema(versFile));
writeFileSync(currentPath, withSchema(currentPath));

console.log(`Freigegeben: ${data.event.name}`);
console.log(`  Programmstand: ${stand}`);
console.log(`  Version:       ${version}`);
console.log(`  Dateien:       ${relative(process.cwd(), versFile)}`);
console.log(`                 ${relative(process.cwd(), currentPath)}`);
if (warnings.length) console.log(`  Hinweise aus der Prüfung: ${warnings.length} (siehe Prüfbericht)`);
console.log(publicTarget
  ? 'Nächster Schritt: committen und pushen. GitHub prüft, baut und veröffentlicht automatisch.'
  : 'Nächster Schritt: im internen Repo committen und pushen. Nicht öffentlich.');
