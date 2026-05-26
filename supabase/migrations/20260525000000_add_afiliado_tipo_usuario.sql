-- Ensure 'afiliado' exists in tipo_usuario enum (no-op if already present)
ALTER TYPE public.tipo_usuario ADD VALUE IF NOT EXISTS 'afiliado';
