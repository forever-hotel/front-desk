import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  CreateWalkInBookingRecord,
  WalkInBookingResult,
  WalkInRoomTypeDetails,
} from '../models/walk-in-booking-result';
import { WalkInBookingRepository } from './walk-in-booking.repository';

@Injectable()
export class PostgresWalkInBookingRepository extends WalkInBookingRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findRoomType(
    roomTypeId: string,
  ): Promise<WalkInRoomTypeDetails | null> {
    const rows = await this.dataSource.query(
      `
      SELECT
        room_type_id::text AS "roomTypeId",
        type_name AS "typeName",
        price_per_night AS "pricePerNight",
        max_guests AS "maxGuests"
      FROM room_types
      WHERE room_type_id = $1
      LIMIT 1
      `,
      [roomTypeId],
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      roomTypeId: String(rows[0].roomTypeId),
      typeName: String(rows[0].typeName),
      pricePerNight: Number(rows[0].pricePerNight),
      maxGuests: Number(rows[0].maxGuests),
    };
  }

  async createWalkInBooking(
    input: CreateWalkInBookingRecord,
  ): Promise<WalkInBookingResult> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const guestRows = await queryRunner.query(
        `
        SELECT
          guest_id::text AS "guestId"
        FROM guests
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        `,
        [input.guest.email.trim()],
      );

      const guestId =
        guestRows.length > 0 ? String(guestRows[0].guestId) : null;

      const bookingRows = await queryRunner.query(
        `
        INSERT INTO bookings (
          guest_id,
          room_type_id,
          check_in_date,
          check_out_date,
          status,
          total_amount,
          source,
          special_requests,
          num_guests
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'WALK_IN',
          $7,
          $8
        )
        RETURNING
          booking_id::text AS "bookingId",
          check_in_date::text AS "checkInDate",
          check_out_date::text AS "checkOutDate",
          status::text AS "status",
          total_amount AS "totalAmount",
          source::text AS "source",
          special_requests AS "specialRequests",
          num_guests AS "numGuests"
        `,
        [
          guestId,
          input.roomType.roomTypeId,
          input.checkInDate,
          input.checkOutDate,
          input.bookingStatus,
          input.totalAmount,
          input.specialRequests ?? null,
          input.numGuests,
        ],
      );

      const booking = bookingRows[0];

      const paidAt =
        input.paymentStatus === 'COMPLETED' ? new Date().toISOString() : null;

      const paymentRows = await queryRunner.query(
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
          $2,
          $3,
          $4,
          $5
        )
        RETURNING
          payment_id::text AS "paymentId",
          payment_method::text AS "paymentMethod",
          amount,
          payment_status::text AS "paymentStatus",
          paid_at::text AS "paidAt"
        `,
        [
          booking.bookingId,
          input.paymentMethod,
          input.totalAmount,
          input.paymentStatus,
          paidAt,
        ],
      );

      const payment = paymentRows[0];

      await queryRunner.commitTransaction();

      return {
        bookingId: String(booking.bookingId),
        bookingReference: String(booking.bookingId),
        guestId,
        guestAccountLinked: guestId !== null,
        guest: {
          fullName: input.guest.fullName,
          email: input.guest.email,
          nicOrPassport: input.guest.nicOrPassport,
          phone: input.guest.phone,
        },
        roomTypeId: input.roomType.roomTypeId,
        roomType: input.roomType.typeName,
        checkInDate: String(booking.checkInDate),
        checkOutDate: String(booking.checkOutDate),
        numGuests: Number(booking.numGuests),
        specialRequests:
          booking.specialRequests === null
            ? null
            : String(booking.specialRequests),
        totalAmount: Number(booking.totalAmount),
        currency: 'LKR',
        status: booking.status as WalkInBookingResult['status'],
        source: 'WALK_IN',
        payment: {
          paymentId: String(payment.paymentId),
          paymentMethod:
            payment.paymentMethod as WalkInBookingResult['payment']['paymentMethod'],
          paymentStatus:
            payment.paymentStatus as WalkInBookingResult['payment']['paymentStatus'],
          amount: Number(payment.amount),
          paidAt: payment.paidAt === null ? null : String(payment.paidAt),
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
