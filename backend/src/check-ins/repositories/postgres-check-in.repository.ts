import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from '../dto/check-in-verification.dto';
import type { CheckInResult } from '../models/check-in-result';
import type { CheckInTransactionInput } from '../models/check-in-transaction';
import { CheckInRepository } from '../ports/check-in.repository';

interface BookingRow {
  bookingId: string;
  roomTypeId: string;
  roomNumber: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
}

interface RoomRow {
  roomNumber: string;
  roomTypeId: string;
  status: string;
}

interface VerificationRow {
  verificationId: string;
  verifiedAt: string;
}

@Injectable()
export class PostgresCheckInRepository extends CheckInRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async checkIn(input: CheckInTransactionInput): Promise<CheckInResult> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const staffRows = await queryRunner.query(
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
        [input.verification.verifiedBy],
      );

      if (
        staffRows.length === 0 ||
        staffRows[0].role !== 'RECEPTIONIST' ||
        staffRows[0].isActive !== true
      ) {
        throw new BadRequestException(
          'Verifying staff member must be an active receptionist',
        );
      }

      const bookingRows = await queryRunner.query(
        `
        SELECT
          booking_id::text AS "bookingId",
          room_type_id::text AS "roomTypeId",
          room_number AS "roomNumber",
          status::text AS "status",
          check_in_date::text AS "checkInDate",
          check_out_date::text AS "checkOutDate"
        FROM bookings
        WHERE booking_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [input.bookingReference],
      );

      if (bookingRows.length === 0) {
        throw new NotFoundException('Booking not found');
      }

      const booking = bookingRows[0] as BookingRow;

      if (booking.status !== 'CONFIRMED') {
        throw new ConflictException(
          `Booking cannot be checked in from status ${booking.status}`,
        );
      }

      if (
        booking.roomNumber &&
        input.roomNumber &&
        booking.roomNumber !== input.roomNumber
      ) {
        throw new ConflictException(
          `Booking is already assigned to room ${booking.roomNumber}`,
        );
      }

      const assignedRoomNumber = booking.roomNumber ?? input.roomNumber ?? null;

      if (!assignedRoomNumber) {
        throw new BadRequestException(
          'Room number is required for an unassigned booking',
        );
      }

      const roomRows = await queryRunner.query(
        `
        SELECT
          room_number AS "roomNumber",
          room_type_id::text AS "roomTypeId",
          status::text AS "status"
        FROM rooms
        WHERE room_number = $1
        LIMIT 1
        FOR UPDATE
        `,
        [assignedRoomNumber],
      );

      if (roomRows.length === 0) {
        throw new NotFoundException('Room not found');
      }

      const room = roomRows[0] as RoomRow;

      if (room.roomTypeId !== booking.roomTypeId) {
        throw new BadRequestException(
          'Selected room does not match the booking room type',
        );
      }

      if (room.status !== 'VACANT') {
        throw new ConflictException(`Room ${room.roomNumber} is not available`);
      }

      const conflictingBookings = await queryRunner.query(
        `
        SELECT
          booking_id::text AS "bookingId"
        FROM bookings
        WHERE
          room_number = $1
          AND booking_id <> $2
          AND status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
          AND check_in_date < $4::date
          AND check_out_date > $3::date
        LIMIT 1
        `,
        [
          assignedRoomNumber,
          booking.bookingId,
          booking.checkInDate,
          booking.checkOutDate,
        ],
      );

      if (conflictingBookings.length > 0) {
        throw new ConflictException(
          `Room ${assignedRoomNumber} has a conflicting active booking`,
        );
      }

      const existingVerifications = await queryRunner.query(
        `
        SELECT
          verification_id::text AS "verificationId"
        FROM fds_id_verifications
        WHERE booking_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [booking.bookingId],
      );

      if (existingVerifications.length > 0) {
        throw new ConflictException(
          'Identity verification already exists for this booking',
        );
      }

      const verificationRows = await queryRunner.query(
        `
        INSERT INTO fds_id_verifications (
          booking_id,
          document_type,
          verification_method,
          document_storage_key,
          document_sha256,
          verified_by,
          notes
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        RETURNING
          verification_id::text AS "verificationId",
          verified_at::text AS "verifiedAt"
        `,
        [
          booking.bookingId,
          input.verification.documentType,
          input.verification.verificationMethod,
          input.verification.documentStorageKey ?? null,
          input.verification.documentSha256 ?? null,
          input.verification.verifiedBy,
          input.verification.notes ?? null,
        ],
      );

      const verification = verificationRows[0] as VerificationRow;

      await queryRunner.query(
        `
        UPDATE bookings
        SET
          room_number = $1,
          status = 'CHECKED_IN',
          updated_at = NOW()
        WHERE booking_id = $2
        `,
        [assignedRoomNumber, booking.bookingId],
      );

      await queryRunner.query(
        `
        UPDATE rooms
        SET
          status = 'OCCUPIED',
          updated_at = NOW()
        WHERE room_number = $1
        `,
        [assignedRoomNumber],
      );

      const auditDetails = {
        roomNumber: assignedRoomNumber,
        verificationId: verification.verificationId,
        verificationMethod: input.verification.verificationMethod,
        documentType: input.verification.documentType,
      };

      const auditRows = await queryRunner.query(
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
          'CHECK_IN',
          'BOOKING',
          $2,
          $3::jsonb
        )
        RETURNING
          log_id::text AS "logId"
        `,
        [
          input.verification.verifiedBy,
          booking.bookingId,
          JSON.stringify(auditDetails),
        ],
      );

      await queryRunner.commitTransaction();

      return {
        status: 'checked_in',
        bookingReference: booking.bookingId,
        roomNumber: assignedRoomNumber,
        bookingStatus: 'CHECKED_IN',
        roomStatus: 'OCCUPIED',
        verification: {
          verificationId: verification.verificationId,
          documentType: input.verification.documentType as IdentityDocumentType,
          verificationMethod: input.verification
            .verificationMethod as IdVerificationMethod,
          verifiedBy: input.verification.verifiedBy,
          verifiedAt: verification.verifiedAt,
        },
        auditLogId: String(auditRows[0].logId),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
