import { Injectable } from '@nestjs/common';
import type { ConfirmWalkInPaymentDto } from './dto/confirm-walk-in-payment.dto';
import type {
  WalkInPaymentConfirmation,
  WalkInPendingPayment,
} from './models/walk-in-payment';
import { WalkInPaymentRepository } from './repositories/walk-in-payment.repository';

@Injectable()
export class WalkInPaymentService {
  constructor(private readonly repository: WalkInPaymentRepository) {}

  findPendingPayment(reference: string): Promise<WalkInPendingPayment> {
    return this.repository.findPendingPayment(reference);
  }

  confirmPayment(
    reference: string,
    dto: ConfirmWalkInPaymentDto,
    performedBy: string,
  ): Promise<WalkInPaymentConfirmation> {
    return this.repository.confirmPayment({
      bookingReference: reference,
      performedBy,
      receiptReference: dto.receiptReference?.trim() || undefined,
    });
  }
}
