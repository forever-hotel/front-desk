export interface ActivateFossSessionInput {
  bookingReference: string;
  roomNumber: string;
}

export abstract class FossSessionGateway {
  abstract activateGuestSession(
    input: ActivateFossSessionInput,
  ): Promise<void>;
}