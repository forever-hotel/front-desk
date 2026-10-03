import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomStatus } from '../rooms/models/room-status';
import { RoomChangeRepository } from './ports/room-change.repository';
import { RoomChangesService } from './room-changes.service';

describe('RoomChangesService', () => {
  let service: RoomChangesService;
  let repository: jest.Mocked<RoomChangeRepository>;

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const performedBy = '66666666-6666-4666-8666-666666666666';

  beforeEach(async () => {
    const repositoryMock = {
      findAvailableRooms: jest.fn(),
      changeRoom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomChangesService,
        {
          provide: RoomChangeRepository,
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get(RoomChangesService);
    repository = module.get(RoomChangeRepository);
  });

  it('should return available room-change options', async () => {
    const rooms = [
      {
        roomNumber: 'T105',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeName: 'Standard',
        floor: 1,
        status: RoomStatus.VACANT as const,
        lastClearedAt: '2032-01-10T08:00:00.000Z',
        updatedAt: '2032-01-10T08:00:00.000Z',
      },
    ];

    repository.findAvailableRooms.mockResolvedValue(rooms);

    await expect(service.findAvailableRooms(bookingReference)).resolves.toEqual(
      rooms,
    );

    expect(repository.findAvailableRooms).toHaveBeenCalledWith(
      bookingReference,
    );
  });

  it('should normalize room number and reason before room change', async () => {
    repository.changeRoom.mockResolvedValue({
      status: 'room_changed',
      bookingReference,
      previousRoomNumber: 'T102',
      roomNumber: 'T105',
      previousRoomStatus: RoomStatus.REQUIRES_CLEANING,
      roomStatus: RoomStatus.OCCUPIED,
      auditLogId: '88888888-8888-4888-8888-888888888888',
    });

    const result = await service.changeRoom({
      bookingReference,
      targetRoomNumber: ' t105 ',
      performedBy,
      reason: '  Guest requested quieter room  ',
    });

    expect(repository.changeRoom).toHaveBeenCalledWith({
      bookingReference,
      targetRoomNumber: 'T105',
      performedBy,
      reason: 'Guest requested quieter room',
    });

    expect(result.status).toBe('room_changed');
    expect(result.roomNumber).toBe('T105');
  });

  it('should omit an empty optional reason', async () => {
    repository.changeRoom.mockResolvedValue({
      status: 'room_changed',
      bookingReference,
      previousRoomNumber: 'T102',
      roomNumber: 'T105',
      previousRoomStatus: RoomStatus.REQUIRES_CLEANING,
      roomStatus: RoomStatus.OCCUPIED,
      auditLogId: '88888888-8888-4888-8888-888888888888',
    });

    await service.changeRoom({
      bookingReference,
      targetRoomNumber: 'T105',
      performedBy,
      reason: '   ',
    });

    expect(repository.changeRoom).toHaveBeenCalledWith({
      bookingReference,
      targetRoomNumber: 'T105',
      performedBy,
      reason: undefined,
    });
  });

  it('should reject an empty target room before accessing repository', async () => {
    await expect(
      service.changeRoom({
        bookingReference,
        targetRoomNumber: '   ',
        performedBy,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.changeRoom).not.toHaveBeenCalled();
  });
});
