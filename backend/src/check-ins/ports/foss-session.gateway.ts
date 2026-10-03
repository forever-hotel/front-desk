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

export interface DeactivateFossSessionInput {
  bookingReference: string;
  roomNumber: string;
}

export interface DeactivateFossSessionResult {
  status: 'DEACTIVATED';
}

export abstract class FossSessionGateway {
  abstract activateGuestSession(
    input: ActivateFossSessionInput,
  ): Promise<ActivateFossSessionResult>;

  abstract deactivateGuestSession(
    input: DeactivateFossSessionInput,
  ): Promise<DeactivateFossSessionResult>;
}
