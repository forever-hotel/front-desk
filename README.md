# Forever Hotel - Front Desk System

This repository contains the **Front Desk System (FDS)** for the Forever Hotel
Management System.

The Front Desk System supports receptionist-facing hotel operations including
reservation lookup, walk-in booking, guest check-in, room lifecycle management,
room reassignment, running folio viewing, and transactional checkout.

## Current Front Desk Backend Scope

Implemented backend capabilities currently include:

- application health and database readiness checks;
- reservation search;
- daily arrivals and departures;
- recent booking lookup;
- walk-in booking creation;
- cash and on-site card workflow contracts;
- transactional guest check-in;
- physical/scanned identity-verification metadata;
- room assignment during check-in;
- FOSS guest-session activation contract;
- check-in registration-card/payment-receipt printing contracts;
- room-status board;
- guarded maintenance block/clear transitions;
- atomic room reassignment;
- deterministic running folio;
- transactional checkout core;
- final outstanding-balance calculation;
- final payment contract;
- booking transition to `CHECKED_OUT`;
- room transition to `REQUIRES_CLEANING`;
- FOSS guest-session deactivation contract;
- Front Desk audit logging;
- unit, PostgreSQL integration, and E2E test coverage.

## Requirement Coverage

Current implemented/relevant Front Desk requirements include:

```text
FD-04  Walk-in booking
FD-05  Guest identity verification
FD-06  Room assignment during check-in
FD-07  FOSS session activation
FD-08  Check-in document printing
FD-09  Checkout folio / final payment core
FD-10  Checkout room state + FOSS deactivation core
FD-11  Room reassignment
FD-12  Room-status board
FD-13  Maintenance block / clear
FD-15  Running folio
FD-16  Front Desk audit logging
```

## Repository Structure

```text
front-desk/
├── .github/
├── backend/
│   ├── docs/
│   │   ├── checkout-api.openapi.yaml
│   │   └── folio-api.openapi.yaml
│   ├── src/
│   │   ├── billing/
│   │   ├── check-ins/
│   │   ├── check-outs/
│   │   ├── common/
│   │   ├── config/
│   │   ├── database/
│   │   ├── guests/
│   │   ├── health/
│   │   ├── messaging/
│   │   ├── realtime/
│   │   ├── reservations/
│   │   ├── room-changes/
│   │   └── rooms/
│   └── test/
├── frontend/
├── CHANGELOG.md
├── README.md
└── .gitignore
```

## Technology Stack

Backend:

```text
Node.js 24
TypeScript
NestJS
PostgreSQL
TypeORM DataSource
Jest
Supertest
class-validator
class-transformer
Oxlint
Prettier
GitHub Actions
```

## Backend Setup

From the repository root:

```powershell
cd backend
npm install
```

For normal CI-compatible installs:

```powershell
npm ci
```

## Database Configuration

The Front Desk backend uses PostgreSQL through TypeORM.

Database configuration is supplied through environment variables. Real database
credentials must never be committed to Git.

Create:

```text
backend/.env
```

from the team-provided development configuration.

Supported database variables include:

```env
DB_HOST=...
DB_PORT=5432
DB_USERNAME=...
DB_PASSWORD=...
DB_NAME=...
DB_SSL=...
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

Keep:

```text
DB_SYNCHRONIZE=false
```

outside isolated throwaway environments.

Schema evolution should use migrations rather than automatic synchronization.

## Run the Backend

Development:

```powershell
npm run start:dev
```

Build:

```powershell
npm run build
```

## Code Quality

Lint:

```powershell
npm run lint
```

Formatting check:

```powershell
npm run format:check
```

Prefer formatting only files touched by a feature, for example:

```powershell
npx prettier --write src/check-outs test/app.e2e-spec.ts
```

## Automated Tests

Unit tests:

```powershell
npm test -- --runInBand
```

Coverage:

```powershell
npm run test:cov -- --runInBand
```

E2E:

```powershell
npm run test:e2e
```

PostgreSQL integration:

```powershell
npm run test:integration
```

The integration suite must run against a **disposable test database**.

Do not run destructive integration tests against the shared Neon development
database, staging data that must be preserved, or production.

## Coverage Gate

The backend enforces a minimum global Jest coverage gate of:

```text
Statements >= 80%
Branches   >= 80%
Functions  >= 80%
Lines      >= 80%
```

## Health API

```http
GET /health/ready
```

## Reservation APIs

```http
GET /bookings/search
GET /bookings/arrivals
GET /bookings/departures
GET /bookings/recent
POST /bookings/walk-in
```

## Guest Check-In

```http
POST /check-in
```

Successful check-in performs the core lifecycle change:

```text
booking -> CHECKED_IN
room    -> OCCUPIED
```

The transactional database workflow includes identity-verification persistence
and `CHECK_IN` audit logging.

FOSS activation is invoked only after the Front Desk database transaction
commits.

## Check-In Printing

```http
POST /check-in/:bookingReference/print
```

Current supported document contracts include:

```text
REGISTRATION_CARD
PAYMENT_RECEIPT
```

## Room Status

```http
GET /rooms/status
PATCH /rooms/:roomNumber/status
```

Persisted room states are:

```text
VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE
```

The generic room-status endpoint must not bypass transitions owned by check-in,
room-change, or checkout workflows.

## Room Reassignment

```http
GET /room-changes/:bookingReference/available-rooms
POST /room-changes
```

Successful reassignment performs:

```text
booking -> target room
old room -> REQUIRES_CLEANING
new room -> OCCUPIED
ROOM_CHANGE audit
```

The booking/current-room/target-room state is protected with PostgreSQL row
locking and availability is revalidated before commit.

## Running Folio - Plan 11 / FD-15

```http
GET /folios/:bookingReference
```

The running folio is a derived read model.

It returns deterministic categories in this order:

```text
ROOM_CHARGES
FOOD_AND_BEVERAGE
SERVICES
```

Money is represented using integer smallest-unit values and:

```text
currency = LKR
```

The Front Desk service does not create a separate `folios` table.

External food/service charge retrieval is behind:

```text
ExternalFolioChargeGateway
```

A required external-charge failure returns `503` instead of silently returning a
partial folio.

API contract:

```text
backend/docs/folio-api.openapi.yaml
```

## Transactional Checkout Core - Plan 12 / FD-09 / FD-10

### Endpoint

```http
POST /check-outs
Content-Type: application/json
```

Example with an outstanding balance:

```json
{
  "bookingReference": "44444444-4444-4444-8444-444444444444",
  "performedBy": "66666666-6666-4666-8666-666666666666",
  "paymentMethod": "CASH"
}
```

The client does **not** submit the payment amount.

The backend derives the final balance as:

```text
folioTotal
-
sum(COMPLETED payments)
=
amountDue
```

Only persisted payments whose status is:

```text
COMPLETED
```

count toward `previouslyPaid`.

The supported Plan 12 Front Desk final-payment methods are:

```text
CASH
CARD_ON_SITE
```

Raw card credentials are not accepted.

### Successful Checkout

When a final balance is due, the server-calculated amount is sent through the
checkout payment gateway.

After successful payment, the checkout repository commits the core state change
transaction:

```text
BEGIN

validate active receptionist

lock booking
revalidate CHECKED_IN

lock assigned room
revalidate OCCUPIED

re-read completed-payment total
verify balance is still current

insert COMPLETED final payment
when amountDue > 0

booking -> CHECKED_OUT

room -> REQUIRES_CLEANING

insert CHECK_OUT audit

COMMIT
```

If the booking was already fully paid:

```text
amountDue = 0
```

no zero-value payment row is inserted.

### Failed Payment Safety

Payment occurs before the state-changing checkout transaction.

A failed final payment returns:

```text
402 Payment Required
```

and leaves:

```text
booking = CHECKED_IN
room    = OCCUPIED
no CHECK_OUT audit
no FOSS deactivation
```

### Checkout Transaction Rollback

If a required persistence step fails:

```text
ROLLBACK
```

The system must not leave a partially checked-out stay.

The transaction protects:

```text
final payment persistence
booking state
room state
checkout audit
```

### FOSS Deactivation

FOSS is a separate subsystem.

FOSS deactivation happens only **after** the successful checkout database commit:

```text
checkout DB transaction
        |
        v
      COMMIT
        |
        v
FossSessionGateway.deactivateGuestSession(...)
```

The Front Desk service does not directly update FOSS-owned persistence.

If post-commit FOSS deactivation fails, the already completed hotel checkout is
not reversed.

The response reports:

```text
fossSession.status = FAILED
failureCode = FOSS_DEACTIVATION_FAILED
```

for later recovery/retry handling.

### Checkout Errors

Core checkout behavior includes:

```text
400 Bad Request
- invalid booking UUID
- invalid performedBy UUID
- unsupported payment method
- payment method missing while a balance is due
- raw card fields / unsupported request properties

402 Payment Required
- final payment attempt failed

404 Not Found
- booking not found

409 Conflict
- booking is not CHECKED_IN
- no assigned room
- room is not OCCUPIED
- completed-payment state is inconsistent/stale

503 Service Unavailable
- required final folio/external-charge retrieval unavailable
```

### Checkout API Documentation

Version-controlled OpenAPI documentation:

```text
backend/docs/checkout-api.openapi.yaml
```

## Monetary Rules

For both folio and checkout:

```text
currency = LKR
```

Monetary values are integer smallest-unit values.

Do not use floating-point payment calculations.

The backend rejects invalid/unsafe financial state rather than accepting
client-calculated totals.

## Staff Identity

Until centralized JWT/RBAC supplies authenticated staff identity, selected
Front Desk mutation requests use a transitional staff UUID such as:

```text
performedBy
verifiedBy
```

The backend validates applicable Front Desk actions against:

```text
role = RECEPTIONIST
is_active = TRUE
```

## Cross-Subsystem Ownership

The Front Desk service must not directly take ownership of other subsystem
persistence.

Important boundaries include:

```text
FOSS sessions -> FOSS-owned
WKMS tasks    -> WKMS-owned
```

FOSS activation/deactivation is behind the FOSS gateway contract.

WKMS checkout-cleaning task automation is expected to use the approved
cross-service/event architecture rather than direct Front Desk database writes.

## Audit Logging

Front Desk lifecycle actions are appended to `audit_logs`.

Implemented action examples include:

```text
CHECK_IN
CHECK_OUT
ROOM_CHANGE
ROOM_MAINTENANCE_BLOCKED
ROOM_MAINTENANCE_CLEARED
```

Sensitive raw card data, passwords, credentials, and unnecessary guest PII must
not be included in audit details.

## Plan 12 Local Verification

Plan 12 local verification currently passes:

```text
Lint
PASS

Build
PASS

Unit tests
34 suites passed
268 tests passed

Coverage
Statements 98.94%
Branches   88.29%
Functions  97.87%
Lines      98.86%

E2E
1 suite passed
55 tests passed
```

The Plan 12 PostgreSQL integration suite is included for the disposable CI
PostgreSQL environment and should not be run against the shared Neon database.

## Plan 12 Out of Scope

Plan 12 checkout core intentionally does not add:

- frontend checkout UI;
- raw card processing;
- production physical POS integration;
- new Stripe checkout flow;
- checkout receipt printing;
- direct writes to `foss_sessions`;
- direct writes to `wkms_tasks`;
- RabbitMQ checkout-completion publishing where no approved reusable publisher
  is available yet;
- automatic WKMS checkout cleaning task inside Front Desk persistence;
- FOSS retry/recovery worker;
- distributed transactions across FDS/FOSS/WKMS;
- API Gateway integration;
- final centralized JWT/RBAC integration.

## Git Workflow

Normal development uses:

```text
main
develop
feature/<issue-number>-<slug>
```

Plan 12:

```text
Issue #49
[DDP-81] feat(fds-backend): implement transactional checkout core

Branch:
feature/49-checkout-core
```

Pull requests target:

```text
develop
```

## Definition of Done

Before merging a backend feature:

- acceptance criteria are verified;
- linter/style checks pass;
- unit tests pass;
- PostgreSQL integration tests pass in the isolated CI environment;
- new-code coverage is at least 80%;
- no hardcoded secrets or credentials are introduced;
- PR targets `develop`;
- PR description is completed;
- at least one peer approving review is completed;
- all `[blocker]` comments are resolved;
- CI passes;
- staging/manual smoke testing is completed where applicable;
- API documentation is updated;
- `CHANGELOG.md` is updated under `[Unreleased]`;
- GitHub Issue is linked;
- Project card is moved to `Done` after merge.
