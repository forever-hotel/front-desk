import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FossBookingServiceGuard } from './foss-booking-service.guard';

const secret = 'test-only-foss-authorization-key-123456789';

describe('FossBookingServiceGuard', () => {
  const config = { get: jest.fn() };
  const guard = new FossBookingServiceGuard(config as unknown as ConfigService);
  const context = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    config.get.mockReset().mockReturnValue(secret);
  });

  it('permits the configured server-to-server bearer key', () => {
    expect(guard.canActivate(context(`Bearer ${secret}`))).toBe(true);
  });

  it('rejects absent header', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });

  it('rejects incorrect key and non-Bearer authentication', () => {
    expect(() => guard.canActivate(context('Bearer incorrect'))).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(context(secret))).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when key is not configured', () => {
    config.get.mockReturnValue(undefined);
    expect(() => guard.canActivate(context(`Bearer ${secret}`))).toThrow(
      ServiceUnavailableException,
    );
  });
});
