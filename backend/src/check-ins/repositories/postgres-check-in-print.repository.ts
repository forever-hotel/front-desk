import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { CheckInPrintContext } from '../models/check-in-print-context';
import { CheckInPrintRepository } from '../ports/check-in-print.repository';

interface CheckInPrintRow {
  bookingReference: string;
  roomNumber: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
}

@Injectable()
export class PostgresCheckInPrintRepository extends CheckInPrintRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findPrintContext(
    bookingReference: string,
  ): Promise<CheckInPrintContext | null> {
    const rows = await this.dataSource.query(
      `
      SELECT
        booking_id::text AS "bookingReference",
        room_number AS "roomNumber",
        status::text AS "status",
        check_in_date::text AS "checkInDate",
        check_out_date::text AS "checkOutDate"
      FROM bookings
      WHERE booking_id = $1
      LIMIT 1
      `,
      [bookingReference],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as CheckInPrintRow;
  }
}
