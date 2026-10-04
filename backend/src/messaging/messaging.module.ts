import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CheckoutCompletedPublisher } from './publishers/checkout-completed.publisher';
import {
  createRabbitMqConfig,
  RABBITMQ_CONFIG,
} from './rabbitmq/rabbitmq.config';
import { RabbitMqService } from './rabbitmq/rabbitmq.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RABBITMQ_CONFIG,
      inject: [ConfigService],
      useFactory: createRabbitMqConfig,
    },
    RabbitMqService,
    CheckoutCompletedPublisher,
  ],
  exports: [RABBITMQ_CONFIG, RabbitMqService, CheckoutCompletedPublisher],
})
export class MessagingModule {}
