import { isUUID } from 'class-validator';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { AuthenticatedPrincipal } from './authenticated-principal';
import { SystemRole } from './system-role';

/**
 * Proposed contract; confirm issuer, audience, algorithm, and claim mapping
 * with the Central Authentication team before enabling this in staging.
 */
export interface CentralAuthJwtContract {
  issuer: string;
  audience: string;
}

/**
 * Verifies only externally signed RS256 access tokens against a trusted key
 * resolver. This class does not fetch keys, issue tokens, or handle passwords.
 * The future integration layer will provide a trusted JWKS key resolver.
 */
export class CentralAuthJwtVerifier {
  constructor(
    private readonly keyResolver: JWTVerifyGetKey,
    private readonly contract: CentralAuthJwtContract,
  ) {}

  async verify(token: string): Promise<AuthenticatedPrincipal | null> {
    if (typeof token !== 'string' || !token.trim()) {
      return null;
    }

    try {
      const { payload } = await jwtVerify(token, this.keyResolver, {
        algorithms: ['RS256'],
        issuer: this.contract.issuer,
        audience: this.contract.audience,
        requiredClaims: ['sub', 'iat', 'exp'],
        clockTolerance: 5,
      });

      if (typeof payload.sub !== 'string' || !isUUID(payload.sub, '4')) {
        return null;
      }

      if (
        payload.role !== SystemRole.RECEPTIONIST &&
        payload.role !== SystemRole.MANAGER
      ) {
        return null;
      }

      return {
        userId: payload.sub,
        role: payload.role,
      };
    } catch {
      // Invalid signature, issuer, audience, expiry, or unavailable keys.
      return null;
    }
  }
}
