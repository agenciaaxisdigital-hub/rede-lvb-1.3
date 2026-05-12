-- Isolamento de cadastros_fernanda e cadastros_social:
-- Admin/coord vê tudo; cada usuário vê/edita apenas os próprios (cadastrado_por = seu id).
-- Edge functions usam service_role (bypass RLS) — inserts públicos sempre funcionam.

-- ══════════════════════════════════════════════════════════════════════════
--  cadastros_fernanda
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.cadastros_fernanda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_cadastros_fernanda" ON public.cadastros_fernanda;
DROP POLICY IF EXISTS "authenticated_insert_cadastros_fernanda" ON public.cadastros_fernanda;
DROP POLICY IF EXISTS "authenticated_update_cadastros_fernanda" ON public.cadastros_fernanda;
DROP POLICY IF EXISTS "authenticated_delete_cadastros_fernanda" ON public.cadastros_fernanda;
DROP POLICY IF EXISTS "select_cadastros_fernanda"               ON public.cadastros_fernanda;
DROP POLICY IF EXISTS "insert_cadastros_fernanda"               ON public.cadastros_fernanda;
DROP POLICY IF EXISTS "update_cadastros_fernanda"               ON public.cadastros_fernanda;
DROP POLICY IF EXISTS "delete_cadastros_fernanda"               ON public.cadastros_fernanda;

-- SELECT: admin/coord vê tudo; outros só os próprios
CREATE POLICY "select_cadastros_fernanda"
  ON public.cadastros_fernanda FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR cadastrado_por = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- INSERT: admin/coord qualquer; outros só com cadastrado_por = si mesmo ou nulo
CREATE POLICY "insert_cadastros_fernanda"
  ON public.cadastros_fernanda FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR cadastrado_por IS NULL
    OR cadastrado_por = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- UPDATE: admin/coord qualquer; outros só os próprios
CREATE POLICY "update_cadastros_fernanda"
  ON public.cadastros_fernanda FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR cadastrado_por = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- DELETE: admin/coord qualquer; outros só os próprios
CREATE POLICY "delete_cadastros_fernanda"
  ON public.cadastros_fernanda FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR cadastrado_por = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- ══════════════════════════════════════════════════════════════════════════
--  cadastros_social
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.cadastros_social ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_cadastros_social" ON public.cadastros_social;
DROP POLICY IF EXISTS "authenticated_insert_cadastros_social" ON public.cadastros_social;
DROP POLICY IF EXISTS "authenticated_update_cadastros_social" ON public.cadastros_social;
DROP POLICY IF EXISTS "authenticated_delete_cadastros_social" ON public.cadastros_social;
DROP POLICY IF EXISTS "select_cadastros_social"               ON public.cadastros_social;
DROP POLICY IF EXISTS "insert_cadastros_social"               ON public.cadastros_social;
DROP POLICY IF EXISTS "update_cadastros_social"               ON public.cadastros_social;
DROP POLICY IF EXISTS "delete_cadastros_social"               ON public.cadastros_social;

-- SELECT
CREATE POLICY "select_cadastros_social"
  ON public.cadastros_social FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR cadastrado_por = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- INSERT
CREATE POLICY "insert_cadastros_social"
  ON public.cadastros_social FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR cadastrado_por IS NULL
    OR cadastrado_por = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- UPDATE
CREATE POLICY "update_cadastros_social"
  ON public.cadastros_social FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR cadastrado_por = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );

-- DELETE
CREATE POLICY "delete_cadastros_social"
  ON public.cadastros_social FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
    OR cadastrado_por = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true
      LIMIT 1
    )
  );
