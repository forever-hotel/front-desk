import { DataSource } from 'typeorm';
import { PostgresBookingRepository } from '../../src/reservations/repositories/postgres-booking.repository';

describe('PostgresBookingRepository integration', () => {
  let dataSource: DataSource;
  let repository: PostgresBookingRepository;

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

    repository = new PostgresBookingRepository(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('searches persisted bookings by guest name', async () => {
    const result = await repository.search('CI Test Guest');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].guestName).toBe('CI Test Guest');
  });

  it('searches persisted bookings by NIC/passport', async () => {
    const result = await repository.search('TEST-NIC-001');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].guestName).toBe('CI Test Guest');
  });

  it('searches persisted bookings by email', async () => {
    const result = await repository.search('ci-test-guest@example.invalid');

    expect(result.length).toBeGreaterThan(0);
  });

  it('searches persisted bookings by phone', async () => {
    const result = await repository.search('+94000000000');

    expect(result.length).toBeGreaterThan(0);
  });

  it('searches persisted bookings by booking reference', async () => {
    const result = await repository.search(
      '33333333-3333-4333-8333-333333333333',
    );

    expect(result).toHaveLength(1);
    expect(result[0].bookingReference).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
  });

  it('returns confirmed arrivals for the requested date', async () => {
    const result = await repository.findArrivals('2030-01-10');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('CONFIRMED');
    expect(result[0].checkInDate).toBe('2030-01-10');
  });

  it('returns checked-in departures for the requested date', async () => {
    const result = await repository.findDepartures('2030-01-12');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('CHECKED_IN');
    expect(result[0].checkOutDate).toBe('2030-01-12');
  });
});
