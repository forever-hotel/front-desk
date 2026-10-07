import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { jwtVerify } from 'jose';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal,
} from './authenticated-principal';
import { PrincipalResolver } from './principal-resolver';
import { isSystemRole, SystemRole } from './system-role';

@Injectable()
export class JwtPrincipalResolver extends PrincipalResolver {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async resolve(
    request: RequestWithPrincipal,
  ): Promise<AuthenticatedPrincipal | null> {
    const authorization = this.getAuthorizationHeader(request);

    if (!authorization) {
      return null;
    }

    const token = this.extractBearerToken(authorization);

    if (!token) {
      return null;
    }

    const secret = this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new ServiceUnavailableException(
        'Authentication configuration is unavailable',
      );
    }

    const issuer = this.configService.get<string>('JWT_ISSUER');

    try {
      const verification = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        {
          algorithms: ['HS256'],
          ...(issuer
            ? {
                issuer,
              }
            : {}),
        },
      );

      const { sub, role } = verification.payload;

      if (typeof sub !== 'string' || !isUUID(sub, '4')) {
        return null;
      }

      if (!isSystemRole(role)) {
        return null;
      }

      return {
        userId: sub,
        role: role as SystemRole,
      };
    } catch {
      return null;
    }
  }

  private getAuthorizationHeader(request: RequestWithPrincipal): string | null {
    const value =
      request.headers.authorization ?? request.headers.Authorization;

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }

  private extractBearerToken(authorization: string): string | null {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());

    if (!match) {
      return null;
    }

    const token = match[1]?.trim();

    return token || null;
  }
}
