import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useUsuarios } from '@/hooks/useDataCache';
import { Search, UserPlus, Trash2, Loader2, Network, ChevronRight, User } from 'lucide-react';

interface HierarquiaUsuario {
  id: string;
  nome: string;
  tipo: string;
  superior_id: string | null;
  link_token: string | null;
}

export default function AdminVinculos() {
  const { data: usuarios, isLoading, refetch } = useUsuarios();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [linkingTo, setLinkingTo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const usuariosList = (usuarios || []) as unknown as HierarquiaUsuario[];

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return usuariosList;
    const s = searchTerm.toLowerCase();
    return usuariosList.filter(u => u.nome.toLowerCase().includes(s));
  }, [usuariosList, searchTerm]);

  const handleLink = async () => {
    if (!selectedUser || !linkingTo) return;
    if (selectedUser === linkingTo) {
      toast({ title: 'Erro', description: 'Não é possível vincular um usuário a ele mesmo', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('hierarquia_usuarios')
        .update({ superior_id: linkingTo })
        .eq('id', selectedUser);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Vínculo criado com sucesso!' });
      setSelectedUser(null);
      setLinkingTo(null);
      refetch();
    } catch (err: any) {
      toast({ title: 'Erro ao vincular', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLink = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este vínculo?')) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('hierarquia_usuarios')
        .update({ superior_id: null })
        .eq('id', userId);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Vínculo removido!' });
      refetch();
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getSuperiorName = (id: string | null) => {
    if (!id) return null;
    return usuariosList.find(u => u.id === id)?.nome || 'Desconhecido';
  };

  const getSubordinates = (id: string) => {
    return usuariosList.filter(u => u.superior_id === id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="section-card">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Network size={20} className="text-primary" />
          Gestão de Rede / Vínculos
        </h2>
        <div className="p-3 mb-4 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary leading-relaxed">
          <strong>Dica:</strong> Vincule um usuário a outro para criar uma estrutura de rede. 
          O usuário vinculado aparecerá como "indicado por" no sistema.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Usuário (Quem será vinculado)</label>
            <select 
              value={selectedUser || ''} 
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-11 px-3 bg-muted border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Selecionar usuário...</option>
              {usuariosList.map(u => (
                <option key={u.id} value={u.id}>{u.nome} ({u.tipo})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Superior (Vincular a quem)</label>
            <select 
              value={linkingTo || ''} 
              onChange={(e) => setLinkingTo(e.target.value)}
              className="w-full h-11 px-3 bg-muted border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Selecionar superior...</option>
              {usuariosList.map(u => (
                <option key={u.id} value={u.id}>{u.nome} ({u.tipo})</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleLink}
          disabled={!selectedUser || !linkingTo || isSaving}
          className="w-full mt-6 h-12 gradient-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
          Confirmar Vinculação
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Estrutura da Rede</h3>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-bold uppercase">
            {usuariosList.filter(u => u.superior_id).length} usuários vinculados
          </span>
        </div>
        
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar na rede..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm focus:bg-background transition-all" 
          />
        </div>

        <div className="space-y-3">
          {filteredUsers.filter(u => u.superior_id || getSubordinates(u.id).length > 0).map(u => (
            <div key={u.id} className="section-card !p-0 overflow-hidden border-l-4 border-l-primary/30">
              <div className="p-4 flex items-center justify-between bg-gradient-to-r from-primary/[0.02] to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-sm border border-primary/10">
                    <User size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{u.nome}</p>
                    {u.superior_id ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-medium">Vinculado a:</span>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                          {getSuperiorName(u.superior_id)}
                        </span>
                        <button 
                          onClick={() => handleRemoveLink(u.id)} 
                          className="p-1 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                          title="Remover vínculo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[9px] bg-muted/60 px-2 py-0.5 rounded-md text-muted-foreground uppercase font-black tracking-tighter mt-1 inline-block border border-border/50">
                        Liderança de Topo
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right pl-4">
                  <p className="text-xl font-black text-primary leading-none">{getSubordinates(u.id).length}</p>
                  <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-tighter mt-1">Indicados</p>
                </div>
              </div>
              
              {getSubordinates(u.id).length > 0 && (
                <div className="bg-muted/30 border-t border-border/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-[1px] flex-1 bg-border/50" />
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      Rede de {u.nome.split(' ')[0]}
                    </p>
                    <div className="h-[1px] flex-1 bg-border/50" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getSubordinates(u.id).map(sub => (
                      <div key={sub.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/30">
                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <User size={12} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-foreground truncate">{sub.nome}</p>
                          <p className="text-[9px] text-muted-foreground uppercase font-medium">{sub.tipo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredUsers.filter(u => u.superior_id || getSubordinates(u.id).length > 0).length === 0 && (
           <div className="text-center py-12 px-6 rounded-3xl border-2 border-dashed border-border/50">
              <Network size={40} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma vinculação encontrada</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Crie o primeiro vínculo usando o formulário acima</p>
           </div>
        )}
      </div>
    </div>
  );
}
