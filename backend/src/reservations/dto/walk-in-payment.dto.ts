import { IsEnum } from 'class-validator';

export enum WalkInPaymentMethod {
  CASH = 'CASH',
  CARD_ON_SITE = 'CARD_ON_SITE',
}

export class WalkInPaymentDto {
  @IsEnum(WalkInPaymentMethod)
  paymentMethod!: WalkInPaymentMethod;
}
