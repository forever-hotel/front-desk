import { allowsInternalFossQr } from './foss-qr-url';

describe('private FOSS QR HTTP opt-in', () => {
  const endpoint = 'http://foss-backend:4300/guest-sessions/internal/qr/issue';
  it('requires explicit opt-in and supports both deployed and local ports', () => {
    expect(allowsInternalFossQr(endpoint, false)).toBe(false);
    expect(allowsInternalFossQr(endpoint, undefined)).toBe(false);
    expect(allowsInternalFossQr(endpoint, true)).toBe(true);
    expect(
      allowsInternalFossQr(endpoint.replace(':4300', ':4004'), 'true'),
    ).toBe(true);
  });
  it.each([
    'http://evil.example:4300/guest-sessions/internal/qr/issue',
    'http://foss-backend.evil.example:4300/guest-sessions/internal/qr/issue',
    'http://foss-backend:8080/guest-sessions/internal/qr/issue',
    'http://user:password@foss-backend:4300/guest-sessions/internal/qr/issue',
    endpoint + '?redirect=elsewhere',
    endpoint + '#fragment',
    endpoint + '/other',
    'invalid',
  ])('rejects non-approved endpoint %s', (url) => {
    expect(allowsInternalFossQr(url, true)).toBe(false);
  });
});
