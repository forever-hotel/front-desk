import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): { status: string; service: string } {
    return {
      status: 'ok',
      service: 'front-desk',
    };
  }

  @Get('ready')
  async getReadiness(): Promise<{
    status: string;
    database: string;
  }> {
    return this.healthService.checkDatabase();
  }
}
