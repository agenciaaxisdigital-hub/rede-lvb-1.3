import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Instagram, Loader2, UserCheck, UserX, CheckCircle, XCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface UsuarioIG {
  id: string;
  nome: string;
  tipo: string;
  instagram: string | null;
  segue_conta: boolean | null;
}

interface MencoesCount {
  feed: number;
  stories: number;
}

interface Meta {
  id: string;
  feed_meta: number;
  stories_meta: number;
  periodo: string;
}

type Periodo = 'semana' | 'mes' | 'total';

function getPeriodStart(periodo: Periodo): string {
  const now = new Date();
  if (periodo === 'semana') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (periodo === 'mes') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
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

const TIPO_LABEL: Record<string, string> = {
  coordenador: 'Coord.', suplente: 'Suplente', lideranca: 'Liderança',
};
const TIPO_COLOR: Record<string, string> = {
  coordenador: 'bg-orange-500/10 text-orange-600',
  suplente: 'bg-blue-500/10 text-blue-600',
  lideranca: 'bg-violet-500/10 text-violet-600',
};

export default function AdminInstagramPanel() {
  const [usuarios, setUsuarios] = useState<UsuarioIG[]>([]);
  const [mencoesMap, setMencoesMap] = useState<Record<string, MencoesCount>>({});
  const [metasMap, setMetasMap] = useState<Record<string, Meta | null>>({});
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'vinculados' | 'sem_conta' | 'nao_segue'>('todos');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [periodo]);

  async function loadData() {
    setLoading(true);

    const [{ data: usrs }, { data: mencoes }, { data: metas }] = await Promise.all([
      (supabase as any)
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, instagram, segue_conta')
        .in('tipo', ['coordenador', 'suplente', 'lideranca'])
        .eq('ativo', true)
        .order('nome'),
      (supabase as any)
        .from('instagram_mencoes')
        .select('autor_username, tipo, criado_em')
        .gte('criado_em', getPeriodStart(periodo)),
      (supabase as any)
        .from('metas_postagem')
        .select('usuario_id, id, feed_meta, stories_meta, periodo')
        .eq('ativa', true),
    ]);

    const allUsuarios: UsuarioIG[] = usrs || [];
    setUsuarios(allUsuarios);

    // Menções por handle
    const mm: Record<string, MencoesCount> = {};
    for (const u of allUsuarios) {
      const handle = normalizeHandle(u.instagram);
      if (!handle) { mm[u.id] = { feed: 0, stories: 0 }; continue; }
      const filtered = (mencoes || []).filter(
        (mn: any) => normalizeHandle(mn.autor_username) === handle
      );
      mm[u.id] = {
        feed: filtered.filter((mn: any) => mn.tipo !== 'story_mention').length,
        stories: filtered.filter((mn: any) => mn.tipo === 'story_mention').length,
      };
    }
    setMencoesMap(mm);

    // Meta ativa por usuário (pega a mais recente)
    const metasPorUsuario: Record<string, Meta | null> = {};
    for (const u of allUsuarios) {
      const userMetas = (metas || []).filter((m: any) => m.usuario_id === u.id);
      metasPorUsuario[u.id] = userMetas.length > 0 ? userMetas[0] : null;
    }
    setMetasMap(metasPorUsuario);

    setLoading(false);
  }

  const filtrados = useMemo(() => {
    let list = usuarios;
    if (filtro === 'vinculados') list = list.filter(u => !!u.instagram);
    else if (filtro === 'sem_conta') list = list.filter(u => !u.instagram);
    else if (filtro === 'nao_segue') list = list.filter(u => u.instagram && !u.segue_conta);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.nome.toLowerCase().includes(q) || normalizeHandle(u.instagram).includes(q));
    }
    return list;
  }, [usuarios, filtro, search]);

  // Stats rápidos
  const stats = useMemo(() => ({
    total: usuarios.length,
    vinculados: usuarios.filter(u => !!u.instagram).length,
    segue: usuarios.filter(u => u.segue_conta).length,
    naoSegue: usuarios.filter(u => u.instagram && !u.segue_conta).length,
    semConta: usuarios.filter(u => !u.instagram).length,
    postouAlgo: usuarios.filter(u => {
      const c = mencoesMap[u.id];
      return c && (c.feed + c.stories) > 0;
    }).length,
  }), [usuarios, mencoesMap]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Instagram size={20} className="text-pink-500" />
        <div>
          <h2 className="text-base font-bold text-foreground">Painel Instagram</h2>
          <p className="text-xs text-muted-foreground">Vinculação, seguidores e postagens</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="section-card !p-3 text-center">
          <p className="text-2xl font-black text-emerald-600">{stats.vinculados}</p>
          <p className="text-[10px] text-muted-foreground font-medium">conta vinculada</p>
        </div>
        <div className="section-card !p-3 text-center">
          <p className="text-2xl font-black text-blue-600">{stats.segue}</p>
          <p className="text-[10px] text-muted-foreground font-medium">segue a conta</p>
        </div>
        <div className="section-card !p-3 text-center">
          <p className="text-2xl font-black text-primary">{stats.postouAlgo}</p>
          <p className="text-[10px] text-muted-foreground font-medium">postou no período</p>
        </div>
      </div>

      {/* Alerta rápido */}
      {stats.naoSegue > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/20">
          <UserX size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            <strong>{stats.naoSegue}</strong> com conta vinculada mas não segue a conta oficial
          </p>
        </div>
      )}
      {stats.semConta > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-400/20">
          <XCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">
            <strong>{stats.semConta}</strong> sem @instagram cadastrado — metas não rastreadas
          </p>
        </div>
      )}

      {/* Período */}
      <div className="flex gap-1.5">
        {([['semana', 'Esta semana'], ['mes', 'Este mês'], ['total', 'Tudo']] as [Periodo, string][]).map(([p, label]) => (
          <button key={p} onClick={() => setPeriodo(p)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
              periodo === p ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>{label}</button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {([
          ['todos', 'Todos', stats.total],
          ['vinculados', 'Vinculados', stats.vinculados],
          ['nao_segue', 'Não segue', stats.naoSegue],
          ['sem_conta', 'Sem conta', stats.semConta],
        ] as [typeof filtro, string, number][]).map(([f, label, count]) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
              filtro === f ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
            }`}>
            {label} <span className="opacity-60">({count})</span>
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou @handle..."
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtrados.length} usuários</p>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.map(u => {
          const handle = normalizeHandle(u.instagram);
          const counts = mencoesMap[u.id] || { feed: 0, stories: 0 };
          const meta = metasMap[u.id];
          const total = counts.feed + counts.stories;
          const isOpen = expanded === u.id;

          // Status geral
          let statusColor = 'bg-red-500/10 border-red-400/20';
          let statusDot = 'bg-red-500';
          if (!u.instagram) {
            statusColor = 'bg-red-500/8 border-red-400/20';
            statusDot = 'bg-red-400';
          } else if (!u.segue_conta) {
            statusColor = 'bg-amber-500/8 border-amber-400/20';
            statusDot = 'bg-amber-400';
          } else if (total > 0) {
            statusColor = 'bg-emerald-500/8 border-emerald-400/20';
            statusDot = 'bg-emerald-500';
          } else {
            statusColor = 'bg-muted/60 border-border';
            statusDot = 'bg-muted-foreground/40';
          }

          const feedPct = meta && meta.feed_meta > 0 ? Math.min(100, Math.round((counts.feed / meta.feed_meta) * 100)) : null;
          const storiesPct = meta && meta.stories_meta > 0 ? Math.min(100, Math.round((counts.stories / meta.stories_meta) * 100)) : null;

          return (
            <div key={u.id} className={`rounded-2xl border overflow-hidden transition-all ${statusColor}`}>
              <button
                onClick={() => setExpanded(isOpen ? null : u.id)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{u.nome}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${TIPO_COLOR[u.tipo] || 'bg-muted text-muted-foreground'}`}>
                      {TIPO_LABEL[u.tipo] || u.tipo}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {handle ? (
                      <span className="text-[11px] text-pink-600 flex items-center gap-0.5">
                        <Instagram size={10} /> @{handle}
                      </span>
                    ) : (
                      <span className="text-[11px] text-red-500">sem @instagram</span>
                    )}
                    {u.instagram && (
                      u.segue_conta
                        ? <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><UserCheck size={10} /> segue</span>
                        : <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><UserX size={10} /> não segue</span>
                    )}
                  </div>
                </div>

                {/* Contadores compactos */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-center">
                    <p className="text-base font-black text-foreground leading-none">{counts.feed}</p>
                    <p className="text-[9px] text-muted-foreground">feed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-black text-foreground leading-none">{counts.stories}</p>
                    <p className="text-[9px] text-muted-foreground">stories</p>
                  </div>
                  {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-current/10 px-4 py-3 bg-background/60 space-y-3">
                  {/* Meta progress */}
                  {meta ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Meta — {meta.periodo}</p>
                      {meta.feed_meta > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">📸 Feed</span>
                            <span className={counts.feed >= meta.feed_meta ? 'text-emerald-600 font-bold' : 'text-foreground'}>
                              {counts.feed} / {meta.feed_meta} {feedPct !== null && feedPct >= 100 ? '✓' : feedPct !== null ? `(${feedPct}%)` : ''}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${counts.feed >= meta.feed_meta ? 'bg-emerald-500' : 'bg-primary'}`}
                              style={{ width: `${feedPct ?? 0}%` }} />
                          </div>
                        </div>
                      )}
                      {meta.stories_meta > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">⭕ Stories</span>
                            <span className={counts.stories >= meta.stories_meta ? 'text-emerald-600 font-bold' : 'text-foreground'}>
                              {counts.stories} / {meta.stories_meta} {storiesPct !== null && storiesPct >= 100 ? '✓' : storiesPct !== null ? `(${storiesPct}%)` : ''}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${counts.stories >= meta.stories_meta ? 'bg-emerald-500' : 'bg-violet-500'}`}
                              style={{ width: `${storiesPct ?? 0}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">Sem meta definida para este usuário</p>
                  )}

                  {/* Diagnóstico rápido */}
                  <div className="space-y-1 pt-1 border-t border-current/10">
                    <div className="flex items-center gap-2 text-[11px]">
                      {u.instagram
                        ? <><CheckCircle size={12} className="text-emerald-500" /> Conta vinculada</>
                        : <><XCircle size={12} className="text-red-500" /> Sem @instagram cadastrado</>}
                    </div>
                    {u.instagram && (
                      <div className="flex items-center gap-2 text-[11px]">
                        {u.segue_conta
                          ? <><CheckCircle size={12} className="text-emerald-500" /> Segue a conta oficial</>
                          : <><XCircle size={12} className="text-amber-500" /> Não segue a conta oficial</>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px]">
                      {total > 0
                        ? <><CheckCircle size={12} className="text-emerald-500" /> {total} menção{total !== 1 ? 'ões' : ''} detectada{total !== 1 ? 's' : ''}</>
                        : <><XCircle size={12} className="text-muted-foreground" /> Nenhuma postagem detectada no período</>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtrados.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Instagram size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
