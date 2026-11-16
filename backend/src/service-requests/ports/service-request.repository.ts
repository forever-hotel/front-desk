import type { ServiceRequestStay } from '../models/service-request-stay';

export abstract class ServiceRequestRepository {
  abstract createFrontDeskRequest(input: {
    requestId: string;
    performedBy: string;
    bookingReference: string;
    roomNumber: string;
    category: string;
    description?: string;
  }): Promise<string>;

  abstract findStay(
    bookingReference: string,
  ): Promise<ServiceRequestStay | null>;
}
