# Changelog

All notable changes to the Front Desk System will be documented in this file.

## [Unreleased]

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

### Fixed

- Stabilized Front Desk frontend and backend CI pipelines.
- Fixed backend Jest E2E ESM configuration.
- Replaced CI dependency installation with `npm ci`.
- Resolved backend dependency vulnerabilities and verified 0 audit vulnerabilities.
