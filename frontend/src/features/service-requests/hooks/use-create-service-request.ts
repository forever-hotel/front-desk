"use client";

import { useMutation } from "@tanstack/react-query";

import { createServiceRequest } from "../api/service-requests.api";

export function useCreateServiceRequest() {
  return useMutation({
    mutationFn: createServiceRequest,
  });
}
