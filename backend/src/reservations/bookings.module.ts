import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingRepository } from './repositories/booking.repository';
import { PostgresBookingRepository } from './repositories/postgres-booking.repository';

@Module({
  controllers: [BookingsController],
  providers: [
    BookingsService,
    {
      provide: BookingRepository,
      useClass: PostgresBookingRepository,
    },
  ],
  exports: [BookingRepository],
})
export class BookingsModule {}
