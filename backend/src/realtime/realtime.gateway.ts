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

import type {
  RealtimeReadyEvent,
  RoomStatusUpdatedEvent,
  TaskEscalatedRealtimeEvent,
} from './realtime.types';

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: {
    origin: 'http://localhost:3000',
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
        const token: unknown = client.handshake.auth?.token;

        const principal = await this.socketAuthService.authenticate(token);

        if (!principal) {
          next(new Error('Unauthorized'));
          return;
        }

        // Store the verified identity for future handlers.
        client.data.principal = principal;

        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  handleConnection(client: Socket): void {
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
