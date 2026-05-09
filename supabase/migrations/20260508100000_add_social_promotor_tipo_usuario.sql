-- Add 'promotor' and 'social' to the tipo_usuario enum
ALTER TYPE public.tipo_usuario ADD VALUE IF NOT EXISTS 'promotor';
ALTER TYPE public.tipo_usuario ADD VALUE IF NOT EXISTS 'social';
