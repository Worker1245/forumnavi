// Zustand der App <-> Link-Teil nach '#'.
// Der Teil nach '#' wird vom Browser nie an den Server geschickt.
//
// Schlüssel im Link:
//   seite   merkliste | filter | teilen      (fehlt = Programm)
//   ansicht forum                            (fehlt = nach Uhrzeit)
//   tag     Tagnummern, z. B. 1.3
//   ab, bis Uhrzeit HHMM (Beginn frühestens / spätestens)
//   forum   Forennummern, z. B. 3.12.P1
//   fv      Forenveranstalter-ids
//   thema   Themen-ids
//   sp      Schwerpunkt-ids (Kategorien)
//   q       Suchtext
//   m       Merkliste: 5-stellige Codes ohne Trennzeichen
//   gf      gespeicherte Filter: Felder mit '~', Filter mit '*' getrennt

import { CODE_LEN } from './codes.js';

export const PAGES = ['programm', 'merkliste', 'filter', 'teilen'];

export const emptyFilter = () => ({ tage: [], ab: '', bis: '', foren: [], fv: [], themen: [], sp: [], q: '' });

export function filterIsActive(f) {
  return Boolean(f.tage.length || f.ab || f.bis || f.foren.length || f.fv.length || f.themen.length || f.sp.length || f.q.trim());
}

// Wie encodeURIComponent, aber auch . ~ * ! ' ( ) werden kodiert,
// weil diese Zeichen als Trennzeichen dienen.
export function enc(s) {
  return encodeURIComponent(s).replace(/[!'()*.~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
function dec(s) {
  try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch { return ''; }
}

const splitList = (s) => (s ? String(s).split('.').filter(Boolean) : []);
const onlyIds = (arr) => arr.filter((x) => /^[A-Za-z0-9-]{1,64}$/.test(x));
const hhmm = (s) => (/^([01]\d|2[0-3])[0-5]\d$/.test(s || '') ? s : '');

// days: Liste der Tage aus den Daten (für Tagnummer <-> id)
function daysToParam(ids, days) {
  return ids.map((id) => days.findIndex((d) => d.id === id) + 1).filter((n) => n > 0).sort((a, b) => a - b).join('.');
}
function paramToDays(s, days) {
  return splitList(s).map((n) => days[Number(n) - 1]?.id).filter(Boolean);
}

function filterFields(f, days) {
  return [daysToParam(f.tage, days), f.ab, f.bis, f.foren.join('.'), f.fv.join('.'), f.themen.join('.'), enc(f.q.trim()), f.sp.join('.')];
}

export function encodeSavedFilter(sf, days) {
  return [enc(sf.name), ...filterFields(sf.filter, days)].join('~').replace(/~+$/, '');
}

export function decodeSavedFilter(str, days) {
  const [name, tag, ab, bis, foren, fv, themen, q, sp] = String(str).split('~');
  return {
    name: dec(name || '') || 'Filter',
    filter: {
      tage: paramToDays(tag, days),
      ab: hhmm(ab), bis: hhmm(bis),
      foren: onlyIds(splitList(foren)),
      fv: onlyIds(splitList(fv)),
      themen: onlyIds(splitList(themen)),
      sp: onlyIds(splitList(sp)),
      q: dec(q || ''),
    },
  };
}

export function encodeState(st, days) {
  const p = [];
  if (st.seite !== 'programm') p.push(['seite', st.seite]);
  if (st.ansicht === 'forum') p.push(['ansicht', 'forum']);
  const [tag, ab, bis, forum, fv, thema, q, sp] = filterFields(st.filter, days);
  if (tag) p.push(['tag', tag]);
  if (ab) p.push(['ab', ab]);
  if (bis) p.push(['bis', bis]);
  if (forum) p.push(['forum', forum]);
  if (fv) p.push(['fv', fv]);
  if (thema) p.push(['thema', thema]);
  if (sp) p.push(['sp', sp]);
  if (q) p.push(['q', q]);
  if (st.fav.size) p.push(['m', [...st.fav].sort().join('')]);
  if (st.gf.length) p.push(['gf', st.gf.map((x) => encodeSavedFilter(x, days)).join('*')]);
  return p.map(([k, v]) => `${k}=${v}`).join('&');
}

export function decodeState(hash, days) {
  const params = {};
  for (const part of String(hash || '').replace(/^#/, '').split('&')) {
    const i = part.indexOf('=');
    if (i > 0) params[part.slice(0, i)] = part.slice(i + 1);
  }
  const fav = new Set();
  const m = (params.m || '').toLowerCase().replace(/[^0-9a-z]/g, '');
  for (let i = 0; i + CODE_LEN <= m.length; i += CODE_LEN) fav.add(m.slice(i, i + CODE_LEN));
  return {
    seite: PAGES.includes(params.seite) ? params.seite : 'programm',
    ansicht: params.ansicht === 'forum' ? 'forum' : 'zeit',
    filter: {
      tage: paramToDays(params.tag, days),
      ab: hhmm(params.ab), bis: hhmm(params.bis),
      foren: onlyIds(splitList(params.forum)),
      fv: onlyIds(splitList(params.fv)),
      themen: onlyIds(splitList(params.thema)),
      sp: onlyIds(splitList(params.sp)),
      q: dec(params.q || ''),
    },
    fav,
    gf: params.gf ? params.gf.split('*').filter(Boolean).map((x) => decodeSavedFilter(x, days)) : [],
  };
}
