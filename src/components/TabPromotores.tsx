import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronRight, MessageCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLiderancas, useInvalidarCadastros } from '@/hooks/useDataCache';
import LinkCaptacaoCard from '@/components/LinkCaptacaoCard';
import SkeletonLista from '@/components/SkeletonLista';

interface PromotorRow {
  id: string;
  tipo_lideranca: string | null;
  cadastrado_por: string | null;
  criado_em: string;
  pessoas: { nome: string; whatsapp: string | null; instagram: string | null };
  hierarquia_usuarios: { nome: string } | null;
  suplentes: { nome: string } | null;
}

interface Props {
  refreshKey: number;
  viewOnly?: boolean;
}

export default function TabPromotores({ refreshKey, viewOnly }: Props) {
  const { isAdmin } = useAuth();
  const { data: cachedData, isLoading } = useLiderancas();
  const invalidar = useInvalidarCadastros();
  const [data, setData] = useState<PromotorRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<PromotorRow | null>(null);

  useEffect(() => {
    if (cachedData) {
      setData((cachedData as unknown as PromotorRow[]).filter(l => l.tipo_lideranca === 'Promotor'));
    }
  }, [cachedData]);

  useEffect(() => {
    if (refreshKey > 0) invalidar();
  }, [refreshKey, invalidar]);

  const filtered = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(l => l.pessoas?.nome?.toLowerCase().includes(q));
  }, [data, searchQuery]);

  if (selected) {
    const p = selected.pessoas;
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card space-y-2">
          <h2 className="text-lg font-bold text-foreground">{p.nome}</h2>
          {isAdmin && selected.hierarquia_usuarios && (
            <p className="text-[11px] text-primary/70">Por: {selected.hierarquia_usuarios.nome}</p>
          )}
          {p.whatsapp && (
            <a
              href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-medium w-fit"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {p.instagram && <p className="text-sm text-muted-foreground">@{p.instagram.replace('@', '')}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {!viewOnly && <LinkCaptacaoCard initialVariant="promotor" lockVariant />}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar promotor por nome..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} promotor{filtered.length !== 1 ? 'es' : ''}</p>

      {isLoading ? (
        <SkeletonLista />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum promotor encontrado</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(l => (
            <button
              key={l.id}
              onClick={() => setSelected(l)}
              className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{l.pessoas?.nome || '—'}</p>
                {isAdmin && l.hierarquia_usuarios && (
                  <p className="text-[10px] text-primary/60">Por: {l.hierarquia_usuarios.nome}</p>
                )}
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
