import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoomStatus } from '../../rooms/models/room-status';
import { AvailableRoomChangeOption } from '../models/available-room-change-option';
import { RoomChangeResult } from '../models/room-change-result';
import {
  ChangeRoomInput,
  RoomChangeRepository,
} from '../ports/room-change.repository';

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
  status: RoomStatus;
}

interface AvailableRoomRow {
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: number;
  status: RoomStatus.VACANT;
  lastClearedAt: Date | string | null;
  updatedAt: Date | string;
}

interface AuditRow {
  logId: string;
}

@Injectable()
export class PostgresRoomChangeRepository extends RoomChangeRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findAvailableRooms(
    bookingReference: string,
  ): Promise<AvailableRoomChangeOption[]> {
    const bookingRows = (await this.dataSource.query(
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
        `,
      [bookingReference],
    )) as BookingRow[];

    if (bookingRows.length === 0) {
      throw new NotFoundException('Booking not found');
    }

    const booking = bookingRows[0];

    if (booking.status !== 'CHECKED_IN') {
      throw new ConflictException(
        `Room change requires a CHECKED_IN booking; current status is ${booking.status}`,
      );
    }

    if (!booking.roomNumber) {
      throw new ConflictException('Checked-in booking has no assigned room');
    }

    const rows = (await this.dataSource.query(
      `
        SELECT
          r.room_number AS "roomNumber",
          r.room_type_id::text AS "roomTypeId",
          rt.type_name AS "roomTypeName",
          r.floor AS "floor",
          r.status::text AS "status",
          r.last_cleared_at AS "lastClearedAt",
          r.updated_at AS "updatedAt"
        FROM rooms r
        INNER JOIN room_types rt
          ON rt.room_type_id = r.room_type_id
        WHERE
          r.room_type_id = $1
          AND r.status = 'VACANT'
          AND r.room_number <> $2
          AND NOT EXISTS (
            SELECT 1
            FROM bookings conflicting_booking
            WHERE
              conflicting_booking.room_number =
                r.room_number
              AND conflicting_booking.booking_id <> $3
              AND conflicting_booking.status IN (
                'PENDING',
                'CONFIRMED',
                'CHECKED_IN'
              )
              AND conflicting_booking.check_in_date <
                $5::date
              AND conflicting_booking.check_out_date >
                $4::date
          )
        ORDER BY
          r.floor ASC,
          r.room_number ASC
        `,
      [
        booking.roomTypeId,
        booking.roomNumber,
        booking.bookingId,
        booking.checkInDate,
        booking.checkOutDate,
      ],
    )) as AvailableRoomRow[];

    return rows.map((room) => ({
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      roomTypeName: room.roomTypeName,
      floor: room.floor,
      status: RoomStatus.VACANT,
      lastClearedAt: this.toIsoOrNull(room.lastClearedAt),
      updatedAt: this.toIso(room.updatedAt),
    }));
  }

  async changeRoom(input: ChangeRoomInput): Promise<RoomChangeResult> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      /*
       * Temporary development authorization
       * contract until centralized JWT/RBAC
       * supplies the authenticated staff identity.
       */
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
        [input.performedBy],
      );

      if (
        staffRows.length === 0 ||
        staffRows[0].role !== 'RECEPTIONIST' ||
        staffRows[0].isActive !== true
      ) {
        throw new BadRequestException(
          'Room change must be performed by an active receptionist',
        );
      }

      const bookingRows = (await queryRunner.query(
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
      )) as BookingRow[];

      if (bookingRows.length === 0) {
        throw new NotFoundException('Booking not found');
      }

      const booking = bookingRows[0];

      if (booking.status !== 'CHECKED_IN') {
        throw new ConflictException(
          `Room change requires a CHECKED_IN booking; current status is ${booking.status}`,
        );
      }

      if (!booking.roomNumber) {
        throw new ConflictException('Checked-in booking has no assigned room');
      }

      if (booking.roomNumber === input.targetRoomNumber) {
        throw new ConflictException(
          `Booking is already assigned to room ${booking.roomNumber}`,
        );
      }

      /*
       * Lock both rooms in deterministic room-number
       * order to reduce deadlock risk when concurrent
       * room-change requests involve the same rooms.
       */
      const roomRows = (await queryRunner.query(
        `
          SELECT
            room_number AS "roomNumber",
            room_type_id::text AS "roomTypeId",
            status::text AS "status"
          FROM rooms
          WHERE room_number IN ($1, $2)
          ORDER BY room_number ASC
          FOR UPDATE
          `,
        [booking.roomNumber, input.targetRoomNumber],
      )) as RoomRow[];

      const currentRoom = roomRows.find(
        (room) => room.roomNumber === booking.roomNumber,
      );

      const targetRoom = roomRows.find(
        (room) => room.roomNumber === input.targetRoomNumber,
      );

      if (!currentRoom) {
        throw new NotFoundException('Current assigned room not found');
      }

      if (!targetRoom) {
        throw new NotFoundException('Target room not found');
      }

      if (currentRoom.status !== RoomStatus.OCCUPIED) {
        throw new ConflictException(
          `Current room ${currentRoom.roomNumber} is not OCCUPIED`,
        );
      }

      if (targetRoom.roomTypeId !== booking.roomTypeId) {
        throw new BadRequestException(
          'Target room does not match the booking room type',
        );
      }

      if (targetRoom.status !== RoomStatus.VACANT) {
        throw new ConflictException(
          `Target room ${targetRoom.roomNumber} is not available`,
        );
      }

      /*
       * Re-check date-overlap availability only
       * after the target room has been row-locked.
       */
      const conflictingBookings = await queryRunner.query(
        `
          SELECT
            booking_id::text AS "bookingId"
          FROM bookings
          WHERE
            room_number = $1
            AND booking_id <> $2
            AND status IN (
              'PENDING',
              'CONFIRMED',
              'CHECKED_IN'
            )
            AND check_in_date < $4::date
            AND check_out_date > $3::date
          LIMIT 1
          `,
        [
          targetRoom.roomNumber,
          booking.bookingId,
          booking.checkInDate,
          booking.checkOutDate,
        ],
      );

      if (conflictingBookings.length > 0) {
        throw new ConflictException(
          `Target room ${targetRoom.roomNumber} has a conflicting active booking`,
        );
      }

      await queryRunner.query(
        `
        UPDATE bookings
        SET
          room_number = $1,
          updated_at = NOW()
        WHERE booking_id = $2
        `,
        [targetRoom.roomNumber, booking.bookingId],
      );

      /*
       * The previous guest room must be cleaned
       * before becoming available again.
       */
      await queryRunner.query(
        `
        UPDATE rooms
        SET
          status = 'REQUIRES_CLEANING',
          updated_at = NOW()
        WHERE room_number = $1
        `,
        [currentRoom.roomNumber],
      );

      await queryRunner.query(
        `
        UPDATE rooms
        SET
          status = 'OCCUPIED',
          updated_at = NOW()
        WHERE room_number = $1
        `,
        [targetRoom.roomNumber],
      );

      const auditDetails = {
        previousRoomNumber: currentRoom.roomNumber,
        targetRoomNumber: targetRoom.roomNumber,
        reason: input.reason ?? null,
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
            'ROOM_CHANGE',
            'BOOKING',
            $2,
            $3::jsonb
          )
          RETURNING
            log_id::text AS "logId"
          `,
        [input.performedBy, booking.bookingId, JSON.stringify(auditDetails)],
      )) as unknown[];

      const auditRows = this.normalizeMutationRows<AuditRow>(auditRawResult);

      const audit = auditRows[0];

      if (!audit) {
        throw new Error(
          'Room change audit record was not returned after insert',
        );
      }

      const result: RoomChangeResult = {
        status: 'room_changed',
        bookingReference: booking.bookingId,
        previousRoomNumber: currentRoom.roomNumber,
        roomNumber: targetRoom.roomNumber,
        previousRoomStatus: RoomStatus.REQUIRES_CLEANING,
        roomStatus: RoomStatus.OCCUPIED,
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

  private toIsoOrNull(value: Date | string | null): string | null {
    if (value === null) {
      return null;
    }

    return this.toIso(value);
  }
}
