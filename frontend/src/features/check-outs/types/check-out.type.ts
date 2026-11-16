export type CheckoutPaymentMethod = "CASH" | "CARD_ON_SITE";

export interface CreateCheckOutRequest {
  bookingReference: string;
  performedBy: string;
  paymentMethod?: CheckoutPaymentMethod;
}

export interface CheckoutPersistedPayment {
  paymentId: string;
  paymentMethod: CheckoutPaymentMethod;
  paymentStatus: "COMPLETED";
  amount: number;
  paidAt: string;
}

export type CheckoutFossSessionResult =
  | {
      status: "DEACTIVATED";
    }
  | {
      status: "FAILED";
      failureCode: "FOSS_DEACTIVATION_FAILED";
    };

export interface CheckoutResult {
  status: "checked_out";
  bookingReference: string;
  roomNumber: string;

  bookingStatus: "CHECKED_OUT";
  roomStatus: "REQUIRES_CLEANING";

  currency: "LKR";

  folioTotal: number;
  previouslyPaid: number;
  finalPaymentAmount: number;

  payment: CheckoutPersistedPayment | null;

  auditLogId: string;

  fossSession: CheckoutFossSessionResult;
}
