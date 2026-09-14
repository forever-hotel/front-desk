import { Injectable } from '@nestjs/common';
import { BookingSearchResult } from '../models/booking-search-result';
import { BookingRepository } from './booking.repository';

@Injectable()
export class InMemoryBookingRepository extends BookingRepository {
  private readonly bookings: BookingSearchResult[] = [
    {
      bookingId: 'booking-001',
      bookingReference: 'FH-1001',
      guestName: 'Kamal Perera',
      email: 'kamal@example.com',
      phone: '0771234567',
      roomType: 'Deluxe',
      checkInDate: '2026-09-10',
      checkOutDate: '2026-09-12',
      status: 'CONFIRMED',
    },
    {
      bookingId: 'booking-002',
      bookingReference: 'FH-1002',
      guestName: 'Nimali Silva',
      email: 'nimali@example.com',
      phone: '0719876543',
      roomType: 'Standard',
      checkInDate: '2026-09-11',
      checkOutDate: '2026-09-13',
      status: 'CONFIRMED',
    },
  ];

  async search(query: string): Promise<BookingSearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return this.bookings.filter((booking) => {
      return (
        booking.bookingReference.toLowerCase().includes(normalizedQuery) ||
        booking.guestName.toLowerCase().includes(normalizedQuery) ||
        booking.email?.toLowerCase().includes(normalizedQuery) ||
        booking.phone?.includes(normalizedQuery)
      );
    });
  }

  async findByReference(
  bookingReference: string,
): Promise<BookingSearchResult | null> {
  const normalizedReference = bookingReference.trim().toLowerCase();

  return (
    this.bookings.find(
      (booking) =>
        booking.bookingReference.toLowerCase() === normalizedReference,
    ) ?? null
  );
}
async findRecent(limit: number) {
  return this.bookings.slice(0, limit);
}
async markCheckedIn(bookingReference: string): Promise<void> {
  const booking = await this.findByReference(bookingReference);

  if (booking) {
    booking.status = 'CHECKED_IN';
  }
}
}