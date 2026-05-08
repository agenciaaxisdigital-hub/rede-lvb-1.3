CREATE TABLE IF NOT EXISTS public.cadastros_social (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL,
  whatsapp     text NOT NULL,
  cpf          text,
  instagram    text,
  nome_mae     text,
  regiao       text,
  cadastrado_por uuid REFERENCES public.hierarquia_usuarios(id) ON DELETE SET NULL,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cadastros_social ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_cadastros_social" ON public.cadastros_social;
CREATE POLICY "authenticated_select_cadastros_social"
  ON public.cadastros_social FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_cadastros_social" ON public.cadastros_social;
CREATE POLICY "authenticated_insert_cadastros_social"
  ON public.cadastros_social FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_cadastros_social" ON public.cadastros_social;
CREATE POLICY "authenticated_update_cadastros_social"
  ON public.cadastros_social FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_cadastros_social" ON public.cadastros_social;
CREATE POLICY "authenticated_delete_cadastros_social"
  ON public.cadastros_social FOR DELETE TO authenticated USING (true);
