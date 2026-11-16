import { apiClient } from "@/lib/api/api-client";

import type {
  CheckInPrintRequest,
  CheckInPrintResult,
  CheckInRequest,
  CheckInResult,
} from "../types/check-in.type";

export function checkInGuest(payload: CheckInRequest): Promise<CheckInResult> {
  return apiClient<CheckInResult>("/check-in", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestCheckInPrint(
  bookingReference: string,
  payload: CheckInPrintRequest,
): Promise<CheckInPrintResult> {
  return apiClient<CheckInPrintResult>(
    `/check-in/${encodeURIComponent(bookingReference)}/print`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
