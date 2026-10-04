import { ConfigService } from '@nestjs/config';
import { RABBITMQ_TOPOLOGY } from '../messaging.constants';
import { createRabbitMqConfig } from './rabbitmq.config';

describe('createRabbitMqConfig', () => {
  function createConfigService(values: Record<string, unknown>): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  it('returns safe defaults when RabbitMQ is not configured', () => {
    const config = createRabbitMqConfig(createConfigService({}));

    expect(config).toEqual({
      enabled: false,
      url: null,
      exchange: RABBITMQ_TOPOLOGY.defaultExchange,
      prefetch: 10,
      maxRetries: 3,
      retryDelayMs: 5000,
    });
  });

  it('maps configured RabbitMQ values', () => {
    const config = createRabbitMqConfig(
      createConfigService({
        RABBITMQ_ENABLED: true,
        RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
        RABBITMQ_EXCHANGE: 'custom.events',
        RABBITMQ_PREFETCH: 20,
        RABBITMQ_MAX_RETRIES: 5,
        RABBITMQ_RETRY_DELAY_MS: 9000,
      }),
    );

    expect(config).toEqual({
      enabled: true,
      url: 'amqp://guest:guest@localhost:5672',
      exchange: 'custom.events',
      prefetch: 20,
      maxRetries: 5,
      retryDelayMs: 9000,
    });
  });

  it('requires a URL when RabbitMQ is enabled', () => {
    expect(() =>
      createRabbitMqConfig(
        createConfigService({
          RABBITMQ_ENABLED: true,
        }),
      ),
    ).toThrow('RABBITMQ_URL is required when RABBITMQ_ENABLED is true');
  });
});
