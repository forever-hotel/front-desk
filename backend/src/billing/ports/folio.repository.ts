import { FolioBookingContext } from '../models/folio-booking-context';

export abstract class FolioRepository {
  abstract findBookingContext(
    bookingReference: string,
  ): Promise<FolioBookingContext | null>;
}
