import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { GroupId, ViewId, GROUPS } from './adminTypes';

interface Props {
  activeGroup: GroupId;
  activeView: ViewId;
  onGroupChange: (g: GroupId) => void;
  onViewChange: (v: ViewId) => void;
}

export default function AdminSidebar({ activeGroup, activeView, onGroupChange, onViewChange }: Props) {
  const navigate = useNavigate();

  return (
    <aside className="hidden md:flex w-60 shrink-0 h-full border-r border-border bg-background flex-col">
      <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div>
          <p className="text-sm font-bold text-foreground">Painel Admin</p>
          <p className="text-[10px] text-muted-foreground">Visão completa da rede</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {GROUPS.map(group => {
          const GroupIcon = group.icon;
          const isActiveGroup = activeGroup === group.id;
          return (
            <div key={group.id}>
              <button
                onClick={() => onGroupChange(group.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  isActiveGroup
                    ? 'gradient-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <GroupIcon size={16} />
                {group.label}
              </button>

              {isActiveGroup && group.views.length > 1 && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
                  {group.views.map(view => {
                    const ViewIcon = view.icon;
                    const isActive = activeView === view.id;
                    return (
                      <button
                        key={view.id}
                        onClick={() => onViewChange(view.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all active:scale-[0.98] ${
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <ViewIcon size={13} />
                        {view.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border shrink-0">
        <button
          onClick={() => navigate('/gestao')}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold active:scale-95 transition-all hover:bg-primary/20"
        >
          <Settings size={14} />
          Acessar Gestão App
        </button>
      </div>
    </aside>
  );
}
