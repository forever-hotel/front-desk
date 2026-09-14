export type BookingSearchItem = {
  bookingId: string;
  bookingReference: string;
  guestName: string;
  email: string;
  phone: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
};

export type BookingSearchResponse =
  | BookingSearchItem[]
  | {
      value: BookingSearchItem[];
      Count?: number;
      count?: number;
    };

export type BookingSearchField =
  | "all"
  | "guest"
  | "booking"
  | "email"
  | "phone";