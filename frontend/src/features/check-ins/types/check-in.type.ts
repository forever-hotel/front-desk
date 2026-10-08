export type IdentityDocumentType = "NIC" | "PASSPORT" | "OTHER";

export type IdVerificationMethod = "PHYSICAL_DOCUMENT" | "SCANNED_COPY";

export type CheckInDocumentType = "REGISTRATION_CARD" | "PAYMENT_RECEIPT";

export interface CheckInVerificationRequest {
  documentType: IdentityDocumentType;
  verificationMethod: IdVerificationMethod;
  verifiedBy: string;
  documentStorageKey?: string;
  documentSha256?: string;
  notes?: string;
}

export interface CheckInRequest {
  bookingReference: string;
  roomNumber?: string;
  verification: CheckInVerificationRequest;
}

export interface CheckInVerificationResult {
  verificationId: string;
  documentType: IdentityDocumentType;
  verificationMethod: IdVerificationMethod;
  verifiedBy: string;
  verifiedAt: string;
}

export type FossSessionResult =
  | {
      status: "ACTIVATED";
      sessionReference: string;
      validUntilDate: string;
    }
  | {
      status: "FAILED";
      sessionReference: null;
      validUntilDate: string;
      failureCode: "FOSS_ACTIVATION_FAILED";
    };

export interface CheckInResult {
  status: "checked_in";
  bookingReference: string;
  roomNumber: string;
  bookingStatus: "CHECKED_IN";
  roomStatus: "OCCUPIED";
  verification: CheckInVerificationResult;
  auditLogId: string;
  fossSession: FossSessionResult;
}

export interface CheckInPrintRequest {
  documentType: CheckInDocumentType;
}

export interface CheckInPrintResult {
  status: "accepted";
  documentType: CheckInDocumentType;
  bookingReference: string;
  roomNumber: string;
  printJobReference: string;
}
