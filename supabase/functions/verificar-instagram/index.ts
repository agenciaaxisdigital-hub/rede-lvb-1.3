const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache em memória por instância (TTL 1h)
const cache = new Map<string, { exists: boolean; ts: number }>();
const TTL_MS = 60 * 60 * 1000;

// Rate-limit best-effort por IP
const recent = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (recent.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  recent.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

function normalize(input: string): string {
  let s = (input || '').trim();
  // Aceita URL completa
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  s = s.replace(/^@/, '');
  s = s.replace(/\/+$/g, '');
  s = s.split('/')[0];
  s = s.split('?')[0];
  return s.toLowerCase();
}

function formatoValido(user: string): boolean {
  // Regras IG: 1-30 chars, letras/números/underline/ponto, não começa/termina com ponto, sem ponto duplo
  if (!user || user.length < 1 || user.length > 30) return false;
  if (!/^[a-z0-9._]+$/.test(user)) return false;
  if (user.startsWith('.') || user.endsWith('.')) return false;
  if (user.includes('..')) return false;
  return true;
}

async function checarExistencia(user: string): Promise<{ exists: boolean; via: string } | null> {
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  // Método 1: endpoint web_profile_info (JSON oficial usado pelo site, sem login)
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': UA,
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `https://www.instagram.com/${encodeURIComponent(user)}/`,
        },
      },
    );
    if (res.status === 404) return { exists: false, via: 'api-404' };
    if (res.status === 200) {
      const json = await res.json().catch(() => null) as any;
      const u = json?.data?.user;
      if (u && (u.username || u.id)) return { exists: true, via: 'api-json' };
      return { exists: false, via: 'api-empty' };
    }
    // 401/403/429 -> tenta fallback
  } catch (_e) {
    // segue p/ fallback
  }

  // Método 2: HEAD na página pública (mobile UA)
  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(user)}/`, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'manual',
    });
    if (res.status === 404) return { exists: false, via: 'html-404' };
    if (res.status === 200) {
      const html = await res.text();
      if (/Sorry, this page isn'?t available/i.test(html)) return { exists: false, via: 'html-text' };
      if (/A página não está disponível/i.test(html)) return { exists: false, via: 'html-text' };
      if (new RegExp(`"username":"${user}"`, 'i').test(html)) return { exists: true, via: 'html-json' };
      if (new RegExp(`@${user}\\b`, 'i').test(html)) return { exists: true, via: 'html-handle' };
      // 200 sem sinais claros: provavelmente shell de login — inconclusivo
      return null;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

async function checarViaProxy(user: string): Promise<{ exists: boolean; via: string } | null> {
  // Proxy de leitura público (r.jina.ai) — bypassa bloqueio de IP do Instagram
  // Retorna o conteúdo renderizado da página em texto/markdown
  try {
    const res = await fetch(`https://r.jina.ai/https://www.instagram.com/${encodeURIComponent(user)}/`, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
      },
    });
    if (res.status === 404) return { exists: false, via: 'proxy-404' };
    if (!res.ok) return null;
    const txt = (await res.text()).toLowerCase();
    if (!txt || txt.length < 50) return null;
    // Sinais de "não existe"
    if (/sorry, this page isn'?t available/i.test(txt)) return { exists: false, via: 'proxy-text' };
    if (/a página não está disponível/i.test(txt)) return { exists: false, via: 'proxy-text' };
    if (/page not found/i.test(txt) && /instagram/i.test(txt)) return { exists: false, via: 'proxy-text' };
    // Sinais positivos: aparece o handle, "followers", "posts", "seguidores"
    if (txt.includes(`@${user}`)) return { exists: true, via: 'proxy-handle' };
    if (txt.includes(`instagram.com/${user}`)) return { exists: true, via: 'proxy-url' };
    if (/(followers|seguidores|posts|publicações|following|seguindo)/i.test(txt) && txt.includes(user)) {
      return { exists: true, via: 'proxy-meta' };
    }
    return null;
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.usuario === 'string' ? body.usuario : '';
    const user = normalize(raw);

    if (!user) {
      return new Response(JSON.stringify({ ok: false, status: 'vazio' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!formatoValido(user)) {
      return new Response(JSON.stringify({ ok: false, status: 'formato_invalido', usuario: user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    const cached = cache.get(user);
    if (cached && now - cached.ts < TTL_MS) {
      return new Response(JSON.stringify({ ok: true, exists: cached.exists, usuario: user, cache: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result = await checarExistencia(user);
    if (!result) {
      // Fallback via proxy de leitura (bypassa bloqueio de IP)
      result = await checarViaProxy(user);
    }
    if (!result) {
      // Inconclusivo — não bloqueia o cadastro, mas não confirma
      return new Response(JSON.stringify({ ok: true, exists: null, status: 'inconclusivo', usuario: user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    cache.set(user, { exists: result.exists, ts: now });
    return new Response(JSON.stringify({ ok: true, exists: result.exists, usuario: user, via: result.via }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('verificar-instagram error', err);
    return new Response(JSON.stringify({ ok: false, error: 'internal' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});