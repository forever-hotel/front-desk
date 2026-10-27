# Forever Hotel — Front Desk System (FDS)

[![Repository](https://img.shields.io/badge/GitHub-front--desk-555555)](https://github.com/forever-hotel/front-desk)

The **Front Desk System (FDS)** is the receptionist-facing subsystem of the Forever Hotel Management System. It supports booking lookup, arrivals and departures, walk-in reservations, identity verification, check-in, room management, room changes, running guest folios, checkout, service-request coordination, audit records and realtime notifications.

**Primary repository:** https://github.com/forever-hotel/front-desk  
**Integration branch:** `develop`  
**Shared API Gateway:** https://github.com/forever-hotel/api-gateway (`main`)  
**Documentation basis:** FDS `develop` as verified on **27 October 2026**.

> **Integration readiness:** FDS is ready to be handed to other subsystem developers for local integration work. Successful local tests and Docker builds do **not** mean the complete six-subsystem hotel application is deployed or production-ready. Central Authentication, live FOSS flows, remaining WKMS APIs, real payments/printing and public HTTPS staging must be verified separately.

## Contents

1. [At a glance](#1-at-a-glance)
2. [Prerequisites and repository setup](#2-prerequisites-and-repository-setup)
3. [Run with Docker Desktop (recommended quick start)](#3-run-with-docker-desktop-recommended-quick-start)
4. [Development database and migrations](#4-development-database-and-migrations)
5. [Run the shared API Gateway](#5-run-the-shared-api-gateway)
6. [Run without Docker](#6-run-without-docker)
7. [Authentication and protected workflows](#7-authentication-and-protected-workflows)
8. [Subsystem integration contracts](#8-subsystem-integration-contracts)
9. [Frontend, backend and API reference](#9-frontend-backend-and-api-reference)
10. [Business and data-integrity rules](#10-business-and-data-integrity-rules)
11. [Testing, CI and evidence](#11-testing-ci-and-evidence)
12. [Troubleshooting](#12-troubleshooting)
13. [Integration handoff checklist](#13-integration-handoff-checklist)
14. [Git workflow and contribution rules](#14-git-workflow-and-contribution-rules)
15. [Reference documentation](#15-reference-documentation)

---

## 1. At a glance

### Technology stack

| Layer | Technology |
|---|---|
| Receptionist UI | Next.js 16, React 19, TypeScript, Ant Design, React Query |
| Front Desk API | NestJS 12, TypeScript, REST, Socket.IO |
| Persistence | PostgreSQL, TypeORM, versioned migrations |
| Shared REST routing | Separate NestJS/Fastify API Gateway |
| Messaging | RabbitMQ (`forever.events`) |
| Authentication | Legacy HS256 for approved local testing; proposed Central Auth RS256/JWKS integration |
| Quality checks | Jest, Supertest, ESLint/Oxlint, Prettier, GitHub Actions |
| Local deployment | Docker Desktop and `compose.fds.yaml` |

### Standard local ports

| Component | Host URL | Details |
|---|---|---|
| FDS frontend (Docker) | http://127.0.0.1:3100 | Browser UI |
| FDS backend (Docker) | http://127.0.0.1:4200 | Direct NestJS backend |
| API Gateway | http://127.0.0.1:8080 | Forwards `/fds/*` to FDS `/*` |
| Readiness (direct) | http://127.0.0.1:4200/health/ready | Checks database connectivity |
| Readiness (Gateway) | http://127.0.0.1:8080/fds/health/ready | Checks routing plus FDS database |
| Socket.IO | FDS backend, `/realtime` namespace | Connect directly to FDS during current local integration |

The root `compose.fds.yaml` starts **only the FDS frontend and backend**. It does not provision the shared hotel database, API Gateway, Central Authentication, RabbitMQ, FOSS or WKMS.

### Current implementation boundaries

- **Implemented and automatically tested:** FDS booking and room lifecycle, REST/RBAC handling, PostgreSQL integration, unit and E2E tests, frontend tests, Docker smoke tests.
- **Locally integration-tested in separate verification environments:** RabbitMQ escalation/event delivery, Socket.IO reconnect/fallback, selected actual WKMS checkout consumption and manual task assignment.
- **Still requires cross-team work:** real Central Auth session/BFF, remaining WKMS task-creation/available-worker APIs, live FOSS guest-session and external-charge integration, production payment/printing, public staging and complete hotel end-to-end acceptance.
- **Demo/contract adapters:** some FOSS, printing, payment and external folio-charge paths use mocks or defined ports. A successful mock test does not prove an external service.

## 2. Prerequisites and repository setup

### Required software

- **Git**, for cloning and collaboration.
- **Docker Desktop** (running with Linux containers), for the recommended container-based setup.
- **Windows PowerShell**, for the commands below (adapt paths for macOS/Linux).
- **Node.js 24.x** (24.21.0 was used in FDS verification), for native frontend/backend development and migrations.
- Access to an **approved development/test PostgreSQL database** prepared with the shared hotel schema and FDS migrations, or a fresh disposable local PostgreSQL database.

> **Gateway runtime difference:** The `api-gateway` repository declares Node.js `>=22.14 <23`. Run Gateway with its supplied Docker Compose file, or use a separate compatible Node.js 22 runtime. Do not assume the Gateway supports the same Node.js 24 runtime as FDS.

### Clone the merged integration code

```powershell
# Choose any development folder on your computer.
git clone -b develop https://github.com/forever-hotel/front-desk.git
cd front-desk

git branch --show-current
git status -sb
```

Expected active branch: `develop`. Create new branches from an up-to-date `develop` for integration changes.

### Repository overview

```text
front-desk/
├── .github/workflows/           # CI pipelines
├── backend/
│   ├── .env.example             # Backend configuration template
│   ├── Dockerfile
│   ├── docs/                    # Checkout and folio API specifications
│   ├── src/                     # NestJS service, data access and migrations
│   └── test/                    # Database, integration and E2E tests
├── frontend/
│   ├── .env.example             # Browser configuration template
│   ├── Dockerfile
│   └── src/                     # Next.js UI and feature modules
├── docs/                        # Deployment, authentication and handoff documents
├── documents/                   # FDS-only final QA PDFs and source notes
├── evidence/                    # Verified local test observations
├── scripts/                     # Smoke and isolated verification runners
├── compose.fds.yaml             # Local frontend + backend Docker Compose
└── README.md
```

**Never commit:** real `.env` files, `.env.local`, `.env.docker.local`, passwords, JWT/private keys, personal guest data, database exports, `node_modules`, `.next`, `dist`, or unredacted screenshots.

## 3. Run with Docker Desktop (recommended quick start)

This mode is best for a **working local frontend/backend container and basic health verification**. It is *not*, by itself, an authenticated hotel-operation demonstration.

### Step 3.1 — Start Docker Desktop

```powershell
docker version
docker compose version
```

Both commands must succeed before continuing.

### Step 3.2 — Create the backend Docker environment

From the `front-desk` root:

```powershell
Copy-Item backend\.env.example backend\.env.docker.local
notepad backend\.env.docker.local
```

Edit the **untracked** `backend/.env.docker.local`. Use test-only values supplied through an approved team channel:

```dotenv
# compose.fds.yaml overrides NODE_ENV and PORT with staging/4200.
NODE_ENV=staging
PORT=4200

# An existing team-approved TEST database. Replace every placeholder.
DB_HOST=<database-host-visible-from-the-container>
DB_PORT=5432
DB_USERNAME=<test-database-user>
DB_PASSWORD=<test-database-password>
DB_NAME=<test-database-name>
DB_SSL=true
DB_SYNCHRONIZE=false
DB_LOGGING=false

# Local integration only. Configure a new secret, not a shared production key.
FDS_AUTH_PROVIDER=legacy
JWT_SECRET=<random-test-only-value-at-least-32-characters>
JWT_ISSUER=forever-hotel-auth

# Basic Compose deliberately leaves these integrations disabled.
RABBITMQ_ENABLED=false
WKMS_INTEGRATION_ENABLED=false
```

**Choose the database address correctly:**

- For hosted **development/test Neon**: use the test connection host and `DB_SSL=true`, as required by your provider. Never use production credentials.
- For PostgreSQL **running directly on the developer's host**: from a Docker container use `DB_HOST=host.docker.internal`; use the database port exposed on the host.
- For PostgreSQL **inside a separate Compose network**: use the resolvable database service hostname on a shared Docker network, not `localhost`.
- If using individual `DB_*` settings, do not leave an active `DATABASE_URL` pointing elsewhere; TypeORM prefers `DATABASE_URL` when present.

`DB_SYNCHRONIZE=false` is mandatory for all non-disposable databases. Schema changes must be reviewed and applied through approved migrations.

### Step 3.3 — Check that the database is prepared

The database must already contain the **shared hotel core tables** (`guests`, `bookings`, `rooms`, `room_types`, `staff_users`, etc.) plus the FDS operational migrations. **FDS migrations do not create the entire shared hotel schema from scratch.** Consult [Section 4](#4-development-database-and-migrations).

### Step 3.4 — Build and start the FDS containers

```powershell
docker compose -f compose.fds.yaml config --quiet
docker compose -f compose.fds.yaml up --build -d
docker compose -f compose.fds.yaml ps
```

The current Compose file publishes:

- Frontend: `127.0.0.1:3100` → container port `3000`.
- Backend: `127.0.0.1:4200` → container port `4200`.

### Step 3.5 — Check health

```powershell
Invoke-RestMethod http://127.0.0.1:4200/health/ready
```

Expected JSON properties:

```json
{ "status": "ready", "database": "up" }
```

Open http://127.0.0.1:3100 to view the Front Desk UI.

> The UI can render even when secure receptionist login is not yet wired. Protected API endpoints require a valid staff credential. A `401` for a protected route without a token is expected and must not be bypassed.

### Step 3.6 — Inspect logs or stop containers

```powershell
docker compose -f compose.fds.yaml logs --tail 100 fds-backend
docker compose -f compose.fds.yaml logs --tail 100 fds-frontend

# Stop only the FDS containers defined by this Compose file.
docker compose -f compose.fds.yaml down
```

Do not delete shared databases, shared RabbitMQ containers, Docker volumes, or other services as a troubleshooting shortcut.

## 4. Development database and migrations

### Database ownership and preparation

The system uses a **shared hotel data model**. Coordinate initial schema creation and database access with the database/infrastructure owners. FDS owns its operational migrations and transaction rules; other subsystems retain ownership of their data and APIs.

FDS migrations are located in:

```text
backend/src/database/migrations/
```

Key migration files include:

```text
1790772881008-CreateFdsOperationalTables.ts
1791280000000-HardenAuditLogsAppendOnly.ts
```

The shared base schema must exist **before** running these FDS migrations. Do **not** run FDS migration or integration test commands blindly against an existing shared Neon database: earlier testing identified migration-history differences that must be reconciled before changes.

### Run migrations only against an authorized isolated database

Use this workflow only after the database owner approves the selected **fresh test database**. Do not use it as an automatic startup step for production or shared Neon.

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
npm ci
npm run migration:show
npm run migration:run
cd ..
```

Set `backend/.env` to the **same intended test database** and confirm its identity, initial schema, and migration history before `migration:run`. The `.env` template contains placeholders that must be replaced. Use `DB_SSL=false` only for an explicitly configured local database.

### Fully disposable local test database (advanced)

For an independent local test environment, use a **new** Docker PostgreSQL 16 instance on a dedicated free port and a fresh database name. The repository contains deterministic fixtures in:

```text
backend/test/database/shared-schema.sql
backend/test/database/seed.sql
backend/test/database/fixtures/ddp195/
```

These SQL fixtures are **for isolated development/CI**, not a replacement for the approved, complete hotel production schema. Refer to the existing isolated runners and their safety checks before using them. **Never execute fixture-loading or destructive tests on shared Neon.**

When the FDS backend runs in Docker and the disposable database is mapped onto the developer host, use `host.docker.internal` plus its mapped port in `backend/.env.docker.local`; when migrations are invoked on the host, use the corresponding `127.0.0.1` address instead.

## 5. Run the shared API Gateway

FDS does **not** contain the shared Gateway. Clone and run it separately, preferably via Docker because its local Node.js engine requirement is Node 22.

### Step 5.1 — Clone Gateway

In a sibling development folder (outside `front-desk`):

```powershell
git clone -b main https://github.com/forever-hotel/api-gateway.git
cd api-gateway
Copy-Item .env.example .env
notepad .env
```

### Step 5.2 — Configure routing

The Gateway `.env` has the FDS upstream example:

```dotenv
FDS_SERVICE_URL=http://localhost:4200
```

If Gateway runs **directly on Windows**, `http://localhost:4200` is appropriate for the FDS Docker port mapping. If Gateway runs **in Docker**, its provided `compose.yaml` sets the upstream to `http://host.docker.internal:4200` (a host mapping is included). **Changing only the Gateway `.env` may not override values explicitly set by Gateway Compose.**

Set `ALLOWED_ORIGINS` to include actual Front Desk browser origins, for example:

```dotenv
ALLOWED_ORIGINS=http://127.0.0.1:3100,http://localhost:3100
```

Retain the other approved subsystem origins as needed. The Gateway does **routing, CORS and limits**; it does not issue staff tokens or authenticate users.

### Step 5.3 — Run and verify Gateway

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://127.0.0.1:8080/fds/health/ready
```

Expected Gateway forwarding:

```text
GET  http://127.0.0.1:8080/fds/health/ready
  -> http://127.0.0.1:4200/health/ready

GET  http://127.0.0.1:8080/fds/bookings/arrivals?date=2026-10-27
  -> http://127.0.0.1:4200/bookings/arrivals?date=2026-10-27
```

Do not use `GET /health/ready` on the Gateway to judge FDS alone: that aggregate route can return `503` when **another** subsystem is not running. Use `/fds/health/ready` for the FDS-specific check.

### Gateway's declared Node.js version (native alternative)

If running Gateway outside Docker, use a dedicated **Node.js 22.14.x** (or another compatible `>=22.14 <23`) environment, then run the commands documented in its own `README.md`:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run dev
```

## 6. Run without Docker

This option is for developers modifying FDS code, with PostgreSQL and Gateway already available.

### Backend

```powershell
cd front-desk\backend
Copy-Item .env.example .env
notepad .env
npm ci
npm run start:dev
```

For a backend listening on `4200`, set `PORT=4200` in `backend/.env`. If running on the host, set the database host/port so **Windows** can reach the correct database; do not copy a Docker-only hostname blindly.

### Frontend (second terminal)

```powershell
cd front-desk\frontend
Copy-Item .env.example .env.local
notepad .env.local
npm ci
npm run dev -- -p 3100
```

Example frontend environment:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/fds
NEXT_PUBLIC_WS_URL=http://127.0.0.1:4200
NEXT_PUBLIC_FDS_CENTRAL_AUTH_ENABLED=false
```

The API Gateway must be available on port 8080 for the example REST base URL. The WebSocket URL intentionally points **directly to FDS** until the full shared WebSocket/auth path is agreed and verified.

**Optional local test JWT injection:** The code supports `NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH=true` only in Next.js **development** on `localhost`/`127.0.0.1`. It reads a test JWT from browser `sessionStorage` under `fds:dev-test-jwt`. Use only explicitly issued **test credentials**, never production tokens. This mechanism is disabled in production builds and must be retired when Central Auth is integrated. Do not put a JWT signing secret in any `NEXT_PUBLIC_*` variable.

## 7. Authentication and protected workflows

The FDS backend validates tokens and enforces role-based permissions. The shared Gateway does **not** act as the identity provider.

| Mode | Purpose | Status |
|---|---|---|
| `FDS_AUTH_PROVIDER=legacy` | HS256 JWT for controlled development/testing | Implemented, test-only use recommended |
| `FDS_AUTH_PROVIDER=central` | RS256 JWT verified using trusted HTTPS JWKS | Backend verifier foundation implemented; service contract and live flow pending |
| `NEXT_PUBLIC_FDS_CENTRAL_AUTH_ENABLED=false` | Current browser/demo shell | UI available, not proof of authenticated API access |
| `NEXT_PUBLIC_FDS_CENTRAL_AUTH_ENABLED=true` | Gate UI on verified same-origin session | **Do not enable** until real session BFF is implemented |

The proposed Central Auth contract requires a trusted issuer, `aud=fds`, a UUID staff `sub`, role claims and a trusted HTTPS JWKS URL. Those values require agreement with the identity team; placeholder domains are not functional configuration.

The frontend's proposed `GET /api/fds-auth/session` BFF endpoint is **not yet implemented**. A secure production frontend needs server-side session handling, cookie/CSRF protections, protected REST forwarding, logout/revocation and authenticated Socket.IO credential handoff. Never call this complete merely because the backend accepts a locally generated JWT.

Use these contract documents when working with the authentication owner:

- [`docs/central-auth-integration-contract.md`](docs/central-auth-integration-contract.md)
- [`docs/frontend-central-auth-session-contract.md`](docs/frontend-central-auth-session-contract.md)

### Expected authorization behavior

```text
GET /health/ready                    -> 200 when the database is ready
GET /bookings/search (no token)      -> 401
GET /rooms/status (no token)         -> 401
Authorized receptionist JWT         -> permitted endpoints, subject to role checks
Forbidden role on protected writes  -> 403
Invalid/expired JWT                 -> 401
```

For authenticated testing, use a team-approved test receptionist identity matching the test database's `staff_users` records. The `performedBy`/`verifiedBy` values on applicable requests must match the authenticated principal and pass role/active-status validation.

## 8. Subsystem integration contracts

Each team owns its service, authentication decisions and persistent data. Do not introduce direct cross-service writes to another subsystem's tables.

| System | Integration points | Required follow-up |
|---|---|---|
| **API Gateway** | `/fds/*` REST route to FDS `/*` | Validate origins, upstream path rewriting and authenticated forwarding |
| **Manager Dashboard / Central Auth** | Staff identity, receptionist/manager JWT claims and sessions | Approve issuer, JWKS, session BFF, login/logout and role mapping |
| **Worker Management (WKMS)** | Checkout/cleaning events, task escalations, manual assignment | Complete/verify service-task creation and available-worker discovery contracts |
| **Food Ordering (FOSS)** | Guest order access on check-in/check-out; guest charges | Replace mock session/charge adapters with live authenticated contracts |
| **Kitchen Management (KMS)** | Food-order processing through FOSS and agreed charge/event contracts | Confirm data ownership and upstream events; do not read KMS DB directly |
| **Hotel Website (HW)** | Guest reservations appearing in FDS booking search/arrivals | Agree booking schema, booking source and lifecycle synchronization |

### RabbitMQ and Socket.IO

The backend includes RabbitMQ integration and a Socket.IO `/realtime` namespace. Relevant local verification evidence exists under `evidence/fds-messaging-realtime/`.

- Exchange: `forever.events`.
- FDS receives task escalations through the agreed event contract (e.g. `wkms.task.escalated.v1`).
- FDS publishes checkout/room-cleaning related events for downstream services according to the messaging contract.
- The receptionist UI uses authenticated Socket.IO and REST fallback/reconciliation when applicable.
- RabbitMQ retry, dead-letter routing and selected broker-recovery cases were tested in **isolated local environments**.

**Critical Compose limitation:** `compose.fds.yaml` currently forces:

```dotenv
RABBITMQ_ENABLED=false
WKMS_INTEGRATION_ENABLED=false
```

Changing `backend/.env.docker.local` alone does **not** enable those capabilities in that Compose setup. Enable them only through an **explicitly reviewed integration-specific Compose configuration** with a reachable test broker, valid credentials, service URLs and contracts. Do not point to a production broker for local acceptance testing.

### Verified-versus-pending boundaries

Local evidence includes FDS checkout→actual WKMS consumer handling, selected WKMS-generated escalation behavior, broker reconnect, development-browser realtime observations and an authenticated FDS→WKMS manual assignment against an isolated test setup. It **does not** establish public staging/production acceptance, full Central Auth login, live FOSS settlement or physical printing. See [`documents/`](documents/) and [`evidence/`](evidence/) for case-level results and blocked conditions.

## 9. Frontend, backend and API reference

### UI screens

Frontend routes available in the repository include:

```text
/                    Dashboard
/bookings/search     Booking search and arrivals/departures
/walk-in             Walk-in reservations
/check-in            Check-in and document actions
/check-out           Checkout
/rooms               Room board, maintenance and room changes
/folio               Running guest folio
/service-requests    Guest service requests
/escalations         Realtime escalations
/audit-log           Front Desk audit log
```

UI routes are application routes, **not** Gateway API prefixes.

### Main backend endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Process health |
| GET | `/health/ready` | Database readiness |
| GET | `/bookings/search?query=...` | Search reservations |
| GET | `/bookings/recent?limit=5` | Recent reservations |
| GET | `/bookings/arrivals?date=YYYY-MM-DD` | Daily arrivals |
| GET | `/bookings/departures?date=YYYY-MM-DD` | Daily departures |
| POST | `/bookings/walk-in` | Create walk-in booking |
| POST | `/check-in` | Check-in and identity verification |
| POST | `/check-in/:bookingReference/print` | Print-job contract |
| GET | `/rooms/status` | Room-state board |
| PATCH | `/rooms/:roomNumber/status` | Guarded room transition |
| GET | `/room-changes/:bookingReference/available-rooms` | Reassignment candidates |
| POST | `/room-changes` | Atomic reassignment |
| GET | `/folios/:bookingReference` | Running folio |
| POST | `/check-outs` | Transactional checkout |
| GET | `/realtime/contract` | Realtime event/fallback contract |
| GET | `/realtime/escalations` | Recent escalation state |
| GET | `/audit-logs` | Authorized audit-log listing |

Other service-task and assignment routes are defined by the backend controllers and may require running WKMS. Refer to source code and generated/checked API contracts rather than guessing request payloads.

**Gateway URL rule:** prefix the backend path with `/fds` when making REST requests through Gateway. For example `/folios/<uuid>` becomes `/fds/folios/<uuid>`.

### API specifications

- [`backend/docs/checkout-api.openapi.yaml`](backend/docs/checkout-api.openapi.yaml)
- [`backend/docs/folio-api.openapi.yaml`](backend/docs/folio-api.openapi.yaml)

## 10. Business and data-integrity rules

### Room-state lifecycle

```text
VACANT -> OCCUPIED              successful check-in
OCCUPIED -> REQUIRES_CLEANING   successful checkout or room change out
UNDER_MAINTENANCE              guarded maintenance transition only
```

Room maintenance and reassignment validate availability and audit changes. A generic room-status PATCH must not bypass check-in/checkout transaction ownership.

### Check-in

A successful check-in validates the booking, authorized receptionist and identity metadata, assigns a compatible available room, sets booking to `CHECKED_IN`, room to `OCCUPIED`, and stores the audit/verification data atomically. FOSS session activation is a **post-transaction integration contract**; real external operation depends on the FOSS adapter.

### Running folio and money

The running folio is a **derived read model**, not an independent `folios` table. It contains ordered room, food/beverage and service categories. Monetary amounts use integer smallest-unit values in **LKR**, not floating-point calculations. Missing required external charges must not be disguised as settled/complete charges.

### Checkout

`POST /check-outs` derives the amount due from the current folio and previously completed payments. It does **not** accept a client-computed final amount or raw payment-card credentials. After the required payment outcome, the PostgreSQL transaction persists:

1. Completed final payment, **only when an amount remains due**;
2. Booking status `CHECKED_OUT`;
3. Room status `REQUIRES_CLEANING`;
4. `CHECK_OUT` audit entry.

The core state transition is atomic. Failures must not leave partial checkout state. Post-commit FOSS deactivation and downstream WKMS processing are separate service integrations, not direct writes into their databases. If post-commit FOSS deactivation fails, the committed checkout is not rolled back; its recovery state must be handled explicitly.

### Staff identity and audit

Protected mutations are authorized against the trusted principal and active role (`RECEPTIONIST`, as applicable). Audit actions include `CHECK_IN`, `CHECK_OUT`, `ROOM_CHANGE` and guarded maintenance transitions. Sensitive card information, tokens, passwords and unnecessary guest PII must not appear in logs.

## 11. Testing, CI and evidence

### Local developer checks

FDS backend (Node.js 24):

```powershell
cd backend
npm ci
npm run format:check
npm run lint
npm run build
npm run test:cov -- --runInBand
npm audit --audit-level=high
cd ..
```

FDS frontend (Node.js 24):

```powershell
cd frontend
npm ci
npm run lint
npm run test:cov
npm run build
npm audit --audit-level=high
cd ..
```

On Windows, the frontend repository's `npm run format:check` may report CRLF/LF differences. Review Git's line endings and use `npx prettier --check . --end-of-line auto` to diagnose; **do not reformat every file just to work around Windows checkout settings**.

### Database/E2E test safety

Backend database integration and mutation-capable E2E tests must use a **disposable PostgreSQL test instance** with the project fixtures and migrations, not a shared team database. GitHub CI provisions a disposable database. Do not run those test commands against Neon unless an isolated authorized disposable branch has been provisioned and the tests explicitly support it.

### Verified CI snapshot (27 October 2026)

| CI scope | Verified result |
|---|---|
| Backend unit | 67 suites / **513 tests passed** |
| Backend PostgreSQL integration | 9 suites / **53 tests passed** |
| Backend E2E | 10 suites / **140 tests passed** |
| Backend coverage | Statements **96.19%**, branches **87.15%**, functions **96.85%**, lines **96.23%** |
| Frontend | 43 suites / **197 tests passed** |
| Frontend coverage | Statements **89.96%**, branches **81.33%**, functions **92.41%**, lines **89.85%** |
| Frontend audit | Full `npm audit --audit-level=high`: **0 vulnerabilities** after `undici` update |
| Docker build/smoke | **Passed** |
| Isolated local performance | **15/15** GET scenarios, **1,800** measured requests, **0** errors |

These checks were verified for the applicable code commits before the QA documentation merge. Use the current GitHub Actions history for new changes:

- [Backend CI run 40530366600](https://github.com/forever-hotel/front-desk/actions/runs/40530366600)
- [Frontend CI run 40553128288 (merged `develop`)](https://github.com/forever-hotel/front-desk/actions/runs/40553128288)
- [Docker CI run 40553128260 (merged `develop`)](https://github.com/forever-hotel/front-desk/actions/runs/40553128260)

The frontend high-severity `undici` development-dependency finding was remediated in `8.12.2` and the audited build reported zero findings. These audits are time-specific, not a guarantee against future advisories.

### Formal FDS QA files

```text
documents/testing/coverage-sprint8.pdf
documents/testing/test-register.pdf
documents/testing/performance-report.pdf
documents/security/owasp-checklist.pdf
```

Supporting sources and execution records are under `documents/testing/`, `documents/security/`, `evidence/fds-core-acceptance/`, `evidence/fds-messaging-realtime/` and `evidence/fds-final-qa/performance/`.

**Performance interpretation:** Measured p50/p95 and requests-per-second are **local microbenchmark evidence**, based on 120 measured requests per scenario across five read-only endpoints and concurrency levels 1/5/10. They are not proof of public staging latency, high-volume checkout performance or compliance with SRS numeric NFR limits until those limits have been checked against the results.

### Safe smoke verification

When FDS and Gateway are started, inspect health manually as above. The repository also contains:

```powershell
.\scripts\plan20-smoke.ps1 -EvidencePath '.\evidence\plan20-local-smoke.json'
```

This original smoke script may also check a separately named RabbitMQ broker; review its prerequisites before running it. A broker `ping` does not prove FDS messaging is enabled.

## 12. Troubleshooting

| Symptom | Likely cause | First check |
|---|---|---|
| `docker` not found / daemon unavailable | Docker Desktop not started | `docker version` |
| FDS backend unhealthy | Wrong database host/port/SSL/schema | `docker compose -f compose.fds.yaml logs --tail 100 fds-backend` |
| Frontend loads but data requests fail with `401` | No authenticated receptionist session | See [authentication](#7-authentication-and-protected-workflows) |
| Gateway `/fds/health/ready` fails | Gateway route/upstream or FDS backend is down | Gateway logs, `FDS_SERVICE_URL`, direct backend health |
| Gateway `/health/ready` gives `503` | Any enabled subsystem may be unavailable | Test `/fds/health/ready` specifically |
| Frontend browser requests rejected by CORS | Incorrect exact origin | `FDS_ALLOWED_ORIGINS`, Gateway `ALLOWED_ORIGINS` |
| WebSocket unavailable or fallback active | FDS origin, socket authentication or WS connection | `NEXT_PUBLIC_WS_URL`, backend logs, browser DevTools |
| FDS RabbitMQ event not received in basic Docker mode | Compose explicitly disables RabbitMQ | Review Compose settings; use a verified integration environment |
| WKMS create-task/worker discovery unavailable | Contract/API not implemented or not configured | Check current WKMS integration contract and test status |
| Migration reports existing/missing tables | Shared schema or migration-history mismatch | Stop; ask DB owner before changing a non-disposable DB |
| Port `3100`, `4200` or `8080` already in use | Another service/container is running | `docker ps`, `Get-NetTCPConnection -State Listen` |
| Frontend Prettier warns across many files on Windows | Git EOL conversion (CRLF/LF) | `git ls-files --eol`, `npx prettier --check . --end-of-line auto` |
| PowerShell crashes when pasting long blocks | PSReadLine console rendering | Use shorter blocks or execute a reviewed `.ps1` file |

Never fix health, migration or authentication failures by disabling authorization, synchronizing a shared database, deleting unexplained containers, or using a production credential in a local test.

## 13. Integration handoff checklist

Before telling another developer to begin work, provide or confirm:

- [ ] Access to [`forever-hotel/front-desk`](https://github.com/forever-hotel/front-desk), branch `develop`.
- [ ] Access to [`forever-hotel/api-gateway`](https://github.com/forever-hotel/api-gateway), branch `main`.
- [ ] Supported Docker/Node runtime selected (Gateway Node 22 if running natively).
- [ ] A **prepared, permitted test database** and credentials delivered **privately**; migration history reviewed.
- [ ] `backend/.env.docker.local` or native `backend/.env` created locally and not committed.
- [ ] Correct frontend REST/Socket.IO origins for the intended runtime.
- [ ] Backend readiness returns HTTP `200` and `database=up`.
- [ ] Gateway `/fds/health/ready` forwards successfully.
- [ ] Any authenticated demo uses approved **test** staff accounts/tokens.
- [ ] Auth team provides issuer/JWKS/BFF contract before enabling Central Auth gate.
- [ ] WKMS/FOSS/HW owners confirm relevant REST/events, payloads, identities and schema boundaries.
- [ ] Integration issues list blocked cases and identify their owners; mocks are explicitly labelled.
- [ ] Staging sign-off is **not** claimed before real HTTPS/auth/end-to-end testing.

### Suggested developer integration order

1. Bring up the existing FDS UI/backend and Gateway; check readiness.
2. Confirm approved shared booking schema and realistic, synthetic test fixtures.
3. Integrate Central Authentication and secure frontend session/BFF forwarding.
4. Verify actual authenticated FDS workflows and Socket.IO reconnection.
5. Integrate and validate WKMS/FOSS contracts with isolated broker/service instances.
6. Verify Hotel Website booking handoff and folio/food-service boundaries.
7. Perform complete six-subsystem staging tests; archive redacted evidence.

## 14. Git workflow and contribution rules

Development conventions:

```text
main       Protected release branch
develop    Shared development/integration branch
feature/<github-issue-number>-<short-title>
```

Create new work from the current `develop` branch:

```powershell
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c feature/<issue-number>-<short-title>
```

Replace angle-bracket placeholders with real values before running commands.

- Create/link an issue using the team DDP naming and label policy.
- Keep one coherent change set per issue, with implementation, tests, docs and integration evidence as applicable.
- Review `git diff` and avoid staging `.env` or secret files.
- Run relevant lint/build/test/CI checks; use a disposable database for mutation tests.
- Open pull requests **into `develop`**, get review, verify applicable CI and document unmet external dependencies accurately.
- Update `CHANGELOG.md` and API contracts when a behavior or integration interface changes.
- Preserve verified existing results and distinguish new observations from earlier historical results.

## 15. Reference documentation

| File | Scope |
|---|---|
| [`backend/README.md`](backend/README.md) | Backend architecture, commands and domain behavior |
| [`frontend/README.md`](frontend/README.md) | Frontend local configuration and test commands |
| [`docs/plan20-deployment-runbook.md`](docs/plan20-deployment-runbook.md) | Docker/Gateway setup, safe smoke checks and staging limitations |
| [`docs/plan20-staging-test-register.md`](docs/plan20-staging-test-register.md) | Staging scenarios and evidence requirements |
| [`docs/plan20-closeout-evidence.md`](docs/plan20-closeout-evidence.md) | Historical Plan 20 evidence and unverified conditions |
| [`docs/plan20-review-handoff.md`](docs/plan20-review-handoff.md) | Existing integration dependencies and ownership |
| [`docs/central-auth-integration-contract.md`](docs/central-auth-integration-contract.md) | Proposed backend Central Auth JWT/JWKS contract |
| [`docs/frontend-central-auth-session-contract.md`](docs/frontend-central-auth-session-contract.md) | Proposed frontend/BFF session contract |
| [`backend/docs/checkout-api.openapi.yaml`](backend/docs/checkout-api.openapi.yaml) | Transactional checkout API |
| [`backend/docs/folio-api.openapi.yaml`](backend/docs/folio-api.openapi.yaml) | Running folio API |
| [`documents/README.md`](documents/README.md) | Final FDS-only QA evidence index |
| [`evidence/fds-final-qa/performance/verification.md`](evidence/fds-final-qa/performance/verification.md) | Measured local API performance |

**Contacts and credentials:** Ask the responsible Forever Hotel repository/team owner for authorized test environment values. This README intentionally does not contain private URLs, passwords, signing keys or real guest records.
