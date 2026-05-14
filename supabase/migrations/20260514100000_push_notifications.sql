-- supabase/migrations/20260514100000_push_notifications.sql

-- ═══════════════════════════════════════════════════════
-- 1. Extensão avisos_app
-- ═══════════════════════════════════════════════════════
ALTER TABLE public.avisos_app
  ADD COLUMN IF NOT EXISTS persistente        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intervalo_minutos  integer     NULL CHECK (intervalo_minutos IS NULL OR intervalo_minutos > 0),
  ADD COLUMN IF NOT EXISTS ultima_notificacao_em timestamptz NULL;

-- ═══════════════════════════════════════════════════════
-- 2. push_subscriptions
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarquia_id uuid        NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  endpoint      text        NOT NULL UNIQUE,
  p256dh        text        NOT NULL,
  auth          text        NOT NULL,
  user_agent    text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_sub_own" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  )
  WITH CHECK (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  );

CREATE POLICY "push_sub_admin_read" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
  );

-- ═══════════════════════════════════════════════════════
-- 3. avisos_destinatarios
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.avisos_destinatarios (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id      uuid  NOT NULL REFERENCES public.avisos_app(id) ON DELETE CASCADE,
  hierarquia_id uuid  REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  tipo_usuario  text,
  CONSTRAINT chk_dest_xor CHECK (
    (hierarquia_id IS NOT NULL AND tipo_usuario IS NULL) OR
    (hierarquia_id IS NULL AND tipo_usuario IS NOT NULL)
  )
);

ALTER TABLE public.avisos_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avisos_dest_admin" ON public.avisos_destinatarios
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
  );

CREATE POLICY "avisos_dest_read_own" ON public.avisos_destinatarios
  FOR SELECT TO authenticated
  USING (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
    OR tipo_usuario = (
      SELECT tipo FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  );

-- ═══════════════════════════════════════════════════════
-- 4. avisos_visualizacoes
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.avisos_visualizacoes (
  aviso_id      uuid        NOT NULL REFERENCES public.avisos_app(id) ON DELETE CASCADE,
  hierarquia_id uuid        NOT NULL REFERENCES public.hierarquia_usuarios(id) ON DELETE CASCADE,
  visto_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aviso_id, hierarquia_id)
);

ALTER TABLE public.avisos_visualizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viz_own" ON public.avisos_visualizacoes
  FOR ALL TO authenticated
  USING (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  )
  WITH CHECK (
    hierarquia_id = (
      SELECT id FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid() AND ativo = true LIMIT 1
    )
  );

CREATE POLICY "viz_admin_read" ON public.avisos_visualizacoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hierarquia_usuarios
      WHERE auth_user_id = auth.uid()
        AND tipo IN ('super_admin', 'coordenador')
        AND ativo = true
    )
  );

-- ═══════════════════════════════════════════════════════
-- 5. Índices de performance
-- ═══════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS push_subscriptions_hierarquia_id_idx
  ON public.push_subscriptions(hierarquia_id);

CREATE INDEX IF NOT EXISTS avisos_viz_hierarquia_id_idx
  ON public.avisos_visualizacoes(hierarquia_id);

CREATE INDEX IF NOT EXISTS avisos_dest_aviso_id_idx
  ON public.avisos_destinatarios(aviso_id);

CREATE INDEX IF NOT EXISTS avisos_dest_hierarquia_id_idx
  ON public.avisos_destinatarios(hierarquia_id)
  WHERE hierarquia_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS avisos_dest_tipo_usuario_idx
  ON public.avisos_destinatarios(tipo_usuario)
  WHERE tipo_usuario IS NOT NULL;
