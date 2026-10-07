import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { BookingsController } from '../src/reservations/bookings.controller';
import { BookingsService } from '../src/reservations/bookings.service';
import type { BookingSearchResult } from '../src/reservations/models/booking-search-result';
import type { WalkInBookingResult } from '../src/reservations/models/walk-in-booking-result';
import type { CreateWalkInBookingDto } from '../src/reservations/dto/create-walk-in-booking.dto';
import { SystemRole } from '../src/security/auth/system-role';
import { SecurityModule } from '../src/security/security.module';

describe('Bookings RBAC (e2e)', () => {
  let app: INestApplication<App>;

  const secret = 'plan16-bookings-rbac-test-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const managerId = '77777777-7777-4777-8777-777777777777';

  const workerId = '88888888-8888-4888-8888-888888888888';

  const searchResult: BookingSearchResult[] = [
    {
      bookingId: '44444444-4444-4444-8444-444444444444',
      bookingReference: '44444444-4444-4444-8444-444444444444',
      guestName: 'Test Guest',
      email: 'guest@example.invalid',
      phone: '+94000000001',
      roomType: 'Standard',
      checkInDate: '2030-01-10',
      checkOutDate: '2030-01-12',
      status: 'CONFIRMED',
    },
  ];

  const walkInResult = {
    bookingReference: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'CONFIRMED',
    source: 'WALK_IN',
  } as WalkInBookingResult;

  const bookingsService = {
    search: jest.fn<(query: string) => Promise<BookingSearchResult[]>>(),

    findRecent: jest.fn<(limit: number) => Promise<BookingSearchResult[]>>(),

    findArrivals: jest.fn<(date: string) => Promise<BookingSearchResult[]>>(),

    findDepartures: jest.fn<(date: string) => Promise<BookingSearchResult[]>>(),

    createWalkInBooking:
      jest.fn<
        (request: CreateWalkInBookingDto) => Promise<WalkInBookingResult>
      >(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: secret,
              JWT_ISSUER: issuer,
            }),
          ],
        }),

        SecurityModule,
      ],

      controllers: [BookingsController],

      providers: [
        {
          provide: BookingsService,
          useValue: bookingsService,
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
    jest.clearAllMocks();

    bookingsService.search.mockResolvedValue(searchResult);

    bookingsService.findRecent.mockResolvedValue(searchResult);

    bookingsService.findArrivals.mockResolvedValue(searchResult);

    bookingsService.findDepartures.mockResolvedValue(searchResult);

    bookingsService.createWalkInBooking.mockResolvedValue(walkInResult);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 for unauthenticated booking read', async () => {
    await request(app.getHttpServer())
      .get('/bookings/search')
      .query({
        query: 'Test Guest',
      })
      .expect(401);
  });

  it('allows a receptionist to read bookings', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/bookings/search')
      .set('Authorization', `Bearer ${token}`)
      .query({
        query: 'Test Guest',
      })
      .expect(200)
      .expect(searchResult);
  });

  it('allows a manager to read bookings', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .get('/bookings/arrivals')
      .set('Authorization', `Bearer ${token}`)
      .query({
        date: '2030-01-10',
      })
      .expect(200);
  });

  it('returns 403 when a worker reads bookings', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .get('/bookings/recent')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 401 for unauthenticated walk-in creation', async () => {
    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .send(createWalkInPayload())
      .expect(401);
  });

  it('allows a receptionist to create a walk-in booking', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send(createWalkInPayload())
      .expect(201)
      .expect(walkInResult);

    expect(bookingsService.createWalkInBooking).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when a manager attempts walk-in creation', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send(createWalkInPayload())
      .expect(403);

    expect(bookingsService.createWalkInBooking).not.toHaveBeenCalled();
  });

  it('returns 403 when a worker attempts walk-in creation', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .post('/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send(createWalkInPayload())
      .expect(403);

    expect(bookingsService.createWalkInBooking).not.toHaveBeenCalled();
  });

  function createWalkInPayload(): CreateWalkInBookingDto {
    return {
      guest: {
        fullName: 'Walk In Guest',
        email: 'walk-in@example.invalid',
        phone: '+94000000001',
      },

      booking: {
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        checkInDate: '2030-02-10',
        checkOutDate: '2030-02-12',
        numGuests: 2,
        specialRequests: 'Quiet room',
      },

      payment: {
        paymentMethod: 'CASH',
      },
    } as CreateWalkInBookingDto;
  }

  async function createToken(
    userId: string,
    role: SystemRole,
  ): Promise<string> {
    return new SignJWT({
      role,
    })
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuer(issuer)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
  }
});
