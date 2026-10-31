import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { FossBookingVerificationService } from './foss-booking-verification.service';

const bookingId = '11111111-1111-4111-8111-111111111111';
const active = {
  bookingId,
  roomNumber: '203',
  status: 'CHECKED_IN',
  roomStatus: 'OCCUPIED',
  checkInDate: '2026-10-31',
  checkOutDate: '2026-11-02',
  guestName: 'FDS Test Guest',
};

describe('FossBookingVerificationService', () => {
  const database = { query: jest.fn() };
  const config = { get: jest.fn() };
  let service: FossBookingVerificationService;

  beforeEach(() => {
    database.query.mockReset();
    config.get.mockReset().mockReturnValue('12:00');
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-10-31T09:00:00Z').getTime());
    service = new FossBookingVerificationService(
      database as unknown as DataSource,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns FOSS adapter-compatible active stay information', async () => {
    database.query.mockResolvedValue([active]);
    await expect(service.verify(bookingId, '203')).resolves.toEqual({
      bookingId,
      roomNumber: '203',
      status: 'CHECKED_IN',
      stayStart: '2026-10-30T18:30:00.000Z',
      stayEnd: '2026-11-02T06:30:00.000Z',
      guestName: 'FDS Test Guest',
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE b.booking_id = $1'),
      [bookingId],
    );
  });

  it('rejects nonexistent booking', async () => {
    database.query.mockResolvedValue([]);
    await expect(service.verify(bookingId, '203')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    [{ status: 'CONFIRMED' }, '203'],
    [{ status: 'CHECKED_OUT' }, '203'],
    [{ roomStatus: 'VACANT' }, '203'],
    [{}, '201'],
  ])(
    'rejects mismatched or ineligible room/booking status',
    async (changes, requestedRoom) => {
      database.query.mockResolvedValue([{ ...active, ...changes }]);
      await expect(
        service.verify(bookingId, requestedRoom),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('rejects expired stay even when booking status still says CHECKED_IN', async () => {
    database.query.mockResolvedValue([
      { ...active, checkInDate: '2026-10-29', checkOutDate: '2026-10-30' },
    ]);
    await expect(service.verify(bookingId, '203')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects future stay dates', async () => {
    database.query.mockResolvedValue([
      { ...active, checkInDate: '2026-11-01' },
    ]);
    await expect(service.verify(bookingId, '203')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects after local checkout cutoff', async () => {
    database.query.mockResolvedValue([
      { ...active, checkOutDate: '2026-10-31' },
    ]);
    await expect(service.verify(bookingId, '203')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('fails closed for invalid hotel checkout time policy', async () => {
    database.query.mockResolvedValue([active]);
    config.get.mockReturnValue('invalid');
    await expect(service.verify(bookingId, '203')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
