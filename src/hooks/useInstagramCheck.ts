import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type InstagramStatus = 'idle' | 'checking' | 'ok' | 'invalido' | 'nao_existe' | 'inconclusivo';

function normalize(s: string) {
  return (s || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/g, '')
    .split('/')[0]
    .split('?')[0]
    .toLowerCase();
}

function formatoValido(u: string) {
  if (!u || u.length < 1 || u.length > 30) return false;
  if (!/^[a-z0-9._]+$/.test(u)) return false;
  if (u.startsWith('.') || u.endsWith('.')) return false;
  if (u.includes('..')) return false;
  return true;
}

export function useInstagramCheck(value: string): InstagramStatus {
  const [status, setStatus] = useState<InstagramStatus>('idle');
  const reqIdRef = useRef(0);

  useEffect(() => {
    const user = normalize(value);
    if (!user) { setStatus('idle'); return; }
    if (!formatoValido(user)) { setStatus('invalido'); return; }
    setStatus('checking');
    const myId = ++reqIdRef.current;
    const t = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verificar-instagram', {
          body: { usuario: user },
        });
        if (myId !== reqIdRef.current) return;
        if (error) { setStatus('inconclusivo'); return; }
        if (data?.status === 'formato_invalido') { setStatus('invalido'); return; }
        if (data?.exists === true) setStatus('ok');
        else if (data?.exists === false) setStatus('nao_existe');
        else setStatus('inconclusivo');
      } catch {
        if (myId === reqIdRef.current) setStatus('inconclusivo');
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [value]);

  return status;
}

export type TelefoneStatus = 'idle' | 'ok' | 'invalido';
export function checkTelefone(raw: string): TelefoneStatus {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 0) return 'idle';
  if (d.length < 10 || d.length > 11) return 'invalido';
  const ddd = parseInt(d.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return 'invalido';
  if (d.length === 11 && d[2] !== '9') return 'invalido';
  if (d.length === 10 && !/[2-5]/.test(d[2])) return 'invalido';
  return 'ok';
}