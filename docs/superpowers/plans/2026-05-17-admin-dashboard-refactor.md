# Admin Dashboard Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar `AdminDashboard.tsx` (1211 linhas, 12 views em tab bar) com sidebar lateral no desktop e bottom nav no mobile/PWA, mantendo 100% das funções e removendo apenas a tab Localização.

**Architecture:** `AdminShell` controla layout responsivo (sidebar 240px desktop / mobile-header + bottom-nav). `AdminDashboard.tsx` vira orquestrador de dados + estado que renderiza `AdminShell` com views filhos. Views inline extraídas para componentes em `src/components/admin/views/`. Tipos, constantes e grupo-config centralizados em `adminTypes.ts`.

**Tech Stack:** React 18 + TypeScript + Tailwind + Lucide React (todos já instalados)

---

## File Map

**Criar:**
```
src/components/admin/
├── adminTypes.ts              ← tipos compartilhados, constantes, definição dos grupos + views
├── AdminStatsStrip.tsx        ← cards de totais (variant: 'full' | 'compact')
├── AdminUserPopup.tsx         ← modal popup de cadastros do usuário (extraído)
├── AdminSidebar.tsx           ← sidebar desktop 240px
├── AdminBottomNav.tsx         ← bottom nav mobile (4 grupos)
├── AdminSubNav.tsx            ← pills horizontais de sub-views (mobile only)
├── AdminShell.tsx             ← layout wrapper responsivo
└── views/
    ├── AdminRanking.tsx       ← ranking view (extraída do AdminDashboard)
    ├── AdminRegistros.tsx     ← registros view (extraída)
    ├── AdminUsuarios.tsx      ← usuários view (extraída)
    └── AdminCidades.tsx       ← cidades view (extraída)
```

**Modificar:**
- `src/pages/AdminDashboard.tsx` — reescrita como orquestrador (~380 linhas vs 1211 original)

**Manter intactos (não tocar):**
- `src/components/TabArvore.tsx`
- `src/components/AdminCadastrosFernanda.tsx`
- `src/components/TabCadastrosSocial.tsx`
- `src/components/AdminCadastrosAfiliados.tsx`
- `src/components/AdminInstagramPanel.tsx`
- `src/components/AdminMencoesInstagram.tsx`
- `src/components/GerenciarEventos.tsx`

---

### Task 1: adminTypes.ts — Tipos compartilhados e configuração dos grupos

**Files:**
- Create: `src/components/admin/adminTypes.ts`

- [ ] **Step 1: Criar adminTypes.ts com tipos, constantes e GROUPS**

```typescript
// src/components/admin/adminTypes.ts
import {
  BarChart3, Trophy, Network, ClipboardList, Eye, Users, Settings,
  UserCog, Building2, Calendar, Instagram, Hash,
} from 'lucide-react';

export type GroupId = 'visao-geral' | 'cadastros' | 'gestao' | 'digital';
export type ViewId =
  | 'ranking' | 'arvore'
  | 'registros' | 'fernanda' | 'social' | 'afiliados'
  | 'usuarios' | 'cidades' | 'eventos'
  | 'instagram' | 'mencoes';
export type Periodo = 'hoje' | 'semana' | 'mes' | 'total';
export type TipoFiltro = 'todos' | 'lideranca' | 'cabo' | 'eleitor' | 'fiscal';
export type TipoUsuarioFiltro = 'todos' | 'suplente' | 'lideranca' | 'coordenador' | 'fernanda' | 'social';

export interface Pessoa {
  nome: string; cpf: string | null; telefone: string | null; whatsapp: string | null;
  email: string | null; instagram: string | null; facebook: string | null;
  titulo_eleitor: string | null; zona_eleitoral: string | null; secao_eleitoral: string | null;
  municipio_eleitoral: string | null; uf_eleitoral: string | null;
  colegio_eleitoral: string | null; endereco_colegio: string | null;
}

export interface LiderancaReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; status: string | null; regiao_atuacao: string | null;
  tipo_lideranca: string | null; municipio_id: string | null; origem_captacao: string | null;
  apoiadores_estimados: number | null; meta_votos: number | null;
  nivel_comprometimento: string | null; observacoes: string | null;
  pessoas: Pessoa | null;
}

export interface EleitorReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; compromisso_voto: string | null;
  municipio_id: string | null; origem_captacao: string | null;
  observacoes: string | null; pessoas: Pessoa | null;
}

export interface FiscalReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; status: string | null; municipio_id: string | null;
  origem_captacao: string | null; zona_fiscal: string | null; secao_fiscal: string | null;
  colegio_eleitoral: string | null; observacoes: string | null; pessoas: Pessoa | null;
}

export interface HierarquiaUsuario {
  id: string; nome: string; tipo: string; suplente_id: string | null;
  municipio_id: string | null; ativo: boolean | null;
  superior_id: string | null; link_token: string | null;
}

export interface CadastroFernanda {
  id: string; nome: string; telefone: string; cidade: string | null;
  instagram: string | null; cadastrado_por: string | null; criado_em: string;
}

export interface CadastroSocial {
  id: string; nome: string; whatsapp: string; cpf: string | null;
  instagram: string | null; nome_mae: string | null; regiao: string | null;
  cadastrado_por: string | null; criado_em: string;
}

export interface Totais { l: number; c: number; e: number; f: number; total: number; }

export interface RankingEntry {
  id: string; nome: string; tipo: string; municipio_id: string | null;
  suplente_id: string | null; superior_id: string | null;
  total: number; l: number; c: number; e: number; f: number; fern: number; soc: number;
}

export interface RegistroEntry {
  tipo: string; pessoa: Pessoa | null; criado_em: string;
  cadastrado_por: string | null; suplente_id: string | null;
  suplente_nome?: string | null; lideranca_nome?: string | null; extra: string;
}

export interface PopupUserData {
  usuario: HierarquiaUsuario | undefined;
  liderancas: LiderancaReg[]; cabos: LiderancaReg[]; promotores: LiderancaReg[];
  eleitores: EleitorReg[]; fiscais: FiscalReg[];
  fernanda: CadastroFernanda[]; social: CadastroSocial[];
}

export const periodoLabels: Record<Periodo, string> = {
  hoje: 'Hoje', semana: 'Semana', mes: 'Mês', total: 'Total',
};
export const tipoFiltroLabels: Record<TipoFiltro, string> = {
  todos: 'Todos', lideranca: 'Lideranças', cabo: 'Cabos', eleitor: 'Eleitores', fiscal: 'Fiscais',
};
export const tipoUsuarioLabels: Record<TipoUsuarioFiltro, string> = {
  todos: 'Todos', suplente: 'Suplentes', lideranca: 'Lideranças',
  coordenador: 'Coordenadores', fernanda: 'Fernanda', social: 'Social',
};

export const tipoLabel = (t: string) => {
  const labels: Record<string, string> = {
    super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente',
    lideranca: 'Liderança', fernanda: 'Fernanda', afiliado: 'Afiliado',
    promotor: 'Promotor', social: 'Social', fiscal: 'Fiscal',
  };
  return labels[t] || t;
};

export interface ViewConfig { id: ViewId; label: string; icon: any; }
export interface GroupConfig { id: GroupId; label: string; icon: any; views: ViewConfig[]; }

export const GROUPS: GroupConfig[] = [
  {
    id: 'visao-geral', label: 'Visão Geral', icon: BarChart3,
    views: [
      { id: 'ranking', label: 'Ranking', icon: Trophy },
      { id: 'arvore', label: 'Árvore', icon: Network },
    ],
  },
  {
    id: 'cadastros', label: 'Cadastros', icon: ClipboardList,
    views: [
      { id: 'registros', label: 'Registros', icon: Eye },
      { id: 'fernanda', label: 'Fernanda', icon: ClipboardList },
      { id: 'social', label: 'Social', icon: Users },
      { id: 'afiliados', label: 'Afiliados', icon: Users },
    ],
  },
  {
    id: 'gestao', label: 'Gestão', icon: Settings,
    views: [
      { id: 'usuarios', label: 'Usuários', icon: UserCog },
      { id: 'cidades', label: 'Cidades', icon: Building2 },
      { id: 'eventos', label: 'Eventos', icon: Calendar },
    ],
  },
  {
    id: 'digital', label: 'Digital', icon: Instagram,
    views: [
      { id: 'instagram', label: 'Instagram', icon: Instagram },
      { id: 'mencoes', label: 'Menções', icon: Hash },
    ],
  },
];

export const groupOfView = (view: ViewId): GroupId =>
  GROUPS.find(g => g.views.some(v => v.id === view))!.id;

export const defaultViewOf = (group: GroupId): ViewId =>
  GROUPS.find(g => g.id === group)!.views[0].id;
```

- [ ] **Step 2: Verificar build**

```bash
cd c:\Users\Gusta\Desktop\Rede\rede_sarelli_v1.0 && npm run build 2>&1 | tail -5
```
Expected: build succeeds (ou falha somente por imports pendentes de outros arquivos — aceitável nesta etapa)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/adminTypes.ts
git commit -m "feat(admin): add shared types, constants and group config"
```

---

### Task 2: AdminStatsStrip.tsx — Cards de totais

**Files:**
- Create: `src/components/admin/AdminStatsStrip.tsx`

- [ ] **Step 1: Criar AdminStatsStrip.tsx**

```tsx
// src/components/admin/AdminStatsStrip.tsx
import { Periodo, Totais, periodoLabels } from './adminTypes';

interface Props {
  totais: Totais;
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  variant: 'full' | 'compact';
}

export default function AdminStatsStrip({ totais, periodo, onPeriodoChange, variant }: Props) {
  const stats = [
    { label: 'Lideranças', value: totais.l, color: 'text-primary bg-primary/10' },
    { label: 'Cabos',      value: totais.c, color: 'text-pink-600 bg-pink-500/10' },
    { label: 'Eleitores',  value: totais.e, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Fiscais',    value: totais.f, color: 'text-amber-600 bg-amber-500/10' },
  ];

  if (variant === 'full') {
    return (
      <div className="space-y-3 pb-2">
        <div className="grid grid-cols-4 gap-2">
          {stats.map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl py-3 px-1 text-center ${color}`}>
              <p className="text-2xl font-black leading-none">{value}</p>
              <p className="text-[10px] font-semibold mt-1 leading-tight">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(periodoLabels) as Periodo[]).map(p => (
            <button key={p} onClick={() => onPeriodoChange(p)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${
                periodo === p ? 'gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
              }`}>
              {periodoLabels[p]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {stats.map(({ label, value, color }) => (
          <span key={label} className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${color}`}>
            {label.slice(0, 3)}. {value}
          </span>
        ))}
      </div>
      <select
        value={periodo}
        onChange={e => onPeriodoChange(e.target.value as Periodo)}
        className="text-[11px] font-semibold bg-muted border border-border rounded-lg px-2 py-1 text-foreground outline-none"
      >
        {(Object.keys(periodoLabels) as Periodo[]).map(p => (
          <option key={p} value={p}>{periodoLabels[p]}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminStatsStrip.tsx
git commit -m "feat(admin): add AdminStatsStrip component"
```

---

### Task 3: AdminUserPopup.tsx — Modal de cadastros do usuário

**Files:**
- Create: `src/components/admin/AdminUserPopup.tsx`

O popup modal está atualmente inline em AdminDashboard.tsx nas linhas 1052–1207. Aqui é extraído para componente próprio.

- [ ] **Step 1: Criar AdminUserPopup.tsx**

```tsx
// src/components/admin/AdminUserPopup.tsx
import { X, MapPin, Users, Target, Shield, Loader2, Trash2 } from 'lucide-react';
import { PopupUserData, tipoLabel, LiderancaReg, EleitorReg, FiscalReg } from './adminTypes';

interface Props {
  popupUser: string | null;
  popupUserData: PopupUserData | null;
  onClose: () => void;
  getCargoTag: (supId: string | null) => string | null;
  nomeMunicipioPorId: (id: string | null | undefined) => string | undefined;
  deletingId: string | null;
  handleDeleteCadastro: (id: string, tipo: 'lideranca' | 'eleitor' | 'fiscal') => void;
}

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="text-[10px] bg-background rounded px-2 py-1">
    <span className="text-muted-foreground">{label}:</span>{' '}
    <span className={value ? 'text-foreground' : 'text-muted-foreground/50 italic'}>{value || '—'}</span>
  </div>
);

export default function AdminUserPopup({
  popupUser, popupUserData, onClose, getCargoTag, nomeMunicipioPorId, deletingId, handleDeleteCadastro,
}: Props) {
  if (!popupUser || !popupUserData) return null;

  const { usuario } = popupUserData;
  const totalCount =
    popupUserData.liderancas.length + popupUserData.cabos.length + popupUserData.promotores.length +
    popupUserData.eleitores.length + popupUserData.fiscais.length +
    popupUserData.fernanda.length + popupUserData.social.length;

  const allRecords = [
    ...popupUserData.liderancas.map(r => ({ ...r, _tipo: 'lideranca' as const })),
    ...popupUserData.cabos.map(r => ({ ...r, _tipo: 'cabo' as const })),
    ...popupUserData.promotores.map(r => ({ ...r, _tipo: 'promotor' as const })),
    ...popupUserData.eleitores.map(r => ({ ...r, _tipo: 'eleitor' as const })),
    ...popupUserData.fiscais.map(r => ({ ...r, _tipo: 'fiscal' as const })),
    ...popupUserData.fernanda.map(r => ({
      ...r, _tipo: 'fernanda' as const,
      pessoas: { nome: r.nome, whatsapp: r.telefone, email: null, instagram: r.instagram, facebook: null,
        cpf: null, telefone: null, titulo_eleitor: null, zona_eleitoral: null, secao_eleitoral: null,
        municipio_eleitoral: null, uf_eleitoral: null, colegio_eleitoral: null, endereco_colegio: null },
    })),
    ...popupUserData.social.map(r => ({
      ...r, _tipo: 'social' as const,
      pessoas: { nome: r.nome, whatsapp: r.whatsapp, email: null, instagram: r.instagram, facebook: null,
        cpf: null, telefone: null, titulo_eleitor: null, zona_eleitoral: null, secao_eleitoral: null,
        municipio_eleitoral: null, uf_eleitoral: null, colegio_eleitoral: null, endereco_colegio: null },
    })),
  ].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  const tipoBadge = (tipo: string) => {
    const map: Record<string, string> = {
      lideranca: 'bg-primary/15 text-primary', cabo: 'bg-pink-500/15 text-pink-600',
      fiscal: 'bg-amber-500/15 text-amber-600', promotor: 'bg-purple-500/15 text-purple-600',
      fernanda: 'bg-rose-500/15 text-rose-600', social: 'bg-teal-500/15 text-teal-600',
      eleitor: 'bg-secondary text-secondary-foreground',
    };
    return map[tipo] || 'bg-secondary text-secondary-foreground';
  };
  const tipoName = (tipo: string) => ({
    lideranca: 'Liderança', cabo: 'Cabo', fiscal: 'Fiscal', promotor: 'Promotor',
    fernanda: 'Fernanda', social: 'Social', eleitor: 'Eleitor',
  }[tipo] || tipo);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{usuario?.nome?.charAt(0) || '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground truncate">{usuario?.nome || 'Desconhecido'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">{tipoLabel(usuario?.tipo || '')}</span>
              {getCargoTag(usuario?.suplente_id || null) && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/50 text-accent-foreground font-medium">{getCargoTag(usuario?.suplente_id || null)}</span>
              )}
              {usuario?.municipio_id && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin size={9} />{nomeMunicipioPorId(usuario.municipio_id)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right mr-2">
            <p className="text-2xl font-black text-primary">{totalCount}</p>
            <p className="text-[9px] text-muted-foreground">cadastros</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted active:scale-95">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-border shrink-0">
          {[
            { data: popupUserData.liderancas, label: 'Lideranças', cls: 'bg-primary/15 text-primary', Icon: Users },
            { data: popupUserData.cabos, label: 'Cabos', cls: 'bg-pink-500/15 text-pink-600', Icon: Users },
            { data: popupUserData.eleitores, label: 'Eleitores', cls: 'bg-secondary text-secondary-foreground', Icon: Target },
            { data: popupUserData.fiscais, label: 'Fiscais', cls: 'bg-amber-500/15 text-amber-600', Icon: Shield },
            { data: popupUserData.promotores, label: 'Promotores', cls: 'bg-purple-500/15 text-purple-600', Icon: Users },
            { data: popupUserData.fernanda, label: 'Fernanda', cls: 'bg-rose-500/15 text-rose-600', Icon: Users },
            { data: popupUserData.social, label: 'Social', cls: 'bg-teal-500/15 text-teal-600', Icon: Users },
          ].filter(({ data }) => data.length > 0).map(({ data, label, cls, Icon }) => (
            <span key={label} className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cls}`}>
              <Icon size={12} className="inline mr-1" />{label}: {data.length}
            </span>
          ))}
        </div>

        {/* Records list */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2">
          {allRecords.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro no período selecionado</p>
          )}
          {allRecords.map((r: any) => {
            const p = r.pessoas || {};
            return (
              <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${tipoBadge(r._tipo)}`}>
                      {tipoName(r._tipo)}
                    </span>
                    <p className="text-sm font-semibold text-foreground">{p.nome || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                    {(r._tipo === 'lideranca' || r._tipo === 'cabo' || r._tipo === 'eleitor' || r._tipo === 'fiscal') && (
                      <button
                        onClick={() => handleDeleteCadastro(r.id, r._tipo === 'eleitor' ? 'eleitor' : (r._tipo === 'cabo' ? 'lideranca' : r._tipo))}
                        disabled={deletingId === r.id}
                        className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Field label="CPF" value={p.cpf} />
                  <Field label="WhatsApp" value={p.whatsapp} />
                  <Field label="E-mail" value={p.email} />
                  <Field label="Instagram" value={p.instagram || p.facebook} />
                </div>
                {(r._tipo === 'lideranca' || r._tipo === 'cabo') && (
                  <div className="grid grid-cols-2 gap-1">
                    <Field label="Região" value={r.regiao_atuacao} />
                    <Field label="Comprometimento" value={r.nivel_comprometimento} />
                    <Field label="Apoiadores" value={r.apoiadores_estimados} />
                    <Field label="Meta votos" value={r.meta_votos} />
                  </div>
                )}
                {r._tipo === 'eleitor' && <div className="grid grid-cols-2 gap-1"><Field label="Compromisso" value={r.compromisso_voto} /></div>}
                {r._tipo === 'fiscal' && (
                  <div className="grid grid-cols-2 gap-1">
                    <Field label="Zona fiscal" value={r.zona_fiscal} />
                    <Field label="Seção fiscal" value={r.secao_fiscal} />
                    <Field label="Colégio" value={r.colegio_eleitoral} />
                  </div>
                )}
                {r.observacoes && <Field label="Observações" value={r.observacoes} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminUserPopup.tsx
git commit -m "feat(admin): extract user popup modal into AdminUserPopup"
```

---

### Task 4: AdminSidebar.tsx — Sidebar desktop

**Files:**
- Create: `src/components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Criar AdminSidebar.tsx**

```tsx
// src/components/admin/AdminSidebar.tsx
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { GroupId, ViewId, GROUPS } from './adminTypes';

interface Props {
  activeGroup: GroupId;
  activeView: ViewId;
  onGroupChange: (g: GroupId) => void;
  onViewChange: (v: ViewId) => void;
}

export default function AdminSidebar({ activeGroup, activeView, onGroupChange, onViewChange }: Props) {
  const navigate = useNavigate();

  return (
    <aside className="hidden md:flex w-60 shrink-0 h-full border-r border-border bg-background flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div>
          <p className="text-sm font-bold text-foreground">Painel Admin</p>
          <p className="text-[10px] text-muted-foreground">Visão completa da rede</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {GROUPS.map(group => {
          const GroupIcon = group.icon;
          const isActiveGroup = activeGroup === group.id;
          return (
            <div key={group.id}>
              <button
                onClick={() => onGroupChange(group.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  isActiveGroup
                    ? 'gradient-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <GroupIcon size={16} />
                {group.label}
              </button>

              {isActiveGroup && group.views.length > 1 && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
                  {group.views.map(view => {
                    const ViewIcon = view.icon;
                    const isActive = activeView === view.id;
                    return (
                      <button
                        key={view.id}
                        onClick={() => onViewChange(view.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all active:scale-[0.98] ${
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <ViewIcon size={13} />
                        {view.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border shrink-0">
        <button
          onClick={() => navigate('/gestao')}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-all hover:bg-primary/20"
        >
          <Settings size={14} />
          Acessar Gestão App
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminSidebar.tsx
git commit -m "feat(admin): add AdminSidebar desktop component"
```

---

### Task 5: AdminBottomNav.tsx + AdminSubNav.tsx — Navegação mobile

**Files:**
- Create: `src/components/admin/AdminBottomNav.tsx`
- Create: `src/components/admin/AdminSubNav.tsx`

- [ ] **Step 1: Criar AdminBottomNav.tsx**

```tsx
// src/components/admin/AdminBottomNav.tsx
import { GroupId, ViewId, GROUPS } from './adminTypes';

interface Props {
  activeGroup: GroupId;
  onGroupChange: (g: GroupId) => void;
}

export default function AdminBottomNav({ activeGroup, onGroupChange }: Props) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border">
      <div className="flex">
        {GROUPS.map(group => {
          const Icon = group.icon;
          const isActive = activeGroup === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onGroupChange(group.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all active:scale-95 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
              <span className={`text-[9px] font-semibold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {group.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Criar AdminSubNav.tsx**

```tsx
// src/components/admin/AdminSubNav.tsx
import { GroupId, ViewId, GROUPS } from './adminTypes';

interface Props {
  activeGroup: GroupId;
  activeView: ViewId;
  onViewChange: (v: ViewId) => void;
}

export default function AdminSubNav({ activeGroup, activeView, onViewChange }: Props) {
  const group = GROUPS.find(g => g.id === activeGroup);
  if (!group || group.views.length <= 1) return null;

  return (
    <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide">
      {group.views.map(view => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 ${
              isActive ? 'gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon size={12} />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminBottomNav.tsx src/components/admin/AdminSubNav.tsx
git commit -m "feat(admin): add AdminBottomNav and AdminSubNav mobile components"
```

---

### Task 6: AdminShell.tsx — Layout wrapper responsivo

**Files:**
- Create: `src/components/admin/AdminShell.tsx`

- [ ] **Step 1: Criar AdminShell.tsx**

```tsx
// src/components/admin/AdminShell.tsx
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { GroupId, ViewId } from './adminTypes';
import AdminSidebar from './AdminSidebar';
import AdminBottomNav from './AdminBottomNav';
import AdminSubNav from './AdminSubNav';

interface Props {
  activeGroup: GroupId;
  activeView: ViewId;
  onGroupChange: (g: GroupId) => void;
  onViewChange: (v: ViewId) => void;
  children: React.ReactNode;
}

export default function AdminShell({ activeGroup, activeView, onGroupChange, onViewChange, children }: Props) {
  const navigate = useNavigate();

  return (
    <div className="h-dvh flex overflow-hidden bg-background">
      <div className="h-[1.5px] gradient-header absolute top-0 left-0 right-0 z-50 pointer-events-none" />

      {/* Desktop sidebar */}
      <AdminSidebar
        activeGroup={activeGroup}
        activeView={activeView}
        onGroupChange={onGroupChange}
        onViewChange={onViewChange}
      />

      {/* Main content column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            <button onClick={() => navigate('/')} className="p-1.5 rounded-xl hover:bg-muted active:scale-95 transition-all shrink-0">
              <ArrowLeft size={20} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-foreground leading-tight">Painel Admin</h1>
              <p className="text-[10px] text-muted-foreground">Visão completa da rede</p>
            </div>
            <button
              onClick={() => navigate('/gestao')}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-all"
            >
              <Settings size={12} /> Gestão
            </button>
          </div>
          <AdminSubNav
            activeGroup={activeGroup}
            activeView={activeView}
            onViewChange={onViewChange}
          />
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-3 pb-28 md:pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <AdminBottomNav
        activeGroup={activeGroup}
        onGroupChange={onGroupChange}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminShell.tsx
git commit -m "feat(admin): add AdminShell responsive layout wrapper"
```

---

### Task 7: AdminRanking.tsx — View de ranking

**Files:**
- Create: `src/components/admin/views/AdminRanking.tsx`

Esta view contém o código do bloco `{vistaAtiva === 'ranking' && ...}` extraído do AdminDashboard original (linhas 613–885), adaptado para receber props.

- [ ] **Step 1: Criar src/components/admin/views/AdminRanking.tsx**

```tsx
// src/components/admin/views/AdminRanking.tsx
import { Search, Network, Users, Target, Shield, Download, Loader2, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import {
  RankingEntry, LiderancaReg, EleitorReg, FiscalReg, CadastroFernanda, CadastroSocial,
  TipoFiltro, TipoUsuarioFiltro, PopupUserData,
  tipoFiltroLabels, tipoUsuarioLabels, tipoLabel,
} from '../adminTypes';
import AdminStatsStrip from '../AdminStatsStrip';
import type { Periodo, Totais } from '../adminTypes';
import SeletorCidade from '@/components/SeletorCidade';
import SeletorEvento from '@/components/SeletorEvento';

interface Props {
  rankingUsuarios: RankingEntry[];
  filteredL: LiderancaReg[];
  filteredE: EleitorReg[];
  filteredF: FiscalReg[];
  filteredFern: CadastroFernanda[];
  filteredSocial: CadastroSocial[];
  rankingTipoUsuario: TipoUsuarioFiltro;
  onRankingTipoUsuarioChange: (v: TipoUsuarioFiltro) => void;
  rankingSearch: string;
  onRankingSearchChange: (v: string) => void;
  tipoFiltro: TipoFiltro;
  onTipoFiltroChange: (v: TipoFiltro) => void;
  totais: Totais;
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  onPopupUserOpen: (id: string) => void;
  getCargoTag: (supId: string | null) => string | null;
  getUserName: (id: string | null) => string;
  exporting: boolean;
  handleExport: (tipo?: 'lideranca' | 'eleitor' | 'fiscal', byId?: string, byNome?: string) => void;
  showCidadeSelector: boolean;
}

export default function AdminRanking({
  rankingUsuarios, filteredL, filteredE, filteredF, filteredFern, filteredSocial,
  rankingTipoUsuario, onRankingTipoUsuarioChange,
  rankingSearch, onRankingSearchChange,
  tipoFiltro, onTipoFiltroChange,
  totais, periodo, onPeriodoChange,
  onPopupUserOpen, getCargoTag, getUserName,
  exporting, handleExport, showCidadeSelector,
}: Props) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedTipo, setExpandedTipo] = useState<string | null>(null);

  let filtered = rankingUsuarios;
  if (rankingTipoUsuario !== 'todos') filtered = filtered.filter(u => u.tipo === rankingTipoUsuario);
  if (tipoFiltro === 'lideranca') filtered = filtered.filter(u => u.l > 0);
  else if (tipoFiltro === 'cabo') filtered = filtered.filter(u => u.c > 0);
  else if (tipoFiltro === 'eleitor') filtered = filtered.filter(u => u.e > 0);
  else if (tipoFiltro === 'fiscal') filtered = filtered.filter(u => u.f > 0);
  if (rankingSearch) {
    const s = rankingSearch.toLowerCase();
    filtered = filtered.filter(u => u.nome.toLowerCase().includes(s) || (getCargoTag(u.suplente_id) || '').toLowerCase().includes(s));
  }
  const maxTotal = filtered.length > 0 ? Math.max(...filtered.map(u => u.total), 1) : 1;
  const showPodium = !rankingSearch && rankingTipoUsuario === 'todos' && tipoFiltro === 'todos' && filtered.length >= 3;

  return (
    <div className="space-y-3">
      <AdminStatsStrip totais={totais} periodo={periodo} onPeriodoChange={onPeriodoChange} variant="full" />

      {showCidadeSelector && <SeletorCidade />}
      <SeletorEvento />

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar usuário..." value={rankingSearch} onChange={e => onRankingSearchChange(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
      </div>

      {/* Filtro tipo usuário */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(tipoUsuarioLabels) as TipoUsuarioFiltro[]).map(t => (
          <button key={t} onClick={() => onRankingTipoUsuarioChange(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
              rankingTipoUsuario === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>{tipoUsuarioLabels[t]}</button>
        ))}
      </div>

      {/* Filtro tipo cadastro */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(tipoFiltroLabels) as TipoFiltro[]).map(t => (
          <button key={t} onClick={() => onTipoFiltroChange(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
              tipoFiltro === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
            }`}>{tipoFiltroLabels[t]}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado</p>
      ) : (
        <div className="space-y-2">
          {/* Podium (top 3) */}
          {showPodium && (
            <div className="space-y-2 mb-3">
              {filtered.slice(0, 3).map((u, i) => {
                const styles = [
                  { gradient: 'from-yellow-500/20 via-amber-400/10 to-transparent', border: 'border-yellow-400/40', medal: '🥇', numColor: 'text-yellow-600' },
                  { gradient: 'from-slate-400/15 via-gray-300/10 to-transparent', border: 'border-slate-300/40', medal: '🥈', numColor: 'text-slate-500' },
                  { gradient: 'from-amber-700/15 via-orange-400/10 to-transparent', border: 'border-amber-600/30', medal: '🥉', numColor: 'text-amber-700' },
                ][i];
                return (
                  <div key={u.id} onClick={() => onPopupUserOpen(u.id)}
                    className={`relative flex items-center gap-3 p-3 rounded-xl border ${styles.border} bg-gradient-to-r ${styles.gradient} cursor-pointer hover:shadow-md transition-all active:scale-[0.98]`}
                  >
                    <span className="text-lg shrink-0">{styles.medal}</span>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{u.nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{tipoLabel(u.tipo)}</span>
                        {u.superior_id && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 font-bold flex items-center gap-0.5">
                            <Network size={8} />{getUserName(u.superior_id)}
                          </span>
                        )}
                        <div className="flex gap-1">
                          {u.l > 0 && <span className="text-[8px] font-semibold text-primary/70">Lid. {u.l}</span>}
                          {u.c > 0 && <span className="text-[8px] font-semibold text-pink-600/70">Cabos {u.c}</span>}
                          {u.e > 0 && <span className="text-[8px] font-semibold text-muted-foreground">Eleit. {u.e}</span>}
                          {u.f > 0 && <span className="text-[8px] font-semibold text-amber-600/70">Fisc. {u.f}</span>}
                        </div>
                      </div>
                    </div>
                    <p className={`text-2xl font-black ${styles.numColor} shrink-0`}>{u.total}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rest of ranking */}
          {filtered.slice(showPodium ? 3 : 0).map((u, i) => {
            const pos = showPodium ? i + 3 : i;
            const pct = maxTotal > 0 ? Math.round((u.total / maxTotal) * 100) : 0;
            const isExpanded = expandedUser === u.id;
            const uLiderancas = filteredL.filter(r => r.cadastrado_por === u.id && r.tipo_lideranca !== 'Cabo Eleitoral');
            const uCabos = filteredL.filter(r => r.cadastrado_por === u.id && r.tipo_lideranca === 'Cabo Eleitoral');
            const uEleitores = filteredE.filter(r => r.cadastrado_por === u.id);
            const uFiscais = filteredF.filter(r => r.cadastrado_por === u.id);
            const uFernanda = filteredFern.filter(r => r.cadastrado_por === u.id);
            const uSocial = filteredSocial.filter(r => r.cadastrado_por === u.id);
            const isFernanda = u.tipo === 'fernanda';
            const isSocial = u.tipo === 'social';

            return (
              <div key={u.id} className="section-card !p-0 overflow-hidden">
                <button onClick={() => { setExpandedUser(isExpanded ? null : u.id); setExpandedTipo(null); }}
                  className="w-full text-left relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-primary/[0.06] transition-all duration-500" style={{ width: `${pct}%` }} />
                  <div className="relative p-3 flex items-center gap-2.5">
                    <span className="text-sm font-bold text-muted-foreground w-7 text-center shrink-0">{pos + 1}º</span>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{tipoLabel(u.tipo)}</span>
                        <div className="flex gap-1">
                          {u.l > 0 && <span className="text-[8px] font-semibold text-primary/70">Lid. {u.l}</span>}
                          {u.c > 0 && <span className="text-[8px] font-semibold text-pink-600/70">Cabos {u.c}</span>}
                          {u.e > 0 && <span className="text-[8px] font-semibold text-muted-foreground">Eleit. {u.e}</span>}
                          {u.f > 0 && <span className="text-[8px] font-semibold text-amber-600/70">Fisc. {u.f}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-primary">{u.total}</p>
                      <p className="text-[8px] text-muted-foreground">cadastros</p>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                    {isFernanda ? (
                      <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">🩷 Cadastros Fernanda ({uFernanda.length})</span>
                        {uFernanda.map(c => (
                          <div key={c.id} className="p-3 rounded-xl bg-muted/50 border border-border/50">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : isSocial ? (
                      <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider">🌐 Cadastros Social ({uSocial.length})</span>
                        {uSocial.map(c => (
                          <div key={c.id} className="p-3 rounded-xl bg-muted/50 border border-border/50">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
                            </div>
                            {c.whatsapp && <p className="text-[10px] text-muted-foreground">{c.whatsapp}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: 'lideranca', label: 'Lideranças', count: uLiderancas.length, icon: Users },
                            { key: 'cabo', label: 'Cabos', count: uCabos.length, icon: Users },
                            { key: 'eleitor', label: 'Eleitores', count: uEleitores.length, icon: Target },
                            { key: 'fiscal', label: 'Fiscais', count: uFiscais.length, icon: Shield },
                          ].map(({ key, label, count, icon: Icon }) => (
                            <button key={key}
                              onClick={() => setExpandedTipo(expandedTipo === key ? null : key)}
                              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                                expandedTipo === key ? 'border-primary bg-primary/5' : 'border-border bg-card'
                              }`}
                            >
                              <Icon size={14} className={expandedTipo === key ? 'text-primary' : 'text-muted-foreground'} />
                              <span className="text-lg font-bold text-foreground">{count}</span>
                              <span className="text-[9px] text-muted-foreground">{label}</span>
                            </button>
                          ))}
                        </div>
                        {expandedTipo && (() => {
                          const records = expandedTipo === 'lideranca' ? uLiderancas : expandedTipo === 'cabo' ? uCabos : expandedTipo === 'fiscal' ? uFiscais : uEleitores;
                          if (records.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro</p>;
                          return (
                            <div className="space-y-1.5 max-h-96 overflow-y-auto">
                              {records.map((r: any) => {
                                const p = r.pessoas || {};
                                return (
                                  <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                                    <div className="flex items-start justify-between">
                                      <p className="text-sm font-semibold text-foreground">{p.nome || '—'}</p>
                                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    {(expandedTipo === 'lideranca' || expandedTipo === 'cabo') && (
                                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                                        <span className="bg-background rounded px-2 py-1"><span className="text-muted-foreground">Região:</span> {r.regiao_atuacao || '—'}</span>
                                        <span className="bg-background rounded px-2 py-1"><span className="text-muted-foreground">Apoiadores:</span> {r.apoiadores_estimados || '—'}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => onPopupUserOpen(u.id)}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold active:scale-95">
                        <Eye size={12} /> Ver detalhes
                      </button>
                      <button onClick={() => handleExport(undefined, u.id, u.nome)} disabled={exporting}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-card border border-border rounded-xl text-xs font-medium active:scale-95 disabled:opacity-50">
                        {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        Exportar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => handleExport(tipoFiltro === 'todos' ? undefined : tipoFiltro as any)} disabled={exporting}
        className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium active:scale-[0.97] disabled:opacity-50">
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Exportar Todos (Excel)
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/views/AdminRanking.tsx
git commit -m "feat(admin): extract AdminRanking view component"
```

---

### Task 8: AdminRegistros.tsx — View de registros

**Files:**
- Create: `src/components/admin/views/AdminRegistros.tsx`

- [ ] **Step 1: Criar AdminRegistros.tsx**

```tsx
// src/components/admin/views/AdminRegistros.tsx
import { Search, Download, Loader2 } from 'lucide-react';
import { RegistroEntry, TipoFiltro, Totais, Periodo, tipoFiltroLabels } from '../adminTypes';
import AdminStatsStrip from '../AdminStatsStrip';
import SeletorCidade from '@/components/SeletorCidade';
import SeletorEvento from '@/components/SeletorEvento';

interface Props {
  allRegistros: RegistroEntry[];
  tipoFiltro: TipoFiltro;
  onTipoFiltroChange: (v: TipoFiltro) => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  totais: Totais;
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  getUserName: (id: string | null) => string;
  getCargoTag: (supId: string | null) => string | null;
  exporting: boolean;
  handleExport: (tipo?: 'lideranca' | 'eleitor' | 'fiscal') => void;
  showCidadeSelector: boolean;
}

export default function AdminRegistros({
  allRegistros, tipoFiltro, onTipoFiltroChange, searchTerm, onSearchChange,
  totais, periodo, onPeriodoChange, getUserName, getCargoTag, exporting, handleExport, showCidadeSelector,
}: Props) {
  return (
    <div className="space-y-3">
      <AdminStatsStrip totais={totais} periodo={periodo} onPeriodoChange={onPeriodoChange} variant="compact" />
      {showCidadeSelector && <SeletorCidade />}
      <SeletorEvento />

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por nome, CPF, cargo..." value={searchTerm} onChange={e => onSearchChange(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(tipoFiltroLabels) as TipoFiltro[]).map(t => (
          <button key={t} onClick={() => onTipoFiltroChange(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
              tipoFiltro === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>{tipoFiltroLabels[t]}</button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{allRegistros.length} registros</p>

      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {allRegistros.map((r, i) => (
          <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-card border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{r.pessoa?.nome || '—'}</p>
              {(r.suplente_nome || r.lideranca_nome) && (
                <p className="text-[10px] text-primary/70 truncate">
                  🔗 {r.suplente_nome || r.lideranca_nome} {getCargoTag(r.suplente_id) && `(${getCargoTag(r.suplente_id)})`}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                <span>{r.pessoa?.cpf || 'Sem CPF'}</span>
                <span>{r.pessoa?.telefone || 'Sem tel.'}</span>
                {r.extra && <span>{r.extra}</span>}
              </div>
              <p className="text-[9px] text-primary/70 mt-0.5">
                Por: {getUserName(r.cadastrado_por)} · {new Date(r.criado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              r.tipo === 'lideranca' ? 'bg-primary/10 text-primary'
              : r.tipo === 'cabo' ? 'bg-pink-500/15 text-pink-600'
              : r.tipo === 'fiscal' ? 'bg-amber-500/15 text-amber-600'
              : 'bg-secondary text-secondary-foreground'
            }`}>
              {r.tipo === 'lideranca' ? 'Liderança' : r.tipo === 'cabo' ? 'Cabo' : r.tipo === 'fiscal' ? 'Fiscal' : 'Eleitor'}
            </span>
          </div>
        ))}
        {allRegistros.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
        )}
      </div>

      <button onClick={() => handleExport(tipoFiltro === 'todos' ? undefined : tipoFiltro as any)} disabled={exporting}
        className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium active:scale-[0.97] disabled:opacity-50">
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Exportar {tipoFiltro === 'todos' ? 'Todos' : tipoFiltroLabels[tipoFiltro]} (Excel)
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/views/AdminRegistros.tsx
git commit -m "feat(admin): extract AdminRegistros view component"
```

---

### Task 9: AdminUsuarios.tsx — View de usuários

**Files:**
- Create: `src/components/admin/views/AdminUsuarios.tsx`

- [ ] **Step 1: Criar AdminUsuarios.tsx**

```tsx
// src/components/admin/views/AdminUsuarios.tsx
import { Search, Users, Target, Shield, ChevronDown, ChevronUp, MapPin, Eye, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  HierarquiaUsuario, LiderancaReg, EleitorReg, FiscalReg,
  TipoUsuarioFiltro, Totais, Periodo, tipoUsuarioLabels, tipoLabel,
} from '../adminTypes';
import AdminStatsStrip from '../AdminStatsStrip';
import SeletorCidade from '@/components/SeletorCidade';

interface Props {
  filteredUsers: HierarquiaUsuario[];
  tipoUsuarioFiltro: TipoUsuarioFiltro;
  onTipoUsuarioFiltroChange: (v: TipoUsuarioFiltro) => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  filteredL: LiderancaReg[];
  filteredE: EleitorReg[];
  filteredF: FiscalReg[];
  totais: Totais;
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  onPopupUserOpen: (id: string) => void;
  getCargoTag: (supId: string | null) => string | null;
  nomeMunicipioPorId: (id: string | null | undefined) => string | undefined;
  exporting: boolean;
  deletingId: string | null;
  handleExport: (tipo?: 'lideranca' | 'eleitor' | 'fiscal', byId?: string, byNome?: string) => void;
  handleDeleteUser?: (id: string) => void;
  showCidadeSelector: boolean;
}

export default function AdminUsuarios({
  filteredUsers, tipoUsuarioFiltro, onTipoUsuarioFiltroChange,
  searchTerm, onSearchChange,
  filteredL, filteredE, filteredF,
  totais, periodo, onPeriodoChange,
  onPopupUserOpen, getCargoTag, nomeMunicipioPorId,
  exporting, deletingId, handleExport, showCidadeSelector,
}: Props) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedTipo, setExpandedTipo] = useState<string | null>(null);

  const userCadastros = expandedUser ? {
    liderancas: filteredL.filter(r => r.cadastrado_por === expandedUser && r.tipo_lideranca !== 'Cabo Eleitoral'),
    cabos: filteredL.filter(r => r.cadastrado_por === expandedUser && r.tipo_lideranca === 'Cabo Eleitoral'),
    eleitores: filteredE.filter(r => r.cadastrado_por === expandedUser),
    fiscais: filteredF.filter(r => r.cadastrado_por === expandedUser),
  } : null;

  return (
    <div className="space-y-3">
      <AdminStatsStrip totais={totais} periodo={periodo} onPeriodoChange={onPeriodoChange} variant="compact" />
      {showCidadeSelector && <SeletorCidade />}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar usuário..." value={searchTerm} onChange={e => onSearchChange(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(tipoUsuarioLabels) as TipoUsuarioFiltro[]).map(t => (
          <button key={t} onClick={() => onTipoUsuarioFiltroChange(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
              tipoUsuarioFiltro === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>{tipoUsuarioLabels[t]}</button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}</p>

      {filteredUsers.map(u => {
        const uL = filteredL.filter(r => r.cadastrado_por === u.id && r.tipo_lideranca !== 'Cabo Eleitoral');
        const uC = filteredL.filter(r => r.cadastrado_por === u.id && r.tipo_lideranca === 'Cabo Eleitoral');
        const uE = filteredE.filter(r => r.cadastrado_por === u.id);
        const uF = filteredF.filter(r => r.cadastrado_por === u.id);
        const total = uL.length + uC.length + uE.length + uF.length;
        const isExpanded = expandedUser === u.id;
        const cityName = nomeMunicipioPorId(u.municipio_id);

        return (
          <div key={u.id} className="section-card !p-0 overflow-hidden">
            <button onClick={() => { setExpandedUser(isExpanded ? null : u.id); setExpandedTipo(null); }}
              className="w-full text-left p-3 flex items-center gap-3 active:bg-muted/50 transition-all">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">{tipoLabel(u.tipo)}</span>
                  {getCargoTag(u.suplente_id) && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-accent/50 text-accent-foreground font-medium">{getCargoTag(u.suplente_id)}</span>
                  )}
                  {cityName && (
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <MapPin size={8} />{cityName}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-primary">{total}</p>
                <p className="text-[8px] text-muted-foreground">cadastros</p>
              </div>
              {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
            </button>

            {isExpanded && userCadastros && (
              <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'lideranca', label: 'Lideranças', count: userCadastros.liderancas.length, icon: Users },
                    { key: 'cabo', label: 'Cabos', count: userCadastros.cabos.length, icon: Users },
                    { key: 'eleitor', label: 'Eleitores', count: userCadastros.eleitores.length, icon: Target },
                    { key: 'fiscal', label: 'Fiscais', count: userCadastros.fiscais.length, icon: Shield },
                  ].map(({ key, label, count, icon: Icon }) => (
                    <button key={key}
                      onClick={() => setExpandedTipo(expandedTipo === key ? null : key)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                        expandedTipo === key ? 'border-primary bg-primary/5' : 'border-border bg-card'
                      }`}
                    >
                      <Icon size={14} className={expandedTipo === key ? 'text-primary' : 'text-muted-foreground'} />
                      <span className="text-lg font-bold text-foreground">{count}</span>
                      <span className="text-[9px] text-muted-foreground">{label}</span>
                    </button>
                  ))}
                </div>
                {expandedTipo && (() => {
                  const records = expandedTipo === 'lideranca' ? userCadastros.liderancas
                    : expandedTipo === 'cabo' ? userCadastros.cabos
                    : expandedTipo === 'fiscal' ? userCadastros.fiscais
                    : userCadastros.eleitores;
                  if (records.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro</p>;
                  return (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto">
                      {records.map((r: any) => {
                        const p = r.pessoas || {};
                        return (
                          <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-semibold text-foreground">{p.nome || '—'}</p>
                              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <span className="bg-background rounded px-2 py-1"><span className="text-muted-foreground">CPF:</span> {p.cpf || '—'}</span>
                              <span className="bg-background rounded px-2 py-1"><span className="text-muted-foreground">WhatsApp:</span> {p.whatsapp || '—'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => onPopupUserOpen(u.id)}
                    className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold active:scale-95">
                    <Eye size={12} /> Ver detalhes
                  </button>
                  <button onClick={() => handleExport(undefined, u.id, u.nome)} disabled={exporting}
                    className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-card border border-border rounded-xl text-xs font-medium active:scale-95 disabled:opacity-50">
                    {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Exportar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={() => handleExport()} disabled={exporting}
        className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium active:scale-[0.97] disabled:opacity-50">
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Exportar Todos (Excel)
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/views/AdminUsuarios.tsx
git commit -m "feat(admin): extract AdminUsuarios view component"
```

---

### Task 10: AdminCidades.tsx — View de cidades

**Files:**
- Create: `src/components/admin/views/AdminCidades.tsx`

- [ ] **Step 1: Criar AdminCidades.tsx**

```tsx
// src/components/admin/views/AdminCidades.tsx
import { Building2, Users, Target, Shield, Plus } from 'lucide-react';
import { HierarquiaUsuario, LiderancaReg, EleitorReg, FiscalReg } from '../adminTypes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCidade } from '@/contexts/CidadeContext';

interface Municipio { id: string; nome: string; uf: string; }

interface Props {
  municipios: Municipio[];
  usuarios: HierarquiaUsuario[];
  liderancas: LiderancaReg[];
  eleitores: EleitorReg[];
  fiscais: FiscalReg[];
  onNavigateToUsuarios: () => void;
}

export default function AdminCidades({ municipios, usuarios, liderancas, eleitores, fiscais, onNavigateToUsuarios }: Props) {
  const { setCidadeAtiva } = useCidade();

  const handleAddCidade = async () => {
    const input = document.getElementById('nova-cidade-input') as HTMLInputElement;
    const nome = input?.value?.trim();
    if (!nome) return;
    const { error } = await (supabase as any).from('municipios').insert({ nome, uf: 'GO' });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `✅ ${nome} adicionada!` });
    input.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="text" id="nova-cidade-input" placeholder="Nome da nova cidade..."
          className="flex-1 h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
        <button onClick={handleAddCidade}
          className="h-10 px-4 gradient-primary text-white rounded-xl text-sm font-semibold flex items-center gap-1 active:scale-95">
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {municipios.map(m => {
        const userCount = usuarios.filter(u => u.municipio_id === m.id).length;
        const lidCount = liderancas.filter(l => l.municipio_id === m.id && l.tipo_lideranca !== 'Cabo Eleitoral').length;
        const caboCount = liderancas.filter(l => l.municipio_id === m.id && l.tipo_lideranca === 'Cabo Eleitoral').length;
        const eleCount = eleitores.filter(e => e.municipio_id === m.id).length;
        const fisCount = fiscais.filter(f => f.municipio_id === m.id).length;

        return (
          <div key={m.id} className="section-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-primary" />
                <div>
                  <p className="text-sm font-bold text-foreground">{m.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{m.uf} · {userCount} usuários</p>
                </div>
              </div>
              <button onClick={() => { setCidadeAtiva({ id: m.id, nome: m.nome }); onNavigateToUsuarios(); }}
                className="text-[10px] text-primary font-semibold px-2 py-1 rounded-lg bg-primary/5 active:scale-95">
                Ver →
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-border">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Users size={10} /> {lidCount} Lid.</span>
              <span className="flex items-center gap-1 text-[10px] text-pink-600/70"><Users size={10} /> {caboCount} Cab.</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Target size={10} /> {eleCount} Ele.</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Shield size={10} /> {fisCount} Fis.</span>
              <span className="ml-auto text-xs font-bold text-primary">{lidCount + caboCount + eleCount + fisCount} total</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/views/AdminCidades.tsx
git commit -m "feat(admin): extract AdminCidades view component"
```

---

### Task 11: AdminDashboard.tsx — Reescrita como orquestrador

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

Esta é a etapa final. O arquivo atual (1211 linhas) é substituído por um orquestrador que mantém todo o estado e lógica mas delega o layout ao `AdminShell` e o rendering de cada view aos novos componentes.

- [ ] **Step 1: Substituir AdminDashboard.tsx pelo novo orquestrador**

```tsx
// src/pages/AdminDashboard.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLiderancas, useEleitores, useUsuarios, useFiscaisAdmin, useRealtimeSync } from '@/hooks/useDataCache';
import { useQueryClient } from '@tanstack/react-query';
import { exportCadastrosFiltered } from '@/lib/exportXlsx';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';

import {
  GroupId, ViewId, Periodo, TipoFiltro, TipoUsuarioFiltro,
  LiderancaReg, EleitorReg, FiscalReg, HierarquiaUsuario,
  CadastroFernanda, CadastroSocial, Totais, RankingEntry, RegistroEntry, PopupUserData,
  GROUPS, defaultViewOf, tipoLabel,
} from '@/components/admin/adminTypes';

import AdminShell from '@/components/admin/AdminShell';
import AdminStatsStrip from '@/components/admin/AdminStatsStrip';
import AdminUserPopup from '@/components/admin/AdminUserPopup';
import AdminRanking from '@/components/admin/views/AdminRanking';
import AdminRegistros from '@/components/admin/views/AdminRegistros';
import AdminUsuarios from '@/components/admin/views/AdminUsuarios';
import AdminCidades from '@/components/admin/views/AdminCidades';

import TabArvore from '@/components/TabArvore';
import GerenciarEventos from '@/components/GerenciarEventos';

const AdminCadastrosFernanda = lazy(() => import('@/components/AdminCadastrosFernanda'));
const TabCadastrosSocial = lazy(() => import('@/components/TabCadastrosSocial'));
const AdminCadastrosAfiliados = lazy(() => import('@/components/AdminCadastrosAfiliados'));
const AdminInstagramPanel = lazy(() => import('@/components/AdminInstagramPanel'));
const AdminMencoesInstagram = lazy(() => import('@/components/AdminMencoesInstagram'));

const LazyFallback = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 size={28} className="animate-spin text-primary" />
  </div>
);

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const { municipios, isTodasCidades, cidadeAtiva, setCidadeAtiva, nomeMunicipioPorId } = useCidade();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useRealtimeSync();

  // ── Navigation state ──
  const [activeGroup, setActiveGroup] = useState<GroupId>('visao-geral');
  const [activeView, setActiveView] = useState<ViewId>('ranking');

  // ── Filter state ──
  const [periodo, setPeriodo] = useState<Periodo>('total');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [rankingTipoUsuario, setRankingTipoUsuario] = useState<TipoUsuarioFiltro>('todos');
  const [rankingSearch, setRankingSearch] = useState('');
  const [tipoUsuarioFiltro, setTipoUsuarioFiltro] = useState<TipoUsuarioFiltro>('todos');

  // ── UI state ──
  const [exporting, setExporting] = useState(false);
  const [popupUser, setPopupUser] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data hooks ──
  const { data: liderancasData, isLoading: lLoading, refetch: refetchLiderancas } = useLiderancas('all', { ignoreCityFilter: true });
  const { data: eleitoresData, isLoading: eLoading, refetch: refetchEleitores } = useEleitores('all', { ignoreCityFilter: true });
  const { data: fiscaisData, isLoading: fLoading, refetch: refetchFiscais } = useFiscaisAdmin({ ignoreCityFilter: true });
  const { data: usuariosData, isLoading: uLoading } = useUsuarios();

  const liderancas = (liderancasData || []) as LiderancaReg[];
  const eleitores = (eleitoresData || []) as EleitorReg[];
  const fiscais = (fiscaisData || []) as FiscalReg[];
  const usuarios = (usuariosData || []) as unknown as HierarquiaUsuario[];
  const loading = lLoading || eLoading || fLoading || uLoading;

  // ── Cadastros Fernanda (real-time) ──
  const [cadastrosFernanda, setCadastrosFernanda] = useState<CadastroFernanda[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = () => {
      (supabase as any).from('cadastros_fernanda').select('*').order('criado_em', { ascending: false })
        .then(({ data }: any) => { if (active && data) setCadastrosFernanda(data); });
    };
    load();
    const channel = supabase
      .channel('admin_cadastros_fernanda_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_fernanda' }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [isAdmin]);

  // ── Cadastros Social (real-time) ──
  const [cadastrosSocial, setCadastrosSocial] = useState<CadastroSocial[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = () => {
      (supabase as any).from('cadastros_social').select('*').order('criado_em', { ascending: false })
        .then(({ data }: any) => { if (active && data) setCadastrosSocial(data); });
    };
    load();
    const channel = supabase
      .channel('admin_cadastros_social_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_social' }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [isAdmin]);

  // ── Suplentes tags ──
  const [suplentesTags, setSuplentesTags] = useState<Record<string, string>>({});
  useEffect(() => {
    (supabase as any).from('suplentes').select('id, cargo_disputado').then(({ data }: any) => {
      if (data) {
        const map: Record<string, string> = {};
        for (const s of data) { if (s.cargo_disputado) map[s.id] = s.cargo_disputado; }
        setSuplentesTags(map);
      }
    });
  }, []);

  const getCargoTag = (supId: string | null) => supId ? suplentesTags[supId] || null : null;
  const getUserName = (userId: string | null) => usuarios.find(u => u.id === userId)?.nome || '—';

  // ── Auth guard ──
  useEffect(() => {
    if (!isAdmin) { navigate('/'); }
  }, [isAdmin, navigate]);

  // ── Data invalidation on mount ──
  useEffect(() => {
    if (!isAdmin) return;
    queryClient.invalidateQueries({ queryKey: ['liderancas'] });
    queryClient.invalidateQueries({ queryKey: ['eleitores'] });
    queryClient.invalidateQueries({ queryKey: ['fiscais'] });
    queryClient.invalidateQueries({ queryKey: ['hierarquia_usuarios'] });
    void refetchLiderancas();
    void refetchEleitores();
    void refetchFiscais();
  }, [isAdmin, queryClient, refetchLiderancas, refetchEleitores, refetchFiscais]);

  // ── Date filters ──
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const inicioSemana = useMemo(() => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay()); return d; }, [hoje]);
  const inicioMes = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1), [hoje]);

  const dateFilter = useCallback((criado_em: string) => {
    if (periodo === 'total') return true;
    const limit = periodo === 'hoje' ? hoje : periodo === 'semana' ? inicioSemana : inicioMes;
    return new Date(criado_em) >= limit;
  }, [periodo, hoje, inicioSemana, inicioMes]);

  const filteredL = useMemo(() => liderancas.filter(r => dateFilter(r.criado_em)), [liderancas, dateFilter]);
  const filteredE = useMemo(() => eleitores.filter(r => dateFilter(r.criado_em)), [eleitores, dateFilter]);
  const filteredF = useMemo(() => fiscais.filter(r => r.criado_em && dateFilter(r.criado_em)), [fiscais, dateFilter]);
  const filteredFern = useMemo(() => cadastrosFernanda.filter(r => dateFilter(r.criado_em)), [cadastrosFernanda, dateFilter]);
  const filteredSocial = useMemo(() => cadastrosSocial.filter(r => dateFilter(r.criado_em)), [cadastrosSocial, dateFilter]);

  const totais: Totais = useMemo(() => {
    const l = filteredL.filter(r => r.tipo_lideranca !== 'Cabo Eleitoral').length;
    const c = filteredL.filter(r => r.tipo_lideranca === 'Cabo Eleitoral').length;
    return { l, c, e: filteredE.length, f: filteredF.length, total: l + c + filteredE.length + filteredF.length };
  }, [filteredL, filteredE, filteredF]);

  // ── Ranking ──
  const rankingUsuarios: RankingEntry[] = useMemo(() => {
    const map: Record<string, { l: number; c: number; e: number; f: number; fern: number; soc: number }> = {};
    usuarios.filter(u => u.tipo !== 'super_admin').forEach(u => {
      map[u.id] = { l: 0, c: 0, e: 0, f: 0, fern: 0, soc: 0 };
    });
    filteredL.forEach(r => {
      if (!r.cadastrado_por || !map[r.cadastrado_por]) return;
      if (r.tipo_lideranca === 'Cabo Eleitoral') map[r.cadastrado_por].c++;
      else map[r.cadastrado_por].l++;
    });
    filteredE.forEach(r => { if (!r.cadastrado_por || !map[r.cadastrado_por]) return; map[r.cadastrado_por].e++; });
    filteredF.forEach(r => { if (!r.cadastrado_por || !map[r.cadastrado_por]) return; map[r.cadastrado_por].f++; });
    filteredFern.forEach(r => { if (!r.cadastrado_por || !map[r.cadastrado_por]) return; map[r.cadastrado_por].fern++; });
    filteredSocial.forEach(r => { if (!r.cadastrado_por || !map[r.cadastrado_por]) return; map[r.cadastrado_por].soc++; });
    return Object.entries(map)
      .map(([id, stats]) => {
        const u = usuarios.find(u => u.id === id);
        return { id, nome: u?.nome || 'Desconhecido', tipo: u?.tipo || '—', municipio_id: u?.municipio_id || null, suplente_id: u?.suplente_id || null, superior_id: u?.superior_id || null, total: stats.l + stats.c + stats.e + stats.f + stats.fern + stats.soc, ...stats };
      })
      .filter(u => u.total > 0)
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }, [filteredL, filteredE, filteredF, filteredFern, filteredSocial, usuarios]);

  // ── Filtered users ──
  const filtroMunicipioId = useMemo(() => isTodasCidades ? null : cidadeAtiva?.id || null, [isTodasCidades, cidadeAtiva]);

  const filteredUsers = useMemo(() => {
    let list = usuarios.filter(u => u.tipo !== 'super_admin');
    if (tipoUsuarioFiltro !== 'todos') list = list.filter(u => u.tipo === tipoUsuarioFiltro);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(u => u.nome.toLowerCase().includes(s) || (getCargoTag(u.suplente_id) || '').toLowerCase().includes(s));
    }
    if (filtroMunicipioId) {
      list = list.sort((a, b) => {
        const aMatch = a.municipio_id === filtroMunicipioId ? 0 : 1;
        const bMatch = b.municipio_id === filtroMunicipioId ? 0 : 1;
        return aMatch - bMatch || a.nome.localeCompare(b.nome);
      });
    }
    return list;
  }, [usuarios, tipoUsuarioFiltro, filtroMunicipioId, searchTerm]);

  // ── All registros ──
  const allRegistros: RegistroEntry[] = useMemo(() => {
    let result: RegistroEntry[] = [];
    if (tipoFiltro === 'todos' || tipoFiltro === 'lideranca' || tipoFiltro === 'cabo')
      filteredL.forEach(r => {
        const isCabo = r.tipo_lideranca === 'Cabo Eleitoral';
        if (tipoFiltro === 'lideranca' && isCabo) return;
        if (tipoFiltro === 'cabo' && !isCabo) return;
        result.push({ tipo: isCabo ? 'cabo' : 'lideranca', pessoa: r.pessoas, criado_em: r.criado_em, cadastrado_por: r.cadastrado_por, suplente_id: r.suplente_id, suplente_nome: (r as any).suplentes?.nome, extra: r.status || '' });
      });
    if (tipoFiltro === 'todos' || tipoFiltro === 'eleitor')
      filteredE.forEach(r => result.push({ tipo: 'eleitor', pessoa: r.pessoas, criado_em: r.criado_em, cadastrado_por: r.cadastrado_por, suplente_id: r.suplente_id, suplente_nome: (r as any).suplentes?.nome, lideranca_nome: (r as any).liderancas?.pessoas?.nome, extra: r.compromisso_voto || '' }));
    if (tipoFiltro === 'todos' || tipoFiltro === 'fiscal')
      filteredF.forEach(r => result.push({ tipo: 'fiscal', pessoa: r.pessoas, criado_em: r.criado_em || '', cadastrado_por: r.cadastrado_por, suplente_id: r.suplente_id, suplente_nome: (r as any).suplentes?.nome, lideranca_nome: (r as any).liderancas?.pessoas?.nome, extra: r.status || '' }));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.pessoa?.nome?.toLowerCase().includes(s) ||
        r.pessoa?.cpf?.includes(s) ||
        (getCargoTag(r.suplente_id) || '').toLowerCase().includes(s) ||
        getUserName(r.cadastrado_por).toLowerCase().includes(s)
      );
    }
    return result.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  }, [filteredL, filteredE, filteredF, tipoFiltro, searchTerm]);

  // ── Popup user data ──
  const popupUserData: PopupUserData | null = useMemo(() => {
    if (!popupUser) return null;
    const u = usuarios.find(u => u.id === popupUser);
    return {
      usuario: u,
      liderancas: filteredL.filter(r => r.cadastrado_por === popupUser && r.tipo_lideranca !== 'Cabo Eleitoral' && r.tipo_lideranca !== 'Promotor'),
      cabos: filteredL.filter(r => r.cadastrado_por === popupUser && r.tipo_lideranca === 'Cabo Eleitoral'),
      promotores: filteredL.filter(r => r.cadastrado_por === popupUser && r.tipo_lideranca === 'Promotor'),
      eleitores: filteredE.filter(r => r.cadastrado_por === popupUser),
      fiscais: filteredF.filter(r => r.cadastrado_por === popupUser),
      fernanda: cadastrosFernanda.filter(r => r.cadastrado_por === popupUser),
      social: cadastrosSocial.filter(r => r.cadastrado_por === popupUser),
    };
  }, [popupUser, filteredL, filteredE, filteredF, cadastrosFernanda, cadastrosSocial, usuarios]);

  // ── Actions ──
  const handleExport = async (tipo?: 'lideranca' | 'eleitor' | 'fiscal', cadastradoPorId?: string, cadastradoPorNome?: string) => {
    setExporting(true);
    try {
      const count = await exportCadastrosFiltered({ tipo, cadastradoPorId, cadastradoPorNome });
      toast({ title: `✅ ${count} registros exportados!` });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    } finally { setExporting(false); }
  };

  const handleDeleteCadastro = async (id: string, tipo: 'lideranca' | 'eleitor' | 'fiscal') => {
    if (!window.confirm('Tem certeza que deseja apagar este cadastro?')) return;
    setDeletingId(id);
    try {
      const table = tipo === 'lideranca' ? 'liderancas' : tipo === 'fiscal' ? 'fiscais' : 'possiveis_eleitores';
      const { error } = await (supabase as any).from(table).delete().eq('id', id);
      if (error) throw error;
      toast({ title: '🗑️ Registro apagado' });
      queryClient.invalidateQueries({ queryKey: ['liderancas'] });
      queryClient.invalidateQueries({ queryKey: ['eleitores'] });
      queryClient.invalidateQueries({ queryKey: ['fiscais'] });
    } catch (err: any) {
      toast({ title: 'Erro ao apagar', description: err.message, variant: 'destructive' });
    } finally { setDeletingId(null); }
  };

  // ── Navigation handlers ──
  const handleGroupChange = (group: GroupId) => {
    setActiveGroup(group);
    setActiveView(defaultViewOf(group));
    setSearchTerm('');
    setRankingSearch('');
    setTipoFiltro('todos');
    setRankingTipoUsuario('todos');
    setTipoUsuarioFiltro('todos');
  };

  const handleViewChange = (view: ViewId) => {
    setActiveView(view);
    setSearchTerm('');
  };

  const showCidadeSelector = municipios.length > 1;

  if (loading) {
    return (
      <div className="h-dvh bg-background flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <AdminShell
        activeGroup={activeGroup}
        activeView={activeView}
        onGroupChange={handleGroupChange}
        onViewChange={handleViewChange}
      >
        {activeView === 'ranking' && (
          <AdminRanking
            rankingUsuarios={rankingUsuarios}
            filteredL={filteredL} filteredE={filteredE} filteredF={filteredF}
            filteredFern={filteredFern} filteredSocial={filteredSocial}
            rankingTipoUsuario={rankingTipoUsuario} onRankingTipoUsuarioChange={setRankingTipoUsuario}
            rankingSearch={rankingSearch} onRankingSearchChange={setRankingSearch}
            tipoFiltro={tipoFiltro} onTipoFiltroChange={setTipoFiltro}
            totais={totais} periodo={periodo} onPeriodoChange={setPeriodo}
            onPopupUserOpen={setPopupUser}
            getCargoTag={getCargoTag} getUserName={getUserName}
            exporting={exporting} handleExport={handleExport}
            showCidadeSelector={showCidadeSelector}
          />
        )}

        {activeView === 'arvore' && (
          <TabArvore usuarios={usuarios} liderancas={liderancas} eleitores={eleitores} fiscais={fiscais} />
        )}

        {activeView === 'registros' && (
          <AdminRegistros
            allRegistros={allRegistros}
            tipoFiltro={tipoFiltro} onTipoFiltroChange={setTipoFiltro}
            searchTerm={searchTerm} onSearchChange={setSearchTerm}
            totais={totais} periodo={periodo} onPeriodoChange={setPeriodo}
            getUserName={getUserName} getCargoTag={getCargoTag}
            exporting={exporting} handleExport={handleExport}
            showCidadeSelector={showCidadeSelector}
          />
        )}

        {activeView === 'fernanda' && (
          <Suspense fallback={<LazyFallback />}><AdminCadastrosFernanda /></Suspense>
        )}

        {activeView === 'social' && (
          <Suspense fallback={<LazyFallback />}><TabCadastrosSocial /></Suspense>
        )}

        {activeView === 'afiliados' && (
          <Suspense fallback={<LazyFallback />}><AdminCadastrosAfiliados /></Suspense>
        )}

        {activeView === 'usuarios' && (
          <AdminUsuarios
            filteredUsers={filteredUsers}
            tipoUsuarioFiltro={tipoUsuarioFiltro} onTipoUsuarioFiltroChange={setTipoUsuarioFiltro}
            searchTerm={searchTerm} onSearchChange={setSearchTerm}
            filteredL={filteredL} filteredE={filteredE} filteredF={filteredF}
            totais={totais} periodo={periodo} onPeriodoChange={setPeriodo}
            onPopupUserOpen={setPopupUser}
            getCargoTag={getCargoTag} nomeMunicipioPorId={nomeMunicipioPorId}
            exporting={exporting} deletingId={deletingId}
            handleExport={handleExport}
            showCidadeSelector={showCidadeSelector}
          />
        )}

        {activeView === 'cidades' && (
          <AdminCidades
            municipios={municipios}
            usuarios={usuarios} liderancas={liderancas} eleitores={eleitores} fiscais={fiscais}
            onNavigateToUsuarios={() => { setActiveGroup('gestao'); setActiveView('usuarios'); }}
          />
        )}

        {activeView === 'eventos' && <GerenciarEventos />}

        {activeView === 'instagram' && (
          <Suspense fallback={<LazyFallback />}><AdminInstagramPanel /></Suspense>
        )}

        {activeView === 'mencoes' && (
          <Suspense fallback={<LazyFallback />}><AdminMencoesInstagram /></Suspense>
        )}
      </AdminShell>

      {/* User popup (outside shell, fixed overlay) */}
      <AdminUserPopup
        popupUser={popupUser}
        popupUserData={popupUserData}
        onClose={() => setPopupUser(null)}
        getCargoTag={getCargoTag}
        nomeMunicipioPorId={nomeMunicipioPorId}
        deletingId={deletingId}
        handleDeleteCadastro={handleDeleteCadastro}
      />
    </>
  );
}
```

- [ ] **Step 2: Build check — verificar sem erros TypeScript**

```bash
cd c:\Users\Gusta\Desktop\Rede\rede_sarelli_v1.0 && npm run build 2>&1 | tail -20
```
Expected: `✓ built in` sem erros de TypeScript.

Se houver erros de tipo, corrigi-los antes de prosseguir.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat(admin): rewrite AdminDashboard as orchestrator with sidebar+bottom-nav layout"
```

- [ ] **Step 4: Push para GitHub**

```bash
git remote set-url origin "https://YOUR_GITHUB_TOKEN@github.com/agenciaaxisdigital-hub/rede-lvb-1.3.git" && git push origin HEAD
```

---

### Task 12: Verificação visual no dev server

- [ ] **Step 1: Iniciar dev server**

```bash
cd c:\Users\Gusta\Desktop\Rede\rede_sarelli_v1.0 && npm run dev
```

- [ ] **Step 2: Verificar checklist**

Abrir `http://localhost:8080/admin` e verificar:
- [ ] Desktop (≥768px): sidebar 240px visível à esquerda com 4 grupos
- [ ] Clicar em cada grupo expande sub-views na sidebar (quando >1 view no grupo)
- [ ] Cada view carrega sem erros
- [ ] Stats cards visíveis no Ranking (variant full) e compactos nas demais views
- [ ] Período selector funciona (Hoje/Semana/Mês/Total altera stats)
- [ ] Ranking: podium 🥇🥈🥉 + lista + expand + popup + export por usuário
- [ ] Registros: busca + filtro tipo + export
- [ ] Usuários: busca + filtro + expand + popup + export
- [ ] Cidades: lista + adicionar + "Ver →" navega para Usuários
- [ ] Fernanda/Social/Afiliados: carregam normalmente (lazy)
- [ ] Eventos/Instagram/Menções: carregam normalmente
- [ ] Popup de usuário: abre ao clicar "Ver detalhes" ou em card do podium, fecha ao clicar fora
- [ ] Mobile (<768px): sidebar some, bottom nav com 4 ícones aparece na base
- [ ] Mobile: sub-nav pills horizontais aparecem quando grupo tem >1 view
- [ ] Localização: não aparece em nenhum lugar (removida)
