import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN = 'sarelli_webhook_2026';

// Conta e hashtag monitoradas (piloto Agência Axxis)
const CONTA_MONITORADA = 'agenciaaxisdigital';
const HASHTAG_ALVO = 'chamaadoutora';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase() : '';
}

function extrairMencoes(body: any): any[] {
  const out: any[] = [];
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const ch of changes) {
      const field = lower(ch?.field);
      const v = ch?.value || {};
      const texto: string = v?.text || v?.caption || v?.message || '';
      const textoLow = lower(texto);
      const mencionaConta = textoLow.includes('@' + CONTA_MONITORADA);
      const usaHashtag = textoLow.includes('#' + HASHTAG_ALVO);

      let tipo: string | null = null;
      if (field === 'mentions' || field === 'mention') tipo = 'mention';
      else if (field === 'story_insights' || field === 'story_mentions') tipo = 'story_mention';
      else if (field === 'comments') tipo = 'comment';
      else if (usaHashtag) tipo = 'hashtag';
      else if (mencionaConta) tipo = 'mention';

      if (!tipo && !mencionaConta && !usaHashtag) continue;

      out.push({
        tipo: tipo || 'outro',
        autor_username: v?.from?.username || v?.username || null,
        autor_id: v?.from?.id || null,
        conta_monitorada: CONTA_MONITORADA,
        hashtag: usaHashtag ? HASHTAG_ALVO : null,
        texto: texto || null,
        permalink: v?.permalink || v?.media?.permalink || null,
        media_id: v?.media_id || v?.media?.id || null,
        media_type: v?.media?.media_product_type || v?.media_type || null,
        raw: { entry, change: ch },
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('instagram-webhook event:', JSON.stringify(body));
      const mencoes = extrairMencoes(body);
      if (mencoes.length > 0) {
        const { error } = await supabase.from('instagram_mencoes').insert(mencoes);
        if (error) console.error('insert mencoes error', error);
        else console.log(`mencoes inseridas: ${mencoes.length}`);
      }
      return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
    } catch (e) {
      console.error('instagram-webhook error', e);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
});