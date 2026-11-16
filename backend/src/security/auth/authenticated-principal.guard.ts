import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithPrincipal } from './authenticated-principal';
import { PrincipalResolver } from './principal-resolver';

@Injectable()
export class AuthenticatedPrincipalGuard implements CanActivate {
  constructor(private readonly principalResolver: PrincipalResolver) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    const principal = await this.principalResolver.resolve(request);

    if (!principal) {
      throw new UnauthorizedException();
    }

    request.authenticatedPrincipal = principal;

    return true;
  }
}
