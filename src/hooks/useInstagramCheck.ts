import { useEffect, useState } from 'react';

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

  useEffect(() => {
    const user = normalize(value);
    if (!user) { setStatus('idle'); return; }
    if (!formatoValido(user)) { setStatus('invalido'); return; }
    // Verificação de existência online desativada: todos os endpoints gratuitos
    // (Graph API, scrapers, proxies CORS, unavatar) estão bloqueados ou exigem
    // login. Validamos apenas o formato do @ — existência fica por conta do
    // usuário, sem falsos negativos visuais.
    setStatus('ok');
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