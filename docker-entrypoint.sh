#!/bin/sh
# Container entrypoint: apply pending database migrations, then exec the
# command (default CMD: node server.js). A failed migration stops the start,
# so the old container keeps serving until the problem is fixed.
set -eu

echo "[entrypoint] applying database migrations"
node scripts/dist/migrate.mjs

echo "[entrypoint] starting: $*"
exec "$@"
