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

  // Registered handlers survive transport loss and can be attached to a new channel.
  private readonly subscriptions = new Map<
    string,
    (message: ConsumeMessage) => Promise<void> | void
  >();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

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
    // Keep only one handler per queue. Multiple consumers of the same queue
    // would compete for deliveries and make reconnect behavior unpredictable.
    if (this.subscriptions.has(queue)) {
      throw new Error(`RabbitMQ queue ${queue} is already subscribed`);
    }

    const channel = await this.getConsumerChannel();
    const consumerTag = await this.subscribeToQueue(channel, queue, handler);

    // Register only after RabbitMQ confirmed the original subscription.
    this.subscriptions.set(queue, handler);
    return consumerTag;
  }

  private async subscribeToQueue(
    channel: Channel,
    queue: string,
    handler: (message: ConsumeMessage) => Promise<void> | void,
  ): Promise<string> {
    const result = await channel.consume(
      queue,
      (message) => {
        if (!message) return;
        void Promise.resolve(handler(message)).catch((error: unknown) => {
          this.logger.error(
            `Unhandled RabbitMQ consumer callback error for queue ${queue}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
      },
      { noAck: false },
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
    this.cancelReconnectTimer();
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
      // Ignore delayed close notifications from an older connection.
      if (this.connection !== connection) return;
      this.connection = null;
      this.publisherChannel = null;
      this.consumerChannel = null;

      if (!this.shuttingDown) {
        this.logger.warn('RabbitMQ connection closed unexpectedly');
        this.scheduleReconnect();
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

      // A new connection does NOT preserve the old channel's consumers.
      // Restore subscriptions before advertising recovery as successful.
      await this.restoreSubscriptions(consumerChannel);
      this.reconnectAttempt = 0;
      this.cancelReconnectTimer();

      this.logger.log(
        `RabbitMQ connected using durable exchange ${this.config.exchange}`,
      );
    } catch (error) {
      if (this.connection === connection) {
        this.connection = null;
        this.publisherChannel = null;
        this.consumerChannel = null;
      }
      try {
        await connection.close();
      } catch {
        // Preserve the original initialization error.
      }

      throw error;
    }
  }

  private async restoreSubscriptions(channel: Channel): Promise<void> {
    for (const [queue, handler] of this.subscriptions) {
      const tag = await this.subscribeToQueue(channel, queue, handler);
      this.logger.log(`RabbitMQ consumer restored for ${queue}: ${tag}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown || this.connection || this.reconnectTimer) return;

    // Bounded exponential backoff: 1s, 2s, 4s, then at most 8s.
    const delayMs = Math.min(
      1000 * 2 ** Math.min(this.reconnectAttempt, 3),
      8000,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shuttingDown || this.connection) return;
      void this.ensureConnected().catch((error: unknown) => {
        if (this.shuttingDown) return;
        this.logger.warn(
          `RabbitMQ reconnect failed: ${this.errorMessage(error)}`,
        );
        this.scheduleReconnect();
      });
    }, delayMs);
    this.reconnectTimer.unref?.();
  }

  private cancelReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
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
