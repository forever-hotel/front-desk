import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExternalFolioCharge } from './models/external-folio-charge';
import { FolioBookingContext } from './models/folio-booking-context';
import { FolioCategorySummary } from './models/folio-category-summary';
import { FolioCategory } from './models/folio-category';
import { FolioItem } from './models/folio-item';
import { RunningFolio } from './models/running-folio';
import { ExternalFolioChargeGateway } from './ports/external-folio-charge.gateway';
import { FolioRepository } from './ports/folio.repository';

@Injectable()
export class FolioService {
  constructor(
    private readonly folioRepository: FolioRepository,
    private readonly externalFolioChargeGateway: ExternalFolioChargeGateway,
  ) {}

  async getRunningFolio(bookingReference: string): Promise<RunningFolio> {
    const booking =
      await this.folioRepository.findBookingContext(bookingReference);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.validateActiveStay(booking);
    this.validateRoomCharge(booking.roomCharge);

    let externalCharges: ExternalFolioCharge[];

    try {
      externalCharges =
        await this.externalFolioChargeGateway.findCharges(bookingReference);
    } catch {
      throw new ServiceUnavailableException(
        'Unable to retrieve external folio charges',
      );
    }

    const normalizedExternalCharges =
      this.normalizeExternalCharges(externalCharges);

    const roomItems: FolioItem[] = [
      {
        reference: `ROOM-${booking.bookingReference}`,
        description: 'Room accommodation',
        amount: booking.roomCharge,
        occurredAt: `${booking.checkInDate}T00:00:00.000Z`,
      },
    ];

    const foodItems = this.toFolioItems(
      normalizedExternalCharges.filter(
        (charge) => charge.category === FolioCategory.FOOD_AND_BEVERAGE,
      ),
    );

    const serviceItems = this.toFolioItems(
      normalizedExternalCharges.filter(
        (charge) => charge.category === FolioCategory.SERVICES,
      ),
    );

    const categories: FolioCategorySummary[] = [
      this.createCategorySummary(FolioCategory.ROOM_CHARGES, roomItems),
      this.createCategorySummary(FolioCategory.FOOD_AND_BEVERAGE, foodItems),
      this.createCategorySummary(FolioCategory.SERVICES, serviceItems),
    ];

    const total = this.sumAmounts(
      categories.map((category) => category.subtotal),
      'Unable to calculate a valid folio total',
    );

    return {
      bookingReference: booking.bookingReference,
      roomNumber: booking.roomNumber as string,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      bookingStatus: 'CHECKED_IN',
      currency: 'LKR',
      categories,
      total,
    };
  }

  private validateActiveStay(booking: FolioBookingContext): void {
    if (booking.bookingStatus !== 'CHECKED_IN') {
      throw new ConflictException('Booking is not an active checked-in stay');
    }

    if (!booking.roomNumber?.trim()) {
      throw new ConflictException(
        'Checked-in booking does not have an assigned room',
      );
    }
  }

  private validateRoomCharge(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new InternalServerErrorException(
        'Persisted booking amount is invalid',
      );
    }
  }

  private normalizeExternalCharges(
    charges: ExternalFolioCharge[],
  ): ExternalFolioCharge[] {
    if (!Array.isArray(charges)) {
      throw new ServiceUnavailableException(
        'External folio charge data is invalid',
      );
    }

    const normalized = charges.map((charge) => {
      if (
        charge.category !== FolioCategory.FOOD_AND_BEVERAGE &&
        charge.category !== FolioCategory.SERVICES
      ) {
        throw new ServiceUnavailableException(
          'External folio charge category is invalid',
        );
      }

      if (typeof charge.reference !== 'string' || !charge.reference.trim()) {
        throw new ServiceUnavailableException(
          'External folio charge reference is invalid',
        );
      }

      if (
        typeof charge.description !== 'string' ||
        !charge.description.trim()
      ) {
        throw new ServiceUnavailableException(
          'External folio charge description is invalid',
        );
      }

      if (!Number.isSafeInteger(charge.amount) || charge.amount < 0) {
        throw new ServiceUnavailableException(
          'External folio charge amount must be a non-negative integer',
        );
      }

      if (
        typeof charge.occurredAt !== 'string' ||
        !this.isValidIsoTimestamp(charge.occurredAt)
      ) {
        throw new ServiceUnavailableException(
          'External folio charge timestamp is invalid',
        );
      }

      return {
        reference: charge.reference.trim(),
        category: charge.category,
        description: charge.description.trim(),
        amount: charge.amount,
        occurredAt: new Date(charge.occurredAt).toISOString(),
      };
    });

    return normalized.sort((left, right) => {
      const timestampComparison = left.occurredAt.localeCompare(
        right.occurredAt,
      );

      if (timestampComparison !== 0) {
        return timestampComparison;
      }

      return left.reference.localeCompare(right.reference);
    });
  }

  private toFolioItems(charges: ExternalFolioCharge[]): FolioItem[] {
    return charges.map((charge) => ({
      reference: charge.reference,
      description: charge.description,
      amount: charge.amount,
      occurredAt: charge.occurredAt,
    }));
  }

  private createCategorySummary(
    category: FolioCategory,
    items: FolioItem[],
  ): FolioCategorySummary {
    return {
      category,
      items,
      subtotal: this.sumAmounts(
        items.map((item) => item.amount),
        `Unable to calculate ${category} subtotal`,
      ),
    };
  }

  private sumAmounts(amounts: number[], errorMessage: string): number {
    let total = 0;

    for (const amount of amounts) {
      if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new ServiceUnavailableException(errorMessage);
      }

      const nextTotal = total + amount;

      if (!Number.isSafeInteger(nextTotal)) {
        throw new ServiceUnavailableException(errorMessage);
      }

      total = nextTotal;
    }

    return total;
  }

  private isValidIsoTimestamp(value: string): boolean {
    const timestamp = Date.parse(value);

    return Number.isFinite(timestamp);
  }
}
