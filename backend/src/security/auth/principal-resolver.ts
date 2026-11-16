import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal,
} from './authenticated-principal';

export abstract class PrincipalResolver {
  abstract resolve(
    request: RequestWithPrincipal,
  ): Promise<AuthenticatedPrincipal | null>;
}
