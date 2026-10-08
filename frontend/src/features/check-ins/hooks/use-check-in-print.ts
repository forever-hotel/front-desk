"use client";

import { useMutation } from "@tanstack/react-query";

import { requestCheckInPrint } from "../api/check-ins.api";

import type { CheckInPrintRequest } from "../types/check-in.type";

type PrintCheckInDocumentInput = {
  bookingReference: string;
  payload: CheckInPrintRequest;
};

export function useCheckInPrint() {
  return useMutation({
    mutationFn: ({ bookingReference, payload }: PrintCheckInDocumentInput) =>
      requestCheckInPrint(bookingReference, payload),
  });
}
