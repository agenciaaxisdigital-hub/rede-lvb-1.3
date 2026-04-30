import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONTA_MONITORADA = Deno.env.get('IG_CONTA_ALVO') || 'agenciaaxisdigital';
const HASHTAG_ALVO = Deno.env.get('IG_HASHTAG_ALVO') || 'chamaadoutora';
const IG_USER_ID = Deno.env.get('IG_USER_ID') || '';
const IG_ACCESS_TOKEN = (Deno.env.get('IG_ACCESS_TOKEN') || Deno.env.get('INSTAGRAM_ACCESS_TOKEN') || '').trim();
const IG_APP_ID = Deno.env.get('IG_APP_ID') || '';
const IG_APP_SECRET = Deno.env.get('IG_APP_SECRET') || '';
const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * Verifica se o token expira em menos de 10 dias e renova automaticamente.
 * Salva o novo token nos secrets do Supabase via Management API.
 */
async function renovarTokenSeNecessario(): Promise<string> {
  if (!IG_APP_ID || !IG_APP_SECRET || !IG_ACCESS_TOKEN) return IG_ACCESS_TOKEN;
  try {
    const debugRes = await fetch(
      `${GRAPH}/debug_token?input_token=${IG_ACCESS_TOKEN}&access_token=${IG_ACCESS_TOKEN}`
    );
    const debug = await debugRes.json();
    const expiresAt: number = debug?.data?.expires_at ?? 0;
    if (!expiresAt) return IG_ACCESS_TOKEN;

    const diasRestantes = (expiresAt - Date.now() / 1000) / 86400;
    console.log(`[token] expira em ${Math.round(diasRestantes)} dias`);

    if (diasRestantes > 10) return IG_ACCESS_TOKEN;

    // Renova para 60 dias
    const refreshRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${IG_APP_ID}&client_secret=${IG_APP_SECRET}&fb_exchange_token=${IG_ACCESS_TOKEN}`
    );
    const refreshData = await refreshRes.json();
    if (!refreshData.access_token) {
      console.error('[token] falha ao renovar:', refreshData);
      return IG_ACCESS_TOKEN;
    }

    // Atualiza o secret no Supabase
    const supabaseRef = Deno.env.get('SUPABASE_URL')?.match(/https:\/\/([^.]+)/)?.[1];
    if (supabaseRef) {
      await fetch(`https://api.supabase.com/v1/projects/${supabaseRef}/secrets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify([{ name: 'IG_ACCESS_TOKEN', value: refreshData.access_token }]),
      });
    }
    console.log('[token] renovado com sucesso, expira em ~60 dias');
    return refreshData.access_token;
  } catch (e) {
    console.error('[token] erro ao verificar/renovar:', e);
    return IG_ACCESS_TOKEN;
  }
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type Mencao = {
  tipo: string;
  autor_username: string | null;
  autor_id: string | null;
  conta_monitorada: string;
  hashtag: string | null;
  texto: string | null;
  permalink: string | null;
  media_id: string | null;
  media_type: string | null;
  raw: any;
};

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Graph API ${r.status}: ${t}`);
  }
  return await r.json();
}

/** Hashtag search: encontra posts recentes com a hashtag */
async function buscarHashtag(token: string): Promise<Mencao[]> {
  if (!IG_USER_ID || !token) return [];
  const search = await fetchJson(
    `${GRAPH}/ig_hashtag_search?user_id=${IG_USER_ID}&q=${encodeURIComponent(HASHTAG_ALVO)}&access_token=${token}`
  );
  const hashtagId = search?.data?.[0]?.id;
  if (!hashtagId) return [];

  const fields = 'id,caption,media_type,permalink,timestamp,username,media_url';
  const [recent, top] = await Promise.all([
    fetchJson(`${GRAPH}/${hashtagId}/recent_media?user_id=${IG_USER_ID}&fields=${fields}&limit=50&access_token=${token}`).catch(() => ({ data: [] })),
    fetchJson(`${GRAPH}/${hashtagId}/top_media?user_id=${IG_USER_ID}&fields=${fields}&limit=50&access_token=${token}`).catch(() => ({ data: [] })),
  ]);
  const seen = new Set<string>();
  const items: any[] = [];
  for (const m of [...(recent?.data || []), ...(top?.data || [])]) {
    if (m?.id && !seen.has(m.id)) { seen.add(m.id); items.push(m); }
  }
  return items.map((m) => ({
    tipo: 'hashtag',
    autor_username: m.username || null,
    autor_id: null,
    conta_monitorada: CONTA_MONITORADA,
    hashtag: HASHTAG_ALVO,
    texto: m.caption || null,
    permalink: m.permalink || null,
    media_id: m.id || null,
    media_type: m.media_type || null,
    raw: m,
  }));
}

/** /tags — posts onde a conta foi fisicamente marcada na foto/vídeo */
async function buscarMencoes(token: string): Promise<Mencao[]> {
  if (!IG_USER_ID || !token) return [];
  const fields = 'id,caption,media_type,permalink,timestamp,username';
  const tagged = await fetchJson(
    `${GRAPH}/${IG_USER_ID}/tags?fields=${fields}&access_token=${token}`
  ).catch(() => ({ data: [] }));
  const items: any[] = tagged?.data || [];
  return items.map((m) => ({
    tipo: m.media_type === 'STORY' ? 'story_mention' : 'mention',
    autor_username: m.username || null,
    autor_id: null,
    conta_monitorada: CONTA_MONITORADA,
    hashtag: null,
    texto: m.caption || null,
    permalink: m.permalink || null,
    media_id: m.id || null,
    media_type: m.media_type || null,
    raw: m,
  }));
}

/** /mentions — posts e stories que mencionaram @conta no texto/caption */
async function buscarMencoesCaption(token: string): Promise<Mencao[]> {
  if (!IG_USER_ID || !token) return [];
  const mentions = await fetchJson(
    `${GRAPH}/${IG_USER_ID}/mentions?fields=id,timestamp&limit=50&access_token=${token}`
  ).catch(() => ({ data: [] }));

  const items: any[] = mentions?.data || [];
  if (items.length === 0) return [];

  const results = await Promise.all(
    items.map(async (m): Promise<Mencao | null> => {
      try {
        const media = await fetchJson(
          `${GRAPH}/${IG_USER_ID}/mentioned_media?media_id=${m.id}&fields=id,caption,media_type,permalink,timestamp,username&access_token=${token}`
        );
        return {
          tipo: media.media_type === 'STORY' ? 'story_mention' : 'mention',
          autor_username: media.username || null,
          autor_id: null,
          conta_monitorada: CONTA_MONITORADA,
          hashtag: null,
          texto: media.caption || null,
          permalink: media.permalink || null,
          media_id: media.id || m.id,
          media_type: media.media_type || null,
          raw: { ...media, mention_timestamp: m.timestamp },
        };
      } catch (e) {
        console.error('[mentions/caption] media_id=' + m.id, (e as Error).message);
        return null;
      }
    })
  );
  return results.filter(Boolean) as Mencao[];
}

async function inserirSemDuplicar(mencoes: Mencao[]): Promise<number> {
  if (mencoes.length === 0) return 0;
  const mediaIds = mencoes.map((m) => m.media_id).filter(Boolean) as string[];
  let existentes = new Set<string>();
  if (mediaIds.length > 0) {
    const { data } = await supabase
      .from('instagram_mencoes')
      .select('media_id')
      .in('media_id', mediaIds);
    existentes = new Set((data || []).map((r: any) => r.media_id).filter(Boolean));
  }
  const novas = mencoes.filter((m) => !m.media_id || !existentes.has(m.media_id));
  if (novas.length === 0) return 0;
  const { error } = await supabase.from('instagram_mencoes').insert(novas);
  if (error) {
    console.error('insert error', error);
    return 0;
  }
  return novas.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const inicio = Date.now();
  const status = {
    ok: true,
    hashtag_encontradas: 0,
    mencoes_encontradas: 0,
    novas_inseridas: 0,
    duracao_ms: 0,
    erro: null as string | null,
    config_ok: !!(IG_USER_ID && IG_ACCESS_TOKEN),
    debug: {} as Record<string, any>,
  };

  try {
    if (!status.config_ok) {
      throw new Error('Faltam secrets IG_USER_ID e/ou IG_ACCESS_TOKEN');
    }

    // Renova token automaticamente se faltar menos de 10 dias
    const tokenAtivo = await renovarTokenSeNecessario();

    // Debug: testa hashtag_search isolado
    try {
      const search = await fetchJson(
        `${GRAPH}/ig_hashtag_search?user_id=${IG_USER_ID}&q=${encodeURIComponent(HASHTAG_ALVO)}&access_token=${tokenAtivo}`
      );
      status.debug.hashtag_id = search?.data?.[0]?.id || null;
      status.debug.hashtag_search_raw = search;
    } catch (e: any) {
      status.debug.hashtag_search_error = e?.message;
    }
    const [hashtags, mencoesTag, mencoesCaption] = await Promise.all([
      buscarHashtag(tokenAtivo).catch((e) => { console.error('hashtag err', e); status.debug.hashtag_error = e?.message; return []; }),
      buscarMencoes(tokenAtivo).catch((e) => { console.error('tag err', e); status.debug.tag_error = e?.message; return []; }),
      buscarMencoesCaption(tokenAtivo).catch((e) => { console.error('caption err', e); status.debug.caption_error = e?.message; return []; }),
    ]);
    const mencoes = [...mencoesTag, ...mencoesCaption];
    status.hashtag_encontradas = hashtags.length;
    status.mencoes_encontradas = mencoes.length;
    status.debug.stories = mencoes.filter(m => m.tipo === 'story_mention').length;
    status.debug.feed_mentions = mencoes.filter(m => m.tipo === 'mention').length;
    status.novas_inseridas = await inserirSemDuplicar([...hashtags, ...mencoes]);
  } catch (e: any) {
    status.ok = false;
    status.erro = e?.message || String(e);
    console.error('instagram-poll fail', e);
  } finally {
    status.duracao_ms = Date.now() - inicio;
  }

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});