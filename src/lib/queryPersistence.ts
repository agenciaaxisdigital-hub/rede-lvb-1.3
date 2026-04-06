// ── React Query Persistence via IndexedDB ────────────────────────────────────
// Persists query cache to IndexedDB for offline reading of critical data.

import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const IDB_KEY = 'rede-sarelli-query-cache';

/**
 * Creates an IndexedDB-based persister for @tanstack/react-query-persist-client.
 * Uses idb-keyval for simplicity and reliability.
 */
export function createIdbPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(IDB_KEY, client);
      } catch (err) {
        console.warn('[QueryPersistence] Failed to persist:', err);
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(IDB_KEY);
      } catch (err) {
        console.warn('[QueryPersistence] Failed to restore:', err);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(IDB_KEY);
      } catch (err) {
        console.warn('[QueryPersistence] Failed to remove:', err);
      }
    },
  };
}
