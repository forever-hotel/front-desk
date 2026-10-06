import type { ServiceRequestStay } from '../models/service-request-stay';

export abstract class ServiceRequestRepository {
  abstract findStay(
    bookingReference: string,
  ): Promise<ServiceRequestStay | null>;
}
