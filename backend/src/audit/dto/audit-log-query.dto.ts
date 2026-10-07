import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const AUDIT_EVENT_CATEGORIES = [
  'AUTHENTICATION',
  'FRONT_DESK_OPERATION',
  'PAYMENT',
  'STAFF_ACCOUNT_MANAGEMENT',
  'DATA_ACCESS',
  'TASK_SERVICE',
  'FOOD_ORDER',
] as const;

export class AuditLogQueryDto {
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return 25;
    }

    return Number(value);
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    return Number(value);
  })
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @IsIn(AUDIT_EVENT_CATEGORIES)
  eventCategory?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;
}
