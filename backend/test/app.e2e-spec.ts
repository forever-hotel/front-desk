import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ExternalFolioChargeGateway } from '../src/billing/ports/external-folio-charge.gateway';
import { CheckInPrintGateway } from '../src/check-ins/ports/check-in-print.gateway';
import { FossSessionGateway } from '../src/check-ins/ports/foss-session.gateway';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  let failFossActivation = false;
  let failPrinting = false;
  let failExternalFolioCharges = false;

  const checkInBookingId = '55555555-5555-4555-8555-555555555551';

  const checkedInBookingId = '44444444-4444-4444-8444-444444444444';

  const unknownFolioBookingId = '99999999-9999-4999-8999-999999999998';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const workerId = '67676767-6767-4676-8676-676767676767';

  const inactiveReceptionistId = '68686868-6868-4686-8686-686868686868';

  const roomTypeId = '11111111-1111-4111-8111-111111111111';

  const auditLogId = '88888888-8888-4888-8888-888888888888';

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

    const queryRunnerMock = {
      connect: jest.fn(async () => undefined),

      startTransaction: jest.fn(async () => undefined),

      query: jest.fn(async (sql: string, parameters?: unknown[]) => {
        if (sql.includes('FROM guests')) {
          return [];
        }

        /*
         * Staff validation used by:
         *
         * - transactional check-in
         * - Plan 10 room changes
         * - Plan 10 maintenance audit
         */
        if (sql.includes('FROM staff_users')) {
          const workerIdParameter = String(parameters?.[0]);

          if (workerIdParameter === workerId) {
            return [
              {
                workerId,
                role: 'WORKER',
                isActive: true,
              },
            ];
          }

          if (workerIdParameter === inactiveReceptionistId) {
            return [
              {
                workerId: inactiveReceptionistId,
                role: 'RECEPTIONIST',
                isActive: false,
              },
            ];
          }

          if (workerIdParameter !== receptionistId) {
            return [];
          }

          return [
            {
              workerId: receptionistId,
              role: 'RECEPTIONIST',
              isActive: true,
            },
          ];
        }

        /*
         * Availability/conflict checks for
         * check-in and room changes.
         */
        if (
          sql.includes('FROM bookings') &&
          sql.includes('booking_id <> $2') &&
          sql.includes('status IN')
        ) {
          return [];
        }

        /*
         * Plan 10 booking row lock.
         *
         * The already checked-in booking is
         * assigned to T102.
         */
        if (sql.includes('FROM bookings') && sql.includes('FOR UPDATE')) {
          const bookingId = String(parameters?.[0]);

          if (bookingId === checkedInBookingId) {
            return [
              {
                bookingId: checkedInBookingId,
                roomTypeId,
                roomNumber: 'T102',
                status: 'CHECKED_IN',
                checkInDate: '2030-01-08',
                checkOutDate: '2030-01-12',
              },
            ];
          }

          if (bookingId === checkInBookingId) {
            return [
              {
                bookingId: checkInBookingId,
                roomTypeId,
                roomNumber: null,
                status: 'CONFIRMED',
                checkInDate: '2032-01-10',
                checkOutDate: '2032-01-12',
              },
            ];
          }

          return [];
        }

        /*
         * Plan 10 room change locks both
         * current and target rooms in one
         * deterministic query.
         */
        if (
          sql.includes('FROM rooms') &&
          sql.includes('WHERE room_number IN') &&
          sql.includes('ORDER BY room_number ASC') &&
          sql.includes('FOR UPDATE')
        ) {
          const currentRoomNumber = String(parameters?.[0]);

          const targetRoomNumber = String(parameters?.[1]);

          const rooms: Array<{
            roomNumber: string;
            roomTypeId: string;
            status: string;
          }> = [];

          if (currentRoomNumber === 'T102') {
            rooms.push({
              roomNumber: 'T102',
              roomTypeId,
              status: 'OCCUPIED',
            });
          }

          if (targetRoomNumber === 'T105') {
            rooms.push({
              roomNumber: 'T105',
              roomTypeId,
              status: 'VACANT',
            });
          }

          if (targetRoomNumber === 'T104') {
            rooms.push({
              roomNumber: 'T104',
              roomTypeId,
              status: 'UNDER_MAINTENANCE',
            });
          }

          if (targetRoomNumber === 'S201') {
            rooms.push({
              roomNumber: 'S201',
              roomTypeId: '99999999-9999-4999-8999-999999999999',
              status: 'VACANT',
            });
          }

          return rooms;
        }

        /*
         * Single-room lock used by check-in
         * and generic room-status management.
         */
        if (sql.includes('FROM rooms') && sql.includes('FOR UPDATE')) {
          const roomNumber = String(parameters?.[0]);

          if (roomNumber === 'T999') {
            return [];
          }

          if (roomNumber === 'T104') {
            return [
              {
                roomNumber,
                roomTypeId,
                status: 'UNDER_MAINTENANCE',
              },
            ];
          }

          if (roomNumber === 'T102') {
            return [
              {
                roomNumber,
                roomTypeId,
                status: 'OCCUPIED',
              },
            ];
          }

          return [
            {
              roomNumber,
              roomTypeId,
              status: 'VACANT',
            },
          ];
        }

        /*
         * Plan 09/10 room-status update.
         */
        if (
          sql.includes('UPDATE rooms') &&
          sql.includes('last_cleared_at') &&
          sql.includes('RETURNING') &&
          sql.includes('AS "lastClearedAt"')
        ) {
          const targetStatus = String(parameters?.[0]);

          const roomNumber = String(parameters?.[1]);

          return [
            {
              roomNumber,
              status: targetStatus,
              lastClearedAt:
                targetStatus === 'VACANT'
                  ? '2032-01-10T12:00:00.000Z'
                  : '2032-01-09T08:00:00.000Z',
              updatedAt: '2032-01-10T12:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM fds_id_verifications')) {
          return [];
        }

        if (sql.includes('INSERT INTO fds_id_verifications')) {
          return [
            {
              verificationId: '77777777-7777-4777-8777-777777777777',
              verifiedAt: '2032-01-10T10:00:00.000Z',
            },
          ];
        }

        /*
         * Check-in, room-change and
         * maintenance audit persistence.
         */
        if (sql.includes('INSERT INTO audit_logs')) {
          return [
            {
              logId: auditLogId,
            },
          ];
        }

        if (sql.includes('INSERT INTO bookings')) {
          return [
            {
              bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              checkInDate: String(parameters?.[2]),
              checkOutDate: String(parameters?.[3]),
              status: String(parameters?.[4]),
              totalAmount: Number(parameters?.[5]),
              source: 'WALK_IN',
              specialRequests:
                parameters?.[6] === null ? null : String(parameters?.[6]),
              numGuests: Number(parameters?.[7]),
            },
          ];
        }

        if (sql.includes('INSERT INTO payments')) {
          return [
            {
              paymentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              paymentMethod: String(parameters?.[1]),
              amount: Number(parameters?.[2]),
              paymentStatus: String(parameters?.[3]),
              paidAt: parameters?.[4] === null ? null : String(parameters?.[4]),
            },
          ];
        }

        /*
         * UPDATE booking/room statements
         * used by check-in and room-change
         * workflows do not need a mocked
         * row result.
         */
        return [];
      }),

      commitTransaction: jest.fn(async () => undefined),

      rollbackTransaction: jest.fn(async () => undefined),

      release: jest.fn(async () => undefined),
    };

    const dataSourceMock = {
      query: jest.fn(async (sql: string, parameters?: unknown[]) => {
        /*
         * Plan 11 running-folio booking
         * context.
         *
         * Keep this matcher before Plan 08
         * print context because both queries
         * select bookingReference/roomNumber.
         */
        if (
          sql.includes('booking_id::text AS "bookingReference"') &&
          sql.includes('total_amount AS "roomCharge"') &&
          sql.includes('FROM bookings') &&
          sql.includes('WHERE booking_id = $1') &&
          sql.includes('LIMIT 1')
        ) {
          const bookingId = String(parameters?.[0]);

          if (bookingId === checkedInBookingId) {
            return [
              {
                bookingReference: checkedInBookingId,
                roomNumber: 'T102',
                checkInDate: '2030-01-08',
                checkOutDate: '2030-01-12',
                bookingStatus: 'CHECKED_IN',
                roomCharge: 60000,
              },
            ];
          }

          if (bookingId === checkInBookingId) {
            return [
              {
                bookingReference: checkInBookingId,
                roomNumber: null,
                checkInDate: '2032-01-10',
                checkOutDate: '2032-01-12',
                bookingStatus: 'CONFIRMED',
                roomCharge: 30000,
              },
            ];
          }

          return [];
        }

        /*
         * Plan 08 print-context query.
         */
        if (
          sql.includes('room_number AS "roomNumber"') &&
          sql.includes('booking_id::text AS "bookingReference"') &&
          sql.includes('WHERE booking_id = $1') &&
          sql.includes('LIMIT 1')
        ) {
          return [
            {
              bookingReference: String(parameters?.[0]),
              roomNumber: 'T102',
              status: 'CHECKED_IN',
              checkInDate: '2030-01-08',
              checkOutDate: '2030-01-12',
            },
          ];
        }

        /*
         * Plan 10 available-room booking
         * context.
         */
        if (
          sql.includes('booking_id::text AS "bookingId"') &&
          sql.includes('FROM bookings') &&
          sql.includes('WHERE booking_id = $1') &&
          sql.includes('LIMIT 1')
        ) {
          const bookingId = String(parameters?.[0]);

          if (bookingId === checkedInBookingId) {
            return [
              {
                bookingId: checkedInBookingId,
                roomTypeId,
                roomNumber: 'T102',
                status: 'CHECKED_IN',
                checkInDate: '2030-01-08',
                checkOutDate: '2030-01-12',
              },
            ];
          }

          if (bookingId === checkInBookingId) {
            return [
              {
                bookingId: checkInBookingId,
                roomTypeId,
                roomNumber: null,
                status: 'CONFIRMED',
                checkInDate: '2032-01-10',
                checkOutDate: '2032-01-12',
              },
            ];
          }

          return [];
        }

        /*
         * Plan 10 available target rooms.
         *
         * This matcher must run before the
         * general Plan 09 room-board matcher
         * because both queries join room_types.
         */
        if (
          sql.includes('FROM rooms r') &&
          sql.includes('INNER JOIN room_types rt') &&
          sql.includes("r.status = 'VACANT'") &&
          sql.includes('NOT EXISTS')
        ) {
          return [
            {
              roomNumber: 'T105',
              roomTypeId,
              roomTypeName: 'CI Standard Room',
              floor: 1,
              status: 'VACANT',
              lastClearedAt: '2032-01-09T08:00:00.000Z',
              updatedAt: '2032-01-10T08:00:00.000Z',
            },
          ];
        }

        /*
         * Plan 09 room-status board.
         */
        if (
          sql.includes('FROM rooms r') &&
          sql.includes('INNER JOIN room_types rt') &&
          sql.includes('last_cleared_at AS "lastClearedAt"')
        ) {
          return [
            {
              roomNumber: 'T101',
              roomTypeId,
              roomTypeName: 'CI Standard Room',
              floor: 1,
              status: 'VACANT',
              lastClearedAt: '2032-01-09T08:00:00.000Z',
              updatedAt: '2032-01-10T08:00:00.000Z',
            },
            {
              roomNumber: 'T102',
              roomTypeId,
              roomTypeName: 'CI Standard Room',
              floor: 1,
              status: 'OCCUPIED',
              lastClearedAt: '2032-01-08T08:00:00.000Z',
              updatedAt: '2032-01-10T09:00:00.000Z',
            },
            {
              roomNumber: 'T103',
              roomTypeId,
              roomTypeName: 'CI Standard Room',
              floor: 1,
              status: 'REQUIRES_CLEANING',
              lastClearedAt: null,
              updatedAt: '2032-01-10T10:00:00.000Z',
            },
            {
              roomNumber: 'T104',
              roomTypeId,
              roomTypeName: 'CI Standard Room',
              floor: 1,
              status: 'UNDER_MAINTENANCE',
              lastClearedAt: '2032-01-07T08:00:00.000Z',
              updatedAt: '2032-01-10T11:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM room_types')) {
          return [
            {
              roomTypeId,
              typeName: 'CI Standard Room',
              pricePerNight: 15000,
              maxGuests: 2,
            },
          ];
        }

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

      createQueryRunner: jest.fn(() => queryRunnerMock),
    };

    const fossSessionGatewayMock = {
      activateGuestSession: jest.fn(
        async (input: {
          bookingReference: string;
          roomNumber: string;
          checkOutDate: string;
        }) => {
          if (failFossActivation) {
            throw new Error('mock FOSS unavailable');
          }

          return {
            status: 'ACTIVATED' as const,
            sessionReference: `mock-foss-session-${input.bookingReference}`,
            validUntilDate: input.checkOutDate,
          };
        },
      ),
    };

    const printGatewayMock = {
      requestPrint: jest.fn(
        async (input: {
          documentType: string;
          bookingReference: string;
          roomNumber: string;
        }) => {
          if (failPrinting) {
            throw new Error('mock printer unavailable');
          }

          return {
            status: 'accepted' as const,
            printJobReference: `mock-print-${input.documentType.toLowerCase()}-${input.bookingReference}`,
          };
        },
      ),
    };

    const externalFolioChargeGatewayMock = {
      findCharges: jest.fn(async (bookingReference: string) => {
        if (failExternalFolioCharges) {
          throw new Error('mock external folio provider unavailable');
        }

        if (bookingReference !== checkedInBookingId) {
          return [];
        }

        /*
         * Intentionally return the food items
         * out of order. FolioService must
         * produce deterministic ordering.
         */
        return [
          {
            reference: 'SERVICE-001',
            category: 'SERVICES',
            description: 'Additional service',
            amount: 1500,
            occurredAt: '2030-01-10T10:00:00.000Z',
          },
          {
            reference: 'FOOD-002',
            category: 'FOOD_AND_BEVERAGE',
            description: 'Breakfast order',
            amount: 2500,
            occurredAt: '2030-01-10T08:00:00.000Z',
          },
          {
            reference: 'FOOD-001',
            category: 'FOOD_AND_BEVERAGE',
            description: 'Dinner order',
            amount: 2000,
            occurredAt: '2030-01-09T18:30:00.000Z',
          },
        ];
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(dataSourceMock)
      .overrideProvider(FossSessionGateway)
      .useValue(fossSessionGatewayMock)
      .overrideProvider(CheckInPrintGateway)
      .useValue(printGatewayMock)
      .overrideProvider(ExternalFolioChargeGateway)
      .useValue(externalFolioChargeGatewayMock)
      .compile();

    app = moduleFixture.createNestApplication();

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
    failFossActivation = false;
    failPrinting = false;
    failExternalFolioCharges = false;
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

  it('/rooms/status returns the FD-12 room status board (GET)', () => {
    return request(app.getHttpServer())
      .get('/rooms/status')
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(4);

        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              roomNumber: 'T101',
              roomTypeName: 'CI Standard Room',
              floor: 1,
              status: 'VACANT',
            }),
            expect.objectContaining({
              roomNumber: 'T102',
              status: 'OCCUPIED',
            }),
            expect.objectContaining({
              roomNumber: 'T103',
              status: 'REQUIRES_CLEANING',
            }),
            expect.objectContaining({
              roomNumber: 'T104',
              status: 'UNDER_MAINTENANCE',
            }),
          ]),
        );

        for (const room of response.body) {
          expect(room).not.toHaveProperty('guestName');

          expect(room).not.toHaveProperty('email');

          expect(room).not.toHaveProperty('nicOrPassport');
        }
      });
  });

  it('/rooms/:roomNumber/status audits VACANT to UNDER_MAINTENANCE (PATCH)', () => {
    return request(app.getHttpServer())
      .patch('/rooms/t103/status')
      .send({
        targetStatus: 'under_maintenance',
        performedBy: receptionistId,
        notes: 'Air-conditioner repair',
      })
      .expect(200)
      .expect({
        roomNumber: 'T103',
        previousStatus: 'VACANT',
        status: 'UNDER_MAINTENANCE',
        lastClearedAt: '2032-01-09T08:00:00.000Z',
        updatedAt: '2032-01-10T12:00:00.000Z',
      });
  });

  it('/rooms/:roomNumber/status audits UNDER_MAINTENANCE to VACANT (PATCH)', () => {
    return request(app.getHttpServer())
      .patch('/rooms/t104/status')
      .send({
        targetStatus: 'vacant',
        performedBy: receptionistId,
        notes: 'Repair completed',
      })
      .expect(200)
      .expect({
        roomNumber: 'T104',
        previousStatus: 'UNDER_MAINTENANCE',
        status: 'VACANT',
        lastClearedAt: '2032-01-10T12:00:00.000Z',
        updatedAt: '2032-01-10T12:00:00.000Z',
      });
  });

  it('/rooms/:roomNumber/status rejects a same-state transition (PATCH)', () => {
    return request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .send({
        targetStatus: 'VACANT',
      })
      .expect(409);
  });

  it('/rooms/:roomNumber/status blocks check-in-owned OCCUPIED transition (PATCH)', () => {
    return request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .send({
        targetStatus: 'OCCUPIED',
      })
      .expect(409);
  });

  it('/rooms/:roomNumber/status blocks checkout-owned REQUIRES_CLEANING transition (PATCH)', () => {
    return request(app.getHttpServer())
      .patch('/rooms/T104/status')
      .send({
        targetStatus: 'REQUIRES_CLEANING',
      })
      .expect(409);
  });

  it('/rooms/:roomNumber/status rejects unsupported CLEAN state (PATCH)', () => {
    return request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .send({
        targetStatus: 'CLEAN',
      })
      .expect(400);
  });

  it('/rooms/:roomNumber/status returns 404 for an unknown room (PATCH)', () => {
    return request(app.getHttpServer())
      .patch('/rooms/T999/status')
      .send({
        targetStatus: 'UNDER_MAINTENANCE',
      })
      .expect(404);
  });

  it('/room-changes/:bookingReference/available-rooms returns eligible targets (GET)', () => {
    return request(app.getHttpServer())
      .get(`/room-changes/${checkedInBookingId}/available-rooms`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);

        expect(response.body[0]).toEqual({
          roomNumber: 'T105',
          roomTypeId,
          roomTypeName: 'CI Standard Room',
          floor: 1,
          status: 'VACANT',
          lastClearedAt: '2032-01-09T08:00:00.000Z',
          updatedAt: '2032-01-10T08:00:00.000Z',
        });

        expect(response.body[0]).not.toHaveProperty('guestName');

        expect(response.body[0]).not.toHaveProperty('email');
      });
  });

  it('/room-changes/:bookingReference/available-rooms rejects invalid booking UUID (GET)', () => {
    return request(app.getHttpServer())
      .get('/room-changes/not-a-uuid/available-rooms')
      .expect(400);
  });

  it('/room-changes atomically reassigns a checked-in booking (POST)', () => {
    return request(app.getHttpServer())
      .post('/room-changes')
      .send({
        bookingReference: checkedInBookingId,
        targetRoomNumber: ' t105 ',
        performedBy: receptionistId,
        reason: 'Guest requested quieter room',
      })
      .expect(201)
      .expect({
        status: 'room_changed',
        bookingReference: checkedInBookingId,
        previousRoomNumber: 'T102',
        roomNumber: 'T105',
        previousRoomStatus: 'REQUIRES_CLEANING',
        roomStatus: 'OCCUPIED',
        auditLogId,
      });
  });

  it('/room-changes rejects changing to the current room (POST)', () => {
    return request(app.getHttpServer())
      .post('/room-changes')
      .send({
        bookingReference: checkedInBookingId,
        targetRoomNumber: 'T102',
        performedBy: receptionistId,
      })
      .expect(409);
  });

  it('/room-changes rejects an UNDER_MAINTENANCE target room (POST)', () => {
    return request(app.getHttpServer())
      .post('/room-changes')
      .send({
        bookingReference: checkedInBookingId,
        targetRoomNumber: 'T104',
        performedBy: receptionistId,
      })
      .expect(409);
  });

  it('/room-changes rejects a booking that is not CHECKED_IN (POST)', () => {
    return request(app.getHttpServer())
      .post('/room-changes')
      .send({
        bookingReference: checkInBookingId,
        targetRoomNumber: 'T105',
        performedBy: receptionistId,
      })
      .expect(409);
  });

  it('/room-changes rejects invalid performedBy UUID (POST)', () => {
    return request(app.getHttpServer())
      .post('/room-changes')
      .send({
        bookingReference: checkedInBookingId,
        targetRoomNumber: 'T105',
        performedBy: 'not-a-uuid',
      })
      .expect(400);
  });

  it('/folios/:bookingReference returns deterministic FD-15 running folio (GET)', () => {
    return request(app.getHttpServer())
      .get(`/folios/${checkedInBookingId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          bookingReference: checkedInBookingId,
          roomNumber: 'T102',
          checkInDate: '2030-01-08',
          checkOutDate: '2030-01-12',
          bookingStatus: 'CHECKED_IN',
          currency: 'LKR',
          categories: [
            {
              category: 'ROOM_CHARGES',
              items: [
                {
                  reference: `ROOM-${checkedInBookingId}`,
                  description: 'Room accommodation',
                  amount: 60000,
                  occurredAt: '2030-01-08T00:00:00.000Z',
                },
              ],
              subtotal: 60000,
            },
            {
              category: 'FOOD_AND_BEVERAGE',
              items: [
                {
                  reference: 'FOOD-001',
                  description: 'Dinner order',
                  amount: 2000,
                  occurredAt: '2030-01-09T18:30:00.000Z',
                },
                {
                  reference: 'FOOD-002',
                  description: 'Breakfast order',
                  amount: 2500,
                  occurredAt: '2030-01-10T08:00:00.000Z',
                },
              ],
              subtotal: 4500,
            },
            {
              category: 'SERVICES',
              items: [
                {
                  reference: 'SERVICE-001',
                  description: 'Additional service',
                  amount: 1500,
                  occurredAt: '2030-01-10T10:00:00.000Z',
                },
              ],
              subtotal: 1500,
            },
          ],
          total: 66000,
        });

        expect(Number.isSafeInteger(response.body.total)).toBe(true);

        for (const category of response.body.categories) {
          expect(Number.isSafeInteger(category.subtotal)).toBe(true);

          for (const item of category.items) {
            expect(Number.isSafeInteger(item.amount)).toBe(true);
          }
        }

        expect(response.body).not.toHaveProperty('guestName');
        expect(response.body).not.toHaveProperty('email');
        expect(response.body).not.toHaveProperty('nicOrPassport');
      });
  });

  it('/folios/:bookingReference rejects invalid booking UUID (GET)', () => {
    return request(app.getHttpServer()).get('/folios/not-a-uuid').expect(400);
  });

  it('/folios/:bookingReference returns 404 for an unknown booking (GET)', () => {
    return request(app.getHttpServer())
      .get(`/folios/${unknownFolioBookingId}`)
      .expect(404);
  });

  it('/folios/:bookingReference rejects a booking that is not CHECKED_IN (GET)', () => {
    return request(app.getHttpServer())
      .get(`/folios/${checkInBookingId}`)
      .expect(409);
  });

  it('/folios/:bookingReference returns 503 when external charge retrieval fails (GET)', async () => {
    failExternalFolioCharges = true;

    await request(app.getHttpServer())
      .get(`/folios/${checkedInBookingId}`)
      .expect(503);
  });

  it('/bookings/search (GET)', () => {
    return request(app.getHttpServer())
      .get('/bookings/search')
      .query({
        query: 'CI Test Guest',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);

        expect(response.body[0].guestName).toBe('CI Test Guest');
      });
  });

  it('/bookings/arrivals (GET)', () => {
    return request(app.getHttpServer())
      .get('/bookings/arrivals')
      .query({
        date: '2030-01-10',
      })
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
      .query({
        date: '2030-01-12',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);

        expect(response.body[0].status).toBe('CHECKED_IN');

        expect(response.body[0].checkOutDate).toBe('2030-01-12');
      });
  });

  it('/bookings/walk-in creates a cash walk-in booking (POST)', () => {
    return request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send({
        guest: {
          fullName: 'Walk In Guest',
          email: 'walk-in@example.invalid',
          nicOrPassport: 'WALK-IN-NIC-001',
          phone: '+94000000001',
        },
        booking: {
          roomTypeId,
          checkInDate: '2030-02-10',
          checkOutDate: '2030-02-12',
          numGuests: 2,
          specialRequests: 'Quiet room',
        },
        payment: {
          paymentMethod: 'CASH',
        },
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.bookingReference).toBe(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        );

        expect(response.body.source).toBe('WALK_IN');

        expect(response.body.status).toBe('CONFIRMED');

        expect(response.body.totalAmount).toBe(30000);

        expect(response.body.payment).toEqual(
          expect.objectContaining({
            paymentMethod: 'CASH',
            paymentStatus: 'COMPLETED',
            amount: 30000,
          }),
        );

        expect(response.body).not.toHaveProperty('cardNumber');

        expect(response.body.payment).not.toHaveProperty('cardNumber');

        expect(response.body.payment).not.toHaveProperty('cvv');
      });
  });

  it('/bookings/walk-in creates a pending on-site card workflow (POST)', () => {
    return request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send({
        guest: {
          fullName: 'Card Guest',
          email: 'card@example.invalid',
          phone: '+94000000002',
        },
        booking: {
          roomTypeId,
          checkInDate: '2030-03-10',
          checkOutDate: '2030-03-11',
          numGuests: 1,
        },
        payment: {
          paymentMethod: 'CARD_ON_SITE',
        },
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('PENDING');

        expect(response.body.payment.paymentMethod).toBe('CARD_ON_SITE');

        expect(response.body.payment.paymentStatus).toBe('PENDING');

        expect(response.body.payment.paidAt).toBeNull();
      });
  });

  it('/bookings/walk-in rejects raw card data (POST)', () => {
    return request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send({
        guest: {
          fullName: 'Unsafe Card Guest',
          email: 'unsafe-card@example.invalid',
        },
        booking: {
          roomTypeId,
          checkInDate: '2030-04-10',
          checkOutDate: '2030-04-11',
          numGuests: 1,
        },
        payment: {
          paymentMethod: 'CARD_ON_SITE',
          cardNumber: '4111111111111111',
          cvv: '123',
          expiryDate: '12/30',
        },
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toEqual(
          expect.arrayContaining([
            'payment.property cardNumber should not exist',
            'payment.property cvv should not exist',
            'payment.property expiryDate should not exist',
          ]),
        );
      });
  });

  it('/bookings/walk-in rejects an unsupported payment method (POST)', () => {
    return request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send({
        guest: {
          fullName: 'Unsupported Payment Guest',
          email: 'unsupported@example.invalid',
        },
        booking: {
          roomTypeId,
          checkInDate: '2030-05-10',
          checkOutDate: '2030-05-11',
          numGuests: 1,
        },
        payment: {
          paymentMethod: 'BITCOIN',
        },
      })
      .expect(400);
  });

  it('/bookings/walk-in rejects invalid guest email (POST)', () => {
    return request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send({
        guest: {
          fullName: 'Invalid Email Guest',
          email: 'not-an-email',
        },
        booking: {
          roomTypeId,
          checkInDate: '2030-06-10',
          checkOutDate: '2030-06-11',
          numGuests: 1,
        },
        payment: {
          paymentMethod: 'CASH',
        },
      })
      .expect(400);
  });

  it('/bookings/walk-in rejects checkout before check-in (POST)', () => {
    return request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send({
        guest: {
          fullName: 'Invalid Date Guest',
          email: 'invalid-date@example.invalid',
        },
        booking: {
          roomTypeId,
          checkInDate: '2030-07-10',
          checkOutDate: '2030-07-09',
          numGuests: 1,
        },
        payment: {
          paymentMethod: 'CASH',
        },
      })
      .expect(400);
  });

  it('/bookings/walk-in rejects guest count above room capacity (POST)', () => {
    return request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send({
        guest: {
          fullName: 'Large Group Guest',
          email: 'large-group@example.invalid',
        },
        booking: {
          roomTypeId,
          checkInDate: '2030-08-10',
          checkOutDate: '2030-08-11',
          numGuests: 3,
        },
        payment: {
          paymentMethod: 'CASH',
        },
      })
      .expect(400);
  });

  it('/check-in completes check-in and activates FOSS session (POST)', () => {
    return request(app.getHttpServer())
      .post('/check-in')
      .send({
        bookingReference: checkInBookingId,
        roomNumber: 't103',
        verification: {
          documentType: 'NIC',
          verificationMethod: 'PHYSICAL_DOCUMENT',
          verifiedBy: receptionistId,
          notes: 'Physical NIC verified',
        },
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual({
          status: 'checked_in',
          bookingReference: checkInBookingId,
          roomNumber: 'T103',
          bookingStatus: 'CHECKED_IN',
          roomStatus: 'OCCUPIED',
          verification: {
            verificationId: '77777777-7777-4777-8777-777777777777',
            documentType: 'NIC',
            verificationMethod: 'PHYSICAL_DOCUMENT',
            verifiedBy: receptionistId,
            verifiedAt: '2032-01-10T10:00:00.000Z',
          },
          auditLogId,
          fossSession: {
            status: 'ACTIVATED',
            sessionReference: `mock-foss-session-${checkInBookingId}`,
            validUntilDate: '2032-01-12',
          },
        });
      });
  });

  it('/check-in keeps check-in successful when FOSS activation fails (POST)', async () => {
    failFossActivation = true;

    const response = await request(app.getHttpServer())
      .post('/check-in')
      .send({
        bookingReference: checkInBookingId,
        roomNumber: 'T103',
        verification: {
          documentType: 'NIC',
          verificationMethod: 'PHYSICAL_DOCUMENT',
          verifiedBy: receptionistId,
        },
      })
      .expect(201);

    expect(response.body.status).toBe('checked_in');

    expect(response.body.bookingStatus).toBe('CHECKED_IN');

    expect(response.body.roomStatus).toBe('OCCUPIED');

    expect(response.body.fossSession).toEqual({
      status: 'FAILED',
      sessionReference: null,
      validUntilDate: '2032-01-12',
      failureCode: 'FOSS_ACTIVATION_FAILED',
    });
  });

  it('/check-in accepts scanned-copy verification metadata (POST)', () => {
    return request(app.getHttpServer())
      .post('/check-in')
      .send({
        bookingReference: checkInBookingId,
        roomNumber: 'T103',
        verification: {
          documentType: 'PASSPORT',
          verificationMethod: 'SCANNED_COPY',
          verifiedBy: receptionistId,
          documentStorageKey: 'guest-id/opaque-passport-object-key',
          documentSha256:
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('checked_in');

        expect(response.body.verification.verificationMethod).toBe(
          'SCANNED_COPY',
        );

        expect(response.body.fossSession.status).toBe('ACTIVATED');

        expect(response.body).not.toHaveProperty('documentStorageKey');

        expect(response.body.verification).not.toHaveProperty(
          'documentStorageKey',
        );

        expect(response.body.verification).not.toHaveProperty('documentSha256');
      });
  });

  it('/check-in rejects scanned-copy verification without a storage key (POST)', () => {
    return request(app.getHttpServer())
      .post('/check-in')
      .send({
        bookingReference: checkInBookingId,
        roomNumber: 'T103',
        verification: {
          documentType: 'NIC',
          verificationMethod: 'SCANNED_COPY',
          verifiedBy: receptionistId,
        },
      })
      .expect(400);
  });

  it('/check-in rejects old idVerified boolean contract (POST)', () => {
    return request(app.getHttpServer())
      .post('/check-in')
      .send({
        bookingReference: checkInBookingId,
        roomNumber: 'T103',
        idVerified: true,
      })
      .expect(400);
  });

  it('/check-in rejects invalid verifying staff UUID (POST)', () => {
    return request(app.getHttpServer())
      .post('/check-in')
      .send({
        bookingReference: checkInBookingId,
        roomNumber: 'T103',
        verification: {
          documentType: 'NIC',
          verificationMethod: 'PHYSICAL_DOCUMENT',
          verifiedBy: 'not-a-uuid',
        },
      })
      .expect(400);
  });

  it('/check-in/:bookingReference/print accepts registration-card printing (POST)', () => {
    return request(app.getHttpServer())
      .post(`/check-in/${checkedInBookingId}/print`)
      .send({
        documentType: 'REGISTRATION_CARD',
      })
      .expect(201)
      .expect({
        status: 'accepted',
        documentType: 'REGISTRATION_CARD',
        bookingReference: checkedInBookingId,
        roomNumber: 'T102',
        printJobReference: `mock-print-registration_card-${checkedInBookingId}`,
      });
  });

  it('/check-in/:bookingReference/print accepts payment-receipt printing (POST)', () => {
    return request(app.getHttpServer())
      .post(`/check-in/${checkedInBookingId}/print`)
      .send({
        documentType: 'payment_receipt',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual({
          status: 'accepted',
          documentType: 'PAYMENT_RECEIPT',
          bookingReference: checkedInBookingId,
          roomNumber: 'T102',
          printJobReference: `mock-print-payment_receipt-${checkedInBookingId}`,
        });

        expect(response.body).not.toHaveProperty('cardNumber');

        expect(response.body).not.toHaveProperty('cvv');
      });
  });

  it('/check-in/:bookingReference/print rejects unsupported document type (POST)', () => {
    return request(app.getHttpServer())
      .post(`/check-in/${checkedInBookingId}/print`)
      .send({
        documentType: 'BOARDING_PASS',
      })
      .expect(400);
  });

  it('/check-in/:bookingReference/print rejects raw card fields (POST)', () => {
    return request(app.getHttpServer())
      .post(`/check-in/${checkedInBookingId}/print`)
      .send({
        documentType: 'PAYMENT_RECEIPT',
        cardNumber: '4111111111111111',
        cvv: '123',
        pin: '9999',
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toEqual(
          expect.arrayContaining([
            'property cardNumber should not exist',
            'property cvv should not exist',
            'property pin should not exist',
          ]),
        );
      });
  });

  it('/check-in/:bookingReference/print returns 503 when printing gateway fails (POST)', async () => {
    failPrinting = true;

    await request(app.getHttpServer())
      .post(`/check-in/${checkedInBookingId}/print`)
      .send({
        documentType: 'REGISTRATION_CARD',
      })
      .expect(503);
  });

  it('/check-in/:bookingReference/print rejects invalid booking UUID (POST)', () => {
    return request(app.getHttpServer())
      .post('/check-in/not-a-uuid/print')
      .send({
        documentType: 'REGISTRATION_CARD',
      })
      .expect(400);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
