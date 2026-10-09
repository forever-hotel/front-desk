import { Module } from '@nestjs/common';

import { MessagingModule } from '../messaging/messaging.module';
import { SecurityModule } from '../security/security.module';

import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisherService } from './realtime-publisher.service';
import { RealtimeSocketAuthService } from './realtime-socket-auth.service';
import { RealtimeStateService } from './realtime-state.service';
import { TaskEscalationConsumer } from './task-escalation.consumer';

@Module({
  imports: [MessagingModule, SecurityModule],

  controllers: [RealtimeController],

  providers: [
    RealtimeGateway,
    RealtimeSocketAuthService,
    RealtimeStateService,
    RealtimePublisherService,
    TaskEscalationConsumer,
  ],

  exports: [RealtimePublisherService, RealtimeStateService],
})
export class RealtimeModule {}
