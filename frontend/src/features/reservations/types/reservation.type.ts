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
