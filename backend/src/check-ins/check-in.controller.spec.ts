import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { SystemRole } from '../security/auth/system-role';
import { CheckInController } from './check-in.controller';
import { CheckInPrintService } from './check-in-print.service';
import { CheckInService } from './check-in.service';
import { CheckInDocumentType } from './dto/check-in-print-request.dto';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from './dto/check-in-verification.dto';

describe('CheckInController', () => {
  let controller: CheckInController;

  let checkInService: {
    checkIn: jest.Mock;
  };

  let printService: {
    requestPrint: jest.Mock;
  };

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const anotherReceptionistId = '77777777-7777-4777-8777-777777777777';

  const principal: AuthenticatedPrincipal = {
    userId: receptionistId,
    role: SystemRole.RECEPTIONIST,
  };

  beforeEach(() => {
    checkInService = {
      checkIn: jest.fn(),
    };

    printService = {
      requestPrint: jest.fn(),
    };

    controller = new CheckInController(
      checkInService as unknown as CheckInService,
      printService as unknown as CheckInPrintService,
    );
  });

  it('should pass a trusted transactional check-in request to the service', async () => {
    const dto = {
      bookingReference: '33333333-3333-4333-8333-333333333333',

      roomNumber: 'T103',

      verification: {
        documentType: IdentityDocumentType.NIC,

        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,

        verifiedBy: receptionistId,
      },
    };

    const result = {
      status: 'checked_in' as const,

      bookingReference: dto.bookingReference,

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

      fossSession: {
        status: 'ACTIVATED' as const,

        sessionReference: 'mock-foss-session-test',

        validUntilDate: '2030-01-12',
      },
    };

    checkInService.checkIn.mockResolvedValue(result);

    await expect(controller.checkIn(dto, principal)).resolves.toEqual(result);

    expect(checkInService.checkIn).toHaveBeenCalledWith({
      ...dto,
      verification: {
        ...dto.verification,
        verifiedBy: receptionistId,
      },
    });
  });

  it('should reject an attempt to verify a check-in as another staff member', () => {
    const dto = {
      bookingReference: '33333333-3333-4333-8333-333333333333',

      roomNumber: 'T103',

      verification: {
        documentType: IdentityDocumentType.NIC,

        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,

        verifiedBy: anotherReceptionistId,
      },
    };

    expect(() => controller.checkIn(dto, principal)).toThrow(
      ForbiddenException,
    );

    expect(checkInService.checkIn).not.toHaveBeenCalled();
  });

  it('should pass registration-card printing to the print service', async () => {
    const bookingReference = '33333333-3333-4333-8333-333333333333';

    const dto = {
      documentType: CheckInDocumentType.REGISTRATION_CARD,
    };

    const result = {
      status: 'accepted' as const,

      documentType: CheckInDocumentType.REGISTRATION_CARD,

      bookingReference,

      roomNumber: 'T103',

      printJobReference: 'mock-print-registration-card',
    };

    printService.requestPrint.mockResolvedValue(result);

    await expect(
      controller.printDocument(bookingReference, dto),
    ).resolves.toEqual(result);

    expect(printService.requestPrint).toHaveBeenCalledWith(
      bookingReference,
      dto,
    );
  });

  it('should pass payment-receipt printing to the print service', async () => {
    const bookingReference = '33333333-3333-4333-8333-333333333333';

    const dto = {
      documentType: CheckInDocumentType.PAYMENT_RECEIPT,
    };

    const result = {
      status: 'accepted' as const,

      documentType: CheckInDocumentType.PAYMENT_RECEIPT,

      bookingReference,

      roomNumber: 'T103',

      printJobReference: 'mock-print-payment-receipt',
    };

    printService.requestPrint.mockResolvedValue(result);

    await expect(
      controller.printDocument(bookingReference, dto),
    ).resolves.toEqual(result);

    expect(printService.requestPrint).toHaveBeenCalledWith(
      bookingReference,
      dto,
    );
  });
});
