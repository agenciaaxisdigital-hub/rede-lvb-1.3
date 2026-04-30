import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Target, Loader2, Instagram } from 'lucide-react';

interface Meta {
  id: string;
  feed_meta: number;
  stories_meta: number;
  periodo: string;
}

interface MencoesCount {
  feed: number;
  stories: number;
}

const PERIODO_LABEL: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
};

function getPeriodStart(periodo: string): string {
  const now = new Date();
  if (periodo === 'diario') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (periodo === 'semanal') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (periodo === 'mensal') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return new Date(0).toISOString();
}

function normalizeHandle(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .split('/')[0]
    .split('?')[0]
    .trim();
}

export default function MeusObjetivos() {
  const { usuario } = useAuth();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [mencoesMap, setMencoesMap] = useState<Record<string, MencoesCount>>({});
  const [handle, setHandle] = useState<string>('');

  useEffect(() => {
    if (!usuario) return;
    loadData();
  }, [usuario]);

  async function loadData() {
    setLoading(true);

    const [{ data: perfil }, { data: metasData }] = await Promise.all([
      (supabase as any)
        .from('hierarquia_usuarios')
        .select('instagram')
        .eq('id', usuario?.id)
        .single(),
      (supabase as any)
        .from('metas_postagem')
        .select('id, feed_meta, stories_meta, periodo')
        .eq('usuario_id', usuario?.id)
        .eq('ativa', true),
    ]);

    const userHandle = normalizeHandle(perfil?.instagram);
    setHandle(userHandle);

    const allMetas: Meta[] = metasData || [];
    setMetas(allMetas);

    if (allMetas.length > 0 && userHandle) {
      const periodoMaisAntigo = allMetas
        .map(m => getPeriodStart(m.periodo))
        .sort()[0];

      const { data: mencoes } = await (supabase as any)
        .from('instagram_mencoes')
        .select('autor_username, tipo, criado_em')
        .gte('criado_em', periodoMaisAntigo);

      const mm: Record<string, MencoesCount> = {};
      for (const meta of allMetas) {
        const since = new Date(getPeriodStart(meta.periodo)).getTime();
        const filtered = (mencoes || []).filter(
          (mn: any) =>
            normalizeHandle(mn.autor_username) === userHandle &&
            new Date(mn.criado_em).getTime() >= since
        );
        mm[meta.id] = {
          feed: filtered.filter((mn: any) => mn.tipo !== 'story_mention').length,
          stories: filtered.filter((mn: any) => mn.tipo === 'story_mention').length,
        };
      }
      setMencoesMap(mm);
    }

    setLoading(false);
  }

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-primary" /></div>;
  if (metas.length === 0) return null;

  return (
    <div className="section-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <Target size={14} className="text-primary" /> Minhas Metas
        </h3>
        {handle ? (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Instagram size={10} /> @{handle}
          </span>
        ) : (
          <span className="text-[10px] text-amber-600">Sem Instagram</span>
        )}
      </div>

      <div className="space-y-3">
        {metas.map(meta => {
          const counts = mencoesMap[meta.id] || { feed: 0, stories: 0 };
          const feedPct = meta.feed_meta > 0 ? Math.min(100, Math.round((counts.feed / meta.feed_meta) * 100)) : 0;
          const storiesPct = meta.stories_meta > 0 ? Math.min(100, Math.round((counts.stories / meta.stories_meta) * 100)) : 0;

          return (
            <div key={meta.id} className="space-y-2 bg-muted/20 rounded-2xl p-3 border border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                {PERIODO_LABEL[meta.periodo] || meta.periodo}
              </span>

              {meta.feed_meta > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="flex items-center gap-1">📸 Feed</span>
                    <span className={counts.feed >= meta.feed_meta ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                      {counts.feed}/{meta.feed_meta} {feedPct >= 100 ? '✓' : `(${feedPct}%)`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${counts.feed >= meta.feed_meta ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${feedPct}%` }}
                    />
                  </div>
                </div>
              )}

              {meta.stories_meta > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="flex items-center gap-1">⭕ Stories</span>
                    <span className={counts.stories >= meta.stories_meta ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                      {counts.stories}/{meta.stories_meta} {storiesPct >= 100 ? '✓' : `(${storiesPct}%)`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${counts.stories >= meta.stories_meta ? 'bg-emerald-500' : 'bg-violet-500'}`}
                      style={{ width: `${storiesPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!handle && (
        <p className="text-[10px] text-amber-600 text-center">
          Cadastre seu @instagram no perfil para rastrear menções
        </p>
      )}
    </div>
  );
}
