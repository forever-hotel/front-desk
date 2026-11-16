import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type {
  CreateWalkInBookingRecord,
  WalkInRoomTypeDetails,
} from '../../src/reservations/models/walk-in-booking-result';
import { PostgresBookingRepository } from '../../src/reservations/repositories/postgres-booking.repository';
import { PostgresWalkInBookingRepository } from '../../src/reservations/repositories/postgres-walk-in-booking.repository';

describe('DDP-230 walk-in guest persistence integration', () => {
  let dataSource: DataSource;
  let walkInRepository: PostgresWalkInBookingRepository;
  let bookingRepository: PostgresBookingRepository;
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
    walkInRepository = new PostgresWalkInBookingRepository(dataSource);
    bookingRepository = new PostgresBookingRepository(dataSource);
    const existingRoomType = await walkInRepository.findRoomType(
      '11111111-1111-4111-8111-111111111111',
    );
    if (!existingRoomType) throw new Error('Expected CI seeded room type');
    roomType = existingRoomType;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  const input = (email: string): CreateWalkInBookingRecord => ({
    guest: {
      fullName: 'Persistent Walk In Guest',
      email,
      nicOrPassport: 'DDP230-TEST',
      phone: '+94000000014',
    },
    roomType,
    checkInDate: '2031-05-10',
    checkOutDate: '2031-05-11',
    numGuests: 1,
    totalAmount: 15000,
    paymentMethod: 'CASH',
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'COMPLETED',
  });

  it('persists guest details without creating a dummy account and supports name/email search', async () => {
    const guestEmail = `ddp230-${randomUUID()}@example.invalid`;
    const created = await walkInRepository.createWalkInBooking(
      input(guestEmail),
    );

    expect(created.guestId).toBeNull();
    expect(created.guestAccountLinked).toBe(false);

    const saved = await dataSource.query(
      `SELECT full_name AS "fullName", email, phone, nic_or_passport AS "nicOrPassport"
       FROM fds_walk_in_guest_details WHERE booking_id = $1`,
      [created.bookingId],
    );
    expect(saved).toEqual([
      {
        fullName: 'Persistent Walk In Guest',
        email: guestEmail,
        phone: '+94000000014',
        nicOrPassport: 'DDP230-TEST',
      },
    ]);

    const byEmail = await bookingRepository.search(guestEmail);
    expect(byEmail).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingId: created.bookingId,
          guestName: 'Persistent Walk In Guest',
          email: guestEmail,
        }),
      ]),
    );

    const byName = await bookingRepository.search('Persistent Walk In Guest');
    expect(byName.some((row) => row.bookingId === created.bookingId)).toBe(
      true,
    );
  });

  it('rolls back the booking and payment if saving the guest snapshot fails', async () => {
    const marker = `DDP230-ROLLBACK-${randomUUID()}`;
    const request = input(`ddp230-rollback-${randomUUID()}@example.invalid`);
    request.guest.fullName = ' '; // invalid for the booking-specific guest snapshot CHECK constraint
    request.specialRequests = marker;

    await expect(
      walkInRepository.createWalkInBooking(request),
    ).rejects.toThrow();

    const leakedBookings = await dataSource.query(
      'SELECT booking_id FROM bookings WHERE special_requests = $1',
      [marker],
    );
    expect(leakedBookings).toHaveLength(0);
  });

  it('preserves the linked registered account while recording a booking-specific guest snapshot', async () => {
    const created = await walkInRepository.createWalkInBooking(
      input('ci-test-guest@example.invalid'),
    );
    expect(created.guestId).toBe('22222222-2222-4222-8222-222222222222');
    expect(created.guestAccountLinked).toBe(true);

    const rows = await bookingRepository.search(created.bookingId);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingId: created.bookingId,
          guestName: 'Persistent Walk In Guest',
        }),
      ]),
    );
  });
});
