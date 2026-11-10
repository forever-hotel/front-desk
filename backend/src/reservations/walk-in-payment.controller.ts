import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { CurrentPrincipal } from '../security/auth/current-principal.decorator';
import { FdsWriteAccess } from '../security/auth/fds-access.decorator';
import { ConfirmWalkInPaymentDto } from './dto/confirm-walk-in-payment.dto';
import type {
  WalkInPaymentConfirmation,
  WalkInPendingPayment,
} from './models/walk-in-payment';
import { WalkInPaymentService } from './walk-in-payment.service';

@Controller('bookings/walk-in')
export class WalkInPaymentController {
  constructor(private readonly payments: WalkInPaymentService) {}

  @Get(':bookingReference/pending-payment')
  @FdsWriteAccess()
  findPending(
    @Param('bookingReference', new ParseUUIDPipe({ version: '4' }))
    reference: string,
  ): Promise<WalkInPendingPayment> {
    return this.payments.findPendingPayment(reference);
  }

  @Post(':bookingReference/confirm-payment')
  @FdsWriteAccess()
  confirm(
    @Param('bookingReference', new ParseUUIDPipe({ version: '4' }))
    reference: string,
    @Body() dto: ConfirmWalkInPaymentDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<WalkInPaymentConfirmation> {
    // Actor is authenticated by the JWT guard, never accepted from the body.
    return this.payments.confirmPayment(reference, dto, principal.userId);
  }
}
