import { supabase } from '@/integrations/supabase/client';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function cachedInvoke<T>(
  functionName: string,
  params?: object
): Promise<T> {
  const key = `${functionName}-${JSON.stringify(params || {})}`;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < TTL_MS) {
    return cached.data as T;
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: params,
  });
  if (error) throw error;

  cache.set(key, { data, timestamp: Date.now() });
  return data as T;
}

export function invalidateCache(functionName?: string) {
  if (functionName) {
    for (const key of cache.keys()) {
      if (key.startsWith(functionName)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
