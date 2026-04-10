import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error, info);
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleFullReload = () => {
    // Clear SW caches to prevent corrupted cache loops
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  handleClearAndReload = async () => {
    // Nuclear option: clear everything and reload
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
      // Unregister SW
      const registrations = await navigator.serviceWorker?.getRegistrations();
      if (registrations) {
        await Promise.all(registrations.map(r => r.unregister()));
      }
      // Clear localStorage (except auth)
      const authKeys = ['sb-yvdfdmyusdhgtzfguxbj-auth-token'];
      const keysToKeep: Record<string, string> = {};
      authKeys.forEach(k => {
        const v = localStorage.getItem(k);
        if (v) keysToKeep[k] = v;
      });
      localStorage.clear();
      Object.entries(keysToKeep).forEach(([k, v]) => localStorage.setItem(k, v));
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isRecurring = this.state.errorCount >= 2;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="text-destructive font-bold text-lg mb-1">Algo deu errado</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {this.state.error?.message || 'Erro inesperado no aplicativo'}
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            {!isRecurring && (
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium active:scale-95 transition-transform"
              >
                <RefreshCw size={16} />
                Tentar novamente
              </button>
            )}
            <button
              onClick={this.handleFullReload}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-xl text-sm font-medium active:scale-95 transition-transform"
            >
              <Home size={16} />
              Recarregar app
            </button>
            {isRecurring && (
              <button
                onClick={this.handleClearAndReload}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-destructive underline"
              >
                Limpar cache e reiniciar
              </button>
            )}
          </div>

          <p className="text-[9px] text-muted-foreground/50 mt-4">
            Se o problema persistir, entre em contato com o suporte.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
