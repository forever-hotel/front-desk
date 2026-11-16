import {
  Body,
  HttpCode,
  HttpStatus,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FossBookingServiceGuard } from './foss-booking-service.guard';
import { FossBookingVerificationService } from './foss-booking-verification.service';
import { VerifyFossBookingDto } from './verify-foss-booking.dto';

/** Exact endpoint used by the FOSS RealBookingAdapter. */
@Controller('api/v1/bookings')
@UseGuards(FossBookingServiceGuard)
export class FossBookingVerificationController {
  constructor(private readonly verification: FossBookingVerificationService) {}

  @Post(':bookingId/verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body() body: VerifyFossBookingDto,
  ) {
    return this.verification.verify(bookingId, body.roomNumber);
  }
}
