import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditLogQueryDto } from './audit-log-query.dto';

describe('AuditLogQueryDto', () => {
  it('uses safe default pagination values', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(25);
    expect(dto.offset).toBe(0);
  });

  it('transforms string pagination values into numbers', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      limit: '50',
      offset: '100',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(100);
  });

  it('rejects limit greater than 100', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      limit: '101',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('rejects zero or negative limit', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      limit: '0',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('rejects a negative offset', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      offset: '-1',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'offset')).toBe(true);
  });

  it('rejects non-numeric pagination input', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      limit: 'not-a-number',
      offset: 'also-invalid',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    'AUTHENTICATION',
    'FRONT_DESK_OPERATION',
    'PAYMENT',
    'STAFF_ACCOUNT_MANAGEMENT',
    'DATA_ACCESS',
    'TASK_SERVICE',
    'FOOD_ORDER',
  ])('accepts supported event category %s', async (eventCategory) => {
    const dto = plainToInstance(AuditLogQueryDto, {
      eventCategory,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.eventCategory).toBe(eventCategory);
  });

  it('rejects an unsupported event category', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      eventCategory: 'UNKNOWN_CATEGORY',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'eventCategory')).toBe(
      true,
    );
  });

  it('normalizes action filters', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      action: ' check_out ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.action).toBe('CHECK_OUT');
  });

  it('rejects an action longer than 100 characters', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      action: 'A'.repeat(101),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'action')).toBe(true);
  });

  it('rejects non-string action input', async () => {
    const dto = plainToInstance(AuditLogQueryDto, {
      action: 123,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'action')).toBe(true);
  });
});
