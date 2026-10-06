import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WkmsClient } from '../integrations/wkms/wkms.client';
import { ServiceRequestCategory } from './models/service-request-category';
import { ServiceRequestRepository } from './ports/service-request.repository';
import { ServiceRequestsService } from './service-requests.service';

describe('ServiceRequestsService', () => {
  let service: ServiceRequestsService;
  let repository: jest.Mocked<ServiceRequestRepository>;
  let wkmsClient: jest.Mocked<WkmsClient>;

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  beforeEach(async () => {
    const repositoryMock = {
      findStay: jest.fn(),
    };

    const wkmsClientMock = {
      createServiceTask: jest.fn(),
      getAvailableWorkers: jest.fn(),
      assignTask: jest.fn(),
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
      ],
    }).compile();

    service = module.get(ServiceRequestsService);
    repository = module.get(ServiceRequestRepository);
    wkmsClient = module.get(WkmsClient);
  });

  it('should create a WKMS task for a checked-in guest', async () => {
    repository.findStay.mockResolvedValue({
      bookingReference,
      roomNumber: 'T102',
      bookingStatus: 'CHECKED_IN',
    });

    wkmsClient.createServiceTask.mockResolvedValue({
      taskId: '11111111-1111-4111-8111-111111111111',
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
        taskId: '11111111-1111-4111-8111-111111111111',
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
      taskId: '11111111-1111-4111-8111-111111111111',
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
});
