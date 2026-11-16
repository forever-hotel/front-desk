import type { LoggerService } from '@nestjs/common';
import { RedactingLoggerService } from './redacting-logger.service';

describe('RedactingLoggerService', () => {
  let delegate: {
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    verbose: jest.Mock;
    fatal: jest.Mock;
  };

  let logger: RedactingLoggerService;

  beforeEach(() => {
    delegate = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      fatal: jest.fn(),
    };

    logger = new RedactingLoggerService(delegate as unknown as LoggerService);
  });

  it('redacts structured values passed to log', () => {
    logger.log(
      {
        email: 'guest@example.com',
        bookingReference: '44444444-4444-4444-8444-444444444444',
      },
      'SecurityContext',
    );

    expect(delegate.log).toHaveBeenCalledWith(
      {
        email: '[REDACTED]',
        bookingReference: '44444444-4444-4444-8444-444444444444',
      },
      'SecurityContext',
    );
  });

  it('redacts sensitive error messages', () => {
    logger.error('Failed with Bearer super-secret-token', {
      databaseUrl: 'postgresql://user:pass@localhost/db',
    });

    expect(delegate.error).toHaveBeenCalledWith(
      'Failed with Bearer [REDACTED]',
      {
        databaseUrl: '[REDACTED]',
      },
    );
  });

  it('supports warn logging', () => {
    logger.warn({
      phone: '0771234567',
      action: 'CHECK_IN',
    });

    expect(delegate.warn).toHaveBeenCalledWith({
      phone: '[REDACTED]',
      action: 'CHECK_IN',
    });
  });

  it('supports debug logging', () => {
    logger.debug({
      password: 'secret',
    });

    expect(delegate.debug).toHaveBeenCalledWith({
      password: '[REDACTED]',
    });
  });

  it('supports verbose logging', () => {
    logger.verbose({
      sessionToken: 'secret-session',
    });

    expect(delegate.verbose).toHaveBeenCalledWith({
      sessionToken: '[REDACTED]',
    });
  });

  it('supports fatal logging', () => {
    logger.fatal({
      cardNumber: '4111111111111111',
    });

    expect(delegate.fatal).toHaveBeenCalledWith({
      cardNumber: '[REDACTED]',
    });
  });
});
