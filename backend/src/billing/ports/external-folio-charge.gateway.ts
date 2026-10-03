import { ExternalFolioCharge } from '../models/external-folio-charge';

export abstract class ExternalFolioChargeGateway {
  abstract findCharges(
    bookingReference: string,
  ): Promise<ExternalFolioCharge[]>;
}
