import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEventWriter } from '../audit/audit-event.writer';
import { WkmsClient } from '../integrations/wkms/wkms.client';
import type {
  AssignWkmsTaskInput,
  WkmsAvailableWorker,
  WkmsTaskAssignmentResult,
} from '../integrations/wkms/wkms.types';
import { RealtimeStateService } from '../realtime/realtime-state.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import type { ServiceRequestResult } from './models/service-request-result';
import { ServiceRequestRepository } from './ports/service-request.repository';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly serviceRequestRepository: ServiceRequestRepository,
    private readonly wkmsClient: WkmsClient,
    private readonly auditEventWriter: AuditEventWriter,
    private readonly realtimeStateService: RealtimeStateService,
  ) {}

  async create(dto: CreateServiceRequestDto): Promise<ServiceRequestResult> {
    const stay = await this.serviceRequestRepository.findStay(
      dto.bookingReference,
    );

    if (!stay) {
      throw new NotFoundException('Booking not found');
    }

    if (stay.bookingStatus !== 'CHECKED_IN') {
      throw new ConflictException(
        'Service requests can only be created for a checked-in guest',
      );
    }

    if (!stay.roomNumber) {
      throw new ConflictException(
        'Checked-in booking does not have an assigned room',
      );
    }

    const task = await this.wkmsClient.createServiceTask({
      roomNumber: stay.roomNumber,

      category: dto.category,

      description: dto.description?.trim() || undefined,

      requestedBy: dto.performedBy,
    });

    return {
      status: 'created',

      bookingReference: stay.bookingReference,

      roomNumber: stay.roomNumber,

      task,
    };
  }

  getAvailableWorkers(): Promise<WkmsAvailableWorker[]> {
    return this.wkmsClient.getAvailableWorkers();
  }

  async assignTask(
    input: AssignWkmsTaskInput,
  ): Promise<WkmsTaskAssignmentResult> {
    const assignment = await this.wkmsClient.assignTask(input);

    await this.auditEventWriter.recordManualTaskAssignment({
      staffUserId: input.assignedBy,

      taskId: assignment.taskId,

      workerId: assignment.assignedWorkerId,

      assignmentStatus: assignment.status,

      assignedAt: assignment.assignedAt,
    });

    this.realtimeStateService.removeTaskEscalation(assignment.taskId);

    return assignment;
  }
}
