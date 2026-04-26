import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
 import { LogOut, ClipboardList, Network } from 'lucide-react';
 import TabCadastrosAfiliado from '@/components/TabCadastrosAfiliado';
 import MinhaRede from '@/components/MinhaRede';
  import { useState, useRef } from 'react';
 import { useScrollRestore } from '@/hooks/useScrollRestore';
import FloatingSupportButton from '@/components/FloatingSupportButton';

 export default function HomeAfiliado() {
   const { usuario, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState<'cadastros' | 'rede'>('cadastros');
    const { scrollRef, onScroll } = useScrollRestore(activeTab);
  const navigate = useNavigate();

  const handleSair = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <FloatingSupportButton />
      <div className="h-[1.5px] gradient-header shrink-0" />
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
        <div className="max-w-[672px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-primary" size={22} />
            <div>
              <h1 className="text-base font-bold leading-tight">Afiliados</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Olá, {usuario?.nome ?? 'usuário'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSair}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium active:scale-95 transition-transform"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>
        <main ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto pb-24">
         <div className="max-w-[672px] mx-auto px-4 py-4">
           <div className="flex gap-2 mb-4 bg-muted/50 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('cadastros')}
               className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                 activeTab === 'cadastros' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'
               }`}
             >
               <ClipboardList size={14} /> Cadastros
             </button>
             <button 
               onClick={() => setActiveTab('rede')}
               className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                 activeTab === 'rede' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'
               }`}
             >
               <Network size={14} /> Minha Rede
             </button>
           </div>
 
           {activeTab === 'cadastros' ? <TabCadastrosAfiliado /> : <MinhaRede />}
         </div>
       </main>
    </div>
  );
}