# Tipo Social Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar tipo de usuário `social` com tabela própria, link de captação, aba dedicada e visibilidade no painel admin — espelhando o padrão do tipo `fernanda`.

**Architecture:** Nova tabela `cadastros_social` no Supabase. Edge function `captacao-afiliado` recebe tipo `social` e insere na tabela. Componente `TabCadastrosSocial` replica `TabCadastrosFernanda` com campos: nome, whatsapp, cpf, instagram, nome_mae, regiao. Visibilidade da aba restrita a admin/coord e `tipoUsuario === 'social'`.

**Tech Stack:** Supabase (PostgreSQL + RLS + Edge Functions Deno), React + TypeScript, React Query, Tailwind CSS

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/20260508000000_cadastros_social.sql` | Criar — tabela + RLS |
| `supabase/functions/captacao-afiliado/index.ts` | Modificar — adicionar tipo `social` |
| `src/contexts/AuthContext.tsx` | Modificar — adicionar `'social'` ao TipoUsuario |
| `src/components/LinkCaptacaoCard.tsx` | Modificar — adicionar variante `social` |
| `src/pages/CadastroPublicoAfiliado.tsx` | Modificar — formulário social |
| `src/components/TabCadastrosSocial.tsx` | Criar — aba social |
| `src/components/BottomNav.tsx` | Modificar — aba social na nav |
| `src/pages/Home.tsx` | Modificar — lazy import + render TabCadastrosSocial |
| `src/pages/AdminDashboard.tsx` | Modificar — carregar + exibir cadastros_social no popup |

---

## Task 1: Migration — tabela cadastros_social

**Files:**
- Create: `supabase/migrations/20260508000000_cadastros_social.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- supabase/migrations/20260508000000_cadastros_social.sql

CREATE TABLE IF NOT EXISTS public.cadastros_social (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL,
  whatsapp     text NOT NULL,
  cpf          text,
  instagram    text,
  nome_mae     text,
  regiao       text,
  cadastrado_por uuid REFERENCES public.hierarquia_usuarios(id) ON DELETE SET NULL,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cadastros_social ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_cadastros_social" ON public.cadastros_social;
CREATE POLICY "authenticated_select_cadastros_social"
  ON public.cadastros_social FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_cadastros_social" ON public.cadastros_social;
CREATE POLICY "authenticated_insert_cadastros_social"
  ON public.cadastros_social FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_cadastros_social" ON public.cadastros_social;
CREATE POLICY "authenticated_update_cadastros_social"
  ON public.cadastros_social FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_cadastros_social" ON public.cadastros_social;
CREATE POLICY "authenticated_delete_cadastros_social"
  ON public.cadastros_social FOR DELETE TO authenticated USING (true);
```

- [ ] **Step 2: Executar no Supabase Dashboard → SQL Editor**

Cole o SQL acima e execute. Verificar: tabela `cadastros_social` criada com todas as colunas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508000000_cadastros_social.sql
git commit -m "feat: migration tabela cadastros_social com RLS"
```

---

## Task 2: Edge function — adicionar tipo social

**Files:**
- Modify: `supabase/functions/captacao-afiliado/index.ts`

- [ ] **Step 1: Adicionar `social` ao enum do tipoLink**

Linha atual:
```typescript
const tipoLink = z.enum(['lideranca', 'cabo', 'fiscal', 'eleitor', 'fernanda', 'afiliado', 'promotor']).optional().nullable();
```
Substituir por:
```typescript
const tipoLink = z.enum(['lideranca', 'cabo', 'fiscal', 'eleitor', 'fernanda', 'afiliado', 'promotor', 'social']).optional().nullable();
```

- [ ] **Step 2: Adicionar handler `social` após o bloco `fernanda`**

Localizar o bloco `if (tipoDestino === 'fernanda') {` e após o `return jres(...)` final do fernanda, adicionar:

```typescript
// ─── SOCIAL ───────────────────────────────────────────────────────────────
if (tipoDestino === 'social') {
  const { error: insErr } = await supabaseAdmin.from('cadastros_social').insert({
    nome: p.nome.trim(),
    whatsapp: whatsappFinal,
    cpf: p.cpf?.trim() || null,
    instagram: instagramFinal || null,
    nome_mae: (p as any).nome_mae?.trim() || null,
    regiao: p.cidade?.trim() || null,
    cadastrado_por: afiliado.id,
  });
  if (insErr) {
    console.error('cadastros_social insert error:', insErr);
    return jres({ error: 'Erro ao salvar cadastro social' }, 500);
  }
  try {
    await supabaseAdmin.from('cadastros_afiliados').insert({
      afiliado_id: afiliado.id,
      nome: p.nome.trim(),
      telefone: whatsappFinal,
      rede_social: instagramFinal || null,
      origem: 'link_publico_social',
    });
  } catch (e) { console.warn('log cadastros_afiliados social:', e); }
  return jres({ ok: true, redirect_url: 'https://www.instagram.com/drafernandasarelli/' });
}
```

- [ ] **Step 3: Deploy edge function**

```bash
npx supabase functions deploy captacao-afiliado
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/captacao-afiliado/index.ts
git commit -m "feat: edge function suporta tipo social"
```

---

## Task 3: AuthContext — adicionar tipo social

**Files:**
- Modify: `src/contexts/AuthContext.tsx:7`

- [ ] **Step 1: Adicionar `'social'` ao TipoUsuario**

Linha atual:
```typescript
export type TipoUsuario = 'super_admin' | 'coordenador' | 'suplente' | 'lideranca' | 'fernanda' | 'afiliado' | 'promotor';
```
Substituir por:
```typescript
export type TipoUsuario = 'super_admin' | 'coordenador' | 'suplente' | 'lideranca' | 'fernanda' | 'afiliado' | 'promotor' | 'social';
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: adiciona tipo social ao TipoUsuario"
```

---

## Task 4: LinkCaptacaoCard — variante social

**Files:**
- Modify: `src/components/LinkCaptacaoCard.tsx`

- [ ] **Step 1: Adicionar `social` ao tipo LinkVariant e ao array de variantes**

Localizar:
```typescript
type LinkVariant = 'lideranca' | 'cabo' | 'fiscal' | 'eleitor' | 'fernanda' | 'afiliado' | 'promotor'
```
Substituir por:
```typescript
type LinkVariant = 'lideranca' | 'cabo' | 'fiscal' | 'eleitor' | 'fernanda' | 'afiliado' | 'promotor' | 'social'
```

- [ ] **Step 2: Adicionar entrada no array de variantes**

Localizar o array `variantes` que contém `{ id: 'promotor', ... }` e adicionar após:
```typescript
{ id: 'social' as LinkVariant, icon: Users, label: 'Social', color: 'text-teal-600' },
```
(Use o ícone `Users` já importado ou `Share2` se disponível.)

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/LinkCaptacaoCard.tsx
git commit -m "feat: variante social no LinkCaptacaoCard"
```

---

## Task 5: CadastroPublicoAfiliado — formulário social

**Files:**
- Modify: `src/pages/CadastroPublicoAfiliado.tsx`

- [ ] **Step 1: Adicionar `social` ao tipoParam**

Localizar:
```typescript
return t === 'lideranca' || t === 'cabo' || t === 'fiscal' || t === 'eleitor' || t === 'fernanda' || t === 'afiliado' || t === 'promotor' ? t : null;
```
Substituir por:
```typescript
return t === 'lideranca' || t === 'cabo' || t === 'fiscal' || t === 'eleitor' || t === 'fernanda' || t === 'afiliado' || t === 'promotor' || t === 'social' ? t : null;
```

- [ ] **Step 2: Adicionar tipoLabel para social**

No bloco de tipoLabel (após `tipoParam === 'promotor'`), adicionar:
```typescript
: tipoParam === 'social'
? 'Cadastro Social'
```

- [ ] **Step 3: Adicionar estado para nome_mae e regiao**

Após os estados existentes de captação, adicionar:
```typescript
const [capNomeMae, setCapNomeMae] = useState('');
const [capRegiao, setCapRegiao] = useState('');
```

- [ ] **Step 4: Adicionar campos ao formulário social no JSX**

Localizar o formulário de captação (onde estão os campos de nome, telefone, etc.). Após o campo de Instagram e antes do campo de título eleitoral (ou antes do botão de submit), adicionar condicionalmente para tipo `social`:

```tsx
{tipoParam === 'social' && (
  <>
    <div>
      <label className={labelCls}>Nome da Mãe</label>
      <input
        type="text"
        value={capNomeMae}
        onChange={e => setCapNomeMae(e.target.value)}
        placeholder="Nome completo da mãe"
        className={inputCls}
      />
    </div>
    <div>
      <label className={labelCls}>Região / Bairro</label>
      <input
        type="text"
        value={capRegiao}
        onChange={e => setCapRegiao(e.target.value)}
        placeholder="Bairro ou região"
        className={inputCls}
      />
    </div>
  </>
)}
```

- [ ] **Step 5: Incluir nome_mae e regiao no payload de envio**

Localizar onde o payload é montado para o fetch POST ao edge function e adicionar:
```typescript
nome_mae: capNomeMae.trim() || null,
cidade: capRegiao.trim() || null,  // reutiliza campo cidade do edge function para regiao
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/CadastroPublicoAfiliado.tsx
git commit -m "feat: formulário social com campos nome_mae e regiao"
```

---

## Task 6: TabCadastrosSocial — componente

**Files:**
- Create: `src/components/TabCadastrosSocial.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/TabCadastrosSocial.tsx` baseado em `TabCadastrosFernanda.tsx` com as seguintes diferenças:

```typescript
// src/components/TabCadastrosSocial.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, ChevronRight, ArrowLeft, Loader2, Phone, Instagram,
  MapPin, User, Trash2, XCircle, Pencil, Calendar as CalendarIcon, IdCard
} from 'lucide-react';
import SkeletonLista from '@/components/SkeletonLista';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { checkTelefone } from '@/hooks/useInstagramCheck';
import { TelefoneStatusIcon, telefoneHelpText } from '@/components/CampoStatusIcon';
import LinkCaptacaoCard from '@/components/LinkCaptacaoCard';

interface CadastroSocial {
  id: string;
  nome: string;
  whatsapp: string;
  cpf: string | null;
  instagram: string | null;
  nome_mae: string | null;
  regiao: string | null;
  cadastrado_por: string | null;
  criado_em: string;
}

interface FormState {
  id?: string;
  nome: string;
  whatsapp: string;
  cpf: string;
  instagram: string;
  nome_mae: string;
  regiao: string;
  responsavel_id: string;
}

const EMPTY: FormState = { nome: '', whatsapp: '', cpf: '', instagram: '', nome_mae: '', regiao: '', responsavel_id: '' };

const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const labelCls = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block';

export default function TabCadastrosSocial() {
  const { usuario, isAdmin } = useAuth();
  const [mode, setMode] = useState<'list' | 'form' | 'detail'>('list');
  const [cadastros, setCadastros] = useState<CadastroSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY);
  const telStatus = checkTelefone(form.whatsapp);
  const [saving, setSaving] = useState(false);
  const [usuariosSistema, setUsuariosSistema] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [selected, setSelected] = useState<CadastroSocial | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [periodo, setPeriodo] = useState<'todos' | 'hoje' | 'ontem' | 'semana' | 'mes' | 'data'>('hoje');
  const [intervalo, setIntervalo] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from('cadastros_social').select('*').order('criado_em', { ascending: false });
    if (!isAdmin && usuario?.id) {
      query = query.eq('cadastrado_por', usuario.id);
    }
    const [cRes, uRes] = await Promise.all([
      query,
      supabase.from('hierarquia_usuarios').select('id, nome, tipo').order('nome')
    ]);
    if (cRes.error) {
      toast({ title: 'Erro ao carregar', description: cRes.error.message, variant: 'destructive' });
    } else {
      setCadastros((cRes.data || []) as CadastroSocial[]);
    }
    if (uRes.data) setUsuariosSistema(uRes.data);
    setLoading(false);
  }, [isAdmin, usuario?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const channel = supabase
      .channel('cadastros_social_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_social' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    let base = cadastros;
    if (periodo === 'data' && (intervalo?.from || intervalo?.to)) {
      const start = intervalo.from ?? intervalo.to!;
      const end = intervalo.to ?? intervalo.from!;
      const inicioDia = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const fimDia = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      fimDia.setDate(fimDia.getDate() + 1);
      base = base.filter(c => { const d = new Date(c.criado_em); return d >= inicioDia && d < fimDia; });
    } else if (periodo !== 'todos' && periodo !== 'data') {
      const agora = new Date();
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      let from = inicio;
      let to: Date | null = null;
      if (periodo === 'ontem') { from = new Date(inicio); from.setDate(from.getDate() - 1); to = inicio; }
      else if (periodo === 'semana') { from = new Date(inicio); from.setDate(from.getDate() - 7); }
      else if (periodo === 'mes') { from = new Date(inicio); from.setDate(from.getDate() - 30); }
      const fromTs = from.getTime();
      const toTs = to ? to.getTime() : null;
      base = base.filter(c => { const t = Date.parse(c.criado_em); if (t < fromTs) return false; if (toTs !== null && t >= toTs) return false; return true; });
    }
    if (!q) return base;
    return base.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.whatsapp.toLowerCase().includes(q) ||
      (c.regiao || '').toLowerCase().includes(q) ||
      (c.instagram || '').toLowerCase().includes(q) ||
      (c.nome_mae || '').toLowerCase().includes(q)
    );
  }, [cadastros, busca, periodo, intervalo]);

  const handleSalvar = async () => {
    if (!form.nome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    if (!form.whatsapp.trim()) { toast({ title: 'Informe o WhatsApp', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      whatsapp: form.whatsapp.trim(),
      cpf: form.cpf.replace(/\D/g, '') || null,
      instagram: form.instagram.trim() || null,
      nome_mae: form.nome_mae.trim() || null,
      regiao: form.regiao.trim() || null,
      cadastrado_por: form.responsavel_id || usuario?.id || null,
    };
    if (form.id) {
      const { data, error } = await (supabase as any).from('cadastros_social').update(payload).eq('id', form.id).select().single();
      setSaving(false);
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
      setCadastros(prev => prev.map(c => c.id === form.id ? (data as CadastroSocial) : c));
      toast({ title: '✅ Cadastro atualizado' });
    } else {
      const { data, error } = await (supabase as any).from('cadastros_social').insert(payload).select().single();
      setSaving(false);
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
      setCadastros(prev => [data as CadastroSocial, ...prev]);
      toast({ title: '✅ Cadastro salvo' });
    }
    setForm(EMPTY);
    setMode('list');
  };

  const abrirNovo = () => { setForm(EMPTY); setMode('form'); };
  const abrirEditar = (c: CadastroSocial) => {
    setForm({ id: c.id, nome: c.nome, whatsapp: c.whatsapp, cpf: c.cpf ?? '', instagram: c.instagram ?? '', nome_mae: c.nome_mae ?? '', regiao: c.regiao ?? '', responsavel_id: c.cadastrado_por ?? '' });
    setMode('form');
  };
  const abrirDetalhe = (c: CadastroSocial) => { setSelected(c); setConfirmDelete(false); setMode('detail'); };

  const handleExcluir = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await (supabase as any).from('cadastros_social').delete().eq('id', selected.id);
    setSaving(false);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '🗑️ Cadastro excluído' });
    setSelected(null); setConfirmDelete(false); setMode('list'); carregar();
  };

  // ─── FORM VIEW ───
  if (mode === 'form') {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <button onClick={() => { setMode('list'); setForm(EMPTY); }} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95"><ArrowLeft size={16} /></button>
          <h2 className="text-base font-bold text-foreground">{form.id ? 'Editar cadastro' : 'Novo cadastro'}</h2>
        </div>
        <div className="section-card space-y-3">
          <div><label className={labelCls}>Nome *</label><input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" className={inputCls} /></div>
          <div>
            <label className={labelCls}>WhatsApp *</label>
            <div className="relative">
              <input type="tel" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="(00) 00000-0000" className={inputCls + ' pr-9'} />
              <div className="absolute right-2 top-1/2 -translate-y-1/2"><TelefoneStatusIcon status={telStatus} /></div>
            </div>
            {telefoneHelpText(telStatus) && <p className="text-[10px] text-destructive mt-1">{telefoneHelpText(telStatus)}</p>}
          </div>
          <div><label className={labelCls}>CPF</label><input type="text" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" className={inputCls} /></div>
          <div><label className={labelCls}>Instagram</label><input type="text" value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" className={inputCls} /></div>
          <div><label className={labelCls}>Nome da Mãe</label><input type="text" value={form.nome_mae} onChange={e => setForm({ ...form, nome_mae: e.target.value })} placeholder="Nome completo da mãe" className={inputCls} /></div>
          <div><label className={labelCls}>Região / Bairro</label><input type="text" value={form.regiao} onChange={e => setForm({ ...form, regiao: e.target.value })} placeholder="Bairro ou região" className={inputCls} /></div>
          {isAdmin && (
            <div>
              <label className={labelCls}>Responsável no Sistema</label>
              <select value={form.responsavel_id} onChange={e => setForm({ ...form, responsavel_id: e.target.value })} className={inputCls}>
                <option value="">{usuario?.nome || 'Eu'} (Padrão)</option>
                {usuariosSistema.filter(u => u.id !== usuario?.id).map(u => (<option key={u.id} value={u.id}>{u.nome} ({u.tipo})</option>))}
              </select>
            </div>
          )}
        </div>
        <button onClick={handleSalvar} disabled={saving} className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{form.id ? 'Salvar alterações' : 'Cadastrar'}
        </button>
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  if (mode === 'detail' && selected) {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <button onClick={() => { setMode('list'); setSelected(null); }} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95"><ArrowLeft size={16} /></button>
          <h2 className="text-base font-bold text-foreground truncate flex-1">{selected.nome}</h2>
          <button onClick={() => abrirEditar(selected)} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95"><Pencil size={14} /></button>
        </div>
        <div className="section-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center"><User size={20} className="text-teal-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{selected.nome}</p>
              <p className="text-[11px] text-muted-foreground">Cadastrado em {new Date(selected.criado_em).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2.5 py-1.5"><Phone size={14} className="text-muted-foreground shrink-0" /><span className="text-sm text-foreground">{selected.whatsapp}</span></div>
            {selected.cpf && <div className="flex items-center gap-2.5 py-1.5"><IdCard size={14} className="text-muted-foreground shrink-0" /><span className="text-sm text-foreground">{selected.cpf}</span></div>}
            {selected.instagram && <div className="flex items-center gap-2.5 py-1.5"><Instagram size={14} className="text-muted-foreground shrink-0" /><span className="text-sm text-foreground">{selected.instagram}</span></div>}
            {selected.nome_mae && <div className="flex items-center gap-2.5 py-1.5"><User size={14} className="text-muted-foreground shrink-0" /><span className="text-sm text-foreground">Mãe: {selected.nome_mae}</span></div>}
            {selected.regiao && <div className="flex items-center gap-2.5 py-1.5"><MapPin size={14} className="text-muted-foreground shrink-0" /><span className="text-sm text-foreground">{selected.regiao}</span></div>}
          </div>
        </div>
        {isAdmin && (
          <div className="section-card">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="w-full h-10 border border-destructive/30 text-destructive text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]"><Trash2 size={16} /> Excluir cadastro</button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Tem certeza? Esta ação não pode ser desfeita.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 bg-muted text-sm font-semibold rounded-xl">Cancelar</button>
                  <button onClick={handleExcluir} disabled={saving} className="flex-1 h-10 bg-destructive text-destructive-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}Confirmar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-3 pb-24">
      <LinkCaptacaoCard initialVariant="social" lockVariant />
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, WhatsApp, bairro..." className="w-full h-11 pl-9 pr-9 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
        {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground active:scale-90"><XCircle size={14} /></button>}
      </div>
      <button onClick={abrirNovo} className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97]"><Plus size={16} /> Novo cadastro</button>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-hide">
        {([{ v: 'hoje', l: 'Hoje' }, { v: 'ontem', l: 'Ontem' }, { v: 'semana', l: '7 dias' }, { v: 'mes', l: '30 dias' }, { v: 'todos', l: 'Todos' }] as const).map(opt => (
          <button key={opt.v} onClick={() => { setPeriodo(opt.v); setIntervalo(undefined); }} className={cn('shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95', periodo === opt.v ? 'gradient-primary text-white shadow-sm' : 'bg-card border border-border text-muted-foreground')}>{opt.l}</button>
        ))}
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button className={cn('shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95 flex items-center gap-1', periodo === 'data' ? 'gradient-primary text-white shadow-sm' : 'bg-card border border-border text-muted-foreground')}>
              <CalendarIcon size={11} />{periodo === 'data' && intervalo?.from ? intervalo.to && intervalo.to.getTime() !== intervalo.from.getTime() ? `${format(intervalo.from, 'dd/MM', { locale: ptBR })} – ${format(intervalo.to, 'dd/MM', { locale: ptBR })}` : format(intervalo.from, 'dd/MM/yy', { locale: ptBR }) : 'Escolher datas'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={intervalo as any} onSelect={(range: any) => { setIntervalo(range); if (range?.from) setPeriodo('data'); }} numberOfMonths={1} initialFocus locale={ptBR} modifiersClassNames={{ today: '' }} classNames={{ day_today: '' }} className={cn('p-3 pointer-events-auto')} />
            <div className="p-2 pt-0 flex gap-2">
              <button onClick={() => { setIntervalo(undefined); setPeriodo('hoje'); setDatePickerOpen(false); }} className="flex-1 h-8 rounded-lg bg-muted text-[11px] font-semibold">Limpar</button>
              <button onClick={() => setDatePickerOpen(false)} className="flex-1 h-8 rounded-lg gradient-primary text-white text-[11px] font-semibold">Aplicar</button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-xs text-muted-foreground">{loading ? 'Carregando...' : `${filtrados.length} cadastro${filtrados.length !== 1 ? 's' : ''}`}</p>
      {loading && cadastros.length === 0 ? <SkeletonLista /> : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{busca ? 'Nenhum cadastro encontrado' : 'Nenhum cadastro ainda.'}</div>
      ) : (
        <div className="space-y-1.5">
          {filtrados.map(c => (
            <button key={c.id} onClick={() => abrirDetalhe(c)} className="w-full section-card !py-3 !px-3.5 text-left active:scale-[0.99] transition-transform">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0 mt-0.5"><User size={17} className="text-teal-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Phone size={9} /> {c.whatsapp}</span>
                    {c.regiao && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><MapPin size={9} /> {c.regiao}</span>}
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70 mt-1"><CalendarIcon size={9} /> {new Date(c.criado_em).toLocaleDateString('pt-BR')}</div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TabCadastrosSocial.tsx
git commit -m "feat: componente TabCadastrosSocial"
```

---

## Task 7: BottomNav — aba social

**Files:**
- Modify: `src/components/BottomNav.tsx`

- [ ] **Step 1: Adicionar `social` ao TabId**

Localizar:
```typescript
export type TabId = 'liderancas' | 'cabos' | 'promotores' | 'fiscais' | 'eleitores' | 'cadastros' | 'fernanda' | 'afiliados' | 'perfil';
```
Substituir por:
```typescript
export type TabId = 'liderancas' | 'cabos' | 'promotores' | 'fiscais' | 'eleitores' | 'cadastros' | 'fernanda' | 'social' | 'afiliados' | 'perfil';
```

- [ ] **Step 2: Adicionar aba ao ALL_TABS**

Após a entrada `{ id: 'fernanda', ... }`:
```typescript
{ id: 'social', icon: Users, label: 'Social' },
```

- [ ] **Step 3: Adicionar regra de visibilidade para social**

No filtro de tabs, após a linha que bloqueia `promotores` para não-promotores, adicionar:
```typescript
// Social: apenas admin/coord (já retornou acima) ou tipo social
if (tab.id === 'social') return tipoUsuario === 'social';
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat: aba Social no BottomNav"
```

---

## Task 8: Home.tsx — integrar TabCadastrosSocial

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Adicionar lazy import**

Após `const TabCadastrosFernanda = lazy(...)`:
```typescript
const TabCadastrosSocial = lazy(() => import('@/components/TabCadastrosSocial'));
```

- [ ] **Step 2: Adicionar `'social'` ao VALID_TABS**

```typescript
const VALID_TABS: TabId[] = ['liderancas', 'cabos', 'promotores', 'fiscais', 'eleitores', 'cadastros', 'fernanda', 'social', 'afiliados', 'perfil'];
```

- [ ] **Step 3: Adicionar título para aba social**

No objeto `titles`:
```typescript
social: 'Cadastros Social',
```

- [ ] **Step 4: Adicionar render da aba**

Após a linha que renderiza `TabCadastrosFernanda`:
```tsx
{visitedTabs.has('social') && activeTab === 'social' && (tipoUsuario === 'social' || isAdmin) && <TabCadastrosSocial />}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: Home renderiza TabCadastrosSocial"
```

---

## Task 9: AdminDashboard — cadastros_social no popup

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Adicionar estado e load de cadastros_social**

Após o bloco `cadastrosFernanda` (useEffect + useState), adicionar:
```typescript
const [cadastrosSocial, setCadastrosSocial] = useState<Array<{ id: string; nome: string; whatsapp: string; cpf: string | null; instagram: string | null; nome_mae: string | null; regiao: string | null; cadastrado_por: string | null; criado_em: string }>>([]);
useEffect(() => {
  if (!isAdmin) return;
  let active = true;
  const load = () => {
    (supabase as any).from('cadastros_social').select('*').order('criado_em', { ascending: false }).then(({ data }: any) => {
      if (active && data) setCadastrosSocial(data);
    });
  };
  load();
  const channel = supabase
    .channel('admin_cadastros_social_sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_social' }, load)
    .subscribe();
  return () => { active = false; supabase.removeChannel(channel); };
}, [isAdmin]);
```

- [ ] **Step 2: Adicionar `social` ao popupUserData**

No `useMemo` do `popupUserData`, adicionar:
```typescript
social: cadastrosSocial.filter(r => r.cadastrado_por === popupUser),
```
E adicionar `cadastrosSocial` nas dependências do useMemo.

- [ ] **Step 3: Atualizar contador do popup**

Localizar a linha do contador e adicionar `+ popupUserData.social.length`.

- [ ] **Step 4: Adicionar badge Social no popup**

Após o badge Fernanda:
```tsx
{popupUserData.social.length > 0 && (
  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-500/15 text-teal-600">
    <Users size={12} className="inline mr-1" />Social: {popupUserData.social.length}
  </span>
)}
```

- [ ] **Step 5: Adicionar social na lista de registros do popup**

No array spread de registros, adicionar:
```typescript
...popupUserData.social.map(r => ({ ...r, _tipo: 'social' as const, pessoas: { nome: r.nome, whatsapp: r.whatsapp, email: null, instagram: r.instagram, facebook: null } })),
```

- [ ] **Step 6: Adicionar badge `social` no item da lista**

No switch de cores e labels dos badges:
```typescript
: r._tipo === 'social' ? 'bg-teal-500/15 text-teal-600'
```
E no texto:
```typescript
: r._tipo === 'social' ? 'Social'
```

- [ ] **Step 7: Atualizar condição de "vazio"**

Adicionar `&& popupUserData.social.length === 0` à condição do empty state.

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Commit e push**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat: painel admin exibe cadastros social no popup"
git push origin main
```

---

## Task 10: Deploy final

- [ ] **Step 1: Deploy edge function**

```bash
npx supabase functions deploy captacao-afiliado
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```
Expected: `✓ built` sem erros.

- [ ] **Step 3: Push final**

```bash
git push origin main
```
