 import { useState, useMemo } from 'react';
 import { Users, User, ChevronRight, ChevronDown, Network, Shield, Target } from 'lucide-react';
 
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
 }
 
 export default function TabArvore({ usuarios }: TabArvoreProps) {
   const [expanded, setExpanded] = useState<Record<string, boolean>>({});
 
   const toggle = (id: string) => {
     setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
   };
 
   const buildTree = (parentId: string | null): any[] => {
     return usuarios
       .filter(u => u.superior_id === parentId)
       .map(u => ({
         ...u,
         children: buildTree(u.id)
       }));
   };
 
   const tree = useMemo(() => buildTree(null), [usuarios]);
 
   const TreeNode = ({ node, level = 0 }: { node: any, level?: number }) => {
     const isExpanded = expanded[node.id];
     const hasChildren = node.children && node.children.length > 0;
 
     return (
       <div className="select-none">
         <div 
           className={`flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${level > 0 ? 'ml-4 border-l border-border/50 pl-4' : ''}`}
           onClick={() => hasChildren && toggle(node.id)}
         >
           {hasChildren ? (
             isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />
           ) : (
             <div className="w-[14px]" />
           )}
           
           <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
             node.tipo === 'suplente' ? 'bg-blue-500/10 text-blue-600' :
             node.tipo === 'lideranca' ? 'bg-amber-500/10 text-amber-600' :
             node.tipo === 'coordenador' ? 'bg-purple-500/10 text-purple-600' :
             'bg-primary/10 text-primary'
           }`}>
             <User size={16} />
           </div>
 
           <div className="flex-1 min-w-0">
             <p className="text-sm font-semibold text-foreground truncate">{node.nome}</p>
             <div className="flex items-center gap-1.5">
               <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-tight">
                 {node.tipo}
               </span>
               {node.children.length > 0 && (
                 <span className="text-[10px] text-primary/60 font-medium bg-primary/5 px-1 rounded">
                   {node.children.length} {node.children.length === 1 ? 'membro' : 'membros'}
                 </span>
               )}
             </div>
           </div>
         </div>
 
         {hasChildren && isExpanded && (
           <div className="mt-1">
             {node.children.map((child: any) => (
               <TreeNode key={child.id} node={child} level={level + 1} />
             ))}
           </div>
         )}
       </div>
     );
   };
 
   return (
     <div className="section-card space-y-4">
       <div className="flex items-center justify-between mb-4">
         <h3 className="section-title flex items-center gap-2 m-0">
           <Network size={18} className="text-primary" />
           Hierarquia da Rede
         </h3>
       </div>
       
       <div className="space-y-1">
         {tree.length === 0 ? (
           <p className="text-center py-10 text-muted-foreground text-sm italic">Nenhum usuário encontrado na hierarquia.</p>
         ) : (
           tree.map(node => <TreeNode key={node.id} node={node} />)
         )}
       </div>
     </div>
   );
 }