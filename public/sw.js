const CACHE_NAME = 'rede-sarelli-v4';
const OFFLINE_URLS = ['/'];

// Install — cache mínimo para instalação instantânea
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Activate: limpar caches antigos e tomar controle imediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first, fallback to cache (só GET, sem extensões/oauth/apis)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.startsWith('chrome-extension')) return;
  if (url.includes('/~oauth')) return;
  if (url.includes('nominatim')) return;
  if (url.includes('supabase.co')) return;
  if (url.includes('ipapi.co') || url.includes('ipwho.is') || url.includes('ip-api.com')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});

// ── Background Sync ─────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-location') {
    event.waitUntil(captureAndBroadcast());
  }
});

// ── Periodic Background Sync (Android Chrome) ───────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(captureAndBroadcast());
  }
});

// ── Push event (keeps SW alive) ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  event.waitUntil(captureAndBroadcast());
});

// IP-based location capture from Service Worker
const IP_PROVIDERS = [
  { url: 'https://ipapi.co/json/', extract: (d) => ({ lat: d?.latitude, lng: d?.longitude }) },
  { url: 'https://ipwho.is/', extract: (d) => ({ lat: d?.latitude, lng: d?.longitude }) },
  { url: 'https://ip-api.com/json/?fields=lat,lon', extract: (d) => ({ lat: d?.lat, lng: d?.lon }) },
];

async function captureAndBroadcast() {
  for (const p of IP_PROVIDERS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(p.url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const c = p.extract(data);
      if (isFinite(c.lat) && isFinite(c.lng)) {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_LOCATION',
            latitude: c.lat,
            longitude: c.lng,
            fonte: 'sw_bg',
          });
        });
        return;
      }
    } catch {
      continue;
    }
  }
}
