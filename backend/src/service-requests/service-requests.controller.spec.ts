import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { SystemRole } from '../security/auth/system-role';
import { ServiceRequestCategory } from './models/service-request-category';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

describe('ServiceRequestsController', () => {
  let controller: ServiceRequestsController;

  let service: {
    create: jest.Mock;
    getAvailableWorkers: jest.Mock;
    assignTask: jest.Mock;
  };

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const anotherStaffId = '77777777-7777-4777-8777-777777777777';

  const workerId = '88888888-8888-4888-8888-888888888888';

  const taskId = '11111111-1111-4111-8111-111111111111';

  const principal: AuthenticatedPrincipal = {
    userId: receptionistId,

    role: SystemRole.RECEPTIONIST,
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),

      getAvailableWorkers: jest.fn(),

      assignTask: jest.fn(),
    };

    controller = new ServiceRequestsController(
      service as unknown as ServiceRequestsService,
    );
  });

  it('should create a service request using the trusted authenticated actor', async () => {
    const dto = {
      bookingReference: '44444444-4444-4444-8444-444444444444',

      category: ServiceRequestCategory.EXTRA_TOWELS,

      description: 'Two extra towels',

      performedBy: receptionistId,
    };

    const result = {
      status: 'created' as const,

      bookingReference: dto.bookingReference,

      roomNumber: 'T102',

      task: {
        taskId,

        roomNumber: 'T102',

        category: 'EXTRA_TOWELS',

        status: 'UNASSIGNED',

        priority: 'NORMAL',
      },
    };

    service.create.mockResolvedValue(result);

    await expect(controller.create(dto, principal)).resolves.toEqual(result);

    expect(service.create).toHaveBeenCalledWith({
      ...dto,
      performedBy: receptionistId,
    });
  });

  it('should reject service-request actor impersonation', () => {
    const dto = {
      bookingReference: '44444444-4444-4444-8444-444444444444',

      category: ServiceRequestCategory.EXTRA_TOWELS,

      performedBy: anotherStaffId,
    };

    expect(() => controller.create(dto, principal)).toThrow(ForbiddenException);

    expect(service.create).not.toHaveBeenCalled();
  });

  it('should return available WKMS workers', async () => {
    const workers = [
      {
        workerId,

        displayName: 'Test Worker',

        activeTaskCount: 1,

        maxActiveTasks: 3,
      },
    ];

    service.getAvailableWorkers.mockResolvedValue(workers);

    await expect(controller.getAvailableWorkers()).resolves.toEqual(workers);

    expect(service.getAvailableWorkers).toHaveBeenCalledTimes(1);
  });

  it('should assign a task using the authenticated user as assignedBy', async () => {
    const result = {
      taskId,

      status: 'ASSIGNED',

      assignedWorkerId: workerId,

      assignedAt: '2030-01-10T12:05:00.000Z',
    };

    service.assignTask.mockResolvedValue(result);

    await expect(
      controller.assignTask(
        taskId,
        {
          workerId,
        },
        principal,
      ),
    ).resolves.toEqual(result);

    expect(service.assignTask).toHaveBeenCalledWith({
      taskId,

      workerId,

      assignedBy: receptionistId,
    });
  });
});
