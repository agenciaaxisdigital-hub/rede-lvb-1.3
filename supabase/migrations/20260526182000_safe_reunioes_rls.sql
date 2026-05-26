-- supabase/migrations/20260526182000_safe_reunioes_rls.sql

-- Drop existing policies on reunioes to prevent any conflicts or old recursive paths
DROP POLICY IF EXISTS "reunioes_select_policy" ON public.reunioes;
DROP POLICY IF EXISTS "reunioes_insert_policy" ON public.reunioes;
DROP POLICY IF EXISTS "reunioes_all_policy" ON public.reunioes;

-- 1. Create a safe, highly-optimized SELECT policy for reunioes
-- - Regular users see only their own meetings.
-- - Admins, Coordinators, and Agenda users bypass the check using JWT metadata for instant, non-recursive access to all meetings.
CREATE POLICY "reunioes_select_policy" ON public.reunioes FOR SELECT TO authenticated
  USING (
    usuario_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'coordenador', 'agenda')
  );

-- 2. Create a safe, highly-optimized INSERT policy for reunioes
-- - Regular users can register their own meetings.
-- - Admins, Coordinators, and Agenda users can register meetings for anyone.
CREATE POLICY "reunioes_insert_policy" ON public.reunioes FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'coordenador', 'agenda')
  );

-- 3. Create a safe, highly-optimized ALL (management) policy for reunioes
-- - Admins, Coordinators, and Agenda users can perform any write action (edit/delete) on all meetings.
CREATE POLICY "reunioes_all_policy" ON public.reunioes FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'coordenador', 'agenda')
  );
