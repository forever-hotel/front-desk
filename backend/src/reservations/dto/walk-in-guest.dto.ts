import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class WalkInGuestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nicOrPassport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9][0-9\s-]{6,19}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;
}
