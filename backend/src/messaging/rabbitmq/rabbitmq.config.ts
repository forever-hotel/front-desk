import { ConfigService } from '@nestjs/config';
import { RABBITMQ_TOPOLOGY } from '../messaging.constants';

export const RABBITMQ_CONFIG = Symbol('RABBITMQ_CONFIG');

export interface RabbitMqRuntimeConfig {
  enabled: boolean;
  url: string | null;
  exchange: string;
  prefetch: number;
  maxRetries: number;
  retryDelayMs: number;
}

export function createRabbitMqConfig(
  configService: ConfigService,
): RabbitMqRuntimeConfig {
  const enabled = configService.get<boolean>('RABBITMQ_ENABLED') ?? false;

  const url = configService.get<string>('RABBITMQ_URL') ?? null;

  if (enabled && !url) {
    throw new Error('RABBITMQ_URL is required when RABBITMQ_ENABLED is true');
  }

  return {
    enabled,
    url,
    exchange:
      configService.get<string>('RABBITMQ_EXCHANGE') ??
      RABBITMQ_TOPOLOGY.defaultExchange,
    prefetch: configService.get<number>('RABBITMQ_PREFETCH') ?? 10,
    maxRetries: configService.get<number>('RABBITMQ_MAX_RETRIES') ?? 3,
    retryDelayMs: configService.get<number>('RABBITMQ_RETRY_DELAY_MS') ?? 5000,
  };
}
