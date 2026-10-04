import { RealtimeController } from './realtime.controller';
import { RealtimeStateService } from './realtime-state.service';

describe('RealtimeController', () => {
  let stateService: RealtimeStateService;
  let controller: RealtimeController;

  beforeEach(() => {
    stateService = new RealtimeStateService();

    controller = new RealtimeController(stateService);
  });

  it('should expose the realtime reconnect/fallback contract', () => {
    expect(controller.getContract()).toEqual(
      expect.objectContaining({
        version: 1,
        namespace: '/realtime',
        reconnect: {
          enabled: true,
          fullResyncAfterReconnect: true,
        },
      }),
    );
  });

  it('should expose recent escalation fallback state', () => {
    expect(controller.getRecentEscalations()).toEqual([]);
  });
});
