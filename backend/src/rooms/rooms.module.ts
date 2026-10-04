import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { RoomRepository } from './ports/room.repository';
import { PostgresRoomRepository } from './repositories/postgres-room.repository';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [RealtimeModule],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    {
      provide: RoomRepository,
      useClass: PostgresRoomRepository,
    },
  ],
  exports: [RoomRepository],
})
export class RoomsModule {}
