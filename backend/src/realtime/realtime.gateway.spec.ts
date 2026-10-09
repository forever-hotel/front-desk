import { jest } from '@jest/globals';
import type { Namespace, Socket } from 'socket.io';

import { SystemRole } from '../security/auth/system-role';

import {
  REALTIME_CONTRACT_VERSION,
  REALTIME_EVENTS,
} from './realtime.constants';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeSocketAuthService } from './realtime-socket-auth.service';

import type { RoomStatusUpdatedEvent } from './realtime.types';

import { RoomStatus } from '../rooms/models/room-status';

type NextFunction = (error?: Error) => void;

type NamespaceMiddleware = (
  client: Socket,
  next: NextFunction,
) => void | Promise<void>;

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;

  let namespaceEmit: jest.Mock;

  let namespaceUse: jest.Mock<(middleware: NamespaceMiddleware) => void>;

  let authenticate: jest.Mock<RealtimeSocketAuthService['authenticate']>;

  const managerPrincipal = {
    userId: '77777777-7777-4777-8777-777777777777',
    role: SystemRole.MANAGER,
  };

  const receptionistPrincipal = {
    userId: '66666666-6666-4666-8666-666666666666',
    role: SystemRole.RECEPTIONIST,
  };

  beforeEach(() => {
    namespaceEmit = jest.fn();

    namespaceUse = jest.fn();

    authenticate = jest.fn();

    const socketAuthService = {
      authenticate,
    } as unknown as RealtimeSocketAuthService;

    gateway = new RealtimeGateway(socketAuthService);

    gateway.server = {
      emit: namespaceEmit,
      use: namespaceUse,
    } as unknown as Namespace;
  });

  function createClient(token?: string): Socket {
    return {
      id: 'socket-1',
      handshake: {
        auth: token ? { token } : {},
      },
      data: {},
      emit: jest.fn(),
    } as unknown as Socket;
  }

  function getAuthenticationMiddleware(): NamespaceMiddleware {
    gateway.afterInit(gateway.server);

    expect(namespaceUse).toHaveBeenCalledTimes(1);

    const middleware = namespaceUse.mock.calls[0]?.[0];

    if (!middleware) {
      throw new Error('Authentication middleware was not registered');
    }

    return middleware;
  }

  it('registers Socket.IO authentication middleware', () => {
    gateway.afterInit(gateway.server);

    expect(namespaceUse).toHaveBeenCalledTimes(1);
    expect(namespaceUse).toHaveBeenCalledWith(expect.any(Function));
  });

  it('rejects a connection without a JWT', async () => {
    const middleware = getAuthenticationMiddleware();

    authenticate.mockResolvedValue(null);

    const client = createClient();

    const next = jest.fn<NextFunction>();

    await middleware(client, next);

    expect(authenticate).toHaveBeenCalledWith(undefined);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized',
      }),
    );

    expect(client.data.principal).toBeUndefined();
  });

  it('rejects a connection with an invalid JWT', async () => {
    const middleware = getAuthenticationMiddleware();

    authenticate.mockResolvedValue(null);

    const client = createClient('invalid-token');

    const next = jest.fn<NextFunction>();

    await middleware(client, next);

    expect(authenticate).toHaveBeenCalledWith('invalid-token');

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized',
      }),
    );
  });

  it('allows an authenticated receptionist', async () => {
    const middleware = getAuthenticationMiddleware();

    authenticate.mockResolvedValue(receptionistPrincipal);

    const client = createClient('valid-receptionist-token');

    const next = jest.fn<NextFunction>();

    await middleware(client, next);

    expect(next).toHaveBeenCalledWith();

    expect(client.data.principal).toEqual(receptionistPrincipal);
  });

  it('allows an authenticated manager', async () => {
    const middleware = getAuthenticationMiddleware();

    authenticate.mockResolvedValue(managerPrincipal);

    const client = createClient('valid-manager-token');

    const next = jest.fn<NextFunction>();

    await middleware(client, next);

    expect(next).toHaveBeenCalledWith();

    expect(client.data.principal).toEqual(managerPrincipal);
  });

  it('rejects connections when authentication throws', async () => {
    const middleware = getAuthenticationMiddleware();

    authenticate.mockRejectedValue(new Error('Authentication unavailable'));

    const client = createClient('test-token');

    const next = jest.fn<NextFunction>();

    await middleware(client, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized',
      }),
    );

    expect(client.data.principal).toBeUndefined();
  });

  it('sends the realtime contract when a client connects', () => {
    const client = createClient('valid-token');

    gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.ready,
      expect.objectContaining({
        eventType: REALTIME_EVENTS.ready,
        contractVersion: REALTIME_CONTRACT_VERSION,
      }),
    );
  });

  it('handles client disconnects', () => {
    const client = createClient();

    expect(() => gateway.handleDisconnect(client)).not.toThrow();
  });

  it('broadcasts room status updates', () => {
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

  it('broadcasts task escalations', () => {
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
