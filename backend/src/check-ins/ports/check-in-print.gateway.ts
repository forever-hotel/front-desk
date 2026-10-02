import { CheckInDocumentType } from '../dto/check-in-print-request.dto';

export interface CheckInPrintJobInput {
  documentType: CheckInDocumentType;
  bookingReference: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface CheckInPrintJobResult {
  status: 'accepted';
  printJobReference: string;
}

export abstract class CheckInPrintGateway {
  abstract requestPrint(
    input: CheckInPrintJobInput,
  ): Promise<CheckInPrintJobResult>;
}
