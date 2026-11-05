"use client";

import { CheckOutScreen } from "@/features/check-outs";
import { useCentralAuthSession } from "@/features/auth/providers/central-auth-session-provider";

export default function CheckOutPage() {
  const auth = useCentralAuthSession();
  const session = auth.status === "authenticated" ? auth.session : null;
  const performedBy =
    session &&
    !session.passwordChangeRequired &&
    ["RECEPTIONIST", "ROOT"].includes(session.role) &&
    Date.parse(session.expiresAt) > Date.now()
      ? session.userId
      : undefined;

  return <CheckOutScreen performedBy={performedBy} />;
}
