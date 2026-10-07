import { Body, Controller, Post } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { requireMatchingActor } from '../security/auth/actor-identity';
import { CurrentPrincipal } from '../security/auth/current-principal.decorator';
import { FdsWriteAccess } from '../security/auth/fds-access.decorator';
import { CheckOutService } from './check-out.service';
import { CreateCheckOutDto } from './dto/create-check-out.dto';
import { CheckoutResult } from './models/checkout-result';

@Controller('check-outs')
export class CheckOutController {
  constructor(private readonly checkOutService: CheckOutService) {}

  @Post()
  @FdsWriteAccess()
  checkOut(
    @Body()
    dto: CreateCheckOutDto,

    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ): Promise<CheckoutResult> {
    requireMatchingActor(dto.performedBy, principal);

    return this.checkOutService.checkOut({
      ...dto,
      performedBy: principal.userId,
    });
  }
}
