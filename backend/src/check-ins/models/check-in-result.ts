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

export interface ActivatedFossSessionResult {
  status: 'ACTIVATED';
  sessionReference: string;
  validUntilDate: string;
}

export interface FailedFossSessionResult {
  status: 'FAILED';
  sessionReference: null;
  validUntilDate: string;
  failureCode: 'FOSS_ACTIVATION_FAILED';
}

export type FossSessionResult =
  ActivatedFossSessionResult | FailedFossSessionResult;

export interface CheckInResult {
  status: 'checked_in';
  bookingReference: string;
  roomNumber: string;
  bookingStatus: 'CHECKED_IN';
  roomStatus: 'OCCUPIED';
  verification: CheckInVerificationResult;
  auditLogId: string;
  fossSession: FossSessionResult;
}
