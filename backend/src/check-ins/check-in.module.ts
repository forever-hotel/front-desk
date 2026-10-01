import { Module } from '@nestjs/common';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';
import { CheckInRepository } from './ports/check-in.repository';
import { PostgresCheckInRepository } from './repositories/postgres-check-in.repository';

@Module({
  controllers: [CheckInController],
  providers: [
    CheckInService,
    {
      provide: CheckInRepository,
      useClass: PostgresCheckInRepository,
    },
  ],
})
export class CheckInModule {}
