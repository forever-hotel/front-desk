import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuditLogController } from '../src/audit/audit-log.controller';
import { AuditLogService } from '../src/audit/audit-log.service';
import type { AuditLogEntry } from '../src/audit/models/audit-log-entry';
import { SystemRole } from '../src/security/auth/system-role';
import { SecurityModule } from '../src/security/security.module';

describe('Audit log RBAC (e2e)', () => {
  let app: INestApplication<App>;

  const secret = 'plan16-audit-rbac-test-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const managerId = '77777777-7777-4777-8777-777777777777';

  const workerId = '88888888-8888-4888-8888-888888888888';

  const logId = '11111111-1111-4111-8111-111111111111';

  const auditEntry: AuditLogEntry = {
    logId,
    eventCategory: 'FRONT_DESK_OPERATION',
    actorType: 'STAFF',
    staffUserId: receptionistId,
    action: 'CHECK_IN',
    entityType: 'BOOKING',
    entityId: '44444444-4444-4444-8444-444444444444',
    details: {
      roomNumber: 'T102',
    },
    createdAt: '2030-01-01T10:00:00.000Z',
  };

  const auditLogService = {
    findMany:
      jest.fn<
        (query: {
          limit: number;
          offset: number;
          eventCategory?: string;
          action?: string;
        }) => Promise<AuditLogEntry[]>
      >(),

    findById: jest.fn<(logId: string) => Promise<AuditLogEntry>>(),
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

      controllers: [AuditLogController],

      providers: [
        {
          provide: AuditLogService,
          useValue: auditLogService,
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

    auditLogService.findMany.mockResolvedValue([auditEntry]);

    auditLogService.findById.mockResolvedValue(auditEntry);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 when authentication is missing', async () => {
    await request(app.getHttpServer()).get('/audit-logs').expect(401);

    expect(auditLogService.findMany).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);

    expect(auditLogService.findMany).not.toHaveBeenCalled();
  });

  it('allows a receptionist to read audit logs', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([auditEntry]);

    expect(auditLogService.findMany).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
    });
  });

  it('allows a manager to read audit logs', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 403 for an authenticated worker', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(auditLogService.findMany).not.toHaveBeenCalled();
  });

  it('applies validated and normalized query filters', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .query({
        limit: '50',
        offset: '100',
        eventCategory: 'FRONT_DESK_OPERATION',
        action: ' check_out ',
      })
      .expect(200);

    expect(auditLogService.findMany).toHaveBeenCalledWith({
      limit: 50,
      offset: 100,
      eventCategory: 'FRONT_DESK_OPERATION',
      action: 'CHECK_OUT',
    });
  });

  it('rejects unexpected query properties', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .query({
        unexpected: 'should-not-be-accepted',
      })
      .expect(400);
  });

  it('allows an authorized receptionist to read one audit entry', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get(`/audit-logs/${logId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(auditEntry);

    expect(auditLogService.findById).toHaveBeenCalledWith(logId);
  });

  it('rejects an invalid audit-log UUID', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/audit-logs/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('does not expose an audit-log POST mutation endpoint', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        action: 'FORGED_EVENT',
      })
      .expect(404);
  });

  it('does not expose an audit-log PATCH mutation endpoint', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .patch(`/audit-logs/${logId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        action: 'TAMPERED',
      })
      .expect(404);
  });

  it('does not expose an audit-log DELETE mutation endpoint', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .delete(`/audit-logs/${logId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

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
