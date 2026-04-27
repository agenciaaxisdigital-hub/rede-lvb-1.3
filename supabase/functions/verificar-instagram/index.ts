const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cache = new Map<string, { exists: boolean; ts: number }>();
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

async function checarExistencia(user: string): Promise<{ exists: boolean; via: string } | null> {
  // O Instagram serve a tela de login pra qualquer browser, mas devolve metadados
  // Open Graph reais quando o User-Agent é de um bot de link preview
  // (WhatsApp / Facebook / Twitter). Perfis válidos têm og:title com nome e
  // og:description com followers. Inexistentes não têm.
  const userAgents = [
    'WhatsApp/2.24.20.0',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
  ];

  for (const ua of userAgents) {
    try {
      const res = await fetch(`https://www.instagram.com/${encodeURIComponent(user)}/`, {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        redirect: 'manual',
      });
      if (res.status === 404) return { exists: false, via: 'bot-404' };
      if (res.status !== 200) {
        try { await res.text(); } catch (_) { /* noop */ }
        continue;
      }
      const html = await res.text();
      if (/Sorry, this page isn'?t available/i.test(html)) return { exists: false, via: 'bot-text' };
      if (/A página não está disponível/i.test(html)) return { exists: false, via: 'bot-text' };

      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
      const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
      const handlePattern = new RegExp(`@${user}\\b`, 'i');

      if (handlePattern.test(ogTitle) || handlePattern.test(ogDesc)) {
        return { exists: true, via: 'og-handle' };
      }
      if (/Followers,.*Following,.*Posts/i.test(ogDesc) || /Seguidores.*Seguindo.*Publica/i.test(ogDesc)) {
        return { exists: true, via: 'og-counts' };
      }
      if (ogTitle && /^Instagram$/i.test(ogTitle.trim()) && !ogDesc) {
        return { exists: false, via: 'og-generic' };
      }
      // sem og útil — tenta próximo UA
    } catch (_e) {
      // próximo UA
    }
  }
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
      return new Response(JSON.stringify({ ok: true, exists: cached.exists, usuario: user, cache: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await checarExistencia(user);
    if (!result) {
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
