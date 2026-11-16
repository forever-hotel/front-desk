import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal,
} from './authenticated-principal';

export const CurrentPrincipal = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): AuthenticatedPrincipal | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    return request.authenticatedPrincipal;
  },
);
