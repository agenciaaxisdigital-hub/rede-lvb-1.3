// Persists form draft to IndexedDB so data isn't lost on refresh/crash
import { useEffect, useRef, useCallback } from 'react';
import { get, set, del } from 'idb-keyval';

const DEBOUNCE_MS = 500;

export function useFormDraft<T extends Record<string, any>>(
  key: string,
  form: T,
  setForm: (val: T) => void,
  emptyForm: T
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Load draft on mount
  useEffect(() => {
    get<T>(`draft:${key}`).then(saved => {
      if (saved && !loadedRef.current) {
        // Only restore if there's actual data (not empty)
        const hasData = Object.entries(saved).some(
          ([k, v]) => v && v !== '' && v !== emptyForm[k]
        );
        if (hasData) {
          setForm(saved);
          console.log(`[FormDraft] Restored draft for ${key}`);
        }
      }
      loadedRef.current = true;
    }).catch(() => { loadedRef.current = true; });
  }, [key]);

  // Auto-save draft on change (debounced)
  useEffect(() => {
    if (!loadedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      set(`draft:${key}`, form).catch(() => {});
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [key, form]);

  const clearDraft = useCallback(() => {
    del(`draft:${key}`).catch(() => {});
  }, [key]);

  return { clearDraft };
}
