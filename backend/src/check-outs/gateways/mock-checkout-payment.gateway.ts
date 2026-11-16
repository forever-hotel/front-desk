import { Injectable } from '@nestjs/common';
import {
  CheckoutPaymentGatewayInput,
  CheckoutPaymentGatewayResult,
} from '../models/checkout-payment-result';
import { CheckoutPaymentGateway } from '../ports/checkout-payment.gateway';

@Injectable()
export class MockCheckoutPaymentGateway extends CheckoutPaymentGateway {
  processFinalPayment(
    _input: CheckoutPaymentGatewayInput,
  ): Promise<CheckoutPaymentGatewayResult> {
    return Promise.resolve({
      status: 'COMPLETED',
    });
  }
}
