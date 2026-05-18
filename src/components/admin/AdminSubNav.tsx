import { GroupId, ViewId, GROUPS } from './adminTypes';

interface Props {
  activeGroup: GroupId;
  activeView: ViewId;
  onViewChange: (v: ViewId) => void;
}

export default function AdminSubNav({ activeGroup, activeView, onViewChange }: Props) {
  const group = GROUPS.find(g => g.id === activeGroup);
  if (!group || group.views.length <= 1) return null;

  return (
    <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide">
      {group.views.map(view => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 ${
              isActive ? 'gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon size={12} />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
