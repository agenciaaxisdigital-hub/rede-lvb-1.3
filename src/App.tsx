import { lazy, Suspense, useEffect, useRef, useCallback } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CidadeProvider } from "@/contexts/CidadeContext";
import { EventoProvider } from "@/contexts/EventoContext";
import LoadingScreen from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { startAutoSync, syncOfflineData } from "@/services/offlineSync";
import SyncStatusBanner from "@/components/SyncStatusBanner";
import { createIdbPersister } from "@/lib/queryPersistence";
import { useRegisterSW } from 'virtual:pwa-register/react';

import { getPendingCount } from "@/lib/offlineQueue";
import { supabase } from "@/integrations/supabase/client";

const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const HomeFernanda = lazy(() => import("./pages/HomeFernanda"));
const HomeAfiliado = lazy(() => import("./pages/HomeAfiliado"));
const CadastroPublicoAfiliado = lazy(() => import("./pages/CadastroPublicoAfiliado"));
const GestaoApp = lazy(() => import("./pages/GestaoApp"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const idbPersister = createIdbPersister();

const PERSISTED_QUERY_PREFIXES = ['liderancas', 'eleitores', 'fiscais', 'contagens', 'hierarquia_usuarios'];

function PrivateRoute({ children, allowFernanda = false, allowAfiliado = false }: { children: React.ReactNode; allowFernanda?: boolean; allowAfiliado?: boolean }) {
  const { user, loading, usuario } = useAuth();
  if (loading) return <LoadingScreen message="Verificando acesso" showProgress />;
  if (!user) return <Navigate to="/login" replace />;
  if (!usuario) return <Navigate to="/login" replace />;
  // Redirect Fernanda users to their dedicated screen
  if ((usuario.tipo as string) === 'fernanda' && !allowFernanda) {
    return <Navigate to="/fernanda" replace />;
  }
  // Redirect Afiliado users to their dedicated screen
  if ((usuario.tipo as string) === 'afiliado' && !allowAfiliado) {
    return <Navigate to="/afiliado" replace />;
  }
  return <>{children}</>;
}
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, usuario } = useAuth();
  if (loading) return <LoadingScreen message="Carregando..." />;
  
  // Se tem usuário E perfil, vai para a home (já está logado)
  if (user && usuario) return <Navigate to="/" replace />;
  
  // Caso contrário (sem user ou sem perfil), permite ver a página de Login
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen message="Carregando..." />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/cadastro/:token" element={<CadastroPublicoAfiliado />} />
        <Route path="/c/:slug/:token" element={<CadastroPublicoAfiliado />} />
        <Route path="/r/:slugComToken" element={<CadastroPublicoAfiliado />} />
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="/fernanda" element={<PrivateRoute allowFernanda><HomeFernanda /></PrivateRoute>} />
        <Route path="/afiliado" element={<PrivateRoute allowAfiliado><HomeAfiliado /></PrivateRoute>} />
        <Route path="/gestao" element={<PrivateRoute><GestaoApp /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function OfflineSyncManager() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      startAutoSync();
    }, 3000);
    
    const handler = () => syncOfflineData();
    window.addEventListener('sync-offline-data', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('sync-offline-data', handler);
    };
  }, [user]);
  
  return null;
}

const RT_CHANNEL = 'app-force-reload';

/** PWA silent auto-update — no popup, reloads automatically */
function PwaSilentUpdater() {
  const updateBlockedRef = useRef(false);
  const updateCheckFailures = useRef(0);

  // Recebe broadcast de force-reload enviado por outro cliente
  useEffect(() => {
    const channel = supabase
      .channel(RT_CHANNEL)
      .on('broadcast', { event: 'reload' }, () => {
        console.log('[SW] Force reload broadcast recebido');
        hardReloadAfterCacheClear();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const broadcastReload = useCallback(async () => {
    try {
      await supabase.channel(RT_CHANNEL).send({
        type: 'broadcast',
        event: 'reload',
        payload: {},
      });
    } catch (e) {
      console.warn('[SW] Broadcast failed:', e);
    }
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        const tryUpdate = async () => {
          try {
            await registration.update();
            updateCheckFailures.current = 0;
          } catch (err) {
            updateCheckFailures.current++;
            if (updateCheckFailures.current >= 5) {
              console.warn('[SW] Multiple update check failures — attempting SW recovery');
              try {
                await registration.unregister();
                if ('caches' in window) {
                  const names = await caches.keys();
                  await Promise.all(names.map(n => caches.delete(n)));
                }
                console.log('[SW] Recovery complete — reloading');
                window.location.reload();
              } catch (recoveryErr) {
                console.error('[SW] Recovery failed:', recoveryErr);
              }
            }
          }
        };

        // Verifica ao abrir o celular / voltar do background (instantâneo)
        const handleVisibility = () => {
          if (document.visibilityState === 'visible') tryUpdate();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // Fallback: verifica a cada 30 segundos enquanto o app está aberto
        setInterval(tryUpdate, 30_000);
      }
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error);
      // If SW fails to register, clear caches as fallback
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n)));
      }
    },
  });

  // Auto-apply update when available — no user action needed
  useEffect(() => {
    if (needRefresh) {
      console.log('[SW] New version available, updating silently...');
      const tryUpdate = async () => {
        const path = window.location.pathname;
        const isPublicForm = path.startsWith('/r/') || path.startsWith('/c/') || path.startsWith('/cadastro/');
        if (isPublicForm) {
          updateBlockedRef.current = true;
          return;
        }
        const pending = await getPendingCount();
        if (pending > 0) {
          console.log(`[SW] ${pending} offline items pending, deferring update...`);
          updateBlockedRef.current = true;
          return;
        }
        updateBlockedRef.current = false;
        // Avisa todos os outros clientes conectados para recarregarem também
        broadcastReload();
        updateServiceWorker(true);
      };
      const t = setTimeout(tryUpdate, 2000);
      const retryInterval = setInterval(async () => {
        if (!updateBlockedRef.current) return;
        const pending = await getPendingCount();
        if (pending === 0) {
          console.log('[SW] Offline queue clear, proceeding with update');
          updateBlockedRef.current = false;
          broadcastReload();
          updateServiceWorker(true);
          clearInterval(retryInterval);
        }
      }, 10_000);
      return () => { clearTimeout(t); clearInterval(retryInterval); };
    }
  }, [needRefresh, updateServiceWorker, broadcastReload]);

  return null;
}

const CHUNK_RELOAD_KEY = 'chunk-reload-at';

async function hardReloadAfterCacheClear() {
  // Guard: no máximo 1 reload por minuto para não entrar em loop
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
  if (Date.now() - last < 60_000) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));

  try {
    // 1. Desregistra SW
    const regs = await navigator.serviceWorker?.getRegistrations() || [];
    await Promise.all(regs.map(r => r.unregister()));
    // 2. Limpa todos os caches
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch (e) {
    console.warn('[GlobalRecovery] Cache clear failed:', e);
  }
  window.location.reload();
}

/** Global unhandled error recovery — prevents permanent white screen */
function GlobalErrorRecovery() {
  useEffect(() => {
    const isChunkError = (msg: string) =>
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Loading CSS chunk');

    const handleError = (event: ErrorEvent) => {
      if (isChunkError(event.message || '')) {
        console.warn('[GlobalRecovery] Chunk load failure — hard reload');
        hardReloadAfterCacheClear();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || '');
      if (isChunkError(reason)) {
        console.warn('[GlobalRecovery] Async chunk failure — hard reload');
        hardReloadAfterCacheClear();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: '',
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0];
            if (typeof key !== 'string') return false;
            return PERSISTED_QUERY_PREFIXES.includes(key) && query.state.status === 'success';
          },
        },
      }}
    >
      <TooltipProvider>
        <Toaster />
        <Analytics />
        <SpeedInsights />
        <BrowserRouter>
          <AuthProvider>
            <CidadeProvider>
              <EventoProvider>
                <ErrorBoundary>
                  <GlobalErrorRecovery />
                  <PwaSilentUpdater />
                  <OfflineSyncManager />
                  <SyncStatusBanner />
                  <AppRoutes />
                </ErrorBoundary>
              </EventoProvider>
            </CidadeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
