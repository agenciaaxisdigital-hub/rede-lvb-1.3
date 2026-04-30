import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  User, Loader2, Save, Instagram, Phone, MapPin, Edit2, X,
  Users, Target, Search, Shield, ChevronDown, ChevronUp, CheckCircle2, Calendar,
} from 'lucide-react';

interface PerfilData {
  id: string;
  nome: string;
  tipo: string;
  instagram: string | null;
  whatsapp: string | null;
  bio: string | null;
  foto_url: string | null;
  cidade_display: string | null;
  municipio_id: string | null;
  data_nascimento: string | null;
}

interface UserStats {
  liderancas: number;
  cabos: number;
  eleitores: number;
  fiscais: number;
}

interface Meta {
  id: string;
  usuario_id: string;
  feed_meta: number;
  stories_meta: number;
  periodo: string;
  ativa: boolean;
}

interface MencoesCount {
  feed: number;
  stories: number;
}

const TIPO_LABEL: Record<string, string> = {
  super_admin: 'Admin', coordenador: 'Coordenador', suplente: 'Suplente',
  lideranca: 'Liderança', fernanda: 'Fernanda', afiliado: 'Afiliado',
};

const TIPO_COLOR: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-600',
  coordenador: 'bg-orange-500/10 text-orange-600',
  suplente: 'bg-blue-500/10 text-blue-600',
  lideranca: 'bg-violet-500/10 text-violet-600',
  fernanda: 'bg-pink-500/10 text-pink-600',
};

function periodoLabel(p: string) {
  return ({ diario: 'hoje', semanal: 'esta semana', mensal: 'este mês' } as Record<string, string>)[p] || p;
}

function getPeriodStart(periodo: string): string {
  const now = new Date();
  if (periodo === 'diario') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  if (periodo === 'semanal') { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  if (periodo === 'mensal') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return new Date(0).toISOString();
}

function normalizeHandle(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .split('/')[0].split('?')[0].trim();
}

export default function TabPerfilGestao() {
  const { isAdmin, usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<PerfilData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PerfilData & { instagram: string }>>({});
  const [saving, setSaving] = useState(false);
  const [statsMap, setStatsMap] = useState<Record<string, UserStats>>({});
  const [metasMap, setMetasMap] = useState<Record<string, Meta[]>>({});
  const [mencoesMap, setMencoesMap] = useState<Record<string, MencoesCount>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);

    let q = supabase.from('hierarquia_usuarios')
      .select('id, nome, tipo, instagram, whatsapp, bio, foto_url, cidade_display, municipio_id, data_nascimento')
      .eq('ativo', true)
      .not('tipo', 'in', '("super_admin","fernanda","afiliado")');
    if (!isAdmin) q = (q as any).eq('id', usuario?.id || '');
    const { data: uData } = await (q as any).order('nome');
    const usrs: PerfilData[] = (uData || []) as PerfilData[];
    setUsuarios(usrs);

    if (usrs.length === 0) { setLoading(false); return; }

    const ids = usrs.map(u => u.id);

    const [{ data: lidData }, { data: cabData }, { data: elData }, { data: fiscData }, { data: metaData }] = await Promise.all([
      supabase.from('liderancas').select('cadastrado_por').in('cadastrado_por', ids).neq('tipo_lideranca', 'Cabo Eleitoral') as any,
      supabase.from('liderancas').select('cadastrado_por').in('cadastrado_por', ids).eq('tipo_lideranca', 'Cabo Eleitoral') as any,
      supabase.from('possiveis_eleitores').select('cadastrado_por').in('cadastrado_por', ids) as any,
      supabase.from('fiscais').select('cadastrado_por').in('cadastrado_por', ids) as any,
      (supabase as any).from('metas_postagem').select('*').in('usuario_id', ids).eq('ativa', true),
    ]);

    const sm: Record<string, UserStats> = {};
    ids.forEach(id => { sm[id] = { liderancas: 0, cabos: 0, eleitores: 0, fiscais: 0 }; });
    (lidData || []).forEach((r: any) => { if (sm[r.cadastrado_por]) sm[r.cadastrado_por].liderancas++; });
    (cabData || []).forEach((r: any) => { if (sm[r.cadastrado_por]) sm[r.cadastrado_por].cabos++; });
    (elData || []).forEach((r: any) => { if (sm[r.cadastrado_por]) sm[r.cadastrado_por].eleitores++; });
    (fiscData || []).forEach((r: any) => { if (sm[r.cadastrado_por]) sm[r.cadastrado_por].fiscais++; });
    setStatsMap(sm);

    const allMetas: Meta[] = metaData || [];
    const mm: Record<string, Meta[]> = {};
    ids.forEach(id => { mm[id] = []; });
    allMetas.forEach(m => { if (mm[m.usuario_id]) mm[m.usuario_id].push(m); });
    setMetasMap(mm);

    // Buscar menções do Instagram para todas as metas ativas
    if (allMetas.length > 0) {
      const periodoMaisAntigo = allMetas.map(m => getPeriodStart(m.periodo)).sort()[0];
      const { data: mencoes } = await (supabase as any)
        .from('instagram_mencoes')
        .select('autor_username, tipo, criado_em')
        .gte('criado_em', periodoMaisAntigo);

      const mencoesById: Record<string, MencoesCount> = {};
      for (const meta of allMetas) {
        const usr = usrs.find(u => u.id === meta.usuario_id);
        const handle = normalizeHandle(usr?.instagram);
        if (!handle) { mencoesById[meta.id] = { feed: 0, stories: 0 }; continue; }
        const since = new Date(getPeriodStart(meta.periodo)).getTime();
        const filtered = (mencoes || []).filter(
          (mn: any) => normalizeHandle(mn.autor_username) === handle && new Date(mn.criado_em).getTime() >= since
        );
        mencoesById[meta.id] = {
          feed: filtered.filter((mn: any) => mn.tipo !== 'story_mention').length,
          stories: filtered.filter((mn: any) => mn.tipo === 'story_mention').length,
        };
      }
      setMencoesMap(mencoesById);
    }

    setLoading(false);

    if (!isAdmin && usrs.length === 1) {
      const me = usrs[0];
      setExpanded(me.id);
      if (!me.instagram) startEdit(me);
    }
  }, [isAdmin, usuario?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function startEdit(u: PerfilData) {
    setEditing(u.id);
    setForm({
      instagram: u.instagram?.replace(/^@/, '') || '',
      whatsapp: u.whatsapp || '',
      bio: u.bio || '',
      foto_url: u.foto_url || '',
      cidade_display: u.cidade_display || '',
      data_nascimento: u.data_nascimento || '',
    });
  }

  async function handleSave(userId: string) {
    setSaving(true);
    const payload: any = {
      instagram: form.instagram?.replace(/^@/, '').trim() || null,
      whatsapp: form.whatsapp?.trim() || null,
      bio: form.bio?.trim() || null,
      foto_url: form.foto_url?.trim() || null,
      cidade_display: form.cidade_display?.trim() || null,
      data_nascimento: form.data_nascimento || null,
    };
    const { error } = await supabase.from('hierarquia_usuarios').update(payload as any).eq('id', userId);
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Perfil atualizado!' });
    setEditing(null);
    loadAll();
  }

  const inputCls = 'w-full h-11 px-3 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';

  const filteredUsuarios = search
    ? usuarios.filter(u => u.nome.toLowerCase().includes(search.toLowerCase()))
    : usuarios;

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <User size={20} className="text-primary" />
        <div className="flex-1">
          <h2 className="text-base font-bold text-foreground">
            {isAdmin ? 'Perfis dos Usuários' : 'Meu Perfil'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? `${usuarios.length} usuários cadastrados` : 'Seus dados e estatísticas'}
          </p>
        </div>
      </div>

      {isAdmin && usuarios.length > 5 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar usuário..."
            className={`${inputCls} pl-9`}
          />
        </div>
      )}

      {filteredUsuarios.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsuarios.map(u => {
            const isEditing = editing === u.id;
            const isExpanded = expanded === u.id || !isAdmin;
            const stats = statsMap[u.id] || { liderancas: 0, cabos: 0, eleitores: 0, fiscais: 0 };
            const totalCadastros = stats.liderancas + stats.cabos + stats.eleitores + stats.fiscais;
            const metas = metasMap[u.id] || [];
            const perfilCompleto = !!(u.instagram);

            return (
              <div key={u.id} className="section-card space-y-3">
                <button
                  onClick={() => !isEditing && setExpanded(isExpanded ? null : u.id)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className="relative shrink-0">
                    {u.foto_url ? (
                      <img src={u.foto_url} alt={u.nome} className="w-14 h-14 rounded-full object-cover border-2 border-primary/20" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                        <span className="text-xl font-bold text-primary">{u.nome.charAt(0)}</span>
                      </div>
                    )}
                    {perfilCompleto && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={10} className="text-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{u.nome}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[u.tipo] || 'bg-muted text-muted-foreground'}`}>
                      {TIPO_LABEL[u.tipo] || u.tipo}
                    </span>
                    {u.instagram && (
                      <p className="text-[10px] text-pink-500 flex items-center gap-1 mt-0.5">
                        <Instagram size={9} /> @{normalizeHandle(u.instagram)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary">{totalCadastros}</p>
                    <p className="text-[8px] text-muted-foreground">cadastros</p>
                  </div>
                  {isAdmin && (isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />)}
                </button>

                {isExpanded && (
                  <>
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: 'Lid.', value: stats.liderancas, color: 'text-blue-600 bg-blue-500/10' },
                        { label: 'Cabos', value: stats.cabos, color: 'text-pink-600 bg-pink-500/10' },
                        { label: 'Eleit.', value: stats.eleitores, color: 'text-emerald-600 bg-emerald-500/10' },
                        { label: 'Fisc.', value: stats.fiscais, color: 'text-amber-600 bg-amber-500/10' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className={`rounded-xl p-2 text-center ${color}`}>
                          <p className="text-base font-bold">{value}</p>
                          <p className="text-[9px] font-medium">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Metas com progresso real de Instagram */}
                    {metas.length > 0 && (
                      <div className="space-y-2 border-t border-border pt-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Target size={10} /> Metas de Postagem
                        </p>
                        {metas.map(meta => {
                          const counts = mencoesMap[meta.id] || { feed: 0, stories: 0 };
                          const feedPct = meta.feed_meta > 0 ? Math.min(100, Math.round((counts.feed / meta.feed_meta) * 100)) : 0;
                          const storiesPct = meta.stories_meta > 0 ? Math.min(100, Math.round((counts.stories / meta.stories_meta) * 100)) : 0;
                          return (
                            <div key={meta.id} className="space-y-1.5 bg-muted/30 rounded-xl p-2.5">
                              <p className="text-[10px] text-muted-foreground capitalize">{periodoLabel(meta.periodo)}</p>
                              {meta.feed_meta > 0 && (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-muted-foreground">📸 Feed</span>
                                    <span className={counts.feed >= meta.feed_meta ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                                      {counts.feed}/{meta.feed_meta} {feedPct >= 100 ? '✓' : `(${feedPct}%)`}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${counts.feed >= meta.feed_meta ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${feedPct}%` }} />
                                  </div>
                                </div>
                              )}
                              {meta.stories_meta > 0 && (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-muted-foreground">⭕ Stories</span>
                                    <span className={counts.stories >= meta.stories_meta ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                                      {counts.stories}/{meta.stories_meta} {storiesPct >= 100 ? '✓' : `(${storiesPct}%)`}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${counts.stories >= meta.stories_meta ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${storiesPct}%` }} />
                                  </div>
                                </div>
                              )}
                              {!u.instagram && (
                                <p className="text-[9px] text-amber-600">⚠️ Sem @instagram — menções não rastreadas</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Infos do perfil */}
                    {!isEditing && (
                      <div className="border-t border-border pt-2 space-y-1.5">
                        {u.bio && <p className="text-xs text-muted-foreground italic leading-relaxed">"{u.bio}"</p>}
                        {u.instagram && (
                          <div className="flex items-center gap-2 text-xs">
                            <Instagram size={12} className="text-pink-500 shrink-0" />
                            <span className="text-foreground">@{normalizeHandle(u.instagram)}</span>
                          </div>
                        )}
                        {u.whatsapp && (
                          <div className="flex items-center gap-2 text-xs">
                            <Phone size={12} className="text-emerald-500 shrink-0" />
                            <span className="text-foreground">{u.whatsapp}</span>
                          </div>
                        )}
                        {u.data_nascimento && (
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar size={12} className="text-blue-500 shrink-0" />
                            <span className="text-foreground">
                              {new Date(u.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                        {!perfilCompleto && (
                          <p className="text-[10px] text-amber-600 bg-amber-500/10 rounded-lg px-2 py-1.5">
                            ⚠️ Perfil incompleto — preencha seu @instagram para rastrear metas
                          </p>
                        )}

                        {(isAdmin || u.id === usuario?.id) && (
                          <button
                            onClick={() => startEdit(u)}
                            className="w-full h-8 flex items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground active:scale-95 transition-all mt-1"
                          >
                            <Edit2 size={12} /> Editar Perfil
                          </button>
                        )}
                      </div>
                    )}

                    {/* Form de edição */}
                    {isEditing && (
                      <div className="space-y-2 border-t border-border pt-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">Editar Perfil</p>
                          <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground"><X size={14} /></button>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Instagram size={11} /> Instagram (sem @) *
                          </label>
                          <input
                            type="text"
                            value={form.instagram || ''}
                            onChange={e => setForm(f => ({ ...f, instagram: e.target.value.replace(/^@/, '') }))}
                            placeholder="seu_usuario"
                            className={inputCls}
                          />
                          <p className="text-[10px] text-muted-foreground">Necessário para rastrear postagens nas metas</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Calendar size={11} /> Data de Nascimento
                          </label>
                          <input
                            type="date"
                            value={form.data_nascimento || ''}
                            onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Phone size={11} /> WhatsApp
                          </label>
                          <input
                            type="tel"
                            value={form.whatsapp || ''}
                            onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                            placeholder="(62) 99999-0000"
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <MapPin size={11} /> Cidade
                          </label>
                          <input
                            type="text"
                            value={form.cidade_display || ''}
                            onChange={e => setForm(f => ({ ...f, cidade_display: e.target.value }))}
                            placeholder="Ex: Goiânia - GO"
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Bio / Apresentação</label>
                          <textarea
                            value={form.bio || ''}
                            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                            rows={2}
                            placeholder="Breve apresentação sobre você..."
                            className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Foto de Perfil (URL)</label>
                          <input
                            type="url"
                            value={form.foto_url || ''}
                            onChange={e => setForm(f => ({ ...f, foto_url: e.target.value }))}
                            placeholder="https://..."
                            className={inputCls}
                          />
                        </div>
                        <button
                          onClick={() => handleSave(u.id)}
                          disabled={saving}
                          className="w-full h-10 gradient-primary text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-all"
                        >
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          {saving ? 'Salvando...' : 'Salvar Perfil'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
