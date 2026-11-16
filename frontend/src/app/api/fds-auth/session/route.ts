import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/staff-bff";
export async function GET(request: NextRequest) {
  const response = await auth(request, "session");
  if (!response.ok) return response;
  const session = await response.json();
  return NextResponse.json(
    {
      userId: session.sub,
      displayName: session.username,
      role: session.role,
      passwordChangeRequired: session.passwordChangeRequired,
      expiresAt: new Date(session.expiresAt * 1000).toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
