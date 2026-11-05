import { envValidationSchema } from './env.validation';
describe('Gateway authentication configuration', () => {
  it('uses a gateway session endpoint without a local signing secret', () => {
    const { error, value } = envValidationSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:password@localhost/hotel',
    });
    expect(error).toBeUndefined();
    expect(value.AUTH_SERVICE_URL).toBe('http://localhost:8080');
  });
  it('rejects non-HTTP gateway URLs', () => {
    expect(
      envValidationSchema.validate({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:password@localhost/hotel',
        AUTH_SERVICE_URL: 'file:///tmp/auth',
      }).error,
    ).toBeDefined();
  });
});
