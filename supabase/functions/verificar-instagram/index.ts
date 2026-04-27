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

async function checarExistencia(user: string): Promise<{ exists: boolean; via: string } | null> {
  // 1) Endpoint web_profile_info — o mais confiável, cobre contas pessoais e business
  try {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
    const home = await fetch('https://www.instagram.com/', {
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });
    const cookie = home.headers.get('set-cookie') || '';
    const csrf = cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
    const wres = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`,
      {
        headers: {
          'User-Agent': userAgent,
          'Accept': '*/*',
          'X-IG-App-ID': '936619743392459',
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookie,
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Sec-Fetch-Site': 'same-origin',
          'Referer': `https://www.instagram.com/${encodeURIComponent(user)}/`,
        },
      },
    );
    console.log('web_profile_info status', user, wres.status);
    if (wres.status === 404) return { exists: false, via: 'web-profile-404' };
    if (wres.ok) {
      const json: any = await wres.json().catch(() => ({}));
      const u = json?.data?.user;
      if (u && String(u.username || '').toLowerCase() === user) {
        return { exists: true, via: 'web-profile' };
      }
      if (json && json.data && json.data.user === null) {
        return { exists: false, via: 'web-profile-null' };
      }
    }
    // Outros status (401/429/403) → cai no fallback
  } catch (e) {
    console.error('web_profile_info error', e);
  }

  // 2) Tenta a Graph API oficial da Meta (Instagram Business Discovery)
  const token = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');
  const igUserId = Deno.env.get('INSTAGRAM_BUSINESS_ID') || '17841478297498593';
  if (token) {
    try {
      const url = `https://graph.facebook.com/v21.0/${igUserId}?fields=business_discovery.username(${encodeURIComponent(user)}){username}&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      const json: any = await res.json().catch(() => ({}));
      console.log('graph-api response', user, res.status, JSON.stringify(json));
      if (res.ok && json?.business_discovery?.username) {
        return { exists: true, via: 'graph-api' };
      }
      // Códigos típicos quando o usuário NÃO existe (não é conta business pública)
      const code = json?.error?.code;
      const sub = json?.error?.error_subcode;
      const msg = String(json?.error?.message || '');
      // Mensagens típicas: "Unsupported get request" / "does not exist" / código 100 subcode 33
      if (
        sub === 2207013 ||
        sub === 33 ||
        code === 110 ||
        (code === 100 && /does not exist|cannot be loaded|business account/i.test(msg)) ||
        /does not exist|not found|cannot be found/i.test(msg)
      ) {
        return { exists: false, via: 'graph-api' };
      }
      // Outros erros (rate limit, token inválido, permissão) → cai no fallback
    } catch (e) {
      console.error('graph-api fetch error', e);
    }
  }

  // 3) Fallback público: página web normal. O endpoint JSON do Instagram
  // costuma retornar 401/429 sem sessão; a página HTML ainda diferencia
  // perfil real (og:url/og:title/@usuario/profilePage_ID) de perfil inexistente.
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
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
      const ogUrl = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
      const handlePattern = new RegExp(`@${user}\\b`, 'i');

      if (
        handlePattern.test(ogTitle) ||
        handlePattern.test(ogDesc) ||
        new RegExp(`instagram\\.com/${user}/?$`, 'i').test(ogUrl) ||
        /profilePage_\d+/.test(html)
      ) {
        return { exists: true, via: 'html-profile' };
      }
      if (/Followers,.*Following,.*Posts/i.test(ogDesc) || /Seguidores.*Seguindo.*Publica/i.test(ogDesc)) {
        return { exists: true, via: 'html-counts' };
      }
      if (!ogTitle && !ogDesc && !ogUrl && !/profilePage_\d+/.test(html)) {
        return { exists: false, via: 'html-no-profile' };
      }
      if (ogTitle && /^Instagram$/i.test(ogTitle.trim()) && !ogDesc) {
        return { exists: false, via: 'html-generic' };
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
    // Segurança contra falsos positivos: só aceita confirmação positiva quando
    // vier de endpoint de perfil/Graph API com username exato. Scraping genérico
    // nunca deve aprovar qualquer coisa.
    if (result.exists && !['web-profile', 'graph-api', 'html-profile'].includes(result.via)) {
      return new Response(JSON.stringify({ ok: true, exists: null, status: 'inconclusivo', usuario: user, via: result.via }), {
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
