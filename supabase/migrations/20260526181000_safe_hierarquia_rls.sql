-- supabase/migrations/20260526181000_safe_hierarquia_rls.sql

-- 1. Enable Row Level Security (RLS) on hierarquia_usuarios
ALTER TABLE public.hierarquia_usuarios ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "agenda_select_hierarquia" ON public.hierarquia_usuarios;
DROP POLICY IF EXISTS "authenticated_select_hierarquia" ON public.hierarquia_usuarios;
DROP POLICY IF EXISTS "admin_all_hierarquia" ON public.hierarquia_usuarios;

-- 3. Create a safe, non-recursive SELECT policy for authenticated users
-- - Any user can see their own profile row.
-- - Admins, Coordinators, and Agenda profiles can see all rows (for management, lists, and synchronization verification).
CREATE POLICY "authenticated_select_hierarquia" ON public.hierarquia_usuarios
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'coordenador', 'agenda')
  );

-- 4. Create a safe, non-recursive ALL policy for Admins and Coordinators
-- - Allows admins and coordinators to create/update/delete users directly.
CREATE POLICY "admin_all_hierarquia" ON public.hierarquia_usuarios
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'coordenador')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'coordenador')
  );
