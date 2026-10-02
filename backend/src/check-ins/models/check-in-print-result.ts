import { CheckInDocumentType } from '../dto/check-in-print-request.dto';

export interface CheckInPrintResult {
  status: 'accepted';
  documentType: CheckInDocumentType;
  bookingReference: string;
  roomNumber: string;
  printJobReference: string;
}
