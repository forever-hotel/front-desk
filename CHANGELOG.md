# Changelog

All notable changes to the Front Desk System will be documented in this file.

## [Unreleased]

### Plan 20 — verified local closeout (2026-10-25)

- Hardened backend dependency versions and frontend Zod advisory; retained CI security audit gates.
- Added Dockerfile/Compose workflows and CI image builds, including non-root container smoke verification.
- Routed Front Desk REST calls through the shared API Gateway `/fds` prefix.
- Added proposed Central Auth RS256/JWKS verification and a configurable provider selection without fallback to legacy tokens.
- Added the frontend session contract, protected UI gate and staff identity display foundation (the real session BFF remains unimplemented).
- Fixed the React session provider effect lint error and restored successful Frontend CI.
- Captured five read-only local smoke checks (frontend 200, backend readiness 200, Gateway readiness 200, no-token rooms 401, RabbitMQ ping).
- Added Plan 20 deployment guidance, review handoff and critical workflow/staging test register.
- **Outstanding, not yet accepted:** public HTTPS staging, live centralized login/logout, authenticated realtime, FDS RabbitMQ publish/consume, full live FOSS/WKMS flows and staging smoke evidence. This is not a production-ready release statement.

### Added

- Initial NestJS backend application scaffold for the Front Desk System.
- Initial Jest unit test configuration for the NestJS backend.
- Backend development, testing, linting, and build instructions.
- Added a `GET /health` endpoint for Front Desk backend application health checks.
- Added provisional Front Desk booking-search backend functionality using an in-memory repository.
- Added provisional Front Desk guest check-in business logic and validations.
- Added mock FOSS session activation for the Check-In workflow.
- Added automated backend Jest coverage reporting.
- Added an 80% global coverage quality gate for statements, branches, functions, and lines.
- Added backend CI coverage artifact upload for development evidence.
- Added unit tests for Front Desk booking and check-in controllers and missing validation paths.
- Aligned the Front Desk backend folder structure with the agreed team-wide domain structure.
- Renamed the existing backend feature folders from `bookings/` to `reservations/` and from `check-in/` to `check-ins/` without changing API behaviour.
- Added structural placeholders for `config`, `database`, `common`, `check-outs`, `guests`, `rooms`, `billing`, `messaging`, and `realtime`.
- Updated the root README to match the actual repository and backend structure.
- Added NestJS environment configuration and validation for Front Desk database settings.
- Added TypeORM PostgreSQL database connection support using `DATABASE_URL` or individual `DB_*` environment variables.
- Added secure local/development and hosted/staging database configuration separation.
- Added `GET /health/ready` database readiness endpoint using a lightweight PostgreSQL connectivity check.
- Added unit and E2E tests for environment validation and database readiness success/failure behaviour.
- Added `backend/.env.example` with safe database configuration placeholders.
- Added FD-15 `GET /folios/:bookingReference` running-folio API for active checked-in stays.
- Added deterministic folio grouping for room charges, food and beverage, and services with server-calculated category subtotals and grand total.
- Added integer `LKR` monetary handling and validation for persisted and external folio charges.
- Added `ExternalFolioChargeGateway` as the cross-subsystem charge integration boundary without creating a `folios` table.
- Added unit, PostgreSQL integration, E2E, and OpenAPI documentation coverage for the running-folio feature.
- Added Plan 12 / FD-09 and FD-10 transactional checkout core through `POST /check-outs`.
- Added authoritative outstanding-balance calculation from the current running folio minus persisted `COMPLETED` payments.
- Added `CASH` and `CARD_ON_SITE` final-payment contracts without accepting a client-supplied payment amount.
- Added `CheckoutPaymentGateway` with a deterministic mock adapter for the core checkout boundary.
- Added atomic checkout persistence covering final completed payment, `CHECKED_OUT` booking state, `REQUIRES_CLEANING` room state, and `CHECK_OUT` audit logging.
- Added PostgreSQL booking/room row locking and completed-payment revalidation before checkout commit.
- Added fully-paid checkout support without inserting a zero-value payment record.
- Added final-payment failure protection so failed payment does not mutate booking, room, audit, or FOSS state.
- Extended the FOSS session contract with post-commit guest-session deactivation.
- Added explicit post-commit FOSS deactivation failure reporting without reversing a completed hotel checkout.
- Added Plan 12 unit tests, PostgreSQL integration coverage, E2E coverage, and OpenAPI documentation.
- Updated the root README with the transactional checkout flow, safety boundaries, testing evidence, and current scope.

### Fixed

- Stabilized Front Desk frontend and backend CI pipelines.
- Fixed backend Jest E2E ESM configuration.
- Replaced CI dependency installation with `npm ci`.
- Resolved backend dependency vulnerabilities and verified 0 audit vulnerabilities.
