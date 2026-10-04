import { Injectable, Logger } from '@nestjs/common';
import { CheckoutCompletedEvent } from '../contracts/checkout-completed.event';
import { validateCheckoutCompletedEvent } from '../contracts/message-contract.validator';
import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
  RABBITMQ_TOPOLOGY,
} from '../messaging.constants';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

export interface PublishCheckoutCompletedInput {
  bookingReference: string;
  roomNumber: string;
}

export type CheckoutCompletedPublishResult =
  | {
      status: 'PUBLISHED';
      eventId: string;
    }
  | {
      status: 'SKIPPED_DISABLED';
      eventId: string;
    }
  | {
      status: 'FAILED';
      eventId: string;
    };

@Injectable()
export class CheckoutCompletedPublisher {
  private readonly logger = new Logger(CheckoutCompletedPublisher.name);

  constructor(private readonly rabbitMqService: RabbitMqService) {}

  async publishCheckoutCompleted(
    input: PublishCheckoutCompletedInput,
  ): Promise<CheckoutCompletedPublishResult> {
    const event = this.createEvent(input);

    if (!this.rabbitMqService.isEnabled()) {
      this.logger.debug(
        `RabbitMQ disabled; checkout event ${event.eventId} was not published`,
      );

      return {
        status: 'SKIPPED_DISABLED',
        eventId: event.eventId,
      };
    }

    try {
      await this.rabbitMqService.publishJson(
        RABBITMQ_TOPOLOGY.routingKeys.checkoutCompleted,
        event,
        {
          messageId: event.eventId,
          type: event.eventType,
          headers: {
            eventVersion: event.eventVersion,
            source: event.source,
          },
        },
      );

      return {
        status: 'PUBLISHED',
        eventId: event.eventId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to publish checkout event ${event.eventId}: ${this.errorMessage(
          error,
        )}`,
      );

      /*
       * The hotel checkout database transaction has already
       * committed before this publisher is called.
       *
       * Therefore RabbitMQ failure must not incorrectly report
       * that the guest is still checked in.
       *
       * A deterministic eventId makes a later retry safe.
       */
      return {
        status: 'FAILED',
        eventId: event.eventId,
      };
    }
  }

  private createEvent(
    input: PublishCheckoutCompletedInput,
  ): CheckoutCompletedEvent {
    const event: CheckoutCompletedEvent = {
      eventId: `checkout:${input.bookingReference}`,
      eventType: MESSAGE_EVENT_TYPES.checkoutCompleted,
      eventVersion: MESSAGE_EVENT_VERSIONS.checkoutCompleted,
      occurredAt: new Date().toISOString(),
      source: MESSAGE_SOURCES.frontDesk,
      data: {
        bookingReference: input.bookingReference,
        roomNumber: input.roomNumber,
        taskCategory: 'ROOM_CLEANING',
        priority: 'HIGH',
        sourceType: 'CHECKOUT_TRIGGER',
      },
    };

    return validateCheckoutCompletedEvent(event);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
