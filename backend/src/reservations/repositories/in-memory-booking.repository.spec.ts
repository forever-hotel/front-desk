import { InMemoryBookingRepository } from './in-memory-booking.repository';

describe('InMemoryBookingRepository', () => {
  let repository: InMemoryBookingRepository;

  beforeEach(() => {
    repository = new InMemoryBookingRepository();
  });

  it('should return an empty array for an empty search query', async () => {
    await expect(repository.search('   ')).resolves.toEqual([]);
  });

  it('should search by booking reference', async () => {
    const result = await repository.search('FH-1001');

    expect(result).toHaveLength(1);
    expect(result[0].bookingReference).toBe('FH-1001');
  });

  it('should search by guest name', async () => {
    const result = await repository.search('kamal');

    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe('Kamal Perera');
  });

  it('should search by email', async () => {
    const result = await repository.search('nimali@example.com');

    expect(result).toHaveLength(1);
    expect(result[0].bookingReference).toBe('FH-1002');
  });

  it('should search by phone', async () => {
    const result = await repository.search('0719876543');

    expect(result).toHaveLength(1);
    expect(result[0].bookingReference).toBe('FH-1002');
  });

  it('should return an empty array when nothing matches', async () => {
    await expect(repository.search('NOT-EXIST')).resolves.toEqual([]);
  });

  it('should find a booking by reference', async () => {
    const result = await repository.findByReference('FH-1001');

    expect(result).not.toBeNull();
    expect(result?.bookingReference).toBe('FH-1001');
  });

  it('should return null when booking reference does not exist', async () => {
    await expect(repository.findByReference('UNKNOWN')).resolves.toBeNull();
  });

  it('should find a booking reference case-insensitively', async () => {
    const result = await repository.findByReference('fh-1001');

    expect(result?.bookingReference).toBe('FH-1001');
  });

  it('should return recent bookings using the provided limit', async () => {
    const result = await repository.findRecent(1);

    expect(result).toHaveLength(1);
  });

  it('should return confirmed arrivals for the provided date', async () => {
    const result = await repository.findArrivals('2026-09-10');

    expect(result).toHaveLength(1);
    expect(result[0].bookingReference).toBe('FH-1001');
    expect(result[0].status).toBe('CONFIRMED');
  });

  it('should return no arrivals when the date does not match', async () => {
    await expect(repository.findArrivals('2030-01-01')).resolves.toEqual([]);
  });

  it('should mark an existing booking as checked in', async () => {
    await repository.markCheckedIn('FH-1001');

    const booking = await repository.findByReference('FH-1001');

    expect(booking?.status).toBe('CHECKED_IN');
  });

  it('should not fail when marking an unknown booking as checked in', async () => {
    await expect(repository.markCheckedIn('UNKNOWN')).resolves.toBeUndefined();
  });

  it('should return checked-in departures for the provided date', async () => {
    await repository.markCheckedIn('FH-1001');

    const result = await repository.findDepartures('2026-09-12');

    expect(result).toHaveLength(1);
    expect(result[0].bookingReference).toBe('FH-1001');
    expect(result[0].status).toBe('CHECKED_IN');
  });

  it('should return no departures when booking is not checked in', async () => {
    await expect(repository.findDepartures('2026-09-13')).resolves.toEqual([]);
  });
});
