import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisherService } from './realtime-publisher.service';
import { RealtimeStateService } from './realtime-state.service';
import { TaskEscalationConsumer } from './task-escalation.consumer';

@Module({
  imports: [MessagingModule],
  controllers: [RealtimeController],
  providers: [
    RealtimeGateway,
    RealtimeStateService,
    RealtimePublisherService,
    TaskEscalationConsumer,
  ],
  exports: [RealtimePublisherService],
})
export class RealtimeModule {}
