import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Target, Bell, User } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const TabMetas = lazy(() => import('@/components/gestao/TabMetas'));
const TabAvisos = lazy(() => import('@/components/gestao/TabAvisos'));
const TabPerfilGestao = lazy(() => import('@/components/gestao/TabPerfilGestao'));

type GestaoTab = 'metas' | 'avisos' | 'perfil';

export default function GestaoApp() {
  const { isAdmin, usuario } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<GestaoTab>('metas');

  if (!isAdmin && !usuario) return <Navigate to="/" replace />;

  const tabs = [
    { id: 'metas' as GestaoTab, label: 'Metas', icon: Target },
    { id: 'avisos' as GestaoTab, label: 'Avisos', icon: Bell },
    { id: 'perfil' as GestaoTab, label: 'Perfil', icon: User },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <div className="h-[1.5px] gradient-header shrink-0" />

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
        <div className="max-w-[672px] mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Gestão App</h1>
            <p className="text-[10px] text-muted-foreground">Metas · Avisos · Perfis</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-[672px] mx-auto px-4 pb-3 flex gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                tab === id ? 'gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-[672px] mx-auto px-4 py-4">
          <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>}>
            {tab === 'metas' && <TabMetas />}
            {tab === 'avisos' && <TabAvisos />}
            {tab === 'perfil' && <TabPerfilGestao />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
