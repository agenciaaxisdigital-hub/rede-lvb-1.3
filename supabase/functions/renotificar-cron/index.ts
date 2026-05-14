// supabase/functions/renotificar-cron/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const CRON_SECRET = Deno.env.get('CRON_SECRET')!;

  const { data: avisos, error } = await supabaseAdmin
    .from('avisos_app')
    .select('id, intervalo_minutos, ultima_notificacao_em')
    .eq('ativa', true)
    .not('intervalo_minutos', 'is', null);

  if (error) {
    console.error('renotificar-cron: erro ao buscar avisos', error);
    return new Response('error', { status: 500 });
  }

  const agora = new Date();
  let processados = 0;

  for (const aviso of avisos ?? []) {
    const ultima = aviso.ultima_notificacao_em ? new Date(aviso.ultima_notificacao_em) : null;
    const minutosDecorridos = ultima
      ? (agora.getTime() - ultima.getTime()) / 60000
      : Infinity;

    if (minutosDecorridos >= aviso.intervalo_minutos) {
      const { data: dests } = await supabaseAdmin
        .from('avisos_destinatarios')
        .select('hierarquia_id, tipo_usuario')
        .eq('aviso_id', aviso.id);

      let hierarquiaIds: string[] | undefined;

      if (dests && dests.length > 0) {
        const tipos = dests.filter((d: any) => d.tipo_usuario).map((d: any) => d.tipo_usuario);
        const individuais = dests.filter((d: any) => d.hierarquia_id).map((d: any) => d.hierarquia_id);

        let ids: string[] = [...individuais];
        if (tipos.length > 0) {
          const { data: porTipo } = await supabaseAdmin
            .from('hierarquia_usuarios')
            .select('id')
            .in('tipo', tipos)
            .eq('ativo', true);
          ids = [...ids, ...(porTipo ?? []).map((u: any) => u.id)];
        }
        hierarquiaIds = [...new Set(ids)];
      }

      await fetch(`${SUPABASE_URL}/functions/v1/enviar-notificacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': CRON_SECRET,
        },
        body: JSON.stringify({ aviso_id: aviso.id, hierarquia_ids: hierarquiaIds }),
      });

      processados++;
    }
  }

  return new Response(JSON.stringify({ processados }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
