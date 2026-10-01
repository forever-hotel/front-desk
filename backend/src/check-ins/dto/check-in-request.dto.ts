import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CheckInVerificationDto } from './check-in-verification.dto';

export class CheckInRequestDto {
  @IsUUID('4')
  bookingReference!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'roomNumber must contain only letters, numbers, or hyphens',
  })
  roomNumber?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => CheckInVerificationDto)
  verification!: CheckInVerificationDto;
}
