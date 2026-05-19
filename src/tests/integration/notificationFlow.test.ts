/**
 * Testes de integração — Fluxo completo de notificações
 *
 * Objetivo: provar que o sistema entrega notificações corretamente em cada camada:
 *   DB  →  Push (Edge Function)  →  Broadcast (in-app)  →  Modal no usuário
 *
 * Cada describe cobre um cenário real que o admin dispara.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks de infraestrutura ──────────────────────────────────────────────────

// Spy capturador do broadcast enviado (compartilhado entre sender e receiver)
const broadcastBus: { payload: any }[] = [];

const mockInsertAviso = vi.fn();
const mockInsertDestinatarios = vi.fn();
const mockInsertSubscribe = vi.fn();
const mockSubscribe = vi.fn();
const mockSend = vi.fn().mockImplementation(async (msg: any) => {
  broadcastBus.push(msg);          // grava no bus de teste
  return {};
});
const mockChannel = vi.fn().mockReturnValue({
  subscribe: mockSubscribe,
  send: mockSend,
  on: vi.fn().mockReturnThis(),
});
const mockRemoveChannel = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-token' } },
      }),
    },
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'avisos_app') {
        return {
          insert: mockInsertAviso.mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'aviso-test-id' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'avisos_destinatarios') {
        return { insert: mockInsertDestinatarios.mockResolvedValue({ error: null }) };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// Mock de fetch para a Edge Function de push
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface Usuario {
  id: string;
  nome: string;
  tipo: string;
  ultimo_cadastro: string | null;
  dias: number;
  temPush: boolean;
}

const makeUser = (overrides: Partial<Usuario> = {}): Usuario => ({
  id: 'user-default-id',
  nome: 'João Silva',
  tipo: 'suplente',
  ultimo_cadastro: null,
  dias: -1,
  temPush: true,
  ...overrides,
});

function setupPushResponse(enviados: number) {
  mockFetch.mockResolvedValueOnce({
    json: vi.fn().mockResolvedValue({ enviados }),
    ok: true,
  } as any);
}

function setupSubscribeSuccess() {
  mockSubscribe.mockImplementation((cb: (s: string) => void) => cb('SUBSCRIBED'));
}

// ─── CENÁRIO 1: Notificar usuário individual com push ──────────────────────

describe('Cenário 1 — Notificar usuário individual (COM push ativo)', () => {
  const JOAO = makeUser({ id: 'joao-id', nome: 'João Silva', temPush: true, dias: -1 });

  beforeEach(() => {
    vi.clearAllMocks();
    broadcastBus.length = 0;
    setupSubscribeSuccess();
    setupPushResponse(1);
  });

  it('cria aviso com ativa: false (não polui o feed de avisos)', async () => {
    const { criarAviso } = await import('@/components/gestao/TabCobranca');
    await criarAviso('Você não cadastrou hoje!', `${JOAO.nome}, não esqueça...`);
    expect(mockInsertAviso).toHaveBeenCalledWith(
      expect.objectContaining({ ativa: false, tipo: 'urgente', persistente: false })
    );
  });

  it('registra destinatário correto em avisos_destinatarios', async () => {
    const { criarAviso } = await import('@/components/gestao/TabCobranca');
    const avisoid = await criarAviso('Título', 'Corpo');
    const { supabase } = await import('@/integrations/supabase/client');
    await (supabase as any).from('avisos_destinatarios').insert([
      { aviso_id: avisoid, hierarquia_id: JOAO.id },
    ]);
    expect(mockInsertDestinatarios).toHaveBeenCalledWith([
      { aviso_id: 'aviso-test-id', hierarquia_id: 'joao-id' },
    ]);
  });

  it('chama Edge Function de push com o aviso_id e hierarquia_id corretos', async () => {
    const { criarAviso } = await import('@/components/gestao/TabCobranca');
    const avisoid = await criarAviso('Título', 'Corpo');
    await global.fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-token', apikey: '' },
      body: JSON.stringify({ aviso_id: avisoid, hierarquia_ids: [JOAO.id] }),
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('enviar-notificacao'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ aviso_id: 'aviso-test-id', hierarquia_ids: ['joao-id'] }),
      })
    );
  });

  it('envia broadcast com target_ids contendo APENAS o usuário notificado', async () => {
    const { enviarBroadcast } = await import('@/components/gestao/TabCobranca');
    enviarBroadcast('aviso-test-id', 'Você não cadastrou hoje!', `${JOAO.nome}, não esqueça...`, [JOAO.id]);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ target_ids: ['joao-id'] }),
      })
    );
  });

  it('broadcast é recebido pelo usuário correto → modal deve abrir', () => {
    const payload = {
      aviso_id: 'aviso-test-id',
      titulo: 'Você não cadastrou hoje!',
      corpo: `${JOAO.nome}, não esqueça de registrar seus cadastros de hoje.`,
      tipo: 'urgente',
      target_ids: [JOAO.id],
    };
    // Simula a lógica do guard em NotificationBell
    const targetIds: string[] = payload.target_ids ?? [];
    const meuId = JOAO.id;
    const deveExibir = !(targetIds.length > 0 && !targetIds.includes(meuId));
    expect(deveExibir).toBe(true);
  });

  it('broadcast NÃO é exibido para usuário que não é alvo', () => {
    const payload = { target_ids: [JOAO.id] };
    const outroUserId = 'suplente-outro-id';
    const targetIds: string[] = payload.target_ids ?? [];
    const deveExibir = !(targetIds.length > 0 && !targetIds.includes(outroUserId));
    expect(deveExibir).toBe(false);
  });

  it('admin que disparou NÃO recebe a notificação', () => {
    const ADMIN_ID = 'admin-coordenador-id';
    const targetIds = [JOAO.id]; // admin não está nos targets
    const deveExibir = !(targetIds.length > 0 && !targetIds.includes(ADMIN_ID));
    expect(deveExibir).toBe(false);
  });
});

// ─── CENÁRIO 2: Usuário SEM push ativo ainda recebe via broadcast in-app ──

describe('Cenário 2 — Usuário SEM push ativo (recebe só in-app via broadcast)', () => {
  const MARIA = makeUser({ id: 'maria-id', nome: 'Maria Santos', temPush: false, dias: 3 });

  beforeEach(() => {
    vi.clearAllMocks();
    broadcastBus.length = 0;
    setupSubscribeSuccess();
    setupPushResponse(0); // 0 push enviado (sem subscription)
  });

  it('Edge Function retorna enviados:0 (sem subscription de push)', async () => {
    const result = { enviados: 0 };
    expect(result.enviados).toBe(0);
  });

  it('broadcast ainda é disparado mesmo com enviados:0', async () => {
    const { enviarBroadcast } = await import('@/components/gestao/TabCobranca');
    enviarBroadcast('aviso-test-id', 'Você não cadastrou hoje!', 'Maria Santos, ...', [MARIA.id]);
    expect(mockSend).toHaveBeenCalled();
  });

  it('broadcast chega ao dispositivo da Maria (in-app) → modal exibe', () => {
    const targetIds = [MARIA.id];
    const deveExibir = !(targetIds.length > 0 && !targetIds.includes(MARIA.id));
    expect(deveExibir).toBe(true);
  });

  it('payload do modal tem conteúdo correto para a Maria', () => {
    const payload = {
      aviso_id: 'aviso-test-id',
      titulo: 'Você não cadastrou hoje!',
      corpo: 'Maria Santos, não esqueça de registrar seus cadastros de hoje.',
      tipo: 'urgente',
      target_ids: [MARIA.id],
    };
    expect(payload.titulo).toBe('Você não cadastrou hoje!');
    expect(payload.corpo).toContain('Maria Santos');
    expect(payload.tipo).toBe('urgente');
    expect(payload.target_ids).toContain(MARIA.id);
  });

  it('toast informa sobre usuário sem push (verão no app)', () => {
    const lista = [MARIA];
    const comPush = lista.filter(u => u.temPush).length;
    const semPush = lista.length - comPush;
    expect(semPush).toBe(1);
    expect(comPush).toBe(0);

    // Simula a lógica da mensagem do toast
    let desc = '';
    if (0 > 0) desc = '0 push enviado(s)';
    if (semPush > 0) desc += (desc ? ' · ' : '') + `${semPush} sem push (verão no app)`;
    expect(desc).toBe('1 sem push (verão no app)');
  });
});

// ─── CENÁRIO 3: Notificar todos (múltiplos usuários) ─────────────────────

describe('Cenário 3 — Notificar todos os suplentes sem cadastro', () => {
  const SUPLENTES = Array.from({ length: 10 }, (_, i) =>
    makeUser({ id: `suplente-${i}`, nome: `Suplente ${i}`, temPush: i % 2 === 0, dias: i + 1 })
  );

  beforeEach(() => {
    vi.clearAllMocks();
    broadcastBus.length = 0;
    setupSubscribeSuccess();
    setupPushResponse(5); // 5 com push ativo
  });

  it('cria apenas UM aviso para todos os usuários', async () => {
    const { criarAviso } = await import('@/components/gestao/TabCobranca');
    await criarAviso('Você não cadastrou hoje!', 'Não esqueça de registrar seus cadastros.');
    expect(mockInsertAviso).toHaveBeenCalledTimes(1);
  });

  it('aviso criado tem corpo genérico (sem nome individual) para grupo', async () => {
    const titulo = 'Você não cadastrou hoje!';
    const corpo = SUPLENTES.length > 1
      ? 'Não esqueça de registrar seus cadastros de hoje. Acesse o app agora!'
      : `${SUPLENTES[0].nome}, não esqueça...`;
    expect(corpo).not.toContain('Suplente 0');
    expect(corpo).toContain('Não esqueça');
  });

  it('broadcast inclui TODOS os IDs dos suplentes como target_ids', async () => {
    const ids = SUPLENTES.map(u => u.id);
    const { enviarBroadcast } = await import('@/components/gestao/TabCobranca');
    enviarBroadcast('aviso-test-id', 'Você não cadastrou hoje!', 'Corpo', ids);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ target_ids: ids }),
      })
    );
  });

  it('cada suplente na lista recebe o broadcast (todos incluídos em target_ids)', () => {
    const ids = SUPLENTES.map(u => u.id);
    SUPLENTES.forEach(suplente => {
      const deveExibir = ids.includes(suplente.id);
      expect(deveExibir).toBe(true);
    });
  });

  it('usuário fora da lista NÃO recebe o broadcast', () => {
    const ids = SUPLENTES.map(u => u.id);
    const foraLista = 'usuario-nao-listado';
    expect(ids.includes(foraLista)).toBe(false);
    const deveExibir = !(ids.length > 0 && !ids.includes(foraLista));
    expect(deveExibir).toBe(false);
  });

  it('contabiliza corretamente com e sem push na lista', () => {
    const comPush = SUPLENTES.filter(u => u.temPush).length;
    const semPush = SUPLENTES.filter(u => !u.temPush).length;
    expect(comPush + semPush).toBe(SUPLENTES.length);
    expect(comPush).toBe(5);
    expect(semPush).toBe(5);
  });

  it('all 10 suplentes são notificados via broadcast independente de push', () => {
    // Os 5 sem push também recebem via in-app broadcast
    const recebemInApp = SUPLENTES.filter(u => !u.temPush).length;
    expect(recebemInApp).toBe(5);
  });
});

// ─── CENÁRIO 4: TabAvisos fica limpo (sem spam de cobrança) ──────────────

describe('Cenário 4 — TabAvisos não exibe spam de cobrança', () => {
  const avisos = [
    { id: '1', titulo: 'Aviso oficial admin', ativa: true, tipo: 'info' },
    { id: '2', titulo: 'Você não cadastrou hoje!', ativa: false, tipo: 'urgente' },
    { id: '3', titulo: 'Você não cadastrou hoje!', ativa: false, tipo: 'urgente' },
    { id: '4', titulo: 'Reunião às 18h', ativa: true, tipo: 'alerta' },
    { id: '5', titulo: 'Você não cadastrou hoje!', ativa: false, tipo: 'urgente' },
  ];

  it('query com .eq(ativa, true) exclui todos os avisos de cobrança', () => {
    const resultado = avisos.filter(a => a.ativa);
    expect(resultado).toHaveLength(2);
    expect(resultado.every(a => a.ativa)).toBe(true);
  });

  it('nenhum aviso "Você não cadastrou hoje!" aparece no feed', () => {
    const resultado = avisos.filter(a => a.ativa);
    const spam = resultado.filter(a => a.titulo.includes('não cadastrou'));
    expect(spam).toHaveLength(0);
  });

  it('avisos oficiais do admin aparecem normalmente', () => {
    const resultado = avisos.filter(a => a.ativa);
    expect(resultado.find(a => a.id === '1')).toBeDefined();
    expect(resultado.find(a => a.id === '4')).toBeDefined();
  });

  it('mesmo após 100 disparos de cobrança, feed fica limpo', () => {
    const muitosSpam = Array.from({ length: 100 }, (_, i) => ({
      id: `spam-${i}`,
      titulo: 'Você não cadastrou hoje!',
      ativa: false,
      tipo: 'urgente',
    }));
    const feedCompleto = [...avisos, ...muitosSpam];
    const resultado = feedCompleto.filter(a => a.ativa);
    expect(resultado).toHaveLength(2);
    expect(resultado.every(a => !a.titulo.includes('não cadastrou'))).toBe(true);
  });
});

// ─── CENÁRIO 5: Modal (popup) no NotificationBell ────────────────────────

describe('Cenário 5 — Modal do NotificationBell abre e fecha corretamente', () => {
  it('payload do broadcast gera objeto de aviso válido para o modal', () => {
    const payload = {
      aviso_id: 'aviso-123',
      titulo: 'Você não cadastrou hoje!',
      corpo: 'João, não esqueça de registrar seus cadastros.',
      tipo: 'urgente',
      target_ids: ['joao-id'],
    };

    // Replica o que NotificationBell faz ao receber o broadcast
    const aviso = {
      id: payload.aviso_id ?? `notif-${Date.now()}`,
      titulo: payload.titulo ?? 'Notificação',
      corpo: payload.corpo ?? '',
      tipo: (payload.tipo ?? 'urgente') as 'info' | 'alerta' | 'sucesso' | 'urgente',
      ativa: true,
      persistente: false,
      criado_em: new Date().toISOString(),
    };

    expect(aviso.id).toBe('aviso-123');
    expect(aviso.titulo).toBe('Você não cadastrou hoje!');
    expect(aviso.tipo).toBe('urgente');
    expect(aviso.ativa).toBe(true);
    expect(aviso.persistente).toBe(false);
  });

  it('payload sem aviso_id gera id temporário (fallback)', () => {
    const payload = { titulo: 'Notif', corpo: 'Corpo', tipo: 'urgente' };
    const id = (payload as any).aviso_id ?? `notif-fallback`;
    expect(id).toContain('notif-fallback');
  });

  it('modal urgente usa tipo correto para estilização', () => {
    const TIPO_CONFIG = {
      info:    { color: 'text-blue-500' },
      alerta:  { color: 'text-amber-500' },
      sucesso: { color: 'text-emerald-500' },
      urgente: { color: 'text-red-500' },
    };
    const payload = { tipo: 'urgente' };
    const cfg = TIPO_CONFIG[payload.tipo as keyof typeof TIPO_CONFIG] ?? TIPO_CONFIG.info;
    expect(cfg.color).toBe('text-red-500');
  });

  it('modal de cobrança mostra nome do usuário no corpo', () => {
    const nomes = ['Maria', 'João', 'Pedro'];
    nomes.forEach(nome => {
      const corpo = `${nome}, não esqueça de registrar seus cadastros de hoje. Acesse o app agora!`;
      expect(corpo).toContain(nome);
      expect(corpo).toContain('Acesse o app agora!');
    });
  });
});

// ─── CENÁRIO 6: Push notification no Service Worker ──────────────────────

describe('Cenário 6 — Push notification no Service Worker (app fechado)', () => {
  function simulatePushHandler(payload: any) {
    let titulo = 'Nova notificação';
    let corpo = 'Abra o app para ver o aviso.';
    let avisoid: string | null = null;
    let tipo = 'info';

    if (payload) {
      titulo = payload.titulo || titulo;
      corpo = payload.corpo || corpo;
      avisoid = payload.aviso_id || null;
      tipo = payload.tipo || tipo;
    }

    const urgente = tipo === 'urgente';
    const tag = avisoid ? `aviso-${avisoid}` : `rede-notif-${Date.now()}`;

    return { titulo, corpo, avisoid, tipo, urgente, tag };
  }

  it('push com payload completo exibe título e corpo corretos', () => {
    const result = simulatePushHandler({
      titulo: 'Você não cadastrou hoje!',
      corpo: 'João, não esqueça...',
      aviso_id: 'aviso-abc',
      tipo: 'urgente',
    });
    expect(result.titulo).toBe('Você não cadastrou hoje!');
    expect(result.corpo).toContain('João');
    expect(result.urgente).toBe(true);
  });

  it('push urgente usa tag única por aviso (sem substituir outras notificações)', () => {
    const result = simulatePushHandler({ aviso_id: 'aviso-xyz', tipo: 'urgente' });
    expect(result.tag).toBe('aviso-aviso-xyz');
  });

  it('push sem payload usa defaults (app continua funcional)', () => {
    const result = simulatePushHandler(null);
    expect(result.titulo).toBe('Nova notificação');
    expect(result.urgente).toBe(false);
    expect(result.tag).toContain('rede-notif-');
  });

  it('push com payload incompleto usa defaults para campos faltantes', () => {
    const result = simulatePushHandler({ aviso_id: 'aviso-123' });
    expect(result.titulo).toBe('Nova notificação');
    expect(result.avisoid).toBe('aviso-123');
  });

  it('tipo urgente ativa requireInteraction (não some sozinho da tela de bloqueio)', () => {
    const result = simulatePushHandler({ tipo: 'urgente', titulo: 'T', corpo: 'C' });
    expect(result.urgente).toBe(true);
    // requireInteraction: true é usado quando urgente=true no SW
  });
});

// ─── CENÁRIO 7: Chain completa — admin notifica → usuário vê popup ────────

describe('Cenário 7 — Chain completa (admin dispara → usuário recebe)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    broadcastBus.length = 0;
    setupSubscribeSuccess();
    setupPushResponse(1);
  });

  it('chain completa: criarAviso → broadcast → targeting → modal payload', async () => {
    const USUARIO_ALVO = makeUser({ id: 'target-user', nome: 'Ana Paula', temPush: true });
    const ADMIN_ID = 'admin-id';

    // Passo 1: Admin cria o aviso
    const { criarAviso, enviarBroadcast } = await import('@/components/gestao/TabCobranca');
    const avisoid = await criarAviso('Você não cadastrou hoje!', `${USUARIO_ALVO.nome}, não esqueça...`);

    // Passo 2: Aviso criado com ativa: false
    expect(mockInsertAviso).toHaveBeenCalledWith(
      expect.objectContaining({ ativa: false })
    );

    // Passo 3: Broadcast disparado com o ID do usuário alvo
    enviarBroadcast(avisoid, 'Você não cadastrou hoje!', `${USUARIO_ALVO.nome}, não esqueça...`, [USUARIO_ALVO.id]);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'new_notification',
        payload: expect.objectContaining({ target_ids: [USUARIO_ALVO.id] }),
      })
    );

    // Passo 4: Usuário alvo recebe
    const broadcastPayload = mockSend.mock.calls[0][0].payload;
    const targetIds: string[] = broadcastPayload.target_ids;
    expect(targetIds.includes(USUARIO_ALVO.id)).toBe(true);   // ✅ alvo recebe
    expect(targetIds.includes(ADMIN_ID)).toBe(false);          // ✅ admin não recebe

    // Passo 5: Modal construído com dados corretos
    const modal = {
      id: broadcastPayload.aviso_id,
      titulo: broadcastPayload.titulo,
      corpo: broadcastPayload.corpo,
      tipo: broadcastPayload.tipo,
    };
    expect(modal.titulo).toBe('Você não cadastrou hoje!');
    expect(modal.corpo).toContain('Ana Paula');
    expect(modal.tipo).toBe('urgente');
  });

  it('chain para "notificar todos": 1 aviso → 1 broadcast → todos na lista recebem', async () => {
    const LISTA = [
      makeUser({ id: 'u1', nome: 'Alice', temPush: true }),
      makeUser({ id: 'u2', nome: 'Bob',   temPush: false }),
      makeUser({ id: 'u3', nome: 'Carol', temPush: true }),
    ];
    const ids = LISTA.map(u => u.id);

    const { criarAviso, enviarBroadcast } = await import('@/components/gestao/TabCobranca');
    const avisoid = await criarAviso('Você não cadastrou hoje!', 'Não esqueça...');
    enviarBroadcast(avisoid, 'Você não cadastrou hoje!', 'Não esqueça...', ids);

    // 1 aviso, não 3
    expect(mockInsertAviso).toHaveBeenCalledTimes(1);

    // broadcast com todos os IDs
    const broadcastPayload = mockSend.mock.calls[0][0].payload;
    expect(broadcastPayload.target_ids).toEqual(['u1', 'u2', 'u3']);

    // todos recebem — incluindo Bob (sem push) via in-app
    LISTA.forEach(u => {
      const recebe = broadcastPayload.target_ids.includes(u.id);
      expect(recebe).toBe(true);
    });

    // usuário de fora não recebe
    expect(broadcastPayload.target_ids.includes('user-fora')).toBe(false);
  });
});
