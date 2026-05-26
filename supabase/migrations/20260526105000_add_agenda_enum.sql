-- supabase/migrations/20260526105000_add_agenda_enum.sql

-- 1. Ensure 'agenda' exists in tipo_usuario enum
ALTER TYPE public.tipo_usuario ADD VALUE IF NOT EXISTS 'agenda';
