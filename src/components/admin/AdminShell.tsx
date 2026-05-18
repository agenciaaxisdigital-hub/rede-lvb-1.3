import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { GroupId, ViewId } from './adminTypes';
import AdminSidebar from './AdminSidebar';
import AdminBottomNav from './AdminBottomNav';
import AdminSubNav from './AdminSubNav';

interface Props {
  activeGroup: GroupId;
  activeView: ViewId;
  onGroupChange: (g: GroupId) => void;
  onViewChange: (v: ViewId) => void;
  children: React.ReactNode;
}

export default function AdminShell({ activeGroup, activeView, onGroupChange, onViewChange, children }: Props) {
  const navigate = useNavigate();

  return (
    <div className="h-dvh flex overflow-hidden bg-background">
      <div className="h-[1.5px] gradient-header absolute top-0 left-0 right-0 z-50 pointer-events-none" />

      <AdminSidebar
        activeGroup={activeGroup}
        activeView={activeView}
        onGroupChange={onGroupChange}
        onViewChange={onViewChange}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            <button onClick={() => navigate('/')} className="p-1.5 rounded-xl hover:bg-muted active:scale-95 transition-all shrink-0">
              <ArrowLeft size={20} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-foreground leading-tight">Painel Admin</h1>
              <p className="text-[10px] text-muted-foreground">Visão completa da rede</p>
            </div>
            <button
              onClick={() => navigate('/gestao')}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-all"
            >
              <Settings size={12} /> Gestão
            </button>
          </div>
          <AdminSubNav
            activeGroup={activeGroup}
            activeView={activeView}
            onViewChange={onViewChange}
          />
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-3 pb-28 md:pb-6">
            {children}
          </div>
        </main>
      </div>

      <AdminBottomNav
        activeGroup={activeGroup}
        onGroupChange={onGroupChange}
      />
    </div>
  );
}
