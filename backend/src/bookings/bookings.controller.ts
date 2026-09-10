import { Controller, Get, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingSearchResult } from './models/booking-search-result';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('search')
  search(
    @Query('query') query = '',
  ): Promise<BookingSearchResult[]> {
    return this.bookingsService.search(query);
  }
}