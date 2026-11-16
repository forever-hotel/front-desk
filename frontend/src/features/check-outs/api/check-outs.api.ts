import { apiClient } from "@/lib/api/api-client";

import type {
  CreateCheckOutRequest,
  CheckoutResult,
} from "../types/check-out.type";

export function checkOutGuest(
  payload: CreateCheckOutRequest,
): Promise<CheckoutResult> {
  return apiClient<CheckoutResult>("/check-outs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
