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
});
