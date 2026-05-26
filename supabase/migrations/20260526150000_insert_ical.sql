-- supabase/migrations/20260526150000_insert_ical.sql

-- Insert or update the iCal private URL for Google Calendar sync
INSERT INTO public.configuracoes_app (chave, valor)
VALUES (
  'google_calendar_ical_url', 
  'https://calendar.google.com/calendar/ical/fernandasarelli2026%40gmail.com/private-2c877221d982325f4dcdad91cea79de6/basic.ics'
)
ON CONFLICT (chave) 
DO UPDATE SET 
  valor = EXCLUDED.valor, 
  atualizado_em = now();
