# Sistema de Notificações Push — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sistema completo de notificações push para PWA — admin dispara notificações nativas no celular dos usuários (som + barra de sistema, app fechado ou aberto), com popup persistente, rastreamento de visualização e painel de inadimplência diária.

**Architecture:** Web Push API via VAPID + Service Worker customizado sobre VitePWA/Workbox existente. Supabase Edge Function assina e despacha os pushes. Rastreamento client-side via insert em `avisos_visualizacoes` ao fechar o popup. Painel admin unificado: composição, destinatários, avisos ativos com status de visualização, e lista de usuários sem cadastro hoje.

**Tech Stack:** React + TypeScript, Supabase (Postgres + Edge Functions Deno), VitePWA/Workbox (já configurado), Web Push VAPID (implementado manualmente via Deno Crypto API — sem dependências externas), Tailwind CSS.

---

## 1. Banco de Dados

### 1.1 Nova tabela `push_subscriptions`
```sql
CREATE TABLE public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarquia_id uuid NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
-- RLS: usuário só insere/deleta a própria; admin vê todas
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_push_sub" ON public.push_subscriptions
  USING (hierarquia_id = (
    SELECT id FROM public.hierarquia_usuarios
    WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
  ));
CREATE POLICY "admin_push_sub" ON public.push_subscriptions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hierarquia_usuarios
    WHERE auth_user_id = auth.uid() AND tipo IN ('super_admin','coordenador') AND ativo = true
  ));
```

### 1.2 Nova tabela `avisos_destinatarios`
```sql
CREATE TABLE public.avisos_destinatarios (
  aviso_id      uuid NOT NULL REFERENCES public.avisos_app(id) ON DELETE CASCADE,
  hierarquia_id uuid REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  tipo_usuario  text,  -- 'fernanda'|'afiliado'|'social'|'lideranca'|'suplente'|'coordenador'
  -- Exatamente um dos dois é preenchido por linha
  CONSTRAINT chk_dest CHECK (
    (hierarquia_id IS NOT NULL AND tipo_usuario IS NULL) OR
    (hierarquia_id IS NULL AND tipo_usuario IS NOT NULL)
  )
);
-- RLS: admin only
ALTER TABLE public.avisos_destinatarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_avisos_dest" ON public.avisos_destinatarios FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hierarquia_usuarios
    WHERE auth_user_id = auth.uid() AND tipo IN ('super_admin','coordenador') AND ativo = true
  ));
```

Regra de visibilidade: se não há linhas em `avisos_destinatarios` para um aviso → todos os usuários veem. Se há linhas → só quem bate com `hierarquia_id` ou `tipo_usuario` vê.

### 1.3 Nova tabela `avisos_visualizacoes`
```sql
CREATE TABLE public.avisos_visualizacoes (
  aviso_id      uuid NOT NULL REFERENCES public.avisos_app(id) ON DELETE CASCADE,
  hierarquia_id uuid NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  visto_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aviso_id, hierarquia_id)
);
-- RLS: usuário insere a própria; admin lê todas
ALTER TABLE public.avisos_visualizacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_viz" ON public.avisos_visualizacoes FOR INSERT TO authenticated
  WITH CHECK (hierarquia_id = (
    SELECT id FROM public.hierarquia_usuarios
    WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
  ));
CREATE POLICY "admin_viz" ON public.avisos_visualizacoes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hierarquia_usuarios
    WHERE auth_user_id = auth.uid() AND tipo IN ('super_admin','coordenador') AND ativo = true
  ));
```

### 1.4 Alterar `avisos_app`
```sql
ALTER TABLE public.avisos_app ADD COLUMN IF NOT EXISTS persistente boolean NOT NULL DEFAULT false;
-- persistente = true → popup reaparece toda vez que o usuário abre o app
-- (não usa localStorage; verifica avisos_visualizacoes a cada mount)
```

### 1.5 Secrets Supabase (VAPID)
Dois secrets gerados uma vez via script:
- `VAPID_PUBLIC_KEY` — exposto ao frontend (`VITE_VAPID_PUBLIC_KEY` no `.env`)
- `VAPID_PRIVATE_KEY` — só nas Edge Functions
- `VAPID_SUBJECT` — `mailto:admin@rede.sarelli.com`

---

## 2. Service Worker

### 2.1 Arquivo `public/sw-push.js` (custom SW handler)
Injetado via VitePWA `injectManifest` mode. Recebe eventos `push` e `notificationclick`.

```js
// Dentro do SW customizado
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const { title, body, icon, badge, aviso_id } = data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { aviso_id },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
```

O som é automático — o sistema operacional (Android/iOS) toca o som padrão ao exibir a notificação, igual WhatsApp.

### 2.2 Alteração `vite.config.ts`
Mudar de `registerType: 'autoUpdate'` (generated SW) para `strategies: 'injectManifest'` com `srcDir: 'public'` e `filename: 'sw-push.js'` — permite código customizado de push mantendo o Workbox cache existente.

---

## 3. Edge Function `enviar-notificacao`

Deno function que:
1. Valida token do caller como admin
2. Recebe `{ aviso_id, titulo, corpo, destinatarios }` onde `destinatarios` é lista de `hierarquia_id`
3. Busca todos os `push_subscriptions` dos destinatários
4. Para cada subscription: assina o payload VAPID manualmente via `crypto.subtle` (Deno native — sem `web-push` npm) e faz `fetch` para o endpoint
5. Retorna `{ enviados: N, erros: [] }`

VAPID signing em Deno usa `crypto.subtle.importKey` + `crypto.subtle.sign` com EC P-256 — padrão Web Crypto, disponível nativamente.

---

## 4. Frontend — Componentes

### 4.1 Hook `usePushSubscription`
`src/hooks/usePushSubscription.ts`
- Verifica suporte (`'serviceWorker' in navigator && 'PushManager' in window`)
- Pede permissão ao usuário (uma vez, com UX explicativa)
- Cria `PushSubscription` com a `VITE_VAPID_PUBLIC_KEY`
- Salva endpoint em `push_subscriptions` via Supabase
- Exporta `{ supported, permission, subscribe, unsubscribe }`

### 4.2 Componente `NotificationBell` (refatorado)
`src/components/NotificationBell.tsx`
- Adiciona botão "Ativar notificações push" se `permission !== 'granted'`
- Ao ativar: chama `subscribe()` do hook
- Lista de avisos filtra por `avisos_destinatarios` (o backend já retorna só os do usuário via RLS view ou função)
- Aviso `persistente: true` e sem registro em `avisos_visualizacoes` → abre modal automaticamente a cada mount
- Ao fechar modal: `INSERT INTO avisos_visualizacoes` → não reaparece até admin desativar e reativar

### 4.3 Painel Admin `AdminNotificacoes`
`src/components/AdminNotificacoes.tsx`

**Aba 1 — Disparar:**
- Form: título, corpo, tipo (info/alerta/urgente), persistente toggle
- Seletor de destinatários: "Todos" ou checkboxes por tipo ou busca de usuário individual
- Botão "Disparar" → `INSERT avisos_app` + `INSERT avisos_destinatarios` + chama edge function `enviar-notificacao`

**Aba 2 — Avisos Ativos:**
- Lista cada aviso ativo com:
  - Destinatários totais (count de subscriptions)
  - Viram: lista de nomes (join `avisos_visualizacoes`)
  - Não viram: lista de nomes
  - Botão "Renotificar quem não viu" → chama `enviar-notificacao` só com os IDs não vistos
  - Botão "Desativar" → `UPDATE avisos_app SET ativa = false`

**Aba 3 — Sem Cadastro Hoje:**
- Select de tipo de usuário
- Query: `hierarquia_usuarios` do tipo selecionado MINUS quem tem registro hoje em:
  - `cadastros_fernanda` (para tipo fernanda)
  - `cadastros_social` (para tipo social)
  - `cadastros_afiliados` (para tipo afiliado)
  - `liderancas`/`fiscais`/`possiveis_eleitores` (para outros)
- Mostra: nome, último cadastro, dias em falta
- Botão "Notificar toda essa lista" → dispara push para quem não cadastrou

---

## 5. Fluxo End-to-End

```
1. Usuário abre app → SW registrado → hook pede permissão push
2. Usuário aceita → endpoint salvo em push_subscriptions
3. Admin compõe notificação, seleciona destinatários, clica Disparar
4. Frontend: INSERT avisos_app + avisos_destinatarios
5. Frontend: chama edge function enviar-notificacao com lista de hierarquia_ids
6. Edge function: busca endpoints → assina VAPID → POST para cada endpoint
7. Celular do usuário: SW recebe push → showNotification (som + barra)
8. Usuário abre app: NotificationBell monta → aviso persistente sem visualização → popup aparece
9. Usuário fecha popup: INSERT avisos_visualizacoes
10. Admin vê painel: 5 enviados, 3 viram, 2 não viram → botão Renotificar
```

---

## 6. Compatibilidade e Limitações

- **Android Chrome 50+**: suporte total ✅
- **iOS Safari 16.4+ (PWA instalado)**: suporte total ✅ (app já instalado nos celulares)
- **iOS < 16.4**: sem push nativo — popup in-app ainda funciona, push não aparece
- **Som**: automático pelo SO, igual WhatsApp — sem necessidade de arquivo de áudio customizado
- **Sem Firebase**: implementação nativa Web Push, zero dependências externas novas

---

## 7. Segurança

- VAPID_PRIVATE_KEY nunca exposto ao frontend (só Edge Function)
- RLS em todas as tabelas novas
- Edge function valida token de admin antes de qualquer operação
- `push_subscriptions`: usuário só vê/edita a própria subscription
- `avisos_visualizacoes`: usuário só insere a própria visualização; admin lê todas
