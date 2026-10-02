import { Test, TestingModule } from '@nestjs/testing';
import { RoomStatus } from './models/room-status';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

describe('RoomsController', () => {
  let controller: RoomsController;
  let service: jest.Mocked<RoomsService>;

  beforeEach(async () => {
    const serviceMock = {
      getStatusBoard: jest.fn(),
      updateStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        {
          provide: RoomsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(RoomsController);
    service = module.get(RoomsService);
  });

  it('should delegate the status board request to the service', async () => {
    const rooms = [
      {
        roomNumber: 'T101',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeName: 'Standard',
        floor: 1,
        status: RoomStatus.VACANT,
        lastClearedAt: '2032-01-10T08:00:00.000Z',
        updatedAt: '2032-01-10T08:00:00.000Z',
      },
    ];

    service.getStatusBoard.mockResolvedValue(rooms);

    await expect(controller.getStatusBoard()).resolves.toEqual(rooms);

    expect(service.getStatusBoard).toHaveBeenCalledTimes(1);
  });

  it('should delegate a room status update to the service', async () => {
    const dto = {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
    };

    const result = {
      roomNumber: 'T103',
      previousStatus: RoomStatus.VACANT,
      status: RoomStatus.UNDER_MAINTENANCE,
      lastClearedAt: '2032-01-10T08:00:00.000Z',
      updatedAt: '2032-01-10T11:00:00.000Z',
    };

    service.updateStatus.mockResolvedValue(result);

    await expect(controller.updateStatus('T103', dto)).resolves.toEqual(result);

    expect(service.updateStatus).toHaveBeenCalledWith('T103', dto);

    expect(service.updateStatus).toHaveBeenCalledTimes(1);
  });
});
