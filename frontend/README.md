# Forever Hotel — Front Desk Frontend

Next.js client for receptionist-facing workflows. The REST API is served by the
shared API Gateway at `/fds`, while Socket.IO currently connects directly to
FDS because the gateway does not proxy WebSocket upgrades.

## Plan 20 local configuration

For local Next.js dev with Gateway on `127.0.0.1:8080` and FDS backend on
`127.0.0.1:4200`, create `frontend/.env.local` (do not commit it):

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/fds
NEXT_PUBLIC_WS_URL=http://127.0.0.1:4200
NEXT_PUBLIC_FDS_CENTRAL_AUTH_ENABLED=false
```

From `frontend/` run `npm ci`, `npm run dev`, `npm run format:check`,
`npm run lint`, `npm run test:cov`, `npm run build` and
`npm audit --omit=dev --audit-level=high` as needed.

**Authentication status:** the frontend session adapter currently expects a
future same-origin `GET /api/fds-auth/session` BFF. That endpoint is not yet
implemented. The gate flag must stay **false** until the identity service,
BFF, secure cookies and REST/Socket.IO forwarding are actually tested.
Demo mode does not imply authenticated identity.

For Docker builds, see the repository-root `compose.fds.yaml` and
`docs/plan20-deployment-runbook.md`. Do not use localhost build arguments for
public deployments: browser-reachable gateway, backend, auth and WebSocket
origins must be configured specifically for staging/production.

## Legacy create-next-app notes

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
