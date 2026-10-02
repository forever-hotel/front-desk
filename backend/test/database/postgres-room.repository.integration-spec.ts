import { DataSource } from 'typeorm';
import { RoomStatus } from '../../src/rooms/models/room-status';
import { PostgresRoomRepository } from '../../src/rooms/repositories/postgres-room.repository';

describe('PostgresRoomRepository integration', () => {
  let dataSource: DataSource;
  let repository: PostgresRoomRepository;

  const roomNumbers = ['P901', 'P902', 'P903', 'P904'];

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

    repository = new PostgresRoomRepository(dataSource);

    await removePlan09Fixtures();

    await dataSource.query(`
      INSERT INTO rooms (
        room_number,
        room_type_id,
        floor,
        status,
        last_cleared_at,
        notes,
        updated_at
      )
      VALUES
      (
        'P901',
        '11111111-1111-4111-8111-111111111111',
        9,
        'VACANT',
        TIMESTAMPTZ '2030-01-01T08:00:00.000Z',
        'Plan 09 vacant-room fixture',
        TIMESTAMPTZ '2030-01-01T08:00:00.000Z'
      ),
      (
        'P902',
        '11111111-1111-4111-8111-111111111111',
        9,
        'OCCUPIED',
        TIMESTAMPTZ '2030-01-01T08:00:00.000Z',
        'Plan 09 occupied-room fixture',
        TIMESTAMPTZ '2030-01-01T09:00:00.000Z'
      ),
      (
        'P903',
        '11111111-1111-4111-8111-111111111111',
        9,
        'REQUIRES_CLEANING',
        NULL,
        'Plan 09 cleaning-room fixture',
        TIMESTAMPTZ '2030-01-01T10:00:00.000Z'
      ),
      (
        'P904',
        '11111111-1111-4111-8111-111111111111',
        9,
        'UNDER_MAINTENANCE',
        TIMESTAMPTZ '2030-01-01T07:00:00.000Z',
        'Plan 09 maintenance-room fixture',
        TIMESTAMPTZ '2030-01-01T11:00:00.000Z'
      )
    `);
  });

  beforeEach(async () => {
    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'VACANT',
        last_cleared_at =
          TIMESTAMPTZ '2030-01-01T08:00:00.000Z',
        updated_at =
          TIMESTAMPTZ '2030-01-01T08:00:00.000Z'
      WHERE room_number = 'P901'
    `);

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'OCCUPIED',
        last_cleared_at =
          TIMESTAMPTZ '2030-01-01T08:00:00.000Z',
        updated_at =
          TIMESTAMPTZ '2030-01-01T09:00:00.000Z'
      WHERE room_number = 'P902'
    `);

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'REQUIRES_CLEANING',
        last_cleared_at = NULL,
        updated_at =
          TIMESTAMPTZ '2030-01-01T10:00:00.000Z'
      WHERE room_number = 'P903'
    `);

    await dataSource.query(`
      UPDATE rooms
      SET
        status = 'UNDER_MAINTENANCE',
        last_cleared_at =
          TIMESTAMPTZ '2030-01-01T07:00:00.000Z',
        updated_at =
          TIMESTAMPTZ '2030-01-01T11:00:00.000Z'
      WHERE room_number = 'P904'
    `);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await removePlan09Fixtures();
      await dataSource.destroy();
    }
  });

  it('loads room-board data including all supported room states', async () => {
    const rooms = await repository.findAllStatuses();

    const plan09Rooms = rooms.filter((room) =>
      roomNumbers.includes(room.roomNumber),
    );

    expect(plan09Rooms).toHaveLength(4);

    expect(plan09Rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomNumber: 'P901',
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          roomTypeName: 'CI Standard Room',
          floor: 9,
          status: RoomStatus.VACANT,
        }),
        expect.objectContaining({
          roomNumber: 'P902',
          status: RoomStatus.OCCUPIED,
        }),
        expect.objectContaining({
          roomNumber: 'P903',
          status: RoomStatus.REQUIRES_CLEANING,
        }),
        expect.objectContaining({
          roomNumber: 'P904',
          status: RoomStatus.UNDER_MAINTENANCE,
        }),
      ]),
    );
  });

  it('transitions a VACANT room to UNDER_MAINTENANCE and preserves lastClearedAt', async () => {
    const result = await repository.transitionStatus({
      roomNumber: 'P901',
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      allowedCurrentStatuses: [RoomStatus.VACANT],
    });

    expect(result.kind).toBe('updated');

    if (result.kind !== 'updated') {
      throw new Error('Expected updated transition result');
    }

    expect(result.value).toEqual(
      expect.objectContaining({
        roomNumber: 'P901',
        previousStatus: RoomStatus.VACANT,
        status: RoomStatus.UNDER_MAINTENANCE,
        lastClearedAt: '2030-01-01T08:00:00.000Z',
      }),
    );

    const rows = (await dataSource.query(`
      SELECT
        status::text AS "status",
        last_cleared_at AS "lastClearedAt"
      FROM rooms
      WHERE room_number = 'P901'
    `)) as Array<{
      status: string;
      lastClearedAt: Date | null;
    }>;

    expect(rows[0].status).toBe(RoomStatus.UNDER_MAINTENANCE);

    expect(rows[0].lastClearedAt?.toISOString()).toBe(
      '2030-01-01T08:00:00.000Z',
    );
  });

  it('transitions REQUIRES_CLEANING to VACANT and sets lastClearedAt', async () => {
    const result = await repository.transitionStatus({
      roomNumber: 'P903',
      targetStatus: RoomStatus.VACANT,
      allowedCurrentStatuses: [
        RoomStatus.REQUIRES_CLEANING,
        RoomStatus.UNDER_MAINTENANCE,
      ],
    });

    expect(result.kind).toBe('updated');

    if (result.kind !== 'updated') {
      throw new Error('Expected updated transition result');
    }

    expect(result.value.roomNumber).toBe('P903');

    expect(result.value.previousStatus).toBe(RoomStatus.REQUIRES_CLEANING);

    expect(result.value.status).toBe(RoomStatus.VACANT);

    expect(result.value.lastClearedAt).not.toBeNull();

    const rows = (await dataSource.query(`
      SELECT
        status::text AS "status",
        last_cleared_at AS "lastClearedAt"
      FROM rooms
      WHERE room_number = 'P903'
    `)) as Array<{
      status: string;
      lastClearedAt: Date | null;
    }>;

    expect(rows[0].status).toBe(RoomStatus.VACANT);

    expect(rows[0].lastClearedAt).not.toBeNull();
  });

  it('transitions UNDER_MAINTENANCE to VACANT', async () => {
    const result = await repository.transitionStatus({
      roomNumber: 'P904',
      targetStatus: RoomStatus.VACANT,
      allowedCurrentStatuses: [
        RoomStatus.REQUIRES_CLEANING,
        RoomStatus.UNDER_MAINTENANCE,
      ],
    });

    expect(result.kind).toBe('updated');

    if (result.kind !== 'updated') {
      throw new Error('Expected updated transition result');
    }

    expect(result.value.previousStatus).toBe(RoomStatus.UNDER_MAINTENANCE);

    expect(result.value.status).toBe(RoomStatus.VACANT);

    expect(result.value.lastClearedAt).not.toBeNull();
  });

  it('returns same_state without changing the room', async () => {
    const result = await repository.transitionStatus({
      roomNumber: 'P901',
      targetStatus: RoomStatus.VACANT,
      allowedCurrentStatuses: [
        RoomStatus.REQUIRES_CLEANING,
        RoomStatus.UNDER_MAINTENANCE,
      ],
    });

    expect(result).toEqual({
      kind: 'same_state',
      currentStatus: RoomStatus.VACANT,
    });

    const rows = (await dataSource.query(`
      SELECT status::text AS "status"
      FROM rooms
      WHERE room_number = 'P901'
    `)) as Array<{
      status: string;
    }>;

    expect(rows[0].status).toBe(RoomStatus.VACANT);
  });

  it('returns blocked for an incompatible current status', async () => {
    const result = await repository.transitionStatus({
      roomNumber: 'P902',
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      allowedCurrentStatuses: [RoomStatus.VACANT],
    });

    expect(result).toEqual({
      kind: 'blocked',
      currentStatus: RoomStatus.OCCUPIED,
    });

    const rows = (await dataSource.query(`
      SELECT status::text AS "status"
      FROM rooms
      WHERE room_number = 'P902'
    `)) as Array<{
      status: string;
    }>;

    expect(rows[0].status).toBe(RoomStatus.OCCUPIED);
  });

  it('returns not_found for an unknown room', async () => {
    const result = await repository.transitionStatus({
      roomNumber: 'P999',
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      allowedCurrentStatuses: [RoomStatus.VACANT],
    });

    expect(result).toEqual({
      kind: 'not_found',
    });
  });

  async function removePlan09Fixtures(): Promise<void> {
    await dataSource.query(`
      DELETE FROM rooms
      WHERE room_number IN (
        'P901',
        'P902',
        'P903',
        'P904'
      )
    `);
  }
});
