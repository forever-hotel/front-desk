import { NotFoundException } from '@nestjs/common';
import type { AuditLogEntry } from './models/audit-log-entry';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository } from './ports/audit-log.repository';

describe('AuditLogService', () => {
  let repository: {
    findMany: jest.Mock;
    findById: jest.Mock;
  };

  let service: AuditLogService;

  const auditEntry: AuditLogEntry = {
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
    repository = {
      findMany: jest.fn(),
      findById: jest.fn(),
    };

    service = new AuditLogService(repository as unknown as AuditLogRepository);
  });

  it('returns sanitized audit logs', async () => {
    repository.findMany.mockResolvedValue([
      {
        ...auditEntry,
        details: {
          roomNumber: 'T102',
          email: 'guest@example.com',
          authorization: 'Bearer secret-token',
        },
      },
    ]);

    const result = await service.findMany({
      limit: 20,
      offset: 0,
    });

    expect(result[0].details).toEqual({
      roomNumber: 'T102',
      email: '[REDACTED]',
      authorization: '[REDACTED]',
    });
  });

  it('preserves opaque operational identifiers', async () => {
    repository.findById.mockResolvedValue(auditEntry);

    const result = await service.findById(auditEntry.logId);

    expect(result.logId).toBe(auditEntry.logId);

    expect(result.staffUserId).toBe(auditEntry.staffUserId);

    expect(result.entityId).toBe(auditEntry.entityId);
  });

  it('throws NotFoundException when the audit log does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.findById('11111111-1111-4111-8111-111111111111'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes pagination and filters to the repository', async () => {
    repository.findMany.mockResolvedValue([]);

    const query = {
      limit: 50,
      offset: 100,
      eventCategory: 'FRONT_DESK_OPERATION',
      action: 'CHECK_OUT',
    };

    await service.findMany(query);

    expect(repository.findMany).toHaveBeenCalledWith(query);
  });
});
