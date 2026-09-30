import * as Joi from 'joi';

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
})
  .or('DATABASE_URL', 'DB_HOST')
  .and('DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME');
