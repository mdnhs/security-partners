# Runbook

Security Partners site + admin on one Next.js app (standalone Docker image
`ghcr.io/mdnhs/security-partners`), Postgres 17 as the `db` service of the
same Dokploy compose app ("Postgres in the compose stack"), Traefik in front
(Dokploy). The app reads exactly three variables: `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (plus the platform's `NODE_ENV`,
`PORT`, `HOSTNAME`, set by the image). Everything else (SMTP, R2, Turnstile,
AI, tracking) is set in the admin and stored in the database, secrets
encrypted with keys derived from `BETTER_AUTH_SECRET`.

Some operator scripts accept a secret through an input-only variable so it
stays out of shell history: `DEMO_PASSWORD` (`demo:seed`),
`OLD_BETTER_AUTH_SECRET` (`secrets:rotate`), `SOURCE_DATABASE_URL` and
`SOURCE_BETTER_AUTH_SECRET` (`db:sync`). Only that script reads them; the app
never does. Never set them in the Dokploy environment.

The container start scripts read a second group of input-only variables,
which the deploy workflow does set in the Dokploy environment; the
entrypoint unsets them before `server.js` starts, so the app never sees
them: `SP_R2_ACCOUNT_ID`, `SP_R2_ACCESS_KEY_ID`, `SP_R2_SECRET_ACCESS_KEY`,
`SP_R2_BUCKET`, `SP_R2_PREFIX` (`r2-bootstrap`, "R2 folder and bootstrap")
and `SP_IMPORT_KEY`, `SP_IMPORT_SOURCE_SECRET` (`data-import`, "Import local
data into production"). `POSTGRES_PASSWORD` is read by the `db` service only.

Owner decisions and the go-live checklist are in `docs/launch.md`.

## Deploy

- Push to `main` → GitHub Actions `Build & Deploy to Dokploy`
  (`.github/workflows/deploy.yml`). Its first job `ci` runs the reusable
  `.github/workflows/ci.yml`: lint, `next typegen` + types, unit and DOM
  tests, `pnpm audit:deps`; integration tests (Postgres + Mailpit); build
  without env; E2E on the standalone server; and an image smoke test (builds
  the Docker image, then migrate → auto-seed of the empty database
  (`seed.mjs --if-empty`) → server → readiness → a second `--if-empty` run
  that must change nothing → `backup.mjs` → `restore-drill.mjs` inside it). Only when CI passes is the
  image pushed to GHCR (`:latest` and `:<commit sha>`), then `ensure-env`
  checks the Dokploy environment, then Dokploy is asked to redeploy the
  compose app (it re-pulls `:latest`: `pull_policy: always`). Every job in
  `deploy.yml` runs only on `refs/heads/main`; `ensure-env` and the Dokploy
  step use the GitHub environment `production` (add required reviewers
  there to make deploys wait for an approval).
- `ensure-env` (Dokploy API with `DOKPLOY_URL` / `DOKPLOY_API_KEY`:
  `compose.one`, `compose.update`, `compose.saveEnvironment`) turns the
  compose app's Dokploy auto-deploy off (only the workflow deploys, after
  CI), then **adds** each missing key: `POSTGRES_PASSWORD` (random hex),
  `DATABASE_URL` (built from that password, host `security-partners-db`),
  `BETTER_AUTH_SECRET` (`openssl rand -base64 48`), `BETTER_AUTH_URL`
  (`https://security.raynx.ie`), `SP_R2_ACCOUNT_ID`, `SP_R2_ACCESS_KEY_ID`,
  `SP_R2_SECRET_ACCESS_KEY`, `SP_R2_BUCKET` (from the repo secrets of the
  same names) and `SP_R2_PREFIX=sp`. A key that exists is never changed,
  whatever its value — change it in Dokploy yourself ("Rotate …"). The one
  exception: `SP_IMPORT_KEY` and `SP_IMPORT_SOURCE_SECRET` follow the repo
  secrets of the same names whenever those are set ("Import local data into
  production"). It saves, reads the environment back and fails (no deploy)
  unless every key it wrote is there and every other key is unchanged. Values
  are masked in the log; only key names are printed. The generated
  `BETTER_AUTH_SECRET` and database password live only in Dokploy: copy
  them into the password manager after the first deploy. `ci.yml` also runs on pull requests; a push to a branch other
  than `main` starts no workflow of its own. Visual pixel tests are not in CI (macOS only): run
  `pnpm test:visual` locally before merging a change that can touch the
  public pages.
- Manual run: Actions → Build & Deploy → Run workflow, on `main` (a
  dispatch on another branch deploys nothing). `skip_ci` deploys `main`
  without waiting for CI — emergency only (a hotfix while CI itself is
  broken); it exists only for `workflow_dispatch`, never for a push.
- The container's PID 1 is `tini`, which forwards `SIGTERM`. On start the
  container applies pending migrations (`docker-entrypoint.sh` →
  `node scripts/dist/migrate.mjs`), imports `SP_IMPORT_KEY` once when it is
  set (`data-import.mjs`, then migrate again), auto-seeds the content if the
  database is empty (`node scripts/dist/seed.mjs --if-empty`), saves R2 from
  `SP_R2_*` when no R2 settings exist (`r2-bootstrap.mjs`), unsets the
  input-only variables, then starts `node server.js`. The seed step writes only when the `pages` table has no
  rows at all (a fresh database); otherwise it logs
  `[db:seed] <n> page(s) already exist: auto-seed skipped, no data changed`
  and touches nothing, so deleted or unpublished content is never
  re-created. On a fresh database it logs
  `[db:seed] empty database (no pages): content seeded (…)`. A failed
  migration or seed makes the container exit; the compose restart policy
  (`unless-stopped`) restarts it, so it crash-loops until the cause is fixed
  (the previous container is already gone). Read `docker logs <container>`
  right after a deploy; the cause is printed as `[migrate] …` or
  `[db:seed] …`.
- Always run exactly one app container (`replicas: 1` in
  `docker-compose.yml`; never scale the service in Dokploy). The
  `'use cache'` store is in memory per process and `revalidateTag` (publish)
  and the scheduler's cache expiry only reach the process that runs them: a
  second replica would keep serving the old page after a publish, with no
  expiry (`cacheLife("max")`). A shared `cacheHandlers` store (Postgres or
  Redis) with tag fan-out is future work ("Known limitations").
- `docker stop` (and a redeploy) ends the container with exit code 143
  (128 + `SIGTERM`). That is expected, not a crash.
- The image runs as a non-root user and has no `VOLUME` line: `/data`
  (uploads, local backups) is the named volume `docker-compose.yml` mounts.
  A plain `docker run` without `-v <volume>:/data` keeps uploads only until
  the container is removed.
- Before a deploy that adds a migration, take a backup
  (`node scripts/dist/backup.mjs`, see "Running scripts in the container"):
  migrations only go forward.
- The MK parity release adds migrations `0010_theme` to
  `0019_ai_enquiry_details` (theme, AI settings, media alt, SEO robots,
  redirect admin fields, marketing/custom code, lead attribution,
  newsletter, builder pages, AI enquiry-details flag). Several carry data
  migrations (the legacy custom code becomes `necessary` all-routes
  snippets in `0015_marketing`). They must run before the new code serves
  a request: the entrypoint does that on every start. If you start
  `server.js` any other way (a custom command, a one-off container), run
  `node scripts/dist/migrate.mjs` first. The data steps are guarded and safe
  to re-run; a stored value always wins over the new default.
- Health: `GET /api/v1/health/live` (no DB; the Docker `HEALTHCHECK`) and
  `GET /api/v1/health` (readiness; 503 when the DB is unreachable).
- Port 3000 is only `expose`d to the Dokploy network, never published on the
  host. Keep it that way: requests must arrive through Traefik ("Client IPs
  and Traefik").

### Keeping the pipeline current

- GitHub Actions are pinned by commit SHA (with a `# vX.Y.Z` comment).
  Dependabot (`.github/dependabot.yml`) opens one grouped pull request a
  week for `github-actions` updates; merge it once CI is green.
- The Dockerfile's Node image (`ARG NODE_IMAGE=node:<version>-alpine@sha256:…`)
  is pinned by digest and Dependabot does **not** watch it. Bump it by hand
  (new version and digest from Docker Hub) for Node security releases, and
  keep the `node-version` in `ci.yml` the same.

## First production deploy

Automatic now (no Dokploy clicks): the database, the environment, R2 and
the deploy.

1. Repo secrets (GitHub → Settings → Secrets → Actions): `DOKPLOY_URL`,
   `DOKPLOY_API_KEY`, `SP_R2_ACCOUNT_ID`, `SP_R2_ACCESS_KEY_ID`,
   `SP_R2_SECRET_ACCESS_KEY`, `SP_R2_BUCKET`; optionally `SP_IMPORT_KEY` and
   `SP_IMPORT_SOURCE_SECRET` ("Import local data into production").
2. Push to `main` (or run the workflow). `ensure-env` writes the missing
   variables (see "Deploy"), Dokploy starts `db` (Postgres 17, new volume
   `security-pgdata`) and the app. The first start migrates, imports
   `SP_IMPORT_KEY` if set, otherwise seeds the empty database
   (`[db:seed] empty database (no pages): content seeded (…)`), and saves
   R2 from `SP_R2_*` with the folder `sp` (`[bootstrap] R2 settings saved
   from SP_R2_* …`). Check `/api/v1/health` and the home page.
3. Copy `BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD` from Dokploy (the app
   → Environment) into the password manager.
4. Never run `node scripts/dist/seed.mjs --allow-production` on a live
   production database: it is insert-only and re-creates rows an editor
   deleted. The entrypoint's `--if-empty` mode is the only seed production
   needs.
5. First owner — still a manual step, unless the import brought a local
   owner account (then sign in with it and change its password):
   `node scripts/dist/admin-create.mjs --email <owner email> --name "<name>"`
   prints a set-password link (single use, valid 7 days; also emailed once
   SMTP works). Sign in at `/admin` and turn on 2FA. `admin-create` does not
   check whether an owner already exists: every run creates another owner.
   Use it once; invite everyone else from Users.
6. Settings ▸ Integrations: SMTP, Turnstile (R2 is already saved; "Move
   uploads to R2" only if uploads were made before it); Settings ▸ Leads:
   recipients. Then work through `docs/launch.md`.
7. Demo accounts: production normally has none. The owner-approved local
   import copies them **with their known local passwords** ("Import local
   data into production"). Remove them before real use:
   `node scripts/dist/demo-remove.mjs` (refuses while no real active owner
   would remain, so create or keep a real owner first).

## Postgres in the compose stack

Ruling: production Postgres is the `db` service of the app's own compose
file (`postgres:17.11`, the patch release CI and local dev use), not a
separate Dokploy database service.

- Data: named volume `security-pgdata`. Dokploy keeps volumes across
  redeploys; deleting the compose app with "delete volumes" deletes the
  database. Backups ("Backups and the restore drill") go to R2.
- Network: `db` is only on the stack's own `default` network (never on
  `dokploy-network`, no published port). The app is on both: `default` for
  the database, `dokploy-network` for Traefik. The database host is the
  alias `security-partners-db`, not `db`: on `dokploy-network` other
  stacks' services named `db` would make a bare `db` ambiguous.
- `POSTGRES_PASSWORD` sets the `sp` role's password on the volume's first
  start only; changing it later does nothing by itself ("Rotate the
  database password").
- Superuser `sp` owns the database, so `restore-drill` and the import's
  scratch databases (`CREATE DATABASE`) work.
- `psql` from the app container:
  `psql "$DATABASE_URL"`; or `docker exec -it <db container> psql -U sp -d sp`.

## R2 folder and bootstrap

- Settings ▸ Integrations ▸ R2 has an optional **Folder** (`keyPrefix`):
  lowercase `a-z 0-9 - _` segments joined by single `/`, no `/` at either
  end, at most 64 characters; empty = the bucket root (settings saved
  before it existed behave as before). The R2 driver then writes, reads,
  streams and deletes `<folder>/<key>`, and backups live under
  `<folder>/backups/`. Media rows and URLs keep the bare key
  (`/api/v1/media/file/<key>`), so the folder is a property of the
  storage, not of the data. Changing the folder does not move stored files;
  it is refused (409) while any upload is stored in R2, like a new bucket.
  Once a folder is saved it cannot be cleared back to the bucket root
  (422): the bucket may be shared.
- Production shares the sister site's bucket under the folder `sp`.
  Nothing of this site is written outside `sp/`.
- `r2-bootstrap` (every container start, after migrate and seed): when
  `SP_R2_ACCOUNT_ID`, `SP_R2_ACCESS_KEY_ID`, `SP_R2_SECRET_ACCESS_KEY` and
  `SP_R2_BUCKET` are set (jurisdiction `default`; folder `SP_R2_PREFIX`,
  `sp` when empty) **and** no R2 settings are saved, it saves them through
  the admin's own validation and encryption (audit `integration.created`,
  no actor, `via: r2-bootstrap`). It never overwrites saved settings: to
  change bucket, keys or folder later, use the admin form. It never logs a
  value; on any problem it logs `[bootstrap] R2 settings not saved: …`
  (names of missing/invalid variables) and the start continues (exit 0).
- Locally: `SP_R2_…=… pnpm r2:bootstrap`.

## Import local data into production

Owner-approved one-shot copy of the local development database (content,
settings, leads, users **including demo users** and their passwords) and
its uploads into production. Production's database is reachable only
inside the compose network, so the import is pulled by the container from
R2.

1. On the developer machine, from the main checkout (it has
   `.env.development` and `.data/uploads`), with the dev database running
   (`pnpm db:up`):
   `SP_R2_ACCOUNT_ID=… SP_R2_ACCESS_KEY_ID=… SP_R2_SECRET_ACCESS_KEY=… SP_R2_BUCKET=… pnpm data:export-to-r2`
   (`--dry-run` first: dumps to a temp file and lists what would be
   uploaded, writes nothing). It checks that the local `BETTER_AUTH_SECRET`
   decrypts the local secrets, dumps with `pg_dump` 17 (the dev Postgres
   container's when the local one is newer — a `pg_dump` 18 archive cannot
   be read by the image's `pg_restore` 17), uploads every upload file to
   `sp/<key>` (what the R2 driver reads) and the dump to
   `sp/bootstrap/<UTC stamp>.dump`, and prints `SP_IMPORT_KEY=<that key>`.
2. Set the repo secrets: `SP_IMPORT_KEY` = the printed key,
   `SP_IMPORT_SOURCE_SECRET` = the local `BETTER_AUTH_SECRET`
   (`.env.development`).
3. Run the deploy workflow. `ensure-env` copies both into Dokploy (these two
   follow their secrets), the container starts and `data-import`:
   - does nothing if this database already holds that key (settings row
     `ops.data-import`) — so later restarts and deploys never re-import;
   - downloads the dump, checks the source secret in a scratch database
     `sp_import_check`, backs up the current database to `/data/backups`,
     restores the dump in one transaction (`db:sync --from-dump`), removes
     the local R2/SMTP settings, re-encrypts the remaining secrets for
     production's key, clears 2FA and sessions, keeps every user as it was
     (demo users included, local passwords unchanged);
   - turns disk media rows whose files are in R2 into R2 rows; records the
     key; then migrations run again and `r2-bootstrap` saves production's
     R2 (folder `sp`).
   Logs are `[import] …` and never contain secrets. The import never stops
   the container (always exit 0). A failure before the restore leaves the
   database as it was (`[import] not imported (database unchanged): …`) and
   the site starts normally: fix the cause and redeploy. The marker
   (`ops.data-import`) is written the moment the restore commits, so a
   failure after it is never followed by a second restore on restart.
4. **If the import fails after the restore** (`[import] FAIL the data was
   restored, then "<step>" failed: …`; marker status
   `restored-with-errors` with that step): the site runs on the restored
   data. Read the step:
   - `re-key secrets`: the remaining integration secrets (Turnstile, AI)
     do not decrypt with production's key. Run
     `OLD_BETTER_AUTH_SECRET='<local secret>' node scripts/dist/secrets-rotate.mjs`
     in the app container, or re-enter those secrets in Settings ▸
     Integrations.
   - `remove source R2/SMTP settings` / `release job claims` /
     `clear sessions and links`: run the matching step by hand (Settings ▸
     Integrations → Disconnect; the `update jobs set locked_at = null …`
     statement in "Restore a backup"; `delete from sessions` /
     `verifications` with `psql "$DATABASE_URL"`).
   - To start over instead: restore the pre-import backup named in the log
     (`/data/backups`, "Restore a backup"), then run a **new** export (new
     key) and update `SP_IMPORT_KEY`; the same key is never imported twice.
5. **Required after a successful import:**
   - Demo accounts are now on production with the known local passwords.
     Sign in with a real owner (imported, or `admin-create`) and run
     `node scripts/dist/demo-remove.mjs` before the site is announced.
   - Delete the dump object(s) under `sp/bootstrap/` in R2 (they hold every
     row, including password hashes).
   - Remove `SP_IMPORT_KEY` and `SP_IMPORT_SOURCE_SECRET` from **both** the
     GitHub repo secrets (`gh secret delete SP_IMPORT_KEY`,
     `gh secret delete SP_IMPORT_SOURCE_SECRET`) and the Dokploy
     environment (the app → Environment; `ensure-env` never deletes keys),
     then redeploy.
6. A new export + a **new** `SP_IMPORT_KEY` imports again and **replaces
   everything** edited on production since: only do that on purpose.

## Rollback

- Dokploy → the app → redeploy the previous image tag
  (`ghcr.io/mdnhs/security-partners:<previous sha>`), or revert the commit on
  `main` and push.
- Migrations only go forward and an old image runs against the newer schema.
  Additive migrations (new tables/columns) are usually fine. If the old code
  needs the old schema, restore the backup taken before the deploy
  ("Restore a backup"). The daily backup job runs 24 hours after its last
  success, not at every start, so take one by hand before a deploy that
  migrates.

## Running scripts in the container

`docker exec -it <app container> node scripts/dist/<name>.mjs [flags]`
(Dokploy: the app → Terminal). Scripts: `migrate`, `seed` (`--if-empty`:
what the entrypoint runs, seeds only a database with no pages;
`--allow-production`: adds every missing fixture row, never on a live
site), `admin-create`, `owner-recover`, `demo-seed`,
`demo-remove`, `backup`, `restore-drill` (`--keep`), `secrets-rotate`,
`db-sync`, `custom-code-off`, `r2-bootstrap`, `data-import` (the last two
run from the entrypoint). Locally: `pnpm <name>` with
`.env.development` (`db:migrate`, `db:seed`, `admin:create`,
`owner:recover`, `demo:seed`, `demo:remove`, `backup`, `restore-drill`,
`secrets:rotate`, `db:sync`, `custom-code:off`). Every script prints
its usage when a required flag is missing.

The scripts use the app's own database code, so they run with the
container's three variables. Scripts that write content (seed, db-sync,
restore) bypass the app's cache: restart the app afterwards.

A one-off `docker run … ghcr.io/mdnhs/security-partners:<tag> node
scripts/dist/<name>.mjs` (as `db-sync` uses) also goes through the
entrypoint: it migrates the target database and auto-seeds it if it has no
pages before the script runs. `db-sync` then replaces that content with the
source's.

## Backups and the restore drill

- Daily (scheduler job `backup`, 24 hours after the last success) and on
  demand (`backup`): `pg_dump` custom format in one consistent snapshot plus
  a `.json` manifest (row count per table, taken in the same snapshot, and
  the dump's SHA-256). Named `sp-<db>-<UTC stamp>.dump`. The newest 14 are
  kept. Pruning and the restore drill only consider this database's
  `sp-<db>-` files, ordered by the stamp, so a store shared by two
  environments never prunes or drills the other one's dumps. The data of
  `rate_limits` and `public_rate_limits` (short-lived counters) and of
  `verifications` (pending invite, password-reset and 2FA links, which are
  redeemable by whoever reads them) is not dumped.
- Where: the R2 bucket, prefix `<folder>/backups/` (production:
  `sp/backups/`; `backups/` when no folder is set), once Settings ▸
  Integrations ▸ R2 is saved; until then `/data/backups` on the app volume (lost with the
  server — set up R2). Local files are readable by the app user only.
- Backups go to the **same bucket with the same API token** as media. They
  are not encrypted by the app; at rest they rely on R2's server-side
  encryption. Anyone holding that token can read every backup (all leads,
  password hashes, encrypted integration secrets). A separate bucket/token
  or client-side encryption (age/GPG) is an owner decision (`docs/launch.md`).
- A whole dump is held in memory while it is uploaded to or downloaded from
  R2. Fine for this site's size (a few MB); revisit if the database grows to
  hundreds of MB.
- A failing backup shows on the dashboard ("Background jobs need
  attention", for users with integration read access) and retries every
  60 s until it succeeds. A backup still running after 10 minutes is treated
  as crashed and may be started again by the next tick (duplicate dump; the
  extra file is pruned with the rest).
- Postgres tools: the image ships `postgresql17-client`, matching the
  Postgres 17 server. Locally, `pg_dump`/`pg_restore` 18 (e.g. Homebrew
  libpq 18.6) also work against Postgres 17. A dump written by `pg_dump` 18
  cannot be read by `pg_restore` 17: restore with the same or a newer
  version.
- SSL to the database: `sslmode`, `sslrootcert`, `sslcert`, `sslkey` and
  `options` in the `DATABASE_URL` query string are passed to
  `pg_dump`/`pg_restore`. `ssl=true` and `sslpassword` are **not** passed
  (use `sslmode=require` or stricter). Inherited `PG*` variables (including
  `PGSSLMODE` and `PGPASSWORD`) are dropped; only the URL counts.
- Restore drill (monthly, and after any Postgres upgrade): `restore-drill`
  restores the newest backup into `<db>_restore_drill` on the same server,
  compares every table's row count with the manifest and drops the scratch
  database (`--keep` leaves it for inspection). The app's database role needs
  `CREATEDB` (the Dokploy database user has it). Exit code 1 = counts differ:
  investigate before you need the backup.

## Restore a backup

1. Stop the app (Dokploy → Stop) so nothing writes.
2. Get the dump: from R2 (`sp/backups/<name>.dump`) or `/data/backups/`. Check
   its SHA-256 against the `.json` manifest next to it.
3. `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error -d "$DATABASE_URL" <name>.dump`
   (from the app container: `PGPASSWORD=… pg_restore … -h security-partners-db -U sp -d sp`).
   The role must own the objects it drops (the app's own user does).
4. Release the job claims the dump captured (the backup job always holds
   its own while it runs; otherwise those jobs wait 10 minutes):
   `psql "$DATABASE_URL" -c "update jobs set locked_at = null where locked_at is not null"`
   (`psql` is in the app image). `db:sync` does this itself.
5. Start the app; check `/api/v1/health` and sign in.

Sessions in the dump stay valid (same secret). Rate-limit tables come back
empty, and so do pending invites and password links: re-send them. If the dump came from another environment, use `db:sync` instead: it
re-encrypts the integration secrets for this environment's key.

## Rotate BETTER_AUTH_SECRET

1. Generate the new secret; keep the old one at hand.
2. Dokploy: set the new `BETTER_AUTH_SECRET` (by hand: the workflow's
   `ensure-env` never changes an existing key), redeploy. Until step 3,
   SMTP/R2/Turnstile/AI cannot decrypt their credentials (email and media in
   R2 fail for those minutes).
3. `OLD_BETTER_AUTH_SECRET='<old>' node scripts/dist/secrets-rotate.mjs`
   (or `--from-secret '<old>'`, which lands in shell history) re-encrypts
   every integration secret, turns 2FA off for everyone and ends all
   sessions (audit: `secrets.rotated`). Safe to re-run: secrets already on
   the new key are reported, not changed.
4. Tell staff to sign in again and re-enrol 2FA. Preview links and lead-IP
   rate-limit counters reset (their keys are derived from the secret).
5. Newsletter: every unsubscribe link already emailed stops working. The
   link is `<subscriber id>.<HMAC>` keyed by the `newsletter` key derived
   from `BETTER_AUTH_SECRET`, and `secrets-rotate` does not (cannot)
   re-issue sent emails; the old key is not accepted after the rotation.
   A person who asks to be removed after that is deleted by an admin under
   Newsletter (`newsletter:delete`). The per-email
   sign-up rate-limit keys reset too. Pending confirm links survive: the
   confirm token is random and stored as a SHA-256 hash, not derived from
   the secret. Rotate only when needed (a leak), not on a schedule.

## Rotate the database password or the R2 keys

- Database: `docker exec -it <db container> psql -U sp -d sp -c "alter role sp password '<new>'"`,
  then in Dokploy change `POSTGRES_PASSWORD` and the password inside
  `DATABASE_URL` to the same value, redeploy. (`ensure-env` keeps existing
  keys, so it never undoes this.)
- R2 keys: create the new token in Cloudflare, enter it in Settings ▸
  Integrations ▸ R2 (same bucket and folder: only the keys), then update the
  repo secrets `SP_R2_ACCESS_KEY_ID` / `SP_R2_SECRET_ACCESS_KEY` and the
  Dokploy variables of the same names by hand (they are only read while no R2
  settings are saved, but stale values mislead), then revoke the old token.

## Copy a database between environments (db:sync)

For refreshing staging from production. It runs with the **target's** three
variables (it uses the app's database and crypto code for the target), with
the **target app stopped**, from a one-off container on the Dokploy network:

`docker run --rm --network dokploy-network -e DATABASE_URL=<staging url> -e BETTER_AUTH_SECRET=<staging secret> -e BETTER_AUTH_URL=<staging url> -e SOURCE_DATABASE_URL=<production db url> -e SOURCE_BETTER_AUTH_SECRET=<production secret> ghcr.io/mdnhs/security-partners:latest node scripts/dist/db-sync.mjs --confirm <staging db name> [--demo-password <pw>] [--verify-url <staging url>]`

- `--from <url>` / `--from-secret <secret>` may replace the two `SOURCE_*`
  variables (flags win); the variables keep the production credentials out of
  shell history and are removed from the environment before `pg_dump` runs.
  `--to` / `--to-secret` override the target's `DATABASE_URL` /
  `BETTER_AUTH_SECRET`. `--confirm` must equal the target database name.
- `--from-dump <file>` uses an existing `pg_dump` custom-format file as the
  source instead of `--from` (the production import uses this). The source
  secret is then checked in a scratch database `<target>_import_check`
  (needs `CREATEDB`), and sessions, verifications and rate-limit rows from
  the file are emptied after the restore.
- Production's database is on its compose network only: run a one-off
  container on that network (`docker network ls`, `<compose app>_default`)
  with `DATABASE_URL` host `security-partners-db`.
- Order: refuses when source and target are the same database; checks that
  the source secret decrypts the source's integration secrets (prints a
  notice when there are none to check); backs up the target first
  (`/data/backups` of that one-off container — mount a volume to keep it);
  restores the source dump in one transaction
  (`--clean --no-owner --single-transaction`); re-encrypts secrets for the target key; clears
  2FA; optionally resets demo passwords; checks the result (DB, every
  integration decrypts, AI test-connection when enabled, `--verify-url`
  health). Any `FAIL` line → exit code 1.
- Sessions, verifications and rate-limit counters are never copied.
- The source's R2 and SMTP settings are removed from the target after the
  restore (audit `integration.deleted`, `via: db:sync`; the script prints
  what it removed): set the target's own bucket and mail account in
  Settings ▸ Integrations. Media rows stored in the source's R2 stay in the
  database but their files will not load until they exist in the target's
  bucket. `--keep-integrations` keeps them — **dangerous**: the target then
  shares the source's bucket (its media deletes remove the source's files)
  and sends real mail as the source. Only for a short-lived copy you control.
- The target role must own every object the restore drops (use the target
  database's own user, as Dokploy creates it).
- Start the target app afterwards; it applies newer migrations itself.
- Lead data is personal data: only sync into an environment with the same
  access controls. Staging is not hidden from search engines by the app
  (`docs/launch.md`).

## Owner locked out

`node scripts/dist/owner-recover.mjs --email <owner email>`: turns 2FA off,
ends all their sessions, voids older links and prints a password link
(single use, 24 hours; also emailed when SMTP works). Audited as
`user.owner_recover`. After promoting someone to owner, they set a new
password and turn on 2FA (promotion ends their sessions).

## Client IPs and Traefik

The app takes the client IP from `X-Forwarded-For` (first value), else
`X-Real-Ip`. Sign-in, two-factor, password-reset and enquiry rate limits,
the IP hash stored with a lead and the IP sent to Turnstile depend on it.

- Keep Traefik's entrypoint `forwardedHeaders` **untrusted** (the default;
  never `insecure: true`, no `trustedIPs` on the public entrypoint). Traefik
  then overwrites client-sent `X-Forwarded-For` with the real peer address,
  so rate limits cannot be dodged by sending a fake header.
- Never publish port 3000 on the host: a request that bypasses Traefik can
  set any `X-Forwarded-For` it likes.
- If a CDN/proxy (e.g. Cloudflare) is put in front, add only its IP ranges
  to `forwardedHeaders.trustedIPs`, so the visitor's real IP reaches the app.
- Better Auth trusts a single-value `X-Forwarded-For` only and otherwise
  uses `X-Real-Ip`; in production, when neither resolves, all such requests
  share one rate-limit bucket.

## Rate limits at the proxy (Traefik)

The app limits only sign-in, two-factor and password resets (Better Auth,
production only), the public enquiry form (`public_rate_limits`) and AI chat
(30 messages per user per 10 minutes). Add a Traefik `rateLimit` middleware in
Dokploy for the paths that cost CPU or money per request and have no limit of
their own:

- `/og/*` — share-card images are rendered on demand (cached afterwards, but
  every new URL variant renders once);
- `/api/v1/admin/ai/*` — beyond the per-user chat limit, a burst limit per
  client IP protects the provider bill if a session is stolen;
- `/api/v1/admin/preview` — every call switches draft mode on and renders an
  uncached page.

A per-IP average of about 10 requests/second with a burst of 20 leaves normal
use untouched. This only works if Traefik sets the client IP itself (no
`forwardedHeaders.insecure` or trusted IPs on the public entrypoint).

## Background jobs

An in-process scheduler ticks every 60 s (first tick 5 s after start) in the
app container. Jobs are claimed with `FOR UPDATE SKIP LOCKED`, so a one-off
script container or an overlapping old/new container during a redeploy
never runs a job twice. That lock does not make replicas safe: run exactly
one app container ("Deploy"), because the cache a job expires lives in its
own process only.

- `publish-scheduled` (due every 30 s, but jobs are only checked on the 60 s
  tick, so in practice every 60 s): publishes articles whose time has come,
  up to about 60 s after the scheduled time; a cache refresh that fails is
  retried on the next run;
- revision pruning (daily, keeps the newest 50 per item);
- lead retention purge (daily; `settings.leads.retentionMonths`, default 24)
  and expired rate-limit rows;
- DB backup (daily, "Backups and the restore drill");
- media move to R2 (on request from Settings ▸ Integrations ▸ R2). Files
  that fail are skipped; when a run makes no progress it stops ("stopped",
  failures listed) and must be started again after fixing the files. One
  tick may block for up to ~40 s; an object copied to R2 whose database
  update then failed is logged by key and left in the bucket;
- newsletter purge (`purge-newsletter`, daily): deletes **pending**
  (never confirmed) sign-ups older than `settings.newsletter.pendingDays`
  (1–90), counted from `created_at` (a row re-pended after an unsubscribe
  counts from its latest confirm link). Confirmed and unsubscribed rows are
  never purged here. Audited as `newsletter.purged` with the count. While
  `settings.newsletter` is unpublished nothing is purged and the job shows a
  warning;
- replaced media files (one `delete-retired-media` row per old file): a
  replaced file stays servable at its old URL for 24 hours (pages already
  open keep their images), then it is deleted. Disconnecting or re-pointing
  R2 within those 24 hours leaves the old object in the old bucket (warning
  on the job).

A job row whose name no release handles any more (renamed or removed) is
logged and parked with "No handler for job …" instead of retrying; delete
the row once you have checked it.

Jobs expire caches through `http://127.0.0.1:$PORT` (signed request) — the
image binds `HOSTNAME=0.0.0.0`, which includes loopback; do not override
`HOSTNAME`. Failures are stored on the job row and listed on the dashboard
("Background jobs need attention", users with integration read access; the
message may be technical). A failed job retries after 60 s; a job locked for
more than 10 minutes counts as crashed and is claimed again.

On `SIGTERM`/`SIGINT` the scheduler stops ticking and waits for the running
tick. This is best effort: Next's own shutdown handler may exit the process
first, and a job cut off that way is claimed again once its lock is older
than 10 minutes.

## Sessions and sign-in

Sessions last 7 days and are extended (at most once a day) while used, so
in practice the limit is about 7 days of inactivity. Rate limits (production
only, in Postgres): sign-in 5/min, 2FA 5/min, password reset 3 per 5 min,
everything else under `/api/auth` 100/min per IP; public enquiries 5 per
10 min per IP; AI chat 30 messages per user per 10 min. Revoking a session
takes effect at once for every admin page, API call and `/api/auth`
request (Better Auth's session cookie cache is off). "Sign out everywhere" also ends
"View as" sessions the user started. Passwords: 12–128 characters. While
"View as" (impersonation) is active, account settings and the AI assistant
are read-only, but the impersonating admin can read the user's AI
conversations.

## Security headers

Pages: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` (`DENY`
under `/admin`), `Permissions-Policy: camera=(), microphone=(),
geolocation=(), browsing-topics=()`, `Strict-Transport-Security:
max-age=31536000`, and a non-blocking `Content-Security-Policy` (`base-uri
'self'; object-src 'none'; frame-ancestors 'self'`, `'none'` under
`/admin`; next.config.ts). API: Hono `secureHeaders()` plus `X-Robots-Tag:
noindex` (also on `/admin`). Unsafe admin API calls must come from the
site's own origin (CSRF check). Uploaded SVGs are sanitised and served with
a sandboxing CSP. Uploaded Lottie animations (`.json` / `.lottie`, up to
2 MB; a `.lottie` may unpack to at most 16 MB) are validated, then served as
`video/lottie+json` / `application/zip+dotlottie` with `nosniff`,
`Content-Security-Policy: default-src 'none'; sandbox` and
`Content-Disposition: attachment`. What a stricter CSP must allow is in the
next section.

### Animated logo (Lottie)

Settings › Site › Logos › "Animated logo (Lottie)" (`settings.site.logoAnimation`)
plays a Lottie file in a loop over the logo in the header and footer. The
image logo is server-rendered as before; on pages with an animation a
client component loads `@lottiefiles/dotlottie-web` (pinned `0.80.0`) with
a dynamic import and shows the animation once its first frame is drawn.
Visitors with "reduce motion" never load the player; a file that fails to
load leaves the image logo. The player's WebAssembly is self-hosted at
`/vendor/dotlottie-web/0.80.0/dotlottie-player.wasm` (a copy of the
package's `dist/dotlottie-player.wasm`; `tests/unit/lottie-logo.test.ts`
fails if the copy and the installed package differ). When upgrading the
package, copy the new file to a new versioned folder and update
`LOTTIE_WASM_URL` in `components/home/logo-animation.tsx`. To switch the
animation off, clear the field and publish.

## Custom code and Content-Security-Policy

Marketing › Custom code (owner only) manages the published
`settings.customCode` snippets (up to 20). Each snippet is either a script
address (`https://` on a host listed under "Allowed hosts") or an HTML
block, with a placement (`head` / end of `body`), route patterns (`/` is the
home page only, `/blog/*` is `/blog` and everything under it; none = every
page) and a consent category:

- `necessary` runs without consent. The pre-MK "head"/"body end" blocks
  were migrated as `necessary`, all-routes snippets (`0015_marketing`), so
  they behave as before.
- `analytics` / `marketing` wait until the visitor accepted that category
  in the cookie banner. With "Load tracking" off there is no banner and no
  consent, so these snippets never run.

Each placement is sent as one inline loader
`<script id="sp-custom-code-head|body">` holding the enabled snippets. In
the browser it checks the path and the consent right before running a
snippet, and checks again after each consent choice (`sp:consent`) and
each client-side navigation (`sp:navigate`); a snippet runs at most once
per page load. Drafts never run on the site; publishing applies at once.

- Only paste code from vendors you trust: it runs with full access to every
  visitor's page. A `necessary` snippet is not covered by the cookie
  banner; put anything that sets cookies or tracks visitors in `analytics`
  or `marketing`. Google and Meta tags belong under Marketing › Tracking.
- **Kill switch.** "Switch all custom code off" (Marketing › Custom code,
  `settings.customCode.disabled`) stops every snippet at once, enabled or
  not. If a snippet breaks the admin itself (it shares the origin), switch
  it off from the server without signing in:
  `node scripts/dist/custom-code-off.mjs` in the container
  (`pnpm custom-code:off` locally). It sets `disabled` on the draft and the
  published value, bumps the version (an open editor cannot overwrite it),
  audits `customCode.killSwitch` (no actor) and expires the cached settings.
  Undo: Marketing › Custom code, turn the switch off again, publish. The
  cache refresh reaches only the app process the script calls; with the
  required single container that is the whole site. If the refresh fails
  the script says so: the switch is already off in the database, restart
  the app to apply it now.
- The Tracking tag IDs (GTM, GA4, Meta Pixel) load third-party script, and
  a GTM container can carry any code ("Custom HTML" tags). The admin and API
  share the public origin, so such code runs with the session of any admin
  who visits the site. Changing an ID therefore needs the owner (the API
  refuses it for others on draft save, publish and restore; other roles see
  the IDs read-only). A separate admin origin would remove this class of
  risk (owner decision, `docs/launch.md`).
- Verify domains by DNS (Google Search Console, Meta Business), not with a
  `<meta>` tag: the tag only exists after JavaScript runs.
- Tracking (Marketing › Tracking) loads nothing until a visitor consents:
  analytics consent loads Google Tag Manager / Google Analytics 4 (after the
  Google Consent Mode defaults, all denied), marketing consent loads the Meta
  Pixel. The choice is kept in the `sp_consent` cookie for 6 months; the
  "Cookie settings" button reopens the banner, and withdrawing a category
  clears the GA/Meta cookies and reloads the page.
- Pages send a Content-Security-Policy that restricts no source:
  `base-uri 'self'; object-src 'none'; frame-ancestors 'self'` (`'none'` under
  `/admin`, next.config.ts). Public pages are Cache Components static shells,
  so a per-request nonce is not possible without making every page dynamic
  (Next CSP guide). If a stricter policy (`script-src` etc.) is added later, it
  must allow:
  - `script-src`: the inline loaders (a per-request nonce on
    `#sp-custom-code-*`, or `'unsafe-inline'`), Next's own scripts (inline
    bootstrap and the `<html class="js">` snippet in the site layout),
    `https://challenges.cloudflare.com` (Cloudflare Turnstile on the contact
    form), and the hosts the snippets load from; for Tracking also
    `https://www.googletagmanager.com` and `https://connect.facebook.net`.
    The animated logo's player compiles WebAssembly: `'wasm-unsafe-eval'`
    (not `'unsafe-eval'`; its wasm-bindgen glue also holds a `new
    Function` fallback that a strict policy would block — check the logo
    still animates before shipping such a policy).
  - `connect-src`: `'self'` for the animated logo (the player fetches the
    Lottie file from `/api/v1/media/file/…` and its WASM from `/vendor/…`).
  - `connect-src` / `img-src`: `https://*.google-analytics.com`,
    `https://*.analytics.google.com`, `https://*.googletagmanager.com`,
    `https://www.facebook.com` (pixel beacons), plus any snippet endpoints.
  - `frame-src`: `https://challenges.cloudflare.com` (the Turnstile widget
    is an iframe) and whatever the snippets embed.
- To remove everything quickly: turn on "Switch all custom code off" and
  publish (no deploy), or run `custom-code-off` (above). To stop all
  tracking at once: switch "Load tracking" off under Marketing › Tracking
  and publish (the banner disappears too; analytics/marketing snippets and
  enquiry attribution stop with it).
- GA4 setup: in GA4 › Admin › Data streams › your web stream › Enhanced
  measurement › Page views › Show advanced settings, turn off "Page changes
  based on browser history events". The site (and `docs/gtm-container.json`)
  sends page changes itself; with the GA4 option on, every client-side page
  change is counted twice. Send GA4 either through the GTM container or
  through the Google Analytics 4 switch on the Tracking page, not both
  (every event would count twice). Both steps are also listed under
  Marketing › Event catalogue.
- Enquiry attribution (first touch: external referrer origin + path,
  landing path, UTM tags) is stored in the visitor's `sessionStorage` only
  after analytics consent and removed when it is refused or withdrawn; the
  contact form sends it only with analytics consent. An invalid value is
  dropped on the server (`[leads] invalid attribution dropped; enquiry
  kept`), never rejecting the enquiry.

## Newsletter

- Sign-up is double opt-in: `POST /api/v1/public/newsletter` stores a
  pending row and emails a confirm link (rate-limited per IP and per email
  address; the per-email key is an HMAC, so the table never holds the
  address).
- Every state change is a `POST`. Mail gateways pre-fetch links, so the
  emailed confirm link opens the `/newsletter/confirm` page, whose button
  POSTs the token; `GET /api/v1/public/newsletter/confirm` (older links)
  only redirects (303) to that page. Unsubscribe is the same: the
  `/newsletter/unsubscribe` page POSTs. The pages strip the token from the
  address bar after load.
- `/newsletter/*` is sent with `Cache-Control: private, no-store,
  max-age=0`, `Referrer-Policy: no-referrer` and
  `X-Robots-Tag: noindex, nofollow` (next.config.ts). A CDN or proxy in
  front must not cache these pages or strip those headers: the URLs carry
  tokens. Also keep access-log retention short ("Logs").
- Settings › Newsletter (placement, copy, `pendingDays`, confirmation
  email) is owner/admin only. Unconfirmed sign-ups are purged daily
  ("Background jobs"). Unsubscribe links depend on `BETTER_AUTH_SECRET`
  ("Rotate BETTER_AUTH_SECRET").

## AI assistant

- Settings › AI assistant: provider, model, API key (encrypted), allowed
  roles. The OpenAI-compatible provider takes a base URL; every request to
  it (model list, test connection, chat) goes through an SSRF guard
  (`server/lib/ai-target.ts`): the host is resolved once per connection and
  refused if **any** address is private, loopback, link-local or a metadata
  address, the socket connects only to the checked addresses (undici
  `connect.lookup`, so DNS cannot be rebound) and redirects are refused (a
  redirect would carry the key). In development only
  (`NODE_ENV !== "production"`) `http://localhost` and loopback literals
  are allowed for a local model server; production needs `https://` to a
  public address. The fixed providers (Anthropic, OpenAI, Google) use their
  own URLs.
- `undici` is a direct, exact-pinned dependency bundled into the server for
  this guard; keep it on a patched 6.x release when Dependabot or
  `pnpm audit:deps` reports one.
- "Share enquiry details" lets the assistant read enquiry contents. Only an
  owner can turn it on, with an acknowledgement; the server stamps who and
  when. Changing the provider or the OpenAI-compatible base URL turns it
  off again (the new processor was never acknowledged) unless the owner
  re-acknowledges in the same save. Anyone who may save the settings can
  turn it off. Contact details in other screens are redacted before they
  reach the provider (best effort).

## Appearance (theme)

Appearance (`appearance:update` saves the draft, `appearance:publish`
publishes; owner and admin) sets the public and admin colours. Publish is
gated: the server refuses a draft with contrast failures (text pairs below
4.5:1, large/UI pairs below 3:1, for the site and both admin modes) with
"Fix the contrast issues before publishing". The default theme renders
exactly the original site. A bad stored value falls back to the default
theme with `[theme] stored theme invalid; using default` in the log.

## Logs

`docker logs <container>`. Lines are prefixed (`[api] <requestId>`,
`[migrate]`, `[mailer]`, `[audit]`, `[db]`, scheduler job names). Never
logged: passwords, secrets, tokens, links from emails, message bodies, lead
IPs (stored only as a keyed hash); the mailer logs only the recipient's domain and a template name.
Watch for `[audit]` errors: an audit write failure never blocks a sign-in,
so the log is the only signal. API error responses carry `requestId`;
search the log for it.

Traefik's access log records full URLs. The lead export for a data-subject
request is a `GET` with the person's email in the query string
(`/api/v1/admin/leads/export.csv?email=…`), so that email appears in
access logs and browser history. Keep access-log retention short or
disabled.

## Dependency audit

`pnpm audit:deps` runs `pnpm audit --prod --audit-level high`. It checks
**production dependencies only** — the packages the standalone image ships.
Dev and build tools (drizzle-kit, eslint, shadcn, vitest, playwright) are not
covered by the gate. Their advisories (e.g. the moderate `esbuild` advisory via
drizzle-kit) only affect the developer machine and CI. Run a full
`pnpm audit` before a release and review anything high or critical by hand.

Fix a finding by updating within the range, or with a `pnpm.overrides` pin to
a patched version published at least 2 weeks ago; a build-only package moves
to `devDependencies` (as `shadcn` did). Record each override here with the
advisory id. Current overrides: none.

## Known limitations

- Visual pixel tests run on macOS only (baselines are macOS renders); CI
  runs E2E but not `tests/visual`.
- E2E does not check email delivery for enquiries and password resets: in
  production mode the SMTP guard refuses the loopback Mailpit, so those
  tests check the app's outcome (notification recorded, response shown);
  delivery to Mailpit is covered by the integration tests. The E2E job still
  starts Mailpit for the SMTP "Test connection" spec.
- Uploads and backups live on `/data` until R2 is configured.
- Media files are streamed with `Range` and `ETag` support. From R2, a
  single request times out after 60 s, so a very slow download of a large
  file can be cut off. Animated WebP/AVIF keep only the first frame; photo
  metadata (EXIF/GPS) is stripped on upload; PDFs open inline.
- Stopping the scheduler on `SIGTERM` is best effort ("Background jobs").
- When the stored Turnstile settings cannot be decrypted (e.g. after a
  secret change without `secrets:rotate`), the contact form keeps accepting
  enquiries **without** the spam check and sends no acknowledgement emails
  (so real enquiries are not lost). The dashboard then shows "Spam
  protection is off" first in "Next up" and the log has
  `[leads] Turnstile settings could not be read`; re-enter the keys under
  Settings ▸ Integrations ▸ Turnstile.
- Share cards (`/og/…`) are sent with
  `Cache-Control: public, max-age=600, stale-while-revalidate=3600`: after a
  title or image change, browsers and proxies may show the old card for up
  to about an hour.
- SEO edits on a service/article/page record are last-write-wins (no
  version check): two people editing the same record's SEO at once overwrite
  each other.
- `seo.defaults` revisions saved before migration
  `0008_seo_defaults_organization` cannot be restored (the restore is
  refused with a validation error); re-enter the values instead.
- The seeded default SEO description is 163 characters, over the usual
  160-character guideline; shorten it under SEO ▸ Defaults (`docs/launch.md`).
- `admin-create` creates another owner on every run (no "owner exists"
  check).
- Staging is not blocked from search engines by the app (`robots.txt` is the
  same everywhere); block it at the proxy or with HTTP auth if needed.
- AI conversations are kept until a user deletes them (no automatic purge).
- Safari < 16.4 cannot open admin draft previews (no `Sec-Fetch-Site`).
- After seeding or restoring from outside the running app, restart it.
- `{…}` in a content field is a placeholder (e.g. `{phone24h}`), not text.
- Migrations are forward-only; roll back schema changes with a backup.
- One app container only ("Deploy"): the page cache is per process. Scaling
  out needs a shared `cacheHandlers` store with tag fan-out first (future
  work).
- The public error page (`app/(site)/error.tsx`, shown when the database is
  down) has fixed English copy ("Something went wrong", "Try again", "Home")
  and no header or footer: it cannot read settings when the database is the
  thing that failed.
- Public images do not use blur placeholders: `blurDataUrl` is computed and
  stored for every upload, but the frozen templates pass plain image URLs.
- Redirect and slug lookups in `proxy.ts` are uncached indexed queries: every
  unknown path (bot scans such as `/wp-login.php`) and every service/article
  view costs one query before the cached render.
- A client that sends its own `__prerender_bypass` cookie skips the proxy's
  slug check and gets the 404 page with HTTP 200 instead of 404 for an
  unknown slug. Draft content stays protected (preview access is re-checked
  on every request); only that client's status code is affected.
- The contact map is a set of static tiles (`settings.sections.contact.map.tiles`
  → `public/images/map/*`): editing the address or the map link does not
  change the map picture.
- Public pages render per request (database-driven, no build-time HTML) and
  the site sources load about three times per request from the in-memory
  cache (metadata, page, site extras). Time to first byte has not been
  measured against the old static site; measure once on the production
  image.
- `settings.site.logoOnDark` is kept in the schema but hidden in the admin:
  no dark surface of the public design shows a logo (the footer logo sits on
  a white plate).
