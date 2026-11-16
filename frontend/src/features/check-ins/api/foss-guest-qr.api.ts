import { apiClient } from "@/lib/api/api-client";
import type { FossGuestQrResult } from "../types/foss-guest-qr.type";

export function issueFossGuestQr(
  bookingReference: string,
): Promise<FossGuestQrResult> {
  return apiClient<FossGuestQrResult>(
    `/check-in/${encodeURIComponent(bookingReference)}/foss-qr`,
    { method: "POST" },
  );
}
