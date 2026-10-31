import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../tests/utils/render-with-providers';
import { server } from '../../../../tests/mocks/server';
import { FossGuestQrActions } from './foss-guest-qr-actions';

const reference = '11111111-1111-4111-8111-111111111111';

describe('FossGuestQrActions', () => {
  it('shows a QR preview only after successful FDS issuance', async () => {
    server.use(http.post('*/check-in/:bookingReference/foss-qr', () =>
      HttpResponse.json({
        roomNumber: '101',
        activationUrl: 'https://guest.example.invalid/activate#token=DEMO-123',
        expiresAt: '2030-10-31T10:00:00.000Z',
        demo: true,
      }),
    ));
    const user = userEvent.setup();
    renderWithProviders(<FossGuestQrActions bookingReference={reference} />);
    await user.click(screen.getByRole('button', { name: 'Print FOSS QR' }));
    expect(await screen.findByText('Room 101')).toBeInTheDocument();
    expect(screen.getByText('DEMO ONLY — NOT VALID FOR GUEST LOGIN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Print Dialog' })).toBeEnabled();
  });

  it('shows backend errors without pretending check-in failed', async () => {
    server.use(http.post('*/check-in/:bookingReference/foss-qr', () =>
      HttpResponse.json({ message: 'FOSS issuer unavailable' }, { status: 503 }),
    ));
    const user = userEvent.setup();
    renderWithProviders(<FossGuestQrActions bookingReference={reference} />);
    await user.click(screen.getByRole('button', { name: 'Print FOSS QR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to issue a FOSS guest QR.');
    expect(screen.queryByText('Room 101')).not.toBeInTheDocument();
  });
});
