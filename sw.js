/* Time Calc service worker: keeps the app and its pixel fonts on the phone so it works offline. */
const CACHE = 'timecalc-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    try {
      const res = await fetch(FONT_CSS, { mode: 'cors' });
      if (res.ok) {
        const css = await res.clone().text();
        await cache.put(FONT_CSS, res);
        const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
        await Promise.all(urls.map(async u => {
          try { const f = await fetch(u, { mode: 'cors' }); if (f.ok) await cache.put(u, f); } catch (e) {}
        }));
      }
    } catch (e) { /* offline during install: fonts get cached on a later visit */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: !isFont });
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
