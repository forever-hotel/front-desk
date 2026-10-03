import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CheckoutPaymentMethod } from '../../src/check-outs/models/checkout-payment-result';
import { PostgresCheckoutRepository } from '../../src/check-outs/repositories/postgres-checkout.repository';

describe('PostgresCheckoutRepository integration', () => {
  let dataSource: DataSource;
  let repository: PostgresCheckoutRepository;

  const receptionistId = '66666666-6666-4666-8666-666666666666';
  const workerId = '67676767-6767-4676-8676-676767676767';
  const guestId = '22222222-2222-4222-8222-222222222222';
  const roomTypeId = '11111111-1111-4111-8111-111111111111';

  const checkoutBookingReference = '12121212-1212-4121-8121-121212121201';
  const fullyPaidBookingReference = '12121212-1212-4121-8121-121212121202';
  const confirmedBookingReference = '12121212-1212-4121-8121-121212121203';
  const invalidRoomStateBookingReference =
    '12121212-1212-4121-8121-121212121204';

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

    repository = new PostgresCheckoutRepository(dataSource);

    await createPlan12Fixtures();
  });

  beforeEach(async () => {
    await resetPlan12State();
  });

  afterEach(async () => {
    await dropFailureTrigger();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dropFailureTrigger();
      await removePlan12Fixtures();
      await dataSource.destroy();
    }
  });

  it('prepares checkout using only completed payments as previously paid', async () => {
    const result = await repository.prepareCheckout({
      bookingReference: checkoutBookingReference,
      performedBy: receptionistId,
    });

    expect(result).toEqual({
      bookingReference: checkoutBookingReference,
      roomNumber: 'P1201',
      bookingStatus: 'CHECKED_IN',
      roomStatus: 'OCCUPIED',
      previouslyPaid: 10000,
    });
  });

  it('atomically persists final payment, checked-out booking, cleaning room and checkout audit', async () => {
    const result = await repository.commitCheckout({
      bookingReference: checkoutBookingReference,
      performedBy: receptionistId,
      roomNumber: 'P1201',
      folioTotal: 66000,
      previouslyPaid: 10000,
      finalPaymentAmount: 56000,
      paymentMethod: CheckoutPaymentMethod.CASH,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'checked_out',
        bookingReference: checkoutBookingReference,
        roomNumber: 'P1201',
        bookingStatus: 'CHECKED_OUT',
        roomStatus: 'REQUIRES_CLEANING',
        currency: 'LKR',
        folioTotal: 66000,
        previouslyPaid: 10000,
        finalPaymentAmount: 56000,
        payment: expect.objectContaining({
          paymentMethod: CheckoutPaymentMethod.CASH,
          paymentStatus: 'COMPLETED',
          amount: 56000,
        }),
      }),
    );

    expect(result.payment?.paymentId).toEqual(expect.any(String));
    expect(result.payment?.paidAt).toEqual(expect.any(String));
    expect(result.auditLogId).toEqual(expect.any(String));

    const bookingRows = await dataSource.query(
      `
      SELECT
        status::text AS "status",
        room_number AS "roomNumber"
      FROM bookings
      WHERE booking_id = $1
      `,
      [checkoutBookingReference],
    );

    expect(bookingRows).toEqual([
      {
        status: 'CHECKED_OUT',
        roomNumber: 'P1201',
      },
    ]);

    const roomRows = await dataSource.query(
      `
      SELECT
        status::text AS "status"
      FROM rooms
      WHERE room_number = 'P1201'
      `,
    );

    expect(roomRows).toEqual([
      {
        status: 'REQUIRES_CLEANING',
      },
    ]);

    const completedPaymentRows = await dataSource.query(
      `
      SELECT
        payment_method::text AS "paymentMethod",
        amount,
        payment_status::text AS "paymentStatus"
      FROM payments
      WHERE
        booking_id = $1
        AND payment_status = 'COMPLETED'
      ORDER BY amount ASC
      `,
      [checkoutBookingReference],
    );

    expect(completedPaymentRows).toEqual([
      {
        paymentMethod: 'CASH',
        amount: 10000,
        paymentStatus: 'COMPLETED',
      },
      {
        paymentMethod: 'CASH',
        amount: 56000,
        paymentStatus: 'COMPLETED',
      },
    ]);

    const auditRows = await dataSource.query(
      `
      SELECT
        event_category::text AS "eventCategory",
        actor_type::text AS "actorType",
        staff_user_id::text AS "staffUserId",
        action,
        entity_type AS "entityType",
        entity_id AS "entityId",
        details
      FROM audit_logs
      WHERE
        action = 'CHECK_OUT'
        AND entity_type = 'BOOKING'
        AND entity_id = $1
      `,
      [checkoutBookingReference],
    );

    expect(auditRows).toHaveLength(1);

    expect(auditRows[0]).toEqual({
      eventCategory: 'FRONT_DESK_OPERATION',
      actorType: 'STAFF',
      staffUserId: receptionistId,
      action: 'CHECK_OUT',
      entityType: 'BOOKING',
      entityId: checkoutBookingReference,
      details: {
        roomNumber: 'P1201',
        folioTotal: 66000,
        previouslyPaid: 10000,
        finalPaymentAmount: 56000,
        paymentMethod: 'CASH',
      },
    });
  });

  it('completes an already fully paid stay without inserting a zero-value payment', async () => {
    const paymentCountBefore = await countPayments(fullyPaidBookingReference);

    const result = await repository.commitCheckout({
      bookingReference: fullyPaidBookingReference,
      performedBy: receptionistId,
      roomNumber: 'P1202',
      folioTotal: 60000,
      previouslyPaid: 60000,
      finalPaymentAmount: 0,
    });

    const paymentCountAfter = await countPayments(fullyPaidBookingReference);

    expect(result.payment).toBeNull();
    expect(result.finalPaymentAmount).toBe(0);
    expect(paymentCountAfter).toBe(paymentCountBefore);

    const bookingRows = await dataSource.query(
      `
      SELECT status::text AS "status"
      FROM bookings
      WHERE booking_id = $1
      `,
      [fullyPaidBookingReference],
    );

    expect(bookingRows[0].status).toBe('CHECKED_OUT');

    const roomRows = await dataSource.query(
      `
      SELECT status::text AS "status"
      FROM rooms
      WHERE room_number = 'P1202'
      `,
    );

    expect(roomRows[0].status).toBe('REQUIRES_CLEANING');
  });

  it('rejects checkout preparation for a booking that is not checked in', async () => {
    await expect(
      repository.prepareCheckout({
        bookingReference: confirmedBookingReference,
        performedBy: receptionistId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects checkout preparation when the assigned room is not occupied', async () => {
    await expect(
      repository.prepareCheckout({
        bookingReference: invalidRoomStateBookingReference,
        performedBy: receptionistId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects checkout preparation for a non-receptionist actor', async () => {
    await expect(
      repository.prepareCheckout({
        bookingReference: checkoutBookingReference,
        performedBy: workerId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revalidates the completed-payment total after locking checkout state', async () => {
    const prepared = await repository.prepareCheckout({
      bookingReference: checkoutBookingReference,
      performedBy: receptionistId,
    });

    expect(prepared.previouslyPaid).toBe(10000);

    await dataSource.query(
      `
      INSERT INTO payments (
        booking_id,
        payment_method,
        amount,
        payment_status,
        paid_at
      )
      VALUES (
        $1,
        'CASH',
        5000,
        'COMPLETED',
        NOW()
      )
      `,
      [checkoutBookingReference],
    );

    await expect(
      repository.commitCheckout({
        bookingReference: checkoutBookingReference,
        performedBy: receptionistId,
        roomNumber: 'P1201',
        folioTotal: 66000,
        previouslyPaid: prepared.previouslyPaid,
        finalPaymentAmount: 56000,
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).rejects.toThrow(
      'Completed-payment total changed before checkout could be committed',
    );

    const bookingRows = await dataSource.query(
      `
      SELECT status::text AS "status"
      FROM bookings
      WHERE booking_id = $1
      `,
      [checkoutBookingReference],
    );

    const roomRows = await dataSource.query(
      `
      SELECT status::text AS "status"
      FROM rooms
      WHERE room_number = 'P1201'
      `,
    );

    expect(bookingRows[0].status).toBe('CHECKED_IN');
    expect(roomRows[0].status).toBe('OCCUPIED');
  });

  it('rolls back payment, booking and room changes when checkout audit persistence fails', async () => {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION
        fail_plan12_checkout_audit_insert()
      RETURNS TRIGGER AS $$
      BEGIN
        IF
          NEW.action = 'CHECK_OUT'
          AND NEW.entity_id =
            '${checkoutBookingReference}'
        THEN
          RAISE EXCEPTION
            'forced Plan 12 checkout audit failure';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await dataSource.query(`
      CREATE TRIGGER
        fail_plan12_checkout_audit_insert_trigger
      BEFORE INSERT ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION
        fail_plan12_checkout_audit_insert()
    `);

    await expect(
      repository.commitCheckout({
        bookingReference: checkoutBookingReference,
        performedBy: receptionistId,
        roomNumber: 'P1201',
        folioTotal: 66000,
        previouslyPaid: 10000,
        finalPaymentAmount: 56000,
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).rejects.toThrow('forced Plan 12 checkout audit failure');

    const completedPaymentRows = await dataSource.query(
      `
      SELECT amount
      FROM payments
      WHERE
        booking_id = $1
        AND payment_status = 'COMPLETED'
      ORDER BY amount ASC
      `,
      [checkoutBookingReference],
    );

    expect(completedPaymentRows).toEqual([
      {
        amount: 10000,
      },
    ]);

    const bookingRows = await dataSource.query(
      `
      SELECT status::text AS "status"
      FROM bookings
      WHERE booking_id = $1
      `,
      [checkoutBookingReference],
    );

    const roomRows = await dataSource.query(
      `
      SELECT status::text AS "status"
      FROM rooms
      WHERE room_number = 'P1201'
      `,
    );

    const auditRows = await dataSource.query(
      `
      SELECT log_id
      FROM audit_logs
      WHERE
        action = 'CHECK_OUT'
        AND entity_type = 'BOOKING'
        AND entity_id = $1
      `,
      [checkoutBookingReference],
    );

    expect(bookingRows[0].status).toBe('CHECKED_IN');
    expect(roomRows[0].status).toBe('OCCUPIED');
    expect(auditRows).toHaveLength(0);
  });

  it('does not directly mutate FOSS sessions or WKMS tasks during checkout persistence', async () => {
    const fossCountBefore = await countRowsForBooking(
      'foss_sessions',
      checkoutBookingReference,
    );

    const wkmsCountBefore = await countRowsForBooking(
      'wkms_tasks',
      checkoutBookingReference,
    );

    await repository.commitCheckout({
      bookingReference: checkoutBookingReference,
      performedBy: receptionistId,
      roomNumber: 'P1201',
      folioTotal: 66000,
      previouslyPaid: 10000,
      finalPaymentAmount: 56000,
      paymentMethod: CheckoutPaymentMethod.CASH,
    });

    const fossCountAfter = await countRowsForBooking(
      'foss_sessions',
      checkoutBookingReference,
    );

    const wkmsCountAfter = await countRowsForBooking(
      'wkms_tasks',
      checkoutBookingReference,
    );

    expect(fossCountAfter).toBe(fossCountBefore);
    expect(wkmsCountAfter).toBe(wkmsCountBefore);
  });

  async function createPlan12Fixtures(): Promise<void> {
    await dataSource.query(`
      INSERT INTO rooms (
        room_number,
        room_type_id,
        floor,
        status,
        notes
      )
      VALUES
      (
        'P1201',
        '${roomTypeId}',
        12,
        'OCCUPIED',
        'Plan 12 checkout fixture'
      ),
      (
        'P1202',
        '${roomTypeId}',
        12,
        'OCCUPIED',
        'Plan 12 fully-paid checkout fixture'
      ),
      (
        'P1203',
        '${roomTypeId}',
        12,
        'VACANT',
        'Plan 12 non-checked-in fixture'
      ),
      (
        'P1204',
        '${roomTypeId}',
        12,
        'REQUIRES_CLEANING',
        'Plan 12 invalid room-state fixture'
      )
      ON CONFLICT (room_number) DO NOTHING
    `);

    await dataSource.query(`
      INSERT INTO bookings (
        booking_id,
        guest_id,
        room_type_id,
        room_number,
        check_in_date,
        check_out_date,
        status,
        total_amount,
        source,
        special_requests,
        num_guests
      )
      VALUES
      (
        '${checkoutBookingReference}',
        '${guestId}',
        '${roomTypeId}',
        'P1201',
        DATE '2036-01-10',
        DATE '2036-01-12',
        'CHECKED_IN',
        66000,
        'WEBSITE',
        'Plan 12 checkout fixture',
        1
      ),
      (
        '${fullyPaidBookingReference}',
        '${guestId}',
        '${roomTypeId}',
        'P1202',
        DATE '2036-02-10',
        DATE '2036-02-12',
        'CHECKED_IN',
        60000,
        'WEBSITE',
        'Plan 12 fully-paid fixture',
        1
      ),
      (
        '${confirmedBookingReference}',
        '${guestId}',
        '${roomTypeId}',
        'P1203',
        DATE '2036-03-10',
        DATE '2036-03-12',
        'CONFIRMED',
        30000,
        'WEBSITE',
        'Plan 12 confirmed fixture',
        1
      ),
      (
        '${invalidRoomStateBookingReference}',
        '${guestId}',
        '${roomTypeId}',
        'P1204',
        DATE '2036-04-10',
        DATE '2036-04-12',
        'CHECKED_IN',
        30000,
        'WEBSITE',
        'Plan 12 invalid room-state fixture',
        1
      )
      ON CONFLICT (booking_id) DO NOTHING
    `);
  }

  async function resetPlan12State(): Promise<void> {
    await dropFailureTrigger();

    const bookingReferences = [
      checkoutBookingReference,
      fullyPaidBookingReference,
      confirmedBookingReference,
      invalidRoomStateBookingReference,
    ];

    await dataSource.query(
      `
      DELETE FROM audit_logs
      WHERE
        entity_type = 'BOOKING'
        AND entity_id = ANY($1::text[])
      `,
      [bookingReferences],
    );

    await dataSource.query(
      `
      DELETE FROM payments
      WHERE booking_id = ANY($1::uuid[])
      `,
      [bookingReferences],
    );

    await dataSource.query(
      `
      DELETE FROM wkms_tasks
      WHERE booking_id = ANY($1::uuid[])
      `,
      [bookingReferences],
    );

    await dataSource.query(
      `
      DELETE FROM foss_sessions
      WHERE booking_id = ANY($1::uuid[])
      `,
      [bookingReferences],
    );

    await dataSource.query(
      `
      UPDATE bookings
      SET
        room_number = CASE booking_id
          WHEN $1::uuid THEN 'P1201'
          WHEN $2::uuid THEN 'P1202'
          WHEN $3::uuid THEN 'P1203'
          WHEN $4::uuid THEN 'P1204'
        END,
        status = CASE booking_id
          WHEN $1::uuid THEN 'CHECKED_IN'::booking_status
          WHEN $2::uuid THEN 'CHECKED_IN'::booking_status
          WHEN $3::uuid THEN 'CONFIRMED'::booking_status
          WHEN $4::uuid THEN 'CHECKED_IN'::booking_status
        END,
        updated_at = NOW()
      WHERE booking_id IN ($1, $2, $3, $4)
      `,
      bookingReferences,
    );

    await dataSource.query(`
      UPDATE rooms
      SET
        status = CASE room_number
          WHEN 'P1201' THEN 'OCCUPIED'::room_status
          WHEN 'P1202' THEN 'OCCUPIED'::room_status
          WHEN 'P1203' THEN 'VACANT'::room_status
          WHEN 'P1204' THEN 'REQUIRES_CLEANING'::room_status
        END,
        updated_at = NOW()
      WHERE room_number IN (
        'P1201',
        'P1202',
        'P1203',
        'P1204'
      )
    `);

    await dataSource.query(
      `
      INSERT INTO payments (
        booking_id,
        payment_method,
        amount,
        payment_status,
        paid_at
      )
      VALUES
      ($1, 'CASH', 10000, 'COMPLETED', NOW()),
      ($1, 'CARD_ON_SITE', 1000, 'PENDING', NULL),
      ($1, 'CASH', 2000, 'FAILED', NULL),
      ($1, 'CASH', 3000, 'REFUNDED', NOW()),
      ($2, 'CASH', 60000, 'COMPLETED', NOW())
      `,
      [checkoutBookingReference, fullyPaidBookingReference],
    );
  }

  async function removePlan12Fixtures(): Promise<void> {
    const bookingReferences = [
      checkoutBookingReference,
      fullyPaidBookingReference,
      confirmedBookingReference,
      invalidRoomStateBookingReference,
    ];

    await dataSource.query(
      `
      DELETE FROM audit_logs
      WHERE
        entity_type = 'BOOKING'
        AND entity_id = ANY($1::text[])
      `,
      [bookingReferences],
    );

    await dataSource.query(
      `
      DELETE FROM wkms_tasks
      WHERE booking_id = ANY($1::uuid[])
      `,
      [bookingReferences],
    );

    await dataSource.query(
      `
      DELETE FROM foss_sessions
      WHERE booking_id = ANY($1::uuid[])
      `,
      [bookingReferences],
    );

    await dataSource.query(
      `
      DELETE FROM payments
      WHERE booking_id = ANY($1::uuid[])
      `,
      [bookingReferences],
    );

    await dataSource.query(
      `
      DELETE FROM bookings
      WHERE booking_id = ANY($1::uuid[])
      `,
      [bookingReferences],
    );

    await dataSource.query(`
      DELETE FROM rooms
      WHERE room_number IN (
        'P1201',
        'P1202',
        'P1203',
        'P1204'
      )
    `);
  }

  async function countPayments(bookingReference: string): Promise<number> {
    const rows = await dataSource.query(
      `
      SELECT COUNT(*)::int AS "count"
      FROM payments
      WHERE booking_id = $1
      `,
      [bookingReference],
    );

    return Number(rows[0].count);
  }

  async function countRowsForBooking(
    tableName: 'foss_sessions' | 'wkms_tasks',
    bookingReference: string,
  ): Promise<number> {
    const rows = await dataSource.query(
      `
      SELECT COUNT(*)::int AS "count"
      FROM ${tableName}
      WHERE booking_id = $1
      `,
      [bookingReference],
    );

    return Number(rows[0].count);
  }

  async function dropFailureTrigger(): Promise<void> {
    await dataSource.query(`
      DROP TRIGGER IF EXISTS
        fail_plan12_checkout_audit_insert_trigger
      ON audit_logs
    `);

    await dataSource.query(`
      DROP FUNCTION IF EXISTS
        fail_plan12_checkout_audit_insert()
    `);
  }
});
