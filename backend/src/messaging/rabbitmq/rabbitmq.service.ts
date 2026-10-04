import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { connect } from 'amqplib';
import type {
  Channel,
  ChannelModel,
  ConfirmChannel,
  ConsumeMessage,
  Options,
} from 'amqplib';
import { RABBITMQ_TOPOLOGY } from '../messaging.constants';
import { RABBITMQ_CONFIG } from './rabbitmq.config';
import type { RabbitMqRuntimeConfig } from './rabbitmq.config';

export interface RabbitMqPublishOptions {
  messageId?: string;
  type?: string;
  headers?: Record<string, unknown>;
}

@Injectable()
export class RabbitMqService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqService.name);

  private connection: ChannelModel | null = null;
  private publisherChannel: ConfirmChannel | null = null;
  private consumerChannel: Channel | null = null;

  private connectionPromise: Promise<void> | null = null;
  private shuttingDown = false;

  constructor(
    @Inject(RABBITMQ_CONFIG)
    private readonly config: RabbitMqRuntimeConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log(
        'RabbitMQ messaging is disabled for the current environment',
      );
      return;
    }

    await this.ensureConnected();
  }

  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;

    await this.close();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getExchangeName(): string {
    return this.config.exchange;
  }

  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  getRetryDelayMs(): number {
    return this.config.retryDelayMs;
  }

  async publishJson(
    routingKey: string,
    payload: unknown,
    options: RabbitMqPublishOptions = {},
  ): Promise<void> {
    const channel = await this.getPublisherChannel();

    const body = Buffer.from(JSON.stringify(payload), 'utf8');

    const publishOptions: Options.Publish = {
      persistent: true,
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      timestamp: Date.now(),
      messageId: options.messageId,
      type: options.type,
      headers: options.headers,
    };

    channel.publish(this.config.exchange, routingKey, body, publishOptions);

    await channel.waitForConfirms();
  }

  async consume(
    queue: string,
    handler: (message: ConsumeMessage) => Promise<void> | void,
  ): Promise<string> {
    const channel = await this.getConsumerChannel();

    const result = await channel.consume(
      queue,
      (message) => {
        if (!message) {
          return;
        }

        void Promise.resolve(handler(message)).catch((error: unknown) => {
          this.logger.error(
            `Unhandled RabbitMQ consumer callback error for queue ${queue}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
      },
      {
        noAck: false,
      },
    );

    return result.consumerTag;
  }

  ack(message: ConsumeMessage): void {
    if (!this.consumerChannel) {
      throw new Error('RabbitMQ consumer channel is not initialized');
    }

    this.consumerChannel.ack(message);
  }

  nack(message: ConsumeMessage, requeue = false): void {
    if (!this.consumerChannel) {
      throw new Error('RabbitMQ consumer channel is not initialized');
    }

    this.consumerChannel.nack(message, false, requeue);
  }

  async close(): Promise<void> {
    const consumerChannel = this.consumerChannel;
    const publisherChannel = this.publisherChannel;
    const connection = this.connection;

    this.consumerChannel = null;
    this.publisherChannel = null;
    this.connection = null;
    this.connectionPromise = null;

    if (consumerChannel) {
      try {
        await consumerChannel.close();
      } catch (error) {
        this.logger.warn(
          `Failed to close RabbitMQ consumer channel cleanly: ${this.errorMessage(
            error,
          )}`,
        );
      }
    }

    if (publisherChannel) {
      try {
        await publisherChannel.close();
      } catch (error) {
        this.logger.warn(
          `Failed to close RabbitMQ publisher channel cleanly: ${this.errorMessage(
            error,
          )}`,
        );
      }
    }

    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        this.logger.warn(
          `Failed to close RabbitMQ connection cleanly: ${this.errorMessage(
            error,
          )}`,
        );
      }
    }
  }

  private async getPublisherChannel(): Promise<ConfirmChannel> {
    this.assertMessagingEnabled();

    await this.ensureConnected();

    if (!this.publisherChannel) {
      throw new Error('RabbitMQ publisher channel is not available');
    }

    return this.publisherChannel;
  }

  private async getConsumerChannel(): Promise<Channel> {
    this.assertMessagingEnabled();

    await this.ensureConnected();

    if (!this.consumerChannel) {
      throw new Error('RabbitMQ consumer channel is not available');
    }

    return this.consumerChannel;
  }

  private async ensureConnected(): Promise<void> {
    this.assertMessagingEnabled();

    if (this.connection && this.publisherChannel && this.consumerChannel) {
      return;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    this.connectionPromise = this.connectAndInitialize();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async connectAndInitialize(): Promise<void> {
    if (!this.config.url) {
      throw new Error(
        'RabbitMQ URL is not configured while messaging is enabled',
      );
    }

    const connection = await connect(this.config.url);

    connection.on('error', (error: Error) => {
      this.logger.error(
        `RabbitMQ connection error: ${error.message}`,
        error.stack,
      );
    });

    connection.on('close', () => {
      this.connection = null;
      this.publisherChannel = null;
      this.consumerChannel = null;

      if (!this.shuttingDown) {
        this.logger.warn('RabbitMQ connection closed unexpectedly');
      }
    });

    try {
      const publisherChannel = await connection.createConfirmChannel();

      const consumerChannel = await connection.createChannel();

      await this.assertTopology(publisherChannel);

      await consumerChannel.prefetch(this.config.prefetch);

      this.connection = connection;
      this.publisherChannel = publisherChannel;
      this.consumerChannel = consumerChannel;

      this.logger.log(
        `RabbitMQ connected using durable exchange ${this.config.exchange}`,
      );
    } catch (error) {
      try {
        await connection.close();
      } catch {
        // Preserve the original initialization error.
      }

      throw error;
    }
  }

  private async assertTopology(channel: Channel): Promise<void> {
    await channel.assertExchange(this.config.exchange, 'topic', {
      durable: true,
    });

    await channel.assertQueue(RABBITMQ_TOPOLOGY.queues.taskEscalation, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.config.exchange,
        'x-dead-letter-routing-key':
          RABBITMQ_TOPOLOGY.routingKeys.taskEscalationDeadLetter,
      },
    });

    await channel.bindQueue(
      RABBITMQ_TOPOLOGY.queues.taskEscalation,
      this.config.exchange,
      RABBITMQ_TOPOLOGY.routingKeys.taskEscalated,
    );

    await channel.assertQueue(RABBITMQ_TOPOLOGY.queues.taskEscalationRetry, {
      durable: true,
      arguments: {
        'x-message-ttl': this.config.retryDelayMs,
        'x-dead-letter-exchange': this.config.exchange,
        'x-dead-letter-routing-key':
          RABBITMQ_TOPOLOGY.routingKeys.taskEscalated,
      },
    });

    await channel.bindQueue(
      RABBITMQ_TOPOLOGY.queues.taskEscalationRetry,
      this.config.exchange,
      RABBITMQ_TOPOLOGY.routingKeys.taskEscalationRetry,
    );

    await channel.assertQueue(
      RABBITMQ_TOPOLOGY.queues.taskEscalationDeadLetter,
      {
        durable: true,
      },
    );

    await channel.bindQueue(
      RABBITMQ_TOPOLOGY.queues.taskEscalationDeadLetter,
      this.config.exchange,
      RABBITMQ_TOPOLOGY.routingKeys.taskEscalationDeadLetter,
    );
  }

  private assertMessagingEnabled(): void {
    if (!this.config.enabled) {
      throw new Error(
        'RabbitMQ messaging is disabled for the current environment',
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
