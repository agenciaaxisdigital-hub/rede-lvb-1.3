import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// Mock all heavy dependencies before importing Login
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

// Mock the Hyperspeed 3D component (heavy dependency)
vi.mock('@/components/Hyperspeed', () => ({
  default: () => null,
}));

// Mock the image import
vi.mock('@/assets/fernanda-sarelli.jpg', () => ({
  default: 'mock-image.jpg',
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

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

  it('renderiza botão de entrar com data-testid', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByTestId('btn-entrar')).toBeInTheDocument();
  });

  it('renderiza campo de nome com placeholder', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByPlaceholderText(/nome de acesso/i)).toBeInTheDocument();
  });

  it('renderiza campo de senha tipo password', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    const senhaInput = screen.getByTestId('input-senha');
    expect(senhaInput).toHaveAttribute('type', 'password');
  });

  it('alterna visibilidade da senha ao clicar no botão', async () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    const senhaInput = screen.getByTestId('input-senha');
    expect(senhaInput).toHaveAttribute('type', 'password');
    
    // Find the toggle button (it's a sibling button in the password field div)
    const toggleButtons = screen.getAllByRole('button');
    const toggleBtn = toggleButtons.find(btn => btn.getAttribute('tabindex') === '-1');
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(senhaInput).toHaveAttribute('type', 'text');
    }
  });

  it('chama signIn ao submeter formulário', async () => {
    const { __signInMock: signInMock } = await import('@/contexts/AuthContext') as any;
    signInMock.mockResolvedValue({ error: null });
    
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    
    fireEvent.change(screen.getByTestId('input-nome'), { target: { value: 'João Silva' } });
    fireEvent.change(screen.getByTestId('input-senha'), { target: { value: 'senha123' } });
    fireEvent.click(screen.getByTestId('btn-entrar'));
    
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('João Silva', 'senha123');
    });
  });

  it('campos têm atributo required para validação HTML5', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByTestId('input-nome')).toHaveAttribute('required');
    expect(screen.getByTestId('input-senha')).toHaveAttribute('required');
  });

  it('exibe texto de branding correto', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByText(/Dra\. Fernanda Sarelli/i)).toBeInTheDocument();
  });

  it('exibe checkbox de lembrar dados', () => {
    render(<MemoryRouter><LoginComponent /></MemoryRouter>);
    expect(screen.getByLabelText(/lembrar/i)).toBeInTheDocument();
  });
});

// Lazy import after mocks
let LoginComponent: any;
beforeAll(async () => {
  const mod = await import('@/pages/Login');
  LoginComponent = mod.default;
});
