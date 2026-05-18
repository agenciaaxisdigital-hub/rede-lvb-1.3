import { GroupId, GROUPS } from './adminTypes';

interface Props {
  activeGroup: GroupId;
  onGroupChange: (g: GroupId) => void;
}

export default function AdminBottomNav({ activeGroup, onGroupChange }: Props) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border">
      <div className="flex">
        {GROUPS.map(group => {
          const Icon = group.icon;
          const isActive = activeGroup === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onGroupChange(group.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all active:scale-95 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
              <span className={`text-[9px] font-semibold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {group.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
