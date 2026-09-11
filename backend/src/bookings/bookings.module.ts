import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingRepository } from './repositories/booking.repository';
import { InMemoryBookingRepository } from './repositories/in-memory-booking.repository';

@Module({
  controllers: [BookingsController],
  providers: [
    BookingsService,
    {
      provide: BookingRepository,
      useClass: InMemoryBookingRepository,
    },
  ],
  exports: [BookingRepository],
})
export class BookingsModule {}