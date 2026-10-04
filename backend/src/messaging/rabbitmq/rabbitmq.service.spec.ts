import type {
  Channel,
  ChannelModel,
  ConfirmChannel,
  ConsumeMessage,
} from 'amqplib';
import { RABBITMQ_TOPOLOGY } from '../messaging.constants';
import type { RabbitMqRuntimeConfig } from './rabbitmq.config';
import { RabbitMqService } from './rabbitmq.service';

type RabbitMqServiceInternals = {
  connection: ChannelModel | null;
  publisherChannel: ConfirmChannel | null;
  consumerChannel: Channel | null;
  connectionPromise: Promise<void> | null;
  shuttingDown: boolean;
  logger: {
    error(message: unknown, ...optionalParams: unknown[]): void;
  };
  ensureConnected(): Promise<void>;
  connectAndInitialize(): Promise<void>;
  assertTopology(channel: Channel): Promise<void>;
  assertMessagingEnabled(): void;
  errorMessage(error: unknown): string;
};

describe('RabbitMqService', () => {
  const enabledConfig: RabbitMqRuntimeConfig = {
    enabled: true,
    url: 'amqp://guest:guest@localhost:5672',
    exchange: 'forever.events',
    prefetch: 10,
    maxRetries: 3,
    retryDelayMs: 5000,
  };

  function createService(config: RabbitMqRuntimeConfig = enabledConfig): {
    service: RabbitMqService;
    internals: RabbitMqServiceInternals;
  } {
    const service = new RabbitMqService(config);
    const internals = service as unknown as RabbitMqServiceInternals;

    return { service, internals };
  }

  function createPublisherChannel(): jest.Mocked<ConfirmChannel> {
    return {
      publish: jest.fn().mockReturnValue(true),
      waitForConfirms: jest.fn().mockResolvedValue(undefined),
      assertExchange: jest
        .fn()
        .mockResolvedValue({ exchange: 'forever.events' }),
      assertQueue: jest.fn().mockResolvedValue({
        queue: 'queue',
        messageCount: 0,
        consumerCount: 0,
      }),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ConfirmChannel>;
  }

  function createConsumerChannel(): jest.Mocked<Channel> {
    return {
      consume: jest.fn().mockResolvedValue({ consumerTag: 'consumer-1' }),
      prefetch: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Channel>;
  }

  function createConnection(): jest.Mocked<ChannelModel> {
    return {
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ChannelModel>;
  }

  function attachConnectedState(internals: RabbitMqServiceInternals): {
    publisherChannel: jest.Mocked<ConfirmChannel>;
    consumerChannel: jest.Mocked<Channel>;
    connection: jest.Mocked<ChannelModel>;
  } {
    const publisherChannel = createPublisherChannel();
    const consumerChannel = createConsumerChannel();
    const connection = createConnection();

    internals.publisherChannel = publisherChannel;
    internals.consumerChannel = consumerChannel;
    internals.connection = connection;

    return { publisherChannel, consumerChannel, connection };
  }

  it('exposes runtime configuration values', () => {
    const { service } = createService();

    expect(service.isEnabled()).toBe(true);
    expect(service.getExchangeName()).toBe('forever.events');
    expect(service.getMaxRetries()).toBe(3);
    expect(service.getRetryDelayMs()).toBe(5000);
  });

  it('connects on module init when messaging is enabled', async () => {
    const { service, internals } = createService();
    const ensureConnected = jest
      .spyOn(internals, 'ensureConnected')
      .mockResolvedValue(undefined);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(ensureConnected).toHaveBeenCalledTimes(1);
  });

  it('does not connect on module init when messaging is disabled', async () => {
    const { service } = createService({
      ...enabledConfig,
      enabled: false,
      url: null,
    });

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(service.isEnabled()).toBe(false);
  });

  it('rejects publishing and consuming when messaging is disabled', async () => {
    const { service } = createService({
      ...enabledConfig,
      enabled: false,
      url: null,
    });

    await expect(service.publishJson('route', { ok: true })).rejects.toThrow(
      'RabbitMQ messaging is disabled for the current environment',
    );

    await expect(service.consume('queue', jest.fn())).rejects.toThrow(
      'RabbitMQ messaging is disabled for the current environment',
    );
  });

  it('publishes JSON through the configured exchange and waits for confirms', async () => {
    const { service, internals } = createService();
    const { publisherChannel } = attachConnectedState(internals);

    await service.publishJson(
      RABBITMQ_TOPOLOGY.routingKeys.checkoutCompleted,
      { bookingReference: 'booking-1' },
      {
        messageId: 'event-1',
        type: 'checkout.completed',
        headers: { eventVersion: 1 },
      },
    );

    expect(publisherChannel.publish).toHaveBeenCalledTimes(1);

    const [exchange, routingKey, body, options] =
      publisherChannel.publish.mock.calls[0];

    expect(exchange).toBe('forever.events');
    expect(routingKey).toBe(RABBITMQ_TOPOLOGY.routingKeys.checkoutCompleted);
    expect(body.toString('utf8')).toBe(
      JSON.stringify({ bookingReference: 'booking-1' }),
    );
    expect(options).toEqual(
      expect.objectContaining({
        persistent: true,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        timestamp: expect.any(Number),
        messageId: 'event-1',
        type: 'checkout.completed',
        headers: { eventVersion: 1 },
      }),
    );
    expect(publisherChannel.waitForConfirms).toHaveBeenCalledTimes(1);
  });

  it('consumes with manual acknowledgement and invokes the handler', async () => {
    const { service, internals } = createService();
    const { consumerChannel } = attachConnectedState(internals);
    const handler = jest.fn().mockResolvedValue(undefined);

    const consumerTag = await service.consume(
      RABBITMQ_TOPOLOGY.queues.taskEscalation,
      handler,
    );

    expect(consumerTag).toBe('consumer-1');
    expect(consumerChannel.consume).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.queues.taskEscalation,
      expect.any(Function),
      { noAck: false },
    );

    const callback = consumerChannel.consume.mock.calls[0][1];
    callback(null);

    const message = {
      content: Buffer.from('{}'),
    } as ConsumeMessage;

    callback(message);
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith(message);
  });

  it('logs rejected consumer handlers for Error and non-Error failures', async () => {
    const { service, internals } = createService();
    const { consumerChannel } = attachConnectedState(internals);
    const errorSpy = jest
      .spyOn(internals.logger, 'error')
      .mockImplementation(() => undefined);
    const handler = jest
      .fn()
      .mockRejectedValueOnce(new Error('handler failed'))
      .mockRejectedValueOnce('plain failure');

    await service.consume(RABBITMQ_TOPOLOGY.queues.taskEscalation, handler);

    const callback = consumerChannel.consume.mock.calls[0][1];
    const message = { content: Buffer.from('{}') } as ConsumeMessage;

    callback(message);
    callback(message);

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Unhandled RabbitMQ consumer callback error'),
      expect.stringContaining('handler failed'),
    );
    expect(errorSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('Unhandled RabbitMQ consumer callback error'),
      'plain failure',
    );
  });

  it('acknowledges and negatively acknowledges messages through the consumer channel', () => {
    const { service, internals } = createService();
    const { consumerChannel } = attachConnectedState(internals);
    const message = { content: Buffer.from('{}') } as ConsumeMessage;

    service.ack(message);
    service.nack(message);
    service.nack(message, true);

    expect(consumerChannel.ack).toHaveBeenCalledWith(message);
    expect(consumerChannel.nack).toHaveBeenNthCalledWith(
      1,
      message,
      false,
      false,
    );
    expect(consumerChannel.nack).toHaveBeenNthCalledWith(
      2,
      message,
      false,
      true,
    );
  });

  it('rejects ack and nack before the consumer channel is initialized', () => {
    const { service } = createService();
    const message = { content: Buffer.from('{}') } as ConsumeMessage;

    expect(() => service.ack(message)).toThrow(
      'RabbitMQ consumer channel is not initialized',
    );
    expect(() => service.nack(message)).toThrow(
      'RabbitMQ consumer channel is not initialized',
    );
  });

  it('asserts the durable exchange, retry queue, and dead-letter topology', async () => {
    const { internals } = createService();
    const channel = createPublisherChannel();

    await internals.assertTopology(channel);

    expect(channel.assertExchange).toHaveBeenCalledWith(
      'forever.events',
      'topic',
      { durable: true },
    );

    expect(channel.assertQueue).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.queues.taskEscalation,
      {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'forever.events',
          'x-dead-letter-routing-key':
            RABBITMQ_TOPOLOGY.routingKeys.taskEscalationDeadLetter,
        },
      },
    );

    expect(channel.assertQueue).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.queues.taskEscalationRetry,
      {
        durable: true,
        arguments: {
          'x-message-ttl': 5000,
          'x-dead-letter-exchange': 'forever.events',
          'x-dead-letter-routing-key':
            RABBITMQ_TOPOLOGY.routingKeys.taskEscalated,
        },
      },
    );

    expect(channel.assertQueue).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.queues.taskEscalationDeadLetter,
      { durable: true },
    );

    expect(channel.bindQueue).toHaveBeenCalledTimes(3);
    expect(channel.bindQueue).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.queues.taskEscalation,
      'forever.events',
      RABBITMQ_TOPOLOGY.routingKeys.taskEscalated,
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.queues.taskEscalationRetry,
      'forever.events',
      RABBITMQ_TOPOLOGY.routingKeys.taskEscalationRetry,
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.queues.taskEscalationDeadLetter,
      'forever.events',
      RABBITMQ_TOPOLOGY.routingKeys.taskEscalationDeadLetter,
    );
  });

  it('starts a fresh connection attempt and clears the shared promise afterward', async () => {
    const { internals } = createService();
    const connectAndInitialize = jest
      .spyOn(internals, 'connectAndInitialize')
      .mockResolvedValue(undefined);

    await expect(internals.ensureConnected()).resolves.toBeUndefined();

    expect(connectAndInitialize).toHaveBeenCalledTimes(1);
    expect(internals.connectionPromise).toBeNull();
  });

  it('clears the shared connection promise when initialization fails', async () => {
    const { internals } = createService();
    jest
      .spyOn(internals, 'connectAndInitialize')
      .mockRejectedValue(new Error('initialization failed'));

    await expect(internals.ensureConnected()).rejects.toThrow(
      'initialization failed',
    );

    expect(internals.connectionPromise).toBeNull();
  });

  it('rejects initialization when messaging is enabled without a RabbitMQ URL', async () => {
    const { internals } = createService({
      ...enabledConfig,
      url: null,
    });

    await expect(internals.connectAndInitialize()).rejects.toThrow(
      'RabbitMQ URL is not configured while messaging is enabled',
    );
  });

  it('reuses an already initialized connection state', async () => {
    const { internals } = createService();
    attachConnectedState(internals);

    await expect(internals.ensureConnected()).resolves.toBeUndefined();
  });

  it('waits for an existing connection attempt instead of starting another one', async () => {
    const { internals } = createService();
    internals.connectionPromise = Promise.resolve();

    await expect(internals.ensureConnected()).resolves.toBeUndefined();
  });

  it('reports unavailable channels after an existing connection promise completes without them', async () => {
    const { service, internals } = createService();
    internals.connectionPromise = Promise.resolve();

    await expect(service.publishJson('route', {})).rejects.toThrow(
      'RabbitMQ publisher channel is not available',
    );

    internals.connectionPromise = Promise.resolve();

    await expect(service.consume('queue', jest.fn())).rejects.toThrow(
      'RabbitMQ consumer channel is not available',
    );
  });

  it('closes cleanly when no RabbitMQ resources were initialized', async () => {
    const { service, internals } = createService();

    await expect(service.close()).resolves.toBeUndefined();

    expect(internals.consumerChannel).toBeNull();
    expect(internals.publisherChannel).toBeNull();
    expect(internals.connection).toBeNull();
    expect(internals.connectionPromise).toBeNull();
  });

  it('closes both channels and the connection and clears internal state', async () => {
    const { service, internals } = createService();
    const { publisherChannel, consumerChannel, connection } =
      attachConnectedState(internals);

    await service.close();

    expect(consumerChannel.close).toHaveBeenCalledTimes(1);
    expect(publisherChannel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
    expect(internals.consumerChannel).toBeNull();
    expect(internals.publisherChannel).toBeNull();
    expect(internals.connection).toBeNull();
    expect(internals.connectionPromise).toBeNull();
  });

  it('swallows cleanup errors so shutdown can continue', async () => {
    const { service, internals } = createService();
    const { publisherChannel, consumerChannel, connection } =
      attachConnectedState(internals);

    consumerChannel.close.mockRejectedValue(new Error('consumer close failed'));
    publisherChannel.close.mockRejectedValue('publisher close failed');
    connection.close.mockRejectedValue(new Error('connection close failed'));

    await expect(service.close()).resolves.toBeUndefined();
  });

  it('marks shutdown and closes resources during application shutdown', async () => {
    const { service, internals } = createService();
    const { publisherChannel, consumerChannel, connection } =
      attachConnectedState(internals);

    await service.onApplicationShutdown();

    expect(internals.shuttingDown).toBe(true);
    expect(consumerChannel.close).toHaveBeenCalledTimes(1);
    expect(publisherChannel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('formats Error and non-Error values for log messages', () => {
    const { internals } = createService();

    expect(internals.errorMessage(new Error('boom'))).toBe('boom');
    expect(internals.errorMessage('boom')).toBe('boom');
  });
});
