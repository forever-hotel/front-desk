import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWalkInBookingDto } from './dto/create-walk-in-booking.dto';
import { WalkInPaymentMethod } from './dto/walk-in-payment.dto';
import { BookingSearchResult } from './models/booking-search-result';
import { WalkInBookingResult } from './models/walk-in-booking-result';
import { BookingRepository } from './repositories/booking.repository';
import { WalkInBookingRepository } from './repositories/walk-in-booking.repository';

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly walkInBookingRepository: WalkInBookingRepository,
  ) {}

  search(query: string): Promise<BookingSearchResult[]> {
    return this.bookingRepository.search(query);
  }

  async findRecent(limit = 5) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    return this.bookingRepository.findRecent(safeLimit);
  }

  findArrivals(date: string): Promise<BookingSearchResult[]> {
    return this.bookingRepository.findArrivals(date);
  }

  findDepartures(date: string): Promise<BookingSearchResult[]> {
    return this.bookingRepository.findDepartures(date);
  }

  async createWalkInBooking(
    request: CreateWalkInBookingDto,
  ): Promise<WalkInBookingResult> {
    const checkInDate = this.parseDateOnly(
      request.booking.checkInDate,
      'checkInDate',
    );

    const checkOutDate = this.parseDateOnly(
      request.booking.checkOutDate,
      'checkOutDate',
    );

    const stayMilliseconds = checkOutDate.getTime() - checkInDate.getTime();

    const nights = stayMilliseconds / (24 * 60 * 60 * 1000);

    if (!Number.isInteger(nights) || nights < 1) {
      throw new BadRequestException('checkOutDate must be after checkInDate');
    }

    const roomType = await this.walkInBookingRepository.findRoomType(
      request.booking.roomTypeId,
    );

    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }

    if (request.booking.numGuests > roomType.maxGuests) {
      throw new BadRequestException(
        `Selected room type allows a maximum of ${roomType.maxGuests} guests`,
      );
    }

    const totalAmount = roomType.pricePerNight * nights;

    if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
      throw new BadRequestException(
        'Unable to calculate a valid booking total',
      );
    }

    const isCashPayment =
      request.payment.paymentMethod === WalkInPaymentMethod.CASH;

    return this.walkInBookingRepository.createWalkInBooking({
      guest: {
        fullName: request.guest.fullName.trim(),
        email: request.guest.email.trim().toLowerCase(),
        nicOrPassport: request.guest.nicOrPassport?.trim() || undefined,
        phone: request.guest.phone?.trim() || undefined,
      },
      roomType,
      checkInDate: request.booking.checkInDate,
      checkOutDate: request.booking.checkOutDate,
      numGuests: request.booking.numGuests,
      specialRequests: request.booking.specialRequests?.trim() || undefined,
      totalAmount,
      paymentMethod: request.payment.paymentMethod,
      bookingStatus: isCashPayment ? 'CONFIRMED' : 'PENDING',
      paymentStatus: isCashPayment ? 'COMPLETED' : 'PENDING',
    });
  }

  private parseDateOnly(value: string, fieldName: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const timestamp = Date.UTC(year, month - 1, day);
    const parsedDate = new Date(timestamp);

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      throw new BadRequestException(
        `${fieldName} must be a valid calendar date`,
      );
    }

    return parsedDate;
  }
}
