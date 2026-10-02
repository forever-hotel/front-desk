import { Injectable } from '@nestjs/common';
import {
  ActivateFossSessionInput,
  ActivateFossSessionResult,
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
}
