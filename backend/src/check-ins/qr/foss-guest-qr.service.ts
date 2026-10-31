import * as crypto from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

interface BookingRow {
  bookingId: string;
  roomNumber: string | null;
  bookingStatus: string;
  roomStatus: string | null;
}

export interface FossGuestQrResult {
  roomNumber: string;
  activationUrl: string;
  expiresAt: string;
  demo: boolean;
}

/**
 * FDS-only QR handoff. FOSS owns issuance, redemption and guest session state.
 * No FDS booking/room state is modified during QR issuance.
 */
@Injectable()
export class FossGuestQrService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async issue(bookingReference: string): Promise<FossGuestQrResult> {
    const rows = (await this.dataSource.query(
      `
      SELECT b.booking_id::text AS "bookingId",
             b.room_number AS "roomNumber",
             b.status::text AS "bookingStatus",
             r.status::text AS "roomStatus"
        FROM bookings b
        LEFT JOIN rooms r ON r.room_number = b.room_number
       WHERE b.booking_id = $1
       LIMIT 1
      `,
      [bookingReference],
    )) as BookingRow[];
    const booking = rows[0];
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (
      booking.bookingStatus !== 'CHECKED_IN' ||
      !booking.roomNumber ||
      booking.roomStatus !== 'OCCUPIED'
    ) {
      throw new ConflictException('Booking is not eligible for a FOSS QR');
    }

    const mode = this.config.get<string>('FOSS_QR_MODE') ?? 'disabled';
    const environment = this.config.get<string>('NODE_ENV') ?? 'development';

    if (mode === 'mock') {
      if (environment !== 'development' && environment !== 'test') {
        throw new ServiceUnavailableException('QR demo mode is unavailable');
      }
      // Deliberately not a live guest URL. Visible/printable demos only.
      return {
        roomNumber: booking.roomNumber,
        activationUrl: `https://guest.example.invalid/activate#token=DEMO-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        demo: true,
      };
    }

    if (mode !== 'http') {
      throw new ServiceUnavailableException(
        'FOSS QR issuance is not configured',
      );
    }

    const endpoint = this.config.get<string>('FOSS_QR_ISSUE_URL');
    const credential = this.config.get<string>('FOSS_QR_SERVICE_TOKEN');
    const timeout = this.config.get<number>('FOSS_QR_TIMEOUT_MS') ?? 5000;
    if (!endpoint || !credential) {
      throw new ServiceUnavailableException(
        'FOSS QR issuance is not configured',
      );
    }

    // Only an explicitly configured trusted server-side service is contacted.
    let issuer: URL;
    try {
      issuer = new URL(endpoint);
    } catch {
      throw new ServiceUnavailableException('Invalid FOSS QR issuer URL');
    }
    if (
      !['http:', 'https:'].includes(issuer.protocol) ||
      (environment !== 'development' &&
        environment !== 'test' &&
        issuer.protocol !== 'https:') ||
      issuer.username ||
      issuer.password
    ) {
      throw new ServiceUnavailableException('Invalid FOSS QR issuer URL');
    }

    let response: Response;
    try {
      response = await fetch(issuer, {
        method: 'POST',
        headers: {
          'X-Internal-Service-Key': credential,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          roomNumber: booking.roomNumber,
        }),
        signal: AbortSignal.timeout(timeout),
        redirect: 'error',
        cache: 'no-store',
      });
    } catch {
      throw new ServiceUnavailableException('FOSS QR issuer unavailable');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'FOSS QR issuer rejected the request',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ServiceUnavailableException('Invalid FOSS QR issuer response');
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('activationUrl' in payload) ||
      !('expiresAt' in payload) ||
      typeof payload.activationUrl !== 'string' ||
      typeof payload.expiresAt !== 'string'
    ) {
      throw new ServiceUnavailableException('Invalid FOSS QR issuer response');
    }

    let activation: URL;
    try {
      activation = new URL(payload.activationUrl);
    } catch {
      throw new ServiceUnavailableException('Invalid FOSS activation URL');
    }
    const expiry = Date.parse(payload.expiresAt);
    if (
      activation.username ||
      activation.password ||
      !['http:', 'https:'].includes(activation.protocol) ||
      (environment !== 'development' &&
        environment !== 'test' &&
        activation.protocol !== 'https:') ||
      !Number.isFinite(expiry) ||
      expiry <= Date.now()
    ) {
      throw new ServiceUnavailableException('Invalid FOSS activation URL');
    }

    return {
      roomNumber: booking.roomNumber,
      activationUrl: activation.toString(),
      expiresAt: new Date(expiry).toISOString(),
      demo: false,
    };
  }
}
