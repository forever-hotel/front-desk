import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditEventWriter } from '../audit/audit-event.writer';
import { WkmsClient } from '../integrations/wkms/wkms.client';
import { RealtimeStateService } from '../realtime/realtime-state.service';
import { ServiceRequestCategory } from './models/service-request-category';
import { ServiceRequestRepository } from './ports/service-request.repository';
import { ServiceRequestsService } from './service-requests.service';

describe('ServiceRequestsService', () => {
  let service: ServiceRequestsService;

  let repository: jest.Mocked<ServiceRequestRepository>;

  let wkmsClient: jest.Mocked<WkmsClient>;

  let auditEventWriter: {
    recordManualTaskAssignment: jest.Mock;
  };

  let realtimeStateService: {
    removeTaskEscalation: jest.Mock;
  };

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const taskId = '11111111-1111-4111-8111-111111111111';

  const workerId = '77777777-7777-4777-8777-777777777777';

  beforeEach(async () => {
    const repositoryMock = {
      findStay: jest.fn(),
    };

    const wkmsClientMock = {
      createServiceTask: jest.fn(),

      getAvailableWorkers: jest.fn(),

      assignTask: jest.fn(),
    };

    auditEventWriter = {
      recordManualTaskAssignment: jest.fn(),
    };

    realtimeStateService = {
      removeTaskEscalation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceRequestsService,

        {
          provide: ServiceRequestRepository,

          useValue: repositoryMock,
        },

        {
          provide: WkmsClient,

          useValue: wkmsClientMock,
        },

        {
          provide: AuditEventWriter,

          useValue: auditEventWriter,
        },

        {
          provide: RealtimeStateService,

          useValue: realtimeStateService,
        },
      ],
    }).compile();

    service = module.get(ServiceRequestsService);

    repository = module.get(ServiceRequestRepository);

    wkmsClient = module.get(WkmsClient);

    auditEventWriter.recordManualTaskAssignment.mockResolvedValue(undefined);
  });

  it('should create a WKMS task for a checked-in guest', async () => {
    repository.findStay.mockResolvedValue({
      bookingReference,

      roomNumber: 'T102',

      bookingStatus: 'CHECKED_IN',
    });

    wkmsClient.createServiceTask.mockResolvedValue({
      taskId,

      roomNumber: 'T102',

      category: 'EXTRA_TOWELS',

      status: 'UNASSIGNED',

      priority: 'NORMAL',

      createdAt: '2030-01-10T12:00:00.000Z',
    });

    await expect(
      service.create({
        bookingReference,

        category: ServiceRequestCategory.EXTRA_TOWELS,

        description: '  Please send two towels  ',

        performedBy: receptionistId,
      }),
    ).resolves.toEqual({
      status: 'created',

      bookingReference,

      roomNumber: 'T102',

      task: {
        taskId,

        roomNumber: 'T102',

        category: 'EXTRA_TOWELS',

        status: 'UNASSIGNED',

        priority: 'NORMAL',

        createdAt: '2030-01-10T12:00:00.000Z',
      },
    });

    expect(wkmsClient.createServiceTask).toHaveBeenCalledWith({
      roomNumber: 'T102',

      category: ServiceRequestCategory.EXTRA_TOWELS,

      description: 'Please send two towels',

      requestedBy: receptionistId,
    });
  });

  it('should reject an unknown booking', async () => {
    repository.findStay.mockResolvedValue(null);

    await expect(
      service.create({
        bookingReference,

        category: ServiceRequestCategory.MAINTENANCE,

        performedBy: receptionistId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(wkmsClient.createServiceTask).not.toHaveBeenCalled();
  });

  it('should reject a guest that is not checked in', async () => {
    repository.findStay.mockResolvedValue({
      bookingReference,

      roomNumber: 'T102',

      bookingStatus: 'CONFIRMED',
    });

    await expect(
      service.create({
        bookingReference,

        category: ServiceRequestCategory.MAINTENANCE,

        performedBy: receptionistId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(wkmsClient.createServiceTask).not.toHaveBeenCalled();
  });

  it('should reject a checked-in stay without an assigned room', async () => {
    repository.findStay.mockResolvedValue({
      bookingReference,

      roomNumber: null,

      bookingStatus: 'CHECKED_IN',
    });

    await expect(
      service.create({
        bookingReference,

        category: ServiceRequestCategory.OTHER,

        performedBy: receptionistId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(wkmsClient.createServiceTask).not.toHaveBeenCalled();
  });

  it('should omit a blank optional description', async () => {
    repository.findStay.mockResolvedValue({
      bookingReference,

      roomNumber: 'T102',

      bookingStatus: 'CHECKED_IN',
    });

    wkmsClient.createServiceTask.mockResolvedValue({
      taskId,

      roomNumber: 'T102',

      category: 'WATER_BOTTLES',

      status: 'UNASSIGNED',

      priority: 'NORMAL',
    });

    await service.create({
      bookingReference,

      category: ServiceRequestCategory.WATER_BOTTLES,

      description: '   ',

      performedBy: receptionistId,
    });

    expect(wkmsClient.createServiceTask).toHaveBeenCalledWith({
      roomNumber: 'T102',

      category: ServiceRequestCategory.WATER_BOTTLES,

      description: undefined,

      requestedBy: receptionistId,
    });
  });

  it('should retrieve available workers from WKMS', async () => {
    const workers = [
      {
        workerId,

        displayName: 'Test Worker',

        activeTaskCount: 1,

        maxActiveTasks: 3,
      },
    ];

    wkmsClient.getAvailableWorkers.mockResolvedValue(workers);

    await expect(service.getAvailableWorkers()).resolves.toEqual(workers);

    expect(wkmsClient.getAvailableWorkers).toHaveBeenCalledTimes(1);
  });

  it('should audit a successful manual assignment and remove its escalation', async () => {
    const assignment = {
      taskId,

      status: 'ASSIGNED',

      assignedWorkerId: workerId,

      assignedAt: '2030-01-10T12:05:00.000Z',
    };

    wkmsClient.assignTask.mockResolvedValue(assignment);

    await expect(
      service.assignTask({
        taskId,

        workerId,

        assignedBy: receptionistId,
      }),
    ).resolves.toEqual(assignment);

    expect(wkmsClient.assignTask).toHaveBeenCalledWith({
      taskId,

      workerId,

      assignedBy: receptionistId,
    });

    expect(auditEventWriter.recordManualTaskAssignment).toHaveBeenCalledWith({
      staffUserId: receptionistId,

      taskId,

      workerId,

      assignmentStatus: 'ASSIGNED',

      assignedAt: '2030-01-10T12:05:00.000Z',
    });

    expect(realtimeStateService.removeTaskEscalation).toHaveBeenCalledWith(
      taskId,
    );

    expect(wkmsClient.assignTask.mock.invocationCallOrder[0]).toBeLessThan(
      auditEventWriter.recordManualTaskAssignment.mock.invocationCallOrder[0],
    );

    expect(
      auditEventWriter.recordManualTaskAssignment.mock.invocationCallOrder[0],
    ).toBeLessThan(
      realtimeStateService.removeTaskEscalation.mock.invocationCallOrder[0],
    );
  });

  it('should not audit or remove an escalation when WKMS assignment fails', async () => {
    wkmsClient.assignTask.mockRejectedValue(
      new Error('WKMS assignment failed'),
    );

    await expect(
      service.assignTask({
        taskId,

        workerId,

        assignedBy: receptionistId,
      }),
    ).rejects.toThrow('WKMS assignment failed');

    expect(auditEventWriter.recordManualTaskAssignment).not.toHaveBeenCalled();

    expect(realtimeStateService.removeTaskEscalation).not.toHaveBeenCalled();
  });

  it('should keep the escalation when audit recording fails after WKMS success', async () => {
    wkmsClient.assignTask.mockResolvedValue({
      taskId,

      status: 'ASSIGNED',

      assignedWorkerId: workerId,
    });

    auditEventWriter.recordManualTaskAssignment.mockRejectedValue(
      new Error('Audit insert failed'),
    );

    await expect(
      service.assignTask({
        taskId,

        workerId,

        assignedBy: receptionistId,
      }),
    ).rejects.toThrow('Audit insert failed');

    expect(realtimeStateService.removeTaskEscalation).not.toHaveBeenCalled();
  });
});
