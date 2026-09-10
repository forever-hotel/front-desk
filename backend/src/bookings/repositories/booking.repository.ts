import { BookingSearchResult } from '../models/booking-search-result';

export abstract class BookingRepository {
  abstract search(query: string): Promise<BookingSearchResult[]>;
}