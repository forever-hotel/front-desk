import { Controller, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { FdsWriteAccess } from '../../security/auth/fds-access.decorator';
import { FossGuestQrService } from './foss-guest-qr.service';
import type { FossGuestQrResult } from './foss-guest-qr.service';

@Controller('check-in')
export class FossGuestQrController {
  constructor(private readonly qrService: FossGuestQrService) {}

  @Post(':bookingReference/foss-qr')
  @FdsWriteAccess()
  @Header('Cache-Control', 'no-store, private')
  @Header('Referrer-Policy', 'no-referrer')
  issue(
    @Param('bookingReference', new ParseUUIDPipe({ version: '4' }))
    bookingReference: string,
  ): Promise<FossGuestQrResult> {
    return this.qrService.issue(bookingReference);
  }
}
