export type WalkInOnSitePaymentMethod = 'CASH' | 'CARD_ON_SITE';

export interface WalkInPendingPayment {
  bookingReference: string;
  bookingStatus: 'PENDING';
  paymentId: string;
  paymentMethod: WalkInOnSitePaymentMethod;
  paymentStatus: 'PENDING';
  amount: number;
  currency: 'LKR';
}

export interface WalkInPaymentConfirmation {
  bookingReference: string;
  bookingStatus: 'CONFIRMED';
  paymentId: string;
  paymentMethod: WalkInOnSitePaymentMethod;
  paymentStatus: 'COMPLETED';
  amount: number;
  currency: 'LKR';
  paidAt: string;
  auditLogId: string;
}

export interface ConfirmWalkInPaymentInput {
  bookingReference: string;
  performedBy: string;
  receiptReference?: string;
}
