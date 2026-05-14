import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  Bell, Loader2, Plus, Trash2, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle, Info, Zap, Users, Eye, EyeOff, Send,
  Clock, RefreshCw
} from 'lucide-react';

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  ativa: boolean;
  tipo: string;
  persistente: boolean;
  intervalo_minutos: number | null;
  ultima_notificacao_em: string | null;
  criado_em: string;
}

interface VisualizacaoStats {
  aviso_id: string;
  total_destinatarios: number;
  viram: { id: string; nome: string }[];
  nao_viram: { id: string; nome: string }[];
}

const TIPOS = [
  { key: 'info',    label: 'Info',    icon: Info,          color: 'text-blue-500 bg-blue-500/10 border-blue-400/30' },
  { key: 'sucesso', label: 'Sucesso', icon: CheckCircle,   color: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30' },
  { key: 'alerta',  label: 'Alerta',  icon: AlertCircle,   color: 'text-amber-500 bg-amber-500/10 border-amber-400/30' },
  { key: 'urgente', label: 'Urgente', icon: Zap,           color: 'text-red-500 bg-red-500/10 border-red-400/30' },
];

const TIPOS_USUARIO = ['fernanda', 'afiliado', 'social', 'lideranca', 'suplente', 'coordenador'];
const INTERVALOS = [
  { val: null,  label: 'Sem repetição' },
  { val: 15,    label: 'A cada 15 min' },
  { val: 30,    label: 'A cada 30 min' },
  { val: 60,    label: 'A cada 1 hora' },
  { val: 120,   label: 'A cada 2 horas' },
  { val: 360,   label: 'A cada 6 horas' },
  { val: 720,   label: 'A cada 12 horas' },
  { val: 1440,  label: 'A cada 24 horas' },
];

const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';

export default function TabAvisos() {
  const { isAdmin, usuario } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [renotificando, setRenotificando] = useState<string | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, VisualizacaoStats>>({});
  const [expandedStats, setExpandedStats] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: '',
    corpo: '',
    tipo: 'info',
    persistente: false,
    intervalo_minutos: null as number | null,
    destinatarios: 'todos' as 'todos' | 'tipos' | 'especificos',
    tipos_selecionados: [] as string[],
  });

  const [todosUsuarios, setTodosUsuarios] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [usuariosSelecionados, setUsuariosSelecionados] = useState<string[]>([]);

  const loadAvisos = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('avisos_app')
      .select('id, titulo, corpo, ativa, tipo, persistente, intervalo_minutos, ultima_notificacao_em, criado_em')
      .order('criado_em', { ascending: false });
    setAvisos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAvisos(); }, [loadAvisos]);

  useEffect(() => {
    if (!isAdmin) return;
    (supabase as any).from('hierarquia_usuarios')
      .select('id, nome, tipo')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }: any) => setTodosUsuarios(data || []));
  }, [isAdmin]);

  async function loadStats(aviso_id: string) {
    const { data: dests } = await (supabase as any)
      .from('avisos_destinatarios')
      .select('hierarquia_id, tipo_usuario')
      .eq('aviso_id', aviso_id);

    let destinatarioIds: string[] = [];
    if (!dests || dests.length === 0) {
      const { data: subs } = await (supabase as any)
        .from('push_subscriptions')
        .select('hierarquia_id');
      destinatarioIds = (subs || []).map((s: any) => s.hierarquia_id);
    } else {
      const tipos = dests.filter((d: any) => d.tipo_usuario).map((d: any) => d.tipo_usuario);
      const individuais = dests.filter((d: any) => d.hierarquia_id).map((d: any) => d.hierarquia_id);
      destinatarioIds = [...individuais];
      if (tipos.length > 0) {
        const { data: porTipo } = await (supabase as any)
          .from('hierarquia_usuarios')
          .select('id')
          .in('tipo', tipos)
          .eq('ativo', true);
        destinatarioIds = [...destinatarioIds, ...(porTipo || []).map((u: any) => u.id)];
      }
    }
    destinatarioIds = [...new Set(destinatarioIds)];

    const { data: vizData } = await (supabase as any)
      .from('avisos_visualizacoes')
      .select('hierarquia_id')
      .eq('aviso_id', aviso_id);
    const vizIds = new Set((vizData || []).map((v: any) => v.hierarquia_id));

    const viram = todosUsuarios.filter(u => vizIds.has(u.id));
    const nao_viram = destinatarioIds
      .filter(id => !vizIds.has(id))
      .map(id => todosUsuarios.find(u => u.id === id))
      .filter(Boolean) as { id: string; nome: string }[];

    setStatsMap(prev => ({
      ...prev,
      [aviso_id]: { aviso_id, total_destinatarios: destinatarioIds.length, viram, nao_viram }
    }));
  }

  async function handleSave() {
    if (!form.titulo.trim() || !form.corpo.trim()) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' });
      return;
    }
    setSaving(true);

    try {
      const { data: novoAviso, error: avisoErr } = await (supabase as any)
        .from('avisos_app')
        .insert({
          titulo: form.titulo.trim(),
          corpo: form.corpo.trim(),
          tipo: form.tipo,
          ativa: true,
          persistente: form.persistente,
          intervalo_minutos: form.intervalo_minutos,
          criado_por: usuario?.id || null,
        })
        .select('id')
        .single();

      if (avisoErr) throw avisoErr;
      const aviso_id = novoAviso.id;

      let hierarquiaIds: string[] | undefined;
      if (form.destinatarios === 'tipos' && form.tipos_selecionados.length > 0) {
        await (supabase as any).from('avisos_destinatarios').insert(
          form.tipos_selecionados.map(t => ({ aviso_id, tipo_usuario: t }))
        );
        const { data: porTipo } = await (supabase as any)
          .from('hierarquia_usuarios')
          .select('id')
          .in('tipo', form.tipos_selecionados)
          .eq('ativo', true);
        hierarquiaIds = (porTipo || []).map((u: any) => u.id);
      } else if (form.destinatarios === 'especificos' && usuariosSelecionados.length > 0) {
        await (supabase as any).from('avisos_destinatarios').insert(
          usuariosSelecionados.map(id => ({ aviso_id, hierarquia_id: id }))
        );
        hierarquiaIds = usuariosSelecionados;
      }

      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ aviso_id, hierarquia_ids: hierarquiaIds }),
      });

      toast({ title: '✅ Aviso criado e push enviado!' });
      setForm({ titulo: '', corpo: '', tipo: 'info', persistente: false, intervalo_minutos: null, destinatarios: 'todos', tipos_selecionados: [] });
      setUsuariosSelecionados([]);
      setShowForm(false);
      loadAvisos();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRenotificar(aviso: Aviso) {
    const stats = statsMap[aviso.id];
    const naoViramIds = stats?.nao_viram?.map(u => u.id);
    if (naoViramIds && naoViramIds.length === 0) {
      toast({ title: 'Todos já viram este aviso!' });
      return;
    }

    setRenotificando(aviso.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ aviso_id: aviso.id, hierarquia_ids: naoViramIds }),
      });
      const result = await res.json();
      toast({ title: `✅ Push reenviado para ${result.enviados ?? '?'} pessoa(s)` });
    } catch (err: any) {
      toast({ title: 'Erro ao renotificar', description: err.message, variant: 'destructive' });
    } finally {
      setRenotificando(null);
    }
  }

  async function toggleAtivo(aviso: Aviso) {
    await (supabase as any).from('avisos_app').update({ ativa: !aviso.ativa }).eq('id', aviso.id);
    setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, ativa: !aviso.ativa } : a));
    toast({ title: aviso.ativa ? 'Desativado' : 'Ativado' });
  }

  async function deleteAviso(id: string) {
    if (!confirm('Excluir este aviso?')) return;
    await (supabase as any).from('avisos_app').delete().eq('id', id);
    setAvisos(prev => prev.filter(a => a.id !== id));
    toast({ title: 'Aviso excluído' });
  }

  const getTipo = (key: string) => TIPOS.find(t => t.key === key) || TIPOS[0];
  const avisosVisiveis = isAdmin ? avisos : avisos.filter(a => a.ativa);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-primary" />
        <div>
          <h2 className="text-base font-bold">Avisos & Push</h2>
          <p className="text-xs text-muted-foreground">{isAdmin ? 'Crie avisos e dispare notificações push' : 'Comunicados importantes'}</p>
        </div>
      </div>

      {isAdmin && (
        <button onClick={() => setShowForm(v => !v)}
          className="w-full h-12 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]">
          <Plus size={18} /> Novo Aviso + Push
        </button>
      )}

      {isAdmin && showForm && (
        <div className="section-card space-y-4">
          <h3 className="text-sm font-bold">Novo Aviso</h3>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Tipo</p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, tipo: key }))}
                  className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    form.tipo === key ? 'gradient-primary text-white border-transparent' : 'bg-card border-border text-muted-foreground'
                  }`}>
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Título *</p>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex: Reunião amanhã às 18h" className={inputCls} />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Mensagem *</p>
            <textarea value={form.corpo} onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))} rows={3}
              placeholder="Digite o aviso completo..."
              className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>

          <button onClick={() => setForm(f => ({ ...f, persistente: !f.persistente }))}
            className={`w-full h-10 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              form.persistente ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
            }`}>
            <Bell size={14} />
            {form.persistente ? '✓ Popup persiste até o admin desativar' : 'Popup persistente (reaparece toda vez)'}
          </button>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Intervalo de renotificação push</p>
            </div>
            <select value={form.intervalo_minutos ?? ''} onChange={e => setForm(f => ({ ...f, intervalo_minutos: e.target.value ? Number(e.target.value) : null }))}
              className={inputCls}>
              {INTERVALOS.map(({ val, label }) => (
                <option key={label} value={val ?? ''}>{label}</option>
              ))}
            </select>
            {form.intervalo_minutos && (
              <p className="text-[10px] text-amber-600 px-1">Push reenviado automaticamente a cada {INTERVALOS.find(i => i.val === form.intervalo_minutos)?.label?.replace('A cada ', '')} enquanto ativo</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Destinatários</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['todos', 'tipos', 'especificos'] as const).map(opt => (
                <button key={opt} onClick={() => setForm(f => ({ ...f, destinatarios: opt }))}
                  className={`h-9 rounded-xl text-xs font-semibold border transition-all ${
                    form.destinatarios === opt ? 'gradient-primary text-white border-transparent' : 'bg-card border-border text-muted-foreground'
                  }`}>
                  {opt === 'todos' ? 'Todos' : opt === 'tipos' ? 'Por tipo' : 'Específicos'}
                </button>
              ))}
            </div>

            {form.destinatarios === 'tipos' && (
              <div className="grid grid-cols-2 gap-1.5">
                {TIPOS_USUARIO.map(tipo => (
                  <button key={tipo} onClick={() => setForm(f => ({
                    ...f,
                    tipos_selecionados: f.tipos_selecionados.includes(tipo)
                      ? f.tipos_selecionados.filter(t => t !== tipo)
                      : [...f.tipos_selecionados, tipo]
                  }))}
                    className={`h-8 rounded-lg text-xs font-semibold border transition-all capitalize ${
                      form.tipos_selecionados.includes(tipo) ? 'bg-primary text-white border-transparent' : 'bg-card border-border text-muted-foreground'
                    }`}>
                    {tipo}
                  </button>
                ))}
              </div>
            )}

            {form.destinatarios === 'especificos' && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {todosUsuarios.map(u => (
                  <button key={u.id} onClick={() => setUsuariosSelecionados(prev =>
                    prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                  )}
                    className={`w-full h-9 px-3 rounded-lg text-xs flex items-center gap-2 transition-all border ${
                      usuariosSelecionados.includes(u.id) ? 'bg-primary/10 border-primary/30 text-primary font-semibold' : 'bg-card border-border text-foreground'
                    }`}>
                    <span className="flex-1 text-left truncate">{u.nome}</span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">{u.tipo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full h-11 gradient-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {saving ? 'Enviando...' : 'Publicar + Enviar Push'}
          </button>
        </div>
      )}

      {avisosVisiveis.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum aviso {isAdmin ? '' : 'ativo '}no momento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {avisosVisiveis.map(aviso => {
            const tipo = getTipo(aviso.tipo);
            const TipoIcon = tipo.icon;
            const stats = statsMap[aviso.id];
            const isExpanded = expandedStats === aviso.id;

            return (
              <div key={aviso.id} className={`section-card border ${tipo.color} ${!aviso.ativa ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${tipo.color} shrink-0`}><TipoIcon size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{aviso.titulo}</p>
                      {aviso.persistente && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Persistente</span>}
                      {aviso.intervalo_minutos && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold flex items-center gap-0.5"><Clock size={8} />{INTERVALOS.find(i => i.val === aviso.intervalo_minutos)?.label?.replace('A cada ', '')}</span>}
                      {!aviso.ativa && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Inativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{aviso.corpo}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(aviso.criado_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {isAdmin && aviso.ativa && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <button
                      onClick={async () => {
                        if (!isExpanded) await loadStats(aviso.id);
                        setExpandedStats(isExpanded ? null : aviso.id);
                      }}
                      className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="flex items-center gap-1"><Eye size={12} /> Ver quem viu / não viu</span>
                      {stats && (
                        <span className="text-[10px]">
                          {stats.viram.length} viram · {stats.nao_viram.length} não viram
                        </span>
                      )}
                    </button>

                    {isExpanded && stats && (
                      <div className="mt-2 space-y-2">
                        {stats.viram.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1"><Eye size={9} /> Viram ({stats.viram.length})</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {stats.viram.map(u => (
                                <span key={u.id} className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-700 rounded-full">{u.nome}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {stats.nao_viram.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-red-500 flex items-center gap-1"><EyeOff size={9} /> Não viram ({stats.nao_viram.length})</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {stats.nao_viram.map(u => (
                                <span key={u.id} className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-600 rounded-full">{u.nome}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => handleRenotificar(aviso)}
                          disabled={renotificando === aviso.id || stats.nao_viram.length === 0}
                          className="w-full h-8 rounded-lg bg-amber-500/10 text-amber-600 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95"
                        >
                          {renotificando === aviso.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          Renotificar quem não viu ({stats.nao_viram.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-current/10">
                    <button onClick={() => toggleAtivo(aviso)}
                      className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                        aviso.ativa ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                      }`}>
                      {aviso.ativa ? <><ToggleLeft size={14} /> Desativar</> : <><ToggleRight size={14} /> Ativar</>}
                    </button>
                    <button onClick={() => deleteAviso(aviso.id)}
                      className="h-8 px-3 flex items-center gap-1 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive active:scale-95">
                      <Trash2 size={13} />
                    </button>
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
