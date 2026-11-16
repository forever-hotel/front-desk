import {
  IdentityDocumentType,
  IdVerificationMethod,
} from '../dto/check-in-verification.dto';

export interface CheckInPersistenceVerificationResult {
  verificationId: string;
  documentType: IdentityDocumentType;
  verificationMethod: IdVerificationMethod;
  verifiedBy: string;
  verifiedAt: string;
}

export interface CheckInPersistenceResult {
  status: 'checked_in';
  bookingReference: string;
  roomNumber: string;
  bookingStatus: 'CHECKED_IN';
  roomStatus: 'OCCUPIED';
  checkOutDate: string;
  verification: CheckInPersistenceVerificationResult;
  auditLogId: string;
}
