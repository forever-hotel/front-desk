import { Test, TestingModule } from '@nestjs/testing';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';

describe('CheckInController', () => {
  let controller: CheckInController;
  let service: jest.Mocked<CheckInService>;

  beforeEach(async () => {
    const serviceMock = {
      checkIn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckInController],
      providers: [
        {
          provide: CheckInService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<CheckInController>(CheckInController);
    service = module.get(CheckInService);
  });

  it('should pass the check-in request to the service', async () => {
    const dto = {
      bookingReference: 'FH-1001',
      roomNumber: '205',
      idVerified: true,
    };

    const result = {
      status: 'checked_in',
      bookingReference: 'FH-1001',
      roomNumber: '205',
      fossSessionActivated: true,
    };

    service.checkIn.mockResolvedValue(result as never);

    await expect(controller.checkIn(dto)).resolves.toEqual(result);

    expect(service.checkIn).toHaveBeenCalledWith(dto);
    expect(service.checkIn).toHaveBeenCalledTimes(1);
  });
});