import type { BookingSearchResult } from '../models/booking-search-result';

export abstract class BookingRepository {
  abstract search(query: string): Promise<BookingSearchResult[]>;

  abstract findRecent(limit: number): Promise<BookingSearchResult[]>;

  abstract findArrivals(date: string): Promise<BookingSearchResult[]>;

  abstract findDepartures(date: string): Promise<BookingSearchResult[]>;
}
