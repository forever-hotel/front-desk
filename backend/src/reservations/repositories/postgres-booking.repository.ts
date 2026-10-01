import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { BookingSearchResult } from '../models/booking-search-result';
import { BookingRepository } from './booking.repository';

@Injectable()
export class PostgresBookingRepository extends BookingRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async search(query: string): Promise<BookingSearchResult[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const searchTerm = `%${normalizedQuery}%`;

    const rows = await this.dataSource.query(
      `
      SELECT
        b.booking_id::text AS "bookingId",
        b.booking_id::text AS "bookingReference",
        g.full_name AS "guestName",
        g.email AS "email",
        g.phone AS "phone",
        rt.type_name AS "roomType",
        b.check_in_date::text AS "checkInDate",
        b.check_out_date::text AS "checkOutDate",
        b.status::text AS "status"
      FROM bookings b
      LEFT JOIN guests g
        ON g.guest_id = b.guest_id
      INNER JOIN room_types rt
        ON rt.room_type_id = b.room_type_id
      WHERE
        b.booking_id::text ILIKE $1
        OR g.full_name ILIKE $1
        OR g.nic_or_passport ILIKE $1
        OR g.email ILIKE $1
        OR g.phone ILIKE $1
      ORDER BY
        b.check_in_date ASC,
        b.created_at DESC
    `,
      [searchTerm],
    );

    return rows as BookingSearchResult[];
  }

  async findRecent(limit: number): Promise<BookingSearchResult[]> {
    const rows = await this.dataSource.query(
      `
      SELECT
        b.booking_id::text AS "bookingId",
        b.booking_id::text AS "bookingReference",
        g.full_name AS "guestName",
        g.email AS "email",
        g.phone AS "phone",
        rt.type_name AS "roomType",
        b.check_in_date::text AS "checkInDate",
        b.check_out_date::text AS "checkOutDate",
        b.status::text AS "status"
      FROM bookings b
      LEFT JOIN guests g
        ON g.guest_id = b.guest_id
      INNER JOIN room_types rt
        ON rt.room_type_id = b.room_type_id
      ORDER BY b.created_at DESC
      LIMIT $1
    `,
      [limit],
    );

    return rows as BookingSearchResult[];
  }

  async findArrivals(date: string): Promise<BookingSearchResult[]> {
    const rows = await this.dataSource.query(
      `
      SELECT
        b.booking_id::text AS "bookingId",
        b.booking_id::text AS "bookingReference",
        g.full_name AS "guestName",
        g.email AS "email",
        g.phone AS "phone",
        rt.type_name AS "roomType",
        b.check_in_date::text AS "checkInDate",
        b.check_out_date::text AS "checkOutDate",
        b.status::text AS "status"
      FROM bookings b
      LEFT JOIN guests g
        ON g.guest_id = b.guest_id
      INNER JOIN room_types rt
        ON rt.room_type_id = b.room_type_id
      WHERE
        b.check_in_date = $1
        AND b.status = 'CONFIRMED'
      ORDER BY
        b.created_at ASC
    `,
      [date],
    );

    return rows as BookingSearchResult[];
  }

  async findDepartures(date: string): Promise<BookingSearchResult[]> {
    const rows = await this.dataSource.query(
      `
      SELECT
        b.booking_id::text AS "bookingId",
        b.booking_id::text AS "bookingReference",
        g.full_name AS "guestName",
        g.email AS "email",
        g.phone AS "phone",
        rt.type_name AS "roomType",
        b.check_in_date::text AS "checkInDate",
        b.check_out_date::text AS "checkOutDate",
        b.status::text AS "status"
      FROM bookings b
      LEFT JOIN guests g
        ON g.guest_id = b.guest_id
      INNER JOIN room_types rt
        ON rt.room_type_id = b.room_type_id
      WHERE
        b.check_out_date = $1
        AND b.status = 'CHECKED_IN'
      ORDER BY
        b.created_at ASC
    `,
      [date],
    );

    return rows as BookingSearchResult[];
  }
}
