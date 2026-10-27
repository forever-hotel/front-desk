import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WkmsClient } from './wkms.client';
import type {
  AssignWkmsTaskInput,
  CreateWkmsServiceTaskInput,
  WkmsAvailableWorker,
  WkmsTaskAssignmentResult,
  WkmsTaskResult,
} from './wkms.types';

@Injectable()
export class WkmsHttpClient extends WkmsClient {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async createServiceTask(
    input: CreateWkmsServiceTaskInput,
  ): Promise<WkmsTaskResult> {
    return this.request<WkmsTaskResult>('/wkms/internal/tasks', {
      method: 'POST',
      body: JSON.stringify({
        source: 'FRONT_DESK',
        roomNumber: input.roomNumber,
        category: input.category,
        description: input.description,
        priority: 'NORMAL',
        requestedBy: input.requestedBy,
      }),
    });
  }

  async getAvailableWorkers(): Promise<WkmsAvailableWorker[]> {
    return this.request<WkmsAvailableWorker[]>(
      '/wkms/internal/workers/available',
      {
        method: 'GET',
      },
    );
  }

  async assignTask(
    input: AssignWkmsTaskInput,
  ): Promise<WkmsTaskAssignmentResult> {
    // Trust only a server-side credential. Never accept it from browser input.
    const token = this.configService.get<string>('FDS_WKMS_SERVICE_TOKEN');

    if (typeof token !== 'string' || token.length < 32) {
      throw new ServiceUnavailableException(
        'WKMS service authentication is not configured',
      );
    }

    // WKMS DDP-198 owns this authenticated endpoint. The FDS principal is
    // checked at our controller; WKMS must not trust an assignedBy body field.
    const raw: unknown = await this.request<unknown>(
      `/wkms/tasks/${encodeURIComponent(input.taskId)}/manual-assign`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workerId: input.workerId }),
      },
    );

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadGatewayException('WKMS returned an invalid task assignment');
    }

    const result = raw as Record<string, unknown>;

    if (
      result.task_id !== input.taskId ||
      result.assigned_worker_id !== input.workerId ||
      result.status !== 'ASSIGNED'
    ) {
      throw new BadGatewayException(
        'WKMS returned a mismatched task assignment',
      );
    }

    const assignedAt = result.updated_at;

    return {
      taskId: input.taskId,
      status: 'ASSIGNED',
      assignedWorkerId: input.workerId,
      ...(typeof assignedAt === 'string' ? { assignedAt } : {}),
    };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const enabled = this.configService.get<boolean>(
      'WKMS_INTEGRATION_ENABLED',
      false,
    );

    if (!enabled) {
      throw new ServiceUnavailableException(
        'WKMS integration is disabled for the current environment',
      );
    }

    const baseUrl = this.configService.get<string>('WKMS_BASE_URL');

    if (!baseUrl) {
      throw new ServiceUnavailableException('WKMS base URL is not configured');
    }

    const timeoutMs = this.configService.get<number>(
      'WKMS_REQUEST_TIMEOUT_MS',
      5000,
    );

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(new URL(path, baseUrl), {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadGatewayException(
          `WKMS request failed with status ${response.status}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new ServiceUnavailableException('WKMS is currently unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
}
