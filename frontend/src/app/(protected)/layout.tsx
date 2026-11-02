import type { ReactNode } from "react";

import AppShell from "@/components/layout/app-shell";
import { CentralAuthGate } from "@/features/auth/components/central-auth-gate";
import { CentralAuthSessionProvider } from "@/features/auth/providers/central-auth-session-provider";
import { RealtimeProvider } from "@/providers/realtime-provider";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const content = (
    <RealtimeProvider>
      <AppShell>{children}</AppShell>
    </RealtimeProvider>
  );

  return (
    <CentralAuthSessionProvider>
      <CentralAuthGate>{content}</CentralAuthGate>
    </CentralAuthSessionProvider>
  );
}
