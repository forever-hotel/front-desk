import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CreateWalkInBookingDto } from './dto/create-walk-in-booking.dto';
import { WalkInPaymentMethod } from './dto/walk-in-payment.dto';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: jest.Mocked<BookingsService>;

  beforeEach(async () => {
    const serviceMock = {
      search: jest.fn(),
      findRecent: jest.fn(),
      findArrivals: jest.fn(),
      findDepartures: jest.fn(),
      createWalkInBooking: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
    service = module.get(BookingsService);
  });

  it('should search bookings using the provided query', async () => {
    const result = [
      {
        bookingReference: 'FH-1001',
        guestName: 'Kamal Perera',
      },
    ];

    service.search.mockResolvedValue(result as never);

    await expect(controller.search('kamal')).resolves.toEqual(result);

    expect(service.search).toHaveBeenCalledWith('kamal');
  });

  it('should use an empty query by default', async () => {
    service.search.mockResolvedValue([]);

    await controller.search();

    expect(service.search).toHaveBeenCalledWith('');
  });

  it('should return recent bookings using the provided limit', async () => {
    const bookings = [{ bookingReference: 'FH-1001' }];

    service.findRecent.mockResolvedValue(bookings as never);

    await expect(controller.findRecent('10')).resolves.toEqual({
      value: bookings,
      count: 1,
    });

    expect(service.findRecent).toHaveBeenCalledWith(10);
  });

  it('should use the default limit when limit is invalid', async () => {
    service.findRecent.mockResolvedValue([]);

    await controller.findRecent('invalid');

    expect(service.findRecent).toHaveBeenCalledWith(5);
  });

  it('should return arrivals for the provided date', async () => {
    const bookings = [
      {
        bookingReference: 'booking-arrival-001',
      },
    ];

    service.findArrivals.mockResolvedValue(bookings as never);

    await expect(controller.findArrivals('2030-01-10')).resolves.toEqual(
      bookings,
    );

    expect(service.findArrivals).toHaveBeenCalledWith('2030-01-10');
  });

  it('should return departures for the provided date', async () => {
    const bookings = [
      {
        bookingReference: 'booking-departure-001',
      },
    ];

    service.findDepartures.mockResolvedValue(bookings as never);

    await expect(controller.findDepartures('2030-01-12')).resolves.toEqual(
      bookings,
    );

    expect(service.findDepartures).toHaveBeenCalledWith('2030-01-12');
  });

  it('should create a walk-in booking', async () => {
    const request: CreateWalkInBookingDto = {
      guest: {
        fullName: 'Walk In Guest',
        email: 'walk-in@example.invalid',
        nicOrPassport: 'WALK-IN-NIC-001',
        phone: '+94000000001',
      },
      booking: {
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        checkInDate: '2030-02-10',
        checkOutDate: '2030-02-12',
        numGuests: 2,
        specialRequests: 'Quiet room',
      },
      payment: {
        paymentMethod: WalkInPaymentMethod.CASH,
      },
    };

    const result = {
      bookingReference: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      source: 'WALK_IN',
      status: 'CONFIRMED',
    };

    service.createWalkInBooking.mockResolvedValue(result as never);

    await expect(controller.createWalkInBooking(request)).resolves.toEqual(
      result,
    );

    expect(service.createWalkInBooking).toHaveBeenCalledWith(request);
  });
});
