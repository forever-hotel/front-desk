export interface WalkInRoomTypeDetails {
  roomTypeId: string;
  typeName: string;
  pricePerNight: number;
  maxGuests: number;
}

export interface WalkInGuestDetails {
  fullName: string;
  email: string;
  nicOrPassport?: string;
  phone?: string;
}

export type WalkInPaymentMethodValue = 'CASH' | 'CARD_ON_SITE';

export type WalkInBookingStatus = 'PENDING' | 'CONFIRMED';

export type WalkInPaymentStatus = 'PENDING' | 'COMPLETED';

export interface CreateWalkInBookingRecord {
  guest: WalkInGuestDetails;
  roomType: WalkInRoomTypeDetails;
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  specialRequests?: string;
  totalAmount: number;
  paymentMethod: WalkInPaymentMethodValue;
  bookingStatus: WalkInBookingStatus;
  paymentStatus: WalkInPaymentStatus;
}

export interface WalkInPaymentResult {
  paymentId: string;
  paymentMethod: WalkInPaymentMethodValue;
  paymentStatus: WalkInPaymentStatus;
  amount: number;
  paidAt: string | null;
}

export interface WalkInBookingResult {
  bookingId: string;
  bookingReference: string;
  guestId: string | null;
  guestAccountLinked: boolean;
  guest: WalkInGuestDetails;
  roomTypeId: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  specialRequests: string | null;
  totalAmount: number;
  currency: 'LKR';
  status: WalkInBookingStatus;
  source: 'WALK_IN';
  payment: WalkInPaymentResult;
}
