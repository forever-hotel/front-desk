# Forever Hotel — Front Desk Backend

NestJS backend for the **Forever Hotel Front Desk System (FDS)**.

The Front Desk backend currently provides reservation lookup, walk-in booking,
transactional guest check-in, guest identity verification, room assignment,
FOSS guest-session activation contracts, check-in document printing contracts,
FD-12 room-status management, FD-11 atomic room reassignment, FD-13 maintenance
blocking/clearing, and Front Desk audit logging.

The service uses PostgreSQL for Front Desk-owned persistence and keeps
cross-subsystem responsibilities behind explicit integration contracts.

---

# Current Backend Scope

Implemented backend capabilities include:

- Health and readiness checks
- Reservation search
- Daily arrivals
- Daily departures
- Recent booking lookup
- Walk-in booking creation
- Cash payment recording
- On-site card-payment workflow skeleton
- Transactional guest check-in
- Physical identity-document verification
- Scanned identity-document metadata handling
- Room assignment during check-in
- Room transition to `OCCUPIED`
- Front Desk audit logging
- FOSS guest-session activation contract
- Mock FOSS activation adapter
- Registration-card printing contract
- Payment-receipt printing contract
- Mock check-in printing adapter
- FD-12 room-status board API
- Guarded room-status transitions
- FD-11 atomic room reassignment
- FD-13 maintenance blocking and clearing
- Room-change target availability lookup
- Maintenance availability impact
- Maintenance audit logging
- Room-change audit logging
- PostgreSQL row locking for room mutations
- Real-time-ready room-status and room-change results
- Unit tests
- PostgreSQL integration tests
- End-to-end tests
- Global Jest coverage enforcement

---

# Requirement Coverage

Current implemented Front Desk requirements include:

```text
FD-04  Walk-in booking
FD-05  Guest identity verification
FD-06  Room assignment during check-in
FD-07  FOSS guest-session activation contract
FD-08  Registration-card and payment-receipt printing contracts
FD-11  Room change / reassignment
FD-12  Room-status board
FD-13  Maintenance block / clear and availability impact
FD-16  Front Desk audit logging
```

Some later integration work remains outside the current backend scope and is
listed in the Out of Scope sections below.

---

# Technology Stack

The backend currently uses:

- Node.js 24
- TypeScript
- NestJS
- PostgreSQL
- TypeORM `DataSource`
- Jest
- Supertest
- class-validator
- class-transformer
- Oxlint
- Prettier
- GitHub Actions

---

# Project Setup

Install dependencies:

```bash
npm install
```

---

# Compile and Run

Development:

```bash
npm run start
```

Watch mode:

```bash
npm run start:dev
```

Production mode:

```bash
npm run start:prod
```

Build:

```bash
npm run build
```

---

# Code Quality

Run linting:

```bash
npm run lint
```

Check formatting:

```bash
npm run format:check
```

Format all supported files:

```bash
npm run format
```

For normal feature work, prefer formatting only the files changed by the
feature.

Examples:

```bash
npx prettier --write src/room-changes
npx prettier --write src/rooms
npx prettier --write test/app.e2e-spec.ts
```

---

# Testing

## Unit tests

```bash
npm run test
```

## Unit tests with coverage

```bash
npm run test:cov
```

## End-to-end tests

```bash
npm run test:e2e
```

## PostgreSQL integration tests

```bash
npm run test:integration
```

The PostgreSQL integration suite requires a prepared disposable test database.

The GitHub Actions backend pipeline provisions PostgreSQL 16, applies the test
schema and migrations, loads deterministic seed data, and executes the
integration suite.

Do **not** run destructive integration tests against:

- the shared development Neon database;
- staging data that must be preserved;
- production databases.

---

# Coverage Requirement

The Jest configuration enforces global minimum coverage thresholds of:

```text
Statements >= 80%
Branches   >= 80%
Functions  >= 80%
Lines      >= 80%
```

A pull request must continue to satisfy all four coverage gates.

---

# Current Plan 10 Local Verification

The current Plan 10 feature branch has passed local verification for:

```text
Lint
PASS
0 warnings
0 errors

Build
PASS

Unit tests
25 suites passed
181 tests passed
0 failed

Coverage
Statements  98.98%
Branches    87.44%
Functions   97.02%
Lines       98.90%

E2E
PASS
```

The Plan 10 PostgreSQL integration suite is intended to run in the disposable
PostgreSQL environment provided by GitHub Actions.

---

# Environment Configuration

The backend reads database configuration from environment variables.

Expected variables include:

```text
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_NAME
DB_SSL
DB_SYNCHRONIZE
DB_LOGGING
```

For development and production environments:

```text
DB_SYNCHRONIZE=false
```

Schema changes must be handled through migrations instead of TypeORM automatic
schema synchronization.

Never commit real `.env` credentials to Git.

---

# Health API

## Readiness

```http
GET /health/ready
```

Example response:

```json
{
  "status": "ready",
  "database": "up"
}
```

---

# Reservation APIs

Reservation persistence is implemented through
`PostgresBookingRepository`.

## Search bookings

```http
GET /bookings/search?query=<search-term>
```

Search may match:

- booking reference;
- guest name;
- NIC/passport number;
- email address;
- phone number.

Example:

```http
GET /bookings/search?query=Kamal
```

## Daily arrivals

```http
GET /bookings/arrivals
```

For deterministic testing:

```http
GET /bookings/arrivals?date=2030-01-10
```

Eligible booking state:

```text
CONFIRMED
```

## Daily departures

```http
GET /bookings/departures
```

For deterministic testing:

```http
GET /bookings/departures?date=2030-01-12
```

Eligible booking state:

```text
CHECKED_IN
```

## Recent bookings

```http
GET /bookings/recent?limit=5
```

The supported limit is constrained between:

```text
1 and 20
```

---

# Walk-In Booking API — FD-04

A receptionist can create a walk-in booking by entering guest details, selecting
a room type and stay dates, and choosing a supported Front Desk payment
workflow.

## Endpoint

```http
POST /bookings/walk-in
Content-Type: application/json
```

Example cash request:

```json
{
  "guest": {
    "fullName": "Kamal Perera",
    "email": "kamal@example.com",
    "nicOrPassport": "200012345678",
    "phone": "0771234567"
  },
  "booking": {
    "roomTypeId": "11111111-1111-4111-8111-111111111111",
    "checkInDate": "2030-02-10",
    "checkOutDate": "2030-02-12",
    "numGuests": 2,
    "specialRequests": "Quiet room"
  },
  "payment": {
    "paymentMethod": "CASH"
  }
}
```

## Supported payment methods

```text
CASH
CARD_ON_SITE
```

`STRIPE` is not accepted by the current Front Desk walk-in endpoint.

## Server-side pricing

The client does not provide the authoritative total.

The backend calculates:

```text
total amount = price per night × number of nights
```

Currency amounts are persisted using integer smallest-unit values.

## Cash workflow

```text
booking source  = WALK_IN
booking status  = CONFIRMED
payment method  = CASH
payment status  = COMPLETED
```

## On-site card workflow

Until a later POS integration confirms payment:

```text
booking source  = WALK_IN
booking status  = PENDING
payment method  = CARD_ON_SITE
payment status  = PENDING
paidAt          = null
```

## Raw card-data protection

The Front Desk backend does not accept or persist raw card credentials such as:

```text
cardNumber
PAN
cvv
cvc
expiryDate
pin
trackData
```

The global validation pipe uses:

```text
whitelist = true
forbidNonWhitelisted = true
transform = true
```

Unknown request properties are rejected.

## Walk-in transaction

Booking and payment persistence execute inside one PostgreSQL transaction.

```text
BEGIN

create booking
create payment

COMMIT
```

Any failure causes:

```text
ROLLBACK
```

---

# Transactional Guest Check-In — FD-05 / FD-06 / FD-16

## Endpoint

```http
POST /check-in
Content-Type: application/json
```

Example:

```json
{
  "bookingReference": "55555555-5555-4555-8555-555555555551",
  "roomNumber": "T103",
  "verification": {
    "documentType": "NIC",
    "verificationMethod": "PHYSICAL_DOCUMENT",
    "verifiedBy": "66666666-6666-4666-8666-666666666666",
    "notes": "Physical NIC verified at reception"
  }
}
```

## Supported identity document types

```text
NIC
PASSPORT
OTHER
```

## Supported verification methods

```text
PHYSICAL_DOCUMENT
SCANNED_COPY
```

## Scanned-copy metadata

For:

```text
verificationMethod = SCANNED_COPY
```

the request requires:

```text
documentStorageKey
```

and may include:

```text
documentSha256
```

The actual identity-document binary is not stored in PostgreSQL.

## Temporary receptionist identity contract

The current development request accepts:

```text
verifiedBy
```

as a staff UUID.

The repository validates:

```text
role      = RECEPTIONIST
is_active = TRUE
```

This must later be replaced by centralized authenticated JWT identity.

## Booking eligibility

Normal check-in requires:

```text
booking exists
booking status = CONFIRMED
```

## Room eligibility

The assigned room must:

```text
exist
match booking room type
status = VACANT
have no overlapping active booking
```

Active overlap states are:

```text
PENDING
CONFIRMED
CHECKED_IN
```

## Check-in transaction

```text
BEGIN

validate receptionist

lock booking
validate booking state

determine room

lock room
validate room type
validate room status
re-check date overlap

validate duplicate ID verification

insert identity verification

booking -> CHECKED_IN
room    -> OCCUPIED

insert CHECK_IN audit

COMMIT
```

Any persistence failure causes:

```text
ROLLBACK
```

---

# FD-07 — FOSS Guest-Session Activation Contract

FOSS activation occurs only after the PostgreSQL check-in transaction commits.

```text
PostgreSQL check-in
        |
        v
      COMMIT
        |
        v
FossSessionGateway
        |
        v
MockFossSessionGateway
```

Current activation request data:

```text
bookingReference
roomNumber
checkOutDate
```

The Front Desk service does not directly write to FOSS-owned persistence.

If FOSS activation fails after check-in commit:

```text
booking = CHECKED_IN
room    = OCCUPIED
FOSS    = FAILED
```

The hotel check-in is not rolled back.

---

# FD-08 — Check-In Printing

Supported document types:

```text
REGISTRATION_CARD
PAYMENT_RECEIPT
```

## Endpoint

```http
POST /check-in/:bookingReference/print
Content-Type: application/json
```

Example:

```json
{
  "documentType": "REGISTRATION_CARD"
}
```

Printing requires:

```text
booking exists
booking status = CHECKED_IN
room is assigned
```

The current adapter is:

```text
MockCheckInPrintGateway
```

Physical USB, LPD, or RAW printer integration remains future work.

Printing failure does not reverse guest check-in.

---

# FD-12 — Room Status Board

## Endpoint

```http
GET /rooms/status
```

Supported persisted room statuses:

```text
VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE
```

The UI meaning:

```text
VACANT = Clean/Vacant
```

There is no separate persisted `CLEAN` status.

Example room-board item:

```json
{
  "roomNumber": "T101",
  "roomTypeId": "11111111-1111-4111-8111-111111111111",
  "roomTypeName": "CI Standard Room",
  "floor": 1,
  "status": "VACANT",
  "lastClearedAt": "2032-01-09T08:00:00.000Z",
  "updatedAt": "2032-01-10T08:00:00.000Z"
}
```

The room board does not expose guest PII.

---

# Guarded Room Status Updates

## Endpoint

```http
PATCH /rooms/:roomNumber/status
Content-Type: application/json
```

The current generic transition policy is:

```text
VACANT
  -> UNDER_MAINTENANCE

UNDER_MAINTENANCE
  -> VACANT

REQUIRES_CLEANING
  -> VACANT
```

The generic endpoint must not bypass domain-owned lifecycle transitions.

## Check-in-owned transition

```text
VACANT -> OCCUPIED
```

Owned by check-in and room-change workflows.

## Checkout-owned transition

```text
OCCUPIED -> REQUIRES_CLEANING
```

Owned by checkout and room-change workflows.

## Same-state requests

Requests such as:

```text
VACANT -> VACANT
```

are rejected with a conflict response.

---

# FD-13 — Audited Maintenance Block / Clear

Plan 10 extends room-status management so maintenance state changes are
performed by an active receptionist and are audited atomically.

## Block room for maintenance

```http
PATCH /rooms/T103/status
```

```json
{
  "targetStatus": "UNDER_MAINTENANCE",
  "performedBy": "66666666-6666-4666-8666-666666666666",
  "notes": "Air-conditioner repair"
}
```

Allowed transition:

```text
VACANT -> UNDER_MAINTENANCE
```

Audit action:

```text
ROOM_MAINTENANCE_BLOCKED
```

## Clear maintenance

```http
PATCH /rooms/T104/status
```

```json
{
  "targetStatus": "VACANT",
  "performedBy": "66666666-6666-4666-8666-666666666666",
  "notes": "Repair completed"
}
```

Allowed maintenance-clear transition:

```text
UNDER_MAINTENANCE -> VACANT
```

Audit action:

```text
ROOM_MAINTENANCE_CLEARED
```

When a room becomes `VACANT`:

```text
last_cleared_at = NOW()
updated_at      = NOW()
```

For non-`VACANT` transitions the previous `last_cleared_at` value is preserved.

## Maintenance transaction

```text
BEGIN

lock room
validate transition
validate active receptionist

update room status

insert maintenance audit

COMMIT
```

If audit insertion fails:

```text
ROLLBACK
```

The room-state update is not left partially committed.

---

# FD-11 — Room Change / Reassignment

Plan 10 introduces atomic room reassignment for an already checked-in guest.

## Available target rooms

```http
GET /room-changes/:bookingReference/available-rooms
```

A valid room-change option must:

```text
booking status = CHECKED_IN
booking has current assigned room

target status = VACANT
target room type = booking room type
target room != current room
no overlapping active booking
```

Overlap states:

```text
PENDING
CONFIRMED
CHECKED_IN
```

The booking being changed is excluded from its own conflict search.

Example response:

```json
[
  {
    "roomNumber": "T105",
    "roomTypeId": "11111111-1111-4111-8111-111111111111",
    "roomTypeName": "CI Standard Room",
    "floor": 1,
    "status": "VACANT",
    "lastClearedAt": "2032-01-09T08:00:00.000Z",
    "updatedAt": "2032-01-10T08:00:00.000Z"
  }
]
```

## Room-change endpoint

```http
POST /room-changes
Content-Type: application/json
```

Example:

```json
{
  "bookingReference": "44444444-4444-4444-8444-444444444444",
  "targetRoomNumber": "T105",
  "performedBy": "66666666-6666-4666-8666-666666666666",
  "reason": "Guest requested a quieter room"
}
```

## Room-change eligibility

The booking must:

```text
exist
status = CHECKED_IN
have a current room assignment
```

The target room must:

```text
exist
not equal current room
match booking room type
status = VACANT
have no conflicting active booking
```

Room upgrades, downgrades, room-type changes, and repricing are not implemented
by this workflow.

## Successful state changes

On successful reassignment:

```text
booking.room_number = target room

old room
OCCUPIED -> REQUIRES_CLEANING

new room
VACANT -> OCCUPIED
```

The old room is deliberately not set directly to `VACANT`, because cleaning
must not be bypassed.

Example response:

```json
{
  "status": "room_changed",
  "bookingReference": "44444444-4444-4444-8444-444444444444",
  "previousRoomNumber": "T102",
  "roomNumber": "T105",
  "previousRoomStatus": "REQUIRES_CLEANING",
  "roomStatus": "OCCUPIED",
  "auditLogId": "88888888-8888-4888-8888-888888888888"
}
```

---

# Atomic Room Reassignment Transaction

Room reassignment executes as one PostgreSQL transaction.

```text
BEGIN
  |
  v
validate active receptionist
  |
  v
lock booking
  |
  v
validate CHECKED_IN state
  |
  v
lock current + target rooms
in deterministic room-number order
  |
  v
validate current room
  |
  v
validate target room
  |
  v
re-check target date-overlap availability
  |
  v
booking.room_number -> target room
  |
  v
old room -> REQUIRES_CLEANING
  |
  v
new room -> OCCUPIED
  |
  v
insert ROOM_CHANGE audit
  |
  v
COMMIT
```

If any required step fails:

```text
ROLLBACK
```

No partial reassignment is permitted.

---

# Room-Change Concurrency Protection

The room-change transaction row-locks:

```text
booking
current room
target room
```

The two room rows are requested in deterministic room-number order to reduce
deadlock risk.

Target-room availability is re-checked **after** the target room has been locked.

The earlier available-room list is therefore advisory for the UI and is never
trusted as the final transaction decision.

---

# FD-13 Availability Impact

Room-change availability uses:

```text
status = VACANT
same room type
not current room
no overlapping active booking
```

Therefore rooms in these states are automatically excluded:

```text
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE
```

A maintenance room becomes eligible again only after it is cleared back to:

```text
VACANT
```

and no other booking conflict exists.

---

# Audit Logging

Front Desk operational actions are persisted in the append-only audit log.

Current actions include:

```text
CHECK_IN
ROOM_CHANGE
ROOM_MAINTENANCE_BLOCKED
ROOM_MAINTENANCE_CLEARED
```

Common audit fields include:

```text
event_category = FRONT_DESK_OPERATION
actor_type     = STAFF
staff_user_id  = acting staff UUID
```

## Room-change audit

```text
action      = ROOM_CHANGE
entity_type = BOOKING
entity_id   = booking UUID
```

Example details:

```json
{
  "previousRoomNumber": "T102",
  "targetRoomNumber": "T105",
  "reason": "Guest requested a quieter room"
}
```

## Maintenance block audit

```text
action      = ROOM_MAINTENANCE_BLOCKED
entity_type = ROOM
entity_id   = room number
```

## Maintenance clear audit

```text
action      = ROOM_MAINTENANCE_CLEARED
entity_type = ROOM
entity_id   = room number
```

Audit details intentionally avoid unnecessary guest PII.

---

# Real-Time Readiness

Plan 09 introduced typed room-status results.

Plan 10 preserves the same separation and returns typed room-change results that
can later be published by the shared real-time layer.

Example future flow:

```text
RoomChangesService
        |
        v
typed room-change result
        |
        v
Realtime/WebSocket adapter
        |
        v
Front Desk room board
```

The current implementation does not directly depend on Socket.IO.

---

# FOSS Boundary During Room Change

FD-07 uses a room-linked FOSS session.

The current FD-11 implementation does **not** directly modify:

```text
foss_sessions
```

Room-change FOSS session re-linking or token rotation has not been defined in the
current Plan 10 contract.

Any future update must go through an approved FOSS integration contract instead
of a direct FOSS database write.

---

# WKMS Boundary

Plan 10 does not directly create or update WKMS-owned task data.

The old room becomes:

```text
REQUIRES_CLEANING
```

after a room change.

Automatic WKMS cleaning-task creation remains future integration work.

---

# Database Usage

Plan 10 uses the existing shared schema.

Relevant tables include:

```text
bookings
rooms
room_types
staff_users
audit_logs
```

No new production table is required.

No new room-status enum is required.

Persisted statuses remain:

```text
VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE
```

---

# PostgreSQL Integration Tests

Integration tests are designed for a disposable PostgreSQL database.

## Check-in integration coverage

Includes:

- successful confirmed-booking check-in;
- physical-document verification;
- scanned-copy metadata;
- pre-assigned room;
- booking -> `CHECKED_IN`;
- room -> `OCCUPIED`;
- audit persistence;
- invalid state rejection;
- occupied-room rejection;
- room-type mismatch;
- overlap rejection;
- non-receptionist rejection;
- inactive receptionist rejection;
- audit-failure rollback.

## Plan 08 print repository integration

File:

```text
test/database/postgres-check-in-print.repository.integration-spec.ts
```

## Plan 09 room repository integration

File:

```text
test/database/postgres-room.repository.integration-spec.ts
```

Covers:

- room-board retrieval;
- all persisted room states;
- guarded room transitions;
- `last_cleared_at`;
- same-state behavior;
- invalid transition blocking;
- unknown room behavior;
- real PostgreSQL persistence.

## Plan 10 room-change / maintenance integration

File:

```text
test/database/postgres-room-change.repository.integration-spec.ts
```

Uses isolated Plan 10 fixtures and verifies:

- available room-change options;
- current-room exclusion;
- maintenance exclusion;
- cleaning exclusion;
- occupied exclusion;
- room-type filtering;
- overlapping-booking exclusion;
- atomic booking reassignment;
- old room -> `REQUIRES_CLEANING`;
- new room -> `OCCUPIED`;
- `ROOM_CHANGE` audit persistence;
- maintenance block;
- maintenance clear;
- maintenance audit persistence;
- `last_cleared_at`;
- availability removal during maintenance;
- availability restoration after clearing;
- full rollback when room-change audit persistence fails.

Do not run this suite against shared Neon development data.

---

# Unit and Contract Tests

The current unit/contract suite covers:

## Reservation and walk-in

- reservation lookup;
- arrivals and departures;
- walk-in DTO validation;
- server-side pricing;
- room capacity;
- cash workflow;
- on-site card workflow;
- raw card-data rejection;
- walk-in transaction handling.

## Check-in

- physical verification;
- scanned-copy verification;
- storage-key validation;
- SHA-256 normalization;
- room assignment;
- transaction behavior;
- FOSS activation success/failure;
- printing;
- booking eligibility;
- printer failure;
- DTO validation.

## Room status and maintenance

- all supported room statuses;
- DTO normalization;
- unsupported `CLEAN` rejection;
- room board;
- guarded transition policy;
- maintenance actor validation;
- maintenance block audit;
- maintenance clear audit;
- maintenance audit rollback;
- `last_cleared_at`;
- PostgreSQL transaction behavior;
- `FOR UPDATE`;
- unknown room;
- same-state rejection;
- blocked transitions.

## Room change

- room-change DTO validation;
- target-room normalization;
- optional reason normalization;
- available-room lookup;
- checked-in booking validation;
- assigned-room validation;
- active receptionist validation;
- inactive receptionist rejection;
- non-receptionist rejection;
- same-room rejection;
- unknown target room;
- current-room state validation;
- room-type mismatch;
- non-vacant target rejection;
- maintenance target rejection;
- date-overlap conflict rejection;
- deterministic room locking;
- booking reassignment;
- old-room update;
- new-room update;
- audit insertion;
- audit failure rollback;
- unexpected database failure rollback.

---

# End-to-End Tests

The E2E suite verifies the public HTTP contracts.

Coverage includes:

## Core

- root endpoint;
- readiness endpoint.

## Room-status and maintenance

- FD-12 room board;
- all four room statuses;
- maintenance block;
- maintenance clear;
- maintenance receptionist context;
- lower-case status normalization;
- same-state rejection;
- check-in-owned transition protection;
- checkout-owned transition protection;
- unsupported `CLEAN` rejection;
- unknown room.

## Room change

- available-room endpoint;
- valid available target;
- invalid booking UUID;
- successful room reassignment;
- target-room normalization;
- same-room rejection;
- maintenance-target rejection;
- non-`CHECKED_IN` booking rejection;
- invalid `performedBy` validation.

## Reservation

- search;
- arrivals;
- departures.

## Walk-in

- cash booking;
- on-site card flow;
- raw card rejection;
- unsupported payment method;
- email validation;
- stay-date validation;
- capacity validation.

## Check-in

- physical-document check-in;
- FOSS activation;
- FOSS failure;
- scanned-copy metadata;
- missing storage key;
- legacy contract rejection;
- invalid staff UUID.

## Printing

- registration card;
- payment receipt;
- unsupported document;
- raw card-field rejection;
- printer failure;
- invalid booking UUID.

---

# GitHub Actions Backend CI

The backend CI workflow runs for relevant:

- `develop` pushes;
- `main` pushes;
- `feature/**` pushes;
- `fix/**` pushes;
- pull requests targeting `develop`;
- pull requests targeting `main`.

The pipeline provisions:

```text
PostgreSQL 16
Node.js 24
```

CI sequence:

```text
Checkout
   |
   v
Install dependencies
   |
   v
Prepare disposable PostgreSQL
   |
   v
Apply schema/migrations
   |
   v
Load deterministic seed data
   |
   v
Run PostgreSQL integration tests
   |
   v
Check formatting
   |
   v
Lint
   |
   v
Build
   |
   v
Unit tests + coverage
   |
   v
Upload coverage artifact
   |
   v
E2E tests
   |
   v
Dependency security scan
```

---

# Current Authentication Limitation

Final centralized JWT/RBAC integration is not part of the current Front Desk
implementation.

Current transitional inputs include:

```text
check-in verification:
verifiedBy

room change:
performedBy

maintenance:
performedBy
```

Repositories currently validate that the supplied staff user is:

```text
role = RECEPTIONIST
is_active = TRUE
```

These request-provided identities must later be replaced by authenticated staff
identity from the centralized JWT.

---

# Current Folder Responsibilities

## Reservations

```text
src/reservations/
```

Responsibilities include reservation queries and walk-in booking orchestration.

## Check-in

```text
src/check-ins/
```

Key contracts include:

```text
CheckInRepository
FossSessionGateway
CheckInPrintRepository
CheckInPrintGateway
```

## Rooms

```text
src/rooms/
├── dto/
│   ├── update-room-status.dto.ts
│   └── update-room-status.dto.spec.ts
├── models/
│   ├── room-status.ts
│   ├── room-status-board-item.ts
│   ├── room-status-transition-result.ts
│   └── room-status-transition-persistence.ts
├── ports/
│   └── room.repository.ts
├── repositories/
│   ├── postgres-room.repository.ts
│   └── postgres-room.repository.spec.ts
├── rooms.controller.ts
├── rooms.controller.spec.ts
├── rooms.service.ts
├── rooms.service.spec.ts
└── rooms.module.ts
```

## Room changes

```text
src/room-changes/
├── dto/
│   ├── create-room-change.dto.ts
│   └── create-room-change.dto.spec.ts
├── models/
│   ├── available-room-change-option.ts
│   └── room-change-result.ts
├── ports/
│   └── room-change.repository.ts
├── repositories/
│   ├── postgres-room-change.repository.ts
│   └── postgres-room-change.repository.spec.ts
├── room-changes.controller.ts
├── room-changes.controller.spec.ts
├── room-changes.service.ts
├── room-changes.service.spec.ts
└── room-changes.module.ts
```

---

# Current Backend Architecture

```text
AppModule
   |
   +--> DatabaseModule
   |
   +--> HealthModule
   |
   +--> BookingsModule
   |
   +--> CheckInModule
   |
   +--> RoomsModule
   |
   +--> RoomChangesModule
```

Controllers remain HTTP boundaries.

Business rules remain in services/repositories.

PostgreSQL access does not live directly inside controllers.

---

# Room Lifecycle Ownership

The current backend intentionally separates transitions by workflow.

```text
Check-in
--------
VACANT -> OCCUPIED

Room change
-----------
old room:
OCCUPIED -> REQUIRES_CLEANING

new room:
VACANT -> OCCUPIED

Checkout
--------
OCCUPIED -> REQUIRES_CLEANING
(future checkout implementation)

Cleaning completion
-------------------
REQUIRES_CLEANING -> VACANT

Maintenance
-----------
VACANT -> UNDER_MAINTENANCE
UNDER_MAINTENANCE -> VACANT
```

The generic room-status endpoint cannot be used to bypass check-in, room-change,
or checkout lifecycle rules.

---

# Security Notes

The current Front Desk backend follows these rules:

- Never commit `.env` files containing real credentials.
- Keep `DB_SYNCHRONIZE=false`.
- Use parameterized PostgreSQL queries.
- Use migrations for schema evolution.
- Do not store raw NIC/passport image binaries in PostgreSQL.
- Do not log unnecessary guest PII.
- Do not accept raw card credentials in Front Desk contracts.
- Do not write directly to FOSS-owned persistence.
- Do not write directly to WKMS-owned persistence.
- Validate temporary staff UUID inputs.
- Require active receptionist status for Front Desk operational mutations.
- Audit room change and maintenance operations.
- Keep audit insertion inside the same transaction as the related state change.
- Lock mutable booking/room rows before committing lifecycle changes.
- Re-check target-room availability inside the room-change transaction.
- Do not expose guest PII through room-status or room-change availability APIs.

---

# Plan 07 Summary

Plan 07 implemented the PostgreSQL check-in transaction:

```text
FD-05
identity verification

FD-06
room assignment
booking -> CHECKED_IN
room -> OCCUPIED

FD-16
CHECK_IN audit
```

It also introduced booking/room row locking, availability re-checking, and
rollback verification.

---

# Plan 08 Summary

Plan 08 implemented:

```text
FD-07
FOSS activation contract

FD-08
registration-card printing
payment-receipt printing
```

Current FOSS and printing adapters are mocks representing integration boundaries.

---

# Plan 09 Summary

Plan 09 implemented:

```text
FD-12
room-status board

GET /rooms/status

PATCH /rooms/:roomNumber/status

VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE

guarded transition policy
row locking
last_cleared_at
real-time-ready result
PostgreSQL integration tests
E2E coverage
```

---

# Plan 10 Summary

Plan 10 implements:

```text
FD-11
atomic room reassignment

FD-13
maintenance blocking / clearing
availability impact

FD-16
room-change and maintenance audit logging
```

New HTTP contracts:

```http
GET /room-changes/:bookingReference/available-rooms
POST /room-changes
```

Existing room status endpoint is extended for audited maintenance:

```http
PATCH /rooms/:roomNumber/status
```

Room-change success:

```text
booking -> target room
old room -> REQUIRES_CLEANING
new room -> OCCUPIED
ROOM_CHANGE audit
```

Maintenance block:

```text
VACANT -> UNDER_MAINTENANCE
ROOM_MAINTENANCE_BLOCKED audit
```

Maintenance clear:

```text
UNDER_MAINTENANCE -> VACANT
last_cleared_at = NOW()
ROOM_MAINTENANCE_CLEARED audit
```

Availability impact:

```text
UNDER_MAINTENANCE
OCCUPIED
REQUIRES_CLEANING

=> excluded from room-change availability
```

Only eligible `VACANT` rooms of the same booking room type with no overlapping
active booking are returned.

---

# Plan 10 Failure Boundaries

## Invalid target

No state changes are committed.

## Booking/room validation failure

No state changes are committed.

## Availability conflict after lock

No state changes are committed.

## Room-change audit failure

```text
booking update -> rolled back
old room update -> rolled back
new room update -> rolled back
audit          -> absent
```

## Maintenance audit failure

```text
room status update -> rolled back
audit              -> absent
```

---

# Plan 10 Out of Scope

The current Plan 10 implementation intentionally does not include:

- frontend room-change screen;
- frontend maintenance screen;
- room upgrades/downgrades;
- room-type repricing;
- FOSS room-session re-linking;
- FOSS token rotation after room change;
- direct writes to `foss_sessions`;
- automatic WKMS cleaning-task creation after room change;
- WKMS cleaning-task completion integration;
- checkout workflow;
- WebSocket broadcasting;
- Socket.IO gateway;
- RabbitMQ room-change events;
- API Gateway integration;
- final JWT/RBAC integration;
- manager-dashboard integration.

---

# Git Workflow

Feature development uses:

```text
main
develop
feature/<issue-number>-<slug>
```

Pull requests for normal development target:

```text
develop
```

Current Plan 10 branch:

```text
feature/45-room-change-maintenance
```

Recommended Plan 10 commit:

```text
feat(fds-backend): add atomic room reassignment and audited maintenance
```

---

# Definition of Done

Before merging a backend feature:

- acceptance criteria are implemented;
- lint passes;
- build passes;
- unit tests pass;
- global coverage remains at least 80%;
- E2E tests pass;
- PostgreSQL integration tests pass in CI where required;
- no secrets are committed;
- documentation is updated;
- pull request targets `develop`;
- CI passes;
- related GitHub issue is linked.

---

# Completed Plan 09 Issue

```text
Issue #43

[DDP-71] feat(fds-backend): add room status board and guarded status transitions
```

Plan 09 primarily covers:

```text
FD-12
```

---

# Current Plan 10 Issue

```text
Issue #45

[DDP-72] feat(fds-backend): add atomic room reassignment and audited maintenance
```

Plan 10 covers:

```text
FD-11
FD-13
FD-16 integration for room-change / maintenance audit
```

Current implementation scope includes:

```text
GET /room-changes/:bookingReference/available-rooms

POST /room-changes

PATCH /rooms/:roomNumber/status
with maintenance actor/audit context

atomic room reassignment

old room -> REQUIRES_CLEANING

new room -> OCCUPIED

same-room rejection

room-type matching

VACANT target requirement

date-overlap conflict re-check

booking + room row locking

ROOM_CHANGE audit

ROOM_MAINTENANCE_BLOCKED audit

ROOM_MAINTENANCE_CLEARED audit

last_cleared_at update

maintenance availability exclusion

availability restoration after maintenance clear

unit tests

PostgreSQL integration tests

E2E tests
```

Pending outside Plan 10:

```text
production real-time broadcast
checkout
WKMS task automation
FOSS room-session re-linking
API Gateway integration
final JWT/RBAC integration
```
