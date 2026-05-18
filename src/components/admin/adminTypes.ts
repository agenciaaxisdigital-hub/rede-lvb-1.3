import {
  BarChart3, Trophy, Network, ClipboardList, Eye, Users, Settings,
  UserCog, Building2, Calendar, Instagram, Hash,
} from 'lucide-react';

export type GroupId = 'visao-geral' | 'cadastros' | 'gestao' | 'digital';
export type ViewId =
  | 'ranking' | 'arvore'
  | 'registros' | 'fernanda' | 'social' | 'afiliados'
  | 'usuarios' | 'cidades' | 'eventos'
  | 'instagram' | 'mencoes';
export type Periodo = 'hoje' | 'semana' | 'mes' | 'total';
export type TipoFiltro = 'todos' | 'lideranca' | 'cabo' | 'eleitor' | 'fiscal';
export type TipoUsuarioFiltro = 'todos' | 'suplente' | 'lideranca' | 'coordenador' | 'fernanda' | 'social';

export interface Pessoa {
  nome: string; cpf: string | null; telefone: string | null; whatsapp: string | null;
  email: string | null; instagram: string | null; facebook: string | null;
  titulo_eleitor: string | null; zona_eleitoral: string | null; secao_eleitoral: string | null;
  municipio_eleitoral: string | null; uf_eleitoral: string | null;
  colegio_eleitoral: string | null; endereco_colegio: string | null;
}

export interface LiderancaReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; status: string | null; regiao_atuacao: string | null;
  tipo_lideranca: string | null; municipio_id: string | null; origem_captacao: string | null;
  apoiadores_estimados: number | null; meta_votos: number | null;
  nivel_comprometimento: string | null; observacoes: string | null;
  pessoas: Pessoa | null;
}

export interface EleitorReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; compromisso_voto: string | null;
  municipio_id: string | null; origem_captacao: string | null;
  observacoes: string | null; pessoas: Pessoa | null;
}

export interface FiscalReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; status: string | null; municipio_id: string | null;
  origem_captacao: string | null; zona_fiscal: string | null; secao_fiscal: string | null;
  colegio_eleitoral: string | null; observacoes: string | null; pessoas: Pessoa | null;
}

export interface HierarquiaUsuario {
  id: string; nome: string; tipo: string; suplente_id: string | null;
  municipio_id: string | null; ativo: boolean | null;
  superior_id: string | null; link_token: string | null;
}

export interface CadastroFernanda {
  id: string; nome: string; telefone: string; cidade: string | null;
  instagram: string | null; cadastrado_por: string | null; criado_em: string;
}

export interface CadastroSocial {
  id: string; nome: string; whatsapp: string; cpf: string | null;
  instagram: string | null; nome_mae: string | null; regiao: string | null;
  cadastrado_por: string | null; criado_em: string;
}

export interface Totais { l: number; c: number; e: number; f: number; total: number; }

export interface RankingEntry {
  id: string; nome: string; tipo: string; municipio_id: string | null;
  suplente_id: string | null; superior_id: string | null;
  total: number; l: number; c: number; e: number; f: number; fern: number; soc: number;
}

export interface RegistroEntry {
  tipo: string; pessoa: Pessoa | null; criado_em: string;
  cadastrado_por: string | null; suplente_id: string | null;
  suplente_nome?: string | null; lideranca_nome?: string | null; extra: string;
}

export interface PopupUserData {
  usuario: HierarquiaUsuario | undefined;
  liderancas: LiderancaReg[]; cabos: LiderancaReg[]; promotores: LiderancaReg[];
  eleitores: EleitorReg[]; fiscais: FiscalReg[];
  fernanda: CadastroFernanda[]; social: CadastroSocial[];
}

export const periodoLabels: Record<Periodo, string> = {
  hoje: 'Hoje', semana: 'Semana', mes: 'Mês', total: 'Total',
};
export const tipoFiltroLabels: Record<TipoFiltro, string> = {
  todos: 'Todos', lideranca: 'Lideranças', cabo: 'Cabos', eleitor: 'Eleitores', fiscal: 'Fiscais',
};
export const tipoUsuarioLabels: Record<TipoUsuarioFiltro, string> = {
  todos: 'Todos', suplente: 'Suplentes', lideranca: 'Lideranças',
  coordenador: 'Coordenadores', fernanda: 'Fernanda', social: 'Social',
};

export const tipoLabel = (t: string) => {
  const labels: Record<string, string> = {
    super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente',
    lideranca: 'Liderança', fernanda: 'Fernanda', afiliado: 'Afiliado',
    promotor: 'Promotor', social: 'Social', fiscal: 'Fiscal',
  };
  return labels[t] || t;
};

export interface ViewConfig { id: ViewId; label: string; icon: any; }
export interface GroupConfig { id: GroupId; label: string; icon: any; views: ViewConfig[]; }

export const GROUPS: GroupConfig[] = [
  {
    id: 'visao-geral', label: 'Visão Geral', icon: BarChart3,
    views: [
      { id: 'ranking', label: 'Ranking', icon: Trophy },
      { id: 'arvore', label: 'Árvore', icon: Network },
    ],
  },
  {
    id: 'cadastros', label: 'Cadastros', icon: ClipboardList,
    views: [
      { id: 'registros', label: 'Registros', icon: Eye },
      { id: 'fernanda', label: 'Fernanda', icon: ClipboardList },
      { id: 'social', label: 'Social', icon: Users },
      { id: 'afiliados', label: 'Afiliados', icon: Users },
    ],
  },
  {
    id: 'gestao', label: 'Gestão', icon: Settings,
    views: [
      { id: 'usuarios', label: 'Usuários', icon: UserCog },
      { id: 'cidades', label: 'Cidades', icon: Building2 },
      { id: 'eventos', label: 'Eventos', icon: Calendar },
    ],
  },
  {
    id: 'digital', label: 'Digital', icon: Instagram,
    views: [
      { id: 'instagram', label: 'Instagram', icon: Instagram },
      { id: 'mencoes', label: 'Menções', icon: Hash },
    ],
  },
];

export const groupOfView = (view: ViewId): GroupId =>
  GROUPS.find(g => g.views.some(v => v.id === view))!.id;

export const defaultViewOf = (group: GroupId): ViewId =>
  GROUPS.find(g => g.id === group)!.views[0].id;
