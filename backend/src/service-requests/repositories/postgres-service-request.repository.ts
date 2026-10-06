import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ServiceRequestStay } from '../models/service-request-stay';
import { ServiceRequestRepository } from '../ports/service-request.repository';

@Injectable()
export class PostgresServiceRequestRepository extends ServiceRequestRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findStay(bookingReference: string): Promise<ServiceRequestStay | null> {
    const rows = await this.dataSource.query(
      `
      SELECT
        booking_id::text AS "bookingReference",
        room_number AS "roomNumber",
        status::text AS "bookingStatus"
      FROM bookings
      WHERE booking_id = $1
      LIMIT 1
      `,
      [bookingReference],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as ServiceRequestStay;
  }
}
