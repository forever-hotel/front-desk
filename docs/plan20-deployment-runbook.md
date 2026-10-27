# Plan 20 — Front Desk deployment and smoke-test runbook

**Document date:** 2026-10-25. **Status:** local Docker/Gateway verified; public
HTTPS staging and full authentication are **not verified**.

## Architecture and boundaries

- Frontend: Next.js; local Docker host `http://127.0.0.1:3100`.
- Backend: NestJS FDS; local Docker host `http://127.0.0.1:4200`.
- Gateway: separate `forever-hotel/api-gateway` repository; local host
  `http://127.0.0.1:8080`; maps `/fds/*` to FDS backend `/*`.
- Postgres: only the agreed FDS-owned tables. The user-configured Docker local
  backend may point at a **non-production** Neon environment. Never run database
  integration tests or destructive migrations against shared Neon data.
- RabbitMQ: broker can be run in Docker; `compose.fds.yaml` explicitly sets
  `RABBITMQ_ENABLED=false`, so broker ping does not verify FDS messaging.
- Auth: FDS validates JWT/roles, not the Gateway. `legacy` mode is used for
  current local testing. `central` mode requires final Central Auth issuer,
  audience and trusted HTTPS JWKS. The BFF session endpoint does not yet exist.
- Socket.IO: direct connection to FDS backend, not via the REST gateway; real
  Central Auth credential forwarding is pending.

## Local startup (Windows PowerShell)

1. Open Docker Desktop. Confirm `docker version` and `docker compose version`.
2. In `backend/.env.docker.local` supply a valid **test/dev** database and a
   secure local HS256 secret if using legacy staging config. This file is
   secret-bearing and ignored by Git. Check that `DB_SYNCHRONIZE=false`.
3. Start the Gateway separately using its own repo README, with
   `FDS_SERVICE_URL=http://host.docker.internal:4200` **only when the Gateway
   runs in a container**; when Gateway runs directly on Windows use
   `http://127.0.0.1:4200` as its FDS upstream. Set the exact allowed frontend
   origins (`http://127.0.0.1:3100`, etc.) according to that repo's config.
4. In this repo root:

```powershell
docker compose -f compose.fds.yaml config --quiet
docker compose -f compose.fds.yaml up --build -d
docker compose -f compose.fds.yaml ps
.\scripts\plan20-smoke.ps1 -EvidencePath '.\evidence\plan20-local-smoke.json'
```

Expected read-only smoke results: frontend `200`; backend readiness `200`;
Gateway forwarded FDS readiness `200`; no-token `/fds/rooms/status` `401`;
RabbitMQ broker diagnostics ping success if the named broker is running.
Unverified live integration must **not** be reported as PASS.

The Gateway `/health/ready` checks **all** enabled upstreams and may return
`503` when another subsystem is down; prefer `/fds/health/ready` to test the
FDS route specifically.

## Automated test and audit commands

In `frontend/`:

```powershell
npm ci
npm run format:check
npm run lint
npm run test:cov
npm run build
npm audit --omit=dev --audit-level=high
```

In `backend/`:

```powershell
npm ci
npm run format:check
npm run lint
npm run build
npm run test:cov -- --runInBand
npm audit --audit-level=high
```

Backend integration/E2E tests requiring database writes must run only against
an **isolated disposable PostgreSQL database**, as provisioned by Backend CI.
Never run those tests on a shared Neon branch.

## Public staging go-live checklist — not yet executed

For a real staging environment, provide an owned HTTPS domain and valid TLS
certificates. Configure frontend build-time URLs with real HTTPS and WSS
endpoints, Gateway routes and allowed CORS origins, database TLS connections,
secret management and the **actual** Central Auth contract. The frontend must
not expose signing keys or access/refresh tokens in JavaScript-accessible
storage. Implement a same-origin session BFF, verify CSRF protections for
cookie-authenticated writes, and ensure the real Socket.IO auth credential
handoff works across origins. Keep the gate disabled until complete; then
verify login, role denial, expiration, logout and socket re-authentication.

If enabling FDS RabbitMQ integration in an isolated environment, use the
approved exchange/routing contracts and verify actual publish/consumer flows,
retry/dead-letter behavior and authenticated realtime receipt. A broker ping
alone is insufficient. FOSS/WKMS/physical printing remain separately owned;
label mock adapters explicitly.

## Safety and evidence

Retain CI run URLs and coverage artifacts; preserve the redacted screenshot
register in `docs/plan20-staging-test-register.md`. Do not commit `.env`, JWTs,
passwords, `.git.zip`, guest documents or unredacted guest PII. Commit the
redacted generated smoke JSON only after reviewing its contents.

## CI references

- [Backend integration, E2E, unit/coverage and audit PASS](https://github.com/forever-hotel/front-desk/actions/runs/40065033714)
- [Frontend format/lint/coverage/build/audit PASS](https://github.com/forever-hotel/front-desk/actions/runs/40175759144)
- [Docker build, non-root runtime and smoke PASS](https://github.com/forever-hotel/front-desk/actions/runs/40175759148)
