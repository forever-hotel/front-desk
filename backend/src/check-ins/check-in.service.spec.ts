import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CheckInService } from './check-in.service';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from './dto/check-in-verification.dto';
import { CheckInRepository } from './ports/check-in.repository';

describe('CheckInService', () => {
  let service: CheckInService;
  let repository: jest.Mocked<CheckInRepository>;

  const bookingReference = '33333333-3333-4333-8333-333333333333';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const successfulResult = {
    status: 'checked_in' as const,
    bookingReference,
    roomNumber: 'T103',
    bookingStatus: 'CHECKED_IN' as const,
    roomStatus: 'OCCUPIED' as const,
    verification: {
      verificationId: '77777777-7777-4777-8777-777777777777',
      documentType: IdentityDocumentType.NIC,
      verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
      verifiedBy: receptionistId,
      verifiedAt: '2030-01-10T10:00:00.000Z',
    },
    auditLogId: '88888888-8888-4888-8888-888888888888',
  };

  beforeEach(async () => {
    const repositoryMock = {
      checkIn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInService,
        {
          provide: CheckInRepository,
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get(CheckInService);
    repository = module.get(CheckInRepository);
  });

  it('should check in using physical-document verification', async () => {
    repository.checkIn.mockResolvedValue(successfulResult);

    await expect(
      service.checkIn({
        bookingReference,
        roomNumber: 'T103',
        verification: {
          documentType: IdentityDocumentType.NIC,
          verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
          verifiedBy: receptionistId,
          notes: ' Physical NIC verified ',
        },
      }),
    ).resolves.toEqual(successfulResult);

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
  });

  it('should check in using scanned-copy verification metadata', async () => {
    const scannedResult = {
      ...successfulResult,
      verification: {
        ...successfulResult.verification,
        documentType: IdentityDocumentType.PASSPORT,
        verificationMethod: IdVerificationMethod.SCANNED_COPY,
      },
    };

    repository.checkIn.mockResolvedValue(scannedResult);

    const hash =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    await expect(
      service.checkIn({
        bookingReference,
        roomNumber: 'T103',
        verification: {
          documentType: IdentityDocumentType.PASSPORT,
          verificationMethod: IdVerificationMethod.SCANNED_COPY,
          verifiedBy: receptionistId,
          documentStorageKey: ' guest-id/opaque-object-key ',
          documentSha256: hash.toUpperCase(),
        },
      }),
    ).resolves.toEqual(scannedResult);

    expect(repository.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        verification: expect.objectContaining({
          documentStorageKey: 'guest-id/opaque-object-key',
          documentSha256: hash,
        }),
      }),
    );
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
      ...successfulResult,
      roomNumber: 'T101',
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
  });
});
