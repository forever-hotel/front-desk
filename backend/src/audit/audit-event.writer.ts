import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ManualTaskAssignmentAuditInput {
  staffUserId: string;
  taskId: string;
  workerId: string;
  assignmentStatus: string;
  assignedAt?: string;
}

@Injectable()
export class AuditEventWriter {
  constructor(private readonly dataSource: DataSource) {}

  async recordManualTaskAssignment(
    input: ManualTaskAssignmentAuditInput,
  ): Promise<void> {
    const details = {
      workerId: input.workerId,
      assignmentStatus: input.assignmentStatus,
      assignedAt: input.assignedAt ?? null,
    };

    await this.dataSource.query(
      `
        INSERT INTO audit_logs (
          event_category,
          actor_type,
          staff_user_id,
          action,
          entity_type,
          entity_id,
          details
        )
        VALUES (
          'TASK_SERVICE',
          'STAFF',
          $1,
          'MANUAL_TASK_ASSIGNMENT',
          'WKMS_TASK',
          $2,
          $3::jsonb
        )
      `,
      [input.staffUserId, input.taskId, JSON.stringify(details)],
    );
  }
}
