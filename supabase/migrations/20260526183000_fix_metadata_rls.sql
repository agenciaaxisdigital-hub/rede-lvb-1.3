-- supabase/migrations/20260526183000_fix_metadata_rls.sql

-- 1. Create a secure, non-recursive helper function to get the user's role.
-- Since this function is defined as SECURITY DEFINER and executes with the privileges of the database owner (postgres),
-- it completely bypasses RLS checks on hierarquia_usuarios internally.
-- This prevents any infinite recursion while allowing us to query the role of the user reliably.
CREATE OR REPLACE FUNCTION public.get_auth_user_role(p_auth_user_id uuid)
RETURNS text
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
BEGIN
  -- Search for the user's role inside the hierarquia_usuarios table
  SELECT tipo INTO v_role
  FROM public.hierarquia_usuarios
  WHERE auth_user_id = p_auth_user_id AND ativo = true
  LIMIT 1;
  
  RETURN v_role;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_auth_user_role(uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Drop and recreate policies for public.hierarquia_usuarios
-- ══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "authenticated_select_hierarquia" ON public.hierarquia_usuarios;
DROP POLICY IF EXISTS "admin_all_hierarquia" ON public.hierarquia_usuarios;

-- SELECT policy:
-- - A user can see their own row.
-- - Users with roles 'super_admin', 'coordenador', or 'agenda' can see all rows.
CREATE POLICY "authenticated_select_hierarquia" ON public.hierarquia_usuarios
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.get_auth_user_role(auth.uid()) IN ('super_admin', 'coordenador', 'agenda')
  );

-- ALL policy:
-- - Only 'super_admin' and 'coordenador' can perform write operations (insert, update, delete).
CREATE POLICY "admin_all_hierarquia" ON public.hierarquia_usuarios
  FOR ALL TO authenticated
  USING (
    public.get_auth_user_role(auth.uid()) IN ('super_admin', 'coordenador')
  )
  WITH CHECK (
    public.get_auth_user_role(auth.uid()) IN ('super_admin', 'coordenador')
  );


-- ══════════════════════════════════════════════════════════════════════════
-- 3. Drop and recreate policies for public.reunioes
-- ══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "reunioes_select_policy" ON public.reunioes;
DROP POLICY IF EXISTS "reunioes_insert_policy" ON public.reunioes;
DROP POLICY IF EXISTS "reunioes_all_policy" ON public.reunioes;

-- SELECT policy:
-- - Regular users see only their own meetings.
-- - Users with roles 'super_admin', 'coordenador', or 'agenda' can see all meetings.
CREATE POLICY "reunioes_select_policy" ON public.reunioes
  FOR SELECT TO authenticated
  USING (
    usuario_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
    OR public.get_auth_user_role(auth.uid()) IN ('super_admin', 'coordenador', 'agenda')
  );

-- INSERT policy:
-- - Regular users can register their own meetings.
-- - Users with roles 'super_admin', 'coordenador', or 'agenda' can register meetings for anyone.
CREATE POLICY "reunioes_insert_policy" ON public.reunioes
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
    OR public.get_auth_user_role(auth.uid()) IN ('super_admin', 'coordenador', 'agenda')
  );

-- ALL (management) policy:
-- - Users with roles 'super_admin', 'coordenador', or 'agenda' can perform any write action (edit/delete) on all meetings.
CREATE POLICY "reunioes_all_policy" ON public.reunioes
  FOR ALL TO authenticated
  USING (
    public.get_auth_user_role(auth.uid()) IN ('super_admin', 'coordenador', 'agenda')
  );
