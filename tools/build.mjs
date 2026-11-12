#!/usr/bin/env node
// Baut die fertige Website in den Ordner dist/ (wird nicht ins Repo eingecheckt).
// 1. kopiert app/ nach dist/
// 2. prüft jede Veranstaltung (aktuell.json) und schreibt sie verkleinert nach dist/events/<id>/data.json
// 3. erzeugt dist/events/index.json und setzt Version und Dateiliste in den Service Worker ein
// Aufruf: node tools/build.mjs [--events <ordner>] [--ziel <ordner>]
// Bricht ab, wenn eine Veranstaltung Fehler hat.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from './validate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? resolve(process.argv[i + 1]) : def;
};
const eventsDir = arg('--events', join(root, 'data/events'));
const dist = arg('--ziel', join(root, 'dist'));

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, 'app'), dist, { recursive: true });

// QR-Code-Bibliothek (MIT-Lizenz, Kazuhiko Arase)
mkdirSync(join(dist, 'vendor'), { recursive: true });
const qrSrc = readFileSync(join(root, 'node_modules/qrcode-generator/dist/qrcode.mjs'), 'utf8');
writeFileSync(join(dist, 'vendor/qrcode.mjs'),
  '// qrcode-generator, Copyright (c) 2009 Kazuhiko Arase, MIT-Lizenz, https://github.com/kazuhikoarase/qrcode-generator\n' + qrSrc);

// Veranstaltungen
const events = [];
for (const id of readdirSync(eventsDir).sort()) {
  const file = join(eventsDir, id, 'aktuell.json');
  if (!existsSync(file)) continue;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const { errors } = validateData(data);
  if (errors.length) {
    console.error(`ABBRUCH: ${relative(root, file)} hat ${errors.length} Fehler. Erst "npm run pruefen" ausführen und beheben.`);
    process.exit(1);
  }
  if (data.event.id !== id) {
    console.error(`ABBRUCH: Ordnername "${id}" passt nicht zu event.id "${data.event.id}".`);
    process.exit(1);
  }
  delete data.$schema;
  const out = join(dist, 'events', id);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'data.json'), JSON.stringify(data));
  if (existsSync(join(eventsDir, id, 'sponsoren'))) cpSync(join(eventsDir, id, 'sponsoren'), join(out, 'sponsoren'), { recursive: true });
  const e = data.event;
  events.push({ id: e.id, name: e.name, city: e.location.city, startDate: e.startDate, endDate: e.endDate, timezone: e.timezone, isDemo: e.isDemo, programStatus: e.programStatus });
}
if (!events.length) {
  console.error(`ABBRUCH: keine Veranstaltung in ${eventsDir} gefunden.`);
  process.exit(1);
}
writeFileSync(join(dist, 'events/index.json'), JSON.stringify({ events }));

// Bei genau einer Veranstaltung: Programm schon beim Laden der Seite anfordern (spart Wartezeit im schwachen WLAN)
if (events.length === 1) {
  const page = join(dist, 'index.html');
  const html = readFileSync(page, 'utf8').replace(
    '<link rel="preload" href="events/index.json" as="fetch" crossorigin>',
    `<link rel="preload" href="events/index.json" as="fetch" crossorigin>\n  <link rel="preload" href="events/${events[0].id}/data.json" as="fetch" crossorigin>`,
  );
  writeFileSync(page, html);
}

// App-Version aus package.json in die Fußzeile
const appVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
writeFileSync(join(dist, 'index.html'), readFileSync(join(dist, 'index.html'), 'utf8').replace('__APP_VERSION__', `v${appVersion}`));

// Alle Dateien auflisten (für Service Worker und Größenbericht)
function list(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? list(p) : [p];
  });
}
const files = list(dist).map((p) => relative(dist, p).split('\\').join('/')).sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);
// Alles außer dem Service Worker selbst, auch die Programmdaten: so funktioniert die App nach dem ersten Aufruf offline
const precache = ['./', ...files.filter((f) => f !== 'sw.js' && f !== '.nojekyll')];
const sw = readFileSync(join(dist, 'sw.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__DATEIEN__', JSON.stringify(precache));
writeFileSync(join(dist, 'sw.js'), sw);
writeFileSync(join(dist, '.nojekyll'), '');

// Bericht
let total = 0, totalGz = 0;
console.log(`Gebaut nach ${relative(process.cwd(), dist) || '.'} (Version ${version})`);
for (const f of files) {
  const buf = readFileSync(join(dist, f));
  const gz = gzipSync(buf).length;
  total += buf.length; totalGz += gz;
  if (!f.includes('/sponsoren/')) console.log(`  ${f.padEnd(44)} ${(buf.length / 1024).toFixed(1).padStart(7)} KB  (komprimiert ${(gz / 1024).toFixed(1)} KB)`);
}
console.log(`Gesamt: ${(total / 1024).toFixed(0)} KB, komprimiert übertragen etwa ${(totalGz / 1024).toFixed(0)} KB`);
console.log(`Veranstaltungen: ${events.map((e) => e.id).join(', ')}`);
