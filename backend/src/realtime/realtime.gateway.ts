import { Injectable, Logger } from '@nestjs/common';
import { RabbitMqService } from '../messaging/rabbitmq/rabbitmq.service';

// Business event adapter. Browser sockets are owned by the shared WebSocket service.
@Injectable()
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);
  constructor(private readonly broker: RabbitMqService) {}
  private publish(name: string): void {
    void this.broker.publishRealtime('fds', name).catch(() => {
      this.logger.warn(
        'Realtime invalidation unavailable; clients recover through REST snapshots.',
      );
    });
  }
  emitRoomStatusUpdated(_event: unknown): void {
    this.publish('room.status.updated');
  }
  emitTaskEscalated(_event: unknown): void {
    this.publish('task.escalated');
  }
}
