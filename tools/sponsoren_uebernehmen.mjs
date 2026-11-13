#!/usr/bin/env node
// Übernimmt Sponsorflächen aus einer Tabelle (CSV) in eine Programmdatei. Ohne KI:
// Texte und Links werden Zeichen für Zeichen aus der Tabelle übernommen, Logos byte-genau kopiert.
// Für jedes Logo wird eine Prüfsumme (SHA-256) ausgegeben. Damit lässt sich belegen, dass die Datei unverändert ist.
//
// Aufruf: node tools/sponsoren_uebernehmen.mjs <tabelle.csv> <programm.json> --logos <ordner> --ausgabe <kandidat.json>
//   <programm.json>  aktuelle Fassung der Veranstaltung (aktuell.json)
//   --logos          Ordner mit den gelieferten Logo-Dateien
//   --ausgabe        neue Datei zur Prüfung; danach wie gewohnt Prüfbericht und "Freigeben"
// Die Logos werden in den Ordner sponsoren/ neben <programm.json> kopiert.
//
// Tabelle: Semikolon-getrennt, UTF-8 (in Excel: "Speichern unter" > "CSV UTF-8 (durch Trennzeichen getrennt)").
// Spalten: Fläche;Sponsor;Logo-Datei;Link;Text;Tag;Forum;Aktiv
//   Fläche: Banner Programm | Banner Tag | Forum | Kalender
//   Tag:    Datum TT.MM.JJJJ (nur bei "Banner Tag")
//   Forum:  Forennummer, z. B. 12 (nur bei "Forum")
//   Aktiv:  ja | nein (leer = ja)
// Die Tabelle ersetzt alle bisherigen Sponsorflächen der Veranstaltung.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join } from 'node:path';
import { validateData, checkSponsorAssets } from './validate.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const fail = (m) => { console.error(`ABBRUCH: ${m}`); process.exit(1); };
const [csvPath, programPath] = process.argv.slice(2);
const logosDir = arg('--logos');
const outPath = arg('--ausgabe');
if (!csvPath || !programPath || !logosDir || !outPath) {
  console.error('Aufruf: node tools/sponsoren_uebernehmen.mjs <tabelle.csv> <programm.json> --logos <ordner> --ausgabe <kandidat.json>');
  process.exit(2);
}

// CSV lesen (UTF-8 erzwingen, damit Umlaute nicht verfälscht werden)
const buf = readFileSync(csvPath);
let text;
try {
  text = new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
} catch {
  fail('Die Tabelle ist nicht als UTF-8 gespeichert. In Excel "Speichern unter" > "CSV UTF-8 (durch Trennzeichen getrennt)" wählen.');
}
function parseCsv(t) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}
const rows = parseCsv(text);
const header = rows.shift().map((h) => h.trim().toLowerCase());
const need = ['fläche', 'sponsor', 'logo-datei', 'link', 'text', 'tag', 'forum', 'aktiv'];
for (const n of need) if (!header.includes(n)) fail(`Spalte "${n}" fehlt in der Tabelle. Erwartet: ${need.join(';')}`);
const col = (r, n) => (r[header.indexOf(n)] ?? '').trim();

const data = JSON.parse(readFileSync(programPath, 'utf8'));
const eventDir = dirname(programPath);
const PLACEMENT = { 'banner programm': 'home_banner', 'banner tag': 'day_banner', forum: 'forum_presented_by', kalender: 'calendar_note' };
const slug = (s) => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

const sponsors = new Map();
const slots = [];
const problems = [];
const copies = [];
rows.forEach((r, i) => {
  const line = i + 2;
  const placement = PLACEMENT[col(r, 'fläche').toLowerCase()];
  if (!placement) { problems.push(`Zeile ${line}: Fläche "${col(r, 'fläche')}" unbekannt (erlaubt: Banner Programm, Banner Tag, Forum, Kalender)`); return; }
  const name = col(r, 'sponsor');
  if (!name) { problems.push(`Zeile ${line}: Sponsor fehlt`); return; }
  const sid = `sp-${slug(name)}`;
  const link = col(r, 'link');
  if (link && !/^https:\/\/\S+$/.test(link)) problems.push(`Zeile ${line}: Link muss mit https:// beginnen und darf keine Leerzeichen enthalten`);
  const logoFile = col(r, 'logo-datei');
  if (!sponsors.has(sid)) sponsors.set(sid, { id: sid, name });
  const sp = sponsors.get(sid);
  if (link) sp.url = link;
  if (logoFile) {
    const src = join(logosDir, basename(logoFile));
    const ext = extname(logoFile).toLowerCase();
    if (!['.svg', '.png', '.webp'].includes(ext)) problems.push(`Zeile ${line}: Logo muss SVG, PNG oder WebP sein`);
    else if (!existsSync(src)) problems.push(`Zeile ${line}: Logo-Datei "${logoFile}" nicht im Ordner ${logosDir}`);
    else {
      sp.logo = `sponsoren/${slug(name)}${ext}`;
      if (!copies.some((c) => c.dest === join(eventDir, sp.logo))) copies.push({ src, dest: join(eventDir, sp.logo), name });
    }
  }
  const slot = { id: `slot-${i + 1}-${slug(name).slice(0, 20)}`, placement, sponsorId: sid };
  const t = col(r, 'text');
  if (t) {
    if ([...t].length > 140) problems.push(`Zeile ${line}: Text hat ${[...t].length} Zeichen, erlaubt sind 140`);
    slot.text = t;
  }
  if (placement === 'day_banner') {
    const m = col(r, 'tag').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    const date = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
    const day = data.days.find((d) => d.date === date);
    if (!day) problems.push(`Zeile ${line}: Tag "${col(r, 'tag')}" ist kein Veranstaltungstag (Format TT.MM.JJJJ)`);
    else slot.dayId = day.id;
  }
  if (placement === 'forum_presented_by') {
    const f = data.forums.find((x) => x.number === col(r, 'forum'));
    if (!f) problems.push(`Zeile ${line}: Forum "${col(r, 'forum')}" gibt es nicht`);
    else slot.forumId = f.id;
  }
  const aktiv = col(r, 'aktiv').toLowerCase();
  slot.active = aktiv === '' || aktiv === 'ja';
  slots.push(slot);
});
if (problems.length) fail(`Die Tabelle hat ${problems.length} Problem(e):\n  ${problems.join('\n  ')}`);

// Logos byte-genau kopieren und Prüfsummen ausgeben
mkdirSync(join(eventDir, 'sponsoren'), { recursive: true });
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
console.log('Logos (Prüfsumme SHA-256, Original = Kopie):');
for (const c of copies) {
  copyFileSync(c.src, c.dest);
  const a = sha(c.src), b = sha(c.dest);
  if (a !== b) fail(`Kopie von ${c.src} weicht vom Original ab`);
  console.log(`  ${c.name}: ${basename(c.src)} -> ${c.dest.slice(eventDir.length + 1)}  ${a}`);
}

data.sponsors = [...sponsors.values()];
data.sponsorSlots = slots;
const { errors } = validateData(data);
errors.push(...checkSponsorAssets(data, eventDir).errors);
if (errors.length) fail(`Ergebnis ist ungültig:\n  ${errors.join('\n  ')}`);
writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');
console.log(`Übernommen: ${slots.length} Flächen von ${sponsors.size} Sponsoren. Texte und Links unverändert aus der Tabelle.`);
console.log(`Ergebnis zur Prüfung: ${outPath}`);
console.log('Nächster Schritt: Prüfbericht erstellen und nach Prüfung "Freigeben".');
