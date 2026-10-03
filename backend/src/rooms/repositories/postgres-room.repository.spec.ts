import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoomStatus } from '../models/room-status';
import { PostgresRoomRepository } from './postgres-room.repository';

describe('PostgresRoomRepository', () => {
  let repository: PostgresRoomRepository;

  let dataSource: {
    query: jest.Mock;
    createQueryRunner: jest.Mock;
  };

  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    query: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
  };

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      query: jest.fn(),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };

    dataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn(() => queryRunner),
    };

    repository = new PostgresRoomRepository(
      dataSource as unknown as DataSource,
    );
  });

  it('should return all supported room states for the status board', async () => {
    dataSource.query.mockResolvedValue([
      {
        roomNumber: 'T101',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeName: 'Standard',
        floor: 1,
        status: RoomStatus.VACANT,
        lastClearedAt: new Date('2032-01-10T08:00:00.000Z'),
        updatedAt: new Date('2032-01-10T08:00:00.000Z'),
      },
      {
        roomNumber: 'T102',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeName: 'Standard',
        floor: 1,
        status: RoomStatus.OCCUPIED,
        lastClearedAt: '2032-01-09T08:00:00.000Z',
        updatedAt: '2032-01-10T09:00:00.000Z',
      },
      {
        roomNumber: 'T103',
        roomTypeId: '22222222-2222-4222-8222-222222222222',
        roomTypeName: 'Deluxe',
        floor: 1,
        status: RoomStatus.REQUIRES_CLEANING,
        lastClearedAt: null,
        updatedAt: new Date('2032-01-10T10:00:00.000Z'),
      },
      {
        roomNumber: 'T201',
        roomTypeId: '22222222-2222-4222-8222-222222222222',
        roomTypeName: 'Deluxe',
        floor: 2,
        status: RoomStatus.UNDER_MAINTENANCE,
        lastClearedAt: null,
        updatedAt: '2032-01-10T11:00:00.000Z',
      },
    ]);

    const result = await repository.findAllStatuses();

    expect(result).toEqual([
      {
        roomNumber: 'T101',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeName: 'Standard',
        floor: 1,
        status: RoomStatus.VACANT,
        lastClearedAt: '2032-01-10T08:00:00.000Z',
        updatedAt: '2032-01-10T08:00:00.000Z',
      },
      {
        roomNumber: 'T102',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeName: 'Standard',
        floor: 1,
        status: RoomStatus.OCCUPIED,
        lastClearedAt: '2032-01-09T08:00:00.000Z',
        updatedAt: '2032-01-10T09:00:00.000Z',
      },
      {
        roomNumber: 'T103',
        roomTypeId: '22222222-2222-4222-8222-222222222222',
        roomTypeName: 'Deluxe',
        floor: 1,
        status: RoomStatus.REQUIRES_CLEANING,
        lastClearedAt: null,
        updatedAt: '2032-01-10T10:00:00.000Z',
      },
      {
        roomNumber: 'T201',
        roomTypeId: '22222222-2222-4222-8222-222222222222',
        roomTypeName: 'Deluxe',
        floor: 2,
        status: RoomStatus.UNDER_MAINTENANCE,
        lastClearedAt: null,
        updatedAt: '2032-01-10T11:00:00.000Z',
      },
    ]);
  });

  it('should block maintenance and create an audit entry atomically', async () => {
    queryRunner.query
      .mockResolvedValueOnce([
        {
          roomNumber: 'T103',
          status: RoomStatus.VACANT,
        },
      ])
      .mockResolvedValueOnce([
        {
          workerId: receptionistId,
          role: 'RECEPTIONIST',
          isActive: true,
        },
      ])
      .mockResolvedValueOnce([
        [
          {
            roomNumber: 'T103',
            status: RoomStatus.UNDER_MAINTENANCE,
            lastClearedAt: '2032-01-09T08:00:00.000Z',
            updatedAt: '2032-01-10T11:00:00.000Z',
          },
        ],
        1,
      ])
      .mockResolvedValueOnce([]);

    const result = await repository.transitionStatus({
      roomNumber: 'T103',
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      allowedCurrentStatuses: [RoomStatus.VACANT],
      performedBy: receptionistId,
      notes: 'Air-conditioner repair',
    });

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FOR UPDATE'),
      ['T103'],
    );

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM staff_users'),
      [receptionistId],
    );

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE rooms'),
      [RoomStatus.UNDER_MAINTENANCE, 'T103'],
    );

    const auditCall = queryRunner.query.mock.calls[3];

    expect(auditCall[0]).toContain('INSERT INTO audit_logs');

    expect(auditCall[1]).toEqual([
      receptionistId,
      'ROOM_MAINTENANCE_BLOCKED',
      'T103',
      JSON.stringify({
        previousStatus: RoomStatus.VACANT,
        targetStatus: RoomStatus.UNDER_MAINTENANCE,
        notes: 'Air-conditioner repair',
      }),
    ]);

    expect(result).toEqual({
      kind: 'updated',
      value: {
        roomNumber: 'T103',
        previousStatus: RoomStatus.VACANT,
        status: RoomStatus.UNDER_MAINTENANCE,
        lastClearedAt: '2032-01-09T08:00:00.000Z',
        updatedAt: '2032-01-10T11:00:00.000Z',
      },
    });

    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('should clear maintenance, update lastClearedAt and audit the clear', async () => {
    queryRunner.query
      .mockResolvedValueOnce([
        {
          roomNumber: 'T104',
          status: RoomStatus.UNDER_MAINTENANCE,
        },
      ])
      .mockResolvedValueOnce([
        {
          workerId: receptionistId,
          role: 'RECEPTIONIST',
          isActive: true,
        },
      ])
      .mockResolvedValueOnce([
        [
          {
            roomNumber: 'T104',
            status: RoomStatus.VACANT,
            lastClearedAt: '2032-01-10T12:00:00.000Z',
            updatedAt: '2032-01-10T12:00:00.000Z',
          },
        ],
        1,
      ])
      .mockResolvedValueOnce([]);

    const result = await repository.transitionStatus({
      roomNumber: 'T104',
      targetStatus: RoomStatus.VACANT,
      allowedCurrentStatuses: [
        RoomStatus.REQUIRES_CLEANING,
        RoomStatus.UNDER_MAINTENANCE,
      ],
      performedBy: receptionistId,
      notes: 'Maintenance completed',
    });

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("WHEN $1::room_status = 'VACANT'::room_status"),
      [RoomStatus.VACANT, 'T104'],
    );

    const auditCall = queryRunner.query.mock.calls[3];

    expect(auditCall[0]).toContain('INSERT INTO audit_logs');

    expect(auditCall[1]).toEqual([
      receptionistId,
      'ROOM_MAINTENANCE_CLEARED',
      'T104',
      JSON.stringify({
        previousStatus: RoomStatus.UNDER_MAINTENANCE,
        targetStatus: RoomStatus.VACANT,
        notes: 'Maintenance completed',
      }),
    ]);

    expect(result).toEqual({
      kind: 'updated',
      value: {
        roomNumber: 'T104',
        previousStatus: RoomStatus.UNDER_MAINTENANCE,
        status: RoomStatus.VACANT,
        lastClearedAt: '2032-01-10T12:00:00.000Z',
        updatedAt: '2032-01-10T12:00:00.000Z',
      },
    });

    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('should allow REQUIRES_CLEANING to VACANT without maintenance audit metadata', async () => {
    queryRunner.query
      .mockResolvedValueOnce([
        {
          roomNumber: 'T105',
          status: RoomStatus.REQUIRES_CLEANING,
        },
      ])
      .mockResolvedValueOnce([
        {
          roomNumber: 'T105',
          status: RoomStatus.VACANT,
          lastClearedAt: '2032-01-10T13:00:00.000Z',
          updatedAt: '2032-01-10T13:00:00.000Z',
        },
      ]);

    const result = await repository.transitionStatus({
      roomNumber: 'T105',
      targetStatus: RoomStatus.VACANT,
      allowedCurrentStatuses: [
        RoomStatus.REQUIRES_CLEANING,
        RoomStatus.UNDER_MAINTENANCE,
      ],
    });

    expect(result).toEqual({
      kind: 'updated',
      value: {
        roomNumber: 'T105',
        previousStatus: RoomStatus.REQUIRES_CLEANING,
        status: RoomStatus.VACANT,
        lastClearedAt: '2032-01-10T13:00:00.000Z',
        updatedAt: '2032-01-10T13:00:00.000Z',
      },
    });

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
  });

  it('should require performedBy for a maintenance transition', async () => {
    queryRunner.query.mockResolvedValueOnce([
      {
        roomNumber: 'T103',
        status: RoomStatus.VACANT,
      },
    ]);

    await expect(
      repository.transitionStatus({
        roomNumber: 'T103',
        targetStatus: RoomStatus.UNDER_MAINTENANCE,
        allowedCurrentStatuses: [RoomStatus.VACANT],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('should reject maintenance change by a non-receptionist', async () => {
    queryRunner.query
      .mockResolvedValueOnce([
        {
          roomNumber: 'T103',
          status: RoomStatus.VACANT,
        },
      ])
      .mockResolvedValueOnce([
        {
          workerId: receptionistId,
          role: 'WORKER',
          isActive: true,
        },
      ]);

    await expect(
      repository.transitionStatus({
        roomNumber: 'T103',
        targetStatus: RoomStatus.UNDER_MAINTENANCE,
        allowedCurrentStatuses: [RoomStatus.VACANT],
        performedBy: receptionistId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('should reject maintenance change by an inactive receptionist', async () => {
    queryRunner.query
      .mockResolvedValueOnce([
        {
          roomNumber: 'T103',
          status: RoomStatus.VACANT,
        },
      ])
      .mockResolvedValueOnce([
        {
          workerId: receptionistId,
          role: 'RECEPTIONIST',
          isActive: false,
        },
      ]);

    await expect(
      repository.transitionStatus({
        roomNumber: 'T103',
        targetStatus: RoomStatus.UNDER_MAINTENANCE,
        allowedCurrentStatuses: [RoomStatus.VACANT],
        performedBy: receptionistId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should return not_found and roll back when the room does not exist', async () => {
    queryRunner.query.mockResolvedValueOnce([]);

    const result = await repository.transitionStatus({
      roomNumber: 'T999',
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      allowedCurrentStatuses: [RoomStatus.VACANT],
      performedBy: receptionistId,
    });

    expect(result).toEqual({
      kind: 'not_found',
    });

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('should return same_state without updating the room', async () => {
    queryRunner.query.mockResolvedValueOnce([
      {
        roomNumber: 'T101',
        status: RoomStatus.VACANT,
      },
    ]);

    const result = await repository.transitionStatus({
      roomNumber: 'T101',
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

    expect(queryRunner.query).toHaveBeenCalledTimes(1);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('should return blocked without updating an invalid transition', async () => {
    queryRunner.query.mockResolvedValueOnce([
      {
        roomNumber: 'T102',
        status: RoomStatus.OCCUPIED,
      },
    ]);

    const result = await repository.transitionStatus({
      roomNumber: 'T102',
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      allowedCurrentStatuses: [RoomStatus.VACANT],
      performedBy: receptionistId,
    });

    expect(result).toEqual({
      kind: 'blocked',
      currentStatus: RoomStatus.OCCUPIED,
    });

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it('should roll back a maintenance change when audit insertion fails', async () => {
    queryRunner.query
      .mockResolvedValueOnce([
        {
          roomNumber: 'T103',
          status: RoomStatus.VACANT,
        },
      ])
      .mockResolvedValueOnce([
        {
          workerId: receptionistId,
          role: 'RECEPTIONIST',
          isActive: true,
        },
      ])
      .mockResolvedValueOnce([
        [
          {
            roomNumber: 'T103',
            status: RoomStatus.UNDER_MAINTENANCE,
            lastClearedAt: '2032-01-09T08:00:00.000Z',
            updatedAt: '2032-01-10T11:00:00.000Z',
          },
        ],
        1,
      ])
      .mockRejectedValueOnce(new Error('audit failure'));

    await expect(
      repository.transitionStatus({
        roomNumber: 'T103',
        targetStatus: RoomStatus.UNDER_MAINTENANCE,
        allowedCurrentStatuses: [RoomStatus.VACANT],
        performedBy: receptionistId,
      }),
    ).rejects.toThrow('audit failure');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should roll back when an UPDATE unexpectedly returns no room', async () => {
    queryRunner.query
      .mockResolvedValueOnce([
        {
          roomNumber: 'T105',
          status: RoomStatus.REQUIRES_CLEANING,
        },
      ])
      .mockResolvedValueOnce([[], 0]);

    await expect(
      repository.transitionStatus({
        roomNumber: 'T105',
        targetStatus: RoomStatus.VACANT,
        allowedCurrentStatuses: [
          RoomStatus.REQUIRES_CLEANING,
          RoomStatus.UNDER_MAINTENANCE,
        ],
      }),
    ).rejects.toThrow('Room T105 was not returned after status update');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('should roll back and rethrow an unexpected database error', async () => {
    queryRunner.query.mockRejectedValueOnce(new Error('database failure'));

    await expect(
      repository.transitionStatus({
        roomNumber: 'T103',
        targetStatus: RoomStatus.UNDER_MAINTENANCE,
        allowedCurrentStatuses: [RoomStatus.VACANT],
        performedBy: receptionistId,
      }),
    ).rejects.toThrow('database failure');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
