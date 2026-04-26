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
 
   const TreeNode = ({ node, level = 0, isRoot = false }: { node: any, level?: number, isRoot?: boolean }) => {
     const isExpanded = expanded[node.id];
     const hasChildren = node.children && node.children.length > 0;
    const counts = getCounts(node.id);
    const registrations = getUserRegistrations(node.id);
     const hasRegistrations = registrations.length > 0;
     const parentNode = node.superior_id ? usuarios.find(u => u.id === node.superior_id) : null;
 
     return (
      <div className="select-none space-y-3">
        <div className={`section-card !p-3 flex flex-col gap-3 transition-all relative ${level > 0 ? 'ml-8 before:absolute before:-left-6 before:top-1/2 before:w-6 before:h-[2px] before:bg-border/60' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              node.tipo === 'suplente' ? 'bg-blue-600 text-white' :
              node.tipo === 'lideranca' ? 'bg-amber-600 text-white' :
              node.tipo === 'coordenador' ? 'bg-purple-600 text-white' :
              'bg-primary text-white'
            }`}>
              <User size={24} />
            </div>
 
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-base font-black text-foreground truncate leading-tight">{node.nome}</p>
                {isRoot && <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0">Início</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                   node.tipo === 'suplente' ? 'bg-blue-100 text-blue-700' :
                   node.tipo === 'lideranca' ? 'bg-amber-100 text-amber-700' :
                   node.tipo === 'coordenador' ? 'bg-purple-100 text-purple-700' :
                   'bg-primary/10 text-primary'
                }`}>{node.tipo}</span>
                
                {parentNode && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-700 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Network size={10} /> {parentNode.nome}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <p className="text-lg font-black text-primary leading-none">{counts.total}</p>
                <p className="text-[8px] text-muted-foreground uppercase font-black">Membros</p>
              </div>
              {(hasChildren || hasRegistrations) && (
                <button 
                  onClick={() => toggle(node.id)} 
                  className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border/40 pt-2.5">
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl flex-1 shadow-sm"
              onClick={() => { setSelectedForCadastro(node.id); setIsDialogOpen(true); }}
            >
              <Plus size={14} /> Novo Cadastro
            </Button>
          </div>
        </div>
 
        {isExpanded && (hasChildren || hasRegistrations) && (
          <div className="space-y-3 relative ml-4 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-border/40">
            {/* Children Usuarios */}
            {node.children.map((child: any) => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
            
            {/* Registrations (Leaf Nodes) */}
            {registrations.map((reg: any) => (
              <div key={reg.id} className="ml-8 relative before:absolute before:-left-8 before:top-1/2 before:w-8 before:h-[2px] before:bg-border/40">
                <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl p-2.5 flex items-center gap-3 shadow-sm hover:border-primary/30 transition-all group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    reg.tipo === 'lideranca' ? 'bg-purple-500/10 text-purple-600' : 
                    reg.tipo === 'fiscal' ? 'bg-orange-500/10 text-orange-600' : 
                    'bg-blue-500/10 text-blue-600'
                  }`}>
                    {reg.tipo === 'lideranca' ? <Users size={16} /> : reg.tipo === 'fiscal' ? <Shield size={16} /> : <Target size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{reg.pessoas?.nome || '—'}</p>
                    <div className="flex items-center gap-1.5">
                       <span className={`text-[8px] font-black uppercase tracking-widest ${
                         reg.tipo === 'lideranca' ? 'text-purple-600' : reg.tipo === 'fiscal' ? 'text-orange-600' : 'text-blue-600'
                       }`}>{reg.tipo}</span>
                       <span className="text-[8px] text-muted-foreground">•</span>
                       <span className="text-[8px] text-muted-foreground uppercase font-bold">Cadastrado por {node.nome}</span>
                    </div>
                  </div>
                </div>
              </div>
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
            {tree.map(node => <TreeNode key={node.id} node={node} isRoot={true} />)}
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