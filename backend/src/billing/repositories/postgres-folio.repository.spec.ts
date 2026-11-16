import { DataSource } from 'typeorm';
import { PostgresFolioRepository } from './postgres-folio.repository';

describe('PostgresFolioRepository', () => {
  let repository: PostgresFolioRepository;

  let dataSource: {
    query: jest.Mock;
  };

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    };

    repository = new PostgresFolioRepository(
      dataSource as unknown as DataSource,
    );
  });

  it('should return the persisted booking context required by the folio', async () => {
    dataSource.query.mockResolvedValue([
      {
        bookingReference,
        roomNumber: 'T102',
        checkInDate: '2032-01-10',
        checkOutDate: '2032-01-12',
        bookingStatus: 'CHECKED_IN',
        roomCharge: 60000,
      },
    ]);

    const result = await repository.findBookingContext(bookingReference);

    expect(result).toEqual({
      bookingReference,
      roomNumber: 'T102',
      checkInDate: '2032-01-10',
      checkOutDate: '2032-01-12',
      bookingStatus: 'CHECKED_IN',
      roomCharge: 60000,
    });

    expect(dataSource.query).toHaveBeenCalledTimes(1);

    expect(dataSource.query.mock.calls[0][0]).toContain(
      'total_amount AS "roomCharge"',
    );

    expect(dataSource.query.mock.calls[0][0]).toContain('FROM bookings');

    expect(dataSource.query.mock.calls[0][0]).toContain(
      'WHERE booking_id = $1',
    );

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      bookingReference,
    ]);
  });

  it('should return null for an unknown booking', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(
      repository.findBookingContext(bookingReference),
    ).resolves.toBeNull();
  });

  it('should preserve a null room number for service validation', async () => {
    dataSource.query.mockResolvedValue([
      {
        bookingReference,
        roomNumber: null,
        checkInDate: '2032-01-10',
        checkOutDate: '2032-01-12',
        bookingStatus: 'CHECKED_IN',
        roomCharge: 60000,
      },
    ]);

    await expect(
      repository.findBookingContext(bookingReference),
    ).resolves.toEqual({
      bookingReference,
      roomNumber: null,
      checkInDate: '2032-01-10',
      checkOutDate: '2032-01-12',
      bookingStatus: 'CHECKED_IN',
      roomCharge: 60000,
    });
  });

  it('should normalize database scalar values into the folio context model', async () => {
    dataSource.query.mockResolvedValue([
      {
        bookingReference,
        roomNumber: 102,
        checkInDate: '2032-01-10',
        checkOutDate: '2032-01-12',
        bookingStatus: 'CHECKED_IN',
        roomCharge: '60000',
      },
    ]);

    const result = await repository.findBookingContext(bookingReference);

    expect(result).toEqual({
      bookingReference,
      roomNumber: '102',
      checkInDate: '2032-01-10',
      checkOutDate: '2032-01-12',
      bookingStatus: 'CHECKED_IN',
      roomCharge: 60000,
    });
  });

  it('should use a parameterized booking-reference query', async () => {
    dataSource.query.mockResolvedValue([]);

    await repository.findBookingContext(bookingReference);

    const [sql, parameters] = dataSource.query.mock.calls[0];

    expect(sql).toContain('WHERE booking_id = $1');

    expect(parameters).toEqual([bookingReference]);

    expect(sql).not.toContain(bookingReference);
  });
});
