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
  // Tenta endpoint público (sem login) — mais leve que HTML
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  };
  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(user)}/`, {
      method: 'GET',
      headers,
      redirect: 'manual',
    });
    // 200 = existe; 404 = não existe; 301/302 para /accounts/login = bloqueio (inconclusivo)
    if (res.status === 404) return { exists: false, via: 'html-404' };
    if (res.status === 200) {
      const html = await res.text();
      // Checagens negativas no HTML
      if (/Sorry, this page isn'?t available/i.test(html)) return { exists: false, via: 'html-text' };
      if (/A página não está disponível/i.test(html)) return { exists: false, via: 'html-text' };
      // Sinais positivos
      if (new RegExp(`"username":"${user}"`, 'i').test(html)) return { exists: true, via: 'html-json' };
      if (new RegExp(`@${user}`, 'i').test(html)) return { exists: true, via: 'html-handle' };
      // 200 sem sinais claros — assumir existe (a Meta serve uma shell)
      return { exists: true, via: 'html-200' };
    }
    // Demais status: inconclusivo
    return null;
  } catch (_err) {
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

    const result = await checarExistencia(user);
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