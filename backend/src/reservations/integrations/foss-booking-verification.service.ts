import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

interface BookingRow {
  bookingId: string;
  roomNumber: string | null;
  status: string;
  roomStatus: string | null;
  checkInDate: string;
  checkOutDate: string;
  guestName: string | null;
}

export interface VerifiedFossBooking {
  bookingId: string;
  roomNumber: string;
  status: 'CHECKED_IN';
  stayStart: string;
  stayEnd: string;
  guestName?: string;
}

/** Read-only authoritative booking verification consumed by the FOSS real adapter. */
@Injectable()
export class FossBookingVerificationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async verify(
    bookingId: string,
    roomNumber: string,
  ): Promise<VerifiedFossBooking> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          b.booking_id::text AS "bookingId",
          b.room_number AS "roomNumber",
          b.status::text AS "status",
          r.status::text AS "roomStatus",
          b.check_in_date::text AS "checkInDate",
          b.check_out_date::text AS "checkOutDate",
          COALESCE(wg.full_name, g.full_name) AS "guestName"
        FROM bookings b
        LEFT JOIN rooms r ON r.room_number = b.room_number
        LEFT JOIN guests g ON g.guest_id = b.guest_id
        LEFT JOIN fds_walk_in_guest_details wg ON wg.booking_id = b.booking_id
        WHERE b.booking_id = $1
        LIMIT 1
      `,
      [bookingId],
    )) as BookingRow[];

    if (rows.length === 0) {
      throw new NotFoundException('Booking not found');
    }

    const record = rows[0];
    if (
      record.status !== 'CHECKED_IN' ||
      record.roomNumber !== roomNumber ||
      record.roomStatus !== 'OCCUPIED'
    ) {
      throw new ForbiddenException(
        'Booking is not checked in to the requested occupied room',
      );
    }

    // SQL DATE values must be interpreted in the hotel's local timezone.
    // The checkout cutoff is a HOTEL POLICY, not implicit midnight UTC.
    // The 12:00 default is for local development; staging/prod must configure it.
    const checkoutTime =
      this.config.get<string>('FDS_FOSS_CHECKOUT_TIME_LOCAL') ?? '12:00';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(checkoutTime)) {
      throw new ServiceUnavailableException(
        'FOSS checkout policy is not configured correctly',
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(record.checkInDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.checkOutDate)
    ) {
      throw new ServiceUnavailableException('Booking stay dates are invalid');
    }

    const start = new Date(`${record.checkInDate}T00:00:00+05:30`);
    const end = new Date(`${record.checkOutDate}T${checkoutTime}:00+05:30`);
    const now = Date.now();
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start.getTime() >= end.getTime()
    ) {
      throw new ServiceUnavailableException(
        'Booking stay dates are inconsistent',
      );
    }

    if (now < start.getTime() || now >= end.getTime()) {
      throw new ForbiddenException('Guest stay is not currently active');
    }

    return {
      bookingId: record.bookingId,
      roomNumber: record.roomNumber,
      status: 'CHECKED_IN',
      stayStart: start.toISOString(),
      stayEnd: end.toISOString(),
      ...(record.guestName ? { guestName: record.guestName } : {}),
    };
  }
}
