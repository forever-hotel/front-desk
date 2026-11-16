import { DataSource } from 'typeorm';
import type {
  CreateWalkInBookingRecord,
  WalkInRoomTypeDetails,
} from '../../src/reservations/models/walk-in-booking-result';
import { PostgresWalkInBookingRepository } from '../../src/reservations/repositories/postgres-walk-in-booking.repository';

describe('PostgresWalkInBookingRepository integration', () => {
  let dataSource: DataSource;
  let repository: PostgresWalkInBookingRepository;
  let roomType: WalkInRoomTypeDetails;

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

    repository = new PostgresWalkInBookingRepository(dataSource);

    const persistedRoomType = await repository.findRoomType(
      '11111111-1111-4111-8111-111111111111',
    );

    if (!persistedRoomType) {
      throw new Error('CI room type was not seeded');
    }

    roomType = persistedRoomType;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('loads the persisted room type used for walk-in pricing', async () => {
    expect(roomType).toEqual({
      roomTypeId: '11111111-1111-4111-8111-111111111111',
      typeName: 'CI Standard Room',
      pricePerNight: 15000,
      maxGuests: 2,
    });
  });

  it('creates a cash walk-in booking and completed payment', async () => {
    const input: CreateWalkInBookingRecord = {
      guest: {
        fullName: 'Anonymous Cash Guest',
        email: 'anonymous-cash@example.invalid',
        nicOrPassport: 'CASH-WALK-IN-001',
        phone: '+94000000011',
      },
      roomType,
      checkInDate: '2031-01-10',
      checkOutDate: '2031-01-11',
      numGuests: 1,
      specialRequests: 'Cash integration test',
      totalAmount: 15000,
      paymentMethod: 'CASH',
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'COMPLETED',
    };

    const result = await repository.createWalkInBooking(input);

    expect(result.guestId).toBeNull();
    expect(result.guestAccountLinked).toBe(false);
    expect(result.source).toBe('WALK_IN');
    expect(result.status).toBe('CONFIRMED');
    expect(result.totalAmount).toBe(15000);

    expect(result.payment.paymentMethod).toBe('CASH');
    expect(result.payment.paymentStatus).toBe('COMPLETED');
    expect(result.payment.amount).toBe(15000);
    expect(result.payment.paidAt).not.toBeNull();

    const bookingRows = await dataSource.query(
      `
      SELECT
        source::text AS "source",
        status::text AS "status",
        total_amount AS "totalAmount"
      FROM bookings
      WHERE booking_id = $1
      `,
      [result.bookingId],
    );

    expect(bookingRows).toHaveLength(1);
    expect(bookingRows[0].source).toBe('WALK_IN');
    expect(bookingRows[0].status).toBe('CONFIRMED');
    expect(Number(bookingRows[0].totalAmount)).toBe(15000);

    const paymentRows = await dataSource.query(
      `
      SELECT
        payment_method::text AS "paymentMethod",
        payment_status::text AS "paymentStatus",
        amount,
        stripe_ref AS "stripeRef"
      FROM payments
      WHERE payment_id = $1
      `,
      [result.payment.paymentId],
    );

    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0].paymentMethod).toBe('CASH');
    expect(paymentRows[0].paymentStatus).toBe('COMPLETED');
    expect(Number(paymentRows[0].amount)).toBe(15000);
    expect(paymentRows[0].stripeRef).toBeNull();
  });

  it('links a walk-in booking to an existing guest account by email', async () => {
    const input: CreateWalkInBookingRecord = {
      guest: {
        fullName: 'CI Test Guest',
        email: 'ci-test-guest@example.invalid',
        nicOrPassport: 'TEST-NIC-001',
        phone: '+94000000000',
      },
      roomType,
      checkInDate: '2031-02-10',
      checkOutDate: '2031-02-12',
      numGuests: 2,
      totalAmount: 30000,
      paymentMethod: 'CARD_ON_SITE',
      bookingStatus: 'PENDING',
      paymentStatus: 'PENDING',
    };

    const result = await repository.createWalkInBooking(input);

    expect(result.guestId).toBe('22222222-2222-4222-8222-222222222222');

    expect(result.guestAccountLinked).toBe(true);
    expect(result.status).toBe('PENDING');
    expect(result.payment.paymentMethod).toBe('CARD_ON_SITE');
    expect(result.payment.paymentStatus).toBe('PENDING');
    expect(result.payment.paidAt).toBeNull();
  });

  it('rolls back the booking when payment persistence fails', async () => {
    const marker = 'ROLLBACK-WALK-IN-TEST';

    const beforeRows = await dataSource.query(
      `
      SELECT COUNT(*)::int AS "count"
      FROM bookings
      WHERE special_requests = $1
      `,
      [marker],
    );

    const input: CreateWalkInBookingRecord = {
      guest: {
        fullName: 'Rollback Guest',
        email: 'rollback@example.invalid',
      },
      roomType,
      checkInDate: '2031-03-10',
      checkOutDate: '2031-03-11',
      numGuests: 1,
      specialRequests: marker,
      totalAmount: 15000,
      paymentMethod: 'INVALID' as CreateWalkInBookingRecord['paymentMethod'],
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'COMPLETED',
    };

    await expect(repository.createWalkInBooking(input)).rejects.toThrow();

    const afterRows = await dataSource.query(
      `
      SELECT COUNT(*)::int AS "count"
      FROM bookings
      WHERE special_requests = $1
      `,
      [marker],
    );

    expect(Number(afterRows[0].count)).toBe(Number(beforeRows[0].count));
  });
});
