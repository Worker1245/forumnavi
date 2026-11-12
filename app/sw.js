// Service Worker: hält App und Programm für schwaches Messe-WLAN bereit.
// App-Dateien: aus dem Zwischenspeicher, im Hintergrund aktualisiert.
// Programmdaten (*.json): zuerst aus dem Netz (max. 4 Sekunden), sonst aus dem Zwischenspeicher.
// VERSION und DATEIEN setzt tools/build.mjs beim Bauen ein.
const VERSION = '__VERSION__';
const DATEIEN = __DATEIEN__;
const CACHE = `forumnavi-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('forumnavi-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function networkFirst(request) {
  return caches.open(CACHE).then((cache) => new Promise((resolve) => {
    let done = false;
    const fromCache = () => cache.match(request, { ignoreSearch: true }).then((r) => r || fetch(request));
    const timer = setTimeout(() => { if (!done) { done = true; resolve(fromCache()); } }, 4000);
    // no-cache: beim Server nachfragen, ob es eine neue Fassung gibt (kostet bei unveränderten Daten fast nichts)
    fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      if (res.ok) cache.put(request, res.clone());
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fromCache()); } });
  }));
}

function cacheFirst(request) {
  return caches.open(CACHE).then((cache) => cache.match(request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  }));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(url.pathname.endsWith('.json') ? networkFirst(event.request) : cacheFirst(event.request));
});
