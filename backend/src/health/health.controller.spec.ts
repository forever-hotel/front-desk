import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: jest.Mocked<HealthService>;

  beforeEach(async () => {
    const serviceMock = {
      checkDatabase: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the FDS health status', () => {
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'front-desk',
    });
  });

  it('should return database readiness status', async () => {
    service.checkDatabase.mockResolvedValue({
      status: 'ready',
      database: 'up',
    });

    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ready',
      database: 'up',
    });

    expect(service.checkDatabase).toHaveBeenCalledTimes(1);
  });
});
