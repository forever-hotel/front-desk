import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
  checkIn(@Body() dto: CheckInRequestDto): Promise<CheckInResult> {
    return this.checkInService.checkIn(dto);
  }

  @Post(':bookingReference/print')
  printDocument(
    @Param(
      'bookingReference',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    bookingReference: string,
    @Body() dto: CheckInPrintRequestDto,
  ): Promise<CheckInPrintResult> {
    return this.checkInPrintService.requestPrint(bookingReference, dto);
  }
}
