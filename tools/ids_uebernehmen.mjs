#!/usr/bin/env node
// Übernimmt die IDs der letzten Fassung in einen neuen Import, damit Merklisten gültig bleiben.
// Regeln (feste Reihenfolge, ohne KI):
//   1. gleiches Forum und gleicher Titel             -> alte ID
//   2. gleiches Forum und gleicher Beginn, Titel ähnlich (gleiche ersten 3 Wörter) -> alte ID
//   3. sonst bleibt die neue ID; ist sie schon vergeben, wird "-n2", "-n3" ... angehängt
// Foren werden über ihre Nummer zugeordnet, Personen über den Namen.
// Aufruf: node tools/ids_uebernehmen.mjs <kandidat.json> <letzte-fassung.json>
// Schreibt kandidat.json zurück und gibt eine Zusammenfassung aus.

import { readFileSync, writeFileSync } from 'node:fs';

const [candPath, prevPath] = process.argv.slice(2);
if (!candPath || !prevPath) {
  console.error('Aufruf: node tools/ids_uebernehmen.mjs <kandidat.json> <letzte-fassung.json>');
  process.exit(2);
}
const cand = JSON.parse(readFileSync(candPath, 'utf8'));
const prev = JSON.parse(readFileSync(prevPath, 'utf8'));
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const first3 = (t) => norm(t).split(' ').slice(0, 3).join(' ');

// Foren: Nummer -> alte ID
const forumMap = new Map();
const prevForumByNumber = new Map(prev.forums.map((f) => [f.number, f]));
for (const f of cand.forums) {
  const old = prevForumByNumber.get(f.number);
  if (old && old.id !== f.id) forumMap.set(f.id, old.id);
}
// Personen: Name -> alte ID
const speakerMap = new Map();
const prevSpeakerByName = new Map(prev.speakers.map((p) => [norm(p.name), p]));
for (const p of cand.speakers) {
  const old = prevSpeakerByName.get(norm(p.name));
  if (old && old.id !== p.id) speakerMap.set(p.id, old.id);
}
const mapF = (id) => forumMap.get(id) || id;
const mapP = (id) => speakerMap.get(id) || id;
cand.forums.forEach((f) => { f.id = mapF(f.id); if (f.moderatorIds) f.moderatorIds = f.moderatorIds.map(mapP); });
cand.speakers.forEach((p) => { p.id = mapP(p.id); });
cand.sessions.forEach((s) => { s.forumId = mapF(s.forumId); if (s.speakerIds) s.speakerIds = s.speakerIds.map(mapP); });
(cand.sponsorSlots || []).forEach((x) => { if (x.forumId) x.forumId = mapF(x.forumId); });

// Programmpunkte
const prevByForum = new Map();
for (const s of prev.sessions) {
  if (!prevByForum.has(s.forumId)) prevByForum.set(s.forumId, []);
  prevByForum.get(s.forumId).push(s);
}
const used = new Set();
const stats = { titel: 0, beginn: 0, neu: 0 };
const assigned = new Map();
// Runde 1: Titel
for (const s of cand.sessions) {
  const hit = (prevByForum.get(s.forumId) || []).find((o) => !used.has(o.id) && norm(o.title) === norm(s.title));
  if (hit) { assigned.set(s, hit.id); used.add(hit.id); stats.titel++; }
}
// Runde 2: Beginn + ähnlicher Titel
for (const s of cand.sessions) {
  if (assigned.has(s)) continue;
  const hit = (prevByForum.get(s.forumId) || []).find((o) => !used.has(o.id) && o.start === s.start && first3(o.title) === first3(s.title));
  if (hit) { assigned.set(s, hit.id); used.add(hit.id); stats.beginn++; }
}
// Runde 3: neue IDs, ohne Kollision mit alten oder schon vergebenen
const allPrevIds = new Set(prev.sessions.map((s) => s.id));
const taken = new Set([...assigned.values()]);
const newOnes = [];
for (const s of cand.sessions) {
  if (assigned.has(s)) { s.id = assigned.get(s); continue; }
  let id = s.id;
  let n = 2;
  while (taken.has(id) || allPrevIds.has(id)) id = `${s.id}-n${n++}`;
  s.id = id;
  taken.add(id);
  stats.neu++;
  newOnes.push(`${s.id}: ${s.title}`);
}

// Redaktionelle Angaben, die in der Quelle meist fehlen, aus der letzten Fassung übernehmen
// (nur wenn der neue Import sie nicht selbst enthält)
const prevById = new Map(prev.sessions.map((s) => [s.id, s]));
let carried = 0;
for (const s of cand.sessions) {
  const o = prevById.get(s.id);
  if (!o) continue;
  for (const k of ['categoryId', 'topicIds', 'description']) {
    if (s[k] === undefined && o[k] !== undefined) { s[k] = o[k]; carried++; }
  }
  if ((s.status || 'geplant') === (o.status || 'geplant') && !s.statusNote && o.statusNote) { s.statusNote = o.statusNote; carried++; }
}

writeFileSync(candPath, JSON.stringify(cand, null, 2) + '\n');
console.log(`Aus der letzten Fassung übernommen (Schwerpunkt, Themen, Beschreibung, Statushinweis): ${carried} Angaben.`);
console.log(`IDs übernommen: ${stats.titel} über den Titel, ${stats.beginn} über den Beginn, ${stats.neu} neu.`);
console.log(`Foren zugeordnet: ${cand.forums.length - [...cand.forums].filter((f) => !prevForumByNumber.has(f.number)).length} von ${cand.forums.length}, Personen über den Namen: ${speakerMap.size} umbenannt.`);
if (newOnes.length) console.log('Neue Programmpunkte:\n  ' + newOnes.join('\n  '));
