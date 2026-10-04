import { RealtimeStateService } from './realtime-state.service';
import type { TaskEscalatedEvent } from '../messaging/contracts/task-escalated.event';

function createEscalation(
  taskId: string,
  occurredAt: string,
): TaskEscalatedEvent {
  return {
    eventId: `event-${taskId}`,
    eventType: 'task.escalated',
    eventVersion: 1,
    occurredAt,
    source: 'worker-management',
    data: {
      taskId,
      taskCategory: 'ROOM_CLEANING',
      roomNumber: 'T102',
      priority: 'HIGH',
      escalatedAt: occurredAt,
    },
  };
}

describe('RealtimeStateService', () => {
  let service: RealtimeStateService;

  beforeEach(() => {
    service = new RealtimeStateService();
  });

  it('should return an empty escalation list initially', () => {
    expect(service.getRecentEscalations()).toEqual([]);
  });

  it('should store the newest escalation first', () => {
    const first = createEscalation(
      '11111111-1111-4111-8111-111111111111',
      '2030-01-01T10:00:00.000Z',
    );

    const second = createEscalation(
      '22222222-2222-4222-8222-222222222222',
      '2030-01-01T10:05:00.000Z',
    );

    service.recordTaskEscalation(first);
    service.recordTaskEscalation(second);

    expect(service.getRecentEscalations()).toEqual([second, first]);
  });

  it('should replace an existing task escalation without duplicating it', () => {
    const taskId = '11111111-1111-4111-8111-111111111111';

    const first = createEscalation(taskId, '2030-01-01T10:00:00.000Z');

    const updated: TaskEscalatedEvent = {
      ...createEscalation(taskId, '2030-01-01T10:10:00.000Z'),
      data: {
        ...first.data,
        priority: 'NORMAL',
        escalatedAt: '2030-01-01T10:10:00.000Z',
      },
    };

    service.recordTaskEscalation(first);
    service.recordTaskEscalation(updated);

    expect(service.getRecentEscalations()).toEqual([updated]);
  });

  it('should keep only the latest 100 escalations', () => {
    const events: TaskEscalatedEvent[] = [];

    for (let index = 1; index <= 101; index += 1) {
      const taskId = `00000000-0000-4000-8000-${String(index).padStart(
        12,
        '0',
      )}`;

      const occurredAt = new Date(
        Date.UTC(2030, 0, 1, 10, index),
      ).toISOString();

      const event = createEscalation(taskId, occurredAt);

      events.push(event);

      service.recordTaskEscalation(event);
    }

    const storedEvents = service.getRecentEscalations();

    expect(storedEvents).toHaveLength(100);

    /*
     * Newest event stays at the front.
     */
    expect(storedEvents[0]).toEqual(events[100]);

    /*
     * The oldest event must be removed once
     * the 100-item fallback buffer is exceeded.
     */
    expect(storedEvents).not.toContainEqual(events[0]);

    expect(storedEvents).toContainEqual(events[1]);
  });

  it('should move an updated task back to the newest position', () => {
    const firstTaskId = '11111111-1111-4111-8111-111111111111';

    const secondTaskId = '22222222-2222-4222-8222-222222222222';

    const first = createEscalation(firstTaskId, '2030-01-01T10:00:00.000Z');

    const second = createEscalation(secondTaskId, '2030-01-01T10:05:00.000Z');

    const updatedFirst = createEscalation(
      firstTaskId,
      '2030-01-01T10:10:00.000Z',
    );

    service.recordTaskEscalation(first);
    service.recordTaskEscalation(second);
    service.recordTaskEscalation(updatedFirst);

    expect(service.getRecentEscalations()).toEqual([updatedFirst, second]);
  });
});
