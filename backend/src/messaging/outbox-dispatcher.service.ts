import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RabbitMqService } from './rabbitmq/rabbitmq.service';
@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private resumeAt = 0;
  constructor(
    private readonly database: DataSource,
    private readonly broker: RabbitMqService,
  ) {}
  onModuleInit() {
    if (!this.broker.isEnabled()) return;
    const tick = () => {
      if (this.running || Date.now() < this.resumeAt) return;
      this.running = this.dispatch()
        .catch(() => {
          this.resumeAt = Date.now() + 5000;
          this.logger.warn(
            'FDS outbox unavailable; check the manual integration SQL.',
          );
        })
        .finally(() => {
          this.running = undefined;
        });
    };
    this.timer = setInterval(tick, 250);
    this.timer.unref();
    tick();
  }
  async dispatch() {
    for (let i = 0; i < 100; i++) {
      const next = await this.database.transaction(async (manager) => {
        const [row] = await manager.query<
          {
            event_id: string;
            exchange_name: string;
            routing_key: string;
            payload: unknown;
            attempts: number;
          }[]
        >(
          'SELECT * FROM public.fds_event_outbox WHERE published_at IS NULL AND next_attempt_at<=now() ORDER BY created_at,event_id FOR UPDATE SKIP LOCKED LIMIT 1',
        );
        if (!row) return false;
        try {
          await this.broker.publishJson(
            row.routing_key,
            row.payload,
            { messageId: row.event_id },
            row.exchange_name,
          );
        } catch {
          await manager.query(
            "UPDATE public.fds_event_outbox SET attempts=attempts+1,last_error='PUBLICATION_FAILED',next_attempt_at=now()+($2*interval '1 second') WHERE event_id=$1",
            [row.event_id, Math.min(60, 2 ** Math.min(row.attempts, 6))],
          );
          return false;
        }
        await manager.query(
          'UPDATE public.fds_event_outbox SET published_at=now(),attempts=attempts+1,last_error=NULL WHERE event_id=$1',
          [row.event_id],
        );
        return true;
      });
      if (!next) break;
    }
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
}
