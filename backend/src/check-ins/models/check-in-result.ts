import {
  IdentityDocumentType,
  IdVerificationMethod,
} from '../dto/check-in-verification.dto';

export interface CheckInVerificationResult {
  verificationId: string;
  documentType: IdentityDocumentType;
  verificationMethod: IdVerificationMethod;
  verifiedBy: string;
  verifiedAt: string;
}

export interface CheckInResult {
  status: 'checked_in';
  bookingReference: string;
  roomNumber: string;
  bookingStatus: 'CHECKED_IN';
  roomStatus: 'OCCUPIED';
  verification: CheckInVerificationResult;
  auditLogId: string;
}
