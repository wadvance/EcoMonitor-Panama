const CACHE = 'ecomonitor-v1';
const ASSETS = [
  '.',
  'index.html',
  'manifest.json',
  'icons/icon-192.svg',
  'icons/icon-512.svg'
];

const CDN_CACHE = 'ecomonitor-cdn-v1';
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/index.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  if (url.includes('api.open-meteo.com')) {
    e.respondWith(networkFirst(e.request, CDN_CACHE));
    return;
  }

  if (CDN_URLS.some(cdn => url.startsWith(cdn))) {
    e.respondWith(cacheFirst(e.request, CDN_CACHE));
    return;
  }

  if (url.startsWith(self.location.origin)) {
    e.respondWith(networkFirst(e.request, CACHE));
    return;
  }

  if (url.includes('opensky-network.org') || url.includes('api.open-meteo.com')) {
    e.respondWith(networkFirst(e.request, CDN_CACHE));
    return;
  }

  e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.destination === 'document') {
      const fallback = await caches.match('.');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}
