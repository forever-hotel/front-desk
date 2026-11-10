import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { BookingsController } from './bookings.controller';
import { FossBookingVerificationController } from './integrations/foss-booking-verification.controller';
import { FossBookingServiceGuard } from './integrations/foss-booking-service.guard';
import { FossBookingVerificationService } from './integrations/foss-booking-verification.service';
import { BookingsService } from './bookings.service';
import { BookingRepository } from './repositories/booking.repository';
import { PostgresBookingRepository } from './repositories/postgres-booking.repository';
import { PostgresWalkInBookingRepository } from './repositories/postgres-walk-in-booking.repository';
import { PostgresWalkInPaymentRepository } from './repositories/postgres-walk-in-payment.repository';
import { WalkInPaymentRepository } from './repositories/walk-in-payment.repository';
import { WalkInPaymentController } from './walk-in-payment.controller';
import { WalkInPaymentService } from './walk-in-payment.service';
import { WalkInBookingRepository } from './repositories/walk-in-booking.repository';

@Module({
  imports: [SecurityModule],

  controllers: [
    BookingsController,
    FossBookingVerificationController,
    WalkInPaymentController,
  ],

  providers: [
    BookingsService,
    WalkInPaymentService,
    FossBookingServiceGuard,
    FossBookingVerificationService,
    {
      provide: WalkInPaymentRepository,
      useClass: PostgresWalkInPaymentRepository,
    },
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
