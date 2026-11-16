import type { SystemRole } from './system-role';

export interface AuthenticatedPrincipal {
  userId: string;
  role: SystemRole;
}

export interface RequestWithPrincipal {
  headers: Record<string, string | string[] | undefined>;

  authenticatedPrincipal?: AuthenticatedPrincipal;
}
