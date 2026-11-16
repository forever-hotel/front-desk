import type { DataSource } from 'typeorm';

const AUDIT_APPEND_ONLY_TRIGGERS = [
  'prevent_audit_log_update',
  'prevent_audit_log_delete',
  'prevent_audit_log_truncate',
] as const;

export async function setAuditAppendOnlyTriggers(
  dataSource: DataSource,
  enabled: boolean,
): Promise<void> {
  const operation = enabled ? 'ENABLE' : 'DISABLE';

  for (const triggerName of AUDIT_APPEND_ONLY_TRIGGERS) {
    const rows = (await dataSource.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_trigger trigger_record
          INNER JOIN pg_class table_record
            ON table_record.oid = trigger_record.tgrelid
          WHERE
            table_record.relname = 'audit_logs'
            AND trigger_record.tgname = $1
            AND trigger_record.tgisinternal = FALSE
        ) AS "exists"
      `,
      [triggerName],
    )) as Array<{
      exists: boolean;
    }>;

    if (rows[0]?.exists !== true) {
      continue;
    }

    await dataSource.query(`
      ALTER TABLE audit_logs
      ${operation} TRIGGER "${triggerName}"
    `);
  }
}
