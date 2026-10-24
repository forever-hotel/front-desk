# Front Desk (FDS) - Final QA Evidence

Issue: [DDP-183 / #84](https://github.com/forever-hotel/front-desk/issues/84)

This folder contains **FDS subsystem-only** evidence. The independent `forever-hotel/documents` repository will hold final consolidated six-subsystem artifacts.

## University deliverables (FDS contribution)

| File | Current verification status |
|---|---|
| `testing/coverage-sprint8.pdf` | Historical CI verified, final branch rerun needed |
| `testing/test-register.pdf` | Source-traced selected cases; live cross-service acceptance pending |
| `security/owasp-checklist.pdf` | Partial control evidence; high-severity development dependency finding identified |
| `testing/performance-report.pdf` | **Not Tested** - planned scenarios; no load measurements |

Supporting editable material: `testing/test-register-source.csv`, `testing/coverage-notes.md`, and `security/owasp-notes.md`.  Do not claim the report set is final or fully compliant until open gaps are closed.

## Evidence snapshot

- CI date: 2026-10-24 UTC
- Tested SHA: `503465b7eb2c29b56cc2ec0d329d91d6b40853d4`
- Backend CI: https://github.com/forever-hotel/front-desk/actions/runs/40057114169
- Frontend CI: https://github.com/forever-hotel/front-desk/actions/runs/40057114175
- FDS evidence branch: `feature/84-fds-final-qa-evidence`. Current CI measurements are from `develop`, not that evidence branch.

## Finalization checklist

- [ ] Re-run CI on final reviewed SHA and update all reports.
- [ ] Download/archive expiring coverage artifacts.
- [ ] Map **every** API endpoint to at least one integration test and measure new-code coverage.
- [ ] Capture signed/actual acceptance results for live FOSS, WKMS, payment and printing.
- [ ] Remediate or document the high-severity full dependency audit finding.
- [ ] Run safe load and realtime performance tests in isolated staging.
- [ ] Review reports, open a PR against `develop`, link `Closes #84`, and obtain peer approval.
