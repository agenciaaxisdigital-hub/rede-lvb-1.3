import { useState, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import fernandaImg from '@/assets/fernanda-sarelli.webp';
import logoSarelli from '@/assets/logo-sarelli.webp';

const ConstellationBg = lazy(() => import('@/components/ConstellationBg'));

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState(() => localStorage.getItem("saved_user") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem("saved_user"));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: 'Preencha nome e senha', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signIn(username, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao entrar', description: 'Nome ou senha incorretos', variant: 'destructive' });
    }
    if (remember) {
      localStorage.setItem("saved_user", username);
    } else {
      localStorage.removeItem("saved_user");
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center overflow-y-auto overscroll-contain relative"
      style={{ background: '#fdf2f8' }}
    >
      <Suspense fallback={null}>
        <ConstellationBg />
      </Suspense>

      <div className="w-full max-w-[460px] mx-auto px-5 relative z-10 flex flex-col items-center animate-fade-in py-8 my-auto">
        {/* Foto circular */}
        <div
          className="w-[120px] h-[120px] rounded-full overflow-hidden flex-shrink-0"
          style={{
            border: '4px solid #f9a8d4',
            boxShadow: '0 0 0 6px rgba(249,168,212,0.25), 0 8px 24px rgba(0,0,0,0.08)',
          }}
        >
          <img src={fernandaImg} alt="Dra. Fernanda Sarelli" className="w-full h-full object-cover" loading="eager" decoding="sync" />
        </div>

        {/* Logo */}
        <img
          src={logoSarelli}
          alt="Sarelli"
          className="h-[72px] object-contain mt-3 flex-shrink-0"
          loading="eager"
          decoding="sync"
        />

        {/* Subtítulo */}
        <p
          className="text-[13px] font-bold uppercase tracking-[0.22em] mt-3 mb-5 text-center flex-shrink-0"
          style={{ color: '#ec4899' }}
        >
          Cadastro de Campanha
        </p>

        {/* Card do formulário */}
        <div
          className="w-full rounded-2xl px-6 py-7 flex-shrink-0"
          style={{
            background: 'rgba(252, 231, 243, 0.55)',
            border: '1.5px solid rgba(249, 168, 212, 0.5)',
          }}
        >
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Usuário */}
            <div className="space-y-2">
              <label className="text-[13px] uppercase tracking-[0.18em] font-extrabold block" style={{ color: '#1f2937' }}>
                Usuário
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#d4a053' }}>
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <input
                  data-testid="input-nome"
                  type="text"
                  placeholder="Ex: Administrador"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  className="w-full h-[52px] pl-12 pr-4 rounded-xl text-[15px] outline-none transition-all placeholder:text-gray-400"
                  style={{
                    background: 'rgba(253, 242, 248, 0.85)',
                    border: '1px solid rgba(249, 168, 212, 0.35)',
                    color: '#374151',
                    fontSize: '16px',
                  }}
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <label className="text-[13px] uppercase tracking-[0.18em] font-extrabold block" style={{ color: '#1f2937' }}>
                Senha
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#d4a053' }}>
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  data-testid="input-senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-[52px] pl-12 pr-12 rounded-xl text-[15px] outline-none transition-all placeholder:text-gray-400"
                  style={{
                    background: 'rgba(253, 242, 248, 0.85)',
                    border: '1px solid rgba(249, 168, 212, 0.35)',
                    color: '#374151',
                    fontSize: '16px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors p-0.5"
                  style={{ color: '#d4a053' }}
                  tabIndex={-1}
                >
                  {showPassword
                    ? <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                    : <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {/* Lembrar */}
            <div className="flex items-center gap-3">
              <div
                onClick={() => setRemember(!remember)}
                className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center cursor-pointer transition-all flex-shrink-0"
                style={{
                  borderColor: remember ? '#ec4899' : '#d1d5db',
                  background: remember ? '#ec4899' : 'transparent',
                }}
              >
                {remember && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <label
                onClick={() => setRemember(!remember)}
                className="text-sm cursor-pointer select-none"
                style={{ color: '#4b5563' }}
              >
                Lembrar meus dados
              </label>
            </div>

            {/* Botão Entrar */}
            <button
              data-testid="btn-entrar"
              type="submit"
              disabled={loading}
              className="w-full h-[52px] rounded-xl font-semibold text-[15px] text-white transition-all active:scale-[0.97] disabled:opacity-60 shadow-md hover:shadow-lg hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 30%, #f59e0b 100%)',
              }}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    Entrando...
                  </span>
                : <span className="flex items-center justify-center gap-2.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Entrar
                  </span>
              }
            </button>
          </form>
        </div>

        {/* Rodapé */}
        <div className="text-center mt-5 space-y-1 flex-shrink-0">
          <p className="text-[12px] tracking-wide" style={{ color: '#9ca3af' }}>
            Pré-candidata a Deputada Estadual — GO 2026
          </p>
          <a
            href="https://drafernandasarelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] hover:underline transition-colors tracking-wide inline-block"
            style={{ color: '#ec4899' }}
          >
            drafernandasarelli.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
