import { useMemo } from 'react';
import { useUsuarios } from '@/hooks/useDataCache';
import { useAuth } from '@/contexts/AuthContext';
import { Network, User, ChevronRight, Loader2 } from 'lucide-react';

interface HierarquiaUsuario {
  id: string;
  nome: string;
  tipo: string;
  superior_id: string | null;
}

export default function MinhaRede() {
  const { usuario } = useAuth();
  const { data: usuarios, isLoading } = useUsuarios();

  const usuariosList = (usuarios || []) as unknown as HierarquiaUsuario[];

  const meuTime = useMemo(() => {
    if (!usuario?.id) return [];
    return usuariosList.filter(u => u.superior_id === usuario.id);
  }, [usuariosList, usuario?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="section-card bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
          <Network size={18} className="text-primary" />
          Minha Rede / Time
        </h2>
        <p className="text-[11px] text-muted-foreground mb-4">
          Veja as pessoas que você indicou para o sistema.
        </p>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-background/50 border border-border">
            <p className="text-2xl font-black text-primary leading-none">{meuTime.length}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Indicados</p>
          </div>
          <div className="p-3 rounded-xl bg-background/50 border border-border">
            <p className="text-2xl font-black text-foreground leading-none">
              {usuariosList.find(u => u.id === usuario?.id)?.superior_id ? 1 : 0}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Superior</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Seu Time</h3>
        {meuTime.map(sub => (
          <div key={sub.id} className="section-card flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <User size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">{sub.nome}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{sub.tipo}</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
        ))}
        
        {meuTime.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
            <User size={30} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground font-medium">Você ainda não tem indicados na sua rede.</p>
          </div>
        )}
      </div>
    </div>
  );
}
