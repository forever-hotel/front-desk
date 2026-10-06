import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WkmsClient } from '../integrations/wkms/wkms.client';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import type { ServiceRequestResult } from './models/service-request-result';
import { ServiceRequestRepository } from './ports/service-request.repository';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly serviceRequestRepository: ServiceRequestRepository,
    private readonly wkmsClient: WkmsClient,
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
}
