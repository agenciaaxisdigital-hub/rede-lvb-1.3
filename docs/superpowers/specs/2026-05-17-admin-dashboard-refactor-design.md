# Admin Dashboard Refactor — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar o AdminDashboard (1125 linhas, 12 views em tab bar bagunçada) em um layout moderno com sidebar lateral no desktop e bottom nav no mobile/PWA, mantendo 100% das funções existentes e removendo apenas a tab de Localização (instável).

**Architecture:** Shell component (`AdminShell`) controla layout responsivo (sidebar desktop / bottom nav mobile). `AdminDashboard.tsx` vira apenas o orquestrador de dados e estado. Views pesadas continuam lazy-loaded. Novos componentes de view extraídos do monólito atual.

**Tech Stack:** React 18 + TypeScript + Tailwind + Lucide React + shadcn/ui (já instalados)

---

## Grupos de Navegação

| Grupo | `id` | Sub-views | Ícone Lucide | Mobile bottom |
|-------|------|-----------|--------------|---------------|
| Visão Geral | `visao-geral` | `ranking`, `arvore` | `BarChart3` | sim |
| Cadastros | `cadastros` | `registros`, `fernanda`, `social`, `afiliados` | `ClipboardList` | sim |
| Gestão | `gestao` | `usuarios`, `cidades`, `eventos` | `Settings` | sim |
| Digital | `digital` | `instagram`, `mencoes` | `Instagram` | sim |

**Removido:** `localizacao` (instável, removido completamente).

Grupos com uma única sub-view abrem direto. Grupos com múltiplas sub-views exibem pills de sub-nav horizontais no topo do content area.

---

## Estrutura de Arquivos

### Novos arquivos (criar)

```
src/components/admin/
├── AdminShell.tsx          ← layout wrapper: sidebar + bottom nav + sub-nav strip
├── AdminSidebar.tsx        ← sidebar desktop fixa 240px
├── AdminBottomNav.tsx      ← bottom nav mobile com 4 ícones
├── AdminSubNav.tsx         ← pills horizontais para sub-views dentro de um grupo
├── AdminStatsStrip.tsx     ← cards de stats (Lideranças/Cabos/Eleitores/Fiscais) + período
└── views/
    ├── AdminRanking.tsx    ← extraído de AdminDashboard (ranking + popup user)
    ├── AdminRegistros.tsx  ← extraído de AdminDashboard (registros com busca + filtro + export)
    ├── AdminUsuarios.tsx   ← extraído de AdminDashboard (usuários com expand + delete + export)
    └── AdminCidades.tsx    ← extraído de AdminDashboard (cidades com add + stats)
```

### Arquivos existentes mantidos como estão (não modificar)

```
src/components/TabArvore.tsx
src/components/AdminCadastrosFernanda.tsx
src/components/TabCadastrosSocial.tsx
src/components/AdminCadastrosAfiliados.tsx
src/components/AdminInstagramPanel.tsx
src/components/AdminMencoesInstagram.tsx
src/components/GerenciarEventos.tsx
```

### Arquivo modificado

```
src/pages/AdminDashboard.tsx   ← vira orquestrador: providers de dados + renderiza AdminShell
```

---

## Componentes Detalhados

### `AdminShell.tsx`

Props:
```typescript
interface AdminShellProps {
  activeGroup: GroupId
  activeView: ViewId
  onGroupChange: (group: GroupId) => void
  onViewChange: (view: ViewId) => void
  children: React.ReactNode
}
type GroupId = 'visao-geral' | 'cadastros' | 'gestao' | 'digital'
type ViewId = 'ranking' | 'arvore' | 'registros' | 'fernanda' | 'social' | 'afiliados' | 'usuarios' | 'cidades' | 'eventos' | 'instagram' | 'mencoes'
```

Layout:
- Desktop (`md:` breakpoint): `flex flex-row h-screen` — `AdminSidebar` fixo à esquerda + `main` com overflow-y-auto
- Mobile: `flex flex-col h-screen` — `main` com overflow-y-auto + `AdminBottomNav` fixo embaixo

### `AdminSidebar.tsx`

- Largura: 240px fixo, height: 100vh, sticky
- Topo: ícone de voltar (`ArrowLeft`) + título "Painel Admin"
- Grupos: cada grupo é um botão com ícone + label. Grupo ativo = `gradient-primary text-white`. Inativo = `hover:bg-muted`
- Sub-views: quando grupo está ativo e tem múltiplas views, exibe lista de sub-items com indent (pills menores, sem ícone, só label)
- Rodapé: nome do usuário logado + botão logout

### `AdminBottomNav.tsx`

- Fixed bottom, 4 ícones centralizados
- Ativo: ícone com cor primária + label embaixo
- Inativo: muted

### `AdminSubNav.tsx`

- Aparece no topo do content area quando grupo tem >1 sub-view
- Pills horizontais com scroll horizontal se necessário
- Só visível no mobile (no desktop, sub-nav está dentro da sidebar como sub-items)

### `AdminStatsStrip.tsx`

Props:
```typescript
interface AdminStatsStripProps {
  liderancas: number
  cabos: number
  eleitores: number
  fiscais: number
  periodo: Periodo
  onPeriodoChange: (p: Periodo) => void
  variant: 'full' | 'compact'
}
type Periodo = 'hoje' | 'semana' | 'mes' | 'total'
```

- `variant='full'`: 4 cards grandes com número + label + período selector (botões Hoje/Semana/Mês/Total) — usado em Visão Geral → Ranking
- `variant='compact'`: linha única `Lid. 55 · Cab. 0 · Eleit. 19 · Fisc. 4` + período selector compacto (select dropdown) — usado no topo das demais views que precisam dos totais

### `AdminRanking.tsx` (extraído)

Contém:
- `AdminStatsStrip variant='full'`
- `SeletorCidade` + `SeletorEvento`
- Filtros de tipo de usuário + busca
- Lista de ranking com posição, avatar, nome, tipo, contadores (l/c/e/f/fern/soc), botão export individual
- Botão "Exportar Todos (Excel)"
- User popup modal (slide from bottom)

### `AdminRegistros.tsx` (extraído)

Contém:
- `AdminStatsStrip variant='compact'`
- `SeletorCidade` + `SeletorEvento`
- Busca por nome/CPF/cargo
- Filtro por tipo (Todos/Liderança/Eleitor/Fiscal)
- Lista com paginação visual (todos os registros)
- Botão "Exportar (Excel)" filtrado pelo tipo ativo

### `AdminUsuarios.tsx` (extraído)

Contém:
- Busca por nome
- Filtro por tipo de usuário (pills)
- Lista de usuários com expand para ver detalhes (tipo, hierarquia, cadastros por tipo)
- Ação: delete usuário (com confirmação)
- Botão "Exportar Todos (Excel)"

### `AdminCidades.tsx` (extraído)

Contém:
- Lista de municípios com contagem de cadastros
- Formulário inline para adicionar novo município
- Stats por cidade

---

## Responsividade — Breakpoints

| Breakpoint | Sidebar | Sub-nav | Stats |
|-----------|---------|---------|-------|
| `< md` (mobile/PWA) | Bottom nav 4 ícones | Pills horizontais acima do content | compact strip |
| `≥ md` (desktop) | Sidebar 240px left | Sub-items dentro da sidebar | full cards em Ranking, compact nas demais |

---

## Estado e Dados

`AdminDashboard.tsx` mantém todo o estado atual:
- `activeGroup` + `activeView` (novo — substitui `vistaAtiva`)
- `periodo`, `tipoFiltro`, `searchTerm`, etc. (inalterados)
- Todos os hooks de dados (`useLiderancas`, `useEleitores`, `useFiscaisAdmin`, `useUsuarios`)
- Real-time channels (`cadastros_fernanda`, `cadastros_social`)
- `handleExport` function (inalterada)

Props drilling: `AdminDashboard` passa dados via props para os views filhos. Não introduzir Context novo — os views recebem só o que precisam.

---

## O que NÃO muda

- Nenhuma lógica de negócio (queries, filtros, cálculos de ranking, exportação)
- Nenhum componente já extraído (TabArvore, AdminCadastrosFernanda, etc.)
- RLS/Supabase nada muda
- `exportCadastrosFiltered` de `@/lib/exportXlsx` — inalterado
- Real-time subscriptions — inalteradas
- `useDataCache` hooks — inalterados

---

## O que é removido

- Tab `localizacao` e import de `TabLocalizacoes` — deletados completamente
- Tab bar horizontal scrollável (substituída por sidebar + bottom nav)
- Header sticky monolítico (distribuído entre sidebar e top de cada view)
