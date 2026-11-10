import { ConflictException, BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { PostgresWalkInPaymentRepository } from './postgres-walk-in-payment.repository';

const bookingReference = '11111111-1111-4111-8111-111111111111';
const performedBy = '22222222-2222-4222-8222-222222222222';
const paymentId = '33333333-3333-4333-8333-333333333333';

function setup(options: {
  method?: 'CASH' | 'CARD_ON_SITE';
  status?: 'PENDING' | 'COMPLETED';
  isActive?: boolean;
  source?: 'WALK_IN' | 'WEBSITE';
  paymentAmount?: number;
} = {}) {
  const commits = jest.fn();
  const rollbacks = jest.fn();
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM staff_users'))
      return [{ role: 'RECEPTIONIST', roles: ['RECEPTIONIST'], isActive: options.isActive ?? true }];
    if (sql.includes('FROM bookings'))
      return [{
        bookingReference,
        bookingStatus: 'PENDING',
        bookingSource: options.source ?? 'WALK_IN',
        totalAmount: 18000,
      }];
    if (sql.includes('FROM payments'))
      return [{
        paymentId,
        paymentMethod: options.method ?? 'CASH',
        paymentStatus: options.status ?? 'PENDING',
        amount: options.paymentAmount ?? 18000,
      }];
    if (sql.includes('UPDATE payments'))
      return [{ paidAt: new Date('2026-11-10T10:00:00.000Z') }];
    if (sql.includes('UPDATE bookings')) return [{ booking_id: bookingReference }];
    if (sql.includes('INSERT INTO audit_logs'))
      return [{ auditLogId: '44444444-4444-4444-8444-444444444444' }];
    throw new Error(`Unexpected query ${sql}`);
  });
  const runner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query,
    commitTransaction: commits,
    rollbackTransaction: rollbacks,
    release: jest.fn(),
  };
  const source = {
    createQueryRunner: () => runner,
    query,
  } as unknown as DataSource;
  return {
    repository: new PostgresWalkInPaymentRepository(source),
    commits,
    rollbacks,
    query,
  };
}

describe('PostgresWalkInPaymentRepository', () => {
  it('looks up one pending walk-in payment without updating data', async () => {
    const { repository, query } = setup();
    const result = await repository.findPendingPayment(bookingReference);
    expect(result).toMatchObject({
      bookingReference,
      paymentStatus: 'PENDING',
      amount: 18000,
      paymentMethod: 'CASH',
    });
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE '))).toBe(false);
  });

  it('confirms only after staff check and atomically records payment, booking and audit', async () => {
    const { repository, commits, query } = setup();
    const result = await repository.confirmPayment({ bookingReference, performedBy });
    expect(result.bookingStatus).toBe('CONFIRMED');
    expect(result.paymentStatus).toBe('COMPLETED');
    expect(commits).toHaveBeenCalledTimes(1);
    const queries = query.mock.calls.map(([sql]) => sql);
    expect(queries.some((sql) => sql.includes('FOR UPDATE'))).toBe(true);
    expect(queries.some((sql) => sql.includes('INSERT INTO audit_logs'))).toBe(true);
  });

  it('rejects repeated confirmation, before attempting any update', async () => {
    const { repository, query, rollbacks } = setup({ status: 'COMPLETED' });
    await expect(repository.confirmPayment({ bookingReference, performedBy })).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE payments'))).toBe(false);
    expect(rollbacks).toHaveBeenCalledTimes(1);
  });

  it('requires active staff', async () => {
    const { repository, query } = setup({ isActive: false });
    await expect(repository.confirmPayment({ bookingReference, performedBy })).rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE payments'))).toBe(false);
  });

  it('requires an approved POS receipt reference for a card transaction', async () => {
    const { repository, query } = setup({ method: 'CARD_ON_SITE' });
    await expect(repository.confirmPayment({ bookingReference, performedBy })).rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE payments'))).toBe(false);
  });

  it('disallows payment confirmation for website bookings', async () => {
    const { repository } = setup({ source: 'WEBSITE' });
    await expect(repository.confirmPayment({ bookingReference, performedBy })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects mismatch between payment and booking amount', async () => {
    const { repository } = setup({ paymentAmount: 6000 });
    await expect(repository.confirmPayment({ bookingReference, performedBy })).rejects.toBeInstanceOf(ConflictException);
  });
});
