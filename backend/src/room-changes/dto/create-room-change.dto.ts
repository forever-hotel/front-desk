import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRoomChangeDto {
  @IsUUID('4')
  bookingReference!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  targetRoomNumber!: string;

  @IsUUID('4')
  performedBy!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  reason?: string;
}
