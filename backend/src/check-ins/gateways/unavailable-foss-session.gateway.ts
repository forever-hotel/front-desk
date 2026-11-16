import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  FossSessionGateway,
  type ActivateFossSessionInput,
  type ActivateFossSessionResult,
  type DeactivateFossSessionInput,
  type DeactivateFossSessionResult,
} from '../ports/foss-session.gateway';
@Injectable()
export class UnavailableFossSessionGateway extends FossSessionGateway {
  activateGuestSession(
    _input: ActivateFossSessionInput,
  ): Promise<ActivateFossSessionResult> {
    return Promise.reject(
      new ServiceUnavailableException(
        'FOSS session provider is not integrated',
      ),
    );
  }
  deactivateGuestSession(
    _input: DeactivateFossSessionInput,
  ): Promise<DeactivateFossSessionResult> {
    return Promise.reject(
      new ServiceUnavailableException(
        'FOSS session provider is not integrated',
      ),
    );
  }
}
