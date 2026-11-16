import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCheckOutDto } from './create-check-out.dto';
import { CheckoutPaymentMethod } from '../models/checkout-payment-result';

describe('CreateCheckOutDto', () => {
  const bookingReference = '44444444-4444-4444-8444-444444444444';
  const performedBy = '66666666-6666-4666-8666-666666666666';

  it('should accept a valid cash checkout request', async () => {
    const dto = plainToInstance(CreateCheckOutDto, {
      bookingReference,
      performedBy,
      paymentMethod: 'CASH',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.paymentMethod).toBe(CheckoutPaymentMethod.CASH);
  });

  it('should accept a valid card-on-site checkout request', async () => {
    const dto = plainToInstance(CreateCheckOutDto, {
      bookingReference,
      performedBy,
      paymentMethod: 'CARD_ON_SITE',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.paymentMethod).toBe(CheckoutPaymentMethod.CARD_ON_SITE);
  });

  it('should normalize payment method before validation', async () => {
    const dto = plainToInstance(CreateCheckOutDto, {
      bookingReference,
      performedBy,
      paymentMethod: ' cash ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.paymentMethod).toBe(CheckoutPaymentMethod.CASH);
  });

  it('should allow payment method to be omitted for a fully paid checkout', async () => {
    const dto = plainToInstance(CreateCheckOutDto, {
      bookingReference,
      performedBy,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.paymentMethod).toBeUndefined();
  });

  it('should reject an invalid booking UUID', async () => {
    const dto = plainToInstance(CreateCheckOutDto, {
      bookingReference: 'not-a-uuid',
      performedBy,
      paymentMethod: 'CASH',
    });

    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('should reject an invalid performedBy UUID', async () => {
    const dto = plainToInstance(CreateCheckOutDto, {
      bookingReference,
      performedBy: 'not-a-uuid',
      paymentMethod: 'CASH',
    });

    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('should reject an unsupported payment method', async () => {
    const dto = plainToInstance(CreateCheckOutDto, {
      bookingReference,
      performedBy,
      paymentMethod: 'STRIPE',
    });

    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('should reject raw card properties through the global validation contract', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          bookingReference,
          performedBy,
          paymentMethod: 'CARD_ON_SITE',
          cardNumber: '4111111111111111',
          cvv: '123',
          expiryDate: '12/30',
        },
        {
          type: 'body',
          metatype: CreateCheckOutDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
