import { jest } from '@jest/globals';
import { RealtimeGateway } from './realtime.gateway';
import { RabbitMqService } from '../messaging/rabbitmq/rabbitmq.service';

describe('Shared realtime relay', () => {
  it('publishes only scoped invalidations through RabbitMQ', async () => {
    const publishRealtime = jest
      .fn<(system: string, name: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const relay = new RealtimeGateway({
      publishRealtime,
    } as unknown as RabbitMqService);
    relay.emitRoomStatusUpdated('private-record-id');
    expect(publishRealtime).toHaveBeenCalledWith('fds', 'room.status.updated');
    relay.emitTaskEscalated('private-record-id');
    expect(publishRealtime).toHaveBeenCalledWith('fds', 'task.escalated');
    expect(JSON.stringify(publishRealtime.mock.calls)).not.toContain(
      'private-record-id',
    );
    await Promise.resolve();
  });
  it('does not undo a committed operation when the broker is unavailable', async () => {
    const publishRealtime = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('offline'));
    const relay = new RealtimeGateway({
      publishRealtime,
    } as unknown as RabbitMqService);
    expect(() => relay.emitRoomStatusUpdated('record')).not.toThrow();
    await Promise.resolve();
  });
});
