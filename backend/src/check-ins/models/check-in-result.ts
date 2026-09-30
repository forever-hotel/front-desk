export interface CheckInResult {
  status: 'checked_in';
  bookingReference: string;
  roomNumber: string;
  fossSessionActivated: boolean;
}
