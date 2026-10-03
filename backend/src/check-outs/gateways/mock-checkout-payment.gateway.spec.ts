import { CheckoutPaymentMethod } from '../models/checkout-payment-result';
import { MockCheckoutPaymentGateway } from './mock-checkout-payment.gateway';

describe('MockCheckoutPaymentGateway', () => {
  let gateway: MockCheckoutPaymentGateway;

  beforeEach(() => {
    gateway = new MockCheckoutPaymentGateway();
  });

  it('should return a deterministic completed result for the core checkout adapter', async () => {
    await expect(
      gateway.processFinalPayment({
        bookingReference: '44444444-4444-4444-8444-444444444444',
        amount: 36000,
        currency: 'LKR',
        paymentMethod: CheckoutPaymentMethod.CASH,
      }),
    ).resolves.toEqual({
      status: 'COMPLETED',
    });
  });
});
