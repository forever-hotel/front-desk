import { redactLogString, redactLogValue } from './log-redactor';

describe('log redaction', () => {
  it('redacts structured guest PII', () => {
    const input = {
      bookingReference: '44444444-4444-4444-8444-444444444444',
      fullName: 'CI Guest',
      email: 'guest@example.com',
      phone: '0771234567',
      nicOrPassport: '200012345678',
      roomNumber: 'T102',
    };

    expect(redactLogValue(input)).toEqual({
      bookingReference: '44444444-4444-4444-8444-444444444444',
      fullName: '[REDACTED]',
      email: '[REDACTED]',
      phone: '[REDACTED]',
      nicOrPassport: '[REDACTED]',
      roomNumber: 'T102',
    });
  });

  it('redacts structured credentials and secrets', () => {
    expect(
      redactLogValue({
        password: 'password123',
        passwordHash: 'hash',
        authorization: 'Bearer sensitive-token',
        sessionToken: 'session-token',
        databaseUrl: 'postgresql://user:pass@host/db',
        rabbitMqUrl: 'amqp://guest:guest@localhost',
        apiKey: 'api-secret',
      }),
    ).toEqual({
      password: '[REDACTED]',
      passwordHash: '[REDACTED]',
      authorization: '[REDACTED]',
      sessionToken: '[REDACTED]',
      databaseUrl: '[REDACTED]',
      rabbitMqUrl: '[REDACTED]',
      apiKey: '[REDACTED]',
    });
  });

  it('redacts raw payment-card fields', () => {
    expect(
      redactLogValue({
        cardNumber: '4111111111111111',
        pan: '4111111111111111',
        cvv: '123',
        cvc: '123',
        pin: '1234',
        expiryDate: '12/30',
        trackData: 'sensitive-track-data',
      }),
    ).toEqual({
      cardNumber: '[REDACTED]',
      pan: '[REDACTED]',
      cvv: '[REDACTED]',
      cvc: '[REDACTED]',
      pin: '[REDACTED]',
      expiryDate: '[REDACTED]',
      trackData: '[REDACTED]',
    });
  });

  it('redacts secrets embedded inside free-form strings', () => {
    const input =
      'Contact guest@example.com using 0771234567. ' +
      'Authorization: Bearer abc.def.ghi ' +
      'DB postgresql://user:pass@localhost/db';

    const result = redactLogString(input);

    expect(result).not.toContain('guest@example.com');

    expect(result).not.toContain('0771234567');

    expect(result).not.toContain('abc.def.ghi');

    expect(result).not.toContain('user:pass');

    expect(result).toContain('[REDACTED]');
  });

  it('preserves non-sensitive operational identifiers', () => {
    expect(
      redactLogValue({
        bookingReference: '44444444-4444-4444-8444-444444444444',
        workerId: '66666666-6666-4666-8666-666666666666',
        taskId: '11111111-1111-4111-8111-111111111111',
        roomNumber: 'T102',
        action: 'CHECK_IN',
      }),
    ).toEqual({
      bookingReference: '44444444-4444-4444-8444-444444444444',
      workerId: '66666666-6666-4666-8666-666666666666',
      taskId: '11111111-1111-4111-8111-111111111111',
      roomNumber: 'T102',
      action: 'CHECK_IN',
    });
  });

  it('redacts sensitive values inside nested objects and arrays', () => {
    expect(
      redactLogValue({
        request: {
          headers: {
            authorization: 'Bearer very-secret-token',
          },
          guests: [
            {
              email: 'guest@example.com',
            },
          ],
        },
      }),
    ).toEqual({
      request: {
        headers: {
          authorization: '[REDACTED]',
        },
        guests: [
          {
            email: '[REDACTED]',
          },
        ],
      },
    });
  });

  it('does not mutate the original object', () => {
    const original = {
      email: 'guest@example.com',
      bookingReference: '44444444-4444-4444-8444-444444444444',
    };

    const result = redactLogValue(original);

    expect(result).not.toBe(original);

    expect(original.email).toBe('guest@example.com');
  });

  it('handles circular objects safely', () => {
    const value: Record<string, unknown> = {
      action: 'CHECK_IN',
    };

    value.self = value;

    expect(redactLogValue(value)).toEqual({
      action: 'CHECK_IN',
      self: '[CIRCULAR]',
    });
  });

  it('redacts sensitive error messages', () => {
    const error = new Error(
      'Failed for guest@example.com using Bearer secret-token',
    );

    const redacted = redactLogValue(error) as {
      name: string;
      message: string;
    };

    expect(redacted.name).toBe('Error');

    expect(redacted.message).not.toContain('guest@example.com');

    expect(redacted.message).not.toContain('secret-token');
  });
});
