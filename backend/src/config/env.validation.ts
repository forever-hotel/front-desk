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
  FDS_ALLOWED_ORIGINS: Joi.string().trim().optional(),

  DB_USERNAME: Joi.string().optional(),

  DB_PASSWORD: Joi.string().optional(),

  DB_NAME: Joi.string().optional(),

  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(true),

  DB_SYNCHRONIZE: Joi.boolean().truthy('true').falsy('false').default(false),

  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  // Central Auth contract is proposed; opt in only after the auth team agrees.
  FDS_AUTH_PROVIDER: Joi.string().valid('legacy', 'central').default('legacy'),
  CENTRAL_AUTH_ISSUER: Joi.string()
    .uri({ scheme: ['https'] })
    .optional(),
  CENTRAL_AUTH_AUDIENCE: Joi.string().valid('fds').optional(),
  CENTRAL_AUTH_JWKS_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .optional(),

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

  FOSS_QR_MODE: Joi.string()
    .valid('disabled', 'mock', 'http')
    .default('disabled'),
  FOSS_QR_ISSUE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional(),
  FOSS_QR_SERVICE_TOKEN: Joi.string().min(32).optional(),
  FOSS_QR_TIMEOUT_MS: Joi.number().integer().min(500).max(30000).default(5000),

  WKMS_INTEGRATION_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  WKMS_BASE_URL: Joi.string()
    .uri({
      scheme: ['http', 'https'],
    })
    .optional(),

  // Shared with the FOSS backend only; never included in a browser bundle.
  FDS_FOSS_BOOKING_API_KEY: Joi.string().min(32).optional(),
  // Checkout cutoff is policy dependent; explicit value required when service enabled in staging/prod.
  FDS_FOSS_CHECKOUT_TIME_LOCAL: Joi.string()
    .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  // Trusted backend-to-backend credential used by WKMS DDP-198.
  FDS_WKMS_SERVICE_TOKEN: Joi.string().min(32).optional(),

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

    if (
      deploymentRequiresJwt &&
      value.FDS_AUTH_PROVIDER === 'legacy' &&
      !value.JWT_SECRET
    ) {
      return helpers.error('auth.jwtSecretRequired');
    }
    if (value.FDS_AUTH_PROVIDER === 'central') {
      const missing = [
        'CENTRAL_AUTH_ISSUER',
        'CENTRAL_AUTH_AUDIENCE',
        'CENTRAL_AUTH_JWKS_URL',
      ].find((name) => !value[name]);

      if (missing) {
        return helpers.message({
          custom: `${missing} is required when FDS_AUTH_PROVIDER is central`,
        });
      }
    }

    if (
      deploymentRequiresJwt &&
      value.FDS_FOSS_BOOKING_API_KEY &&
      !value.FDS_FOSS_CHECKOUT_TIME_LOCAL
    ) {
      return helpers.message({
        custom:
          'FDS_FOSS_CHECKOUT_TIME_LOCAL is required with FOSS booking integration in staging/production',
      });
    }
    if (deploymentRequiresJwt && value.DB_SYNCHRONIZE === true) {
      return helpers.message({
        custom: 'DB_SYNCHRONIZE must be false in staging and production',
      });
    }

    const origins = value.FDS_ALLOWED_ORIGINS
      ? String(value.FDS_ALLOWED_ORIGINS)
          .split(',')
          .map((origin) => origin.trim())
      : [];

    if (deploymentRequiresJwt && origins.length === 0) {
      return helpers.message({
        custom: 'FDS_ALLOWED_ORIGINS is required in staging and production',
      });
    }

    const invalidOrigin = origins.some((origin) => {
      try {
        const parsed = new URL(origin);

        return (
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.origin !== origin
        );
      } catch {
        return true;
      }
    });

    if (invalidOrigin) {
      return helpers.message({
        custom: 'FDS_ALLOWED_ORIGINS contains an invalid origin',
      });
    }

    if (value.RABBITMQ_ENABLED === true && !value.RABBITMQ_URL) {
      return helpers.error('rabbitmq.urlRequired');
    }

    if (value.WKMS_INTEGRATION_ENABLED === true && !value.WKMS_BASE_URL) {
      return helpers.error('wkms.urlRequired');
    }

    if (
      value.FOSS_QR_MODE === 'http' &&
      (!value.FOSS_QR_ISSUE_URL || !value.FOSS_QR_SERVICE_TOKEN)
    ) {
      return helpers.message({
        custom:
          'FOSS QR HTTP mode requires FOSS_QR_ISSUE_URL and FOSS_QR_SERVICE_TOKEN',
      });
    }
    if (deploymentRequiresJwt && value.FOSS_QR_MODE === 'mock') {
      return helpers.message({
        custom: 'QR mock mode is forbidden in staging/production',
      });
    }
    if (
      deploymentRequiresJwt &&
      value.FOSS_QR_MODE === 'http' &&
      !value.FOSS_QR_ISSUE_URL.startsWith('https://')
    ) {
      return helpers.message({
        custom: 'FOSS_QR_ISSUE_URL must use HTTPS in staging/production',
      });
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
