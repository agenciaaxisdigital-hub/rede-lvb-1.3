const CACHE_NAME = 'rede-sarelli-v1';
const OFFLINE_URLS = ['/', '/index.html'];

// Install: cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension')) return;
  // Never cache OAuth routes
  if (event.request.url.includes('/~oauth')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});

// Background sync for location
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-location') {
    event.waitUntil(captureAndSendLocation());
  }
});

// Periodic background sync (if browser supports)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(captureAndSendLocation());
  }
});

async function captureAndSendLocation() {
  // Try getting location from cache or IP
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        // Queue for when online
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_LOCATION',
            latitude: data.latitude,
            longitude: data.longitude,
            fonte: 'ip_background',
          });
        });
      }
    }
  } catch {}
}
