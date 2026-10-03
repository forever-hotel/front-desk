# Forever Hotel — Front Desk Backend

NestJS backend for the **Forever Hotel Front Desk System (FDS)**.

The Front Desk backend currently provides reservation lookup, walk-in booking,
transactional guest check-in, guest identity verification, room assignment,
FOSS guest-session activation contracts, check-in document printing contracts,
FD-12 room-status management, FD-11 atomic room reassignment, FD-13 maintenance
blocking/clearing, FD-15 deterministic running guest folios, and Front Desk
audit logging.

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
- FD-15 running guest folio API
- Deterministic room, food/beverage, and service charge categories
- Server-calculated folio category subtotals and grand total
- Integer `LKR` monetary representation
- External folio-charge integration contract
- Read-only folio model with no separate `folios` table
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
FD-15  Running guest folio / accumulated charges
FD-16  Front Desk audit logging
```

Later checkout and production cross-service integration work remains outside the
current backend scope where noted below.

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

Format supported files:

```bash
npm run format
```

For normal feature work, prefer formatting only the files changed by the
feature.

Examples:

```bash
npx prettier --write src/billing
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

# Current Plan 11 Local Verification

The current Plan 11 feature branch has passed local verification for:

```text
Lint
PASS

Build
PASS

Unit tests
PASS

Coverage
PASS
global coverage gates remain >= 80%

E2E
PASS
```

The Plan 11 PostgreSQL integration suite is intended to run in the disposable
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

The earlier available-room list is advisory for the UI and is never trusted as
the final transaction decision.

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

Room-change FOSS session re-linking or token rotation has not been defined in
the current Plan 10 contract.

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

# FD-15 — Running Guest Folio / Billing

Plan 11 implements the running folio read model required by FD-15.

A receptionist can retrieve accumulated charges for an active checked-in stay
without performing checkout or final payment settlement.

## Endpoint

```http
GET /folios/:bookingReference
```

Example:

```http
GET /folios/44444444-4444-4444-8444-444444444444
```

The booking reference is validated as a UUID v4.

## Active-stay eligibility

A running folio is available only when:

```text
booking exists
booking status = CHECKED_IN
room is assigned
```

Expected HTTP outcomes:

```text
200  running folio returned
400  malformed booking UUID
404  booking not found
409  booking is not an active checked-in stay
503  required external charge retrieval failed
```

## Folio model

The folio is a derived read model.

Plan 11 does not create:

```text
folios table
folio database entity
folio migration
```

The Front Desk backend builds the folio from authoritative booking data and an
explicit external-charge integration contract.

## Charge categories

The response always uses this deterministic category order:

```text
1. ROOM_CHARGES
2. FOOD_AND_BEVERAGE
3. SERVICES
```

Each category contains:

```text
category
items
subtotal
```

The complete response contains:

```text
bookingReference
roomNumber
checkInDate
checkOutDate
bookingStatus
currency
categories
total
```

Example response:

```json
{
  "bookingReference": "44444444-4444-4444-8444-444444444444",
  "roomNumber": "T102",
  "checkInDate": "2030-01-08",
  "checkOutDate": "2030-01-12",
  "bookingStatus": "CHECKED_IN",
  "currency": "LKR",
  "categories": [
    {
      "category": "ROOM_CHARGES",
      "items": [
        {
          "reference": "ROOM-44444444-4444-4444-8444-444444444444",
          "description": "Room accommodation",
          "amount": 60000,
          "occurredAt": "2030-01-08T00:00:00.000Z"
        }
      ],
      "subtotal": 60000
    },
    {
      "category": "FOOD_AND_BEVERAGE",
      "items": [],
      "subtotal": 0
    },
    {
      "category": "SERVICES",
      "items": [],
      "subtotal": 0
    }
  ],
  "total": 60000
}
```

## Room-charge source

The persisted booking amount is the authoritative room-charge input:

```text
bookings.total_amount
```

The folio endpoint does not accept a client-supplied room total and does not
trust client-calculated subtotals or grand totals.

## External charge contract

Food/beverage and service charges are kept behind:

```text
ExternalFolioChargeGateway
```

The integration contract provides:

```text
reference
category
description
amount
occurredAt
```

Supported external categories are:

```text
FOOD_AND_BEVERAGE
SERVICES
```

The current adapter is:

```text
MockExternalFolioChargeGateway
```

It returns an empty external-charge list until the approved live cross-service
integration is connected.

This allows the running folio endpoint to return a valid room-only folio while
keeping the future KMS/FOSS integration boundary explicit.

The Front Desk folio service does not directly mutate KMS, FOSS, or WKMS-owned
tables.

## No fabricated service prices

If an external service record does not provide an approved monetary amount, the
Front Desk backend does not invent one.

Only amounts received from approved persisted data or the external-charge
contract may contribute to the folio total.

## Currency rule

All monetary values are represented as integers in the smallest supported
currency unit.

```text
currency = LKR
```

Valid:

```text
15000
```

Invalid monetary representation for the folio contract:

```text
15000.50
1499.99
```

The service validates that room charges and external charges are non-negative
safe integers.

## Deterministic totals

For each category:

```text
subtotal = sum(item amounts)
```

The complete folio total is:

```text
ROOM_CHARGES subtotal
+
FOOD_AND_BEVERAGE subtotal
+
SERVICES subtotal
```

All calculations are performed by the backend.

## Deterministic item ordering

External folio items are ordered by:

```text
occurredAt ASC
reference ASC
```

Therefore identical booking and charge data produce identical itemisation,
subtotals, ordering, and grand total.

## Failure boundary

If the external charge provider fails, the backend does not silently return an
incomplete folio.

Instead:

```text
503 Service Unavailable
```

is returned.

## API documentation

The Plan 11 HTTP contract is documented in:

```text
docs/folio-api.openapi.yaml
```

The OpenAPI document describes:

```text
GET /folios/{bookingReference}

200
400
404
409
503
```

---

# Database Usage

The current backend uses the approved shared PostgreSQL schema.

Relevant tables include:

```text
bookings
rooms
room_types
staff_users
payments
fds_id_verifications
audit_logs
```

Plan 11 does not introduce a new production table.

For the folio read model, relevant booking fields include:

```text
booking_id
room_number
check_in_date
check_out_date
status
total_amount
```

The authoritative room-charge source is:

```text
bookings.total_amount
```

No new folio persistence entity is required.

---

# PostgreSQL Integration Tests

Integration tests are designed for a disposable PostgreSQL database.

## Reservation repository integration

File:

```text
test/database/postgres-booking.repository.integration-spec.ts
```

Covers persisted reservation search, arrivals, departures, and deterministic
seed behavior.

## Walk-in booking integration

The walk-in integration tests verify:

- room-type lookup;
- server-calculated pricing;
- booking persistence;
- payment persistence;
- transaction success;
- transaction rollback.

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

## Plan 11 folio repository integration

File:

```text
test/database/postgres-folio.repository.integration-spec.ts
```

Uses deterministic shared CI seed data and verifies:

- checked-in booking context retrieval;
- persisted room number and stay dates;
- persisted booking status;
- `bookings.total_amount` as the authoritative room charge;
- integer room-charge representation;
- confirmed/non-active booking state preservation;
- unknown booking behavior;
- read-only behavior with no booking mutation.

Do not run the full integration suite against shared Neon development data.

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

## Running folio

- room-only running folio;
- food-and-beverage charges;
- service charges;
- mixed-category folio;
- stable category ordering;
- stable external-item ordering;
- room-charge validation;
- integer currency validation;
- `LKR` response currency;
- category subtotal calculation;
- grand-total calculation;
- zero-value external charges;
- unknown booking rejection;
- inactive-stay rejection;
- missing-room rejection;
- external-provider failure handling;
- non-array external provider response rejection;
- unsupported external category rejection;
- invalid external reference rejection;
- invalid external description rejection;
- fractional external amount rejection;
- negative external amount rejection;
- unsafe external amount rejection;
- invalid external timestamp rejection;
- subtotal overflow protection;
- grand-total overflow protection;
- deterministic repeat-response behavior;
- PostgreSQL folio-context mapping;
- parameterized folio repository query;
- external gateway contract behavior.

---

# End-to-End Tests

The E2E suite verifies public HTTP contracts.

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

## Running folio

- valid FD-15 running folio;
- room, food/beverage, and service itemisation;
- deterministic category order;
- deterministic item order;
- server-calculated category subtotals;
- server-calculated grand total;
- integer monetary values;
- explicit `LKR` currency;
- invalid booking UUID -> `400`;
- unknown booking -> `404`;
- inactive stay -> `409`;
- external provider failure -> `503`;
- guest PII exclusion from the folio response.

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

The current Plan 11 folio endpoint is read-only and does not yet add final JWT
authorization logic.

These transitional identities and read access controls must later be replaced
or enforced through the centralized JWT/RBAC layer.

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

## Billing / running folio

```text
src/billing/
├── gateways/
│   ├── mock-external-folio-charge.gateway.ts
│   └── mock-external-folio-charge.gateway.spec.ts
├── models/
│   ├── external-folio-charge.ts
│   ├── folio-booking-context.ts
│   ├── folio-category.ts
│   ├── folio-category-summary.ts
│   ├── folio-item.ts
│   └── running-folio.ts
├── ports/
│   ├── external-folio-charge.gateway.ts
│   └── folio.repository.ts
├── repositories/
│   ├── postgres-folio.repository.ts
│   └── postgres-folio.repository.spec.ts
├── folio.controller.ts
├── folio.controller.spec.ts
├── folio.service.ts
├── folio.service.spec.ts
└── folio.module.ts
```

Key contracts:

```text
FolioRepository
ExternalFolioChargeGateway
```

The billing module owns folio composition and total calculation.

It does not take ownership of KMS/FOSS/WKMS persistence.

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
   |
   +--> FolioModule
```

Controllers remain HTTP boundaries.

Business rules remain in services/repositories.

PostgreSQL access does not live directly inside controllers.

---

# Folio Architecture

```text
FolioController
      |
      v
FolioService
      |
      +-----------------------+
      |                       |
      v                       v
FolioRepository       ExternalFolioChargeGateway
      |                       |
      v                       v
PostgreSQL            approved external
booking data          charge adapter
```

`FolioController` owns the HTTP boundary.

`FolioService` owns:

- active-stay validation;
- category construction;
- deterministic ordering;
- monetary validation;
- category subtotal calculation;
- grand-total calculation;
- response composition.

`FolioRepository` owns Front Desk booking-context retrieval.

`ExternalFolioChargeGateway` owns the external charge integration boundary.

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

The Plan 11 running-folio endpoint is read-only and does not alter room or
booking lifecycle state.

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
- Do not expose unnecessary guest PII through the running-folio response.
- Do not trust client-calculated folio subtotals or totals.
- Use integer smallest-unit monetary values for folio calculations.
- Reject invalid, negative, fractional, or unsafe external folio amounts.
- Keep external food/service charge retrieval behind the approved gateway contract.
- Do not fabricate service prices when no approved monetary source exists.
- Do not silently return a partial folio when required external charge retrieval fails.

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

Current FOSS and printing adapters are mocks representing integration
boundaries.

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

Plan 10 implemented:

```text
FD-11
atomic room reassignment

FD-13
maintenance blocking / clearing
availability impact

FD-16
room-change and maintenance audit logging
```

HTTP contracts:

```http
GET /room-changes/:bookingReference/available-rooms
POST /room-changes
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

Plan 10 intentionally does not include:

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

# Plan 11 Summary

Plan 11 implements:

```text
FD-15
running guest folio / accumulated charges
```

New HTTP contract:

```http
GET /folios/:bookingReference
```

Plan 11 provides:

```text
active CHECKED_IN stay validation

room charge from bookings.total_amount

ROOM_CHARGES
FOOD_AND_BEVERAGE
SERVICES

deterministic category order

deterministic external item order

server-calculated category subtotals

server-calculated grand total

integer monetary validation

currency = LKR

ExternalFolioChargeGateway

MockExternalFolioChargeGateway

400 invalid UUID

404 unknown booking

409 inactive stay

503 external charge provider failure

no folios table

unit tests

PostgreSQL integration tests

E2E tests

OpenAPI contract
```

The running folio is intentionally a read model.

It does not perform checkout, payment settlement, room lifecycle transitions,
FOSS deactivation, or WKMS task creation.

---

# Plan 11 Failure Boundaries

## Unknown booking

```text
404 Not Found
```

No folio is fabricated.

## Invalid booking UUID

```text
400 Bad Request
```

The request is rejected at the HTTP boundary.

## Booking is not CHECKED_IN

```text
409 Conflict
```

The backend does not present it as an active running folio.

## Checked-in booking without assigned room

```text
409 Conflict
```

The folio is not generated from an inconsistent active-stay state.

## Invalid persisted room charge

The backend rejects:

```text
negative
fractional
unsafe integer
```

persisted room amounts instead of returning an invalid monetary result.

## Invalid external charge payload

The backend rejects:

```text
unsupported category
empty reference
empty description
negative amount
fractional amount
unsafe integer amount
invalid timestamp
```

## External provider failure

```text
503 Service Unavailable
```

The backend does not silently return a partial folio.

## Monetary overflow

Category and grand totals are protected by `Number.isSafeInteger`.

Unsafe totals are rejected.

---

# Plan 11 Out of Scope

Plan 11 intentionally does not include:

- final guest checkout;
- booking transition to `CHECKED_OUT`;
- final payment settlement;
- unpaid-balance settlement;
- checkout payment processing;
- checkout receipt printing;
- FOSS session deactivation;
- checkout room transition to `REQUIRES_CLEANING`;
- automatic WKMS checkout-cleaning task creation;
- Stripe checkout/payment processing;
- frontend Folio screen;
- API Gateway integration;
- RabbitMQ charge-event integration;
- production KMS/FOSS charge adapter before its final contract is approved;
- final centralized JWT/RBAC integration;
- a new `folios` database table.

---

# API Documentation

Plan 11 introduces a version-controlled OpenAPI contract:

```text
docs/folio-api.openapi.yaml
```

It documents:

```text
GET /folios/{bookingReference}

200
400
404
409
503
```

The OpenAPI contract includes:

- booking-reference path parameter;
- running-folio response schema;
- folio-category schema;
- folio-item schema;
- integer monetary fields;
- `LKR` currency;
- error response shape.

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

Current Plan 11 branch:

```text
feature/47-running-folio
```

Recommended Plan 11 commit:

```text
feat(fds-backend): implement deterministic running folio
```

---

# Definition of Done

Before merging a backend feature:

- acceptance criteria are implemented;
- agreed style guide/linter passes;
- unit tests for new logic pass;
- integration tests for new API endpoints pass;
- new code coverage remains at least 80%;
- no hardcoded secrets or credentials are introduced;
- pull request targets `develop`;
- pull request description is completed;
- at least one peer code review is completed;
- all `[blocker]` review comments are resolved;
- CI passes lint, build, unit, integration, and E2E checks;
- staging smoke testing is completed where available;
- API documentation is updated;
- `CHANGELOG.md` is updated under `[Unreleased]`;
- the GitHub Issue is linked to the PR/commits;
- the issue is moved to `Done` after merge.

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

# Completed Plan 10 Issue

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

Implemented scope includes:

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

---

# Current Plan 11 Issue

```text
Issue #47

[DDP-76] feat(fds-backend): implement deterministic running folio API
```

Plan 11 covers:

```text
FD-15
```

Current implementation scope includes:

```text
GET /folios/:bookingReference

active CHECKED_IN stay validation

room charge from bookings.total_amount

ROOM_CHARGES

FOOD_AND_BEVERAGE

SERVICES

deterministic category ordering

deterministic item ordering

integer LKR monetary values

category subtotals

grand total

ExternalFolioChargeGateway

MockExternalFolioChargeGateway

400 / 404 / 409 / 503 handling

no folios table

unit tests

PostgreSQL integration tests

E2E tests

OpenAPI documentation
```

Pending outside Plan 11:

```text
final checkout
payment settlement
FOSS deactivation
WKMS checkout cleaning task
production KMS/FOSS charge adapter
frontend folio UI
API Gateway integration
RabbitMQ charge events
final JWT/RBAC integration
```
