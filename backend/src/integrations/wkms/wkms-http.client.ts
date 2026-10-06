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
    return this.request<WkmsTaskAssignmentResult>(
      `/wkms/internal/tasks/${encodeURIComponent(input.taskId)}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({
          workerId: input.workerId,
          assignedBy: input.assignedBy,
        }),
      },
    );
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
