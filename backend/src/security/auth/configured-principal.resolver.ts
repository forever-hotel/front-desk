import type { ConfigService } from '@nestjs/config';
import { JwtPrincipalResolver } from './jwt-principal.resolver';
import { PrincipalResolver } from './principal-resolver';

// A single gateway owns JWT verification, account status and session revocation.
export function createConfiguredPrincipalResolver(
  _config: ConfigService,
  resolver: JwtPrincipalResolver,
): PrincipalResolver {
  return resolver;
}
