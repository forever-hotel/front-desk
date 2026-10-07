import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { TaskEscalatedEvent } from '../src/messaging/contracts/task-escalated.event';
import { RealtimeController } from '../src/realtime/realtime.controller';
import { RealtimeStateService } from '../src/realtime/realtime-state.service';
import { SystemRole } from '../src/security/auth/system-role';
import { SecurityModule } from '../src/security/security.module';

describe('Realtime RBAC (e2e)', () => {
  let app: INestApplication<App>;

  const secret = 'plan16-realtime-rbac-test-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const managerId = '77777777-7777-4777-8777-777777777777';

  const workerId = '88888888-8888-4888-8888-888888888888';

  const escalation: TaskEscalatedEvent = {
    eventId: 'event-1',

    eventType: 'task.escalated',

    eventVersion: 1,

    occurredAt: '2030-01-10T12:00:00.000Z',

    source: 'worker-management',

    data: {
      taskId: '11111111-1111-4111-8111-111111111111',

      taskCategory: 'ROOM_CLEANING',

      roomNumber: 'T102',

      priority: 'HIGH',

      escalatedAt: '2030-01-10T12:00:00.000Z',
    },
  };

  const realtimeStateService = {
    getRecentEscalations: jest.fn<() => TaskEscalatedEvent[]>(),
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

      controllers: [RealtimeController],

      providers: [
        {
          provide: RealtimeStateService,

          useValue: realtimeStateService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    realtimeStateService.getRecentEscalations.mockReturnValue([escalation]);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 for unauthenticated realtime contract read', async () => {
    await request(app.getHttpServer()).get('/realtime/contract').expect(401);
  });

  it('allows a receptionist to read realtime contract', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/realtime/contract')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('allows a manager to read realtime contract', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .get('/realtime/contract')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 403 when a worker reads realtime contract', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .get('/realtime/contract')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 401 for unauthenticated escalation fallback read', async () => {
    await request(app.getHttpServer()).get('/realtime/escalations').expect(401);
  });

  it('allows a receptionist to read escalations', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/realtime/escalations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([escalation]);
  });

  it('allows a manager to read escalations', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .get('/realtime/escalations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 403 when a worker reads escalations', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .get('/realtime/escalations')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(realtimeStateService.getRecentEscalations).not.toHaveBeenCalled();
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
