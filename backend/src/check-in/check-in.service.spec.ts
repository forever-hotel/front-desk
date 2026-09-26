import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingRepository } from '../bookings/repositories/booking.repository';
import { InMemoryBookingRepository } from '../bookings/repositories/in-memory-booking.repository';
import { CheckInService } from './check-in.service';
import { MockFossSessionGateway } from './gateways/mock-foss-session.gateway';
import { FossSessionGateway } from './ports/foss-session.gateway';

describe('CheckInService', () => {
  let service: CheckInService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInService,
        {
          provide: BookingRepository,
          useClass: InMemoryBookingRepository,
        },
        {
          provide: FossSessionGateway,
          useClass: MockFossSessionGateway,
        },
      ],
    }).compile();

    service = module.get<CheckInService>(CheckInService);
  });

  it('should check in a confirmed booking', async () => {
    const result = await service.checkIn({
      bookingReference: 'FH-1001',
      roomNumber: '205',
      idVerified: true,
    });

    expect(result).toEqual({
      status: 'checked_in',
      bookingReference: 'FH-1001',
      roomNumber: '205',
      fossSessionActivated: true,
    });
  });

  it('should reject an unknown booking', async () => {
    await expect(
      service.checkIn({
        bookingReference: 'UNKNOWN',
        roomNumber: '205',
        idVerified: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should reject check-in when ID is not verified', async () => {
    await expect(
      service.checkIn({
        bookingReference: 'FH-1001',
        roomNumber: '205',
        idVerified: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject check-in when room number is missing', async () => {
    await expect(
      service.checkIn({
        bookingReference: 'FH-1001',
        roomNumber: '',
        idVerified: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject a second check-in for the same booking', async () => {
    await service.checkIn({
      bookingReference: 'FH-1001',
      roomNumber: '205',
      idVerified: true,
    });

    await expect(
      service.checkIn({
        bookingReference: 'FH-1001',
        roomNumber: '205',
        idVerified: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
