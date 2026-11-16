import { CheckoutPersistedPayment } from './checkout-payment-result';

export type CheckoutFossSessionResult =
  | {
      status: 'DEACTIVATED';
    }
  | {
      status: 'FAILED';
      failureCode: 'FOSS_DEACTIVATION_FAILED';
    };

export interface CheckoutPersistenceResult {
  status: 'checked_out';
  bookingReference: string;
  roomNumber: string;
  bookingStatus: 'CHECKED_OUT';
  roomStatus: 'REQUIRES_CLEANING';
  currency: 'LKR';
  folioTotal: number;
  previouslyPaid: number;
  finalPaymentAmount: number;
  payment: CheckoutPersistedPayment | null;
  auditLogId: string;
}

export interface CheckoutResult extends CheckoutPersistenceResult {
  fossSession: CheckoutFossSessionResult;
}
