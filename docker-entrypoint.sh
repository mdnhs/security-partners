#!/bin/sh
# Container entrypoint (PID 1 is tini, which forwards SIGTERM): apply pending
# database migrations, seed the site content if the database is empty, then
# exec the command (default CMD: node server.js).
# A failed migration or seed exits non-zero: the container stops and Docker's
# restart policy starts it again — a crash loop until the cause is fixed. The
# previous container is already gone by then, so read `docker logs` right
# after a deploy (docs/runbook.md "Deploy").
set -eu

echo "[entrypoint] applying database migrations"
node scripts/dist/migrate.mjs

# First deploy only: a database with no pages gets the seeded content (spec
# §1.2 #6: 3 env vars + deploy + admin:create). Any existing page means the
# site has content and nothing is written; the line it logs says which.
echo "[entrypoint] seeding content if the database is empty"
node scripts/dist/seed.mjs --if-empty

echo "[entrypoint] starting: $*"
exec "$@"
