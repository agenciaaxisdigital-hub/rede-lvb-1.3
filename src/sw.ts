// src/sw.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// ── Precache (manifest injetado pelo VitePWA) ──────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Runtime caching ────────────────────────────────────────────

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    !url.pathname.startsWith('/auth/') &&
    !url.pathname.startsWith('/storage/'),
  new StaleWhileRevalidate({
    cacheName: 'supabase-api-data',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// ── Push Notifications ─────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

self.addEventListener('push', (event) => {
  const fetchAndShow = async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/avisos_app?ativa=eq.true&order=criado_em.desc&limit=1`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const avisos = await res.json();
      const aviso = avisos?.[0];

      await self.registration.showNotification(
        aviso?.titulo || 'Nova notificação',
        {
          body: aviso?.corpo || '',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { aviso_id: aviso?.id, url: '/' },
          vibrate: [200, 100, 200],
          requireInteraction: false,
          tag: aviso?.id || 'rede-notif',
        }
      );
    } catch {
      await self.registration.showNotification('Nova notificação', {
        body: 'Abra o app para ver o aviso.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      });
    }
  };

  event.waitUntil(fetchAndShow());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as any)?.url || '/';
  event.waitUntil(
    (self as any).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients: any[]) => {
        const existing = windowClients.find((c) => c.url.includes(targetUrl));
        if (existing) return existing.focus();
        return (self as any).clients.openWindow(targetUrl);
      })
  );
});
