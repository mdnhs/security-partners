# Runbook

Security Partners site + admin on one Next.js app (standalone Docker image
`ghcr.io/mdnhs/security-partners`), Postgres 17 as a Dokploy database
service, Traefik in front (Dokploy). The container reads exactly three
variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (plus the
platform's `NODE_ENV`, `PORT`, `HOSTNAME`, set by the image). Everything else
(SMTP, R2, Turnstile, AI, tracking) is set in the admin and stored in the
database, secrets encrypted with keys derived from `BETTER_AUTH_SECRET`.

Some operator scripts accept a secret through an input-only variable so it
stays out of shell history: `DEMO_PASSWORD` (`demo:seed`),
`OLD_BETTER_AUTH_SECRET` (`secrets:rotate`), `SOURCE_DATABASE_URL` and
`SOURCE_BETTER_AUTH_SECRET` (`db:sync`). Only that script reads them; the app
never does. Never set them in the Dokploy environment.

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
  image pushed to GHCR (`:latest` and `:<commit sha>`) and Dokploy asked to
  redeploy the compose app. Every job in `deploy.yml` runs only on
  `refs/heads/main`; the Dokploy step uses the GitHub environment
  `production` (add required reviewers there to make deploys wait for an
  approval). `ci.yml` also runs on pull requests; a push to a branch other
  than `main` starts no workflow of its own. Visual pixel tests are not in CI (macOS only): run
  `pnpm test:visual` locally before merging a change that can touch the
  public pages.
- Manual run: Actions → Build & Deploy → Run workflow, on `main` (a
  dispatch on another branch deploys nothing). `skip_ci` deploys `main`
  without waiting for CI — emergency only (a hotfix while CI itself is
  broken); it exists only for `workflow_dispatch`, never for a push.
- The container's PID 1 is `tini`, which forwards `SIGTERM`. On start the
  container applies pending migrations (`docker-entrypoint.sh` →
  `node scripts/dist/migrate.mjs`), then auto-seeds the content if the
  database is empty (`node scripts/dist/seed.mjs --if-empty`), then starts
  `node server.js`. The seed step writes only when the `pages` table has no
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

1. Dokploy: create a Postgres 17 database service. Put the app's compose
   project on the same `dokploy-network` so the database host name resolves
   from the app container.
2. Environment (Dokploy → the app → Environment): `DATABASE_URL`,
   `BETTER_AUTH_SECRET` (`openssl rand -base64 48`; keep it in the password
   manager — it also derives the encryption keys; the `.env.example` value is
   refused in production), `BETTER_AUTH_URL` (`https://security.raynx.ie`;
   https is required in production, http is accepted only for localhost).
3. Deploy (push to `main` or run the workflow). The first start migrates
   and seeds the empty database by itself (`docker logs` shows
   `[db:seed] empty database (no pages): content seeded (…)`). Check
   `/api/v1/health` and the home page. No manual seed step: the bootstrap is
   the three variables, the deploy and `admin-create` (spec §1.2 #6).
4. Never run `node scripts/dist/seed.mjs --allow-production` on a live
   production database: it is insert-only and re-creates rows an editor
   deleted. The entrypoint's `--if-empty` mode is the only seed production
   needs.
5. First owner:
   `node scripts/dist/admin-create.mjs --email <owner email> --name "<name>"`
   prints a set-password link (single use, valid 7 days; also emailed once
   SMTP works). Sign in at `/admin` and turn on 2FA. `admin-create` does not
   check whether an owner already exists: every run creates another owner.
   Use it once; invite everyone else from Users.
6. Settings ▸ Integrations: SMTP, R2 (then "Move uploads to R2"),
   Turnstile; Settings ▸ Leads: recipients. Then work through
   `docs/launch.md`.
7. Demo accounts never go on production. If `demo:seed` ever ran there:
   `node scripts/dist/demo-remove.mjs` (refuses while no real active owner
   would remain).

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
`db-sync`. Locally: `pnpm <name>` with `.env.development` (`db:migrate`,
`db:seed`, `admin:create`, `owner:recover`, `demo:seed`, `demo:remove`,
`backup`, `restore-drill`, `secrets:rotate`, `db:sync`). Every script prints
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
- Where: the R2 bucket, prefix `backups/`, once Settings ▸ Integrations ▸ R2
  is saved; until then `/data/backups` on the app volume (lost with the
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
2. Get the dump: from R2 (`backups/<name>.dump`) or `/data/backups/`. Check
   its SHA-256 against the `.json` manifest next to it.
3. `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error -d "$DATABASE_URL" <name>.dump`
   (from the app container: `PGPASSWORD=… pg_restore … -h <db host> -U <user> -d <db>`).
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
2. Dokploy: set the new `BETTER_AUTH_SECRET`, redeploy. Until step 3,
   SMTP/R2/Turnstile/AI cannot decrypt their credentials (email and media in
   R2 fail for those minutes).
3. `OLD_BETTER_AUTH_SECRET='<old>' node scripts/dist/secrets-rotate.mjs`
   (or `--from-secret '<old>'`, which lands in shell history) re-encrypts
   every integration secret, turns 2FA off for everyone and ends all
   sessions (audit: `secrets.rotated`). Safe to re-run: secrets already on
   the new key are reported, not changed.
4. Tell staff to sign in again and re-enrol 2FA. Preview links and lead-IP
   rate-limit counters reset (their keys are derived from the secret).

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
a sandboxing CSP. What a stricter CSP must allow is in the next section.

## Custom code and Content-Security-Policy

Marketing › Custom code (owner only) adds the published `settings.customCode`
snippets to every public page. Each snippet is sent as one inline loader
`<script id="sp-custom-code-head|body">` that parses the HTML and appends it
to `<head>` / the end of `<body>` after the page loads, so its scripts run
once per page load. Drafts never run on the site; publishing applies at once.

- Only paste code from vendors you trust: it runs with full access to every
  visitor's page and is not covered by the cookie banner. Consent-dependent
  tags (Google, Meta) belong under Marketing › Tracking.
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
  - `connect-src` / `img-src`: `https://*.google-analytics.com`,
    `https://*.analytics.google.com`, `https://*.googletagmanager.com`,
    `https://www.facebook.com` (pixel beacons), plus any snippet endpoints.
  - `frame-src`: `https://challenges.cloudflare.com` (the Turnstile widget
    is an iframe) and whatever the snippets embed.
- To remove everything quickly: clear both fields and publish (no deploy).
  To stop all tracking at once: switch "Load tracking" off under
  Marketing › Tracking and publish (the banner disappears too).

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
