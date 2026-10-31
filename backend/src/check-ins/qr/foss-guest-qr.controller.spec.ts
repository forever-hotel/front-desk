import { FossGuestQrController } from './foss-guest-qr.controller';
import { FossGuestQrService } from './foss-guest-qr.service';

describe('FossGuestQrController', () => {
  const reference = '11111111-1111-4111-8111-111111111111';
  const result = {
    roomNumber: '101',
    activationUrl: 'https://guest.example.invalid/activate#token=DEMO',
    expiresAt: '2030-11-01T12:00:00.000Z',
    demo: true,
  };

  it('delegates QR requests to the authorized QR service', async () => {
    const issue = jest.fn().mockResolvedValue(result);
    const controller = new FossGuestQrController({
      issue,
    } as unknown as FossGuestQrService);

    await expect(controller.issue(reference)).resolves.toEqual(result);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(issue).toHaveBeenCalledWith(reference);
  });

  it('does not turn service errors into a successful QR response', async () => {
    const error = new Error('issuer unavailable');
    const issue = jest.fn().mockRejectedValue(error);
    const controller = new FossGuestQrController({
      issue,
    } as unknown as FossGuestQrService);

    await expect(controller.issue(reference)).rejects.toBe(error);
    expect(issue).toHaveBeenCalledWith(reference);
  });
});
