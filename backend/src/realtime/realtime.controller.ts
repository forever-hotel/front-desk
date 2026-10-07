import { Controller, Get } from '@nestjs/common';
import type { TaskEscalatedEvent } from '../messaging/contracts/task-escalated.event';
import { FdsReadAccess } from '../security/auth/fds-access.decorator';
import {
  REALTIME_CONTRACT_VERSION,
  REALTIME_EVENTS,
  REALTIME_NAMESPACE,
} from './realtime.constants';
import { RealtimeStateService } from './realtime-state.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeStateService: RealtimeStateService) {}

  @Get('contract')
  @FdsReadAccess()
  getContract() {
    return {
      version: REALTIME_CONTRACT_VERSION,
      namespace: REALTIME_NAMESPACE,
      events: REALTIME_EVENTS,
      reconnect: {
        enabled: true,
        fullResyncAfterReconnect: true,
      },
      fallback: {
        roomStatus: {
          method: 'GET',
          path: '/rooms/status',
          pollIntervalMs: 5000,
        },
        escalations: {
          method: 'GET',
          path: '/realtime/escalations',
          pollIntervalMs: 5000,
        },
      },
    };
  }

  @Get('escalations')
  @FdsReadAccess()
  getRecentEscalations(): TaskEscalatedEvent[] {
    return this.realtimeStateService.getRecentEscalations();
  }
}
