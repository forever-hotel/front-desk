import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FolioBookingContext } from '../models/folio-booking-context';
import { FolioRepository } from '../ports/folio.repository';

interface FolioBookingRow {
  bookingReference: string;
  roomNumber: string | null;
  checkInDate: string;
  checkOutDate: string;
  bookingStatus: string;
  roomCharge: number;
}

@Injectable()
export class PostgresFolioRepository extends FolioRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findBookingContext(
    bookingReference: string,
  ): Promise<FolioBookingContext | null> {
    const rows = (await this.dataSource.query(
      `
      SELECT
        booking_id::text AS "bookingReference",
        room_number AS "roomNumber",
        check_in_date::text AS "checkInDate",
        check_out_date::text AS "checkOutDate",
        status::text AS "bookingStatus",
        total_amount AS "roomCharge"
      FROM bookings
      WHERE booking_id = $1
      LIMIT 1
      `,
      [bookingReference],
    )) as FolioBookingRow[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    return {
      bookingReference: String(row.bookingReference),
      roomNumber: row.roomNumber === null ? null : String(row.roomNumber),
      checkInDate: String(row.checkInDate),
      checkOutDate: String(row.checkOutDate),
      bookingStatus: String(row.bookingStatus),
      roomCharge: Number(row.roomCharge),
    };
  }
}
