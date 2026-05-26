-- supabase/migrations/20260526110000_reunioes_feature.sql

-- 2. Create reunioes table
CREATE TABLE IF NOT EXISTS public.reunioes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     uuid NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  registrado_por uuid NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  data_reuniao   timestamptz NOT NULL,
  local          text NOT NULL,
  observacoes    text,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- 3. Create configuracoes_app table
CREATE TABLE IF NOT EXISTS public.configuracoes_app (
  chave         text PRIMARY KEY,
  valor         text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_app ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies to prevent conflicts during migration re-runs
DROP POLICY IF EXISTS "reunioes_select_policy" ON public.reunioes;
DROP POLICY IF EXISTS "reunioes_insert_policy" ON public.reunioes;
DROP POLICY IF EXISTS "reunioes_all_policy" ON public.reunioes;
DROP POLICY IF EXISTS "config_select_policy" ON public.configuracoes_app;
DROP POLICY IF EXISTS "config_all_policy" ON public.configuracoes_app;

-- 6. Create policies for public.reunioes
CREATE POLICY "reunioes_select_policy" ON public.reunioes FOR SELECT TO authenticated
  USING (
    usuario_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
    OR EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND tipo IN ('super_admin', 'coordenador', 'agenda') AND ativo = true
    )
  );

CREATE POLICY "reunioes_insert_policy" ON public.reunioes FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
    OR EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND tipo IN ('super_admin', 'coordenador', 'agenda') AND ativo = true
    )
  );

CREATE POLICY "reunioes_all_policy" ON public.reunioes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND tipo IN ('super_admin', 'coordenador', 'agenda') AND ativo = true
    )
  );

-- 7. Create policies for public.configuracoes_app
CREATE POLICY "config_select_policy" ON public.configuracoes_app FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "config_all_policy" ON public.configuracoes_app FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND tipo IN ('super_admin', 'coordenador') AND ativo = true
    )
  );
