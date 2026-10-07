import type { ReactNode } from "react";

import AppShell from "@/components/layout/app-shell";
import { RealtimeProvider } from "@/providers/realtime-provider";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return (
    <RealtimeProvider>
      <AppShell>{children}</AppShell>
    </RealtimeProvider>
  );
}
