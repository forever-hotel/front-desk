import { Test } from '@nestjs/testing';
import { OutboxDispatcherService } from '../messaging/outbox-dispatcher.service';
import { RabbitMqService } from '../messaging/rabbitmq/rabbitmq.service';
import { PrincipalResolver } from '../security/auth/principal-resolver';
import { RealtimeController } from './realtime.controller';
import { RealtimeModule } from './realtime.module';

describe('RealtimeModule authentication wiring', () => {
  it('compiles protected controllers with the configured principal resolver', async () => {
    const module = await Test.createTestingModule({
      imports: [RealtimeModule],
    })
      .overrideProvider(RabbitMqService)
      .useValue({ isEnabled: () => false })
      .overrideProvider(OutboxDispatcherService)
      .useValue({})
      .compile();

    try {
      expect(module.get(PrincipalResolver)).toBeDefined();
      expect(module.get(RealtimeController).getContract().authentication).toBe(
        'single-use-ticket',
      );
    } finally {
      await module.close();
    }
  });
});
