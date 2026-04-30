import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, X, Info, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  tipo: 'info' | 'alerta' | 'sucesso' | 'urgente';
  ativa: boolean;
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
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    loadAvisos();

    const channel = supabase
      .channel('avisos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos_app' }, () => {
        loadAvisos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [usuario]);

  async function loadAvisos() {
    const { data } = await supabase
      .from('avisos_app')
      .select('*')
      .eq('ativa', true)
      .order('criado_em', { ascending: false });

    if (data) {
      setAvisos(data as Aviso[]);

      const readIds: string[] = JSON.parse(localStorage.getItem('read_avisos') || '[]');
      const unread = data.filter((a: any) => !readIds.includes(a.id)).length;
      setUnreadCount(unread);

      // Auto-popup para avisos urgentes não vistos nesta sessão
      const urgent = data.find((a: any) => a.tipo === 'urgente' && !readIds.includes(a.id));
      if (urgent && !sessionStorage.getItem('urgente_shown_' + urgent.id)) {
        setOpen(true);
        sessionStorage.setItem('urgente_shown_' + urgent.id, 'true');
      }
    }
  }

  function markAllRead() {
    const readIds = avisos.map(a => a.id);
    localStorage.setItem('read_avisos', JSON.stringify(readIds));
    setUnreadCount(0);
  }

  const handleOpen = () => {
    setOpen(true);
    markAllRead();
  };

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
              <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {avisos.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhum aviso no momento.</p>
                </div>
              ) : (
                avisos.map(aviso => {
                  const cfg = TIPO_CONFIG[aviso.tipo] ?? TIPO_CONFIG.info;
                  const Icon = cfg.icon;
                  return (
                    <div key={aviso.id} className={`p-4 rounded-2xl border ${cfg.border} ${cfg.bg} space-y-2`}>
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={cfg.color} />
                        <h4 className={`text-sm font-bold ${cfg.color}`}>{aviso.titulo}</h4>
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
                onClick={() => setOpen(false)}
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
