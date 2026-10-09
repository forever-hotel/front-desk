import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import { io, type Socket } from 'socket.io-client';

import { REALTIME_EVENTS } from '../src/realtime/realtime.constants';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';
import { RealtimePublisherService } from '../src/realtime/realtime-publisher.service';
import { RealtimeSocketAuthService } from '../src/realtime/realtime-socket-auth.service';
import { RealtimeStateService } from '../src/realtime/realtime-state.service';

import type { RoomStatusUpdatedEvent } from '../src/realtime/realtime.types';

import { RoomStatus } from '../src/rooms/models/room-status';
import { SecurityModule } from '../src/security/security.module';
import { SystemRole } from '../src/security/auth/system-role';

describe('Realtime WebSocket Authentication (e2e)', () => {
  let app: INestApplication;
  let publisher: RealtimePublisherService;
  let baseUrl: string;

  const clients: Socket[] = [];

  const secret = 'realtime-e2e-test-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const managerId = '77777777-7777-4777-8777-777777777777';

  const workerId = '88888888-8888-4888-8888-888888888888';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: secret,
              JWT_ISSUER: issuer,
            }),
          ],
        }),
        SecurityModule,
      ],

      providers: [
        RealtimeGateway,
        RealtimeSocketAuthService,
        RealtimeStateService,
        RealtimePublisherService,
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    await app.listen(0, '127.0.0.1');

    baseUrl = await app.getUrl();

    publisher = app.get(RealtimePublisherService);
  });

  afterEach(() => {
    for (const socket of clients) {
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
    }

    clients.length = 0;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createToken(
    role: SystemRole,
    options: {
      expired?: boolean;
      issuer?: string;
      signingSecret?: string;
    } = {},
  ): Promise<string> {
    const userId =
      role === SystemRole.RECEPTIONIST
        ? receptionistId
        : role === SystemRole.MANAGER
          ? managerId
          : workerId;

    const expiresAt = options.expired
      ? Math.floor(Date.now() / 1000) - 60
      : Math.floor(Date.now() / 1000) + 3600;

    return new SignJWT({ role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(options.issuer ?? issuer)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(new TextEncoder().encode(options.signingSecret ?? secret));
  }

  function createSocket(token?: string, reconnect = true): Socket {
    const socket = io(`${baseUrl}/realtime`, {
      forceNew: true,
      autoConnect: false,

      reconnection: reconnect,
      reconnectionAttempts: 5,
      reconnectionDelay: 50,
      reconnectionDelayMax: 100,

      timeout: 2000,
      transports: ['websocket', 'polling'],

      auth: token ? { token } : {},
    });

    clients.push(socket);

    return socket;
  }

  function connectClient(token: string): Promise<Socket> {
    const socket = createSocket(token);

    return new Promise<Socket>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('WebSocket connection timed out'));
      }, 3500);

      const onConnect = () => {
        cleanup();
        resolve(socket);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
      };

      socket.once('connect', onConnect);
      socket.once('connect_error', onError);

      socket.connect();
    });
  }

  function expectConnectionRejected(token?: string): Promise<void> {
    const socket = createSocket(token, false);

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Authentication rejection timed out'));
      }, 3500);

      const onConnect = () => {
        cleanup();
        reject(new Error('Unauthorized client was connected'));
      };

      const onError = (error: Error) => {
        cleanup();

        try {
          expect(error.message).toBe('Unauthorized');
          expect(socket.connected).toBe(false);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
      };

      socket.once('connect', onConnect);
      socket.once('connect_error', onError);

      socket.connect();
    });
  }

  function waitForRoomUpdate(socket: Socket): Promise<RoomStatusUpdatedEvent> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(REALTIME_EVENTS.roomStatusUpdated, onEvent);
        reject(new Error('Room update event timed out'));
      }, 3500);

      const onEvent = (event: RoomStatusUpdatedEvent) => {
        clearTimeout(timeout);
        resolve(event);
      };

      socket.once(REALTIME_EVENTS.roomStatusUpdated, onEvent);
    });
  }

  function waitForDisconnect(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('disconnect', onDisconnect);
        reject(new Error('Disconnect timed out'));
      }, 3500);

      const onDisconnect = () => {
        clearTimeout(timeout);
        resolve();
      };

      socket.once('disconnect', onDisconnect);
    });
  }

  function waitForNextConnection(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('connect', onConnect);
        reject(new Error('Reconnect timed out'));
      }, 5000);

      const onConnect = () => {
        clearTimeout(timeout);
        resolve();
      };

      socket.once('connect', onConnect);
    });
  }

  it('allows a receptionist and delivers room events', async () => {
    const token = await createToken(SystemRole.RECEPTIONIST);

    const socket = await connectClient(token);

    expect(socket.connected).toBe(true);

    const eventPromise = waitForRoomUpdate(socket);

    publisher.publishRoomStatusUpdated({
      roomNumber: 'T102',
      status: RoomStatus.REQUIRES_CLEANING,
      source: 'CHECK_OUT',
    });

    const event = await eventPromise;

    expect(event.eventType).toBe(REALTIME_EVENTS.roomStatusUpdated);

    expect(event.data).toEqual(
      expect.objectContaining({
        roomNumber: 'T102',
        status: RoomStatus.REQUIRES_CLEANING,
        source: 'CHECK_OUT',
      }),
    );
  });

  it('allows a manager JWT', async () => {
    const token = await createToken(SystemRole.MANAGER);

    const socket = await connectClient(token);

    expect(socket.connected).toBe(true);
  });

  it('rejects a missing JWT', async () => {
    await expectConnectionRejected();
  });

  it('rejects an invalid JWT', async () => {
    await expectConnectionRejected('invalid-token');
  });

  it('rejects an expired JWT', async () => {
    const token = await createToken(SystemRole.RECEPTIONIST, { expired: true });

    await expectConnectionRejected(token);
  });

  it('rejects a worker JWT', async () => {
    const token = await createToken(SystemRole.WORKER);

    await expectConnectionRejected(token);
  });

  it('rejects a JWT with an invalid issuer', async () => {
    const token = await createToken(SystemRole.RECEPTIONIST, {
      issuer: 'unknown-issuer',
    });

    await expectConnectionRejected(token);
  });

  it('rejects a JWT with an invalid signature', async () => {
    const token = await createToken(SystemRole.RECEPTIONIST, {
      signingSecret: 'another-different-test-secret-at-least-32-characters',
    });

    await expectConnectionRejected(token);
  });

  it('reconnects with JWT and receives room events', async () => {
    const token = await createToken(SystemRole.RECEPTIONIST);

    const socket = await connectClient(token);

    const initialSocketId = socket.id;

    const disconnectPromise = waitForDisconnect(socket);
    const reconnectPromise = waitForNextConnection(socket);

    // Simulate an unexpected network transport failure.
    socket.io.engine.close();

    await disconnectPromise;
    await reconnectPromise;

    expect(socket.connected).toBe(true);
    expect(socket.id).not.toBe(initialSocketId);

    const eventPromise = waitForRoomUpdate(socket);

    publisher.publishRoomStatusUpdated({
      roomNumber: 'T104',
      status: RoomStatus.UNDER_MAINTENANCE,
      source: 'ROOM_STATUS',
    });

    const event = await eventPromise;

    expect(event.eventType).toBe(REALTIME_EVENTS.roomStatusUpdated);

    expect(event.data.roomNumber).toBe('T104');
    expect(event.data.status).toBe(RoomStatus.UNDER_MAINTENANCE);
  });
});
