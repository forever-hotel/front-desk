import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { CentralAuthJwtVerifier } from './central-auth-jwt.verifier';
import { SystemRole } from './system-role';

const issuer = 'https://auth.example.test';
const audience = 'fds';
const userId = '66666666-6666-4666-8666-666666666666';
const keyId = 'central-auth-test-key';

describe('CentralAuthJwtVerifier (proposed JWKS contract)', () => {
  let signingKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  let verifier: CentralAuthJwtVerifier;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    signingKey = privateKey;
    const publicJwk = await exportJWK(publicKey);
    const keyResolver = createLocalJWKSet({
      keys: [{ ...publicJwk, kid: keyId, alg: 'RS256', use: 'sig' }],
    });
    verifier = new CentralAuthJwtVerifier(keyResolver, { issuer, audience });
  });

  async function sign(
    options: {
      role?: string;
      issuer?: string;
      audience?: string;
      subject?: string;
      expiresAt?: number;
      omitExpiry?: boolean;
    } = {},
  ): Promise<string> {
    const jwt = new SignJWT({
      role: options.role ?? SystemRole.RECEPTIONIST,
    })
      .setProtectedHeader({ alg: 'RS256', kid: keyId })
      .setIssuer(options.issuer ?? issuer)
      .setAudience(options.audience ?? audience)
      .setSubject(options.subject ?? userId)
      .setIssuedAt();

    if (!options.omitExpiry) {
      jwt.setExpirationTime(options.expiresAt ?? '10m');
    }

    return jwt.sign(signingKey);
  }

  it('accepts a correctly signed receptionist access token', async () => {
    expect(await verifier.verify(await sign())).toEqual({
      userId,
      role: SystemRole.RECEPTIONIST,
    });
  });

  it('accepts a manager token for FDS role authorization', async () => {
    expect(
      await verifier.verify(await sign({ role: SystemRole.MANAGER })),
    ).toEqual({
      userId,
      role: SystemRole.MANAGER,
    });
  });

  it('rejects tokens issued for another subsystem', async () => {
    expect(await verifier.verify(await sign({ audience: 'wkms' }))).toBeNull();
  });

  it('rejects an unexpected issuer', async () => {
    expect(
      await verifier.verify(await sign({ issuer: 'https://other.test' })),
    ).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 120;
    expect(await verifier.verify(await sign({ expiresAt }))).toBeNull();
  });

  it('rejects tokens without an expiration claim', async () => {
    expect(await verifier.verify(await sign({ omitExpiry: true }))).toBeNull();
  });

  it('rejects tokens with a non-UUID subject', async () => {
    expect(
      await verifier.verify(await sign({ subject: 'invalid-staff-id' })),
    ).toBeNull();
  });

  it('rejects workers attempting to authenticate to Front Desk', async () => {
    expect(
      await verifier.verify(await sign({ role: SystemRole.WORKER })),
    ).toBeNull();
  });

  it('rejects HS256 tokens even when the claims look valid', async () => {
    const token = await new SignJWT({ role: SystemRole.RECEPTIONIST })
      .setProtectedHeader({ alg: 'HS256', kid: keyId })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode('test-only-hmac-secret'));

    expect(await verifier.verify(token)).toBeNull();
  });

  it('rejects an altered signature', async () => {
    const jwt = await sign();
    const [header, payload, signature] = jwt.split('.');
    const alteredSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    const altered = `${header}.${payload}.${alteredSignature}`;
    expect(await verifier.verify(altered)).toBeNull();
  });

  it('rejects unsigned, empty, or malformed tokens', async () => {
    expect(await verifier.verify('')).toBeNull();
    expect(await verifier.verify('not-a-jwt')).toBeNull();
  });
});
