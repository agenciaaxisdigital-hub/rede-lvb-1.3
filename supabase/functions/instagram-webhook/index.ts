import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const VERIFY_TOKEN    = Deno.env.get('IG_WEBHOOK_VERIFY_TOKEN') || 'rede_sarelli_ig_webhook';
const IG_USER_ID      = Deno.env.get('IG_USER_ID') || '';
const IG_ACCESS_TOKEN = (Deno.env.get('IG_ACCESS_TOKEN') || '').trim();
const APP_SECRET      = Deno.env.get('IG_APP_SECRET') || '';
const CONTA_MONITORADA = Deno.env.get('IG_CONTA_ALVO') || 'agenciaaxisdigital';
const GRAPH = 'https://graph.facebook.com/v21.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function assinaturaValida(body: string, signature: string | null): boolean {
  if (!APP_SECRET || !signature) return true;
  const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
  return expected === signature;
}

async function fetchMentionedMedia(mediaId: string): Promise<any | null> {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) return null;
  try {
    const r = await fetch(
      `${GRAPH}/${IG_USER_ID}/mentioned_media?media_id=${mediaId}&fields=id,caption,media_type,permalink,timestamp,username&access_token=${IG_ACCESS_TOKEN}`
    );
    if (!r.ok) { console.error('[webhook] mentioned_media', r.status, await r.text()); return null; }
    return await r.json();
  } catch (e) { console.error('[webhook] fetchMentionedMedia', e); return null; }
}

async function salvarMencao(media: any): Promise<void> {
  if (!media?.id) return;
  const tipo = media.media_type === 'STORY' ? 'story_mention' : 'mention';
  const { error } = await supabase.from('instagram_mencoes').upsert(
    {
      tipo,
      autor_username: media.username || null,
      autor_id: null,
      conta_monitorada: CONTA_MONITORADA,
      hashtag: null,
      texto: media.caption || null,
      permalink: media.permalink || null,
      media_id: media.id,
      media_type: media.media_type || null,
      raw: media,
    },
    { onConflict: 'media_id', ignoreDuplicates: true }
  );
  if (error) console.error('[webhook] upsert error', error);
  else console.log(`[webhook] salvo [${tipo}] @${media.username} media=${media.id}`);
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // GET — verificação do webhook pela Meta
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode      = url.searchParams.get('hub.mode');
    const token     = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      console.log('[webhook] verificado');
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST — evento de menção da Meta
  if (req.method === 'POST') {
    const rawBody = await req.text();
    if (!assinaturaValida(rawBody, req.headers.get('x-hub-signature-256'))) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      const body = JSON.parse(rawBody);
      console.log('[webhook] evento:', JSON.stringify(body).slice(0, 500));
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'mentions') continue;
          const mediaId = change.value?.media_id;
          if (!mediaId) continue;
          console.log('[webhook] menção media_id=' + mediaId);
          const media = await fetchMentionedMedia(mediaId);
          if (media) await salvarMencao(media);
        }
      }
      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (e) {
      console.error('[webhook] error', e);
      return new Response('Error', { status: 500 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
});
