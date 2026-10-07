import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingRepository } from './repositories/booking.repository';
import { PostgresBookingRepository } from './repositories/postgres-booking.repository';
import { PostgresWalkInBookingRepository } from './repositories/postgres-walk-in-booking.repository';
import { WalkInBookingRepository } from './repositories/walk-in-booking.repository';

@Module({
  imports: [SecurityModule],

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
