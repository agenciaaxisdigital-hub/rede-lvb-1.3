import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, Send, RefreshCw, BellOff, Clock, UserX, Bell, CheckSquare, Square } from 'lucide-react';

interface UsuarioSemCadastro {
  id: string;
  nome: string;
  tipo: string;
  ultimo_cadastro: string | null;
  dias: number; // -1 = nunca
  temPush: boolean;
}

const TIPOS_MONITORADOS = [
  { val: 'fernanda',  label: 'Fernanda',  tabela: 'cadastros_fernanda',  campo: 'cadastrado_por' },
  { val: 'social',    label: 'Social',    tabela: 'cadastros_social',    campo: 'cadastrado_por' },
  { val: 'afiliado',  label: 'Afiliado',  tabela: 'cadastros_afiliados', campo: 'afiliado_id' },
  { val: 'lideranca', label: 'Liderança', tabela: 'liderancas',          campo: 'cadastrado_por' },
  { val: 'suplente',  label: 'Suplente',  tabela: 'liderancas',          campo: 'cadastrado_por' },
];

function getUrgencia(dias: number): { cor: string; bg: string; label: string; icone: typeof AlertCircle } {
  if (dias === -1) return { cor: 'text-red-600',   bg: 'bg-red-500/10',   label: 'nunca cadastrou', icone: UserX };
  if (dias >= 7)   return { cor: 'text-red-500',   bg: 'bg-red-500/10',   label: `${dias} dias atrás`, icone: AlertCircle };
  if (dias >= 3)   return { cor: 'text-amber-600', bg: 'bg-amber-500/10', label: `${dias} dias atrás`, icone: Clock };
  if (dias === 2)  return { cor: 'text-amber-500', bg: 'bg-amber-500/10', label: 'anteontem', icone: Clock };
  return               { cor: 'text-yellow-600', bg: 'bg-yellow-500/10', label: 'ontem', icone: Clock };
}

async function enviarPush(avisoid: string, hierarquiaIds: string[]) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacao`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ aviso_id: avisoid, hierarquia_ids: hierarquiaIds }),
  });
  return res.json();
}

async function criarAviso(titulo: string, corpo: string): Promise<string> {
  const { data, error } = await (supabase as any)
    .from('avisos_app')
    .insert({ titulo, corpo, tipo: 'urgente', ativa: false, persistente: false })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

function enviarBroadcast(avisoid: string, titulo: string, corpo: string, ids: string[]) {
  const ch = (supabase as any).channel('app-notifications');
  ch.subscribe((status: string) => {
    if (status !== 'SUBSCRIBED') return;
    ch.send({
      type: 'broadcast',
      event: 'new_notification',
      payload: { aviso_id: avisoid, titulo, corpo, tipo: 'urgente', target_ids: ids },
    });
    setTimeout(() => (supabase as any).removeChannel(ch), 3000);
  });
}

export default function TabCobranca() {
  const [tipoFiltro, setTipoFiltro] = useState(TIPOS_MONITORADOS[0].val);
  const [semCadastro, setSemCadastro] = useState<UsuarioSemCadastro[]>([]);
  const [loading, setLoading] = useState(false);
  const [enviandoTodos, setEnviandoTodos] = useState(false);
  const [enviandoIds, setEnviandoIds] = useState<Set<string>>(new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modoSelecao, setModoSelecao] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setSelecionados(new Set());
    try {
      const cfg = TIPOS_MONITORADOS.find(t => t.val === tipoFiltro)!;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const [{ data: usuarios }, { data: pushSubs }] = await Promise.all([
        (supabase as any)
          .from('hierarquia_usuarios')
          .select('id, nome, tipo')
          .eq('tipo', tipoFiltro)
          .eq('ativo', true)
          .order('nome'),
        (supabase as any)
          .from('push_subscriptions')
          .select('hierarquia_id'),
      ]);

      if (!usuarios || usuarios.length === 0) { setSemCadastro([]); return; }

      const comPush = new Set((pushSubs || []).map((s: any) => s.hierarquia_id));

      const { data: cadastrosHoje } = await (supabase as any)
        .from(cfg.tabela)
        .select(`${cfg.campo}`)
        .gte('criado_em', hoje.toISOString());

      const comCadastroHoje = new Set((cadastrosHoje || []).map((c: any) => c[cfg.campo]));

      const ids = usuarios.map((u: any) => u.id);
      const { data: ultimosCadastros } = await (supabase as any)
        .from(cfg.tabela)
        .select(`${cfg.campo}, criado_em`)
        .in(cfg.campo, ids)
        .order('criado_em', { ascending: false });

      const ultimoMap: Record<string, string> = {};
      for (const c of ultimosCadastros || []) {
        if (!ultimoMap[c[cfg.campo]]) ultimoMap[c[cfg.campo]] = c.criado_em;
      }

      const resultado: UsuarioSemCadastro[] = usuarios
        .filter((u: any) => !comCadastroHoje.has(u.id))
        .map((u: any) => {
          const ultimo = ultimoMap[u.id] || null;
          const dias = ultimo
            ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000)
            : -1;
          return { id: u.id, nome: u.nome, tipo: u.tipo, ultimo_cadastro: ultimo, dias, temPush: comPush.has(u.id) };
        })
        .sort((a, b) => {
          if (a.dias === -1 && b.dias !== -1) return -1;
          if (a.dias !== -1 && b.dias === -1) return 1;
          return b.dias - a.dias;
        });

      setSemCadastro(resultado);
    } finally {
      setLoading(false);
    }
  }, [tipoFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function selecionarTodos() { setSelecionados(new Set(semCadastro.map(u => u.id))); }
  function limparSelecao() { setSelecionados(new Set()); setModoSelecao(false); }

  async function notificarLista(lista: UsuarioSemCadastro[]) {
    if (lista.length === 0) return;
    const titulo = 'Você não cadastrou hoje!';
    const corpo = lista.length === 1
      ? `${lista[0].nome}, não esqueça de registrar seus cadastros de hoje. Acesse o app agora!`
      : 'Não esqueça de registrar seus cadastros de hoje. Acesse o app agora!';
    const ids = lista.map(u => u.id);
    const avisoid = await criarAviso(titulo, corpo);
    await (supabase as any).from('avisos_destinatarios').insert(
      ids.map(id => ({ aviso_id: avisoid, hierarquia_id: id }))
    );
    const result = await enviarPush(avisoid, ids);
    enviarBroadcast(avisoid, titulo, corpo, ids);
    const comPush = lista.filter(u => u.temPush).length;
    const semPush = lista.length - comPush;
    let desc = '';
    if (result.enviados > 0) desc = `${result.enviados} push enviado(s)`;
    if (semPush > 0) desc += (desc ? ' · ' : '') + `${semPush} sem push (verão no app)`;
    toast({ title: `Enviado para ${lista.length} pessoa(s)`, description: desc || undefined });
  }

  async function notificarUsuario(u: UsuarioSemCadastro) {
    if (enviandoIds.has(u.id)) return;
    setEnviandoIds(prev => new Set([...prev, u.id]));
    try {
      await notificarLista([u]);
    } catch (err: any) {
      toast({ title: 'Erro ao notificar', description: err.message, variant: 'destructive' });
    } finally {
      setEnviandoIds(prev => { const n = new Set(prev); n.delete(u.id); return n; });
    }
  }

  async function notificarTodos() {
    if (semCadastro.length === 0) return;
    setEnviandoTodos(true);
    try {
      await notificarLista(semCadastro);
    } catch (err: any) {
      toast({ title: 'Erro ao notificar', description: err.message, variant: 'destructive' });
    } finally {
      setEnviandoTodos(false);
    }
  }

  async function notificarSelecionados() {
    const lista = semCadastro.filter(u => selecionados.has(u.id));
    if (lista.length === 0) return;
    setEnviandoTodos(true);
    try {
      await notificarLista(lista);
      limparSelecao();
    } catch (err: any) {
      toast({ title: 'Erro ao notificar', description: err.message, variant: 'destructive' });
    } finally {
      setEnviandoTodos(false);
    }
  }

  const tipoAtual = TIPOS_MONITORADOS.find(t => t.val === tipoFiltro);
  const nuncaCount = semCadastro.filter(u => u.dias === -1).length;
  const antigosCount = semCadastro.filter(u => u.dias >= 3).length;
  const comPushCount = semCadastro.filter(u => u.temPush).length;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <AlertCircle size={20} className="text-amber-500" />
        <div>
          <h2 className="text-base font-bold">Sem cadastro hoje</h2>
          <p className="text-xs text-muted-foreground">Usuários que não registraram nada hoje</p>
        </div>
      </div>

      {/* Filtro por tipo */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-hide">
        {TIPOS_MONITORADOS.map(t => (
          <button key={t.val} onClick={() => setTipoFiltro(t.val)}
            className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
              tipoFiltro === t.val ? 'gradient-primary text-white' : 'bg-card border border-border text-muted-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Resumo de urgência + push status */}
      {semCadastro.length > 0 && (
        <div className="flex gap-2">
          {nuncaCount > 0 && (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <UserX size={14} className="text-red-600 shrink-0" />
              <p className="text-xs font-bold text-red-600">{nuncaCount} nunca cadastrou</p>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
            <Bell size={14} className="text-primary shrink-0" />
            <p className="text-xs font-bold text-primary">{comPushCount} com push</p>
          </div>
        </div>
      )}

      {/* Info sobre push */}
      {semCadastro.length > 0 && semCadastro.length - comPushCount > 0 && (
        <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
          <BellOff size={11} />
          <span>{semCadastro.length - comPushCount} sem push ativo — verão o aviso quando abrirem o app</span>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        <button onClick={carregar} disabled={loading}
          className="h-10 px-4 rounded-xl bg-muted border border-border text-xs font-semibold flex items-center gap-1.5 active:scale-95 shrink-0">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>

        <button
          onClick={() => { setModoSelecao(v => !v); if (modoSelecao) setSelecionados(new Set()); }}
          disabled={semCadastro.length === 0}
          className={`h-10 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 shrink-0 border transition-all ${
            modoSelecao ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
          }`}>
          {modoSelecao ? <CheckSquare size={13} /> : <Square size={13} />}
          {modoSelecao ? 'Cancelar' : 'Selecionar'}
        </button>

        {modoSelecao && selecionados.size > 0 ? (
          <button onClick={notificarSelecionados} disabled={enviandoTodos}
            className="flex-1 h-10 rounded-xl gradient-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.97]">
            {enviandoTodos ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Notificar {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
          </button>
        ) : (
          <button onClick={notificarTodos} disabled={enviandoTodos || semCadastro.length === 0}
            className="flex-1 h-10 rounded-xl gradient-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.97]">
            {enviandoTodos ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Notificar todos ({semCadastro.length})
          </button>
        )}
      </div>

      {/* Selecionar todos / limpar quando em modo seleção */}
      {modoSelecao && (
        <div className="flex gap-2">
          <button onClick={selecionarTodos}
            className="flex-1 h-8 rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20 active:scale-95">
            Selecionar todos ({semCadastro.length})
          </button>
          <button onClick={limparSelecao}
            className="h-8 px-4 rounded-lg bg-muted text-muted-foreground text-xs font-semibold border border-border active:scale-95">
            Limpar
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : semCadastro.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm font-semibold">Todos cadastraram hoje!</p>
          <p className="text-xs">Nenhum usuário {tipoAtual?.label} em falta</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {semCadastro.map(u => {
            const { cor, bg, label, icone: Icone } = getUrgencia(u.dias);
            const isEnviando = enviandoIds.has(u.id);
            const isSelecionado = selecionados.has(u.id);
            const borderCor = bg.replace('bg-', 'border-').replace('/10', '/20');
            return (
              <div
                key={u.id}
                onClick={modoSelecao ? () => toggleSelecionado(u.id) : undefined}
                className={`section-card !py-3 !px-3.5 flex items-center gap-3 border transition-all ${
                  modoSelecao ? 'cursor-pointer active:scale-[0.98]' : ''
                } ${isSelecionado ? 'border-primary bg-primary/5' : borderCor}`}
              >
                {/* Checkbox em modo seleção */}
                {modoSelecao && (
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelecionado ? 'bg-primary border-primary' : 'border-border'
                  }`}>
                    {isSelecionado && (
                      <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                )}

                <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center shrink-0`}>
                  <Icone size={16} className={cor} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{u.nome}</p>
                    {u.temPush ? (
                      <Bell size={11} className="text-primary shrink-0" title="Push ativo" />
                    ) : (
                      <BellOff size={11} className="text-muted-foreground/40 shrink-0" title="Sem push" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Último cadastro: <span className={cor}>{label}</span>
                  </p>
                </div>

                {!modoSelecao && (
                  <button
                    onClick={() => notificarUsuario(u)}
                    disabled={isEnviando}
                    className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all"
                    title={`Notificar ${u.nome}`}
                  >
                    {isEnviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
