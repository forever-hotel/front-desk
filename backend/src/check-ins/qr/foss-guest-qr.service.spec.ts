import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { FossGuestQrService } from './foss-guest-qr.service';

describe('FossGuestQrService', () => {
  const bookingId = '11111111-1111-4111-8111-111111111111';
  const checkedIn = {
    bookingId,
    roomNumber: '101',
    bookingStatus: 'CHECKED_IN',
    roomStatus: 'OCCUPIED',
  };
  let query: jest.Mock;
  let config: Record<string, string>;
  let service: FossGuestQrService;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([checkedIn]);
    config = { NODE_ENV: 'development', FOSS_QR_MODE: 'mock' };
    service = new FossGuestQrService(
      { query } as unknown as DataSource,
      { get: (key: string) => config[key] } as unknown as ConfigService,
    );
  });

  it('issues an explicitly non-functional demo QR for a checked-in booking', async () => {
    const result = await service.issue(bookingId);
    expect(result.demo).toBe(true);
    expect(result.roomNumber).toBe('101');
    expect(result.activationUrl).toContain('.invalid/activate#token=DEMO-');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM bookings b'),
      [bookingId],
    );
  });

  it('rejects a missing booking', async () => {
    query.mockResolvedValue([]);
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    { bookingStatus: 'CONFIRMED' },
    { bookingStatus: 'CHECKED_OUT' },
    { roomNumber: null },
    { roomStatus: 'REQUIRES_CLEANING' },
  ])('rejects ineligible booking %o', async (change) => {
    query.mockResolvedValue([{ ...checkedIn, ...change }]);
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('fails closed when issuer is not configured', async () => {
    config.FOSS_QR_MODE = 'disabled';
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('forbids demo mode on production', async () => {
    config.NODE_ENV = 'production';
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects HTTP mode with missing internal credentials', async () => {
    config.FOSS_QR_MODE = 'http';
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('FossGuestQrService HTTP issuer adapter', () => {
  const reference = '22222222-2222-4222-8222-222222222222';
  const booking = {
    bookingId: reference,
    roomNumber: '202',
    bookingStatus: 'CHECKED_IN',
    roomStatus: 'OCCUPIED',
  };
  const config: Record<string, string | number> = {
    NODE_ENV: 'test',
    FOSS_QR_MODE: 'http',
    FOSS_QR_ISSUE_URL: 'https://issuer.example.invalid/internal/guest-qr',
    FOSS_QR_SERVICE_TOKEN: 'test-only-service-key-longer-than-32-characters',
    FOSS_QR_TIMEOUT_MS: 1000,
  };
  const issue = (query: jest.Mock) =>
    new FossGuestQrService(
      { query } as unknown as DataSource,
      { get: (key: string) => config[key] } as unknown as ConfigService,
    );
  afterEach(() => jest.restoreAllMocks());

  it('sends the minimum booking/room payload to FOSS and validates HTTPS activation', async () => {
    const query = jest.fn().mockResolvedValue([booking]);
    const token = 'https://guest.example.invalid/activate#token=sample';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          activationUrl: token,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const result = await issue(query).issue(reference);
    expect(result.activationUrl).toBe(token);
    expect(result.demo).toBe(false);
    const call = fetchSpy.mock.calls[0];
    const init = call?.[1] as RequestInit;
    expect(init.headers).toEqual(
      expect.objectContaining({
        'X-Internal-Service-Key':
          'test-only-service-key-longer-than-32-characters',
      }),
    );
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('https://issuer.example.invalid/internal/guest-qr'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ bookingId: reference, roomNumber: '202' }),
      }),
    );
  });

  it('fails closed when FOSS rejects the issuance request', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(
      issue(jest.fn().mockResolvedValue([booking])).issue(reference),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed on malformed issuer responses', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(
      issue(jest.fn().mockResolvedValue([booking])).issue(reference),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
