import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { sanitizePlainText } from '../../security/sanitization/sanitize-plain-text';
import { ServiceRequestCategory } from '../models/service-request-category';

export class CreateServiceRequestDto {
  @IsUUID('4')
  bookingReference!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(ServiceRequestCategory)
  category!: ServiceRequestCategory;

  @Transform(({ value }) => sanitizePlainText(value))
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsUUID('4')
  performedBy!: string;
}
