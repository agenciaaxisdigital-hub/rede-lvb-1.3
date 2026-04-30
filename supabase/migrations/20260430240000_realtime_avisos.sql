-- Habilita realtime para avisos_app e metas_postagem
-- Sem isso, o NotificationBell não recebe eventos em tempo real
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.avisos_app;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.metas_postagem;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
