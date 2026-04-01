import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Municipio {
  id: string;
  nome: string;
  uf: string;
}

interface CidadeContextType {
  cidadeAtiva: { id: string; nome: string } | null;
  setCidadeAtiva: (cidade: { id: string; nome: string } | null) => void;
  municipios: Municipio[];
  isTodasCidades: boolean;
  carregando: boolean;
  recarregarMunicipios: () => Promise<void>;
  nomeMunicipioPorId: (id: string | null) => string | null;
}

const CidadeContext = createContext<CidadeContextType | undefined>(undefined);

const STORAGE_KEY = 'campanha-cidade-ativa';

export function CidadeProvider({ children }: { children: ReactNode }) {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [cidadeAtiva, setCidadeAtivaState] = useState<{ id: string; nome: string } | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarMunicipios = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from('municipios')
        .select('id, nome, uf')
        .eq('ativo', true)
        .order('nome');
      const result = (data || []) as Municipio[];
      setMunicipios(result);
    } catch {
      // Table may not exist yet
      setMunicipios([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await carregarMunicipios();
      setCarregando(false);
    })();
  }, [carregarMunicipios]);

  // Set default city after municipios load
  useEffect(() => {
    if (municipios.length === 0 || cidadeAtiva !== null) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) { setCidadeAtivaState(parsed); return; }
      }
    } catch {}
    // Default: Aparecida de Goiânia
    const aparecida = municipios.find(m => m.nome.toLowerCase().includes('aparecida'));
    if (aparecida) {
      setCidadeAtivaState({ id: aparecida.id, nome: aparecida.nome });
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: aparecida.id, nome: aparecida.nome })); } catch {}
    }
  }, [municipios, cidadeAtiva]);

  const setCidadeAtiva = useCallback((cidade: { id: string; nome: string } | null) => {
    setCidadeAtivaState(cidade);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cidade));
    } catch {}
  }, []);

  const nomeMunicipioPorId = useCallback((id: string | null): string | null => {
    if (!id) return null;
    return municipios.find(m => m.id === id)?.nome ?? null;
  }, [municipios]);

  return (
    <CidadeContext.Provider value={{
      cidadeAtiva,
      setCidadeAtiva,
      municipios,
      isTodasCidades: cidadeAtiva === null,
      carregando,
      recarregarMunicipios: carregarMunicipios,
      nomeMunicipioPorId,
    }}>
      {children}
    </CidadeContext.Provider>
  );
}

export function useCidade() {
  const ctx = useContext(CidadeContext);
  if (!ctx) throw new Error('useCidade deve ser usado dentro de CidadeProvider');
  return ctx;
}
