import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInstagramCheck } from '@/hooks/useInstagramCheck';

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

describe('useInstagramCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Validação local (sem chamada de rede) ──────────────────────────

  it('retorna idle para valor vazio', () => {
    const { result } = renderHook(() => useInstagramCheck(''));
    expect(result.current).toBe('idle');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('retorna invalido para username com hífen', () => {
    const { result } = renderHook(() => useInstagramCheck('@nome-invalido'));
    expect(result.current).toBe('invalido');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('retorna invalido para username com espaço', () => {
    const { result } = renderHook(() => useInstagramCheck('nome invalido'));
    expect(result.current).toBe('invalido');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('retorna invalido para username iniciando com ponto', () => {
    const { result } = renderHook(() => useInstagramCheck('.usuario'));
    expect(result.current).toBe('invalido');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('retorna invalido para username com ponto duplo', () => {
    const { result } = renderHook(() => useInstagramCheck('us..er'));
    expect(result.current).toBe('invalido');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('normaliza URL completa do Instagram antes de validar', () => {
    mockInvoke.mockResolvedValue({ data: { exists: true }, error: null });
    const { result } = renderHook(() =>
      useInstagramCheck('https://www.instagram.com/fulano/'),
    );
    expect(result.current).toBe('checking');
  });

  it('normaliza @ antes de validar', () => {
    mockInvoke.mockResolvedValue({ data: { exists: true }, error: null });
    const { result } = renderHook(() => useInstagramCheck('@fulano'));
    expect(result.current).toBe('checking');
  });

  // ── Fluxo de rede (Edge Function) ─────────────────────────────────

  it('fica checking durante o debounce e chama Edge Function depois', async () => {
    mockInvoke.mockResolvedValue({ data: { exists: true }, error: null });
    const { result } = renderHook(() => useInstagramCheck('fulano'));
    expect(result.current).toBe('checking');
    expect(mockInvoke).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('verificar-instagram', {
      body: { usuario: 'fulano' },
    });
  });

  it('retorna ok quando Edge Function confirma exists: true', async () => {
    mockInvoke.mockResolvedValue({ data: { exists: true, usuario: 'fulano' }, error: null });
    const { result } = renderHook(() => useInstagramCheck('fulano'));
    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(result.current).toBe('ok');
  });

  it('retorna nao_existe quando Edge Function retorna exists: false', async () => {
    mockInvoke.mockResolvedValue({ data: { exists: false, usuario: 'naoexiste99' }, error: null });
    const { result } = renderHook(() => useInstagramCheck('naoexiste99'));
    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(result.current).toBe('nao_existe');
  });

  it('retorna inconclusivo quando Edge Function retorna exists: null', async () => {
    mockInvoke.mockResolvedValue({ data: { exists: null, status: 'inconclusivo' }, error: null });
    const { result } = renderHook(() => useInstagramCheck('userduvidoso'));
    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(result.current).toBe('inconclusivo');
  });

  it('retorna invalido quando Edge Function retorna formato_invalido', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, status: 'formato_invalido' },
      error: null,
    });
    const { result } = renderHook(() => useInstagramCheck('usuario_valido'));
    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(result.current).toBe('invalido');
  });

  it('retorna inconclusivo quando Edge Function retorna error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network failure') });
    const { result } = renderHook(() => useInstagramCheck('usuario'));
    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(result.current).toBe('inconclusivo');
  });

  it('retorna inconclusivo quando invoke lança exceção', async () => {
    mockInvoke.mockRejectedValue(new Error('timeout'));
    const { result } = renderHook(() => useInstagramCheck('usuario'));
    await act(() => vi.advanceTimersByTimeAsync(700));
    expect(result.current).toBe('inconclusivo');
  });

  // ── Debounce e cancelamento de requests concorrentes ──────────────

  it('respeita debounce de 600ms — não chama antes disso', async () => {
    mockInvoke.mockResolvedValue({ data: { exists: true }, error: null });
    renderHook(() => useInstagramCheck('usuario'));
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(mockInvoke).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(mockInvoke).toHaveBeenCalledOnce();
  });

  it('ignora resposta de request anterior quando valor mudou (race condition)', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstCall = new Promise((r) => { resolveFirst = r; });
    mockInvoke
      .mockImplementationOnce(() => firstCall)
      .mockResolvedValue({ data: { exists: false }, error: null });

    const { result, rerender } = renderHook(
      ({ val }) => useInstagramCheck(val),
      { initialProps: { val: 'primeiro' } },
    );
    await act(() => vi.advanceTimersByTimeAsync(700));

    rerender({ val: 'segundo' });
    await act(() => vi.advanceTimersByTimeAsync(700));

    // Resolve o primeiro request depois do segundo já ter chegado
    await act(async () => {
      resolveFirst({ data: { exists: true }, error: null });
      await Promise.resolve();
    });

    // Estado deve refletir o segundo request (exists: false), não o primeiro (exists: true)
    expect(result.current).toBe('nao_existe');
  });
});
