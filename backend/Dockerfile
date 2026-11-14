# syntax=docker/dockerfile:1
# Stage 1: Build the NestJS application
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

# Install build dependencies without running npm lifecycle scripts
RUN --mount=type=cache,id=fds-backend-npm,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts --no-audit --no-fund --prefer-offline

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build


# Stage 2: Production runtime
FROM node:24-bookworm-slim AS production

ENV NODE_ENV=production \
    PORT=4001

WORKDIR /app

COPY package.json package-lock.json ./

# Production dependencies only
RUN --mount=type=cache,id=fds-backend-npm,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund --prefer-offline

COPY --from=build /app/dist ./dist

# Run without root privileges
USER node

EXPOSE 4001

# Liveness check. Database readiness is checked separately at /health/ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4001) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
