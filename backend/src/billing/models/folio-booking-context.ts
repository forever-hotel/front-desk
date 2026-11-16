export interface FolioBookingContext {
  bookingReference: string;
  roomNumber: string | null;
  checkInDate: string;
  checkOutDate: string;
  bookingStatus: string;
  roomCharge: number;
}
