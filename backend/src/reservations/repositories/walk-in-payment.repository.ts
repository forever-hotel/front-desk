import type {
  ConfirmWalkInPaymentInput,
  WalkInPaymentConfirmation,
  WalkInPendingPayment,
} from '../models/walk-in-payment';

export abstract class WalkInPaymentRepository {
  abstract findPendingPayment(
    bookingReference: string,
  ): Promise<WalkInPendingPayment>;

  abstract confirmPayment(
    input: ConfirmWalkInPaymentInput,
  ): Promise<WalkInPaymentConfirmation>;
}
