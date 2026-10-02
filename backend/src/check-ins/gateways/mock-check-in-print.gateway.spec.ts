import { CheckInDocumentType } from '../dto/check-in-print-request.dto';
import { MockCheckInPrintGateway } from './mock-check-in-print.gateway';

describe('MockCheckInPrintGateway', () => {
  let gateway: MockCheckInPrintGateway;

  beforeEach(() => {
    gateway = new MockCheckInPrintGateway();
  });

  it('should accept a registration-card print job', async () => {
    const bookingReference = '55555555-5555-4555-8555-555555555551';

    await expect(
      gateway.requestPrint({
        documentType: CheckInDocumentType.REGISTRATION_CARD,
        bookingReference,
        roomNumber: 'T103',
        checkInDate: '2032-01-10',
        checkOutDate: '2032-01-12',
      }),
    ).resolves.toEqual({
      status: 'accepted',
      printJobReference: `mock-print-registration_card-${bookingReference}`,
    });
  });

  it('should accept a payment-receipt print job', async () => {
    const bookingReference = '55555555-5555-4555-8555-555555555551';

    await expect(
      gateway.requestPrint({
        documentType: CheckInDocumentType.PAYMENT_RECEIPT,
        bookingReference,
        roomNumber: 'T103',
        checkInDate: '2032-01-10',
        checkOutDate: '2032-01-12',
      }),
    ).resolves.toEqual({
      status: 'accepted',
      printJobReference: `mock-print-payment_receipt-${bookingReference}`,
    });
  });
});
