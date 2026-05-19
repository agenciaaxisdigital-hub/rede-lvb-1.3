import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUrgencia } from '@/components/gestao/TabCobranca';

// ─── getUrgencia ─────────────────────────────────────────────────────────────

describe('getUrgencia', () => {
  it('classifica como "nunca cadastrou" quando dias = -1', () => {
    const r = getUrgencia(-1);
    expect(r.label).toBe('nunca cadastrou');
    expect(r.cor).toContain('red-600');
    expect(r.bg).toContain('red-500/10');
  });

  it('classifica como urgente (vermelho) quando dias >= 7', () => {
    for (const dias of [7, 10, 30, 365]) {
      const r = getUrgencia(dias);
      expect(r.label).toBe(`${dias} dias atrás`);
      expect(r.cor).toContain('red-500');
    }
  });

  it('classifica como alerta (âmbar) quando dias está entre 3 e 6', () => {
    for (const dias of [3, 4, 5, 6]) {
      const r = getUrgencia(dias);
      expect(r.label).toBe(`${dias} dias atrás`);
      expect(r.cor).toContain('amber');
    }
  });

  it('classifica como anteontem quando dias = 2', () => {
    const r = getUrgencia(2);
    expect(r.label).toBe('anteontem');
    expect(r.cor).toContain('amber-500');
  });

  it('classifica como ontem quando dias = 1', () => {
    const r = getUrgencia(1);
    expect(r.label).toBe('ontem');
    expect(r.cor).toContain('yellow-600');
  });

  it('dias = 0 retorna ontem (hoje não cadastrou = 0 dias atrás, fallback yellow)', () => {
    const r = getUrgencia(0);
    expect(r.label).toBe('ontem');
  });

  it('todos os branches retornam ícone definido', () => {
    for (const dias of [-1, 1, 2, 4, 7]) {
      const r = getUrgencia(dias);
      expect(r.icone).toBeDefined();
    }
  });
});

// ─── Ordenação de semCadastro ─────────────────────────────────────────────────

interface UsuarioSemCadastro {
  id: string;
  nome: string;
  tipo: string;
  ultimo_cadastro: string | null;
  dias: number;
  temPush: boolean;
}

function sortSemCadastro(lista: UsuarioSemCadastro[]): UsuarioSemCadastro[] {
  return [...lista].sort((a, b) => {
    if (a.dias === -1 && b.dias !== -1) return -1;
    if (a.dias !== -1 && b.dias === -1) return 1;
    return b.dias - a.dias;
  });
}

const makeUser = (id: string, dias: number): UsuarioSemCadastro => ({
  id,
  nome: `User ${id}`,
  tipo: 'suplente',
  ultimo_cadastro: null,
  dias,
  temPush: false,
});

describe('ordenação de semCadastro', () => {
  it('coloca "nunca cadastrou" (-1) sempre primeiro', () => {
    const lista = [makeUser('a', 3), makeUser('b', -1), makeUser('c', 1)];
    const sorted = sortSemCadastro(lista);
    expect(sorted[0].dias).toBe(-1);
  });

  it('múltiplos "nunca" ficam todos no início', () => {
    const lista = [makeUser('a', 5), makeUser('b', -1), makeUser('c', -1), makeUser('d', 2)];
    const sorted = sortSemCadastro(lista);
    expect(sorted[0].dias).toBe(-1);
    expect(sorted[1].dias).toBe(-1);
  });

  it('depois dos "nunca", ordena do mais antigo para o mais recente', () => {
    const lista = [makeUser('a', 1), makeUser('b', 7), makeUser('c', 3)];
    const sorted = sortSemCadastro(lista);
    expect(sorted[0].dias).toBe(7);
    expect(sorted[1].dias).toBe(3);
    expect(sorted[2].dias).toBe(1);
  });

  it('lista só com "nunca" mantém todos', () => {
    const lista = [makeUser('a', -1), makeUser('b', -1)];
    const sorted = sortSemCadastro(lista);
    expect(sorted).toHaveLength(2);
    sorted.forEach(u => expect(u.dias).toBe(-1));
  });

  it('lista vazia retorna vazio', () => {
    expect(sortSemCadastro([])).toHaveLength(0);
  });

  it('combina nunca + antiguidade corretamente', () => {
    const lista = [makeUser('a', 2), makeUser('b', -1), makeUser('c', 10), makeUser('d', -1), makeUser('e', 5)];
    const sorted = sortSemCadastro(lista);
    expect(sorted[0].dias).toBe(-1);
    expect(sorted[1].dias).toBe(-1);
    expect(sorted[2].dias).toBe(10);
    expect(sorted[3].dias).toBe(5);
    expect(sorted[4].dias).toBe(2);
  });
});

// ─── Filtragem de quem cadastrou hoje ────────────────────────────────────────

describe('filtragem de usuários sem cadastro hoje', () => {
  it('exclui usuários que cadastraram hoje', () => {
    const usuarios = [
      { id: 'u1', nome: 'Alice', tipo: 'suplente' },
      { id: 'u2', nome: 'Bob', tipo: 'suplente' },
      { id: 'u3', nome: 'Carol', tipo: 'suplente' },
    ];
    const comCadastroHoje = new Set(['u1', 'u3']);
    const semCadastro = usuarios.filter(u => !comCadastroHoje.has(u.id));
    expect(semCadastro).toHaveLength(1);
    expect(semCadastro[0].id).toBe('u2');
  });

  it('retorna todos quando ninguém cadastrou hoje', () => {
    const usuarios = [{ id: 'u1' }, { id: 'u2' }];
    const comCadastroHoje = new Set<string>();
    const semCadastro = usuarios.filter(u => !comCadastroHoje.has(u.id));
    expect(semCadastro).toHaveLength(2);
  });

  it('retorna vazio quando todos cadastraram hoje', () => {
    const usuarios = [{ id: 'u1' }, { id: 'u2' }];
    const comCadastroHoje = new Set(['u1', 'u2']);
    const semCadastro = usuarios.filter(u => !comCadastroHoje.has(u.id));
    expect(semCadastro).toHaveLength(0);
  });
});

// ─── Cálculo de dias desde último cadastro ──────────────────────────────────

describe('cálculo de dias desde último cadastro', () => {
  it('retorna -1 quando não há cadastro anterior', () => {
    const ultimo = null;
    const dias = ultimo ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000) : -1;
    expect(dias).toBe(-1);
  });

  it('retorna 0 para cadastro feito hoje', () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ultimo = hoje.toISOString();
    const dias = Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000);
    expect(dias).toBe(0);
  });

  it('retorna 1 para cadastro feito ontem', () => {
    const ontem = new Date(Date.now() - 86400000);
    const dias = Math.floor((Date.now() - ontem.getTime()) / 86400000);
    expect(dias).toBe(1);
  });

  it('retorna 7 para cadastro feito há 7 dias', () => {
    const seteDiasAtras = new Date(Date.now() - 7 * 86400000);
    const dias = Math.floor((Date.now() - seteDiasAtras.getTime()) / 86400000);
    expect(dias).toBe(7);
  });
});

// ─── enviarBroadcast (mock Supabase) ─────────────────────────────────────────

// vi.hoisted garante que os mocks estão disponíveis quando vi.mock é içado
const { mockSend, mockSubscribe, mockRemoveChannel, mockChannel } = vi.hoisted(() => {
  const mockSend = vi.fn().mockResolvedValue({});
  const mockSubscribe = vi.fn();
  const mockRemoveChannel = vi.fn();
  const mockChannel = vi.fn().mockReturnValue({
    subscribe: mockSubscribe,
    send: mockSend,
  });
  return { mockSend, mockSubscribe, mockRemoveChannel, mockChannel };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'aviso-123' }, error: null }),
        }),
      }),
    }),
  },
}));

describe('enviarBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockImplementation((cb: (s: string) => void) => cb('SUBSCRIBED'));
  });

  it('cria canal app-notifications', async () => {
    const { enviarBroadcast: broadcast } = await import('@/components/gestao/TabCobranca');
    broadcast('aviso-1', 'Título', 'Corpo', ['uid-1']);
    expect(mockChannel).toHaveBeenCalledWith('app-notifications');
  });

  it('envia broadcast com event new_notification', async () => {
    const { enviarBroadcast: broadcast } = await import('@/components/gestao/TabCobranca');
    broadcast('aviso-1', 'Título test', 'Corpo test', ['uid-1', 'uid-2']);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'new_notification',
      })
    );
  });

  it('inclui target_ids no payload', async () => {
    const { enviarBroadcast: broadcast } = await import('@/components/gestao/TabCobranca');
    const ids = ['user-a', 'user-b', 'user-c'];
    broadcast('aviso-42', 'Título', 'Corpo', ids);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ target_ids: ids }),
      })
    );
  });

  it('inclui aviso_id e tipo urgente no payload', async () => {
    const { enviarBroadcast: broadcast } = await import('@/components/gestao/TabCobranca');
    broadcast('aviso-99', 'T', 'C', ['x']);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          aviso_id: 'aviso-99',
          tipo: 'urgente',
        }),
      })
    );
  });

  it('não envia se channel não atingir SUBSCRIBED', async () => {
    mockSubscribe.mockImplementation((cb: (s: string) => void) => cb('CHANNEL_ERROR'));
    const { enviarBroadcast: broadcast } = await import('@/components/gestao/TabCobranca');
    broadcast('aviso-1', 'T', 'C', ['x']);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ─── criarAviso (mock Supabase) ───────────────────────────────────────────────

describe('criarAviso', () => {
  beforeEach(() => vi.clearAllMocks());

  it('insere aviso com ativa: false (não polui o feed)', async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
      }),
    });
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase as any).from = vi.fn().mockReturnValue({ insert: insertMock });

    const { criarAviso: criar } = await import('@/components/gestao/TabCobranca');
    await criar('Você não cadastrou hoje!', 'Corpo teste');

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ ativa: false })
    );
  });

  it('retorna o id do aviso criado', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase as any).from = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'abc-def' }, error: null }),
        }),
      }),
    });

    const { criarAviso: criar } = await import('@/components/gestao/TabCobranca');
    const id = await criar('Título', 'Corpo');
    expect(id).toBe('abc-def');
  });

  it('lança erro se insert falhar', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase as any).from = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        }),
      }),
    });

    const { criarAviso: criar } = await import('@/components/gestao/TabCobranca');
    await expect(criar('T', 'C')).rejects.toThrow('DB error');
  });
});
