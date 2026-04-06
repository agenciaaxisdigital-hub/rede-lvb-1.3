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
    <div className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center overflow-y-auto overscroll-contain relative">
      <Suspense fallback={null}>
        <ConstellationBg />
      </Suspense>

      <div className="w-full max-w-[480px] mx-auto px-5 pt-8 pb-10 sm:py-0 relative z-10 flex flex-col items-center">
        {/* Avatar with animated ring */}
        <div className="relative mb-3">
          <div
            className="absolute -inset-[3px] rounded-full animate-[spin_8s_linear_infinite] opacity-60"
            style={{
              background: 'conic-gradient(from 0deg, #ec4899, #f472b6, #e879f9, #c084fc, #ec4899)',
            }}
          />
          <div
            className="relative w-[96px] h-[96px] sm:w-[110px] sm:h-[110px] rounded-full overflow-hidden"
            style={{ border: '3px solid #fdf2f8' }}
          >
            <img src={fernandaImg} alt="Dra. Fernanda Sarelli" className="w-full h-full object-cover" loading="eager" decoding="sync" />
          </div>
        </div>

        {/* Logo */}
        <img
          src={logoSarelli}
          alt="Sarelli"
          className="h-16 sm:h-20 object-contain"
          loading="eager"
          decoding="sync"
        />

        {/* Subtitle */}
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em] mt-2 mb-5"
          style={{ color: '#be185d' }}>
          Painel de Campanha
        </p>

        {/* Glass card with animated border */}
        <div className="relative w-full group">
          {/* Animated gradient border */}
          <div
            className="absolute -inset-[1px] rounded-2xl opacity-40 blur-[1px] animate-[spin_6s_linear_infinite]"
            style={{
              background: 'conic-gradient(from 0deg, #f9a8d4, #f472b6, #e879f9, #c084fc, #f9a8d4)',
            }}
          />
          {/* Card */}
          <div className="relative w-full rounded-2xl bg-white/70 backdrop-blur-xl px-6 py-7 sm:px-8 sm:py-8 shadow-[0_8px_40px_-12px_rgba(236,72,153,0.15)]">
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.18em] font-semibold block"
                  style={{ color: '#9d174d' }}>
                  Usuário
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#d1d5db' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <input
                    data-testid="input-nome"
                    type="text"
                    placeholder="Nome de usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="username"
                    className="w-full bg-white/80 border border-pink-100 text-gray-800 placeholder:text-gray-300 h-12 pl-11 pr-4 rounded-xl text-sm outline-none transition-all duration-300 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 focus:bg-white"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.18em] font-semibold block"
                  style={{ color: '#9d174d' }}>
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#d1d5db' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
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
                    className="w-full bg-white/80 border border-pink-100 text-gray-800 placeholder:text-gray-300 h-12 pl-11 pr-11 rounded-xl text-sm outline-none transition-all duration-300 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 focus:bg-white"
                    style={{ fontSize: '16px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-pink-400 transition-colors duration-200 p-0.5"
                    tabIndex={-1}
                  >
                    {showPassword
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Remember */}
              <div className="flex items-center gap-2.5 pt-0.5">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-pink-500 cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-gray-500 cursor-pointer select-none">Lembrar meus dados</label>
              </div>

              {/* Submit */}
              <button
                data-testid="btn-entrar"
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-sm text-white transition-all duration-300 active:scale-[0.97] disabled:opacity-60 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:brightness-105"
                style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)',
                }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      Entrando...
                    </span>
                  : <span className="flex items-center justify-center gap-2 tracking-wide">
                      Entrar
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                }
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-5 space-y-0.5">
          <p className="text-[10px] text-gray-400 tracking-wide">Pré-candidata a Deputada Estadual — GO 2026</p>
          <a
            href="https://drafernandasarelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] tracking-wide transition-colors duration-200"
            style={{ color: '#f472b6' }}
          >
            drafernandasarelli.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
