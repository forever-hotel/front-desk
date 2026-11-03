import { encryptPii, piiSearchQuery } from '../../security/guest-pii';
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
          guestName: null,
          email: null,
          phone: null,
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
          guestName: null,
          email: null,
          phone: null,
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
          guestName: null,
          email: null,
          phone: null,
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

describe('encrypted booking lookup', () => {
  it('uses keyed search and never exposes ciphertext or the identity-search field', async () => {
    const previous = { ...process.env };
    process.env.GUEST_PII_ENABLED = 'true';
    process.env.GUEST_PII_KEY = Buffer.alloc(32, 9).toString('base64');
    const query = jest.fn().mockResolvedValue([
      {
        bookingId: 'one',
        bookingReference: 'one',
        guestName: encryptPii('Test Guest', 'full_name'),
        email: encryptPii('test@example.com', 'email'),
        phone: null,
        searchIdentity: encryptPii('123456789V', 'nic_or_passport'),
      },
      {
        bookingId: 'two',
        bookingReference: 'two',
        guestName: encryptPii('Other Name', 'full_name'),
        email: null,
        phone: null,
        searchIdentity: null,
      },
    ]);
    try {
      const result = await new PostgresBookingRepository({
        query,
      } as unknown as DataSource).search('Guest');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('search_tokens @>'),
        ['%Guest%', piiSearchQuery('Guest')],
      );
      expect(result).toHaveLength(1);
      expect(result[0].guestName).toBe('Test Guest');
      expect(result[0]).not.toHaveProperty('searchIdentity');
    } finally {
      for (const name of ['GUEST_PII_ENABLED', 'GUEST_PII_KEY']) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });
});
