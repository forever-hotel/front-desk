import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PostgresRoomChangeRepository } from '../../src/room-changes/repositories/postgres-room-change.repository';
import { RoomStatus } from '../../src/rooms/models/room-status';
import { PostgresRoomRepository } from '../../src/rooms/repositories/postgres-room.repository';

describe('Plan 10 room change and maintenance integration', () => {
  let dataSource: DataSource;
  let roomChangeRepository: PostgresRoomChangeRepository;
  let roomRepository: PostgresRoomRepository;

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const guestId = '22222222-2222-4222-8222-222222222222';

  const standardRoomTypeId = '11111111-1111-4111-8111-111111111111';

  const suiteRoomTypeId = '99999999-9999-4999-8999-999999999999';

  const bookingReference = '71000000-0000-4000-8000-000000000001';

  const conflictingBookingReference = '71000000-0000-4000-8000-000000000002';

  const plan10RoomNumbers = [
    'P1001',
    'P1002',
    'P1003',
    'P1004',
    'P1005',
    'P2001',
  ];

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

    roomChangeRepository = new PostgresRoomChangeRepository(dataSource);

    roomRepository = new PostgresRoomRepository(dataSource);

    await dropFailureTrigger();
    await removePlan10Fixtures();
    await createPlan10Fixtures();
  });

  beforeEach(async () => {
    await resetPlan10State();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dropFailureTrigger();
      await removePlan10Fixtures();
      await dataSource.destroy();
    }
  });

  it('returns only valid room-change options and excludes unavailable rooms', async () => {
    const rooms =
      await roomChangeRepository.findAvailableRooms(bookingReference);

    const plan10Rooms = rooms.filter((room) =>
      plan10RoomNumbers.includes(room.roomNumber),
    );

    expect(plan10Rooms.map((room) => room.roomNumber)).toEqual(['P1002']);

    expect(plan10Rooms[0]).toEqual(
      expect.objectContaining({
        roomNumber: 'P1002',
        roomTypeId: standardRoomTypeId,
        roomTypeName: 'CI Standard Room',
        floor: 10,
        status: RoomStatus.VACANT,
      }),
    );

    /*
     * P1001 = current room
     * P1003 = UNDER_MAINTENANCE
     * P1004 = REQUIRES_CLEANING
     * P1005 = VACANT but overlapping booking
     * P2001 = wrong room type
     */
    expect(plan10Rooms.map((room) => room.roomNumber)).not.toContain('P1001');

    expect(plan10Rooms.map((room) => room.roomNumber)).not.toContain('P1003');

    expect(plan10Rooms.map((room) => room.roomNumber)).not.toContain('P1004');

    expect(plan10Rooms.map((room) => room.roomNumber)).not.toContain('P1005');

    expect(plan10Rooms.map((room) => room.roomNumber)).not.toContain('P2001');
  });

  it('atomically reassigns a checked-in booking and audits the room change', async () => {
    const result = await roomChangeRepository.changeRoom({
      bookingReference,
      targetRoomNumber: 'P1002',
      performedBy: receptionistId,
      reason: 'Guest requested a quieter room',
    });

    expect(result).toEqual({
      status: 'room_changed',
      bookingReference,
      previousRoomNumber: 'P1001',
      roomNumber: 'P1002',
      previousRoomStatus: RoomStatus.REQUIRES_CLEANING,
      roomStatus: RoomStatus.OCCUPIED,
      auditLogId: expect.any(String),
    });

    const bookingRows = await dataSource.query(
      `
        SELECT
          room_number AS "roomNumber",
          status::text AS "status"
        FROM bookings
        WHERE booking_id = $1
        `,
      [bookingReference],
    );

    expect(bookingRows).toHaveLength(1);

    expect(bookingRows[0]).toEqual({
      roomNumber: 'P1002',
      status: 'CHECKED_IN',
    });

    const roomRows = await dataSource.query(
      `
        SELECT
          room_number AS "roomNumber",
          status::text AS "status"
        FROM rooms
        WHERE room_number IN (
          'P1001',
          'P1002'
        )
        ORDER BY room_number ASC
        `,
    );

    expect(roomRows).toEqual([
      {
        roomNumber: 'P1001',
        status: 'REQUIRES_CLEANING',
      },
      {
        roomNumber: 'P1002',
        status: 'OCCUPIED',
      },
    ]);

    const auditRows = await dataSource.query(
      `
        SELECT
          event_category::text
            AS "eventCategory",
          actor_type::text
            AS "actorType",
          staff_user_id::text
            AS "staffUserId",
          action,
          entity_type AS "entityType",
          entity_id AS "entityId",
          details
        FROM audit_logs
        WHERE log_id = $1
        `,
      [result.auditLogId],
    );

    expect(auditRows).toHaveLength(1);

    expect(auditRows[0]).toEqual(
      expect.objectContaining({
        eventCategory: 'FRONT_DESK_OPERATION',
        actorType: 'STAFF',
        staffUserId: receptionistId,
        action: 'ROOM_CHANGE',
        entityType: 'BOOKING',
        entityId: bookingReference,
      }),
    );

    expect(auditRows[0].details).toEqual({
      previousRoomNumber: 'P1001',
      targetRoomNumber: 'P1002',
      reason: 'Guest requested a quieter room',
    });

    expect(auditRows[0].details).not.toHaveProperty('guestName');

    expect(auditRows[0].details).not.toHaveProperty('email');

    expect(auditRows[0].details).not.toHaveProperty('nicOrPassport');
  });

  it('rejects an UNDER_MAINTENANCE target room', async () => {
    await expect(
      roomChangeRepository.changeRoom({
        bookingReference,
        targetRoomNumber: 'P1003',
        performedBy: receptionistId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const bookingRows = await dataSource.query(
      `
        SELECT
          room_number AS "roomNumber"
        FROM bookings
        WHERE booking_id = $1
        `,
      [bookingReference],
    );

    expect(bookingRows[0].roomNumber).toBe('P1001');

    const roomRows = await dataSource.query(
      `
        SELECT
          room_number AS "roomNumber",
          status::text AS "status"
        FROM rooms
        WHERE room_number IN (
          'P1001',
          'P1003'
        )
        ORDER BY room_number
        `,
    );

    expect(roomRows).toEqual([
      {
        roomNumber: 'P1001',
        status: 'OCCUPIED',
      },
      {
        roomNumber: 'P1003',
        status: 'UNDER_MAINTENANCE',
      },
    ]);
  });

  it('removes a room from availability while under maintenance and restores it after clearing', async () => {
    const beforeMaintenance =
      await roomChangeRepository.findAvailableRooms(bookingReference);

    expect(beforeMaintenance.some((room) => room.roomNumber === 'P1002')).toBe(
      true,
    );

    const blocked = await roomRepository.transitionStatus({
      roomNumber: 'P1002',
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      allowedCurrentStatuses: [RoomStatus.VACANT],
      performedBy: receptionistId,
      notes: 'Air-conditioner maintenance',
    });

    expect(blocked.kind).toBe('updated');

    if (blocked.kind !== 'updated') {
      throw new Error('Expected maintenance block to update room');
    }

    expect(blocked.value).toEqual(
      expect.objectContaining({
        roomNumber: 'P1002',
        previousStatus: RoomStatus.VACANT,
        status: RoomStatus.UNDER_MAINTENANCE,
      }),
    );

    const whileMaintenance =
      await roomChangeRepository.findAvailableRooms(bookingReference);

    expect(whileMaintenance.some((room) => room.roomNumber === 'P1002')).toBe(
      false,
    );

    const cleared = await roomRepository.transitionStatus({
      roomNumber: 'P1002',
      targetStatus: RoomStatus.VACANT,
      allowedCurrentStatuses: [RoomStatus.UNDER_MAINTENANCE],
      performedBy: receptionistId,
      notes: 'Maintenance completed',
    });

    expect(cleared.kind).toBe('updated');

    if (cleared.kind !== 'updated') {
      throw new Error('Expected maintenance clear to update room');
    }

    expect(cleared.value.status).toBe(RoomStatus.VACANT);

    expect(cleared.value.lastClearedAt).not.toBeNull();

    const afterClear =
      await roomChangeRepository.findAvailableRooms(bookingReference);

    expect(afterClear.some((room) => room.roomNumber === 'P1002')).toBe(true);

    const auditRows = await dataSource.query(
      `
        SELECT
          action,
          entity_type AS "entityType",
          entity_id AS "entityId",
          staff_user_id::text
            AS "staffUserId",
          details
        FROM audit_logs
        WHERE
          entity_type = 'ROOM'
          AND entity_id = 'P1002'
          AND action IN (
            'ROOM_MAINTENANCE_BLOCKED',
            'ROOM_MAINTENANCE_CLEARED'
          )
        ORDER BY created_at ASC
        `,
    );

    expect(auditRows.map((row: { action: string }) => row.action)).toEqual([
      'ROOM_MAINTENANCE_BLOCKED',
      'ROOM_MAINTENANCE_CLEARED',
    ]);

    expect(auditRows[0].staffUserId).toBe(receptionistId);

    expect(auditRows[0].details).toEqual(
      expect.objectContaining({
        previousStatus: 'VACANT',
        targetStatus: 'UNDER_MAINTENANCE',
        notes: 'Air-conditioner maintenance',
      }),
    );

    expect(auditRows[1].details).toEqual(
      expect.objectContaining({
        previousStatus: 'UNDER_MAINTENANCE',
        targetStatus: 'VACANT',
        notes: 'Maintenance completed',
      }),
    );
  });

  it('rolls back booking and both room changes when room-change audit persistence fails', async () => {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION
        fail_plan10_room_change_audit_insert()
      RETURNS TRIGGER AS $$
      BEGIN
        IF
          NEW.action = 'ROOM_CHANGE'
          AND NEW.entity_id =
            '${bookingReference}'
        THEN
          RAISE EXCEPTION
            'forced Plan 10 audit failure';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await dataSource.query(`
      CREATE TRIGGER
        fail_plan10_room_change_audit_insert_trigger
      BEFORE INSERT ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION
        fail_plan10_room_change_audit_insert()
    `);

    try {
      await expect(
        roomChangeRepository.changeRoom({
          bookingReference,
          targetRoomNumber: 'P1002',
          performedBy: receptionistId,
          reason: 'Rollback test',
        }),
      ).rejects.toThrow('forced Plan 10 audit failure');

      const bookingRows = await dataSource.query(
        `
          SELECT
            room_number AS "roomNumber",
            status::text AS "status"
          FROM bookings
          WHERE booking_id = $1
          `,
        [bookingReference],
      );

      expect(bookingRows).toHaveLength(1);

      expect(bookingRows[0]).toEqual({
        roomNumber: 'P1001',
        status: 'CHECKED_IN',
      });

      const roomRows = await dataSource.query(
        `
          SELECT
            room_number AS "roomNumber",
            status::text AS "status"
          FROM rooms
          WHERE room_number IN (
            'P1001',
            'P1002'
          )
          ORDER BY room_number ASC
          `,
      );

      expect(roomRows).toEqual([
        {
          roomNumber: 'P1001',
          status: 'OCCUPIED',
        },
        {
          roomNumber: 'P1002',
          status: 'VACANT',
        },
      ]);

      const auditRows = await dataSource.query(
        `
          SELECT log_id
          FROM audit_logs
          WHERE
            action = 'ROOM_CHANGE'
            AND entity_type = 'BOOKING'
            AND entity_id = $1
          `,
        [bookingReference],
      );

      expect(auditRows).toHaveLength(0);
    } finally {
      await dropFailureTrigger();
    }
  });

  async function createPlan10Fixtures(): Promise<void> {
    await dataSource.query(`
      INSERT INTO rooms (
        room_number,
        room_type_id,
        floor,
        status,
        last_cleared_at,
        notes
      )
      VALUES
      (
        'P1001',
        '${standardRoomTypeId}',
        10,
        'OCCUPIED',
        TIMESTAMPTZ
          '2035-01-09T08:00:00.000Z',
        'Plan 10 current guest room'
      ),
      (
        'P1002',
        '${standardRoomTypeId}',
        10,
        'VACANT',
        TIMESTAMPTZ
          '2035-01-10T08:00:00.000Z',
        'Plan 10 available target'
      ),
      (
        'P1003',
        '${standardRoomTypeId}',
        10,
        'UNDER_MAINTENANCE',
        TIMESTAMPTZ
          '2035-01-08T08:00:00.000Z',
        'Plan 10 maintenance exclusion'
      ),
      (
        'P1004',
        '${standardRoomTypeId}',
        10,
        'REQUIRES_CLEANING',
        NULL,
        'Plan 10 cleaning exclusion'
      ),
      (
        'P1005',
        '${standardRoomTypeId}',
        10,
        'VACANT',
        TIMESTAMPTZ
          '2035-01-10T08:00:00.000Z',
        'Plan 10 overlap exclusion'
      ),
      (
        'P2001',
        '${suiteRoomTypeId}',
        20,
        'VACANT',
        TIMESTAMPTZ
          '2035-01-10T08:00:00.000Z',
        'Plan 10 wrong room type'
      )
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
        '${bookingReference}',
        '${guestId}',
        '${standardRoomTypeId}',
        'P1001',
        DATE '2035-01-10',
        DATE '2035-01-15',
        'CHECKED_IN',
        75000,
        'WEBSITE',
        'Plan 10 active stay',
        1
      ),
      (
        '${conflictingBookingReference}',
        '${guestId}',
        '${standardRoomTypeId}',
        'P1005',
        DATE '2035-01-12',
        DATE '2035-01-16',
        'CONFIRMED',
        60000,
        'WEBSITE',
        'Plan 10 overlap fixture',
        1
      )
    `);
  }

  async function resetPlan10State(): Promise<void> {
    await dropFailureTrigger();

    await dataSource.query(
      `
      DELETE FROM audit_logs
      WHERE
        (
          entity_type = 'BOOKING'
          AND entity_id = $1
          AND action = 'ROOM_CHANGE'
        )
        OR
        (
          entity_type = 'ROOM'
          AND entity_id IN (
            'P1001',
            'P1002',
            'P1003',
            'P1004',
            'P1005',
            'P2001'
          )
          AND action IN (
            'ROOM_MAINTENANCE_BLOCKED',
            'ROOM_MAINTENANCE_CLEARED'
          )
        )
      `,
      [bookingReference],
    );

    await dataSource.query(
      `
      UPDATE bookings
      SET
        room_number = 'P1001',
        status = 'CHECKED_IN',
        updated_at = NOW()
      WHERE booking_id = $1
      `,
      [bookingReference],
    );

    await dataSource.query(
      `
      UPDATE bookings
      SET
        room_number = 'P1005',
        status = 'CONFIRMED',
        updated_at = NOW()
      WHERE booking_id = $1
      `,
      [conflictingBookingReference],
    );

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'OCCUPIED',
        last_cleared_at =
          TIMESTAMPTZ
            '2035-01-09T08:00:00.000Z',
        updated_at = NOW()
      WHERE room_number = 'P1001'
    `);

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'VACANT',
        last_cleared_at =
          TIMESTAMPTZ
            '2035-01-10T08:00:00.000Z',
        updated_at = NOW()
      WHERE room_number = 'P1002'
    `);

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'UNDER_MAINTENANCE',
        last_cleared_at =
          TIMESTAMPTZ
            '2035-01-08T08:00:00.000Z',
        updated_at = NOW()
      WHERE room_number = 'P1003'
    `);

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'REQUIRES_CLEANING',
        last_cleared_at = NULL,
        updated_at = NOW()
      WHERE room_number = 'P1004'
    `);

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'VACANT',
        last_cleared_at =
          TIMESTAMPTZ
            '2035-01-10T08:00:00.000Z',
        updated_at = NOW()
      WHERE room_number = 'P1005'
    `);

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'VACANT',
        last_cleared_at =
          TIMESTAMPTZ
            '2035-01-10T08:00:00.000Z',
        updated_at = NOW()
      WHERE room_number = 'P2001'
    `);
  }

  async function removePlan10Fixtures(): Promise<void> {
    await dataSource.query(
      `
      DELETE FROM audit_logs
      WHERE
        (
          entity_type = 'BOOKING'
          AND entity_id = $1
        )
        OR
        (
          entity_type = 'ROOM'
          AND entity_id IN (
            'P1001',
            'P1002',
            'P1003',
            'P1004',
            'P1005',
            'P2001'
          )
        )
      `,
      [bookingReference],
    );

    await dataSource.query(
      `
      DELETE FROM bookings
      WHERE booking_id IN (
        $1,
        $2
      )
      `,
      [bookingReference, conflictingBookingReference],
    );

    await dataSource.query(`
      DELETE FROM rooms
      WHERE room_number IN (
        'P1001',
        'P1002',
        'P1003',
        'P1004',
        'P1005',
        'P2001'
      )
    `);
  }

  async function dropFailureTrigger(): Promise<void> {
    await dataSource.query(`
      DROP TRIGGER IF EXISTS
        fail_plan10_room_change_audit_insert_trigger
      ON audit_logs
    `);

    await dataSource.query(`
      DROP FUNCTION IF EXISTS
        fail_plan10_room_change_audit_insert()
    `);
  }
});
