import { Injectable } from '@nestjs/common';
import {
  ActivateFossSessionInput,
  ActivateFossSessionResult,
  DeactivateFossSessionInput,
  DeactivateFossSessionResult,
  FossSessionGateway,
} from '../ports/foss-session.gateway';

@Injectable()
export class MockFossSessionGateway extends FossSessionGateway {
  activateGuestSession(
    input: ActivateFossSessionInput,
  ): Promise<ActivateFossSessionResult> {
    return Promise.resolve({
      status: 'ACTIVATED',
      sessionReference: `mock-foss-session-${input.bookingReference}`,
      validUntilDate: input.checkOutDate,
    });
  }

  deactivateGuestSession(
    _input: DeactivateFossSessionInput,
  ): Promise<DeactivateFossSessionResult> {
    return Promise.resolve({
      status: 'DEACTIVATED',
    });
  }
}
