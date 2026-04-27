import { useEffect, useRef, useState } from 'react';

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
        // Verifica direto do navegador (IP residencial não é bloqueado pelo IG).
        // Usa "no-cors" → não conseguimos ler o status, mas o navegador segue redirects
        // e devolve uma resposta opaque. Para detectar 404, usamos uma <img> com favicon
        // do perfil: existe se carrega, não existe se falha.
        const exists = await checkViaFavicon(user);
        if (myId !== reqIdRef.current) return;
        if (exists === true) setStatus('ok');
        else if (exists === false) setStatus('nao_existe');
        else setStatus('inconclusivo');
      } catch {
        if (myId === reqIdRef.current) setStatus('inconclusivo');
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [value]);

  return status;
}

// Estratégia: o Instagram retorna a página de perfil com 200 OK quando o usuário existe
// e 404 quando não existe. No browser, podemos usar uma <img> apontando para o
// endpoint de imagem do perfil. Como recurso público de imagem, ele é
// servido com CORS aberto e o erro de carga indica usuário inexistente.
function checkViaFavicon(user: string): Promise<boolean | null> {
  // Tenta múltiplos provedores em paralelo. Se QUALQUER um confirmar, vale.
  const providers = [
    `https://www.instagram.com/${encodeURIComponent(user)}/favicon.ico`,
    `https://avatars.io/instagram/${encodeURIComponent(user)}`,
    `https://unavatar.io/instagram/${encodeURIComponent(user)}?fallback=false`,
  ];
  return new Promise((resolve) => {
    let pending = providers.length;
    let confirmedExists = false;
    let anyAnswered = false;
    const timer = window.setTimeout(() => {
      if (!anyAnswered) resolve(null);
      else if (!confirmedExists) resolve(false);
    }, 6000);

    providers.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        anyAnswered = true;
        if (img.naturalWidth > 1) {
          confirmedExists = true;
          window.clearTimeout(timer);
          resolve(true);
        }
        if (--pending === 0 && !confirmedExists) {
          window.clearTimeout(timer);
          resolve(false);
        }
      };
      img.onerror = () => {
        anyAnswered = true;
        if (--pending === 0 && !confirmedExists) {
          window.clearTimeout(timer);
          resolve(false);
        }
      };
      img.src = `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`;
    });
  });
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