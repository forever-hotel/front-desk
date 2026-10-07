import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from './authenticated-principal';
import { requireMatchingActor } from './actor-identity';
import { SystemRole } from './system-role';

describe('requireMatchingActor', () => {
  const principal: AuthenticatedPrincipal = {
    userId: '66666666-6666-4666-8666-666666666666',
    role: SystemRole.RECEPTIONIST,
  };

  it('returns the trusted authenticated user ID when the actor matches', () => {
    const result = requireMatchingActor(
      '66666666-6666-4666-8666-666666666666',
      principal,
    );

    expect(result).toBe(principal.userId);
  });

  it('rejects an attempt to act as another staff member', () => {
    expect(() =>
      requireMatchingActor('77777777-7777-4777-8777-777777777777', principal),
    ).toThrow(ForbiddenException);
  });
});
