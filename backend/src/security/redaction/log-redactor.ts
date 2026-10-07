const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = new Set([
  'fullname',
  'guestname',
  'email',
  'phone',
  'phonenumber',
  'nic',
  'nicorpassport',
  'passport',
  'passportnumber',

  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',

  'authorization',
  'cookie',
  'setcookie',

  'token',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'jwt',

  'secret',
  'clientsecret',
  'apikey',

  'databaseurl',
  'dbpassword',

  'rabbitmqurl',

  'cardnumber',
  'pan',
  'cvv',
  'cvc',
  'pin',
  'trackdata',
  'expirydate',
  'expirymonth',
  'expiryyear',

  'documentstoragekey',
  'documentsha256',
]);

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);

  if (SENSITIVE_KEYS.has(normalized)) {
    return true;
  }

  return (
    normalized.endsWith('password') ||
    normalized.endsWith('passwordhash') ||
    normalized.endsWith('token') ||
    normalized.endsWith('secret')
  );
}

export function redactLogString(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      REDACTED,
    )
    .replace(
      /\b(postgres(?:ql)?|amqps?):\/\/[^\s"'`]+/gi,
      (_match, protocol: string) => `${protocol}://${REDACTED}`,
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/\b(?:\+94|0)(?:[\s-]?\d){9}\b/g, REDACTED)
    .replace(/(?<![A-Za-z0-9-])\d{9}[VvXx](?![A-Za-z0-9-])/g, REDACTED)
    .replace(/(?<![A-Za-z0-9-])\d{12}(?![A-Za-z0-9-])/g, REDACTED)
    .replace(/(?<![A-Za-z0-9-])\d{13,19}(?![A-Za-z0-9-])/g, REDACTED);
}

export function redactLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === 'string') {
    return redactLogString(value);
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactLogString(value.message),
      stack:
        typeof value.stack === 'string'
          ? redactLogString(value.stack)
          : undefined,
    };
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  if (seen.has(value)) {
    return '[CIRCULAR]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.map((item) => redactLogValue(item, seen));

    seen.delete(value);

    return result;
  }

  const result: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
      continue;
    }

    result[key] = redactLogValue(nestedValue, seen);
  }

  seen.delete(value);

  return result;
}
