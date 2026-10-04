import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TaskEscalatedEvent } from '../messaging/contracts/task-escalated.event';
import {
  REALTIME_CONTRACT_VERSION,
  REALTIME_EVENTS,
} from './realtime.constants';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeStateService } from './realtime-state.service';
import type {
  PublishRoomStatusUpdateInput,
  RoomStatusUpdatedEvent,
} from './realtime.types';

@Injectable()
export class RealtimePublisherService {
  private readonly logger = new Logger(RealtimePublisherService.name);

  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly realtimeStateService: RealtimeStateService,
  ) {}

  publishRoomStatusUpdated(
    input: PublishRoomStatusUpdateInput,
  ): RoomStatusUpdatedEvent {
    const event: RoomStatusUpdatedEvent = {
      eventId: randomUUID(),
      eventType: REALTIME_EVENTS.roomStatusUpdated,
      contractVersion: REALTIME_CONTRACT_VERSION,
      occurredAt: new Date().toISOString(),
      data: {
        roomNumber: input.roomNumber,
        status: input.status,
        source: input.source,
        performedBy: input.performedBy,
      },
    };

    try {
      this.realtimeGateway.emitRoomStatusUpdated(event);
    } catch (error) {
      this.logger.warn(
        `Unable to push room-status realtime event for ${input.roomNumber}: ${this.errorMessage(
          error,
        )}`,
      );
    }

    return event;
  }

  publishTaskEscalated(event: TaskEscalatedEvent): TaskEscalatedEvent {
    /*
     * Store the latest escalation before attempting the socket push.
     *
     * If a browser is temporarily disconnected it can later recover the
     * escalation through GET /realtime/escalations.
     */
    this.realtimeStateService.recordTaskEscalation(event);

    try {
      this.realtimeGateway.emitTaskEscalated(event);
    } catch (error) {
      this.logger.warn(
        `Unable to push task escalation ${event.data.taskId}: ${this.errorMessage(
          error,
        )}`,
      );
    }

    return event;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
