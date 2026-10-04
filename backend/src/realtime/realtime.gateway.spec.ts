import { jest } from '@jest/globals';
import type { Namespace, Socket } from 'socket.io';
import {
  REALTIME_CONTRACT_VERSION,
  REALTIME_EVENTS,
} from './realtime.constants';
import { RealtimeGateway } from './realtime.gateway';
import type { RoomStatusUpdatedEvent } from './realtime.types';
import { RoomStatus } from '../rooms/models/room-status';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let namespaceEmit: jest.Mock;

  beforeEach(() => {
    gateway = new RealtimeGateway();

    namespaceEmit = jest.fn();

    gateway.server = {
      emit: namespaceEmit,
    } as unknown as Namespace;
  });

  it('should send the realtime contract when a client connects', () => {
    const clientEmit = jest.fn();

    const client = {
      id: 'socket-1',
      emit: clientEmit,
    } as unknown as Socket;

    gateway.handleConnection(client);

    expect(clientEmit).toHaveBeenCalledWith(
      REALTIME_EVENTS.ready,
      expect.objectContaining({
        eventType: REALTIME_EVENTS.ready,
        contractVersion: REALTIME_CONTRACT_VERSION,
      }),
    );
  });

  it('should handle client disconnects', () => {
    const client = {
      id: 'socket-1',
    } as Socket;

    expect(() => gateway.handleDisconnect(client)).not.toThrow();
  });

  it('should broadcast room-status updates', () => {
    const event: RoomStatusUpdatedEvent = {
      eventId: '11111111-1111-4111-8111-111111111111',
      eventType: REALTIME_EVENTS.roomStatusUpdated,
      contractVersion: REALTIME_CONTRACT_VERSION,
      occurredAt: '2030-01-01T10:00:00.000Z',
      data: {
        roomNumber: 'T102',
        status: RoomStatus.REQUIRES_CLEANING,
        source: 'CHECK_OUT',
      },
    };

    gateway.emitRoomStatusUpdated(event);

    expect(namespaceEmit).toHaveBeenCalledWith(
      REALTIME_EVENTS.roomStatusUpdated,
      event,
    );
  });

  it('should broadcast task escalations', () => {
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

    gateway.emitTaskEscalated(event);

    expect(namespaceEmit).toHaveBeenCalledWith(
      REALTIME_EVENTS.taskEscalated,
      event,
    );
  });
});
