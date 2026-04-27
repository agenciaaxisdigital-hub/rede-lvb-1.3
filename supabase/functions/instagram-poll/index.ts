import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuração do piloto
const CONTA_MONITORADA = 'agenciaaxisdigital';
const HASHTAG_ALVO = 'chamaadoutora';

// IG_USER_ID = id numérico da conta business "agenciaaxisdigital" (Instagram Graph API)
// IG_ACCESS_TOKEN = token de longa duração da página vinculada
const IG_USER_ID = Deno.env.get('IG_USER_ID') || '';
const IG_ACCESS_TOKEN = Deno.env.get('IG_ACCESS_TOKEN') || '';
const GRAPH = 'https://graph.facebook.com/v21.0';

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
async function buscarHashtag(): Promise<Mencao[]> {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) return [];
  // 1) resolver hashtag_id
  const search = await fetchJson(
    `${GRAPH}/ig_hashtag_search?user_id=${IG_USER_ID}&q=${encodeURIComponent(HASHTAG_ALVO)}&access_token=${IG_ACCESS_TOKEN}`
  );
  const hashtagId = search?.data?.[0]?.id;
  if (!hashtagId) return [];

  const fields = 'id,caption,media_type,permalink,timestamp,username,media_url';
  // Combina recent_media (últimas 24h) + top_media para capturar tudo
  const [recent, top] = await Promise.all([
    fetchJson(`${GRAPH}/${hashtagId}/recent_media?user_id=${IG_USER_ID}&fields=${fields}&limit=50&access_token=${IG_ACCESS_TOKEN}`).catch(() => ({ data: [] })),
    fetchJson(`${GRAPH}/${hashtagId}/top_media?user_id=${IG_USER_ID}&fields=${fields}&limit=50&access_token=${IG_ACCESS_TOKEN}`).catch(() => ({ data: [] })),
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

/** Mentioned media: posts em que a conta foi marcada (@) */
async function buscarMencoes(): Promise<Mencao[]> {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) return [];
  const fields = 'id,caption,media_type,permalink,timestamp,username';
  // tagged endpoint: media em que @conta foi mencionada/marcada
  const tagged = await fetchJson(
    `${GRAPH}/${IG_USER_ID}/tags?fields=${fields}&access_token=${IG_ACCESS_TOKEN}`
  ).catch(() => ({ data: [] }));
  const items: any[] = tagged?.data || [];
  return items.map((m) => ({
    tipo: 'mention',
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
  };

  try {
    if (!status.config_ok) {
      throw new Error('Faltam secrets IG_USER_ID e/ou IG_ACCESS_TOKEN');
    }
    const [hashtags, mencoes] = await Promise.all([
      buscarHashtag().catch((e) => { console.error('hashtag err', e); return []; }),
      buscarMencoes().catch((e) => { console.error('mention err', e); return []; }),
    ]);
    status.hashtag_encontradas = hashtags.length;
    status.mencoes_encontradas = mencoes.length;
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