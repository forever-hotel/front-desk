import {
  CheckoutPaymentGatewayInput,
  CheckoutPaymentGatewayResult,
} from '../models/checkout-payment-result';

export abstract class CheckoutPaymentGateway {
  abstract processFinalPayment(
    input: CheckoutPaymentGatewayInput,
  ): Promise<CheckoutPaymentGatewayResult>;
}
