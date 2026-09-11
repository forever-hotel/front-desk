import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { BookingsModule } from './bookings/bookings.module';
import { CheckInModule } from './check-in/check-in.module';

@Module({
  imports: [HealthModule, BookingsModule, CheckInModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
