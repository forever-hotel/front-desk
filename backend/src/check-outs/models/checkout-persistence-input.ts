import { CheckoutPaymentMethod } from './checkout-payment-result';

export interface CheckoutPersistenceInput {
  bookingReference: string;
  performedBy: string;
  roomNumber: string;
  folioTotal: number;
  previouslyPaid: number;
  finalPaymentAmount: number;
  paymentMethod?: CheckoutPaymentMethod;
}
