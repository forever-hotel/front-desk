const DEFAULT_DEVELOPMENT_ORIGIN = 'http://localhost:3000';

export function getAllowedOrigins(): string[] {
  const configuredOrigins = process.env.FDS_ALLOWED_ORIGINS;

  if (!configuredOrigins) {
    return [DEFAULT_DEVELOPMENT_ORIGIN];
  }

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
