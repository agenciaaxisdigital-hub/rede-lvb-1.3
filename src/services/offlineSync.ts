// ── Offline Sync Service ─────────────────────────────────────────────────────
// Processes pending offline registrations with idempotency (operationId).
// Uses exponential backoff with proper lastAttemptAt tracking.

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { getAllPending, removeFromQueue, updateAttempts, getPendingCount, type OfflineRegistration } from '@/lib/offlineQueue';
import { requestBackgroundSync } from '@/lib/backgroundSync';

const MAX_ATTEMPTS = 8; // More retries before giving up (was 5)
let syncing = false;
let listeners: Array<() => void> = [];

export function onSyncStatusChange(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

function notifyListeners() {
  listeners.forEach(cb => { try { cb(); } catch {} });
}

export async function syncOfflineData(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    // Verify we actually have a valid session before syncing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[OfflineSync] No active session, deferring sync');
      syncing = false;
      return { synced: 0, failed: 0 };
    }

    const pending = await getAllPending();
    const count = pending.length;
    logger.info('sync_start', { count });
    if (count === 0) { syncing = false; return { synced: 0, failed: 0 }; }

    for (const item of pending) {
      const attempts = item.attempts || 0;

      // Exponential backoff using ACTUAL lastAttemptAt (not createdAt)
      if (attempts > 0 && attempts < MAX_ATTEMPTS && item.lastAttemptAt) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempts), 5 * 60 * 1000); // max 5min
        const timeSinceLastAttempt = Date.now() - new Date(item.lastAttemptAt).getTime();
        if (timeSinceLastAttempt < backoffMs) {
          continue; // Not ready yet — skip silently
        }
      }

      // Skip items that have exceeded max attempts — but DON'T delete them
      if (attempts >= MAX_ATTEMPTS) {
        console.warn(`[OfflineSync] Item ${item.operationId} reached max attempts (${MAX_ATTEMPTS}). Requires manual intervention.`);
        failed++;
        continue;
      }

      try {
        await syncSingleRegistration(item);
        await removeFromQueue(item.id!);
        synced++;
        console.log(`[OfflineSync] ✅ Synced operationId=${item.operationId}`);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        console.error(`[OfflineSync] ❌ Failed operationId=${item.operationId}:`, errorMsg);
        await updateAttempts(item.id!, attempts + 1, errorMsg);
        failed++;
      }
    }

    const remaining = await getPendingCount();
    console.log(`[OfflineSync] Done — synced=${synced}, failed=${failed}, remaining=${remaining}`);
    notifyListeners();
  } catch (err) {
    console.error('[OfflineSync] Sync error:', err);
  } finally {
    syncing = false;
  }

  return { synced, failed };
}

async function syncSingleRegistration(item: OfflineRegistration) {
  // ── Idempotency check: see if this operationId was already processed ──
  const existingCheck = await checkOperationIdExists(item);
  if (existingCheck) {
    console.log(`[OfflineSync] operationId=${item.operationId} already exists in DB, skipping`);
    return; // Already synced — safe to remove from queue
  }

  // Se for do tipo 'fernanda', o registro vai direto para a tabela cadastros_fernanda, sem tabela pessoas.
  if (item.type === 'fernanda') {
    const registroFernanda = {
      ...item.registro,
      observacoes: `[opId:${item.operationId}]`
    };
    const { error } = await (supabase as any).from('cadastros_fernanda').insert(registroFernanda);
    if (error) throw error;
    return;
  }

  let pessoaId: string;

  if (item.pessoaExistenteId) {
    pessoaId = item.pessoaExistenteId;
    const { error } = await supabase.from('pessoas').update({
      ...item.pessoa,
      atualizado_em: new Date().toISOString(),
    }).eq('id', pessoaId);
    if (error) throw error;
  } else {
    // Check if pessoa with same CPF already exists (dedup safety)
    if (item.pessoa.cpf) {
      const { data: existing } = await supabase
        .from('pessoas')
        .select('id')
        .eq('cpf', item.pessoa.cpf)
        .limit(1);
      if (existing && existing.length > 0) {
        pessoaId = existing[0].id;
        console.log(`[OfflineSync] Pessoa with CPF already exists (id=${pessoaId}), reusing`);
      } else {
        const { data, error } = await supabase.from('pessoas').insert(item.pessoa as any).select('id').single();
        if (error) throw error;
        pessoaId = data!.id;
      }
    } else {
      const { data, error } = await supabase.from('pessoas').insert(item.pessoa as any).select('id').single();
      if (error) throw error;
      pessoaId = data!.id;
    }
  }

  // Tag the registro with operationId in observacoes for future dedup
  const registro = {
    ...item.registro,
    pessoa_id: pessoaId,
    observacoes: item.registro.observacoes
      ? `${item.registro.observacoes} [opId:${item.operationId}]`
      : `[opId:${item.operationId}]`,
  };

  if (item.type === 'lideranca') {
    const { error } = await (supabase as any).from('liderancas').insert(registro);
    if (error) throw error;
  } else if (item.type === 'fiscal') {
    const { error } = await (supabase as any).from('fiscais').insert(registro);
    if (error) throw error;
  } else if (item.type === 'eleitor') {
    const { error } = await (supabase as any).from('possiveis_eleitores').insert(registro);
    if (error) throw error;
  }
}

async function checkOperationIdExists(item: OfflineRegistration): Promise<boolean> {
  const table = item.type === 'fernanda' ? 'cadastros_fernanda'
    : item.type === 'lideranca' ? 'liderancas'
    : item.type === 'fiscal' ? 'fiscais'
    : 'possiveis_eleitores';

  try {
    const { data } = await (supabase as any)
      .from(table)
      .select('id')
      .ilike('observacoes', `%[opId:${item.operationId}]%`)
      .limit(1);
    return data && data.length > 0;
  } catch {
    return false; // If check fails, proceed with insert (better than losing data)
  }
}

// Auto-sync setup
let syncInterval: ReturnType<typeof setInterval> | null = null;
let onlineHandler: (() => void) | null = null;

export function startAutoSync() {
  if (syncInterval) return;

  getPendingCount().then(count => {
    console.log(`[OfflineSync] startAutoSync — queue count: ${count}`);
  });

  if (navigator.onLine) {
    syncOfflineData();
  } else {
    requestBackgroundSync();
  }

  if (!onlineHandler) {
    onlineHandler = () => {
      console.log('[OfflineSync] Back online, syncing...');
      // Small delay to let network stabilize
      setTimeout(() => syncOfflineData(), 2000);
    };
    window.addEventListener('online', onlineHandler);
  }

  // Periodic sync every 30 seconds
  syncInterval = setInterval(() => {
    if (navigator.onLine) syncOfflineData();
  }, 30_000);

  requestBackgroundSync();
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
}
