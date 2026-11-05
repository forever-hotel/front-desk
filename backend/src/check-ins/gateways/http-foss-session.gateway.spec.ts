import { ConfigService } from '@nestjs/config';
import { HttpFossSessionGateway } from './http-foss-session.gateway';

describe('FDS FOSS lifecycle HTTP adapter', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });
  const input = {
    bookingReference: 'booking',
    roomNumber: '101',
    checkOutDate: '2099-01-01',
  };
  const gateway = () =>
    new HttpFossSessionGateway(
      new ConfigService({
        FOSS_SERVICE_URL: 'http://foss.internal:4004',
        FOSS_QR_SERVICE_TOKEN: 'test-only-secret',
      }),
    );
  it('issues a stay-bound activation through the protected FOSS endpoint', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'ACTIVATED',
            sessionReference: 'activation',
          }),
        ),
      );
    expect(await gateway().activateGuestSession(input)).toEqual({
      status: 'ACTIVATED',
      sessionReference: 'activation',
      validUntilDate: input.checkOutDate,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://foss.internal:4004/guest-sessions/internal/qr/issue',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-internal-service-key': 'test-only-secret',
        }),
        body: JSON.stringify({
          bookingId: 'booking',
          roomNumber: '101',
          checkOutDate: input.checkOutDate,
        }),
      }),
    );
  });
  it('sends a checkout revocation event', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true })));
    expect(await gateway().deactivateGuestSession(input)).toEqual({
      status: 'DEACTIVATED',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/internal/events/checkout'),
      expect.objectContaining({
        body: expect.stringContaining('fds.guest.checkout'),
      }),
    );
  });
  it('fails closed when the provider rejects the request', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(gateway().activateGuestSession(input)).rejects.toMatchObject({
      status: 503,
    });
  });
});
