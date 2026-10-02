import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from '../dto/check-in-verification.dto';
import type {
  CheckInTransactionInput,
  CheckInVerificationInput,
} from '../models/check-in-transaction';
import { PostgresCheckInRepository } from './postgres-check-in.repository';

describe('PostgresCheckInRepository', () => {
  let repository: PostgresCheckInRepository;

  let dataSource: {
    createQueryRunner: jest.Mock;
  };

  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    query: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
  };

  const bookingReference = '55555555-5555-4555-8555-555555555551';

  const roomTypeId = '11111111-1111-4111-8111-111111111111';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const verificationId = '77777777-7777-4777-8777-777777777777';

  const auditLogId = '88888888-8888-4888-8888-888888888888';

  interface MockState {
    staffRows: Array<Record<string, unknown>>;
    bookingRows: Array<Record<string, unknown>>;
    roomRows: Array<Record<string, unknown>>;
    conflictingBookingRows: Array<Record<string, unknown>>;
    existingVerificationRows: Array<Record<string, unknown>>;
    verificationInsertRows: Array<Record<string, unknown>>;
    auditRows: Array<Record<string, unknown>>;
    failOnSql?: string;
  }

  let state: MockState;

  const createInput = (overrides?: {
    bookingReference?: string;
    roomNumber?: string;
    verification?: Partial<CheckInVerificationInput>;
  }): CheckInTransactionInput => ({
    bookingReference: overrides?.bookingReference ?? bookingReference,
    roomNumber:
      overrides && 'roomNumber' in overrides ? overrides.roomNumber : 'T103',
    verification: {
      documentType: IdentityDocumentType.NIC,
      verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
      verifiedBy: receptionistId,
      notes: 'Physical NIC verified',
      ...overrides?.verification,
    },
  });

  const configureQueryMock = () => {
    queryRunner.query.mockImplementation(async (sql: string) => {
      if (state.failOnSql && sql.includes(state.failOnSql)) {
        throw new Error('forced persistence failure');
      }

      if (sql.includes('FROM staff_users')) {
        return state.staffRows;
      }

      if (
        sql.includes('FROM bookings') &&
        sql.includes('booking_id <> $2') &&
        sql.includes('status IN')
      ) {
        return state.conflictingBookingRows;
      }

      if (sql.includes('FROM bookings') && sql.includes('FOR UPDATE')) {
        return state.bookingRows;
      }

      if (sql.includes('FROM rooms') && sql.includes('FOR UPDATE')) {
        return state.roomRows;
      }

      if (sql.includes('FROM fds_id_verifications')) {
        return state.existingVerificationRows;
      }

      if (sql.includes('INSERT INTO fds_id_verifications')) {
        return state.verificationInsertRows;
      }

      if (sql.includes('INSERT INTO audit_logs')) {
        return state.auditRows;
      }

      return [];
    });
  };

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    repository = new PostgresCheckInRepository(
      dataSource as unknown as DataSource,
    );

    state = {
      staffRows: [
        {
          workerId: receptionistId,
          role: 'RECEPTIONIST',
          isActive: true,
        },
      ],
      bookingRows: [
        {
          bookingId: bookingReference,
          roomTypeId,
          roomNumber: null,
          status: 'CONFIRMED',
          checkInDate: '2032-01-10',
          checkOutDate: '2032-01-12',
        },
      ],
      roomRows: [
        {
          roomNumber: 'T103',
          roomTypeId,
          status: 'VACANT',
        },
      ],
      conflictingBookingRows: [],
      existingVerificationRows: [],
      verificationInsertRows: [
        {
          verificationId,
          verifiedAt: '2032-01-10T10:00:00.000Z',
        },
      ],
      auditRows: [
        {
          logId: auditLogId,
        },
      ],
    };

    configureQueryMock();
  });

  it('should complete an unassigned-room check-in transaction', async () => {
    const result = await repository.checkIn(createInput());

    expect(queryRunner.connect).toHaveBeenCalledTimes(1);

    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM staff_users'),
      [receptionistId],
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM bookings'),
      [bookingReference],
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM rooms'),
      ['T103'],
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO fds_id_verifications'),
      [
        bookingReference,
        IdentityDocumentType.NIC,
        IdVerificationMethod.PHYSICAL_DOCUMENT,
        null,
        null,
        receptionistId,
        'Physical NIC verified',
      ],
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE bookings'),
      ['T103', bookingReference],
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rooms'),
      ['T103'],
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      [receptionistId, bookingReference, expect.any(String)],
    );

    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();

    expect(queryRunner.release).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      status: 'checked_in',
      bookingReference,
      roomNumber: 'T103',
      bookingStatus: 'CHECKED_IN',
      roomStatus: 'OCCUPIED',
      checkOutDate: '2032-01-12',
      verification: {
        verificationId,
        documentType: IdentityDocumentType.NIC,
        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
        verifiedBy: receptionistId,
        verifiedAt: '2032-01-10T10:00:00.000Z',
      },
      auditLogId,
    });
  });

  it('should use a pre-assigned room when request room number is omitted', async () => {
    state.bookingRows = [
      {
        bookingId: bookingReference,
        roomTypeId,
        roomNumber: 'T105',
        status: 'CONFIRMED',
        checkInDate: '2032-02-10',
        checkOutDate: '2032-02-12',
      },
    ];

    state.roomRows = [
      {
        roomNumber: 'T105',
        roomTypeId,
        status: 'VACANT',
      },
    ];

    const hash =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const result = await repository.checkIn(
      createInput({
        roomNumber: undefined,
        verification: {
          documentType: IdentityDocumentType.PASSPORT,
          verificationMethod: IdVerificationMethod.SCANNED_COPY,
          documentStorageKey: 'guest-id/opaque-passport-key',
          documentSha256: hash,
          notes: undefined,
        },
      }),
    );

    expect(result.roomNumber).toBe('T105');

    expect(result.checkOutDate).toBe('2032-02-12');

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO fds_id_verifications'),
      [
        bookingReference,
        IdentityDocumentType.PASSPORT,
        IdVerificationMethod.SCANNED_COPY,
        'guest-id/opaque-passport-key',
        hash,
        receptionistId,
        null,
      ],
    );
  });

  it('should accept a request matching the already assigned room', async () => {
    state.bookingRows = [
      {
        bookingId: bookingReference,
        roomTypeId,
        roomNumber: 'T105',
        status: 'CONFIRMED',
        checkInDate: '2032-02-10',
        checkOutDate: '2032-02-12',
      },
    ];

    state.roomRows = [
      {
        roomNumber: 'T105',
        roomTypeId,
        status: 'VACANT',
      },
    ];

    const result = await repository.checkIn(
      createInput({
        roomNumber: 'T105',
      }),
    );

    expect(result.roomNumber).toBe('T105');

    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('should reject an unknown verifying staff member', async () => {
    state.staffRows = [];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('should reject verifying staff who is not a receptionist', async () => {
    state.staffRows = [
      {
        workerId: receptionistId,
        role: 'WORKER',
        isActive: true,
      },
    ];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should reject an inactive receptionist', async () => {
    state.staffRows = [
      {
        workerId: receptionistId,
        role: 'RECEPTIONIST',
        isActive: false,
      },
    ];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should reject an unknown booking', async () => {
    state.bookingRows = [];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should reject a booking that is not confirmed', async () => {
    state.bookingRows = [
      {
        bookingId: bookingReference,
        roomTypeId,
        roomNumber: null,
        status: 'PENDING',
        checkInDate: '2032-01-10',
        checkOutDate: '2032-01-12',
      },
    ];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('should reject a different room when the booking is already assigned', async () => {
    state.bookingRows = [
      {
        bookingId: bookingReference,
        roomTypeId,
        roomNumber: 'T105',
        status: 'CONFIRMED',
        checkInDate: '2032-01-10',
        checkOutDate: '2032-01-12',
      },
    ];

    await expect(
      repository.checkIn(
        createInput({
          roomNumber: 'T103',
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should require a room number for an unassigned booking', async () => {
    await expect(
      repository.checkIn(
        createInput({
          roomNumber: undefined,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject an unknown room', async () => {
    state.roomRows = [];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should reject a room from another room type', async () => {
    state.roomRows = [
      {
        roomNumber: 'T103',
        roomTypeId: '99999999-9999-4999-8999-999999999999',
        status: 'VACANT',
      },
    ];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should reject a room that is not vacant', async () => {
    state.roomRows = [
      {
        roomNumber: 'T103',
        roomTypeId,
        status: 'OCCUPIED',
      },
    ];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('should reject a room with a conflicting active booking', async () => {
    state.conflictingBookingRows = [
      {
        bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    ];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('should reject duplicate identity verification for the booking', async () => {
    state.existingVerificationRows = [
      {
        verificationId: '99999999-9999-4999-8999-999999999999',
      },
    ];

    await expect(repository.checkIn(createInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('should rollback when verification persistence fails', async () => {
    state.failOnSql = 'INSERT INTO fds_id_verifications';

    await expect(repository.checkIn(createInput())).rejects.toThrow(
      'forced persistence failure',
    );

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should rollback when booking update fails', async () => {
    state.failOnSql = 'UPDATE bookings';

    await expect(repository.checkIn(createInput())).rejects.toThrow(
      'forced persistence failure',
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('should rollback when room update fails', async () => {
    state.failOnSql = 'UPDATE rooms';

    await expect(repository.checkIn(createInput())).rejects.toThrow(
      'forced persistence failure',
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('should rollback when audit persistence fails', async () => {
    state.failOnSql = 'INSERT INTO audit_logs';

    await expect(repository.checkIn(createInput())).rejects.toThrow(
      'forced persistence failure',
    );

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
