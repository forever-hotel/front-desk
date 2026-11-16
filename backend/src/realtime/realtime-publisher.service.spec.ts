import { jest } from '@jest/globals';
import { RoomStatus } from '../rooms/models/room-status';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisherService } from './realtime-publisher.service';
import { RealtimeStateService } from './realtime-state.service';

describe('RealtimePublisherService', () => {
  let gateway: {
    emitRoomStatusUpdated: jest.Mock;
    emitTaskEscalated: jest.Mock;
  };

  let stateService: {
    recordTaskEscalation: jest.Mock;
  };

  let service: RealtimePublisherService;

  beforeEach(() => {
    gateway = {
      emitRoomStatusUpdated: jest.fn(),
      emitTaskEscalated: jest.fn(),
    };

    stateService = {
      recordTaskEscalation: jest.fn(),
    };

    service = new RealtimePublisherService(
      gateway as unknown as RealtimeGateway,
      stateService as unknown as RealtimeStateService,
    );
  });

  it('should create and broadcast a room-status realtime event', () => {
    const event = service.publishRoomStatusUpdated({
      roomNumber: 'T102',
      status: RoomStatus.REQUIRES_CLEANING,
      source: 'CHECK_OUT',
      performedBy: '66666666-6666-4666-8666-666666666666',
    });

    expect(event.eventType).toBe('room.status.updated');

    expect(event.eventId).toEqual(expect.any(String));

    expect(event.data).toEqual({
      roomNumber: 'T102',
      status: RoomStatus.REQUIRES_CLEANING,
      source: 'CHECK_OUT',
      performedBy: '66666666-6666-4666-8666-666666666666',
    });

    expect(gateway.emitRoomStatusUpdated).toHaveBeenCalledWith(event);
  });

  it('should not fail the business operation if socket broadcasting fails', () => {
    gateway.emitRoomStatusUpdated.mockImplementation(() => {
      throw new Error('socket unavailable');
    });

    expect(() =>
      service.publishRoomStatusUpdated({
        roomNumber: 'T102',
        status: RoomStatus.REQUIRES_CLEANING,
        source: 'CHECK_OUT',
      }),
    ).not.toThrow();
  });

  it('should store and broadcast a task escalation', () => {
    const event = {
      eventId: 'event-1',
      eventType: 'task.escalated' as const,
      eventVersion: 1 as const,
      occurredAt: '2030-01-01T10:00:00.000Z',
      source: 'worker-management' as const,
      data: {
        taskId: '11111111-1111-4111-8111-111111111111',
        taskCategory: 'ROOM_CLEANING' as const,
        roomNumber: 'T102',
        priority: 'HIGH' as const,
        escalatedAt: '2030-01-01T10:00:00.000Z',
      },
    };

    expect(service.publishTaskEscalated(event)).toBe(event);

    expect(stateService.recordTaskEscalation).toHaveBeenCalledWith(event);

    expect(gateway.emitTaskEscalated).toHaveBeenCalledWith(event);
  });

  it('should preserve escalation fallback state if socket push fails', () => {
    gateway.emitTaskEscalated.mockImplementation(() => {
      throw 'socket unavailable';
    });

    const event = {
      eventId: 'event-1',
      eventType: 'task.escalated' as const,
      eventVersion: 1 as const,
      occurredAt: '2030-01-01T10:00:00.000Z',
      source: 'worker-management' as const,
      data: {
        taskId: '11111111-1111-4111-8111-111111111111',
        taskCategory: 'MAINTENANCE' as const,
        roomNumber: 'T104',
        priority: 'HIGH' as const,
        escalatedAt: '2030-01-01T10:00:00.000Z',
      },
    };

    expect(() => service.publishTaskEscalated(event)).not.toThrow();

    expect(stateService.recordTaskEscalation).toHaveBeenCalledWith(event);
  });
});
