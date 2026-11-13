#!/usr/bin/env node
// Vergleicht zwei Fassungen eines Programms und listet: neu, geändert, entfallen.
// Arbeitet ohne KI: gleiche Eingabe ergibt immer die gleiche Liste.
// Aufruf: node tools/diff.mjs <alt.json> <neu.json> [--md ausgabe.md]

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function when(dt) {
  const d = new Date(`${dt.slice(0, 10)}T12:00:00Z`);
  return `${WD[d.getUTCDay()]} ${dt.slice(8, 10)}.${dt.slice(5, 7)}. ${dt.slice(11, 16)}`;
}
const normTitle = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

function index(d) {
  const by = (k) => new Map((d[k] || []).map((x) => [x.id, x]));
  const forums = by('forums');
  const rooms = by('rooms');
  const speakers = by('speakers');
  const cats = by('categories');
  const forumLabel = (f) => (f ? (f.kind === 'plenum' ? f.title : `Forum ${f.number}`) : '?');
  const sessions = new Map();
  for (const s of d.sessions) {
    const f = forums.get(s.forumId);
    sessions.set(s.id, {
      id: s.id,
      raw: s,
      forum: forumLabel(f),
      fields: {
        Titel: s.title,
        Beginn: s.start,
        Ende: s.end,
        Raum: rooms.get(s.roomId || f?.roomId)?.name || '(kein Raum)',
        Forum: f ? `${forumLabel(f)}${f.kind === 'plenum' ? '' : `: ${f.title}`}` : '?',
        Personen: (s.speakerIds || []).map((id) => speakers.get(id)?.name || id).join(', ') || '(keine)',
        Status: s.status || 'geplant',
        Statushinweis: s.statusNote || '',
        Beschreibung: s.description || '',
        Schwerpunkt: cats.get(s.categoryId)?.label || '',
        Typ: s.type || 'Vortrag',
      },
    });
  }
  return { sessions, forums };
}

export function diffPrograms(oldData, newData) {
  const A = index(oldData);
  const B = index(newData);
  const added = [], removed = [], changed = [];
  for (const [id, b] of B.sessions) {
    const a = A.sessions.get(id);
    if (!a) { added.push(b); continue; }
    const changes = [];
    for (const k of Object.keys(b.fields)) {
      if (a.fields[k] !== b.fields[k]) changes.push({ field: k, from: a.fields[k], to: b.fields[k] });
    }
    if (changes.length) changed.push({ ...b, changes });
  }
  for (const [id, a] of A.sessions) if (!B.sessions.has(id)) removed.push(a);

  // Vermutlich nur die ID geändert: gleicher Titel im gleichen Forum, oder gleicher Beginn im gleichen Forum
  const idChanges = [];
  for (const r of removed) {
    const match = added.find((n) => n.forum === r.forum && (normTitle(n.fields.Titel) === normTitle(r.fields.Titel) || n.fields.Beginn === r.fields.Beginn));
    if (match) idChanges.push({ from: r, to: match });
  }

  const forumChanges = [];
  for (const [id, f] of B.forums) {
    const o = A.forums.get(id);
    if (!o) forumChanges.push(`Neues Forum: ${f.number} ${f.title}`);
    else {
      if (o.title !== f.title) forumChanges.push(`Forum ${f.number}: Titel „${o.title}“ → „${f.title}“`);
      if (o.roomId !== f.roomId) forumChanges.push(`Forum ${f.number}: Raum ${o.roomId || '(keiner)'} → ${f.roomId || '(keiner)'}`);
      if ((o.organizerIds || []).join() !== (f.organizerIds || []).join()) forumChanges.push(`Forum ${f.number}: Forenveranstalter geändert`);
    }
  }
  for (const [id, o] of A.forums) if (!B.forums.has(id)) forumChanges.push(`Forum entfallen: ${o.number} ${o.title}`);

  const sponsorsChanged = JSON.stringify(oldData.sponsorSlots || []) !== JSON.stringify(newData.sponsorSlots || [])
    || JSON.stringify(oldData.sponsors || []) !== JSON.stringify(newData.sponsors || []);

  const byTime = (x, y) => x.fields.Beginn.localeCompare(y.fields.Beginn) || x.id.localeCompare(y.id);
  added.sort(byTime); removed.sort(byTime); changed.sort(byTime);
  return { added, removed, changed, idChanges, forumChanges, sponsorsChanged };
}

const short = (v) => (String(v).length > 80 ? String(v).slice(0, 77) + '...' : String(v));

export function diffMarkdown(r, labels = { old: 'alt', new: 'neu' }) {
  const L = [];
  const line = (s) => `${when(s.fields.Beginn)} · ${s.forum} · ${s.fields.Titel}`;
  L.push(`Vergleich: **${labels.old}** → **${labels.new}**`, '');
  L.push(`| neu | geändert | entfallen | Foren-Änderungen | Sponsorflächen |`, '|---|---|---|---|---|');
  L.push(`| ${r.added.length} | ${r.changed.length} | ${r.removed.length} | ${r.forumChanges.length} | ${r.sponsorsChanged ? 'geändert' : 'unverändert'} |`, '');
  if (r.idChanges.length) {
    L.push('### Achtung: vermutlich nur die ID geändert', '');
    L.push('Diese Programmpunkte sind entfallen und gleichzeitig sehr ähnlich neu aufgetaucht. Wenn es derselbe Programmpunkt ist, bitte die alte ID behalten, sonst verschwindet er aus den Merklisten der Teilnehmenden.', '');
    for (const c of r.idChanges) L.push(`* ${line(c.from)}: \`${c.from.id}\` → \`${c.to.id}\``);
    L.push('');
  }
  if (r.changed.length) {
    L.push('### Geändert', '');
    for (const c of r.changed) {
      L.push(`* ${line(c)}`);
      for (const ch of c.changes) L.push(`  * ${ch.field}: „${short(ch.from)}“ → „${short(ch.to)}“`);
    }
    L.push('');
  }
  if (r.added.length) {
    L.push('### Neu', '');
    for (const s of r.added) L.push(`* ${line(s)} (${s.fields.Raum})`);
    L.push('');
  }
  if (r.removed.length) {
    L.push('### Entfallen (nicht mehr in der neuen Fassung)', '');
    L.push('Hinweis: Wenn ein Programmpunkt abgesagt ist, besser in der neuen Fassung behalten und den Status auf „entfällt“ setzen. Dann sehen Teilnehmende die Absage.', '');
    for (const s of r.removed) L.push(`* ${line(s)}`);
    L.push('');
  }
  if (r.forumChanges.length) {
    L.push('### Foren', '');
    for (const f of r.forumChanges) L.push(`* ${f}`);
    L.push('');
  }
  if (!r.added.length && !r.changed.length && !r.removed.length && !r.forumChanges.length && !r.sponsorsChanged) L.push('Keine inhaltlichen Änderungen.', '');
  return L.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  if (!a || !b) {
    console.error('Aufruf: node tools/diff.mjs <alt.json> <neu.json> [--md ausgabe.md]');
    process.exit(2);
  }
  const r = diffPrograms(JSON.parse(readFileSync(a, 'utf8')), JSON.parse(readFileSync(b, 'utf8')));
  const md = diffMarkdown(r, { old: a, new: b });
  const i = process.argv.indexOf('--md');
  if (i > 0) writeFileSync(process.argv[i + 1], md + '\n');
  console.log(md);
}
