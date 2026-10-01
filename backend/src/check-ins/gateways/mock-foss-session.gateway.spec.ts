import { MockFossSessionGateway } from './mock-foss-session.gateway';

describe('MockFossSessionGateway', () => {
  let gateway: MockFossSessionGateway;

  beforeEach(() => {
    gateway = new MockFossSessionGateway();
  });

  it('should resolve mock guest-session activation', async () => {
    await expect(
      gateway.activateGuestSession({
        bookingReference: '55555555-5555-4555-8555-555555555551',
        roomNumber: 'T103',
      }),
    ).resolves.toBeUndefined();
  });
});
