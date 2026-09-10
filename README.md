# Forever Hotel - Front Desk System

This repository contains the Front Desk System for the Forever Hotel Management System.

The Front Desk System is used by receptionists to manage:

- Daily arrivals and departures
- Guest check-in
- Guest check-out
- Walk-in bookings
- Room status management
- Room changes
- Maintenance blocking
- Service requests
- Escalated worker tasks
- Guest folio
- Audit logs

## Folder Structure

front-desk/
├── frontend/
├── backend/
├── docs/
├── README.md
├── .gitignore
└── .env.example

## Development Branches

- main: production-ready branch
- develop: development/integration branch
- feature branches: used for each GitHub issue

## Front Desk Backend

The Front Desk System backend is implemented using NestJS and TypeScript.

### Prerequisites

- Node.js 24 LTS
- npm 11 or later

### Install Dependencies

```bash
cd backend
npm install