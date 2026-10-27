# FDS Performance Evidence Source

DDP-183 / Issue #84, executed 27 October 2026; evidence commit a6050dd.

- Fresh disposable PostgreSQL 16, local NestJS FDS backend, JWT test-only receptionist.
- 5 GET endpoints x 3 concurrency levels (1, 5, 10).
- 120 measured + 12 warmup per case; measured total 1,800 requests.
- 15 of 15 cases PASS; 0 errors; highest observed p95 153.23 ms; max per-case throughput 1,016.85 RPS.
- No public staging, shared Neon, API Gateway, external FOSS/WKMS, payment, printing or checkout write-load.
- This is not proof of compliance with an as-yet-unverified numeric NFR target.

Raw artifacts committed in `evidence/fds-final-qa/performance/`:

- `performance-results.json`
- `performance-execution-register.csv`
- `verification.md`

Runner: `scripts/verification/fds-final-qa/run-fds-performance.cjs`.
