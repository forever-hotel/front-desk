import { Injectable } from '@nestjs/common';
import {
  CheckInPrintGateway,
  CheckInPrintJobInput,
  CheckInPrintJobResult,
} from '../ports/check-in-print.gateway';

@Injectable()
export class MockCheckInPrintGateway extends CheckInPrintGateway {
  requestPrint(input: CheckInPrintJobInput): Promise<CheckInPrintJobResult> {
    const documentPart = input.documentType.toLowerCase();

    return Promise.resolve({
      status: 'accepted',
      printJobReference: `mock-print-${documentPart}-${input.bookingReference}`,
    });
  }
}
