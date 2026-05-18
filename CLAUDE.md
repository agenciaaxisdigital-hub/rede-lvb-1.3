# Rede Sarelli — CLAUDE.md

## Visão Geral

PWA de gestão de campanha política (Dra. Fernanda Sarelli). Controla cadastros, metas, avisos, notificações push e hierarquia de usuários. Deploy em Vercel + Supabase.

**Domínio produção:** `https://rede.deputadasarelli.com.br`
**GitHub:** `https://github.com/agenciaaxisdigital-hub/rede-lvb-1.3.git`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + SWC |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| Estado | TanStack Query v5 + Context API |
| Offline | Dexie (IndexedDB) + persist client |
| Auth/DB | Supabase v2 (PostgreSQL + Realtime + RLS) |
| PWA | vite-plugin-pwa (injectManifest) + `src/sw.ts` |
| Push | Web Push API (VAPID) via Edge Function |
| 3D/Visual | Three.js + React Three Fiber |
| Mapas | React Leaflet |
| Gráficos | Recharts |
| Monitoring | Sentry + Vercel Analytics |

---

## Comandos

```bash
npm run dev          # Dev server em :8080
npm run build        # Build produção
npm run test         # Vitest (unit)
npm run test:e2e     # Playwright (e2e)
npm run lint         # ESLint
```

---

## Estrutura de Arquivos

```
src/
├── pages/
│   ├── Index.tsx                  # Splash/redirect inicial
│   ├── Login.tsx                  # Login único
│   ├── Home.tsx                   # Home padrão (liderança, coordenador, admin)
│   ├── HomeAfiliado.tsx           # Home afiliado (isolado)
│   ├── HomeFernanda.tsx           # Home fernanda
│   ├── AdminDashboard.tsx         # Painel super_admin
│   ├── GestaoApp.tsx              # Gestão: Metas/Avisos/Cobrança/Perfil
│   └── CadastroPublicoAfiliado.tsx # Formulário público via link de captação
├── components/
│   ├── gestao/
│   │   ├── TabMetas.tsx           # Metas de cadastro
│   │   ├── TabAvisos.tsx          # Criar/gerenciar avisos + push
│   │   ├── TabCobranca.tsx        # Cobrar quem não cadastrou hoje
│   │   └── TabPerfilGestao.tsx    # Configurações de perfil
│   ├── NotificationBell.tsx       # Sino de notificações + popup + push banner
│   ├── LinkCaptacaoCard.tsx       # Card com link de captação do usuário
│   ├── TabCadastros.tsx           # Lista de cadastros (liderança)
│   ├── TabCadastrosFernanda.tsx   # Cadastros via perfil fernanda
│   ├── TabCadastrosAfiliado.tsx   # Cadastros do afiliado (isolado)
│   └── ui/                        # shadcn/ui components
├── contexts/
│   ├── AuthContext.tsx             # Auth + perfil de usuário
│   ├── CidadeContext.tsx           # Cidade selecionada
│   └── EventoContext.tsx           # Evento ativo
├── hooks/
│   ├── usePushSubscription.ts     # Gerencia subscription Web Push
│   ├── useFormDraft.ts            # Persistência de rascunho de formulário
│   ├── useOfflineItems.ts         # Fila offline
│   └── useDataCache.ts            # Cache de dados com React Query
└── services/
    └── offlineSync.ts             # Sync de dados offline → online
```

---

## Rotas

| Rota | Componente | Acesso |
|------|-----------|--------|
| `/login` | Login | Público (não autenticado) |
| `/cadastro/:token` | CadastroPublicoAfiliado | Público |
| `/c/:slug/:token` | CadastroPublicoAfiliado | Público |
| `/r/:slugComToken` | CadastroPublicoAfiliado | Público |
| `/` | Home | Autenticado |
| `/admin` | AdminDashboard | Autenticado |
| `/fernanda` | HomeFernanda | Tipo `fernanda` |
| `/afiliado` | HomeAfiliado | Tipo `afiliado` |
| `/gestao` | GestaoApp | Autenticado (admin vê Cobrança) |

---

## Tipos de Usuário

```typescript
type TipoUsuario =
  | 'super_admin'   // acesso total
  | 'coordenador'   // similar ao admin, sem algumas funções
  | 'suplente'      // vê hierarquia de liderança
  | 'lideranca'     // cadastra eleitores
  | 'fernanda'      // perfil isolado — só vê seus próprios cadastros
  | 'afiliado'      // perfil isolado — cadastros via link público
  | 'promotor'      // captação
  | 'social'        // operador de redes sociais
```

`isAdmin` = `super_admin | coordenador`
`isAfiliado` = `afiliado`

Rotas e dados são isolados por RLS no Supabase por `tipo` e `auth_user_id`.

---

## Banco de Dados (Principais Tabelas)

| Tabela | Descrição |
|--------|-----------|
| `hierarquia_usuarios` | Perfis (tipo, superior_id, ativo, municipio_id) |
| `pessoas` | Eleitores cadastrados |
| `liderancas` | Lideranças + fiscais |
| `cadastros_fernanda` | Cadastros feitos pelo perfil Fernanda |
| `cadastros_social` | Cadastros da equipe de redes sociais |
| `cadastros_afiliados` | Cadastros via link de afiliado |
| `avisos_app` | Avisos/notificações com persistente + intervalo |
| `avisos_destinatarios` | Destinatários (por tipo_usuario ou hierarquia_id) |
| `avisos_visualizacoes` | Controle de quem viu qual aviso |
| `push_subscriptions` | Subscriptions Web Push por dispositivo |
| `metas` | Metas de cadastro |
| `eventos` | Eventos da campanha |
| `municipios` | Municípios do estado |

---

## Edge Functions (Supabase)

| Função | Descrição |
|--------|-----------|
| `enviar-notificacao` | Envia Web Push para subscriptions ativas |
| `renotificar-cron` | Cron que renotifica avisos persistentes não vistos |
| `cadastro-afiliado-publico` | Processa formulário público de captação |
| `captacao-afiliado` | Onboarding de afiliado |
| `criar-usuario` | Cria usuário individual |
| `criar-usuarios-massa` | Criação em lote |
| `gerenciar-usuario` | Update de perfil/permissões |
| `instagram-poll` | Polling de menções no Instagram |
| `instagram-webhook` | Webhook do Instagram |
| `verificar-instagram` | Verifica conta vinculada |
| `regenerar-tokens` | Regenera tokens de captação |
| `limpar-duplicados` | Remove cadastros duplicados |
| `buscar-liderancas-externo` | Consulta lideranças (externo) |
| `buscar-pagamentos-externo` | Consulta pagamentos (externo) |
| `buscar-indicadores` | Indicadores gerais |
| `admin-diagnostico` | Diagnóstico para admin |
| `atribuir-modulos-massa` | Atribui módulos em lote |
| `manutencao-usuarios` | Manutenção de usuários |
| `setup-fernanda` | Setup inicial do perfil Fernanda |

---

## Push Notifications (Web Push + VAPID)

### Fluxo
1. `usePushSubscription.ts` → solicita permissão + registra SW → chama `enviar-notificacao` com subscription
2. Subscription salva em `push_subscriptions` (endpoint, p256dh, auth, user_agent)
3. Admin cria aviso em `TabAvisos.tsx` → INSERT em `avisos_app` + `avisos_destinatarios` → chama `enviar-notificacao`
4. Edge function assina JWT VAPID via `crypto.subtle` (Deno nativo, sem npm:web-push)
5. `renotificar-cron` roda a cada 5 min → renotifica avisos `persistente=true` com `intervalo_minutos` configurado

### Variáveis de Ambiente
```
VITE_VAPID_PUBLIC_KEY     # Chave pública VAPID (frontend)
VAPID_PRIVATE_KEY         # Chave privada (edge function secret)
VAPID_PUBLIC_KEY          # Chave pública (edge function)
CRON_SECRET               # Segredo para autenticar renotificar-cron
```

### Configuração Manual no Supabase Dashboard
- **Cron job** `renotificar-cron`: a cada 5 minutos, header `x-cron-secret: <CRON_SECRET>`

---

## Avisos (Pop-up + Push)

- `avisos_visualizacoes` = fonte de verdade de quem viu (não localStorage)
- `persistente = true` → popup reaparece toda sessão até o usuário fechar
- `intervalo_minutos` → renotifica push após N minutos se não viu
- Destinatários: `todos` (NULL), por `tipo_usuario` ou por `hierarquia_id` específico

---

## Captação Pública (Link de Afiliado)

- URL: `/r/:slugComToken` → `CadastroPublicoAfiliado.tsx`
- CPF está **oculto** temporariamente (campo existe no DB, oculto só no formulário público)
- Campo **Cidade** adicionado (mapeia para coluna `cidade` em `cadastros_afiliados`)
- Sem badge "MANDATO" nem texto "convocações" nessa tela

Para reativar CPF: buscar `CPF oculto temporariamente` em `CadastroPublicoAfiliado.tsx`

---

## Deploy

### Vercel
- Build: `npm run build`
- Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- Domínio ativo: `rede.deputadasarelli.com.br`
- Domínio com problema: `rede.drafernandasarelli.com.br` (verificar DNS/Vercel)

### Supabase
- Migrations: `supabase db push`
- Edge Functions: `supabase functions deploy <nome>`
- Secrets: `supabase secrets set KEY=value`

---

## Git / GitHub

- Remote: `https://github.com/agenciaaxisdigital-hub/rede-lvb-1.3.git`
- `.env` **nunca** vai para o git
- Para push autenticado: credenciais salvas em memory (`project_github.md`)

---

## Padrões do Projeto

- Componentes lazy + Suspense para code splitting
- React Query para cache/fetch — não chamar Supabase diretamente em componentes
- RLS em todas as tabelas — nunca confiar só no frontend para isolamento
- `DROP POLICY IF EXISTS` antes de `CREATE POLICY` nas migrations (idempotência)
- Cast explícito `tipo::text` ao comparar enum PostgreSQL com coluna `text`
- Imports: `@/` mapeia para `src/`
