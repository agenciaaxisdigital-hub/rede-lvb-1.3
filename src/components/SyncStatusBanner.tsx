import { useState, useEffect } from 'react';
import { WifiOff, Loader2, CheckCircle2, AlertCircle, CloudOff } from 'lucide-react';
import { getPendingCount } from '@/lib/offlineQueue';
import { onSyncStatusChange, syncOfflineData } from '@/services/offlineSync';

type SyncState = 'idle' | 'offline' | 'syncing' | 'synced' | 'error';

export default function SyncStatusBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastResult, setLastResult] = useState<{ synced: number; failed: number } | null>(null);

  useEffect(() => {
    const goOnline = () => { setOnline(true); };
    const goOffline = () => { setOnline(false); setSyncState('offline'); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (!navigator.onLine) setSyncState('offline');
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    const check = () => getPendingCount().then(setPending).catch(() => {});
    check();
    const interval = setInterval(check, 3000);
    const unsub = onSyncStatusChange(check);
    return () => { clearInterval(interval); unsub(); };
  }, []);

  // Auto-sync when back online with pending items
  useEffect(() => {
    if (online && pending > 0 && syncState !== 'syncing') {
      setSyncState('syncing');
      syncOfflineData().then(result => {
        setLastResult(result);
        setSyncState(result.failed > 0 ? 'error' : 'synced');
        if (result.failed === 0) {
          setTimeout(() => setSyncState('idle'), 4000);
        }
      });
    } else if (online && pending === 0 && syncState === 'offline') {
      setSyncState('idle');
    }
  }, [online, pending]);

  // Nothing to show
  if (syncState === 'idle' && pending === 0) return null;

  // Discrete floating pill at bottom-right, above bottom nav
  const pills: Record<Exclude<SyncState, 'idle'>, { icon: React.ReactNode; text: string; cls: string }> = {
    offline: {
      icon: <WifiOff size={14} />,
      text: pending > 0 ? `Offline · ${pending} pendente${pending > 1 ? 's' : ''}` : 'Sem internet',
      cls: 'bg-amber-600 text-white',
    },
    syncing: {
      icon: <Loader2 size={14} className="animate-spin" />,
      text: `Sincronizando${pending > 0 ? ` (${pending})` : ''}...`,
      cls: 'bg-blue-600 text-white',
    },
    synced: {
      icon: <CheckCircle2 size={14} />,
      text: lastResult ? `${lastResult.synced} sincronizado${lastResult.synced > 1 ? 's' : ''}` : 'Sincronizado!',
      cls: 'bg-emerald-600 text-white',
    },
    error: {
      icon: <AlertCircle size={14} />,
      text: lastResult ? `${lastResult.failed} com erro` : 'Erro',
      cls: 'bg-red-600 text-white',
    },
  };

  // If idle but has pending items (shouldn't happen often, but handle gracefully)
  if (syncState === 'idle' && pending > 0) {
    return (
      <div className="fixed bottom-20 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg text-xs font-medium bg-amber-600 text-white animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CloudOff size={14} />
        <span>{pending} pendente{pending > 1 ? 's' : ''}</span>
      </div>
    );
  }

  const { icon, text, cls } = pills[syncState as Exclude<SyncState, 'idle'>];

  return (
    <div
      className={`fixed bottom-20 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg text-xs font-medium ${cls} animate-in fade-in slide-in-from-bottom-2 duration-300`}
      onClick={() => {
        if (syncState === 'error' && pending > 0) {
          setSyncState('syncing');
          syncOfflineData().then(r => {
            setLastResult(r);
            setSyncState(r.failed > 0 ? 'error' : 'synced');
          });
        }
      }}
    >
      {icon}
      <span>{text}</span>
      {syncState === 'error' && (
        <span className="ml-1 opacity-70 text-[10px]">Toque p/ tentar</span>
      )}
    </div>
  );
}
