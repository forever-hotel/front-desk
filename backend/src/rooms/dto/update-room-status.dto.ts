import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RoomStatus } from '../models/room-status';

export class UpdateRoomStatusDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(RoomStatus)
  targetStatus!: RoomStatus;

  @IsOptional()
  @IsUUID('4')
  performedBy?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  notes?: string;
}
