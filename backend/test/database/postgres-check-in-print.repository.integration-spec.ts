import { DataSource } from 'typeorm';
import { PostgresCheckInPrintRepository } from '../../src/check-ins/repositories/postgres-check-in-print.repository';

describe('PostgresCheckInPrintRepository integration', () => {
  let dataSource: DataSource;
  let repository: PostgresCheckInPrintRepository;

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

    repository = new PostgresCheckInPrintRepository(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('loads print context for an existing checked-in booking', async () => {
    const bookingReference = '44444444-4444-4444-8444-444444444444';

    const result = await repository.findPrintContext(bookingReference);

    expect(result).toEqual({
      bookingReference,
      roomNumber: 'T102',
      status: 'CHECKED_IN',
      checkInDate: '2030-01-08',
      checkOutDate: '2030-01-12',
    });
  });

  it('loads a confirmed booking so service-level eligibility can reject printing', async () => {
    const bookingReference = '33333333-3333-4333-8333-333333333333';

    const result = await repository.findPrintContext(bookingReference);

    expect(result).toEqual({
      bookingReference,
      roomNumber: 'T101',
      status: 'CONFIRMED',
      checkInDate: '2030-01-10',
      checkOutDate: '2030-01-12',
    });
  });

  it('returns null for an unknown booking', async () => {
    const result = await repository.findPrintContext(
      'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    );

    expect(result).toBeNull();
  });
});
