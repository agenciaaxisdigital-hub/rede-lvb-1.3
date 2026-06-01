import { Periodo, Totais, periodoLabels } from './adminTypes';

interface Props {
  totais: Totais;
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  variant: 'full' | 'compact';
}

export default function AdminStatsStrip({ totais, periodo, onPeriodoChange, variant }: Props) {
  const stats = [
    { label: 'Lideranças', value: totais.l, color: 'text-primary bg-primary/10' },
    { label: 'Cabos',      value: totais.c, color: 'text-pink-600 bg-pink-500/10' },
    { label: 'Eleitores',  value: totais.e, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Fiscais',    value: totais.f, color: 'text-amber-600 bg-amber-500/10' },
    { label: 'Fernanda',   value: totais.fern ?? 0, color: 'text-rose-700 bg-rose-500/10 border border-rose-500/5' },
    { label: 'Total',      value: totais.total, color: 'text-white bg-pink-600 font-extrabold shadow-sm' },
  ];

  if (variant === 'full') {
    return (
      <div className="space-y-3 pb-2">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {stats.map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl py-2.5 px-1 text-center transition-all hover:scale-[1.02] ${color}`}>
              <p className="text-xl font-black leading-none">{value}</p>
              <p className="text-[10px] font-semibold mt-1 leading-tight">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(periodoLabels) as Periodo[]).map(p => (
            <button key={p} onClick={() => onPeriodoChange(p)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${
                periodo === p ? 'gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
              }`}>
              {periodoLabels[p]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {stats.map(({ label, value, color }) => (
          <span key={label} className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${color}`}>
            {label.slice(0, 3)}. {value}
          </span>
        ))}
      </div>
      <select
        value={periodo}
        onChange={e => onPeriodoChange(e.target.value as Periodo)}
        className="text-[11px] font-semibold bg-muted border border-border rounded-lg px-2 py-1 text-foreground outline-none"
      >
        {(Object.keys(periodoLabels) as Periodo[]).map(p => (
          <option key={p} value={p}>{periodoLabels[p]}</option>
        ))}
      </select>
    </div>
  );
}
