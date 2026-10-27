# Plan 20 — Review handoff and unresolved dependencies

**Prepared:** 2026-10-25. **Completion status:** partial; local implementation
and verification are ready for peer review. This document does **not** declare
all AC1–AC11 in Issue #70 satisfied.

## Changes available for review

- Front Desk local Docker / Gateway integration and both image builds.
- Backend/frontend dependency vulnerability patches and green relevant CI.
- Central Auth **proposed** RS256/JWKS verifier, selectable by configuration,
  and frontend session UI foundation. No production login or BFF implemented.
- Five read-only local smoke checks recorded under `evidence/`.
- Deployment runbook, test register, security constraints, known limitations.

## Evidence URLs

- [Backend CI 40065033714](https://github.com/forever-hotel/front-desk/actions/runs/40065033714) — unit/coverage, disposable DB integration and E2E, build, audit.
- [Frontend CI 40175759144](https://github.com/forever-hotel/front-desk/actions/runs/40175759144) — lint, format, tests/coverage, build, production audit.
- [Docker CI 40175759148](https://github.com/forever-hotel/front-desk/actions/runs/40175759148) — container builds and smoke.
- [Smoke JSON](../evidence/plan20-local-smoke.json) — local frontend/backend/Gateway security and broker ping.

## Sign-off blockers with responsible owners

| Owner | Required delivery | Validation to attach |
|---|---|---|
| Central Auth team | Approved issuer, audience, JWKS, login callback/logout protocol, claims and rotation/revocation contract | Actual RS256 credentials and real session BFF tests |
| Front Desk team | BFF implementation, protected REST forwarding, Socket.IO auth/session recovery | Authorized HTTP, cross-origin security, role denial, revoke/reconnect |
| Gateway/infrastructure team | Public HTTPS staging, real frontend/Gateway/Socket.IO DNS and TLS, CORS | Browser HTTPS/WSS and external host smoke |
| FDS + messaging owner | Broker connection and FDS event publish/consume, retry/DLQ | Actual RabbitMQ delivery evidence; compose currently disables FDS messaging |
| FOSS/WKMS/integration owners | Live cross-subsystem workflows as documented contracts permit | Authenticated multi-service staging outcomes, or explicit mocks |
| FDS reviewer | Peer approval, CI and coverage artifacts, security review, deployment and smoke evidence | Final reviewed PR and approval link |

## Pull request policy

Open an incremental PR from `feature/70-fds-auth-integration` into `develop`
only after all changed-file tests pass. Its title/body must say **integration
foundation and local verification**, **not full production deployment**. Do not
use `Closes #70` as the issue is already closed despite open acceptance checks;
use `Refs #70`. Require reviewer approval. New pushes to feature branch should
trigger applicable CI; documentation-only commits may not create new jobs due
to `paths` filters. Review latest successful relevant code-commit runs.

If a reviewed PR is merged while the external blockers remain, retain this
handoff and track those blockers in follow-up issues. **Do not mark Plan 20
fully complete or advertise public staging until AC6/AC7/AC11 are proven.**
