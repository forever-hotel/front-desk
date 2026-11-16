import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { WalkInBookingDetailsDto } from './walk-in-booking-details.dto';
import { WalkInGuestDto } from './walk-in-guest.dto';
import { WalkInPaymentDto } from './walk-in-payment.dto';

export class CreateWalkInBookingDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => WalkInGuestDto)
  guest!: WalkInGuestDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => WalkInBookingDetailsDto)
  booking!: WalkInBookingDetailsDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => WalkInPaymentDto)
  payment!: WalkInPaymentDto;
}
