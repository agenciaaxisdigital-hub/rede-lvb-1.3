import { useState, useEffect } from 'react';
import { WifiOff, Wifi, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getPendingCount } from '@/lib/offlineQueue';
import { onSyncStatusChange, syncOfflineData } from '@/services/offlineSync';

type SyncState = 'online' | 'offline' | 'syncing' | 'synced' | 'error';

export default function SyncStatusBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>(navigator.onLine ? 'online' : 'offline');
  const [lastResult, setLastResult] = useState<{ synced: number; failed: number } | null>(null);
  const [visible, setVisible] = useState(false);

  // Track online/offline
  useEffect(() => {
    const goOnline = () => { setOnline(true); setSyncState('syncing'); };
    const goOffline = () => { setOnline(false); setSyncState('offline'); setVisible(true); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Poll pending count
  useEffect(() => {
    const check = () => getPendingCount().then(setPending).catch(() => {});
    check();
    const interval = setInterval(check, 3000);
    const unsub = onSyncStatusChange(() => {
      check();
    });
    return () => { clearInterval(interval); unsub(); };
  }, []);

  // Show banner when there are pending items or offline
  useEffect(() => {
    if (!online || pending > 0) {
      setVisible(true);
    }
  }, [online, pending]);

  // When back online with pending items, auto-sync
  useEffect(() => {
    if (online && pending > 0) {
      setSyncState('syncing');
      syncOfflineData().then(result => {
        setLastResult(result);
        setSyncState(result.failed > 0 ? 'error' : 'synced');
        // Hide after success
        if (result.failed === 0) {
          setTimeout(() => setVisible(false), 4000);
        }
      });
    } else if (online && pending === 0 && syncState === 'syncing') {
      setSyncState('synced');
      setTimeout(() => setVisible(false), 3000);
    }
  }, [online, pending]);

  if (!visible) return null;

  const config: Record<SyncState, { icon: React.ReactNode; text: string; bg: string }> = {
    offline: {
      icon: <WifiOff size={16} />,
      text: `Sem internet${pending > 0 ? ` • ${pending} cadastro${pending > 1 ? 's' : ''} salvo${pending > 1 ? 's' : ''} localmente` : ''}`,
      bg: 'bg-amber-500/90',
    },
    syncing: {
      icon: <Loader2 size={16} className="animate-spin" />,
      text: `Sincronizando ${pending} cadastro${pending > 1 ? 's' : ''}...`,
      bg: 'bg-blue-500/90',
    },
    synced: {
      icon: <CheckCircle2 size={16} />,
      text: lastResult ? `${lastResult.synced} cadastro${lastResult.synced > 1 ? 's' : ''} sincronizado${lastResult.synced > 1 ? 's' : ''}!` : 'Tudo sincronizado!',
      bg: 'bg-emerald-500/90',
    },
    error: {
      icon: <AlertCircle size={16} />,
      text: lastResult ? `${lastResult.synced} enviado${lastResult.synced > 1 ? 's' : ''}, ${lastResult.failed} com erro` : 'Erro na sincronização',
      bg: 'bg-red-500/90',
    },
    online: {
      icon: <Wifi size={16} />,
      text: 'Conectado',
      bg: 'bg-emerald-500/90',
    },
  };

  const { icon, text, bg } = config[syncState];

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] ${bg} text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300`}>
      {icon}
      <span>{text}</span>
      {syncState === 'error' && pending > 0 && (
        <button
          onClick={() => { setSyncState('syncing'); syncOfflineData().then(r => { setLastResult(r); setSyncState(r.failed > 0 ? 'error' : 'synced'); }); }}
          className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs hover:bg-white/30 transition"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
