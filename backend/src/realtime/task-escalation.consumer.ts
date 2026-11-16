import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import {
  MessageContractValidationError,
  validateTaskEscalatedEvent,
} from '../messaging/contracts/message-contract.validator';
import { RABBITMQ_TOPOLOGY } from '../messaging/messaging.constants';
import { RabbitMqService } from '../messaging/rabbitmq/rabbitmq.service';
import { RealtimePublisherService } from './realtime-publisher.service';

@Injectable()
export class TaskEscalationConsumer implements OnModuleInit {
  private readonly logger = new Logger(TaskEscalationConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly realtimePublisherService: RealtimePublisherService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.rabbitMqService.isEnabled()) {
      this.logger.log(
        'Task escalation consumer is inactive because RabbitMQ is disabled',
      );

      return;
    }

    const consumerTag = await this.rabbitMqService.consume(
      RABBITMQ_TOPOLOGY.queues.taskEscalation,
      async (message) => {
        await this.handleMessage(message);
      },
    );

    this.logger.log(
      `Listening for task escalations using consumer ${consumerTag}`,
    );
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    try {
      const rawPayload = message.content.toString('utf8');

      const parsedPayload: unknown = JSON.parse(rawPayload);

      const event = validateTaskEscalatedEvent(parsedPayload);

      this.realtimePublisherService.publishTaskEscalated(event);

      this.rabbitMqService.ack(message);
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        error instanceof MessageContractValidationError
      ) {
        this.logger.warn(
          `Rejected invalid task escalation message: ${this.errorMessage(
            error,
          )}`,
        );
      } else {
        this.logger.error(
          `Failed to process task escalation message: ${this.errorMessage(
            error,
          )}`,
        );
      }

      /*
       * requeue=false:
       * the durable task-escalation queue already has the Plan 13 DLX
       * configuration, therefore rejected poison messages are routed to
       * the dead-letter flow instead of looping forever.
       */
      this.rabbitMqService.nack(message, false);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
