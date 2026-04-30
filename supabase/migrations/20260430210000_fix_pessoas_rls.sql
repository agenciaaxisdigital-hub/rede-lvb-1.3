-- Fix: garantir que usuários autenticados possam inserir e ler da tabela pessoas
-- (necessário para o cadastro de Cabos Eleitorais e demais registros)

-- Remover políticas antigas que possam estar conflitando
DROP POLICY IF EXISTS "pessoas_insert" ON public.pessoas;
DROP POLICY IF EXISTS "pessoas_select" ON public.pessoas;
DROP POLICY IF EXISTS "pessoas_update" ON public.pessoas;
DROP POLICY IF EXISTS "pessoas_delete" ON public.pessoas;
DROP POLICY IF EXISTS "Authenticated users can insert pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Authenticated users can read pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Authenticated users can update pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Authenticated users can delete pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.pessoas;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.pessoas;

-- Garantir que RLS está ativa
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;

-- Garantir que a política existe (idempotente)
DROP POLICY IF EXISTS "authenticated_all_pessoas" ON public.pessoas;
CREATE POLICY "authenticated_all_pessoas"
  ON public.pessoas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
