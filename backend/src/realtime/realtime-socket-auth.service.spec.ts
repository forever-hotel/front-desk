import { jest } from '@jest/globals';

import type { PrincipalResolver } from '../security/auth/principal-resolver';
import { SystemRole } from '../security/auth/system-role';

import { RealtimeSocketAuthService } from './realtime-socket-auth.service';

describe('RealtimeSocketAuthService', () => {
  const resolver = {
    resolve: jest.fn<PrincipalResolver['resolve']>(),
  };

  const service = new RealtimeSocketAuthService(
    resolver as unknown as PrincipalResolver,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a missing JWT', async () => {
    expect(await service.authenticate(undefined)).toBeNull();
    expect(await service.authenticate('')).toBeNull();

    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired JWT', async () => {
    resolver.resolve.mockResolvedValue(null);

    expect(await service.authenticate('invalid-token')).toBeNull();
  });

  it('allows a receptionist', async () => {
    resolver.resolve.mockResolvedValue({
      userId: '66666666-6666-4666-8666-666666666666',
      role: SystemRole.RECEPTIONIST,
    });

    const result = await service.authenticate('valid-token');

    expect(result?.role).toBe(SystemRole.RECEPTIONIST);
  });

  it('allows a manager', async () => {
    resolver.resolve.mockResolvedValue({
      userId: '77777777-7777-4777-8777-777777777777',
      role: SystemRole.MANAGER,
    });

    const result = await service.authenticate('valid-token');

    expect(result?.role).toBe(SystemRole.MANAGER);
  });

  it('rejects a worker', async () => {
    resolver.resolve.mockResolvedValue({
      userId: '88888888-8888-4888-8888-888888888888',
      role: SystemRole.WORKER,
    });

    expect(await service.authenticate('valid-token')).toBeNull();
  });

  it('fails closed when JWT verification throws', async () => {
    resolver.resolve.mockRejectedValue(new Error('Authentication unavailable'));

    expect(await service.authenticate('test-token')).toBeNull();
  });
});
