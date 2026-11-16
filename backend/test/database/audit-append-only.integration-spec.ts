import { DataSource } from 'typeorm';
import { setAuditAppendOnlyTriggers } from './audit-trigger-test.helper';

describe('Audit log append-only integration', () => {
  let dataSource: DataSource;

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const auditEntityId = 'plan16-append-only-test';

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true',
    });

    await dataSource.initialize();

    /*
     * Global integration setup disables the
     * append-only triggers so legacy fixture
     * cleanup can continue working.
     *
     * This security-specific suite explicitly
     * enables them so it tests production behaviour.
     */
    await setAuditAppendOnlyTriggers(dataSource, true);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('allows a new audit record to be inserted', async () => {
    const rows = await dataSource.query(
      `
        INSERT INTO audit_logs (
          event_category,
          actor_type,
          staff_user_id,
          action,
          entity_type,
          entity_id,
          details
        )
        VALUES (
          'FRONT_DESK_OPERATION',
          'STAFF',
          $1,
          'PLAN16_APPEND_ONLY_TEST',
          'SECURITY_TEST',
          $2,
          $3::jsonb
        )
        RETURNING
          log_id::text AS "logId",
          action,
          entity_type AS "entityType",
          entity_id AS "entityId"
      `,
      [
        receptionistId,
        auditEntityId,
        JSON.stringify({
          purpose: 'append-only integration evidence',
        }),
      ],
    );

    expect(rows).toHaveLength(1);

    expect(rows[0]).toEqual(
      expect.objectContaining({
        logId: expect.any(String),
        action: 'PLAN16_APPEND_ONLY_TEST',
        entityType: 'SECURITY_TEST',
        entityId: auditEntityId,
      }),
    );
  });

  it('rejects modification of an existing audit record', async () => {
    await expect(
      dataSource.query(
        `
          UPDATE audit_logs
          SET action = $1
          WHERE
            entity_type = 'SECURITY_TEST'
            AND entity_id = $2
        `,
        ['TAMPERED_ACTION', auditEntityId],
      ),
    ).rejects.toThrow(/append-only/i);

    const rows = await dataSource.query(
      `
        SELECT action
        FROM audit_logs
        WHERE
          entity_type = 'SECURITY_TEST'
          AND entity_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [auditEntityId],
    );

    expect(rows[0].action).toBe('PLAN16_APPEND_ONLY_TEST');
  });

  it('rejects deletion of an existing audit record', async () => {
    await expect(
      dataSource.query(
        `
          DELETE FROM audit_logs
          WHERE
            entity_type = 'SECURITY_TEST'
            AND entity_id = $1
        `,
        [auditEntityId],
      ),
    ).rejects.toThrow(/append-only/i);

    const rows = await dataSource.query(
      `
        SELECT COUNT(*)::int AS "count"
        FROM audit_logs
        WHERE
          entity_type = 'SECURITY_TEST'
          AND entity_id = $1
      `,
      [auditEntityId],
    );

    expect(Number(rows[0].count)).toBeGreaterThan(0);
  });

  it('rejects truncation of the audit table', async () => {
    await expect(
      dataSource.query(`
        TRUNCATE TABLE audit_logs
      `),
    ).rejects.toThrow(/append-only/i);

    const rows = await dataSource.query(
      `
        SELECT COUNT(*)::int AS "count"
        FROM audit_logs
        WHERE
          entity_type = 'SECURITY_TEST'
          AND entity_id = $1
      `,
      [auditEntityId],
    );

    expect(Number(rows[0].count)).toBeGreaterThan(0);
  });
});
