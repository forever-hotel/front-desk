import { MockFossSessionGateway } from './mock-foss-session.gateway';

describe('MockFossSessionGateway', () => {
  let gateway: MockFossSessionGateway;

  beforeEach(() => {
    gateway = new MockFossSessionGateway();
  });

  it('should return a deterministic mock activation result', async () => {
    const bookingReference = '55555555-5555-4555-8555-555555555551';

    await expect(
      gateway.activateGuestSession({
        bookingReference,
        roomNumber: 'T103',
        checkOutDate: '2032-01-12',
      }),
    ).resolves.toEqual({
      status: 'ACTIVATED',
      sessionReference: `mock-foss-session-${bookingReference}`,
      validUntilDate: '2032-01-12',
    });
  });
});
