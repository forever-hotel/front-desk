import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal,
} from './authenticated-principal';
import { PrincipalResolver } from './principal-resolver';
import { SystemRole } from './system-role';

@Injectable()
export class JwtPrincipalResolver extends PrincipalResolver {
  constructor(private readonly config: ConfigService) {
    super();
  }
  async resolve(
    request: RequestWithPrincipal,
  ): Promise<AuthenticatedPrincipal | null> {
    const header =
      request.headers.authorization ?? request.headers.Authorization;
    if (typeof header !== 'string' || !/^Bearer \S+$/.test(header)) return null;
    try {
      const response = await fetch(
        this.config.getOrThrow<string>('AUTH_SERVICE_URL') +
          '/fds/auth/session',
        {
          headers: { Authorization: header },
          signal: AbortSignal.timeout(12000),
          redirect: 'error',
        },
      );
      if ([401, 403].includes(response.status)) return null;
      if (!response.ok) throw new Error();
      const session = await response.json();
      if (
        !session ||
        typeof session.sub !== 'string' ||
        !isUUID(session.sub) ||
        !['ROOT', 'RECEPTIONIST'].includes(session.role) ||
        session.passwordChangeRequired !== false ||
        !Number.isSafeInteger(session.expiresAt) ||
        session.expiresAt * 1000 <= Date.now()
      )
        return null;
      return { userId: session.sub, role: session.role as SystemRole };
    } catch {
      throw new ServiceUnavailableException(
        'Staff authentication is unavailable',
      );
    }
  }
}
