import { DataSource } from 'typeorm';
import { PostgresServiceRequestRepository } from './postgres-service-request.repository';

describe('PostgresServiceRequestRepository', () => {
  let repository: PostgresServiceRequestRepository;
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    };

    repository = new PostgresServiceRequestRepository(
      dataSource as unknown as DataSource,
    );
  });

  it('should return the booking stay required for FD-14', async () => {
    dataSource.query.mockResolvedValue([
      {
        bookingReference: '44444444-4444-4444-8444-444444444444',
        roomNumber: 'T102',
        bookingStatus: 'CHECKED_IN',
      },
    ]);

    await expect(
      repository.findStay('44444444-4444-4444-8444-444444444444'),
    ).resolves.toEqual({
      bookingReference: '44444444-4444-4444-8444-444444444444',
      roomNumber: 'T102',
      bookingStatus: 'CHECKED_IN',
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM bookings'),
      ['44444444-4444-4444-8444-444444444444'],
    );
  });

  it('should return null when the booking does not exist', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(
      repository.findStay('99999999-9999-4999-8999-999999999999'),
    ).resolves.toBeNull();
  });
});
