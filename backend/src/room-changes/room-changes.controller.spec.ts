import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { SystemRole } from '../security/auth/system-role';
import { RoomStatus } from '../rooms/models/room-status';
import { RoomChangesController } from './room-changes.controller';
import { RoomChangesService } from './room-changes.service';

describe('RoomChangesController', () => {
  let controller: RoomChangesController;

  let service: {
    findAvailableRooms: jest.Mock;
    changeRoom: jest.Mock;
  };

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const anotherStaffId = '77777777-7777-4777-8777-777777777777';

  const principal: AuthenticatedPrincipal = {
    userId: receptionistId,
    role: SystemRole.RECEPTIONIST,
  };

  beforeEach(() => {
    service = {
      findAvailableRooms: jest.fn(),

      changeRoom: jest.fn(),
    };

    controller = new RoomChangesController(
      service as unknown as RoomChangesService,
    );
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

  it('should pass the trusted room-change actor to the service', async () => {
    const dto = {
      bookingReference,

      targetRoomNumber: 'T105',

      performedBy: receptionistId,

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

    await expect(controller.changeRoom(dto, principal)).resolves.toEqual(
      result,
    );

    expect(service.changeRoom).toHaveBeenCalledWith({
      ...dto,
      performedBy: receptionistId,
    });
  });

  it('should reject an attempt to perform a room change as another staff member', () => {
    const dto = {
      bookingReference,

      targetRoomNumber: 'T105',

      performedBy: anotherStaffId,

      reason: 'Guest requested quieter room',
    };

    expect(() => controller.changeRoom(dto, principal)).toThrow(
      ForbiddenException,
    );

    expect(service.changeRoom).not.toHaveBeenCalled();
  });
});
