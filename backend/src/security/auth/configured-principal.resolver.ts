import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';
import { CentralAuthJwtVerifier } from './central-auth-jwt.verifier';
import { CentralAuthPrincipalResolver } from './central-auth-principal.resolver';
import { JwtPrincipalResolver } from './jwt-principal.resolver';
import { PrincipalResolver } from './principal-resolver';

/**
 * Select exactly one token validator at bootstrap. Once Central Auth is enabled,
 * a failed JWKS lookup or a bad token MUST NOT fall back to legacy HS256.
 *
 * The issuer, audience and JWKS URL are server-controlled configuration;
 * never read a key URL from untrusted JWT headers or request parameters.
 */
export function createConfiguredPrincipalResolver(
  config: ConfigService,
  legacyResolver: JwtPrincipalResolver,
): PrincipalResolver {
  const provider = config.get<string>('FDS_AUTH_PROVIDER') ?? 'legacy';

  if (provider === 'legacy') {
    return legacyResolver;
  }

  if (provider !== 'central') {
    throw new ServiceUnavailableException('Unsupported auth provider');
  }

  const issuer = config.get<string>('CENTRAL_AUTH_ISSUER');
  const audience = config.get<string>('CENTRAL_AUTH_AUDIENCE');
  const jwksUrl = config.get<string>('CENTRAL_AUTH_JWKS_URL');

  if (!issuer || audience !== 'fds' || !jwksUrl) {
    throw new ServiceUnavailableException(
      'Central authentication configuration is incomplete',
    );
  }

  let trustedJwksUrl: URL;

  try {
    trustedJwksUrl = new URL(jwksUrl);
    if (
      trustedJwksUrl.protocol !== 'https:' ||
      trustedJwksUrl.username ||
      trustedJwksUrl.password ||
      trustedJwksUrl.hash
    ) {
      throw new Error('Invalid trusted JWKS URL');
    }
  } catch {
    throw new ServiceUnavailableException(
      'Central authentication JWKS URL must use HTTPS',
    );
  }

  const verifier = new CentralAuthJwtVerifier(
    createRemoteJWKSet(trustedJwksUrl, {
      timeoutDuration: 3000,
      cooldownDuration: 30000,
      cacheMaxAge: 300000,
    }),
    { issuer, audience },
  );

  return new CentralAuthPrincipalResolver(verifier);
}
