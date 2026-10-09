import { Injectable } from '@nestjs/common';

import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { PrincipalResolver } from '../security/auth/principal-resolver';
import { SystemRole } from '../security/auth/system-role';

@Injectable()
export class RealtimeSocketAuthService {
  constructor(private readonly principalResolver: PrincipalResolver) {}

  async authenticate(token: unknown): Promise<AuthenticatedPrincipal | null> {
    if (typeof token !== 'string' || !token.trim()) {
      return null;
    }

    try {
      // Reuse the existing REST JWT verification logic.
      // It validates signature, expiration, issuer and role.
      const principal = await this.principalResolver.resolve({
        headers: {
          authorization: `Bearer ${token.trim()}`,
        },
      });

      if (!principal) {
        return null;
      }

      // Only Front Desk users can receive realtime events.
      if (
        principal.role !== SystemRole.RECEPTIONIST &&
        principal.role !== SystemRole.MANAGER
      ) {
        return null;
      }

      return principal;
    } catch {
      // Fail closed if authentication cannot be completed.
      return null;
    }
  }
}
