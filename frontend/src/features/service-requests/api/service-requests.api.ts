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
    headers: { "Idempotency-Key": payload.requestId ?? crypto.randomUUID() },
    body: JSON.stringify({
      bookingReference: payload.bookingReference,
      category: payload.category,
      description: payload.description,
      performedBy: payload.performedBy,
    }),
  });
}
