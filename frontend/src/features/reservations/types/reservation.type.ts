export type BookingSearchItem = {
  bookingId: string;
  bookingReference: string;
  guestName: string | null;
  email: string | null;
  phone: string | null;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
};

export type RecentBookingsResponse = {
  value: BookingSearchItem[];
  count: number;
};

export type BookingSearchField =
  "all" | "guest" | "booking" | "email" | "phone";

export type WalkInPaymentMethod = "CASH" | "CARD_ON_SITE";

export interface WalkInGuestInput {
  fullName: string;
  email: string;
  nicOrPassport?: string;
  identityDocumentType?: "NIC" | "PASSPORT";
  phone: string;
}

export interface WalkInBookingDetailsInput {
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  specialRequests?: string;
}

export interface WalkInPaymentInput {
  paymentMethod: WalkInPaymentMethod;
}

export interface CreateWalkInBookingRequest {
  guest: WalkInGuestInput;
  booking: WalkInBookingDetailsInput;
  payment: WalkInPaymentInput;
}

export interface WalkInPaymentResult {
  paymentId: string;
  paymentMethod: WalkInPaymentMethod;
  paymentStatus: "PENDING" | "COMPLETED";
  amount: number;
  paidAt: string | null;
}

export interface WalkInPendingPayment {
  bookingReference: string;
  bookingStatus: "PENDING";
  paymentId: string;
  paymentMethod: WalkInPaymentMethod;
  paymentStatus: "PENDING";
  amount: number;
  currency: "LKR";
}

export interface ConfirmWalkInPaymentRequest {
  confirmedReceived: true;
  receiptReference?: string;
}

export interface WalkInPaymentConfirmationResult {
  bookingReference: string;
  bookingStatus: "CONFIRMED";
  paymentId: string;
  paymentMethod: WalkInPaymentMethod;
  paymentStatus: "COMPLETED";
  amount: number;
  currency: "LKR";
  paidAt: string;
  auditLogId: string;
}

export interface WalkInBookingResult {
  bookingId: string;
  bookingReference: string;
  guestId: string | null;
  guestAccountLinked: boolean;

  guest: {
    fullName: string;
    email: string;
    nicOrPassport?: string;
    phone?: string;
  };

  roomTypeId: string;
  roomType: string;

  checkInDate: string;
  checkOutDate: string;

  numGuests: number;

  specialRequests: string | null;

  totalAmount: number;
  currency: "LKR";

  status: "PENDING" | "CONFIRMED";

  source: "WALK_IN";

  payment: WalkInPaymentResult;
}
