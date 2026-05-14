# Sistema de Notificações Push PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema completo de Web Push para PWA — admin dispara notificações nativas no celular (som + barra do sistema, app fechado), com popup persistente, rastreamento quem viu/não viu, renotificação automática por intervalo configurável, e painel de inadimplência diária por tipo de usuário.

**Architecture:** VitePWA `injectManifest` strategy com `src/sw.ts` customizado que intercepta push events e busca conteúdo do aviso via Supabase REST. Edge function `enviar-notificacao` assina VAPID JWT via Web Crypto nativo do Deno e envia POST vazio para cada endpoint registrado. Edge function `renotificar-cron` roda em schedule e re-dispara avisos cujo intervalo expirou. `NotificationBell` refatorado elimina localStorage para persistência — usa `avisos_visualizacoes` como fonte de verdade. `TabAvisos` em GestaoApp expandida com push/destinatários/intervalo/tracking. Nova aba `TabCobranca` mostra quem não cadastrou hoje.

**Tech Stack:** React + TypeScript, Supabase (Postgres + Edge Functions Deno + pg_cron), VitePWA/Workbox, Web Crypto API nativa (Deno), Workbox (precaching + runtime caching portado para sw.ts).

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260514100000_push_notifications.sql` | Criar | 3 tabelas novas + ALTER avisos_app |
| `src/sw.ts` | Criar | SW customizado: precache + runtime cache + push handler |
| `vite.config.ts` | Modificar | Trocar `generateSW` → `injectManifest` |
| `src/hooks/usePushSubscription.ts` | Criar | Permissão, subscription, save/delete no DB |
| `supabase/functions/enviar-notificacao/index.ts` | Criar | VAPID JWT + POST para endpoints |
| `supabase/functions/renotificar-cron/index.ts` | Criar | Cron re-notificador por intervalo |
| `src/components/NotificationBell.tsx` | Modificar | Popup persistente via DB, push permission UI |
| `src/components/gestao/TabAvisos.tsx` | Modificar | Push + destinatários + persistente + intervalo + tracking |
| `src/components/gestao/TabCobranca.tsx` | Criar | Sem cadastro hoje por tipo + notificar lista |
| `src/pages/GestaoApp.tsx` | Modificar | Adicionar aba TabCobranca |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260514100000_push_notifications.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260514100000_push_notifications.sql

-- ═══════════════════════════════════════════════════════
-- 1. Extensão avisos_app
-- ═══════════════════════════════════════════════════════
ALTER TABLE public.avisos_app
  ADD COLUMN IF NOT EXISTS persistente        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intervalo_minutos  integer     NULL,
  ADD COLUMN IF NOT EXISTS ultima_notificacao_em timestamptz NULL;
-- persistente: popup reaparece toda vez que abre o app até admin desativar
-- intervalo_minutos: NULL = sem repetição; 30 = re-send push a cada 30 min
-- ultima_notificacao_em: timestamp do último push enviado (usado pelo cron)

-- ═══════════════════════════════════════════════════════
-- 2. push_subscriptions
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarquia_id uuid        NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  endpoint      text        NOT NULL UNIQUE,
  p256dh        text        NOT NULL,
  auth          text        NOT NULL,
  user_agent    text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário gerencia apenas a própria subscription
CREATE POLICY "push_sub_own" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  )
  WITH CHECK (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  );

-- Admin lê todas
CREATE POLICY "push_sub_admin_read" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
  );

-- ═══════════════════════════════════════════════════════
-- 3. avisos_destinatarios
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.avisos_destinatarios (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id      uuid  NOT NULL REFERENCES public.avisos_app(id) ON DELETE CASCADE,
  hierarquia_id uuid  REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  tipo_usuario  text,
  CONSTRAINT chk_dest_xor CHECK (
    (hierarquia_id IS NOT NULL AND tipo_usuario IS NULL) OR
    (hierarquia_id IS NULL AND tipo_usuario IS NOT NULL)
  )
);
-- Sem linha = todos os usuários veem
-- Com linha tipo_usuario = apenas esse tipo vê
-- Com linha hierarquia_id = apenas esse usuário vê

ALTER TABLE public.avisos_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avisos_dest_admin" ON public.avisos_destinatarios
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
  );

-- ═══════════════════════════════════════════════════════
-- 4. avisos_visualizacoes
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.avisos_visualizacoes (
  aviso_id      uuid        NOT NULL REFERENCES public.avisos_app(id) ON DELETE CASCADE,
  hierarquia_id uuid        NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  visto_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aviso_id, hierarquia_id)
);

ALTER TABLE public.avisos_visualizacoes ENABLE ROW LEVEL SECURITY;

-- Usuário insere e lê a própria visualização
CREATE POLICY "viz_own" ON public.avisos_visualizacoes
  FOR ALL TO authenticated
  USING (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  )
  WITH CHECK (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  );

-- Admin lê todas
CREATE POLICY "viz_admin_read" ON public.avisos_visualizacoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
  );
```

- [ ] **Step 2: Aplicar a migration no Supabase**

```bash
cd rede_sarelli_v1.0
npx supabase db push
```
Expected: migration aplicada sem erros.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260514100000_push_notifications.sql
git commit -m "feat: migration push_subscriptions, avisos_destinatarios, avisos_visualizacoes"
```

---

## Task 2: Gerar VAPID Keys e Configurar Secrets

**Files:**
- Create: `generate-vapid.mjs` (temporário, deletar depois)

- [ ] **Step 1: Criar script de geração**

```js
// generate-vapid.mjs
import { webcrypto } from 'node:crypto';

const keyPair = await webcrypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveKey']
);

const publicRaw = await webcrypto.subtle.exportKey('raw', keyPair.publicKey);
// PKCS8 para a private key (formato usado pelo importKey)
const privateRaw = await webcrypto.subtle.exportKey('pkcs8', keyPair.privateKey);

const b64url = (buf) => Buffer.from(buf).toString('base64url');

console.log('VAPID_PUBLIC_KEY=' + b64url(publicRaw));
console.log('VAPID_PRIVATE_KEY=' + b64url(privateRaw));
console.log('VAPID_SUBJECT=mailto:admin@rede.sarelli.com');
console.log('\nVITE_VAPID_PUBLIC_KEY=' + b64url(publicRaw));
```

- [ ] **Step 2: Rodar o script**

```bash
node generate-vapid.mjs
```
Expected: 4 linhas de output com as keys.

- [ ] **Step 3: Salvar as keys nos Secrets do Supabase**

No dashboard Supabase → Edge Functions → Manage secrets, adicionar:
- `VAPID_PUBLIC_KEY` = valor gerado
- `VAPID_PRIVATE_KEY` = valor gerado
- `VAPID_SUBJECT` = `mailto:admin@rede.sarelli.com`

- [ ] **Step 4: Adicionar ao .env do projeto**

No arquivo `.env` do projeto (criar se não existir):
```
VITE_VAPID_PUBLIC_KEY=<valor gerado>
```

No painel Vercel → Settings → Environment Variables, adicionar:
- `VITE_VAPID_PUBLIC_KEY` = mesmo valor

- [ ] **Step 5: Deletar script temporário e commitar .env.example**

```bash
rm generate-vapid.mjs
```
Adicionar ao `.env.example` (se existir) a linha: `VITE_VAPID_PUBLIC_KEY=`

---

## Task 3: Service Worker Customizado

**Files:**
- Create: `src/sw.ts`

- [ ] **Step 1: Criar o arquivo src/sw.ts**

```typescript
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

// ── Runtime caching (portado de vite.config.ts) ────────────────

// Google Fonts CSS
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  })
);

// Google Fonts arquivos
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

// Supabase API data (exceto auth/storage)
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

// Imagens
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

// A edge function envia push vazio (sem payload cifrado).
// O SW busca o último aviso ativo diretamente do Supabase REST.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

self.addEventListener('push', (event) => {
  const fetchAndShow = async () => {
    try {
      // Busca o aviso mais recente ativo
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
          tag: aviso?.id || 'rede-notif', // colapsa notificações do mesmo aviso
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
```

- [ ] **Step 2: Commit**

```bash
git add src/sw.ts
git commit -m "feat: custom service worker com push handler e runtime caching"
```

---

## Task 4: Atualizar vite.config.ts

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Substituir a configuração VitePWA**

No `vite.config.ts`, remover o bloco `VitePWA({ registerType, workbox, ... })` e substituir pelo conteúdo abaixo. O restante do arquivo permanece igual.

```typescript
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  },
  devOptions: { enabled: false },
  includeAssets: ['icon-192.png', 'icon-512.png'],
  manifest: {
    name: 'Rede Política – Dra. Fernanda Sarelli',
    short_name: 'Rede Sarelli',
    description: 'Sistema de cadastros de campanha política',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fdf2f8',
    theme_color: '#ec4899',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  },
}),
```

- [ ] **Step 2: Verificar que o build não quebra**

```bash
cd rede_sarelli_v1.0
npm run build 2>&1 | tail -20
```
Expected: sem erros, `dist/sw.js` gerado.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: vite.config.ts injectManifest para suporte a push notifications"
```

---

## Task 5: Hook usePushSubscription

**Files:**
- Create: `src/hooks/usePushSubscription.ts`

- [ ] **Step 1: Criar o hook**

```typescript
// src/hooks/usePushSubscription.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw.split(''), (c) => c.charCodeAt(0));
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushSubscription() {
  const { usuario } = useAuth();
  const [permission, setPermission] = useState<PushPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!supported) { setPermission('unsupported'); return; }
    setPermission(Notification.permission as PushPermission);
  }, [supported]);

  // Verifica se já tem subscription salva para este usuário
  useEffect(() => {
    if (!usuario?.id || !supported) return;
    (async () => {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        // Confirmar que está no banco
        const { data } = await (supabase as any)
          .from('push_subscriptions')
          .select('id')
          .eq('endpoint', existing.endpoint)
          .maybeSingle();
        setSubscribed(!!data);
      }
    })();
  }, [usuario?.id, supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || !usuario?.id) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;

      // Remove subscription existente antes de criar nova
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const sub = subscription.toJSON();
      const { error } = await (supabase as any).from('push_subscriptions').upsert({
        hierarquia_id: usuario.id,
        endpoint: sub.endpoint,
        p256dh: (sub.keys as any).p256dh,
        auth: (sub.keys as any).auth,
        user_agent: navigator.userAgent.slice(0, 200),
      }, { onConflict: 'endpoint' });

      if (error) throw error;
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('[push] subscribe error', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, usuario?.id]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await (supabase as any).from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePushSubscription.ts
git commit -m "feat: usePushSubscription hook - Web Push permission e subscription"
```

---

## Task 6: Edge Function enviar-notificacao

**Files:**
- Create: `supabase/functions/enviar-notificacao/index.ts`

- [ ] **Step 1: Criar a edge function**

```typescript
// supabase/functions/enviar-notificacao/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── VAPID helpers ──────────────────────────────────────────────

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - padded.length % 4) % 4;
  const binary = atob(padded + '='.repeat(pad));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function buildVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKeyPkcs8: string,
  subject: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  })));
  const signingInput = `${header}.${payload}`;

  // Importa a chave privada no formato PKCS8 (base64url → bytes)
  const pkcs8Bytes = b64urlDecode(vapidPrivateKeyPkcs8);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Bytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signatureRaw = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${b64urlEncode(signatureRaw)}`;
  return `vapid t=${jwt},k=${vapidPublicKey}`;
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@rede.sarelli.com';

    // Verificar se é chamada de cron (sem token) ou chamada autenticada de admin
    const authHeader = req.headers.get('Authorization');
    const isCron = req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET');

    if (!isCron) {
      if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
      if (!caller) return jsonResponse({ error: 'Token inválido' }, 401);

      const { data: callerHier } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('tipo')
        .eq('auth_user_id', caller.id)
        .eq('ativo', true)
        .maybeSingle();

      if (!callerHier || !['super_admin', 'coordenador'].includes(callerHier.tipo)) {
        return jsonResponse({ error: 'Acesso negado' }, 403);
      }
    }

    const body = await req.json();
    // hierarquia_ids: lista de IDs para enviar, ou null para buscar por aviso_id
    const { aviso_id, hierarquia_ids }: { aviso_id?: string; hierarquia_ids?: string[] } = body;

    if (!aviso_id) return jsonResponse({ error: 'aviso_id obrigatório' }, 400);

    // Buscar subscriptions
    let query = supabaseAdmin.from('push_subscriptions').select('endpoint, p256dh, auth, hierarquia_id');

    if (hierarquia_ids && hierarquia_ids.length > 0) {
      query = query.in('hierarquia_id', hierarquia_ids);
    }

    const { data: subs, error: subsError } = await query;
    if (subsError) throw subsError;
    if (!subs || subs.length === 0) {
      // Atualiza ultima_notificacao_em mesmo sem subs
      await supabaseAdmin.from('avisos_app').update({ ultima_notificacao_em: new Date().toISOString() }).eq('id', aviso_id);
      return jsonResponse({ success: true, enviados: 0, erros: [] });
    }

    let enviados = 0;
    const erros: string[] = [];
    const endpointsParaRemover: string[] = [];

    for (const sub of subs) {
      try {
        const authHeader = await buildVapidAuthHeader(sub.endpoint, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT);
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'TTL': '86400',
            'Content-Length': '0',
          },
        });

        if (res.status === 201 || res.status === 200) {
          enviados++;
        } else if (res.status === 404 || res.status === 410) {
          // Subscription expirou — marcar para remoção
          endpointsParaRemover.push(sub.endpoint);
        } else {
          const txt = await res.text().catch(() => '');
          erros.push(`${sub.endpoint.slice(-20)}: ${res.status} ${txt.slice(0, 100)}`);
        }
      } catch (err: any) {
        erros.push(`${sub.endpoint.slice(-20)}: ${err.message}`);
      }
    }

    // Limpar subscriptions expiradas
    if (endpointsParaRemover.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', endpointsParaRemover);
    }

    // Atualizar ultima_notificacao_em
    await supabaseAdmin.from('avisos_app')
      .update({ ultima_notificacao_em: new Date().toISOString() })
      .eq('id', aviso_id);

    return jsonResponse({ success: true, enviados, erros });
  } catch (err: any) {
    console.error('enviar-notificacao error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
});
```

- [ ] **Step 2: Deploy da edge function**

```bash
npx supabase functions deploy enviar-notificacao
```
Expected: `Deployed enviar-notificacao` sem erros.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/enviar-notificacao/index.ts
git commit -m "feat: edge function enviar-notificacao com VAPID nativo Deno"
```

---

## Task 7: Edge Function renotificar-cron

**Files:**
- Create: `supabase/functions/renotificar-cron/index.ts`

Esta função roda via Supabase Schedule (pg_cron) a cada 5 minutos e re-envia push para avisos com `intervalo_minutos` configurado cujo tempo expirou.

- [ ] **Step 1: Criar a edge function**

```typescript
// supabase/functions/renotificar-cron/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Supabase cron chama com POST sem body — validar secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const CRON_SECRET = Deno.env.get('CRON_SECRET')!;

  // Buscar avisos ativos com intervalo configurado cujo tempo expirou
  const { data: avisos, error } = await supabaseAdmin
    .from('avisos_app')
    .select('id, intervalo_minutos, ultima_notificacao_em')
    .eq('ativa', true)
    .not('intervalo_minutos', 'is', null);

  if (error) {
    console.error('renotificar-cron: erro ao buscar avisos', error);
    return new Response('error', { status: 500 });
  }

  const agora = new Date();
  let processados = 0;

  for (const aviso of avisos ?? []) {
    const ultima = aviso.ultima_notificacao_em ? new Date(aviso.ultima_notificacao_em) : null;
    const minutosDecorridos = ultima
      ? (agora.getTime() - ultima.getTime()) / 60000
      : Infinity;

    if (minutosDecorridos >= aviso.intervalo_minutos) {
      // Buscar destinatários que ainda não viram (para renotificação inteligente)
      const { data: dests } = await supabaseAdmin
        .from('avisos_destinatarios')
        .select('hierarquia_id, tipo_usuario')
        .eq('aviso_id', aviso.id);

      let hierarquiaIds: string[] | undefined;

      if (dests && dests.length > 0) {
        // Resolver tipos para IDs
        const tipos = dests.filter(d => d.tipo_usuario).map(d => d.tipo_usuario);
        const individuais = dests.filter(d => d.hierarquia_id).map(d => d.hierarquia_id);

        let ids: string[] = [...individuais];
        if (tipos.length > 0) {
          const { data: porTipo } = await supabaseAdmin
            .from('hierarquia_usuarios')
            .select('id')
            .in('tipo', tipos)
            .eq('ativo', true);
          ids = [...ids, ...(porTipo ?? []).map(u => u.id)];
        }
        hierarquiaIds = [...new Set(ids)];
      }
      // Se hierarquiaIds undefined → envia para todos (sem filtro)

      // Chamar enviar-notificacao via HTTP
      await fetch(`${SUPABASE_URL}/functions/v1/enviar-notificacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': CRON_SECRET,
        },
        body: JSON.stringify({ aviso_id: aviso.id, hierarquia_ids: hierarquiaIds }),
      });

      processados++;
    }
  }

  return new Response(JSON.stringify({ processados }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Gerar um CRON_SECRET e salvar nos Secrets do Supabase**

```bash
# Gerar um secret aleatório
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Salvar o valor gerado no Supabase Secrets como `CRON_SECRET`.

- [ ] **Step 3: Deploy da função**

```bash
npx supabase functions deploy renotificar-cron
```

- [ ] **Step 4: Configurar o schedule no Supabase**

No Supabase Dashboard → Edge Functions → `renotificar-cron` → Schedule:
- Cron expression: `*/5 * * * *` (a cada 5 minutos)
- Method: POST
- Headers: `x-cron-secret: <valor do CRON_SECRET>`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/renotificar-cron/index.ts
git commit -m "feat: edge function renotificar-cron - re-disparo automático por intervalo"
```

---

## Task 8: Refatorar NotificationBell

**Files:**
- Modify: `src/components/NotificationBell.tsx`

Substitui o arquivo completo. Mudanças chave:
1. Remove localStorage — usa `avisos_visualizacoes` como fonte de verdade
2. Aviso `persistente = true` e sem visualização → popup abre a cada mount
3. Ao fechar o popup → insere visualização no banco
4. Botão "Ativar notificações" se push não ativado
5. Filtra avisos por `avisos_destinatarios` (se sem linha → todos veem; se com linha → filtra)

- [ ] **Step 1: Substituir src/components/NotificationBell.tsx**

```typescript
// src/components/NotificationBell.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, X, Info, AlertTriangle, CheckCircle, Zap, BellRing } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushSubscription } from '@/hooks/usePushSubscription';

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  tipo: 'info' | 'alerta' | 'sucesso' | 'urgente';
  ativa: boolean;
  persistente: boolean;
  criado_em: string;
}

const TIPO_CONFIG = {
  info:    { icon: Info,          color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  alerta:  { icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  sucesso: { icon: CheckCircle,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  urgente: { icon: Zap,           color: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
};

export default function NotificationBell() {
  const { usuario } = useAuth();
  const { supported, permission, subscribed, loading: pushLoading, subscribe } = usePushSubscription();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [visualizados, setVisualizados] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [pendentesParaMarcar, setPendentesParaMarcar] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!usuario?.id) return;

    // Buscar avisos ativos
    const { data: avisosData } = await (supabase as any)
      .from('avisos_app')
      .select('id, titulo, corpo, tipo, ativa, persistente, criado_em')
      .eq('ativa', true)
      .order('criado_em', { ascending: false });

    if (!avisosData) return;

    // Buscar quais destinatários cada aviso tem
    const avisosIds = avisosData.map((a: any) => a.id);
    const { data: dests } = await (supabase as any)
      .from('avisos_destinatarios')
      .select('aviso_id, hierarquia_id, tipo_usuario')
      .in('aviso_id', avisosIds);

    // Filtrar avisos que se destinam a este usuário
    const meuTipo = (usuario as any).tipo as string;
    const meuId = usuario.id;

    const avisosVisiveis = avisosData.filter((aviso: any) => {
      const destsDeste = (dests || []).filter((d: any) => d.aviso_id === aviso.id);
      if (destsDeste.length === 0) return true; // sem destinatários = todos
      return destsDeste.some((d: any) =>
        d.hierarquia_id === meuId || d.tipo_usuario === meuTipo
      );
    });

    setAvisos(avisosVisiveis);

    // Buscar visualizações do usuário
    const { data: vizData } = await (supabase as any)
      .from('avisos_visualizacoes')
      .select('aviso_id')
      .eq('hierarquia_id', meuId)
      .in('aviso_id', avisosIds);

    const vizSet = new Set<string>((vizData || []).map((v: any) => v.aviso_id));
    setVisualizados(vizSet);

    // Auto-popup para avisos persistentes não visualizados
    const persistenteNaoVisto = avisosVisiveis.find(
      (a: any) => a.persistente && !vizSet.has(a.id)
    );
    if (persistenteNaoVisto) {
      setOpen(true);
    }
  }, [usuario?.id, (usuario as any)?.tipo]);

  useEffect(() => {
    loadData();
    const channel = (supabase as any)
      .channel('notif-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos_app' }, loadData)
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [loadData]);

  async function marcarComoVisto(avisosParaMarcar: Aviso[]) {
    if (!usuario?.id) return;
    const naoMarcados = avisosParaMarcar.filter(a => !visualizados.has(a.id));
    if (naoMarcados.length === 0) return;

    await (supabase as any).from('avisos_visualizacoes').upsert(
      naoMarcados.map(a => ({ aviso_id: a.id, hierarquia_id: usuario.id })),
      { onConflict: 'aviso_id,hierarquia_id', ignoreDuplicates: true }
    );
    setVisualizados(prev => new Set([...prev, ...naoMarcados.map(a => a.id)]));
  }

  function handleOpen() {
    setOpen(true);
    setPendentesParaMarcar(avisos.map(a => a.id));
  }

  async function handleClose() {
    setOpen(false);
    await marcarComoVisto(avisos);
    setPendentesParaMarcar([]);
  }

  const unreadCount = avisos.filter(a => !visualizados.has(a.id)).length;
  const showPushBanner = supported && permission !== 'denied' && !subscribed;

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl bg-muted/50 hover:bg-muted active:scale-95 transition-all"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground'} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">Avisos</h3>
              </div>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {/* Banner para ativar push */}
              {showPushBanner && (
                <button
                  onClick={async () => { await subscribe(); }}
                  disabled={pushLoading}
                  className="w-full p-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 active:scale-[0.98] transition-all"
                >
                  <BellRing size={20} className="text-primary shrink-0" />
                  <div className="text-left flex-1">
                    <p className="text-xs font-bold text-primary">Ativar notificações push</p>
                    <p className="text-[10px] text-muted-foreground">Receba avisos no celular mesmo com o app fechado</p>
                  </div>
                </button>
              )}

              {avisos.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhum aviso no momento.</p>
                </div>
              ) : (
                avisos.map(aviso => {
                  const cfg = TIPO_CONFIG[aviso.tipo] ?? TIPO_CONFIG.info;
                  const Icon = cfg.icon;
                  const lido = visualizados.has(aviso.id);
                  return (
                    <div
                      key={aviso.id}
                      className={`p-4 rounded-2xl border ${cfg.border} ${cfg.bg} space-y-2 ${lido ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={cfg.color} />
                        <h4 className={`text-sm font-bold ${cfg.color} flex-1`}>{aviso.titulo}</h4>
                        {!lido && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {aviso.corpo}
                      </p>
                      <p className="text-[9px] text-muted-foreground pt-1">
                        {new Date(aviso.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-muted/30 border-t border-border">
              <button
                onClick={handleClose}
                className="w-full h-11 gradient-primary text-white font-bold rounded-xl active:scale-[0.98] transition-all shadow-md shadow-primary/20"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NotificationBell.tsx
git commit -m "feat: NotificationBell persistente via DB, banner push, filtro destinatários"
```

---

## Task 9: TabAvisos expandida com Push + Tracking

**Files:**
- Modify: `src/components/gestao/TabAvisos.tsx`

Substitui o arquivo completo. Adiciona:
- Campos `persistente` e `intervalo_minutos` no formulário
- Seletor de destinatários (todos / por tipo / específico)
- Após criar aviso → chama `enviar-notificacao` via edge function
- Seção "Avisos Ativos" com contagem viram/não viram e botão "Renotificar quem não viu"

- [ ] **Step 1: Substituir src/components/gestao/TabAvisos.tsx**

```typescript
// src/components/gestao/TabAvisos.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  Bell, Loader2, Plus, Save, Trash2, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle, Info, Zap, Users, Eye, EyeOff, Send,
  Clock, RefreshCw
} from 'lucide-react';

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  ativa: boolean;
  tipo: string;
  persistente: boolean;
  intervalo_minutos: number | null;
  ultima_notificacao_em: string | null;
  criado_em: string;
}

interface VisualizacaoStats {
  aviso_id: string;
  total_destinatarios: number;
  viram: { id: string; nome: string }[];
  nao_viram: { id: string; nome: string }[];
}

const TIPOS = [
  { key: 'info',    label: 'Info',    icon: Info,          color: 'text-blue-500 bg-blue-500/10 border-blue-400/30' },
  { key: 'sucesso', label: 'Sucesso', icon: CheckCircle,   color: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30' },
  { key: 'alerta',  label: 'Alerta',  icon: AlertCircle,   color: 'text-amber-500 bg-amber-500/10 border-amber-400/30' },
  { key: 'urgente', label: 'Urgente', icon: Zap,           color: 'text-red-500 bg-red-500/10 border-red-400/30' },
];

const TIPOS_USUARIO = ['fernanda', 'afiliado', 'social', 'lideranca', 'suplente', 'coordenador'];
const INTERVALOS = [
  { val: null,  label: 'Sem repetição' },
  { val: 15,    label: 'A cada 15 min' },
  { val: 30,    label: 'A cada 30 min' },
  { val: 60,    label: 'A cada 1 hora' },
  { val: 120,   label: 'A cada 2 horas' },
  { val: 360,   label: 'A cada 6 horas' },
  { val: 720,   label: 'A cada 12 horas' },
  { val: 1440,  label: 'A cada 24 horas' },
];

const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';

export default function TabAvisos() {
  const { isAdmin, usuario } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [renotificando, setRenotificando] = useState<string | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, VisualizacaoStats>>({});
  const [expandedStats, setExpandedStats] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: '',
    corpo: '',
    tipo: 'info',
    persistente: false,
    intervalo_minutos: null as number | null,
    destinatarios: 'todos' as 'todos' | 'tipos' | 'especificos',
    tipos_selecionados: [] as string[],
  });

  const [todosUsuarios, setTodosUsuarios] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [usuariosSelecionados, setUsuariosSelecionados] = useState<string[]>([]);

  const loadAvisos = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('avisos_app')
      .select('id, titulo, corpo, ativa, tipo, persistente, intervalo_minutos, ultima_notificacao_em, criado_em')
      .order('criado_em', { ascending: false });
    setAvisos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAvisos(); }, [loadAvisos]);

  useEffect(() => {
    if (!isAdmin) return;
    (supabase as any).from('hierarquia_usuarios')
      .select('id, nome, tipo')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }: any) => setTodosUsuarios(data || []));
  }, [isAdmin]);

  async function loadStats(aviso_id: string) {
    // Total de destinatários (quem tem push subscription)
    const { data: dests } = await (supabase as any)
      .from('avisos_destinatarios')
      .select('hierarquia_id, tipo_usuario')
      .eq('aviso_id', aviso_id);

    let destinatarioIds: string[] = [];
    if (!dests || dests.length === 0) {
      // Todos os usuários com subscription
      const { data: subs } = await (supabase as any)
        .from('push_subscriptions')
        .select('hierarquia_id');
      destinatarioIds = (subs || []).map((s: any) => s.hierarquia_id);
    } else {
      const tipos = dests.filter((d: any) => d.tipo_usuario).map((d: any) => d.tipo_usuario);
      const individuais = dests.filter((d: any) => d.hierarquia_id).map((d: any) => d.hierarquia_id);
      destinatarioIds = [...individuais];
      if (tipos.length > 0) {
        const { data: porTipo } = await (supabase as any)
          .from('hierarquia_usuarios')
          .select('id')
          .in('tipo', tipos)
          .eq('ativo', true);
        destinatarioIds = [...destinatarioIds, ...(porTipo || []).map((u: any) => u.id)];
      }
    }
    destinatarioIds = [...new Set(destinatarioIds)];

    // Quem visualizou
    const { data: vizData } = await (supabase as any)
      .from('avisos_visualizacoes')
      .select('hierarquia_id')
      .eq('aviso_id', aviso_id);
    const vizIds = new Set((vizData || []).map((v: any) => v.hierarquia_id));

    const viram = todosUsuarios.filter(u => vizIds.has(u.id));
    const nao_viram = destinatarioIds
      .filter(id => !vizIds.has(id))
      .map(id => todosUsuarios.find(u => u.id === id))
      .filter(Boolean) as { id: string; nome: string }[];

    setStatsMap(prev => ({
      ...prev,
      [aviso_id]: { aviso_id, total_destinatarios: destinatarioIds.length, viram, nao_viram }
    }));
  }

  async function handleSave() {
    if (!form.titulo.trim() || !form.corpo.trim()) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' });
      return;
    }
    setSaving(true);

    try {
      // 1. Inserir aviso
      const { data: novoAviso, error: avisoErr } = await (supabase as any)
        .from('avisos_app')
        .insert({
          titulo: form.titulo.trim(),
          corpo: form.corpo.trim(),
          tipo: form.tipo,
          ativa: true,
          persistente: form.persistente,
          intervalo_minutos: form.intervalo_minutos,
          criado_por: usuario?.id || null,
        })
        .select('id')
        .single();

      if (avisoErr) throw avisoErr;
      const aviso_id = novoAviso.id;

      // 2. Inserir destinatários
      let hierarquiaIds: string[] | undefined;
      if (form.destinatarios === 'tipos' && form.tipos_selecionados.length > 0) {
        await (supabase as any).from('avisos_destinatarios').insert(
          form.tipos_selecionados.map(t => ({ aviso_id, tipo_usuario: t }))
        );
        // Resolver IDs para push
        const { data: porTipo } = await (supabase as any)
          .from('hierarquia_usuarios')
          .select('id')
          .in('tipo', form.tipos_selecionados)
          .eq('ativo', true);
        hierarquiaIds = (porTipo || []).map((u: any) => u.id);
      } else if (form.destinatarios === 'especificos' && usuariosSelecionados.length > 0) {
        await (supabase as any).from('avisos_destinatarios').insert(
          usuariosSelecionados.map(id => ({ aviso_id, hierarquia_id: id }))
        );
        hierarquiaIds = usuariosSelecionados;
      }
      // 'todos' → não insere em avisos_destinatarios → hierarquiaIds undefined

      // 3. Disparar push
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ aviso_id, hierarquia_ids: hierarquiaIds }),
      });

      toast({ title: '✅ Aviso criado e push enviado!' });
      setForm({ titulo: '', corpo: '', tipo: 'info', persistente: false, intervalo_minutos: null, destinatarios: 'todos', tipos_selecionados: [] });
      setUsuariosSelecionados([]);
      setShowForm(false);
      loadAvisos();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRenotificar(aviso: Aviso) {
    const stats = statsMap[aviso.id];
    const naoViramIds = stats?.nao_viram?.map(u => u.id);
    if (naoViramIds && naoViramIds.length === 0) {
      toast({ title: 'Todos já viram este aviso!' });
      return;
    }

    setRenotificando(aviso.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ aviso_id: aviso.id, hierarquia_ids: naoViramIds }),
      });
      const result = await res.json();
      toast({ title: `✅ Push reenviado para ${result.enviados ?? '?'} pessoa(s)` });
    } catch (err: any) {
      toast({ title: 'Erro ao renotificar', description: err.message, variant: 'destructive' });
    } finally {
      setRenotificando(null);
    }
  }

  async function toggleAtivo(aviso: Aviso) {
    await (supabase as any).from('avisos_app').update({ ativa: !aviso.ativa }).eq('id', aviso.id);
    setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, ativa: !aviso.ativa } : a));
    toast({ title: aviso.ativa ? '⏸ Desativado' : '▶️ Ativado' });
  }

  async function deleteAviso(id: string) {
    if (!confirm('Excluir este aviso?')) return;
    await (supabase as any).from('avisos_app').delete().eq('id', id);
    setAvisos(prev => prev.filter(a => a.id !== id));
    toast({ title: 'Aviso excluído' });
  }

  const getTipo = (key: string) => TIPOS.find(t => t.key === key) || TIPOS[0];
  const avisosVisiveis = isAdmin ? avisos : avisos.filter(a => a.ativa);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-primary" />
        <div>
          <h2 className="text-base font-bold">Avisos & Push</h2>
          <p className="text-xs text-muted-foreground">{isAdmin ? 'Crie avisos e dispare notificações push' : 'Comunicados importantes'}</p>
        </div>
      </div>

      {isAdmin && (
        <button onClick={() => setShowForm(v => !v)}
          className="w-full h-12 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]">
          <Plus size={18} /> Novo Aviso + Push
        </button>
      )}

      {/* ── Formulário ── */}
      {isAdmin && showForm && (
        <div className="section-card space-y-4">
          <h3 className="text-sm font-bold">Novo Aviso</h3>

          {/* Tipo */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Tipo</p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, tipo: key }))}
                  className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    form.tipo === key ? 'gradient-primary text-white border-transparent' : 'bg-card border-border text-muted-foreground'
                  }`}>
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Título *</p>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex: Reunião amanhã às 18h" className={inputCls} />
          </div>

          {/* Mensagem */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Mensagem *</p>
            <textarea value={form.corpo} onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))} rows={3}
              placeholder="Digite o aviso completo..."
              className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>

          {/* Persistente */}
          <button onClick={() => setForm(f => ({ ...f, persistente: !f.persistente }))}
            className={`w-full h-10 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              form.persistente ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
            }`}>
            {form.persistente ? <Bell size={14} /> : <Bell size={14} />}
            {form.persistente ? '✓ Popup persiste até o admin desativar' : 'Popup persistente (reaparece toda vez)'}
          </button>

          {/* Intervalo de repetição */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Intervalo de renotificação push</p>
            </div>
            <select value={form.intervalo_minutos ?? ''} onChange={e => setForm(f => ({ ...f, intervalo_minutos: e.target.value ? Number(e.target.value) : null }))}
              className={inputCls}>
              {INTERVALOS.map(({ val, label }) => (
                <option key={label} value={val ?? ''}>{label}</option>
              ))}
            </select>
            {form.intervalo_minutos && (
              <p className="text-[10px] text-amber-600 px-1">Push será reenviado automaticamente a cada {INTERVALOS.find(i => i.val === form.intervalo_minutos)?.label?.replace('A cada ', '')} enquanto o aviso estiver ativo</p>
            )}
          </div>

          {/* Destinatários */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Destinatários</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['todos', 'tipos', 'especificos'] as const).map(opt => (
                <button key={opt} onClick={() => setForm(f => ({ ...f, destinatarios: opt }))}
                  className={`h-9 rounded-xl text-xs font-semibold border transition-all ${
                    form.destinatarios === opt ? 'gradient-primary text-white border-transparent' : 'bg-card border-border text-muted-foreground'
                  }`}>
                  {opt === 'todos' ? 'Todos' : opt === 'tipos' ? 'Por tipo' : 'Específicos'}
                </button>
              ))}
            </div>

            {form.destinatarios === 'tipos' && (
              <div className="grid grid-cols-2 gap-1.5">
                {TIPOS_USUARIO.map(tipo => (
                  <button key={tipo} onClick={() => setForm(f => ({
                    ...f,
                    tipos_selecionados: f.tipos_selecionados.includes(tipo)
                      ? f.tipos_selecionados.filter(t => t !== tipo)
                      : [...f.tipos_selecionados, tipo]
                  }))}
                    className={`h-8 rounded-lg text-xs font-semibold border transition-all capitalize ${
                      form.tipos_selecionados.includes(tipo) ? 'bg-primary text-white border-transparent' : 'bg-card border-border text-muted-foreground'
                    }`}>
                    {tipo}
                  </button>
                ))}
              </div>
            )}

            {form.destinatarios === 'especificos' && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {todosUsuarios.map(u => (
                  <button key={u.id} onClick={() => setUsuariosSelecionados(prev =>
                    prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                  )}
                    className={`w-full h-9 px-3 rounded-lg text-xs flex items-center gap-2 transition-all border ${
                      usuariosSelecionados.includes(u.id) ? 'bg-primary/10 border-primary/30 text-primary font-semibold' : 'bg-card border-border text-foreground'
                    }`}>
                    <span className="flex-1 text-left truncate">{u.nome}</span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">{u.tipo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full h-11 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {saving ? 'Enviando...' : 'Publicar + Enviar Push'}
          </button>
        </div>
      )}

      {/* ── Lista de avisos ── */}
      {avisosVisiveis.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum aviso {isAdmin ? '' : 'ativo '}no momento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {avisosVisiveis.map(aviso => {
            const tipo = getTipo(aviso.tipo);
            const TipoIcon = tipo.icon;
            const stats = statsMap[aviso.id];
            const isExpanded = expandedStats === aviso.id;

            return (
              <div key={aviso.id} className={`section-card border ${tipo.color} ${!aviso.ativa ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${tipo.color} shrink-0`}><TipoIcon size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{aviso.titulo}</p>
                      {aviso.persistente && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Persistente</span>}
                      {aviso.intervalo_minutos && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold flex items-center gap-0.5"><Clock size={8} />{INTERVALOS.find(i => i.val === aviso.intervalo_minutos)?.label?.replace('A cada ', '')}</span>}
                      {!aviso.ativa && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Inativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{aviso.corpo}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(aviso.criado_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {/* Stats de visualização */}
                {isAdmin && aviso.ativa && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <button
                      onClick={async () => {
                        if (!isExpanded) await loadStats(aviso.id);
                        setExpandedStats(isExpanded ? null : aviso.id);
                      }}
                      className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="flex items-center gap-1"><Eye size={12} /> Ver quem viu / não viu</span>
                      {stats && (
                        <span className="text-[10px]">
                          {stats.viram.length} viram · {stats.nao_viram.length} não viram
                        </span>
                      )}
                    </button>

                    {isExpanded && stats && (
                      <div className="mt-2 space-y-2">
                        {stats.viram.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1"><Eye size={9} /> Viram ({stats.viram.length})</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {stats.viram.map(u => (
                                <span key={u.id} className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-700 rounded-full">{u.nome}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {stats.nao_viram.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-red-500 flex items-center gap-1"><EyeOff size={9} /> Não viram ({stats.nao_viram.length})</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {stats.nao_viram.map(u => (
                                <span key={u.id} className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-600 rounded-full">{u.nome}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => handleRenotificar(aviso)}
                          disabled={renotificando === aviso.id || stats.nao_viram.length === 0}
                          className="w-full h-8 rounded-lg bg-amber-500/10 text-amber-600 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95"
                        >
                          {renotificando === aviso.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          Renotificar quem não viu ({stats.nao_viram.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-current/10">
                    <button onClick={() => toggleAtivo(aviso)}
                      className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                        aviso.ativa ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                      }`}>
                      {aviso.ativa ? <><ToggleLeft size={14} /> Desativar</> : <><ToggleRight size={14} /> Ativar</>}
                    </button>
                    <button onClick={() => deleteAviso(aviso.id)}
                      className="h-8 px-3 flex items-center gap-1 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive active:scale-95">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gestao/TabAvisos.tsx
git commit -m "feat: TabAvisos com push, persistente, intervalo, destinatários, tracking viram/não viram"
```

---

## Task 10: TabCobranca — Quem não cadastrou hoje

**Files:**
- Create: `src/components/gestao/TabCobranca.tsx`

- [ ] **Step 1: Criar src/components/gestao/TabCobranca.tsx**

```typescript
// src/components/gestao/TabCobranca.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, Send, RefreshCw } from 'lucide-react';

interface UsuarioSemCadastro {
  id: string;
  nome: string;
  tipo: string;
  ultimo_cadastro: string | null;
}

const TIPOS_MONITORADOS = [
  { val: 'fernanda',  label: 'Fernanda',  tabela: 'cadastros_fernanda',  campo: 'cadastrado_por' },
  { val: 'social',    label: 'Social',    tabela: 'cadastros_social',    campo: 'cadastrado_por' },
  { val: 'afiliado',  label: 'Afiliado',  tabela: 'cadastros_afiliados', campo: 'afiliado_id' },
  { val: 'lideranca', label: 'Liderança', tabela: 'liderancas',          campo: 'cadastrado_por' },
  { val: 'suplente',  label: 'Suplente',  tabela: 'liderancas',          campo: 'cadastrado_por' },
];

export default function TabCobranca() {
  const [tipoFiltro, setTipoFiltro] = useState(TIPOS_MONITORADOS[0].val);
  const [semCadastro, setSemCadastro] = useState<UsuarioSemCadastro[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = TIPOS_MONITORADOS.find(t => t.val === tipoFiltro)!;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Buscar todos os usuários ativos do tipo selecionado
      const { data: usuarios } = await (supabase as any)
        .from('hierarquia_usuarios')
        .select('id, nome, tipo')
        .eq('tipo', tipoFiltro)
        .eq('ativo', true)
        .order('nome');

      if (!usuarios || usuarios.length === 0) { setSemCadastro([]); return; }

      // Buscar quem cadastrou hoje nessa tabela
      const { data: cadastrosHoje } = await (supabase as any)
        .from(cfg.tabela)
        .select(`${cfg.campo}`)
        .gte('criado_em', hoje.toISOString());

      const comCadastroHoje = new Set((cadastrosHoje || []).map((c: any) => c[cfg.campo]));

      // Buscar último cadastro de cada um (para mostrar "último: X dias")
      const ids = usuarios.map((u: any) => u.id);
      const { data: ultimosCadastros } = await (supabase as any)
        .from(cfg.tabela)
        .select(`${cfg.campo}, criado_em`)
        .in(cfg.campo, ids)
        .order('criado_em', { ascending: false });

      const ultimoMap: Record<string, string> = {};
      for (const c of ultimosCadastros || []) {
        if (!ultimoMap[c[cfg.campo]]) ultimoMap[c[cfg.campo]] = c.criado_em;
      }

      const resultado: UsuarioSemCadastro[] = usuarios
        .filter((u: any) => !comCadastroHoje.has(u.id))
        .map((u: any) => ({
          id: u.id,
          nome: u.nome,
          tipo: u.tipo,
          ultimo_cadastro: ultimoMap[u.id] || null,
        }));

      setSemCadastro(resultado);
    } finally {
      setLoading(false);
    }
  }, [tipoFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  function diasDesde(dateStr: string | null): string {
    if (!dateStr) return 'nunca cadastrou';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'ontem';
    return `${diff} dias atrás`;
  }

  async function notificarTodos() {
    if (semCadastro.length === 0) return;
    setEnviando(true);
    try {
      // Criar aviso urgente temporário e enviar push
      const { data: novoAviso, error } = await (supabase as any)
        .from('avisos_app')
        .insert({
          titulo: '⚠️ Você não cadastrou hoje!',
          corpo: `Não esqueça de registrar seus cadastros de hoje. Acesse o app agora!`,
          tipo: 'urgente',
          ativa: true,
          persistente: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Inserir destinatários específicos
      await (supabase as any).from('avisos_destinatarios').insert(
        semCadastro.map(u => ({ aviso_id: novoAviso.id, hierarquia_id: u.id }))
      );

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          aviso_id: novoAviso.id,
          hierarquia_ids: semCadastro.map(u => u.id),
        }),
      });
      const result = await res.json();
      toast({ title: `✅ Push enviado para ${result.enviados ?? semCadastro.length} pessoa(s)` });
    } catch (err: any) {
      toast({ title: 'Erro ao notificar', description: err.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <AlertCircle size={20} className="text-amber-500" />
        <div>
          <h2 className="text-base font-bold">Sem cadastro hoje</h2>
          <p className="text-xs text-muted-foreground">Usuários que não registraram nenhum cadastro hoje</p>
        </div>
      </div>

      {/* Filtro por tipo */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
        {TIPOS_MONITORADOS.map(t => (
          <button key={t.val} onClick={() => setTipoFiltro(t.val)}
            className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
              tipoFiltro === t.val ? 'gradient-primary text-white' : 'bg-card border border-border text-muted-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Barra de ação */}
      <div className="flex gap-2">
        <button onClick={carregar} disabled={loading}
          className="h-10 px-4 rounded-xl bg-muted border border-border text-xs font-semibold flex items-center gap-1.5 active:scale-95">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
        <button onClick={notificarTodos} disabled={enviando || semCadastro.length === 0}
          className="flex-1 h-10 rounded-xl gradient-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.97]">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Notificar todos ({semCadastro.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : semCadastro.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm font-semibold">Todos cadastraram hoje! 🎉</p>
          <p className="text-xs">Nenhum usuário {TIPOS_MONITORADOS.find(t => t.val === tipoFiltro)?.label} em falta</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {semCadastro.map(u => (
            <div key={u.id} className="section-card !py-3 !px-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertCircle size={16} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  Último cadastro: <span className={u.ultimo_cadastro ? 'text-amber-600' : 'text-red-500'}>{diasDesde(u.ultimo_cadastro)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gestao/TabCobranca.tsx
git commit -m "feat: TabCobranca - painel sem cadastro hoje com notificação push"
```

---

## Task 11: Integrar nova aba em GestaoApp

**Files:**
- Modify: `src/pages/GestaoApp.tsx`

- [ ] **Step 1: Atualizar GestaoApp.tsx**

Adicionar a aba "Cobrança" visível apenas para admins. No arquivo `src/pages/GestaoApp.tsx`:

**Linha 9** — adicionar import:
```typescript
const TabCobranca = lazy(() => import('@/components/gestao/TabCobranca'));
```

**Linha 13** — alterar o tipo:
```typescript
type GestaoTab = 'metas' | 'avisos' | 'perfil' | 'cobranca';
```

**Linha 23-26** — alterar o array de tabs para incluir cobrança condicional:
```typescript
const tabs = [
  { id: 'metas' as GestaoTab, label: 'Metas', icon: Target },
  { id: 'avisos' as GestaoTab, label: 'Avisos', icon: Bell },
  ...(isAdmin ? [{ id: 'cobranca' as GestaoTab, label: 'Cobrança', icon: AlertCircle }] : []),
  { id: 'perfil' as GestaoTab, label: 'Perfil', icon: User },
];
```

**No render do conteúdo** — adicionar após o `{tab === 'avisos' && ...}`:
```typescript
{tab === 'cobranca' && isAdmin && (
  <Suspense fallback={<div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>}>
    <TabCobranca />
  </Suspense>
)}
```

**Import AlertCircle** no topo do arquivo:
```typescript
import { ArrowLeft, Target, Bell, User, AlertCircle } from 'lucide-react';
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -20
```
Expected: sem erros de TypeScript ou Vite.

- [ ] **Step 3: Commit**

```bash
git add src/pages/GestaoApp.tsx
git commit -m "feat: GestaoApp - aba Cobrança para admins"
```

---

## Task 12: Push Final, Deploy e Verificação

- [ ] **Step 1: Verificar que todas as env vars estão configuradas**

Verificar que o `.env` tem:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=BD...
```

- [ ] **Step 2: Deploy de todas as edge functions**

```bash
npx supabase functions deploy enviar-notificacao
npx supabase functions deploy renotificar-cron
```
Expected: ambas deployadas sem erros.

- [ ] **Step 3: Push e deploy Vercel**

```bash
git push origin main
```
Expected: Vercel inicia deploy automaticamente.

- [ ] **Step 4: Verificação no celular (checklist)**

No celular com o PWA instalado:
1. Abrir o app → NotificationBell deve mostrar botão "Ativar notificações push"
2. Tocar no botão → sistema pede permissão → aceitar
3. Admin criar um aviso em Gestão → Avisos → Novo Aviso + Push
4. Celular deve receber notificação na barra do sistema mesmo com app fechado
5. Abrir app → popup persistente deve aparecer se o aviso for `persistente: true`
6. Tocar "Entendi" → popup fecha e NÃO reaparece (visualização registrada)
7. Admin ver painel de Cobrança → filtrar por tipo → ver quem não cadastrou hoje

---

## Self-Review: Spec Coverage

| Requisito | Task que implementa |
|---|---|
| Web Push nativo (som + barra do celular, app fechado) | Tasks 3, 4, 5, 6 |
| Service Worker customizado com Workbox | Tasks 3, 4 |
| Tabelas push_subscriptions, avisos_destinatarios, avisos_visualizacoes | Task 1 |
| Popup persistente (reaparece até admin desativar) | Tasks 1, 8 |
| Intervalo de re-notificação configurável | Tasks 1, 7, 9 |
| Admin seleciona destinatários (todos / por tipo / específicos) | Task 9 |
| Múltiplos avisos simultâneos | Task 9 (múltiplos inserts independentes) |
| Rastreamento quem viu / não viu | Tasks 1, 8, 9 |
| Botão "Renotificar quem não viu" | Task 9 |
| Painel "sem cadastro hoje" por tipo | Task 10 |
| Botão "Notificar toda a lista" no painel cobrança | Task 10 |
| Subscriptions expiradas limpas automaticamente | Task 6 |
| Cron job re-notificador | Task 7 |
| VAPID nativo Deno sem dependências externas | Task 6 |
