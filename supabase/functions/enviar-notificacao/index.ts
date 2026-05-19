// supabase/functions/enviar-notificacao/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── VAPID helpers ──────────────────────────────────────────────

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - padded.length % 4) % 4;
  const binary = atob(padded + '='.repeat(pad));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8);
  return new Uint8Array(bits);
}

async function buildVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKeyPkcs8: string,
  subject: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  })));
  const signingInput = `${header}.${payload}`;

  const pkcs8Bytes = b64urlDecode(vapidPrivateKeyPkcs8);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Bytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signatureRaw = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${b64urlEncode(signatureRaw)}`;
  return `vapid t=${jwt},k=${vapidPublicKey}`;
}

// ── Web Push Payload Encryption (RFC 8291 + RFC 8188 aes128gcm) ──

async function encryptWebPush(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ body: Uint8Array; contentType: string; contentEncoding: string }> {
  const plaintext = new TextEncoder().encode(payload);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const receiverPubRaw = b64urlDecode(p256dh);
  const authBytes = b64urlDecode(auth);

  const receiverPub = await crypto.subtle.importKey(
    'raw', receiverPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  const senderKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey));

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPub }, senderKeys.privateKey, 256
  );

  // RFC 8291 §3.3: IKM from shared secret + auth
  const keyInfo = concat(
    new TextEncoder().encode('WebPush: info\x00'),
    receiverPubRaw,
    senderPubRaw
  );
  const ikm = await hkdf(authBytes, new Uint8Array(sharedBits), keyInfo, 32);

  // RFC 8188 §2: CEK and nonce from IKM + salt
  const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\x00\x01'), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\x00\x01'), 12);

  // Encrypt: AES-128-GCM with 0x02 end-of-record padding
  const padded = concat(plaintext, new Uint8Array([0x02]));
  const encKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, encKey, padded
  ));

  // aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  const body = concat(salt, rs, new Uint8Array([65]), senderPubRaw, ciphertext);
  return { body, contentType: 'application/octet-stream', contentEncoding: 'aes128gcm' };
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@rede.sarelli.com';

    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const isCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;

    if (!isCron) {
      if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
      if (!caller) return jsonResponse({ error: 'Token inválido' }, 401);

      const { data: callerHier } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('tipo')
        .eq('auth_user_id', caller.id)
        .eq('ativo', true)
        .maybeSingle();

      if (!callerHier || !['super_admin', 'coordenador'].includes(callerHier.tipo)) {
        return jsonResponse({ error: 'Acesso negado' }, 403);
      }
    }

    const body = await req.json();
    const { aviso_id, hierarquia_ids }: { aviso_id?: string; hierarquia_ids?: string[] } = body;

    if (!aviso_id) return jsonResponse({ error: 'aviso_id obrigatório' }, 400);

    // Fetch aviso content to embed in push payload
    const { data: aviso } = await supabaseAdmin
      .from('avisos_app')
      .select('titulo, corpo, tipo')
      .eq('id', aviso_id)
      .single();

    const pushPayload = JSON.stringify({
      titulo: aviso?.titulo || 'Novo aviso',
      corpo: aviso?.corpo || 'Abra o app para ver.',
      aviso_id,
      tipo: aviso?.tipo || 'info',
    });

    let query = supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, hierarquia_id');

    if (hierarquia_ids && hierarquia_ids.length > 0) {
      query = query.in('hierarquia_id', hierarquia_ids);
    }

    const { data: subs, error: subsError } = await query;
    if (subsError) throw subsError;
    if (!subs || subs.length === 0) {
      await supabaseAdmin
        .from('avisos_app')
        .update({ ultima_notificacao_em: new Date().toISOString() })
        .eq('id', aviso_id);
      return jsonResponse({ success: true, enviados: 0, erros: [] });
    }

    let enviados = 0;
    const erros: string[] = [];
    const endpointsParaRemover: string[] = [];

    for (const sub of subs) {
      try {
        const vapidAuth = await buildVapidAuthHeader(sub.endpoint, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT);

        let fetchOpts: RequestInit;

        if (sub.p256dh && sub.auth) {
          // Encrypt payload (RFC 8291)
          const enc = await encryptWebPush(pushPayload, sub.p256dh, sub.auth);
          fetchOpts = {
            method: 'POST',
            headers: {
              'Authorization': vapidAuth,
              'TTL': '86400',
              'Content-Type': enc.contentType,
              'Content-Encoding': enc.contentEncoding,
              'Content-Length': String(enc.body.length),
            },
            body: enc.body,
          };
        } else {
          // Fallback: no encryption (older subscriptions without keys)
          fetchOpts = {
            method: 'POST',
            headers: {
              'Authorization': vapidAuth,
              'TTL': '86400',
              'Content-Length': '0',
            },
          };
        }

        const res = await fetch(sub.endpoint, fetchOpts);

        if (res.status === 201 || res.status === 200) {
          enviados++;
        } else if (res.status === 404 || res.status === 410) {
          endpointsParaRemover.push(sub.endpoint);
        } else {
          const txt = await res.text().catch(() => '');
          erros.push(`${sub.endpoint.slice(-20)}: ${res.status} ${txt.slice(0, 100)}`);
        }
      } catch (err: any) {
        erros.push(`${sub.endpoint.slice(-20)}: ${err.message}`);
      }
    }

    if (endpointsParaRemover.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('endpoint', endpointsParaRemover);
    }

    await supabaseAdmin
      .from('avisos_app')
      .update({ ultima_notificacao_em: new Date().toISOString() })
      .eq('id', aviso_id);

    return jsonResponse({ success: true, enviados, erros });
  } catch (err: any) {
    console.error('enviar-notificacao error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
});
