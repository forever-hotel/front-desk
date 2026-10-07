import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { SystemRole } from './system-role';

describe('RolesGuard', () => {
  let reflector: {
    getAllAndOverride: jest.Mock;
  };

  let guard: RolesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows routes without role metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext({}))).toBe(true);
  });

  it('allows a receptionist on a receptionist route', () => {
    reflector.getAllAndOverride.mockReturnValue([SystemRole.RECEPTIONIST]);

    const context = createContext({
      authenticatedPrincipal: {
        userId: '66666666-6666-4666-8666-666666666666',
        role: SystemRole.RECEPTIONIST,
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a manager on a read-only route that explicitly permits managers', () => {
    reflector.getAllAndOverride.mockReturnValue([
      SystemRole.RECEPTIONIST,
      SystemRole.MANAGER,
    ]);

    const context = createContext({
      authenticatedPrincipal: {
        userId: '77777777-7777-4777-8777-777777777777',
        role: SystemRole.MANAGER,
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns 401 when authentication was not established', () => {
    reflector.getAllAndOverride.mockReturnValue([SystemRole.RECEPTIONIST]);

    expect(() => guard.canActivate(createContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns 403 for an authenticated user with the wrong role', () => {
    reflector.getAllAndOverride.mockReturnValue([SystemRole.RECEPTIONIST]);

    const context = createContext({
      authenticatedPrincipal: {
        userId: '88888888-8888-4888-8888-888888888888',
        role: SystemRole.WORKER,
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  function createContext(request: object): ExecutionContext {
    return {
      getHandler: () => function handler() {},
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }
});
