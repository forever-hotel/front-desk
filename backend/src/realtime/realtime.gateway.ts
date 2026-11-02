import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import {
  REALTIME_CONTRACT_VERSION,
  REALTIME_EVENTS,
  REALTIME_NAMESPACE,
} from './realtime.constants';

import { RealtimeSocketAuthService } from './realtime-socket-auth.service';
import { getAllowedOrigins } from '../config/cors.config';

import type {
  RealtimeReadyEvent,
  RoomStatusUpdatedEvent,
  TaskEscalatedRealtimeEvent,
} from './realtime.types';

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: {
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      const allowed = getAllowedOrigins().includes(requestOrigin);
      callback(null, allowed);
    },
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit<Namespace>, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly socketAuthService: RealtimeSocketAuthService) {}

  @WebSocketServer()
  server!: Namespace;

  /*
   * Authenticate every Socket.IO namespace connection
   * before allowing the client to join /realtime.
   */
  afterInit(server: Namespace): void {
    server.use(async (client, next) => {
      try {
        const origin = client.handshake.headers?.origin;
        if (
          (origin && !getAllowedOrigins().includes(origin)) ||
          (!origin && !client.handshake.auth?.token)
        )
          throw new Error('Unapproved socket origin');
        const token: unknown =
          client.handshake.auth?.token ??
          client.handshake.headers.cookie
            ?.split(';')
            .map((value) => value.trim())
            .find((value) => value.startsWith('fds_session='))
            ?.slice(12);

        const principal = await this.socketAuthService.authenticate(token);

        if (!principal) {
          next(new Error('Unauthorized'));
          return;
        }

        // Store the verified identity for future handlers.
        client.data.principal = principal;
        client.data.staffToken = token;

        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  handleConnection(client: Socket): void {
    const revalidate = setInterval(() => {
      void this.socketAuthService
        .authenticate(client.data.staffToken)
        .then((principal) => {
          if (!principal) client.disconnect(true);
        });
    }, 5000);
    revalidate.unref();
    client.once('disconnect', () => clearInterval(revalidate));
    const readyEvent: RealtimeReadyEvent = {
      eventType: REALTIME_EVENTS.ready,
      contractVersion: REALTIME_CONTRACT_VERSION,
      connectedAt: new Date().toISOString(),
    };

    client.emit(REALTIME_EVENTS.ready, readyEvent);

    this.logger.debug(`Authenticated realtime client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Realtime client disconnected: ${client.id}`);
  }

  emitRoomStatusUpdated(event: RoomStatusUpdatedEvent): void {
    this.server.emit(REALTIME_EVENTS.roomStatusUpdated, event);
  }

  emitTaskEscalated(event: TaskEscalatedRealtimeEvent): void {
    this.server.emit(REALTIME_EVENTS.taskEscalated, event);
  }
}
