import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { FolioModule } from './billing/folio.module';
import { CheckInModule } from './check-ins/check-in.module';
import { CheckOutModule } from './check-outs/check-out.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MessagingModule } from './messaging/messaging.module';
import { RealtimeModule } from './realtime/realtime.module';
import { BookingsModule } from './reservations/bookings.module';
import { RoomChangesModule } from './room-changes/room-changes.module';
import { RoomsModule } from './rooms/rooms.module';
import { SecurityModule } from './security/security.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    DatabaseModule,
    SecurityModule,
    AuditModule,
    MessagingModule,
    RealtimeModule,
    HealthModule,
    BookingsModule,
    CheckInModule,
    RoomsModule,
    RoomChangesModule,
    FolioModule,
    CheckOutModule,
    ServiceRequestsModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}
