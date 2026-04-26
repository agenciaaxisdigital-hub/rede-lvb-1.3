import { useMemo, useState } from 'react';
import { useUsuarios } from '@/hooks/useDataCache';
import { useAuth } from '@/contexts/AuthContext';
import { Network, User, ChevronRight, ChevronDown, Loader2, Link2, PlusCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HierarquiaUsuario {
  id: string;
  nome: string;
  tipo: string;
  superior_id: string | null;
}

function TreeNode({ 
  node, 
  allUsers, 
  level = 1,
  onRefetch 
}: { 
  node: HierarquiaUsuario; 
  allUsers: HierarquiaUsuario[]; 
  level?: number;
  onRefetch: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const children = useMemo(() => {
    return allUsers.filter(u => u.superior_id === node.id);
  }, [allUsers, node.id]);

  const paginatedChildren = useMemo(() => {
    return children.slice(0, page * pageSize);
  }, [children, page]);

  const hasMore = children.length > paginatedChildren.length;

  return (
    <div className="space-y-2">
      <div 
        className={`section-card flex items-center justify-between p-3 cursor-pointer transition-all hover:border-primary/40 ${isExpanded ? 'border-primary/30 bg-primary/5' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
            <User size={18} />
          </div>
          <div>
            <p className="text-sm font-bold">{node.nome}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Nível {level} · {node.tipo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {children.length > 0 && (
            <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {children.length}
            </span>
          )}
          {children.length > 0 ? (
            isExpanded ? <ChevronDown size={14} className="text-primary" /> : <ChevronRight size={14} className="text-muted-foreground" />
          ) : null}
        </div>
      </div>

      {isExpanded && children.length > 0 && (
        <div className="pl-4 ml-4 border-l-2 border-primary/10 space-y-2 py-1">
          {paginatedChildren.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              allUsers={allUsers} 
              level={level + 1}
              onRefetch={onRefetch}
            />
          ))}
          
          {hasMore && (
            <button 
              onClick={(e) => { e.stopPropagation(); setPage(p => p + 1); }}
              className="text-[10px] font-bold text-primary uppercase tracking-widest py-2 w-full text-center hover:bg-primary/5 rounded-lg transition-colors"
            >
              Ver mais indicados ({children.length - paginatedChildren.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function VincularUsuarioExistente({ onRefetch }: { onRefetch: () => void }) {
  const { usuario } = useAuth();
  const { data: usuarios } = useUsuarios();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [open, setOpen] = useState(false);

  const usuariosList = (usuarios || []) as unknown as HierarquiaUsuario[];
  
  const filtered = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return usuariosList.filter(u => 
      u.id !== usuario?.id && 
      !u.superior_id && 
      u.nome.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [usuariosList, searchTerm, usuario?.id]);

  const handleLink = async (targetUserId: string) => {
    setIsLinking(true);
    try {
      const { error } = await supabase
        .from('hierarquia_usuarios')
        .update({ superior_id: usuario?.id })
        .eq('id', targetUserId);

      if (error) throw error;
      
      toast({ title: "Sucesso!", description: "Usuário vinculado à sua rede." });
      setOpen(false);
      onRefetch();
    } catch (err: any) {
      toast({ title: "Erro ao vincular", description: err.message, variant: "destructive" });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          <Link2 size={14} /> Vincular Existente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Usuário Existente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Buscar por nome..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {filtered.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                <div>
                  <p className="text-sm font-bold">{u.nome}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{u.tipo}</p>
                </div>
                <Button size="sm" onClick={() => handleLink(u.id)} disabled={isLinking}>
                  Vincular
                </Button>
              </div>
            ))}
            {searchTerm.length >= 2 && filtered.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">Nenhum usuário sem superior encontrado.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MinhaRede() {
  const { usuario } = useAuth();
  const { data: usuarios, isLoading, refetch } = useUsuarios();

  const usuariosList = (usuarios || []) as unknown as HierarquiaUsuario[];

  const level1 = useMemo(() => {
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
              <Network size={18} className="text-primary" />
              Minha Rede / Árvore Genealógica
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Visualize sua estrutura hierárquica completa.
            </p>
          </div>
          <VincularUsuarioExistente onRefetch={refetch} />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-background/50 border border-border">
            <p className="text-2xl font-black text-primary leading-none">{level1.length}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Nível 1 (Diretos)</p>
          </div>
          <div className="p-3 rounded-xl bg-background/50 border border-border">
            <p className="text-2xl font-black text-foreground leading-none">
              {usuariosList.filter(u => {
                // Simple check for indirects (at least Level 2)
                const isDirect = u.superior_id === usuario?.id;
                if (isDirect) return false;
                
                // Check if any of my direct reports is this user's ancestor
                // This is a simplified check for the summary card
                let curr = u;
                while (curr?.superior_id) {
                  if (curr.superior_id === usuario?.id) return true;
                  const parent = usuariosList.find(x => x.id === curr.superior_id);
                  if (!parent || parent.id === curr.id) break;
                  curr = parent;
                }
                return false;
              }).length}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Total na Rede</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Seu Time</h3>
        {level1.map(sub => (
          <TreeNode 
            key={sub.id} 
            node={sub} 
            allUsers={usuariosList} 
            level={1} 
            onRefetch={refetch}
          />
        ))}
        
        {level1.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
            <User size={30} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground font-medium">Você ainda não tem indicados na sua rede.</p>
          </div>
        )}
      </div>
    </div>
  );
}
