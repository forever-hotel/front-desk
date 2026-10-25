# Plan 20 — Critical workflow and staging test register

**As of:** 2026-10-25. This register separates automated-test success from a
live, authenticated staging demonstration. It is not a claim that each row was
manually tested in staging.

| Test ID | Workflow | Automated evidence | Live staging | Evidence required for sign-off |
|---|---|---|---|---|
| FDS-20-01 | Reservation search, arrivals/departures | Backend/frontend CI PASS (suite) | PENDING | Redacted search result and HTTP 200 using valid staff session |
| FDS-20-02 | Walk-in booking with payment selection | Backend/frontend CI PASS (suite) | PENDING | Disposable booking ID, DB state, no guest PII |
| FDS-20-03 | Guest identity verification + check-in | Backend/frontend CI PASS (suite) | PENDING | Authorized flow, room booked/occupied, audit evidence |
| FDS-20-04 | Registration/receipt printing request | Automated contract coverage | PENDING | Mock vs physical printer clearly distinguished |
| FDS-20-05 | Room board and maintenance | Automated coverage; unauthenticated rooms 401 locally | PENDING | Role-authorized board and write/read transitions |
| FDS-20-06 | Room reassignment | Backend/frontend CI PASS (suite) | PENDING | Old room/new room state and audit trace |
| FDS-20-07 | Folio and calculation | Backend/frontend CI PASS (suite) | PENDING | Check deterministic category totals, external-source semantics |
| FDS-20-08 | Checkout and final payment | Backend/frontend CI PASS (suite) | PENDING | DB transaction, room cleaning status, post-commit FOSS state |
| FDS-20-09 | Escalation and Socket.IO reconnect | Automated coverage | PENDING | Authenticated socket, forced reconnect, event reconciliation |
| FDS-20-10 | Service requests/WKMS boundary | Automated contract coverage | PENDING | Cross-service confirmation, or mock explicitly identified |
| FDS-20-11 | Audit log, role restrictions and redaction | Backend automated RBAC tests | PENDING | Authorized/forbidden role cases, non-PII log samples |
| FDS-20-12 | Login/session/logout | Central Auth adapters tested, service not connected | BLOCKED | Auth-team API contract, BFF and live session lifecycle |
| FDS-20-13 | RabbitMQ publish/consume | Broker ping PASS locally only | BLOCKED | Enable FDS messaging; publish, consume, retry, DLQ |
| FDS-20-14 | Public HTTPS staging, Gateway, Neon | Local Gateway smoke PASS only | BLOCKED | TLS, DNS, secrets, routing, DB and auth evidence |

## Verified local smoke (automated script)

`evidence/plan20-local-smoke.json`, generated 2026-10-25, has 5/5 PASS:
Docker frontend `200`, backend readiness `200`, Gateway forwarded readiness
`200`, unauthenticated rooms `401`, and RabbitMQ broker ping success. These
**do not** prove logged-in functionality, messaging delivery or public staging.

## Staging execution template

For each staged test, add an execution record without personally identifying
guests: **Tester, timestamp, environment URL (no credentials), role, outcome,
redacted screenshot filename, correlation/request ID, issue reference**.
No row may be changed from `PENDING`/`BLOCKED` until that evidence exists.

Screenshots suggested (redact all guest details and private tokens): dashboard,
reservation search, walk-in, check-in, checkout, room status, room maintenance,
room change, folio, escalations, service request and audit log.

## CI and coverage evidence

[Backend CI](https://github.com/forever-hotel/front-desk/actions/runs/40065033714)
passes disposable Postgres integration tests, migration/seed, E2E, unit
coverage gate, lint, formatting, build and audit. [Frontend CI](https://github.com/forever-hotel/front-desk/actions/runs/40175759144)
passes formatting, lint, coverage gates, build and production dependency audit.
[Docker CI](https://github.com/forever-hotel/front-desk/actions/runs/40175759148)
passes image builds and frontend HTTP smoke. Download the corresponding
coverage artifacts if the university requires numeric metrics; do not infer
fresh percentage values from previous development plans.
