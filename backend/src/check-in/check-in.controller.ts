import { Body, Controller, Post } from '@nestjs/common';
import { CheckInService } from './check-in.service';
import { CheckInRequestDto } from './dto/check-in-request.dto';
import { CheckInResult } from './models/check-in-result';

@Controller('check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post()
  checkIn(
    @Body() dto: CheckInRequestDto,
  ): Promise<CheckInResult> {
    return this.checkInService.checkIn(dto);
  }
}