import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CheckInDocumentType,
  CheckInPrintRequestDto,
} from './check-in-print-request.dto';
import { CheckInRequestDto } from './check-in-request.dto';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from './check-in-verification.dto';

describe('Check-in DTO validation', () => {
  const bookingReference = '55555555-5555-4555-8555-555555555551';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  it('should transform and validate a physical-document request', async () => {
    const dto = plainToInstance(CheckInRequestDto, {
      bookingReference,
      roomNumber: ' t103 ',
      verification: {
        documentType: ' nic ',
        verificationMethod: ' physical_document ',
        verifiedBy: receptionistId,
        notes: ' Physical NIC verified ',
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.roomNumber).toBe('T103');

    expect(dto.verification.documentType).toBe(IdentityDocumentType.NIC);

    expect(dto.verification.verificationMethod).toBe(
      IdVerificationMethod.PHYSICAL_DOCUMENT,
    );

    expect(dto.verification.notes).toBe('Physical NIC verified');
  });

  it('should transform and validate scanned-copy metadata', async () => {
    const uppercaseHash =
      'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789';

    const dto = plainToInstance(CheckInRequestDto, {
      bookingReference,
      roomNumber: 'T105',
      verification: {
        documentType: ' passport ',
        verificationMethod: ' scanned_copy ',
        verifiedBy: receptionistId,
        documentStorageKey: ' guest-id/opaque-passport-key ',
        documentSha256: ` ${uppercaseHash} `,
        notes: ' Passport scan checked ',
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.verification.documentType).toBe(IdentityDocumentType.PASSPORT);

    expect(dto.verification.verificationMethod).toBe(
      IdVerificationMethod.SCANNED_COPY,
    );

    expect(dto.verification.documentStorageKey).toBe(
      'guest-id/opaque-passport-key',
    );

    expect(dto.verification.documentSha256).toBe(uppercaseHash.toLowerCase());

    expect(dto.verification.notes).toBe('Passport scan checked');
  });

  it('should allow optional room and scanned metadata to be omitted', async () => {
    const dto = plainToInstance(CheckInRequestDto, {
      bookingReference,
      verification: {
        documentType: 'NIC',
        verificationMethod: 'PHYSICAL_DOCUMENT',
        verifiedBy: receptionistId,
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.roomNumber).toBeUndefined();

    expect(dto.verification.documentStorageKey).toBeUndefined();

    expect(dto.verification.documentSha256).toBeUndefined();

    expect(dto.verification.notes).toBeUndefined();
  });

  it('should reject invalid booking and verification values', async () => {
    const dto = plainToInstance(CheckInRequestDto, {
      bookingReference: 'not-a-uuid',
      roomNumber: 'room number with spaces',
      verification: {
        documentType: 'DRIVING_LICENSE',
        verificationMethod: 'MANUAL',
        verifiedBy: 'not-a-uuid',
        documentSha256: 'invalid-hash',
      },
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should exercise non-string transformation branches safely', async () => {
    const dto = plainToInstance(CheckInRequestDto, {
      bookingReference,
      roomNumber: 123,
      verification: {
        documentType: 123,
        verificationMethod: 456,
        verifiedBy: receptionistId,
        documentStorageKey: 789,
        documentSha256: 123,
        notes: 456,
      },
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);

    expect(dto.roomNumber).toBe(123);
    expect(dto.verification.documentType).toBe(123);

    expect(dto.verification.verificationMethod).toBe(456);

    expect(dto.verification.documentStorageKey).toBe(789);

    expect(dto.verification.documentSha256).toBe(123);

    expect(dto.verification.notes).toBe(456);
  });

  it('should reject an invalid room-number format', async () => {
    const dto = plainToInstance(CheckInRequestDto, {
      bookingReference,
      roomNumber: 'T 103!',
      verification: {
        documentType: 'NIC',
        verificationMethod: 'PHYSICAL_DOCUMENT',
        verifiedBy: receptionistId,
      },
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an invalid SHA-256 value', async () => {
    const dto = plainToInstance(CheckInRequestDto, {
      bookingReference,
      roomNumber: 'T103',
      verification: {
        documentType: 'PASSPORT',
        verificationMethod: 'SCANNED_COPY',
        verifiedBy: receptionistId,
        documentStorageKey: 'guest-id/test-key',
        documentSha256: 'abc123',
      },
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should transform and validate a registration-card print request', async () => {
    const dto = plainToInstance(CheckInPrintRequestDto, {
      documentType: ' registration_card ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.documentType).toBe(CheckInDocumentType.REGISTRATION_CARD);
  });

  it('should transform and validate a payment-receipt print request', async () => {
    const dto = plainToInstance(CheckInPrintRequestDto, {
      documentType: ' payment_receipt ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.documentType).toBe(CheckInDocumentType.PAYMENT_RECEIPT);
  });

  it('should reject an unsupported check-in document type', async () => {
    const dto = plainToInstance(CheckInPrintRequestDto, {
      documentType: 'BOARDING_PASS',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should safely handle non-string print document input', async () => {
    const dto = plainToInstance(CheckInPrintRequestDto, {
      documentType: 123,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(dto.documentType).toBe(123);
  });
});
