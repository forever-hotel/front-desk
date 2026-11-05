"use client";

import { CheckInScreen } from "@/features/check-ins";
import { useCentralAuthSession } from "@/features/auth/providers/central-auth-session-provider";

export default function CheckInPage() {
  const auth = useCentralAuthSession();
  const session = auth.status === "authenticated" ? auth.session : null;
  const performedBy =
    session &&
    !session.passwordChangeRequired &&
    ["RECEPTIONIST", "ROOT"].includes(session.role) &&
    Date.parse(session.expiresAt) > Date.now()
      ? session.userId
      : undefined;

  return <CheckInScreen performedBy={performedBy} />;
}
