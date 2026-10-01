export interface BookingSearchResult {
  bookingId: string;
  bookingReference: string;
  guestName: string | null;
  email: string | null;
  phone: string | null;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
}
