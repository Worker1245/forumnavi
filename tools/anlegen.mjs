#!/usr/bin/env node
// Legt eine Veranstaltung an, BEVOR es ein Programm gibt, und reserviert ihren Veranstaltungscode.
// Unter dem Code erscheint bis zum ersten Import die Seite "Programm folgt".
// So kann der Veranstalter den Code schon in Einladungen, Website und Programmheft drucken.
//
// Aufruf:
//   node tools/anlegen.mjs --id windenergietage-2027 --name "Windenergietage 2027" \
//     --beginn 2027-11-09 --ende 2027-11-11 --ort "Tagungshotel" --stadt "Ort" \
//     [--code WIND27] [--programm-ab "September 2027"] [--ziel <events-ordner>] [--demo]
// Ohne --code wird ein Code vorgeschlagen. Ohne --ziel: internes Repo (../forumnavi-intern/data/events).
// Schreibt <ziel>/<id>/ankuendigung.json

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const fail = (m) => { console.error(`ABBRUCH: ${m}`); process.exit(1); };

export const RESERVED = new Set(['CSS', 'JS', 'EVENTS', 'VENDOR', 'IMPRESSUM', 'DATENSCHUTZ', 'VERANSTALTER', 'DEMO', 'TEST', 'ADMIN']);
export const EVENT_DIRS = [join(root, 'data/events'), join(root, '../forumnavi-intern/data/events')];

// Alle bereits vergebenen Codes aus beiden Repos (Programme und Ankündigungen)
export function usedCodes() {
  const used = new Map();
  for (const dir of EVENT_DIRS) {
    if (!existsSync(dir)) continue;
    for (const id of readdirSync(dir)) {
      for (const f of ['aktuell.json', 'ankuendigung.json']) {
        const p = join(dir, id, f);
        if (!existsSync(p)) continue;
        try {
          const d = JSON.parse(readFileSync(p, 'utf8'));
          const code = (d.event || d).code;
          if (code) used.set(code.toUpperCase(), (d.event || d).id);
        } catch { /* defekte Datei: meldet das Prüfskript */ }
      }
    }
  }
  return used;
}

// Vorschlag: erste Silbe des ersten Worts (4 Buchstaben) + Jahr zweistellig, z. B. WIND27
export function proposeCode(name, year, used) {
  const word = (name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().match(/[A-Z]{3,}/) || ['EVENT'])[0];
  const yy = String(year).slice(-2);
  const bases = [word.slice(0, 4), word.slice(0, 5), word.slice(0, 6)];
  for (const b of bases) if (!used.has(b + yy) && !RESERVED.has(b + yy)) return b + yy;
  for (const c of 'ABCDEFGHJKMNPQRSTUVWXYZ') if (!used.has(word.slice(0, 4) + c + yy)) return word.slice(0, 4) + c + yy;
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const id = arg('--id'), name = arg('--name'), beginn = arg('--beginn'), ende = arg('--ende');
  if (!id || !name || !beginn || !ende) {
    console.error('Aufruf: node tools/anlegen.mjs --id <id> --name "<Name>" --beginn JJJJ-MM-TT --ende JJJJ-MM-TT --ort "<Ort>" --stadt "<Stadt>" [--code CODE] [--programm-ab "Text"] [--ziel <ordner>] [--demo]');
    process.exit(2);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) fail('Die id darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(beginn) || !/^\d{4}-\d{2}-\d{2}$/.test(ende) || beginn > ende) fail('Beginn und Ende als JJJJ-MM-TT angeben, Beginn nicht nach Ende.');
  const ziel = resolve(arg('--ziel') || join(root, '../forumnavi-intern/data/events'));
  for (const dir of EVENT_DIRS) if (existsSync(join(dir, id))) fail(`Eine Veranstaltung mit der id "${id}" gibt es schon (${relative(process.cwd(), join(dir, id))}).`);

  const used = usedCodes();
  let code = arg('--code') ? arg('--code').toUpperCase().replace(/[^A-Z0-9]/g, '') : proposeCode(name, beginn.slice(0, 4), used);
  if (!code || !/^[A-Z0-9]{4,12}$/.test(code)) fail('Code muss 4 bis 12 Zeichen haben, nur Buchstaben und Ziffern.');
  if (RESERVED.has(code)) fail(`Der Code ${code} ist reserviert.`);
  if (used.has(code)) fail(`Der Code ${code} ist schon vergeben (${used.get(code)}).`);
  const ambiguous = /[0O1IL]/.test(code);

  const a = {
    id, name, code, isDemo: process.argv.includes('--demo'), listed: false,
    startDate: beginn, endDate: ende, timezone: 'Europe/Berlin',
    location: { venue: arg('--ort') || '', city: arg('--stadt') || '' },
    hinweis: arg('--programm-ab') ? `Das Programm erscheint hier voraussichtlich ab ${arg('--programm-ab')}.` : 'Das Programm erscheint hier, sobald es feststeht.',
    angelegt: new Date().toISOString().slice(0, 10),
  };
  mkdirSync(join(ziel, id), { recursive: true });
  writeFileSync(join(ziel, id, 'ankuendigung.json'), JSON.stringify(a, null, 2) + '\n');
  console.log(`Angelegt: ${name}`);
  console.log(`  Code:  ${code}${ambiguous ? '   (Hinweis: enthält 0/O oder 1/I/L, die man verwechseln kann)' : ''}`);
  console.log(`  Datei: ${relative(process.cwd(), join(ziel, id, 'ankuendigung.json'))}`);
  console.log('  Online erreichbar erst, wenn die Datei im öffentlichen Repo liegt (nach Eintrag in data/freigaben.json).');
}
