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
    const { termo } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar suplentes da tabela suplentes (banco externo compartilhado)
    const { data: suplentes } = await supabaseAdmin
      .from('suplentes')
      .select('id, nome, partido, regiao_atuacao')
      .ilike('nome', `%${termo}%`)
      .order('nome')
      .limit(15);

    // Buscar lideranças da hierarquia_usuarios (usuários locais tipo lideranca)
    const { data: liderancasHierarquia } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo, municipio_id')
      .eq('ativo', true)
      .in('tipo', ['lideranca', 'suplente', 'coordenador'])
      .ilike('nome', `%${termo}%`)
      .order('nome')
      .limit(15);

    // Buscar lideranças cadastradas (tabela liderancas → pessoas)
    const { data: liderancasCadastradas } = await supabaseAdmin
      .from('liderancas')
      .select('id, pessoas(nome, whatsapp), regiao_atuacao')
      .eq('status', 'Ativa')
      .limit(50);

    // Filtrar lideranças cadastradas pelo termo
    const liderancasFiltradas = (liderancasCadastradas || [])
      .filter((l: any) => l.pessoas?.nome?.toLowerCase().includes(termo.toLowerCase()))
      .slice(0, 15)
      .map((l: any) => ({
        id: l.id,
        nome: l.pessoas?.nome || '',
        regiao: l.regiao_atuacao || '',
        fonte: 'lideranca_cadastrada',
      }));

    // Combinar lideranças (hierarquia + cadastradas, sem duplicar)
    const nomesVistos = new Set<string>();
    const liderancasUnificadas: any[] = [];

    for (const l of (liderancasHierarquia || [])) {
      const key = l.nome.toLowerCase();
      if (!nomesVistos.has(key)) {
        nomesVistos.add(key);
        liderancasUnificadas.push({
          id: l.id,
          nome: l.nome,
          regiao: '',
          fonte: 'hierarquia',
        });
      }
    }

    for (const l of liderancasFiltradas) {
      const key = l.nome.toLowerCase();
      if (!nomesVistos.has(key)) {
        nomesVistos.add(key);
        liderancasUnificadas.push(l);
      }
    }

    return new Response(
      JSON.stringify({
        suplentes: (suplentes || []).map(s => ({
          id: s.id,
          nome: s.nome,
          partido: s.partido,
          regiao_atuacao: s.regiao_atuacao,
        })),
        liderancas: liderancasUnificadas,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro buscar-indicadores:', error);
    return new Response(
      JSON.stringify({ suplentes: [], liderancas: [], error: error instanceof Error ? error.message : 'Erro' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
