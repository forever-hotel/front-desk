import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CentralAuthPrincipalResolver } from './central-auth-principal.resolver';
import { createConfiguredPrincipalResolver } from './configured-principal.resolver';
import { JwtPrincipalResolver } from './jwt-principal.resolver';

const approved = {
  FDS_AUTH_PROVIDER: 'central',
  CENTRAL_AUTH_ISSUER: 'https://auth.example.test',
  CENTRAL_AUTH_AUDIENCE: 'fds',
  CENTRAL_AUTH_JWKS_URL: 'https://auth.example.test/.well-known/jwks.json',
};

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('FDS authentication provider selection', () => {
  const legacy = {} as JwtPrincipalResolver;

  it('retains legacy verification when the option is absent', () => {
    expect(createConfiguredPrincipalResolver(config({}), legacy)).toBe(legacy);
  });

  it('retains legacy verification when explicitly selected', () => {
    expect(
      createConfiguredPrincipalResolver(
        config({ FDS_AUTH_PROVIDER: 'legacy' }),
        legacy,
      ),
    ).toBe(legacy);
  });

  it('selects Central Auth without an automatic HS256 fallback', () => {
    const result = createConfiguredPrincipalResolver(config(approved), legacy);
    expect(result).toBeInstanceOf(CentralAuthPrincipalResolver);
    expect(result).not.toBe(legacy);
  });

  it('fails closed when Central Auth configuration is incomplete', () => {
    expect(() =>
      createConfiguredPrincipalResolver(
        config({ FDS_AUTH_PROVIDER: 'central' }),
        legacy,
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects an insecure JWKS HTTP URL', () => {
    expect(() =>
      createConfiguredPrincipalResolver(
        config({
          ...approved,
          CENTRAL_AUTH_JWKS_URL: 'http://auth.example.test/keys',
        }),
        legacy,
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects embedded credentials in the JWKS URL', () => {
    expect(() =>
      createConfiguredPrincipalResolver(
        config({
          ...approved,
          CENTRAL_AUTH_JWKS_URL:
            'https://username:password@auth.example.test/keys',
        }),
        legacy,
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects unsupported provider names', () => {
    expect(() =>
      createConfiguredPrincipalResolver(
        config({ FDS_AUTH_PROVIDER: 'anything' }),
        legacy,
      ),
    ).toThrow(ServiceUnavailableException);
  });
});
