import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Target, Loader2, Plus, Save, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Trash2, Instagram } from 'lucide-react';

interface Meta {
  id: string;
  usuario_id: string;
  feed_meta: number;
  stories_meta: number;
  periodo: string;
  ativa: boolean;
}

interface Usuario {
  id: string;
  nome: string;
  tipo: string;
  instagram: string | null;
}

interface MencoesCount {
  feed: number;
  stories: number;
}

const PERIODOS = ['diario', 'semanal', 'mensal'];
const PERIODO_LABEL: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
};

function getPeriodStart(periodo: string): string {
  const now = new Date();
  if (periodo === 'diario') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (periodo === 'semanal') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (periodo === 'mensal') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return new Date(0).toISOString();
}

function normalizeHandle(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .split('/')[0]
    .split('?')[0]
    .trim();
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const done = max > 0 && value >= max;
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function TabMetas() {
  const { isAdmin, usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ usuario_id: '', feed_meta: '', stories_meta: '', periodo: 'semanal' });
  const [showForm, setShowForm] = useState(false);
  const [mencoesMap, setMencoesMap] = useState<Record<string, MencoesCount>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);

    const [{ data: u }, { data: m }] = await Promise.all([
      (supabase as any)
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, instagram')
        .in('tipo', ['suplente', 'lideranca', 'coordenador'])
        .eq('ativo', true)
        .order('nome'),
      (supabase as any)
        .from('metas_postagem')
        .select('*')
        .order('criado_em', { ascending: false }),
    ]);

    const allUsuarios: Usuario[] = u || [];
    const allMetas: Meta[] = m || [];
    setUsuarios(allUsuarios);
    setMetas(allMetas);

    if (allMetas.length > 0) {
      // Uma única query: busca todas as menções desde o período mais antigo entre as metas
      const periodoMaisAntigo = allMetas
        .map(meta => getPeriodStart(meta.periodo))
        .sort()[0];

      const { data: mencoes } = await (supabase as any)
        .from('instagram_mencoes')
        .select('autor_username, tipo, criado_em')
        .gte('criado_em', periodoMaisAntigo);

      const mm: Record<string, MencoesCount> = {};

      for (const meta of allMetas) {
        const usr = allUsuarios.find(u => u.id === meta.usuario_id);
        const handle = normalizeHandle(usr?.instagram);

        if (!handle) {
          mm[meta.id] = { feed: 0, stories: 0 };
          continue;
        }

        const since = new Date(getPeriodStart(meta.periodo)).getTime();
        const filtered = (mencoes || []).filter(
          (mn: any) =>
            normalizeHandle(mn.autor_username) === handle &&
            new Date(mn.criado_em).getTime() >= since
        );

        mm[meta.id] = {
          // Feed: hashtag + mention (qualquer tipo que não seja story_mention)
          feed: filtered.filter((mn: any) => mn.tipo !== 'story_mention').length,
          // Stories: tipo explicitamente story_mention
          stories: filtered.filter((mn: any) => mn.tipo === 'story_mention').length,
        };
      }

      setMencoesMap(mm);
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!form.usuario_id) { toast({ title: 'Selecione o usuário', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      usuario_id: form.usuario_id,
      feed_meta: parseInt(form.feed_meta) || 0,
      stories_meta: parseInt(form.stories_meta) || 0,
      periodo: form.periodo,
      ativa: true,
    };
    const { error } = await (supabase as any).from('metas_postagem').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Meta criada!' });
    setShowForm(false);
    setForm({ usuario_id: '', feed_meta: '', stories_meta: '', periodo: 'semanal' });
    loadData();
  }

  async function toggleAtiva(meta: Meta) {
    await (supabase as any).from('metas_postagem').update({ ativa: !meta.ativa }).eq('id', meta.id);
    setMetas(prev => prev.map(m => m.id === meta.id ? { ...m, ativa: !meta.ativa } : m));
    toast({ title: meta.ativa ? 'Meta pausada' : 'Meta ativada' });
  }

  async function deleteMeta(id: string) {
    if (!confirm('Excluir esta meta?')) return;
    await (supabase as any).from('metas_postagem').delete().eq('id', id);
    setMetas(prev => prev.filter(m => m.id !== id));
    toast({ title: 'Meta excluída' });
  }

  const getNomeUsuario = (id: string) => usuarios.find(u => u.id === id)?.nome || '—';
  const getHandleUsuario = (id: string) => normalizeHandle(usuarios.find(u => u.id === id)?.instagram);

  const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  const minhasMetas = isAdmin ? metas : metas.filter(m => m.usuario_id === usuario?.id);

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Target size={20} className="text-primary" />
        <div>
          <h2 className="text-base font-bold text-foreground">Metas de Postagem</h2>
          <p className="text-xs text-muted-foreground">Feed e stories monitorados via Instagram</p>
        </div>
      </div>

      {isAdmin && (
        <button
          onClick={() => setShowForm(v => !v)}
          className="w-full h-12 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
        >
          <Plus size={18} /> Criar Nova Meta
        </button>
      )}

      {isAdmin && showForm && (
        <div className="section-card space-y-3">
          <h3 className="text-sm font-bold text-foreground">Nova Meta</h3>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Usuário *</label>
            <select
              value={form.usuario_id}
              onChange={e => setForm(f => ({ ...f, usuario_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">Selecione o usuário...</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.tipo}){u.instagram ? ` · @${normalizeHandle(u.instagram)}` : ' · sem Instagram'}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Meta Feed (posts)</label>
              <input
                type="number"
                min="0"
                value={form.feed_meta}
                onChange={e => setForm(f => ({ ...f, feed_meta: e.target.value }))}
                placeholder="Ex: 3"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Meta Stories</label>
              <input
                type="number"
                min="0"
                value={form.stories_meta}
                onChange={e => setForm(f => ({ ...f, stories_meta: e.target.value }))}
                placeholder="Ex: 5"
                className={inputCls}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <select
              value={form.periodo}
              onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}
              className={inputCls}
            >
              {PERIODOS.map(p => (
                <option key={p} value={p}>{PERIODO_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Salvando...' : 'Salvar Meta'}
          </button>
        </div>
      )}

      {minhasMetas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma meta definida ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {minhasMetas.map(meta => {
            const isExpanded = expanded === meta.id;
            const counts = mencoesMap[meta.id] || { feed: 0, stories: 0 };
            const feedPct = meta.feed_meta > 0 ? Math.min(100, Math.round((counts.feed / meta.feed_meta) * 100)) : 0;
            const storiesPct = meta.stories_meta > 0 ? Math.min(100, Math.round((counts.stories / meta.stories_meta) * 100)) : 0;
            const handle = getHandleUsuario(meta.usuario_id);
            const periodoLabel = PERIODO_LABEL[meta.periodo] || meta.periodo;

            return (
              <div key={meta.id} className="section-card !p-0 overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : meta.id)}
                  className="w-full text-left p-3 flex items-center gap-3 active:bg-muted/30 transition-all"
                >
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.ativa ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{getNomeUsuario(meta.usuario_id)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Feed: {counts.feed}/{meta.feed_meta} · Stories: {counts.stories}/{meta.stories_meta} · {periodoLabel}
                      {!meta.ativa && <span className="ml-1 text-destructive">· Pausada</span>}
                    </p>
                  </div>
                  {isExpanded
                    ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                    : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
                    {/* Handle do instagram */}
                    {handle ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Instagram size={12} />
                        <span>@{handle}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-600 flex items-center gap-1.5">
                        <Instagram size={12} />
                        <span>Sem Instagram cadastrado — menções não rastreadas</span>
                      </div>
                    )}

                    {/* Barra Feed */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">📸 Feed</span>
                        <span className={counts.feed >= meta.feed_meta && meta.feed_meta > 0 ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                          {counts.feed} / {meta.feed_meta} {feedPct >= 100 ? '✓' : `(${feedPct}%)`}
                        </span>
                      </div>
                      <ProgressBar value={counts.feed} max={meta.feed_meta} color="bg-primary" />
                    </div>

                    {/* Barra Stories */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">⭕ Stories</span>
                        <span className={counts.stories >= meta.stories_meta && meta.stories_meta > 0 ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                          {counts.stories} / {meta.stories_meta} {storiesPct >= 100 ? '✓' : `(${storiesPct}%)`}
                        </span>
                      </div>
                      <ProgressBar value={counts.stories} max={meta.stories_meta} color="bg-violet-500" />
                    </div>

                    <p className="text-[10px] text-muted-foreground/60 text-center">
                      {counts.feed + counts.stories} menção{counts.feed + counts.stories !== 1 ? 'ões' : ''} capturada{counts.feed + counts.stories !== 1 ? 's' : ''} {
                        meta.periodo === 'diario' ? 'hoje' : meta.periodo === 'semanal' ? 'esta semana' : 'este mês'
                      }
                    </p>

                    {isAdmin && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => toggleAtiva(meta)}
                          className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                            meta.ativa
                              ? 'border-amber-400/40 text-amber-600 bg-amber-500/5'
                              : 'border-emerald-400/40 text-emerald-600 bg-emerald-500/5'
                          }`}
                        >
                          {meta.ativa ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                          {meta.ativa ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => deleteMeta(meta.id)}
                          className="h-9 px-4 flex items-center gap-1.5 rounded-xl text-xs font-semibold border border-destructive/30 text-destructive bg-destructive/5 active:scale-95"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    )}
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
