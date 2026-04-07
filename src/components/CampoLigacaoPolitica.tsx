import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Users, UserPlus, Lock, Search, Loader2, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cachedInvoke } from '@/lib/cacheEdgeFunctions';
import { resolverMunicipioId } from '@/lib/resolverMunicipio';
import { toast } from '@/hooks/use-toast';

interface SuplenteResult {
  id: string;
  nome: string;
  partido?: string | null;
  regiao_atuacao?: string | null;
  origem?: 'externo' | 'interno';
  hierarquia_id?: string;
}

interface LiderancaResult {
  id: string;
  lideranca_id?: string | null;
  nome: string;
  regiao_atuacao?: string | null;
  suplente_id?: string | null;
  municipio_id?: string | null;
  origem?: 'local' | 'interna';
  hierarquia_id?: string;
}

interface UsuarioInternoResult {
  id: string;
  nome: string;
  tipo: string;
  suplente_id?: string | null;
  municipio_id?: string | null;
}

interface Props {
  bloqueado: boolean;
  nomeFixo?: string | null;
  subtituloFixo?: string | null;
  suplenteIdSelecionado?: string | null;
  liderancaIdSelecionada?: string | null;
  onSuplenteChange: (id: string | null, nome: string | null, municipioId: string | null) => void;
  onLiderancaChange: (id: string | null, nome: string | null, suplenteId: string | null, municipioId: string | null) => void;
  obrigatorio?: boolean;
  erro?: string | null;
  cidadeAtivaId?: string | null;
}

const normalizarTexto = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function CampoLigacaoPolitica({
  bloqueado,
  nomeFixo,
  subtituloFixo,
  suplenteIdSelecionado,
  liderancaIdSelecionada,
  onSuplenteChange,
  onLiderancaChange,
  obrigatorio = false,
  erro,
  cidadeAtivaId,
}: Props) {
  const [aba, setAba] = useState<'suplente' | 'lideranca' | 'nova'>('suplente');
  const [buscaSuplente, setBuscaSuplente] = useState('');
  const [buscaLideranca, setBuscaLideranca] = useState('');
  const [suplentes, setSuplentes] = useState<SuplenteResult[]>([]);
  const [liderancasLocal, setLiderancasLocal] = useState<LiderancaResult[]>([]);
  const [loadingSup, setLoadingSup] = useState(false);
  const [loadingLid, setLoadingLid] = useState(false);
  const [supNomeSelecionado, setSupNomeSelecionado] = useState<string | null>(null);
  const [lidNomeSelecionado, setLidNomeSelecionado] = useState<string | null>(null);
  const debounceSupRef = useRef<NodeJS.Timeout | null>(null);
  const debounceLidRef = useRef<NodeJS.Timeout | null>(null);

  // Nova Liderança inline form
  const [novaLidNome, setNovaLidNome] = useState('');
  const [novaLidTelefone, setNovaLidTelefone] = useState('');
  const [novaLidRegiao, setNovaLidRegiao] = useState('');
  const [salvandoNova, setSalvandoNova] = useState(false);

  const buscarUsuariosInternos = useCallback(async (tipos: string[], q: string) => {
    let query = (supabase as any)
      .from('hierarquia_usuarios')
      .select('id, nome, tipo, suplente_id, municipio_id')
      .eq('ativo', true)
      .in('tipo', tipos)
      .order('nome');

    if (cidadeAtivaId) {
      query = query.eq('municipio_id', cidadeAtivaId);
    }

    const { data } = await query;
    let results = (data || []) as UsuarioInternoResult[];

    if (q) {
      const termo = normalizarTexto(q);
      results = results.filter((u) => normalizarTexto(u.nome || '').includes(termo));
    }

    return results;
  }, [cidadeAtivaId]);

  // Buscar suplentes com debounce
  const buscarSuplentes = useCallback(async (q: string) => {
    setLoadingSup(true);
    try {
      const [data, usuariosInternos] = await Promise.all([
        cachedInvoke<any[]>('buscar-suplentes'),
        buscarUsuariosInternos(['suplente'], q),
      ]);

      let filtradosExternos: SuplenteResult[] = Array.isArray(data) ? (data as SuplenteResult[]) : [];

      if (q) {
        const termo = normalizarTexto(q);
        filtradosExternos = filtradosExternos.filter((s: any) =>
          normalizarTexto(s.nome || '').includes(termo)
        );
      }

      if (cidadeAtivaId) {
        const { data: supMun } = await (supabase as any)
          .from('suplente_municipio')
          .select('suplente_id')
          .eq('municipio_id', cidadeAtivaId);

        if (supMun) {
          const supIds = new Set(supMun.map((sm: any) => String(sm.suplente_id)));
          filtradosExternos = filtradosExternos.filter(s => supIds.has(String(s.id)));
        }
      }

      const internosMapeados: SuplenteResult[] = usuariosInternos
        .filter((u) => !!u.suplente_id)
        .map((u) => ({
          id: String(u.suplente_id),
          nome: u.nome,
          partido: null,
          regiao_atuacao: 'Usuário interno',
          origem: 'interno',
          hierarquia_id: u.id,
        }));

      const vistos = new Set<string>();
      const lista = [...internosMapeados, ...filtradosExternos].filter((item) => {
        const chave = `${item.id}::${normalizarTexto(item.nome)}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });

      setSuplentes(lista.slice(0, 20));
    } catch {}
    setLoadingSup(false);
  }, [buscarUsuariosInternos, cidadeAtivaId]);

  const buscarLiderancas = useCallback(async (q: string) => {
    setLoadingLid(true);
    try {
      const usuariosInternos = await buscarUsuariosInternos(['lideranca'], q);

      const internosMapeados: LiderancaResult[] = usuariosInternos.map((u) => ({
        id: `interno-${u.id}`,
        lideranca_id: null,
        nome: u.nome,
        regiao_atuacao: null,
        suplente_id: u.suplente_id || null,
        municipio_id: u.municipio_id || null,
        origem: 'interna',
        hierarquia_id: u.id,
      }));

      setLiderancasLocal(internosMapeados.slice(0, 20));
    } catch {}
    setLoadingLid(false);
  }, [buscarUsuariosInternos]);

  // Trigger searches on mount
  useEffect(() => {
    if (!bloqueado) {
      buscarSuplentes('');
      buscarLiderancas('');
    }
  }, [bloqueado, buscarSuplentes, buscarLiderancas]);

  const handleBuscaSuplente = (val: string) => {
    setBuscaSuplente(val);
    if (debounceSupRef.current) clearTimeout(debounceSupRef.current);
    debounceSupRef.current = setTimeout(() => buscarSuplentes(val), 300);
  };

  const handleBuscaLideranca = (val: string) => {
    setBuscaLideranca(val);
    if (debounceLidRef.current) clearTimeout(debounceLidRef.current);
    debounceLidRef.current = setTimeout(() => buscarLiderancas(val), 300);
  };

  const selecionarSuplente = async (sup: SuplenteResult) => {
    // Upsert suplente into local table to satisfy FK constraints
    try {
      let supData = sup;

      if (sup.origem === 'interno') {
        const data = await cachedInvoke<any[]>('buscar-suplentes');
        if (Array.isArray(data)) {
          const externo = data.find((item: any) => String(item.id) === String(sup.id));
          if (externo) {
            supData = {
              id: String(externo.id),
              nome: externo.nome,
              partido: externo.partido || null,
              regiao_atuacao: externo.regiao_atuacao || null,
              origem: 'externo',
            };
          }
        }
      }

      await (supabase as any).from('suplentes').upsert({
        id: String(supData.id),
        nome: supData.nome,
        partido: supData.partido || null,
        regiao_atuacao: supData.regiao_atuacao || null,
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Erro ao sincronizar suplente local:', e);
    }

    const munId = await resolverMunicipioId(String(sup.id));
    setSupNomeSelecionado(sup.nome);
    setLidNomeSelecionado(null);
    onSuplenteChange(String(sup.id), sup.nome, munId);
    onLiderancaChange(null, null, null, null);
  };

  const selecionarLideranca = async (lid: LiderancaResult) => {
    let liderancaId = lid.lideranca_id || null;
    let suplenteId = lid.suplente_id || null;
    let munId = lid.municipio_id || null;

    if (lid.origem === 'interna') {
      try {
        let query = (supabase as any)
          .from('liderancas')
          .select('id, municipio_id, suplente_id, pessoas(nome)')
          .eq('status', 'Ativa')
          .limit(100);

        if (cidadeAtivaId) {
          query = query.eq('municipio_id', cidadeAtivaId);
        }

        const { data: liderancas } = await query;

        if (liderancas) {
          const nomeBuscado = normalizarTexto(lid.nome);
          const match = (liderancas as any[]).find((item) =>
            normalizarTexto(item.pessoas?.nome || '') === nomeBuscado
          );

          if (match) {
            liderancaId = match.id;
            suplenteId = match.suplente_id || suplenteId;
            munId = match.municipio_id || munId;
          }
        }
      } catch {}
    }

    if (!munId && suplenteId) {
      munId = await resolverMunicipioId(String(suplenteId));
    }

    if (!liderancaId && !suplenteId) {
      toast({
        title: 'Usuário interno sem vínculo disponível',
        description: 'Esse usuário ainda não possui suplente ou liderança vinculada para seleção.',
        variant: 'destructive',
      });
      return;
    }

    setLidNomeSelecionado(lid.nome);
    setSupNomeSelecionado(null);
    onLiderancaChange(liderancaId, lid.nome, suplenteId, munId);
    onSuplenteChange(null, null, null);
  };

  const limpar = () => {
    setSupNomeSelecionado(null);
    setLidNomeSelecionado(null);
    onSuplenteChange(null, null, null);
    onLiderancaChange(null, null, null, null);
  };

  // Salvar nova liderança inline
  const salvarNovaLideranca = async () => {
    if (!novaLidNome.trim()) {
      toast({ title: 'Informe o nome da liderança', variant: 'destructive' });
      return;
    }
    setSalvandoNova(true);
    try {
      // Criar pessoa
      const { data: novaPessoa, error: pessoaError } = await supabase.from('pessoas').insert({
        nome: novaLidNome.trim(),
        telefone: novaLidTelefone.trim() || null,
      }).select('id').single();
      if (pessoaError) throw pessoaError;

      // Criar liderança
      const { data: novaLid, error: lidError } = await (supabase as any).from('liderancas').insert({
        pessoa_id: novaPessoa.id,
        regiao_atuacao: novaLidRegiao.trim() || null,
        status: 'Ativa',
      }).select('id').single();
      if (lidError) throw lidError;

      // Selecionar a nova liderança
      setLidNomeSelecionado(novaLidNome.trim());
      setSupNomeSelecionado(null);
      onLiderancaChange(novaLid.id, novaLidNome.trim(), null, null);
      onSuplenteChange(null, null, null);

      // Limpar form
      setNovaLidNome('');
      setNovaLidTelefone('');
      setNovaLidRegiao('');
      setAba('suplente');

      toast({ title: '✅ Nova liderança criada e selecionada!' });

      // Refresh liderancas list
      buscarLiderancas('');
    } catch (err: any) {
      toast({ title: 'Erro ao criar liderança', description: err.message, variant: 'destructive' });
    } finally {
      setSalvandoNova(false);
    }
  };

  // Bloqueado → exibir campo fixo
  if (bloqueado) {
    return (
      <div className="section-card">
        <h3 className="section-title">🔗 Ligação Política</h3>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <Lock size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{nomeFixo || 'Vinculado'}</p>
            {subtituloFixo && <p className="text-[10px] text-muted-foreground">{subtituloFixo}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Editável com tabs
  const temSelecao = !!suplenteIdSelecionado || !!liderancaIdSelecionada || !!supNomeSelecionado || !!lidNomeSelecionado;

  const inputCls = "w-full h-9 px-3 bg-card border border-border rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="section-card">
      <h3 className="section-title">🔗 Ligação Política {obrigatorio && <span className="text-primary">*</span>}</h3>

      {/* Seleção atual */}
      {temSelecao && (
        <div className="flex items-center gap-2 p-2.5 mb-2 rounded-xl bg-primary/5 border border-primary/20">
          <Check size={14} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary truncate">
              {supNomeSelecionado || lidNomeSelecionado || 'Selecionado'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {supNomeSelecionado ? 'Suplente' : 'Liderança'}
            </p>
          </div>
          <button onClick={limpar} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs - 3 abas */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setAba('suplente')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
            aba === 'suplente' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <User size={11} /> Suplente
        </button>
        <button
          onClick={() => setAba('lideranca')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
            aba === 'lideranca' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Users size={11} /> Liderança
        </button>
        <button
          onClick={() => setAba('nova')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
            aba === 'nova' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <UserPlus size={11} /> Nova
        </button>
      </div>

      {/* Tab: Suplente */}
      {aba === 'suplente' && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={buscaSuplente}
              onChange={e => handleBuscaSuplente(e.target.value)}
              placeholder="Buscar suplente..."
              className="w-full h-9 pl-8 pr-3 bg-card border border-border rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            {loadingSup && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {suplentes.map(s => (
              <button
                key={`${s.origem || 'externo'}-${s.hierarquia_id || s.id}-${normalizarTexto(s.nome)}`}
                onClick={() => selecionarSuplente(s)}
                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all active:scale-[0.98] ${
                  String(suplenteIdSelecionado) === String(s.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <p className="text-xs font-semibold text-foreground">{s.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {s.origem === 'interno'
                    ? [s.regiao_atuacao].filter(Boolean).join(' · ') || 'Usuário interno'
                    : [s.partido, s.regiao_atuacao].filter(Boolean).join(' · ') || '—'}
                </p>
              </button>
            ))}
            {!loadingSup && suplentes.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">Nenhum suplente encontrado</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Liderança Existente */}
      {aba === 'lideranca' && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={buscaLideranca}
              onChange={e => handleBuscaLideranca(e.target.value)}
              placeholder="Buscar liderança existente..."
              className="w-full h-9 pl-8 pr-3 bg-card border border-border rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            {loadingLid && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {liderancasLocal.map(l => (
              <button
                key={l.id}
                onClick={() => selecionarLideranca(l)}
                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all active:scale-[0.98] ${
                  liderancaIdSelecionada === l.lideranca_id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <p className="text-xs font-semibold text-foreground">{l.nome}</p>
                {(l.regiao_atuacao || l.origem === 'interna') && (
                  <p className="text-[10px] text-muted-foreground">
                    {l.origem === 'interna'
                      ? [l.regiao_atuacao].filter(Boolean).join(' · ') || 'Usuário interno'
                      : l.regiao_atuacao}
                  </p>
                )}
              </button>
            ))}
            {!loadingLid && liderancasLocal.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">Nenhuma liderança encontrada</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Nova Liderança */}
      {aba === 'nova' && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">Crie uma nova liderança rapidamente e vincule ao cadastro.</p>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Nome <span className="text-primary">*</span></label>
            <input
              value={novaLidNome}
              onChange={e => setNovaLidNome(e.target.value)}
              placeholder="Nome da liderança"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Telefone</label>
            <input
              value={novaLidTelefone}
              onChange={e => setNovaLidTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Região de atuação</label>
            <input
              value={novaLidRegiao}
              onChange={e => setNovaLidRegiao(e.target.value)}
              placeholder="Bairro, comunidade..."
              className={inputCls}
            />
          </div>
          <button
            onClick={salvarNovaLideranca}
            disabled={salvandoNova || !novaLidNome.trim()}
            className="w-full h-9 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {salvandoNova ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
            Criar e Vincular
          </button>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <p className="text-xs text-destructive mt-1.5">{erro}</p>
      )}
    </div>
  );
}
