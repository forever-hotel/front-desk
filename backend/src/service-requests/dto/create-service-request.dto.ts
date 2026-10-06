import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ServiceRequestCategory } from '../models/service-request-category';

export class CreateServiceRequestDto {
  @IsUUID('4')
  bookingReference!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(ServiceRequestCategory)
  category!: ServiceRequestCategory;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUUID('4')
  performedBy!: string;
}
