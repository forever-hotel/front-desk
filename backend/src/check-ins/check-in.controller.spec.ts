import { Test, TestingModule } from '@nestjs/testing';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from './dto/check-in-verification.dto';

describe('CheckInController', () => {
  let controller: CheckInController;
  let service: jest.Mocked<CheckInService>;

  beforeEach(async () => {
    const serviceMock = {
      checkIn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckInController],
      providers: [
        {
          provide: CheckInService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(CheckInController);
    service = module.get(CheckInService);
  });

  it('should pass the transactional check-in request to the service', async () => {
    const dto = {
      bookingReference: '33333333-3333-4333-8333-333333333333',
      roomNumber: 'T103',
      verification: {
        documentType: IdentityDocumentType.NIC,
        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,
        verifiedBy: '66666666-6666-4666-8666-666666666666',
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
        verifiedBy: dto.verification.verifiedBy,
        verifiedAt: '2030-01-10T10:00:00.000Z',
      },
      auditLogId: '88888888-8888-4888-8888-888888888888',
    };

    service.checkIn.mockResolvedValue(result);

    await expect(controller.checkIn(dto)).resolves.toEqual(result);

    expect(service.checkIn).toHaveBeenCalledWith(dto);
    expect(service.checkIn).toHaveBeenCalledTimes(1);
  });
});
