import {
  IdentityDocumentType,
  IdVerificationMethod,
} from '../dto/check-in-verification.dto';

export interface CheckInVerificationInput {
  documentType: IdentityDocumentType;
  verificationMethod: IdVerificationMethod;
  verifiedBy: string;
  documentStorageKey?: string;
  documentSha256?: string;
  notes?: string;
}

export interface CheckInTransactionInput {
  bookingReference: string;
  roomNumber?: string;
  verification: CheckInVerificationInput;
}
