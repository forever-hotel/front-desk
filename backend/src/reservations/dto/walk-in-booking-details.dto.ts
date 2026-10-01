import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class WalkInBookingDetailsDto {
  @IsUUID()
  roomTypeId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkInDate must use YYYY-MM-DD format',
  })
  checkInDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkOutDate must use YYYY-MM-DD format',
  })
  checkOutDate!: string;

  @IsInt()
  @Min(1)
  numGuests!: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;
}
