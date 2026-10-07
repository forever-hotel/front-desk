import { envValidationSchema } from './env.validation';

describe('Environment validation', () => {
  it('should accept a valid DATABASE_URL configuration', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
    });

    expect(error).toBeUndefined();
  });

  it('should accept valid DB_* configuration when DATABASE_URL is absent', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      PORT: 3000,
      DB_HOST: 'example.com',
      DB_PORT: 5432,
      DB_USERNAME: 'user',
      DB_PASSWORD: 'password',
      DB_NAME: 'forever_hotel',
      DB_SSL: true,
      DB_SYNCHRONIZE: false,
      DB_LOGGING: false,
    });

    expect(error).toBeUndefined();
  });

  it('should reject configuration when no database credentials are provided', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      PORT: 3000,
    });

    expect(error).toBeDefined();
  });

  it('should allow JWT configuration to remain absent during development', () => {
    const { error, value } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
    });

    expect(error).toBeUndefined();

    expect(value.JWT_ISSUER).toBe('forever-hotel-auth');
  });

  it('should allow JWT configuration to remain absent during tests', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
    });

    expect(error).toBeUndefined();
  });

  it('should require JWT_SECRET in staging', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
    });

    expect(error).toBeDefined();

    expect(error?.message).toContain('JWT_SECRET');
  });

  it('should require JWT_SECRET in production', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
    });

    expect(error).toBeDefined();

    expect(error?.message).toContain('JWT_SECRET');
  });

  it('should reject a JWT secret shorter than 32 characters', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      JWT_SECRET: 'too-short',
    });

    expect(error).toBeDefined();
  });

  it('should accept valid production JWT configuration', () => {
    const { error, value } = envValidationSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      JWT_SECRET: 'production-test-secret-at-least-32-characters',
      JWT_ISSUER: 'forever-hotel-auth',
    });

    expect(error).toBeUndefined();

    expect(value.JWT_ISSUER).toBe('forever-hotel-auth');
  });

  it('should allow RabbitMQ to remain disabled without broker credentials', () => {
    const { error, value } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      RABBITMQ_ENABLED: false,
    });

    expect(error).toBeUndefined();
    expect(value.RABBITMQ_ENABLED).toBe(false);
  });

  it('should require RABBITMQ_URL when RabbitMQ is enabled', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      RABBITMQ_ENABLED: true,
    });

    expect(error).toBeDefined();
  });

  it('should accept valid RabbitMQ configuration', () => {
    const { error, value } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      RABBITMQ_ENABLED: true,
      RABBITMQ_URL: 'amqp://user:password@localhost:5672',
      RABBITMQ_EXCHANGE: 'forever.events',
      RABBITMQ_PREFETCH: 10,
      RABBITMQ_MAX_RETRIES: 3,
      RABBITMQ_RETRY_DELAY_MS: 5000,
    });

    expect(error).toBeUndefined();

    expect(value.RABBITMQ_ENABLED).toBe(true);

    expect(value.RABBITMQ_EXCHANGE).toBe('forever.events');

    expect(value.RABBITMQ_PREFETCH).toBe(10);

    expect(value.RABBITMQ_MAX_RETRIES).toBe(3);

    expect(value.RABBITMQ_RETRY_DELAY_MS).toBe(5000);
  });

  it('should reject a non-AMQP RabbitMQ URL', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      RABBITMQ_ENABLED: true,
      RABBITMQ_URL: 'https://example.com/rabbitmq',
    });

    expect(error).toBeDefined();
  });

  it('should reject invalid RabbitMQ retry configuration', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      RABBITMQ_ENABLED: true,
      RABBITMQ_URL: 'amqp://user:password@localhost:5672',
      RABBITMQ_MAX_RETRIES: -1,
    });

    expect(error).toBeDefined();
  });

  it('should allow WKMS integration to remain disabled without a base URL', () => {
    const { error, value } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      WKMS_INTEGRATION_ENABLED: false,
    });

    expect(error).toBeUndefined();

    expect(value.WKMS_INTEGRATION_ENABLED).toBe(false);

    expect(value.WKMS_REQUEST_TIMEOUT_MS).toBe(5000);
  });

  it('should require WKMS_BASE_URL when WKMS integration is enabled', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      WKMS_INTEGRATION_ENABLED: true,
    });

    expect(error).toBeDefined();

    expect(error?.message).toContain('WKMS_BASE_URL');
  });

  it('should accept a valid WKMS integration configuration', () => {
    const { error, value } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
      WKMS_REQUEST_TIMEOUT_MS: 7000,
    });

    expect(error).toBeUndefined();

    expect(value.WKMS_INTEGRATION_ENABLED).toBe(true);

    expect(value.WKMS_BASE_URL).toBe('http://localhost:3002');

    expect(value.WKMS_REQUEST_TIMEOUT_MS).toBe(7000);
  });

  it('should reject a non-HTTP WKMS base URL', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'amqp://localhost:5672',
    });

    expect(error).toBeDefined();
  });

  it('should reject a WKMS timeout below the minimum', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
      WKMS_REQUEST_TIMEOUT_MS: 100,
    });

    expect(error).toBeDefined();
  });

  it('should reject a WKMS timeout above the maximum', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/forever_hotel',
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'https://wkms.example.com',
      WKMS_REQUEST_TIMEOUT_MS: 30001,
    });

    expect(error).toBeDefined();
  });
});
