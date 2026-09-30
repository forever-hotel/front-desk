import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    };

    service = new HealthService(dataSource as unknown as DataSource);
  });

  it('should report database as ready when query succeeds', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.checkDatabase()).resolves.toEqual({
      status: 'ready',
      database: 'up',
    });

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('should report database as unavailable when query fails', async () => {
    dataSource.query.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.checkDatabase()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
