# Front Desk browser authentication

`/login` and `/change-password` use the existing FDS palette and Ant Design form
components. Same-origin `/api/auth/[action]` handlers call gateway `/fds/auth/*`.
JWTs stay in the HttpOnly `fds_session` cookie and never appear in browser session
JSON or development-token storage. Write handlers require the configured
`APP_ORIGIN` and reject cross-site requests.

`/api/fds-auth/session` exposes only verified identity, effective role, expiry and
first-password-change state. The protected layout always enables the session
gate. A required initial change blocks content and redirects to the change page.
Expired or rejected sessions redirect to login; provider outages fail closed.

Business APIs use `/api/backend/[...path]`. The BFF adds the cookie's bearer token
to requests through the gateway. Native sockets authenticate the same HttpOnly
cookie with the gateway; they do not read an injected development JWT.

Runtime server settings: `API_GATEWAY_INTERNAL_URL` and `APP_ORIGIN`. Root Compose
sets these automatically. The native socket transport remains separate from the
shared WebSocket transport until that integration is completed.
