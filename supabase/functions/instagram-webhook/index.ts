const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN = 'sarelli_webhook_2026';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // Validação inicial da Meta (GET com hub.challenge)
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

  // Recebimento de eventos (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('instagram-webhook event:', JSON.stringify(body));
      return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
    } catch (e) {
      console.error('instagram-webhook error', e);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
});