"use client";

import { useContext } from "react";

import { RealtimeContext } from "@/providers/realtime-provider";

export function useRealtimeStatus() {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error("useRealtimeStatus must be used within RealtimeProvider.");
  }

  return context;
}
