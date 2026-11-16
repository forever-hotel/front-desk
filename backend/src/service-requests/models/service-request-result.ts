import type { WkmsTaskResult } from '../../integrations/wkms/wkms.types';

export interface ServiceRequestResult {
  status: 'created';
  bookingReference: string;
  roomNumber: string;
  task: WkmsTaskResult;
}
