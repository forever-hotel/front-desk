import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RoomStatus } from '../src/rooms/models/room-status';
import type { RoomStatusBoardItem } from '../src/rooms/models/room-status-board-item';
import type { RoomStatusTransitionResult } from '../src/rooms/models/room-status-transition-result';
import { RoomsController } from '../src/rooms/rooms.controller';
import { RoomsService } from '../src/rooms/rooms.service';
import { SystemRole } from '../src/security/auth/system-role';
import { SecurityModule } from '../src/security/security.module';

describe('Rooms RBAC (e2e)', () => {
  let app: INestApplication<App>;

  const secret = 'plan16-rooms-rbac-test-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const managerId = '77777777-7777-4777-8777-777777777777';

  const workerId = '88888888-8888-4888-8888-888888888888';

  const anotherStaffId = '99999999-9999-4999-8999-999999999999';

  const statusBoard: RoomStatusBoardItem[] = [
    {
      roomNumber: 'T101',
      roomTypeId: '11111111-1111-4111-8111-111111111111',
      roomTypeName: 'Standard',
      floor: 1,
      status: RoomStatus.VACANT,
      lastClearedAt: '2032-01-10T08:00:00.000Z',
      updatedAt: '2032-01-10T08:00:00.000Z',
    },
  ];

  const transitionResult: RoomStatusTransitionResult = {
    roomNumber: 'T103',
    previousStatus: RoomStatus.VACANT,
    status: RoomStatus.UNDER_MAINTENANCE,
    lastClearedAt: '2032-01-10T08:00:00.000Z',
    updatedAt: '2032-01-10T11:00:00.000Z',
  };

  const roomsService = {
    getStatusBoard: jest.fn<() => Promise<RoomStatusBoardItem[]>>(),

    updateStatus: jest.fn<
      (
        roomNumber: string,
        dto: {
          targetStatus: RoomStatus;
          performedBy?: string;
          notes?: string;
        },
      ) => Promise<RoomStatusTransitionResult>
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

      controllers: [RoomsController],

      providers: [
        {
          provide: RoomsService,
          useValue: roomsService,
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

    roomsService.getStatusBoard.mockResolvedValue(statusBoard);

    roomsService.updateStatus.mockResolvedValue(transitionResult);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 for unauthenticated room-status read', async () => {
    await request(app.getHttpServer()).get('/rooms/status').expect(401);
  });

  it('allows a receptionist to read room status', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/rooms/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(statusBoard);
  });

  it('allows a manager to read room status', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .get('/rooms/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 403 when a worker reads room status', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .get('/rooms/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 401 for unauthenticated room-status mutation', async () => {
    await request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .send({
        targetStatus: 'UNDER_MAINTENANCE',
      })
      .expect(401);
  });

  it('allows a receptionist to update room status and derives performedBy from JWT', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetStatus: 'UNDER_MAINTENANCE',
        notes: 'Air-conditioner repair',
      })
      .expect(200)
      .expect(transitionResult);

    expect(roomsService.updateStatus).toHaveBeenCalledWith('T103', {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      notes: 'Air-conditioner repair',
      performedBy: receptionistId,
    });
  });

  it('allows a matching performedBy value', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetStatus: 'UNDER_MAINTENANCE',
        performedBy: receptionistId,
      })
      .expect(200);
  });

  it('rejects actor impersonation with 403', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetStatus: 'UNDER_MAINTENANCE',
        performedBy: anotherStaffId,
      })
      .expect(403);

    expect(roomsService.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when a manager attempts room mutation', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetStatus: 'UNDER_MAINTENANCE',
      })
      .expect(403);

    expect(roomsService.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when a worker attempts room mutation', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .patch('/rooms/T103/status')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetStatus: 'UNDER_MAINTENANCE',
      })
      .expect(403);

    expect(roomsService.updateStatus).not.toHaveBeenCalled();
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
