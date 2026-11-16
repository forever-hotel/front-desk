import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum IdentityDocumentType {
  NIC = 'NIC',
  PASSPORT = 'PASSPORT',
  OTHER = 'OTHER',
}

export enum IdVerificationMethod {
  PHYSICAL_DOCUMENT = 'PHYSICAL_DOCUMENT',
  SCANNED_COPY = 'SCANNED_COPY',
}

export class CheckInVerificationDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(IdentityDocumentType)
  documentType!: IdentityDocumentType;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(IdVerificationMethod)
  verificationMethod!: IdVerificationMethod;

  @IsUUID('4')
  verifiedBy!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  documentStorageKey?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'documentSha256 must be a valid SHA-256 hexadecimal value',
  })
  documentSha256?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}
