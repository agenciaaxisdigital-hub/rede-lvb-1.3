import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLiderancas, useEleitores, useUsuarios, useFiscaisAdmin, useRealtimeSync } from '@/hooks/useDataCache';
import {
  Users, Target, Search, Shield, ChevronDown, ChevronUp,
  Loader2, Download, MapPin, Eye, Building2, Plus, Network,
  Phone, Mail, FileSpreadsheet, ChevronLeft, ChevronRight, Calendar,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { exportCadastrosFiltered } from '@/lib/exportXlsx';
import SeletorCidade from '@/components/SeletorCidade';
import SeletorEvento from '@/components/SeletorEvento';
import GerenciarEventos from '@/components/GerenciarEventos';
import TabArvore from '@/components/TabArvore';
import AdminShell from '@/components/admin/AdminShell';
import AdminStatsStrip from '@/components/admin/AdminStatsStrip';
import AdminUserPopup from '@/components/admin/AdminUserPopup';
import {
  GroupId, ViewId, Periodo, TipoFiltro, TipoUsuarioFiltro,
  LiderancaReg, EleitorReg, FiscalReg, HierarquiaUsuario,
  CadastroFernanda, CadastroSocial,
  tipoFiltroLabels, tipoUsuarioLabels, tipoLabel,
  groupOfView, defaultViewOf,
} from '@/components/admin/adminTypes';

const TabLocalizacoes    = lazy(() => import('@/components/TabLocalizacoes'));
const AdminCadastrosFernanda = lazy(() => import('@/components/AdminCadastrosFernanda'));
const TabCadastrosSocial = lazy(() => import('@/components/TabCadastrosSocial'));
const AdminCadastrosAfiliados = lazy(() => import('@/components/AdminCadastrosAfiliados'));
const AdminMencoesInstagram   = lazy(() => import('@/components/AdminMencoesInstagram'));
const AdminInstagramPanel     = lazy(() => import('@/components/AdminInstagramPanel'));

const FallbackLoader = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 size={28} className="animate-spin text-primary" />
  </div>
);

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="text-[10px] bg-background rounded px-2 py-1">
    <span className="text-muted-foreground">{label}:</span>{' '}
    <span className={value ? 'text-foreground' : 'text-muted-foreground/50 italic'}>{value || '—'}</span>
  </div>
);

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const { municipios, isTodasCidades, cidadeAtiva, setCidadeAtiva, nomeMunicipioPorId } = useCidade();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useRealtimeSync();

  /* ── Navigation state ── */
  const [activeGroup, setActiveGroup] = useState<GroupId>('visao-geral');
  const [activeView,  setActiveView]  = useState<ViewId>('ranking');

  /* ── Filter / UI state ── */
  const [periodo,            setPeriodo]            = useState<Periodo>('total');
  const [tipoFiltro,         setTipoFiltro]         = useState<TipoFiltro>('todos');
  const [tipoUsuarioFiltro,  setTipoUsuarioFiltro]  = useState<TipoUsuarioFiltro>('todos');
  const [rankingTipoUsuario, setRankingTipoUsuario] = useState<TipoUsuarioFiltro>('todos');
  const [searchTerm,         setSearchTerm]         = useState('');
  const [rankingSearch,      setRankingSearch]      = useState('');
  const [rankingMetric,      setRankingMetric]      = useState<'cadastros' | 'reunioes'>('cadastros');
  const [expandedUser,       setExpandedUser]       = useState<string | null>(null);
  const [expandedTipo,       setExpandedTipo]       = useState<string | null>(null);
  const [popupUser,          setPopupUser]          = useState<string | null>(null);
  const [exporting,          setExporting]          = useState(false);
  const [deletingId,         setDeletingId]         = useState<string | null>(null);
  const [registrosPage,      setRegistrosPage]      = useState(0);
  const REGISTROS_PER_PAGE = 50;

  /* ── Data fetching ── */
  const { data: liderancasData, isLoading: lLoading, refetch: refetchLiderancas } = useLiderancas('all', { ignoreCityFilter: true });
  const { data: eleitoresData,  isLoading: eLoading, refetch: refetchEleitores  } = useEleitores('all', { ignoreCityFilter: true });
  const { data: fiscaisData,    isLoading: fLoading, refetch: refetchFiscais    } = useFiscaisAdmin({ ignoreCityFilter: true });
  const { data: usuariosData,   isLoading: uLoading } = useUsuarios();

  const liderancas = (liderancasData || []) as LiderancaReg[];
  const eleitores  = (eleitoresData  || []) as EleitorReg[];
  const fiscais    = (fiscaisData    || []) as FiscalReg[];
  const usuarios   = (usuariosData   || []) as unknown as HierarquiaUsuario[];
  const loading    = lLoading || eLoading || fLoading || uLoading;

  /* ── Cadastros Fernanda (realtime) ── */
  const [cadastrosFernanda, setCadastrosFernanda] = useState<CadastroFernanda[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = () => {
      (supabase as any).from('cadastros_fernanda').select('*').order('criado_em', { ascending: false })
        .then(({ data }: any) => { if (active && data) setCadastrosFernanda(data); });
    };
    load();
    const ch = supabase.channel('adm_fernanda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_fernanda' }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [isAdmin]);

  /* ── Cadastros Social (realtime) ── */
  const [cadastrosSocial, setCadastrosSocial] = useState<CadastroSocial[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = () => {
      (supabase as any).from('cadastros_social').select('*').order('criado_em', { ascending: false })
        .then(({ data }: any) => { if (active && data) setCadastrosSocial(data); });
    };
    load();
    const ch = supabase.channel('adm_social')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_social' }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [isAdmin]);

  /* ── Reuniões (realtime) ── */
  const [reunioes, setReunioes] = useState<any[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = () => {
      (supabase as any).from('reunioes').select('*').order('data_reuniao', { ascending: false })
        .then(({ data }: any) => { if (active && data) setReunioes(data); });
    };
    load();
    const ch = supabase.channel('adm_reunioes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reunioes' }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [isAdmin]);

  /* ── Suplentes cargo map ── */
  const [suplentesTags, setSuplentesTags] = useState<Record<string, string>>({});
  useEffect(() => {
    (supabase as any).from('suplentes').select('id, cargo_disputado').then(({ data }: any) => {
      if (data) {
        const map: Record<string, string> = {};
        for (const s of data) { if (s.cargo_disputado) map[s.id] = s.cargo_disputado; }
        setSuplentesTags(map);
      }
    });
  }, []);

  /* ── Auth guard + initial fetch ── */
  useEffect(() => { if (!isAdmin) navigate('/'); }, [isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    queryClient.invalidateQueries({ queryKey: ['liderancas'] });
    queryClient.invalidateQueries({ queryKey: ['eleitores'] });
    queryClient.invalidateQueries({ queryKey: ['fiscais'] });
    queryClient.invalidateQueries({ queryKey: ['hierarquia_usuarios'] });
    void refetchLiderancas();
    void refetchEleitores();
    void refetchFiscais();
  }, [isAdmin, queryClient, refetchLiderancas, refetchEleitores, refetchFiscais]);

  /* ── Helpers ── */
  const getCargoTag  = (supId: string | null) => supId ? suplentesTags[supId] || null : null;
  const getUserName  = (userId: string | null) => usuarios.find(u => u.id === userId)?.nome || '—';
  const filtroMunicipioId = useMemo(
    () => isTodasCidades ? null : cidadeAtiva?.id || null,
    [isTodasCidades, cidadeAtiva],
  );

  /* ── Date filters ── */
  const hoje       = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const inicioSemana = useMemo(() => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay()); return d; }, [hoje]);
  const inicioMes    = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1), [hoje]);

  const dateFilter = useCallback((criado_em: string) => {
    if (periodo === 'total') return true;
    const limit = periodo === 'hoje' ? hoje : periodo === 'semana' ? inicioSemana : inicioMes;
    return new Date(criado_em) >= limit;
  }, [periodo, hoje, inicioSemana, inicioMes]);

  const filteredL = useMemo(() => {
    return liderancas.filter(r => {
      if (!dateFilter(r.criado_em)) return false;
      if (filtroMunicipioId && r.municipio_id !== filtroMunicipioId) return false;
      return true;
    });
  }, [liderancas, dateFilter, filtroMunicipioId]);

  const filteredE = useMemo(() => {
    return eleitores.filter(r => {
      if (!dateFilter(r.criado_em)) return false;
      if (filtroMunicipioId && r.municipio_id !== filtroMunicipioId) return false;
      return true;
    });
  }, [eleitores, dateFilter, filtroMunicipioId]);

  const filteredF = useMemo(() => {
    return fiscais.filter(r => {
      if (!r.criado_em || !dateFilter(r.criado_em)) return false;
      if (filtroMunicipioId && r.municipio_id !== filtroMunicipioId) return false;
      return true;
    });
  }, [fiscais, dateFilter, filtroMunicipioId]);

  const filteredFern = useMemo(() => {
    return cadastrosFernanda.filter(r => {
      if (!dateFilter(r.criado_em)) return false;
      if (cidadeAtiva) {
        if (!r.cidade) return false;
        return r.cidade.toLowerCase().trim() === cidadeAtiva.nome.toLowerCase().trim();
      }
      return true;
    });
  }, [cadastrosFernanda, dateFilter, cidadeAtiva]);

  const filteredSoc = useMemo(() => {
    return cadastrosSocial.filter(r => {
      if (!dateFilter(r.criado_em)) return false;
      if (cidadeAtiva && r.regiao) {
        return r.regiao.toLowerCase().includes(cidadeAtiva.nome.toLowerCase()) ||
               cidadeAtiva.nome.toLowerCase().includes(r.regiao.toLowerCase());
      }
      return true;
    });
  }, [cadastrosSocial, dateFilter, cidadeAtiva]);

  const totais = useMemo(() => {
    const l = filteredL.filter(r => r.tipo_lideranca !== 'Cabo Eleitoral').length;
    const c = filteredL.filter(r => r.tipo_lideranca === 'Cabo Eleitoral').length;
    const fern = filteredFern.length;
    return { l, c, e: filteredE.length, f: filteredF.length, fern, total: l + c + filteredE.length + filteredF.length + fern };
  }, [filteredL, filteredE, filteredF, filteredFern]);

  /* ── Ranking ── */
  const rankingUsuarios = useMemo(() => {
    const map: Record<string, { l:number; c:number; e:number; f:number; fern:number; soc:number }> = {};
    usuarios.filter(u => u.tipo !== 'super_admin').forEach(u => { map[u.id] = { l:0, c:0, e:0, f:0, fern:0, soc:0 }; });
    filteredL.forEach(r => {
      if (!r.cadastrado_por || !map[r.cadastrado_por]) return;
      if (r.tipo_lideranca === 'Cabo Eleitoral') map[r.cadastrado_por].c++;
      else map[r.cadastrado_por].l++;
    });
    filteredE.forEach(r => { if (r.cadastrado_por && map[r.cadastrado_por]) map[r.cadastrado_por].e++; });
    filteredF.forEach(r => { if (r.cadastrado_por && map[r.cadastrado_por]) map[r.cadastrado_por].f++; });
    filteredFern.forEach(r => { if (r.cadastrado_por && map[r.cadastrado_por]) map[r.cadastrado_por].fern++; });
    filteredSoc.forEach(r => { if (r.cadastrado_por && map[r.cadastrado_por]) map[r.cadastrado_por].soc++; });
    return Object.entries(map)
      .map(([id, s]) => {
        const u = usuarios.find(u => u.id === id);
        return { id, nome: u?.nome || 'Desconhecido', tipo: u?.tipo || '—', municipio_id: u?.municipio_id || null, suplente_id: u?.suplente_id || null, superior_id: u?.superior_id || null, total: s.l+s.c+s.e+s.f+s.fern+s.soc, ...s };
      })
      .filter(u => u.total > 0)
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }, [filteredL, filteredE, filteredF, filteredFern, filteredSoc, usuarios]);

  /* ── Ranking de Reuniões ── */
  const rankingReunioes = useMemo(() => {
    const map: Record<string, number> = {};
    usuarios.filter(u => u.tipo !== 'super_admin').forEach(u => { map[u.id] = 0; });
    reunioes.forEach(r => {
      if (r.usuario_id && map[r.usuario_id] !== undefined) {
        map[r.usuario_id]++;
      }
    });
    return Object.entries(map)
      .map(([id, total]) => {
        const u = usuarios.find(usr => usr.id === id);
        return {
          id,
          nome: u?.nome || 'Desconhecido',
          tipo: u?.tipo || '—',
          municipio_id: u?.municipio_id || null,
          suplente_id: u?.suplente_id || null,
          superior_id: u?.superior_id || null,
          total,
          l: 0, c: 0, e: 0, f: 0, fern: 0, soc: 0 // placeholder fields for type-compat in list filter
        };
      })
      .filter(u => u.total > 0)
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }, [reunioes, usuarios]);

  /* ── Users list ── */
  const filteredUsers = useMemo(() => {
    let list = usuarios.filter(u => u.tipo !== 'super_admin');
    if (tipoUsuarioFiltro !== 'todos') list = list.filter(u => u.tipo === tipoUsuarioFiltro);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(u => u.nome.toLowerCase().includes(s) || (getCargoTag(u.suplente_id) || '').toLowerCase().includes(s));
    }
    if (filtroMunicipioId) {
      list = list.sort((a, b) => {
        const aM = a.municipio_id === filtroMunicipioId ? 0 : 1;
        const bM = b.municipio_id === filtroMunicipioId ? 0 : 1;
        return aM - bM || a.nome.localeCompare(b.nome);
      });
    }
    return list;
  }, [usuarios, tipoUsuarioFiltro, filtroMunicipioId, searchTerm, suplentesTags]);

  /* ── Registros list ── */
  const allRegistros = useMemo(() => {
    let result: { tipo: string; pessoa: any; criado_em: string; cadastrado_por: string | null; suplente_id: string | null; suplente_nome?: string | null; lideranca_nome?: string | null; extra: string }[] = [];
    if (tipoFiltro === 'todos' || tipoFiltro === 'lideranca' || tipoFiltro === 'cabo')
      filteredL.forEach(r => {
        const isCabo = r.tipo_lideranca === 'Cabo Eleitoral';
        if (tipoFiltro === 'lideranca' && isCabo) return;
        if (tipoFiltro === 'cabo' && !isCabo) return;
        result.push({ tipo: isCabo ? 'cabo' : 'lideranca', pessoa: r.pessoas, criado_em: r.criado_em, cadastrado_por: r.cadastrado_por, suplente_id: r.suplente_id, suplente_nome: (r as any).suplentes?.nome, extra: r.status || '' });
      });
    if (tipoFiltro === 'todos' || tipoFiltro === 'eleitor')
      filteredE.forEach(r => result.push({ tipo: 'eleitor', pessoa: r.pessoas, criado_em: r.criado_em, cadastrado_por: r.cadastrado_por, suplente_id: r.suplente_id, suplente_nome: (r as any).suplentes?.nome, lideranca_nome: (r as any).liderancas?.pessoas?.nome, extra: r.compromisso_voto || '' }));
    if (tipoFiltro === 'todos' || tipoFiltro === 'fiscal')
      filteredF.forEach(r => result.push({ tipo: 'fiscal', pessoa: r.pessoas, criado_em: r.criado_em || '', cadastrado_por: r.cadastrado_por, suplente_id: r.suplente_id, suplente_nome: (r as any).suplentes?.nome, lideranca_nome: (r as any).liderancas?.pessoas?.nome, extra: r.status || '' }));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.pessoa?.nome?.toLowerCase().includes(s) ||
        r.pessoa?.cpf?.includes(s) ||
        (getCargoTag(r.suplente_id) || '').toLowerCase().includes(s) ||
        getUserName(r.cadastrado_por).toLowerCase().includes(s),
      );
    }
    return result.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  }, [filteredL, filteredE, filteredF, tipoFiltro, searchTerm, suplentesTags, usuarios]);

  /* ── User expanded data ── */
  const userCadastros = useMemo(() => {
    if (!expandedUser) return null;
    return {
      liderancas: filteredL.filter(r => r.cadastrado_por === expandedUser && r.tipo_lideranca !== 'Cabo Eleitoral'),
      cabos:      filteredL.filter(r => r.cadastrado_por === expandedUser && r.tipo_lideranca === 'Cabo Eleitoral'),
      eleitores:  filteredE.filter(r => r.cadastrado_por === expandedUser),
      fiscais:    filteredF.filter(r => r.cadastrado_por === expandedUser),
    };
  }, [expandedUser, filteredL, filteredE, filteredF]);

  /* ── Popup data ── */
  const popupUserData = useMemo(() => {
    if (!popupUser) return null;
    return {
      usuario:    usuarios.find(u => u.id === popupUser),
      liderancas: filteredL.filter(r => r.cadastrado_por === popupUser && r.tipo_lideranca !== 'Cabo Eleitoral' && r.tipo_lideranca !== 'Promotor'),
      cabos:      filteredL.filter(r => r.cadastrado_por === popupUser && r.tipo_lideranca === 'Cabo Eleitoral'),
      promotores: filteredL.filter(r => r.cadastrado_por === popupUser && r.tipo_lideranca === 'Promotor'),
      eleitores:  filteredE.filter(r => r.cadastrado_por === popupUser),
      fiscais:    filteredF.filter(r => r.cadastrado_por === popupUser),
      fernanda:   cadastrosFernanda.filter(r => r.cadastrado_por === popupUser),
      social:     cadastrosSocial.filter(r => r.cadastrado_por === popupUser),
    };
  }, [popupUser, filteredL, filteredE, filteredF, cadastrosFernanda, cadastrosSocial, usuarios]);

  /* ── Handlers ── */
  const handleExport = async (tipo?: 'lideranca' | 'eleitor' | 'fiscal', cadastradoPorId?: string, cadastradoPorNome?: string) => {
    setExporting(true);
    try {
      const count = await exportCadastrosFiltered({ tipo, cadastradoPorId, cadastradoPorNome });
      toast({ title: `✅ ${count} registros exportados!` });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    } finally { setExporting(false); }
  };

  const handleDeleteCadastro = async (id: string, tipo: 'lideranca' | 'eleitor' | 'fiscal') => {
    if (!window.confirm('Tem certeza que deseja apagar este cadastro?')) return;
    setDeletingId(id);
    try {
      const table = tipo === 'lideranca' ? 'liderancas' : tipo === 'fiscal' ? 'fiscais' : 'possiveis_eleitores';
      const { error } = await (supabase as any).from(table).delete().eq('id', id);
      if (error) throw error;
      toast({ title: '🗑️ Registro apagado' });
      queryClient.invalidateQueries({ queryKey: ['liderancas'] });
      queryClient.invalidateQueries({ queryKey: ['eleitores'] });
      queryClient.invalidateQueries({ queryKey: ['fiscais'] });
    } catch (err: any) {
      toast({ title: 'Erro ao apagar', description: err.message, variant: 'destructive' });
    } finally { setDeletingId(null); }
  };

  const resetFilters = () => {
    setSearchTerm(''); setRankingSearch(''); setExpandedUser(null);
    setExpandedTipo(null); setTipoFiltro('todos'); setRankingTipoUsuario('todos');
    setRankingMetric('cadastros');
  };

  const handleGroupChange = (g: GroupId) => { setActiveGroup(g); setActiveView(defaultViewOf(g)); resetFilters(); };
  const handleViewChange  = (v: ViewId)  => { setActiveView(v); resetFilters(); };
  const navigateTo        = (v: ViewId)  => { setActiveGroup(groupOfView(v)); setActiveView(v); resetFilters(); };

  /* ── Loading ── */
  if (loading) return (
    <div className="h-full bg-background flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  return (
    <AdminShell
      activeGroup={activeGroup}
      activeView={activeView}
      onGroupChange={handleGroupChange}
      onViewChange={handleViewChange}
    >
      {/* Estatísticas globais + período */}
      <AdminStatsStrip totais={totais} periodo={periodo} onPeriodoChange={setPeriodo} variant="full" />

      {/* Seletores de contexto */}
      {municipios.length > 1 && <SeletorCidade />}
      <SeletorEvento />

      {/* ══════════ RANKING ══════════ */}
      {activeView === 'ranking' && (() => {
        const isReunioes = rankingMetric === 'reunioes';
        let filtered = isReunioes ? rankingReunioes : rankingUsuarios;
        if (rankingTipoUsuario !== 'todos') filtered = filtered.filter(u => u.tipo === rankingTipoUsuario);
        if (!isReunioes) {
          if (tipoFiltro === 'lideranca') filtered = filtered.filter(u => u.l > 0);
          else if (tipoFiltro === 'cabo')   filtered = filtered.filter(u => u.c > 0);
          else if (tipoFiltro === 'eleitor') filtered = filtered.filter(u => u.e > 0);
          else if (tipoFiltro === 'fiscal')  filtered = filtered.filter(u => u.f > 0);
        }
        if (rankingSearch) {
          const s = rankingSearch.toLowerCase();
          filtered = filtered.filter(u => u.nome.toLowerCase().includes(s) || (getCargoTag(u.suplente_id) || '').toLowerCase().includes(s));
        }
        const maxTotal = filtered.length > 0 ? Math.max(...filtered.map(u => u.total), 1) : 1;

        return (
          <div className="space-y-3">
            {/* Seletor de Métrica de Ranking */}
            <div className="bg-muted p-1 rounded-2xl flex gap-1 border border-border">
              <button
                onClick={() => setRankingMetric('cadastros')}
                className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all ${
                  rankingMetric === 'cadastros'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                📊 Ranking de Cadastros
              </button>
              <button
                onClick={() => setRankingMetric('reunioes')}
                className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all ${
                  rankingMetric === 'reunioes'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                📅 Ranking de Reuniões
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar usuário..." value={rankingSearch} onChange={e => setRankingSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {(Object.keys(tipoUsuarioLabels) as TipoUsuarioFiltro[]).map(t => (
                <button key={t} onClick={() => setRankingTipoUsuario(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${rankingTipoUsuario === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                  {tipoUsuarioLabels[t]}
                </button>
              ))}
            </div>

            {!isReunioes && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {(Object.keys(tipoFiltroLabels) as TipoFiltro[]).map(t => (
                  <button key={t} onClick={() => setTipoFiltro(t)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${tipoFiltro === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    {tipoFiltroLabels[t]}
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado</p>
            ) : (
              <div className="space-y-2">
                {/* Top 3 destaque */}
                {!rankingSearch && rankingTipoUsuario === 'todos' && (tipoFiltro === 'todos' || isReunioes) && filtered.length >= 3 && (
                  <div className="space-y-2 mb-3">
                    {filtered.slice(0, 3).map((u, i) => {
                      const styles = [
                        { gradient: 'from-yellow-500/20 via-amber-400/10 to-transparent', border: 'border-yellow-400/40', medal: '🥇', numColor: 'text-yellow-600' },
                        { gradient: 'from-slate-400/15 via-gray-300/10 to-transparent',   border: 'border-slate-300/40',  medal: '🥈', numColor: 'text-slate-500' },
                        { gradient: 'from-amber-700/15 via-orange-400/10 to-transparent', border: 'border-amber-600/30',  medal: '🥉', numColor: 'text-amber-700' },
                      ];
                      const s = styles[i];
                      return (
                        <div key={u.id} onClick={() => setPopupUser(u.id)}
                          className={`relative flex items-center gap-3 p-3 rounded-xl border ${s.border} bg-gradient-to-r ${s.gradient} cursor-pointer hover:shadow-md transition-all active:scale-[0.98]`}>
                          <span className="text-lg shrink-0">{s.medal}</span>
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{u.nome}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{tipoLabel(u.tipo)}</span>
                              {u.superior_id && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 font-bold uppercase tracking-wider flex items-center gap-0.5">
                                  <Network size={8} /> {getUserName(u.superior_id)}
                                </span>
                              )}
                              {isReunioes ? (
                                <span className="text-[8px] font-bold text-emerald-600">📅 {u.total} {u.total === 1 ? 'reunião' : 'reuniões'}</span>
                              ) : (
                                <div className="flex gap-1">
                                  {u.l > 0 && <span className="text-[8px] font-semibold text-primary/70">Lid. {u.l}</span>}
                                  {u.c > 0 && <span className="text-[8px] font-semibold text-pink-600/70">Cabos {u.c}</span>}
                                  {u.e > 0 && <span className="text-[8px] font-semibold text-muted-foreground">Eleit. {u.e}</span>}
                                  {u.f > 0 && <span className="text-[8px] font-semibold text-amber-600/70">Fisc. {u.f}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className={`text-2xl font-black ${s.numColor} shrink-0`}>{u.total}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Restante do ranking */}
                {filtered.slice((!rankingSearch && rankingTipoUsuario === 'todos' && (tipoFiltro === 'todos' || isReunioes) && filtered.length >= 3) ? 3 : 0).map((u, i) => {
                  const pos = (!rankingSearch && rankingTipoUsuario === 'todos' && (tipoFiltro === 'todos' || isReunioes) && filtered.length >= 3) ? i + 3 : i;
                  const pct = maxTotal > 0 ? Math.round((u.total / maxTotal) * 100) : 0;
                  const isExpanded = expandedUser === u.id;
                  const uLiderancas = filteredL.filter(r => r.cadastrado_por === u.id && r.tipo_lideranca !== 'Cabo Eleitoral');
                  const uCabos      = filteredL.filter(r => r.cadastrado_por === u.id && r.tipo_lideranca === 'Cabo Eleitoral');
                  const uEleitores  = filteredE.filter(r => r.cadastrado_por === u.id);
                  const uFiscais    = filteredF.filter(r => r.cadastrado_por === u.id);
                  const uFernanda   = filteredFern.filter(r => r.cadastrado_por === u.id);
                  const uSocial     = filteredSoc.filter(r => r.cadastrado_por === u.id);
                  const isFernanda  = u.tipo === 'fernanda';
                  const isSocial    = u.tipo === 'social';

                  return (
                    <div key={u.id} className="section-card !p-0 overflow-hidden">
                      <button onClick={() => { setExpandedUser(isExpanded ? null : u.id); setExpandedTipo(null); }}
                        className="w-full text-left relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-primary/[0.06] transition-all duration-500" style={{ width: `${pct}%` }} />
                        <div className="relative p-3 flex items-center gap-2.5">
                          <span className="text-sm font-bold text-muted-foreground w-7 text-center shrink-0">{pos + 1}º</span>
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{tipoLabel(u.tipo)}</span>
                              {isReunioes ? (
                                <span className="text-[8px] font-bold text-emerald-600">📅 {u.total} {u.total === 1 ? 'reunião' : 'reuniões'}</span>
                              ) : (
                                <div className="flex gap-1">
                                  {u.l > 0 && <span className="text-[8px] font-semibold text-primary/70">Lid. {u.l}</span>}
                                  {u.c > 0 && <span className="text-[8px] font-semibold text-pink-600/70">Cabos {u.c}</span>}
                                  {u.e > 0 && <span className="text-[8px] font-semibold text-muted-foreground">Eleit. {u.e}</span>}
                                  {u.f > 0 && <span className="text-[8px] font-semibold text-amber-600/70">Fisc. {u.f}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-primary">{u.total}</p>
                            <p className="text-[8px] text-muted-foreground">{isReunioes ? (u.total === 1 ? 'reunião' : 'reuniões') : 'cadastros'}</p>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                          {isReunioes ? (
                            <>
                              <div className="flex items-center justify-between px-1 border-b border-border/40 pb-1.5 mb-1.5">
                                <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                                  📅 Histórico de Reuniões ({u.total})
                                </span>
                              </div>
                              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                                {reunioes.filter(r => r.usuario_id === u.id).length === 0 ? (
                                  <p className="text-[10px] text-muted-foreground italic text-center py-4">Nenhuma reunião registrada ainda</p>
                                ) : (
                                  reunioes.filter(r => r.usuario_id === u.id).map(r => (
                                    <div key={r.id} className="p-2.5 rounded-xl bg-muted/40 border border-border/50 space-y-0.5">
                                      <div className="flex items-start justify-between gap-3">
                                        <span className="text-[10px] font-bold text-foreground">
                                          {new Date(r.data_reuniao).toLocaleDateString('pt-BR', {
                                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                          })}
                                        </span>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 font-semibold truncate max-w-[150px]">
                                          📍 {r.local}
                                        </span>
                                      </div>
                                      {r.observacoes && (
                                        <p className="text-[9px] text-muted-foreground leading-normal pt-1 border-t border-border/30 mt-1 italic">
                                          {r.observacoes}
                                        </p>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </>
                          ) : isFernanda ? (
                            <>
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">🩷 Cadastros Fernanda</span>
                                <span className="text-[11px] font-bold text-foreground">{uFernanda.length}</span>
                              </div>
                              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                                {uFernanda.map(c => (
                                  <div key={c.id} className="p-3 rounded-xl bg-muted/50 border border-border/50">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : isSocial ? (
                            <>
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider">🌐 Cadastros Social</span>
                                <span className="text-[11px] font-bold text-foreground">{uSocial.length}</span>
                              </div>
                              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                                {uSocial.map(c => (
                                  <div key={c.id} className="p-3 rounded-xl bg-muted/50 border border-border/50">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    {c.whatsapp && <p className="text-[10px] text-muted-foreground">{c.whatsapp}</p>}
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { key: 'lideranca', label: 'Lideranças', count: uLiderancas.length, icon: Users },
                                  { key: 'cabo',      label: 'Cabos',      count: uCabos.length,      icon: Users },
                                  { key: 'eleitor',   label: 'Eleitores',  count: uEleitores.length,  icon: Target },
                                  { key: 'fiscal',    label: 'Fiscais',    count: uFiscais.length,    icon: Shield },
                                ].map(({ key, label, count, icon: Icon }) => (
                                  <button key={key} onClick={() => setExpandedTipo(expandedTipo === key ? null : key)}
                                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${expandedTipo === key ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                                    <Icon size={14} className={expandedTipo === key ? 'text-primary' : 'text-muted-foreground'} />
                                    <span className="text-lg font-bold text-foreground">{count}</span>
                                    <span className="text-[9px] text-muted-foreground">{label}</span>
                                  </button>
                                ))}
                              </div>

                              {expandedTipo && (
                                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                                  {(() => {
                                    const records = expandedTipo === 'lideranca' ? uLiderancas : expandedTipo === 'cabo' ? uCabos : expandedTipo === 'fiscal' ? uFiscais : uEleitores;
                                    if (records.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro</p>;
                                    return records.map((r: any) => {
                                      const p = r.pessoas || {};
                                      return (
                                        <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                                          <div className="flex items-start justify-between">
                                            <span className="text-xs font-semibold text-foreground truncate">{p.nome}</span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-1">
                                            <Field label="CPF" value={p.cpf} />
                                            <Field label="WhatsApp" value={p.whatsapp} />
                                            <Field label="E-mail" value={p.email} />
                                            <Field label="Instagram" value={p.instagram || p.facebook} />
                                          </div>
                                          {(expandedTipo === 'lideranca' || expandedTipo === 'cabo') && (
                                            <div className="grid grid-cols-2 gap-1">
                                              <Field label="Região" value={r.regiao_atuacao} />
                                              <Field label="Comprometimento" value={r.nivel_comprometimento} />
                                              <Field label="Apoiadores" value={r.apoiadores_estimados} />
                                              <Field label="Meta votos" value={r.meta_votos} />
                                            </div>
                                          )}
                                          {expandedTipo === 'eleitor' && <div className="grid grid-cols-2 gap-1"><Field label="Compromisso" value={r.compromisso_voto} /></div>}
                                          {expandedTipo === 'fiscal' && (
                                            <div className="grid grid-cols-2 gap-1">
                                              <Field label="Zona fiscal" value={r.zona_fiscal} />
                                              <Field label="Seção fiscal" value={r.secao_fiscal} />
                                              <Field label="Colégio" value={r.colegio_eleitoral} />
                                            </div>
                                          )}
                                          {r.observacoes && <Field label="Observações" value={r.observacoes} />}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              )}
                            </>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button onClick={() => setPopupUser(u.id)}
                              className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold active:scale-95 transition-all">
                              <Eye size={12} /> Ver detalhes
                            </button>
                            {!isReunioes && (
                              <button onClick={() => handleExport(undefined, u.id, u.nome)} disabled={exporting}
                                className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-card border border-border rounded-xl text-xs font-medium text-foreground active:scale-95 transition-all disabled:opacity-50">
                                {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                Exportar
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!isReunioes && (
              <button onClick={() => handleExport(tipoFiltro === 'todos' ? undefined : tipoFiltro as any)} disabled={exporting}
                className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Exportar Todos (Excel)
              </button>
            )}
          </div>
        );
      })()}

      {/* ══════════ ÁRVORE ══════════ */}
      {activeView === 'arvore' && (
        <TabArvore usuarios={usuarios} liderancas={liderancas} eleitores={eleitores} fiscais={fiscais} />
      )}

      {/* ══════════ USUÁRIOS ══════════ */}
      {activeView === 'usuarios' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar usuário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {(Object.keys(tipoUsuarioLabels) as TipoUsuarioFiltro[]).map(t => (
              <button key={t} onClick={() => setTipoUsuarioFiltro(t)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${tipoUsuarioFiltro === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                {tipoUsuarioLabels[t]}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">{filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}</p>

          {filteredUsers.map(u => {
            const uL    = filteredL.filter(r => r.cadastrado_por === u.id && r.tipo_lideranca !== 'Cabo Eleitoral');
            const uC    = filteredL.filter(r => r.cadastrado_por === u.id && r.tipo_lideranca === 'Cabo Eleitoral');
            const uE    = filteredE.filter(r => r.cadastrado_por === u.id);
            const uF    = filteredF.filter(r => r.cadastrado_por === u.id);
            const total = uL.length + uC.length + uE.length + uF.length;
            const isExpanded = expandedUser === u.id;
            const cityName   = nomeMunicipioPorId(u.municipio_id);

            return (
              <div key={u.id} className="section-card !p-0 overflow-hidden">
                <button onClick={() => { setExpandedUser(isExpanded ? null : u.id); setExpandedTipo(null); }}
                  className="w-full text-left p-3 flex items-center gap-3 active:bg-muted/50 transition-all">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">{tipoLabel(u.tipo)}</span>
                      {getCargoTag(u.suplente_id) && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-accent/50 text-accent-foreground font-medium">{getCargoTag(u.suplente_id)}</span>
                      )}
                      {cityName && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin size={8} />{cityName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary">{total}</p>
                    <p className="text-[8px] text-muted-foreground">cadastros</p>
                  </div>
                  {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                </button>

                {isExpanded && userCadastros && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'lideranca', label: 'Lideranças', count: userCadastros.liderancas.length, icon: Users },
                        { key: 'cabo',      label: 'Cabos',      count: userCadastros.cabos.length,      icon: Users },
                        { key: 'eleitor',   label: 'Eleitores',  count: userCadastros.eleitores.length,  icon: Target },
                        { key: 'fiscal',    label: 'Fiscais',    count: userCadastros.fiscais.length,    icon: Shield },
                      ].map(({ key, label, count, icon: Icon }) => (
                        <button key={key} onClick={() => setExpandedTipo(expandedTipo === key ? null : key)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${expandedTipo === key ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                          <Icon size={14} className={expandedTipo === key ? 'text-primary' : 'text-muted-foreground'} />
                          <span className="text-lg font-bold text-foreground">{count}</span>
                          <span className="text-[9px] text-muted-foreground">{label}</span>
                        </button>
                      ))}
                    </div>

                    {expandedTipo && (
                      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                        {(() => {
                          const records = expandedTipo === 'lideranca' ? userCadastros.liderancas : expandedTipo === 'cabo' ? userCadastros.cabos : expandedTipo === 'fiscal' ? userCadastros.fiscais : userCadastros.eleitores;
                          if (records.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro</p>;
                          return records.map((r: any) => {
                            const p = r.pessoas || {};
                            return (
                              <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                                <div className="flex items-start justify-between">
                                  <p className="text-sm font-semibold text-foreground">{p.nome || '—'}</p>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <Field label="CPF" value={p.cpf} />
                                  <Field label="WhatsApp" value={p.whatsapp} />
                                  <Field label="E-mail" value={p.email} />
                                  <Field label="Instagram" value={p.instagram || p.facebook} />
                                </div>
                                {(expandedTipo === 'lideranca' || expandedTipo === 'cabo') && (
                                  <div className="grid grid-cols-2 gap-1">
                                    <Field label="Região" value={r.regiao_atuacao} />
                                    <Field label="Comprometimento" value={r.nivel_comprometimento} />
                                    <Field label="Apoiadores" value={r.apoiadores_estimados} />
                                    <Field label="Meta votos" value={r.meta_votos} />
                                  </div>
                                )}
                                {expandedTipo === 'eleitor' && <div className="grid grid-cols-2 gap-1"><Field label="Compromisso" value={r.compromisso_voto} /></div>}
                                {expandedTipo === 'fiscal' && (
                                  <div className="grid grid-cols-2 gap-1">
                                    <Field label="Zona fiscal" value={r.zona_fiscal} />
                                    <Field label="Seção fiscal" value={r.secao_fiscal} />
                                    <Field label="Colégio" value={r.colegio_eleitoral} />
                                  </div>
                                )}
                                {r.observacoes && <Field label="Observações" value={r.observacoes} />}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => handleExport()} disabled={exporting}
            className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exportar Todos (Excel)
          </button>
        </div>
      )}

      {/* ══════════ REGISTROS ══════════ */}
      {activeView === 'registros' && (() => {
        const totalPages = Math.max(1, Math.ceil(allRegistros.length / REGISTROS_PER_PAGE));
        const safePage = Math.min(registrosPage, totalPages - 1);
        const pageItems = allRegistros.slice(safePage * REGISTROS_PER_PAGE, (safePage + 1) * REGISTROS_PER_PAGE);

        // Contadores por tipo
        const countLid = allRegistros.filter(r => r.tipo === 'lideranca').length;
        const countCab = allRegistros.filter(r => r.tipo === 'cabo').length;
        const countEle = allRegistros.filter(r => r.tipo === 'eleitor').length;
        const countFis = allRegistros.filter(r => r.tipo === 'fiscal').length;

        const tipoBadgeCls = (tipo: string) => {
          const m: Record<string, string> = {
            lideranca: 'bg-primary/15 text-primary border-primary/20',
            cabo: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
            eleitor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
            fiscal: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
          };
          return m[tipo] || 'bg-secondary text-secondary-foreground border-border';
        };
        const tipoName = (tipo: string) => ({
          lideranca: 'Liderança', cabo: 'Cabo Eleitoral', eleitor: 'Eleitor', fiscal: 'Fiscal',
        }[tipo] || tipo);
        const tipoIcon = (tipo: string) => {
          if (tipo === 'lideranca') return <Users size={10} className="text-primary" />;
          if (tipo === 'cabo') return <Users size={10} className="text-pink-600" />;
          if (tipo === 'eleitor') return <Target size={10} className="text-blue-600" />;
          if (tipo === 'fiscal') return <Shield size={10} className="text-amber-600" />;
          return null;
        };
        const avatarBg = (tipo: string) => {
          const m: Record<string, string> = {
            lideranca: 'bg-primary/10 text-primary',
            cabo: 'bg-pink-500/10 text-pink-600',
            eleitor: 'bg-blue-500/10 text-blue-600',
            fiscal: 'bg-amber-500/10 text-amber-600',
          };
          return m[tipo] || 'bg-muted text-muted-foreground';
        };

        return (
          <div className="space-y-3">
            {/* ── Search ── */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar por nome, CPF, cargo..." value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setRegistrosPage(0); }}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            </div>

            {/* ── Filtros por tipo ── */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {(Object.keys(tipoFiltroLabels) as TipoFiltro[]).map(t => (
                <button key={t} onClick={() => { setTipoFiltro(t); setRegistrosPage(0); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${tipoFiltro === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                  {tipoFiltroLabels[t]}
                </button>
              ))}
            </div>

            {/* ── Contadores por tipo (resumo visual) ── */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Lideranças', count: countLid, icon: Users, cls: 'text-primary bg-primary/10', key: 'lideranca' as TipoFiltro },
                { label: 'Cabos', count: countCab, icon: Users, cls: 'text-pink-600 bg-pink-500/10', key: 'cabo' as TipoFiltro },
                { label: 'Eleitores', count: countEle, icon: Target, cls: 'text-blue-600 bg-blue-500/10', key: 'eleitor' as TipoFiltro },
                { label: 'Fiscais', count: countFis, icon: Shield, cls: 'text-amber-600 bg-amber-500/10', key: 'fiscal' as TipoFiltro },
              ].map(({ label, count, icon: Icon, cls, key }) => (
                <button key={key} onClick={() => { setTipoFiltro(tipoFiltro === key ? 'todos' : key); setRegistrosPage(0); }}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border transition-all active:scale-95 ${
                    tipoFiltro === key ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:bg-muted/50'
                  }`}>
                  <Icon size={14} className={cls.split(' ')[0]} />
                  <span className="text-lg font-bold text-foreground">{count}</span>
                  <span className="text-[8px] text-muted-foreground font-medium">{label}</span>
                </button>
              ))}
            </div>

            {/* ── Header de paginação ── */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">
                {allRegistros.length} registros
                {totalPages > 1 && <span className="ml-1">· página {safePage + 1}/{totalPages}</span>}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setRegistrosPage(Math.max(0, safePage - 1))} disabled={safePage === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted-foreground disabled:opacity-30 active:scale-95 transition-all">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => setRegistrosPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted-foreground disabled:opacity-30 active:scale-95 transition-all">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* ── Lista de registros ── */}
            {pageItems.length === 0 ? (
              <div className="text-center py-12">
                <Search size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum cadastro encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pageItems.map((r, i) => {
                  const nome = r.pessoa?.nome || '—';
                  const iniciais = nome !== '—' ? nome.split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() : '?';
                  return (
                    <div key={`${r.tipo}-${i}-${safePage}`}
                      className="group rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 overflow-hidden">
                      <div className="flex items-start gap-3 p-3">
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${avatarBg(r.tipo)}`}>
                          {iniciais}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-foreground truncate">{nome}</p>
                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${tipoBadgeCls(r.tipo)}`}>
                              {tipoIcon(r.tipo)} {tipoName(r.tipo)}
                            </span>
                          </div>

                          {/* Dados de contato em uma linha */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
                            {r.pessoa?.whatsapp && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Phone size={9} className="text-green-500" /> {r.pessoa.whatsapp}
                              </span>
                            )}
                            {r.pessoa?.cpf && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Shield size={9} /> {r.pessoa.cpf}
                              </span>
                            )}
                            {r.pessoa?.email && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Mail size={9} /> {r.pessoa.email}
                              </span>
                            )}
                          </div>

                          {/* Vinculação / Suplente */}
                          {(r.suplente_nome || r.lideranca_nome) && (
                            <p className="text-[10px] text-primary/80 font-medium truncate mb-1">
                              🔗 {r.suplente_nome || r.lideranca_nome}
                              {getCargoTag(r.suplente_id) && <span className="text-primary/60"> · {getCargoTag(r.suplente_id)}</span>}
                            </p>
                          )}

                          {/* Extra + autor + data */}
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/70">
                            {r.extra && <span className="px-1.5 py-0.5 bg-muted rounded-md font-medium">{r.extra}</span>}
                            <span>Por: {getUserName(r.cadastrado_por)}</span>
                            <span>·</span>
                            <span>{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Paginação inferior ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button onClick={() => setRegistrosPage(Math.max(0, safePage - 1))} disabled={safePage === 0}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground disabled:opacity-30 active:scale-95 transition-all">
                  <ChevronLeft size={14} /> Anterior
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    let page: number;
                    if (totalPages <= 5) page = idx;
                    else if (safePage < 3) page = idx;
                    else if (safePage > totalPages - 4) page = totalPages - 5 + idx;
                    else page = safePage - 2 + idx;
                    return (
                      <button key={page} onClick={() => setRegistrosPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                          page === safePage ? 'gradient-primary text-white shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                        }`}>
                        {page + 1}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setRegistrosPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground disabled:opacity-30 active:scale-95 transition-all">
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* ── Botões de exportação ── */}
            <div className="space-y-2 pt-1">
              <button onClick={() => handleExport(tipoFiltro === 'todos' ? undefined : tipoFiltro as any)} disabled={exporting}
                className="w-full h-11 flex items-center justify-center gap-2 gradient-primary text-white rounded-xl text-sm font-bold active:scale-[0.97] transition-all disabled:opacity-50 shadow-sm">
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                Exportar {tipoFiltro === 'todos' ? 'Todos os Cadastros' : tipoFiltroLabels[tipoFiltro]} (Excel)
              </button>

              {tipoFiltro === 'todos' && (
                <div className="grid grid-cols-2 gap-2">
                  {(['lideranca', 'cabo', 'eleitor', 'fiscal'] as const).map(tipo => (
                    <button key={tipo} onClick={() => handleExport(tipo === 'cabo' ? undefined : tipo as any)}
                      disabled={exporting}
                      className="h-9 flex items-center justify-center gap-1.5 bg-card border border-border rounded-xl text-[11px] font-medium text-foreground active:scale-95 transition-all disabled:opacity-50">
                      <Download size={12} />
                      {tipo === 'lideranca' ? 'Lideranças' : tipo === 'cabo' ? 'Cabos' : tipo === 'eleitor' ? 'Eleitores' : 'Fiscais'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══════════ CIDADES ══════════ */}
      {activeView === 'cidades' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Nome da nova cidade..." id="nova-cidade-input"
              className="flex-1 h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            <button
              onClick={async () => {
                const input = document.getElementById('nova-cidade-input') as HTMLInputElement;
                const nome = input?.value?.trim();
                if (!nome) return;
                const { error } = await (supabase as any).from('municipios').insert({ nome, uf: 'GO' });
                if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
                toast({ title: `✅ ${nome} adicionada!` });
                input.value = '';
              }}
              className="h-10 px-4 gradient-primary text-white rounded-xl text-sm font-semibold flex items-center gap-1 active:scale-95">
              <Plus size={14} /> Adicionar
            </button>
          </div>

          {municipios.map(m => {
            const userCount = usuarios.filter(u => u.municipio_id === m.id).length;
            const lidCount  = liderancas.filter(l => l.municipio_id === m.id && l.tipo_lideranca !== 'Cabo Eleitoral').length;
            const caboCount = liderancas.filter(l => l.municipio_id === m.id && l.tipo_lideranca === 'Cabo Eleitoral').length;
            const eleCount  = eleitores.filter(e => e.municipio_id === m.id).length;
            const fisCount  = fiscais.filter(f => f.municipio_id === m.id).length;

            return (
              <div key={m.id} className="section-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-primary" />
                    <div>
                      <p className="text-sm font-bold text-foreground">{m.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{m.uf} · {userCount} usuários</p>
                    </div>
                  </div>
                  <button onClick={() => { setCidadeAtiva({ id: m.id, nome: m.nome }); navigateTo('usuarios'); }}
                    className="text-[10px] text-primary font-semibold px-2 py-1 rounded-lg bg-primary/5 active:scale-95">
                    Ver →
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-border">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Users size={10} /> {lidCount} Lid.</span>
                  <span className="flex items-center gap-1 text-[10px] text-pink-600/70"><Users size={10} /> {caboCount} Cab.</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Target size={10} /> {eleCount} Ele.</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Shield size={10} /> {fisCount} Fis.</span>
                  <span className="ml-auto text-xs font-bold text-primary">{lidCount + caboCount + eleCount + fisCount} total</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ EVENTOS ══════════ */}
      {activeView === 'eventos' && <GerenciarEventos />}

      {/* ══════════ FERNANDA ══════════ */}
      {activeView === 'fernanda' && (
        <Suspense fallback={<FallbackLoader />}>
          <AdminCadastrosFernanda periodo={periodo} cidadeAtiva={cidadeAtiva} />
        </Suspense>
      )}

      {/* ══════════ SOCIAL ══════════ */}
      {activeView === 'social' && (
        <Suspense fallback={<FallbackLoader />}><TabCadastrosSocial /></Suspense>
      )}

      {/* ══════════ AFILIADOS ══════════ */}
      {activeView === 'afiliados' && (
        <Suspense fallback={<FallbackLoader />}><AdminCadastrosAfiliados /></Suspense>
      )}

      {/* ══════════ INSTAGRAM ══════════ */}
      {activeView === 'instagram' && (
        <Suspense fallback={<FallbackLoader />}><AdminInstagramPanel /></Suspense>
      )}

      {/* ══════════ MENÇÕES ══════════ */}
      {activeView === 'mencoes' && (
        <Suspense fallback={<FallbackLoader />}><AdminMencoesInstagram /></Suspense>
      )}

      {/* ══════════ POPUP CADASTROS ══════════ */}
      <AdminUserPopup
        popupUser={popupUser}
        popupUserData={popupUserData}
        onClose={() => setPopupUser(null)}
        getCargoTag={getCargoTag}
        nomeMunicipioPorId={nomeMunicipioPorId}
        deletingId={deletingId}
        handleDeleteCadastro={handleDeleteCadastro}
      />
    </AdminShell>
  );
}
