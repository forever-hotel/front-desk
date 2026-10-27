# FDS Test Coverage - Source Notes

DDP-183 / Issue #84. Updated from verified 27 October 2026 CI.

| CI scope | Suites | Passed | Failed | Statements | Branches | Functions | Lines | SHA |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Backend Jest unit | 67 | 513 | 0 | 96.19% | 87.15% | 96.85% | 96.23% | e590326 |
| Backend PostgreSQL integration | 9 | 53 | 0 | N/A | N/A | N/A | N/A | e590326 |
| Backend E2E | 10 | 140 | 0 | N/A | N/A | N/A | N/A | e590326 |
| Frontend Jest | 43 | 197 | 0 | 89.96% | 81.33% | 92.41% | 89.85% | 1065617 |

- Backend CI: https://github.com/forever-hotel/front-desk/actions/runs/40530366600
- Frontend CI: https://github.com/forever-hotel/front-desk/actions/runs/40534533200
- Docker CI: https://github.com/forever-hotel/front-desk/actions/runs/40534533251
- Backend coverage artifact: `front-desk-backend-coverage-129` (GitHub artifact from backend run).
- Frontend artifact: `frontend-coverage` (GitHub artifact from frontend run).
- Jest-configured thresholds of 80% passed. This is not evidence of calculated diff coverage.
- Local Plan 02 35 PASS; Plan 03 baseline 14 PASS 5 BLOCKED; Phase B 3 PASS; Phase C 5 PASS; Phase D 8 PASS; W04-B 6 PASS/2 BLOCKED; local performance 15 PASS / 1,800 requests. Context and limitations in each named evidence file.
- The latest evidence commit `a6050dd` is not separately described as having rerun all CI.
