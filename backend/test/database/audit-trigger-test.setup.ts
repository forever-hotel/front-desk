import { DataSource } from 'typeorm';
import { setAuditAppendOnlyTriggers } from './audit-trigger-test.helper';

let dataSource: DataSource;

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
   * Legacy integration suites use DELETE statements
   * only to remove disposable test fixtures.
   *
   * Disable Plan 16 append-only triggers for those
   * legacy test files. The dedicated Plan 16 audit
   * test explicitly re-enables them before verifying
   * the production security behaviour.
   */
  await setAuditAppendOnlyTriggers(dataSource, false);
});

afterAll(async () => {
  if (!dataSource?.isInitialized) {
    return;
  }

  /*
   * Never leave the disposable test database with
   * append-only protection disabled.
   */
  await setAuditAppendOnlyTriggers(dataSource, true);

  await dataSource.destroy();
});
