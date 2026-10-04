import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FolioService } from '../billing/folio.service';
import { FolioCategory } from '../billing/models/folio-category';
import { RunningFolio } from '../billing/models/running-folio';
import { FossSessionGateway } from '../check-ins/ports/foss-session.gateway';
import { CheckoutCompletedPublisher } from '../messaging/publishers/checkout-completed.publisher';
import { CheckOutService } from './check-out.service';
import { CheckoutPaymentMethod } from './models/checkout-payment-result';
import { CheckoutPersistenceResult } from './models/checkout-result';
import { CheckoutPaymentGateway } from './ports/checkout-payment.gateway';
import { CheckoutRepository } from './ports/checkout.repository';

describe('CheckOutService', () => {
  let service: CheckOutService;
  let repository: jest.Mocked<CheckoutRepository>;
  let paymentGateway: jest.Mocked<CheckoutPaymentGateway>;
  let folioService: jest.Mocked<FolioService>;
  let fossSessionGateway: jest.Mocked<FossSessionGateway>;
  let checkoutCompletedPublisher: jest.Mocked<CheckoutCompletedPublisher>;

  const bookingReference = '44444444-4444-4444-8444-444444444444';
  const performedBy = '66666666-6666-4666-8666-666666666666';

  const runningFolio: RunningFolio = {
    bookingReference,
    roomNumber: 'T102',
    checkInDate: '2030-01-08',
    checkOutDate: '2030-01-12',
    bookingStatus: 'CHECKED_IN',
    currency: 'LKR',
    categories: [
      {
        category: FolioCategory.ROOM_CHARGES,
        items: [
          {
            reference: `ROOM-${bookingReference}`,
            description: 'Room accommodation',
            amount: 60000,
            occurredAt: '2030-01-08T00:00:00.000Z',
          },
        ],
        subtotal: 60000,
      },
      {
        category: FolioCategory.FOOD_AND_BEVERAGE,
        items: [
          {
            reference: 'FOOD-001',
            description: 'Dinner order',
            amount: 4500,
            occurredAt: '2030-01-09T18:30:00.000Z',
          },
        ],
        subtotal: 4500,
      },
      {
        category: FolioCategory.SERVICES,
        items: [
          {
            reference: 'SERVICE-001',
            description: 'Additional service',
            amount: 1500,
            occurredAt: '2030-01-10T10:00:00.000Z',
          },
        ],
        subtotal: 1500,
      },
    ],
    total: 66000,
  };

  const preparation = {
    bookingReference,
    roomNumber: 'T102',
    bookingStatus: 'CHECKED_IN' as const,
    roomStatus: 'OCCUPIED' as const,
    previouslyPaid: 30000,
  };

  const committedCheckout: CheckoutPersistenceResult = {
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
  };

  beforeEach(async () => {
    const repositoryMock = {
      prepareCheckout: jest.fn(),
      commitCheckout: jest.fn(),
    };

    const paymentGatewayMock = {
      processFinalPayment: jest.fn(),
    };

    const folioServiceMock = {
      getRunningFolio: jest.fn(),
    };

    const fossSessionGatewayMock = {
      activateGuestSession: jest.fn(),
      deactivateGuestSession: jest.fn(),
    };

    const checkoutCompletedPublisherMock = {
      publishCheckoutCompleted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckOutService,
        {
          provide: CheckoutRepository,
          useValue: repositoryMock,
        },
        {
          provide: CheckoutPaymentGateway,
          useValue: paymentGatewayMock,
        },
        {
          provide: FolioService,
          useValue: folioServiceMock,
        },
        {
          provide: FossSessionGateway,
          useValue: fossSessionGatewayMock,
        },
        {
          provide: CheckoutCompletedPublisher,
          useValue: checkoutCompletedPublisherMock,
        },
      ],
    }).compile();

    service = module.get(CheckOutService);
    repository = module.get(CheckoutRepository);
    paymentGateway = module.get(CheckoutPaymentGateway);
    folioService = module.get(FolioService);
    fossSessionGateway = module.get(FossSessionGateway);
    checkoutCompletedPublisher = module.get(CheckoutCompletedPublisher);

    repository.prepareCheckout.mockResolvedValue(preparation);
    folioService.getRunningFolio.mockResolvedValue(runningFolio);
    paymentGateway.processFinalPayment.mockResolvedValue({
      status: 'COMPLETED',
    });
    repository.commitCheckout.mockResolvedValue(committedCheckout);
    checkoutCompletedPublisher.publishCheckoutCompleted.mockResolvedValue({
      status: 'PUBLISHED',
      eventId: `checkout:${bookingReference}`,
    });
    fossSessionGateway.deactivateGuestSession.mockResolvedValue({
      status: 'DEACTIVATED',
    });
  });

  it('should complete checkout with the server-calculated outstanding balance', async () => {
    const result = await service.checkOut({
      bookingReference,
      performedBy,
      paymentMethod: CheckoutPaymentMethod.CASH,
    });

    expect(repository.prepareCheckout).toHaveBeenCalledWith({
      bookingReference,
      performedBy,
    });

    expect(folioService.getRunningFolio).toHaveBeenCalledWith(bookingReference);

    expect(paymentGateway.processFinalPayment).toHaveBeenCalledWith({
      bookingReference,
      amount: 36000,
      currency: 'LKR',
      paymentMethod: CheckoutPaymentMethod.CASH,
    });

    expect(repository.commitCheckout).toHaveBeenCalledWith({
      bookingReference,
      performedBy,
      roomNumber: 'T102',
      folioTotal: 66000,
      previouslyPaid: 30000,
      finalPaymentAmount: 36000,
      paymentMethod: CheckoutPaymentMethod.CASH,
    });

    expect(fossSessionGateway.deactivateGuestSession).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T102',
    });

    expect(
      checkoutCompletedPublisher.publishCheckoutCompleted,
    ).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T102',
    });

    expect(repository.commitCheckout.mock.invocationCallOrder[0]).toBeLessThan(
      checkoutCompletedPublisher.publishCheckoutCompleted.mock
        .invocationCallOrder[0],
    );
    expect(
      checkoutCompletedPublisher.publishCheckoutCompleted.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      fossSessionGateway.deactivateGuestSession.mock.invocationCallOrder[0],
    );

    expect(result).toEqual({
      ...committedCheckout,
      fossSession: {
        status: 'DEACTIVATED',
      },
    });
  });

  it('should support CARD_ON_SITE using the calculated outstanding balance', async () => {
    await service.checkOut({
      bookingReference,
      performedBy,
      paymentMethod: CheckoutPaymentMethod.CARD_ON_SITE,
    });

    expect(paymentGateway.processFinalPayment).toHaveBeenCalledWith({
      bookingReference,
      amount: 36000,
      currency: 'LKR',
      paymentMethod: CheckoutPaymentMethod.CARD_ON_SITE,
    });
  });

  it('should complete an already fully paid checkout without creating a new payment attempt', async () => {
    repository.prepareCheckout.mockResolvedValue({
      ...preparation,
      previouslyPaid: 66000,
    });

    repository.commitCheckout.mockResolvedValue({
      ...committedCheckout,
      previouslyPaid: 66000,
      finalPaymentAmount: 0,
      payment: null,
    });

    const result = await service.checkOut({
      bookingReference,
      performedBy,
    });

    expect(paymentGateway.processFinalPayment).not.toHaveBeenCalled();

    expect(repository.commitCheckout).toHaveBeenCalledWith({
      bookingReference,
      performedBy,
      roomNumber: 'T102',
      folioTotal: 66000,
      previouslyPaid: 66000,
      finalPaymentAmount: 0,
      paymentMethod: undefined,
    });

    expect(
      checkoutCompletedPublisher.publishCheckoutCompleted,
    ).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T102',
    });
    expect(fossSessionGateway.deactivateGuestSession).toHaveBeenCalledTimes(1);

    expect(result.finalPaymentAmount).toBe(0);
    expect(result.payment).toBeNull();
  });

  it('should require a payment method when a balance is due', async () => {
    await expect(
      service.checkOut({
        bookingReference,
        performedBy,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(paymentGateway.processFinalPayment).not.toHaveBeenCalled();
    expect(repository.commitCheckout).not.toHaveBeenCalled();
    expect(
      checkoutCompletedPublisher.publishCheckoutCompleted,
    ).not.toHaveBeenCalled();
    expect(fossSessionGateway.deactivateGuestSession).not.toHaveBeenCalled();
  });

  it('should return 402 when the payment gateway reports failure', async () => {
    paymentGateway.processFinalPayment.mockResolvedValue({
      status: 'FAILED',
    });

    try {
      await service.checkOut({
        bookingReference,
        performedBy,
        paymentMethod: CheckoutPaymentMethod.CASH,
      });

      throw new Error('Expected checkout to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    expect(repository.commitCheckout).not.toHaveBeenCalled();
    expect(
      checkoutCompletedPublisher.publishCheckoutCompleted,
    ).not.toHaveBeenCalled();
    expect(fossSessionGateway.deactivateGuestSession).not.toHaveBeenCalled();
  });

  it('should return 402 when the payment gateway throws', async () => {
    paymentGateway.processFinalPayment.mockRejectedValue(
      new Error('Payment provider unavailable'),
    );

    try {
      await service.checkOut({
        bookingReference,
        performedBy,
        paymentMethod: CheckoutPaymentMethod.CASH,
      });

      throw new Error('Expected checkout to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    expect(repository.commitCheckout).not.toHaveBeenCalled();
    expect(
      checkoutCompletedPublisher.publishCheckoutCompleted,
    ).not.toHaveBeenCalled();
    expect(fossSessionGateway.deactivateGuestSession).not.toHaveBeenCalled();
  });

  it('should reject an overpaid or inconsistent financial state', async () => {
    repository.prepareCheckout.mockResolvedValue({
      ...preparation,
      previouslyPaid: 66001,
    });

    await expect(
      service.checkOut({
        bookingReference,
        performedBy,
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(paymentGateway.processFinalPayment).not.toHaveBeenCalled();
    expect(repository.commitCheckout).not.toHaveBeenCalled();
    expect(fossSessionGateway.deactivateGuestSession).not.toHaveBeenCalled();
  });

  it('should reject an invalid fractional folio total', async () => {
    folioService.getRunningFolio.mockResolvedValue({
      ...runningFolio,
      total: 66000.5,
    });

    await expect(
      service.checkOut({
        bookingReference,
        performedBy,
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(paymentGateway.processFinalPayment).not.toHaveBeenCalled();
    expect(repository.commitCheckout).not.toHaveBeenCalled();
  });

  it('should reject an invalid completed-payment total', async () => {
    repository.prepareCheckout.mockResolvedValue({
      ...preparation,
      previouslyPaid: -1,
    });

    await expect(
      service.checkOut({
        bookingReference,
        performedBy,
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(paymentGateway.processFinalPayment).not.toHaveBeenCalled();
    expect(repository.commitCheckout).not.toHaveBeenCalled();
  });

  it('should preserve the committed checkout when FOSS deactivation fails', async () => {
    fossSessionGateway.deactivateGuestSession.mockRejectedValue(
      new Error('FOSS unavailable'),
    );

    const result = await service.checkOut({
      bookingReference,
      performedBy,
      paymentMethod: CheckoutPaymentMethod.CASH,
    });

    expect(repository.commitCheckout).toHaveBeenCalledTimes(1);
    expect(
      checkoutCompletedPublisher.publishCheckoutCompleted,
    ).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T102',
    });

    expect(result).toEqual({
      ...committedCheckout,
      fossSession: {
        status: 'FAILED',
        failureCode: 'FOSS_DEACTIVATION_FAILED',
      },
    });
  });

  it('should not request FOSS deactivation when checkout persistence fails', async () => {
    repository.commitCheckout.mockRejectedValue(
      new Error('Checkout transaction failed'),
    );

    await expect(
      service.checkOut({
        bookingReference,
        performedBy,
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).rejects.toThrow('Checkout transaction failed');

    expect(
      checkoutCompletedPublisher.publishCheckoutCompleted,
    ).not.toHaveBeenCalled();
    expect(fossSessionGateway.deactivateGuestSession).not.toHaveBeenCalled();
  });

  it('should not attempt payment or FOSS deactivation when checkout preparation fails', async () => {
    repository.prepareCheckout.mockRejectedValue(
      new ConflictException('Booking is not checked in'),
    );

    await expect(
      service.checkOut({
        bookingReference,
        performedBy,
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(folioService.getRunningFolio).not.toHaveBeenCalled();
    expect(paymentGateway.processFinalPayment).not.toHaveBeenCalled();
    expect(repository.commitCheckout).not.toHaveBeenCalled();
    expect(fossSessionGateway.deactivateGuestSession).not.toHaveBeenCalled();
  });

  it('should not mutate checkout state when folio retrieval fails', async () => {
    folioService.getRunningFolio.mockRejectedValue(
      new Error('Folio unavailable'),
    );

    await expect(
      service.checkOut({
        bookingReference,
        performedBy,
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).rejects.toThrow('Folio unavailable');

    expect(paymentGateway.processFinalPayment).not.toHaveBeenCalled();
    expect(repository.commitCheckout).not.toHaveBeenCalled();
    expect(fossSessionGateway.deactivateGuestSession).not.toHaveBeenCalled();
  });
});
