import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, X, Info, AlertTriangle, CheckCircle, Zap, BellRing } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushSubscription } from '@/hooks/usePushSubscription';

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  tipo: 'info' | 'alerta' | 'sucesso' | 'urgente';
  ativa: boolean;
  persistente: boolean;
  criado_em: string;
}

const TIPO_CONFIG = {
  info:    { icon: Info,          color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  alerta:  { icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  sucesso: { icon: CheckCircle,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  urgente: { icon: Zap,           color: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
};

export default function NotificationBell() {
  const { usuario } = useAuth();
  const { supported, permission, subscribed, loading: pushLoading, subscribe } = usePushSubscription();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [visualizados, setVisualizados] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!usuario?.id) return;

    const { data: avisosData } = await (supabase as any)
      .from('avisos_app')
      .select('id, titulo, corpo, tipo, ativa, persistente, criado_em')
      .eq('ativa', true)
      .order('criado_em', { ascending: false });

    if (!avisosData) return;

    const avisosIds = avisosData.map((a: any) => a.id);
    const { data: dests } = await (supabase as any)
      .from('avisos_destinatarios')
      .select('aviso_id, hierarquia_id, tipo_usuario')
      .in('aviso_id', avisosIds);

    const meuTipo = (usuario as any).tipo as string;
    const meuId = usuario.id;

    const avisosVisiveis = avisosData.filter((aviso: any) => {
      const destsDeste = (dests || []).filter((d: any) => d.aviso_id === aviso.id);
      if (destsDeste.length === 0) return true;
      return destsDeste.some((d: any) =>
        d.hierarquia_id === meuId || d.tipo_usuario === meuTipo
      );
    });

    setAvisos(avisosVisiveis);

    const { data: vizData } = await (supabase as any)
      .from('avisos_visualizacoes')
      .select('aviso_id')
      .eq('hierarquia_id', meuId)
      .in('aviso_id', avisosIds);

    const vizSet = new Set<string>((vizData || []).map((v: any) => v.aviso_id));
    setVisualizados(vizSet);

    const persistenteNaoVisto = avisosVisiveis.find(
      (a: any) => a.persistente && !vizSet.has(a.id)
    );
    if (persistenteNaoVisto) {
      setOpen(true);
    }
  }, [usuario?.id, (usuario as any)?.tipo]);

  useEffect(() => {
    loadData();
    const channel = (supabase as any)
      .channel('notif-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos_app' }, loadData)
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [loadData]);

  async function marcarComoVisto(avisosParaMarcar: Aviso[]) {
    if (!usuario?.id) return;
    const naoMarcados = avisosParaMarcar.filter(a => !visualizados.has(a.id));
    if (naoMarcados.length === 0) return;

    await (supabase as any).from('avisos_visualizacoes').upsert(
      naoMarcados.map(a => ({ aviso_id: a.id, hierarquia_id: usuario.id })),
      { onConflict: 'aviso_id,hierarquia_id', ignoreDuplicates: true }
    );
    setVisualizados(prev => new Set([...prev, ...naoMarcados.map(a => a.id)]));
  }

  function handleOpen() {
    setOpen(true);
  }

  async function handleClose() {
    setOpen(false);
    await marcarComoVisto(avisos);
  }

  const unreadCount = avisos.filter(a => !visualizados.has(a.id)).length;
  const showPushBanner = supported && permission !== 'denied' && !subscribed;

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl bg-muted/50 hover:bg-muted active:scale-95 transition-all"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground'} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">Avisos</h3>
              </div>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {showPushBanner && (
                <button
                  onClick={async () => { await subscribe(); }}
                  disabled={pushLoading}
                  className="w-full p-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 active:scale-[0.98] transition-all"
                >
                  <BellRing size={20} className="text-primary shrink-0" />
                  <div className="text-left flex-1">
                    <p className="text-xs font-bold text-primary">Ativar notificações push</p>
                    <p className="text-[10px] text-muted-foreground">Receba avisos no celular mesmo com o app fechado</p>
                  </div>
                </button>
              )}

              {avisos.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhum aviso no momento.</p>
                </div>
              ) : (
                avisos.map(aviso => {
                  const cfg = TIPO_CONFIG[aviso.tipo] ?? TIPO_CONFIG.info;
                  const Icon = cfg.icon;
                  const lido = visualizados.has(aviso.id);
                  return (
                    <div
                      key={aviso.id}
                      className={`p-4 rounded-2xl border ${cfg.border} ${cfg.bg} space-y-2 ${lido ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={cfg.color} />
                        <h4 className={`text-sm font-bold ${cfg.color} flex-1`}>{aviso.titulo}</h4>
                        {!lido && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {aviso.corpo}
                      </p>
                      <p className="text-[9px] text-muted-foreground pt-1">
                        {new Date(aviso.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-muted/30 border-t border-border">
              <button
                onClick={handleClose}
                className="w-full h-11 gradient-primary text-white font-bold rounded-xl active:scale-[0.98] transition-all shadow-md shadow-primary/20"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
