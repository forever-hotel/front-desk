import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingRepository } from './repositories/booking.repository';
import { PostgresBookingRepository } from './repositories/postgres-booking.repository';
import { PostgresWalkInBookingRepository } from './repositories/postgres-walk-in-booking.repository';
import { WalkInBookingRepository } from './repositories/walk-in-booking.repository';

@Module({
  controllers: [BookingsController],
  providers: [
    BookingsService,
    {
      provide: BookingRepository,
      useClass: PostgresBookingRepository,
    },
    {
      provide: WalkInBookingRepository,
      useClass: PostgresWalkInBookingRepository,
    },
  ],
  exports: [BookingRepository, WalkInBookingRepository],
})
export class BookingsModule {}
