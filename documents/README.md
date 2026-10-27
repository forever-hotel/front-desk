# Front Desk (FDS) - Final QA Evidence

DDP-183 / [Issue #84](https://github.com/forever-hotel/front-desk/issues/84)

These reports cover the **Front Desk subsystem**, not the consolidated six-subsystem evaluation. Latest QA evidence was checked on 27 October 2026. The baseline unit, integration and E2E CI runs predate the evidence-only commit `a6050dd`; exact commits are stated per run.

## Included reports

- `testing/coverage-sprint8.pdf`: CI counts and unit coverage, plus local verification summary.
- `testing/test-register.pdf`: 43 original cases retained by ID with updated standalone local-execution addendum.
- `security/owasp-checklist.pdf`: A01-A10 evidence and status, including corrected `undici` finding on QA branch.
- `testing/performance-report.pdf`: actual local, read-only 1,800-request benchmark on 27 October 2026.

Original detailed test-case fields remain in `testing/test-register-source.csv` and must not be deleted/overwritten by this patch. Phase verification markdown and performance raw evidence remain under `evidence/`.

## Verified CI

- Backend (e590326): https://github.com/forever-hotel/front-desk/actions/runs/40530366600
- Frontend (1065617): https://github.com/forever-hotel/front-desk/actions/runs/40534533200
- Docker (1065617): https://github.com/forever-hotel/front-desk/actions/runs/40534533251

## Open sign-off boundaries

- Central Auth end-to-end session/login and public HTTPS staging acceptance require real evidence.
- FOSS activation, real payment settlement and physical printing remain unverified.
- WKMS assignment was locally demonstrated for an existing task; service-task creation and worker availability remain blocked.
- No staging/production load test or contract-specific NFR compliance conclusion is claimed.
- Recheck Dependabot default-branch issue after merging the `undici` fix.

A reviewed pull request to `develop` and explicit outstanding integration handoff are still required.
