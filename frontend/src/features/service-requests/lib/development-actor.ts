/**
 * Local-development convenience only. This decodes (but DOES NOT verify) a
 * receptionist JWT so that the test actor matches the JWT's subject.
 * Never treat this decoded value as proof of authentication or authorization.
 * Backend JWT verification, role guards and requireMatchingActor are mandatory.
 * Production Auth Service integration must supply the actor separately.
 */
export function getLocalDevelopmentReceptionistId(): string | null {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH !== "true" ||
    typeof window === "undefined" ||
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return null;
  }

  try {
    const token = window.sessionStorage.getItem("fds:dev-test-jwt");
    const parts = token?.split(".");

    const encodedPayload = parts?.[1];

    if (parts?.length !== 3 || !encodedPayload) {
      return null;
    }

    const encoded = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(window.atob(padded));

    if (!payload || typeof payload !== "object") {
      return null;
    }

    const claims = payload as Record<string, unknown>;
    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      claims.role !== "RECEPTIONIST" ||
      typeof claims.sub !== "string" ||
      !uuidV4.test(claims.sub) ||
      typeof claims.exp !== "number" ||
      !Number.isFinite(claims.exp) ||
      claims.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    return claims.sub;
  } catch {
    return null;
  }
}
