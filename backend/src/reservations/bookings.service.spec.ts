import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { BookingRepository } from './repositories/booking.repository';

describe('BookingsService', () => {
  let service: BookingsService;
  let repository: jest.Mocked<BookingRepository>;

  beforeEach(async () => {
    const repositoryMock = {
      search: jest.fn(),
      findRecent: jest.fn(),
      findArrivals: jest.fn(),
      findDepartures: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BookingRepository,
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    repository = module.get(BookingRepository);
  });

  it('should search bookings using the repository', async () => {
    const bookings = [
      {
        bookingId: 'booking-001',
        bookingReference: 'booking-001',
        guestName: 'Kamal Perera',
        email: 'kamal@example.com',
        phone: '0771234567',
        roomType: 'Deluxe',
        checkInDate: '2030-01-10',
        checkOutDate: '2030-01-12',
        status: 'CONFIRMED',
      },
    ];

    repository.search.mockResolvedValue(bookings);

    await expect(service.search('kamal')).resolves.toEqual(bookings);

    expect(repository.search).toHaveBeenCalledWith('kamal');
  });

  it('should return an empty result from repository search', async () => {
    repository.search.mockResolvedValue([]);

    await expect(service.search('NOT-EXIST')).resolves.toEqual([]);

    expect(repository.search).toHaveBeenCalledWith('NOT-EXIST');
  });

  it('should return recent bookings', async () => {
    repository.findRecent.mockResolvedValue([]);

    await service.findRecent(5);

    expect(repository.findRecent).toHaveBeenCalledWith(5);
  });

  it('should clamp recent booking limit to a minimum of 1', async () => {
    repository.findRecent.mockResolvedValue([]);

    await service.findRecent(0);

    expect(repository.findRecent).toHaveBeenCalledWith(1);
  });

  it('should clamp recent booking limit to a maximum of 20', async () => {
    repository.findRecent.mockResolvedValue([]);

    await service.findRecent(100);

    expect(repository.findRecent).toHaveBeenCalledWith(20);
  });

  it('should return arrivals for the provided date', async () => {
    const bookings = [
      {
        bookingId: 'arrival-001',
        bookingReference: 'arrival-001',
        guestName: 'Test Guest',
        email: 'test@example.com',
        phone: '0770000000',
        roomType: 'Standard',
        checkInDate: '2030-01-10',
        checkOutDate: '2030-01-12',
        status: 'CONFIRMED',
      },
    ];

    repository.findArrivals.mockResolvedValue(bookings);

    await expect(service.findArrivals('2030-01-10')).resolves.toEqual(bookings);

    expect(repository.findArrivals).toHaveBeenCalledWith('2030-01-10');
  });

  it('should return departures for the provided date', async () => {
    const bookings = [
      {
        bookingId: 'departure-001',
        bookingReference: 'departure-001',
        guestName: 'Test Guest',
        email: 'test@example.com',
        phone: '0770000000',
        roomType: 'Standard',
        checkInDate: '2030-01-10',
        checkOutDate: '2030-01-12',
        status: 'CHECKED_IN',
      },
    ];

    repository.findDepartures.mockResolvedValue(bookings);

    await expect(service.findDepartures('2030-01-12')).resolves.toEqual(
      bookings,
    );

    expect(repository.findDepartures).toHaveBeenCalledWith('2030-01-12');
  });
});
