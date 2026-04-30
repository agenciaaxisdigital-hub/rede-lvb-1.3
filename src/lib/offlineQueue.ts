// ── Offline Queue using Dexie (IndexedDB) ────────────────────────────────────
// Stores pending registrations when offline and syncs when back online.
// Each item gets a unique operationId (UUID) for idempotency/deduplication.

import Dexie, { type Table } from 'dexie';

export interface OfflineRegistration {
  id?: number;
  operationId: string; // UUID for idempotency
  type: 'lideranca' | 'fiscal' | 'eleitor' | 'fernanda';
  pessoa: Record<string, any>;
  registro: Record<string, any>;
  pessoaExistenteId?: string | null;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
  lastAttemptAt?: string | null; // Track last attempt for proper backoff
}

class OfflineDB extends Dexie {
  pending_registrations!: Table<OfflineRegistration, number>;

  constructor() {
    super('rede-sarelli-offline');
    // Dexie versions must be in ascending order
    this.version(1).stores({
      pending_registrations: '++id',
    });
    this.version(2).stores({
      pending_registrations: '++id, operationId, type, createdAt, attempts',
    });
    this.version(3).stores({
      pending_registrations: '++id, operationId, type, createdAt, attempts',
    }).upgrade(tx => {
      // Add lastAttemptAt to existing records
      return tx.table('pending_registrations').toCollection().modify(item => {
        if (!item.lastAttemptAt) {
          item.lastAttemptAt = null;
        }
      });
    });
  }
}

const db = new OfflineDB();

function generateOperationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function addToOfflineQueue(
  reg: Omit<OfflineRegistration, 'id' | 'operationId' | 'createdAt' | 'attempts' | 'lastError' | 'lastAttemptAt'>
): Promise<string> {
  const operationId = generateOperationId();
  await db.pending_registrations.add({
    ...reg,
    operationId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
  });
  console.log(`[OfflineQueue] Added item operationId=${operationId}, type=${reg.type}`);
  return operationId;
}

export async function getPendingCount(): Promise<number> {
  try {
    return await db.pending_registrations.count();
  } catch {
    return 0;
  }
}

export async function getAllPending(): Promise<OfflineRegistration[]> {
  return db.pending_registrations.orderBy('createdAt').toArray();
}

export async function removeFromQueue(id: number): Promise<void> {
  await db.pending_registrations.delete(id);
}

export async function updateAttempts(id: number, attempts: number, lastError?: string): Promise<void> {
  await db.pending_registrations.update(id, {
    attempts,
    lastError: lastError || null,
    lastAttemptAt: new Date().toISOString(),
  });
}

export async function getByOperationId(operationId: string): Promise<OfflineRegistration | undefined> {
  return db.pending_registrations.where('operationId').equals(operationId).first();
}

export { db as offlineDb };
