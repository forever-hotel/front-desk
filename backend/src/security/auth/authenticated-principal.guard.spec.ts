import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from './authenticated-principal';
import { AuthenticatedPrincipalGuard } from './authenticated-principal.guard';
import { PrincipalResolver } from './principal-resolver';
import { SystemRole } from './system-role';

describe('AuthenticatedPrincipalGuard', () => {
  let resolver: {
    resolve: jest.Mock;
  };

  let guard: AuthenticatedPrincipalGuard;

  const principal: AuthenticatedPrincipal = {
    userId: '66666666-6666-4666-8666-666666666666',
    role: SystemRole.RECEPTIONIST,
  };

  beforeEach(() => {
    resolver = {
      resolve: jest.fn(),
    };

    guard = new AuthenticatedPrincipalGuard(
      resolver as unknown as PrincipalResolver,
    );
  });

  it('attaches the authenticated principal to the request', async () => {
    resolver.resolve.mockResolvedValue(principal);

    const request = {
      headers: {},
    };

    const context = createContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request).toEqual({
      headers: {},
      authenticatedPrincipal: principal,
    });
  });

  it('returns 401 when no authenticated principal can be resolved', async () => {
    resolver.resolve.mockResolvedValue(null);

    const context = createContext({
      headers: {},
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  function createContext(request: object): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }
});
