-- supabase/migrations/20260526180000_drop_agenda_policy.sql

-- Drop the recursive agenda RLS policy that is causing infinite loop/hang for all authenticated users
DROP POLICY IF EXISTS "agenda_select_hierarquia" ON public.hierarquia_usuarios;
