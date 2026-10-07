import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { CreateRoomChangeDto } from '../src/room-changes/dto/create-room-change.dto';
import type { AvailableRoomChangeOption } from '../src/room-changes/models/available-room-change-option';
import type { RoomChangeResult } from '../src/room-changes/models/room-change-result';
import { RoomChangesController } from '../src/room-changes/room-changes.controller';
import { RoomChangesService } from '../src/room-changes/room-changes.service';
import { RoomStatus } from '../src/rooms/models/room-status';
import { SystemRole } from '../src/security/auth/system-role';
import { SecurityModule } from '../src/security/security.module';

describe('Room Changes RBAC (e2e)', () => {
  let app: INestApplication<App>;

  const secret = 'plan16-room-changes-rbac-test-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const anotherStaffId = '77777777-7777-4777-8777-777777777777';

  const managerId = '88888888-8888-4888-8888-888888888888';

  const workerId = '99999999-9999-4999-8999-999999999999';

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const availableRooms: AvailableRoomChangeOption[] = [
    {
      roomNumber: 'T105',

      roomTypeId: '11111111-1111-4111-8111-111111111111',

      roomTypeName: 'Standard',

      floor: 1,

      status: RoomStatus.VACANT,

      lastClearedAt: '2032-01-10T08:00:00.000Z',

      updatedAt: '2032-01-10T08:00:00.000Z',
    },
  ];

  const roomChangeResult: RoomChangeResult = {
    status: 'room_changed',

    bookingReference,

    previousRoomNumber: 'T102',

    roomNumber: 'T105',

    previousRoomStatus: RoomStatus.REQUIRES_CLEANING,

    roomStatus: RoomStatus.OCCUPIED,

    auditLogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  };

  const roomChangesService = {
    findAvailableRooms:
      jest.fn<
        (bookingReference: string) => Promise<AvailableRoomChangeOption[]>
      >(),

    changeRoom:
      jest.fn<(dto: CreateRoomChangeDto) => Promise<RoomChangeResult>>(),
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

      controllers: [RoomChangesController],

      providers: [
        {
          provide: RoomChangesService,

          useValue: roomChangesService,
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

    roomChangesService.findAvailableRooms.mockResolvedValue(availableRooms);

    roomChangesService.changeRoom.mockResolvedValue(roomChangeResult);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 for unauthenticated available-room lookup', async () => {
    await request(app.getHttpServer())
      .get(`/room-changes/${bookingReference}/available-rooms`)
      .expect(401);
  });

  it('allows a receptionist to view available rooms', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get(`/room-changes/${bookingReference}/available-rooms`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(availableRooms);
  });

  it('allows a manager to view available rooms', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .get(`/room-changes/${bookingReference}/available-rooms`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 403 when a worker views available rooms', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .get(`/room-changes/${bookingReference}/available-rooms`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 401 for unauthenticated room change', async () => {
    await request(app.getHttpServer())
      .post('/room-changes')
      .send(createRoomChangePayload(receptionistId))
      .expect(401);
  });

  it('allows a receptionist to perform a room change', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/room-changes')
      .set('Authorization', `Bearer ${token}`)
      .send(createRoomChangePayload(receptionistId))
      .expect(201)
      .expect(roomChangeResult);

    expect(roomChangesService.changeRoom).toHaveBeenCalledWith({
      bookingReference,

      targetRoomNumber: 'T105',

      performedBy: receptionistId,

      reason: 'Guest requested quieter room',
    });
  });

  it('rejects performedBy impersonation with 403', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/room-changes')
      .set('Authorization', `Bearer ${token}`)
      .send(createRoomChangePayload(anotherStaffId))
      .expect(403);

    expect(roomChangesService.changeRoom).not.toHaveBeenCalled();
  });

  it('returns 403 when a manager attempts a room change', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .post('/room-changes')
      .set('Authorization', `Bearer ${token}`)
      .send(createRoomChangePayload(managerId))
      .expect(403);

    expect(roomChangesService.changeRoom).not.toHaveBeenCalled();
  });

  it('returns 403 when a worker attempts a room change', async () => {
    const token = await createToken(workerId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .post('/room-changes')
      .set('Authorization', `Bearer ${token}`)
      .send(createRoomChangePayload(workerId))
      .expect(403);

    expect(roomChangesService.changeRoom).not.toHaveBeenCalled();
  });

  function createRoomChangePayload(performedBy: string): CreateRoomChangeDto {
    return {
      bookingReference,

      targetRoomNumber: 'T105',

      performedBy,

      reason: 'Guest requested quieter room',
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
