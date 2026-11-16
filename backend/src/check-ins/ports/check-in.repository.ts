import type { CheckInPersistenceResult } from '../models/check-in-persistence-result';
import type { CheckInTransactionInput } from '../models/check-in-transaction';

export abstract class CheckInRepository {
  abstract checkIn(
    input: CheckInTransactionInput,
  ): Promise<CheckInPersistenceResult>;
}
