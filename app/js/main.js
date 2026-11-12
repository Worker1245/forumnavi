// Forumnavi: Programmansicht, Filter, Merkliste, gespeicherte Filter, Teilen, Kalenderexport.
// Kein Server speichert Nutzerdaten: Merkliste und Filter stehen nur im Link (Teil nach '#').

import { sessionCode } from './codes.js';
import { emptyFilter, filterIsActive, encodeState, decodeState } from './state.js';
import { buildIcs } from './ics.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
const hm = (dt) => dt.slice(11, 16);
const hmToParam = (t) => t.replace(':', '');
const paramToHm = (p) => (p ? `${p.slice(0, 2)}:${p.slice(2)}` : '');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const ICON_STAR = '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>';
const ICON_CAL = '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 12.5v5M9.5 15h5" stroke="currentColor" stroke-width="2"/></svg>';

let D; // Programmdaten
let C; // aufbereitete Daten (Nachschlagetabellen)
let S; // Zustand (aus dem Link)
let searchTimer;
let renderRun = 0;

// ---------- Laden ----------

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function init() {
  const main = $('#inhalt');
  try {
    let id = new URLSearchParams(location.search).get('e');
    // Ist die Veranstaltung im Link genannt, laden Übersicht und Programm gleichzeitig (spart eine Wartezeit im schwachen WLAN)
    const early = id ? fetchJson(`events/${encodeURIComponent(id)}/data.json`).catch(() => null) : null;
    const index = await fetchJson('events/index.json');
    if (!id) {
      if (index.events.length === 1) id = index.events[0].id;
      else return renderEventList(index.events);
    }
    if (!index.events.some((e) => e.id === id)) {
      main.innerHTML = '<p class="hinweis">Diese Veranstaltung gibt es hier nicht. <a href="./">Zur Übersicht</a></p>';
      return;
    }
    D = (early && await early) || await fetchJson(`events/${encodeURIComponent(id)}/data.json`);
  } catch (err) {
    console.error(err);
    main.innerHTML = '<div class="hinweis" role="alert"><p>Das Programm konnte nicht geladen werden. Bitte die Internetverbindung prüfen.</p><p><button type="button" class="knopf" onclick="location.reload()">Erneut versuchen</button></p></div>';
    return;
  }
  prepare();
  S = decodeState(location.hash, D.days);
  renderShell();
  renderAll();
  window.addEventListener('hashchange', () => {
    const next = encodeState(S, D.days);
    if (location.hash.replace(/^#/, '') === next) return;
    S = decodeState(location.hash, D.days);
    renderAll();
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function renderEventList(events) {
  document.title = 'Forumnavi';
  $('#titel').textContent = 'Veranstaltungen';
  $('#inhalt').innerHTML = `<ul class="liste-veranstaltungen">${events.map((e) =>
    `<li><a href="?e=${encodeURIComponent(e.id)}">${esc(e.name)}</a> <span class="leise">${esc(e.city)}, ${esc(formatDateRange(e.startDate, e.endDate))}</span></li>`).join('')}</ul>`;
}

// ---------- Daten aufbereiten ----------

function byId(list) { return new Map(list.map((x) => [x.id, x])); }

function prepare() {
  const days = byId(D.days);
  const rooms = byId(D.rooms);
  const forums = byId(D.forums);
  const organizers = byId(D.organizers);
  const speakers = byId(D.speakers);
  const topics = byId(D.topics);
  const categories = byId(D.categories || []);
  const sponsors = byId(D.sponsors);
  D.days.forEach((d, i) => { d.index = i + 1; });

  for (const sp of D.speakers) {
    sp.label = [sp.academicTitle, sp.name].filter(Boolean).join(' ') + (sp.affiliation ? ` (${sp.affiliation})` : '');
  }
  const activeSlots = D.sponsorSlots.filter((x) => x.active !== false && sponsors.has(x.sponsorId))
    .map((x) => ({ ...x, sponsor: sponsors.get(x.sponsorId) }));
  const forumSponsor = new Map(activeSlots.filter((x) => x.placement === 'forum_presented_by').map((x) => [x.forumId, x]));

  const forumNum = (f) => (f.kind === 'plenum' ? -1 : parseInt(f.number, 10) || 0);
  for (const f of D.forums) {
    f.day = days.get(f.dayId);
    f.room = rooms.get(f.roomId);
    f.organizers = (f.organizerIds || []).map((id) => organizers.get(id)).filter(Boolean);
    f.moderators = (f.moderatorIds || []).map((id) => speakers.get(id)).filter(Boolean);
    f.sponsorSlot = forumSponsor.get(f.id);
    f.sortKey = forumNum(f);
  }

  const byCode = new Map();
  for (const s of D.sessions) {
    s.code = sessionCode(s.id);
    s.forum = forums.get(s.forumId);
    s.day = s.forum.day;
    s.room = rooms.get(s.roomId || s.forum.roomId);
    s.status = s.status || 'geplant';
    s.speakers = (s.speakerIds || []).map((id) => speakers.get(id)).filter(Boolean);
    s.topics = (s.topicIds && s.topicIds.length ? s.topicIds : s.forum.topicIds || []);
    s.category = categories.get(s.categoryId);
    s.search = norm([
      s.title, s.description, s.forum.title, s.forum.number, s.forum.description, s.room?.name,
      ...s.speakers.map((p) => `${p.name} ${p.affiliation || ''}`),
      ...s.forum.organizers.map((o) => o.name),
      ...s.topics.map((t) => topics.get(t)?.label),
      s.category?.label,
    ].filter(Boolean).join(' '));
    byCode.set(s.code, s);
  }
  D.sessions.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.forum.sortKey - b.forum.sortKey || a.id.localeCompare(b.id)));

  // Uhrzeiten für den Filter: halbstündlich vom frühesten Beginn bis zum spätesten Beginn
  const starts = D.sessions.map((s) => hm(s.start)).sort();
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const times = [];
  for (let m = Math.floor(toMin(starts[0]) / 30) * 30; m <= toMin(starts[starts.length - 1]) + 29; m += 30) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }

  const sortedForums = [...D.forums].sort((a, b) => a.day.index - b.day.index || a.sortKey - b.sortKey);
  C = {
    days, rooms, forums, organizers, speakers, topics, categories, byCode, times, sortedForums,
    homeBanner: activeSlots.find((x) => x.placement === 'home_banner'),
    dayBanners: new Map(activeSlots.filter((x) => x.placement === 'day_banner').map((x) => [x.dayId, x])),
    calendarNote: activeSlots.find((x) => x.placement === 'calendar_note'),
  };
}

// ---------- Formatierung ----------

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function formatDateRange(a, b) {
  return a === b ? formatDate(a) : `${formatDate(a).slice(0, 6)} bis ${formatDate(b)}`;
}
function statusText() {
  const st = D.event.programStatus;
  const dt = new Date(st.date);
  const f = new Intl.DateTimeFormat('de-DE', { timeZone: D.event.timezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `Programmstand vom ${f.format(dt)} Uhr`;
}
const forumLabel = (f) => (f.kind === 'plenum' ? f.title : `Forum ${f.number}: ${f.title}`);

// ---------- Grundgerüst ----------

function renderShell() {
  const ev = D.event;
  document.title = `${ev.name} · Programm`;
  $('#titel').textContent = ev.name;
  $('#ort').textContent = `${formatDateRange(ev.startDate, ev.endDate)} · ${ev.location.venue}, ${ev.location.city}`;
  $$('.stand').forEach((el) => { el.textContent = statusText(); });
  $('#demo-hinweis').hidden = !ev.isDemo;
  $('#reiter').hidden = false;
  buildFilterForm();

  $('#reiter').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-seite]');
    if (!a) return;
    e.preventDefault();
    goTo(a.dataset.seite);
  });
  document.addEventListener('click', onClick);
  $('#filter-form').addEventListener('input', onFilterInput);
  $('#filter-form').addEventListener('change', onFilterInput);
  $('#filter-form').addEventListener('submit', (e) => e.preventDefault());
  $('#knopf-gf-speichern').addEventListener('click', onSaveFilter);
  $('#gf-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') onSaveFilter(e); });
  if (window.matchMedia('(min-width: 60rem)').matches) $('#filter-klappe').open = true;
  $$('.rechtliches a').forEach((a) => a.addEventListener('click', () => {
    a.href = `${a.getAttribute('href').split('?')[0]}?e=${encodeURIComponent(ev.id)}${location.hash}`;
  }));
}

function goTo(seite) {
  S.seite = seite;
  writeHash(true);
  renderAll();
  const h = $(`#seite-${seite} h2`);
  if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  window.scrollTo(0, 0);
}

function writeHash(push = false) {
  const hash = encodeState(S, D.days);
  const url = `${location.pathname}${location.search}${hash ? '#' + hash : ''}`;
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
  if (S.seite === 'teilen') renderShare();
}

function renderAll() {
  for (const p of ['programm', 'merkliste', 'filter', 'teilen']) {
    $(`#seite-${p}`).hidden = S.seite !== p;
    const tab = $(`#reiter a[data-seite="${p}"]`);
    if (S.seite === p) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  }
  syncFilterForm();
  updateBadges();
  if (S.seite === 'programm') renderProgram();
  if (S.seite === 'merkliste') renderFavorites();
  if (S.seite === 'filter') renderSavedFilters();
  if (S.seite === 'teilen') renderShare();
}

function updateBadges() {
  $('#zahl-merkliste').textContent = S.fav.size;
  $('#zahl-filter').textContent = S.gf.length;
}

function announce(msg) {
  const el = $('#ansage');
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 50);
}

// ---------- Sponsorflächen ----------

function sponsorHtml(slot, variant) {
  if (!slot) return '';
  const sp = slot.sponsor;
  const logo = sp.logo ? `<img src="events/${esc(D.event.id)}/${esc(sp.logo)}" alt="${esc(sp.name)}" width="160" height="40" loading="lazy" decoding="async">` : '';
  const inner = variant === 'forum'
    ? `<span class="anzeige-label">Anzeige</span> <span>präsentiert von</span> ${logo || `<strong>${esc(sp.name)}</strong>`}`
    : `<span class="anzeige-label">Anzeige</span>${logo}${slot.text ? `<span class="anzeige-text">${esc(slot.text)}</span>` : ''}`;
  const tag = sp.url ? 'a' : 'div';
  const attrs = sp.url ? ` href="${esc(sp.url)}" rel="sponsored noopener noreferrer" target="_blank"` : '';
  const hint = sp.url ? '<span class="sr-only"> (öffnet neue Seite)</span>' : '';
  return `<${tag} class="anzeige anzeige-${variant}"${attrs}>${inner}${hint}</${tag}>`;
}

// ---------- Filter ----------

function checkboxList(name, items, cls = '') {
  return items.map((it) => `<label class="wahl ${cls}"><input type="checkbox" name="${name}" value="${esc(it.value)}"><span${it.color ? ` style="--farbe:${esc(it.color)}"` : ''}>${it.color ? '<i class="punkt" aria-hidden="true"></i>' : ''}${esc(it.label)}</span></label>`).join('');
}

function buildFilterForm() {
  const timeOpts = (label) => `<option value="">${label}</option>` + C.times.map((t) => `<option value="${hmToParam(t)}">${t} Uhr</option>`).join('');
  const forumItems = C.sortedForums.map((f) => ({ value: f.number, label: `${f.kind === 'plenum' ? f.number : f.number}: ${f.title}` }));
  const orgItems = [...D.organizers].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((o) => ({ value: o.id, label: o.name }));
  const topicItems = [...D.topics].sort((a, b) => a.label.localeCompare(b.label, 'de')).map((t) => ({ value: t.id, label: t.label }));
  $('#filter-felder').innerHTML = `
    <div class="feld">
      <label for="f-q">Suche</label>
      <input id="f-q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Titel, Person, Firma, Raum">
    </div>
    <fieldset class="feld">
      <legend>Tag</legend>
      <div class="chips">${checkboxList('tag', D.days.map((d) => ({ value: d.id, label: d.label })), 'chip')}</div>
    </fieldset>
    <fieldset class="feld zeit">
      <legend>Uhrzeit (Beginn)</legend>
      <label for="f-ab">frühestens</label><select id="f-ab" name="ab">${timeOpts('beliebig')}</select>
      <label for="f-bis">spätestens</label><select id="f-bis" name="bis">${timeOpts('beliebig')}</select>
    </fieldset>
    ${D.categories && D.categories.length ? `<fieldset class="feld">
      <legend>Schwerpunkt</legend>
      <div class="chips">${checkboxList('sp', D.categories.map((c) => ({ value: c.id, label: c.label, color: c.color })), 'chip')}</div>
    </fieldset>` : ''}
    <fieldset class="feld">
      <legend>Thema</legend>
      <div class="chips">${checkboxList('thema', topicItems, 'chip')}</div>
    </fieldset>
    <details class="feld klappe">
      <summary>Forum <span class="zaehler" data-zaehler="forum"></span></summary>
      <div class="auswahl-liste">${checkboxList('forum', forumItems)}</div>
    </details>
    <details class="feld klappe">
      <summary>Forenveranstalter <span class="zaehler" data-zaehler="fv"></span></summary>
      <div class="auswahl-liste">${checkboxList('fv', orgItems)}</div>
    </details>`;
}

function syncFilterForm() {
  const f = S.filter;
  const form = $('#filter-form');
  $('#f-q').value = f.q;
  $('#f-ab').value = f.ab;
  $('#f-bis').value = f.bis;
  const set = (name, values) => $$(`input[name="${name}"]`, form).forEach((cb) => { cb.checked = values.includes(cb.value); });
  set('tag', f.tage); set('thema', f.themen); set('sp', f.sp); set('forum', f.foren); set('fv', f.fv);
  $$('[data-zaehler]').forEach((el) => {
    const n = el.dataset.zaehler === 'forum' ? f.foren.length : f.fv.length;
    el.textContent = n ? `(${n} gewählt)` : '';
  });
  const active = filterIsActive(f);
  $('#filter-aktiv').textContent = active ? `(${countActive(f)} aktiv)` : '';
  $('#gf-form').hidden = !active;
  $('#knopf-zuruecksetzen').hidden = !active;
}

function countActive(f) {
  return [f.tage.length, f.ab || f.bis, f.foren.length, f.fv.length, f.themen.length, f.sp.length, f.q.trim()].filter(Boolean).length;
}

function readFilterForm() {
  const form = $('#filter-form');
  const vals = (name) => $$(`input[name="${name}"]:checked`, form).map((cb) => cb.value);
  return { tage: vals('tag'), ab: $('#f-ab').value, bis: $('#f-bis').value, foren: vals('forum'), fv: vals('fv'), themen: vals('thema'), sp: vals('sp'), q: $('#f-q').value };
}

function onFilterInput(e) {
  if (e.target.closest('#gf-form')) return;
  if (e.type === 'change' && e.target.id === 'f-q') return; // Suche läuft über 'input'
  S.filter = readFilterForm();
  const run = () => { writeHash(); syncFilterForm(); renderProgram(true); };
  clearTimeout(searchTimer);
  if (e.target.id === 'f-q') searchTimer = setTimeout(run, 250); else run();
}

function matches(s, f, words) {
  if (f.tage.length && !f.tage.includes(s.day.id)) return false;
  const t = hmToParam(hm(s.start));
  if (f.ab && t < f.ab) return false;
  if (f.bis && t > f.bis) return false;
  if (f.foren.length && !f.foren.includes(s.forum.number)) return false;
  if (f.fv.length && !s.forum.organizerIds.some((o) => f.fv.includes(o))) return false;
  if (f.themen.length && !s.topics.some((x) => f.themen.includes(x))) return false;
  if (f.sp.length && !f.sp.includes(s.categoryId)) return false;
  return words.every((w) => s.search.includes(w));
}

function filtered(f = S.filter) {
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  return D.sessions.filter((s) => matches(s, f, words));
}

function describeFilter(f) {
  const parts = [];
  if (f.q.trim()) parts.push(`Suche „${f.q.trim()}“`);
  if (f.tage.length) parts.push(f.tage.map((id) => C.days.get(id)?.label).filter(Boolean).join(', '));
  if (f.ab || f.bis) parts.push(`Beginn ${f.ab ? 'ab ' + paramToHm(f.ab) : ''}${f.ab && f.bis ? ' ' : ''}${f.bis ? 'bis ' + paramToHm(f.bis) : ''} Uhr`);
  if (f.sp.length) parts.push(`Schwerpunkt: ${f.sp.map((id) => C.categories.get(id)?.label).filter(Boolean).join(', ')}`);
  if (f.themen.length) parts.push(`Thema: ${f.themen.map((id) => C.topics.get(id)?.label).filter(Boolean).join(', ')}`);
  if (f.foren.length) parts.push(`Forum ${f.foren.join(', ')}`);
  if (f.fv.length) parts.push(`Veranstalter: ${f.fv.map((id) => C.organizers.get(id)?.name).filter(Boolean).join(', ')}`);
  return parts.join(' · ') || 'kein Filter';
}

// ---------- Programmpunkte darstellen ----------

function sessionHtml(s, opts = {}) {
  const fav = S.fav.has(s.code);
  const cancelled = s.status === 'entfällt';
  const statusBadge = s.status !== 'geplant'
    ? `<p class="status status-${cancelled ? 'entfaellt' : 'geaendert'}"><strong>${cancelled ? 'Entfällt' : 'Geändert'}</strong>${s.statusNote ? `: ${esc(s.statusNote)}` : ''}</p>` : '';
  const f = s.forum;
  const details = [
    s.description ? `<p>${esc(s.description)}</p>` : '',
    f.description && !opts.inForum ? `<p class="leise">${esc(f.description)}</p>` : '',
    f.organizers.length ? `<p><span class="leise">Forenveranstalter:</span> ${esc(f.organizers.map((o) => o.name).join(', '))}</p>` : '',
    f.moderators.length ? `<p><span class="leise">Moderation:</span> ${esc(f.moderators.map((m) => m.label).join(', '))}</p>` : '',
    !opts.inForum && f.sponsorSlot ? sponsorHtml(f.sponsorSlot, 'forum') : '',
  ].join('');
  const cat = s.category ? `<p class="pp-kategorie"><i class="punkt" aria-hidden="true"></i>Schwerpunkt: ${esc(s.category.label)}</p>` : '';
  return `<li class="pp${cancelled ? ' pp-entfaellt' : ''}${s.category ? ' pp-mit-kategorie' : ''}" id="pp-${s.code}"${s.category ? ` style="--farbe:${esc(s.category.color)}"` : ''}>
    <div class="pp-zeit"><time datetime="${s.start}">${hm(s.start)}</time>–<time datetime="${s.end}">${hm(s.end)}</time></div>
    <div class="pp-inhalt">
      ${opts.inForum ? '' : `<p class="pp-forum">${esc(forumLabel(f))}</p>`}
      <h${opts.level || 4} class="pp-titel">${esc(s.title)}</h${opts.level || 4}>
      ${cat}
      ${statusBadge}
      ${opts.conflict ? `<p class="konflikt">Überschneidet sich mit: ${esc(opts.conflict)}</p>` : ''}
      <p class="pp-ort">${opts.showDay ? esc(s.day.label) + ' · ' : ''}${esc(s.room?.name || 'Raum folgt')}${s.type && s.type !== 'Vortrag' ? ` · ${esc(s.type)}` : ''}</p>
      ${s.speakers.length ? `<p class="pp-ref">${esc(s.speakers.map((p) => p.label).join(', '))}</p>` : ''}
      ${details ? `<details class="pp-mehr"><summary>Details<span class="sr-only"> zu ${esc(s.title)}</span></summary>${details}</details>` : ''}
    </div>
    <div class="pp-aktionen">
      <button type="button" class="knopf-icon merken" data-merken="${s.code}" aria-pressed="${fav}" aria-label="Merken: ${esc(s.title)}">${ICON_STAR}</button>
      <button type="button" class="knopf-icon" data-ics="${s.code}" aria-label="In den Kalender: ${esc(s.title)}"${cancelled ? ' disabled' : ''}>${ICON_CAL}</button>
    </div>
  </li>`;
}

function groupBy(list, keyFn) {
  const m = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

// Liefert HTML-Stücke mit Anzahl Programmpunkten (zum schrittweisen Anzeigen)
function renderList(sessions, view) {
  const pieces = [];
  for (const [dayId, daySessions] of groupBy(sessions, (s) => s.day.id)) {
    const day = C.days.get(dayId);
    pieces.push({ n: 0, html: `<h2 class="tag-titel" id="tag-${esc(dayId)}">${esc(day.label)}</h2>${sponsorHtml(C.dayBanners.get(dayId), 'banner')}` });
    if (view === 'forum') {
      const forumsOfDay = groupBy(daySessions, (s) => s.forum.id);
      const ordered = [...forumsOfDay.keys()].map((id) => C.forums.get(id))
        .sort((a, b) => forumsOfDay.get(a.id)[0].start.localeCompare(forumsOfDay.get(b.id)[0].start) || a.sortKey - b.sortKey);
      for (const f of ordered) {
        const list = forumsOfDay.get(f.id);
        const all = D.sessions.filter((s) => s.forumId === f.id);
        pieces.push({ n: list.length, html: `<section class="forum" aria-label="${esc(forumLabel(f))}"><h3 class="forum-titel">${esc(forumLabel(f))}</h3>
          <p class="forum-meta">${hm(all[0].start)}–${hm(all[all.length - 1].end)} Uhr · ${esc(f.room?.name || 'Raum folgt')}${f.organizers.length ? ` · ${esc(f.organizers.map((o) => o.name).join(', '))}` : ''}</p>
          ${sponsorHtml(f.sponsorSlot, 'forum')}
          <ul class="pp-liste">${list.map((s) => sessionHtml(s, { inForum: true })).join('')}</ul></section>` });
      }
    } else {
      for (const [time, list] of groupBy(daySessions, (s) => hm(s.start))) {
        pieces.push({ n: list.length, html: `<section class="zeit-block" aria-label="${esc(day.label)}, ${time} Uhr"><h3 class="zeit-titel">${time} Uhr <span class="leise">(${list.length})</span></h3><ul class="pp-liste">${list.map((s) => sessionHtml(s)).join('')}</ul></section>` });
      }
    }
  }
  // Zu Paketen bündeln: erstes Paket klein (schnell sichtbar), weitere größer
  const batches = [];
  let cur = '', count = 0;
  for (const p of pieces) {
    cur += p.html; count += p.n;
    if (count >= (batches.length ? 80 : 40)) { batches.push(cur); cur = ''; count = 0; }
  }
  if (cur) batches.push(cur);
  return batches;
}

function renderProgram(fromFilter = false) {
  const list = filtered();
  const active = filterIsActive(S.filter);
  $('#banner-start').innerHTML = sponsorHtml(C.homeBanner, 'banner');
  $('#ergebnis').textContent = active
    ? `${plural(list.length, 'Programmpunkt', 'Programmpunkte')} gefunden (von ${D.sessions.length})`
    : `${D.sessions.length} Programmpunkte`;
  $('#knopf-ics-filter').textContent = active ? `Treffer in Kalender (${list.length})` : 'Alles in Kalender';
  $('#knopf-ics-filter').disabled = list.filter((s) => s.status !== 'entfällt').length === 0;
  $$('#ansicht-wahl button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ansicht === S.ansicht)));
  const target = $('#programm-liste');
  const chunks = renderList(list, S.ansicht);
  const run = ++renderRun;
  target.innerHTML = chunks.length
    ? chunks[0]
    : '<p class="hinweis">Keine Programmpunkte für diesen Filter. <button type="button" class="link" data-aktion="zuruecksetzen">Filter zurücksetzen</button></p>';
  // Erster Tag sofort, weitere Tage direkt danach: Die Seite reagiert schneller auf langsamen Handys
  chunks.slice(1).forEach((html, i) => setTimeout(() => {
    if (run === renderRun) target.insertAdjacentHTML('beforeend', html);
  }, 30 * (i + 1)));
  if (fromFilter) announce($('#ergebnis').textContent);
}

// ---------- Merkliste ----------

function renderFavorites() {
  const favs = D.sessions.filter((s) => S.fav.has(s.code));
  const unknown = [...S.fav].filter((c) => !C.byCode.has(c));
  const active = favs.filter((s) => s.status !== 'entfällt');
  const conflicts = new Map();
  for (const a of active) {
    const other = active.filter((b) => b !== a && a.start < b.end && b.start < a.end);
    if (other.length) conflicts.set(a.code, other.map((b) => b.title).join('; '));
  }
  $('#merkliste-info').innerHTML = favs.length
    ? `${plural(favs.length, 'Programmpunkt', 'Programmpunkte')} gemerkt.`
    : 'Noch nichts gemerkt. Tippe im Programm auf den Stern, um einen Programmpunkt zu merken.';
  $('#knopf-ics-merkliste').disabled = active.length === 0;
  $('#knopf-teilen-merkliste').disabled = favs.length === 0;
  $('#merkliste-unbekannt').innerHTML = unknown.length
    ? `<p class="hinweis">${plural(unknown.length, 'gemerkter Programmpunkt ist', 'gemerkte Programmpunkte sind')} nicht mehr im Programm. <button type="button" class="link" data-aktion="unbekannte-entfernen">Aus der Merkliste entfernen</button></p>` : '';
  let html = '';
  for (const [dayId, list] of groupBy(favs, (s) => s.day.id)) {
    html += `<section class="tag"><h3 class="tag-titel">${esc(C.days.get(dayId).label)}</h3><ul class="pp-liste">${list.map((s) => sessionHtml(s, { conflict: conflicts.get(s.code) })).join('')}</ul></section>`;
  }
  $('#merkliste-liste').innerHTML = html;
}

function toggleFav(code, btn) {
  const s = C.byCode.get(code);
  if (S.fav.has(code)) S.fav.delete(code); else S.fav.add(code);
  const on = S.fav.has(code);
  writeHash();
  updateBadges();
  $$(`[data-merken="${code}"]`).forEach((b) => b.setAttribute('aria-pressed', String(on)));
  announce(on ? `Gemerkt: ${s?.title}. ${S.fav.size} in der Merkliste.` : `Aus Merkliste entfernt: ${s?.title || ''}`);
  if (S.seite === 'merkliste' && !on) {
    renderFavorites();
    $('#seite-merkliste h2').focus();
  }
}

// ---------- Gespeicherte Filter ----------

function onSaveFilter(e) {
  e.preventDefault();
  const input = $('#gf-name');
  const name = input.value.trim() || `Filter ${S.gf.length + 1}`;
  S.gf.push({ name, filter: JSON.parse(JSON.stringify(S.filter)) });
  input.value = '';
  writeHash();
  updateBadges();
  announce(`Filter „${name}“ gespeichert. Er steht im Link unter „Meine Filter“.`);
  $('#gf-meldung').textContent = `Gespeichert unter „Meine Filter“: ${name}`;
}

function renderSavedFilters() {
  $('#gf-liste').innerHTML = S.gf.length
    ? S.gf.map((g, i) => `<li class="gf">
        <div><h3 class="gf-name">${esc(g.name)}</h3><p class="leise">${esc(describeFilter(g.filter))} · ${plural(filtered(g.filter).length, 'Treffer', 'Treffer')}</p></div>
        <div class="gf-aktionen">
          <button type="button" class="knopf" data-gf-anwenden="${i}">Anwenden<span class="sr-only">: ${esc(g.name)}</span></button>
          <button type="button" class="knopf knopf-leise" data-gf-loeschen="${i}">Löschen<span class="sr-only">: ${esc(g.name)}</span></button>
        </div></li>`).join('')
    : '<li class="hinweis">Noch keine Filter gespeichert. Stelle im Programm einen Filter ein und speichere ihn unter einem Namen, z. B. „Netze am Dienstag“.</li>';
}

// ---------- Teilen und QR-Code ----------

async function renderShare() {
  const url = location.href;
  $('#teilen-link').value = url;
  const len = url.length;
  let qrHtml;
  try {
    const { default: qrcode } = await import('../vendor/qrcode.mjs');
    if (location.href !== url) return; // inzwischen geändert, neuer Aufruf folgt
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const modules = qr.getModuleCount();
    const version = (modules - 17) / 4;
    qrHtml = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: 'QR-Code mit dem Link zu dieser Ansicht', title: 'QR-Code' });
    $('#qr-info').textContent = `Link: ${len} Zeichen · QR-Code Version ${version} (${modules} × ${modules} Punkte)` +
      (version > 15 ? '. Sehr dichter Code: Bildschirm hell stellen und Kamera ruhig halten. Alternativ den Link per Messenger schicken.' : '');
  } catch {
    qrHtml = '<p class="hinweis">Der Link ist zu lang für einen QR-Code. Bitte per „Link kopieren“ oder „Teilen“ übertragen.</p>';
    $('#qr-info').textContent = `Link: ${len} Zeichen`;
  }
  $('#qr').innerHTML = qrHtml;
  $('#teilen-inhalt').textContent = `Dieser Link enthält: ${plural(S.fav.size, 'gemerkten Programmpunkt', 'gemerkte Programmpunkte')}, ${plural(S.gf.length, 'gespeicherten Filter', 'gespeicherte Filter')}${filterIsActive(S.filter) ? ', den aktuellen Filter' : ''}.`;
  $('#knopf-teilen-system').hidden = !navigator.share;
}

async function copyLink() {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const field = $('#teilen-link');
    field.select();
    document.execCommand('copy');
  }
  $('#teilen-meldung').textContent = 'Link kopiert.';
  announce('Link kopiert');
}

// ---------- Kalender ----------

function downloadIcs(sessions, filenamePart, calName) {
  const list = sessions.filter((s) => sessions.length === 1 || s.status !== 'entfällt');
  if (!list.length) return;
  const ics = buildIcs(list, {
    event: D.event,
    name: calName,
    statusText: statusText(),
    calendarNote: C.calendarNote ? (C.calendarNote.text || C.calendarNote.sponsor.name) : '',
    appUrl: `${location.origin}${location.pathname}?e=${encodeURIComponent(D.event.id)}`,
  });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${D.event.id}-${filenamePart}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  announce(`Kalenderdatei mit ${plural(list.length, 'Termin', 'Terminen')} erstellt.`);
}

// ---------- Klicks ----------

function onClick(e) {
  const t = e.target.closest('button, a');
  if (!t) return;
  const d = t.dataset;
  if (d.merken) return toggleFav(d.merken, t);
  if (d.ics) {
    const s = C.byCode.get(d.ics);
    return downloadIcs([s], s.id, `${D.event.shortName || D.event.name}: ${s.title}`);
  }
  if (d.ansicht) { S.ansicht = d.ansicht; writeHash(); return renderProgram(); }
  if (d.gfAnwenden !== undefined) {
    S.filter = JSON.parse(JSON.stringify(S.gf[Number(d.gfAnwenden)].filter));
    return goTo('programm');
  }
  if (d.gfLoeschen !== undefined) {
    const [g] = S.gf.splice(Number(d.gfLoeschen), 1);
    writeHash(); updateBadges(); renderSavedFilters();
    announce(`Filter „${g.name}“ gelöscht`);
    return $('#seite-filter h2').focus();
  }
  switch (t.id || d.aktion) {
    case 'knopf-zuruecksetzen':
    case 'zuruecksetzen':
      S.filter = emptyFilter(); writeHash(); syncFilterForm(); renderProgram(true);
      return $('#f-q').focus();
    case 'unbekannte-entfernen':
      [...S.fav].filter((c) => !C.byCode.has(c)).forEach((c) => S.fav.delete(c));
      writeHash(); updateBadges(); return renderFavorites();
    case 'knopf-ics-filter': {
      const active = filterIsActive(S.filter);
      return downloadIcs(filtered(), active ? 'auswahl' : 'gesamtprogramm', `${D.event.shortName || D.event.name}${active ? ' (Auswahl)' : ''}`);
    }
    case 'knopf-ics-merkliste':
      return downloadIcs(D.sessions.filter((s) => S.fav.has(s.code)), 'merkliste', `${D.event.shortName || D.event.name}: Merkliste`);
    case 'knopf-teilen-merkliste':
      return goTo('teilen');
    case 'knopf-kopieren':
      return copyLink();
    case 'knopf-teilen-system':
      return navigator.share({ title: D.event.name, text: 'Mein Programm', url: location.href }).catch(() => {});
    default:
  }
}

init();
