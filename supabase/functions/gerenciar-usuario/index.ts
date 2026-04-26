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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      acao, 
      hierarquia_id, 
      auth_user_id, 
      novo_nome, 
      nova_senha, 
      novo_municipio_id,
      novo_superior_id,
      novo_suplente_id,
      novo_tipo
    } = body;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Não autenticado' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return jsonResponse({ error: 'Token inválido' }, 401);
    }

    // ──────────────────────────────────────────
    // Self password change (any authenticated user)
    // ──────────────────────────────────────────
    if (acao === 'alterar_propria_senha') {
      if (!nova_senha || nova_senha.length < 6) {
        return jsonResponse({ error: 'Senha deve ter ao menos 6 caracteres' }, 400);
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(caller.id, { password: nova_senha });
      if (error) throw error;
      return jsonResponse({ success: true, message: 'Senha alterada com sucesso' });
    }

    // ──────────────────────────────────────────
    // Get login (email) of an auth user — for admins
    // ──────────────────────────────────────────
    if (acao === 'obter_login') {
      if (!auth_user_id) return jsonResponse({ error: 'auth_user_id obrigatório' }, 400);
      const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(auth_user_id);
      if (error) return jsonResponse({ error: error.message }, 400);
      const email = u?.user?.email || '';
      // Strip synthetic suffix used by nomeToEmail (e.g. @rede.local)
      const login = email.includes('@') ? email.split('@')[0] : email;
      return jsonResponse({ success: true, email, login });
    }

    // ──────────────────────────────────────────
    // Admin-only actions below
    // ──────────────────────────────────────────
    const { data: callerHier } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('tipo')
      .eq('auth_user_id', caller.id)
      .eq('ativo', true)
      .maybeSingle();

    if (!callerHier || !['super_admin', 'coordenador'].includes(callerHier.tipo)) {
      return jsonResponse({ error: 'Acesso negado: apenas administradores podem gerenciar usuários' }, 403);
    }

    // ──────────────────────────────────────────
    // ATUALIZAR
    // ──────────────────────────────────────────
    if (acao === 'atualizar') {
      if (!hierarquia_id) {
        return jsonResponse({ error: 'hierarquia_id é obrigatório' }, 400);
      }

      const updates: Record<string, any> = {};
      const trimmedNome = typeof novo_nome === 'string' ? novo_nome.trim() : '';
      const hasValidAuth = typeof auth_user_id === 'string' && auth_user_id.length === 36;

      if (trimmedNome) {
        updates.nome = trimmedNome;
      }
      if (novo_municipio_id) {
        updates.municipio_id = novo_municipio_id;
      }
      if (novo_superior_id !== undefined) {
        updates.superior_id = novo_superior_id;
      }
      if (novo_suplente_id !== undefined) {
        updates.suplente_id = novo_suplente_id;
      }
      if (novo_tipo && ['super_admin','coordenador','suplente','lideranca','fernanda'].includes(novo_tipo)) {
        updates.tipo = novo_tipo;
      }

      let resolvedAuthUserId = hasValidAuth ? auth_user_id : null;

      // If password change requested, ensure we have an auth account
      if (nova_senha) {
        if (nova_senha.length < 6) {
          return jsonResponse({ error: 'Senha deve ter ao menos 6 caracteres' }, 400);
        }

        // Fetch target user from hierarchy
        const { data: targetUser, error: targetUserError } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('id, nome, auth_user_id')
          .eq('id', hierarquia_id)
          .maybeSingle();

        if (targetUserError) throw targetUserError;
        if (!targetUser) {
          return jsonResponse({ error: 'Usuário não encontrado' }, 404);
        }

        // Try to use existing auth_user_id from DB if not provided
        if (!resolvedAuthUserId && targetUser.auth_user_id && targetUser.auth_user_id.length === 36) {
          resolvedAuthUserId = targetUser.auth_user_id;
        }

        if (resolvedAuthUserId) {
          // Simply update password on existing auth account
          const { error } = await supabaseAdmin.auth.admin.updateUserById(resolvedAuthUserId, { password: nova_senha });
          if (error) throw error;
        } else {
          // No auth account exists — create one
          const baseName = (trimmedNome || targetUser.nome || '').trim();
          const slug = baseName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');

          if (!slug) {
            return jsonResponse({ error: 'Nome inválido para criar login do usuário' }, 400);
          }

          const email = `${slug}@rede.sarelli.com`;

          // Check if email already exists in auth
          const { data: authList, error: authListError } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          if (authListError) throw authListError;

          const existingAuthUser = authList.users.find(
            (user) => user.email?.toLowerCase() === email.toLowerCase()
          ) ?? null;

          if (existingAuthUser) {
            resolvedAuthUserId = existingAuthUser.id;
            const { error: relinkError } = await supabaseAdmin.auth.admin.updateUserById(resolvedAuthUserId, {
              password: nova_senha,
              email,
              user_metadata: { name: baseName },
            });
            if (relinkError) throw relinkError;
          } else {
            const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: nova_senha,
              email_confirm: true,
              user_metadata: { name: baseName },
            });
            if (createAuthError) throw createAuthError;
            resolvedAuthUserId = createdAuth.user?.id ?? null;
            if (!resolvedAuthUserId) {
              throw new Error('Conta de autenticação não foi criada corretamente');
            }
          }

          updates.auth_user_id = resolvedAuthUserId;
        }
      }

      // Update auth email/name if nome changed and user has auth account
      if (trimmedNome && resolvedAuthUserId) {
        const newEmail = trimmedNome.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') + '@rede.sarelli.com';
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(resolvedAuthUserId, {
          email: newEmail,
          user_metadata: { name: trimmedNome },
        });
        if (authUpdateError) throw authUpdateError;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabaseAdmin.from('hierarquia_usuarios').update(updates).eq('id', hierarquia_id);
        if (updateErr) throw updateErr;
      }

      return jsonResponse({ success: true, message: 'Usuário atualizado', auth_user_id: resolvedAuthUserId });
    }

    // ──────────────────────────────────────────
    // MOVER CIDADE
    // ──────────────────────────────────────────
    if (acao === 'mover_cidade') {
      if (!hierarquia_id || !novo_municipio_id) {
        return jsonResponse({ error: 'hierarquia_id e novo_municipio_id são obrigatórios' }, 400);
      }

      const { error } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .update({ municipio_id: novo_municipio_id })
        .eq('id', hierarquia_id);

      if (error) throw error;
      return jsonResponse({ success: true, message: 'Cidade do usuário atualizada' });
    }

    // ──────────────────────────────────────────
    // DELETAR
    // ──────────────────────────────────────────
    if (acao === 'deletar') {
      if (!hierarquia_id) {
        return jsonResponse({ error: 'hierarquia_id é obrigatório' }, 400);
      }

      // Deactivate in hierarchy
      const { error: deactivateErr } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .update({ ativo: false })
        .eq('id', hierarquia_id);

      if (deactivateErr) throw deactivateErr;

      // Only delete auth user if valid auth_user_id provided
      const validAuthId = typeof auth_user_id === 'string' && auth_user_id.length === 36;
      if (validAuthId) {
        const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(auth_user_id);
        if (deleteAuthErr) {
          console.error('Erro ao deletar auth user (não-fatal):', deleteAuthErr.message);
        }
      }

      return jsonResponse({ success: true, message: 'Usuário removido' });
    }

    return jsonResponse({ error: 'Ação inválida' }, 400);
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno ao gerenciar usuário';
    return jsonResponse({ error: message }, 500);
  }
});
