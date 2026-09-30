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


### Fixed

- Stabilized Front Desk frontend and backend CI pipelines.
- Fixed backend Jest E2E ESM configuration.
- Replaced CI dependency installation with `npm ci`.
- Resolved backend dependency vulnerabilities and verified 0 audit vulnerabilities.