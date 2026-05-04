-- Remove unique constraint on cpf in pessoas table
-- Allows multiple registrations with the same CPF (via link or manual)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'pessoas'::regclass
      AND contype = 'u'
      AND conname ILIKE '%cpf%'
  LOOP
    EXECUTE 'ALTER TABLE pessoas DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Also drop index if exists (some unique constraints are index-based)
DROP INDEX IF EXISTS pessoas_cpf_key;
DROP INDEX IF EXISTS pessoas_cpf_idx;
DROP INDEX IF EXISTS idx_pessoas_cpf;
