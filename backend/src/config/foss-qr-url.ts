// Explicit opt-in for the private Compose FOSS service, never arbitrary HTTP hosts.
export function allowsInternalFossQr(
  endpoint: string,
  enabled: unknown,
): boolean {
  if (enabled !== true && enabled !== 'true') return false;
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'http:' &&
      url.hostname === 'foss-backend' &&
      ['4300', '4004'].includes(url.port) &&
      url.pathname === '/guest-sessions/internal/qr/issue' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
