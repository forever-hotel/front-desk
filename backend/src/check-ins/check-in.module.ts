import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SecurityModule } from '../security/security.module';
import { CheckInController } from './check-in.controller';
import { CheckInPrintService } from './check-in-print.service';
import { CheckInService } from './check-in.service';
import { MockCheckInPrintGateway } from './gateways/mock-check-in-print.gateway';
import { MockFossSessionGateway } from './gateways/mock-foss-session.gateway';
import { CheckInPrintGateway } from './ports/check-in-print.gateway';
import { CheckInPrintRepository } from './ports/check-in-print.repository';
import { CheckInRepository } from './ports/check-in.repository';
import { FossSessionGateway } from './ports/foss-session.gateway';
import { PostgresCheckInPrintRepository } from './repositories/postgres-check-in-print.repository';
import { PostgresCheckInRepository } from './repositories/postgres-check-in.repository';

@Module({
  imports: [RealtimeModule, SecurityModule],

  controllers: [CheckInController],

  providers: [
    CheckInService,
    CheckInPrintService,
    {
      provide: CheckInRepository,
      useClass: PostgresCheckInRepository,
    },
    {
      provide: FossSessionGateway,
      useClass: MockFossSessionGateway,
    },
    {
      provide: CheckInPrintRepository,
      useClass: PostgresCheckInPrintRepository,
    },
    {
      provide: CheckInPrintGateway,
      useClass: MockCheckInPrintGateway,
    },
  ],

  exports: [FossSessionGateway],
})
export class CheckInModule {}
