#!/bin/sh
# Container entrypoint (PID 1 is tini, which forwards SIGTERM): apply pending
# database migrations, import local data once if asked, seed the site content
# if the database is empty, save R2 settings from SP_R2_* once, then exec the
# command (default CMD: node server.js).
# A failed migration or seed exits non-zero: the container stops and Docker's
# restart policy starts it again — a crash loop until the cause is fixed. The
# previous container is already gone by then, so read `docker logs` right
# after a deploy (docs/runbook.md "Deploy").
set -eu

echo "[entrypoint] applying database migrations"
node scripts/dist/migrate.mjs

# One-shot import of a `pnpm data:export-to-r2` dump (docs/runbook.md
# "Import local data into production"): only when SP_IMPORT_KEY is set and
# this database does not hold that import yet. Exits non-zero only if the
# data was restored but a later step failed; otherwise it logs and the start
# continues. Migrations run again: the dump may predate this release.
if [ -n "${SP_IMPORT_KEY:-}" ]; then
  echo "[entrypoint] importing data if SP_IMPORT_KEY is new"
  node scripts/dist/data-import.mjs
  node scripts/dist/migrate.mjs
fi

# First deploy only: a database with no pages gets the seeded content (spec
# §1.2 #6: 3 env vars + deploy + admin:create). Any existing page means the
# site has content and nothing is written; the line it logs says which.
echo "[entrypoint] seeding content if the database is empty"
node scripts/dist/seed.mjs --if-empty

# Settings ▸ Integrations ▸ R2 from SP_R2_* when not saved yet (never
# overwrites; never fails the start).
node scripts/dist/r2-bootstrap.mjs

# The input-only variables are for the scripts above: the app never sees them.
unset SP_R2_ACCOUNT_ID SP_R2_ACCESS_KEY_ID SP_R2_SECRET_ACCESS_KEY SP_R2_BUCKET \
  SP_R2_PREFIX SP_IMPORT_KEY SP_IMPORT_SOURCE_SECRET

echo "[entrypoint] starting: $*"
exec "$@"
