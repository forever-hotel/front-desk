import { Injectable } from '@nestjs/common';
import { ExternalFolioCharge } from '../models/external-folio-charge';
import { ExternalFolioChargeGateway } from '../ports/external-folio-charge.gateway';

@Injectable()
export class MockExternalFolioChargeGateway extends ExternalFolioChargeGateway {
  findCharges(_bookingReference: string): Promise<ExternalFolioCharge[]> {
    return Promise.resolve([]);
  }
}
