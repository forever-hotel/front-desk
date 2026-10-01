<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

<p align="center">
  A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.
</p>

<p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
<a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
<a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us"></a>
</p>

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov

# PostgreSQL integration tests
$ npm run test:integration
```

## Reservation Search API

The Front Desk reservation endpoints use PostgreSQL persistence through the
`PostgresBookingRepository`.

### Search bookings

```http
GET /bookings/search?query=<search-term>
```

Searches bookings using:

- Booking reference
- Guest name
- NIC or passport number
- Email address
- Phone number

### Daily arrivals

```http
GET /bookings/arrivals
```

Returns confirmed bookings expected to arrive on the current UTC date.

An explicit date can be supplied for deterministic testing:

```http
GET /bookings/arrivals?date=2030-01-10
```

### Daily departures

```http
GET /bookings/departures
```

Returns checked-in bookings expected to depart on the current UTC date.

An explicit date can be supplied for deterministic testing:

```http
GET /bookings/departures?date=2030-01-12
```

### Recent bookings

```http
GET /bookings/recent?limit=5
```

Returns recent persisted bookings. The limit is constrained to a minimum of
`1` and a maximum of `20`.

### Reservation response

Reservation endpoints return:

- Booking ID
- Booking reference
- Guest name
- Guest email
- Guest phone
- Room type
- Check-in date
- Check-out date
- Booking status

## Walk-In Booking API

The Front Desk walk-in workflow implements FD-04.

A receptionist can enter guest details, select a room type and stay dates, and
record either cash payment or an on-site card payment workflow.

### Create walk-in booking

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

Supported payment methods:

```text
CASH
CARD_ON_SITE
```

`STRIPE` is not accepted by the Front Desk walk-in endpoint.

### Walk-in validation

The backend validates:

- Guest full name
- Guest email
- Optional NIC/passport number
- Optional phone number
- Room type UUID
- Check-in date
- Check-out date
- Number of guests
- Selected room type capacity
- Supported payment method

The check-out date must be later than the check-in date.

The selected room type must exist.

The guest count must not exceed the selected room type's maximum capacity.

### Server-side pricing

The client does not provide the authoritative booking total.

The backend loads `price_per_night` from the persisted room type and calculates:

```text
total amount = price per night × number of nights
```

This prevents a client from supplying an arbitrary booking price.

Currency values are represented as integer LKR smallest-unit values.

### Cash workflow

For a successful cash walk-in:

```text
booking source  = WALK_IN
booking status  = CONFIRMED
payment method  = CASH
payment status  = COMPLETED
```

The payment completion timestamp is persisted.

### On-site card workflow

`CARD_ON_SITE` represents the Front Desk card-payment workflow skeleton.

Until a future physical POS/payment integration confirms the payment:

```text
booking source  = WALK_IN
booking status  = PENDING
payment method  = CARD_ON_SITE
payment status  = PENDING
paidAt          = null
```

The backend does not process or persist raw card credentials.

### Raw card data

The API must not receive or persist raw card information.

The following fields are not part of the payment DTO and are rejected:

```text
cardNumber
PAN
cvv
cvc
expiryDate
pin
trackData
```

For example, this request is invalid:

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

The global NestJS validation pipe uses a whitelist and rejects unknown
properties.

### Guest account linking

If the supplied email belongs to an existing registered guest, the walk-in
booking is linked to that guest account.

If no registered guest account exists, the booking may remain an anonymous
walk-in with `guest_id = NULL`.

The current shared Guest schema requires a password hash for registered guest
accounts. The Front Desk workflow therefore does not generate fake passwords or
silently create guest accounts.

Permanent anonymous walk-in guest-detail persistence requires an agreed shared
schema/architecture decision.

### Database transaction

Walk-in booking and payment creation are performed within a PostgreSQL
transaction.

Conceptually:

```text
BEGIN

create booking
create payment

COMMIT
```

If payment persistence fails after the booking insert:

```text
create booking  -> success
create payment  -> failure

ROLLBACK
```

The transaction prevents a partially persisted walk-in workflow.

### Walk-in response

A successful request returns information including:

- Booking ID
- Booking reference
- Guest account link state
- Guest input details
- Room type
- Check-in date
- Check-out date
- Number of guests
- Special requests
- Server-calculated total
- Currency
- Booking status
- Booking source
- Payment ID
- Payment method
- Payment status
- Payment amount
- Payment completion time

No raw card information is returned.

## Transactional Check-In API

The Front Desk transactional check-in workflow implements the current backend
scope for:

- FD-05 — guest identity verification
- FD-06 — room assignment and room occupancy
- FD-16 — Front Desk audit logging

The workflow replaces the previous provisional in-memory check-in persistence
with a PostgreSQL-backed domain transaction.

### Check in a guest

```http
POST /check-in
Content-Type: application/json
```

The `bookingReference` is the persisted booking UUID.

Example physical-document verification request:

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

Example scanned-copy verification request:

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

### Identity document types

Supported values are:

```text
NIC
PASSPORT
OTHER
```

### Verification methods

Supported values are:

```text
PHYSICAL_DOCUMENT
SCANNED_COPY
```

### Physical-document verification

For physical-document verification:

```text
verificationMethod = PHYSICAL_DOCUMENT
documentStorageKey = not supplied
documentSha256      = not supplied
```

The receptionist confirms the identity document that is physically presented at
reception.

No scanned-document storage information is required.

### Scanned-copy verification

For scanned-copy verification:

```text
verificationMethod = SCANNED_COPY
documentStorageKey = required
documentSha256      = optional
```

The actual NIC/passport image or file is not stored in PostgreSQL.

PostgreSQL stores only approved metadata such as:

- Opaque object-storage key
- Optional SHA-256 integrity hash
- Document type
- Verification method
- Verifying receptionist
- Verification timestamp
- Optional verification notes

The actual scanned document is intended to be stored separately in encrypted
object storage.

Object-storage upload implementation is outside the current transactional
check-in scope.

### Verifying receptionist

The current development contract accepts:

```text
verifiedBy
```

as a staff UUID.

Before the transaction proceeds, the PostgreSQL repository verifies that the
staff record exists and satisfies:

```text
role      = RECEPTIONIST
is_active = TRUE
```

This is a transitional contract while centralized authentication and JWT/RBAC
integration remain outside the current Front Desk implementation.

When authentication integration is introduced, the verifying staff identity
should be obtained from the authenticated JWT identity instead of being trusted
directly from request input.

### Booking eligibility

The booking must:

- Exist
- Be in `CONFIRMED` status

A normal check-in is rejected if the booking is in another state such as:

```text
PENDING
CHECKED_IN
CHECKED_OUT
CANCELLED
```

### Room assignment

If the booking already contains a room assignment, that room is used.

If the booking does not yet contain a room assignment, `roomNumber` must be
provided in the request.

The selected room must:

- Exist
- Belong to the same `room_type_id` as the booking
- Have status `VACANT`
- Have no overlapping active booking for the requested stay period

If the booking already has a room assigned and the request supplies a different
room number, the check-in is rejected.

The booking and room rows are locked while the check-in transaction is being
performed.

### Room availability re-check

Room availability is checked inside the PostgreSQL transaction.

The repository checks for overlapping bookings using active booking states:

```text
PENDING
CONFIRMED
CHECKED_IN
```

The booking being checked in is excluded from the conflict query.

This protects the check-in workflow from committing against stale room
availability information.

### Identity-verification persistence

A successful check-in creates one record in:

```text
fds_id_verifications
```

The record contains approved verification metadata.

For physical verification, no scanned-file storage key is stored.

For scanned-copy verification, an opaque object-storage key is required.

A booking cannot create a second identity-verification record because the
current schema defines one verification record per booking.

### Booking state transition

On successful check-in:

```text
bookings.room_number = assigned room number
bookings.status      = CHECKED_IN
```

### Room state transition

On successful check-in:

```text
rooms.status = OCCUPIED
```

### Audit logging

A successful check-in appends a Front Desk audit event to `audit_logs`.

The event uses:

```text
event_category = FRONT_DESK_OPERATION
actor_type     = STAFF
action         = CHECK_IN
entity_type    = BOOKING
entity_id      = booking UUID
```

The current check-in audit details contain operational metadata such as:

- Room number
- Verification ID
- Verification method
- Document type

The audit details do not include guest name, email, phone number,
NIC/passport number, document contents, or storage credentials.

The application check-in flow inserts audit records and does not modify or
delete previous audit entries.

### Atomic PostgreSQL transaction

The complete check-in persistence operation runs inside one PostgreSQL
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
validate VACANT room status
re-check overlapping active bookings
check for existing ID verification
insert identity-verification record
update booking room number
update booking status to CHECKED_IN
update room status to OCCUPIED
insert audit-log record

COMMIT
```

If any persistence operation fails:

```text
ROLLBACK
```

The transaction therefore prevents partial check-in state.

For example:

```text
identity verification insert  -> success
booking update                 -> success
room update                    -> success
audit insert                   -> failure

ROLLBACK
```

After the rollback:

```text
identity-verification insert -> undone
booking update               -> undone
room update                  -> undone
audit insert                 -> absent
```

### Row locking

The transaction locks the booking row before changing its state and locks the
room row before assigning or occupying it.

This prevents concurrent check-in operations from independently proceeding
against the same stale booking or room state.

### Successful response

Example response:

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
  "auditLogId": "88888888-8888-4888-8888-888888888888"
}
```

The response does not expose:

- Scanned-document contents
- Document-storage key
- Document SHA-256 value
- Guest PII

### FOSS integration scope

The codebase retains the existing FOSS session gateway abstraction for future
integration.

Real FOSS session activation is not part of this transactional PostgreSQL
check-in workflow.

FOSS activation remains a separate cross-service integration concern rather
than a direct write from the Front Desk service to FOSS-owned persistence.

### Current authentication limitation

Final centralized JWT/RBAC integration is outside this check-in implementation.

Therefore, the current `verifiedBy` staff UUID is a temporary development
contract.

It must not be treated as the final authentication or authorization mechanism.

## Integration tests

```bash
npm run test:integration
```

The integration suite requires a disposable PostgreSQL database prepared with
the test schema and deterministic seed data.

The GitHub Actions backend pipeline provides this disposable PostgreSQL
environment automatically.

Do not run integration tests against a shared or production database.

The transactional check-in PostgreSQL integration tests cover:

- Confirmed booking check-in
- Physical-document verification
- Scanned-copy verification metadata
- Pre-assigned room handling
- Booking transition to `CHECKED_IN`
- Room transition to `OCCUPIED`
- Audit-log persistence
- Invalid booking state rejection
- Occupied-room rejection
- Room-type mismatch rejection
- Overlapping active-booking rejection
- Non-receptionist staff rejection
- Inactive receptionist rejection
- Transaction rollback when audit persistence fails

The rollback integration test verifies that a failed transaction does not leave:

- A partially created identity-verification record
- A changed booking state
- An occupied room
- A partial check-in audit entry

## Deployment

When you're ready to deploy your NestJS application to production, there are
some key steps you can take to ensure it runs as efficiently as possible.
Check out the
[deployment documentation](https://docs.nestjs.com/deployment)
for more information.

If you are looking for a cloud-based platform to deploy your NestJS application,
check out [Mau](https://mau.nestjs.com), our official platform for deploying
NestJS applications on AWS.

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

## Observability

In production applications, observability is essential for understanding how
your system behaves, detecting issues early, and maintaining reliable
performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your
application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how
  they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow
  operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and
  quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand
  system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to
  make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes
  with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your
  application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance
  degradation, SLA violations, and other anomalies so your team can react
  quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about
  the framework.
- For questions and support, please visit the
  [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out the official video
  [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with
  [NestJS Mau](https://mau.nestjs.com).
- Auto-instrument your application with
  [NestJS Observer](https://observer.nestjs.com).
- Visualize your application graph using
  [NestJS Devtools](https://devtools.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors
and support by the amazing backers. If you'd like to join them, please
[read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kamilmysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).