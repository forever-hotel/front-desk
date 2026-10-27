# DDP-183 — FDS Local API Performance Verification

**Date:** 2026-10-27T17:01:24.265Z
**Git commit:** `106561705fe5d7a66e06fe1a7dd14f255b4ba744`
**Environment:** disposable localhost PostgreSQL 16 (front_desk_test), NestJS, Node v24.21.0, win32 10.0.19045.
**Sample:** 120 measured calls + 12 warmup calls for each of five GET endpoints at concurrency 1, 5 and 10.
Authentication: synthetic receptionist JWT signed with a test-only key; no central authentication service.
RabbitMQ/WKMS disabled; actual production services, secrets and Neon were not used.

## Measured results

| Case | Concurrency | p50 ms | p95 ms | RPS | Error rate | Request result |
|---|---:|---:|---:|---:|---:|---|
| PERF-01-C1 | 1 | 3.89 | 10.3 | 177.09 | 0% | PASS |
| PERF-01-C5 | 5 | 8.29 | 32.93 | 393.07 | 0% | PASS |
| PERF-01-C10 | 10 | 20.8 | 41.77 | 347.52 | 0% | PASS |
| PERF-02-C1 | 1 | 5.64 | 14.38 | 129.74 | 0% | PASS |
| PERF-02-C5 | 5 | 10.19 | 30.21 | 384.83 | 0% | PASS |
| PERF-02-C10 | 10 | 21.44 | 44.89 | 418.67 | 0% | PASS |
| PERF-03-C1 | 1 | 4.17 | 8.77 | 180.79 | 0% | PASS |
| PERF-03-C5 | 5 | 9.71 | 16.76 | 478.06 | 0% | PASS |
| PERF-03-C10 | 10 | 64.92 | 153.23 | 136.87 | 0% | PASS |
| PERF-04-C1 | 1 | 4.93 | 13.9 | 148.36 | 0% | PASS |
| PERF-04-C5 | 5 | 9.35 | 23.73 | 444.58 | 0% | PASS |
| PERF-04-C10 | 10 | 18.95 | 58.15 | 426.1 | 0% | PASS |
| PERF-05-C1 | 1 | 1.67 | 4.87 | 466.3 | 0% | PASS |
| PERF-05-C5 | 5 | 4.39 | 8.3 | 1016.85 | 0% | PASS |
| PERF-05-C10 | 10 | 12.28 | 23.54 | 679.97 | 0% | PASS |

**Requests with errors:** 0 / 1800.
**Execution status:** ALL MEASURED REQUESTS SUCCEEDED.
This status is *not* an NFR/SLA PASS assertion; compare measurements against the approved SRS thresholds separately.

## Limitations
- Small deterministic test fixture; not representative of production database volume
- No TLS, reverse proxy, Gateway, shared Neon, RabbitMQ, WKMS, FOSS or public staging
- Read-only GET endpoints only; no check-in, checkout or write-operation load tests
- Measured on local operator hardware; numbers cannot be generalized to hosting infrastructure
- NFR pass/fail against a numeric SRS target requires verified, agreed SRS threshold

Raw values: `performance-results.json`; structured case register: `performance-execution-register.csv`.
