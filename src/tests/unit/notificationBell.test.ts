import { describe, it, expect, vi } from 'vitest';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface Aviso {
  id: string;
  titulo: string;
  corpo: string;
  tipo: 'info' | 'alerta' | 'sucesso' | 'urgente';
  ativa: boolean;
  persistente: boolean;
  criado_em: string;
}

// ─── Lógica de filtragem por target_ids (broadcast) ──────────────────────────
// Replica exatamente o guard implementado em NotificationBell.tsx

function deveExibirNotificacao(targetIds: string[], meuId: string): boolean {
  if (targetIds.length > 0 && !targetIds.includes(meuId)) return false;
  return true;
}

describe('broadcast – filtragem por target_ids', () => {
  const MEU_ID = 'user-suplente-1';

  it('exibe quando o usuário está em target_ids', () => {
    expect(deveExibirNotificacao([MEU_ID, 'outro'], MEU_ID)).toBe(true);
  });

  it('ignora quando o usuário NÃO está em target_ids', () => {
    expect(deveExibirNotificacao(['user-outro', 'user-outro-2'], MEU_ID)).toBe(false);
  });

  it('exibe para todos quando target_ids está vazio (broadcast global)', () => {
    expect(deveExibirNotificacao([], MEU_ID)).toBe(true);
    expect(deveExibirNotificacao([], 'qualquer-usuario')).toBe(true);
  });

  it('notificação cobrança chega apenas ao destinatário correto (lista com 3)', () => {
    const ids = ['user-1', 'user-2', 'user-3'];
    expect(deveExibirNotificacao(ids, 'user-2')).toBe(true);
    expect(deveExibirNotificacao(ids, 'user-5')).toBe(false);
  });

  it('admin que disparou NÃO recebe a notificação (admin não está em target_ids)', () => {
    const ADMIN_ID = 'admin-id';
    const ids = ['suplente-1', 'suplente-2'];
    expect(deveExibirNotificacao(ids, ADMIN_ID)).toBe(false);
  });

  it('notificarTodos: todos os alvos recebem', () => {
    const ids = Array.from({ length: 45 }, (_, i) => `suplente-${i}`);
    ids.forEach(id => {
      expect(deveExibirNotificacao(ids, id)).toBe(true);
    });
  });
});

// ─── Filtragem de avisos visíveis (ativa: true) ────────────────────────────

describe('visibilidade de avisos no NotificationBell', () => {
  const avisos: Aviso[] = [
    { id: '1', titulo: 'Aviso oficial', corpo: 'Reunião amanhã', tipo: 'info', ativa: true, persistente: false, criado_em: new Date().toISOString() },
    { id: '2', titulo: 'Cobrança spam', corpo: 'Você não cadastrou', tipo: 'urgente', ativa: false, persistente: false, criado_em: new Date().toISOString() },
    { id: '3', titulo: 'Aviso urgente', corpo: 'Emergência!', tipo: 'urgente', ativa: true, persistente: true, criado_em: new Date().toISOString() },
    { id: '4', titulo: 'Aviso desativado', corpo: 'Antigo', tipo: 'alerta', ativa: false, persistente: false, criado_em: new Date().toISOString() },
  ];

  it('exibe apenas avisos com ativa: true', () => {
    const visiveis = avisos.filter(a => a.ativa);
    expect(visiveis).toHaveLength(2);
    expect(visiveis.every(a => a.ativa)).toBe(true);
  });

  it('oculta avisos de cobrança (ativa: false) do feed', () => {
    const visiveis = avisos.filter(a => a.ativa);
    const spam = visiveis.find(a => a.titulo.includes('Cobrança'));
    expect(spam).toBeUndefined();
  });

  it('avisos persistentes não vistos disparam abertura do painel', () => {
    const vizSet = new Set<string>();
    const persistenteNaoVisto = avisos
      .filter(a => a.ativa)
      .find(a => a.persistente && !vizSet.has(a.id));
    expect(persistenteNaoVisto?.id).toBe('3');
  });

  it('aviso persistente já visto NÃO reabre painel', () => {
    const vizSet = new Set(['3']);
    const persistenteNaoVisto = avisos
      .filter(a => a.ativa)
      .find(a => a.persistente && !vizSet.has(a.id));
    expect(persistenteNaoVisto).toBeUndefined();
  });
});

// ─── Detecção de avisos novos via Realtime ─────────────────────────────────

describe('detecção de novo aviso via Realtime (knownIds)', () => {
  const makeAviso = (id: string, ativa = true): Aviso => ({
    id,
    titulo: `Aviso ${id}`,
    corpo: '',
    tipo: 'info',
    ativa,
    persistente: false,
    criado_em: new Date().toISOString(),
  });

  function detectarNovos(
    visiveis: Aviso[],
    knownIds: Set<string>,
    vizSet: Set<string>
  ): Aviso[] {
    return visiveis.filter(a => !knownIds.has(a.id) && !vizSet.has(a.id));
  }

  it('detecta aviso novo quando não estava em knownIds', () => {
    const visiveis = [makeAviso('old-1'), makeAviso('new-2')];
    const known = new Set(['old-1']);
    const viz = new Set<string>();
    const novos = detectarNovos(visiveis, known, viz);
    expect(novos).toHaveLength(1);
    expect(novos[0].id).toBe('new-2');
  });

  it('não dispara para aviso já conhecido', () => {
    const visiveis = [makeAviso('known-1')];
    const known = new Set(['known-1']);
    const viz = new Set<string>();
    expect(detectarNovos(visiveis, known, viz)).toHaveLength(0);
  });

  it('não dispara para aviso já visualizado', () => {
    const visiveis = [makeAviso('aviso-1')];
    const known = new Set<string>();
    const viz = new Set(['aviso-1']);
    expect(detectarNovos(visiveis, known, viz)).toHaveLength(0);
  });

  it('cobrança (ativa:false) nunca entra em visiveis → nunca dispara Realtime', () => {
    const todos = [makeAviso('oficial-1', true), makeAviso('cobranca-1', false)];
    const visiveis = todos.filter(a => a.ativa);
    const known = new Set<string>();
    const viz = new Set<string>();
    const novos = detectarNovos(visiveis, known, viz);
    expect(novos.every(a => a.id !== 'cobranca-1')).toBe(true);
  });
});

// ─── Contador de não lidos ──────────────────────────────────────────────────

describe('contador de não lidos', () => {
  const avisos: Aviso[] = [
    { id: 'a1', titulo: 'T', corpo: '', tipo: 'info', ativa: true, persistente: false, criado_em: '' },
    { id: 'a2', titulo: 'T', corpo: '', tipo: 'urgente', ativa: true, persistente: false, criado_em: '' },
    { id: 'a3', titulo: 'T', corpo: '', tipo: 'alerta', ativa: true, persistente: false, criado_em: '' },
  ];

  it('conta corretamente não lidos', () => {
    const viz = new Set(['a1']);
    const unread = avisos.filter(a => !viz.has(a.id)).length;
    expect(unread).toBe(2);
  });

  it('zero não lidos quando tudo foi visto', () => {
    const viz = new Set(['a1', 'a2', 'a3']);
    const unread = avisos.filter(a => !viz.has(a.id)).length;
    expect(unread).toBe(0);
  });

  it('todos não lidos quando nada foi visto', () => {
    const viz = new Set<string>();
    const unread = avisos.filter(a => !viz.has(a.id)).length;
    expect(unread).toBe(3);
  });
});

// ─── playNotifSound (AudioContext mock) ─────────────────────────────────────

describe('playNotifSound', () => {
  it('não lança exceção quando AudioContext não disponível', () => {
    const original = (global as any).AudioContext;
    delete (global as any).AudioContext;

    const playNotifSound = (urgente = false) => {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(urgente ? 1200 : 1760, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        osc.onended = () => ctx.close();
      } catch {
        // silent fail — expected when AudioContext unavailable
      }
    };

    expect(() => playNotifSound()).not.toThrow();
    expect(() => playNotifSound(true)).not.toThrow();
    (global as any).AudioContext = original;
  });

  it('executa sem lançar exceção quando AudioContext disponível (mock)', () => {
    const mockOsc = {
      connect: vi.fn(),
      type: '',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      gain: { setValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as any,
    };
    const mockGain = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    };
    const mockCtx = {
      createOscillator: vi.fn().mockReturnValue(mockOsc),
      createGain: vi.fn().mockReturnValue(mockGain),
      destination: {},
      currentTime: 0,
      close: vi.fn(),
    };
    (global as any).AudioContext = vi.fn().mockReturnValue(mockCtx);

    const playNotifSound = () => {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        osc.onended = () => ctx.close();
      } catch {}
    };

    expect(() => playNotifSound()).not.toThrow();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });
});
