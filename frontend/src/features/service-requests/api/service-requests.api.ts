import { apiClient } from "@/lib/api/api-client";

import type {
  CreateServiceRequest,
  ServiceRequestResult,
} from "../types/service-request.type";

export function createServiceRequest(
  payload: CreateServiceRequest,
): Promise<ServiceRequestResult> {
  return apiClient<ServiceRequestResult>("/service-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
