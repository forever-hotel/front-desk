import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';
import type { ValidationArguments } from 'class-validator';
import {
  normalizeWalkInPhone,
  validateWalkInDocument,
  validateWalkInName,
  type WalkInIdentityDocumentType,
} from './walk-in-guest.validation';

export class WalkInGuestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @ValidateBy({
    name: 'isSupportedGuestName',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && validateWalkInName(value),
      defaultMessage: () => 'fullName must contain 2–255 valid name characters',
    },
  })
  fullName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsIn(['NIC', 'PASSPORT'])
  identityDocumentType?: WalkInIdentityDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @ValidateBy({
    name: 'isSupportedIdentityDocument',
    validator: {
      validate: (value: unknown, args: ValidationArguments) => {
        if (typeof value !== 'string') return false;
        const guest = args.object as WalkInGuestDto;
        return validateWalkInDocument(value, guest.identityDocumentType);
      },
      defaultMessage: () =>
        'nicOrPassport is invalid for the selected document type',
    },
  })
  nicOrPassport?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @ValidateBy({
    name: 'isRealisticWalkInPhone',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && normalizeWalkInPhone(value) !== null,
      defaultMessage: () =>
        'phone must be a valid Sri Lankan or international telephone number',
    },
  })
  phone!: string;
}
