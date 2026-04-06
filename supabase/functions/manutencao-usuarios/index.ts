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

    // Verify caller is super_admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: callerH } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('tipo')
      .eq('auth_user_id', caller.id)
      .eq('ativo', true)
      .maybeSingle();
    if (!callerH || !['super_admin', 'coordenador'].includes(callerH.tipo)) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const acao = body.acao;

    // ── RESETAR SENHAS ──
    if (acao === 'resetar_senhas') {
      const novaSenha = body.nova_senha || '123456';
      const excluirNomes = (body.excluir_nomes || []).map((n: string) => n.trim().toLowerCase());

      const { data: usuarios } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, nome, auth_user_id')
        .eq('ativo', true)
        .not('auth_user_id', 'is', null);

      const resultados: any[] = [];
      let atualizados = 0;
      let pulados = 0;

      for (const u of (usuarios || [])) {
        const nomeLower = u.nome.trim().toLowerCase();
        if (excluirNomes.some((ex: string) => nomeLower.includes(ex))) {
          resultados.push({ nome: u.nome, status: 'pulado', motivo: 'Na lista de exclusão' });
          pulados++;
          continue;
        }
        if (!u.auth_user_id) continue;

        try {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(u.auth_user_id, {
            password: novaSenha,
          });
          if (error) {
            resultados.push({ nome: u.nome, status: 'erro', motivo: error.message });
          } else {
            resultados.push({ nome: u.nome, status: 'atualizado' });
            atualizados++;
          }
        } catch (e) {
          resultados.push({ nome: u.nome, status: 'erro', motivo: String(e) });
        }
      }

      return new Response(JSON.stringify({
        resumo: { atualizados, pulados, total: (usuarios || []).length },
        detalhes: resultados,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── APAGAR USUARIOS TESTE ──
    if (acao === 'apagar_teste') {
      const pattern = body.pattern || 'teste';

      const { data: usuarios } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, nome, auth_user_id')
        .ilike('nome', `%${pattern}%`);

      const resultados: any[] = [];
      let apagados = 0;

      for (const u of (usuarios || [])) {
        // Delete auth user if exists
        if (u.auth_user_id) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(u.auth_user_id);
          } catch (e) {
            console.error('Erro deletar auth:', e);
          }
        }
        // Deactivate/delete from hierarquia
        await supabaseAdmin.from('hierarquia_usuarios')
          .update({ ativo: false })
          .eq('id', u.id);

        resultados.push({ nome: u.nome, status: 'removido' });
        apagados++;
      }

      return new Response(JSON.stringify({
        resumo: { apagados, total: (usuarios || []).length },
        detalhes: resultados,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── LISTAR TODOS ──
    if (acao === 'listar') {
      const { data: usuarios } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, auth_user_id, ativo')
        .order('nome');

      return new Response(JSON.stringify({ usuarios }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida. Use: resetar_senhas, apagar_teste, listar' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
