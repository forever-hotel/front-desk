import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { RoomStatus } from '../models/room-status';

export class UpdateRoomStatusDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(RoomStatus)
  targetStatus!: RoomStatus;
}
