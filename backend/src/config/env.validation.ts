import * as Joi from 'joi';
import { RABBITMQ_TOPOLOGY } from '../messaging/messaging.constants';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string()
    .uri({
      scheme: ['postgres', 'postgresql'],
    })
    .optional(),

  DB_HOST: Joi.string().optional(),

  DB_PORT: Joi.number().port().default(5432),

  DB_USERNAME: Joi.string().optional(),

  DB_PASSWORD: Joi.string().optional(),

  DB_NAME: Joi.string().optional(),

  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(true),

  DB_SYNCHRONIZE: Joi.boolean().truthy('true').falsy('false').default(false),

  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  JWT_SECRET: Joi.string().min(32).optional(),

  JWT_ISSUER: Joi.string().trim().min(3).max(100).default('forever-hotel-auth'),

  RABBITMQ_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),

  RABBITMQ_URL: Joi.string()
    .uri({
      scheme: ['amqp', 'amqps'],
    })
    .optional(),

  RABBITMQ_EXCHANGE: Joi.string()
    .trim()
    .min(1)
    .default(RABBITMQ_TOPOLOGY.defaultExchange),

  RABBITMQ_PREFETCH: Joi.number().integer().min(1).max(100).default(10),

  RABBITMQ_MAX_RETRIES: Joi.number().integer().min(0).max(10).default(3),

  RABBITMQ_RETRY_DELAY_MS: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(5000),

  WKMS_INTEGRATION_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  WKMS_BASE_URL: Joi.string()
    .uri({
      scheme: ['http', 'https'],
    })
    .optional(),

  WKMS_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(500)
    .max(30000)
    .default(5000),
})
  .or('DATABASE_URL', 'DB_HOST')
  .and('DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME')
  .custom((value, helpers) => {
    const deploymentRequiresJwt =
      value.NODE_ENV === 'staging' || value.NODE_ENV === 'production';

    if (deploymentRequiresJwt && !value.JWT_SECRET) {
      return helpers.error('auth.jwtSecretRequired');
    }

    if (value.RABBITMQ_ENABLED === true && !value.RABBITMQ_URL) {
      return helpers.error('rabbitmq.urlRequired');
    }

    if (value.WKMS_INTEGRATION_ENABLED === true && !value.WKMS_BASE_URL) {
      return helpers.error('wkms.urlRequired');
    }

    return value;
  })
  .messages({
    'auth.jwtSecretRequired':
      '"JWT_SECRET" is required in staging and production',

    'rabbitmq.urlRequired':
      '"RABBITMQ_URL" is required when "RABBITMQ_ENABLED" is true',

    'wkms.urlRequired':
      '"WKMS_BASE_URL" is required when "WKMS_INTEGRATION_ENABLED" is true',
  });
