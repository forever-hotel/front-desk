export enum SystemRole {
  GUEST = 'GUEST',
  RECEPTIONIST = 'RECEPTIONIST',
  KITCHEN_STAFF = 'KITCHEN_STAFF',
  KITCHEN_MANAGER = 'KITCHEN_MANAGER',
  WORKER = 'WORKER',
  MANAGER = 'MANAGER',
}

const SYSTEM_ROLES = new Set<string>(Object.values(SystemRole));

export function isSystemRole(value: unknown): value is SystemRole {
  return typeof value === 'string' && SYSTEM_ROLES.has(value);
}
