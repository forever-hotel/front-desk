import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WkmsModule } from '../integrations/wkms/wkms.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SecurityModule } from '../security/security.module';
import { ServiceRequestRepository } from './ports/service-request.repository';
import { PostgresServiceRequestRepository } from './repositories/postgres-service-request.repository';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

@Module({
  imports: [WkmsModule, SecurityModule, AuditModule, RealtimeModule],

  controllers: [ServiceRequestsController],

  providers: [
    ServiceRequestsService,
    {
      provide: ServiceRequestRepository,

      useClass: PostgresServiceRequestRepository,
    },
  ],
})
export class ServiceRequestsModule {}
