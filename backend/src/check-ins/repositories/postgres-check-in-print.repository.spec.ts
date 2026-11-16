import { DataSource } from 'typeorm';
import { PostgresCheckInPrintRepository } from './postgres-check-in-print.repository';

describe('PostgresCheckInPrintRepository', () => {
  let repository: PostgresCheckInPrintRepository;

  let dataSource: {
    query: jest.Mock;
  };

  const bookingReference = '55555555-5555-4555-8555-555555555551';

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    };

    repository = new PostgresCheckInPrintRepository(
      dataSource as unknown as DataSource,
    );
  });

  it('should return the persisted print context', async () => {
    dataSource.query.mockResolvedValue([
      {
        bookingReference,
        roomNumber: 'T103',
        status: 'CHECKED_IN',
        checkInDate: '2032-01-10',
        checkOutDate: '2032-01-12',
      },
    ]);

    await expect(
      repository.findPrintContext(bookingReference),
    ).resolves.toEqual({
      bookingReference,
      roomNumber: 'T103',
      status: 'CHECKED_IN',
      checkInDate: '2032-01-10',
      checkOutDate: '2032-01-12',
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM bookings'),
      [bookingReference],
    );
  });

  it('should return null when the booking does not exist', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(
      repository.findPrintContext(bookingReference),
    ).resolves.toBeNull();
  });
});
