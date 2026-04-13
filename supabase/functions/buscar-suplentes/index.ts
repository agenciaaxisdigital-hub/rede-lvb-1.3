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
    // 1. Fetch from external database
    let externalData: any[] = [];
    try {
      const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
      const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY');

      if (externalUrl && externalKey) {
        const externalSupabase = createClient(externalUrl, externalKey);
        const { data, error } = await externalSupabase
          .from('suplentes')
          .select('id, nome, regiao_atuacao, telefone, partido, cargo_disputado, base_politica, situacao, expectativa_votos, total_votos')
          .order('nome');

        if (!error && data) {
          externalData = data;
        } else {
          console.error('Erro ao buscar suplentes externos:', error);
        }
      }
    } catch (e) {
      console.error('Erro ao conectar ao banco externo:', e);
    }

    // 2. Fetch from local suplentes table
    let localData: any[] = [];
    try {
      const localUrl = Deno.env.get('SUPABASE_URL')!;
      const localKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const localSupabase = createClient(localUrl, localKey);

      const { data, error } = await localSupabase
        .from('suplentes')
        .select('id, nome, regiao_atuacao, telefone, partido, cargo_disputado, base_politica, situacao, expectativa_votos, total_votos')
        .order('nome');

      if (!error && data) {
        localData = data;
      }
    } catch (e) {
      console.error('Erro ao buscar suplentes locais:', e);
    }

    // 3. Merge: local overrides external by id, then add external-only
    const mergedMap = new Map<string, any>();
    for (const ext of externalData) {
      mergedMap.set(String(ext.id), { ...ext, origem: 'externo' });
    }
    for (const loc of localData) {
      mergedMap.set(String(loc.id), { ...loc, origem: 'local' });
    }

    const merged = Array.from(mergedMap.values()).sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '')
    );

    return new Response(
      JSON.stringify(merged),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
