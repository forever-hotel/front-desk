import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from './authenticated-principal';

export function requireMatchingActor(
  claimedActorId: string,
  principal: AuthenticatedPrincipal,
): string {
  if (claimedActorId !== principal.userId) {
    throw new ForbiddenException(
      'Authenticated user does not match the operation actor',
    );
  }

  return principal.userId;
}
