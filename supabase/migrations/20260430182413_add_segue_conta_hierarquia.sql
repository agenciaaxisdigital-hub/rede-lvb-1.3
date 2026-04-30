ALTER TABLE public.hierarquia_usuarios ADD COLUMN IF NOT EXISTS segue_conta BOOLEAN DEFAULT false;
