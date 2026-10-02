import type { CheckInPrintContext } from '../models/check-in-print-context';

export abstract class CheckInPrintRepository {
  abstract findPrintContext(
    bookingReference: string,
  ): Promise<CheckInPrintContext | null>;
}
