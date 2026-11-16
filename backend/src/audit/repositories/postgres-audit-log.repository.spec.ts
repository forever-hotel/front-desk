import type { DataSource } from 'typeorm';
import { PostgresAuditLogRepository } from './postgres-audit-log.repository';

describe('PostgresAuditLogRepository', () => {
  let query: jest.Mock;

  let repository: PostgresAuditLogRepository;

  beforeEach(() => {
    query = jest.fn();

    repository = new PostgresAuditLogRepository({
      query,
    } as unknown as DataSource);
  });

  it('loads recent audit logs with parameterized pagination', async () => {
    query.mockResolvedValue([
      {
        logId: '11111111-1111-4111-8111-111111111111',
        eventCategory: 'FRONT_DESK_OPERATION',
        actorType: 'STAFF',
        staffUserId: '66666666-6666-4666-8666-666666666666',
        action: 'CHECK_IN',
        entityType: 'BOOKING',
        entityId: '44444444-4444-4444-8444-444444444444',
        details: {
          roomNumber: 'T102',
        },
        createdAt: new Date('2030-01-01T10:00:00.000Z'),
      },
    ]);

    const result = await repository.findMany({
      limit: 25,
      offset: 0,
    });

    expect(query).toHaveBeenCalledTimes(1);

    const [sql, parameters] = query.mock.calls[0];

    expect(sql).toContain('LIMIT $1');
    expect(sql).toContain('OFFSET $2');

    expect(parameters).toEqual([25, 0]);

    expect(result).toEqual([
      {
        logId: '11111111-1111-4111-8111-111111111111',
        eventCategory: 'FRONT_DESK_OPERATION',
        actorType: 'STAFF',
        staffUserId: '66666666-6666-4666-8666-666666666666',
        action: 'CHECK_IN',
        entityType: 'BOOKING',
        entityId: '44444444-4444-4444-8444-444444444444',
        details: {
          roomNumber: 'T102',
        },
        createdAt: '2030-01-01T10:00:00.000Z',
      },
    ]);
  });

  it('parameterizes category and action filters', async () => {
    query.mockResolvedValue([]);

    await repository.findMany({
      limit: 20,
      offset: 40,
      eventCategory: 'FRONT_DESK_OPERATION',
      action: 'CHECK_OUT',
    });

    const [sql, parameters] = query.mock.calls[0];

    expect(sql).toContain('event_category::text = $1');

    expect(sql).toContain('action = $2');

    expect(sql).toContain('LIMIT $3');

    expect(sql).toContain('OFFSET $4');

    expect(parameters).toEqual(['FRONT_DESK_OPERATION', 'CHECK_OUT', 20, 40]);
  });

  it('does not interpolate an SQL injection payload into the SQL string', async () => {
    query.mockResolvedValue([]);

    const maliciousAction = "' OR 1=1 --";

    await repository.findMany({
      limit: 10,
      offset: 0,
      action: maliciousAction,
    });

    const [sql, parameters] = query.mock.calls[0];

    expect(sql).not.toContain(maliciousAction);

    expect(sql).toContain('action = $1');

    expect(parameters).toEqual([maliciousAction, 10, 0]);
  });

  it('finds one audit log by parameterized UUID', async () => {
    const logId = '11111111-1111-4111-8111-111111111111';

    query.mockResolvedValue([
      {
        logId,
        eventCategory: 'FRONT_DESK_OPERATION',
        actorType: 'STAFF',
        staffUserId: null,
        action: 'ROOM_CHANGE',
        entityType: 'BOOKING',
        entityId: '44444444-4444-4444-8444-444444444444',
        details: null,
        createdAt: '2030-01-01T10:00:00.000Z',
      },
    ]);

    const result = await repository.findById(logId);

    const [sql, parameters] = query.mock.calls[0];

    expect(sql).toContain('WHERE log_id = $1');

    expect(sql).not.toContain(logId);

    expect(parameters).toEqual([logId]);

    expect(result?.logId).toBe(logId);
  });

  it('returns null when an audit log does not exist', async () => {
    query.mockResolvedValue([]);

    const result = await repository.findById(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(result).toBeNull();
  });
});
