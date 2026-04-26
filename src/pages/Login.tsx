import { useState, lazy, Suspense, type CSSProperties } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { User, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import fernandaImg from '@/assets/fernanda-sarelli.webp';
import logoSarelli from '@/assets/logo-sarelli.webp';
import FloatingSupportButton from '@/components/FloatingSupportButton';

const ConstellationBg = lazy(() => import('@/components/ConstellationBg'));

/* ── animation helper ── */
const entrance = (delay: number, bounce = false): CSSProperties => ({
  opacity: 0,
  transform: 'translateY(30px) scale(0.95)',
  animation: `loginEntrance 0.6s ${bounce ? 'cubic-bezier(0.34,1.56,0.64,1)' : 'cubic-bezier(0.16,1,0.3,1)'} ${delay}s forwards`,
});

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState(() => localStorage.getItem("saved_user") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem("saved_user"));
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  // Rate limiting: lock after 5 failed attempts
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: 'Preencha usuário e senha', variant: 'destructive' });
      return;
    }
    if (isLocked) {
      const remainingSec = Math.ceil((lockedUntil! - Date.now()) / 1000);
      toast({ title: `Aguarde ${remainingSec}s`, description: 'Muitas tentativas. Tente novamente em breve.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signIn(username, password);
    setLoading(false);
    if (error) {
      const newCount = failedAttempts + 1;
      setFailedAttempts(newCount);
      if (newCount >= 5) {
        // Lock for 30s after 5 failures, exponentially increasing
        const lockMs = Math.min(30000 * Math.pow(2, Math.floor((newCount - 5) / 3)), 300000);
        setLockedUntil(Date.now() + lockMs);
        toast({ title: 'Conta temporariamente bloqueada', description: `Muitas tentativas. Aguarde ${Math.round(lockMs / 1000)}s.`, variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao entrar', description: 'Usuário ou senha incorretos', variant: 'destructive' });
      }
    } else {
      setFailedAttempts(0);
      setLockedUntil(null);
    }
    if (remember) localStorage.setItem("saved_user", username);
    else localStorage.removeItem("saved_user");
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center overflow-y-auto overscroll-contain relative"
      style={{ background: 'linear-gradient(180deg, #fef2f2 0%, #fdf2f8 40%, #fefefe 100%)' }}
    >
      {/* Canvas constellation */}
      <Suspense fallback={null}>
        <ConstellationBg />
      </Suspense>

      {/* Overlay radial */}
      <div className="fixed inset-0 z-[1] pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 10%, rgba(200,170,100,0.07) 0%, transparent 60%), radial-gradient(ellipse at 50% 90%, rgba(236,72,153,0.05) 0%, transparent 60%)',
      }} />

      {/* Main container */}
      <div className="w-full max-w-[24rem] mx-auto px-4 relative z-10 flex flex-col items-center justify-start pt-8 md:justify-center md:pt-0 min-h-[100dvh]">

        {/* Photo */}
        <div style={entrance(0.1, true)}>
          <div
            className="w-[90px] h-[90px] md:w-[110px] md:h-[110px] rounded-full overflow-hidden flex-shrink-0"
            style={{
              border: '3px solid #ec4899',
              boxShadow: '0 4px 25px rgba(236,72,153,0.3)',
            }}
          >
            <img
              src={fernandaImg}
              alt="Dra. Fernanda Sarelli"
              className="w-full h-full object-cover"
              style={{ objectPosition: '50% 15%' }}
              loading="eager"
              decoding="sync"
            />
          </div>
        </div>

        {/* Logo */}
        <div style={entrance(0.2, true)}>
          <img
            src={logoSarelli}
            alt="Sarelli"
            className="h-36 md:h-44 object-contain flex-shrink-0"
            style={{ marginTop: '-1.5rem' }}
            loading="eager"
            decoding="sync"
          />
        </div>

        {/* Subtitle */}
        <p
          style={{ ...entrance(0.3), marginTop: '-1rem', color: '#c8aa64', fontSize: '12px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' as const }}
          className="text-center flex-shrink-0"
        >
          Painel de Lideranças
        </p>

        {/* Form card (glassmorphism) */}
        <div
          className="w-full flex-shrink-0 mt-5"
          style={{
            ...entrance(0.3),
            borderRadius: '20px',
            padding: 'clamp(1.25rem, 3vw, 1.75rem)',
            background: 'linear-gradient(160deg, rgba(255,255,255,0.38), rgba(255,240,245,0.18) 50%, rgba(255,255,255,0.08))',
            backdropFilter: 'blur(20px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
            border: '2px solid rgba(236,150,170,0.5)',
            boxShadow: '0 8px 40px rgba(236,72,153,0.08), 0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5), 0 0 20px rgba(236,150,170,0.15)',
            animation: `glassPulse 4s ease-in-out infinite, loginEntrance 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s forwards`,
            opacity: 0,
            transform: 'translateY(30px) scale(0.95)',
          }}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div style={entrance(0.35)}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: '#555' }} className="block mb-1.5">
                Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: '#c8aa64' }} strokeWidth={1.8} />
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
                  className="w-full h-12 pl-10 pr-4 rounded-xl text-sm outline-none transition-all placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(200,170,100,0.3)',
                    color: '#333',
                    fontSize: '16px',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={entrance(0.4)}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: '#555' }} className="block mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: '#c8aa64' }} strokeWidth={1.8} />
                <input
                  data-testid="input-senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-12 pl-10 pr-12 rounded-xl text-sm outline-none transition-all placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(200,170,100,0.3)',
                    color: '#333',
                    fontSize: '16px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                  style={{ color: '#c8aa64' }}
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    : <Eye className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  }
                </button>
              </div>
            </div>

            {/* Remember */}
            <div className="flex items-center gap-2.5" style={entrance(0.45)}>
              <div
                onClick={() => setRemember(!remember)}
                className="w-4 h-4 rounded-sm border flex items-center justify-center cursor-pointer transition-all flex-shrink-0"
                style={{
                  borderColor: remember ? '#ec4899' : '#ccc',
                  background: remember ? '#ec4899' : 'transparent',
                }}
              >
                {remember && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <label onClick={() => setRemember(!remember)} className="cursor-pointer select-none" style={{ fontSize: '12px', color: '#777' }}>
                Lembrar meus dados
              </label>
            </div>

            {/* Submit */}
            <button
              data-testid="btn-entrar"
              type="submit"
              disabled={loading || isLocked}
              className="w-full h-12 rounded-xl font-bold text-white transition-all active:scale-[0.97] disabled:opacity-60 hover:brightness-110 flex items-center justify-center gap-2.5"
              style={{
                ...entrance(0.5),
                background: isLocked ? '#999' : 'linear-gradient(135deg, #ec4899, #d4a054)',
                boxShadow: isLocked ? 'none' : '0 4px 20px rgba(236,72,153,0.3), 0 2px 8px rgba(200,170,100,0.2)',
              }}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  Entrando...
                </>
              ) : isLocked ? (
                'Aguarde...'
              ) : (
                <>
                  <LogIn className="w-5 h-5" strokeWidth={2.5} />
                  Entrar
                </>
              )}
            </button>
          </form>
        </div>

      </div>

      <FloatingSupportButton />

      {/* Keyframes */}
      <style>{`
        @keyframes loginEntrance {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes glassPulse {
          0%, 100% {
            border-color: rgba(236,150,170,0.4);
            box-shadow: 0 8px 40px rgba(236,72,153,0.06), 0 0 15px rgba(236,150,170,0.1), inset 0 1px 0 rgba(255,255,255,0.5);
          }
          50% {
            border-color: rgba(236,150,170,0.65);
            box-shadow: 0 8px 40px rgba(236,72,153,0.12), 0 0 25px rgba(236,150,170,0.2), inset 0 1px 0 rgba(255,255,255,0.5);
          }
        }
      `}</style>
    </div>
  );
}
