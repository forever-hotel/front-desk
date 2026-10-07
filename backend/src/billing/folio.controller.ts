import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { FdsReadAccess } from '../security/auth/fds-access.decorator';
import { FolioService } from './folio.service';
import { RunningFolio } from './models/running-folio';

@Controller('folios')
export class FolioController {
  constructor(private readonly folioService: FolioService) {}

  @Get(':bookingReference')
  @FdsReadAccess()
  getRunningFolio(
    @Param(
      'bookingReference',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    bookingReference: string,
  ): Promise<RunningFolio> {
    return this.folioService.getRunningFolio(bookingReference);
  }
}
