import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateWalkInBookingDto } from './dto/create-walk-in-booking.dto';
import { WalkInPaymentMethod } from './dto/walk-in-payment.dto';
import { BookingsService } from './bookings.service';
import type {
  WalkInBookingResult,
  WalkInRoomTypeDetails,
} from './models/walk-in-booking-result';
import { BookingRepository } from './repositories/booking.repository';
import { WalkInBookingRepository } from './repositories/walk-in-booking.repository';

describe('BookingsService', () => {
  let service: BookingsService;
  let repository: jest.Mocked<BookingRepository>;
  let walkInRepository: jest.Mocked<WalkInBookingRepository>;

  const roomType: WalkInRoomTypeDetails = {
    roomTypeId: '11111111-1111-4111-8111-111111111111',
    typeName: 'CI Standard Room',
    pricePerNight: 15000,
    maxGuests: 2,
  };

  const createWalkInRequest = (
    paymentMethod = WalkInPaymentMethod.CASH,
  ): CreateWalkInBookingDto => ({
    guest: {
      fullName: 'Walk In Guest',
      email: 'walk-in@example.invalid',
      nicOrPassport: 'WALK-IN-NIC-001',
      phone: '+94000000001',
    },
    booking: {
      roomTypeId: roomType.roomTypeId,
      checkInDate: '2030-02-10',
      checkOutDate: '2030-02-12',
      numGuests: 2,
      specialRequests: 'Quiet room',
    },
    payment: {
      paymentMethod,
    },
  });

  const walkInResult: WalkInBookingResult = {
    bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    bookingReference: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    guestId: null,
    guestAccountLinked: false,
    guest: {
      fullName: 'Walk In Guest',
      email: 'walk-in@example.invalid',
      nicOrPassport: 'WALK-IN-NIC-001',
      phone: '+94000000001',
    },
    roomTypeId: roomType.roomTypeId,
    roomType: roomType.typeName,
    checkInDate: '2030-02-10',
    checkOutDate: '2030-02-12',
    numGuests: 2,
    specialRequests: 'Quiet room',
    totalAmount: 30000,
    currency: 'LKR',
    status: 'CONFIRMED',
    source: 'WALK_IN',
    payment: {
      paymentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      paymentMethod: 'CASH',
      paymentStatus: 'COMPLETED',
      amount: 30000,
      paidAt: '2030-02-10T10:00:00.000Z',
    },
  };

  beforeEach(async () => {
    const repositoryMock = {
      search: jest.fn(),
      findRecent: jest.fn(),
      findArrivals: jest.fn(),
      findDepartures: jest.fn(),
    };

    const walkInRepositoryMock = {
      findRoomType: jest.fn(),
      createWalkInBooking: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BookingRepository,
          useValue: repositoryMock,
        },
        {
          provide: WalkInBookingRepository,
          useValue: walkInRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    repository = module.get(BookingRepository);
    walkInRepository = module.get(WalkInBookingRepository);
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

  it('should create a cash walk-in booking with server-calculated total', async () => {
    const request = createWalkInRequest();

    walkInRepository.findRoomType.mockResolvedValue(roomType);
    walkInRepository.createWalkInBooking.mockResolvedValue(walkInResult);

    await expect(service.createWalkInBooking(request)).resolves.toEqual(
      walkInResult,
    );

    expect(walkInRepository.findRoomType).toHaveBeenCalledWith(
      roomType.roomTypeId,
    );

    expect(walkInRepository.createWalkInBooking).toHaveBeenCalledWith({
      guest: {
        fullName: 'Walk In Guest',
        email: 'walk-in@example.invalid',
        nicOrPassport: 'WALK-IN-NIC-001',
        phone: '+94000000001',
      },
      roomType,
      checkInDate: '2030-02-10',
      checkOutDate: '2030-02-12',
      numGuests: 2,
      specialRequests: 'Quiet room',
      totalAmount: 30000,
      paymentMethod: 'CASH',
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'COMPLETED',
    });
  });

  it('should keep an on-site card booking pending until card payment is confirmed', async () => {
    const request = createWalkInRequest(WalkInPaymentMethod.CARD_ON_SITE);

    const cardResult: WalkInBookingResult = {
      ...walkInResult,
      status: 'PENDING',
      payment: {
        ...walkInResult.payment,
        paymentMethod: 'CARD_ON_SITE',
        paymentStatus: 'PENDING',
        paidAt: null,
      },
    };

    walkInRepository.findRoomType.mockResolvedValue(roomType);
    walkInRepository.createWalkInBooking.mockResolvedValue(cardResult);

    await expect(service.createWalkInBooking(request)).resolves.toEqual(
      cardResult,
    );

    expect(walkInRepository.createWalkInBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 30000,
        paymentMethod: 'CARD_ON_SITE',
        bookingStatus: 'PENDING',
        paymentStatus: 'PENDING',
      }),
    );
  });

  it('should reject an unknown room type', async () => {
    const request = createWalkInRequest();

    walkInRepository.findRoomType.mockResolvedValue(null);

    await expect(service.createWalkInBooking(request)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(walkInRepository.createWalkInBooking).not.toHaveBeenCalled();
  });

  it('should reject a checkout date equal to the check-in date', async () => {
    const request = createWalkInRequest();

    request.booking.checkOutDate = request.booking.checkInDate;

    await expect(service.createWalkInBooking(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(walkInRepository.findRoomType).not.toHaveBeenCalled();
  });

  it('should reject a checkout date before the check-in date', async () => {
    const request = createWalkInRequest();

    request.booking.checkOutDate = '2030-02-09';

    await expect(service.createWalkInBooking(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should reject an invalid calendar date', async () => {
    const request = createWalkInRequest();

    request.booking.checkInDate = '2030-02-30';

    await expect(service.createWalkInBooking(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(walkInRepository.findRoomType).not.toHaveBeenCalled();
  });

  it('should reject a malformed date', async () => {
    const request = createWalkInRequest();

    request.booking.checkInDate = '10-02-2030';

    await expect(service.createWalkInBooking(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should reject a guest count above room capacity', async () => {
    const request = createWalkInRequest();

    request.booking.numGuests = 3;

    walkInRepository.findRoomType.mockResolvedValue(roomType);

    await expect(service.createWalkInBooking(request)).rejects.toThrow(
      'Selected room type allows a maximum of 2 guests',
    );

    expect(walkInRepository.createWalkInBooking).not.toHaveBeenCalled();
  });

  it('should allow a single-night stay at maximum room capacity', async () => {
    const request = createWalkInRequest();

    request.booking.checkOutDate = '2030-02-11';
    request.booking.numGuests = 2;

    const singleNightResult: WalkInBookingResult = {
      ...walkInResult,
      checkOutDate: '2030-02-11',
      totalAmount: 15000,
      payment: {
        ...walkInResult.payment,
        amount: 15000,
      },
    };

    walkInRepository.findRoomType.mockResolvedValue(roomType);
    walkInRepository.createWalkInBooking.mockResolvedValue(singleNightResult);

    await service.createWalkInBooking(request);

    expect(walkInRepository.createWalkInBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        numGuests: 2,
        totalAmount: 15000,
      }),
    );
  });

  it('should reject an unsafe calculated total', async () => {
    const request = createWalkInRequest();

    walkInRepository.findRoomType.mockResolvedValue({
      ...roomType,
      pricePerNight: Number.MAX_SAFE_INTEGER,
    });

    await expect(service.createWalkInBooking(request)).rejects.toThrow(
      'Unable to calculate a valid booking total',
    );

    expect(walkInRepository.createWalkInBooking).not.toHaveBeenCalled();
  });
});
