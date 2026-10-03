import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CheckoutPaymentMethod } from '../models/checkout-payment-result';
import { PostgresCheckoutRepository } from './postgres-checkout.repository';

describe('PostgresCheckoutRepository', () => {
  let repository: PostgresCheckoutRepository;

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

  const bookingReference = '44444444-4444-4444-8444-444444444444';
  const performedBy = '66666666-6666-4666-8666-666666666666';
  const auditLogId = '88888888-8888-4888-8888-888888888888';
  const paymentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      query: jest.fn(),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };

    dataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn(() => queryRunner),
    };

    repository = new PostgresCheckoutRepository(
      dataSource as unknown as DataSource,
    );
  });

  describe('prepareCheckout', () => {
    function mockValidPreparation(
      previouslyPaid: number | string = 30000,
    ): void {
      dataSource.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid,
          },
        ]);
    }

    it('should return active checkout context and completed-payment total', async () => {
      mockValidPreparation('30000');

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).resolves.toEqual({
        bookingReference,
        roomNumber: 'T102',
        bookingStatus: 'CHECKED_IN',
        roomStatus: 'OCCUPIED',
        previouslyPaid: 30000,
      });

      expect(dataSource.query).toHaveBeenCalledTimes(3);

      expect(dataSource.query.mock.calls[0][0]).toContain('FROM staff_users');

      expect(dataSource.query.mock.calls[1][0]).toContain('FROM bookings b');

      expect(dataSource.query.mock.calls[1][0]).toContain('LEFT JOIN rooms r');

      expect(dataSource.query.mock.calls[2][0]).toContain(
        "payment_status = 'COMPLETED'",
      );

      expect(dataSource.query.mock.calls[2][1]).toEqual([bookingReference]);
    });

    it('should reject an unknown receptionist', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject a non-receptionist', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          workerId: performedBy,
          role: 'WORKER',
          isActive: true,
        },
      ]);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject an inactive receptionist', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          workerId: performedBy,
          role: 'RECEPTIONIST',
          isActive: false,
        },
      ]);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject an unknown booking', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should reject a booking that is not checked in', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CONFIRMED',
            roomStatus: 'OCCUPIED',
          },
        ]);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject a checked-in booking without an assigned room', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: null,
            bookingStatus: 'CHECKED_IN',
            roomStatus: null,
          },
        ]);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject when the assigned room cannot be resolved', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
            roomStatus: null,
          },
        ]);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject when the assigned room is not occupied', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
            roomStatus: 'REQUIRES_CLEANING',
          },
        ]);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should support zero completed payments', async () => {
      mockValidPreparation(0);

      const result = await repository.prepareCheckout({
        bookingReference,
        performedBy,
      });

      expect(result.previouslyPaid).toBe(0);
    });

    it('should reject a negative persisted completed-payment total', async () => {
      mockValidPreparation(-1);

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject an unsafe persisted completed-payment total', async () => {
      mockValidPreparation(String(Number.MAX_SAFE_INTEGER + 1));

      await expect(
        repository.prepareCheckout({
          bookingReference,
          performedBy,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('commitCheckout', () => {
    const checkoutInput = {
      bookingReference,
      performedBy,
      roomNumber: 'T102',
      folioTotal: 66000,
      previouslyPaid: 30000,
      finalPaymentAmount: 36000,
      paymentMethod: CheckoutPaymentMethod.CASH,
    };

    function mockSuccessfulCheckout(
      persistedPreviouslyPaid: number | string = 30000,
    ): void {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: persistedPreviouslyPaid,
          },
        ])
        .mockResolvedValueOnce([
          [
            {
              paymentId,
              paymentMethod: 'CASH',
              paymentStatus: 'COMPLETED',
              amount: 36000,
              paidAt: '2030-01-12T10:00:00.000Z',
            },
          ],
          1,
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          [
            {
              logId: auditLogId,
            },
          ],
          1,
        ]);
    }

    it('should lock and atomically persist the checkout core', async () => {
      mockSuccessfulCheckout();

      const result = await repository.commitCheckout(checkoutInput);

      expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);

      expect(queryRunner.query.mock.calls[0][0]).toContain('FOR SHARE');

      expect(queryRunner.query.mock.calls[1][0]).toContain('FOR UPDATE');

      expect(queryRunner.query.mock.calls[1][0]).toContain('FROM bookings');

      expect(queryRunner.query.mock.calls[2][0]).toContain('FOR UPDATE');

      expect(queryRunner.query.mock.calls[2][0]).toContain('FROM rooms');

      expect(queryRunner.query.mock.calls[3][0]).toContain(
        "payment_status = 'COMPLETED'",
      );

      expect(queryRunner.query.mock.calls[4][0]).toContain(
        'INSERT INTO payments',
      );

      expect(queryRunner.query.mock.calls[4][0]).toContain("'COMPLETED'");

      expect(queryRunner.query.mock.calls[4][1]).toEqual([
        bookingReference,
        CheckoutPaymentMethod.CASH,
        36000,
      ]);

      expect(queryRunner.query.mock.calls[5][0]).toContain('UPDATE bookings');

      expect(queryRunner.query.mock.calls[5][0]).toContain(
        "status = 'CHECKED_OUT'",
      );

      expect(queryRunner.query.mock.calls[6][0]).toContain('UPDATE rooms');

      expect(queryRunner.query.mock.calls[6][0]).toContain(
        "status = 'REQUIRES_CLEANING'",
      );

      expect(queryRunner.query.mock.calls[7][0]).toContain(
        'INSERT INTO audit_logs',
      );

      expect(queryRunner.query.mock.calls[7][0]).toContain("'CHECK_OUT'");

      const auditParameters = queryRunner.query.mock.calls[7][1];

      expect(JSON.parse(auditParameters[2])).toEqual({
        roomNumber: 'T102',
        folioTotal: 66000,
        previouslyPaid: 30000,
        finalPaymentAmount: 36000,
        paymentMethod: 'CASH',
      });

      expect(auditParameters[2]).not.toContain('cardNumber');

      expect(auditParameters[2]).not.toContain('cvv');

      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);

      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();

      expect(queryRunner.release).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        status: 'checked_out',
        bookingReference,
        roomNumber: 'T102',
        bookingStatus: 'CHECKED_OUT',
        roomStatus: 'REQUIRES_CLEANING',
        currency: 'LKR',
        folioTotal: 66000,
        previouslyPaid: 30000,
        finalPaymentAmount: 36000,
        payment: {
          paymentId,
          paymentMethod: CheckoutPaymentMethod.CASH,
          paymentStatus: 'COMPLETED',
          amount: 36000,
          paidAt: '2030-01-12T10:00:00.000Z',
        },
        auditLogId,
      });
    });

    it('should revalidate completed payments after locking the booking and room', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 31000,
          },
        ]);

      await expect(repository.commitCheckout(checkoutInput)).rejects.toThrow(
        'Completed-payment total changed before checkout could be committed',
      );

      expect(
        queryRunner.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO payments'),
        ),
      ).toBe(false);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should support fully paid checkout without inserting a zero payment', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 66000,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          [
            {
              logId: auditLogId,
            },
          ],
          1,
        ]);

      const result = await repository.commitCheckout({
        bookingReference,
        performedBy,
        roomNumber: 'T102',
        folioTotal: 66000,
        previouslyPaid: 66000,
        finalPaymentAmount: 0,
      });

      expect(
        queryRunner.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO payments'),
        ),
      ).toBe(false);

      expect(result.payment).toBeNull();
      expect(result.finalPaymentAmount).toBe(0);

      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('should reject an invalid receptionist and roll back', async () => {
      queryRunner.query.mockResolvedValueOnce([]);

      await expect(
        repository.commitCheckout(checkoutInput),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('should reject an unknown booking and roll back', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        repository.commitCheckout(checkoutInput),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should reject a booking that is no longer checked in', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_OUT',
          },
        ]);

      await expect(
        repository.commitCheckout(checkoutInput),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject a booking without an assigned room', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: null,
            bookingStatus: 'CHECKED_IN',
          },
        ]);

      await expect(
        repository.commitCheckout(checkoutInput),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject when the room assignment changed before commit', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T105',
            bookingStatus: 'CHECKED_IN',
          },
        ]);

      await expect(
        repository.commitCheckout(checkoutInput),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject when the locked assigned room cannot be resolved', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        repository.commitCheckout(checkoutInput),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject when the locked room is not occupied', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'REQUIRES_CLEANING',
          },
        ]);

      await expect(
        repository.commitCheckout(checkoutInput),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject invalid monetary state after locked-state revalidation', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 30000,
          },
        ]);

      await expect(
        repository.commitCheckout({
          ...checkoutInput,
          folioTotal: 66000.5,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject an overpaid financial state', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 66001,
          },
        ]);

      await expect(
        repository.commitCheckout({
          ...checkoutInput,
          folioTotal: 66000,
          previouslyPaid: 66001,
          finalPaymentAmount: 0,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should reject a final payment amount that does not match the balance', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 30000,
          },
        ]);

      await expect(
        repository.commitCheckout({
          ...checkoutInput,
          finalPaymentAmount: 35000,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should require payment method when a final payment is due', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 30000,
          },
        ]);

      await expect(
        repository.commitCheckout({
          ...checkoutInput,
          paymentMethod: undefined,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should roll back when payment persistence fails', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 30000,
          },
        ])
        .mockRejectedValueOnce(new Error('payment insert failed'));

      await expect(repository.commitCheckout(checkoutInput)).rejects.toThrow(
        'payment insert failed',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should roll back when booking update fails', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 30000,
          },
        ])
        .mockResolvedValueOnce([
          [
            {
              paymentId,
              paymentMethod: 'CASH',
              paymentStatus: 'COMPLETED',
              amount: 36000,
              paidAt: '2030-01-12T10:00:00.000Z',
            },
          ],
          1,
        ])
        .mockRejectedValueOnce(new Error('booking update failed'));

      await expect(repository.commitCheckout(checkoutInput)).rejects.toThrow(
        'booking update failed',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should roll back when room update fails', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 30000,
          },
        ])
        .mockResolvedValueOnce([
          [
            {
              paymentId,
              paymentMethod: 'CASH',
              paymentStatus: 'COMPLETED',
              amount: 36000,
              paidAt: '2030-01-12T10:00:00.000Z',
            },
          ],
          1,
        ])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('room update failed'));

      await expect(repository.commitCheckout(checkoutInput)).rejects.toThrow(
        'room update failed',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should roll back when checkout audit persistence fails', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          {
            workerId: performedBy,
            role: 'RECEPTIONIST',
            isActive: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            bookingReference,
            roomNumber: 'T102',
            bookingStatus: 'CHECKED_IN',
          },
        ])
        .mockResolvedValueOnce([
          {
            roomNumber: 'T102',
            roomStatus: 'OCCUPIED',
          },
        ])
        .mockResolvedValueOnce([
          {
            previouslyPaid: 30000,
          },
        ])
        .mockResolvedValueOnce([
          [
            {
              paymentId,
              paymentMethod: 'CASH',
              paymentStatus: 'COMPLETED',
              amount: 36000,
              paidAt: '2030-01-12T10:00:00.000Z',
            },
          ],
          1,
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await expect(repository.commitCheckout(checkoutInput)).rejects.toThrow(
        'Checkout audit record was not returned after insert',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();

      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });
});
