export default function SkeletonLista({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border p-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
            <div className="w-4 h-4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
