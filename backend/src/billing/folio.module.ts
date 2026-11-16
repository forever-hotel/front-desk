import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { FolioController } from './folio.controller';
import { FolioService } from './folio.service';
import { MockExternalFolioChargeGateway } from './gateways/mock-external-folio-charge.gateway';
import { ExternalFolioChargeGateway } from './ports/external-folio-charge.gateway';
import { FolioRepository } from './ports/folio.repository';
import { PostgresFolioRepository } from './repositories/postgres-folio.repository';

@Module({
  imports: [SecurityModule],

  controllers: [FolioController],

  providers: [
    FolioService,
    {
      provide: FolioRepository,
      useClass: PostgresFolioRepository,
    },
    {
      provide: ExternalFolioChargeGateway,
      useClass: MockExternalFolioChargeGateway,
    },
  ],

  exports: [FolioService],
})
export class FolioModule {}
