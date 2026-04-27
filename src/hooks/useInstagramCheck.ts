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
async function checkViaFavicon(user: string): Promise<boolean | null> {
  // Estratégia: fetch direto à página do Instagram em modo no-cors.
  // - Se a URL existe (200/3xx), o fetch resolve com response opaque (sem erro).
  // - Se 404, o Instagram redireciona internamente mas a request ainda completa,
  //   então não dá para distinguir só pelo fetch. Por isso combinamos com a foto.
  // A combinação confiável: tentar carregar a página E o avatar do Google s2.
  // O Google s2 favicon retorna o favicon do site — se o perfil existe, IG serve
  // sua imagem; se não existe, retorna a página de erro do IG (favicon padrão).
  // Isso não diferencia bem. Então usamos a abordagem: <img> direto pra
  // `https://www.instagram.com/{user}/media/?size=t` que é endpoint legacy
  // de mídia do perfil (ainda funciona e retorna 404 se inválido).
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (result: boolean | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(null), 7000);
    img.referrerPolicy = 'no-referrer';
    img.onload = () => finish(img.naturalWidth > 1);
    img.onerror = () => finish(false);
    // unavatar.io/instagram retorna a foto do perfil quando existe, ou imagem
    // genérica/erro quando não. Com fallback=false → 404 quando não existe.
    // Usamos o subdomínio "cdn" que pula o cache rate-limit.
    img.src = `https://unavatar.io/instagram/${encodeURIComponent(user)}?fallback=false&_=${Date.now()}`;
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