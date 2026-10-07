import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthenticatedPrincipalGuard } from './authenticated-principal.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { SystemRole } from './system-role';

export function FdsReadAccess() {
  return applyDecorators(
    UseGuards(AuthenticatedPrincipalGuard, RolesGuard),
    Roles(SystemRole.RECEPTIONIST, SystemRole.MANAGER),
  );
}

export function FdsWriteAccess() {
  return applyDecorators(
    UseGuards(AuthenticatedPrincipalGuard, RolesGuard),
    Roles(SystemRole.RECEPTIONIST),
  );
}
