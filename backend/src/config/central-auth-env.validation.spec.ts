import { envValidationSchema } from './env.validation';

const databaseUrl = 'postgresql://user:password@example.com:5432/hotel';
const centralAuth = {
  FDS_AUTH_PROVIDER: 'central',
  CENTRAL_AUTH_ISSUER: 'https://auth.example.test',
  CENTRAL_AUTH_AUDIENCE: 'fds',
  CENTRAL_AUTH_JWKS_URL: 'https://auth.example.test/.well-known/jwks.json',
};

describe('Central Auth environment validation', () => {
  it('accepts configured Central Auth in staging without a local JWT secret', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'staging',
      DATABASE_URL: databaseUrl,
      FDS_ALLOWED_ORIGINS: 'https://frontdesk.example.test',
      ...centralAuth,
    });
    expect(error).toBeUndefined();
  });

  it('requires Central Auth configuration when central mode is selected', () => {
    for (const key of [
      'CENTRAL_AUTH_ISSUER',
      'CENTRAL_AUTH_AUDIENCE',
      'CENTRAL_AUTH_JWKS_URL',
    ]) {
      const values: Record<string, string | undefined> = { ...centralAuth };
      delete values[key];
      const { error } = envValidationSchema.validate({
        NODE_ENV: 'development',
        DATABASE_URL: databaseUrl,
        ...values,
      });
      expect(error?.message).toContain(key);
    }
  });

  it('rejects non-HTTPS JWKS URLs', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      ...centralAuth,
      CENTRAL_AUTH_JWKS_URL: 'http://auth.example.test/keys',
    });
    expect(error).toBeDefined();
  });

  it('rejects access-token audiences for other services', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      ...centralAuth,
      CENTRAL_AUTH_AUDIENCE: 'wkms',
    });
    expect(error).toBeDefined();
  });

  it('keeps requiring the existing JWT secret in legacy staging', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'staging',
      DATABASE_URL: databaseUrl,
      FDS_ALLOWED_ORIGINS: 'https://frontdesk.example.test',
      FDS_AUTH_PROVIDER: 'legacy',
    });
    expect(error?.message).toContain('JWT_SECRET');
  });

  it('rejects an unsupported authentication provider', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: databaseUrl,
      FDS_AUTH_PROVIDER: 'disable-auth',
    });
    expect(error).toBeDefined();
  });
});
