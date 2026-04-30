import { supabase } from '@/integrations/supabase/client';

interface ExportRow {
  tipo: string;
  nome: string;
  cpf: string;
  telefone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
  titulo_eleitor: string;
  zona_eleitoral: string;
  secao_eleitoral: string;
  municipio_eleitoral: string;
  uf_eleitoral: string;
  colegio_eleitoral: string;
  endereco_colegio: string;
  situacao_titulo: string;
  status: string;
  cadastrado_por_nome: string;
  criado_em: string;
  extras: string;
  origem: string;
}

export interface ExportFilters {
  tipo?: 'lideranca' | 'eleitor' | 'fiscal' | 'cabo_eleitoral';
  cadastradoPorId?: string;
  cadastradoPorNome?: string;
}

const headers = [
  'Tipo', 'Nome', 'CPF', 'Telefone', 'WhatsApp', 'E-mail',
  'Instagram', 'Facebook', 'Título Eleitor', 'Zona', 'Seção',
  'Município', 'UF', 'Colégio', 'End. Colégio', 'Situação Título',
  'Status', 'Cadastrado por', 'Data Cadastro', 'Origem', 'Detalhes',
];

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR');
}

export async function exportAllCadastros(tipo?: 'lideranca' | 'eleitor' | 'cabo_eleitoral', cadastradoPorId?: string) {
  return exportCadastrosFiltered({ tipo, cadastradoPorId });
}

export async function exportCadastrosFiltered(filters: ExportFilters = {}) {
  const XLSX = await import('xlsx');
  const agentesMap: Record<string, string> = {};
  const { data: agentes } = await supabase.from('hierarquia_usuarios').select('id, nome');
  agentes?.forEach(a => { agentesMap[a.id] = a.nome; });

  const rows: ExportRow[] = [];

  // Helper to fetch all data in batches
  async function fetchAllBatches(table: string) {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      let q = supabase.from(table).select('*, pessoas(*)').range(from, from + step - 1);
      if (filters.cadastradoPorId) q = q.eq('cadastrado_por', filters.cadastradoPorId);
      
      const { data, error } = await q;
      if (error) { console.error(`Error fetching ${table}:`, error); break; }
      if (!data || data.length === 0) { hasMore = false; }
      else {
        allData = [...allData, ...data];
        if (data.length < step) hasMore = false;
        from += step;
      }
    }
    return allData;
  }

  // Lideranças
  if (!filters.tipo || filters.tipo === 'lideranca') {
    const data = await fetchAllBatches('liderancas');
    data.filter((l: any) => l.tipo_lideranca !== 'Cabo Eleitoral').forEach((l: any) => {
      const p = l.pessoas || {};
      rows.push({
        tipo: 'Liderança', nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '', instagram: p.instagram || '', facebook: p.facebook || '',
        titulo_eleitor: p.titulo_eleitor || '', zona_eleitoral: p.zona_eleitoral || '',
        secao_eleitoral: p.secao_eleitoral || '', municipio_eleitoral: p.municipio_eleitoral || '',
        uf_eleitoral: p.uf_eleitoral || '', colegio_eleitoral: p.colegio_eleitoral || '',
        endereco_colegio: p.endereco_colegio || '', situacao_titulo: p.situacao_titulo || '',
        status: l.status || '', cadastrado_por_nome: agentesMap[l.cadastrado_por] || '',
        criado_em: formatDate(l.criado_em), origem: l.origem_captacao || '',
        extras: [l.tipo_lideranca, l.nivel, l.regiao_atuacao, l.observacoes].filter(Boolean).join(' | '),
      });
    });
  }

  // Cabos Eleitorais
  if (!filters.tipo || filters.tipo === 'cabo_eleitoral') {
    const data = await fetchAllBatches('liderancas');
    data.filter((l: any) => l.tipo_lideranca === 'Cabo Eleitoral').forEach((l: any) => {
      const p = l.pessoas || {};
      rows.push({
        tipo: 'Cabo Eleitoral', nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '', instagram: p.instagram || '', facebook: p.facebook || '',
        titulo_eleitor: p.titulo_eleitor || '', zona_eleitoral: p.zona_eleitoral || '',
        secao_eleitoral: p.secao_eleitoral || '', municipio_eleitoral: p.municipio_eleitoral || '',
        uf_eleitoral: p.uf_eleitoral || '', colegio_eleitoral: p.colegio_eleitoral || '',
        endereco_colegio: p.endereco_colegio || '', situacao_titulo: p.situacao_titulo || '',
        status: l.status || '', cadastrado_por_nome: agentesMap[l.cadastrado_por] || '',
        criado_em: formatDate(l.criado_em), origem: l.origem_captacao || '',
        extras: [l.tipo_lideranca, l.nivel, l.regiao_atuacao, l.observacoes].filter(Boolean).join(' | '),
      });
    });
  }

  // Eleitores
  if (!filters.tipo || filters.tipo === 'eleitor') {
    const data = await fetchAllBatches('possiveis_eleitores');
    data.forEach((e: any) => {
      const p = e.pessoas || {};
      rows.push({
        tipo: 'Eleitor', nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '', instagram: p.instagram || '', facebook: p.facebook || '',
        titulo_eleitor: p.titulo_eleitor || '', zona_eleitoral: p.zona_eleitoral || '',
        secao_eleitoral: p.secao_eleitoral || '', municipio_eleitoral: p.municipio_eleitoral || '',
        uf_eleitoral: p.uf_eleitoral || '', colegio_eleitoral: p.colegio_eleitoral || '',
        endereco_colegio: p.endereco_colegio || '', situacao_titulo: p.situacao_titulo || '',
        status: e.compromisso_voto || 'Indefinido', cadastrado_por_nome: agentesMap[e.cadastrado_por] || '',
        criado_em: formatDate(e.criado_em), origem: e.origem_captacao || '',
        extras: e.observacoes || '',
      });
    });
  }

  // Fiscais
  if (!filters.tipo || filters.tipo === 'fiscal') {
    const data = await fetchAllBatches('fiscais');
    data.forEach((f: any) => {
      const p = f.pessoas || {};
      rows.push({
        tipo: 'Fiscal', nome: p.nome || '', cpf: p.cpf || '', telefone: p.telefone || '',
        whatsapp: p.whatsapp || '', email: p.email || '', instagram: p.instagram || '', facebook: p.facebook || '',
        titulo_eleitor: p.titulo_eleitor || '', zona_eleitoral: p.zona_eleitoral || '',
        secao_eleitoral: p.secao_eleitoral || '', municipio_eleitoral: p.municipio_eleitoral || '',
        uf_eleitoral: p.uf_eleitoral || '', colegio_eleitoral: p.colegio_eleitoral || '',
        endereco_colegio: p.endereco_colegio || '', situacao_titulo: p.situacao_titulo || '',
        status: f.status || '', cadastrado_por_nome: agentesMap[f.cadastrado_por] || '',
        criado_em: formatDate(f.criado_em), origem: f.origem_captacao || '',
        extras: [f.zona_fiscal ? `Z:${f.zona_fiscal}` : '', f.secao_fiscal ? `S:${f.secao_fiscal}` : '', f.observacoes].filter(Boolean).join(' | '),
      });
    });
  }

  const wsData = [headers, ...rows.map(r => [
    r.tipo, r.nome, r.cpf, r.telefone, r.whatsapp, r.email,
    r.instagram, r.facebook, r.titulo_eleitor, r.zona_eleitoral,
    r.secao_eleitoral, r.municipio_eleitoral, r.uf_eleitoral,
    r.colegio_eleitoral, r.endereco_colegio, r.situacao_titulo,
    r.status, r.cadastrado_por_nome, r.criado_em, r.origem, r.extras,
  ])];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    rows.forEach(r => {
      const vals = [r.tipo, r.nome, r.cpf, r.telefone, r.whatsapp, r.email,
        r.instagram, r.facebook, r.titulo_eleitor, r.zona_eleitoral,
        r.secao_eleitoral, r.municipio_eleitoral, r.uf_eleitoral,
        r.colegio_eleitoral, r.endereco_colegio, r.situacao_titulo,
        r.status, r.cadastrado_por_nome, r.criado_em, r.origem, r.extras];
      const len = (vals[i] || '').length;
      if (len > max) max = len;
    });
    return { wch: Math.min(max + 2, 40) };
  });
  ws['!cols'] = colWidths;

  // Style header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E8E8E8' } } };
    }
  }

  const wb = XLSX.utils.book_new();
  let sheetName = 'Cadastros';
  const parts: string[] = [];
  if (filters.tipo) parts.push(filters.tipo === 'lideranca' ? 'Lideranças' : filters.tipo === 'cabo_eleitoral' ? 'Cabos' : filters.tipo === 'eleitor' ? 'Eleitores' : 'Fiscais');
  if (filters.cadastradoPorNome) parts.push(filters.cadastradoPorNome.split(' ')[0]);
  if (parts.length) sheetName = parts.join(' - ').slice(0, 31);

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const fileParts = ['cadastros'];
  if (filters.tipo) fileParts.push(filters.tipo);
  if (filters.cadastradoPorNome) fileParts.push(filters.cadastradoPorNome.split(' ')[0].toLowerCase());
  fileParts.push(new Date().toISOString().slice(0, 10));
  const fileName = `${fileParts.join('_')}.xlsx`;

  XLSX.writeFile(wb, fileName);
  return rows.length;
}
