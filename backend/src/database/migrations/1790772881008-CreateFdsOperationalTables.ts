import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFdsOperationalTables1790772881008 implements MigrationInterface {
  name = 'CreateFdsOperationalTables1790772881008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE fds_id_verification_method AS ENUM (
        'PHYSICAL_DOCUMENT',
        'SCANNED_COPY'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE fds_identity_document_type AS ENUM (
        'NIC',
        'PASSPORT',
        'OTHER'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE fds_booking_import_status AS ENUM (
        'PENDING',
        'IMPORTED',
        'FAILED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE fds_booking_imports (
        import_id UUID
          PRIMARY KEY DEFAULT uuid_generate_v4(),

        provider VARCHAR(50)
          NOT NULL DEFAULT 'BOOKING_LK'
          CHECK (provider = 'BOOKING_LK'),

        external_booking_ref VARCHAR(255)
          NOT NULL,

        booking_id UUID
          UNIQUE
          REFERENCES bookings(booking_id)
          ON DELETE RESTRICT,

        import_status fds_booking_import_status
          NOT NULL DEFAULT 'PENDING',

        payload_sha256 CHAR(64),

        imported_by UUID
          REFERENCES staff_users(worker_id)
          ON DELETE RESTRICT,

        last_attempted_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW(),

        imported_at TIMESTAMPTZ,

        error_message VARCHAR(1000),

        created_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW(),

        updated_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_fds_booking_import_external_ref
          UNIQUE (provider, external_booking_ref),

        CONSTRAINT chk_fds_booking_import_payload_hash
          CHECK (
            payload_sha256 IS NULL
            OR payload_sha256 ~ '^[0-9A-Fa-f]{64}$'
          ),

        CONSTRAINT chk_fds_booking_import_result
          CHECK (
            (
              import_status = 'PENDING'
              AND booking_id IS NULL
              AND imported_at IS NULL
            )
            OR
            (
              import_status = 'IMPORTED'
              AND booking_id IS NOT NULL
              AND imported_at IS NOT NULL
              AND error_message IS NULL
            )
            OR
            (
              import_status = 'FAILED'
              AND booking_id IS NULL
              AND imported_at IS NULL
              AND error_message IS NOT NULL
            )
          )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE fds_id_verifications (
        verification_id UUID
          PRIMARY KEY DEFAULT uuid_generate_v4(),

        booking_id UUID
          NOT NULL UNIQUE
          REFERENCES bookings(booking_id)
          ON DELETE RESTRICT,

        document_type fds_identity_document_type
          NOT NULL,

        verification_method fds_id_verification_method
          NOT NULL,

        document_storage_key VARCHAR(500),

        document_sha256 CHAR(64),

        verified_by UUID
          NOT NULL
          REFERENCES staff_users(worker_id)
          ON DELETE RESTRICT,

        verified_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW(),

        notes VARCHAR(500),

        created_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW(),

        updated_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW(),

        CONSTRAINT chk_fds_id_verification_storage
          CHECK (
            (
              verification_method = 'SCANNED_COPY'
              AND document_storage_key IS NOT NULL
            )
            OR
            (
              verification_method = 'PHYSICAL_DOCUMENT'
              AND document_storage_key IS NULL
            )
          ),

        CONSTRAINT chk_fds_id_verification_hash
          CHECK (
            document_sha256 IS NULL
            OR document_sha256 ~ '^[0-9A-Fa-f]{64}$'
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_guests_full_name_lower
        ON guests (LOWER(full_name))
    `);

    await queryRunner.query(`
      CREATE INDEX idx_guests_nic_or_passport
        ON guests(nic_or_passport)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_guests_phone
        ON guests(phone)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_bookings_arrivals
        ON bookings(check_in_date, status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_bookings_departures
        ON bookings(check_out_date, status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_bookings_room_dates_status
        ON bookings(room_number, check_in_date, check_out_date, status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fds_booking_imports_status
        ON fds_booking_imports(import_status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fds_booking_imports_booking
        ON fds_booking_imports(booking_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fds_booking_imports_last_attempted
        ON fds_booking_imports(last_attempted_at)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fds_id_verifications_verified_by
        ON fds_id_verifications(verified_by)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fds_id_verifications_verified_at
        ON fds_id_verifications(verified_at)
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON fds_booking_imports
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_updated_at()
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON fds_id_verifications
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_fds_id_verifications_verified_at
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_fds_id_verifications_verified_by
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_fds_booking_imports_last_attempted
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_fds_booking_imports_booking
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_fds_booking_imports_status
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bookings_room_dates_status
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bookings_departures
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bookings_arrivals
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_guests_phone
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_guests_nic_or_passport
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_guests_full_name_lower
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS fds_id_verifications
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS fds_booking_imports
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS fds_booking_import_status
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS fds_identity_document_type
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS fds_id_verification_method
    `);
  }
}
