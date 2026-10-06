import { Body, Controller, Post } from '@nestjs/common';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import type { ServiceRequestResult } from './models/service-request-result';
import { ServiceRequestsService } from './service-requests.service';

@Controller('service-requests')
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Post()
  create(@Body() dto: CreateServiceRequestDto): Promise<ServiceRequestResult> {
    return this.serviceRequestsService.create(dto);
  }
}
