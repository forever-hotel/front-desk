import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import { REALTIME_EVENTS } from '../src/realtime/realtime.constants';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';
import { RealtimePublisherService } from '../src/realtime/realtime-publisher.service';
import { RealtimeStateService } from '../src/realtime/realtime-state.service';
import type { RoomStatusUpdatedEvent } from '../src/realtime/realtime.types';
import { RoomStatus } from '../src/rooms/models/room-status';

describe('Realtime WebSocket (e2e)', () => {
  let app: INestApplication;
  let client: Socket | undefined;
  let publisher: RealtimePublisherService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
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
    if (!client) {
      return;
    }

    client.removeAllListeners();
    client.io.removeAllListeners();
    client.close();

    client = undefined;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  function connectClient(): Promise<Socket> {
    const socket = io(`${baseUrl}/realtime`, {
      forceNew: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 50,
      reconnectionDelayMax: 100,
      timeout: 2000,
      transports: ['websocket', 'polling'],
    });

    client = socket;

    return new Promise<Socket>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close();

        reject(new Error('Initial realtime client connection timed out'));
      }, 3000);

      const handleConnect = () => {
        clearTimeout(timeout);

        socket.off('connect_error', handleConnectError);

        resolve(socket);
      };

      const handleConnectError = (error: Error) => {
        clearTimeout(timeout);

        socket.off('connect', handleConnect);

        reject(error);
      };

      socket.once('connect', handleConnect);
      socket.once('connect_error', handleConnectError);

      socket.connect();
    });
  }

  function waitForNextConnection(socket: Socket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();

        reject(new Error('Realtime namespace socket did not reconnect'));
      }, 5000);

      const handleConnect = () => {
        cleanup();

        resolve();
      };

      const cleanup = () => {
        clearTimeout(timeout);

        socket.off('connect', handleConnect);
      };

      /*
       * We deliberately wait for Socket.IO Socket's
       * "connect" event here, not Manager's "reconnect".
       *
       * The Socket-level event confirms that the
       * /realtime namespace has completed its handshake
       * and can receive application events again.
       */
      socket.once('connect', handleConnect);
    });
  }

  function waitForDisconnect(socket: Socket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();

        reject(new Error('Realtime client did not detect transport loss'));
      }, 3000);

      const handleDisconnect = () => {
        cleanup();

        resolve();
      };

      const cleanup = () => {
        clearTimeout(timeout);

        socket.off('disconnect', handleDisconnect);
      };

      socket.once('disconnect', handleDisconnect);
    });
  }

  function waitForRoomUpdate(socket: Socket): Promise<RoomStatusUpdatedEvent> {
    return new Promise<RoomStatusUpdatedEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();

        reject(new Error('Room realtime event was not received'));
      }, 3000);

      const handleRoomUpdate = (event: RoomStatusUpdatedEvent) => {
        cleanup();

        resolve(event);
      };

      const cleanup = () => {
        clearTimeout(timeout);

        socket.off(REALTIME_EVENTS.roomStatusUpdated, handleRoomUpdate);
      };

      socket.once(REALTIME_EVENTS.roomStatusUpdated, handleRoomUpdate);
    });
  }

  it('should deliver a room-status update without an HTTP refresh', async () => {
    const socket = await connectClient();

    expect(socket.connected).toBe(true);

    const eventPromise = waitForRoomUpdate(socket);

    publisher.publishRoomStatusUpdated({
      roomNumber: 'T102',
      status: RoomStatus.REQUIRES_CLEANING,
      source: 'CHECK_OUT',
    });

    const event = await eventPromise;

    expect(event.eventType).toBe(REALTIME_EVENTS.roomStatusUpdated);

    expect(event.data).toEqual({
      roomNumber: 'T102',
      status: RoomStatus.REQUIRES_CLEANING,
      source: 'CHECK_OUT',
    });
  });

  it('should reconnect and continue receiving realtime updates', async () => {
    const socket = await connectClient();

    expect(socket.connected).toBe(true);

    const initialSocketId = socket.id;

    /*
     * Register both listeners BEFORE forcing the
     * transport failure so a fast reconnect cannot
     * race past the test.
     */
    const disconnectPromise = waitForDisconnect(socket);

    const reconnectPromise = waitForNextConnection(socket);

    /*
     * Do not call socket.disconnect().
     *
     * disconnect() is an intentional application-level
     * disconnect and disables automatic reconnection.
     *
     * Closing the Engine.IO transport simulates a real
     * network/transport interruption and lets Socket.IO
     * execute its reconnection mechanism.
     */
    socket.io.engine.close();

    await disconnectPromise;

    expect(socket.connected).toBe(false);

    await reconnectPromise;

    /*
     * At this point the /realtime namespace Socket,
     * not merely the low-level Manager, is connected.
     */
    expect(socket.connected).toBe(true);

    expect(socket.id).toBeDefined();

    expect(socket.id).not.toBe(initialSocketId);

    /*
     * Register the application-event listener before
     * publishing, so there is no event-listener race.
     */
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

    expect(event.data.source).toBe('ROOM_STATUS');
  });
});
