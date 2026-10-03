import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { RunningFolio } from './models/running-folio';
import { FolioService } from './folio.service';

@Controller('folios')
export class FolioController {
  constructor(private readonly folioService: FolioService) {}

  @Get(':bookingReference')
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
