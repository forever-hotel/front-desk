import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithPrincipal } from './authenticated-principal';
import { ROLES_METADATA_KEY } from './roles.decorator';
import type { SystemRole } from './system-role';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    const principal = request.authenticatedPrincipal;

    if (!principal) {
      throw new UnauthorizedException();
    }

    if (!requiredRoles.includes(principal.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
