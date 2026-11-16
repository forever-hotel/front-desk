import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import type { AuditLogEntry } from './models/audit-log-entry';

describe('AuditLogController', () => {
  let service: {
    findMany: jest.Mock;
    findById: jest.Mock;
  };

  let controller: AuditLogController;

  const entry: AuditLogEntry = {
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
  };

  beforeEach(() => {
    service = {
      findMany: jest.fn(),
      findById: jest.fn(),
    };

    controller = new AuditLogController(service as unknown as AuditLogService);
  });

  it('returns a filtered audit-log list', async () => {
    service.findMany.mockResolvedValue([entry]);

    const query = {
      limit: 25,
      offset: 0,
      eventCategory: 'FRONT_DESK_OPERATION',
      action: 'CHECK_IN',
    };

    const result = await controller.findMany(query);

    expect(service.findMany).toHaveBeenCalledWith(query);

    expect(result).toEqual([entry]);
  });

  it('returns one audit-log entry', async () => {
    service.findById.mockResolvedValue(entry);

    const result = await controller.findById(entry.logId);

    expect(service.findById).toHaveBeenCalledWith(entry.logId);

    expect(result).toEqual(entry);
  });
});
