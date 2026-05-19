import { useState, useEffect, useCallback, useRef } from 'react';
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
  info:    { icon: Info,          color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    gradient: 'from-blue-500/20 to-blue-500/5' },
  alerta:  { icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   gradient: 'from-amber-500/20 to-amber-500/5' },
  sucesso: { icon: CheckCircle,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', gradient: 'from-emerald-500/20 to-emerald-500/5' },
  urgente: { icon: Zap,           color: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     gradient: 'from-red-500/30 to-red-500/5' },
};

// Persistent AudioContext to avoid autoplay policy issues
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

// Unlock AudioContext on first user gesture (call once at module level)
if (typeof window !== 'undefined') {
  const unlock = () => {
    try { getAudioCtx(); } catch {}
    document.removeEventListener('touchstart', unlock);
    document.removeEventListener('click', unlock);
  };
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('click', unlock, { once: true });
}

function playNotifSound(urgente = false) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    if (urgente) {
      // Double beep for urgente
      [0, 0.25].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, now + delay);
        osc.frequency.exponentialRampToValueAtTime(880, now + delay + 0.25);
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.35, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
        osc.start(now + delay);
        osc.stop(now + delay + 0.3);
        osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
      });
    } else {
      // Single soft beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
    }
  } catch {
    // AudioContext unavailable
  }
}

export default function NotificationBell() {
  const { usuario } = useAuth();
  const { supported, permission, subscribed, loading: pushLoading, subscribe } = usePushSubscription();

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [visualizados, setVisualizados] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [modalAviso, setModalAviso] = useState<Aviso | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const initialDoneRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const modalTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const triggerModal = useCallback((aviso: Aviso) => {
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
    setModalAviso(aviso);
    // Small delay so CSS transition plays
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setModalVisible(true));
    });
    playNotifSound(aviso.tipo === 'urgente');

    if (aviso.tipo !== 'urgente') {
      // Auto-dismiss non-urgent after 6s
      modalTimerRef.current = setTimeout(() => {
        setModalVisible(false);
        setTimeout(() => setModalAviso(null), 300);
      }, 6000);
    }
  }, []);

  const dismissModal = useCallback(() => {
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
    setModalVisible(false);
    setTimeout(() => setModalAviso(null), 300);
  }, []);

  const loadData = useCallback(async (isRealtime = false) => {
    if (!usuario?.id) return;

    const { data: avisosData } = await (supabase as any)
      .from('avisos_app')
      .select('id, titulo, corpo, tipo, ativa, persistente, criado_em')
      .eq('ativa', true)
      .order('criado_em', { ascending: false });

    if (!avisosData) return;

    const allIds = avisosData.map((a: any) => a.id);

    const { data: dests } = await (supabase as any)
      .from('avisos_destinatarios')
      .select('aviso_id, hierarquia_id, tipo_usuario')
      .in('aviso_id', allIds);

    const meuTipo = (usuario as any).tipo as string;
    const meuId = usuario.id;

    const visiveis: Aviso[] = avisosData.filter((a: any) => {
      const d = (dests || []).filter((x: any) => x.aviso_id === a.id);
      if (d.length === 0) return true;
      return d.some((x: any) => x.hierarquia_id === meuId || x.tipo_usuario === meuTipo);
    });

    const { data: vizData } = await (supabase as any)
      .from('avisos_visualizacoes')
      .select('aviso_id')
      .eq('hierarquia_id', meuId)
      .in('aviso_id', allIds);

    const vizSet = new Set<string>((vizData || []).map((v: any) => v.aviso_id));

    if (isRealtime && initialDoneRef.current) {
      const novos = visiveis.filter(a => !knownIdsRef.current.has(a.id) && !vizSet.has(a.id));
      if (novos.length > 0) {
        triggerModal(novos[0]);
      }
    } else if (!initialDoneRef.current) {
      const persistenteNaoVisto = visiveis.find(a => a.persistente && !vizSet.has(a.id));
      if (persistenteNaoVisto) {
        setPanelOpen(true);
        playNotifSound(persistenteNaoVisto.tipo === 'urgente');
      }
      initialDoneRef.current = true;
    }

    knownIdsRef.current = new Set(visiveis.map(a => a.id));
    setAvisos(visiveis);
    setVisualizados(vizSet);
  }, [usuario?.id, (usuario as any)?.tipo, triggerModal]);

  useEffect(() => {
    loadData(false);

    const channel = (supabase as any)
      .channel('notif-bell-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos_app' }, () => loadData(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'avisos_app' }, () => loadData(true))
      .subscribe();

    const broadcastChannel = (supabase as any)
      .channel('app-notifications')
      .on('broadcast', { event: 'new_notification' }, ({ payload }: any) => {
        const targetIds: string[] = payload?.target_ids ?? [];
        if (targetIds.length > 0 && !targetIds.includes(usuario?.id ?? '')) return;
        triggerModal({
          id: payload?.aviso_id ?? `notif-${Date.now()}`,
          titulo: payload?.titulo ?? 'Notificação',
          corpo: payload?.corpo ?? '',
          tipo: (payload?.tipo ?? 'urgente') as Aviso['tipo'],
          ativa: true,
          persistente: false,
          criado_em: new Date().toISOString(),
        });
      })
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
      (supabase as any).removeChannel(broadcastChannel);
      if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
    };
  }, [loadData]);

  async function marcarTodosLidos() {
    if (!usuario?.id) return;
    const naoLidos = avisos.filter(a => !visualizados.has(a.id));
    if (naoLidos.length === 0) return;
    await (supabase as any).from('avisos_visualizacoes').upsert(
      naoLidos.map(a => ({ aviso_id: a.id, hierarquia_id: usuario.id })),
      { onConflict: 'aviso_id,hierarquia_id', ignoreDuplicates: true }
    );
    setVisualizados(prev => new Set([...prev, ...naoLidos.map(a => a.id)]));
  }

  async function handleClosePanel() {
    setPanelOpen(false);
    await marcarTodosLidos();
  }

  const unreadCount = avisos.filter(a => !visualizados.has(a.id)).length;
  const showPushBanner = supported && permission !== 'denied' && !subscribed;
  const modalCfg = modalAviso ? (TIPO_CONFIG[modalAviso.tipo] ?? TIPO_CONFIG.info) : null;
  const ModalIcon = modalCfg?.icon ?? null;

  return (
    <>
      {/* Botão sino */}
      <button
        onClick={() => setPanelOpen(true)}
        className="relative p-2 rounded-xl bg-muted/50 hover:bg-muted active:scale-95 transition-all"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground'} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Modal centralizado para novos avisos */}
      {modalAviso && modalCfg && ModalIcon && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          style={{
            opacity: modalVisible ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: modalVisible ? 'auto' : 'none',
          }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={dismissModal}
          />

          {/* Card central */}
          <div
            className={`relative w-full max-w-sm bg-card rounded-3xl shadow-2xl border ${modalCfg.border} overflow-hidden`}
            style={{
              transform: modalVisible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
              transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* Gradient topo */}
            <div className={`h-1.5 bg-gradient-to-r ${modalCfg.gradient} w-full`} />

            <div className="p-5">
              {/* Ícone + fechar */}
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-2xl ${modalCfg.bg} flex items-center justify-center`}>
                  <ModalIcon size={24} className={modalCfg.color} />
                </div>
                <button
                  onClick={dismissModal}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors -mr-1 -mt-1"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Conteúdo */}
              <h3 className={`text-base font-bold ${modalCfg.color} mb-1.5`}>{modalAviso.titulo}</h3>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{modalAviso.corpo}</p>

              {/* Botão fechar */}
              <button
                onClick={() => { dismissModal(); setPanelOpen(true); }}
                className={`w-full mt-4 h-11 rounded-2xl gradient-primary text-white font-semibold text-sm active:scale-[0.97] transition-all shadow-md shadow-primary/20`}
              >
                Ver avisos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Painel de avisos — bottom sheet */}
      {panelOpen && (
        <div className="fixed inset-0 z-[200]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleClosePanel}
          />
          <div className="absolute bottom-0 inset-x-0 max-h-[85dvh] flex flex-col bg-card rounded-t-3xl shadow-2xl border-t border-border animate-in slide-in-from-bottom duration-300">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                <h3 className="text-base font-bold text-foreground">Avisos</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {unreadCount} novo{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button onClick={handleClosePanel} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2.5 overscroll-contain">
              {showPushBanner && (
                <button
                  onClick={async () => { await subscribe(); }}
                  disabled={pushLoading}
                  className="w-full p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <BellRing size={20} className="text-primary shrink-0" />
                  <div className="text-left flex-1">
                    <p className="text-xs font-bold text-primary">Ativar notificações push</p>
                    <p className="text-[10px] text-muted-foreground">Receba avisos mesmo com o app fechado</p>
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
                      className={`p-4 rounded-2xl border ${cfg.border} ${lido ? 'bg-muted/20' : cfg.bg} space-y-1.5 transition-colors`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={15} className={lido ? 'text-muted-foreground' : cfg.color} />
                        <h4 className={`text-sm font-bold flex-1 ${lido ? 'text-muted-foreground' : cfg.color}`}>
                          {aviso.titulo}
                        </h4>
                        {!lido && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{aviso.corpo}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {new Date(aviso.criado_em).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 pt-3 border-t border-border shrink-0"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
              <button
                onClick={handleClosePanel}
                className="w-full h-12 gradient-primary text-white font-bold rounded-2xl active:scale-[0.98] transition-all shadow-md shadow-primary/20 text-sm"
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
