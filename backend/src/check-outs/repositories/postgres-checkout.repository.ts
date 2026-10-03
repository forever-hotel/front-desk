import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CheckoutPreparation } from '../models/checkout-balance';
import { CheckoutPersistenceInput } from '../models/checkout-persistence-input';
import { CheckoutPersistedPayment } from '../models/checkout-payment-result';
import { CheckoutPersistenceResult } from '../models/checkout-result';
import {
  CheckoutRepository,
  PrepareCheckoutInput,
} from '../ports/checkout.repository';

interface StaffRow {
  workerId: string;
  role: string;
  isActive: boolean;
}

interface CheckoutBookingRow {
  bookingReference: string;
  roomNumber: string | null;
  bookingStatus: string;
  roomStatus: string | null;
}

interface LockedBookingRow {
  bookingReference: string;
  roomNumber: string | null;
  bookingStatus: string;
}

interface LockedRoomRow {
  roomNumber: string;
  roomStatus: string;
}

interface PaymentTotalRow {
  previouslyPaid: number | string;
}

interface PaymentRow {
  paymentId: string;
  paymentMethod: string;
  paymentStatus: string;
  amount: number | string;
  paidAt: Date | string;
}

interface AuditRow {
  logId: string;
}

@Injectable()
export class PostgresCheckoutRepository extends CheckoutRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async prepareCheckout(
    input: PrepareCheckoutInput,
  ): Promise<CheckoutPreparation> {
    const staffRows = (await this.dataSource.query(
      `
      SELECT
        worker_id::text AS "workerId",
        role::text AS "role",
        is_active AS "isActive"
      FROM staff_users
      WHERE worker_id = $1
      LIMIT 1
      `,
      [input.performedBy],
    )) as StaffRow[];

    this.validateReceptionist(staffRows);

    const bookingRows = (await this.dataSource.query(
      `
      SELECT
        b.booking_id::text AS "bookingReference",
        b.room_number AS "roomNumber",
        b.status::text AS "bookingStatus",
        r.status::text AS "roomStatus"
      FROM bookings b
      LEFT JOIN rooms r
        ON r.room_number = b.room_number
      WHERE b.booking_id = $1
      LIMIT 1
      `,
      [input.bookingReference],
    )) as CheckoutBookingRow[];

    if (bookingRows.length === 0) {
      throw new NotFoundException('Booking not found');
    }

    const booking = bookingRows[0];

    if (booking.bookingStatus !== 'CHECKED_IN') {
      throw new ConflictException(
        `Checkout requires a CHECKED_IN booking; current status is ${booking.bookingStatus}`,
      );
    }

    if (!booking.roomNumber) {
      throw new ConflictException(
        'Checked-in booking does not have an assigned room',
      );
    }

    if (!booking.roomStatus) {
      throw new ConflictException('Assigned room could not be resolved');
    }

    if (booking.roomStatus !== 'OCCUPIED') {
      throw new ConflictException(
        `Assigned room ${booking.roomNumber} must be OCCUPIED for checkout`,
      );
    }

    const paymentRows = (await this.dataSource.query(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS "previouslyPaid"
      FROM payments
      WHERE
        booking_id = $1
        AND payment_status = 'COMPLETED'
      `,
      [input.bookingReference],
    )) as PaymentTotalRow[];

    const previouslyPaid = this.normalizeCompletedPaymentTotal(paymentRows);

    return {
      bookingReference: booking.bookingReference,
      roomNumber: booking.roomNumber,
      bookingStatus: 'CHECKED_IN',
      roomStatus: 'OCCUPIED',
      previouslyPaid,
    };
  }

  async commitCheckout(
    input: CheckoutPersistenceInput,
  ): Promise<CheckoutPersistenceResult> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const staffRows = (await queryRunner.query(
        `
        SELECT
          worker_id::text AS "workerId",
          role::text AS "role",
          is_active AS "isActive"
        FROM staff_users
        WHERE worker_id = $1
        LIMIT 1
        FOR SHARE
        `,
        [input.performedBy],
      )) as StaffRow[];

      this.validateReceptionist(staffRows);

      const bookingRows = (await queryRunner.query(
        `
        SELECT
          booking_id::text AS "bookingReference",
          room_number AS "roomNumber",
          status::text AS "bookingStatus"
        FROM bookings
        WHERE booking_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [input.bookingReference],
      )) as LockedBookingRow[];

      if (bookingRows.length === 0) {
        throw new NotFoundException('Booking not found');
      }

      const booking = bookingRows[0];

      if (booking.bookingStatus !== 'CHECKED_IN') {
        throw new ConflictException(
          `Checkout requires a CHECKED_IN booking; current status is ${booking.bookingStatus}`,
        );
      }

      if (!booking.roomNumber) {
        throw new ConflictException(
          'Checked-in booking does not have an assigned room',
        );
      }

      if (booking.roomNumber !== input.roomNumber) {
        throw new ConflictException(
          'Booking room assignment changed before checkout could be committed',
        );
      }

      const roomRows = (await queryRunner.query(
        `
        SELECT
          room_number AS "roomNumber",
          status::text AS "roomStatus"
        FROM rooms
        WHERE room_number = $1
        LIMIT 1
        FOR UPDATE
        `,
        [booking.roomNumber],
      )) as LockedRoomRow[];

      if (roomRows.length === 0) {
        throw new ConflictException('Assigned room could not be resolved');
      }

      const room = roomRows[0];

      if (room.roomStatus !== 'OCCUPIED') {
        throw new ConflictException(
          `Assigned room ${room.roomNumber} must be OCCUPIED for checkout`,
        );
      }

      const paymentTotalRows = (await queryRunner.query(
        `
        SELECT
          COALESCE(SUM(amount), 0) AS "previouslyPaid"
        FROM payments
        WHERE
          booking_id = $1
          AND payment_status = 'COMPLETED'
        `,
        [booking.bookingReference],
      )) as PaymentTotalRow[];

      const persistedPreviouslyPaid =
        this.normalizeCompletedPaymentTotal(paymentTotalRows);

      if (persistedPreviouslyPaid !== input.previouslyPaid) {
        throw new ConflictException(
          'Completed-payment total changed before checkout could be committed',
        );
      }

      this.validateFinancialInput({
        ...input,
        previouslyPaid: persistedPreviouslyPaid,
      });

      let payment: CheckoutPersistedPayment | null = null;

      if (input.finalPaymentAmount > 0) {
        if (!input.paymentMethod) {
          throw new BadRequestException(
            'paymentMethod is required when a final payment is due',
          );
        }

        const paymentRawResult = (await queryRunner.query(
          `
          INSERT INTO payments (
            booking_id,
            payment_method,
            amount,
            payment_status,
            paid_at
          )
          VALUES (
            $1,
            $2::payment_method,
            $3,
            'COMPLETED',
            NOW()
          )
          RETURNING
            payment_id::text AS "paymentId",
            payment_method::text AS "paymentMethod",
            payment_status::text AS "paymentStatus",
            amount AS "amount",
            paid_at AS "paidAt"
          `,
          [
            booking.bookingReference,
            input.paymentMethod,
            input.finalPaymentAmount,
          ],
        )) as unknown[];

        const paymentRows =
          this.normalizeMutationRows<PaymentRow>(paymentRawResult);

        const paymentRow = paymentRows[0];

        if (!paymentRow) {
          throw new Error('Final payment record was not returned after insert');
        }

        payment = {
          paymentId: paymentRow.paymentId,
          paymentMethod: input.paymentMethod,
          paymentStatus: 'COMPLETED',
          amount: Number(paymentRow.amount),
          paidAt: this.toIso(paymentRow.paidAt),
        };
      }

      await queryRunner.query(
        `
        UPDATE bookings
        SET
          status = 'CHECKED_OUT',
          updated_at = NOW()
        WHERE booking_id = $1
        `,
        [booking.bookingReference],
      );

      await queryRunner.query(
        `
        UPDATE rooms
        SET
          status = 'REQUIRES_CLEANING',
          updated_at = NOW()
        WHERE room_number = $1
        `,
        [room.roomNumber],
      );

      const auditDetails = {
        roomNumber: room.roomNumber,
        folioTotal: input.folioTotal,
        previouslyPaid: persistedPreviouslyPaid,
        finalPaymentAmount: input.finalPaymentAmount,
        paymentMethod: input.paymentMethod ?? null,
      };

      const auditRawResult = (await queryRunner.query(
        `
        INSERT INTO audit_logs (
          event_category,
          actor_type,
          staff_user_id,
          action,
          entity_type,
          entity_id,
          details
        )
        VALUES (
          'FRONT_DESK_OPERATION',
          'STAFF',
          $1,
          'CHECK_OUT',
          'BOOKING',
          $2,
          $3::jsonb
        )
        RETURNING
          log_id::text AS "logId"
        `,
        [
          input.performedBy,
          booking.bookingReference,
          JSON.stringify(auditDetails),
        ],
      )) as unknown[];

      const auditRows = this.normalizeMutationRows<AuditRow>(auditRawResult);

      const audit = auditRows[0];

      if (!audit) {
        throw new Error('Checkout audit record was not returned after insert');
      }

      const result: CheckoutPersistenceResult = {
        status: 'checked_out',
        bookingReference: booking.bookingReference,
        roomNumber: room.roomNumber,
        bookingStatus: 'CHECKED_OUT',
        roomStatus: 'REQUIRES_CLEANING',
        currency: 'LKR',
        folioTotal: input.folioTotal,
        previouslyPaid: persistedPreviouslyPaid,
        finalPaymentAmount: input.finalPaymentAmount,
        payment,
        auditLogId: audit.logId,
      };

      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validateReceptionist(staffRows: StaffRow[]): void {
    if (
      staffRows.length === 0 ||
      staffRows[0].role !== 'RECEPTIONIST' ||
      staffRows[0].isActive !== true
    ) {
      throw new BadRequestException(
        'Checkout must be performed by an active receptionist',
      );
    }
  }

  private validateFinancialInput(input: CheckoutPersistenceInput): void {
    const values = [
      input.folioTotal,
      input.previouslyPaid,
      input.finalPaymentAmount,
    ];

    if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
      throw new ConflictException('Checkout monetary state is invalid');
    }

    const calculatedAmountDue = input.folioTotal - input.previouslyPaid;

    if (calculatedAmountDue < 0 || !Number.isSafeInteger(calculatedAmountDue)) {
      throw new ConflictException('Checkout financial state is inconsistent');
    }

    if (calculatedAmountDue !== input.finalPaymentAmount) {
      throw new ConflictException(
        'Checkout payment amount no longer matches the calculated balance',
      );
    }
  }

  private normalizeCompletedPaymentTotal(rows: PaymentTotalRow[]): number {
    const previouslyPaid = Number(rows[0]?.previouslyPaid ?? 0);

    if (!Number.isSafeInteger(previouslyPaid) || previouslyPaid < 0) {
      throw new ConflictException(
        'Persisted completed-payment total is invalid',
      );
    }

    return previouslyPaid;
  }

  private normalizeMutationRows<T>(rawResult: unknown[]): T[] {
    if (Array.isArray(rawResult[0])) {
      return rawResult[0] as T[];
    }

    return rawResult as T[];
  }

  private toIso(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(value).toISOString();
  }
}
