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
<a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
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

## Integration tests

```bash
npm run test:integration
```

The integration suite requires a disposable PostgreSQL database prepared with
the test schema and deterministic seed data.

The GitHub Actions backend pipeline provides this disposable PostgreSQL
environment automatically.

Do not run integration tests against a shared or production database.

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
NestJS application, giving you deep visibility into your system with minimal
setup:

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

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
