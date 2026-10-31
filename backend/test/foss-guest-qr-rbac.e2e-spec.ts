import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { FossGuestQrController } from '../src/check-ins/qr/foss-guest-qr.controller';
import { FossGuestQrService } from '../src/check-ins/qr/foss-guest-qr.service';
import { SecurityModule } from '../src/security/security.module';
import { SystemRole } from '../src/security/auth/system-role';

describe('FDS FOSS QR endpoint authorization (e2e)', () => {
  const secret = 'safe-test-only-secret-for-fds-qr-rbac-e2e-tests';
  const issuer = 'forever-hotel-auth';
  const booking = '22222222-2222-4222-8222-222222222222';
  const result = {
    roomNumber: '101',
    activationUrl: 'https://guest.example.invalid/activate#token=DEMO-TEST',
    expiresAt: '2030-12-31T00:00:00.000Z',
    demo: true,
  };
  const qrService = {
    issue: jest.fn<() => Promise<typeof result>>(),
  };
  let app: INestApplication<App>;

  async function bearer(role: SystemRole): Promise<string> {
    return new SignJWT({ role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setSubject('77777777-7777-4777-8777-777777777777')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: secret, JWT_ISSUER: issuer })],
        }),
        SecurityModule,
      ],
      controllers: [FossGuestQrController],
      providers: [{ provide: FossGuestQrService, useValue: qrService }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    qrService.issue.mockReset();
    qrService.issue.mockResolvedValue(result);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('returns 401 without credentials', async () => {
    await request(app.getHttpServer())
      .post(`/check-in/${booking}/foss-qr`)
      .expect(401);
    expect(qrService.issue).not.toHaveBeenCalled();
  });

  it('returns 403 for a manager', async () => {
    const token = await bearer(SystemRole.MANAGER);
    await request(app.getHttpServer())
      .post(`/check-in/${booking}/foss-qr`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(qrService.issue).not.toHaveBeenCalled();
  });

  it('allows a receptionist and returns no-store headers', async () => {
    const token = await bearer(SystemRole.RECEPTIONIST);
    await request(app.getHttpServer())
      .post(`/check-in/${booking}/foss-qr`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect('Cache-Control', 'no-store, private')
      .expect(result);
    expect(qrService.issue).toHaveBeenCalledWith(booking);
  });

  it('rejects malformed booking IDs', async () => {
    const token = await bearer(SystemRole.RECEPTIONIST);
    await request(app.getHttpServer())
      .post('/check-in/not-a-uuid/foss-qr')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(qrService.issue).not.toHaveBeenCalled();
  });
});
