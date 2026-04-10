// Hook to merge offline queue items into listing data
import { useState, useEffect, useMemo } from 'react';
import { getAllPending, type OfflineRegistration } from '@/lib/offlineQueue';
import { onSyncStatusChange } from '@/services/offlineSync';

export interface OfflineListItem {
  id: string;
  isOffline: true;
  operationId: string;
  nome: string;
  pessoa: Record<string, any>;
  registro: Record<string, any>;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
}

export function useOfflineItems(type: 'lideranca' | 'fiscal' | 'eleitor') {
  const [items, setItems] = useState<OfflineListItem[]>([]);

  useEffect(() => {
    const load = () => {
      getAllPending().then(all => {
        const filtered = all
          .filter(i => i.type === type)
          .map(i => ({
            id: `offline-${i.operationId}`,
            isOffline: true as const,
            operationId: i.operationId,
            nome: i.pessoa?.nome || 'Sem nome',
            pessoa: i.pessoa,
            registro: i.registro,
            createdAt: i.createdAt,
            attempts: i.attempts,
            lastError: i.lastError,
          }));
        setItems(filtered);
      }).catch(() => setItems([]));
    };

    load();
    const interval = setInterval(load, 5000);
    const unsub = onSyncStatusChange(load);
    return () => { clearInterval(interval); unsub(); };
  }, [type]);

  return items;
}
