import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Booking-specific guest data, without creating a guest login account. */
export class CreateFdsWalkInGuestDetails1793404800000 implements MigrationInterface {
  name = 'CreateFdsWalkInGuestDetails1793404800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE fds_walk_in_guest_details (
        booking_id UUID PRIMARY KEY
          REFERENCES bookings(booking_id) ON DELETE RESTRICT,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(320) NOT NULL,
        nic_or_passport VARCHAR(50),
        phone VARCHAR(20),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_fds_walk_in_guest_name
          CHECK (LENGTH(BTRIM(full_name)) > 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE fds_walk_in_guest_details');
  }
}
