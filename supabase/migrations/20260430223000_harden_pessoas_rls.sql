-- Harden pessoas RLS:
-- keep app creation/update flow working while preventing broad deletes.

DROP POLICY IF EXISTS "authenticated_all_pessoas"    ON public.pessoas;
DROP POLICY IF EXISTS "authenticated_select_pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "authenticated_insert_pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "authenticated_update_pessoas" ON public.pessoas;

ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_pessoas"
  ON public.pessoas FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_pessoas"
  ON public.pessoas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_pessoas"
  ON public.pessoas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
