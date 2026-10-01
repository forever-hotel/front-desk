import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateWalkInBookingDto } from './dto/create-walk-in-booking.dto';
import { BookingSearchResult } from './models/booking-search-result';
import { WalkInBookingResult } from './models/walk-in-booking-result';

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

  @Get('arrivals')
  findArrivals(@Query('date') date?: string): Promise<BookingSearchResult[]> {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);

    return this.bookingsService.findArrivals(targetDate);
  }

  @Get('departures')
  findDepartures(@Query('date') date?: string): Promise<BookingSearchResult[]> {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);

    return this.bookingsService.findDepartures(targetDate);
  }

  @Post('walk-in')
  createWalkInBooking(
    @Body() request: CreateWalkInBookingDto,
  ): Promise<WalkInBookingResult> {
    return this.bookingsService.createWalkInBooking(request);
  }
}
