import { Injectable } from '@nestjs/common';
import { BookingSearchResult } from './models/booking-search-result';
import { BookingRepository } from './repositories/booking.repository';

@Injectable()
export class BookingsService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  search(query: string): Promise<BookingSearchResult[]> {
    return this.bookingRepository.search(query);
  }
}