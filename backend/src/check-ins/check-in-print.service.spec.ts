import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CheckInPrintService } from './check-in-print.service';
import { CheckInDocumentType } from './dto/check-in-print-request.dto';
import { CheckInPrintGateway } from './ports/check-in-print.gateway';
import { CheckInPrintRepository } from './ports/check-in-print.repository';

describe('CheckInPrintService', () => {
  let service: CheckInPrintService;
  let repository: jest.Mocked<CheckInPrintRepository>;
  let gateway: jest.Mocked<CheckInPrintGateway>;

  const bookingReference = '55555555-5555-4555-8555-555555555551';

  const checkedInContext = {
    bookingReference,
    roomNumber: 'T103',
    status: 'CHECKED_IN',
    checkInDate: '2032-01-10',
    checkOutDate: '2032-01-12',
  };

  beforeEach(async () => {
    const repositoryMock = {
      findPrintContext: jest.fn(),
    };

    const gatewayMock = {
      requestPrint: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInPrintService,
        {
          provide: CheckInPrintRepository,
          useValue: repositoryMock,
        },
        {
          provide: CheckInPrintGateway,
          useValue: gatewayMock,
        },
      ],
    }).compile();

    service = module.get(CheckInPrintService);
    repository = module.get(CheckInPrintRepository);
    gateway = module.get(CheckInPrintGateway);
  });

  it('should request registration-card printing for a checked-in booking', async () => {
    repository.findPrintContext.mockResolvedValue(checkedInContext);

    gateway.requestPrint.mockResolvedValue({
      status: 'accepted',
      printJobReference: 'mock-print-registration-card',
    });

    const result = await service.requestPrint(bookingReference, {
      documentType: CheckInDocumentType.REGISTRATION_CARD,
    });

    expect(repository.findPrintContext).toHaveBeenCalledWith(bookingReference);

    expect(gateway.requestPrint).toHaveBeenCalledWith({
      documentType: CheckInDocumentType.REGISTRATION_CARD,
      bookingReference,
      roomNumber: 'T103',
      checkInDate: '2032-01-10',
      checkOutDate: '2032-01-12',
    });

    expect(result).toEqual({
      status: 'accepted',
      documentType: CheckInDocumentType.REGISTRATION_CARD,
      bookingReference,
      roomNumber: 'T103',
      printJobReference: 'mock-print-registration-card',
    });
  });

  it('should request payment-receipt printing without raw card information', async () => {
    repository.findPrintContext.mockResolvedValue(checkedInContext);

    gateway.requestPrint.mockResolvedValue({
      status: 'accepted',
      printJobReference: 'mock-print-payment-receipt',
    });

    const result = await service.requestPrint(bookingReference, {
      documentType: CheckInDocumentType.PAYMENT_RECEIPT,
    });

    expect(gateway.requestPrint).toHaveBeenCalledWith({
      documentType: CheckInDocumentType.PAYMENT_RECEIPT,
      bookingReference,
      roomNumber: 'T103',
      checkInDate: '2032-01-10',
      checkOutDate: '2032-01-12',
    });

    const gatewayInput = gateway.requestPrint.mock.calls[0][0];

    expect(gatewayInput).not.toHaveProperty('cardNumber');
    expect(gatewayInput).not.toHaveProperty('cvv');
    expect(gatewayInput).not.toHaveProperty('cvc');
    expect(gatewayInput).not.toHaveProperty('pin');

    expect(result.documentType).toBe(CheckInDocumentType.PAYMENT_RECEIPT);
  });

  it('should reject an unknown booking', async () => {
    repository.findPrintContext.mockResolvedValue(null);

    await expect(
      service.requestPrint(bookingReference, {
        documentType: CheckInDocumentType.REGISTRATION_CARD,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(gateway.requestPrint).not.toHaveBeenCalled();
  });

  it('should reject a booking that is not checked in', async () => {
    repository.findPrintContext.mockResolvedValue({
      ...checkedInContext,
      status: 'CONFIRMED',
    });

    await expect(
      service.requestPrint(bookingReference, {
        documentType: CheckInDocumentType.REGISTRATION_CARD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(gateway.requestPrint).not.toHaveBeenCalled();
  });

  it('should reject a checked-in booking without an assigned room', async () => {
    repository.findPrintContext.mockResolvedValue({
      ...checkedInContext,
      roomNumber: null,
    });

    await expect(
      service.requestPrint(bookingReference, {
        documentType: CheckInDocumentType.REGISTRATION_CARD,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(gateway.requestPrint).not.toHaveBeenCalled();
  });

  it('should surface printing gateway failure without changing booking state', async () => {
    repository.findPrintContext.mockResolvedValue(checkedInContext);

    gateway.requestPrint.mockRejectedValue(new Error('printer unavailable'));

    await expect(
      service.requestPrint(bookingReference, {
        documentType: CheckInDocumentType.PAYMENT_RECEIPT,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(repository.findPrintContext).toHaveBeenCalledTimes(1);

    expect(gateway.requestPrint).toHaveBeenCalledTimes(1);
  });
});
