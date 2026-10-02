import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';

export enum CheckInDocumentType {
  REGISTRATION_CARD = 'REGISTRATION_CARD',
  PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
}

export class CheckInPrintRequestDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(CheckInDocumentType)
  documentType!: CheckInDocumentType;
}
