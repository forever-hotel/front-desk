import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { requireMatchingActor } from '../security/auth/actor-identity';
import { CurrentPrincipal } from '../security/auth/current-principal.decorator';
import { FdsWriteAccess } from '../security/auth/fds-access.decorator';
import { CheckInPrintService } from './check-in-print.service';
import { CheckInService } from './check-in.service';
import { CheckInPrintRequestDto } from './dto/check-in-print-request.dto';
import { CheckInRequestDto } from './dto/check-in-request.dto';
import { CheckInPrintResult } from './models/check-in-print-result';
import { CheckInResult } from './models/check-in-result';

@Controller('check-in')
export class CheckInController {
  constructor(
    private readonly checkInService: CheckInService,
    private readonly checkInPrintService: CheckInPrintService,
  ) {}

  @Post()
  @FdsWriteAccess()
  checkIn(
    @Body()
    dto: CheckInRequestDto,

    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ): Promise<CheckInResult> {
    requireMatchingActor(dto.verification.verifiedBy, principal);

    return this.checkInService.checkIn({
      ...dto,
      verification: {
        ...dto.verification,
        verifiedBy: principal.userId,
      },
    });
  }

  @Post(':bookingReference/print')
  @FdsWriteAccess()
  printDocument(
    @Param(
      'bookingReference',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    bookingReference: string,

    @Body()
    dto: CheckInPrintRequestDto,
  ): Promise<CheckInPrintResult> {
    return this.checkInPrintService.requestPrint(bookingReference, dto);
  }
}
