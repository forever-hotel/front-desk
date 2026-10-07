import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type {
  WkmsAvailableWorker,
  WkmsTaskAssignmentResult,
} from '../integrations/wkms/wkms.types';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { requireMatchingActor } from '../security/auth/actor-identity';
import { CurrentPrincipal } from '../security/auth/current-principal.decorator';
import {
  FdsReadAccess,
  FdsWriteAccess,
} from '../security/auth/fds-access.decorator';
import { AssignServiceTaskDto } from './dto/assign-service-task.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import type { ServiceRequestResult } from './models/service-request-result';
import { ServiceRequestsService } from './service-requests.service';

@Controller('service-requests')
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Post()
  @FdsWriteAccess()
  create(
    @Body()
    dto: CreateServiceRequestDto,

    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ): Promise<ServiceRequestResult> {
    requireMatchingActor(dto.performedBy, principal);

    return this.serviceRequestsService.create({
      ...dto,
      performedBy: principal.userId,
    });
  }

  @Get('available-workers')
  @FdsReadAccess()
  getAvailableWorkers(): Promise<WkmsAvailableWorker[]> {
    return this.serviceRequestsService.getAvailableWorkers();
  }

  @Post('tasks/:taskId/assign')
  @FdsWriteAccess()
  assignTask(
    @Param(
      'taskId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    taskId: string,

    @Body()
    dto: AssignServiceTaskDto,

    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ): Promise<WkmsTaskAssignmentResult> {
    return this.serviceRequestsService.assignTask({
      taskId,
      workerId: dto.workerId,
      assignedBy: principal.userId,
    });
  }
}
