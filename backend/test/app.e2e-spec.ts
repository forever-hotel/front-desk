import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USERNAME = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_NAME = 'test';
    process.env.DB_SSL = 'false';
    process.env.DB_SYNCHRONIZE = 'false';
    process.env.DB_LOGGING = 'false';

    const { AppModule } = await import('./../src/app.module.js');

    const dataSourceMock = {
      query: jest.fn(async (sql: string, parameters?: unknown[]) => {
        if (sql.includes("b.status = 'CONFIRMED'")) {
          return [
            {
              bookingId: 'arrival-001',
              bookingReference: 'arrival-001',
              guestName: 'Arrival Guest',
              email: 'arrival@example.invalid',
              phone: '+94000000001',
              roomType: 'Standard',
              checkInDate: String(parameters?.[0]),
              checkOutDate: '2030-01-12',
              status: 'CONFIRMED',
            },
          ];
        }

        if (sql.includes("b.status = 'CHECKED_IN'")) {
          return [
            {
              bookingId: 'departure-001',
              bookingReference: 'departure-001',
              guestName: 'Departure Guest',
              email: 'departure@example.invalid',
              phone: '+94000000002',
              roomType: 'Standard',
              checkInDate: '2030-01-08',
              checkOutDate: String(parameters?.[0]),
              status: 'CHECKED_IN',
            },
          ];
        }

        if (sql.includes('FROM bookings b')) {
          return [
            {
              bookingId: '33333333-3333-4333-8333-333333333333',
              bookingReference: '33333333-3333-4333-8333-333333333333',
              guestName: 'CI Test Guest',
              email: 'ci-test-guest@example.invalid',
              phone: '+94000000000',
              roomType: 'CI Standard Room',
              checkInDate: '2030-01-10',
              checkOutDate: '2030-01-12',
              status: 'CONFIRMED',
            },
          ];
        }

        return [];
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(dataSourceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({
        status: 'ready',
        database: 'up',
      });
  });

  it('/bookings/search (GET)', () => {
    return request(app.getHttpServer())
      .get('/bookings/search')
      .query({ query: 'CI Test Guest' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
        expect(response.body[0].guestName).toBe('CI Test Guest');
      });
  });

  it('/bookings/arrivals (GET)', () => {
    return request(app.getHttpServer())
      .get('/bookings/arrivals')
      .query({ date: '2030-01-10' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
        expect(response.body[0].status).toBe('CONFIRMED');
        expect(response.body[0].checkInDate).toBe('2030-01-10');
      });
  });

  it('/bookings/departures (GET)', () => {
    return request(app.getHttpServer())
      .get('/bookings/departures')
      .query({ date: '2030-01-12' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
        expect(response.body[0].status).toBe('CHECKED_IN');
        expect(response.body[0].checkOutDate).toBe('2030-01-12');
      });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
