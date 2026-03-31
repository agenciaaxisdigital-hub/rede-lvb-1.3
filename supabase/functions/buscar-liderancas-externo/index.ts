import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY');

    if (!externalUrl || !externalKey) {
      return new Response(
        JSON.stringify({ error: 'Credenciais do banco externo não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const externalSupabase = createClient(externalUrl, externalKey);

    // Fetch liderancas and pessoas separately (no FK relationship in external DB)
    const [lidRes, pesRes] = await Promise.all([
      externalSupabase
        .from('liderancas')
        .select('id, pessoa_id, status, tipo_lideranca, regiao_atuacao, suplente_id')
        .order('criado_em', { ascending: false }),
      externalSupabase
        .from('pessoas')
        .select('id, nome, telefone, whatsapp'),
    ]);

    if (lidRes.error) {
      console.error('Erro ao buscar lideranças:', lidRes.error);
      return new Response(
        JSON.stringify({ error: lidRes.error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build a map of pessoas by id
    const pessoasMap = new Map<string, { id: string; nome: string; telefone: string | null; whatsapp: string | null }>();
    if (pesRes.data) {
      for (const p of pesRes.data) {
        pessoasMap.set(p.id, p);
      }
    }

    // Join in code
    const result = (lidRes.data || []).map((l: any) => ({
      ...l,
      pessoas: pessoasMap.get(l.pessoa_id) || null,
    }));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
