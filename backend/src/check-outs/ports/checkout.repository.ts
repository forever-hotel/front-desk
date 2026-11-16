import { CheckoutPreparation } from '../models/checkout-balance';
import { CheckoutPersistenceInput } from '../models/checkout-persistence-input';
import { CheckoutPersistenceResult } from '../models/checkout-result';

export interface PrepareCheckoutInput {
  bookingReference: string;
  performedBy: string;
}

export abstract class CheckoutRepository {
  abstract prepareCheckout(
    input: PrepareCheckoutInput,
  ): Promise<CheckoutPreparation>;

  abstract commitCheckout(
    input: CheckoutPersistenceInput,
  ): Promise<CheckoutPersistenceResult>;
}
