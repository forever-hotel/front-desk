import { SetMetadata } from '@nestjs/common';
import type { SystemRole } from './system-role';

export const ROLES_METADATA_KEY = 'required-system-roles';

export const Roles = (...roles: SystemRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
