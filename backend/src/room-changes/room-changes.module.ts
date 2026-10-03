import { Module } from '@nestjs/common';
import { RoomChangeRepository } from './ports/room-change.repository';
import { PostgresRoomChangeRepository } from './repositories/postgres-room-change.repository';
import { RoomChangesController } from './room-changes.controller';
import { RoomChangesService } from './room-changes.service';

@Module({
  controllers: [RoomChangesController],
  providers: [
    RoomChangesService,
    {
      provide: RoomChangeRepository,
      useClass: PostgresRoomChangeRepository,
    },
  ],
})
export class RoomChangesModule {}
