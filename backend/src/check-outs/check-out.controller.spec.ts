import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { SystemRole } from '../security/auth/system-role';
import { CheckOutController } from './check-out.controller';
import { CheckOutService } from './check-out.service';
import { CheckoutPaymentMethod } from './models/checkout-payment-result';
import { CheckoutResult } from './models/checkout-result';

describe('CheckOutController', () => {
  let controller: CheckOutController;

  let service: {
    checkOut: jest.Mock;
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
      checkOut: jest.fn(),
    };

    controller = new CheckOutController(service as unknown as CheckOutService);
  });

  it('should delegate checkout using the trusted authenticated actor', async () => {
    const dto = {
      bookingReference,

      performedBy: receptionistId,

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

    await expect(controller.checkOut(dto, principal)).resolves.toEqual(result);

    expect(service.checkOut).toHaveBeenCalledTimes(1);

    expect(service.checkOut).toHaveBeenCalledWith({
      ...dto,
      performedBy: receptionistId,
    });
  });

  it('should reject an attempt to checkout as another staff member', () => {
    const dto = {
      bookingReference,

      performedBy: anotherStaffId,

      paymentMethod: CheckoutPaymentMethod.CASH,
    };

    expect(() => controller.checkOut(dto, principal)).toThrow(
      ForbiddenException,
    );

    expect(service.checkOut).not.toHaveBeenCalled();
  });
});
