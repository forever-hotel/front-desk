import { DataSource } from 'typeorm';
import { AuditEventWriter } from './audit-event.writer';

describe('AuditEventWriter', () => {
  let writer: AuditEventWriter;

  let dataSource: {
    query: jest.Mock;
  };

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    };

    writer = new AuditEventWriter(dataSource as unknown as DataSource);
  });

  it('should record a parameterized manual-task-assignment audit event', async () => {
    dataSource.query.mockResolvedValue([]);

    await writer.recordManualTaskAssignment({
      staffUserId: '66666666-6666-4666-8666-666666666666',

      taskId: '11111111-1111-4111-8111-111111111111',

      workerId: '88888888-8888-4888-8888-888888888888',

      assignmentStatus: 'ASSIGNED',

      assignedAt: '2030-01-10T12:05:00.000Z',
    });

    expect(dataSource.query).toHaveBeenCalledTimes(1);

    const [sql, parameters] = dataSource.query.mock.calls[0];

    expect(String(sql)).toContain('MANUAL_TASK_ASSIGNMENT');

    expect(String(sql)).toContain("'TASK_SERVICE'");

    expect(parameters).toEqual([
      '66666666-6666-4666-8666-666666666666',

      '11111111-1111-4111-8111-111111111111',

      JSON.stringify({
        workerId: '88888888-8888-4888-8888-888888888888',

        assignmentStatus: 'ASSIGNED',

        assignedAt: '2030-01-10T12:05:00.000Z',
      }),
    ]);
  });

  it('should not interpolate audit values into SQL text', async () => {
    dataSource.query.mockResolvedValue([]);

    const taskId = '11111111-1111-4111-8111-111111111111';

    const workerId = '88888888-8888-4888-8888-888888888888';

    await writer.recordManualTaskAssignment({
      staffUserId: '66666666-6666-4666-8666-666666666666',

      taskId,

      workerId,

      assignmentStatus: 'ASSIGNED',
    });

    const [sql] = dataSource.query.mock.calls[0];

    expect(String(sql)).not.toContain(taskId);

    expect(String(sql)).not.toContain(workerId);
  });
});
