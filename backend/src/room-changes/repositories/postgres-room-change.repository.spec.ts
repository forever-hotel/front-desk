import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoomStatus } from '../../rooms/models/room-status';
import { PostgresRoomChangeRepository } from './postgres-room-change.repository';

describe('PostgresRoomChangeRepository', () => {
  let repository: PostgresRoomChangeRepository;

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

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const performedBy = '66666666-6666-4666-8666-666666666666';

  const roomTypeId = '11111111-1111-4111-8111-111111111111';

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

    repository = new PostgresRoomChangeRepository(
      dataSource as unknown as DataSource,
    );
  });

  describe('findAvailableRooms', () => {
    it('should return only eligible available-room rows', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T105',
            roomTypeId,
            roomTypeName: 'Standard',
            floor: 1,
            status: RoomStatus.VACANT,
            lastClearedAt: new Date('2032-01-10T08:00:00.000Z'),
            updatedAt: '2032-01-10T09:00:00.000Z',
          },
        ]);

      const result = await repository.findAvailableRooms(bookingReference);

      expect(result).toEqual([
        {
          roomNumber: 'T105',
          roomTypeId,
          roomTypeName: 'Standard',
          floor: 1,
          status: RoomStatus.VACANT,
          lastClearedAt: '2032-01-10T08:00:00.000Z',
          updatedAt: '2032-01-10T09:00:00.000Z',
        },
      ]);

      expect(dataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("r.status = 'VACANT'"),
        [roomTypeId, 'T102', bookingReference, '2032-01-10', '2032-01-12'],
      );

      expect(dataSource.query.mock.calls[1][0]).toContain('NOT EXISTS');

      expect(dataSource.query.mock.calls[1][0]).toContain(
        'conflicting_booking.status IN',
      );
    });

    it('should reject an unknown booking', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        repository.findAvailableRooms(bookingReference),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should reject a booking that is not checked in', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          bookingId: bookingReference,
          roomTypeId,
          roomNumber: 'T102',
          status: 'CONFIRMED',
          checkInDate: '2032-01-10',
          checkOutDate: '2032-01-12',
        },
      ]);

      await expect(
        repository.findAvailableRooms(bookingReference),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject a checked-in booking without an assigned room', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          bookingId: bookingReference,
          roomTypeId,
          roomNumber: null,
          status: 'CHECKED_IN',
          checkInDate: '2032-01-10',
          checkOutDate: '2032-01-12',
        },
      ]);

      await expect(
        repository.findAvailableRooms(bookingReference),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changeRoom', () => {
    function mockValidFlow(): void {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomTypeId,
            status: RoomStatus.OCCUPIED,
          },
          {
            roomNumber: 'T105',
            roomTypeId,
            status: RoomStatus.VACANT,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          [
            {
              logId: '88888888-8888-4888-8888-888888888888',
            },
          ],
          1,
        ]);
    }

    it('should atomically reassign the booking, update both rooms and create audit', async () => {
      mockValidFlow();

      const result = await repository.changeRoom({
        bookingReference,
        targetRoomNumber: 'T105',
        performedBy,
        reason: 'Guest requested quieter room',
      });

      expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);

      expect(queryRunner.query.mock.calls[1][0]).toContain('FOR UPDATE');

      expect(queryRunner.query.mock.calls[2][0]).toContain(
        'ORDER BY room_number ASC',
      );

      expect(queryRunner.query.mock.calls[2][0]).toContain('FOR UPDATE');

      expect(queryRunner.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('booking_id <> $2'),
        ['T105', bookingReference, '2032-01-10', '2032-01-12'],
      );

      expect(queryRunner.query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('UPDATE bookings'),
        ['T105', bookingReference],
      );

      expect(queryRunner.query).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining("status = 'REQUIRES_CLEANING'"),
        ['T102'],
      );

      expect(queryRunner.query).toHaveBeenNthCalledWith(
        7,
        expect.stringContaining("status = 'OCCUPIED'"),
        ['T105'],
      );

      expect(queryRunner.query.mock.calls[7][0]).toContain("'ROOM_CHANGE'");

      expect(queryRunner.query.mock.calls[7][1]).toEqual([
        performedBy,
        bookingReference,
        JSON.stringify({
          previousRoomNumber: 'T102',
          targetRoomNumber: 'T105',
          reason: 'Guest requested quieter room',
        }),
      ]);

      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();

      expect(result).toEqual({
        status: 'room_changed',
        bookingReference,
        previousRoomNumber: 'T102',
        roomNumber: 'T105',
        previousRoomStatus: RoomStatus.REQUIRES_CLEANING,
        roomStatus: RoomStatus.OCCUPIED,
        auditLogId: '88888888-8888-4888-8888-888888888888',
      });
    });

    it('should support a room change without a reason', async () => {
      mockValidFlow();

      await repository.changeRoom({
        bookingReference,
        targetRoomNumber: 'T105',
        performedBy,
      });

      const auditParameters = queryRunner.query.mock.calls[7][1];

      expect(auditParameters[2]).toBe(
        JSON.stringify({
          previousRoomNumber: 'T102',
          targetRoomNumber: 'T105',
          reason: null,
        }),
      );
    });

    it('should reject an invalid receptionist', async () => {
      queryRunner.query.mockResolvedValueOnce([]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should reject a non-receptionist staff member', async () => {
      queryRunner.query.mockResolvedValueOnce([
        {
          workerId: performedBy,
          role: 'MANAGER',
          isActive: true,
        },
      ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject an inactive receptionist', async () => {
      queryRunner.query.mockResolvedValueOnce([
        {
          workerId: performedBy,
          role: 'RECEPTIONIST',
          isActive: false,
        },
      ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject an unknown booking', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should reject a booking that is not checked in', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CONFIRMED',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject a booking without a current room', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: null,
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject changing to the current room', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T102',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject an unknown target room', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomTypeId,
            status: RoomStatus.OCCUPIED,
          },
        ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T999',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should reject when the current room is not occupied', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomTypeId,
            status: RoomStatus.VACANT,
          },
          {
            roomNumber: 'T105',
            roomTypeId,
            status: RoomStatus.VACANT,
          },
        ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject a target room of another room type', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomTypeId,
            status: RoomStatus.OCCUPIED,
          },
          {
            roomNumber: 'T205',
            roomTypeId: '22222222-2222-4222-8222-222222222222',
            status: RoomStatus.VACANT,
          },
        ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T205',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      RoomStatus.OCCUPIED,
      RoomStatus.REQUIRES_CLEANING,
      RoomStatus.UNDER_MAINTENANCE,
    ])('should reject target room with status %s', async (targetStatus) => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomTypeId,
            status: RoomStatus.OCCUPIED,
          },
          {
            roomNumber: 'T105',
            roomTypeId,
            status: targetStatus,
          },
        ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject a target room with an overlapping booking after locking it', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomTypeId,
            status: RoomStatus.OCCUPIED,
          },
          {
            roomNumber: 'T105',
            roomTypeId,
            status: RoomStatus.VACANT,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: '99999999-9999-4999-8999-999999999999',
          },
        ]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(queryRunner.query).toHaveBeenCalledTimes(4);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should roll back when audit persistence returns no record', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingId: bookingReference,
            roomTypeId,
            roomNumber: 'T102',
            status: 'CHECKED_IN',
            checkInDate: '2032-01-10',
            checkOutDate: '2032-01-12',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomTypeId,
            status: RoomStatus.OCCUPIED,
          },
          {
            roomNumber: 'T105',
            roomTypeId,
            status: RoomStatus.VACANT,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[], 0]);

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toThrow(
        'Room change audit record was not returned after insert',
      );

      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should roll back and rethrow an unexpected database error', async () => {
      queryRunner.query.mockRejectedValueOnce(new Error('database failure'));

      await expect(
        repository.changeRoom({
          bookingReference,
          targetRoomNumber: 'T105',
          performedBy,
        }),
      ).rejects.toThrow('database failure');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });
});
