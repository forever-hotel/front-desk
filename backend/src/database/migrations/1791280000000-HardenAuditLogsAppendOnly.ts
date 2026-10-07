import type { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenAuditLogsAppendOnly1791280000000 implements MigrationInterface {
  name = 'HardenAuditLogsAppendOnly1791280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION
          'audit_logs is append-only; % is not permitted',
          TG_OP
          USING ERRCODE = '55000';

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER prevent_audit_log_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation()
    `);

    await queryRunner.query(`
      CREATE TRIGGER prevent_audit_log_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation()
    `);

    await queryRunner.query(`
      CREATE TRIGGER prevent_audit_log_truncate
      BEFORE TRUNCATE ON audit_logs
      FOR EACH STATEMENT
      EXECUTE FUNCTION prevent_audit_log_mutation()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS prevent_audit_log_truncate
      ON audit_logs
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS prevent_audit_log_delete
      ON audit_logs
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS prevent_audit_log_update
      ON audit_logs
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS prevent_audit_log_mutation()
    `);
  }
}
