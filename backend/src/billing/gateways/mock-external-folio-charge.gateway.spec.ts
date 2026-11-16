import { MockExternalFolioChargeGateway } from './mock-external-folio-charge.gateway';

describe('MockExternalFolioChargeGateway', () => {
  let gateway: MockExternalFolioChargeGateway;

  beforeEach(() => {
    gateway = new MockExternalFolioChargeGateway();
  });

  it('should return an empty external-charge list until live integration is connected', async () => {
    await expect(
      gateway.findCharges('44444444-4444-4444-8444-444444444444'),
    ).resolves.toEqual([]);
  });

  it('should return a new empty result without fabricating charge data', async () => {
    const first = await gateway.findCharges(
      '44444444-4444-4444-8444-444444444444',
    );

    const second = await gateway.findCharges(
      '55555555-5555-4555-8555-555555555555',
    );

    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });
});
