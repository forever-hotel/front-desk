import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceRequestCategory } from '../../service-requests/models/service-request-category';
import { WkmsHttpClient } from './wkms-http.client';

describe('WkmsHttpClient', () => {
  function createConfigService(values: Record<string, unknown>): ConfigService {
    return {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        return Object.prototype.hasOwnProperty.call(values, key)
          ? values[key]
          : defaultValue;
      }),
    } as unknown as ConfigService;
  }

  function createClient(values: Record<string, unknown> = {}): WkmsHttpClient {
    return new WkmsHttpClient(createConfigService(values));
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject requests when WKMS integration is disabled', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const client = createClient({
      WKMS_INTEGRATION_ENABLED: false,
    });

    await expect(
      client.createServiceTask({
        roomNumber: 'T102',
        category: ServiceRequestCategory.EXTRA_TOWELS,
        requestedBy: '66666666-6666-4666-8666-666666666666',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should reject requests when WKMS base URL is missing', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const client = createClient({
      WKMS_INTEGRATION_ENABLED: true,
    });

    await expect(
      client.createServiceTask({
        roomNumber: 'T102',
        category: ServiceRequestCategory.MAINTENANCE,
        requestedBy: '66666666-6666-4666-8666-666666666666',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should create a service task through the WKMS REST API', async () => {
    const responseBody = {
      taskId: '11111111-1111-4111-8111-111111111111',
      roomNumber: 'T102',
      category: 'EXTRA_TOWELS',
      status: 'UNASSIGNED',
      priority: 'NORMAL',
      createdAt: '2030-01-10T12:00:00.000Z',
    };

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn(async () => responseBody),
    } as unknown as Response);

    const client = createClient({
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
      WKMS_REQUEST_TIMEOUT_MS: 5000,
    });

    const result = await client.createServiceTask({
      roomNumber: 'T102',
      category: ServiceRequestCategory.EXTRA_TOWELS,
      description: 'Please send two towels',
      requestedBy: '66666666-6666-4666-8666-666666666666',
    });

    expect(result).toEqual(responseBody);

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, options] = fetchSpy.mock.calls[0];

    expect(String(url)).toBe('http://localhost:3002/wkms/internal/tasks');

    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );

    expect(JSON.parse(String(options?.body))).toEqual({
      source: 'FRONT_DESK',
      roomNumber: 'T102',
      category: 'EXTRA_TOWELS',
      description: 'Please send two towels',
      priority: 'NORMAL',
      requestedBy: '66666666-6666-4666-8666-666666666666',
    });

    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('should retrieve available workers from WKMS', async () => {
    const workers = [
      {
        workerId: '77777777-7777-4777-8777-777777777777',
        displayName: 'Test Worker',
        activeTaskCount: 1,
        maxActiveTasks: 3,
      },
    ];

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn(async () => workers),
    } as unknown as Response);

    const client = createClient({
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
    });

    await expect(client.getAvailableWorkers()).resolves.toEqual(workers);

    const [url, options] = fetchSpy.mock.calls[0];

    expect(String(url)).toBe(
      'http://localhost:3002/wkms/internal/workers/available',
    );

    expect(options).toEqual(
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('maps authenticated WKMS DDP-198 manual assignment to the FDS contract', async () => {
    const taskId = '11111111-1111-4111-8111-111111111111';
    const workerId = '77777777-7777-4777-8777-777777777777';
    const assignedBy = '66666666-6666-4666-8666-666666666666';
    const serviceToken =
      'fds-wkms-integration-test-credential-minimum-32-chars';

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn(async () => ({
        task_id: taskId,
        assigned_worker_id: workerId,
        status: 'ASSIGNED',
        updated_at: '2030-01-10T12:05:00.000Z',
      })),
    } as unknown as Response);

    const client = createClient({
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
      FDS_WKMS_SERVICE_TOKEN: serviceToken,
    });

    await expect(
      client.assignTask({ taskId, workerId, assignedBy }),
    ).resolves.toEqual({
      taskId,
      status: 'ASSIGNED',
      assignedWorkerId: workerId,
      assignedAt: '2030-01-10T12:05:00.000Z',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      `http://localhost:3002/wkms/tasks/${taskId}/manual-assign`,
    );
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken}`,
        },
      }),
    );
    expect(JSON.parse(String(options?.body))).toEqual({ workerId });
    expect(String(options?.body)).not.toContain(assignedBy);
  });

  it('fails closed when the WKMS service credential is missing or too short', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const client = createClient({
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
    });
    await expect(
      client.assignTask({
        taskId: '11111111-1111-4111-8111-111111111111',
        workerId: '77777777-7777-4777-8777-777777777777',
        assignedBy: '66666666-6666-4666-8666-666666666666',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a mismatched WKMS task assignment response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn(async () => ({
        task_id: '11111111-1111-4111-8111-111111111111',
        assigned_worker_id: '99999999-9999-4999-8999-999999999999',
        status: 'ASSIGNED',
      })),
    } as unknown as Response);
    const client = createClient({
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
      FDS_WKMS_SERVICE_TOKEN:
        'fds-wkms-integration-test-credential-minimum-32-chars',
    });
    await expect(
      client.assignTask({
        taskId: '11111111-1111-4111-8111-111111111111',
        workerId: '77777777-7777-4777-8777-777777777777',
        assignedBy: '66666666-6666-4666-8666-666666666666',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('should convert a non-success WKMS response to BadGatewayException', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 409,
      json: jest.fn(),
    } as unknown as Response);

    const client = createClient({
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
    });

    await expect(
      client.createServiceTask({
        roomNumber: 'T102',
        category: ServiceRequestCategory.OTHER,
        requestedBy: '66666666-6666-4666-8666-666666666666',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('should convert a network failure to ServiceUnavailableException', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('ECONNREFUSED'));

    const client = createClient({
      WKMS_INTEGRATION_ENABLED: true,
      WKMS_BASE_URL: 'http://localhost:3002',
    });

    await expect(client.getAvailableWorkers()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
