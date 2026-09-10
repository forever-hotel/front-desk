import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { BookingRepository } from './repositories/booking.repository';
import { InMemoryBookingRepository } from './repositories/in-memory-booking.repository';

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BookingRepository,
          useClass: InMemoryBookingRepository,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('should find a booking by booking reference', async () => {
    const result = await service.search('FH-1001');

    expect(result).toHaveLength(1);
    expect(result[0].bookingReference).toBe('FH-1001');
  });

  it('should find a booking by partial guest name', async () => {
    const result = await service.search('kamal');

    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe('Kamal Perera');
  });

  it('should search case-insensitively', async () => {
    const result = await service.search('NIMALI');

    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe('Nimali Silva');
  });

  it('should return an empty array when no booking matches', async () => {
    const result = await service.search('NOT-EXIST');

    expect(result).toEqual([]);
  });

  it('should return an empty array for an empty search query', async () => {
    const result = await service.search('');

    expect(result).toEqual([]);
  });
});