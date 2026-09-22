import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';
import { MockFossSessionGateway } from './gateways/mock-foss-session.gateway';
import { FossSessionGateway } from './ports/foss-session.gateway';

@Module({
  imports: [BookingsModule],
  controllers: [CheckInController],
  providers: [
    CheckInService,
    {
      provide: FossSessionGateway,
      useClass: MockFossSessionGateway,
    },
  ],
})
export class CheckInModule {}
