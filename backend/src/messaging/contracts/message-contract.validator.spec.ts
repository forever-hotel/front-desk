import {
  MessageContractValidationError,
  validateCheckoutCompletedEvent,
  validateTaskEscalatedEvent,
} from './message-contract.validator';
import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
} from '../messaging.constants';

describe('message contract validation', () => {
  const checkoutCompletedEvent = {
    eventId: 'checkout:44444444-4444-4444-8444-444444444444',
    eventType: MESSAGE_EVENT_TYPES.checkoutCompleted,
    eventVersion: MESSAGE_EVENT_VERSIONS.checkoutCompleted,
    occurredAt: '2030-01-12T10:00:00.000Z',
    source: MESSAGE_SOURCES.frontDesk,
    data: {
      bookingReference: '44444444-4444-4444-8444-444444444444',
      roomNumber: 'T102',
      taskCategory: 'ROOM_CLEANING',
      priority: 'HIGH',
      sourceType: 'CHECKOUT_TRIGGER',
    },
  } as const;

  const taskEscalatedEvent = {
    eventId: 'task-escalated:55555555-5555-4555-8555-555555555555',
    eventType: MESSAGE_EVENT_TYPES.taskEscalated,
    eventVersion: MESSAGE_EVENT_VERSIONS.taskEscalated,
    occurredAt: '2030-01-12T10:05:00.000Z',
    source: MESSAGE_SOURCES.workerManagement,
    data: {
      taskId: '55555555-5555-4555-8555-555555555555',
      taskCategory: 'MAINTENANCE',
      roomNumber: 'T102',
      priority: 'NORMAL',
      escalatedAt: '2030-01-12T10:04:00.000Z',
    },
  } as const;

  it('accepts a valid checkout.completed event', () => {
    expect(validateCheckoutCompletedEvent(checkoutCompletedEvent)).toEqual(
      checkoutCompletedEvent,
    );
  });

  it('rejects an invalid checkout.completed event with all validation details', () => {
    const invalidEvent = {
      ...checkoutCompletedEvent,
      eventType: MESSAGE_EVENT_TYPES.taskEscalated,
      occurredAt: 'not-a-date',
      data: {
        ...checkoutCompletedEvent.data,
        bookingReference: 'not-a-uuid',
        unexpected: true,
      },
      unexpectedTopLevel: true,
    };

    expect(() => validateCheckoutCompletedEvent(invalidEvent)).toThrow(
      MessageContractValidationError,
    );

    expect(() => validateCheckoutCompletedEvent(invalidEvent)).toThrow(
      'Invalid checkout.completed event:',
    );
  });

  it('accepts a valid task.escalated event', () => {
    expect(validateTaskEscalatedEvent(taskEscalatedEvent)).toEqual(
      taskEscalatedEvent,
    );
  });

  it.each([
    'ROOM_CLEANING',
    'EXTRA_TOWELS',
    'WATER_BOTTLES',
    'MAINTENANCE',
    'LAUNDRY',
    'FOOD_DELIVERY',
    'OTHER',
  ] as const)('accepts supported task category %s', (taskCategory) => {
    expect(
      validateTaskEscalatedEvent({
        ...taskEscalatedEvent,
        data: {
          ...taskEscalatedEvent.data,
          taskCategory,
        },
      }).data.taskCategory,
    ).toBe(taskCategory);
  });

  it.each(['HIGH', 'NORMAL'] as const)(
    'accepts supported task priority %s',
    (priority) => {
      expect(
        validateTaskEscalatedEvent({
          ...taskEscalatedEvent,
          data: {
            ...taskEscalatedEvent.data,
            priority,
          },
        }).data.priority,
      ).toBe(priority);
    },
  );

  it('rejects invalid task.escalated payload values and unknown fields', () => {
    const invalidEvent = {
      ...taskEscalatedEvent,
      source: MESSAGE_SOURCES.frontDesk,
      data: {
        ...taskEscalatedEvent.data,
        taskId: 'not-a-uuid',
        taskCategory: 'UNSUPPORTED',
        priority: 'LOW',
        escalatedAt: 'not-a-date',
        extra: 'not-allowed',
      },
    };

    expect(() => validateTaskEscalatedEvent(invalidEvent)).toThrow(
      MessageContractValidationError,
    );

    expect(() => validateTaskEscalatedEvent(invalidEvent)).toThrow(
      'Invalid task.escalated event:',
    );
  });
});
