import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  WkmsAvailableWorker,
  WkmsTaskAssignmentResult,
} from '../src/integrations/wkms/wkms.types';
import type { CreateServiceRequestDto } from '../src/service-requests/dto/create-service-request.dto';
import { ServiceRequestCategory } from '../src/service-requests/models/service-request-category';
import type { ServiceRequestResult } from '../src/service-requests/models/service-request-result';
import { ServiceRequestsController } from '../src/service-requests/service-requests.controller';
import { ServiceRequestsService } from '../src/service-requests/service-requests.service';
import { SystemRole } from '../src/security/auth/system-role';
import { SecurityModule } from '../src/security/security.module';

describe('Service Requests RBAC (e2e)', () => {
  let app: INestApplication<App>;

  const secret = 'plan16-service-request-rbac-secret-at-least-32-characters';

  const issuer = 'forever-hotel-auth';

  const receptionistId = '66666666-6666-4666-8666-666666666666';

  const anotherStaffId = '77777777-7777-4777-8777-777777777777';

  const workerUserId = '88888888-8888-4888-8888-888888888888';

  const managerId = '99999999-9999-4999-8999-999999999999';

  const taskId = '11111111-1111-4111-8111-111111111111';

  const assignedWorkerId = '22222222-2222-4222-8222-222222222222';

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const serviceRequestResult: ServiceRequestResult = {
    status: 'created',
    bookingReference,
    roomNumber: 'T102',
    task: {
      taskId,
      roomNumber: 'T102',
      category: 'EXTRA_TOWELS',
      status: 'UNASSIGNED',
      priority: 'NORMAL',
    },
  };

  const availableWorkers: WkmsAvailableWorker[] = [
    {
      workerId: assignedWorkerId,
      displayName: 'Test Worker',
      activeTaskCount: 1,
      maxActiveTasks: 3,
    },
  ];

  const assignmentResult: WkmsTaskAssignmentResult = {
    taskId,
    status: 'ASSIGNED',
    assignedWorkerId,
    assignedAt: '2030-01-10T12:05:00.000Z',
  };

  const serviceRequestsService = {
    create:
      jest.fn<
        (dto: CreateServiceRequestDto) => Promise<ServiceRequestResult>
      >(),

    getAvailableWorkers: jest.fn<() => Promise<WkmsAvailableWorker[]>>(),

    assignTask:
      jest.fn<
        (input: {
          taskId: string;
          workerId: string;
          assignedBy: string;
        }) => Promise<WkmsTaskAssignmentResult>
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

      controllers: [ServiceRequestsController],

      providers: [
        {
          provide: ServiceRequestsService,
          useValue: serviceRequestsService,
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

    serviceRequestsService.create.mockResolvedValue(serviceRequestResult);

    serviceRequestsService.getAvailableWorkers.mockResolvedValue(
      availableWorkers,
    );

    serviceRequestsService.assignTask.mockResolvedValue(assignmentResult);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 401 for unauthenticated service-request creation', async () => {
    await request(app.getHttpServer())
      .post('/service-requests')
      .send(createServiceRequestPayload(receptionistId))
      .expect(401);
  });

  it('allows a receptionist to create a service request', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/service-requests')
      .set('Authorization', `Bearer ${token}`)
      .send(createServiceRequestPayload(receptionistId))
      .expect(201)
      .expect(serviceRequestResult);

    expect(serviceRequestsService.create).toHaveBeenCalledWith({
      bookingReference,
      category: ServiceRequestCategory.EXTRA_TOWELS,
      description: 'Two extra towels',
      performedBy: receptionistId,
    });
  });

  it('rejects service-request actor impersonation with 403', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/service-requests')
      .set('Authorization', `Bearer ${token}`)
      .send(createServiceRequestPayload(anotherStaffId))
      .expect(403);

    expect(serviceRequestsService.create).not.toHaveBeenCalled();
  });

  it('returns 403 when a manager attempts service-request creation', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .post('/service-requests')
      .set('Authorization', `Bearer ${token}`)
      .send(createServiceRequestPayload(managerId))
      .expect(403);

    expect(serviceRequestsService.create).not.toHaveBeenCalled();
  });

  it('allows a receptionist to read available workers', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .get('/service-requests/available-workers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(availableWorkers);
  });

  it('allows a manager to read available workers', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .get('/service-requests/available-workers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 403 when a worker reads available workers', async () => {
    const token = await createToken(workerUserId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .get('/service-requests/available-workers')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows a receptionist to manually assign a task', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post(`/service-requests/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        workerId: assignedWorkerId,
      })
      .expect(201)
      .expect(assignmentResult);

    expect(serviceRequestsService.assignTask).toHaveBeenCalledWith({
      taskId,
      workerId: assignedWorkerId,
      assignedBy: receptionistId,
    });
  });

  it('returns 403 when a manager attempts manual assignment', async () => {
    const token = await createToken(managerId, SystemRole.MANAGER);

    await request(app.getHttpServer())
      .post(`/service-requests/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        workerId: assignedWorkerId,
      })
      .expect(403);

    expect(serviceRequestsService.assignTask).not.toHaveBeenCalled();
  });

  it('returns 403 when a worker attempts manual assignment', async () => {
    const token = await createToken(workerUserId, SystemRole.WORKER);

    await request(app.getHttpServer())
      .post(`/service-requests/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        workerId: assignedWorkerId,
      })
      .expect(403);

    expect(serviceRequestsService.assignTask).not.toHaveBeenCalled();
  });

  it('rejects mass-assignment of assignedBy before service execution', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post(`/service-requests/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        workerId: assignedWorkerId,

        assignedBy: anotherStaffId,
      })
      .expect(400);

    expect(serviceRequestsService.assignTask).not.toHaveBeenCalled();
  });

  it('rejects an invalid task UUID', async () => {
    const token = await createToken(receptionistId, SystemRole.RECEPTIONIST);

    await request(app.getHttpServer())
      .post('/service-requests/tasks/not-a-uuid/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workerId: assignedWorkerId,
      })
      .expect(400);
  });

  function createServiceRequestPayload(
    performedBy: string,
  ): CreateServiceRequestDto {
    return {
      bookingReference,
      category: ServiceRequestCategory.EXTRA_TOWELS,
      description: 'Two extra towels',
      performedBy,
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
