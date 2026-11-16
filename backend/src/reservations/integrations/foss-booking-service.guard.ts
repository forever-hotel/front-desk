import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** Internal FOSS-to-FDS authentication. A guest JWT and a receptionist JWT are
 * deliberately NOT accepted here. This key must never be sent to browsers. */
@Injectable()
export class FossBookingServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredKey = this.config.get<string>('FDS_FOSS_BOOKING_API_KEY');
    if (!configuredKey || configuredKey.length < 32) {
      throw new ServiceUnavailableException(
        'FOSS booking verification is not configured',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? /^Bearer ([^\s]+)$/.exec(authorization)
        : null;

    if (!match) {
      throw new UnauthorizedException(
        'Internal service authorization required',
      );
    }

    // Hash both values to equal-length buffers before timing-safe comparison.
    const expected = createHash('sha256').update(configuredKey).digest();
    const supplied = createHash('sha256').update(match[1]).digest();
    if (!timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedException('Invalid internal service credential');
    }
    return true;
  }
}
