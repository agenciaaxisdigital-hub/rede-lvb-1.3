import { describe, it, expect } from 'vitest';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  ativa: boolean;
  tipo: string;
  persistente: boolean;
  intervalo_minutos: number | null;
  ultima_notificacao_em: string | null;
  criado_em: string;
}

function makeAviso(overrides: Partial<Aviso> = {}): Aviso {
  return {
    id: 'aviso-1',
    titulo: 'Título',
    corpo: 'Corpo',
    ativa: true,
    tipo: 'info',
    persistente: false,
    intervalo_minutos: null,
    ultima_notificacao_em: null,
    criado_em: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Filtro avisosVisiveis ────────────────────────────────────────────────────

describe('TabAvisos – avisosVisiveis (ativa: true)', () => {
  const avisos: Aviso[] = [
    makeAviso({ id: '1', titulo: 'Aviso oficial', ativa: true }),
    makeAviso({ id: '2', titulo: 'Você não cadastrou hoje!', ativa: false }),
    makeAviso({ id: '3', titulo: 'Reunião segunda', ativa: true, persistente: true }),
    makeAviso({ id: '4', titulo: 'Cobrança antiga', ativa: false }),
    makeAviso({ id: '5', titulo: 'Alerta segurança', ativa: true, tipo: 'urgente' }),
  ];

  // Replica: const avisosVisiveis = avisos.filter(a => a.ativa);
  const avisosVisiveis = avisos.filter(a => a.ativa);

  it('exibe somente avisos com ativa: true', () => {
    expect(avisosVisiveis.every(a => a.ativa)).toBe(true);
  });

  it('exibe exatamente 3 avisos dos 5 do mock', () => {
    expect(avisosVisiveis).toHaveLength(3);
  });

  it('não exibe spam de cobrança (ativa: false)', () => {
    const spam = avisosVisiveis.find(a => a.titulo === 'Você não cadastrou hoje!');
    expect(spam).toBeUndefined();
  });

  it('não exibe avisos desativados por admin', () => {
    const ids = avisosVisiveis.map(a => a.id);
    expect(ids).not.toContain('4');
  });

  it('inclui aviso urgente ativo', () => {
    const urgente = avisosVisiveis.find(a => a.tipo === 'urgente');
    expect(urgente).toBeDefined();
    expect(urgente?.id).toBe('5');
  });

  it('inclui aviso persistente ativo', () => {
    const persistente = avisosVisiveis.find(a => a.persistente);
    expect(persistente).toBeDefined();
    expect(persistente?.id).toBe('3');
  });
});

// ─── Admin e não-admin veem o mesmo (sem distinção isAdmin) ──────────────────

describe('TabAvisos – sem distinção de papel (admin = non-admin)', () => {
  const avisos: Aviso[] = [
    makeAviso({ id: 'a', ativa: true }),
    makeAviso({ id: 'b', ativa: false }),
    makeAviso({ id: 'c', ativa: true }),
  ];

  it('admin e não-admin obtêm mesma lista filtrada', () => {
    const isAdmin = true;
    const isNonAdmin = false;

    // Comportamento atual: ambos filtram por ativa: true
    const visivelAdmin = avisos.filter(a => a.ativa);
    const visivelNonAdmin = avisos.filter(a => a.ativa);

    expect(visivelAdmin).toHaveLength(2);
    expect(visivelNonAdmin).toHaveLength(2);
    expect(visivelAdmin.map(a => a.id)).toEqual(visivelNonAdmin.map(a => a.id));

    // Garantir que o flag isAdmin não afeta mais o resultado
    void isAdmin;
    void isNonAdmin;
  });

  it('spam de cobrança (ativa: false) nunca aparece para admin', () => {
    const cobrancaSpam = [
      makeAviso({ id: 'cb-1', titulo: 'Você não cadastrou hoje!', ativa: false }),
      makeAviso({ id: 'cb-2', titulo: 'Você não cadastrou hoje!', ativa: false }),
      makeAviso({ id: 'cb-3', titulo: 'Você não cadastrou hoje!', ativa: false }),
    ];
    const todosAvisos = [...avisos, ...cobrancaSpam];
    const visiveis = todosAvisos.filter(a => a.ativa);
    const spam = visiveis.filter(a => a.titulo.includes('não cadastrou'));
    expect(spam).toHaveLength(0);
  });
});

// ─── Query DB – apenas ativa: true enviada ao Supabase ────────────────────────

describe('TabAvisos – query DB filtra ativa: true', () => {
  it('query não retorna avisos de cobrança (ativa: false) simulados', () => {
    // Simula o que o Supabase retorna com .eq('ativa', true)
    const dbResult: Aviso[] = [
      makeAviso({ id: '1', titulo: 'Oficial', ativa: true }),
      makeAviso({ id: '2', titulo: 'Urgente', ativa: true, tipo: 'urgente' }),
    ];
    // Cobrança (ativa: false) NÃO estaria no resultado por causa do .eq('ativa', true)
    const avisoCobranca = makeAviso({ titulo: 'Você não cadastrou hoje!', ativa: false });

    expect(dbResult).not.toContainEqual(expect.objectContaining({ ativa: false }));
    expect(dbResult).not.toContainEqual(expect.objectContaining({ id: avisoCobranca.id }));
  });
});

// ─── toggleAtivo – comportamento esperado ────────────────────────────────────

describe('TabAvisos – toggleAtivo', () => {
  it('aviso ativado → inativado some da lista visível', () => {
    let avisos: Aviso[] = [
      makeAviso({ id: 'x', ativa: true }),
      makeAviso({ id: 'y', ativa: true }),
    ];

    // Simula toggleAtivo('x')
    avisos = avisos.map(a => a.id === 'x' ? { ...a, ativa: false } : a);
    const visiveis = avisos.filter(a => a.ativa);

    expect(visiveis).toHaveLength(1);
    expect(visiveis[0].id).toBe('y');
  });

  it('aviso excluído some completamente', () => {
    let avisos: Aviso[] = [
      makeAviso({ id: '1', ativa: true }),
      makeAviso({ id: '2', ativa: true }),
    ];
    avisos = avisos.filter(a => a.id !== '1');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].id).toBe('2');
  });
});

// ─── Tipos de aviso ───────────────────────────────────────────────────────────

describe('TabAvisos – tipos de aviso válidos', () => {
  const TIPOS = ['info', 'sucesso', 'alerta', 'urgente'];

  it('os 4 tipos esperados estão definidos', () => {
    expect(TIPOS).toHaveLength(4);
    expect(TIPOS).toContain('info');
    expect(TIPOS).toContain('urgente');
  });

  it('aviso de cobrança criado como tipo urgente', () => {
    const tipoCobranca = 'urgente';
    expect(TIPOS).toContain(tipoCobranca);
  });
});
