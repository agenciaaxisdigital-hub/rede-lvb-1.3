-- Reforçar isolamento de cadastros_afiliados:
-- Admin/coord vê tudo; afiliado vê só os próprios; demais não veem nada.

DROP POLICY IF EXISTS "authenticated_select_cadastros_afiliados" ON public.cadastros_afiliados;
DROP POLICY IF EXISTS "authenticated_insert_cadastros_afiliados" ON public.cadastros_afiliados;
DROP POLICY IF EXISTS "authenticated_update_cadastros_afiliados" ON public.cadastros_afiliados;
DROP POLICY IF EXISTS "authenticated_delete_cadastros_afiliados" ON public.cadastros_afiliados;

-- SELECT: admin/coord vê tudo; afiliado vê só os seus
CREATE POLICY "select_cadastros_afiliados"
  ON public.cadastros_afiliados FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR afiliado_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- INSERT: edge functions usam service_role (bypass RLS) — usuários autenticados não devem inserir diretamente
CREATE POLICY "insert_cadastros_afiliados"
  ON public.cadastros_afiliados FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR afiliado_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- UPDATE/DELETE: somente admin/coord
CREATE POLICY "update_cadastros_afiliados"
  ON public.cadastros_afiliados FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
  );

CREATE POLICY "delete_cadastros_afiliados"
  ON public.cadastros_afiliados FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
  );
