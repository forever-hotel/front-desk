import { Test, TestingModule } from '@nestjs/testing';
import { ServiceRequestCategory } from './models/service-request-category';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

describe('ServiceRequestsController', () => {
  let controller: ServiceRequestsController;
  let service: jest.Mocked<ServiceRequestsService>;

  beforeEach(async () => {
    const serviceMock = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceRequestsController],
      providers: [
        {
          provide: ServiceRequestsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(ServiceRequestsController);
    service = module.get(ServiceRequestsService);
  });

  it('should delegate service-request creation to the service', async () => {
    const dto = {
      bookingReference: '44444444-4444-4444-8444-444444444444',
      category: ServiceRequestCategory.EXTRA_TOWELS,
      description: 'Two extra towels',
      performedBy: '66666666-6666-4666-8666-666666666666',
    };

    const result = {
      status: 'created' as const,
      bookingReference: dto.bookingReference,
      roomNumber: 'T102',
      task: {
        taskId: '11111111-1111-4111-8111-111111111111',
        roomNumber: 'T102',
        category: 'EXTRA_TOWELS',
        status: 'UNASSIGNED',
        priority: 'NORMAL',
      },
    };

    service.create.mockResolvedValue(result);

    await expect(controller.create(dto)).resolves.toEqual(result);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(service.create).toHaveBeenCalledTimes(1);
  });
});
