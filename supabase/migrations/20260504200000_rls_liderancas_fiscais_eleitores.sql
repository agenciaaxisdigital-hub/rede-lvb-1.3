-- Garante que usuários autenticados podem ler liderancas, fiscais e possiveis_eleitores
-- O filtro por usuario (cadastrado_por / suplente_id) é feito no lado da aplicação.
-- Sem estas policies, usuários não-admin não conseguem ver seus próprios cadastros.

ALTER TABLE public.liderancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.possiveis_eleitores ENABLE ROW LEVEL SECURITY;

-- liderancas
DROP POLICY IF EXISTS "authenticated_select_liderancas" ON public.liderancas;
CREATE POLICY "authenticated_select_liderancas"
  ON public.liderancas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_liderancas" ON public.liderancas;
CREATE POLICY "authenticated_insert_liderancas"
  ON public.liderancas FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_liderancas" ON public.liderancas;
CREATE POLICY "authenticated_update_liderancas"
  ON public.liderancas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_liderancas" ON public.liderancas;
CREATE POLICY "authenticated_delete_liderancas"
  ON public.liderancas FOR DELETE TO authenticated USING (true);

-- fiscais
DROP POLICY IF EXISTS "authenticated_select_fiscais" ON public.fiscais;
CREATE POLICY "authenticated_select_fiscais"
  ON public.fiscais FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_fiscais" ON public.fiscais;
CREATE POLICY "authenticated_insert_fiscais"
  ON public.fiscais FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_fiscais" ON public.fiscais;
CREATE POLICY "authenticated_update_fiscais"
  ON public.fiscais FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_fiscais" ON public.fiscais;
CREATE POLICY "authenticated_delete_fiscais"
  ON public.fiscais FOR DELETE TO authenticated USING (true);

-- possiveis_eleitores
DROP POLICY IF EXISTS "authenticated_select_eleitores" ON public.possiveis_eleitores;
CREATE POLICY "authenticated_select_eleitores"
  ON public.possiveis_eleitores FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_eleitores" ON public.possiveis_eleitores;
CREATE POLICY "authenticated_insert_eleitores"
  ON public.possiveis_eleitores FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_eleitores" ON public.possiveis_eleitores;
CREATE POLICY "authenticated_update_eleitores"
  ON public.possiveis_eleitores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_eleitores" ON public.possiveis_eleitores;
CREATE POLICY "authenticated_delete_eleitores"
  ON public.possiveis_eleitores FOR DELETE TO authenticated USING (true);

-- cadastros_afiliados (contador do link card — lido pelo usuário autenticado)
ALTER TABLE public.cadastros_afiliados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_cadastros_afiliados" ON public.cadastros_afiliados;
CREATE POLICY "authenticated_select_cadastros_afiliados"
  ON public.cadastros_afiliados FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_cadastros_afiliados" ON public.cadastros_afiliados;
CREATE POLICY "authenticated_insert_cadastros_afiliados"
  ON public.cadastros_afiliados FOR INSERT TO authenticated WITH CHECK (true);
