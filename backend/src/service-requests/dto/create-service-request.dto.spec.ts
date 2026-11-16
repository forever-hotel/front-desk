import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ServiceRequestCategory } from '../models/service-request-category';
import { CreateServiceRequestDto } from './create-service-request.dto';

describe('CreateServiceRequestDto', () => {
  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  it.each([
    ServiceRequestCategory.EXTRA_TOWELS,
    ServiceRequestCategory.WATER_BOTTLES,
    ServiceRequestCategory.MAINTENANCE,
    ServiceRequestCategory.LAUNDRY,
    ServiceRequestCategory.OTHER,
  ])(
    'should accept supported service-request category %s',
    async (category) => {
      const dto = plainToInstance(CreateServiceRequestDto, {
        bookingReference,
        category,
        performedBy: receptionistId,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.category).toBe(category);
    },
  );

  it('should trim and normalize a lowercase category', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ' extra_towels ',
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.category).toBe(ServiceRequestCategory.EXTRA_TOWELS);
  });

  it('should trim an optional description', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ServiceRequestCategory.MAINTENANCE,
      description: '  Air-conditioner requires inspection  ',
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.description).toBe('Air-conditioner requires inspection');
  });

  it('should sanitize script content from a description', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ServiceRequestCategory.EXTRA_TOWELS,
      description: '<script>alert("xss")</script>Please send towels',
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.description).toBe('Please send towels');

    expect(dto.description).not.toContain('<script');
  });

  it('should sanitize HTML markup from a description', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ServiceRequestCategory.MAINTENANCE,
      description: '<img src=x onerror=alert(1)>Maintenance required',
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.description).toBe('Maintenance required');
  });

  it('should accept an omitted optional description', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ServiceRequestCategory.WATER_BOTTLES,
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.description).toBeUndefined();
  });

  it('should accept a description exactly 300 characters long', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ServiceRequestCategory.OTHER,
      description: 'a'.repeat(300),
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a description longer than 300 characters', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ServiceRequestCategory.OTHER,
      description: 'a'.repeat(301),
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an unsupported category', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: 'FOOD_DELIVERY',
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an invalid booking reference', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference: 'not-a-uuid',
      category: ServiceRequestCategory.EXTRA_TOWELS,
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an invalid performedBy UUID', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ServiceRequestCategory.EXTRA_TOWELS,
      performedBy: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should safely reject non-string category input', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: 123,
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(dto.category).toBe(123);
  });

  it('should safely reject non-string description input', async () => {
    const dto = plainToInstance(CreateServiceRequestDto, {
      bookingReference,
      category: ServiceRequestCategory.EXTRA_TOWELS,
      description: 123,
      performedBy: receptionistId,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(dto.description).toBe(123);
  });
});
