# FDS Plan 02 — Local Core Lifecycle Verification

Executed: 2026-10-27T06:30:21.032Z
Environment: isolated disposable Docker PostgreSQL 16 / front_desk_test / 127.0.0.1:55433; FDS backend 127.0.0.1:4301.
No Neon credentials used; RabbitMQ and WKMS disabled.
These are local real database/API tests, not proof of live FOSS/payment/printing/integration.

**Result: 35 passed, 0 failed.**

- **PASS** FDS-00: Backend readiness — ready/up
- **PASS** FDS-02a: Missing JWT rejected
- **PASS** FDS-22a: Manager GET permitted
- **PASS** FDS-22b: Manager write forbidden
- **PASS** FDS-22c: Invalid JWT rejected
- **PASS** FDS-02b: Search persisted synthetic guest — 6 results
- **PASS** FDS-02c: Search nonexistent booking
- **PASS** FDS-03a: Recent bookings response — 5 recent
- **PASS** FDS-03b: Today arrivals includes DDP-195
- **PASS** FDS-03c: Today departures includes DDP-195
- **PASS** FDS-08: Room board reflects database
- **PASS** FDS-06a: Scanned copy without storage key rejected
- **PASS** FDS-09a: Clear maintenance with audit
- **PASS** FDS-09b: Block maintenance with audit
- **PASS** FDS-09c: Occupied room cannot enter maintenance
- **PASS** FDS-10a: Available room lookup for checked-in booking
- **PASS** FDS-11a: Room change to maintenance room rejected
- **PASS** FDS-10b: Transactional room reassignment — old room cleaning, new room occupied
- **PASS** FDS-12: Folio totals are integer LKR — LKR 30000; mocked external charges
- **PASS** FDS-13a: Checkout due rejects missing payment method
- **PASS** FDS-13b: Checkout persists payment and cleaning state — Balance settled LKR 15000
- **PASS** FDS-15: Duplicate checkout rejected without new payment
- **PASS** FDS-05: Physical ID check-in transaction
- **PASS** FDS-05b: Duplicate check-in rejected
- **PASS** FDS-07: Print registration card contract is mock — mock only — physical printer not verified
- **PASS** FDS-16: Service request blocked while WKMS disabled — External WKMS intentionally disabled
- **PASS** FDS-17: Worker list blocked while WKMS disabled — External WKMS intentionally disabled
- **PASS** FDS-04a: Invalid walk-in dates rejected
- **PASS** FDS-04b: Walk-in CASH persists booking and completed payment — Synthetic booking 01c92ac3-5698-4589-a535-fb254a847b91
- **PASS** FDS-06b: Scanned ID check-in with storage metadata — Metadata only; no real document uploaded
- **PASS** FDS-14: Fully-paid checkout produces no new payment — No zero-value payment persisted
- **PASS** FDS-22d: Mismatched actor is forbidden
- **PASS** FDS-17b: Manual task assignment blocked with WKMS disabled — External WKMS intentionally disabled
- **PASS** FDS-18a: Authenticated audit listing available
- **PASS** FDS-18: Audit action references persist — CHECK_IN/ROOM_CHANGE/CHECK_OUT audit entries present

## Manual and deferred checks
- Actual Front Desk browser UI, gateway/BFF, loading/error/keyboard/mobile checks: NOT RUN by this script.
- Live payment gateway failure, physical printing, external FOSS/WKMS: BLOCKED/CONTRACT-ONLY; mocks are not integrations.
- Concurrency and alternate payment scenario: supported by existing automated suites; require additional manual execution evidence if claimed.
- Neon test branch missing migration records is a separately tracked DDP-195 finding.
- Complete SRS FD-01–FD-19 traceability by reviewing the approved SRS; not asserted here.
