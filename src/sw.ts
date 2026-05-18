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
  const show = async () => {
    let titulo = 'Nova notificação';
    let corpo = 'Abra o app para ver o aviso.';
    let avisoid: string | null = null;

    if (event.data) {
      try {
        const payload = event.data.json();
        titulo = payload.titulo || titulo;
        corpo = payload.corpo || corpo;
        avisoid = payload.aviso_id || null;

        // Payload só tem aviso_id → busca o aviso específico (não o mais recente)
        if (avisoid && (!payload.titulo || !payload.corpo)) {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/avisos_app?id=eq.${avisoid}&select=titulo,corpo&limit=1`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
          );
          const [aviso] = await res.json();
          if (aviso) { titulo = aviso.titulo || titulo; corpo = aviso.corpo || corpo; }
        }
      } catch {
        // usa defaults
      }
    }

    // Tag por aviso_id evita substituição silenciosa de notificações diferentes.
    // Sem aviso_id usa timestamp para garantir que cada push apareça como novo.
    const tag = avisoid ? `aviso-${avisoid}` : `rede-notif-${Date.now()}`;

    await self.registration.showNotification(titulo, {
      body: corpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { aviso_id: avisoid, url: '/' },
      vibrate: [200, 100, 200],
      requireInteraction: false,
      tag,
      silent: false,
    });
  };

  event.waitUntil(show());
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
