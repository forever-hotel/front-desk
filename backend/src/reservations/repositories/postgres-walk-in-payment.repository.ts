import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  ConfirmWalkInPaymentInput,
  WalkInPaymentConfirmation,
  WalkInPendingPayment,
} from '../models/walk-in-payment';
import { WalkInPaymentRepository } from './walk-in-payment.repository';

type BookingRow = {
  bookingReference: string;
  bookingStatus: string;
  bookingSource: string;
  totalAmount: number | string;
};
type PaymentRow = {
  paymentId: string;
  paymentMethod: string;
  paymentStatus: string;
  amount: number | string;
  paidAt?: string | Date;
};

type StaffRow = {
  role: string;
  roles?: string[];
  isActive: boolean;
};

@Injectable()
export class PostgresWalkInPaymentRepository extends WalkInPaymentRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findPendingPayment(
    bookingReference: string,
  ): Promise<WalkInPendingPayment> {
    const bookings = (await this.dataSource.query(
      `SELECT booking_id::text AS "bookingReference",
              source::text AS "bookingSource", status::text AS "bookingStatus",
              total_amount AS "totalAmount"
         FROM bookings WHERE booking_id=$1 LIMIT 1`,
      [bookingReference],
    )) as BookingRow[];

    const booking = bookings[0];
    if (!booking) throw new NotFoundException('Booking not found');
    this.requirePendingWalkIn(booking);

    const payments = (await this.dataSource.query(
      `SELECT payment_id::text AS "paymentId",
              payment_method::text AS "paymentMethod",
              payment_status::text AS "paymentStatus",
              amount
         FROM payments WHERE booking_id=$1`,
      [bookingReference],
    )) as PaymentRow[];

    const payment = this.requireSinglePendingPayment(
      booking,
      payments,
    );

    return {
      bookingReference,
      bookingStatus: 'PENDING',
      paymentId: payment.paymentId,
      paymentMethod: payment.paymentMethod as 'CASH' | 'CARD_ON_SITE',
      paymentStatus: 'PENDING',
      amount: Number(payment.amount),
      currency: 'LKR',
    };
  }

  async confirmPayment(
    input: ConfirmWalkInPaymentInput,
  ): Promise<WalkInPaymentConfirmation> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const staff = (await runner.query(
        `SELECT role::text AS "role", roles, is_active AS "isActive"
           FROM staff_users WHERE worker_id=$1 LIMIT 1 FOR SHARE`,
        [input.performedBy],
      )) as StaffRow[];

      const member = staff[0];
      if (
        !member ||
        member.isActive !== true ||
        !(member.roles ?? [member.role]).some(
          (role) => role === 'RECEPTIONIST' || role === 'ROOT',
        )
      ) {
        throw new BadRequestException(
          'An active receptionist is required to confirm a payment',
        );
      }

      // Serialize confirmations and check-in on the booking row.
      const bookings = (await runner.query(
        `SELECT booking_id::text AS "bookingReference",
                status::text AS "bookingStatus", source::text AS "bookingSource",
                total_amount AS "totalAmount"
           FROM bookings WHERE booking_id=$1 LIMIT 1 FOR UPDATE`,
        [input.bookingReference],
      )) as BookingRow[];

      const booking = bookings[0];
      if (!booking) throw new NotFoundException('Booking not found');
      this.requirePendingWalkIn(booking);

      const payments = (await runner.query(
        `SELECT payment_id::text AS "paymentId",
                payment_method::text AS "paymentMethod",
                payment_status::text AS "paymentStatus",
                amount
           FROM payments WHERE booking_id=$1 FOR UPDATE`,
        [input.bookingReference],
      )) as PaymentRow[];

      const payment = this.requireSinglePendingPayment(booking, payments);
      const reference = input.receiptReference?.trim();
      if (payment.paymentMethod === 'CARD_ON_SITE' && !reference) {
        throw new BadRequestException(
          'An approved POS receipt reference is required for card payments',
        );
      }

      const updatedPayments = this.normalizeMutationRows<{ paidAt: Date | string }>(await runner.query(
        `UPDATE payments SET payment_status='COMPLETED', paid_at=NOW(),
                             updated_at=NOW()
           WHERE payment_id=$1 AND payment_status='PENDING'
           RETURNING paid_at AS "paidAt"`,
        [payment.paymentId],
      ));
      if (updatedPayments.length !== 1) {
        throw new ConflictException('Pending payment changed during confirmation');
      }

      const updatedBookings = this.normalizeMutationRows<{ booking_id: string }>(await runner.query(
        `UPDATE bookings SET status='CONFIRMED', updated_at=NOW()
           WHERE booking_id=$1 AND status='PENDING'
           RETURNING booking_id`,
        [input.bookingReference],
      ));
      if (updatedBookings.length !== 1) {
        throw new ConflictException('Booking changed during payment confirmation');
      }

      const audit = this.normalizeMutationRows<{ auditLogId: string }>(await runner.query(
        `INSERT INTO audit_logs (
           event_category, actor_type, staff_user_id, action,
           entity_type, entity_id, details
         ) VALUES ('PAYMENT', 'STAFF', $1, 'WALK_IN_PAYMENT_CONFIRMED',
                   'BOOKING', $2, $3::jsonb)
         RETURNING log_id::text AS "auditLogId"`,
        [
          input.performedBy,
          input.bookingReference,
          JSON.stringify({
            paymentId: payment.paymentId,
            paymentMethod: payment.paymentMethod,
            amount: Number(payment.amount),
            currency: 'LKR',
            confirmationType: 'STAFF_RECORDED',
            receiptReference: reference ?? null,
          }),
        ],
      ));
      if (audit.length !== 1) {
        throw new Error('Payment audit record was not returned');
      }

      await runner.commitTransaction();

      return {
        bookingReference: input.bookingReference,
        bookingStatus: 'CONFIRMED',
        paymentId: payment.paymentId,
        paymentMethod: payment.paymentMethod as 'CASH' | 'CARD_ON_SITE',
        paymentStatus: 'COMPLETED',
        amount: Number(payment.amount),
        currency: 'LKR',
        paidAt: new Date(updatedPayments[0].paidAt).toISOString(),
        auditLogId: audit[0].auditLogId,
      };
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private normalizeMutationRows<T>(raw: unknown): T[] {
    if (!Array.isArray(raw)) return [];
    // TypeORM PostgreSQL can return [rows, rowCount] for DML RETURNING.
    if (Array.isArray(raw[0])) return raw[0] as T[];
    return raw as T[];
  }

  private requirePendingWalkIn(booking: BookingRow): void {
    if (
      booking.bookingSource !== 'WALK_IN' ||
      booking.bookingStatus !== 'PENDING'
    ) {
      throw new ConflictException(
        'Only pending walk-in bookings can have their initial payment confirmed',
      );
    }
  }

  private requireSinglePendingPayment(
    booking: BookingRow,
    payments: PaymentRow[],
  ): PaymentRow {
    if (
      payments.length !== 1 ||
      payments[0].paymentStatus !== 'PENDING' ||
      !['CASH', 'CARD_ON_SITE'].includes(payments[0].paymentMethod) ||
      Number(payments[0].amount) !== Number(booking.totalAmount)
    ) {
      throw new ConflictException(
        'Expected one pending room payment matching the booking total',
      );
    }
    return payments[0];
  }
}
