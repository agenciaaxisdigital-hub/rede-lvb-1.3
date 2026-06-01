import { Periodo, Totais, periodoLabels } from './adminTypes';

interface Props {
  totais: Totais;
  trends?: { l: number[]; c: number[]; e: number[]; f: number[]; fern: number[]; total: number[] };
  periodo: Periodo;
  onPeriodoChange: (p: Periodo) => void;
  variant: 'full' | 'compact';
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const width = 60;
  const height = 18;
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - (val / max) * height + 1; // 1px padding
    return `${x},${y}`;
  });
  
  const pathData = `M ${points.map((p, i) => `${i === 0 ? '' : 'L '}${p.replace(',', ' ')}`).join(' ')}`;
  
  return (
    <svg width={width} height={height} className="overflow-visible mx-auto mt-1.5 opacity-80">
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminStatsStrip({ totais, trends, periodo, onPeriodoChange, variant }: Props) {
  const stats = [
    { label: 'Lideranças', value: totais.l, color: 'text-primary bg-primary/10', strokeColor: 'currentColor', trend: trends?.l },
    { label: 'Cabos',      value: totais.c, color: 'text-pink-600 bg-pink-500/10', strokeColor: '#db2777', trend: trends?.c },
    { label: 'Eleitores',  value: totais.e, color: 'text-emerald-600 bg-emerald-500/10', strokeColor: '#059669', trend: trends?.e },
    { label: 'Fiscais',    value: totais.f, color: 'text-amber-600 bg-amber-500/10', strokeColor: '#d97706', trend: trends?.f },
    { label: 'Fernanda',   value: totais.fern ?? 0, color: 'text-rose-700 bg-rose-500/10 border border-rose-500/5', strokeColor: '#e11d48', trend: trends?.fern },
    { label: 'Total',      value: totais.total, color: 'text-white bg-pink-600 font-extrabold shadow-sm', strokeColor: '#ffffff', trend: trends?.total },
  ];

  if (variant === 'full') {
    return (
      <div className="space-y-3 pb-2">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {stats.map(({ label, value, color, strokeColor, trend }) => (
            <div key={label} className={`rounded-xl py-2 px-1 text-center transition-all hover:scale-[1.02] flex flex-col justify-between ${color}`}>
              <div>
                <p className="text-xl font-black leading-none">{value}</p>
                <p className="text-[10px] font-semibold mt-0.5 leading-tight">{label}</p>
              </div>
              {trend && <Sparkline data={trend} color={strokeColor} />}
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
