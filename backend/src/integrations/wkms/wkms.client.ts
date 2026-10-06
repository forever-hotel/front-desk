import type {
  AssignWkmsTaskInput,
  CreateWkmsServiceTaskInput,
  WkmsAvailableWorker,
  WkmsTaskAssignmentResult,
  WkmsTaskResult,
} from './wkms.types';

export abstract class WkmsClient {
  abstract createServiceTask(
    input: CreateWkmsServiceTaskInput,
  ): Promise<WkmsTaskResult>;

  abstract getAvailableWorkers(): Promise<WkmsAvailableWorker[]>;

  abstract assignTask(
    input: AssignWkmsTaskInput,
  ): Promise<WkmsTaskAssignmentResult>;
}
