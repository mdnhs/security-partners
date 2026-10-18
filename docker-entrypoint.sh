#!/bin/sh
# Container entrypoint (PID 1 is tini, which forwards SIGTERM): apply pending
# database migrations, then exec the command (default CMD: node server.js).
# A failed migration exits non-zero: the container stops and Docker's restart
# policy starts it again — a crash loop until the cause is fixed. The previous
# container is already gone by then, so read `docker logs` right after a
# deploy (docs/runbook.md "Deploy").
set -eu

echo "[entrypoint] applying database migrations"
node scripts/dist/migrate.mjs

echo "[entrypoint] starting: $*"
exec "$@"
