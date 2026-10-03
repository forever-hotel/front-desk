import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CheckoutPaymentMethod } from '../models/checkout-payment-result';

export class CreateCheckOutDto {
  @IsUUID('4')
  bookingReference!: string;

  @IsUUID('4')
  performedBy!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsEnum(CheckoutPaymentMethod)
  paymentMethod?: CheckoutPaymentMethod;
}
