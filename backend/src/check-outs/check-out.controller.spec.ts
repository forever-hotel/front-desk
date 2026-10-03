import { Test, TestingModule } from '@nestjs/testing';
import { CheckOutController } from './check-out.controller';
import { CheckOutService } from './check-out.service';
import { CheckoutPaymentMethod } from './models/checkout-payment-result';
import { CheckoutResult } from './models/checkout-result';

describe('CheckOutController', () => {
  let controller: CheckOutController;
  let service: jest.Mocked<CheckOutService>;

  const bookingReference = '44444444-4444-4444-8444-444444444444';
  const performedBy = '66666666-6666-4666-8666-666666666666';

  beforeEach(async () => {
    const serviceMock = {
      checkOut: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckOutController],
      providers: [
        {
          provide: CheckOutService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(CheckOutController);
    service = module.get(CheckOutService);
  });

  it('should delegate checkout to the service', async () => {
    const dto = {
      bookingReference,
      performedBy,
      paymentMethod: CheckoutPaymentMethod.CASH,
    };

    const result: CheckoutResult = {
      status: 'checked_out',
      bookingReference,
      roomNumber: 'T102',
      bookingStatus: 'CHECKED_OUT',
      roomStatus: 'REQUIRES_CLEANING',
      currency: 'LKR',
      folioTotal: 66000,
      previouslyPaid: 30000,
      finalPaymentAmount: 36000,
      payment: {
        paymentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        paymentMethod: CheckoutPaymentMethod.CASH,
        paymentStatus: 'COMPLETED',
        amount: 36000,
        paidAt: '2030-01-12T10:00:00.000Z',
      },
      auditLogId: '88888888-8888-4888-8888-888888888888',
      fossSession: {
        status: 'DEACTIVATED',
      },
    };

    service.checkOut.mockResolvedValue(result);

    await expect(controller.checkOut(dto)).resolves.toEqual(result);

    expect(service.checkOut).toHaveBeenCalledTimes(1);
    expect(service.checkOut).toHaveBeenCalledWith(dto);
  });
});
