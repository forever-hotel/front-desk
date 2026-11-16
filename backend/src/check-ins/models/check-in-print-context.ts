export interface CheckInPrintContext {
  bookingReference: string;
  roomNumber: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
}
