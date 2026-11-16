import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  FossSessionGateway,
  ActivateFossSessionInput,
  ActivateFossSessionResult,
  DeactivateFossSessionInput,
  DeactivateFossSessionResult,
} from '../ports/foss-session.gateway';

@Injectable()
export class HttpFossSessionGateway extends FossSessionGateway {
  constructor(private readonly config: ConfigService) {
    super();
  }

  private async request(path: string, body: object) {
    const base = this.config.get<string>('FOSS_SERVICE_URL');
    const key = this.config.get<string>('FOSS_QR_SERVICE_TOKEN');
    if (!base || !key)
      throw new ServiceUnavailableException(
        'FOSS integration is not configured',
      );
    const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'x-internal-service-key': key,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new ServiceUnavailableException('FOSS integration unavailable');
    return response.json();
  }

  async activateGuestSession(
    input: ActivateFossSessionInput,
  ): Promise<ActivateFossSessionResult> {
    const result = await this.request('/guest-sessions/internal/qr/issue', {
      bookingId: input.bookingReference,
      roomNumber: input.roomNumber,
      checkOutDate: input.checkOutDate,
    });
    if (
      result.status !== 'ACTIVATED' ||
      typeof result.sessionReference !== 'string'
    )
      throw new ServiceUnavailableException('Invalid FOSS activation response');
    return {
      status: 'ACTIVATED',
      sessionReference: result.sessionReference,
      validUntilDate: input.checkOutDate,
    };
  }

  async deactivateGuestSession(
    input: DeactivateFossSessionInput,
  ): Promise<DeactivateFossSessionResult> {
    const result = await this.request(
      '/guest-sessions/internal/events/checkout',
      {
        eventId: randomUUID(),
        eventType: 'fds.guest.checkout',
        bookingId: input.bookingReference,
        roomNumber: input.roomNumber,
        checkoutTime: new Date().toISOString(),
      },
    );
    if (result.success !== true)
      throw new ServiceUnavailableException(
        'Invalid FOSS deactivation response',
      );
    return { status: 'DEACTIVATED' };
  }
}
