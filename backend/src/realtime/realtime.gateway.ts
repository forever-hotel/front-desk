import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import {
  REALTIME_CONTRACT_VERSION,
  REALTIME_EVENTS,
  REALTIME_NAMESPACE,
} from './realtime.constants';
import type {
  RealtimeReadyEvent,
  RoomStatusUpdatedEvent,
  TaskEscalatedRealtimeEvent,
} from './realtime.types';

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: {
    origin: 'http://localhost:3001',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Namespace;

  handleConnection(client: Socket): void {
    const readyEvent: RealtimeReadyEvent = {
      eventType: REALTIME_EVENTS.ready,
      contractVersion: REALTIME_CONTRACT_VERSION,
      connectedAt: new Date().toISOString(),
    };

    client.emit(REALTIME_EVENTS.ready, readyEvent);

    this.logger.debug(`Realtime client connected: ${client.id}`);
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
