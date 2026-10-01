import type { BookingSearchResult } from '../../reservations/models/booking-search-result';

export abstract class CheckInBookingRepository {
  abstract findByReference(
    bookingReference: string,
  ): Promise<BookingSearchResult | null>;

  abstract markCheckedIn(bookingReference: string): Promise<void>;
}
