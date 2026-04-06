import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolverMunicipioId, buscarNomeMunicipio } from '@/lib/resolverMunicipio';
import type { User } from '@supabase/supabase-js';

export type TipoUsuario = 'super_admin' | 'coordenador' | 'suplente' | 'lideranca';

interface HierarquiaUsuario {
  id: string;
  auth_user_id: string;
  nome: string;
  tipo: TipoUsuario;
  superior_id: string | null;
  suplente_id: string | null;
  ativo: boolean;
  municipio_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  usuario: HierarquiaUsuario | null;
  loading: boolean;
  isAdmin: boolean;
  isSuplente: boolean;
  isLideranca: boolean;
  tipoUsuario: TipoUsuario | null;
  municipioId: string | null;
  municipioNome: string | null;
  signIn: (nome: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function nomeToEmail(nome: string): string {
  const slug = nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  return `${slug}@rede.sarelli.com`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<HierarquiaUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [municipioId, setMunicipioId] = useState<string | null>(null);
  const [municipioNome, setMunicipioNome] = useState<string | null>(null);

  const resolverMunicipio = async (usr: HierarquiaUsuario) => {
    const t0 = performance.now();
    try {
      if (usr.municipio_id) {
        setMunicipioId(usr.municipio_id);
        const nome = await buscarNomeMunicipio(usr.municipio_id);
        setMunicipioNome(nome);
        console.log(`[Auth] resolverMunicipio (direto) ${(performance.now() - t0).toFixed(0)}ms`);
        return;
      }
      if (usr.suplente_id) {
        const munId = await resolverMunicipioId(usr.suplente_id);
        if (munId) {
          setMunicipioId(munId);
          const nome = await buscarNomeMunicipio(munId);
          setMunicipioNome(nome);
          console.log(`[Auth] resolverMunicipio (suplente) ${(performance.now() - t0).toFixed(0)}ms`);
          return;
        }
      }
      setMunicipioId(null);
      setMunicipioNome(null);
    } catch (err) {
      console.error('[Auth] resolverMunicipio error:', err);
      setMunicipioId(null);
      setMunicipioNome(null);
    }
  };

  const fetchUsuario = async (authUserId: string): Promise<HierarquiaUsuario | null> => {
    const t0 = performance.now();
    try {
      const { data, error } = await supabase
        .from('hierarquia_usuarios')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('ativo', true)
        .single();
      console.log(`[Auth] fetchUsuario ${(performance.now() - t0).toFixed(0)}ms`);
      if (error) {
        console.error('[Auth] fetchUsuario error:', error.message);
        return null;
      }
      return data as unknown as HierarquiaUsuario;
    } catch (err) {
      console.error('[Auth] fetchUsuario unexpected error:', err);
      return null;
    }
  };

  /** Parallelized init: fetchUsuario + resolverMunicipio run concurrently where possible */
  const initializeUser = async (authUserId: string) => {
    const t0 = performance.now();
    console.log('[Auth] ⏱ initializeUser start');

    const usr = await fetchUsuario(authUserId);
    if (!usr) {
      setUsuario(null);
      setMunicipioId(null);
      setMunicipioNome(null);
      console.log(`[Auth] ⏱ initializeUser done (no user) ${(performance.now() - t0).toFixed(0)}ms`);
      return;
    }

    // Set usuario immediately so UI can start rendering
    setUsuario(usr);

    // Resolve municipio in parallel (non-blocking for initial render)
    await resolverMunicipio(usr);
    console.log(`[Auth] ⏱ initializeUser done ${(performance.now() - t0).toFixed(0)}ms`);
  };

  useEffect(() => {
    let initialized = false;
    let active = true;
    const t0 = performance.now();

    const safetyTimeout = setTimeout(() => {
      if (active && !initialized) {
        console.warn('[Auth] Safety timeout (4s) — forcing loading=false');
        setLoading(false);
        initialized = true;
      }
    }, 4000);

    console.log('[Auth] ⏱ getSession start');
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log(`[Auth] ⏱ getSession done ${(performance.now() - t0).toFixed(0)}ms`);
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          await initializeUser(session.user.id);
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
      } finally {
        if (active) setLoading(false);
        initialized = true;
        clearTimeout(safetyTimeout);
      }
    }).catch((err) => {
      console.error('[Auth] getSession error:', err);
      if (active) setLoading(false);
      initialized = true;
      clearTimeout(safetyTimeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!initialized || !active) return;
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          await initializeUser(session.user.id);
        } else {
          setUsuario(null);
          setMunicipioId(null);
          setMunicipioNome(null);
        }
      } catch (err) {
        console.error('[Auth] Auth state change error:', err);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (nome: string, password: string) => {
    const t0 = performance.now();
    console.log('[Auth] ⏱ signIn start');
    const email = nomeToEmail(nome);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    console.log(`[Auth] ⏱ signIn done ${(performance.now() - t0).toFixed(0)}ms, error=${!!error}`);
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsuario(null);
    setMunicipioId(null);
    setMunicipioNome(null);
  };

  const tipo = usuario?.tipo ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      usuario,
      loading,
      isAdmin: tipo === 'super_admin' || tipo === 'coordenador',
      isSuplente: tipo === 'suplente',
      isLideranca: tipo === 'lideranca',
      tipoUsuario: tipo,
      municipioId,
      municipioNome,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
