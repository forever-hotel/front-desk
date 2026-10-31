import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { FossGuestQrService } from './foss-guest-qr.service';

describe('FossGuestQrService additional failure and security coverage', () => {
  const bookingId = '11111111-1111-4111-8111-111111111111';
  const booking = {
    bookingId,
    roomNumber: '101',
    bookingStatus: 'CHECKED_IN',
    roomStatus: 'OCCUPIED',
  };

  let config: Record<string, string | number>;
  let query: jest.Mock;
  let service: FossGuestQrService;

  const validPayload = () => ({
    activationUrl:
      'https://guest.example.invalid/activate#token=unit-test-only',
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  });

  const mockIssuerResponse = (payload: unknown) =>
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  beforeEach(() => {
    config = {
      NODE_ENV: 'test',
      FOSS_QR_MODE: 'http',
      FOSS_QR_ISSUE_URL: 'https://issuer.example.invalid/internal/guest-qr',
      FOSS_QR_SERVICE_TOKEN: 'unit-test-only-secret-of-at-least-32-characters',
      FOSS_QR_TIMEOUT_MS: 1000,
    };
    query = jest.fn().mockResolvedValue([booking]);
    service = new FossGuestQrService(
      { query } as unknown as DataSource,
      { get: (key: string) => config[key] } as unknown as ConfigService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('rejects a network failure and does not modify the checked-in booking', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('timeout'));
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT b.booking_id'),
      [bookingId],
    );
  });

  it('rejects invalid JSON from the FOSS issuer', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('not JSON', { status: 200 }));
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it.each([
    null,
    [],
    {},
    { activationUrl: 123, expiresAt: '2030-11-01T12:00:00.000Z' },
    { activationUrl: 'https://guest.example.invalid/activate#token=x' },
    {
      activationUrl: 'https://guest.example.invalid/activate#token=x',
      expiresAt: 123,
    },
  ])('rejects invalid issuer response shape: %j', async (payload) => {
    mockIssuerResponse(payload);
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it.each([
    { activationUrl: 'not-a-url' },
    { activationUrl: 'file:///tmp/qr' },
    {
      activationUrl:
        'https://guest:password@guest.example.invalid/activate#token=x',
    },
    { expiresAt: 'not-a-date' },
    { expiresAt: '2020-01-01T00:00:00.000Z' },
  ])('rejects unsafe or expired activation properties: %j', async (change) => {
    mockIssuerResponse({ ...validPayload(), ...change });
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects an invalid issuer endpoint protocol before making a network request', async () => {
    config.FOSS_QR_ISSUE_URL = 'file:///tmp/issuer';
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects issuer credentials embedded in the issuer URL', async () => {
    config.FOSS_QR_ISSUE_URL =
      'https://user:password@issuer.example.invalid/internal/guest-qr';
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects HTTP issuer URLs in production', async () => {
    config.NODE_ENV = 'production';
    config.FOSS_QR_ISSUE_URL =
      'http://issuer.example.invalid/internal/guest-qr';
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects HTTP activation URLs in production', async () => {
    config.NODE_ENV = 'production';
    mockIssuerResponse({
      ...validPayload(),
      activationUrl: 'http://guest.example.invalid/activate#token=x',
    });
    await expect(service.issue(bookingId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('accepts only a future HTTPS activation URL in production', async () => {
    config.NODE_ENV = 'production';
    const payload = validPayload();
    mockIssuerResponse(payload);
    const result = await service.issue(bookingId);
    expect(result).toEqual({
      roomNumber: '101',
      activationUrl: payload.activationUrl,
      expiresAt: payload.expiresAt,
      demo: false,
    });
  });
});
