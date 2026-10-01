import { Module } from '@nestjs/common';
import { InMemoryBookingRepository } from '../reservations/repositories/in-memory-booking.repository';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';
import { MockFossSessionGateway } from './gateways/mock-foss-session.gateway';
import { CheckInBookingRepository } from './ports/check-in-booking.repository';
import { FossSessionGateway } from './ports/foss-session.gateway';

@Module({
  controllers: [CheckInController],
  providers: [
    CheckInService,
    InMemoryBookingRepository,
    {
      provide: CheckInBookingRepository,
      useExisting: InMemoryBookingRepository,
    },
    {
      provide: FossSessionGateway,
      useClass: MockFossSessionGateway,
    },
  ],
})
export class CheckInModule {}
