-- DDP-195 audit protection inventory; read-only and safe in fds-test.
SELECT trigger_name, enabled, definition
FROM (
  SELECT tgname AS trigger_name,
         tgenabled AS enabled,
         pg_get_triggerdef(oid) AS definition
    FROM pg_trigger
    WHERE tgrelid = 'public.audit_logs'::regclass
      AND NOT tgisinternal
) s
ORDER BY trigger_name;

SELECT pg_get_functiondef('public.prevent_audit_log_mutation()'::regprocedure)
  AS append_only_function;

SELECT COUNT(*) AS applied_typeorm_migrations
  FROM public.migrations;
