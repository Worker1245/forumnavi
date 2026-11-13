// Speicher nur auf diesem Gerät (localStorage des Browsers). Nichts davon wird an einen Server geschickt.
// Gespeichert werden: Merkliste und gespeicherte Filter je Veranstaltung sowie die Liste
// der auf diesem Gerät geöffneten Veranstaltungen.
// Funktioniert der Speicher nicht (z. B. privater Modus), arbeitet die App ohne ihn weiter.

const PREFIX = 'forumnavi:v1:';

function read(key) {
  try { return JSON.parse(localStorage.getItem(PREFIX + key) || 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* nichts zu tun */ }
}

// Merkliste (Kurzcodes) und gespeicherte Filter (bereits kodiert) einer Veranstaltung
export function loadEventState(eventId) {
  const v = read(`event:${eventId}`);
  if (!v || !Array.isArray(v.fav) || !Array.isArray(v.gf)) return null;
  return v;
}

export function saveEventState(eventId, fav, gf) {
  if (!fav.length && !gf.length) return write(`event:${eventId}`, { fav: [], gf: [], t: Date.now() });
  return write(`event:${eventId}`, { fav, gf, t: Date.now() });
}

export function myEvents() {
  const list = read('events');
  return Array.isArray(list) ? list.sort((a, b) => (b.t || 0) - (a.t || 0)) : [];
}

export function rememberEvent(meta) {
  const list = myEvents().filter((e) => e.id !== meta.id);
  list.unshift({ id: meta.id, name: meta.name, city: meta.city, startDate: meta.startDate, endDate: meta.endDate, t: Date.now() });
  write('events', list.slice(0, 30));
}

export function forgetEvent(eventId) {
  remove(`event:${eventId}`);
  write('events', myEvents().filter((e) => e.id !== eventId));
}
