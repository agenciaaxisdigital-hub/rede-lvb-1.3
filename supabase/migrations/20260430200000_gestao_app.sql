-- ── Gestão App: Metas de Postagem ────────────────────────────────────────────
-- Armazena metas de feed e stories por usuário, com período e status ativa/inativa.

CREATE TABLE IF NOT EXISTS public.metas_postagem (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  feed_meta   integer NOT NULL DEFAULT 0,
  stories_meta integer NOT NULL DEFAULT 0,
  periodo     text NOT NULL DEFAULT 'semanal', -- 'diario' | 'semanal' | 'mensal'
  ativa       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metas_postagem ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "admin_all_metas" ON public.metas_postagem FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Gestão App: Avisos ────────────────────────────────────────────────────────
-- Armazena avisos/notificações que o admin envia para os usuários do app.

CREATE TABLE IF NOT EXISTS public.avisos_app (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  corpo       text NOT NULL,
  ativa       boolean NOT NULL DEFAULT true,
  tipo        text NOT NULL DEFAULT 'info', -- 'info' | 'alerta' | 'sucesso' | 'urgente'
  criado_por  uuid REFERENCES public.hierarquia_usuarios(id) ON DELETE SET NULL,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos_app ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "admin_all_avisos" ON public.avisos_app FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Perfil do Usuário: campos extras em hierarquia_usuarios ───────────────────
ALTER TABLE public.hierarquia_usuarios
  ADD COLUMN IF NOT EXISTS bio        text,
  ADD COLUMN IF NOT EXISTS foto_url   text,
  ADD COLUMN IF NOT EXISTS whatsapp   text,
  ADD COLUMN IF NOT EXISTS cidade_display text; -- nome da cidade para exibição pública
