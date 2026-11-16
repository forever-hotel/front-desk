import { Injectable, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ServiceRequestStay } from '../models/service-request-stay';
import { ServiceRequestRepository } from '../ports/service-request.repository';

@Injectable()
export class PostgresServiceRequestRepository extends ServiceRequestRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async createFrontDeskRequest(input: {
    requestId: string;
    performedBy: string;
    bookingReference: string;
    roomNumber: string;
    category: string;
    description?: string;
  }): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        ['fds-request:' + input.requestId],
      );
      const [existing] = await manager.query<Record<string, unknown>[]>(
        'SELECT * FROM public.foss_service_requests WHERE request_id=$1',
        [input.requestId],
      );
      if (existing) {
        if (
          existing.source !== 'FRONT_DESK' ||
          existing.booking_id !== input.bookingReference ||
          existing.room_number !== input.roomNumber ||
          existing.category !== input.category ||
          (existing.description ?? '') !== (input.description ?? '')
        )
          throw new ConflictException(
            'The request key was already used with different details',
          );
        return input.requestId;
      }
      const rows = await manager.query<{ request_id: string }[]>(
        `INSERT INTO public.foss_service_requests(request_id,booking_id,room_number,category,description,source)
        SELECT $1,b.booking_id,b.room_number,$4,$5,'FRONT_DESK' FROM public.bookings b
        WHERE b.booking_id=$2 AND b.room_number=$3 AND b.status='CHECKED_IN' RETURNING request_id`,
        [
          input.requestId,
          input.bookingReference,
          input.roomNumber,
          input.category,
          input.description ?? null,
        ],
      );
      if (!rows.length)
        throw new ConflictException('Booking is no longer checked in');
      await manager.query(
        `INSERT INTO public.audit_logs(event_category,actor_type,staff_user_id,action,entity_type,entity_id,details)
        VALUES('FRONT_DESK_OPERATION','STAFF',$1,'SERVICE_REQUEST_CREATED','SERVICE_REQUEST',$2,$3::jsonb)`,
        [
          input.performedBy,
          input.requestId,
          JSON.stringify({
            bookingReference: input.bookingReference,
            roomNumber: input.roomNumber,
          }),
        ],
      );
      return rows[0].request_id;
    });
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
