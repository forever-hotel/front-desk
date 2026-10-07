import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CheckInController } from '../src/check-ins/check-in.controller';
import { CheckInPrintService } from '../src/check-ins/check-in-print.service';
import { CheckInService } from '../src/check-ins/check-in.service';
import {
  CheckInDocumentType,
  type CheckInPrintRequestDto,
} from '../src/check-ins/dto/check-in-print-request.dto';
import type { CheckInRequestDto } from '../src/check-ins/dto/check-in-request.dto';
import {
  IdentityDocumentType,
  IdVerificationMethod,
} from '../src/check-ins/dto/check-in-verification.dto';
import type { CheckInPrintResult } from '../src/check-ins/models/check-in-print-result';
import type { CheckInResult } from '../src/check-ins/models/check-in-result';
import { SystemRole } from '../src/security/auth/system-role';
import { SecurityModule } from '../src/security/security.module';

describe('Check-In RBAC (e2e)', () => {
  let app: INestApplication<App>;

  const secret = 'plan16-check-in-rbac-test-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const anotherStaffId = '77777777-7777-4777-8777-777777777777';

  const managerId = '88888888-8888-4888-8888-888888888888';

  const workerId = '99999999-9999-4999-8999-999999999999';

  const bookingReference = '33333333-3333-4333-8333-333333333333';

  const checkInResult: CheckInResult = {
    status: 'checked_in',

    bookingReference,

    roomNumber: 'T103',

    bookingStatus: 'CHECKED_IN',

    roomStatus: 'OCCUPIED',

    verification: {
      verificationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      documentType: IdentityDocumentType.NIC,

      verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,

      verifiedBy: receptionistId,

      verifiedAt: '2030-01-10T10:00:00.000Z',
    },

    auditLogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

    fossSession: {
      status: 'ACTIVATED',

      sessionReference: 'mock-foss-session',

      validUntilDate: '2030-01-12',
    },
  };

  const printResult: CheckInPrintResult = {
    status: 'accepted',

    documentType: CheckInDocumentType.REGISTRATION_CARD,

    bookingReference,

    roomNumber: 'T103',

    printJobReference: 'mock-print-registration-card',
  };

  const checkInService = {
    checkIn: jest.fn<(dto: CheckInRequestDto) => Promise<CheckInResult>>(),
  };

  const printService = {
    requestPrint:
      jest.fn<
        (
          bookingReference: string,
          dto: CheckInPrintRequestDto,
        ) => Promise<CheckInPrintResult>
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

      controllers: [CheckInController],

      providers: [
        {
          provide: CheckInService,

          useValue: checkInService,
        },

        {
          provide: CheckInPrintService,

          useValue: printService,
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

    checkInService.checkIn.mockResolvedValue(checkInResult);

    printService.requestPrint.mockResolvedValue(printResult);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 for unauthenticated check-in', async () => {
    await request(app.getHttpServer())
      .post('/check-in')
      .send(createCheckInPayload(receptionistId))
      .expect(401);
  });

  it('allows a receptionist to perform check-in', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send(createCheckInPayload(receptionistId))
      .expect(201)
      .expect(checkInResult);

    expect(checkInService.checkIn).toHaveBeenCalledWith({
      bookingReference,
      roomNumber: 'T103',

      verification: {
        documentType: IdentityDocumentType.NIC,

        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,

        verifiedBy: receptionistId,
      },
    });
  });

  it('rejects verifiedBy impersonation with 403', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send(createCheckInPayload(anotherStaffId))
      .expect(403);

    expect(checkInService.checkIn).not.toHaveBeenCalled();
  });

  it('returns 403 when a manager attempts check-in', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .post('/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send(createCheckInPayload(managerId))
      .expect(403);

    expect(checkInService.checkIn).not.toHaveBeenCalled();
  });

  it('returns 403 when a worker attempts check-in', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .post('/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send(createCheckInPayload(workerId))
      .expect(403);

    expect(checkInService.checkIn).not.toHaveBeenCalled();
  });

  it('allows a receptionist to request document printing', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post(`/check-in/${bookingReference}/print`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentType: CheckInDocumentType.REGISTRATION_CARD,
      })
      .expect(201)
      .expect(printResult);

    expect(printService.requestPrint).toHaveBeenCalledWith(bookingReference, {
      documentType: CheckInDocumentType.REGISTRATION_CARD,
    });
  });

  it('returns 403 when a manager attempts document printing', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .post(`/check-in/${bookingReference}/print`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentType: CheckInDocumentType.REGISTRATION_CARD,
      })
      .expect(403);

    expect(printService.requestPrint).not.toHaveBeenCalled();
  });

  function createCheckInPayload(verifiedBy: string): CheckInRequestDto {
    return {
      bookingReference,

      roomNumber: 'T103',

      verification: {
        documentType: IdentityDocumentType.NIC,

        verificationMethod: IdVerificationMethod.PHYSICAL_DOCUMENT,

        verifiedBy,
      },
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
