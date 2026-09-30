# Forever Hotel - Front Desk System

This repository contains the Front Desk System (FDS) for the Forever Hotel
Management System.

The Front Desk System is used by receptionists to support:

- daily arrivals and departures;
- booking search;
- guest check-in and check-out;
- walk-in bookings;
- room assignment and room-status management;
- room changes;
- maintenance blocking;
- guest folio viewing;
- service requests;
- escalated worker-task monitoring;
- audit logging.

## Repository Structure

```text
front-desk/
├── .github/
├── frontend/
├── backend/
├── README.md
├── CHANGELOG.md
└── .gitignore

## Backend Database Configuration

The Front Desk backend uses PostgreSQL through TypeORM.

Database configuration is supplied through environment variables. Real database
credentials must never be committed to Git.

### Local Development

Create `backend/.env` using the shared development configuration provided by the
team.

The local/team setup may use:

```env
DB_HOST=...
DB_PORT=5432
DB_USERNAME=...
DB_PASSWORD=...
DB_NAME=...
DB_SSL=...
DB_SYNCHRONIZE=false
DB_LOGGING=false