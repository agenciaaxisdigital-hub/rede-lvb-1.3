 import { useState, useMemo } from 'react';
 import { Users, User, ChevronRight, ChevronDown, Network, Shield, Target, Search, Plus, X, ArrowLeft } from 'lucide-react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import TabCadastrar from './TabCadastrar';
 
 interface HierarquiaUsuario {
   id: string;
   nome: string;
   tipo: string;
   superior_id: string | null;
   suplente_id: string | null;
   municipio_id: string | null;
 }
 
 interface TabArvoreProps {
   usuarios: HierarquiaUsuario[];
  liderancas: any[];
  eleitores: any[];
  fiscais: any[];
 }
 
export default function TabArvore({ usuarios, liderancas, eleitores, fiscais }: TabArvoreProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedRegistrations, setExpandedRegistrations] = useState<Record<string, boolean>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedForCadastro, setSelectedForCadastro] = useState<string | null>(null);

  const filteredSearch = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return usuarios.filter(u => 
      u.nome.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [usuarios, searchTerm]);

  const getCounts = (userId: string) => {
    const lids = liderancas.filter(l => l.cadastrado_por === userId).length;
    const eleits = eleitores.filter(e => e.cadastrado_por === userId).length;
    const fiscs = fiscais.filter(f => f.cadastrado_por === userId).length;
    return { lids, eleits, fiscs, total: lids + eleits + fiscs };
  };

  const getUserRegistrations = (userId: string) => {
    const lids = liderancas.filter(l => l.cadastrado_por === userId).map(l => ({ ...l, tipo: 'lideranca' }));
    const eleits = eleitores.filter(e => e.cadastrado_por === userId).map(e => ({ ...e, tipo: 'eleitor' }));
    const fiscs = fiscais.filter(f => f.cadastrado_por === userId).map(f => ({ ...f, tipo: 'fiscal' }));
    return [...lids, ...eleits, ...fiscs].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  };
 
   const toggle = (id: string) => {
     setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
   };
 
  const toggleRegistrations = (id: string) => {
    setExpandedRegistrations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const buildTree = (rootId: string | null): any[] => {
    if (!rootId) return [];
    const rootUser = usuarios.find(u => u.id === rootId);
    if (!rootUser) return [];

    const getChildren = (parentId: string): any[] => {
      return usuarios
        .filter(u => u.superior_id === parentId)
        .map(u => ({
          ...u,
          children: getChildren(u.id)
        }));
    };

    return [{
      ...rootUser,
      children: getChildren(rootUser.id)
    }];
  };

  const tree = useMemo(() => buildTree(selectedRootId), [usuarios, selectedRootId]);
 
  const TreeNode = ({ node, level = 0 }: { node: any, level?: number }) => {
     const isExpanded = expanded[node.id];
    const isRegExpanded = expandedRegistrations[node.id];
     const hasChildren = node.children && node.children.length > 0;
    const counts = getCounts(node.id);
    const registrations = getUserRegistrations(node.id);
 
     return (
      <div className="select-none space-y-2">
        <div className={`section-card !p-3 flex flex-col gap-3 transition-all ${level > 0 ? 'ml-6 relative before:absolute before:-left-4 before:top-1/2 before:w-4 before:h-[2px] before:bg-border/50' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              node.tipo === 'suplente' ? 'bg-blue-500 text-white' :
              node.tipo === 'lideranca' ? 'bg-amber-500 text-white' :
              node.tipo === 'coordenador' ? 'bg-purple-500 text-white' :
              'bg-primary text-white'
            }`}>
              <User size={20} />
            </div>
 
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{node.nome}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">{node.tipo}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-black text-primary leading-none">{counts.total}</p>
                <p className="text-[8px] text-muted-foreground uppercase">Cadastros</p>
              </div>
              {hasChildren && (
                <button onClick={() => toggle(node.id)} className="p-1 rounded-lg hover:bg-muted">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-[10px] font-bold uppercase tracking-wider gap-1.5 rounded-lg flex-1"
              onClick={() => toggleRegistrations(node.id)}
            >
              {isRegExpanded ? 'Ocultar Cadastros' : 'Ver Cadastros'}
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-7 text-[10px] font-bold uppercase tracking-wider gap-1.5 rounded-lg flex-1"
              onClick={() => { setSelectedForCadastro(node.id); setIsDialogOpen(true); }}
            >
              <Plus size={14} /> Cadastrar
            </Button>
          </div>

          {isRegExpanded && (
            <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
              {registrations.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic text-center py-2">Nenhum cadastro encontrado.</p>
              ) : (
                registrations.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/20">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        r.tipo === 'lideranca' ? 'bg-purple-500' : r.tipo === 'fiscal' ? 'bg-orange-500' : 'bg-blue-500'
                      }`} />
                      <p className="text-xs font-medium truncate max-w-[120px]">{r.pessoas?.nome || '—'}</p>
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">{r.tipo}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
 
        {hasChildren && isExpanded && (
          <div className="space-y-2 relative ml-3 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-border/30">
            {node.children.map((child: any) => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };
 
  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="section-card !p-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Network size={20} className="text-primary" />
          <div>
            <h2 className="text-sm font-bold">Explorar Rede</h2>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Busque por um usuário para ver sua estrutura</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            placeholder="Buscar usuário na rede..." 
            className="pl-9 h-11 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {searchTerm.length >= 2 && filteredSearch.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-border/50 pt-2 animate-in fade-in slide-in-from-top-2">
            {filteredSearch.map(u => (
              <button 
                key={u.id} 
                onClick={() => { setSelectedRootId(u.id); setSearchTerm(''); }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-primary/10 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs group-hover:bg-primary group-hover:text-white transition-colors">
                    {u.nome.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{u.nome}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{u.tipo}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tree View */}
      {!selectedRootId ? (
        <div className="text-center py-20 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Search size={30} className="text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Use a busca acima para começar a explorar a rede.</p>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between px-1">
            <button 
              onClick={() => setSelectedRootId(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider hover:underline"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estrutura de Rede</span>
          </div>
          
          <div className="space-y-4">
            {tree.map(node => <TreeNode key={node.id} node={node} />)}
          </div>
        </div>
      )}

      {/* Dialog para Cadastro */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              Novo Cadastro para {usuarios.find(u => u.id === selectedForCadastro)?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
             <TabCadastrar 
                onSaved={() => setIsDialogOpen(false)} 
                responsavelId={selectedForCadastro || undefined} 
             />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}