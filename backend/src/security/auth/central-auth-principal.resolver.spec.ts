import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { RealtimeSocketAuthService } from '../../realtime/realtime-socket-auth.service';
import { CentralAuthJwtVerifier } from './central-auth-jwt.verifier';
import { CentralAuthPrincipalResolver } from './central-auth-principal.resolver';
import { SystemRole } from './system-role';

const issuer = 'https://auth.example.test';
const userId = '66666666-6666-4666-8666-666666666666';
const kid = 'central-auth-adapter-test';

describe('Central Auth principal adapter', () => {
  let resolver: CentralAuthPrincipalResolver;
  let sign: (role?: SystemRole) => Promise<string>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    const verifier = new CentralAuthJwtVerifier(
      createLocalJWKSet({
        keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }],
      }),
      { issuer, audience: 'fds' },
    );

    resolver = new CentralAuthPrincipalResolver(verifier);

    sign = (role = SystemRole.RECEPTIONIST) =>
      new SignJWT({ role })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuer(issuer)
        .setAudience('fds')
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(privateKey);
  });

  it('resolves a valid REST Authorization Bearer token', async () => {
    const token = await sign();
    await expect(
      resolver.resolve({ headers: { authorization: `Bearer ${token}` } }),
    ).resolves.toEqual({ userId, role: SystemRole.RECEPTIONIST });
  });

  it('rejects missing and non-Bearer authorization', async () => {
    await expect(resolver.resolve({ headers: {} })).resolves.toBeNull();
    await expect(
      resolver.resolve({ headers: { authorization: 'Basic abc' } }),
    ).resolves.toBeNull();
  });

  it('rejects multiple Authorization values', async () => {
    const token = await sign();
    await expect(
      resolver.resolve({
        headers: { authorization: [`Bearer ${token}`, `Bearer ${token}`] },
      }),
    ).resolves.toBeNull();
  });

  it('rejects invalid signatures', async () => {
    await expect(
      resolver.resolve({ headers: { authorization: 'Bearer broken.token' } }),
    ).resolves.toBeNull();
  });

  it('shares the same verifier with Socket.IO authentication', async () => {
    const socketAuth = new RealtimeSocketAuthService(resolver);
    const token = await sign();
    await expect(socketAuth.authenticate(token)).resolves.toEqual({
      userId,
      role: SystemRole.RECEPTIONIST,
    });
    await expect(socketAuth.authenticate('invalid')).resolves.toBeNull();
  });
});
