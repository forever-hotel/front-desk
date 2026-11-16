import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class VerifyFossBookingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9-]+$/, { message: 'roomNumber has invalid characters' })
  roomNumber!: string;
}
