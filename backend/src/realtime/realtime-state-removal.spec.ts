import type { TaskEscalatedEvent } from '../messaging/contracts/task-escalated.event';
import { RealtimeStateService } from './realtime-state.service';

describe('RealtimeStateService escalation removal', () => {
  const taskId = '11111111-1111-4111-8111-111111111111';

  function createEvent(): TaskEscalatedEvent {
    return {
      eventId: 'event-task-1',

      eventType: 'task.escalated',

      eventVersion: 1,

      occurredAt: '2030-01-10T12:00:00.000Z',

      source: 'worker-management',

      data: {
        taskId,

        taskCategory: 'ROOM_CLEANING',

        roomNumber: 'T102',

        priority: 'HIGH',

        escalatedAt: '2030-01-10T12:00:00.000Z',
      },
    };
  }

  it('should remove an assigned task from recent escalations', () => {
    const service = new RealtimeStateService();

    service.recordTaskEscalation(createEvent());

    expect(service.getRecentEscalations()).toHaveLength(1);

    service.removeTaskEscalation(taskId);

    expect(service.getRecentEscalations()).toEqual([]);
  });

  it('should safely ignore removal of an unknown task', () => {
    const service = new RealtimeStateService();

    expect(() => service.removeTaskEscalation(taskId)).not.toThrow();

    expect(service.getRecentEscalations()).toEqual([]);
  });
});
