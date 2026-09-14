import { Injectable } from '@nestjs/common';
import { BookingSearchResult } from './models/booking-search-result';
import { BookingRepository } from './repositories/booking.repository';

@Injectable()
export class BookingsService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  search(query: string): Promise<BookingSearchResult[]> {
    return this.bookingRepository.search(query);
  }
  async findRecent(limit = 5) {
  const safeLimit = Math.min(
    Math.max(limit, 1),
    20,
  );

  return this.bookingRepository.findRecent(safeLimit);
}
}