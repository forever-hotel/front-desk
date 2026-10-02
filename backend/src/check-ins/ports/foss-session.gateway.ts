export interface ActivateFossSessionInput {
  bookingReference: string;
  roomNumber: string;
  checkOutDate: string;
}

export interface ActivateFossSessionResult {
  status: 'ACTIVATED';
  sessionReference: string;
  validUntilDate: string;
}

export abstract class FossSessionGateway {
  abstract activateGuestSession(
    input: ActivateFossSessionInput,
  ): Promise<ActivateFossSessionResult>;
}
