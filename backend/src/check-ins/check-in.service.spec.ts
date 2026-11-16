import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CheckInService } from './check-in.service';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from './dto/check-in-verification.dto';
import { CheckInRepository } from './ports/check-in.repository';
import { FossSessionGateway } from './ports/foss-session.gateway';

describe('CheckInService', () => {
  let service: CheckInService;
  let repository: jest.Mocked<CheckInRepository>;
  let fossSessionGateway: jest.Mocked<FossSessionGateway>;

  const bookingReference = '33333333-3333-4333-8333-333333333333';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const committedCheckIn = {
    status: 'checked_in' as const,
    bookingReference,
    roomNumber: 'T103',
    bookingStatus: 'CHECKED_IN' as const,
    roomStatus: 'OCCUPIED' as const,
    checkOutDate: '2030-01-12',
    verification: {
      verificationId: '77777777-7777-4777-8777-777777777777',
      documentType: IdentityDocumentType.NIC,
      verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
      verifiedBy: receptionistId,
      verifiedAt: '2030-01-10T10:00:00.000Z',
    },
    auditLogId: '88888888-8888-4888-8888-888888888888',
  };

  const fossActivation = {
    status: 'ACTIVATED' as const,
    sessionReference: 'mock-foss-session-33333333-3333-4333-8333-333333333333',
    validUntilDate: '2030-01-12',
  };

  beforeEach(async () => {
    const repositoryMock = {
      checkIn: jest.fn(),
    };

    const fossSessionGatewayMock = {
      activateGuestSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInService,
        {
          provide: CheckInRepository,
          useValue: repositoryMock,
        },
        {
          provide: FossSessionGateway,
          useValue: fossSessionGatewayMock,
        },
      ],
    }).compile();

    service = module.get(CheckInService);
    repository = module.get(CheckInRepository);
    fossSessionGateway = module.get(FossSessionGateway);
  });

  it('should check in and activate FOSS access after the domain transaction succeeds', async () => {
    repository.checkIn.mockResolvedValue(committedCheckIn);

    fossSessionGateway.activateGuestSession.mockResolvedValue(fossActivation);

    const result = await service.checkIn({
      bookingReference,
      roomNumber: 'T103',
      verification: {
        documentType: IdentityDocumentType.NIC,
        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
        verifiedBy: receptionistId,
        notes: ' Physical NIC verified ',
      },
    });

    expect(repository.checkIn).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T103',
      verification: {
        documentType: IdentityDocumentType.NIC,
        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
        verifiedBy: receptionistId,
        documentStorageKey: undefined,
        documentSha256: undefined,
        notes: 'Physical NIC verified',
      },
    });

    expect(fossSessionGateway.activateGuestSession).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T103',
      checkOutDate: '2030-01-12',
    });

    expect(repository.checkIn.mock.invocationCallOrder[0]).toBeLessThan(
      fossSessionGateway.activateGuestSession.mock.invocationCallOrder[0],
    );

    expect(result).toEqual({
      status: 'checked_in',
      bookingReference,
      roomNumber: 'T103',
      bookingStatus: 'CHECKED_IN',
      roomStatus: 'OCCUPIED',
      verification: committedCheckIn.verification,
      auditLogId: committedCheckIn.auditLogId,
      fossSession: fossActivation,
    });
  });

  it('should pass scanned-copy metadata and activate FOSS access', async () => {
    const scannedCheckIn = {
      ...committedCheckIn,
      roomNumber: 'T105',
      verification: {
        ...committedCheckIn.verification,
        documentType: IdentityDocumentType.PASSPORT,
        verificationMethod: IdVerificationMethod.SCANNED_COPY,
      },
    };

    repository.checkIn.mockResolvedValue(scannedCheckIn);

    fossSessionGateway.activateGuestSession.mockResolvedValue({
      ...fossActivation,
      sessionReference: 'mock-foss-session-scanned',
    });

    const hash =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const result = await service.checkIn({
      bookingReference,
      roomNumber: 'T105',
      verification: {
        documentType: IdentityDocumentType.PASSPORT,
        verificationMethod: IdVerificationMethod.SCANNED_COPY,
        verifiedBy: receptionistId,
        documentStorageKey: ' guest-id/opaque-object-key ',
        documentSha256: hash.toUpperCase(),
      },
    });

    expect(repository.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        verification: expect.objectContaining({
          documentStorageKey: 'guest-id/opaque-object-key',
          documentSha256: hash,
        }),
      }),
    );

    expect(fossSessionGateway.activateGuestSession).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T105',
      checkOutDate: '2030-01-12',
    });

    expect(result.fossSession.status).toBe('ACTIVATED');
  });

  it('should keep the committed check-in successful when FOSS activation fails', async () => {
    repository.checkIn.mockResolvedValue(committedCheckIn);

    fossSessionGateway.activateGuestSession.mockRejectedValue(
      new Error('FOSS unavailable'),
    );

    const result = await service.checkIn({
      bookingReference,
      roomNumber: 'T103',
      verification: {
        documentType: IdentityDocumentType.NIC,
        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
        verifiedBy: receptionistId,
      },
    });

    expect(result).toEqual({
      status: 'checked_in',
      bookingReference,
      roomNumber: 'T103',
      bookingStatus: 'CHECKED_IN',
      roomStatus: 'OCCUPIED',
      verification: committedCheckIn.verification,
      auditLogId: committedCheckIn.auditLogId,
      fossSession: {
        status: 'FAILED',
        sessionReference: null,
        validUntilDate: '2030-01-12',
        failureCode: 'FOSS_ACTIVATION_FAILED',
      },
    });

    expect(repository.checkIn).toHaveBeenCalledTimes(1);

    expect(fossSessionGateway.activateGuestSession).toHaveBeenCalledTimes(1);
  });

  it('should not request FOSS activation when the database check-in fails', async () => {
    repository.checkIn.mockRejectedValue(
      new Error('database transaction failed'),
    );

    await expect(
      service.checkIn({
        bookingReference,
        roomNumber: 'T103',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: receptionistId,
        },
      }),
    ).rejects.toThrow('database transaction failed');

    expect(fossSessionGateway.activateGuestSession).not.toHaveBeenCalled();
  });

  it('should reject scanned-copy verification without a storage key', async () => {
    await expect(
      service.checkIn({
        bookingReference,
        roomNumber: 'T103',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.SCANNED_COPY,
          verifiedBy: receptionistId,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.checkIn).not.toHaveBeenCalled();

    expect(fossSessionGateway.activateGuestSession).not.toHaveBeenCalled();
  });

  it('should reject physical verification with a storage key', async () => {
    await expect(
      service.checkIn({
        bookingReference,
        roomNumber: 'T103',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: receptionistId,
          documentStorageKey: 'guest-id/should-not-be-present',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.checkIn).not.toHaveBeenCalled();
  });

  it('should reject physical verification with a document hash', async () => {
    await expect(
      service.checkIn({
        bookingReference,
        roomNumber: 'T103',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: receptionistId,
          documentSha256:
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.checkIn).not.toHaveBeenCalled();
  });

  it('should allow room number to be omitted for a pre-assigned booking', async () => {
    repository.checkIn.mockResolvedValue({
      ...committedCheckIn,
      roomNumber: 'T101',
    });

    fossSessionGateway.activateGuestSession.mockResolvedValue({
      ...fossActivation,
      sessionReference: 'mock-foss-session-preassigned',
    });

    await service.checkIn({
      bookingReference,
      verification: {
        documentType: IdentityDocumentType.NIC,
        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
        verifiedBy: receptionistId,
      },
    });

    expect(repository.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingReference,
        roomNumber: undefined,
      }),
    );

    expect(fossSessionGateway.activateGuestSession).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T101',
      checkOutDate: '2030-01-12',
    });
  });
});
