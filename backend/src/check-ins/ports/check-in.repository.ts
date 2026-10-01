import type { CheckInResult } from '../models/check-in-result';
import type { CheckInTransactionInput } from '../models/check-in-transaction';

export abstract class CheckInRepository {
  abstract checkIn(input: CheckInTransactionInput): Promise<CheckInResult>;
}
