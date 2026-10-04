import { Injectable } from '@nestjs/common';
import type { TaskEscalatedEvent } from '../messaging/contracts/task-escalated.event';

const MAX_RECENT_ESCALATIONS = 100;

@Injectable()
export class RealtimeStateService {
  private readonly escalations = new Map<string, TaskEscalatedEvent>();

  recordTaskEscalation(event: TaskEscalatedEvent): void {
    const taskId = event.data.taskId;

    if (this.escalations.has(taskId)) {
      this.escalations.delete(taskId);
    }

    this.escalations.set(taskId, event);

    while (this.escalations.size > MAX_RECENT_ESCALATIONS) {
      const oldestTaskId = this.escalations.keys().next().value as
        string | undefined;

      if (!oldestTaskId) {
        break;
      }

      this.escalations.delete(oldestTaskId);
    }
  }

  getRecentEscalations(): TaskEscalatedEvent[] {
    return Array.from(this.escalations.values()).reverse();
  }
}
