import { Module } from '@nestjs/common';
import { WkmsModule } from '../integrations/wkms/wkms.module';
import { ServiceRequestRepository } from './ports/service-request.repository';
import { PostgresServiceRequestRepository } from './repositories/postgres-service-request.repository';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

@Module({
  imports: [WkmsModule],
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
