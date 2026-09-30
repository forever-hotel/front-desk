import { Controller, Get, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingSearchResult } from './models/booking-search-result';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('search')
  search(@Query('query') query = ''): Promise<BookingSearchResult[]> {
    return this.bookingsService.search(query);
  }

  @Get('recent')
  async findRecent(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit);

    const safeLimit =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;

    const value = await this.bookingsService.findRecent(safeLimit);

    return {
      value,
      count: value.length,
    };
  }
}
