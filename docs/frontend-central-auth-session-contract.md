# FDS frontend central authentication — proposed BFF contract

Status: **PROPOSED. Not connected to the Central Authentication Service.**

## Phase B1

- `NEXT_PUBLIC_FDS_CENTRAL_AUTH_ENABLED` is **off by default**. When not set, the existing development/demo shell remains available, but protected FDS APIs still require backend authorization.
- When explicitly set to `true`, the `(protected)` UI is gated on a verified session response from a future **same-origin** `GET /api/fds-auth/session` endpoint.
- `200` must return **only** `{ userId, displayName, role, expiresAt }`, with a UUID staff ID, `RECEPTIONIST` or `MANAGER` role, and ISO-8601 expiration. Never include access tokens, refresh tokens, secrets or password hashes in this response.
- `401` means not authenticated; network errors, schema errors, `404`, `403`, and `5xx` fail closed as session unavailable. An FDS API `401` clears displayed identity.
- This patch does **not** implement the BFF route, sign-in, logout, token exchange, cookie forwarding, or true server-side route protection. **Do not enable the gate in staging or production until those are completed and tested.**
- The current `apiClient` still calls the API Gateway directly. When the BFF uses an HttpOnly cookie, protected calls must move to a same-origin BFF proxy that reads the cookie server-side and attaches an access token to the upstream request, or use another approved secure contract. Do not expose Central Auth access tokens in client storage.
- Socket.IO currently connects directly to FDS backend. Its production authentication method must be designed with the Central Auth team (for example, a short-lived socket credential mediated server-side). The future BFF cookie alone is not automatically sufficient for the existing Socket.IO `auth.token` handshake.
- The proposed Central Auth JWT verifier on the FDS backend continues enforcing tokens/roles; the frontend gate is **not** a security boundary.

## Outstanding decisions for the Central Auth team

1. OIDC discovery, login/callback/logout URLs, PKCE and CSRF/nonce handling.
2. Exact issuer, audience, JWKS URL, token claims, clock skew and rotation contract.
3. Refresh/revocation semantics and same-site cookie domain in local/staging/production.
4. Shared staff identity and receptionist/manager role source.
5. REST BFF proxy design and Socket.IO credential handoff.

## Test plan

1. Unit tests for valid, unauthorized, expired, unsupported-role, malformed and unavailable session responses.
2. Provider tests for correct identity display and reset after FDS 401.
3. When BFF exists: E2E sign-in, navigation, protected GET/POST, role denial, expiration, logout/revocation and Socket.IO reauthentication.
