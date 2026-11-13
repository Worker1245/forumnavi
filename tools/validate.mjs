#!/usr/bin/env node
// Prüft Programmdateien gegen das JSON-Schema und auf inhaltliche Fehler.
// Aufruf:  node tools/validate.mjs <datei.json | ordner> [weitere ...]
// Ordner werden rekursiv nach *.json durchsucht.
// Exit-Code 0 = keine Fehler (Warnungen erlaubt), 1 = Fehler gefunden.
// Arbeitet ohne KI und ohne Netzwerk: gleiche Eingabe ergibt immer gleiches Ergebnis.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sessionCode } from '../app/js/codes.js';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../data/schema/event.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function collectFiles(p) {
  const st = statSync(p);
  if (st.isFile()) return p.endsWith('.json') ? [p] : [];
  return readdirSync(p).sort().flatMap((n) => {
    if (n === 'node_modules' || n.startsWith('.')) return [];
    return collectFiles(join(p, n));
  });
}

// Lesbare deutsche Fehlermeldung aus einem Ajv-Fehler
function schemaMessage(e, data) {
  const path = e.instancePath || '(Wurzel)';
  let where = path;
  const m = path.match(/^\/(\w+)\/(\d+)/);
  if (m && Array.isArray(data?.[m[1]])) {
    const item = data[m[1]][Number(m[2])];
    if (item?.id) where = `${path} (id "${item.id}")`;
  }
  switch (e.keyword) {
    case 'required': return `${where}: Pflichtfeld "${e.params.missingProperty}" fehlt`;
    case 'additionalProperties': return `${where}: unbekanntes Feld "${e.params.additionalProperty}"`;
    case 'enum': return `${where}: Wert nicht erlaubt, erlaubt sind: ${e.params.allowedValues.join(', ')}`;
    case 'pattern': return `${where}: Format falsch (erwartet Muster ${e.params.pattern})`;
    case 'type': return `${where}: falscher Typ, erwartet ${e.params.type}`;
    case 'const': return `${where}: muss "${e.params.allowedValue}" sein`;
    default: return `${where}: ${e.message}`;
  }
}

function checkContent(d) {
  const errors = [];
  const warnings = [];
  const err = (s) => errors.push(s);
  const warn = (s) => warnings.push(s);

  // 1. Eindeutige IDs je Liste
  const index = {};
  for (const key of ['days', 'rooms', 'topics', 'categories', 'organizers', 'speakers', 'forums', 'sessions', 'sponsors', 'sponsorSlots']) {
    index[key] = new Map();
    for (const item of d[key] || []) {
      if (index[key].has(item.id)) err(`${key}: id "${item.id}" kommt doppelt vor`);
      index[key].set(item.id, item);
    }
  }
  const ref = (key, id, where) => {
    if (id !== undefined && !index[key].has(id)) err(`${where}: Verweis auf unbekannte ${key}-id "${id}"`);
  };

  // 2. Veranstaltungszeitraum und Tage
  const { startDate, endDate } = d.event;
  if (startDate > endDate) err(`event: startDate ${startDate} liegt nach endDate ${endDate}`);
  const dayDates = new Set();
  for (const day of d.days) {
    if (day.date < startDate || day.date > endDate) err(`Tag "${day.id}": Datum ${day.date} liegt außerhalb der Veranstaltung`);
    if (dayDates.has(day.date)) err(`Tag "${day.id}": Datum ${day.date} doppelt`);
    dayDates.add(day.date);
  }

  // 3. Foren
  for (const f of d.forums) {
    const w = `Forum "${f.id}"`;
    ref('days', f.dayId, w);
    ref('rooms', f.roomId, w);
    (f.organizerIds || []).forEach((id) => ref('organizers', id, w));
    (f.moderatorIds || []).forEach((id) => ref('speakers', id, w));
    (f.topicIds || []).forEach((id) => ref('topics', id, w));
    if ((f.organizerIds || []).length === 0 && f.kind !== 'plenum') warn(`${w}: kein Forenveranstalter angegeben`);
    if (!f.roomId) warn(`${w}: kein Raum angegeben`);
  }

  // 4. Programmpunkte
  const usedSpeakers = new Set();
  for (const s of d.sessions) {
    const w = `Programmpunkt "${s.id}"`;
    ref('forums', s.forumId, w);
    ref('rooms', s.roomId, w);
    (s.topicIds || []).forEach((id) => ref('topics', id, w));
    ref('categories', s.categoryId, w);
    (s.speakerIds || []).forEach((id) => { ref('speakers', id, w); usedSpeakers.add(id); });
    if (s.end <= s.start) err(`${w}: Ende ${s.end} liegt nicht nach Beginn ${s.start}`);
    if (s.start.slice(0, 10) !== s.end.slice(0, 10)) warn(`${w}: geht über Mitternacht`);
    const forum = index.forums.get(s.forumId);
    const day = forum && index.days.get(forum.dayId);
    if (day && s.start.slice(0, 10) !== day.date) err(`${w}: Datum ${s.start.slice(0, 10)} passt nicht zum Tag des Forums (${day.date})`);
    if (!dayDates.has(s.start.slice(0, 10))) err(`${w}: Datum ${s.start.slice(0, 10)} ist kein Veranstaltungstag`);
    if (s.status === 'geändert' && !s.statusNote) warn(`${w}: Status "geändert" ohne statusNote`);
    if (!forum?.roomId && !s.roomId) warn(`${w}: kein Raum (weder am Programmpunkt noch am Forum)`);
    if (s.type !== 'Pause' && !(s.speakerIds || []).length) warn(`${w}: keine Referenten angegeben`);
  }
  for (const f of d.forums) (f.moderatorIds || []).forEach((id) => usedSpeakers.add(id));
  for (const sp of d.speakers) if (!usedSpeakers.has(sp.id)) warn(`Referent "${sp.id}" (${sp.name}) wird nirgends verwendet`);

  // 5. Überschneidungen: gleicher Raum oder gleiche Person zur gleichen Zeit
  const active = d.sessions.filter((s) => s.status !== 'entfällt');
  const overlap = (a, b) => a.start < b.end && b.start < a.end;
  const roomOf = (s) => s.roomId || index.forums.get(s.forumId)?.roomId;
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (!overlap(a, b)) continue;
      if (a.forumId === b.forumId) warn(`Forum "${a.forumId}": "${a.id}" und "${b.id}" überschneiden sich zeitlich`);
      else if (roomOf(a) && roomOf(a) === roomOf(b)) err(`Raum "${roomOf(a)}": "${a.id}" und "${b.id}" gleichzeitig belegt`);
      const both = (a.speakerIds || []).filter((x) => (b.speakerIds || []).includes(x));
      for (const p of both) warn(`Referent "${p}" ist gleichzeitig in "${a.id}" und "${b.id}" eingeplant`);
    }
  }

  // 6. Mögliche Doppelungen: gleicher Titel und gleicher Beginn
  const seen = new Map();
  for (const s of d.sessions) {
    const k = `${s.title.trim().toLowerCase()}|${s.start}`;
    if (seen.has(k)) warn(`Mögliche Doppelung: "${seen.get(k)}" und "${s.id}" (gleicher Titel, gleicher Beginn)`);
    else seen.set(k, s.id);
  }

  // 7. Kurzcodes für Merklisten-Links müssen eindeutig sein (siehe docs/link_kodierung.md)
  const codes = new Map();
  for (const s of d.sessions) {
    const c = sessionCode(s.id);
    if (codes.has(c)) err(`Programmpunkte "${codes.get(c)}" und "${s.id}" ergeben denselben Link-Code "${c}". Bitte eine der beiden ids leicht ändern.`);
    else codes.set(c, s.id);
  }

  // 8. Sponsorflächen
  for (const slot of d.sponsorSlots) {
    const w = `Sponsorfläche "${slot.id}"`;
    ref('sponsors', slot.sponsorId, w);
    ref('forums', slot.forumId, w);
    ref('days', slot.dayId, w);
  }
  const perForum = new Map();
  for (const slot of d.sponsorSlots.filter((x) => x.placement === 'forum_presented_by' && x.active !== false)) {
    if (perForum.has(slot.forumId)) err(`Forum "${slot.forumId}" hat mehr als eine aktive Fläche "präsentiert von"`);
    perForum.set(slot.forumId, slot.id);
  }
  if (d.sponsorSlots.filter((x) => x.placement === 'home_banner' && x.active !== false).length > 1) {
    err('Mehr als ein aktives Startseiten-Banner');
  }

  return { errors, warnings };
}

// Ankündigung (Veranstaltung angelegt, Programm folgt): kleine Datei ankuendigung.json
export function validateAnnouncement(a) {
  const errors = [];
  const need = ['id', 'name', 'code', 'startDate', 'endDate', 'timezone', 'location', 'hinweis'];
  for (const k of need) if (a[k] === undefined || a[k] === '') errors.push(`Pflichtfeld "${k}" fehlt`);
  if (a.id && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(a.id)) errors.push(`id "${a.id}" hat ein falsches Format`);
  if (a.code && !/^[A-Z0-9]{4,12}$/.test(a.code)) errors.push(`code "${a.code}" hat ein falsches Format (4 bis 12 Großbuchstaben/Ziffern)`);
  if (a.startDate > a.endDate) errors.push('startDate liegt nach endDate');
  return { errors, warnings: [] };
}

export function validateData(data) {
  if (!validateSchema(data)) {
    return { errors: validateSchema.errors.map((e) => schemaMessage(e, data)), warnings: [] };
  }
  return checkContent(data);
}

// Kommandozeile
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const quiet = process.argv.includes('--kurz');
  if (args.length === 0) {
    console.error('Aufruf: node tools/validate.mjs <datei.json | ordner> [--kurz]');
    process.exit(2);
  }
  let failed = 0, total = 0;
  for (const file of args.flatMap(collectFiles)) {
    total++;
    const rel = relative(process.cwd(), file);
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      console.log(`✗ ${rel}\n  FEHLER: Datei ist kein gültiges JSON: ${e.message}`);
      failed++;
      continue;
    }
    if (file.endsWith('ankuendigung.json')) {
      const { errors } = validateAnnouncement(data);
      if (errors.length) failed++;
      console.log(`${errors.length ? '✗' : '✓'} ${rel}  (Ankündigung, Code ${data.code || '?'}, ${errors.length} Fehler)`);
      errors.forEach((e) => console.log(`  FEHLER:  ${e}`));
      continue;
    }
    const { errors, warnings } = validateData(data);
    const n = data.sessions?.length ?? 0;
    const fo = data.forums?.length ?? 0;
    if (errors.length) failed++;
    console.log(`${errors.length ? '✗' : '✓'} ${rel}  (${fo} Foren, ${n} Programmpunkte, ${errors.length} Fehler, ${warnings.length} Hinweise)`);
    errors.forEach((e) => console.log(`  FEHLER:  ${e}`));
    if (!quiet) warnings.forEach((w) => console.log(`  Hinweis: ${w}`));
  }
  console.log(`\n${total} Datei(en) geprüft, ${failed} mit Fehlern.`);
  process.exit(failed ? 1 : 0);
}
