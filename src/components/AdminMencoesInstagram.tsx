import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Instagram, Hash, AtSign, ExternalLink, ChevronDown, ChevronUp, RefreshCw, Check, X, Pencil, AlertCircle, Camera, LayoutGrid, Film } from 'lucide-react';

interface Mencao {
  id: string;
  tipo: string;
  autor_username: string | null;
  conta_monitorada: string | null;
  hashtag: string | null;
  texto: string | null;
  permalink: string | null;
  media_type: string | null;
  criado_em: string;
}

interface UsuarioRow {
  id: string;
  nome: string;
  tipo: string;
  instagram: string | null;
  ativo: boolean | null;
  segue_conta: boolean | null;
}

interface UsuarioMencoes {
  usuario: UsuarioRow;
  handle: string | null;
  total: number;
  hashtags: number;
  mencoesAt: number;
  ultimaEm: string | null;
  posts: Mencao[];
}

const CONTA = 'agenciaaxisdigital';
const HASHTAG = 'chamaadoutora';

export default function AdminMencoesInstagram() {
  const [data, setData] = useState<Mencao[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'postaram' | 'sem_post' | 'sem_handle'>('todos');
  const [busca, setBusca] = useState('');
  const [polling, setPolling] = useState(false);
  const [pagina, setPagina] = useState(1);
  const ITENS_POR_PAGINA = 30;

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const mRes = await (supabase as any)
        .from('instagram_mencoes')
        .select('id, tipo, autor_username, conta_monitorada, hashtag, texto, permalink, media_type, criado_em')
        .order('criado_em', { ascending: false })
        .limit(2000);
      let uRes = await (supabase as any)
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, instagram, ativo, segue_conta')
        .neq('tipo', 'super_admin')
        .order('nome');

      // Fallback: se a coluna segue_conta não existir ainda (migração pendente)
      if (uRes.error && (uRes.error.code === '42703' || uRes.error.message?.includes('segue_conta'))) {
        console.warn('Coluna segue_conta não encontrada, usando query de fallback.');
        uRes = await (supabase as any)
          .from('hierarquia_usuarios')
          .select('id, nome, tipo, instagram, ativo')
          .neq('tipo', 'super_admin')
          .order('nome');
      }

      if (mRes.error) throw mRes.error;
      if (uRes.error) throw uRes.error;
      setData((mRes.data || []) as Mencao[]);
      setUsuarios((uRes.data || []) as UsuarioRow[]);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar menções');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const ch = (supabase as any)
      .channel('admin_mencoes_ig')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'instagram_mencoes' }, carregar)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hierarquia_usuarios' }, carregar)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  const normalizar = (s: string | null | undefined) =>
    (s || '').replace(/^@+/, '').trim().toLowerCase();

  const usuariosComMencoes: UsuarioMencoes[] = useMemo(() => {
    // index menções por handle normalizado
    const porHandle = new Map<string, Mencao[]>();
    for (const m of data) {
      const h = normalizar(m.autor_username);
      if (!h) continue;
      const arr = porHandle.get(h) || [];
      arr.push(m);
      porHandle.set(h, arr);
    }
    return usuarios.map((u) => {
      const handle = normalizar(u.instagram);
      const posts = handle ? porHandle.get(handle) || [] : [];
      const hashtags = posts.filter((p) => p.tipo === 'hashtag' || !!p.hashtag).length;
      const mencoesAt = posts.length - hashtags;
      const ultimaEm = posts[0]?.criado_em || null;
      return {
        usuario: u,
        handle: handle || null,
        total: posts.length,
        hashtags,
        mencoesAt,
        ultimaEm,
        posts,
      };
    });
  }, [data, usuarios]);

  const stats = useMemo(() => {
    const comHandle = usuariosComMencoes.filter((u) => u.handle);
    const postaram = comHandle.filter((u) => u.total > 0);
    const stories = data.filter(m => m.tipo === 'story_mention' || m.media_type === 'STORY').length;
    const feed = data.filter(m => m.tipo === 'hashtag' || (m.tipo !== 'story_mention' && m.media_type !== 'STORY')).length;
    return {
      total: usuariosComMencoes.length,
      comHandle: comHandle.length,
      semHandle: usuariosComMencoes.length - comHandle.length,
      postaram: postaram.length,
      naoPostaram: comHandle.length - postaram.length,
      totalPosts: data.length,
      stories,
      feed,
    };
  }, [usuariosComMencoes, data]);

  const lista = useMemo(() => {
    let arr = usuariosComMencoes;
    if (filtro === 'postaram') arr = arr.filter((u) => u.total > 0);
    else if (filtro === 'sem_post') arr = arr.filter((u) => u.handle && u.total === 0);
    else if (filtro === 'sem_handle') arr = arr.filter((u) => !u.handle);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter((u) =>
        u.usuario.nome.toLowerCase().includes(q) ||
        (u.handle || '').includes(q)
      );
    }
    return arr.sort((a, b) => {
      // postaram primeiro (desc), depois com handle sem post, depois sem handle
      if (b.total !== a.total) return b.total - a.total;
      if (!!b.handle !== !!a.handle) return b.handle ? 1 : -1;
      return a.usuario.nome.localeCompare(b.usuario.nome);
    });
  }, [usuariosComMencoes, filtro, busca]);

  useEffect(() => {
    setPagina(1);
  }, [filtro, busca]);

  const iniciarEdicao = (u: UsuarioRow) => {
    setEditingId(u.id);
    setEditValue(u.instagram || '');
  };

  const salvarHandle = async (id: string) => {
    setSavingEdit(true);
    try {
      const valor = editValue.replace(/^@+/, '').trim() || null;
      const { error } = await (supabase as any)
        .from('hierarquia_usuarios')
        .update({ instagram: valor })
        .eq('id', id);
      if (error) throw error;
      toast({ title: '✅ Instagram atualizado' });
      setEditingId(null);
      setEditValue('');
      carregar();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleSegueConta = async (id: string, currentVal: boolean | null) => {
    try {
      const newVal = !currentVal;
      const { error } = await (supabase as any)
        .from('hierarquia_usuarios')
        .update({ segue_conta: newVal })
        .eq('id', id);
      if (error) throw error;
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, segue_conta: newVal } : u));
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar status de seguidor', description: e?.message, variant: 'destructive' });
    }
  };

  const dispararPollManual = async () => {
    setPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-poll', {});
      if (error) throw error;
      const r: any = data;
      if (r?.ok) {
        toast({
          title: '✅ Busca executada',
          description: `${r.novas_inseridas || 0} novas menções (${r.hashtag_encontradas} hashtags, ${r.mencoes_encontradas} marcações)`,
        });
      } else {
        toast({
          title: 'Busca falhou',
          description: r?.erro || 'Verifique secrets IG_USER_ID e IG_ACCESS_TOKEN',
          variant: 'destructive',
        });
      }
      carregar();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Instagram size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Engajamento dos Usuários</h3>
          <button
            onClick={dispararPollManual}
            disabled={polling}
            className="ml-auto px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 active:scale-95 disabled:opacity-50 flex items-center gap-1"
          >
            {polling ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Buscar agora
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Vínculo via <span className="font-semibold text-foreground">@</span> do Instagram cadastrado no usuário. Monitora marcações em
          <span className="font-semibold text-foreground"> @{CONTA}</span> e a hashtag <span className="font-semibold text-foreground">#{HASHTAG}</span>.
          Atualização automática a cada 10 segundos.
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5">
            <p className="text-emerald-600 dark:text-emerald-400 font-bold text-base leading-none">{stats.postaram}</p>
            <p className="text-muted-foreground">postaram</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
            <p className="text-amber-600 dark:text-amber-400 font-bold text-base leading-none">{stats.naoPostaram}</p>
            <p className="text-muted-foreground">sem post</p>
          </div>
          <div className="rounded-lg bg-muted px-2 py-1.5">
            <p className="text-foreground font-bold text-base leading-none">{stats.semHandle}</p>
            <p className="text-muted-foreground">sem @</p>
          </div>
          <div className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5">
            <p className="text-primary font-bold text-base leading-none">{stats.totalPosts}</p>
            <p className="text-muted-foreground">posts captados</p>
          </div>
        </div>
        {stats.totalPosts > 0 && (
          <div className="mt-2 flex gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
              <Camera size={9} /> {stats.stories} stories
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
              <LayoutGrid size={9} /> {stats.feed} feed/hashtag
            </span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-2 flex flex-wrap gap-1.5">
        {([
          { key: 'todos', label: `Todos (${stats.total})` },
          { key: 'postaram', label: `Postaram (${stats.postaram})` },
          { key: 'sem_post', label: `Sem post (${stats.naoPostaram})` },
          { key: 'sem_handle', label: `Sem @ (${stats.semHandle})` },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
              filtro === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome ou @"
          className="ml-auto h-7 px-2 text-xs bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/30 min-w-[160px]"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {erro}. Verifique se as colunas/tabelas (<code>instagram_mencoes</code>, <code>hierarquia_usuarios.instagram</code>) já existem.
        </div>
      )}

      {!loading && !erro && lista.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <Instagram size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">Nenhum usuário encontrado</p>
          <p className="text-[11px] text-muted-foreground mt-1">Ajuste os filtros ou cadastre usuários.</p>
        </div>
      )}

      <div className="space-y-2">
        {lista.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA).map((g) => {
          const isOpen = expanded === g.usuario.id;
          const semHandle = !g.handle;
          const naoPostou = g.handle && g.total === 0;
          return (
            <div
              key={g.usuario.id}
              className={`rounded-xl border overflow-hidden ${
                semHandle ? 'border-border bg-muted/20'
                : naoPostou ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-emerald-500/30 bg-emerald-500/5'
              }`}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  semHandle ? 'bg-muted-foreground/40'
                  : naoPostou ? 'bg-amber-500'
                  : 'gradient-primary'
                }`}>
                  {g.usuario.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{g.usuario.nome}</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-primary/10 text-primary shrink-0">
                      {g.usuario.tipo === 'lideranca' ? 'Lider.' : g.usuario.tipo === 'suplente' ? 'Supl.' : g.usuario.tipo === 'afiliado' ? 'Afil.' : g.usuario.tipo === 'fernanda' ? 'Fern.' : g.usuario.tipo}
                    </span>
                  </div>
                  {editingId === g.usuario.id ? (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground">@</span>
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') salvarHandle(g.usuario.id); if (e.key === 'Escape') setEditingId(null); }}
                        placeholder="instagram"
                        className="h-6 px-1.5 text-[11px] bg-background border border-border rounded outline-none focus:ring-1 focus:ring-primary/30 w-32"
                      />
                      <button onClick={() => salvarHandle(g.usuario.id)} disabled={savingEdit} className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10">
                        {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded text-muted-foreground hover:bg-muted">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => iniciarEdicao(g.usuario)}
                      className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 group"
                    >
                      {g.handle ? (
                        <>
                          <span className="font-medium">@{g.handle}</span>
                          <Pencil size={9} className="opacity-0 group-hover:opacity-100 transition" />
                        </>
                      ) : (
                        <>
                          <AlertCircle size={10} className="text-amber-500" />
                          <span className="text-amber-600 dark:text-amber-400 font-medium">Adicionar @</span>
                        </>
                      )}
                    </button>
                  )}
                  <div className="mt-1.5">
                    <button
                      onClick={() => toggleSegueConta(g.usuario.id, g.usuario.segue_conta)}
                      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border transition-colors ${
                        g.usuario.segue_conta 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                          : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                      }`}
                    >
                      {g.usuario.segue_conta ? '✓ Segue a conta' : 'Não segue a conta'}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-base font-bold leading-none ${
                    g.total > 0 ? 'text-emerald-600 dark:text-emerald-400'
                    : g.handle ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
                  }`}>{g.total}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">posts</p>
                </div>
                {g.total > 0 && (
                  <button
                    onClick={() => setExpanded(isOpen ? null : g.usuario.id)}
                    className="p-1 rounded hover:bg-muted"
                  >
                    {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </button>
                )}
              </div>

              {isOpen && g.posts.length > 0 && (
                <div className="border-t border-border bg-card/50 px-4 py-3">
                  <div className="relative border-l border-border ml-2 space-y-4 pb-1">
                    {g.posts.map((m) => {
                      const isStory = m.tipo === 'story_mention' || m.media_type === 'STORY';
                      const isHashtag = m.tipo === 'hashtag' || !!m.hashtag;
                      const isVideo = m.media_type === 'VIDEO' || m.media_type === 'REELS';
                      return (
                        <div key={m.id} className="relative pl-5 text-xs space-y-1.5">
                          <div className="absolute w-2 h-2 rounded-full bg-primary/40 -left-[4.5px] top-1.5 ring-4 ring-card"></div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Badge tipo de conteúdo */}
                            {isStory ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase">
                                <Camera size={9} /> Story
                              </span>
                            ) : isVideo ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase">
                                <Film size={9} /> Vídeo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">
                                <LayoutGrid size={9} /> Feed
                              </span>
                            )}
                            {/* Badge origem */}
                            {isHashtag ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-semibold">
                                <Hash size={9} /> #{m.hashtag || 'hashtag'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-semibold">
                                <AtSign size={9} /> menção
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {new Date(m.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {m.texto && (
                            <p className="text-foreground/80 text-[11px] leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">{m.texto}</p>
                          )}
                          {!m.texto && isStory && (
                            <p className="text-muted-foreground text-[11px] italic">Story sem legenda</p>
                          )}
                          {m.permalink ? (
                            <a href={m.permalink} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary text-[11px] font-semibold hover:underline">
                              Ver post <ExternalLink size={10} />
                            </a>
                          ) : isStory ? (
                            <span className="text-[10px] text-muted-foreground italic">Link expirado (stories duram 24h)</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lista.length > ITENS_POR_PAGINA && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[11px] text-muted-foreground">
            Mostrando {(pagina - 1) * ITENS_POR_PAGINA + 1} até {Math.min(pagina * ITENS_POR_PAGINA, lista.length)} de {lista.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={pagina === 1}
              onClick={() => setPagina(p => p - 1)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-card border border-border disabled:opacity-50 hover:bg-muted"
            >
              Anterior
            </button>
            <button
              disabled={pagina >= Math.ceil(lista.length / ITENS_POR_PAGINA)}
              onClick={() => setPagina(p => p + 1)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-card border border-border disabled:opacity-50 hover:bg-muted"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}