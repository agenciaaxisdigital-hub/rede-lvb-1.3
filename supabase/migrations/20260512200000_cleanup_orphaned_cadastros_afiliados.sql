-- Remove orphaned log entries in cadastros_afiliados where the capturing user was deleted.
-- For fernanda/social/lideranca/cabo/fiscal/eleitor/promotor origins, the primary data was
-- already written to their respective tables (cadastros_fernanda, cadastros_social, liderancas, etc.)
-- so removing the log entry here is safe.
-- For 'link_publico_afiliado' and 'manual' origins, the record is the only copy —
-- we preserve those so data is not lost.

DELETE FROM public.cadastros_afiliados
WHERE (afiliado_id IS NULL OR afiliado_id NOT IN (SELECT id FROM public.hierarquia_usuarios))
  AND origem NOT IN ('link_publico_afiliado', 'manual');
