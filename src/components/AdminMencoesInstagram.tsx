import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Instagram, Hash, AtSign, ExternalLink, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface Mencao {
  id: string;
  tipo: string;
  autor_username: string | null;
  conta_monitorada: string | null;
  hashtag: string | null;
  texto: string | null;
  permalink: string | null;
  criado_em: string;
}

interface Agrupado {
  autor: string;
  total: number;
  mencoes: Mencao[];
}

const CONTA = 'agenciaaxisdigital';
const HASHTAG = 'chamaadoutora';

export default function AdminMencoesInstagram() {
  const [data, setData] = useState<Mencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await (supabase as any)
        .from('instagram_mencoes')
        .select('id, tipo, autor_username, conta_monitorada, hashtag, texto, permalink, criado_em')
        .order('criado_em', { ascending: false })
        .limit(1000);
      if (error) throw error;
      setData((data || []) as Mencao[]);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar menções');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const ch = (supabase as any)
      .channel('admin_mencoes_ig')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'instagram_mencoes' }, carregar)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  const agrupados: Agrupado[] = useMemo(() => {
    const map = new Map<string, Agrupado>();
    for (const m of data) {
      const autor = m.autor_username || 'desconhecido';
      const cur = map.get(autor) || { autor, total: 0, mencoes: [] };
      cur.total += 1;
      cur.mencoes.push(m);
      map.set(autor, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Instagram size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Menções no Instagram</h3>
          <button
            onClick={carregar}
            className="ml-auto p-1.5 rounded-lg hover:bg-muted active:scale-95"
            aria-label="Atualizar"
          >
            <RefreshCw size={14} className="text-muted-foreground" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Piloto monitorando a conta <span className="font-semibold text-foreground">@{CONTA}</span> e a hashtag <span className="font-semibold text-foreground">#{HASHTAG}</span>.
          Os eventos chegam via webhook oficial da Meta — só são captadas postagens públicas de contas autorizadas no app em modo desenvolvedor.
        </p>
        <div className="mt-3 flex gap-3 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-muted text-foreground">
            <strong>{data.length}</strong> menções totais
          </span>
          <span className="px-2 py-0.5 rounded-full bg-muted text-foreground">
            <strong>{agrupados.length}</strong> usuários únicos
          </span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {erro}. Verifique se a tabela <code>instagram_mencoes</code> já foi criada no banco.
        </div>
      )}

      {!loading && !erro && agrupados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <Instagram size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">Nenhuma menção recebida ainda</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Faça uma postagem de teste mencionando @{CONTA} ou usando #{HASHTAG}.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {agrupados.map((g) => {
          const isOpen = expanded === g.autor;
          return (
            <div key={g.autor} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : g.autor)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 active:scale-[0.99] transition"
              >
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm">
                  {g.autor.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">@{g.autor}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.total} {g.total === 1 ? 'menção' : 'menções'}
                  </p>
                </div>
                <span className="text-xs font-bold text-primary">{g.total}</span>
                {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {g.mencoes.map((m) => (
                    <div key={m.id} className="px-3 py-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {m.hashtag ? <Hash size={11} /> : <AtSign size={11} />}
                        <span className="uppercase tracking-wider font-semibold">{m.tipo}</span>
                        <span>•</span>
                        <span>{new Date(m.criado_em).toLocaleString('pt-BR')}</span>
                      </div>
                      {m.texto && (
                        <p className="text-foreground whitespace-pre-wrap break-words">{m.texto}</p>
                      )}
                      {m.permalink && (
                        <a
                          href={m.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary text-[11px] font-semibold hover:underline"
                        >
                          Ver post <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}