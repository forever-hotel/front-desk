# Forever Hotel — Front Desk Backend

NestJS backend for the **Forever Hotel Front Desk System (FDS)**.

The Front Desk backend currently provides reservation lookup, walk-in booking,
transactional guest check-in, guest identity verification, room assignment,
Front Desk audit logging, FOSS guest-session activation contracts, check-in
document printing contracts, and room-status management for the Front Desk room
board.

The service uses PostgreSQL for Front Desk-owned persistence and communicates
with other subsystem responsibilities through explicit integration contracts.

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
- Maintenance-state management contract
- Room transition concurrency protection
- Real-time-ready room-status results
- Unit tests
- PostgreSQL integration tests
- End-to-end tests
- Global Jest coverage enforcement

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

Format files:

```bash
npm run format
```

When working on a feature, prefer formatting only the files changed by that
feature instead of unnecessarily reformatting unrelated files.

Example:

```bash
npx prettier --write src/rooms test/app.e2e-spec.ts
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

The integration test suite requires a prepared PostgreSQL test database.

The GitHub Actions backend pipeline creates a disposable PostgreSQL 16 database,
applies the test schema and migrations, loads deterministic seed data, and then
runs the integration suite.

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

A pull request must continue to satisfy these coverage gates.

---

# Current Local Test Evidence

Current Plan 09 local verification:

```text
Lint
PASS
0 warnings
0 errors

Build
PASS

Unit tests
21 suites passed
138 tests passed
0 failed

Coverage
Statements  99.34%
Branches    86.47%
Functions   96.29%
Lines       99.27%

Rooms
Statements  100%
Branches    82.14%
Functions   100%
Lines       100%

E2E
1 suite passed
31 tests passed
0 failed
```

The PostgreSQL integration suite is intended to run in the disposable
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

The readiness endpoint confirms that the backend and configured database
connection are available.

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

---

## Search bookings

```http
GET /bookings/search?query=<search-term>
```

The reservation search supports matching against:

- Booking reference
- Guest name
- NIC/passport number
- Email address
- Phone number

Example:

```http
GET /bookings/search?query=Kamal
```

---

## Daily arrivals

```http
GET /bookings/arrivals
```

Returns confirmed bookings expected to arrive on the current UTC date.

For deterministic testing, a specific date may be supplied:

```http
GET /bookings/arrivals?date=2030-01-10
```

Eligible booking state:

```text
CONFIRMED
```

---

## Daily departures

```http
GET /bookings/departures
```

Returns checked-in bookings expected to depart on the current UTC date.

For deterministic testing:

```http
GET /bookings/departures?date=2030-01-12
```

Eligible booking state:

```text
CHECKED_IN
```

---

## Recent bookings

```http
GET /bookings/recent?limit=5
```

The supported limit is constrained between:

```text
1 and 20
```

---

## Reservation response

Reservation query responses may include:

- Booking ID
- Booking reference
- Guest name
- Guest email
- Guest phone
- Room type
- Check-in date
- Check-out date
- Booking status

---

# Walk-In Booking API

The current walk-in workflow implements the backend scope for **FD-04**.

A receptionist can create a booking by entering guest information, selecting a
room type and stay dates, and choosing either a cash or on-site card workflow.

---

## Create walk-in booking

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

---

## Supported Front Desk payment methods

```text
CASH
CARD_ON_SITE
```

`STRIPE` is not accepted by the current Front Desk walk-in endpoint.

---

## Walk-in validation

The backend validates:

- Guest full name
- Guest email
- Optional NIC/passport number
- Optional phone number
- Room type UUID
- Check-in date
- Check-out date
- Number of guests
- Room capacity
- Supported payment method

The check-out date must be later than the check-in date.

The selected room type must exist.

The guest count must not exceed the room type's configured capacity.

---

## Server-side pricing

The client does not provide the authoritative booking total.

The backend loads the persisted room price and calculates:

```text
total amount = price per night × number of nights
```

Currency amounts are persisted using integer smallest-unit values.

---

## Cash walk-in

A successful cash workflow persists:

```text
booking source  = WALK_IN
booking status  = CONFIRMED
payment method  = CASH
payment status  = COMPLETED
```

The payment completion timestamp is persisted.

---

## On-site card workflow

`CARD_ON_SITE` currently represents the Front Desk physical card-payment
workflow skeleton.

Until a later POS/payment integration confirms payment:

```text
booking source  = WALK_IN
booking status  = PENDING
payment method  = CARD_ON_SITE
payment status  = PENDING
paidAt          = null
```

The backend does not process raw card credentials.

---

## Raw card-data protection

Raw payment-card information must not be submitted to the Front Desk walk-in
API.

Unsupported fields include values such as:

```text
cardNumber
PAN
cvv
cvc
expiryDate
pin
trackData
```

For example, the following request is invalid:

```json
{
  "payment": {
    "paymentMethod": "CARD_ON_SITE",
    "cardNumber": "4111111111111111",
    "cvv": "123",
    "expiryDate": "12/30"
  }
}
```

The global NestJS validation pipe uses:

```text
whitelist = true
forbidNonWhitelisted = true
transform = true
```

Therefore unknown request properties are rejected.

---

## Guest account linking

If the supplied email already belongs to a registered guest, the walk-in booking
may be linked to that guest account.

If no registered account exists, the current schema permits the walk-in booking
to remain unlinked:

```text
guest_id = NULL
```

The Front Desk backend does not generate fake guest passwords or silently
create registered guest accounts.

---

## Walk-in database transaction

Booking and payment persistence execute inside one PostgreSQL transaction.

Conceptually:

```text
BEGIN

create booking
create payment

COMMIT
```

If payment persistence fails:

```text
create booking  -> success
create payment  -> failure

ROLLBACK
```

This prevents partially persisted walk-in workflows.

---

# Transactional Guest Check-In

The transactional check-in workflow implements the current backend scope for:

- **FD-05** — Guest identity verification
- **FD-06** — Room assignment and occupancy
- **FD-16** — Front Desk audit entry

Plan 08 extends the completed check-in with:

- **FD-07** — FOSS guest-session activation contract
- **FD-08** — Registration-card and payment-receipt printing contracts

---

## Check-in endpoint

```http
POST /check-in
Content-Type: application/json
```

`bookingReference` is the persisted booking UUID.

---

## Physical-document verification example

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

---

## Scanned-copy verification example

```json
{
  "bookingReference": "55555555-5555-4555-8555-555555555552",
  "verification": {
    "documentType": "PASSPORT",
    "verificationMethod": "SCANNED_COPY",
    "verifiedBy": "66666666-6666-4666-8666-666666666666",
    "documentStorageKey": "guest-id/opaque-passport-object-key",
    "documentSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  }
}
```

---

## Supported identity document types

```text
NIC
PASSPORT
OTHER
```

---

## Supported identity verification methods

```text
PHYSICAL_DOCUMENT
SCANNED_COPY
```

---

## Physical-document verification

For physical verification:

```text
verificationMethod = PHYSICAL_DOCUMENT
documentStorageKey = not supplied
documentSha256      = not supplied
```

The receptionist confirms that the guest physically presented an identity
document.

No scanned-file metadata is required.

---

## Scanned-copy verification

For scanned verification:

```text
verificationMethod = SCANNED_COPY
documentStorageKey = required
documentSha256      = optional
```

The actual NIC/passport image or document is **not stored in PostgreSQL**.

PostgreSQL stores only approved metadata, including:

- Document type
- Verification method
- Opaque storage key
- Optional SHA-256 integrity hash
- Verifying receptionist
- Verification timestamp
- Optional notes

The scanned file itself is intended to live in separately controlled encrypted
object storage.

Actual object-storage upload is outside the current implementation.

---

# Verifying Receptionist

The current development contract accepts:

```text
verifiedBy
```

as a staff UUID.

Before check-in continues, the PostgreSQL repository verifies that the supplied
staff record satisfies:

```text
role      = RECEPTIONIST
is_active = TRUE
```

This is a transitional development contract.

When centralized authentication is integrated, staff identity should come from
the authenticated JWT identity instead of being trusted directly from request
input.

---

# Booking Check-In Eligibility

A normal check-in requires:

```text
booking exists
booking status = CONFIRMED
```

Check-in is rejected from states such as:

```text
PENDING
CHECKED_IN
CHECKED_OUT
CANCELLED
```

---

# Room Assignment

If a booking already contains a room assignment, that room is used.

If the booking does not contain a room assignment, the request must provide:

```text
roomNumber
```

The selected room must:

- Exist
- Match the booking's room type
- Have status `VACANT`
- Have no conflicting active booking for the requested stay period

If the booking already has a room and the request provides a different room,
the check-in is rejected.

---

# Check-In Concurrency Protection

The check-in transaction locks important rows before making state changes.

The booking is loaded using a row lock before its status changes.

The assigned room is also row-locked before occupancy is changed.

Room availability is re-checked inside the transaction.

Conflicting booking states considered by the overlap query are:

```text
PENDING
CONFIRMED
CHECKED_IN
```

The booking currently being checked in is excluded from its own conflict
search.

---

# Identity-Verification Persistence

Successful verification creates one record in:

```text
fds_id_verifications
```

The current schema supports one verification record per booking.

A duplicate verification attempt is rejected.

---

# Check-In Booking Transition

On successful check-in:

```text
bookings.room_number = assigned room
bookings.status      = CHECKED_IN
```

---

# Check-In Room Transition

On successful check-in:

```text
rooms.status = OCCUPIED
```

The generic Plan 09 room-status endpoint does not replace this check-in-owned
transition.

---

# Front Desk Audit Entry

A successful check-in inserts a Front Desk audit record.

The current event uses:

```text
event_category = FRONT_DESK_OPERATION
actor_type     = STAFF
action         = CHECK_IN
entity_type    = BOOKING
entity_id      = booking UUID
```

The current audit details include operational metadata such as:

- Room number
- Verification ID
- Verification method
- Document type

The check-in audit details intentionally do not include:

- Guest name
- Guest email
- Guest phone number
- NIC/passport number
- Scanned identity-document contents
- Object-storage credentials

The application check-in workflow inserts new audit events and does not update
or delete previous audit events.

---

# Atomic PostgreSQL Check-In Transaction

The persisted check-in domain operation executes inside one PostgreSQL
transaction.

Conceptually:

```text
BEGIN

validate active receptionist

lock booking
validate booking status

determine assigned room

lock room
validate room type
validate room status
re-check overlapping bookings

check existing identity verification

insert identity verification

update booking -> CHECKED_IN
update room -> OCCUPIED

insert Front Desk audit record

COMMIT
```

If any database operation fails:

```text
ROLLBACK
```

For example:

```text
identity verification insert  -> success
booking update                 -> success
room update                    -> success
audit insert                   -> failure

ROLLBACK
```

After rollback:

```text
identity verification -> not persisted
booking               -> unchanged
room                  -> unchanged
audit event           -> absent
```

This prevents a partially persisted hotel check-in.

---

# Check-In Persistence Result

Internally, the PostgreSQL check-in repository also returns the booking's
check-out date.

This value is used by the post-commit FOSS activation contract to determine the
guest-session stay expiry.

It is not added to the public check-in response as a separate top-level
property.

---

# FD-07 — FOSS Guest-Session Activation

Plan 08 introduces the FOSS guest-session activation contract.

The Front Desk service does **not** directly create or update FOSS-owned
database records.

FOSS activation occurs through:

```text
FossSessionGateway
```

---

## FOSS activation flow

```text
POST /check-in
      |
      v
CheckInService
      |
      v
PostgreSQL CheckInRepository
      |
      v
BEGIN transaction
      |
      v
ID verification
booking -> CHECKED_IN
room -> OCCUPIED
audit insert
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

The important boundary is:

```text
database check-in transaction
        |
        v
      COMMIT
        |
        v
external FOSS activation
```

FOSS activation is **not** executed inside the PostgreSQL transaction.

---

# FOSS Activation Request Contract

The current activation request contains:

```text
bookingReference
roomNumber
checkOutDate
```

Example logical payload:

```json
{
  "bookingReference": "55555555-5555-4555-8555-555555555551",
  "roomNumber": "T103",
  "checkOutDate": "2032-01-12"
}
```

Guest PII such as guest name, email, phone, or identity-document number is not
required by this contract.

---

# FOSS Activation Result

The current mock adapter returns:

```json
{
  "status": "ACTIVATED",
  "sessionReference": "mock-foss-session-55555555-5555-4555-8555-555555555551",
  "validUntilDate": "2032-01-12"
}
```

The mock session reference is test/development integration metadata.

It is not a production guest credential.

---

# Successful Check-In Response

A successful check-in with successful mocked FOSS activation may return:

```json
{
  "status": "checked_in",
  "bookingReference": "55555555-5555-4555-8555-555555555551",
  "roomNumber": "T103",
  "bookingStatus": "CHECKED_IN",
  "roomStatus": "OCCUPIED",
  "verification": {
    "verificationId": "77777777-7777-4777-8777-777777777777",
    "documentType": "NIC",
    "verificationMethod": "PHYSICAL_DOCUMENT",
    "verifiedBy": "66666666-6666-4666-8666-666666666666",
    "verifiedAt": "2032-01-10T10:00:00.000Z"
  },
  "auditLogId": "88888888-8888-4888-8888-888888888888",
  "fossSession": {
    "status": "ACTIVATED",
    "sessionReference": "mock-foss-session-55555555-5555-4555-8555-555555555551",
    "validUntilDate": "2032-01-12"
  }
}
```

The public response does not expose:

- Scanned-document binary contents
- Document storage key
- Document SHA-256 value
- Raw payment-card data

---

# FOSS Failure Handling

FOSS is an external integration boundary.

A successful hotel check-in is not undone merely because external FOSS
activation fails after database commit.

Expected sequence:

```text
PostgreSQL check-in transaction
        |
        v
      COMMIT
        |
        v
FOSS activation request
        |
        X
      FAILED
```

Resulting domain state:

```text
booking = CHECKED_IN
room    = OCCUPIED
FOSS    = FAILED
```

The response reports the integration failure separately:

```json
{
  "fossSession": {
    "status": "FAILED",
    "sessionReference": null,
    "validUntilDate": "2032-01-12",
    "failureCode": "FOSS_ACTIVATION_FAILED"
  }
}
```

If the PostgreSQL check-in itself fails, FOSS activation is not attempted.

---

# Current FOSS Adapter

The current implementation uses:

```text
MockFossSessionGateway
```

This mock validates the Front Desk/FOSS contract and orchestration boundary.

It does not currently provide:

- Production FOSS HTTP connectivity
- RabbitMQ FOSS connectivity
- Production session-token generation
- Production guest QR credentials
- External retry infrastructure
- Production FOSS deployment integration

A future production FOSS adapter can replace the mock without changing
`CheckInService` business orchestration.

---

# FD-08 — Check-In Printing

Plan 08 also introduces backend contracts for:

```text
REGISTRATION_CARD
PAYMENT_RECEIPT
```

Printing happens as a separate request after check-in.

---

# Check-In Printing Endpoint

```http
POST /check-in/:bookingReference/print
Content-Type: application/json
```

`bookingReference` must be a valid UUID.

---

# Registration Card Print Request

```json
{
  "documentType": "REGISTRATION_CARD"
}
```

Example response:

```json
{
  "status": "accepted",
  "documentType": "REGISTRATION_CARD",
  "bookingReference": "44444444-4444-4444-8444-444444444444",
  "roomNumber": "T102",
  "printJobReference": "mock-print-registration_card-44444444-4444-4444-8444-444444444444"
}
```

---

# Payment Receipt Print Request

```json
{
  "documentType": "PAYMENT_RECEIPT"
}
```

Example response:

```json
{
  "status": "accepted",
  "documentType": "PAYMENT_RECEIPT",
  "bookingReference": "44444444-4444-4444-8444-444444444444",
  "roomNumber": "T102",
  "printJobReference": "mock-print-payment_receipt-44444444-4444-4444-8444-444444444444"
}
```

---

# Supported Check-In Document Types

```text
REGISTRATION_CARD
PAYMENT_RECEIPT
```

Unsupported values are rejected by DTO validation.

For example:

```json
{
  "documentType": "BOARDING_PASS"
}
```

is invalid.

---

# Print Eligibility

Before forwarding a print request to the printing adapter, the backend loads the
booking context from PostgreSQL.

Printing requires:

```text
booking exists
booking status = CHECKED_IN
room_number is assigned
```

A request is rejected when:

- The booking does not exist
- The booking is not checked in
- The booking has no assigned room
- The document type is unsupported
- The booking reference is not a valid UUID

---

# Printing Architecture

The current printing flow is:

```text
POST /check-in/:bookingReference/print
            |
            v
     CheckInController
            |
            v
     CheckInPrintService
            |
            +---------------------------+
            |                           |
            v                           v
PostgresCheckInPrintRepository   CheckInPrintGateway
                                        |
                                        v
                             MockCheckInPrintGateway
```

`PostgresCheckInPrintRepository` performs a read-only booking lookup.

The printing adapter is responsible for the external printing boundary.

---

# Printing Contract Payload

The current print gateway receives operational stay information:

```text
documentType
bookingReference
roomNumber
checkInDate
checkOutDate
```

The printing gateway contract does not contain raw card credentials.

---

# Payment Receipt Security

The payment-receipt request must not accept values such as:

```text
cardNumber
PAN
cvv
cvc
pin
trackData
```

For example:

```json
{
  "documentType": "PAYMENT_RECEIPT",
  "cardNumber": "4111111111111111",
  "cvv": "123",
  "pin": "9999"
}
```

is rejected by global request validation.

The printing contract is intentionally based on booking/stay identifiers rather
than raw payment-card information.

---

# Printing Failure Handling

Printing is an external operation.

If the printer adapter fails:

```text
booking = CHECKED_IN
room    = OCCUPIED

print request -> FAILED
```

The previous hotel check-in is not reversed.

The current service returns a service-unavailable error for printing gateway
failure.

The printing failure does not:

- Change the booking back to `CONFIRMED`
- Change the room back to `VACANT`
- Modify the FOSS result
- Reverse the completed check-in transaction

---

# Current Printing Adapter

The current implementation uses:

```text
MockCheckInPrintGateway
```

It validates the backend integration contract only.

It does not currently communicate with:

- USB receipt printers
- LPD printers
- RAW network printers
- Printer queues
- Printer discovery services
- Real printer IP addresses

It also does not currently implement:

- Physical printer acknowledgement
- Production retry queues
- Printer configuration UI

A later adapter can replace the mock without changing
`CheckInPrintService`.

---

# FD-12 — Room Status Board

Plan 09 introduces the dedicated Front Desk room-status API.

The room status board is intended to show the current operational state of each
hotel room.

The backend persists the following room states:

```text
VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE
```

The Front Desk UI may display:

```text
VACANT = Clean/Vacant
```

There is no separate persisted `CLEAN` room status.

---

# Room Status Board Endpoint

```http
GET /rooms/status
```

The endpoint returns the current persisted room-state information required for
the Front Desk room board.

Example response:

```json
[
  {
    "roomNumber": "T101",
    "roomTypeId": "11111111-1111-4111-8111-111111111111",
    "roomTypeName": "CI Standard Room",
    "floor": 1,
    "status": "VACANT",
    "lastClearedAt": "2032-01-09T08:00:00.000Z",
    "updatedAt": "2032-01-10T08:00:00.000Z"
  },
  {
    "roomNumber": "T102",
    "roomTypeId": "11111111-1111-4111-8111-111111111111",
    "roomTypeName": "CI Standard Room",
    "floor": 1,
    "status": "OCCUPIED",
    "lastClearedAt": "2032-01-08T08:00:00.000Z",
    "updatedAt": "2032-01-10T09:00:00.000Z"
  }
]
```

The room-status board response intentionally does not require guest PII.

It does not expose:

```text
guestName
guestEmail
guestPhone
NIC/passport number
payment details
```

---

# Supported Room Statuses

The backend room-status enum contains:

```text
VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE
```

`CLEAN` is not a valid persisted status.

A clean room that is ready for use is represented by:

```text
VACANT
```

---

# Room Status Update Endpoint

```http
PATCH /rooms/:roomNumber/status
Content-Type: application/json
```

Example:

```http
PATCH /rooms/T103/status
```

Request:

```json
{
  "targetStatus": "UNDER_MAINTENANCE"
}
```

The DTO normalizes supported string input to uppercase.

For example:

```json
{
  "targetStatus": "under_maintenance"
}
```

is normalized to:

```text
UNDER_MAINTENANCE
```

Unsupported values are rejected.

For example:

```json
{
  "targetStatus": "CLEAN"
}
```

returns a validation error.

---

# Guarded Room Status Transitions

The generic room-status endpoint is not allowed to arbitrarily mutate room
state.

The current manual transition policy is:

```text
VACANT
  -> UNDER_MAINTENANCE
  allowed

UNDER_MAINTENANCE
  -> VACANT
  allowed

REQUIRES_CLEANING
  -> VACANT
  allowed
```

All other generic transitions are blocked unless they are handled by their
dedicated domain workflow.

---

# Check-In-Owned Room Transition

The following transition belongs to the transactional check-in workflow:

```text
VACANT -> OCCUPIED
```

The generic room-status endpoint must not be used to bypass guest check-in.

Therefore:

```http
PATCH /rooms/T103/status
```

with:

```json
{
  "targetStatus": "OCCUPIED"
}
```

is rejected by the guarded transition policy.

---

# Checkout-Owned Room Transition

The following transition belongs to the guest checkout workflow:

```text
OCCUPIED -> REQUIRES_CLEANING
```

The generic room-status endpoint does not bypass the future checkout workflow.

Therefore a generic request attempting to place an occupied room directly into:

```text
REQUIRES_CLEANING
```

is rejected.

Checkout itself is outside Plan 09.

---

# Maintenance Transition

An eligible clean/vacant room may be manually removed from normal operational
use:

```text
VACANT -> UNDER_MAINTENANCE
```

Example response:

```json
{
  "roomNumber": "T103",
  "previousStatus": "VACANT",
  "status": "UNDER_MAINTENANCE",
  "lastClearedAt": "2032-01-09T08:00:00.000Z",
  "updatedAt": "2032-01-10T12:00:00.000Z"
}
```

A room under maintenance is not considered a normal vacant room for check-in.

Full FD-13 booking-availability integration is outside the current Plan 09
scope.

---

# Clearing a Maintenance Room

Once a maintained room has been cleared for use, the guarded room-status
contract supports:

```text
UNDER_MAINTENANCE -> VACANT
```

This represents the room becoming clean and available again.

When the room enters `VACANT`, the backend updates:

```text
last_cleared_at
```

---

# Housekeeping Completion Transition

The guarded room-status contract also supports:

```text
REQUIRES_CLEANING -> VACANT
```

This represents the room becoming clean/vacant after the required cleaning has
been completed.

When this transition succeeds:

```text
status          = VACANT
last_cleared_at = current database timestamp
updated_at      = current database timestamp
```

Plan 09 does not implement WKMS task completion itself.

It only provides the room-state transition required once the room may be
cleared.

---

# Same-State Room Requests

A request that does not represent a real state change is rejected.

For example:

```text
VACANT -> VACANT
```

does not silently succeed.

It returns a conflict response.

This prevents false room-status events and misleading update timestamps.

---

# Unknown Rooms

A status transition for an unknown room returns a Not Found response.

Example:

```http
PATCH /rooms/T999/status
```

The service does not create missing rooms automatically.

---

# Room Status Transition Architecture

The current Plan 09 structure is:

```text
RoomsController
      |
      v
RoomsService
      |
      v
RoomRepository
      |
      v
PostgresRoomRepository
      |
      v
rooms table
```

Responsibilities are separated as follows:

```text
RoomsController
---------------
HTTP request/response boundary

RoomsService
------------
business transition policy
room-number normalization
domain error mapping

RoomRepository
--------------
persistence abstraction

PostgresRoomRepository
----------------------
PostgreSQL queries
transactions
row locking
status persistence
timestamp persistence
```

---

# Room Status PostgreSQL Transaction

A room-status transition uses a PostgreSQL transaction.

Conceptually:

```text
BEGIN
  |
  v
SELECT room
FOR UPDATE
  |
  v
check room exists
  |
  v
check same state
  |
  v
check allowed current state
  |
  v
UPDATE rooms
  |
  v
COMMIT
```

The room row is locked using:

```sql
FOR UPDATE
```

before the transition is evaluated.

This prevents two concurrent requests from both independently acting on the same
stale room state.

---

# Room Status Failure Handling

If a room does not exist:

```text
ROLLBACK
```

If the requested target equals the current state:

```text
ROLLBACK
```

If the transition is not allowed:

```text
ROLLBACK
```

If an unexpected database failure occurs:

```text
ROLLBACK
rethrow error
```

Only a valid status transition is committed.

---

# Room Cleared Timestamp

The `rooms` table contains:

```text
last_cleared_at
```

The current Plan 09 behavior is:

```text
target status = VACANT
    -> last_cleared_at = NOW()
```

For transitions to other states:

```text
last_cleared_at
    -> preserved
```

For example:

```text
VACANT -> UNDER_MAINTENANCE
```

does not falsely mark the room as newly cleared.

---

# Real-Time-Ready Room Status Result

Plan 09 is intentionally structured so the result of a successful status
transition can later be published through the shared real-time layer.

Example logical result:

```json
{
  "roomNumber": "T103",
  "previousStatus": "VACANT",
  "status": "UNDER_MAINTENANCE",
  "lastClearedAt": "2032-01-09T08:00:00.000Z",
  "updatedAt": "2032-01-10T12:00:00.000Z"
}
```

The room business service currently does not depend directly on Socket.IO.

Future flow:

```text
RoomsService
      |
      v
typed room status result
      |
      v
Realtime/WebSocket adapter
      |
      v
Front Desk room-status board
```

This allows WebSocket publishing to be added later without rewriting the room
transition business rules.

---

# Current Real-Time Limitation

Plan 09 makes the room APIs and returned models ready for future real-time
delivery.

The current implementation does **not** yet provide:

- Socket.IO gateway
- WebSocket room-status broadcast
- Gateway WSS endpoint
- Frontend real-time subscription
- Automatic cache updates in the frontend
- RabbitMQ room-status events

The current source of truth remains PostgreSQL plus the REST APIs.

---

# Integration Ownership Boundaries

Forever Hotel is designed as multiple independently owned subsystem services.

The Front Desk backend must not directly modify persistence owned by another
subsystem for cross-service workflows.

Current responsibilities include:

```text
Front Desk responsibilities
---------------------------
reservation lookup
walk-in booking orchestration
check-in orchestration
ID-verification metadata
booking state transition
room occupancy transition
Front Desk audit entry
FOSS activation request
printing request
room-status board
guarded room-status management

FOSS responsibilities
---------------------
guest session state
guest access lifecycle
guest application access

WKMS responsibilities
----------------------
worker tasks
room-cleaning tasks
task assignment/completion

Printing integration responsibilities
-------------------------------------
physical registration-card delivery
physical payment-receipt delivery
```

Therefore:

```text
FDS -> FossSessionGateway -> FOSS adapter
```

is used instead of:

```text
FDS -> direct foss_sessions database write
```

Likewise, Plan 09 does not directly implement WKMS task behavior.

---

# PostgreSQL Integration Tests

The integration test suite is designed to run against a disposable PostgreSQL
database.

Existing transactional check-in integration coverage includes:

- Successful confirmed-booking check-in
- Physical-document verification
- Scanned-copy verification metadata
- Pre-assigned room handling
- Booking transition to `CHECKED_IN`
- Room transition to `OCCUPIED`
- Audit-event persistence
- Invalid booking-state rejection
- Occupied-room rejection
- Room-type mismatch rejection
- Overlapping active-booking rejection
- Non-receptionist rejection
- Inactive receptionist rejection
- Transaction rollback when audit persistence fails

---

# Plan 08 PostgreSQL Printing Integration Test

Plan 08 adds:

```text
test/database/postgres-check-in-print.repository.integration-spec.ts
```

The integration test verifies actual PostgreSQL read behavior for:

- A checked-in booking with assigned room
- A confirmed booking
- An unknown booking

The service layer separately verifies whether that retrieved context is eligible
for printing.

---

# Plan 09 PostgreSQL Room Integration Test

Plan 09 adds:

```text
test/database/postgres-room.repository.integration-spec.ts
```

The integration suite uses dedicated Plan 09 test rooms and verifies actual
PostgreSQL behavior for:

- Room-board retrieval
- All four persisted room states
- `VACANT -> UNDER_MAINTENANCE`
- `REQUIRES_CLEANING -> VACANT`
- `UNDER_MAINTENANCE -> VACANT`
- `last_cleared_at` updates
- Non-vacant transitions preserving existing cleared timestamp
- Same-state behavior
- Invalid transition blocking
- Unknown room behavior
- Actual room-state persistence

The test fixtures are created inside the disposable test database and removed
after the suite.

Plan 09 integration tests should not be run against the shared Neon development
database.

---

# Unit and Contract Tests

The current unit and contract suite includes coverage for:

## Reservation and walk-in

- Reservation lookup behavior
- Arrival/departure queries
- Walk-in request validation
- Server-side stay pricing
- Room-capacity enforcement
- Cash workflow
- On-site card workflow
- Raw card-data protection
- Walk-in transaction behavior

## Check-in

- Physical identity-document verification
- Scanned-copy verification
- Storage-key validation
- SHA-256 normalization
- Room assignment handling
- Transaction repository behavior
- FOSS activation after successful database check-in
- FOSS activation ordering
- FOSS activation success
- FOSS activation failure
- No FOSS activation when database check-in fails
- FOSS mock contract
- Registration-card printing
- Payment-receipt printing
- Print booking eligibility
- Missing booking handling
- Missing room handling
- Printer gateway failure
- Raw-card-field protection
- Mock print gateway
- Print repository behavior
- DTO transformation and validation

## Room status

- All supported room statuses
- Lowercase-to-uppercase DTO transformation
- Unsupported `CLEAN` rejection
- Invalid room status rejection
- Room-status board delegation
- Room status service delegation
- `VACANT -> UNDER_MAINTENANCE`
- `UNDER_MAINTENANCE -> VACANT`
- `REQUIRES_CLEANING -> VACANT`
- Check-in-owned `OCCUPIED` transition protection
- Checkout-owned `REQUIRES_CLEANING` transition protection
- Same-state transition rejection
- Unknown room behavior
- Empty room-number rejection
- PostgreSQL room-board mapping
- PostgreSQL transaction handling
- PostgreSQL `FOR UPDATE` locking
- `last_cleared_at` handling
- Rollback on invalid transition
- Rollback on unexpected database error

---

# End-to-End Tests

The E2E suite currently verifies HTTP behavior including:

- Root endpoint
- Health readiness

## Room-status E2E

- FD-12 room status board
- `VACANT` room state
- `OCCUPIED` room state
- `REQUIRES_CLEANING` room state
- `UNDER_MAINTENANCE` room state
- No guest PII in room-board response
- `VACANT -> UNDER_MAINTENANCE`
- Room-number normalization
- Lowercase target-status normalization
- Same-state transition rejection
- Check-in-owned `OCCUPIED` transition blocking
- Checkout-owned `REQUIRES_CLEANING` transition blocking
- Unsupported `CLEAN` state rejection
- Unknown room response

## Reservation E2E

- Reservation search
- Daily arrivals
- Daily departures

## Walk-in E2E

- Cash walk-in booking
- On-site card workflow
- Raw walk-in card-data rejection
- Unsupported payment method
- Invalid email validation
- Invalid date validation
- Room-capacity validation

## Check-in E2E

- Physical-document guest check-in
- FOSS activation after check-in
- FOSS activation failure handling
- Scanned-copy verification
- Missing scanned-copy storage-key rejection
- Legacy `idVerified` request rejection
- Invalid verifying-staff UUID rejection

## Printing E2E

- Registration-card print request
- Payment-receipt print request
- Unsupported print-document rejection
- Raw-card-field rejection for printing
- Printer failure handling
- Invalid booking UUID rejection

The current local E2E suite contains:

```text
31 tests
31 passed
0 failed
```

---

# GitHub Actions Backend CI

The backend CI workflow runs for relevant:

- `develop` pushes
- `main` pushes
- `feature/**` pushes
- `fix/**` pushes
- Pull requests targeting `develop`
- Pull requests targeting `main`

The pipeline provisions:

```text
PostgreSQL 16
Node.js 24
```

The CI sequence is:

```text
Checkout repository
        |
        v
Install dependencies
        |
        v
Prepare disposable PostgreSQL schema
        |
        v
Run TypeORM migrations
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
Run lint
        |
        v
Build NestJS backend
        |
        v
Run Jest coverage
        |
        v
Upload coverage artifact
        |
        v
Run E2E tests
        |
        v
Run dependency security scan
```

This allows PostgreSQL integration tests to run without modifying the shared
Neon development database.

---

# Current Authentication Limitation

Final centralized authentication and JWT/RBAC integration are not part of the
current Front Desk implementation.

For check-in, the current request still accepts:

```text
verifiedBy
```

as a receptionist UUID.

The repository verifies that this staff record is:

```text
RECEPTIONIST
ACTIVE
```

This should not be treated as the final authorization solution.

Later authentication integration should derive staff identity from the
authenticated JWT.

The current room-status management endpoint also does not yet contain final
JWT/RBAC authorization.

Authorization for room-status management must be enforced when centralized
authentication integration is introduced.

---

# Plan 07 Summary

Plan 07 introduced the production-style PostgreSQL check-in domain transaction.

It implemented:

```text
FD-05
guest ID verification

FD-06
room assignment
booking -> CHECKED_IN
room -> OCCUPIED

FD-16
Front Desk audit entry
```

The Plan 07 transaction also introduced row locking, room availability re-check,
rollback handling, and database integration tests.

---

# Plan 08 Summary

Plan 08 extends the completed check-in workflow with cross-service and external
operation contracts.

Implemented:

```text
FD-07
FOSS activation contract
MockFossSessionGateway
post-commit FOSS activation
room-linked activation request
stay-expiry information
FOSS success response
FOSS failure response
no FOSS call after failed DB check-in
no direct FOSS database persistence

FD-08
registration-card print contract
payment-receipt print contract
print eligibility validation
PostgresCheckInPrintRepository
CheckInPrintGateway
MockCheckInPrintGateway
printing failure handling
raw payment-card-field rejection
```

---

# Plan 08 Failure Boundaries

The persisted check-in and external operations deliberately have different
failure boundaries.

## Database failure

```text
PostgreSQL transaction -> FAILED

booking changes -> rolled back
room changes    -> rolled back
verification    -> rolled back
audit entry     -> rolled back
FOSS activation -> not attempted
```

## FOSS failure after commit

```text
PostgreSQL transaction -> COMMITTED
booking                -> CHECKED_IN
room                   -> OCCUPIED
FOSS activation        -> FAILED
```

The database check-in remains successful.

## Printing failure

```text
booking       -> CHECKED_IN
room          -> OCCUPIED
print request -> FAILED
```

Printing failure does not reverse check-in state.

---

# Plan 08 Out of Scope

The current Plan 08 implementation intentionally does not include:

- Production FOSS HTTP adapter
- Production RabbitMQ FOSS wiring
- Production guest session-token generation
- Production QR credential generation
- Direct writes to `foss_sessions`
- USB printer-driver implementation
- LPD printer integration
- RAW network printer integration
- Printer discovery
- Printer configuration UI
- Front Desk frontend printing UI
- Checkout printing
- API Gateway integration
- Final JWT/RBAC integration
- Production retry queues for FOSS or printers

---

# Plan 09 Summary

Plan 09 introduces the Front Desk room-status backend required for the room
status board.

Implemented:

```text
FD-12 room status board

GET /rooms/status

PATCH /rooms/:roomNumber/status

RoomStatus enum

VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE

PostgresRoomRepository

explicit transition policy

VACANT -> UNDER_MAINTENANCE

UNDER_MAINTENANCE -> VACANT

REQUIRES_CLEANING -> VACANT

same-state transition blocking

check-in-owned transition protection

checkout-owned transition protection

FOR UPDATE concurrency protection

last_cleared_at handling

typed real-time-ready transition result

unit tests

PostgreSQL integration test

E2E tests
```

---

# Plan 09 Transition Boundaries

Plan 09 separates generic room management from booking/check-in/checkout
workflows.

## Allowed generic transitions

```text
VACANT
  -> UNDER_MAINTENANCE

UNDER_MAINTENANCE
  -> VACANT

REQUIRES_CLEANING
  -> VACANT
```

## Check-in-owned transition

```text
VACANT
  -> OCCUPIED
```

This transition remains owned by the transactional check-in workflow.

## Checkout-owned transition

```text
OCCUPIED
  -> REQUIRES_CLEANING
```

This transition remains owned by the checkout workflow.

The generic room-status endpoint therefore cannot be used as a shortcut around
hotel booking lifecycle rules.

---

# Plan 09 Real-Time Readiness

Plan 09 does not directly implement WebSocket broadcasting.

Instead, it returns a stable typed transition result containing:

```text
roomNumber
previousStatus
status
lastClearedAt
updatedAt
```

This result may later be published by the shared real-time layer.

The business rules therefore remain independent of the delivery mechanism.

---

# Plan 09 Out of Scope

The current Plan 09 implementation intentionally does not include:

- Front Desk room-status frontend grid
- Socket.IO gateway
- WebSocket room-status broadcasting
- RabbitMQ room-status events
- Guest checkout
- Automatic WKMS cleaning-task creation
- WKMS cleaning-task completion consumption
- Room-change workflow
- Full FD-13 booking-availability integration
- API Gateway integration
- Final JWT/RBAC integration
- Manager Dashboard room-status integration

---

# Security Notes

The current Front Desk implementation follows these development rules:

- Never commit `.env` files containing real credentials.
- Never store raw NIC/passport image data directly in PostgreSQL.
- Store only approved scanned-document metadata in PostgreSQL.
- Never send unnecessary guest PII through the FOSS activation contract.
- Never accept raw card credentials in the printing contract.
- Never log raw payment-card data.
- Never hard-code printer credentials.
- Never hard-code production FOSS credentials.
- Never expose production secrets in mock adapters.
- Keep database access parameterized.
- Keep `DB_SYNCHRONIZE=false`.
- Use migrations for schema evolution.
- Keep cross-service state behind explicit integration contracts.
- Do not expose guest PII through the room-status board.
- Do not accept arbitrary room-state strings.
- Do not allow generic room management to bypass check-in/checkout workflows.
- Use row locking for room-status transitions.

---

# Current Folder Responsibilities

## Check-in components

```text
src/check-ins/
├── dto/
│   ├── check-in-request.dto.ts
│   ├── check-in-verification.dto.ts
│   └── check-in-print-request.dto.ts
│
├── gateways/
│   ├── mock-foss-session.gateway.ts
│   └── mock-check-in-print.gateway.ts
│
├── models/
│   ├── check-in-transaction.ts
│   ├── check-in-persistence-result.ts
│   ├── check-in-result.ts
│   ├── check-in-print-context.ts
│   └── check-in-print-result.ts
│
├── ports/
│   ├── check-in.repository.ts
│   ├── foss-session.gateway.ts
│   ├── check-in-print.repository.ts
│   └── check-in-print.gateway.ts
│
├── repositories/
│   ├── postgres-check-in.repository.ts
│   └── postgres-check-in-print.repository.ts
│
├── check-in.controller.ts
├── check-in.service.ts
├── check-in-print.service.ts
└── check-in.module.ts
```

Production check-in code depends on abstractions such as:

```text
CheckInRepository
FossSessionGateway
CheckInPrintRepository
CheckInPrintGateway
```

Nest dependency injection binds those contracts to the current implementations.

---

## Room-status components

```text
src/rooms/
├── dto/
│   ├── update-room-status.dto.ts
│   └── update-room-status.dto.spec.ts
│
├── models/
│   ├── room-status.ts
│   ├── room-status-board-item.ts
│   ├── room-status-transition-result.ts
│   └── room-status-transition-persistence.ts
│
├── ports/
│   └── room.repository.ts
│
├── repositories/
│   ├── postgres-room.repository.ts
│   └── postgres-room.repository.spec.ts
│
├── rooms.controller.ts
├── rooms.controller.spec.ts
├── rooms.service.ts
├── rooms.service.spec.ts
└── rooms.module.ts
```

The room module uses:

```text
RoomRepository
```

as its persistence abstraction.

The current production binding is:

```text
RoomRepository
      |
      v
PostgresRoomRepository
```

---

# Current Backend Architecture

At the current stage:

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
```

The feature structure keeps business domains separated.

For example:

```text
reservations/
check-ins/
rooms/
health/
```

Database access remains outside HTTP controllers.

---

# Database Room Model

The current shared `rooms` persistence model includes:

```text
room_number
room_type_id
floor
status
last_cleared_at
notes
created_at
updated_at
```

The persisted status type contains:

```text
VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE
```

Plan 09 does not introduce a new table or a new room-status enum value.

---

# No CLEAN Database Status

The Front Desk design describes a room-board state as:

```text
Clean/Vacant
```

The physical PostgreSQL representation remains:

```text
VACANT
```

The backend therefore does not introduce:

```text
CLEAN
```

as an additional room status.

This avoids creating two database values for the same operational meaning.

---

# Git Workflow

Feature development uses:

```text
main
develop
feature/<issue-number>-<slug>
```

Pull requests for development work target:

```text
develop
```

Current Plan 09 feature branch:

```text
feature/43-room-status-board
```

Use Conventional Commit messages.

Recommended Plan 09 commit:

```text
feat(fds-backend): add room status board and guarded transitions
```

---

# Definition of Done

Before merging a backend feature:

- Acceptance criteria are implemented
- Lint passes
- Build passes
- Unit tests pass
- Global coverage remains at least 80%
- E2E tests pass
- PostgreSQL integration tests pass in CI where required
- No secrets are committed
- Documentation is updated
- Pull request targets `develop`
- CI passes
- The related GitHub issue is linked

---

# Completed Plan 08 Issue

```text
Issue #41

[DDP-69] feat(fds-backend): add FOSS activation and check-in printing contracts
```

Plan 08 covers:

```text
FD-07
FD-08
```

The production FOSS adapter and physical printer adapter remain future
integration work.

---

# Current Plan 09 Issue

```text
Issue #43

[DDP-71] feat(fds-backend): add room status board and guarded status transitions
```

Plan 09 primarily covers:

```text
FD-12
```

and prepares the backend contract for related room-management behavior.

Implemented Plan 09 scope:

```text
GET /rooms/status

PATCH /rooms/:roomNumber/status

VACANT
OCCUPIED
REQUIRES_CLEANING
UNDER_MAINTENANCE

guarded transitions

maintenance state entry

maintenance clearing

cleaning completion to VACANT

same-state blocking

check-in/checkout workflow protection

room row locking

last_cleared_at updates

real-time-ready result models

unit tests

PostgreSQL integration test

E2E tests
```

Pending outside Plan 09:

```text
actual WebSocket broadcasting

checkout workflow

WKMS cleaning-task automation

room changes

full FD-13 booking-availability integration

API Gateway integration

final JWT/RBAC integration
```
