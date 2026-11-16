"use client";

import { useSessionCurrent } from "@/hooks/use-session-current";

import { CheckInScreen } from "@/features/check-ins";
import { useCentralAuthSession } from "@/features/auth/providers/central-auth-session-provider";

export default function CheckInPage() {
  const auth = useCentralAuthSession();
  const session = auth.status === "authenticated" ? auth.session : null;
  const sessionCurrent = useSessionCurrent(session?.expiresAt);
  const performedBy =
    session &&
    !session.passwordChangeRequired &&
    ["RECEPTIONIST", "ROOT"].includes(session.role) &&
    sessionCurrent
      ? session.userId
      : undefined;

  return <CheckInScreen performedBy={performedBy} />;
}
