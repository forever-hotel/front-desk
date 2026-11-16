import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { FossBookingVerificationController } from '../src/reservations/integrations/foss-booking-verification.controller';
import { FossBookingServiceGuard } from '../src/reservations/integrations/foss-booking-service.guard';
import { FossBookingVerificationService } from '../src/reservations/integrations/foss-booking-verification.service';

const bookingId = '11111111-1111-4111-8111-111111111111';
const secret = 'integration-test-only-foss-key-123456789';

describe('FOSS booking verification boundary (e2e)', () => {
  let app: INestApplication;
  const database = { query: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FossBookingVerificationController],
      providers: [
        FossBookingServiceGuard,
        FossBookingVerificationService,
        { provide: DataSource, useValue: database },
        {
          provide: ConfigService,
          useValue: {
            get: (name: string) =>
              name === 'FDS_FOSS_BOOKING_API_KEY' ? secret : '12:00',
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    database.query.mockReset().mockResolvedValue([
      {
        bookingId,
        roomNumber: '203',
        status: 'CHECKED_IN',
        roomStatus: 'OCCUPIED',
        checkInDate: '2026-10-31',
        checkOutDate: '2026-11-02',
        guestName: 'Guest',
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous service calls', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/verify`)
      .send({ roomNumber: '203' })
      .expect(401);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('rejects incorrect server key', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/verify`)
      .set('Authorization', 'Bearer wrong')
      .send({ roomNumber: '203' })
      .expect(401);
  });

  it('validates request body and UUID', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/verify`)
      .set('Authorization', `Bearer ${secret}`)
      .send({ roomNumber: '203', other: 'not allowed' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/bookings/not-a-uuid/verify')
      .set('Authorization', `Bearer ${secret}`)
      .send({ roomNumber: '203' })
      .expect(400);
  });

  it('verifies active stay', async () => {
    const now = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-10-31T09:00:00Z').getTime());
    try {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/verify`)
        .set('Authorization', `Bearer ${secret}`)
        .send({ roomNumber: '203' })
        .expect(200);
      expect(response.body).toMatchObject({
        bookingId,
        roomNumber: '203',
        status: 'CHECKED_IN',
      });
    } finally {
      now.mockRestore();
    }
  });
});
