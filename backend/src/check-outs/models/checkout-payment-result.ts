export enum CheckoutPaymentMethod {
  CASH = 'CASH',
  CARD_ON_SITE = 'CARD_ON_SITE',
}

export interface CheckoutPaymentGatewayInput {
  bookingReference: string;
  amount: number;
  currency: 'LKR';
  paymentMethod: CheckoutPaymentMethod;
}

export interface CheckoutPaymentGatewayResult {
  status: 'COMPLETED' | 'FAILED';
}

export interface CheckoutPersistedPayment {
  paymentId: string;
  paymentMethod: CheckoutPaymentMethod;
  paymentStatus: 'COMPLETED';
  amount: number;
  paidAt: string;
}
