import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { FolioController } from '../src/billing/folio.controller';
import { FolioService } from '../src/billing/folio.service';
import { FolioCategory } from '../src/billing/models/folio-category';
import type { RunningFolio } from '../src/billing/models/running-folio';
import { CheckOutController } from '../src/check-outs/check-out.controller';
import { CheckOutService } from '../src/check-outs/check-out.service';
import type { CreateCheckOutDto } from '../src/check-outs/dto/create-check-out.dto';
import { CheckoutPaymentMethod } from '../src/check-outs/models/checkout-payment-result';
import type { CheckoutResult } from '../src/check-outs/models/checkout-result';
import { SystemRole } from '../src/security/auth/system-role';
import { SecurityModule } from '../src/security/security.module';

describe('Folio and Checkout RBAC (e2e)', () => {
  let app: INestApplication<App>;

  const secret =
    'plan16-folio-checkout-rbac-test-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const anotherStaffId = '77777777-7777-4777-8777-777777777777';

  const managerId = '88888888-8888-4888-8888-888888888888';

  const workerId = '99999999-9999-4999-8999-999999999999';

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const runningFolio: RunningFolio = {
    bookingReference,

    roomNumber: 'T102',

    checkInDate: '2030-01-08',

    checkOutDate: '2030-01-12',

    bookingStatus: 'CHECKED_IN',

    currency: 'LKR',

    categories: [
      {
        category: FolioCategory.ROOM_CHARGES,

        items: [
          {
            reference: `ROOM-${bookingReference}`,

            description: 'Room accommodation',

            amount: 60000,

            occurredAt: '2030-01-08T00:00:00.000Z',
          },
        ],

        subtotal: 60000,
      },

      {
        category: FolioCategory.FOOD_AND_BEVERAGE,

        items: [],

        subtotal: 0,
      },

      {
        category: FolioCategory.SERVICES,

        items: [],

        subtotal: 0,
      },
    ],

    total: 60000,
  };

  const checkoutResult: CheckoutResult = {
    status: 'checked_out',

    bookingReference,

    roomNumber: 'T102',

    bookingStatus: 'CHECKED_OUT',

    roomStatus: 'REQUIRES_CLEANING',

    currency: 'LKR',

    folioTotal: 60000,

    previouslyPaid: 30000,

    finalPaymentAmount: 30000,

    payment: {
      paymentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      paymentMethod: CheckoutPaymentMethod.CASH,

      paymentStatus: 'COMPLETED',

      amount: 30000,

      paidAt: '2030-01-12T10:00:00.000Z',
    },

    auditLogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

    fossSession: {
      status: 'DEACTIVATED',
    },
  };

  const folioService = {
    getRunningFolio:
      jest.fn<(bookingReference: string) => Promise<RunningFolio>>(),
  };

  const checkOutService = {
    checkOut: jest.fn<(dto: CreateCheckOutDto) => Promise<CheckoutResult>>(),
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

      controllers: [FolioController, CheckOutController],

      providers: [
        {
          provide: FolioService,

          useValue: folioService,
        },

        {
          provide: CheckOutService,

          useValue: checkOutService,
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

    folioService.getRunningFolio.mockResolvedValue(runningFolio);

    checkOutService.checkOut.mockResolvedValue(checkoutResult);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 for unauthenticated folio read', async () => {
    await request(app.getHttpServer())
      .get(`/folios/${bookingReference}`)
      .expect(401);
  });

  it('allows a receptionist to read a folio', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get(`/folios/${bookingReference}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(runningFolio);
  });

  it('allows a manager to read a folio', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .get(`/folios/${bookingReference}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 403 when a worker reads a folio', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .get(`/folios/${bookingReference}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 401 for unauthenticated checkout', async () => {
    await request(app.getHttpServer())
      .post('/check-outs')
      .send(createCheckoutPayload(receptionistId))
      .expect(401);
  });

  it('allows a receptionist to checkout using trusted actor identity', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/check-outs')
      .set('Authorization', `Bearer ${token}`)
      .send(createCheckoutPayload(receptionistId))
      .expect(201)
      .expect(checkoutResult);

    expect(checkOutService.checkOut).toHaveBeenCalledWith({
      bookingReference,

      performedBy: receptionistId,

      paymentMethod: CheckoutPaymentMethod.CASH,
    });
  });

  it('rejects checkout actor impersonation with 403', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/check-outs')
      .set('Authorization', `Bearer ${token}`)
      .send(createCheckoutPayload(anotherStaffId))
      .expect(403);

    expect(checkOutService.checkOut).not.toHaveBeenCalled();
  });

  it('returns 403 when a manager attempts checkout', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .post('/check-outs')
      .set('Authorization', `Bearer ${token}`)
      .send(createCheckoutPayload(managerId))
      .expect(403);

    expect(checkOutService.checkOut).not.toHaveBeenCalled();
  });

  it('returns 403 when a worker attempts checkout', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .post('/check-outs')
      .set('Authorization', `Bearer ${token}`)
      .send(createCheckoutPayload(workerId))
      .expect(403);

    expect(checkOutService.checkOut).not.toHaveBeenCalled();
  });

  it('rejects raw card properties before checkout service execution', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/check-outs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...createCheckoutPayload(receptionistId),

        cardNumber: '4111111111111111',

        cvv: '123',

        expiryDate: '12/30',
      })
      .expect(400);

    expect(checkOutService.checkOut).not.toHaveBeenCalled();
  });

  function createCheckoutPayload(performedBy: string): CreateCheckOutDto {
    return {
      bookingReference,

      performedBy,

      paymentMethod: CheckoutPaymentMethod.CASH,
    };
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
