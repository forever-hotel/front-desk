import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from '../../src/check-ins/dto/check-in-verification.dto';
import { PostgresCheckInRepository } from '../../src/check-ins/repositories/postgres-check-in.repository';

describe('PostgresCheckInRepository integration', () => {
  let dataSource: DataSource;
  let repository: PostgresCheckInRepository;

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true',
    });

    await dataSource.initialize();

    repository = new PostgresCheckInRepository(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('checks in a confirmed booking with physical-document verification', async () => {
    const bookingReference = '55555555-5555-4555-8555-555555555551';

    const result = await repository.checkIn({
      bookingReference,
      roomNumber: 'T103',
      verification: {
        documentType: IdentityDocumentType.NIC,
        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
        verifiedBy: receptionistId,
        notes: 'Physical NIC verified at reception',
      },
    });

    expect(result.status).toBe('checked_in');
    expect(result.bookingReference).toBe(bookingReference);
    expect(result.roomNumber).toBe('T103');
    expect(result.bookingStatus).toBe('CHECKED_IN');
    expect(result.roomStatus).toBe('OCCUPIED');

    const bookingRows = await dataSource.query(
      `
      SELECT
        room_number AS "roomNumber",
        status::text AS "status"
      FROM bookings
      WHERE booking_id = $1
      `,
      [bookingReference],
    );

    expect(bookingRows).toHaveLength(1);
    expect(bookingRows[0].roomNumber).toBe('T103');
    expect(bookingRows[0].status).toBe('CHECKED_IN');

    const roomRows = await dataSource.query(
      `
      SELECT
        status::text AS "status"
      FROM rooms
      WHERE room_number = $1
      `,
      ['T103'],
    );

    expect(roomRows).toHaveLength(1);
    expect(roomRows[0].status).toBe('OCCUPIED');

    const verificationRows = await dataSource.query(
      `
      SELECT
        document_type::text AS "documentType",
        verification_method::text AS "verificationMethod",
        document_storage_key AS "documentStorageKey",
        verified_by::text AS "verifiedBy"
      FROM fds_id_verifications
      WHERE booking_id = $1
      `,
      [bookingReference],
    );

    expect(verificationRows).toHaveLength(1);
    expect(verificationRows[0]).toEqual(
      expect.objectContaining({
        documentType: 'NIC',
        verificationMethod: 'PHYSICAL_DOCUMENT',
        documentStorageKey: null,
        verifiedBy: receptionistId,
      }),
    );

    const auditRows = await dataSource.query(
      `
      SELECT
        event_category::text AS "eventCategory",
        actor_type::text AS "actorType",
        staff_user_id::text AS "staffUserId",
        action,
        entity_type AS "entityType",
        entity_id AS "entityId",
        details
      FROM audit_logs
      WHERE log_id = $1
      `,
      [result.auditLogId],
    );

    expect(auditRows).toHaveLength(1);

    expect(auditRows[0]).toEqual(
      expect.objectContaining({
        eventCategory: 'FRONT_DESK_OPERATION',
        actorType: 'STAFF',
        staffUserId: receptionistId,
        action: 'CHECK_IN',
        entityType: 'BOOKING',
        entityId: bookingReference,
      }),
    );

    expect(auditRows[0].details).toEqual(
      expect.objectContaining({
        roomNumber: 'T103',
        verificationMethod: 'PHYSICAL_DOCUMENT',
        documentType: 'NIC',
      }),
    );

    expect(auditRows[0].details).not.toHaveProperty('guestName');
    expect(auditRows[0].details).not.toHaveProperty('email');
    expect(auditRows[0].details).not.toHaveProperty('phone');
    expect(auditRows[0].details).not.toHaveProperty('nicOrPassport');
  });

  it('checks in a pre-assigned booking with scanned-copy metadata', async () => {
    const bookingReference = '55555555-5555-4555-8555-555555555552';

    const documentSha256 =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const result = await repository.checkIn({
      bookingReference,
      verification: {
        documentType: IdentityDocumentType.PASSPORT,
        verificationMethod: IdVerificationMethod.SCANNED_COPY,
        verifiedBy: receptionistId,
        documentStorageKey: 'guest-id/opaque-passport-object-key',
        documentSha256,
      },
    });

    expect(result.roomNumber).toBe('T105');
    expect(result.bookingStatus).toBe('CHECKED_IN');
    expect(result.roomStatus).toBe('OCCUPIED');

    const verificationRows = await dataSource.query(
      `
      SELECT
        document_type::text AS "documentType",
        verification_method::text AS "verificationMethod",
        document_storage_key AS "documentStorageKey",
        document_sha256 AS "documentSha256"
      FROM fds_id_verifications
      WHERE booking_id = $1
      `,
      [bookingReference],
    );

    expect(verificationRows).toHaveLength(1);

    expect(verificationRows[0]).toEqual({
      documentType: 'PASSPORT',
      verificationMethod: 'SCANNED_COPY',
      documentStorageKey: 'guest-id/opaque-passport-object-key',
      documentSha256,
    });
  });

  it('rejects a booking that is not confirmed', async () => {
    await expect(
      repository.checkIn({
        bookingReference: '55555555-5555-4555-8555-555555555553',
        roomNumber: 'T103',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: receptionistId,
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an occupied room', async () => {
    await expect(
      repository.checkIn({
        bookingReference: '55555555-5555-4555-8555-555555555554',
        roomNumber: 'T104',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: receptionistId,
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a room from a different room type', async () => {
    await expect(
      repository.checkIn({
        bookingReference: '55555555-5555-4555-8555-555555555555',
        roomNumber: 'S201',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: receptionistId,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a room with an overlapping active booking', async () => {
    await expect(
      repository.checkIn({
        bookingReference: '55555555-5555-4555-8555-555555555556',
        roomNumber: 'T106',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: receptionistId,
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a verifying staff member who is not a receptionist', async () => {
    await expect(
      repository.checkIn({
        bookingReference: '55555555-5555-4555-8555-555555555558',
        roomNumber: 'T107',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: '67676767-6767-4676-8676-676767676767',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive receptionist', async () => {
    await expect(
      repository.checkIn({
        bookingReference: '55555555-5555-4555-8555-555555555558',
        roomNumber: 'T107',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: '68686868-6868-4686-8686-686868686868',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rolls back verification, booking, and room changes when audit persistence fails', async () => {
    const bookingReference = '55555555-5555-4555-8555-555555555558';

    await dataSource.query(`
      CREATE OR REPLACE FUNCTION fail_plan07_audit_insert()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.entity_id =
          '55555555-5555-4555-8555-555555555558'
        THEN
          RAISE EXCEPTION 'forced Plan 07 audit failure';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await dataSource.query(`
      CREATE TRIGGER fail_plan07_audit_insert_trigger
      BEFORE INSERT ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION fail_plan07_audit_insert()
    `);

    try {
      await expect(
        repository.checkIn({
          bookingReference,
          roomNumber: 'T107',
          verification: {
            documentType: IdentityDocumentType.NIC,
            verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
            verifiedBy: receptionistId,
          },
        }),
      ).rejects.toThrow('forced Plan 07 audit failure');

      const bookingRows = await dataSource.query(
        `
        SELECT
          room_number AS "roomNumber",
          status::text AS "status"
        FROM bookings
        WHERE booking_id = $1
        `,
        [bookingReference],
      );

      expect(bookingRows).toHaveLength(1);
      expect(bookingRows[0].roomNumber).toBeNull();
      expect(bookingRows[0].status).toBe('CONFIRMED');

      const roomRows = await dataSource.query(
        `
        SELECT
          status::text AS "status"
        FROM rooms
        WHERE room_number = $1
        `,
        ['T107'],
      );

      expect(roomRows).toHaveLength(1);
      expect(roomRows[0].status).toBe('VACANT');

      const verificationRows = await dataSource.query(
        `
        SELECT verification_id
        FROM fds_id_verifications
        WHERE booking_id = $1
        `,
        [bookingReference],
      );

      expect(verificationRows).toHaveLength(0);

      const auditRows = await dataSource.query(
        `
        SELECT log_id
        FROM audit_logs
        WHERE entity_type = 'BOOKING'
          AND entity_id = $1
          AND action = 'CHECK_IN'
        `,
        [bookingReference],
      );

      expect(auditRows).toHaveLength(0);
    } finally {
      await dataSource.query(`
        DROP TRIGGER IF EXISTS fail_plan07_audit_insert_trigger
        ON audit_logs
      `);

      await dataSource.query(`
        DROP FUNCTION IF EXISTS fail_plan07_audit_insert()
      `);
    }
  });
});
