const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cache = new Map<string, { exists: boolean; ts: number; via: string }>();
const TTL_MS = 60 * 60 * 1000;

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
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  s = s.replace(/^@/, '');
  s = s.replace(/\/+$/g, '');
  s = s.split('/')[0];
  s = s.split('?')[0];
  return s.toLowerCase();
}

function formatoValido(user: string): boolean {
  if (!user || user.length < 1 || user.length > 30) return false;
  if (!/^[a-z0-9._]+$/.test(user)) return false;
  if (user.startsWith('.') || user.endsWith('.')) return false;
  if (user.includes('..')) return false;
  return true;
}

function timedFetch(url: string, opts: RequestInit, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// Extrai conteúdo de meta tag OG independente da ordem dos atributos
function getOgContent(html: string, prop: string): string {
  return (
    html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'))?.[1] ||
    ''
  );
}

/**
 * Interpreta o HTML da página de perfil do Instagram.
 * Retorna:
 *   true  → perfil confirmado como existente
 *   false → confirmado como inexistente
 *   null  → inconclusivo para este método (login wall, sem dados suficientes)
 */
function parseHtml(html: string, user: string): boolean | null {
  // ── Não existe ────────────────────────────────────────────────────────
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
  if (/page\s+not\s+found\s*[•·]\s*instagram/i.test(titleTag)) return false;
  if (/sorry,?\s+this\s+page\s+isn.t\s+available/i.test(html)) return false;
  if (/esta\s+página\s+não\s+está\s+disponível/i.test(html)) return false;
  if (/"pageNotFound"\s*:\s*true/i.test(html)) return false;
  if (/"loginPage"\s*:\s*true/i.test(html)) return null; // login wall — tentar próximo método

  // ── Existe ────────────────────────────────────────────────────────────
  const ogTitle = getOgContent(html, 'og:title');
  const ogDesc  = getOgContent(html, 'og:description');

  // OG title contém @username
  if (new RegExp(`@${user}\\b`, 'i').test(ogTitle + ' ' + ogDesc)) return true;

  // <title> no formato "username | Instagram" ou "username • Instagram"
  if (new RegExp(`^${user}\\s*[|•·]`, 'i').test(titleTag.trim())) return true;

  // OG description com contadores de seguidores
  if (/followers.*following.*posts|seguidores.*seguindo.*publicações/i.test(ogDesc)) return true;

  // JSON-LD com ProfilePage ou Person
  const ldJson = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (ldJson) {
    try {
      const ld = JSON.parse(ldJson);
      const type = (Array.isArray(ld) ? ld[0] : ld)?.['@type'];
      if (type === 'ProfilePage' || type === 'Person') return true;
    } catch { /* html malformado */ }
  }

  // Username no JSON inline (shared_data)
  if (new RegExp(`"username"\\s*:\\s*"${user}"`, 'i').test(html)) return true;

  return null; // sem dados suficientes neste método
}

type DetectResult = { exists: boolean; via: string } | null;

async function tryHttp(label: string, url: string, headers: Record<string, string>, user: string): Promise<DetectResult> {
  try {
    const r = await timedFetch(url, { headers, redirect: 'follow' });
    console.log(`[${label}] status=${r.status} user=${user}`);
    if (r.status === 404) return { exists: false, via: `${label}-404` };
    if (r.ok) {
      const html = await r.text();
      const result = parseHtml(html, user);
      if (result !== null) return { exists: result, via: `${label}-parse` };
    }
  } catch (e) {
    console.error(`[${label}] error`, (e as Error).message);
  }
  return null;
}

async function tryMobileApi(user: string): Promise<DetectResult> {
  try {
    const r = await timedFetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`,
      {
        headers: {
          'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; pt_BR; 458229258)',
          'X-IG-App-ID': '936619743392459',
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR',
        },
        redirect: 'follow',
      },
    );
    console.log(`[mobile] status=${r.status} user=${user}`);
    if (r.status === 404) return { exists: false, via: 'mobile-404' };
    if (r.ok) {
      const j: any = await r.json().catch(() => ({}));
      if (j?.data?.user === null) return { exists: false, via: 'mobile-null' };
      if (j?.data?.user && String(j.data.user.username || '').toLowerCase() === user)
        return { exists: true, via: 'mobile-api' };
    }
  } catch (e) {
    console.error('[mobile] error', (e as Error).message);
  }
  return null;
}

async function checarExistencia(user: string): Promise<DetectResult> {
  const url = `https://www.instagram.com/${encodeURIComponent(user)}/`;

  // Rodada 1: facebookexternalhit + mobile API em paralelo (mais confiáveis)
  const [r1, r2] = await Promise.all([
    tryHttp('fb', url, {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    }, user),
    tryMobileApi(user),
  ]);
  if (r1) return r1;
  if (r2) return r2;

  // Rodada 2: Googlebot + Chrome UA em paralelo (fallback)
  const [r3, r4] = await Promise.all([
    tryHttp('gbot', url, {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    }, user),
    tryHttp('chrome', url, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
    }, user),
  ]);
  if (r3) return r3;
  if (r4) return r4;

  return null;
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
      return new Response(JSON.stringify({ ok: true, exists: cached.exists, usuario: user, via: cached.via, cache: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await checarExistencia(user);
    if (!result) {
      return new Response(JSON.stringify({ ok: true, exists: null, status: 'inconclusivo', usuario: user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    cache.set(user, { exists: result.exists, ts: now, via: result.via });
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
