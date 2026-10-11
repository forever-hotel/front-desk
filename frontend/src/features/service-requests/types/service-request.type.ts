export type ServiceRequestCategory =
  "EXTRA_TOWELS" | "WATER_BOTTLES" | "MAINTENANCE" | "LAUNDRY" | "OTHER";

export interface CreateServiceRequest {
  bookingReference: string;
  category: ServiceRequestCategory;
  description?: string;
  performedBy: string;
}

export interface ServiceTaskResult {
  taskId: string;
  roomNumber: string;
  category: string;
  status: string;
  priority: string;
  createdAt?: string;
}

export interface ServiceRequestResult {
  status: "created";
  bookingReference: string;
  roomNumber: string;
  task: ServiceTaskResult;
}
