import { Body, Controller, Post } from '@nestjs/common';
import { CheckOutService } from './check-out.service';
import { CreateCheckOutDto } from './dto/create-check-out.dto';
import { CheckoutResult } from './models/checkout-result';

@Controller('check-outs')
export class CheckOutController {
  constructor(private readonly checkOutService: CheckOutService) {}

  @Post()
  checkOut(@Body() dto: CreateCheckOutDto): Promise<CheckoutResult> {
    return this.checkOutService.checkOut(dto);
  }
}
