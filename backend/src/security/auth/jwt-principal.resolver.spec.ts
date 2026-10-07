import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import type { RequestWithPrincipal } from './authenticated-principal';
import { JwtPrincipalResolver } from './jwt-principal.resolver';
import { SystemRole } from './system-role';

describe('JwtPrincipalResolver', () => {
  const secret = 'plan16-test-secret-that-is-long-enough';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  let configService: {
    get: jest.Mock;
  };

  let resolver: JwtPrincipalResolver;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') {
          return secret;
        }

        if (key === 'JWT_ISSUER') {
          return issuer;
        }

        return undefined;
      }),
    };

    resolver = new JwtPrincipalResolver(
      configService as unknown as ConfigService,
    );
  });

  it('resolves a valid receptionist JWT', async () => {
    const token = await createToken({
      sub: receptionistId,
      role: SystemRole.RECEPTIONIST,
    });

    const result = await resolver.resolve(createRequest(`Bearer ${token}`));

    expect(result).toEqual({
      userId: receptionistId,
      role: SystemRole.RECEPTIONIST,
    });
  });

  it('returns null when Authorization is missing', async () => {
    const result = await resolver.resolve({
      headers: {},
    });

    expect(result).toBeNull();
  });

  it('returns null for a malformed Authorization header', async () => {
    const result = await resolver.resolve(createRequest('Basic abc123'));

    expect(result).toBeNull();
  });

  it('returns null for an invalid signature', async () => {
    const token = await new SignJWT({
      role: SystemRole.RECEPTIONIST,
    })
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuer(issuer)
      .setSubject(receptionistId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('different-secret'));

    const result = await resolver.resolve(createRequest(`Bearer ${token}`));

    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const token = await new SignJWT({
      role: SystemRole.RECEPTIONIST,
    })
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuer(issuer)
      .setSubject(receptionistId)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(secret));

    const result = await resolver.resolve(createRequest(`Bearer ${token}`));

    expect(result).toBeNull();
  });

  it('returns null for the wrong issuer', async () => {
    const token = await new SignJWT({
      role: SystemRole.RECEPTIONIST,
    })
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuer('different-auth-service')
      .setSubject(receptionistId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    const result = await resolver.resolve(createRequest(`Bearer ${token}`));

    expect(result).toBeNull();
  });

  it('returns null for an invalid subject UUID', async () => {
    const token = await createToken({
      sub: 'not-a-uuid',
      role: SystemRole.RECEPTIONIST,
    });

    const result = await resolver.resolve(createRequest(`Bearer ${token}`));

    expect(result).toBeNull();
  });

  it('returns null for an unsupported role', async () => {
    const token = await createToken({
      sub: receptionistId,
      role: 'SUPER_ADMIN',
    });

    const result = await resolver.resolve(createRequest(`Bearer ${token}`));

    expect(result).toBeNull();
  });

  it('throws when JWT verification configuration is unavailable', async () => {
    configService.get.mockReturnValue(undefined);

    await expect(
      resolver.resolve(createRequest('Bearer token')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  async function createToken({
    sub,
    role,
  }: {
    sub: string;
    role: string;
  }): Promise<string> {
    return new SignJWT({
      role,
    })
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuer(issuer)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
  }

  function createRequest(authorization: string): RequestWithPrincipal {
    return {
      headers: {
        authorization,
      },
    };
  }
});
