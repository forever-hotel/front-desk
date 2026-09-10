import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [HealthModule, BookingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
