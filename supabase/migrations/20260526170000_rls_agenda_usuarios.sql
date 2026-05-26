-- supabase/migrations/20260526170000_rls_agenda_usuarios.sql

-- 1. Create a SELECT policy for 'agenda' users on hierarquia_usuarios
DROP POLICY IF EXISTS "agenda_select_hierarquia" ON public.hierarquia_usuarios;

CREATE POLICY "agenda_select_hierarquia" ON public.hierarquia_usuarios
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND tipo = 'agenda' AND ativo = true
    )
  );
