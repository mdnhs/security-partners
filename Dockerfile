# syntax=docker/dockerfile:1

# Production image for security.raynx.ie, built from Next.js standalone output.
# Build:  docker build -t security-partners-web .
# Run:    docker run -p 3000:3000 \
#           -e DATABASE_URL=postgres://… -e BETTER_AUTH_SECRET=… -e BETTER_AUTH_URL=https://… \
#           -v security-data:/data security-partners-web
# The image builds without any env vars or database; migrations run when the
# container starts (docker-entrypoint.sh).

# node:22.23.3-alpine, pinned by digest (multi-arch index) so rebuilds are
# reproducible; Dependabot (docker) or a manual bump updates both together.
ARG NODE_IMAGE=node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

# 1. Install dependencies from the lockfile only, so this layer is cached
#    until package.json / pnpm-lock.yaml change.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 2. Build the app. next/font downloads Google Fonts here, so the build
#    needs network access. Then bundle the operational scripts (migrate, …)
#    into self-contained files, because the runtime image has no tsx and only
#    the node_modules that Next traced for server.js.
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build && pnpm scripts:build

# 3. Minimal runtime: the standalone server, static assets, public/, the
#    bundled scripts and the SQL migrations they apply.
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# pg_dump/pg_restore 17 for the backup job and the restore drill; tini as
# PID 1 forwards SIGTERM to the migration and to server.js (ledger P01-6).
RUN apk add --no-cache postgresql17-client tini

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs \
    && mkdir -p /data/uploads /data/backups && chown -R nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/dist ./scripts/dist
COPY --from=builder --chown=nextjs:nodejs /app/server/db/migrations ./server/db/migrations
COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# /data (uploads and local backups until R2 is configured) is the named
# volume docker-compose.yml mounts. No VOLUME line: it would create an
# anonymous volume on every plain `docker run`.

# Liveness only: never touches the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
