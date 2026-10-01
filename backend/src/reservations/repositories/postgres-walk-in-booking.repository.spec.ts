import { DataSource } from 'typeorm';
import type { CreateWalkInBookingRecord } from '../models/walk-in-booking-result';
import { PostgresWalkInBookingRepository } from './postgres-walk-in-booking.repository';

describe('PostgresWalkInBookingRepository', () => {
  let repository: PostgresWalkInBookingRepository;

  let dataSource: {
    query: jest.Mock;
    createQueryRunner: jest.Mock;
  };

  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    query: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
  };

  const roomType = {
    roomTypeId: '11111111-1111-4111-8111-111111111111',
    typeName: 'CI Standard Room',
    pricePerNight: 15000,
    maxGuests: 2,
  };

  const createInput = (
    paymentMethod: 'CASH' | 'CARD_ON_SITE' = 'CASH',
  ): CreateWalkInBookingRecord => ({
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
    paymentMethod,
    bookingStatus: paymentMethod === 'CASH' ? 'CONFIRMED' : 'PENDING',
    paymentStatus: paymentMethod === 'CASH' ? 'COMPLETED' : 'PENDING',
  });

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn(() => queryRunner),
    };

    repository = new PostgresWalkInBookingRepository(
      dataSource as unknown as DataSource,
    );
  });

  it('should return room type details from PostgreSQL', async () => {
    dataSource.query.mockResolvedValue([
      {
        roomTypeId: roomType.roomTypeId,
        typeName: roomType.typeName,
        pricePerNight: '15000',
        maxGuests: '2',
      },
    ]);

    await expect(repository.findRoomType(roomType.roomTypeId)).resolves.toEqual(
      roomType,
    );

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM room_types'),
      [roomType.roomTypeId],
    );
  });

  it('should return null when the room type does not exist', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(
      repository.findRoomType(roomType.roomTypeId),
    ).resolves.toBeNull();
  });

  it('should create a cash walk-in booking inside a transaction', async () => {
    queryRunner.query
      .mockResolvedValueOnce([
        {
          guestId: '22222222-2222-4222-8222-222222222222',
        },
      ])
      .mockResolvedValueOnce([
        {
          bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          checkInDate: '2030-02-10',
          checkOutDate: '2030-02-12',
          status: 'CONFIRMED',
          totalAmount: 30000,
          source: 'WALK_IN',
          specialRequests: 'Quiet room',
          numGuests: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          paymentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          paymentMethod: 'CASH',
          amount: 30000,
          paymentStatus: 'COMPLETED',
          paidAt: '2030-02-10T10:00:00.000Z',
        },
      ]);

    const result = await repository.createWalkInBooking(createInput());

    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.startTransaction).toHaveBeenCalled();

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM guests'),
      ['walk-in@example.invalid'],
    );

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO bookings'),
      [
        '22222222-2222-4222-8222-222222222222',
        roomType.roomTypeId,
        '2030-02-10',
        '2030-02-12',
        'CONFIRMED',
        30000,
        'Quiet room',
        2,
      ],
    );

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO payments'),
      [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'CASH',
        30000,
        'COMPLETED',
        expect.any(String),
      ],
    );

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();

    expect(result).toEqual({
      bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      bookingReference: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      guestId: '22222222-2222-4222-8222-222222222222',
      guestAccountLinked: true,
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
    });
  });

  it('should create an anonymous pending card-on-site booking', async () => {
    queryRunner.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          bookingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          checkInDate: '2030-02-10',
          checkOutDate: '2030-02-12',
          status: 'PENDING',
          totalAmount: 30000,
          source: 'WALK_IN',
          specialRequests: null,
          numGuests: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          paymentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          paymentMethod: 'CARD_ON_SITE',
          amount: 30000,
          paymentStatus: 'PENDING',
          paidAt: null,
        },
      ]);

    const input = createInput('CARD_ON_SITE');
    input.specialRequests = undefined;

    const result = await repository.createWalkInBooking(input);

    expect(result.guestId).toBeNull();
    expect(result.guestAccountLinked).toBe(false);
    expect(result.status).toBe('PENDING');
    expect(result.specialRequests).toBeNull();
    expect(result.payment.paymentMethod).toBe('CARD_ON_SITE');
    expect(result.payment.paymentStatus).toBe('PENDING');
    expect(result.payment.paidAt).toBeNull();

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO payments'),
      [
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'CARD_ON_SITE',
        30000,
        'PENDING',
        null,
      ],
    );

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('should rollback the transaction when persistence fails', async () => {
    queryRunner.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          bookingId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          checkInDate: '2030-02-10',
          checkOutDate: '2030-02-12',
          status: 'CONFIRMED',
          totalAmount: 30000,
          source: 'WALK_IN',
          specialRequests: null,
          numGuests: 2,
        },
      ])
      .mockRejectedValueOnce(new Error('payment insert failed'));

    await expect(repository.createWalkInBooking(createInput())).rejects.toThrow(
      'payment insert failed',
    );

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });
});
