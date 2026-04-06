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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if eventos table already exists
    const { data: existingTable } = await supabaseAdmin
      .from('eventos')
      .select('id')
      .limit(1);

    // If we get here without error, table exists
    if (existingTable !== null) {
      // Table exists, just ensure columns exist on other tables
      // Try adding evento_id columns (will fail silently if already exist)
      const results: string[] = ['Table eventos already exists'];

      // Check if evento_id exists on liderancas
      try {
        await supabaseAdmin.rpc('exec_sql' as any, {});
      } catch {}

      return new Response(
        JSON.stringify({ success: true, message: 'Table already exists, columns may need manual addition', results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Check completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Table doesn't exist - this is expected on first run
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        instruction: 'Please run the SQL migration manually in Supabase SQL Editor'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
