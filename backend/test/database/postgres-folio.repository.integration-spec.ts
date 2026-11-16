import { DataSource } from 'typeorm';
import { PostgresFolioRepository } from '../../src/billing/repositories/postgres-folio.repository';

describe('PostgresFolioRepository integration', () => {
  let dataSource: DataSource;
  let repository: PostgresFolioRepository;

  const checkedInBookingReference = '44444444-4444-4444-8444-444444444444';

  const confirmedBookingReference = '33333333-3333-4333-8333-333333333333';

  const unknownBookingReference = '77777777-7777-4777-8777-777777777779';

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

    repository = new PostgresFolioRepository(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('loads the persisted checked-in booking context for a running folio', async () => {
    const result = await repository.findBookingContext(
      checkedInBookingReference,
    );

    expect(result).toEqual({
      bookingReference: checkedInBookingReference,
      roomNumber: 'T102',
      checkInDate: '2030-01-08',
      checkOutDate: '2030-01-12',
      bookingStatus: 'CHECKED_IN',
      roomCharge: 60000,
    });
  });

  it('uses the authoritative persisted booking total as the room charge', async () => {
    const result = await repository.findBookingContext(
      checkedInBookingReference,
    );

    expect(result).not.toBeNull();

    expect(result?.roomCharge).toBe(60000);

    expect(Number.isSafeInteger(result?.roomCharge)).toBe(true);
  });

  it('loads booking state without incorrectly treating a confirmed booking as checked in', async () => {
    const result = await repository.findBookingContext(
      confirmedBookingReference,
    );

    expect(result).toEqual({
      bookingReference: confirmedBookingReference,
      roomNumber: 'T101',
      checkInDate: '2030-01-10',
      checkOutDate: '2030-01-12',
      bookingStatus: 'CONFIRMED',
      roomCharge: 30000,
    });

    expect(result?.bookingStatus).not.toBe('CHECKED_IN');
  });

  it('returns null when the booking does not exist', async () => {
    await expect(
      repository.findBookingContext(unknownBookingReference),
    ).resolves.toBeNull();
  });

  it('does not create or mutate folio persistence while reading booking context', async () => {
    const beforeRows = await dataSource.query(
      `
        SELECT
          booking_id::text
            AS "bookingReference",
          room_number
            AS "roomNumber",
          status::text
            AS "bookingStatus",
          total_amount
            AS "totalAmount"
        FROM bookings
        WHERE booking_id = $1
        `,
      [checkedInBookingReference],
    );

    await repository.findBookingContext(checkedInBookingReference);

    const afterRows = await dataSource.query(
      `
        SELECT
          booking_id::text
            AS "bookingReference",
          room_number
            AS "roomNumber",
          status::text
            AS "bookingStatus",
          total_amount
            AS "totalAmount"
        FROM bookings
        WHERE booking_id = $1
        `,
      [checkedInBookingReference],
    );

    expect(beforeRows).toEqual(afterRows);

    expect(afterRows).toEqual([
      {
        bookingReference: checkedInBookingReference,
        roomNumber: 'T102',
        bookingStatus: 'CHECKED_IN',
        totalAmount: 60000,
      },
    ]);
  });
});
