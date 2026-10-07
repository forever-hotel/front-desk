import { Module } from '@nestjs/common';
import { FolioModule } from '../billing/folio.module';
import { CheckInModule } from '../check-ins/check-in.module';
import { MessagingModule } from '../messaging/messaging.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SecurityModule } from '../security/security.module';
import { CheckOutController } from './check-out.controller';
import { CheckOutService } from './check-out.service';
import { MockCheckoutPaymentGateway } from './gateways/mock-checkout-payment.gateway';
import { CheckoutPaymentGateway } from './ports/checkout-payment.gateway';
import { CheckoutRepository } from './ports/checkout.repository';
import { PostgresCheckoutRepository } from './repositories/postgres-checkout.repository';

@Module({
  imports: [
    FolioModule,
    CheckInModule,
    MessagingModule,
    RealtimeModule,
    SecurityModule,
  ],

  controllers: [CheckOutController],

  providers: [
    CheckOutService,
    {
      provide: CheckoutRepository,
      useClass: PostgresCheckoutRepository,
    },
    {
      provide: CheckoutPaymentGateway,
      useClass: MockCheckoutPaymentGateway,
    },
  ],
})
export class CheckOutModule {}
