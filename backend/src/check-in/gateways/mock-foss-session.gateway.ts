import { Injectable } from '@nestjs/common';
import {
  ActivateFossSessionInput,
  FossSessionGateway,
} from '../ports/foss-session.gateway';

@Injectable()
export class MockFossSessionGateway extends FossSessionGateway {
  activateGuestSession(
    _input: ActivateFossSessionInput,
  ): Promise<void> {
    return Promise.resolve();
  }
}