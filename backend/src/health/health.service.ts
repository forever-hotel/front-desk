import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async checkDatabase(): Promise<{
    status: string;
    database: string;
  }> {
    try {
      await this.dataSource.query('SELECT 1');
      await this.dataSource.query(
        'SELECT event_id FROM public.fds_event_outbox LIMIT 0',
      );

      return {
        status: 'ready',
        database: 'up',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'down',
      });
    }
  }
}
