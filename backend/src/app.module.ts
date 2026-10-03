import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FolioModule } from './billing/folio.module';
import { CheckInModule } from './check-ins/check-in.module';
import { CheckOutModule } from './check-outs/check-out.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RoomChangesModule } from './room-changes/room-changes.module';
import { BookingsModule } from './reservations/bookings.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    HealthModule,
    BookingsModule,
    CheckInModule,
    RoomsModule,
    RoomChangesModule,
    FolioModule,
    CheckOutModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
