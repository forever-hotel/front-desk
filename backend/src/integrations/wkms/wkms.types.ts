import type { ServiceRequestCategory } from '../../service-requests/models/service-request-category';

export interface CreateWkmsServiceTaskInput {
  roomNumber: string;
  category: ServiceRequestCategory;
  description?: string;
  requestedBy: string;
}

export interface WkmsTaskResult {
  taskId: string;
  roomNumber: string;
  category: string;
  status: string;
  priority: string;
  createdAt?: string;
}

export interface WkmsAvailableWorker {
  workerId: string;
  displayName: string;
  activeTaskCount: number;
  maxActiveTasks: number;
}

export interface AssignWkmsTaskInput {
  taskId: string;
  workerId: string;
  assignedBy: string;
}

export interface WkmsTaskAssignmentResult {
  taskId: string;
  status: string;
  assignedWorkerId: string;
  assignedAt?: string;
}
