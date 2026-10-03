import { Test, TestingModule } from '@nestjs/testing';
import { RoomStatus } from '../rooms/models/room-status';
import { RoomChangesController } from './room-changes.controller';
import { RoomChangesService } from './room-changes.service';

describe('RoomChangesController', () => {
  let controller: RoomChangesController;
  let service: jest.Mocked<RoomChangesService>;

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const performedBy = '66666666-6666-4666-8666-666666666666';

  beforeEach(async () => {
    const serviceMock = {
      findAvailableRooms: jest.fn(),
      changeRoom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomChangesController],
      providers: [
        {
          provide: RoomChangesService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(RoomChangesController);
    service = module.get(RoomChangesService);
  });

  it('should delegate available-room lookup', async () => {
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

    service.findAvailableRooms.mockResolvedValue(rooms);

    await expect(
      controller.findAvailableRooms(bookingReference),
    ).resolves.toEqual(rooms);

    expect(service.findAvailableRooms).toHaveBeenCalledWith(bookingReference);
  });

  it('should delegate a room-change request', async () => {
    const dto = {
      bookingReference,
      targetRoomNumber: 'T105',
      performedBy,
      reason: 'Guest requested quieter room',
    };

    const result = {
      status: 'room_changed' as const,
      bookingReference,
      previousRoomNumber: 'T102',
      roomNumber: 'T105',
      previousRoomStatus: RoomStatus.REQUIRES_CLEANING as const,
      roomStatus: RoomStatus.OCCUPIED as const,
      auditLogId: '88888888-8888-4888-8888-888888888888',
    };

    service.changeRoom.mockResolvedValue(result);

    await expect(controller.changeRoom(dto)).resolves.toEqual(result);

    expect(service.changeRoom).toHaveBeenCalledWith(dto);
  });
});
