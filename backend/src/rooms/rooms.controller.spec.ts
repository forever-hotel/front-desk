import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { SystemRole } from '../security/auth/system-role';
import { RoomStatus } from './models/room-status';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

describe('RoomsController', () => {
  let controller: RoomsController;

  let service: {
    getStatusBoard: jest.Mock;
    updateStatus: jest.Mock;
  };

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const anotherReceptionistId = '77777777-7777-4777-8777-777777777777';

  const principal: AuthenticatedPrincipal = {
    userId: receptionistId,
    role: SystemRole.RECEPTIONIST,
  };

  beforeEach(() => {
    service = {
      getStatusBoard: jest.fn(),
      updateStatus: jest.fn(),
    };

    controller = new RoomsController(service as unknown as RoomsService);
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

  it('should derive performedBy from the authenticated principal when omitted', async () => {
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

    await expect(
      controller.updateStatus('T103', dto, principal),
    ).resolves.toEqual(result);

    expect(service.updateStatus).toHaveBeenCalledWith('T103', {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      performedBy: receptionistId,
    });
  });

  it('should allow a matching performedBy value', async () => {
    const dto = {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      performedBy: receptionistId,
      notes: 'Air-conditioner repair',
    };

    const result = {
      roomNumber: 'T103',
      previousStatus: RoomStatus.VACANT,
      status: RoomStatus.UNDER_MAINTENANCE,
      lastClearedAt: '2032-01-10T08:00:00.000Z',
      updatedAt: '2032-01-10T11:00:00.000Z',
    };

    service.updateStatus.mockResolvedValue(result);

    await controller.updateStatus('T103', dto, principal);

    expect(service.updateStatus).toHaveBeenCalledWith('T103', {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      performedBy: receptionistId,
      notes: 'Air-conditioner repair',
    });
  });

  it('should reject an attempt to act as another staff member', () => {
    const dto = {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      performedBy: anotherReceptionistId,
    };

    expect(() => controller.updateStatus('T103', dto, principal)).toThrow(
      ForbiddenException,
    );

    expect(service.updateStatus).not.toHaveBeenCalled();
  });
});
