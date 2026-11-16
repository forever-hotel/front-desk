import { ConfigService } from '@nestjs/config';
import { JwtPrincipalResolver } from './jwt-principal.resolver';
const session = {
  sub: '66666666-6666-4666-8666-666666666666',
  username: 'staff',
  role: 'RECEPTIONIST',
  roles: ['RECEPTIONIST'],
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  passwordChangeRequired: false,
};
describe('Gateway-backed FDS principal', () => {
  const resolver = new JwtPrincipalResolver(
    new ConfigService({ AUTH_SERVICE_URL: 'http://gateway' }),
  );
  afterEach(() => jest.restoreAllMocks());
  it('requires a bearer token', async () => {
    expect(await resolver.resolve({ headers: {} })).toBeNull();
  });
  it.each(['RECEPTIONIST', 'ROOT'])(
    'accepts effective %s permission',
    async (role) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(Response.json({ ...session, role }));
      expect(
        await resolver.resolve({ headers: { authorization: 'Bearer token' } }),
      ).toEqual({ userId: session.sub, role });
    },
  );
  it.each([401, 403])('rejects gateway status %s', async (status) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({}, { status }));
    expect(
      await resolver.resolve({ headers: { authorization: 'Bearer token' } }),
    ).toBeNull();
  });
  it('blocks initial-password sessions', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ ...session, passwordChangeRequired: true }),
      );
    expect(
      await resolver.resolve({ headers: { authorization: 'Bearer token' } }),
    ).toBeNull();
  });
  it('fails closed on gateway outage', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(
      resolver.resolve({ headers: { authorization: 'Bearer token' } }),
    ).rejects.toThrow('Staff authentication is unavailable');
  });
});
