import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { useEvento } from '@/contexts/EventoContext';
import BottomNav, { type TabId } from '@/components/BottomNav';
import SeletorCidade from '@/components/SeletorCidade';
import { useRealtimeSync } from '@/hooks/useDataCache';
import { Loader2 } from 'lucide-react';
import FloatingSupportButton from '@/components/FloatingSupportButton';
import SeletorEvento from '@/components/SeletorEvento';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { supabase } from '@/integrations/supabase/client';
import NotificationBell from '@/components/NotificationBell';

const TabLiderancas = lazy(() => import('@/components/TabLiderancas'));
const TabCabos = lazy(() => import('@/components/TabCabos'));
const TabFiscais = lazy(() => import('@/components/TabFiscais'));
const TabEleitores = lazy(() => import('@/components/TabEleitores'));
const TabCadastros = lazy(() => import('@/components/TabCadastros'));
const TabCadastrosFernanda = lazy(() => import('@/components/TabCadastrosFernanda'));
const AdminCadastrosAfiliados = lazy(() => import('@/components/AdminCadastrosAfiliados'));
const TabPerfil = lazy(() => import('@/components/TabPerfil'));

const TAB_STORAGE_KEY = 'home-active-tab';
const VALID_TABS: TabId[] = ['liderancas', 'cabos', 'fiscais', 'eleitores', 'cadastros', 'fernanda', 'afiliados', 'perfil'];

function getInitialTab(): TabId {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY) as TabId | null;
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch {}
  return 'liderancas';
}

export default function Home() {
  const { isAdmin, tipoUsuario, usuario, isSuplente, isLideranca } = useAuth();
  useRealtimeSync();
  useLocationTracking();
  const { municipios } = useCidade();
  const { eventos } = useEvento();
  const [activeTab, setActiveTab] = useState<TabId>(() => getInitialTab());
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set([getInitialTab()]));
  const [refreshKey, setRefreshKey] = useState(0);
   const { scrollRef, onScroll } = useScrollRestore(activeTab);

  const isAdminOrCoord = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';
  const showCitySelector = isAdminOrCoord && municipios.length > 0;

   const handleTabChange = useCallback((tab: TabId) => {
     setActiveTab(tab);
     setVisitedTabs(prev => {
       if (prev.has(tab)) return prev;
       return new Set([...prev, tab]);
     });
   }, []);

  // Auto-correct tab if user doesn't have access to current tab
  useEffect(() => {
    if (!usuario?.id) return;
    if (!isAdminOrCoord && activeTab === 'fernanda') {
      handleTabChange('cadastros');
      return;
    }
    if (!isAdminOrCoord && activeTab === 'afiliados') {
      handleTabChange('cadastros');
      return;
    }
     if (isAdminOrCoord) return;
     supabase.from('usuario_modulos').select('modulo').eq('usuario_id', usuario.id)
       .then(({ data }) => {
         if (!data) return;
         const modulos = new Set(data.map((d: any) => d.modulo));
         const hasMaster = modulos.has('master');

         if (activeTab === 'fiscais' && !hasMaster && !modulos.has('cadastrar_fiscais')) {
           handleTabChange('cadastros');
           return;
         }

         if (activeTab === 'liderancas' && !hasMaster && !modulos.has('cadastrar_liderancas')) {
           // Suplentes e lideranças sempre podem acessar a aba Lideranças
           if (isSuplente || isLideranca) return;
           handleTabChange('cadastros');
           return;
         }

         if (activeTab === 'cabos' && !hasMaster && !modulos.has('cadastrar_liderancas')) {
           // Suplentes e lideranças sempre podem acessar a aba Cabos
           if (isSuplente || isLideranca) return;
           handleTabChange('cadastros');
           return;
         }

         if (activeTab === 'eleitores' && !hasMaster && !modulos.has('cadastrar_eleitores')) {
           handleTabChange('cadastros');
           return;
         }
       });
  }, [usuario?.id, isAdminOrCoord, activeTab, handleTabChange]);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch {}
  }, [activeTab]);

  const handleSaved = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const titles: Record<TabId, string> = {
    liderancas: 'Cadastro de Lideranças',
    cabos: 'Cadastro de Cabos Eleitorais',
    fiscais: 'Cadastro de Fiscais',
    eleitores: 'Cadastro de Eleitores',
    cadastros: isAdmin ? 'Todos os Cadastros' : 'Meus Cadastros',
    fernanda: 'Cadastros Fernanda',
    afiliados: 'Cadastros Afiliados',
    perfil: 'Perfil & Usuários',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-[1.5px] gradient-header shrink-0" />
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
        <div className="max-w-[672px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{titles[activeTab] || ''}</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Rede política – Dra. Fernanda Sarelli</p>
            </div>
            <NotificationBell />
          </div>
          {showCitySelector && activeTab !== 'perfil' && (
            <div className="mt-2">
              <SeletorCidade />
            </div>
          )}
          {isAdminOrCoord && eventos.length > 0 && activeTab !== 'perfil' && (
            <div className="mt-2">
              <SeletorEvento />
            </div>
          )}
        </div>
      </header>

       <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-[672px] mx-auto px-4 py-4">
          <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>}>
            {visitedTabs.has('liderancas') && activeTab === 'liderancas' && <TabLiderancas refreshKey={refreshKey} onSaved={handleSaved} />}
            {visitedTabs.has('cabos') && activeTab === 'cabos' && <TabCabos refreshKey={refreshKey} onSaved={handleSaved} />}
            {visitedTabs.has('fiscais') && activeTab === 'fiscais' && <TabFiscais refreshKey={refreshKey} onSaved={handleSaved} />}
            {visitedTabs.has('eleitores') && activeTab === 'eleitores' && <TabEleitores refreshKey={refreshKey} onSaved={handleSaved} />}
            {visitedTabs.has('cadastros') && activeTab === 'cadastros' && <TabCadastros refreshKey={refreshKey} onSaved={handleSaved} />}
            {visitedTabs.has('fernanda') && activeTab === 'fernanda' && isAdmin && <TabCadastrosFernanda />}
            {visitedTabs.has('afiliados') && activeTab === 'afiliados' && isAdmin && <AdminCadastrosAfiliados />}
            {activeTab === 'perfil' && <TabPerfil />}
          </Suspense>
        </div>
      </div>

      <FloatingSupportButton />
      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  );
}
