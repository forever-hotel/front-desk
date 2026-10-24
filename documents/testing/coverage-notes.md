# FDS Test Coverage - Source Notes

DDP-183 / Issue #84. Historical CI snapshot dated 2026-10-24 UTC; tested `develop` commit `503465b7eb2c29b56cc2ec0d329d91d6b40853d4`. Do not describe these metrics as rerun on `feature/84-fds-final-qa-evidence`.

| CI scope | Suites | Passed | Failed | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|---:|---:|---:|
| Backend Jest unit | 63 | 479 | 0 | 96.89% | 87.19% | 96.71% | 96.66% |
| Backend PostgreSQL integration | 9 | 53 | 0 | N/A | N/A | N/A | N/A |
| Backend E2E | 10 | 140 | 0 | N/A | N/A | N/A | N/A |
| Frontend Jest | 40 | 186 | 0 | 89.77% | 80.91% | 92.36% | 89.67% |

- Backend CI: https://github.com/forever-hotel/front-desk/actions/runs/40057114169
- Frontend CI: https://github.com/forever-hotel/front-desk/actions/runs/40057114175
- Backend artifact: `front-desk-backend-coverage-116`; expires 2026-11-07 UTC.
- Frontend artifact: `frontend-coverage`; expires 2026-11-07 UTC.
- Jest config: `backend/jest.config.ts`, `frontend/jest.config.ts`. Coverage is only for configured instrumented source scope; new-code/diff coverage is not separately verified.
- The final `forever-hotel/documents` repository will consolidate all six subsystems, not copy this FDS PDF as the global result.
