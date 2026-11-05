import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import request from 'supertest';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';
import { RealtimePublisherService } from '../src/realtime/realtime-publisher.service';
import { RealtimeStateService } from '../src/realtime/realtime-state.service';
import { RealtimeController } from '../src/realtime/realtime.controller';
import { RabbitMqService } from '../src/messaging/rabbitmq/rabbitmq.service';
import { SecurityModule } from '../src/security/security.module';
import { PrincipalResolver } from '../src/security/auth/principal-resolver';
import { RoomStatus } from '../src/rooms/models/room-status';

describe('FDS shared realtime handoff (integration)', () => {
  let app: INestApplication;
  const publishRealtime = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), SecurityModule],
      controllers: [RealtimeController],
      providers: [
        RealtimeGateway,
        RealtimePublisherService,
        RealtimeStateService,
        { provide: RabbitMqService, useValue: { publishRealtime } },
      ],
    })
      .overrideProvider(PrincipalResolver)
      .useValue({
        resolve: async (request: { headers: { authorization?: string } }) =>
          request.headers.authorization === 'Bearer receptionist'
            ? { userId: 'staff', role: 'RECEPTIONIST' }
            : null,
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('keeps snapshots protected and does not expose a native socket server', async () => {
    await request(app.getHttpServer()).get('/realtime/escalations').expect(401);
    await request(app.getHttpServer())
      .get('/realtime/escalations')
      .set('Authorization', 'Bearer receptionist')
      .expect(200, []);
    await request(app.getHttpServer())
      .get('/socket.io/?EIO=4&transport=polling')
      .expect(404);
  });
  it('relays committed room changes to RabbitMQ without private room data', async () => {
    app
      .get(RealtimePublisherService)
      .publishRoomStatusUpdated({
        roomNumber: '101',
        status: RoomStatus.OCCUPIED,
        source: 'CHECK_IN',
      });
    await Promise.resolve();
    expect(publishRealtime).toHaveBeenCalledWith('fds', 'room.status.updated');
    expect(JSON.stringify(publishRealtime.mock.calls)).not.toContain('101');
  });
});
