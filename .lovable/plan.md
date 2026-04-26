
# Integração Meta API — Fundação

Vamos construir em **3 fases**. Metas diárias ficam para depois (fase 4), conforme você pediu.

---

## ⚠️ Pré-requisitos Meta (você precisa fornecer/criar)

Antes de qualquer código, é **obrigatório** ter:

### 1. Meta Business Account + WhatsApp Cloud API
- **Meta Business Manager** verificado (CNPJ da campanha/empresa)
- **WhatsApp Business Account (WABA)** criada no Business Manager
- **Número de telefone dedicado** para o WhatsApp Business (não pode ser número pessoal já em uso no WhatsApp comum)
- **Template de mensagem aprovado** pela Meta (algo curto tipo: *"Olá! Confirmando seu cadastro na Rede Sarelli. ✅"*) — aprovação leva 1–24h
- Credenciais que vou armazenar como secrets:
  - `META_WHATSAPP_TOKEN` (Permanent Access Token)
  - `META_WHATSAPP_PHONE_NUMBER_ID`
  - `META_WHATSAPP_TEMPLATE_NAME`

### 2. Instagram Business + App Meta
- Conta **@chamaadoutora** (ou similar) convertida para **Instagram Business** ou **Creator**
- Vinculada a uma **Página do Facebook** que você administra
- **App Meta** criado em developers.facebook.com com produtos:
  - Instagram Graph API
  - Webhooks
- Solicitar permissões (precisa **App Review** da Meta — pode levar 1–4 semanas):
  - `instagram_basic`
  - `instagram_manage_insights`
  - `pages_read_engagement`
  - `instagram_manage_comments` (para webhook de menções)
- Credenciais:
  - `META_APP_ID`, `META_APP_SECRET`
  - `META_IG_BUSINESS_ACCOUNT_ID`
  - `META_IG_LONG_LIVED_TOKEN` (60 dias, com refresh automático)
  - `META_WEBHOOK_VERIFY_TOKEN` (string que você define)

> Eu **não consigo criar isso por você** — são contas externas. Vou te guiar passo-a-passo quando começarmos.

---

## FASE 1 — Validação de WhatsApp ao digitar

**Objetivo:** quando o usuário termina de digitar o WhatsApp no formulário de cadastro, o sistema dispara uma **mensagem template silenciosa** via WhatsApp Cloud API. Se a Meta retornar `message_status: sent` → número existe. Se retornar erro `131026` (recipient not in WhatsApp) → não existe.

### Backend
- **Edge function nova: `validar-whatsapp`**
  - Input: `{ telefone: "62999999999" }`
  - Normaliza para E.164 (`+5562999999999`)
  - POST para `https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages` com template aprovado
  - Mapeia resposta da Meta → `{ valido: true|false, motivo: "existe" | "numero_inexistente" | "formato_invalido" }`
  - Cache em memória 5min para não revalidar o mesmo número
  - Rate limit local: máx 1 chamada/segundo por IP (custo Meta ≈ R$0,03 por mensagem)

### Frontend
- Hook novo: `useValidacaoWhatsapp(telefone)` com **debounce de 800ms**
- Aplicado em **todos** os formulários que pedem WhatsApp:
  - `TabCadastrar.tsx`, `TabLiderancas.tsx`, `TabFiscais.tsx`, `TabEleitores.tsx`, `TabSuplentes.tsx`, `CadastroPublicoAfiliado.tsx`, `TabCadastrosFernanda.tsx`
- UI: ícone ao lado do campo
  - 🔄 validando
  - ✅ verde "WhatsApp confirmado"
  - ❌ vermelho "Número não tem WhatsApp" (bloqueia submit, ou só avisa — você decide)

### DB
- Adicionar coluna `whatsapp_validado` (boolean) e `whatsapp_validado_em` (timestamp) na tabela `pessoas`
- Tabela nova `validacoes_whatsapp` (log/auditoria + cache persistente 30 dias):
  ```
  id, telefone_normalizado, valido, resposta_meta jsonb, criado_em
  ```

---

## FASE 2 — Validação de Instagram

**Recomendação:** **validação por oEmbed público + verificação posterior via webhook**. Justificativa: OAuth de Instagram para cada liderança é inviável (a maioria não tem conta Business). Scraping fere ToS. Login com Instagram exige App Review pesado.

### Estratégia em 2 camadas

**Camada A — Validação de formato + checagem oEmbed (na hora do cadastro)**
- Edge function `validar-instagram`:
  - Limpa @ e URL → extrai username
  - Valida regex (`^[a-zA-Z0-9._]{1,30}$`)
  - Tenta `GET https://www.instagram.com/api/v1/users/web_profile_info/?username={user}` com User-Agent rotativo (público, sem auth) → se 200 e perfil existe, marca como provável-válido
  - Se bloqueado pela Meta (acontece), marca como **"formato OK, aguardando verificação"** sem bloquear cadastro

**Camada B — Verificação real via menção (automática)**
- Quando a pessoa postar marcando @chamaadoutora, o webhook recebe e cruza com o `instagram` cadastrado → marca `instagram_verificado = true` automaticamente
- Pessoas que nunca interagem ficam com flag pendente, e admin pode ver no painel

### DB
- Coluna `instagram_normalizado` (text, lowercase sem @) e `instagram_verificado` (boolean) em `pessoas`
- Index único parcial em `instagram_normalizado` para detectar duplicatas

---

## FASE 3 — Monitoramento de Postagens (Hashtag + Menções)

**Conta Business:** @chamaadoutora própria + Hashtag Search API + Webhook de menções.

### 3a. Webhook de menções (tempo real)
- **Edge function `webhook-instagram`** (sem auth, verify_jwt = false)
  - Endpoint público: `https://yvdfdmyusdhgtzfguxbj.supabase.co/functions/v1/webhook-instagram`
  - Verifica `hub.verify_token` no setup
  - Recebe eventos `mentions` e `comments`
  - Para cada menção: salva post e cruza com `pessoas.instagram_normalizado`

### 3b. Job de hashtag (cron)
- **Edge function `monitorar-hashtag`** rodando a cada 30 minutos via Supabase cron
- Busca `IG Hashtag Search API` por `chamaadoutora` → `recent_media`
- Para cada post novo: salva e cruza com cadastros

### 3c. Refresh de token (cron)
- **Edge function `refresh-instagram-token`** rodando a cada 50 dias
- Renova long-lived token automaticamente (token expira em 60 dias)

### DB — tabelas novas
```
posts_instagram
  id uuid pk
  pessoa_id uuid fk pessoas (nullable, preenchido no match)
  ig_media_id text unique
  ig_username text          -- quem postou
  tipo text                 -- 'hashtag' | 'mention_feed' | 'mention_story' | 'comment'
  permalink text
  media_url text
  caption text
  postado_em timestamptz
  hashtag text              -- 'chamaadoutora'
  detectado_em timestamptz default now()
  contabilizado boolean default true

webhook_eventos_meta        -- log bruto para auditoria/debug
  id, payload jsonb, processado bool, erro text, criado_em
```

### RLS
- `posts_instagram`: admin vê tudo; usuário comum vê apenas posts onde `pessoa_id` está na sua hierarquia (`get_subordinados`)
- `webhook_eventos_meta`: apenas super_admin

### UI — Painel
- Nova aba/seção no `AdminDashboard`: **"Postagens Sociais"**
  - Total de posts com #chamaadoutora hoje/semana/mês
  - Total de menções @chamaadoutora
  - Top 10 lideranças que mais postaram
  - Lista cronológica com link para o post
- No card de cada cadastro (Lideranças/Fiscais/Eleitores): badge **"X posts esta semana"**

---

## FASE 4 — Sistema de Metas (depois da fase 3 funcionando)

Conforme você disse, definimos depois. Estrutura provável:
- Tabela `metas_postagem` (por tipo OU por usuário, com período)
- Cálculo: `posts_instagram` filtrado por janela vs meta
- UI: barra de progresso no perfil + ranking no dashboard

Não vamos implementar agora — só deixar a base de dados pronta para receber.

---

## Secrets que vou pedir (na ordem)

1. **Fase 1:** `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_TEMPLATE_NAME`
2. **Fase 2:** nenhum extra (camada A é pública)
3. **Fase 3:** `META_APP_ID`, `META_APP_SECRET`, `META_IG_BUSINESS_ACCOUNT_ID`, `META_IG_LONG_LIVED_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`

---

## Custos estimados

- **WhatsApp Cloud API:** ~R$ 0,03 por mensagem template (validação). 1.000 cadastros/mês ≈ R$ 30
- **Instagram Graph API:** **grátis** (limites: 200 chamadas/hora/usuário, 30 hashtags acompanháveis simultâneas por app)
- **Webhooks:** grátis

---

## Ordem de execução proposta

1. ✅ Você aprova este plano
2. 🔨 Você cria conta WhatsApp Business + template (fora do Lovable)
3. 🤖 Eu construo Fase 1 (validação WhatsApp)
4. 🧪 Testamos com seu número
5. 🤖 Eu construo Fase 2 (validação Instagram — não precisa de Meta App ainda)
6. 🔨 Você cria App Meta + submete para App Review (paralelo)
7. 🤖 Eu construo Fase 3 (monitoramento) quando App Review for aprovado
8. 🤖 Fase 4 (metas) depois que tudo estiver fluindo

Quer que eu comece pela **Fase 1** assim que você aprovar e tiver as 3 credenciais do WhatsApp?
