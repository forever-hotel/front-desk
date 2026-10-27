import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal,
} from './authenticated-principal';
import { CentralAuthJwtVerifier } from './central-auth-jwt.verifier';
import { PrincipalResolver } from './principal-resolver';

/**
 * Adapts Central Auth Bearer tokens to the FDS principal contract.
 * Signature/claims verification is delegated to CentralAuthJwtVerifier.
 */
export class CentralAuthPrincipalResolver extends PrincipalResolver {
  constructor(private readonly verifier: CentralAuthJwtVerifier) {
    super();
  }

  resolve(
    request: RequestWithPrincipal,
  ): Promise<AuthenticatedPrincipal | null> {
    const authorization =
      request.headers.authorization ?? request.headers.Authorization;

    // Reject duplicate Authorization headers rather than choosing one.
    if (typeof authorization !== 'string') {
      return Promise.resolve(null);
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());

    if (!match) {
      return Promise.resolve(null);
    }

    return this.verifier.verify(match[1]);
  }
}
