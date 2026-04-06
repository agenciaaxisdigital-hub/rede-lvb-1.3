import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/AuthContext', () => {
  const signInMock = vi.fn();
  return {
    useAuth: () => ({
      signIn: signInMock,
      user: null,
      usuario: null,
      loading: false,
    }),
    AuthProvider: ({ children }: any) => children,
    __signInMock: signInMock,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn(), Navigate: () => null };
});

vi.mock('@/components/ConstellationBg', () => ({
  default: () => null,
}));

vi.mock('@/assets/fernanda-sarelli.webp', () => ({
  default: 'mock-image.webp',
}));

vi.mock('@/assets/logo-sarelli.webp', () => ({
  default: 'mock-logo.webp',
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

let LoginComponent: any;
beforeAll(async () => {
  const mod = await import('@/pages/Login');
  LoginComponent = mod.default;
});

describe('Tela de Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza campo de nome com data-testid', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByTestId('input-nome')).toBeInTheDocument();
  });

  it('renderiza campo de senha com data-testid', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByTestId('input-senha')).toBeInTheDocument();
  });

  it('renderiza botão de entrar', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByTestId('btn-entrar')).toBeInTheDocument();
  });

  it('chama signIn ao submeter formulário', async () => {
    const { __signInMock: signInMock } = await import('@/contexts/AuthContext') as any;
    signInMock.mockResolvedValue({ error: null });
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    fireEvent.change(screen.getByTestId('input-nome'), { target: { value: 'João' } });
    fireEvent.change(screen.getByTestId('input-senha'), { target: { value: '1234' } });
    fireEvent.click(screen.getByTestId('btn-entrar'));
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('João', '1234');
    });
  });

  it('campos têm atributo required', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByTestId('input-nome')).toHaveAttribute('required');
    expect(screen.getByTestId('input-senha')).toHaveAttribute('required');
  });

  it('exibe checkbox de lembrar dados', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByText(/lembrar/i)).toBeInTheDocument();
  });
});
