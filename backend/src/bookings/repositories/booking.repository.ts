import { BookingSearchResult } from '../models/booking-search-result';

export abstract class BookingRepository {
  abstract search(query: string): Promise<BookingSearchResult[]>;

  abstract findRecent(limit: number): Promise<BookingSearchResult[]>;

  abstract findByReference(
    bookingReference: string,
  ): Promise<BookingSearchResult | null>;

  abstract markCheckedIn(bookingReference: string): Promise<void>;
}
