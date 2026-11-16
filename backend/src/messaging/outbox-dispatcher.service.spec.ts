import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { DataSource } from 'typeorm';
import { RabbitMqService } from './rabbitmq/rabbitmq.service';
describe('FDS transactional outbox dispatcher', () => {
  function setup(failure = false) {
    const row = {
      event_id: 'checkout:booking',
      exchange_name: 'forever.events',
      routing_key: 'fds.checkout.completed.v1',
      payload: { eventId: 'checkout:booking' },
      attempts: 1,
    };
    const query = jest.fn().mockResolvedValue([]).mockResolvedValueOnce([row]);
    const transaction = jest.fn(async (fn) => fn({ query }));
    const publishJson = jest.fn();
    if (failure) publishJson.mockRejectedValue(new Error('offline'));
    else publishJson.mockResolvedValue(undefined);
    const dispatcher = new OutboxDispatcherService(
      { transaction } as unknown as DataSource,
      { publishJson } as unknown as RabbitMqService,
    );
    return { dispatcher, query, publishJson, row };
  }
  it('marks an intent only after confirmed publication', async () => {
    const f = setup();
    await f.dispatcher.dispatch();
    expect(f.publishJson).toHaveBeenCalledWith(
      f.row.routing_key,
      f.row.payload,
      { messageId: f.row.event_id },
      'forever.events',
    );
    expect(f.query.mock.calls[1][0]).toContain('published_at=now()');
  });
  it('retains the intent with bounded backoff when publication fails', async () => {
    const f = setup(true);
    await f.dispatcher.dispatch();
    expect(f.query.mock.calls[1][0]).toContain('next_attempt_at');
    expect(f.query.mock.calls[1][1]).toEqual(['checkout:booking', 2]);
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes('published_at=now()')),
    ).toBe(false);
  });
});
