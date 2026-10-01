import { DataSource } from 'typeorm';
import { PostgresBookingRepository } from './postgres-booking.repository';

describe('PostgresBookingRepository', () => {
  let repository: PostgresBookingRepository;
  let dataSource: {
    query: jest.Mock;
  };

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    };

    repository = new PostgresBookingRepository(
      dataSource as unknown as DataSource,
    );
  });

  describe('search', () => {
    it('should return an empty array when query is empty', async () => {
      const result = await repository.search('   ');

      expect(result).toEqual([]);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('should search persisted bookings using the normalized query', async () => {
      const rows = [
        {
          bookingId: '33333333-3333-4333-8333-333333333333',
          bookingReference: '33333333-3333-4333-8333-333333333333',
          guestName: 'CI Test Guest',
          email: 'ci-test-guest@example.invalid',
          phone: '+94000000000',
          roomType: 'CI Standard Room',
          checkInDate: '2030-01-10',
          checkOutDate: '2030-01-12',
          status: 'CONFIRMED',
        },
      ];

      dataSource.query.mockResolvedValue(rows);

      const result = await repository.search('  CI Test Guest  ');

      expect(result).toEqual(rows);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM bookings b'),
        ['%CI Test Guest%'],
      );
    });
  });

  describe('findRecent', () => {
    it('should return recent persisted bookings using the provided limit', async () => {
      const rows = [
        {
          bookingId: '33333333-3333-4333-8333-333333333333',
          bookingReference: '33333333-3333-4333-8333-333333333333',
        },
      ];

      dataSource.query.mockResolvedValue(rows);

      const result = await repository.findRecent(5);

      expect(result).toEqual(rows);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY b.created_at DESC'),
        [5],
      );
    });
  });

  describe('findArrivals', () => {
    it('should return confirmed arrivals for the provided date', async () => {
      const rows = [
        {
          bookingId: 'arrival-001',
          bookingReference: 'arrival-001',
          status: 'CONFIRMED',
          checkInDate: '2030-01-10',
        },
      ];

      dataSource.query.mockResolvedValue(rows);

      const result = await repository.findArrivals('2030-01-10');

      expect(result).toEqual(rows);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("b.status = 'CONFIRMED'"),
        ['2030-01-10'],
      );
    });
  });

  describe('findDepartures', () => {
    it('should return checked-in departures for the provided date', async () => {
      const rows = [
        {
          bookingId: 'departure-001',
          bookingReference: 'departure-001',
          status: 'CHECKED_IN',
          checkOutDate: '2030-01-12',
        },
      ];

      dataSource.query.mockResolvedValue(rows);

      const result = await repository.findDepartures('2030-01-12');

      expect(result).toEqual(rows);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("b.status = 'CHECKED_IN'"),
        ['2030-01-12'],
      );
    });
  });
});
