import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingRepository } from '../bookings/repositories/booking.repository';
import { CheckInRequestDto } from './dto/check-in-request.dto';
import { CheckInResult } from './models/check-in-result';
import { FossSessionGateway } from './ports/foss-session.gateway';

@Injectable()
export class CheckInService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly fossSessionGateway: FossSessionGateway,
  ) {}

  async checkIn(dto: CheckInRequestDto): Promise<CheckInResult> {
    const bookingReference = dto.bookingReference?.trim();
    const roomNumber = dto.roomNumber?.trim();

    if (!bookingReference) {
      throw new BadRequestException('Booking reference is required');
    }

    if (!roomNumber) {
      throw new BadRequestException('Room number is required');
    }

    if (dto.idVerified !== true) {
      throw new BadRequestException(
        'Guest identity must be verified before check-in',
      );
    }

    const booking =
      await this.bookingRepository.findByReference(bookingReference);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException(
        `Booking cannot be checked in from status ${booking.status}`,
      );
    }

    await this.fossSessionGateway.activateGuestSession({
      bookingReference: booking.bookingReference,
      roomNumber,
    });

    await this.bookingRepository.markCheckedIn(
      booking.bookingReference,
    );

    return {
      status: 'checked_in',
      bookingReference: booking.bookingReference,
      roomNumber,
      fossSessionActivated: true,
    };
  }
}