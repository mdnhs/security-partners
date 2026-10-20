# Phase 10 — Hardening, ops, E2E, docs

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master Phase 10 = Tasks 10.1–10.5). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§1.2, §4, §12, §13, §14, §15, §17). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Public design is frozen: `pnpm test:visual` keeps every public baseline at **0 px** (1440×900 and 390×844, macOS only, port 3100 free). Nothing in this phase changes public markup; Task 10 changes the server the suites run against (standalone `server.js`) and must prove 0 px again.
- `next build` succeeds with no env vars and no database (`env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`).
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (+ platform `NODE_ENV`, `PORT`, `HOSTNAME`). Operator scripts may read an input-only variable for a secret they are given (`DEMO_PASSWORD` exists; this phase adds `OLD_BETTER_AUTH_SECRET` for `secrets:rotate`) — never app configuration.
- **Deploy trigger is not changed:** `.github/workflows/deploy.yml` keeps `on: push: branches: [main]` + `workflow_dispatch`. Never push.
- Every file under `server/` starts with `import "server-only"`. `lib/**` and `templates/*/schema.ts` never import `server/**`. Only `server/modules/*/repo.ts` and `server/db/**` import `drizzle-orm` (tests may). Routes never import repos.
- Hono handlers: validate (`zv`) → authorise (`can(...)`) → call a service. Services audit every mutation (`writeAudit`).
- Admin UI follows `phase-04b-jw-parity.md` → "Patterns for later phases (5–10) — binding" (kit components, `StatusPill`, `EmptyState`, 44 px form actions, Sheets). This phase adds no new admin screen; it adds one dashboard "Next up" item and fixes deferred a11y/editor findings in existing components.
- WCAG 2.2 AA in the admin.
- Code style: repo Prettier (no semicolons, double quotes, 80 cols). Run `pnpm exec prettier --write <files>` on files you create or edit.
- Commit after every task, staging only your paths (`git add <paths>`; never `git add -A`); message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Only one agent at a time runs Playwright (`test:visual`, `test:e2e`) or `next build` (ledger ruling).
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` + `pnpm test:visual` + `pnpm test:e2e` (Postgres **and** Mailpit up: `pnpm db:up`), plus `pnpm audit:deps`.

**Prerequisites:** Phases 0–9 and 4b complete. Real files used by name (read from the working tree on 2026-10-16): `server/lib/{crypto,errors,audit,ip,mailer,pg-errors,site-env}.ts`, `server/env.ts`, `server/db/{client,migrate}.ts`, `server/db/seed/{guard,index}.ts`, `server/db/schema/{auth,settings,jobs,audit}.ts`, `server/auth/{auth,tokens,hooks}.ts`, `server/api/{app,context}.ts`, `server/api/middleware/{error,same-origin,request-id}.ts`, `server/modules/users/{service,repo,bootstrap,routes}.ts`, `server/modules/{search,audit,users,collections,services,media}/repo.ts` (local `escapeLike` copies), `lib/auth/permissions.ts`, `lib/href.ts`, `lib/schemas/common.ts`, `lib/api-client.ts`, `hooks/use-autosave.ts`, `components/admin/editor/versioned-editor.tsx`, `components/admin/services/service-editor.tsx`, `components/admin/shell/{command-palette,user-menu,nav}.tsx|ts`, `components/admin/schema-form/widgets/group.tsx`, `components/admin/pages/pages-list.tsx`, `scripts/{build-scripts,seed,demo-seed,migrate}.ts`, `scripts/lib/run-script.ts`, `Dockerfile`, `docker-entrypoint.sh`, `docker-compose.yml`, `.github/workflows/deploy.yml`, `playwright.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `next.config.ts`, `tests/e2e/{env,fixtures,seed,global.setup,account.spec,admin-auth.spec,public-site.spec}.ts`, `tests/visual/{seed,admin-user,public-pages.spec}.ts`, `tests/integration/{db,setup,global-setup}.ts`, `tests/integration/helpers/auth.ts`, `tests/unit/{lint-boundaries,scripts-bundle,crypto,env,permissions}.test.ts`, `tests/dom/{use-autosave,versioned-editor,command-palette,schema-form-lists}.test.tsx`. **Not built when this plan was written** (taken from their plan files — apply the same change to the real code and say so in your report if names differ): Phase 4 Task 11 `server/modules/dashboard/{repo,service}.ts` + `lib/schemas/api/dashboard.ts` (`NextUpItem`), Phase 4 Task 12 users/audit screens; Phase 5 Task 6 `server/lib/jobs/index.ts` (`JobDefinition`, `RECURRING_JOBS`), `server/lib/scheduler.ts`; Phase 5 Task 5 `EditorActionContext` render-prop `aside` on `VersionedEditor`; Phase 6 Task 1 `lib/schemas/integrations` (`INTEGRATION_KEYS`, `INTEGRATIONS[key].secrets`, `R2Config`, `IntegrationConfig`), `server/modules/integrations/{repo,service,testers}.ts` (`listIntegrationRows`, `readIntegrationConfig`, `secretAad`, `saveIntegration`, `runIntegrationTest`), `server/lib/r2-client.ts` (`createR2Client`); Phase 7 `server/lib/mailer.ts` (SMTP from `integrations.smtp`), table `public_rate_limits`, `tests/e2e/leads.spec.ts`; Phase 8 `docs/runbook.md` (custom-code CSP section), `tests/e2e/seo.spec.ts`; Phase 5 `tests/e2e/articles.spec.ts`; Phase 6 `tests/e2e/media.spec.ts`.

**Ledger rulings applied:** never push; deploy trigger unchanged (controller instruction for this phase — supersedes the master "workflow_run" wording and pre-flight row "10.4 ↔ deploy.yml"); visual pixel gate runs on macOS only, CI runs E2E but not `tests/visual`; CI integration **and** E2E jobs need Mailpit (Phase 6/7 notes); `next typegen` before `typecheck` in CI (P04b-3 carry); the scheduler reaches the app over loopback (`HOSTNAME=0.0.0.0` binds loopback too — verified by the image smoke job); Traefik must not trust client `X-Forwarded-*` (runbook); seed in the production container needs `public/images` + `sharp` in the standalone `node_modules` (image smoke runs `seed.mjs`); `db:seed --allow-production` on the first deploy only; integration secrets are re-encrypted with AAD `<key>.<field>` over `INTEGRATIONS[key].secrets` (Phase 6 note); R2 bucket stays private, API token "Object Read & Write" (Phase 6); OWNER MUST CONFIRM items (consent basis, AI provider as GDPR processor, data inconsistencies) go to `docs/launch.md`; every deferred finding from the ledger is either fixed below or listed with a reason in "Deferred findings sweep".

**Verification note (2026-10-16):** checked against the installed packages: `pg-connection-string@2.14.1` `parse()` returns `{ host, port, user, password, database, sslmode, ssl }` (probed); Better Auth 1.7.10 `getIP` (`@better-auth/core/dist/utils/ip.mjs`) trusts a **single-value** `X-Forwarded-For` only, unless `advanced.ipAddress.trustedProxies` is set, then falls through to the next configured header (`x-real-ip`), and in production returns `null` (one shared "no-trusted-ip" bucket) when nothing resolves; ESLint 9 `no-restricted-syntax` selectors `ImportExpression[source.value=/^(@[/]server|([.][.][/])+server)([/]|$)/]` and the `require` equivalent match `@/server/env` and `../../server/env` but not `@/server-utils` (probed in `scratchpad/planprobe/esq.mjs`); `pnpm audit --prod --audit-level high` today reports one **high** (`braces` via `shadcn` → `fast-glob`, no patched version) and one moderate (`esbuild` via `drizzle-kit`); `shadcn` is only used as `@import "shadcn/tailwind.css"` in `app/globals.css` (build time). Local `pg_dump`/`pg_restore` are 18.6 (Homebrew libpq) against the Postgres 17 container — fine for custom-format dump/restore; the image ships `postgresql17-client`. The code below was not executed (Phases 5–9 are not built yet); run every step's command and fix mechanical drift.

## Corrections to master plan

- **Deploy gating without changing the trigger (master 10.4):** the master text says `deploy.yml` moves to `workflow_run`. Controller instruction for this phase: the trigger stays `push: main` (+ `workflow_dispatch`). Gating is done inside the same run: `ci.yml` becomes reusable (`workflow_call`) and `deploy.yml` gets a first job `ci: uses: ./.github/workflows/ci.yml`; `build-and-push` `needs: ci`. A manual dispatch can pass `skip_ci: true` for an emergency deploy. Cost if wrong: delete the `ci` job and the `needs`/`if` lines (3 lines).
- **CI gains an `image` smoke job** (not in the master list): builds the Docker image (no push), runs migrate → `seed.mjs` (sharp) → server → readiness → `backup.mjs` → `restore-drill.mjs` inside it. It is the only check of the standalone image, the entrypoint, `pg_dump` in the image and loopback binding. Cost: ~4 CI minutes.
- **Backups are dumps + a JSON manifest** (`sp-<db>-<UTC stamp>.dump` + `.json` with row counts taken in the dump's exported snapshot and a SHA-256). The restore drill compares the restored scratch DB against the **manifest**, not the live DB (the live DB moves on after the dump). Backups skip the data of `rate_limits` / `public_rate_limits` (ephemeral). Cost: none.
- **Backups do not use the media `StorageDriver`:** it has no `list()` and keys must never be reachable through `/api/v1/media/file/*`. A small `BackupStore` writes to `backups/` in the R2 bucket (when `integrations.r2` is saved) or `/data/backups` (`.data/backups` in dev). Cost: one module.
- **`secrets:rotate`** also deletes every session (cookies signed with the old secret are dead anyway) and writes audit `secrets.rotated`; it is idempotent (a secret that already decrypts with the new key is reported, not an error) and accepts `OLD_BETTER_AUTH_SECRET` instead of `--from-secret` to keep the secret out of shell history. Cost: everyone signs in again (unavoidable).
- **`db:sync` runs with the TARGET's env** (it uses the app's DB/auth code for the target): `--to`/`--to-secret` are optional overrides of `DATABASE_URL`/`BETTER_AUTH_SECRET`; `--confirm <target database name>` is required (it replaces everything in the target); `--demo-password` (re-apply demo passwords) and `--verify-url` (health check) are optional. Cost: none.
- **New `demo:remove` script** (spec §14 says demo accounts are "removed before handover" but gives no mechanism): deletes every `@demo.local` user under the owners lock and refuses if no real active owner would remain. Cost: one script.
- **Dashboard "Next up" gains `failed-jobs`** (spec §12 "failures … surfaced on the dashboard" had no task): listed for `integration:read` while any `jobs.last_error` is set. Cost: one union member + one query.
- **Playwright serves the standalone `server.js`** (what production runs) instead of `next start` (ledger minors P01-5/P02-6/P03-9). Cost: one copy step after `pnpm build`.
- **Security headers via `next.config.ts` `headers()`** (nosniff, referrer policy, frame options — `DENY` on `/admin`, permissions policy, HSTS) on every non-`/api` path (Hono's `secureHeaders` already covers `/api`). No CSP: the custom-code/tracking feature needs inline loaders and third-party hosts; the runbook (Phase 8 section) documents what a future CSP must allow. Cost if wrong: none for pixels (headers only).
- **`shadcn` moves to `devDependencies`** — its only use is a build-time CSS import; this clears the production audit's only high finding. Cost: none (Docker deps stage installs dev deps).
- **`secretHint` reveals nothing for secrets shorter than 12 characters** (ledger P01-3: 4 of 5 chars leaked). The shared-contract comment "•••• + last 4" now applies to secrets of 12+ characters. Cost: short test secrets show `••••`.
- **`BETTER_AUTH_URL` must be `https` when `NODE_ENV=production`, except loopback hosts** (`localhost`, `127.0.0.1`, `[::1]` — E2E and the CI image run `next start`/`server.js` on http loopback). Otherwise auth cookies would be sent without `Secure` (ledger P02-2). Cost: none for real deployments.
- **Master 10.3 file `tests/e2e/global-setup.ts`** is really `tests/e2e/global.setup.ts` + `tests/e2e/seed.ts` (Phase 2); demo users (one per role) are seeded there with `seedDemoUsers`. Cost: none.
- **Task split:** 10.1 → Tasks 1–4; 10.2 → Tasks 5–9 (Task 9 = deferred admin findings); 10.3 → Tasks 10–11; 10.4 → Task 12; 10.5 → Task 13. Cost: none.

## Deferred findings sweep

Every "minor (deferred)", carry and parked item in `.superpowers/sdd/2026-10-16-dynamic-platform/progress.md` not owned by a Phase 4b–9 plan, with its disposition. "Owned" rows name the phase plan that already fixes it.

| Ledger item | Finding | Disposition |
|---|---|---|
| P00-2 | `reuseExistingServer` may reuse a stale server | Resolved in Phase 3 (`reuseExistingServer: false`) |
| P00-2 | darwin skip guard for visual specs | **Task 10** |
| P00-2 | 41 MB of PNG baselines in git (LFS?) | Won't fix: moving to LFS rewrites the history of a shared branch; baselines change rarely. Listed in `docs/launch.md` as an owner option |
| P00-2 | `freezeMotion` `animation:none` overrides Playwright's `animations: "disabled"` | Won't fix: intended — every baseline was captured with it; changing it re-baselines everything for no gain |
| P00-1 | brief §14.3 calls `{phone24hHref}`/`{officeHref}` settings fields (they are derived at render) | **Task 13** (brief Change note) |
| P00-1 note | owner must confirm data inconsistencies (office hours written 2 ways; HR phone = Cleaning Partners digits; Accounts phone format) | **Task 13** (`docs/launch.md`) |
| P01-1 | lint boundary globs ts/tsx only; dynamic `import()`/`require` of `server/` from `lib/` not caught | **Task 8** |
| P01-1 | eslint 9.39.5 deprecation warning; drizzle-kit pulls deprecated `@esbuild-kit` | Won't fix: upstream, dev-only; the moderate `esbuild` advisory is below the `--audit-level high` gate and never ships in the image |
| P01-2 | `getSiteEnv` origin-first ordering untested; invalid `NODE_ENV` message | **Task 5** (tests) |
| P01-2 | guard test cwd-dependent/narrow; DATABASE_URL special-char wording | Won't fix: Vitest always runs from the repo root; wording is cosmetic |
| P01-3 | `secretHint` reveals 4 of 5 chars of very short secrets | **Task 5** |
| P01-4 | `reset_probe` test cleanup not in `finally` | Won't fix: test-only; leaves a probe table only after that test already failed |
| P01-4 | advisory unlock in `finally` may mask the migration error | **Task 5** |
| P01-4 | old pool ended under live refs | Won't fix: documented rule "never cache `getDb()` at module scope" (only tests change the URL); README dev notes (Task 13) |
| P01-4 | `pingDb` timeout and migration lock untested | Won't fix: readiness 503 on an unreachable DB is tested (Task 1.5); the lock is Postgres semantics, exercised by the CI image job's double start (migrate runs in every container start) |
| P01-4 | drizzle-orm repo-only lint not enforced | Resolved (Phase 3 lint block); globs widened in **Task 8** |
| P01-4 | raw SQL inserts need an explicit id | Won't fix: convention, added to README dev notes (**Task 13**) |
| P01-5 | `HTTPException` headers dropped (Retry-After) | Owned: Phase 7 ("HTTPException headers are now preserved by `onError`") |
| P01-5 | 413 message always in KB | Won't fix: cosmetic |
| P01-5 | smoke tests should use standalone `server.js`, kill by PID | **Task 10** (Playwright on `server.js`) + **Task 12** (image job) |
| P01-5 | `HTTPException` 5xx branch logs nothing server-side | **Task 6** |
| P01-6 | entrypoint comment wrong; PID-1 `sh` ignores SIGTERM during migrate; `VOLUME` creates anonymous volumes; build-scripts cwd-dependent | **Task 10** |
| P01 launch | Dokploy app must reach the Postgres service (`dokploy-network`) | **Task 13** (`docs/launch.md`) |
| P02 note | XFF spoofing — Traefik must not trust client forwarded headers | **Task 13** (runbook) + **Task 6** (config test) |
| P02-1 | `hasPermission` throws on an undefined action list / prototype-named resource | **Task 5** |
| P02-2 | Better Auth ignores multi-value XFF without `trustedProxies` | **Task 13** runbook (Traefik overwrites XFF → single value; falls back to `X-Real-Ip`); config pinned by **Task 6** test |
| P02-2 | http `BETTER_AUTH_URL` in production → cookies without `Secure` | **Task 5** |
| P02-2 | missing tests: reset revokes sessions, 12-char boundary, 128 max, `__Secure-` names on https | **Task 7** |
| P02-2 | sliding 7-day session = inactivity timeout (document); `tokens.ts` uses `internalAdapter` (comment) | **Task 13** (runbook); comment: won't fix (code already says so) |
| P02-3 | `auditAuthEvent` fails open (console only) — alert hook | Won't fix: deliberate — an audit outage must not lock people out; runbook tells the operator to watch for `[audit]` log lines (**Task 13**) |
| P02-3 | sliding-session `Set-Cookie` dropped by the DAL `getSession` | Won't fix: worst case a user signs in again 7 days after sign-in, which is the spec's session length |
| P02-3 | 2FA lockout failure row loses the user; wrong 2FA code during enrolment not audited | Won't fix: Better Auth consumes the challenge before our hook; low value |
| P02-4 | unban audits when the user was not banned | **Task 7** |
| P02-4 | `react-email` pulls its CLI tree into prod deps | Won't fix: the standalone trace ships only imported files; covered by the `--prod` audit gate (**Task 6**) |
| P02-4 | `sendResetPassword` timing reveals whether an account exists | **Task 6** |
| P02-4 | future user-delete / owner-recover must take `lockOwners` | **Task 7** (`demo:remove` takes it; `recoverOwner` already does) |
| P02-4 | password-link delete + create not atomic; owner check outside `lockOwners` (TOCTOU) | **Task 7** |
| P02-4 | `listUserSessions` excludes impersonations the user started | Won't fix: the list shows the user's own sessions; "Sign out everywhere" ends both (documented in the runbook) |
| P02-4 | `startImpersonation` owner check outside `lockOwners` | Won't fix: Better Auth's admin plugin re-checks `impersonate-admins` (owners only) at impersonation time |
| P02-4 | promotion to owner doesn't revoke the target's regular sessions | **Task 7** |
| P02-6 | E2E/visual run `next start`, not `server.js` | **Task 10** |
| P02-6 | no-JS E2E `waitForLoadState` may race | **Task 11** |
| P02-7 | `createOwner` not atomic; demo seed writes no audit; `DEMO_PASSWORD` too-short message names `--password` | **Task 7** |
| P02-7 | cookieCache 5 min lets revoked sessions read cookie-cached paths | Won't fix: `requireActor` and the Hono middleware read fresh sessions; runbook note (**Task 13**) |
| P02-7 | future `/api/v1` self-service routes must enforce the impersonation guard | Won't fix here: this phase adds no self-service route (Phase 9 applied it to AI) |
| P02-7 | later `db:seed` must call `assertDisposable` | Resolved (`scripts/seed.ts`) |
| P03 carry | smoke-test `node scripts/dist/seed.mjs` in the image (sharp, `public/images`) | **Task 12** (image job) |
| P03-1 | `contact.operationsExtension` unused ("Ext 2" literal) | Won't fix: design frozen; the literal is editable in its own string |
| P03-1 | `httpUrl` accepts inner C0 controls (NUL → DB error, not 422) | **Task 5** |
| P03-2 | no CHECK for pages/services status, `scheduled ⇒ scheduled_at`, composite indexes | Won't fix: Zod + services enforce them; tables are tiny (dozens of rows) |
| P03-3 | eslint boundary should include `templates/registry.ts` | **Task 8** |
| P03-3 | inventory test cwd path; hero stat drift; type-only z import; value-level fixture-vs-inventory test | Won't fix: Vitest root fixed; the editor composes stat values (Phase 4); the visual diff pins values |
| P03-4 | `readStaticMedia` path containment | Owned: Phase 6 |
| P03-5 | missing seed author silently `null` | Won't fix: fixtures are constants; a missing byline fails the visual diff |
| P03-5 | re-running seed in prod restores deleted rows | **Task 13** runbook: `--allow-production` on the first deploy only |
| P03-5 | restored `sortOrder` collisions; tests for edit survival/settings version/rollback | Won't fix: insert-only seed is covered by the idempotency test |
| P03-6 | ESLint drizzle glob ts-only; routes→repo regex gaps | **Task 8** |
| P03-6 | untested tags; `listArticles` limit in JS; separate cache entries | Won't fix: tags are covered through the public-query tests; data volume is tiny |
| P03-7 | partial placeholders in hrefs | Resolved in Phase 4 (server `link` schema ruling) |
| P03-7 | `telHref` "(0)" trunk prefix; `UNSAFE_HREF_FALLBACK` location | Won't fix: no seeded number uses "(0)"; file location is cosmetic |
| P03-8 | `as SiteSources` cast; titles containing `{email}` get interpolated | Won't fix: cast is test-fixture only; `{…}` in copy is the documented template rule (runbook editing note) |
| P03-9 | visual vs e2e seed guards differ | **Task 10** |
| P03-9 | cached `null`s survive an out-of-process seed | **Task 13** runbook: restart the app after seeding |
| P03-9 | cold-cache media one query per id; `loadSiteSources` loads all articles | Won't fix: cached; dozens of rows |
| P03-9 | `next start` standalone warning; double seeding in E2E | Warning: **Task 10**; double seeding: won't fix (visual and E2E projects stay independent) |
| P03-10 | privacy/terms page files duplicated; retry button untested; error page lacks header/footer | Won't fix: two tiny files; DB-down page was verified manually in the Phase 3 gate; header data needs the DB that is down |
| P03-10 | E2E "Terms" link match not exact | **Task 11** |
| P04-1 | sidebar section label id uses label text | Resolved (04b: index-based ids in `nav-main.tsx`) |
| P04-1 | scroll-padding for sticky header (WCAG 2.4.11) | Owned: 04b Tasks 8/12 |
| P04-1 carry | sheet focus trap/return check in E2E | **Task 11** |
| P04-2 | palette error `<p role=alert>` inside the listbox | **Task 9** |
| P04-3 | redundant `orderBy` in pages repo; audit coalesce window uses app clock | Won't fix: harmless; container clock is NTP-synced |
| P04-3 | `pgErrorCode` walks one cause level | **Task 5** |
| P04-4 | "0. " normalization blocks Backspace undo; start plugin walks the doc per keystroke | Won't fix: editor edge case; article sizes are small |
| P04-5 | list-item group errors lack `aria-describedby`; `GroupErrors` duplicate keys | **Task 9** |
| P04-5 | `clearErrors` on a vanished server path wipes the client error until revalidate | Won't fix: the next save re-validates |
| P04-6 | missing `Sec-Fetch-Site` → 403 blocks Safari < 16.4 preview | Won't fix: admin-only; negligible share |
| P04-8 | loading `aria-label` on a generic div | **Task 9** |
| P04-8 | blocked-key restore test uses a random id; DOM coverage for other keys | Won't fix: test-strength only |
| P04-9 | `escapeLike` duplicated 6× | **Task 8** |
| P04-9 | reorder audit entityType; N UPDATEs; last-write-wins; services 23505 not constraint-checked; loose unions; reorder max 500 vs pageSize 100; untested races | Won't fix: ≤ 100 rows per collection; `slug` is the only unique column besides the uuid PK |
| P04-10 | slug change reload loses a pending autosave edit | **Task 9** |
| P04-10 | empty in-range page race; delete flow untested | Won't fix: covered by list re-fetch; low value |
| P04-7 | queued flush after 409 re-sends; overwrite with missing `current` closes silently; no "publish again" hint; restore 409 only toasts; list invalidation misses param keys | **Task 9** |
| P04-13 | stale `path=/` sidebar cookie (dev); `SidebarMenuAction` `md:opacity-0` | Won't fix: dev-browser artefact; the component is unused by the admin |
| P04b-3 | CI: `next typegen` before `typecheck` | **Task 12** |
| P04b-4 | opening the user menu clears the dock's sign-out error | **Task 9** |
| P04b-4 | sign-out context value not memoised | Won't fix: negligible re-renders |
| Phase 5 carry | scheduler must reach loopback in production | **Task 12** (image job) + **Task 13** runbook |
| Phase 6/7 carry | CI integration + E2E need Mailpit | **Task 12** |
| Phase 6 | R2 private bucket, token Object Read & Write, no public URL | **Task 13** (`docs/launch.md`) |
| Phase 7 | consent basis (no checkbox), Turnstile Invisible, real `settings.leads.recipients` | **Task 13** (`docs/launch.md`) |
| Phase 9 | AI provider receives enquiry text + names (GDPR processor) | **Task 13** (`docs/launch.md`) |
| Controller | `7a7acd8` swept another task's staged files | Won't fix: no history rewrite on the shared branch; noted in the final report |

---

### Task 1: Backups — dump + manifest, backup store, `backup` script, daily job, dashboard item (master Task 10.1, part 1)

**Files:**
- Create: `server/lib/backup/pg-tools.ts`, `server/lib/backup/dump.ts`, `server/lib/backup/store.ts`, `server/lib/backup/index.ts`, `server/lib/jobs/backup.ts`, `scripts/backup.ts`
- Modify: `server/lib/jobs/index.ts` (append `backupJob` to `RECURRING_JOBS`), `scripts/build-scripts.ts` (`SCRIPT_ENTRIES` + `"backup"`), `package.json` (`"backup"` script), `lib/schemas/api/dashboard.ts` (`NextUpItem.id` + `"failed-jobs"`), `server/modules/dashboard/repo.ts` (`listJobProblems`), `server/modules/dashboard/service.ts` (Next-up item)
- Test: `tests/unit/backup/pg-tools.test.ts`, `tests/unit/backup/store.test.ts`, `tests/integration/backup/backup.test.ts`, `tests/integration/dashboard/failed-jobs.test.ts`

**Interfaces:**
- Consumes: `getEnv` (`server/env.ts`); `parse` (`pg-connection-string`); `Client` (`pg`); Phase 6 `readIntegrationConfig("integrations.r2")`, `createR2Client(config)`, `R2Config`; `@aws-sdk/client-s3` commands `PutObjectCommand`, `ListObjectsV2Command`, `GetObjectCommand`, `DeleteObjectCommand`; Phase 5 `JobDefinition`, `RECURRING_JOBS`; Phase 4 Task 11 `getDashboard`, `NextUpItem`, dashboard `repo`.
- Produces:

```ts
// server/lib/backup/pg-tools.ts
export type PgTool = "pg_dump" | "pg_restore"
export function pgEnv(url: string, base?: NodeJS.ProcessEnv): NodeJS.ProcessEnv   // PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE/PGSSLMODE; password never on argv
export function withDatabase(url: string, database: string): string               // same server, other database
export function runPgTool(tool: PgTool, args: readonly string[], url: string): Promise<void>  // rejects with a redacted, readable Error
// server/lib/backup/dump.ts
export const DUMPED_SCHEMAS: readonly ["public", "drizzle"]
export type BackupManifest = { version: 1; createdAt: string; database: string; file: string; bytes: number; sha256: string; counts: Record<string, number>; excludedData: string[] }
export function quoteIdent(name: string): string
export async function countRows(client: Client): Promise<Record<string, number>>  // "schema.table" → rows
export async function dumpDatabase(url: string, file: string, opts?: { excludeTableData?: readonly string[]; now?: Date }): Promise<BackupManifest>
// server/lib/backup/store.ts
export const BACKUP_PREFIX = "backups/"; export const BACKUPS_KEPT = 14
export type BackupObject = { name: string; bytes: number; createdAt: Date }
export type BackupStore = { kind: "disk" | "r2"; location: string; put(name: string, file: string): Promise<void>; list(): Promise<BackupObject[]> /* name desc = newest first */; download(name: string, file: string): Promise<void>; delete(name: string): Promise<void> }
export function defaultBackupsDir(): string            // "/data/backups" when /data exists, else <cwd>/.data/backups
export function diskBackupStore(dir?: string): BackupStore
export function r2BackupStore(config: R2Config, client?: S3Client): BackupStore
export async function getBackupStore(): Promise<BackupStore>   // R2 when integrations.r2 is saved, else disk
export async function pruneBackups(store: BackupStore, keep?: number): Promise<string[]>  // deleted .dump names (their .json too)
// server/lib/backup/index.ts
export const BACKUP_SKIPPED_DATA: readonly ["public.rate_limits", "public.public_rate_limits"]
export function backupBaseName(database: string, now: Date): string   // "sp-<db>-20261016T120000Z"
export type BackupResult = { name: string; store: "disk" | "r2"; location: string; bytes: number; pruned: string[]; manifest: BackupManifest }
export async function runBackup(opts?: { url?: string; store?: BackupStore; now?: Date; keep?: number }): Promise<BackupResult>
// server/lib/jobs/backup.ts
export const BACKUP_INTERVAL_MS = 86_400_000
export const backupJob: JobDefinition    // name/key "backup", daily; a failure throws → scheduler retries in 60 s
// lib/schemas/api/dashboard.ts
NextUpItem["id"] += "failed-jobs"
// server/modules/dashboard/repo.ts
export async function listJobProblems(db: DbOrTx): Promise<{ name: string; lastError: string }[]>
// CLI
pnpm backup                         (dev)   |   node scripts/dist/backup.mjs   (container)
```

Rules: the dump is `pg_dump --format=custom --no-owner --no-privileges --snapshot=<id>` where `<id>` comes from `pg_export_snapshot()` inside a `REPEATABLE READ READ ONLY` transaction that also counts every table of the `public` and `drizzle` schemas — so the manifest counts are exactly the dump's content. Excluded tables count as 0. The connection password goes to the child through `PGPASSWORD`, never argv; stderr in errors has the password replaced by `***`. Retention keeps the newest 14 `.dump` files (by name, which embeds the UTC stamp) and deletes older ones with their `.json`. The job runs daily on the Phase 5 scheduler; the first run is on the first tick after a deploy.

- [ ] **Step 1: Write the failing tests**

`tests/unit/backup/pg-tools.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"

import { pgEnv, runPgTool, withDatabase } from "@/server/lib/backup/pg-tools"

const URL_WITH_PASSWORD = "postgres://backup:s3cr%40t@db.internal:5433/sp_prod?sslmode=require"

describe("pgEnv", () => {
  it("moves every connection part into libpq variables (password never on argv)", () => {
    const env = pgEnv(URL_WITH_PASSWORD, { PATH: "/usr/bin", PGPASSWORD: "stale" })
    expect(env).toMatchObject({
      PATH: "/usr/bin",
      PGHOST: "db.internal",
      PGPORT: "5433",
      PGUSER: "backup",
      PGPASSWORD: "s3cr@t",
      PGDATABASE: "sp_prod",
      PGSSLMODE: "require",
      PGCONNECT_TIMEOUT: "10",
    })
  })

  it("drops inherited libpq variables the URL does not set", () => {
    const env = pgEnv("postgres://sp@127.0.0.1/sp_dev", {
      PGPASSWORD: "leaked",
      PGSSLMODE: "disable",
    })
    expect(env.PGPASSWORD).toBeUndefined()
    expect(env.PGSSLMODE).toBeUndefined()
  })
})

describe("withDatabase", () => {
  it("points the same server at another database", () => {
    expect(withDatabase("postgres://sp:sp@127.0.0.1:5432/sp_test", "sp_test_restore_drill")).toBe(
      "postgres://sp:sp@127.0.0.1:5432/sp_test_restore_drill"
    )
  })
})

describe("runPgTool", () => {
  const savedPath = process.env.PATH
  afterEach(() => {
    process.env.PATH = savedPath
  })

  it("explains a missing client binary", async () => {
    process.env.PATH = "/nonexistent-sp-test"
    await expect(
      runPgTool("pg_dump", ["--version"], "postgres://sp@127.0.0.1/sp_test")
    ).rejects.toThrow(
      "pg_dump was not found on PATH: install the PostgreSQL 17 client tools"
    )
  })
})
```

`tests/unit/backup/store.test.ts`:

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { S3Client } from "@aws-sdk/client-s3"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { R2Config } from "@/lib/schemas/integrations"
import {
  BACKUP_PREFIX,
  diskBackupStore,
  pruneBackups,
  r2BackupStore,
} from "@/server/lib/backup/store"

let dir: string
let src: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sp-store-"))
  src = join(dir, "src.bin")
  await writeFile(src, "PGDMP-fake")
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const stamp = (day: number) =>
  `sp-sp_test-202610${String(day).padStart(2, "0")}T020000Z`

describe("disk backup store", () => {
  it("puts, lists newest first, downloads and deletes", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    await store.put(`${stamp(1)}.dump`, src)
    await store.put(`${stamp(2)}.dump`, src)
    expect((await store.list()).map((o) => o.name)).toEqual([
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])
    const out = join(dir, "out.bin")
    await store.download(`${stamp(1)}.dump`, out)
    expect(await readFile(out, "utf8")).toBe("PGDMP-fake")
    await store.delete(`${stamp(1)}.dump`)
    expect((await store.list()).map((o) => o.name)).toEqual([`${stamp(2)}.dump`])
  })

  it("lists nothing when the directory does not exist yet", async () => {
    expect(await diskBackupStore(join(dir, "missing")).list()).toEqual([])
  })

  it("rejects names that could leave the directory", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    await expect(store.put("../escape.dump", src)).rejects.toThrow(
      "Invalid backup file name"
    )
    await expect(store.download("a/b.dump", src)).rejects.toThrow(
      "Invalid backup file name"
    )
  })

  it("keeps the newest 14 dumps and deletes older dumps with their manifests", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    for (let day = 1; day <= 16; day++) {
      await store.put(`${stamp(day)}.dump`, src)
      await store.put(`${stamp(day)}.json`, src)
    }
    expect(await pruneBackups(store, 14)).toEqual([
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])
    const names = (await store.list()).map((o) => o.name)
    expect(names.filter((n) => n.endsWith(".dump"))).toHaveLength(14)
    expect(names).not.toContain(`${stamp(1)}.json`)
    expect(names).toContain(`${stamp(3)}.json`)
  })
})

describe("R2 backup store", () => {
  const config = {
    accountId: "acc",
    jurisdiction: "default",
    bucket: "sp-media",
    accessKeyId: "key",
    secretAccessKey: "secret",
  } as R2Config

  it("stores under backups/ and pages through the listing", async () => {
    const sent: { name: string; input: Record<string, unknown> }[] = []
    const send = vi.fn(async (command: { input: Record<string, unknown> }) => {
      const name = command.constructor.name
      sent.push({ name, input: command.input })
      if (name === "ListObjectsV2Command")
        return command.input.ContinuationToken
          ? {
              Contents: [{ Key: `${BACKUP_PREFIX}${stamp(1)}.dump`, Size: 5, LastModified: new Date() }],
              IsTruncated: false,
            }
          : {
              Contents: [
                { Key: `${BACKUP_PREFIX}${stamp(2)}.dump`, Size: 5, LastModified: new Date() },
                { Key: `${BACKUP_PREFIX}nested/x.dump`, Size: 5, LastModified: new Date() },
              ],
              IsTruncated: true,
              NextContinuationToken: "t2",
            }
      if (name === "GetObjectCommand")
        return { Body: { transformToByteArray: async () => new TextEncoder().encode("PGDMP-r2") } }
      return {}
    })
    const store = r2BackupStore(config, { send } as unknown as S3Client)
    expect(store.location).toBe("r2://sp-media/backups/")

    await store.put(`${stamp(2)}.dump`, src)
    expect(sent.at(-1)).toMatchObject({
      name: "PutObjectCommand",
      input: { Bucket: "sp-media", Key: `backups/${stamp(2)}.dump` },
    })

    expect((await store.list()).map((o) => o.name)).toEqual([
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])

    const out = join(dir, "r2.bin")
    await store.download(`${stamp(2)}.dump`, out)
    expect(await readFile(out, "utf8")).toBe("PGDMP-r2")

    await store.delete(`${stamp(1)}.dump`)
    expect(sent.at(-1)).toMatchObject({
      name: "DeleteObjectCommand",
      input: { Key: `backups/${stamp(1)}.dump` },
    })
  })
})
```

`tests/integration/backup/backup.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { runBackup } from "@/server/lib/backup"
import type { BackupManifest } from "@/server/lib/backup/dump"
import { diskBackupStore } from "@/server/lib/backup/store"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { createUser } from "../helpers/auth"

let dir: string
beforeEach(async () => {
  await resetDb()
  dir = await mkdtemp(join(tmpdir(), "sp-backup-it-"))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe("runBackup (spec §14 backup)", () => {
  it("writes a custom-format dump and a manifest with the snapshot's row counts", async () => {
    await createUser({ roles: ["editor"] })
    await createUser({ roles: ["viewer"] })
    const store = diskBackupStore(dir)
    const result = await runBackup({
      url: TEST_DATABASE_URL,
      store,
      now: new Date("2026-10-16T12:00:00Z"),
    })
    expect(result).toMatchObject({
      name: "sp-sp_test-20261016T120000Z.dump",
      store: "disk",
      location: dir,
      pruned: [],
    })
    const dump = await readFile(join(dir, result.name))
    expect(dump.subarray(0, 5).toString("latin1")).toBe("PGDMP")
    const manifest = JSON.parse(
      await readFile(join(dir, "sp-sp_test-20261016T120000Z.json"), "utf8")
    ) as BackupManifest
    expect(manifest).toMatchObject({
      version: 1,
      database: "sp_test",
      file: result.name,
      bytes: dump.length,
      excludedData: ["public.rate_limits", "public.public_rate_limits"],
    })
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(manifest.counts["public.users"]).toBe(2)
    expect(manifest.counts["public.rate_limits"]).toBe(0)
    expect(manifest.counts["drizzle.__drizzle_migrations"]).toBeGreaterThan(0)
  })

  it("prunes beyond the kept number", async () => {
    const store = diskBackupStore(dir)
    for (let hour = 0; hour < 3; hour++)
      await runBackup({
        url: TEST_DATABASE_URL,
        store,
        keep: 2,
        now: new Date(Date.UTC(2026, 9, 16, hour)),
      })
    const dumps = (await store.list())
      .map((o) => o.name)
      .filter((n) => n.endsWith(".dump"))
    expect(dumps).toEqual([
      "sp-sp_test-20261016T020000Z.dump",
      "sp-sp_test-20261016T010000Z.dump",
    ])
  })
})
```

`tests/integration/dashboard/failed-jobs.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { jobs } from "@/server/db/schema"
import type { Actor } from "@/server/lib/actor"
import { getDashboard } from "@/server/modules/dashboard/service"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

const actorOf = (userId: string, roles: Actor["roles"]): Actor => ({
  userId,
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})

beforeEach(resetDb)

describe("dashboard Next up: failed background jobs (spec §12)", () => {
  it("lists failing jobs for owners/admins only, and nothing when all are fine", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const editor = await createUser({ roles: ["editor"] })
    const ownerActor = actorOf(owner.id, ["owner"])
    expect(
      (await getDashboard(ownerActor)).nextUp.find((i) => i.id === "failed-jobs")
    ).toBeUndefined()

    await getDb().insert(jobs).values({
      name: "backup",
      key: "backup",
      runAt: new Date(),
      lastError: "pg_dump exited with code 1: connection refused",
    })
    const item = (await getDashboard(ownerActor)).nextUp.find(
      (i) => i.id === "failed-jobs"
    )
    expect(item).toMatchObject({
      title: "Background jobs need attention",
      href: "/admin/settings/integrations",
      done: false,
    })
    expect(item?.description).toContain("backup: pg_dump exited with code 1")
    expect(
      (await getDashboard(actorOf(editor.id, ["editor"]))).nextUp.find(
        (i) => i.id === "failed-jobs"
      )
    ).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/backup && pnpm test:integration tests/integration/backup tests/integration/dashboard/failed-jobs.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/backup/pg-tools"` (and `…/store`, `@/server/lib/backup`); the dashboard test fails on `item` being `undefined`.

- [ ] **Step 3: Implement**

`server/lib/backup/pg-tools.ts`:

```ts
import "server-only"

import { spawn } from "node:child_process"

import { parse } from "pg-connection-string"

export type PgTool = "pg_dump" | "pg_restore"

const LIBPQ_VARS = [
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "PGSSLMODE",
] as const

/**
 * libpq environment for one connection string. pg_dump/pg_restore get the
 * password through PGPASSWORD, never on their command line (visible in
 * `ps` and in error output). Inherited PG* variables are dropped first so a
 * stray PGPASSWORD can never reach another server.
 */
export function pgEnv(
  url: string,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const config = parse(url) as Record<string, unknown>
  const env: NodeJS.ProcessEnv = {
    ...base,
    PGCONNECT_TIMEOUT: "10",
    PGAPPNAME: "sp-ops",
  }
  for (const key of LIBPQ_VARS) delete env[key]
  const set = (key: (typeof LIBPQ_VARS)[number], value: unknown) => {
    if (typeof value === "string" && value !== "") env[key] = value
  }
  set("PGHOST", config.host)
  set("PGPORT", config.port)
  set("PGUSER", config.user)
  set("PGPASSWORD", config.password)
  set("PGDATABASE", config.database)
  set("PGSSLMODE", config.sslmode)
  return env
}

/** The same server and credentials, another database (scratch restores). */
export function withDatabase(url: string, database: string): string {
  const target = new URL(url)
  target.pathname = `/${encodeURIComponent(database)}`
  return target.toString()
}

/**
 * Runs pg_dump/pg_restore against `url` (connection via pgEnv). Resolves on
 * exit code 0; otherwise rejects with the tail of stderr, the password
 * replaced by ***.
 */
export function runPgTool(
  tool: PgTool,
  args: readonly string[],
  url: string
): Promise<void> {
  const password = (parse(url) as { password?: string }).password
  return new Promise((resolvePromise, reject) => {
    const child = spawn(tool, args, {
      env: pgEnv(url),
      stdio: ["ignore", "ignore", "pipe"],
    })
    let stderr = ""
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000)
    })
    child.on("error", (err: NodeJS.ErrnoException) => {
      reject(
        err.code === "ENOENT"
          ? new Error(
              `${tool} was not found on PATH: install the PostgreSQL 17 client tools (the production image includes them)`
            )
          : err
      )
    })
    child.on("close", (code) => {
      if (code === 0) return resolvePromise()
      const redacted = password ? stderr.replaceAll(password, "***") : stderr
      const detail = redacted.trim().slice(-500)
      reject(
        new Error(`${tool} exited with code ${code}${detail ? `: ${detail}` : ""}`)
      )
    })
  })
}
```

`server/lib/backup/dump.ts`:

```ts
import "server-only"

import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import { basename } from "node:path"

import { Client } from "pg"
import { parse } from "pg-connection-string"

import { runPgTool } from "./pg-tools"

/** App tables and Drizzle's migration bookkeeping. */
export const DUMPED_SCHEMAS = ["public", "drizzle"] as const

export type BackupManifest = {
  version: 1
  createdAt: string
  database: string
  file: string
  bytes: number
  sha256: string
  /** "schema.table" → rows in the dump (0 for tables whose data is excluded). */
  counts: Record<string, number>
  excludedData: string[]
}

export const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`

/** Rows per table of DUMPED_SCHEMAS, read in the client's current transaction (if any). */
export async function countRows(
  client: Client
): Promise<Record<string, number>> {
  const { rows } = await client.query<{
    schemaname: string
    tablename: string
  }>(
    "select schemaname, tablename from pg_tables where schemaname = any($1) order by 1, 2",
    [[...DUMPED_SCHEMAS]]
  )
  const counts: Record<string, number> = {}
  for (const { schemaname, tablename } of rows) {
    const result = await client.query<{ n: number }>(
      `select count(*)::int as n from ${quoteIdent(schemaname)}.${quoteIdent(tablename)}`
    )
    counts[`${schemaname}.${tablename}`] = result.rows[0].n
  }
  return counts
}

/**
 * pg_dump (custom format) of `url` into `file`. A REPEATABLE READ snapshot is
 * exported and handed to pg_dump, and the row counts are read in that same
 * snapshot, so the manifest describes exactly what the dump contains.
 */
export async function dumpDatabase(
  url: string,
  file: string,
  opts: { excludeTableData?: readonly string[]; now?: Date } = {}
): Promise<BackupManifest> {
  const excluded = [...(opts.excludeTableData ?? [])]
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()
  try {
    await client.query("begin isolation level repeatable read read only")
    const snapshot = await client.query<{ id: string }>(
      "select pg_export_snapshot() as id"
    )
    const counts = await countRows(client)
    for (const table of excluded) if (table in counts) counts[table] = 0
    await runPgTool(
      "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        `--snapshot=${snapshot.rows[0].id}`,
        ...excluded.map((table) => `--exclude-table-data=${table}`),
        `--file=${file}`,
      ],
      url
    )
    await client.query("commit")
    const bytes = (await stat(file)).size
    const sha256 = createHash("sha256")
      .update(await readFile(file))
      .digest("hex")
    return {
      version: 1,
      createdAt: (opts.now ?? new Date()).toISOString(),
      database: parse(url).database ?? "",
      file: basename(file),
      bytes,
      sha256,
      counts,
      excludedData: excluded,
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}
```

`server/lib/backup/store.ts`:

```ts
import "server-only"

import { existsSync } from "node:fs"
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { join, resolve } from "node:path"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3"

import type { R2Config } from "@/lib/schemas/integrations"
import { createR2Client } from "@/server/lib/r2-client"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

/** Backups live beside media in the R2 bucket, under their own prefix. */
export const BACKUP_PREFIX = "backups/"
export const BACKUPS_KEPT = 14

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/

export type BackupObject = { name: string; bytes: number; createdAt: Date }

export type BackupStore = {
  kind: "disk" | "r2"
  /** For messages: "/data/backups" or "r2://<bucket>/backups/". */
  location: string
  put(name: string, file: string): Promise<void>
  /** Every stored file, newest first (names embed the UTC stamp). */
  list(): Promise<BackupObject[]>
  download(name: string, file: string): Promise<void>
  /** A missing file is not an error. */
  delete(name: string): Promise<void>
}

function checkName(name: string): string {
  if (!NAME.test(name) || name.includes(".."))
    throw new Error(`Invalid backup file name: ${name}`)
  return name
}

const newestFirst = (a: BackupObject, b: BackupObject) =>
  b.name.localeCompare(a.name)

/** The Docker volume when present (spec D9), else the repo's .data dir. */
export function defaultBackupsDir(): string {
  return existsSync("/data")
    ? "/data/backups"
    : resolve(process.cwd(), ".data/backups")
}

export function diskBackupStore(dir = defaultBackupsDir()): BackupStore {
  return {
    kind: "disk",
    location: dir,
    async put(name, file) {
      await mkdir(dir, { recursive: true })
      await copyFile(file, join(dir, checkName(name)))
    },
    async list() {
      if (!existsSync(dir)) return []
      const names = (await readdir(dir)).filter((name) => NAME.test(name))
      const items = await Promise.all(
        names.map(async (name) => {
          const info = await stat(join(dir, name))
          return { name, bytes: info.size, createdAt: info.mtime }
        })
      )
      return items.sort(newestFirst)
    },
    async download(name, file) {
      await copyFile(join(dir, checkName(name)), file)
    },
    async delete(name) {
      await rm(join(dir, checkName(name)), { force: true })
    },
  }
}

export function r2BackupStore(
  config: R2Config,
  client: S3Client = createR2Client(config)
): BackupStore {
  const key = (name: string) => `${BACKUP_PREFIX}${checkName(name)}`
  return {
    kind: "r2",
    location: `r2://${config.bucket}/${BACKUP_PREFIX}`,
    async put(name, file) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key(name),
          Body: await readFile(file),
          ContentType: name.endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
        })
      )
    },
    async list() {
      const items: BackupObject[] = []
      let token: string | undefined
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: BACKUP_PREFIX,
            ContinuationToken: token,
          })
        )
        for (const object of page.Contents ?? []) {
          const name = (object.Key ?? "").slice(BACKUP_PREFIX.length)
          if (NAME.test(name))
            items.push({
              name,
              bytes: object.Size ?? 0,
              createdAt: object.LastModified ?? new Date(0),
            })
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (token)
      return items.sort(newestFirst)
    },
    async download(name, file) {
      const object = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key(name) })
      )
      if (!object.Body) throw new Error(`Backup ${name} is empty`)
      await writeFile(file, await object.Body.transformToByteArray())
    },
    async delete(name) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key(name) })
      )
    },
  }
}

/** R2 once Settings ▸ Integrations ▸ R2 is saved; the /data volume until then (spec D9). */
export async function getBackupStore(): Promise<BackupStore> {
  const r2 = await readIntegrationConfig("integrations.r2")
  return r2 ? r2BackupStore(r2) : diskBackupStore()
}

/** Deletes every .dump beyond the newest `keep` (and its .json manifest). */
export async function pruneBackups(
  store: BackupStore,
  keep = BACKUPS_KEPT
): Promise<string[]> {
  const dumps = (await store.list()).filter((o) => o.name.endsWith(".dump"))
  const old = dumps.slice(keep)
  for (const dump of old) {
    await store.delete(dump.name)
    await store.delete(dump.name.replace(/\.dump$/, ".json"))
  }
  return old.map((dump) => dump.name)
}
```

`server/lib/backup/index.ts`:

```ts
import "server-only"

import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parse } from "pg-connection-string"

import { getEnv } from "@/server/env"

import { type BackupManifest, dumpDatabase } from "./dump"
import {
  BACKUPS_KEPT,
  type BackupStore,
  getBackupStore,
  pruneBackups,
} from "./store"

/** Ephemeral counters: their rows are not worth restoring. */
export const BACKUP_SKIPPED_DATA = [
  "public.rate_limits",
  "public.public_rate_limits",
] as const

/** "sp-<db>-20261016T120000Z" (UTC, sortable). */
export function backupBaseName(database: string, now: Date): string {
  const safe = database.replace(/[^A-Za-z0-9_-]/g, "_") || "db"
  const stamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "")
  return `sp-${safe}-${stamp}`
}

export type BackupResult = {
  name: string
  store: "disk" | "r2"
  location: string
  bytes: number
  pruned: string[]
  manifest: BackupManifest
}

/** Spec §14: dump → manifest → store (R2 or /data/backups) → keep the newest 14. */
export async function runBackup(
  opts: { url?: string; store?: BackupStore; now?: Date; keep?: number } = {}
): Promise<BackupResult> {
  const url = opts.url ?? getEnv().DATABASE_URL
  const now = opts.now ?? new Date()
  const store = opts.store ?? (await getBackupStore())
  const dir = await mkdtemp(join(tmpdir(), "sp-backup-"))
  try {
    const base = backupBaseName(parse(url).database ?? "db", now)
    const dumpFile = join(dir, `${base}.dump`)
    const manifest = await dumpDatabase(url, dumpFile, {
      excludeTableData: BACKUP_SKIPPED_DATA,
      now,
    })
    const manifestFile = join(dir, `${base}.json`)
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    await store.put(`${base}.dump`, dumpFile)
    await store.put(`${base}.json`, manifestFile)
    const pruned = await pruneBackups(store, opts.keep ?? BACKUPS_KEPT)
    return {
      name: `${base}.dump`,
      store: store.kind,
      location: store.location,
      bytes: manifest.bytes,
      pruned,
      manifest,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
```

`server/lib/jobs/backup.ts`:

```ts
import "server-only"

import { runBackup } from "@/server/lib/backup"

import type { JobDefinition } from "./index"

export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Daily DB backup (spec §12). A failure throws: the scheduler records it in
 * jobs.last_error (dashboard "Next up") and retries after 60 s.
 */
export const backupJob: JobDefinition = {
  name: "backup",
  key: "backup",
  everyMs: BACKUP_INTERVAL_MS,
  async run() {
    await runBackup()
    return {}
  },
}
```

`server/lib/jobs/index.ts` — import `backupJob` from `./backup` and append it to `RECURRING_JOBS` (after the entries Phases 5 and 7 added; keep their order).

`scripts/backup.ts`:

```ts
// One DB backup now (the app also runs one daily, spec §12/§14).
//   dev:       pnpm backup
//   container: node scripts/dist/backup.mjs
// Writes sp-<db>-<UTC stamp>.dump + .json to R2 (backups/) when
// Settings ▸ Integrations ▸ R2 is saved, else to /data/backups; keeps 14.
import { runBackup } from "@/server/lib/backup"

import { runScript } from "./lib/run-script"

await runScript("backup", async () => {
  const result = await runBackup()
  const kb = Math.ceil(result.bytes / 1024)
  console.log(
    `[backup] ${result.name} (${kb} KB) → ${result.location}; ${Object.keys(result.manifest.counts).length} tables`
  )
  if (result.pruned.length)
    console.log(`[backup] removed old backups: ${result.pruned.join(", ")}`)
})
```

`scripts/build-scripts.ts` — append `"backup"` to `SCRIPT_ENTRIES`.

`package.json` — add `"backup": "pnpm tsx:server scripts/backup.ts"` after `"db:seed"`.

`lib/schemas/api/dashboard.ts` — extend the union:

```ts
export type NextUpItem = {
  id:
    | "smtp"
    | "r2"
    | "two-factor"
    | "review"
    | "unassigned-leads"
    | "failed-jobs"
  title: string
  description: string
  href: string
  done: boolean
}
```

(keep any ids later phases added; only `"failed-jobs"` is new).

`server/modules/dashboard/repo.ts` — add (import `isNotNull`, `asc` from `drizzle-orm` and `jobs` from `@/server/db/schema` if not yet imported):

```ts
/** Jobs whose last run failed or warned (spec §12: surfaced on the dashboard). */
export async function listJobProblems(
  db: DbOrTx
): Promise<{ name: string; lastError: string }[]> {
  const rows = await db
    .select({ name: jobs.name, lastError: jobs.lastError })
    .from(jobs)
    .where(isNotNull(jobs.lastError))
    .orderBy(asc(jobs.name))
  return rows.map((row) => ({ name: row.name, lastError: row.lastError ?? "" }))
}
```

`server/modules/dashboard/service.ts` — in `getDashboard`, add to the `Promise.all` list `can({ integration: ["read"] }) ? repo.listJobProblems(db) : null` (destructured as `jobProblems`), and after the existing Next-up items:

```ts
  if (jobProblems && jobProblems.length > 0)
    nextUp.push({
      id: "failed-jobs",
      title: "Background jobs need attention",
      description: jobProblems
        .map((job) => `${job.name}: ${job.lastError.slice(0, 160)}`)
        .join(" · "),
      href: "/admin/settings/integrations",
      done: false,
    })
```

(`.data/` is already in `.gitignore`, so local backups are never committed.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/backup tests/unit/scripts-bundle.test.ts && pnpm test:integration tests/integration/backup tests/integration/dashboard`
Expected: PASS (the bundle test now emits `backup.mjs` too). Needs `pg_dump` on PATH (`brew install libpq` locally; CI installs the PostgreSQL 17 client).

Run: `pnpm backup` (Postgres up, `.env.development`)
Expected: `[backup] sp-sp_dev-<stamp>.dump (<n> KB) → <repo>/.data/backups; <n> tables`.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write server/lib/backup server/lib/jobs scripts/backup.ts scripts/build-scripts.ts lib/schemas/api/dashboard.ts server/modules/dashboard tests/unit/backup tests/integration/backup tests/integration/dashboard
git add server/lib/backup server/lib/jobs/backup.ts server/lib/jobs/index.ts scripts/backup.ts scripts/build-scripts.ts package.json lib/schemas/api/dashboard.ts server/modules/dashboard tests/unit/backup tests/integration/backup tests/integration/dashboard
git commit -m "$(cat <<'EOF'
feat(ops): daily database backups to R2 or the data volume

pg_dump in an exported snapshot plus a manifest of row counts and a
checksum; keeps the newest 14; pnpm backup / scripts/dist/backup.mjs;
failing jobs show on the dashboard.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Restore drill (master Task 10.1, part 2)

**Files:**
- Create: `server/lib/backup/restore-drill.ts`, `scripts/restore-drill.ts`
- Modify: `scripts/build-scripts.ts` (`SCRIPT_ENTRIES` + `"restore-drill"`), `package.json` (`"restore-drill"`)
- Test: `tests/integration/backup/restore-drill.test.ts`

**Interfaces:**
- Consumes: Task 1 `BackupStore`, `getBackupStore`, `BackupManifest`, `countRows`, `quoteIdent`, `runPgTool`, `withDatabase`, `runBackup`, `diskBackupStore`; `getEnv`.
- Produces:

```ts
// server/lib/backup/restore-drill.ts
export const DRILL_SUFFIX = "_restore_drill"
export type DrillMismatch = { table: string; expected: number; actual: number | null }   // actual null = table missing
export type DrillResult = { backup: string; scratchDatabase: string; tables: number; mismatches: DrillMismatch[]; ok: boolean }
export async function restoreDrill(opts?: { url?: string; store?: BackupStore; keepScratch?: boolean }): Promise<DrillResult>
// CLI
pnpm restore-drill [--keep]   |   node scripts/dist/restore-drill.mjs [--keep]      exit 1 when !ok
```

Rules: picks the newest `.dump` in the store, downloads it and its `.json`, verifies the SHA-256, drops and re-creates `<db>_restore_drill` on the same server (`WITH (FORCE)`), `pg_restore --no-owner --no-privileges --exit-on-error --single-transaction` into it, counts every table and compares with the manifest; drops the scratch DB unless `--keep`. Needs `CREATEDB` on the app's DB role (the Dokploy Postgres user is the owner/superuser — runbook).

- [ ] **Step 1: Write the failing test**

`tests/integration/backup/restore-drill.test.ts`:

```ts
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Client } from "pg"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { runBackup } from "@/server/lib/backup"
import { restoreDrill } from "@/server/lib/backup/restore-drill"
import { diskBackupStore } from "@/server/lib/backup/store"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { createUser } from "../helpers/auth"

let dir: string
beforeEach(async () => {
  await resetDb()
  dir = await mkdtemp(join(tmpdir(), "sp-drill-it-"))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

async function scratchExists(): Promise<boolean> {
  const client = new Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    const { rowCount } = await client.query(
      "select 1 from pg_database where datname = 'sp_test_restore_drill'"
    )
    return rowCount === 1
  } finally {
    await client.end()
  }
}

describe("restoreDrill (spec §14)", () => {
  it("restores the newest backup into a scratch DB and matches every count", async () => {
    await createUser({ roles: ["editor"] })
    await createUser({ roles: ["admin"] })
    const store = diskBackupStore(dir)
    await runBackup({ url: TEST_DATABASE_URL, store })
    const result = await restoreDrill({ url: TEST_DATABASE_URL, store })
    expect(result).toMatchObject({
      scratchDatabase: "sp_test_restore_drill",
      mismatches: [],
      ok: true,
    })
    expect(result.backup).toMatch(/^sp-sp_test-\d{8}T\d{6}Z\.dump$/)
    expect(result.tables).toBeGreaterThan(10)
    expect(await scratchExists()).toBe(false)
  })

  it("reports a count that does not match the manifest", async () => {
    await createUser({ roles: ["editor"] })
    const store = diskBackupStore(dir)
    const { name } = await runBackup({ url: TEST_DATABASE_URL, store })
    const manifestFile = join(dir, name.replace(/\.dump$/, ".json"))
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"))
    manifest.counts["public.users"] = 99
    await writeFile(manifestFile, JSON.stringify(manifest))
    const result = await restoreDrill({ url: TEST_DATABASE_URL, store })
    expect(result.ok).toBe(false)
    expect(result.mismatches).toEqual([
      { table: "public.users", expected: 99, actual: 1 },
    ])
  })

  it("refuses a dump whose checksum does not match", async () => {
    const store = diskBackupStore(dir)
    const { name } = await runBackup({ url: TEST_DATABASE_URL, store })
    await appendFile(join(dir, name), "x")
    await expect(
      restoreDrill({ url: TEST_DATABASE_URL, store })
    ).rejects.toThrow("checksum does not match its manifest")
  })

  it("explains an empty store", async () => {
    await expect(
      restoreDrill({ url: TEST_DATABASE_URL, store: diskBackupStore(dir) })
    ).rejects.toThrow(`No backup found in ${dir}`)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration tests/integration/backup/restore-drill.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/backup/restore-drill"`.

- [ ] **Step 3: Implement**

`server/lib/backup/restore-drill.ts`:

```ts
import "server-only"

import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Client } from "pg"
import { parse } from "pg-connection-string"

import { getEnv } from "@/server/env"

import { type BackupManifest, countRows, quoteIdent } from "./dump"
import { runPgTool, withDatabase } from "./pg-tools"
import { type BackupStore, getBackupStore } from "./store"

export const DRILL_SUFFIX = "_restore_drill"

export type DrillMismatch = {
  table: string
  expected: number
  /** null: the table is missing from the restored database. */
  actual: number | null
}

export type DrillResult = {
  backup: string
  scratchDatabase: string
  tables: number
  mismatches: DrillMismatch[]
  ok: boolean
}

async function withClient<T>(
  url: string,
  run: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()
  try {
    return await run(client)
  } finally {
    await client.end().catch(() => undefined)
  }
}

/**
 * Spec §14 restore drill: restore the newest backup into a scratch database
 * on the same server and compare every table's row count with the backup's
 * manifest. The scratch database is dropped afterwards unless keepScratch.
 */
export async function restoreDrill(
  opts: { url?: string; store?: BackupStore; keepScratch?: boolean } = {}
): Promise<DrillResult> {
  const url = opts.url ?? getEnv().DATABASE_URL
  const store = opts.store ?? (await getBackupStore())
  const latest = (await store.list()).find((o) => o.name.endsWith(".dump"))
  if (!latest) throw new Error(`No backup found in ${store.location}`)
  const scratch = `${parse(url).database ?? ""}${DRILL_SUFFIX}`
  if (!/^[a-z0-9_]{1,63}$/.test(scratch))
    throw new Error(`Cannot derive a scratch database name (${scratch})`)
  const scratchUrl = withDatabase(url, scratch)
  const dir = await mkdtemp(join(tmpdir(), "sp-drill-"))
  try {
    const manifestName = latest.name.replace(/\.dump$/, ".json")
    const dumpFile = join(dir, latest.name)
    const manifestFile = join(dir, manifestName)
    await store.download(latest.name, dumpFile)
    await store.download(manifestName, manifestFile)
    const manifest = JSON.parse(
      await readFile(manifestFile, "utf8")
    ) as BackupManifest
    const sha256 = createHash("sha256")
      .update(await readFile(dumpFile))
      .digest("hex")
    if (sha256 !== manifest.sha256)
      throw new Error(`${latest.name}: checksum does not match its manifest`)

    await withClient(url, (c) =>
      c.query(`drop database if exists ${quoteIdent(scratch)} with (force)`)
    )
    await withClient(url, (c) =>
      c.query(`create database ${quoteIdent(scratch)}`)
    )
    try {
      await runPgTool(
        "pg_restore",
        [
          "--no-owner",
          "--no-privileges",
          "--exit-on-error",
          "--single-transaction",
          `--dbname=${scratch}`,
          dumpFile,
        ],
        scratchUrl
      )
      const actual = await withClient(scratchUrl, countRows)
      const mismatches: DrillMismatch[] = []
      for (const [table, expected] of Object.entries(manifest.counts)) {
        const found = actual[table] ?? null
        if (found !== expected)
          mismatches.push({ table, expected, actual: found })
      }
      return {
        backup: latest.name,
        scratchDatabase: scratch,
        tables: Object.keys(manifest.counts).length,
        mismatches,
        ok: mismatches.length === 0,
      }
    } finally {
      if (!opts.keepScratch)
        await withClient(url, (c) =>
          c.query(`drop database if exists ${quoteIdent(scratch)} with (force)`)
        )
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
```

`scripts/restore-drill.ts`:

```ts
// Restores the newest backup into <db>_restore_drill on the same server and
// compares every table's row count with the backup's manifest (spec §14).
//   dev:       pnpm restore-drill [--keep]
//   container: node scripts/dist/restore-drill.mjs [--keep]
// --keep leaves the scratch database for inspection. Exit code 1 on a mismatch.
import { parseArgs } from "node:util"

import { restoreDrill } from "@/server/lib/backup/restore-drill"

import { runScript } from "./lib/run-script"

await runScript("restore-drill", async () => {
  const { values } = parseArgs({
    options: { keep: { type: "boolean", default: false } },
  })
  const result = await restoreDrill({ keepScratch: values.keep ?? false })
  console.log(
    `[restore-drill] ${result.backup} → ${result.scratchDatabase}: ${result.tables} tables checked`
  )
  if (!result.ok) {
    for (const m of result.mismatches)
      console.error(
        `[restore-drill] ${m.table}: expected ${m.expected}, restored ${m.actual ?? "missing"}`
      )
    throw new Error("restore drill FAILED: counts differ (see above)")
  }
  console.log("[restore-drill] OK: every count matches the backup manifest")
})
```

`scripts/build-scripts.ts` — append `"restore-drill"` to `SCRIPT_ENTRIES`. `package.json` — add `"restore-drill": "pnpm tsx:server scripts/restore-drill.ts"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/backup && pnpm exec vitest run --project unit tests/unit/scripts-bundle.test.ts`
Expected: PASS.

Run: `pnpm backup && pnpm restore-drill`
Expected: `[restore-drill] OK: every count matches the backup manifest`.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write server/lib/backup/restore-drill.ts scripts/restore-drill.ts scripts/build-scripts.ts tests/integration/backup/restore-drill.test.ts
git add server/lib/backup/restore-drill.ts scripts/restore-drill.ts scripts/build-scripts.ts package.json tests/integration/backup/restore-drill.test.ts
git commit -m "$(cat <<'EOF'
feat(ops): restore drill restores the newest backup into a scratch DB

Verifies the checksum, restores in one transaction and compares every
table's row count with the backup manifest.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `secrets:rotate` (master Task 10.1, part 3)

**Files:**
- Create: `server/modules/integrations/rotate.ts`, `scripts/secrets-rotate.ts`
- Modify: `server/modules/integrations/repo.ts` (`replaceIntegrationDraft`), `server/modules/users/repo.ts` (`clearAllTwoFactor`, `deleteAllSessions`), `scripts/build-scripts.ts` (`"secrets-rotate"`), `package.json` (`"secrets:rotate"`)
- Test: `tests/unit/integrations/rotate.test.ts`, `tests/integration/ops/secrets-rotate.test.ts`

**Interfaces:**
- Consumes: Phase 1 `encryptSecret`/`decryptSecret` (explicit `secret` argument, ≥ 32 chars); Phase 6 `INTEGRATION_KEYS`, `INTEGRATIONS[key].secrets`, `IntegrationKey` (`lib/schemas/integrations`), `listIntegrationRows(db, keys)` (`server/modules/integrations/repo.ts`), `secretAad(key, field)` and `readIntegrationConfig` (`server/modules/integrations/service.ts`); Phase 2 `writeAudit`, tables `sessions`, `twoFactors`, `users`; `getEnv`.
- Produces:

```ts
// server/modules/integrations/rotate.ts
export type ReencryptResult = { draft: Record<string, unknown>; fields: string[]; alreadyCurrent: string[] }   // "<key>.<field>" names
export function reencryptDraft(key: IntegrationKey, draft: Record<string, unknown>, fromSecret: string, toSecret: string): ReencryptResult
export type RotateReport = { reencrypted: string[]; alreadyCurrent: string[]; twoFactorCleared: number; sessionsRevoked: number }
export async function rotateSecrets(opts: { fromSecret: string; toSecret?: string; via?: string; db?: DbOrTx }): Promise<RotateReport>   // one transaction
// server/modules/integrations/repo.ts
export async function replaceIntegrationDraft(db: DbOrTx, key: string, draft: unknown): Promise<void>   // version + 1
// server/modules/users/repo.ts
export async function clearAllTwoFactor(db: DbOrTx): Promise<number>   // two_factors rows deleted; users.two_factor_enabled = false
export async function deleteAllSessions(db: DbOrTx): Promise<number>
// CLI (spec §4 rotation)
pnpm secrets:rotate --from-secret "<previous BETTER_AUTH_SECRET>"     (or OLD_BETTER_AUTH_SECRET=… pnpm secrets:rotate)
node scripts/dist/secrets-rotate.mjs --from-secret "…"               (container, new secret already in env)
```

Rules (spec §4): in one transaction, every non-empty secret field of every saved integration is decrypted with the old derived key (AAD `<key>.<field>`) and re-encrypted with the current one; a field that already decrypts with the new key is reported in `alreadyCurrent` (re-runs are safe); a field neither key can read aborts the whole rotation. Two-factor rows are deleted and `two_factor_enabled` cleared (TOTP secrets are encrypted with the old auth secret; users re-enrol), every session is deleted (cookies were signed with the old secret), and one audit row `secrets.rotated` lists field **names** and counts only. The integration row's `version` goes up so an open Settings form gets a 409 instead of writing stale ciphertext. The script refuses when the old secret equals the current one (the new secret must be set first).

- [ ] **Step 1: Write the failing tests**

`tests/unit/integrations/rotate.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { decryptSecret, encryptSecret } from "@/server/lib/crypto"
import { reencryptDraft } from "@/server/modules/integrations/rotate"

const OLD = "old-secret-0123456789abcdef0123456789abcdef"
const NEW = "new-secret-0123456789abcdef0123456789abcdef"
const SMTP_AAD = "integrations.smtp.password"
const smtp = {
  host: "smtp.example.test",
  port: 587,
  secure: false,
  user: "mailer",
  fromName: "Security Partners",
  fromAddress: "no-reply@example.test",
}

describe("reencryptDraft (spec §4 rotation)", () => {
  it("re-encrypts each secret field with the new key and keeps other fields", () => {
    const draft = { ...smtp, password: encryptSecret("p@ss-word-1", SMTP_AAD, OLD) }
    const result = reencryptDraft("integrations.smtp", draft, OLD, NEW)
    expect(result.fields).toEqual(["integrations.smtp.password"])
    expect(result.alreadyCurrent).toEqual([])
    expect(decryptSecret(String(result.draft.password), SMTP_AAD, NEW)).toBe(
      "p@ss-word-1"
    )
    expect(() =>
      decryptSecret(String(result.draft.password), SMTP_AAD, OLD)
    ).toThrow()
    expect(result.draft).toMatchObject(smtp)
  })

  it("covers every secret of a multi-secret integration (R2)", () => {
    const draft = {
      accountId: "acc",
      jurisdiction: "eu",
      bucket: "sp-media",
      accessKeyId: encryptSecret("AKIA-1", "integrations.r2.accessKeyId", OLD),
      secretAccessKey: encryptSecret(
        "s3cr3t",
        "integrations.r2.secretAccessKey",
        OLD
      ),
    }
    const result = reencryptDraft("integrations.r2", draft, OLD, NEW)
    expect(result.fields.sort()).toEqual([
      "integrations.r2.accessKeyId",
      "integrations.r2.secretAccessKey",
    ])
    expect(
      decryptSecret(
        String(result.draft.secretAccessKey),
        "integrations.r2.secretAccessKey",
        NEW
      )
    ).toBe("s3cr3t")
  })

  it("skips empty secrets and reports secrets already under the new key", () => {
    const draft = { ...smtp, password: encryptSecret("x".repeat(16), SMTP_AAD, NEW) }
    expect(reencryptDraft("integrations.smtp", draft, OLD, NEW)).toEqual({
      draft,
      fields: [],
      alreadyCurrent: ["integrations.smtp.password"],
    })
    const empty = { ...smtp, password: "" }
    expect(reencryptDraft("integrations.smtp", empty, OLD, NEW).fields).toEqual(
      []
    )
  })

  it("refuses a secret neither key can read (never writes garbage)", () => {
    const other = "third-secret-0123456789abcdef0123456789abcd"
    const draft = { ...smtp, password: encryptSecret("p", SMTP_AAD, other) }
    expect(() => reencryptDraft("integrations.smtp", draft, OLD, NEW)).toThrow(
      "integrations.smtp.password cannot be decrypted with the old or the new secret"
    )
  })
})
```

`tests/integration/ops/secrets-rotate.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import {
  auditLog,
  sessions,
  settings,
  twoFactors,
  users,
} from "@/server/db/schema"
import { encryptSecret } from "@/server/lib/crypto"
import { rotateSecrets } from "@/server/modules/integrations/rotate"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { resetDb } from "../db"
import { createUser, signIn } from "../helpers/auth"

const OLD = "previous-secret-0123456789abcdef0123456789"

beforeEach(resetDb)

describe("rotateSecrets (pnpm secrets:rotate)", () => {
  it("re-encrypts saved secrets, clears 2FA and sessions, audits names only, and is re-runnable", async () => {
    const db = getDb()
    await db.insert(settings).values({
      key: "integrations.smtp",
      draft: {
        host: "smtp.example.test",
        port: 587,
        secure: false,
        user: "mailer",
        password: encryptSecret(
          "smtp-password-1",
          "integrations.smtp.password",
          OLD
        ),
        fromName: "Security Partners",
        fromAddress: "no-reply@example.test",
      },
      version: 1,
    })
    const user = await createUser({ roles: ["admin"] })
    await signIn(user.email)
    await db
      .insert(twoFactors)
      .values({ userId: user.id, secret: "enc", backupCodes: "enc" })
    await db
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, user.id))

    await expect(readIntegrationConfig("integrations.smtp")).rejects.toThrow(
      "cannot be decrypted"
    )

    const report = await rotateSecrets({ fromSecret: OLD })
    expect(report).toMatchObject({
      reencrypted: ["integrations.smtp.password"],
      alreadyCurrent: [],
      twoFactorCleared: 1,
    })
    expect(report.sessionsRevoked).toBeGreaterThanOrEqual(1)
    expect((await readIntegrationConfig("integrations.smtp"))?.password).toBe(
      "smtp-password-1"
    )
    expect(await db.select().from(sessions)).toHaveLength(0)
    expect(await db.select().from(twoFactors)).toHaveLength(0)
    const [me] = await db.select().from(users).where(eq(users.id, user.id))
    expect(me.twoFactorEnabled).toBe(false)
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "integrations.smtp"))
    expect(row.version).toBe(2)
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "secrets.rotated"))
    expect(audit).toHaveLength(1)
    expect(JSON.stringify(audit[0].diff)).not.toContain("smtp-password-1")

    const again = await rotateSecrets({ fromSecret: OLD })
    expect(again).toMatchObject({
      reencrypted: [],
      alreadyCurrent: ["integrations.smtp.password"],
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/integrations/rotate.test.ts && pnpm test:integration tests/integration/ops/secrets-rotate.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/modules/integrations/rotate"`.

- [ ] **Step 3: Implement**

`server/modules/users/repo.ts` — append (all names are already imported in this file):

```ts
/**
 * Two-factor off for every user (secrets:rotate / db:sync): TOTP secrets are
 * encrypted with BETTER_AUTH_SECRET, so they are unreadable after a change.
 */
export async function clearAllTwoFactor(db: DbOrTx): Promise<number> {
  const deleted = await db
    .delete(twoFactors)
    .returning({ id: twoFactors.id })
  await db
    .update(users)
    .set({ twoFactorEnabled: false })
    .where(eq(users.twoFactorEnabled, true))
  return deleted.length
}

/** Signs everyone out (session cookies are signed with the auth secret). */
export async function deleteAllSessions(db: DbOrTx): Promise<number> {
  const deleted = await db.delete(sessions).returning({ id: sessions.id })
  return deleted.length
}
```

`server/modules/integrations/repo.ts` — add `sql` to the `drizzle-orm` import and append:

```ts
/** Replaces the stored object (secrets:rotate). Bumps `version` so an open form reloads. */
export async function replaceIntegrationDraft(
  db: DbOrTx,
  key: string,
  draft: unknown
): Promise<void> {
  await db
    .update(settings)
    .set({ draft, version: sql`${settings.version} + 1` })
    .where(eq(settings.key, key))
}
```

`server/modules/integrations/rotate.ts`:

```ts
import "server-only"

import {
  INTEGRATION_KEYS,
  INTEGRATIONS,
  type IntegrationKey,
} from "@/lib/schemas/integrations"
import { type DbOrTx, getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import { writeAudit } from "@/server/lib/audit"
import { decryptSecret, encryptSecret } from "@/server/lib/crypto"
import {
  clearAllTwoFactor,
  deleteAllSessions,
} from "@/server/modules/users/repo"

import { listIntegrationRows, replaceIntegrationDraft } from "./repo"
import { secretAad } from "./service"

export type ReencryptResult = {
  draft: Record<string, unknown>
  /** "<key>.<field>" re-encrypted with the new key. */
  fields: string[]
  /** "<key>.<field>" that already decrypt with the new key (a re-run). */
  alreadyCurrent: string[]
}

/** Re-encrypts the secret fields of one stored integration object. Throws if one is unreadable with both keys. */
export function reencryptDraft(
  key: IntegrationKey,
  draft: Record<string, unknown>,
  fromSecret: string,
  toSecret: string
): ReencryptResult {
  const next: Record<string, unknown> = { ...draft }
  const fields: string[] = []
  const alreadyCurrent: string[] = []
  for (const field of INTEGRATIONS[key].secrets) {
    const value = draft[field]
    if (typeof value !== "string" || value === "") continue
    const aad = secretAad(key, field)
    let plain: string
    try {
      plain = decryptSecret(value, aad, fromSecret)
    } catch {
      try {
        decryptSecret(value, aad, toSecret)
      } catch {
        throw new Error(
          `${key}.${field} cannot be decrypted with the old or the new secret`
        )
      }
      alreadyCurrent.push(`${key}.${field}`)
      continue
    }
    next[field] = encryptSecret(plain, aad, toSecret)
    fields.push(`${key}.${field}`)
  }
  return { draft: next, fields, alreadyCurrent }
}

export type RotateReport = {
  reencrypted: string[]
  alreadyCurrent: string[]
  twoFactorCleared: number
  sessionsRevoked: number
}

/**
 * Spec §4 rotation, in one transaction: integration secrets move from the
 * key derived from `fromSecret` to the key derived from `toSecret` (default:
 * the current BETTER_AUTH_SECRET); 2FA is cleared and every session ends.
 */
export async function rotateSecrets(opts: {
  fromSecret: string
  toSecret?: string
  via?: string
  db?: DbOrTx
}): Promise<RotateReport> {
  const toSecret = opts.toSecret ?? getEnv().BETTER_AUTH_SECRET
  const db = opts.db ?? getDb()
  return db.transaction(async (tx) => {
    const reencrypted: string[] = []
    const alreadyCurrent: string[] = []
    for (const row of await listIntegrationRows(tx, INTEGRATION_KEYS)) {
      if (!row.draft || typeof row.draft !== "object") continue
      const key = row.key as IntegrationKey
      const result = reencryptDraft(
        key,
        row.draft as Record<string, unknown>,
        opts.fromSecret,
        toSecret
      )
      alreadyCurrent.push(...result.alreadyCurrent)
      if (result.fields.length === 0) continue
      await replaceIntegrationDraft(tx, key, result.draft)
      reencrypted.push(...result.fields)
    }
    const twoFactorCleared = await clearAllTwoFactor(tx)
    const sessionsRevoked = await deleteAllSessions(tx)
    await writeAudit(tx, null, {
      action: "secrets.rotated",
      diff: {
        via: opts.via ?? "secrets:rotate",
        reencrypted,
        alreadyCurrent,
        twoFactorCleared,
        sessionsRevoked,
      },
    })
    return { reencrypted, alreadyCurrent, twoFactorCleared, sessionsRevoked }
  })
}
```

`scripts/secrets-rotate.ts`:

```ts
// After BETTER_AUTH_SECRET changed (spec §4): re-encrypts every integration
// secret from the old derived key to the new one, turns 2FA off for everyone
// (users re-enrol) and signs everyone out. The NEW secret must already be in
// the environment. See docs/runbook.md "Rotate BETTER_AUTH_SECRET".
//   pnpm secrets:rotate --from-secret "<previous secret>"
//   OLD_BETTER_AUTH_SECRET="<previous secret>" node scripts/dist/secrets-rotate.mjs
import { parseArgs } from "node:util"

import { getEnv } from "@/server/env"
import { rotateSecrets } from "@/server/modules/integrations/rotate"

import { runScript } from "./lib/run-script"

const USAGE =
  'Usage: secrets:rotate --from-secret "<previous BETTER_AUTH_SECRET>" (or set OLD_BETTER_AUTH_SECRET)'

await runScript("secrets:rotate", async () => {
  const { values } = parseArgs({
    options: { "from-secret": { type: "string" } },
  })
  const fromSecret =
    values["from-secret"] || process.env.OLD_BETTER_AUTH_SECRET
  if (!fromSecret) throw new Error(USAGE)
  if (fromSecret === getEnv().BETTER_AUTH_SECRET)
    throw new Error(
      "The old secret equals the current BETTER_AUTH_SECRET: set the new secret in the environment first (docs/runbook.md)."
    )
  const report = await rotateSecrets({ fromSecret })
  console.log(
    `[secrets:rotate] re-encrypted ${report.reencrypted.length} secret(s)${report.reencrypted.length ? `: ${report.reencrypted.join(", ")}` : ""}`
  )
  if (report.alreadyCurrent.length)
    console.log(
      `[secrets:rotate] already on the new secret: ${report.alreadyCurrent.join(", ")}`
    )
  console.log(
    `[secrets:rotate] two-factor turned off for ${report.twoFactorCleared} user(s); ${report.sessionsRevoked} session(s) ended. Everyone signs in again; 2FA users re-enrol.`
  )
})
```

`scripts/build-scripts.ts` — append `"secrets-rotate"` to `SCRIPT_ENTRIES`. `package.json` — add `"secrets:rotate": "pnpm tsx:server scripts/secrets-rotate.ts"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/integrations/rotate.test.ts tests/unit/scripts-bundle.test.ts && pnpm test:integration tests/integration/ops`
Expected: PASS.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write server/modules/integrations/rotate.ts server/modules/integrations/repo.ts server/modules/users/repo.ts scripts/secrets-rotate.ts scripts/build-scripts.ts tests/unit/integrations/rotate.test.ts tests/integration/ops
git add server/modules/integrations/rotate.ts server/modules/integrations/repo.ts server/modules/users/repo.ts scripts/secrets-rotate.ts scripts/build-scripts.ts package.json tests/unit/integrations/rotate.test.ts tests/integration/ops/secrets-rotate.test.ts
git commit -m "$(cat <<'EOF'
feat(ops): secrets:rotate re-encrypts integration secrets

Moves every saved integration secret from the old derived key to the
current one in one transaction, clears 2FA, ends all sessions and
audits field names only. Safe to re-run.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `db:sync` (master Task 10.1, part 4)

**Files:**
- Create: `server/lib/db-sync.ts`, `scripts/db-sync.ts`
- Modify: `scripts/build-scripts.ts` (`"db-sync"`), `package.json` (`"db:sync"`)
- Test: `tests/integration/ops/db-sync.test.ts`

**Interfaces:**
- Consumes: Task 1 `runBackup`, `dumpDatabase`, `runPgTool`, `withDatabase`, `diskBackupStore`, `BackupStore`, `quoteIdent`; Task 3 `rotateSecrets`, `RotateReport`; Phase 2 `seedDemoUsers`, `describeDatabase` (`server/db/seed/guard.ts`); Phase 1 `closeDb`, `pingDb`, `runMigrations`; Phase 6 `INTEGRATION_KEYS`, `readIntegrationConfig`, `runIntegrationTest`.
- Produces:

```ts
// server/lib/db-sync.ts
export const SYNC_SKIPPED_DATA: readonly ["public.sessions", "public.verifications", "public.rate_limits", "public.public_rate_limits"]
export type SyncCheck = { name: string; ok: boolean; message: string }
export type SyncOptions = { from: string; fromSecret: string; confirm: string; demoPassword?: string; verifyUrl?: string; backupStore?: BackupStore; fetchImpl?: typeof fetch }
export type SyncReport = { backup: string; backupLocation: string; rotate: RotateReport; demoUsers: number; checks: SyncCheck[]; ok: boolean }
export async function dbSync(opts: SyncOptions): Promise<SyncReport>   // target = current env (DATABASE_URL, BETTER_AUTH_SECRET)
// CLI (spec §14)
pnpm db:sync --from <source url> --from-secret <source secret> --confirm <target db name>
             [--to <target url>] [--to-secret <target secret>] [--demo-password <12+ chars>] [--verify-url <target origin>]
node scripts/dist/db-sync.mjs …   (same flags; env = the target's three variables)
```

Rules (spec §14): refuse unless `--confirm` equals the target database name and source ≠ target; (1) back up the target (`runBackup` → disk store `/data/backups` or `.data/backups`), (2) dump the source in a snapshot, skipping the **data** of sessions, verifications and rate limits, (3) `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error` into the target (one transaction: a failure leaves the target untouched), (4) `rotateSecrets({ fromSecret, via: "db:sync" })` — re-encrypts source secrets for the target key, clears 2FA, ends sessions, (5) `seedDemoUsers(demoPassword)` when given, (6) checks: `select 1`, every saved integration decrypts with the target key, the AI test-connection when AI is enabled, and `GET <verify-url>/api/v1/health` = 200 when given. `ok` = every check ok. The target app should be stopped while it runs (runbook); its next start applies newer migrations.

- [ ] **Step 1: Write the failing test**

`tests/integration/ops/db-sync.test.ts`:

```ts
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { count, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Client, Pool } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import * as schema from "@/server/db/schema"
import { withDatabase } from "@/server/lib/backup/pg-tools"
import { diskBackupStore } from "@/server/lib/backup/store"
import { encryptSecret } from "@/server/lib/crypto"
import { dbSync } from "@/server/lib/db-sync"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { createUser } from "../helpers/auth"

const SOURCE_DB = "sp_test_sync_source"
const SOURCE_URL = withDatabase(TEST_DATABASE_URL, SOURCE_DB)
const SOURCE_SECRET = "source-secret-0123456789abcdef0123456789ab"

async function admin(sql: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

let dir: string
beforeAll(async () => {
  await admin(`drop database if exists ${SOURCE_DB} with (force)`)
  await admin(`create database ${SOURCE_DB}`)
  await runMigrations(SOURCE_URL)
  const pool = new Pool({ connectionString: SOURCE_URL })
  const source = drizzle({ client: pool, schema })
  const [user] = await source
    .insert(schema.users)
    .values({ name: "Prod Person", email: "prod.person@example.test" })
    .returning()
  await source.insert(schema.sessions).values({
    userId: user.id,
    token: "source-session-token",
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  await source.insert(schema.settings).values({
    key: "integrations.smtp",
    draft: {
      host: "smtp.example.test",
      port: 587,
      secure: false,
      user: "mailer",
      password: encryptSecret(
        "prod-smtp-password",
        "integrations.smtp.password",
        SOURCE_SECRET
      ),
      fromName: "Security Partners",
      fromAddress: "no-reply@example.test",
    },
    version: 1,
  })
  await pool.end()
})
afterAll(() => admin(`drop database if exists ${SOURCE_DB} with (force)`))
beforeEach(async () => {
  await resetDb()
  dir = await mkdtemp(join(tmpdir(), "sp-sync-it-"))
})

describe("dbSync (spec §14 db:sync)", () => {
  it("refuses without the target database name as confirmation", async () => {
    const before = await createUser({ roles: ["editor"] })
    await expect(
      dbSync({
        from: SOURCE_URL,
        fromSecret: SOURCE_SECRET,
        confirm: "sp_prod",
        backupStore: diskBackupStore(dir),
      })
    ).rejects.toThrow("--confirm must be the target database name (sp_test)")
    const [row] = await getDb()
      .select({ n: count() })
      .from(schema.users)
      .where(eq(schema.users.id, before.id))
    expect(row.n).toBe(1)
  })

  it("refuses to sync a database onto itself", async () => {
    await expect(
      dbSync({
        from: TEST_DATABASE_URL,
        fromSecret: SOURCE_SECRET,
        confirm: "sp_test",
        backupStore: diskBackupStore(dir),
      })
    ).rejects.toThrow("Source and target are the same database")
  })

  it("backs up the target, copies the source, re-keys secrets, skips sessions", async () => {
    await createUser({ roles: ["editor"], email: "target-only@example.test" })
    const report = await dbSync({
      from: SOURCE_URL,
      fromSecret: SOURCE_SECRET,
      confirm: "sp_test",
      backupStore: diskBackupStore(dir),
    })
    expect(report.ok).toBe(true)
    expect(report.backup).toMatch(/^sp-sp_test-\d{8}T\d{6}Z\.dump$/)
    expect(await readdir(dir)).toContain(report.backup)
    expect(report.rotate.reencrypted).toEqual(["integrations.smtp.password"])
    expect(report.checks).toContainEqual({
      name: "integrations.smtp",
      ok: true,
      message: "secrets decrypt with the target key",
    })

    const db = getDb()
    const emails = (await db.select().from(schema.users)).map((u) => u.email)
    expect(emails).toEqual(["prod.person@example.test"])
    expect(await db.select().from(schema.sessions)).toHaveLength(0)
    expect((await readIntegrationConfig("integrations.smtp"))?.password).toBe(
      "prod-smtp-password"
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration tests/integration/ops/db-sync.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/db-sync"`.

- [ ] **Step 3: Implement**

`server/lib/db-sync.ts`:

```ts
import "server-only"

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parse } from "pg-connection-string"

import { INTEGRATION_KEYS } from "@/lib/schemas/integrations"
import { closeDb, pingDb } from "@/server/db/client"
import { describeDatabase } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"
import { runBackup } from "@/server/lib/backup"
import { dumpDatabase } from "@/server/lib/backup/dump"
import { runPgTool } from "@/server/lib/backup/pg-tools"
import { type BackupStore, diskBackupStore } from "@/server/lib/backup/store"
import {
  type RotateReport,
  rotateSecrets,
} from "@/server/modules/integrations/rotate"
import { readIntegrationConfig } from "@/server/modules/integrations/service"
import { runIntegrationTest } from "@/server/modules/integrations/testers"
import { seedDemoUsers } from "@/server/modules/users/bootstrap"

/** Spec §14: data never copied between environments. */
export const SYNC_SKIPPED_DATA = [
  "public.sessions",
  "public.verifications",
  "public.rate_limits",
  "public.public_rate_limits",
] as const

export type SyncCheck = { name: string; ok: boolean; message: string }

export type SyncOptions = {
  from: string
  fromSecret: string
  /** Must equal the target database name. */
  confirm: string
  demoPassword?: string
  verifyUrl?: string
  backupStore?: BackupStore
  fetchImpl?: typeof fetch
}

export type SyncReport = {
  backup: string
  backupLocation: string
  rotate: RotateReport
  demoUsers: number
  checks: SyncCheck[]
  ok: boolean
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

async function verifyTarget(opts: SyncOptions): Promise<SyncCheck[]> {
  const checks: SyncCheck[] = [
    {
      name: "database",
      ok: await pingDb(),
      message: "the target answers select 1",
    },
  ]
  for (const key of INTEGRATION_KEYS) {
    try {
      const config = await readIntegrationConfig(key)
      checks.push({
        name: key,
        ok: true,
        message: config
          ? "secrets decrypt with the target key"
          : "not configured",
      })
    } catch (err) {
      checks.push({ name: key, ok: false, message: message(err) })
    }
  }
  try {
    const ai = await readIntegrationConfig("integrations.ai")
    if (ai?.enabled) {
      const result = await runIntegrationTest("integrations.ai", ai, {
        fetch: opts.fetchImpl,
      })
      checks.push({
        name: "ai test-connection",
        ok: result.ok,
        message: result.message,
      })
    }
  } catch {
    // Reported by the integrations.ai check above.
  }
  if (opts.verifyUrl) {
    try {
      const res = await (opts.fetchImpl ?? fetch)(
        new URL("/api/v1/health", opts.verifyUrl)
      )
      checks.push({
        name: "health",
        ok: res.status === 200,
        message: `GET /api/v1/health → ${res.status}`,
      })
    } catch (err) {
      checks.push({ name: "health", ok: false, message: message(err) })
    }
  }
  return checks
}

/**
 * Spec §14 db:sync: copies the source database into the target (this
 * process's DATABASE_URL / BETTER_AUTH_SECRET). Backs the target up first and
 * restores in a single transaction, so a failure leaves the target as it was.
 */
export async function dbSync(opts: SyncOptions): Promise<SyncReport> {
  const target = getEnv().DATABASE_URL
  const targetName = parse(target).database ?? ""
  if (opts.confirm !== targetName)
    throw new Error(
      `--confirm must be the target database name (${targetName}): db:sync replaces everything in it`
    )
  if (describeDatabase(opts.from) === describeDatabase(target))
    throw new Error("Source and target are the same database")

  const backup = await runBackup({
    url: target,
    store: opts.backupStore ?? diskBackupStore(),
  })
  const dir = await mkdtemp(join(tmpdir(), "sp-sync-"))
  try {
    const file = join(dir, "source.dump")
    await dumpDatabase(opts.from, file, {
      excludeTableData: SYNC_SKIPPED_DATA,
    })
    // Nothing of ours may hold target connections during the restore.
    await closeDb()
    await runPgTool(
      "pg_restore",
      [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--single-transaction",
        "--exit-on-error",
        `--dbname=${targetName}`,
        file,
      ],
      target
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  const rotate = await rotateSecrets({
    fromSecret: opts.fromSecret,
    via: "db:sync",
  })
  const demoUsers = opts.demoPassword
    ? (await seedDemoUsers(opts.demoPassword)).length
    : 0
  const checks = await verifyTarget(opts)
  return {
    backup: backup.name,
    backupLocation: backup.location,
    rotate,
    demoUsers,
    checks,
    ok: checks.every((check) => check.ok),
  }
}
```

`scripts/db-sync.ts`:

```ts
// Copies one environment's database into another (spec §14), e.g. production
// → staging. Run with the TARGET's env (DATABASE_URL, BETTER_AUTH_SECRET,
// BETTER_AUTH_URL) while the target app is stopped — docs/runbook.md "db:sync".
//   pnpm db:sync --from <source url> --from-secret <source secret> --confirm <target db name>
//     [--to <target url>] [--to-secret <target secret>]
//     [--demo-password <12+ chars>] [--verify-url https://staging.example.ie]
// The target is backed up first (/data/backups or .data/backups).
import { parseArgs } from "node:util"

import { dbSync } from "@/server/lib/db-sync"

import { runScript } from "./lib/run-script"

const USAGE =
  "Usage: db:sync --from <url> --from-secret <secret> --confirm <target database name> [--to <url>] [--to-secret <secret>] [--demo-password <pw>] [--verify-url <origin>]"

let values: Record<string, string | undefined>
try {
  ;({ values } = parseArgs({
    options: {
      from: { type: "string" },
      to: { type: "string" },
      "from-secret": { type: "string" },
      "to-secret": { type: "string" },
      confirm: { type: "string" },
      "demo-password": { type: "string" },
      "verify-url": { type: "string" },
    },
  }))
} catch (err) {
  console.error(`[db:sync] ${err instanceof Error ? err.message : err}\n${USAGE}`)
  process.exit(1)
}
// --to / --to-secret override the target env before it is validated.
if (values.to) process.env.DATABASE_URL = values.to
if (values["to-secret"]) process.env.BETTER_AUTH_SECRET = values["to-secret"]

await runScript("db:sync", async () => {
  const from = values.from
  const fromSecret = values["from-secret"]
  const confirm = values.confirm
  if (!from || !fromSecret || !confirm) throw new Error(USAGE)
  const report = await dbSync({
    from,
    fromSecret,
    confirm,
    demoPassword: values["demo-password"],
    verifyUrl: values["verify-url"],
  })
  console.log(
    `[db:sync] target backed up: ${report.backup} → ${report.backupLocation}`
  )
  console.log(
    `[db:sync] secrets re-keyed: ${report.rotate.reencrypted.join(", ") || "none"}; 2FA cleared for ${report.rotate.twoFactorCleared}; demo accounts reset: ${report.demoUsers}`
  )
  for (const check of report.checks)
    console.log(
      `[db:sync] ${check.ok ? "ok  " : "FAIL"} ${check.name}: ${check.message}`
    )
  if (!report.ok)
    throw new Error("finished, but some checks failed (see FAIL lines above)")
})
```

`scripts/build-scripts.ts` — append `"db-sync"` to `SCRIPT_ENTRIES`. `package.json` — add `"db:sync": "pnpm tsx:server scripts/db-sync.ts"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/ops && pnpm exec vitest run --project unit tests/unit/scripts-bundle.test.ts`
Expected: PASS. Then `pnpm test:integration` (whole project) — later files still pass after `sp_test` was restored over (same migrations, `resetDb` per file).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write server/lib/db-sync.ts scripts/db-sync.ts scripts/build-scripts.ts tests/integration/ops/db-sync.test.ts
git add server/lib/db-sync.ts scripts/db-sync.ts scripts/build-scripts.ts package.json tests/integration/ops/db-sync.test.ts
git commit -m "$(cat <<'EOF'
feat(ops): db:sync copies one environment's database into another

Backs up the target, restores the source in one transaction without
sessions or rate limits, re-keys integration secrets, clears 2FA,
optionally resets demo passwords and verifies the result.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Security pass — input, permission, crypto and env guards (master Task 10.2, part 1)

**Files:**
- Modify: `lib/auth/permissions.ts` (`hasPermission` guards), `lib/href.ts` (export `CONTROL_CHAR`), `lib/schemas/common.ts` (`httpUrl` rejects control characters), `server/lib/crypto.ts` (`secretHint`), `server/lib/pg-errors.ts` (walk the cause chain), `server/env.ts` (https in production), `server/db/migrate.ts` (unlock never masks the migration error)
- Test: `tests/unit/permissions.test.ts` (append), `tests/unit/schemas/http-url.test.ts` (new), `tests/unit/crypto.test.ts` (modify `secretHint` block), `tests/unit/pg-errors.test.ts` (new), `tests/unit/env.test.ts` (append), `tests/unit/migrate-unlock.test.ts` (new)

**Interfaces:**
- Consumes: existing code only.
- Produces (behaviour changes; signatures unchanged):

```ts
// lib/auth/permissions.ts
hasPermission(roles, req)   // false (never throws) for a non-array action list or a resource that is not an own key of `statements`
// lib/href.ts
export const CONTROL_CHAR: RegExp     // /[\u0000-\u001f\u007f-\u009f]/
// lib/schemas/common.ts
httpUrl                     // also rejects any C0/C1 control character → 422 "Must not contain control characters"
// server/lib/crypto.ts
secretHint(plain)           // "••••" for secrets shorter than 12 characters, else "••••" + last 4
// server/lib/pg-errors.ts
pgErrorCode(err), pgConstraint(err)   // walk `cause` up to 5 levels; pgErrorCode returns the first SQLSTATE-shaped code ([0-9A-Z]{5})
// server/env.ts
parseEnv(...)               // NODE_ENV=production + BETTER_AUTH_URL http on a non-loopback host → "BETTER_AUTH_URL: must use https in production (http only for localhost)"
// server/db/migrate.ts
runMigrations(...)          // a failing pg_advisory_unlock / client.end never replaces the migration error
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/permissions.test.ts`:

```ts
describe("hasPermission never throws on malformed requests (fail closed)", () => {
  it("denies a resource whose action list is not an array", () => {
    expect(
      hasPermission(["owner"], { page: undefined } as unknown as PermissionRequest)
    ).toBe(false)
    expect(
      hasPermission(["owner"], { page: "read" } as unknown as PermissionRequest)
    ).toBe(false)
  })

  it("denies prototype-named resources", () => {
    for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty"])
      expect(
        hasPermission(
          ["owner"],
          JSON.parse(`{"${name}":["read"]}`) as PermissionRequest
        )
      ).toBe(false)
  })
})
```

`tests/unit/schemas/http-url.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { httpUrl } from "@/lib/schemas/common"

describe("httpUrl rejects control characters (ledger P03-1)", () => {
  it("accepts ordinary http(s) URLs", () => {
    expect(httpUrl.safeParse("https://www.example.ie/path?q=1").success).toBe(
      true
    )
    expect(httpUrl.safeParse("http://localhost:3000/").success).toBe(true)
  })

  it.each([
    ["NUL", "https://example.ie/a\u0000b"],
    ["unit separator", "https://example.ie/a\u001fb"],
    ["DEL", "https://example.ie/a\u007fb"],
    ["C1 NEL", "https://example.ie/a\u0085b"],
  ])("rejects an inner %s with a 422-style issue", (_name, value) => {
    const result = httpUrl.safeParse(value)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      "Must not contain control characters"
    )
  })
})
```

In `tests/unit/crypto.test.ts`, replace the `describe("secretHint", …)` block with:

```ts
describe("secretHint", () => {
  it('returns "••••" + the last 4 characters of a secret of 12+ characters', () => {
    expect(secretHint("sk-live-abcd1234")).toBe("••••1234")
    expect(secretHint("123456789012")).toBe("••••9012")
  })

  it("reveals nothing for secrets shorter than 12 characters", () => {
    expect(secretHint("12345678901")).toBe("••••")
    expect(secretHint("abcde")).toBe("••••")
    expect(secretHint("abcd")).toBe("••••")
    expect(secretHint("")).toBe("••••")
  })
})
```

`tests/unit/pg-errors.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { pgConstraint, pgErrorCode } from "@/server/lib/pg-errors"

describe("pg error helpers walk the cause chain (ledger P04-3)", () => {
  it("finds the SQLSTATE and constraint on the pg error itself or 1–3 causes deep", () => {
    const pg = { code: "23505", constraint: "services_slug_unique" }
    expect(pgErrorCode(pg)).toBe("23505")
    expect(pgErrorCode({ cause: pg })).toBe("23505")
    expect(pgErrorCode({ cause: { cause: { cause: pg } } })).toBe("23505")
    expect(pgConstraint({ cause: { cause: pg } })).toBe("services_slug_unique")
  })

  it("prefers a SQLSTATE over a Node error code on a wrapper", () => {
    expect(pgErrorCode({ code: "ECONNRESET", cause: { code: "40001" } })).toBe(
      "40001"
    )
  })

  it("stops on cycles and deep chains, and ignores non-objects", () => {
    const cyclic: { cause?: unknown } = {}
    cyclic.cause = cyclic
    expect(pgErrorCode(cyclic)).toBeUndefined()
    let deep: unknown = { code: "23503" }
    for (let i = 0; i < 6; i++) deep = { cause: deep }
    expect(pgErrorCode(deep)).toBeUndefined()
    expect(pgErrorCode(null)).toBeUndefined()
    expect(pgErrorCode("23505")).toBeUndefined()
  })
})
```

Append to `tests/unit/env.test.ts` — inside `describe("parseEnv", …)`:

```ts
  it("requires https in production except on loopback hosts", () => {
    expect(() =>
      parseEnv({ ...VALID, BETTER_AUTH_URL: "http://security.raynx.ie" })
    ).toThrow(
      "  - BETTER_AUTH_URL: must use https in production (http only for localhost)"
    )
    for (const url of [
      "http://localhost:3000",
      "http://127.0.0.1:3100",
      "http://[::1]:3000",
    ])
      expect(parseEnv({ ...VALID, BETTER_AUTH_URL: url }).BETTER_AUTH_URL).toBe(
        url
      )
    expect(
      parseEnv({
        ...VALID,
        NODE_ENV: "development",
        BETTER_AUTH_URL: "http://dev.example.ie",
      }).BETTER_AUTH_URL
    ).toBe("http://dev.example.ie")
  })

  it("names NODE_ENV when it is not development, production or test", () => {
    expect(() => parseEnv({ ...VALID, NODE_ENV: "staging" })).toThrow(
      "  - NODE_ENV:"
    )
  })
```

and inside `describe("getSiteEnv (spec §1.4)", …)`:

```ts
  it("checks the production origin before NODE_ENV (a dev server on the production URL is production)", () => {
    setEnv({
      ...VALID,
      NODE_ENV: "development",
      BETTER_AUTH_URL: "https://www.example.ie",
    })
    expect(getSiteEnv("https://www.example.ie")).toBe("production")
  })
```

`tests/unit/migrate-unlock.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

const queries: string[] = []
vi.mock("pg", () => {
  class Client {
    async connect() {}
    async query(sql: string) {
      queries.push(sql)
      if (sql.includes("pg_advisory_unlock"))
        throw new Error("Connection terminated unexpectedly")
      return { rows: [] }
    }
    async end() {
      throw new Error("Client was closed and is not queryable")
    }
  }
  return { Client }
})
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }))
vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: async () => {
    throw new Error('relation "pages" already exists')
  },
}))

import { runMigrations } from "@/server/db/migrate"

describe("runMigrations (ledger P01-4)", () => {
  it("surfaces the migration error even when unlocking and closing fail", async () => {
    await expect(
      runMigrations("postgres://sp:sp@127.0.0.1:5432/sp_test", "/tmp/none")
    ).rejects.toThrow('relation "pages" already exists')
    expect(queries.some((q) => q.includes("pg_advisory_unlock"))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/permissions.test.ts tests/unit/schemas/http-url.test.ts tests/unit/crypto.test.ts tests/unit/pg-errors.test.ts tests/unit/env.test.ts tests/unit/migrate-unlock.test.ts`
Expected: FAIL — `hasPermission` throws `TypeError: actions.every is not a function` / returns true for nothing but throws on `__proto__`; control characters accepted; `secretHint("abcde")` → `"••••bcde"`; nested causes → `undefined`; http production URL accepted; migrate test rejects with `Connection terminated unexpectedly`.

- [ ] **Step 3: Implement**

`lib/auth/permissions.ts` — in `hasPermission`, replace the `entries.every(...)` callback head:

```ts
  return entries.every(
    ([resource, actions]) =>
      Object.hasOwn(statements, resource) &&
      Array.isArray(actions) &&
      actions.length > 0 &&
      actions.every((action) =>
        known.some(
          (role) =>
            roles[role].authorize({ [resource]: [action] } as never).success
        )
      )
  )
```

`lib/href.ts` — change `const CONTROL_CHAR = …` to `export const CONTROL_CHAR = /[\u0000-\u001f\u007f-\u009f]/`.

`lib/schemas/common.ts` — import `CONTROL_CHAR` alongside the existing `lib/href` import and replace `httpUrl`:

```ts
/** Absolute http(s) URL only (never javascript:, data:, ftp:…), no control characters. */
export const httpUrl = z
  .url({ protocol: /^https?$/ })
  .refine((value) => !CONTROL_CHAR.test(value), {
    message: "Must not contain control characters",
  })
```

`server/lib/crypto.ts`:

```ts
/** Secrets shorter than this reveal nothing in their hint. */
const HINT_MIN_LENGTH = 12

/** "••••" + last 4 characters for secrets of 12+ characters; shorter ones reveal nothing. */
export function secretHint(plain: string): string {
  return plain.length < HINT_MIN_LENGTH ? "••••" : `••••${plain.slice(-4)}`
}
```

`server/lib/pg-errors.ts`:

```ts
import "server-only"

const MAX_DEPTH = 5
const SQLSTATE = /^[0-9A-Z]{5}$/

/** Errors along `err.cause` (drizzle wraps the pg error), at most MAX_DEPTH deep, no cycles. */
function chain(err: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  let current: unknown = err
  while (
    current !== null &&
    typeof current === "object" &&
    out.length < MAX_DEPTH &&
    !out.includes(current as Record<string, unknown>)
  ) {
    out.push(current as Record<string, unknown>)
    current = (current as { cause?: unknown }).cause
  }
  return out
}

/** Postgres SQLSTATE of a failed query (the first SQLSTATE-shaped `code` along the cause chain). */
export function pgErrorCode(err: unknown): string | undefined {
  for (const e of chain(err))
    if (typeof e.code === "string" && SQLSTATE.test(e.code)) return e.code
  return undefined
}

/** Name of the constraint a failed query violated, e.g. "services_slug_unique". */
export function pgConstraint(err: unknown): string | undefined {
  for (const e of chain(err))
    if (typeof e.constraint === "string") return e.constraint
  return undefined
}

export const UNIQUE_VIOLATION = "23505"
export const FOREIGN_KEY_VIOLATION = "23503"
```

(The "deep chain" test builds the pg error 7 levels deep — beyond `MAX_DEPTH` → `undefined`.)

`server/env.ts` — add above `envSchema`:

```ts
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

/** Plain http to anything but this machine: auth cookies would travel without Secure. */
const isInsecureRemote = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "http:" && !LOOPBACK.has(url.hostname)
  } catch {
    return false
  }
}
```

and chain onto the object schema:

```ts
const envSchema = z
  .object({
    // … the four existing fields, unchanged …
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && isInsecureRemote(env.BETTER_AUTH_URL))
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "must use https in production (http only for localhost)",
      })
  })
```

`server/db/migrate.ts` — replace the two `finally` blocks:

```ts
    try {
      await migrate(drizzle({ client }), { migrationsFolder })
    } finally {
      // The lock dies with the connection anyway; a failed unlock (dropped
      // connection) must never replace the migration error.
      await client
        .query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID])
        .catch(() => undefined)
    }
  } finally {
    await client.end().catch(() => undefined)
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/permissions.test.ts tests/unit/schemas tests/unit/crypto.test.ts tests/unit/pg-errors.test.ts tests/unit/env.test.ts tests/unit/migrate-unlock.test.ts`
Expected: PASS.

Run: `grep -rn "secretHint\|hint" tests/unit tests/integration tests/dom | grep -v "crypto.test"` and run those files: any expectation built on a secret shorter than 12 characters (Phase 6 integration tests) is updated to `"••••"` — change the test secret to 12+ characters where the test is about the last-4 hint.
Expected: `pnpm test` exit 0.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write lib/auth/permissions.ts lib/href.ts lib/schemas/common.ts server/lib/crypto.ts server/lib/pg-errors.ts server/env.ts server/db/migrate.ts tests/unit/permissions.test.ts tests/unit/schemas/http-url.test.ts tests/unit/crypto.test.ts tests/unit/pg-errors.test.ts tests/unit/env.test.ts tests/unit/migrate-unlock.test.ts
git add lib/auth/permissions.ts lib/href.ts lib/schemas/common.ts server/lib/crypto.ts server/lib/pg-errors.ts server/env.ts server/db/migrate.ts tests/unit/permissions.test.ts tests/unit/schemas/http-url.test.ts tests/unit/crypto.test.ts tests/unit/pg-errors.test.ts tests/unit/env.test.ts tests/unit/migrate-unlock.test.ts
git commit -m "$(cat <<'EOF'
fix(security): fail-closed guards from the hardening pass

hasPermission never throws on malformed requests; httpUrl rejects
control characters; short secrets reveal nothing in hints; pg error
helpers walk the cause chain; production requires an https auth URL;
a failed unlock no longer hides the migration error.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Security pass — headers, cross-origin sweep, rate-limit config, no secrets in logs, dependency audit (master Task 10.2, part 2)

**Files:**
- Modify: `next.config.ts` (`headers()`), `server/api/middleware/error.ts` (log `HTTPException` 5xx), `server/auth/auth.ts` (`sendResetPassword` does not wait for the mailer), `package.json` + `pnpm-lock.yaml` (`shadcn` → devDependencies; `"audit:deps"` script)
- Create: `scripts/check-log-secrets.ts`
- Test: `tests/unit/next-config-headers.test.ts`, `tests/unit/api/error-envelope.test.ts` (append), `tests/unit/check-log-secrets.test.ts`, `tests/integration/security/cross-origin.test.ts`, `tests/integration/security/no-secrets-in-logs.test.ts`, `tests/integration/auth/rate-limit-config.test.ts`

**Interfaces:**
- Consumes: `app`/`createApp` (`server/api/app.ts`), `getAuth`, `signedInUser`, `signIn`, `authPost`, `adminRequest`, `createUser`, `TEST_PASSWORD` (`tests/integration/helpers/auth.ts`); Phase 6 `PUT/POST /api/v1/admin/integrations/integrations.smtp[/test]`; Phase 2 `POST /api/v1/admin/users/invite`, `POST /api/v1/admin/users/:id/password-link`; `E2E_ENV`, `E2E_PASSWORD`, `VISUAL_ADMIN`.
- Produces:

```ts
// next.config.ts
export const SECURITY_HEADERS: { key: string; value: string }[]
nextConfig.headers(): [{ source: "/((?!api/).*)", headers: SECURITY_HEADERS }, { source: "/admin/:path*", headers: [{ key: "X-Frame-Options", value: "DENY" }] }]
// scripts/check-log-secrets.ts
export function findSecrets(text: string, secrets: readonly string[]): string[]   // labels of what leaked: the secret itself is never echoed
// CLI: pnpm exec tsx scripts/check-log-secrets.ts <log file>…   → exit 1 when a known test secret or a ?token= value appears
// package.json
"audit:deps": "pnpm audit --prod --audit-level high"
```

Header set (spec §13 "secureHeaders"; CSP documented, not sent — see Corrections): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` (`DENY` on `/admin/*`, last rule wins), `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`, `Strict-Transport-Security: max-age=31536000` (browsers ignore it on http, e.g. E2E). `/api/*` is excluded: Hono's `secureHeaders()` already sets these there (no duplicated header values).

- [ ] **Step 1: Write the failing tests**

`tests/unit/next-config-headers.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import nextConfig from "../../next.config"

describe("security headers (spec §13)", () => {
  it("sends the hardening headers on every page except /api (Hono sets its own)", async () => {
    const rules = await nextConfig.headers!()
    expect(rules[0].source).toBe("/((?!api/).*)")
    expect(Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      "Strict-Transport-Security": "max-age=31536000",
    })
  })

  it("forbids framing the admin at all (the later rule wins)", async () => {
    const rules = await nextConfig.headers!()
    expect(rules.at(-1)).toEqual({
      source: "/admin/:path*",
      headers: [{ key: "X-Frame-Options", value: "DENY" }],
    })
  })
})
```

Append to `tests/unit/api/error-envelope.test.ts`, inside `describe("API error envelope", …)`:

```ts
  it("HTTPException 5xx is logged server-side with the request id", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const res = await app.request("/api/v1/__test/http-exception-5xx", {
      headers: { "x-request-id": "0190a6e0-0000-7000-8000-00000000abcd" },
    })
    expect(res.status).toBe(502)
    expect(error).toHaveBeenCalledWith(
      "[api] 0190a6e0-0000-7000-8000-00000000abcd HTTP 502: secret upstream detail"
    )
    error.mockRestore()
  })
```

`tests/unit/check-log-secrets.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { findSecrets } from "../../scripts/check-log-secrets"

describe("check-log-secrets", () => {
  it("names each known secret found, without echoing it", () => {
    const found = findSecrets("login with hunter2-hunter2 ok", [
      "hunter2-hunter2",
      "never-there-123",
    ])
    expect(found).toEqual(["known secret #1"])
    expect(found.join()).not.toContain("hunter2")
  })

  it("flags single-use tokens in logged URLs", () => {
    expect(
      findSecrets("GET /admin/set-password?token=AbCdEfGhIjKlMnOpQrStUv12 200", [])
    ).toEqual(["a ?token= value"])
  })

  it("passes clean output", () => {
    expect(findSecrets("[api] 0190… HTTP 502", ["secret-value-1"])).toEqual([])
  })
})
```

`tests/integration/security/cross-origin.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"

import { resetDb } from "../db"
import { signedInUser } from "../helpers/auth"

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])
const SOME_ID = "0190a9c2-6b1e-7000-8000-000000000000"

/** Every mutating admin route the app mounts, params filled in. */
function adminMutations(): { method: string; path: string }[] {
  const seen = new Set<string>()
  const out: { method: string; path: string }[] = []
  for (const route of app.routes) {
    if (!MUTATING.has(route.method)) continue
    if (!route.path.startsWith("/api/v1/admin/")) continue
    const path = route.path
      .replace(/:[A-Za-z_]\w*(\{[^}]*\})?/g, SOME_ID)
      .replace(/\*/g, "x")
    const key = `${route.method} ${path}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ method: route.method, path })
  }
  return out
}

let cookie: string
beforeAll(async () => {
  await resetDb()
  ;({ cookie } = await signedInUser(["owner"]))
})

describe("CSRF: every mutating admin route rejects cross-origin requests (spec §13)", () => {
  const routes = adminMutations()

  it("finds the admin API's mutations", () => {
    expect(routes.length).toBeGreaterThanOrEqual(25)
  })

  it.each(routes)("$method $path → 403 for a foreign Origin", async ({ method, path }) => {
    const res = await app.request(path, {
      method,
      headers: {
        cookie,
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: "{}",
    })
    expect(res.status).toBe(403)
    expect((await res.json()).error.message).toBe("Cross-origin request rejected")
  })

  it.each(routes)("$method $path → 403 without Origin from another site", async ({ method, path }) => {
    const res = await app.request(path, {
      method,
      headers: {
        cookie,
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
      },
      body: "{}",
    })
    expect(res.status).toBe(403)
  })
})
```

`tests/integration/auth/rate-limit-config.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"

import { getAuth } from "@/server/auth/auth"

// Next types NODE_ENV as read-only; the test flips it.
const ENV = process.env as Record<string, string | undefined>
const saved = ENV.NODE_ENV
afterEach(() => {
  ENV.NODE_ENV = saved
})

describe("Better Auth rate limits (spec §6, §13)", () => {
  it("are on in production, stored in Postgres, strict on sign-in, 2FA and resets", () => {
    ENV.NODE_ENV = "production"
    const { rateLimit, advanced } = getAuth().options
    expect(rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    })
    // Traefik overwrites X-Forwarded-For with the client address (single
    // value); X-Real-Ip is the fallback (docs/runbook.md "Client IPs").
    expect(advanced?.ipAddress?.ipAddressHeaders).toEqual([
      "x-forwarded-for",
      "x-real-ip",
    ])
  })

  it("are off outside production (tests, dev)", () => {
    ENV.NODE_ENV = "test"
    expect(getAuth().options.rateLimit?.enabled).toBe(false)
  })
})
```

`tests/integration/security/no-secrets-in-logs.test.ts`:

```ts
import { inspect } from "node:util"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { parseEnv } from "@/server/env"
import { decryptSecret } from "@/server/lib/crypto"

import { resetDb } from "../db"
import {
  adminRequest,
  authPost,
  createUser,
  signIn,
  TEST_PASSWORD,
} from "../helpers/auth"

const SMTP_SENTINEL = "smtp-sentinel-password-7f3a9c"
const WRONG_PASSWORD = "wrong-password-sentinel-123"

let output: string[] = []
beforeEach(async () => {
  await resetDb()
  output = []
  for (const method of ["log", "info", "warn", "error", "debug"] as const)
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      output.push(
        args
          .map((a) => (typeof a === "string" ? a : inspect(a, { depth: 6 })))
          .join(" ")
      )
    })
})
afterEach(() => vi.restoreAllMocks())

describe("no secrets in logs (spec §13)", () => {
  it("sign-in, invites, password links, SMTP save/test and env errors log no secret", async () => {
    const owner = await createUser({ roles: ["owner"] })
    await authPost("/sign-in/email", {
      email: owner.email,
      password: WRONG_PASSWORD,
    })
    const cookie = await signIn(owner.email)

    const invite = await adminRequest("/users/invite", {
      cookie,
      method: "POST",
      json: { email: "log-invitee@example.test", name: "Log Invitee", roles: ["editor"] },
    })
    expect(invite.status).toBe(201)
    const invited = await invite.json()
    const inviteToken = new URL(invited.inviteUrl).searchParams.get("token")!

    const link = await adminRequest(`/users/${invited.user.id}/password-link`, {
      cookie,
      method: "POST",
    })
    const linkToken = new URL((await link.json()).url).searchParams.get("token")!

    const save = await adminRequest("/integrations/integrations.smtp", {
      cookie,
      method: "PUT",
      json: {
        version: 0,
        values: {
          host: "127.0.0.1",
          port: 1,
          secure: false,
          user: "mailer",
          password: SMTP_SENTINEL,
          fromName: "Security Partners",
          fromAddress: "no-reply@example.test",
        },
      },
    })
    expect(save.status).toBe(200)
    const test = await adminRequest("/integrations/integrations.smtp/test", {
      cookie,
      method: "POST",
    })
    expect((await test.json()).ok).toBe(false)

    await authPost("/request-password-reset", { email: owner.email })
    // sendResetPassword no longer waits for the mailer: let it finish.
    await new Promise((resolve) => setTimeout(resolve, 1_000))

    expect(() =>
      parseEnv({
        DATABASE_URL: "postgres://sp:sp@127.0.0.1:5432/sp_test",
        BETTER_AUTH_SECRET: "too-short-secret-value",
        BETTER_AUTH_URL: "http://localhost:3000",
      })
    ).toThrow()
    expect(() => decryptSecret("v1:AAAA:BBBB:CCCC", "x.y")).toThrow()

    const log = output.join("\n")
    const sessionValue = cookie.split(";")[0].split("=").slice(1).join("=")
    for (const secret of [
      TEST_PASSWORD,
      WRONG_PASSWORD,
      SMTP_SENTINEL,
      process.env.BETTER_AUTH_SECRET!,
      "too-short-secret-value",
      inviteToken,
      linkToken,
      sessionValue,
    ])
      expect(log.includes(secret), `log contains a secret: ${secret.slice(0, 4)}…`).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/next-config-headers.test.ts tests/unit/api/error-envelope.test.ts tests/unit/check-log-secrets.test.ts && pnpm test:integration tests/integration/security tests/integration/auth/rate-limit-config.test.ts`
Expected: FAIL — `nextConfig.headers` is undefined; no `[api] … HTTP 502` log; `Cannot find module '../../scripts/check-log-secrets'`. The cross-origin and rate-limit tests are regression pins and may already pass; the logs test may pass too (it guards against regressions — keep it).

- [ ] **Step 3: Implement**

`next.config.ts`:

```ts
import type { NextConfig } from "next"

/**
 * Spec §13 hardening headers for pages (Hono's secureHeaders() covers /api).
 * No Content-Security-Policy: Marketing ▸ Custom code and Tracking need
 * inline loaders and third-party hosts — docs/runbook.md lists what a
 * future policy must allow.
 */
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Ignored by browsers over http (local, E2E); Traefik serves https.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
]

// "standalone" traces only the files the server needs, so the Docker image
// ships a small server.js instead of the full node_modules.
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Cache Components: routes are dynamic unless data is cached with
  // 'use cache' (server/modules/*/queries.ts). Public pages read the DB
  // inside <Suspense> after connection(), so `next build` needs no DB.
  cacheComponents: true,
  experimental: {
    // forbidden() from requirePermission() renders app/(admin)/admin/forbidden.tsx
    authInterrupts: true,
  },
  async headers() {
    return [
      { source: "/((?!api/).*)", headers: SECURITY_HEADERS },
      // The admin is never framed (the live preview frames the public site).
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
    ]
  },
}

export default nextConfig
```

Keep every option later phases added to `nextConfig` (Phase 8 `htmlLimitedBots`, any `experimental` keys) — only `SECURITY_HEADERS` and `headers()` are new.

`server/api/middleware/error.ts` — in `onError`, at the start of the `if (err instanceof HTTPException) {` branch (after `const status = …`), add:

```ts
    if (status >= 500)
      // The client only gets "Internal server error"; keep the cause here.
      console.error(`[api] ${c.get("requestId")} HTTP ${status}: ${err.message}`)
```

`server/auth/auth.ts` — `sendResetPassword` must not let the response time reveal whether the account exists (Better Auth only calls it for existing users):

```ts
      // Forgot-password: Better Auth creates the token; we link to our page.
      // Not awaited: the reply must take as long for an unknown email as for
      // a real one (the mailer never throws and never logs links).
      sendResetPassword: async ({ user, token }) => {
        void mailer.send({
          to: user.email,
          subject: "Reset your Security Partners admin password",
          react: createElement(ResetPasswordEmail, {
            name: user.name,
            url: adminUrl("/admin/reset-password", { token }),
            expiresInMinutes: RESET_TOKEN_EXPIRES_IN / 60,
          }),
        })
      },
```

If an existing test asserts the reset email synchronously (spy called right after `/request-password-reset`), wrap that assertion in `await vi.waitFor(() => …)`; Mailpit-based tests already poll.

`scripts/check-log-secrets.ts`:

```ts
// Fails when a captured log (CI E2E server output) contains a known test
// secret or a single-use ?token= value. Never prints the secret itself.
//   pnpm exec tsx scripts/check-log-secrets.ts e2e.log [more.log…]
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { E2E_ENV } from "../tests/e2e/env"
import { E2E_PASSWORD } from "../tests/e2e/fixtures"
import { VISUAL_ADMIN } from "../tests/visual/admin-user"

const TOKEN_IN_URL = /[?&]token=[A-Za-z0-9_-]{16,}/

/** Labels of what leaked ("known secret #n", "a ?token= value"). */
export function findSecrets(text: string, secrets: readonly string[]): string[] {
  const found = secrets.flatMap((secret, index) =>
    secret && text.includes(secret) ? [`known secret #${index + 1}`] : []
  )
  if (TOKEN_IN_URL.test(text)) found.push("a ?token= value")
  return found
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error("Usage: tsx scripts/check-log-secrets.ts <log file>…")
    process.exit(2)
  }
  const secrets = [E2E_ENV.BETTER_AUTH_SECRET, E2E_PASSWORD, VISUAL_ADMIN.password]
  let failed = false
  for (const file of files) {
    const found = findSecrets(readFileSync(file, "utf8"), secrets)
    if (found.length) {
      failed = true
      console.error(`[check-log-secrets] ${file}: ${found.join(", ")}`)
    }
  }
  if (failed) process.exit(1)
  console.log(`[check-log-secrets] ${files.length} log(s) clean`)
}
```

Dependencies:

```bash
pnpm remove shadcn
pnpm add -D shadcn@4.21.4
```

and add to `package.json` scripts: `"audit:deps": "pnpm audit --prod --audit-level high"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/next-config-headers.test.ts tests/unit/api/error-envelope.test.ts tests/unit/check-log-secrets.test.ts && pnpm test:integration tests/integration/security tests/integration/auth`
Expected: PASS.

Run: `pnpm audit:deps`
Expected: exit 0 (no high/critical in production dependencies; the moderate `esbuild` via `drizzle-kit` is below the gate). If a high/critical appears that Phases 5–9 introduced: upgrade within the range (`pnpm update <pkg>`), or add a `pnpm.overrides` entry pinning the patched version (2-week rule), re-run, and add a line to `docs/runbook.md` "Dependency audit" (Task 13). If no patched version exists and the package is build/dev-only, move it to `devDependencies` as done for `shadcn`.

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0 (the CSS import still resolves `shadcn/tailwind.css`).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write next.config.ts server/api/middleware/error.ts server/auth/auth.ts scripts/check-log-secrets.ts tests/unit/next-config-headers.test.ts tests/unit/api/error-envelope.test.ts tests/unit/check-log-secrets.test.ts tests/integration/security tests/integration/auth/rate-limit-config.test.ts
git add next.config.ts server/api/middleware/error.ts server/auth/auth.ts scripts/check-log-secrets.ts package.json pnpm-lock.yaml tests/unit/next-config-headers.test.ts tests/unit/api/error-envelope.test.ts tests/unit/check-log-secrets.test.ts tests/integration/security tests/integration/auth/rate-limit-config.test.ts
git commit -m "$(cat <<'EOF'
feat(security): hardening headers, CSRF sweep, log and audit gates

Pages send nosniff, referrer, frame, permissions and HSTS headers;
every mutating admin route is proven to reject cross-origin requests;
rate-limit config and log hygiene are pinned by tests; reset emails no
longer reveal account existence by timing; shadcn is a dev dependency
so the production audit is clean.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Users and bootstrap hardening, `demo:remove`, auth policy tests (master Task 10.2, part 3)

**Files:**
- Modify: `server/modules/users/service.ts` (`createPasswordLink` atomic under the owners lock; promotion revokes sessions; `unbanUser` no-op when not banned), `server/modules/users/repo.ts` (`insertPasswordToken`, `deleteUserById`, `listUsersByEmailDomain`, `deleteUsersByIds`), `server/modules/users/bootstrap.ts` (`createOwner` rolls back; `seedDemoUsers` audits + message; `removeDemoUsers`), `server/auth/tokens.ts` (`newPasswordToken`), `scripts/demo-seed.ts` (no change in behaviour; message comes from bootstrap), `scripts/build-scripts.ts` (`"demo-remove"`), `package.json` (`"demo:remove"`)
- Create: `scripts/demo-remove.ts`
- Test: `tests/integration/users/hardening.test.ts`, `tests/integration/users/create-owner-rollback.test.ts`, `tests/integration/auth/password-policy.test.ts`

**Interfaces:**
- Consumes: Phase 2 users module (`lockOwners`, `countActiveOwners`, `deletePasswordTokens`, `deleteUserSessions`, `deleteImpersonationSessionsOf`, `findUserByEmail`, `loadTarget`, `assertMayTouch`), `passwordUrl`, `RECOVERY_TOKEN_EXPIRES_IN`, `INVITE_TOKEN_EXPIRES_IN`, tables `verifications`, `users`, `sessions`; `writeAudit`; `getAuth`.
- Produces:

```ts
// server/auth/tokens.ts
export function newPasswordToken(): string                     // 24 random bytes, base64url
// server/modules/users/repo.ts
export async function insertPasswordToken(db: DbOrTx, row: { userId: string; token: string; expiresAt: Date }): Promise<void>   // "reset-password:<token>" verification row
export async function deleteUserById(db: DbOrTx, id: string): Promise<void>
export async function listUsersByEmailDomain(db: DbOrTx, domain: string): Promise<UserRow[]>
export async function deleteUsersByIds(db: DbOrTx, ids: string[]): Promise<number>
// server/modules/users/bootstrap.ts
export async function removeDemoUsers(): Promise<{ removed: string[] }>   // 409 CONFLICT when no real active owner would remain
// CLI
pnpm demo:remove   |   node scripts/dist/demo-remove.mjs
```

Behaviour: `createPasswordLink` runs under `lockOwners` in one transaction (target re-read and `assertMayTouch` inside it; old links deleted, new verification row inserted and the audit row written together), then emails outside the transaction. Promotion to owner additionally deletes **all** the target's sessions (`diff.sessionsRevoked`) — a password an admin set before the promotion can no longer ride an existing session; the runbook tells new owners to change their password and enable 2FA. `unbanUser` on a user who is not banned returns the user unchanged and writes no audit row. `createOwner` deletes the just-created user when the link or audit step fails. `seedDemoUsers` writes one audit row `user.demo_seeded` (`diff: { emails, via: "demo:seed" }`) and its length error reads "`--password` (or DEMO_PASSWORD) must be 12–128 characters". `removeDemoUsers` takes the owners lock, signs the demo users out everywhere, deletes them (FKs cascade or set null), checks at least one active owner remains (else rolls back with 409 "Create a real owner first (pnpm admin:create)") and audits `user.demo_removed`.

- [ ] **Step 1: Write the failing tests**

`tests/integration/users/hardening.test.ts`:

```ts
import { and, eq, like } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { auditLog, sessions, users, verifications } from "@/server/db/schema"
import type { Actor } from "@/server/lib/actor"
import {
  removeDemoUsers,
  seedDemoUsers,
} from "@/server/modules/users/bootstrap"
import {
  createPasswordLink,
  setRoles,
  unbanUser,
} from "@/server/modules/users/service"

import { resetDb } from "../db"
import { createUser, signIn } from "../helpers/auth"

const actor = (userId: string, roles: Actor["roles"]): Actor => ({
  userId,
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})
const DEMO_PASSWORD = "demo-password-0123456789"

beforeEach(resetDb)

describe("users hardening (Phase 10 sweep)", () => {
  it("a new password link replaces older ones atomically and is audited", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const target = await createUser({ roles: ["editor"] })
    const first = await createPasswordLink(actor(owner.id, ["owner"]), target.id)
    const second = await createPasswordLink(actor(owner.id, ["owner"]), target.id)
    expect(first.url).not.toBe(second.url)
    const rows = await getDb()
      .select()
      .from(verifications)
      .where(
        and(
          like(verifications.identifier, "reset-password:%"),
          eq(verifications.value, target.id)
        )
      )
    expect(rows.map((r) => r.identifier)).toEqual([
      `reset-password:${new URL(second.url).searchParams.get("token")}`,
    ])
    const audit = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.password_link"))
    expect(audit).toHaveLength(2)
  })

  it("promotion to owner signs the target out everywhere", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const target = await createUser({ roles: ["admin"] })
    await signIn(target.email)
    await setRoles(actor(owner.id, ["owner"]), target.id, { roles: ["owner"] })
    expect(
      await getDb().select().from(sessions).where(eq(sessions.userId, target.id))
    ).toHaveLength(0)
    const [row] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.roles_change"))
    expect(row.diff).toMatchObject({ sessionsRevoked: 1 })
  })

  it("unbanning a user who is not banned changes and audits nothing", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const target = await createUser({ roles: ["editor"] })
    const item = await unbanUser(actor(owner.id, ["owner"]), target.id)
    expect(item.id).toBe(target.id)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "user.unban"))
    ).toHaveLength(0)
  })

  it("demo seeding is audited; demo:remove refuses to leave no real owner", async () => {
    await seedDemoUsers(DEMO_PASSWORD)
    const seeded = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.demo_seeded"))
    expect(seeded).toHaveLength(1)
    expect((seeded[0].diff as { emails: string[] }).emails).toHaveLength(7)

    await expect(removeDemoUsers()).rejects.toThrow(
      "Create a real owner first (pnpm admin:create)"
    )
    expect(
      await getDb().select().from(users).where(like(users.email, "%@demo.local"))
    ).toHaveLength(7)

    await createUser({ roles: ["owner"], email: "real.owner@example.test" })
    const { removed } = await removeDemoUsers()
    expect(removed).toHaveLength(7)
    expect(
      await getDb().select().from(users).where(like(users.email, "%@demo.local"))
    ).toHaveLength(0)
    expect(
      await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "user.demo_removed"))
    ).toHaveLength(1)
  })

  it("names both inputs in the demo password length error", async () => {
    await expect(seedDemoUsers("short")).rejects.toThrow(
      "--password (or DEMO_PASSWORD) must be 12–128 characters"
    )
  })
})
```

`tests/integration/users/create-owner-rollback.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/server/lib/audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/lib/audit")>()
  return {
    ...original,
    writeAudit: vi.fn(async (...args: Parameters<typeof original.writeAudit>) => {
      const entry = args[2]
      if ((entry.diff as { via?: string } | undefined)?.via === "admin:create")
        throw new Error("audit store unavailable")
      return original.writeAudit(...args)
    }),
  }
})

import { getDb } from "@/server/db/client"
import { createOwner } from "@/server/modules/users/bootstrap"
import { findUserByEmail } from "@/server/modules/users/repo"

import { resetDb } from "../db"

beforeEach(resetDb)

describe("admin:create is all-or-nothing (ledger P02-7)", () => {
  it("removes the new owner again when a later step fails", async () => {
    await expect(
      createOwner({ email: "first.owner@example.test", name: "First Owner" })
    ).rejects.toThrow("audit store unavailable")
    expect(await findUserByEmail(getDb(), "first.owner@example.test")).toBeNull()
  })
})
```

`tests/integration/auth/password-policy.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { createPasswordToken } from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { sessions } from "@/server/db/schema"

import { resetDb } from "../db"
import { authPost, cookieNames, createUser, signIn } from "../helpers/auth"

beforeEach(resetDb)

const reset = async (userId: string, newPassword: string) =>
  authPost("/reset-password", {
    token: await createPasswordToken(userId, 3600),
    newPassword,
  })

describe("password policy (spec §6: ≥ 12 characters; ledger P02-2)", () => {
  it("a password reset ends every session of that user", async () => {
    const user = await createUser({ roles: ["editor"] })
    await signIn(user.email)
    await signIn(user.email)
    const res = await reset(user.id, "a-brand-new-password-1")
    expect(res.status).toBe(200)
    expect(
      await getDb().select().from(sessions).where(eq(sessions.userId, user.id))
    ).toHaveLength(0)
  })

  it("accepts 12 and 128 characters, rejects 11 and 129", async () => {
    const user = await createUser({ roles: ["editor"] })
    expect((await reset(user.id, "x".repeat(11))).status).toBe(400)
    expect((await reset(user.id, "x".repeat(12))).status).toBe(200)
    expect((await reset(user.id, "y".repeat(129))).status).toBe(400)
    expect((await reset(user.id, "y".repeat(128))).status).toBe(200)
  })
})

describe("cookies on an https origin", () => {
  const savedUrl = process.env.BETTER_AUTH_URL
  afterEach(() => {
    process.env.BETTER_AUTH_URL = savedUrl
  })

  it("are __Secure- prefixed", async () => {
    process.env.BETTER_AUTH_URL = "https://admin.example.test"
    const user = await createUser({ roles: ["editor"] })
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://admin.example.test",
      },
      body: JSON.stringify({
        email: user.email,
        password: "correct-horse-battery-staple",
      }),
    })
    expect(res.status).toBe(200)
    const names = cookieNames(res)
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) expect(name.startsWith("__Secure-sp.")).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration tests/integration/users/hardening.test.ts tests/integration/users/create-owner-rollback.test.ts tests/integration/auth/password-policy.test.ts`
Expected: FAIL — `removeDemoUsers` is not exported; promotion leaves 1 session; unban writes an audit row; no `user.demo_seeded` row; the length message differs; the rollback test finds the owner. The password-policy tests are regression pins and may pass already.

- [ ] **Step 3: Implement**

`server/auth/tokens.ts` — add, and use it in `createPasswordToken`:

```ts
/** A single-use password-link token (24 random bytes, URL-safe). */
export function newPasswordToken(): string {
  return randomBytes(24).toString("base64url")
}
```

(in `createPasswordToken`, replace `randomBytes(24).toString("base64url")` with `newPasswordToken()`).

`server/modules/users/repo.ts` — append:

```ts
/**
 * The same verification row Better Auth's /request-password-reset writes
 * (`reset-password:<token>` → user id), inside the caller's transaction.
 */
export async function insertPasswordToken(
  db: DbOrTx,
  row: { userId: string; token: string; expiresAt: Date }
): Promise<void> {
  await db.insert(verifications).values({
    identifier: `reset-password:${row.token}`,
    value: row.userId,
    expiresAt: row.expiresAt,
  })
}

export async function deleteUserById(db: DbOrTx, id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id))
}

/** Users whose email ends in "@<domain>" (demo accounts). */
export async function listUsersByEmailDomain(
  db: DbOrTx,
  domain: string
): Promise<UserRow[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%@${domain}`))
  const out: UserRow[] = []
  for (const { id } of rows) {
    const row = await findUserById(db, id)
    if (row) out.push(row)
  }
  return out
}

/** Deletes users (sessions, accounts, 2FA cascade; authored rows keep a null actor). */
export async function deleteUsersByIds(
  db: DbOrTx,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0
  const deleted = await db
    .delete(users)
    .where(inArray(users.id, ids))
    .returning({ id: users.id })
  return deleted.length
}
```

(add `inArray` to the `drizzle-orm` import if missing; `like`, `eq`, `users`, `verifications`, `findUserById`, `UserRow` already exist in this file).

`server/modules/users/service.ts` — replace `createPasswordLink`:

```ts
/**
 * Single-use link to choose a password: "set-password" for invited users,
 * "reset-password" otherwise. Emailed when SMTP works; always returned so an
 * admin can pass it on when it does not (spec §17 bootstrap without SMTP).
 * Under the owners lock, in one transaction: the target is re-checked, older
 * links die and the new one is created together (ledger P02-4).
 */
export async function createPasswordLink(
  actor: Actor,
  id: string
): Promise<PasswordLinkResult> {
  need(actor, { user: ["update"] })
  const db = getDb()
  const token = newPasswordToken()
  const target = await db.transaction(async (tx) => {
    await repo.lockOwners(tx)
    const found = await loadTarget(tx, id)
    assertMayTouch(actor, found)
    if (isBannedNow(found))
      throw new AppError(
        "CONFLICT",
        "Unban this user before sending a password link"
      )
    const revoked = await repo.deletePasswordTokens(tx, id)
    await repo.insertPasswordToken(tx, {
      userId: id,
      token,
      expiresAt: new Date(Date.now() + RECOVERY_TOKEN_EXPIRES_IN * 1000),
    })
    await writeAudit(tx, actor, {
      action: "user.password_link",
      entityType: "user",
      entityId: id,
      diff: { passwordLinksRevoked: revoked },
    })
    return found
  })
  const url = passwordUrl(
    target.hasPassword ? "reset-password" : "set-password",
    token
  )
  const { delivered } = target.hasPassword
    ? await mailer.send({
        to: target.email,
        subject: "Reset your Security Partners admin password",
        react: createElement(ResetPasswordEmail, {
          name: target.name,
          url,
          expiresInMinutes: RECOVERY_TOKEN_EXPIRES_IN / 60,
        }),
      })
    : await sendInviteEmail(db, actor, {
        to: target.email,
        name: target.name,
        url,
        expiresInSeconds: RECOVERY_TOKEN_EXPIRES_IN,
      })
  return { url, emailDelivered: delivered }
}
```

(import `newPasswordToken` from `@/server/auth/tokens`; `createPasswordToken` stays imported if `inviteUser` still uses it).

In `setRoles`, extend the promotion branch:

```ts
    if (input.roles.includes("owner") && !from.includes("owner")) {
      // New owner: links and "View as" sessions issued while they were not
      // an owner (by non-owners) must not grant owner access, and neither
      // may sessions opened with a password someone else set (ledger P02-4).
      revoked.passwordLinksRevoked = await repo.deletePasswordTokens(tx, id)
      revoked.impersonationsRevoked = await repo.deleteImpersonationSessionsOf(
        tx,
        id
      )
      revoked.sessionsRevoked = await repo.deleteUserSessions(tx, id)
    }
```

Replace `unbanUser`:

```ts
export async function unbanUser(actor: Actor, id: string): Promise<UserItem> {
  need(actor, { user: ["ban"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  // Nothing to undo: no change, no audit row (ledger P02-4).
  if (!target.banned) return toUserItem(target)
  await db.transaction(async (tx) => {
    await repo.setUserBan(tx, id, null)
    await writeAudit(tx, actor, {
      action: "user.unban",
      entityType: "user",
      entityId: id,
    })
  })
  return toUserItem(await loadTarget(db, id))
}
```

`server/modules/users/bootstrap.ts` — in `createOwner`, replace everything after `const { user } = await getAuth().api.createUser(...)`:

```ts
  let url: string
  try {
    url = passwordUrl(
      "set-password",
      await createPasswordToken(user.id, INVITE_TOKEN_EXPIRES_IN)
    )
    await writeAudit(db, null, {
      action: "user.invite",
      entityType: "user",
      entityId: user.id,
      diff: { email, roles: ["owner"], via: "admin:create" },
    })
  } catch (err) {
    // All or nothing: a half-created owner would block the next attempt
    // ("already exists") without a working link (ledger P02-7).
    await repo.deleteUserById(db, user.id)
    throw err
  }
  const { delivered } = await sendInviteEmail({
    to: email,
    name,
    url,
    expiresInSeconds: INVITE_TOKEN_EXPIRES_IN,
  })
  return { userId: user.id, url, emailDelivered: delivered }
```

In `seedDemoUsers`, change the length error to:

```ts
    throw new AppError(
      "VALIDATION_FAILED",
      `--password (or DEMO_PASSWORD) must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`
    )
```

and before `return result` add:

```ts
  await writeAudit(db, null, {
    action: "user.demo_seeded",
    diff: { emails: result.map((u) => u.email), via: "demo:seed" },
  })
```

Append `removeDemoUsers`:

```ts
const NIL_UUID = "00000000-0000-0000-0000-000000000000"

/**
 * demo:remove (spec §14 "remove before handover"): deletes every
 * <role>@demo.local account under the owners lock, signing them out
 * everywhere first. Refuses (and changes nothing) when no real active owner
 * would remain.
 */
export async function removeDemoUsers(): Promise<{ removed: string[] }> {
  const db = getDb()
  return db.transaction(async (tx) => {
    await repo.lockOwners(tx)
    const demo = await repo.listUsersByEmailDomain(tx, DEMO_EMAIL_DOMAIN)
    for (const user of demo) await repo.deleteUserSessions(tx, user.id)
    await repo.deleteUsersByIds(
      tx,
      demo.map((user) => user.id)
    )
    if ((await repo.countActiveOwners(tx, NIL_UUID)) === 0)
      throw new AppError(
        "CONFLICT",
        "Create a real owner first (pnpm admin:create), then remove the demo accounts"
      )
    const removed = demo.map((user) => user.email)
    await writeAudit(tx, null, {
      action: "user.demo_removed",
      diff: { emails: removed, via: "demo:remove" },
    })
    return { removed }
  })
}
```

`scripts/demo-remove.ts`:

```ts
// Deletes every demo account (<role>@demo.local) — run before handover
// (docs/launch.md). Refuses while no real active owner exists.
//   pnpm demo:remove   |   node scripts/dist/demo-remove.mjs
import { removeDemoUsers } from "@/server/modules/users/bootstrap"

import { runScript } from "./lib/run-script"

await runScript("demo:remove", async () => {
  const { removed } = await removeDemoUsers()
  if (removed.length === 0) {
    console.log("[demo:remove] no demo accounts found")
    return
  }
  for (const email of removed) console.log(`[demo:remove] removed ${email}`)
  console.log(`[demo:remove] ${removed.length} demo account(s) removed`)
})
```

`scripts/build-scripts.ts` — append `"demo-remove"`. `package.json` — add `"demo:remove": "pnpm tsx:server scripts/demo-remove.ts"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/users tests/integration/auth && pnpm exec vitest run --project unit tests/unit/scripts-bundle.test.ts`
Expected: PASS. Existing users tests that assert the exact `user.roles_change` diff of a promotion gain `sessionsRevoked` — update those expectations (`toMatchObject` keeps passing).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write server/auth/tokens.ts server/modules/users scripts/demo-remove.ts scripts/build-scripts.ts tests/integration/users tests/integration/auth/password-policy.test.ts
git add server/auth/tokens.ts server/modules/users scripts/demo-remove.ts scripts/build-scripts.ts package.json tests/integration/users tests/integration/auth/password-policy.test.ts
git commit -m "$(cat <<'EOF'
fix(users): atomic password links, safer promotion, demo:remove

Password links are replaced under the owners lock in one transaction;
promotion to owner ends the target's sessions; unban of an active user
is a no-op; admin:create rolls back on failure; demo seeding is audited
and demo:remove deletes the demo accounts while keeping a real owner.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Lint boundaries and the shared LIKE helper (master Task 10.2, part 4)

**Files:**
- Modify: `eslint.config.mjs`, every `server/modules/*/repo.ts` that declares its own `escapeLike` (today: `search`, `audit`, `users`, `collections`, `services`, `media`; Phases 5–8 may have added `articles`, `leads`, `redirects` — find them with `grep -rln "const escapeLike" server`)
- Create: `server/db/like.ts`
- Test: `tests/unit/lint-boundaries.test.ts` (append), `tests/unit/like.test.ts`

**Interfaces:**
- Consumes: existing lint config and repos.
- Produces:

```ts
// server/db/like.ts
export function escapeLike(value: string): string       // escapes \ % _ (default ESCAPE '\')
export function containsPattern(value: string): string  // `%${escapeLike(value)}%`
```

Lint rules after this task: the drizzle and server-import boundaries also cover `.js/.mjs/.cjs/.mts` files; `lib/**`, `templates/*/schema.ts` and `templates/registry.ts` may not reach `server/` through static imports, dynamic `import()` or `require()`; `server/modules/*/routes.ts` may not import any `repo` (alias or relative, incl. `../<module>/repo`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/lint-boundaries.test.ts`:

```ts
async function syntaxErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax")
}

describe(
  "lint boundaries: Phase 10 gaps (ledger P01-1, P03-3, P03-6)",
  { timeout: 30_000 },
  () => {
    it("flags dynamic import() of server/ from lib/", async () => {
      const errors = await syntaxErrors(
        'export const load = () => import("@/server/env")\n',
        "lib/fixture.ts"
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain("never import server/ code")
    })

    it("flags require() of server/ from lib/", async () => {
      expect(
        await syntaxErrors(
          'export const env = require("../server/env")\n',
          "lib/fixture.ts"
        )
      ).toHaveLength(1)
    })

    it("does not flag dynamic imports of look-alike or lib paths", async () => {
      expect(
        await syntaxErrors(
          'export const a = () => import("@/server-utils")\nexport const b = () => import("@/lib/utils")\n',
          "lib/fixture.ts"
        )
      ).toEqual([])
    })

    it("covers .mjs files under lib/", async () => {
      expect(
        await boundaryErrors(
          'import { getEnv } from "../server/env.js"\n\nexport const x = getEnv\n',
          "lib/fixture.mjs"
        )
      ).toHaveLength(1)
    })

    it("covers templates/registry.ts", async () => {
      expect(
        await boundaryErrors(
          'import { getEnv } from "@/server/env"\n\nexport const x = getEnv\n',
          "templates/registry.ts"
        )
      ).toHaveLength(1)
    })

    it("flags a route importing another module's repo by relative path", async () => {
      expect(
        await boundaryErrors(
          'import { findUserById } from "../users/repo"\n\nexport const x = findUserById\n',
          "server/modules/pages/routes.ts"
        )
      ).toHaveLength(1)
    })

    it("flags drizzle-orm in a .mjs file outside repos", async () => {
      expect(
        await boundaryErrors(
          'import { eq } from "drizzle-orm"\n\nexport const x = eq\n',
          "scripts/fixture.mjs"
        )
      ).toHaveLength(1)
    })
  }
)
```

`tests/unit/like.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { containsPattern, escapeLike } from "@/server/db/like"

describe("LIKE helpers (ledger P04-9)", () => {
  it("escapes wildcards and the escape character", () => {
    expect(escapeLike(String.raw`50%_off\now`)).toBe(String.raw`50\%\_off\\now`)
    expect(containsPattern("a_b")).toBe(String.raw`%a\_b%`)
  })

  it("is the only LIKE escaper in the repos", () => {
    const modules = join(process.cwd(), "server/modules")
    const copies = readdirSync(modules)
      .map((name) => join(modules, name, "repo.ts"))
      .filter((file) => {
        try {
          return readFileSync(file, "utf8").includes("const escapeLike")
        } catch {
          return false
        }
      })
    expect(copies).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/lint-boundaries.test.ts tests/unit/like.test.ts`
Expected: FAIL — no `no-restricted-syntax` errors; `.mjs`/registry/relative-repo not flagged; `@/server/db/like` missing.

- [ ] **Step 3: Implement**

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const CODE = "{ts,tsx,mts,cts,js,mjs,cjs}";

// Isomorphic code (lib/, template schemas, the template registry) also ships
// to the browser: it must never import server/ (secrets, database, Node-only
// APIs) — statically, with import() or with require().
const SERVER_MESSAGE =
  "lib/ and templates/*/schema.ts are isomorphic: never import server/ code.";
const serverImport = {
  regex: "^(?:@/server|(?:\\.\\./)+server)(?:/|$)",
  message: SERVER_MESSAGE,
};
// esquery regex: character classes instead of "/" (probed, Phase 10 plan).
const SERVER_PATH = "/^(@[/]server|([.][.][/])+server)([/]|$)/";
const serverSyntax = [
  {
    selector: `ImportExpression[source.value=${SERVER_PATH}]`,
    message: SERVER_MESSAGE,
  },
  {
    selector: `CallExpression[callee.name='require'][arguments.0.value=${SERVER_PATH}]`,
    message: SERVER_MESSAGE,
  },
];
// Only repositories talk to Drizzle (global constraint). Schema, migrations
// and the seed live in server/db/; tests may query directly.
const drizzleImport = {
  regex: "^drizzle-orm(?:/|$)",
  message:
    "Only server/modules/*/repo.ts (and server/db/**) may import drizzle-orm. Call a repo function instead.",
};
// Routes validate, authorise and call a service; never a repo (any module's).
const repoImport = {
  regex: "^(?:\\.{1,2}/(?:[^/]+/)*repo|@/server/modules/[^/]+/repo)$",
  message: "Routes call services, never repos.",
};

const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const ISOMORPHIC = [
  `lib/**/*.${CODE}`,
  "templates/*/schema.ts",
  "templates/registry.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A later block replaces the rule for the files it matches, so each block
  // lists every pattern that applies to its files.
  {
    files: [`**/*.${CODE}`],
    ignores: ["server/db/**", "server/modules/*/repo.ts", "tests/**"],
    rules: restrict(drizzleImport),
  },
  {
    files: ISOMORPHIC,
    rules: {
      ...restrict(serverImport, drizzleImport),
      "no-restricted-syntax": ["error", ...serverSyntax],
    },
  },
  // The typed admin API client needs the route *types* only (erased at
  // build): type-only imports of server/ are allowed in this one file.
  {
    files: ["lib/api-client.ts"],
    rules: {
      ...restrict(drizzleImport),
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ ...serverImport, allowTypeImports: true }] },
      ],
    },
  },
  {
    files: ["server/modules/*/routes.ts"],
    rules: restrict(drizzleImport, repoImport),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output:
    "scripts/dist/**",
    "coverage/**",
    ".vitest/**",
    ".data/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
```

(If later phases added blocks to `eslint.config.mjs`, keep them, applying `CODE` to their globs the same way.)

`server/db/like.ts`:

```ts
import "server-only"

/** Escapes LIKE/ILIKE wildcards (% _) and the escape character (\, Postgres' default ESCAPE). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`)
}

/** `%value%` with wildcards escaped: a substring match for LIKE/ILIKE. */
export function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`
}
```

In every file listed by `grep -rln "const escapeLike" server/modules`: delete the local `const escapeLike = …` line, add `import { containsPattern } from "@/server/db/like"` (and/or `escapeLike` where it is used without the `%…%` wrapper), and replace each `` `%${escapeLike(EXPR)}%` `` with `containsPattern(EXPR)`. In `server/modules/search/repo.ts` replace `const contains = (q: string) => `%${escapeLike(q)}%`` with `const contains = containsPattern` (or call `containsPattern` directly at its uses).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/lint-boundaries.test.ts tests/unit/like.test.ts && pnpm lint`
Expected: PASS; `pnpm lint` clean across the repo (fix any newly reported real violation in `.js/.mjs` files by moving the import into a repo, not by disabling the rule).

Run: `pnpm test:integration tests/integration/api/search.test.ts tests/integration/api/audit.test.ts tests/integration/api/users.test.ts tests/integration/api/collections.test.ts tests/integration/api/media.test.ts && pnpm typecheck`
Expected: PASS (search behaviour unchanged).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write server/db/like.ts server/modules tests/unit/lint-boundaries.test.ts tests/unit/like.test.ts
git add eslint.config.mjs server/db/like.ts server/modules tests/unit/lint-boundaries.test.ts tests/unit/like.test.ts
git commit -m "$(cat <<'EOF'
refactor(lint): close import-boundary gaps, share the LIKE escaper

Boundaries now cover js/mjs files, dynamic import() and require(), the
template registry and relative repo imports from routes; one escapeLike
helper replaces the per-repo copies.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Deferred admin findings — palette alert, group errors, loading status, sign-out error, editor conflicts, slug flush (master Task 10.2, part 5)

**Files:**
- Modify: `components/admin/shell/command-palette.tsx` (alert outside the listbox), `components/admin/schema-form/widgets/group.tsx` (`GroupErrors` keys; list-item group described by its errors), `components/admin/pages/pages-list.tsx` + `components/admin/editor/versioned-editor.tsx` (loading containers `role="status"`; plus every other admin file the new source test lists), `components/admin/shell/user-menu.tsx` (opening the menu clears only the menu's error), `hooks/use-autosave.ts` (no send after a 409 of the save it waited for), `components/admin/editor/versioned-editor.tsx` (list invalidation by prefix; overwrite needs their version; "publish again" hint; restore 409 → conflict dialog), `components/admin/services/service-editor.tsx` (flush pending edits before an address change)
- Test: `tests/dom/command-palette.test.tsx` (append), `tests/dom/schema-form-lists.test.tsx` (append), `tests/unit/admin/aria-busy.test.ts` (new), `tests/dom/sign-out-errors.test.tsx` (new), `tests/dom/use-autosave.test.tsx` (append), `tests/dom/versioned-editor.test.tsx` (append + `renderEditor(client?)`), `tests/dom/service-slug-flush.test.tsx` (new)

**Interfaces:**
- Consumes: Phase 4/4b components named above; Phase 5 Task 5 `EditorActionContext<Dto>` (`{ record, draft, flush(): Promise<boolean>, version(): number, accept(dto), showAllErrors() }`) and render-prop `aside?: ReactNode | ((ctx) => ReactNode)` on `VersionedEditor`; `isDeepEqual` (`lib/json.ts`); `ApiError`.
- Produces (behaviour; no new exports except the test-visible ones below):

```ts
// hooks/use-autosave.ts
flush()                 // returns false without sending when the save it waited for hit a 409 (until resolveConflict())
// components/admin/editor/versioned-editor.tsx
// accept(): marks every query whose key starts with queryKey[0] stale (refetchType "none"), except the editor's own key
// onOverwrite without `current` → toast "Their version could not be loaded", dialog stays open, nothing sent
// after a successful overwrite → toast "Your version replaced theirs" (+ "Publish to put it on the site." when the record is live)
// restore → 409 → History closes, conflict dialog opens (same as a save conflict)
// components/admin/services/service-editor.tsx
// SlugCard: await ctx.flush() before PATCH …/slug and send ctx.version(); on false → "Save your changes first: fix the fields marked in red, then change the address."
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/dom/command-palette.test.tsx`, inside the `describe` block:

```ts
  it("keeps the failed-search alert outside the listbox (ARIA: listbox children are options)", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "VALIDATION", message: "Bad" } }),
          { status: 422, headers: { "content-type": "application/json" } }
        )
    )
    const user = userEvent.setup()
    renderShell()
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", { name: "Search the admin" })
    await user.type(within(dialog).getByRole("combobox"), "zzz")
    const alert = await within(dialog).findByRole("alert")
    expect(alert.closest('[role="listbox"]')).toBeNull()
  })
```

Append to `tests/dom/schema-form-lists.test.tsx`:

```ts
describe("SchemaForm list-item errors (ledger P04-5)", () => {
  it("describes the item group by its own errors, without duplicate keys", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    renderHome({
      "hero.stats.1": ["Count must match the value", "Count must match the value"],
    })
    // If list items render collapsed (04b Task 13), open Stat 2 first.
    const toggle = within(stat(2)).queryByRole("button", { expanded: false })
    if (toggle) fireEvent.click(toggle)
    const messages = await within(stat(2)).findAllByText(
      "Count must match the value"
    )
    expect(messages).toHaveLength(2)
    const container = messages[0].parentElement!
    expect(container.id).not.toBe("")
    const described = document.querySelector(
      `[aria-describedby~="${container.id}"]`
    )
    expect(described).not.toBeNull()
    expect(described).toHaveAttribute("role", "group")
    expect(error.mock.calls.flat().join(" ")).not.toContain("same key")
    error.mockRestore()
  })
})
```

`tests/unit/admin/aria-busy.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return path.endsWith(".tsx") ? [path] : []
  })
}

describe("admin loading states are announced (ledger P04-8)", () => {
  it("every element with aria-busy also has a role (aria-label on a generic div is ignored)", () => {
    const offenders: string[] = []
    for (const file of [
      ...files("components/admin"),
      ...files("app/(admin)"),
    ]) {
      const source = readFileSync(file, "utf8")
      for (const tag of source.match(/<[A-Za-z][\w.]*\s[^<>]*?aria-busy[^<>]*>/g) ?? [])
        if (!/\brole=/.test(tag)) offenders.push(`${file}: ${tag.slice(0, 80)}`)
    }
    expect(offenders).toEqual([])
  })
})
```

`tests/dom/sign-out-errors.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname === "/api/auth/sign-out")
        return new Response(JSON.stringify({ message: "Unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        })
      return new Response(
        JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    })
  )
})

describe("shell sign-out errors (ledger P04b-4)", () => {
  it("opening the user menu keeps the dock's sign-out error", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell
        queryClient={makeQueryClient()}
        session={{
          user: { id: "u1", name: "Edith Editor", email: "e@x.test", title: null, twoFactorEnabled: true },
          roles: ["editor"],
          impersonatedBy: null,
        }}
      >
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: "Log out" }))
    const alert = await screen.findByRole("alert")
    await user.click(
      screen.getByRole("button", { name: "Account menu for Edith Editor" })
    )
    await user.keyboard("{Escape}")
    expect(alert).toBeInTheDocument()
  })
})
```

Append to `tests/dom/use-autosave.test.tsx`, inside the `describe`:

```ts
  it("a flush queued behind a save that hits 409 sends nothing (ledger P04-7)", async () => {
    let reject: (err: unknown) => void = () => undefined
    const save = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail
        })
    )
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    rerender({ value: { t: "b" }, savedValue: { t: "a" } })
    let first: Promise<boolean> = Promise.resolve(true)
    let second: Promise<boolean> = Promise.resolve(true)
    act(() => {
      first = result.current.flush()
      second = result.current.flush()
    })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await act(async () => {
      reject(
        new ApiError(409, {
          error: { code: "CONFLICT", message: "Changed", current: { version: 4 } },
        })
      )
      expect(await first).toBe(false)
      expect(await second).toBe(false)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.state).toBe("conflict")
  })
```

In `tests/dom/versioned-editor.test.tsx`: change the helper to accept a client —

```tsx
function renderEditor(client = makeQueryClient()) {
  return render(
    <AdminShell
      queryClient={client}
      // … session prop unchanged …
    >
      <PageEditor pageKey="home" />
    </AdminShell>
  )
}
```

and append inside `describe("page editor (master 4.4)", …)` (after the "copy mine" test, so `saveStatus`, `conflictBody`, `bodyOf`, `PutBody` are in scope):

```ts
  it("a 409 on restore opens the conflict dialog (ledger P04-7)", async () => {
    const user = userEvent.setup()
    routes["GET /api/v1/admin/revisions/page/home"] = () =>
      json(200, {
        items: [
          {
            id: "0190a6e0-0000-7000-8000-0000000000aa",
            version: 1,
            createdAt: "2026-10-16T08:00:00.000Z",
            actor: null,
          },
        ],
      })
    routes["POST /api/v1/admin/pages/home/restore"] = () =>
      json(409, conflictBody("Their heading"))
    renderEditor()
    await headingInput()
    await user.click(screen.getByRole("button", { name: "History" }))
    await user.click(
      await screen.findByRole("button", { name: "Restore version 1" })
    )
    await user.click(
      await screen.findByRole("button", { name: "Restore into draft" })
    )
    const dialog = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Reload their version" })
    )
    await waitFor(async () =>
      expect(await headingInput()).toHaveValue("Their heading")
    )
  })

  it("overwrite without their version keeps the dialog open and sends nothing", async () => {
    const user = userEvent.setup()
    const bodies: PutBody[] = []
    routes["PUT /api/v1/admin/pages/home/draft"] = (init) => {
      bodies.push(bodyOf(init))
      return json(409, {
        error: { code: "CONFLICT", message: "Changed", requestId: "r" },
      })
    }
    renderEditor()
    const heading = await headingInput()
    await user.type(heading, " mine")
    await user.keyboard("{Control>}s{/Control}")
    const dialog = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    await user.click(
      within(dialog).getByRole("button", { name: "Overwrite with mine" })
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(bodies).toHaveLength(1)
    expect(
      screen.getByRole("alertdialog", { name: "Someone else changed this" })
    ).toBeInTheDocument()
  })

  it("a save marks every list of the resource stale, including paged lists", async () => {
    const user = userEvent.setup()
    routes["PUT /api/v1/admin/pages/home/draft"] = (init) =>
      json(200, { ...dto(2, "New heading"), draft: bodyOf(init).draft })
    const client = makeQueryClient()
    client.setQueryData(["pages"], { items: [] })
    client.setQueryData(["pages", { page: 2 }], { items: [] })
    renderEditor(client)
    const heading = await headingInput()
    await user.type(heading, "!")
    await user.keyboard("{Control>}s{/Control}")
    await waitFor(() => expect(saveStatus()).toHaveTextContent("Saved"))
    expect(client.getQueryState(["pages"])?.isInvalidated).toBe(true)
    expect(client.getQueryState(["pages", { page: 2 }])?.isInvalidated).toBe(
      true
    )
    expect(client.getQueryState(["pages", "home"])?.isInvalidated).toBe(false)
  })
```

`tests/dom/service-slug-flush.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/services/x",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { ServiceEditor } from "@/components/admin/services/service-editor"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { ServiceDto } from "@/lib/schemas/api/services"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { servicesFixture } from "@/server/db/seed/fixtures/services"

const fixture = servicesFixture(fixtureMediaLookup)[0]
const ID = "00000000-0000-7000-8000-000000000001"
const initial: ServiceDto = {
  id: ID,
  slug: fixture.slug,
  sortOrder: 0,
  title: fixture.content.title,
  draft: fixture.content,
  published: fixture.content,
  version: 3,
  status: "published",
  dirty: false,
  publishedAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: null,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

let current: ServiceDto
let writes: { method: string; path: string; body: Record<string, unknown> }[]

beforeEach(() => {
  current = structuredClone(initial)
  writes = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const method = init?.method ?? "GET"
      const base = `/api/v1/admin/services/${ID}`
      if (method === "GET" && url.pathname === base) return json(200, current)
      if (method !== "GET") {
        const body = JSON.parse(String(init?.body ?? "{}"))
        writes.push({ method, path: url.pathname.slice(base.length), body })
        if (url.pathname === `${base}/draft`) {
          current = {
            ...current,
            draft: body.draft,
            title: body.draft.title,
            version: current.version + 1,
            dirty: true,
          }
          return json(200, current)
        }
        if (url.pathname === `${base}/slug`) {
          if (body.version !== current.version)
            return json(409, {
              error: { code: "CONFLICT", message: "Changed", current, requestId: "r" },
            })
          current = { ...current, slug: body.slug, version: current.version + 1 }
          return json(200, current)
        }
      }
      if (url.pathname.startsWith("/api/v1/admin/media/"))
        return json(404, { error: { code: "NOT_FOUND", message: "x" } })
      return json(200, { items: [], page: 1, pageSize: 20, total: 0 })
    })
  )
})

describe("service address change keeps pending edits (ledger P04-10)", () => {
  it("saves the pending edit first and moves with the version that save returned", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell
        queryClient={makeQueryClient()}
        session={{
          user: { id: "u", name: "U", email: "u@x.test", title: null, twoFactorEnabled: true },
          roles: ["editor"],
          impersonatedBy: null,
        }}
      >
        <ServiceEditor id={ID} />
      </AdminShell>
    )
    const name = () => screen.getAllByRole("textbox", { name: "Name" })[0]
    await waitFor(() => expect(name()).toHaveValue(initial.title))
    await user.clear(name())
    await user.type(name(), "Mobile Patrols Plus")
    const address = screen.getByRole("textbox", { name: "Address" })
    await user.clear(address)
    await user.type(address, "mobile-patrols-plus")
    await user.click(screen.getByRole("button", { name: "Change address" }))
    await waitFor(() =>
      expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([
        "PUT /draft",
        "PATCH /slug",
      ])
    )
    expect(writes[1].body).toMatchObject({ slug: "mobile-patrols-plus", version: 4 })
    await waitFor(() => expect(name()).toHaveValue("Mobile Patrols Plus"))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/command-palette.test.tsx tests/dom/schema-form-lists.test.tsx tests/dom/sign-out-errors.test.tsx tests/dom/use-autosave.test.tsx tests/dom/versioned-editor.test.tsx tests/dom/service-slug-flush.test.tsx && pnpm exec vitest run --project unit tests/unit/admin/aria-busy.test.ts`
Expected: FAIL — the alert is inside the listbox; no element is described by the group errors (and a "same key" warning); offenders `pages-list.tsx`, `versioned-editor.tsx`; the dock alert disappears when the menu opens; `save` called twice; restore 409 shows only a toast; overwrite re-sends; `["pages", { page: 2 }]` not invalidated; the slug PATCH goes out with version 3 before (or without) the PUT.

- [ ] **Step 3: Implement**

`components/admin/shell/command-palette.tsx` — move the alert above the list:

```tsx
        <Command shouldFilter={false} vimBindings={false} label="Search">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, services, team… or type a section"
          />
          {/* Outside the listbox: a listbox may only own options and groups. */}
          {failed ? (
            <p
              role="alert"
              className="px-2 py-3 text-center text-sm text-destructive"
            >
              Search failed — try again
            </p>
          ) : null}
          <CommandList>
            {failed ? null : (
              <CommandEmpty>
                {searching ? "Searching…" : `No results for “${trimmed}”.`}
              </CommandEmpty>
            )}
```

(the rest of `CommandList` is unchanged).

`components/admin/schema-form/widgets/group.tsx`:

```tsx
function GroupErrors({ id, messages }: { id: string; messages: string[] }) {
  if (!messages.length) return null
  return (
    <div id={id} className="flex flex-col gap-1">
      {messages.map((message, index) => (
        // The same message can come twice (client + server): key by position.
        <ErrorText key={index} id={`${id}-${index}`}>
          {message}
        </ErrorText>
      ))}
    </div>
  )
}
```

and the list-item branch of `GroupWidget`:

```tsx
  // A list item's object: the item card already titles it.
  if (/\.\d+$/.test(path))
    return (
      <div
        role="group"
        aria-describedby={errorRef}
        className="flex flex-col gap-4"
      >
        {errors}
        <FieldGrid shape={shape} path={path} keys={Object.keys(shape)} />
      </div>
    )
```

Loading containers — `components/admin/pages/pages-list.tsx`:

```tsx
      <div
        role="status"
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Loading pages"
      >
```

`components/admin/editor/versioned-editor.tsx` (pending state):

```tsx
      <div
        role="status"
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Loading editor"
      >
```

Apply the same `role="status"` to every other offender the new unit test lists (later phases' screens).

`components/admin/shell/user-menu.tsx`:

```tsx
      <DropdownMenu
        onOpenChange={(open) => {
          // Only the menu's own failure clears; the dock keeps its error.
          if (open && error?.source === "menu") clearError()
        }}
      >
```

`hooks/use-autosave.ts`:

```ts
  const [conflict, setConflict] = useState<ApiError | null>(null)
  // Set synchronously by a failing save, so a flush that was waiting for it
  // never sends on top of a 409 (the state update lands a render later).
  const conflictRef = useRef<ApiError | null>(null)
```

in `flush`, right after `while (inFlight.current) await inFlight.current`:

```ts
    if (conflictRef.current) return false
```

in its `catch`:

```ts
        if (err instanceof ApiError && err.isConflict) {
          conflictRef.current = err
          setConflict(err)
        } else setError(err)
```

and the returned `resolveConflict`:

```ts
    resolveConflict: () => {
      conflictRef.current = null
      setConflict(null)
    },
```

`components/admin/editor/versioned-editor.tsx` — import `isDeepEqual` from `@/lib/json`; in `accept`, replace the `invalidateQueries` call:

```ts
    // Lists of this resource (["services"], ["services", { page: 2 }], …)
    // show status badges: refetch them when next shown. Not this editor's own
    // query, which now holds `dto`.
    void queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === props.queryKey[0] &&
        !isDeepEqual(query.queryKey, props.queryKey),
      refetchType: "none",
    })
```

the `flushRequest` effect:

```ts
  useEffect(() => {
    if (flushRequest === 0) return
    void flush().then((saved) => {
      if (!saved) return
      toast.success("Your version replaced theirs", {
        description: record.published
          ? "Publish to put it on the site."
          : undefined,
      })
    })
    // Runs once per overwrite request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushRequest, flush])
```

the `RevisionDrawer` `onRestore`:

```tsx
        onRestore={async (revision) => {
          try {
            const dto = await props.restore(
              revision.id,
              baseRef.current.version
            )
            replaceDraft(dto)
            toast.success(`Version ${revision.version} restored into the draft`)
          } catch (error) {
            if (error instanceof ApiError && error.isConflict) {
              // Someone saved meanwhile: resolve it like a save conflict.
              setHistoryOpen(false)
              setPublishConflict(error)
              return
            }
            toast.error("Not restored", { description: errorMessage(error) })
            throw error
          }
        }}
```

and `onOverwrite` of `ConflictDialog`:

```tsx
        onOverwrite={() => {
          if (!current) {
            // Without their version we cannot know which version to send.
            toast.error("Their version could not be loaded", {
              description: "Copy yours, then reload the page.",
            })
            return
          }
          // Their record becomes the base; saving mine over it sends their
          // version, so the server accepts it.
          baseRef.current = { version: current.version, saved: current.draft }
          setBase(baseRef.current)
          resolveConflict()
          setFlushRequest((n) => n + 1)
        }}
```

(rename `publishConflict`/`setPublishConflict` to `requestConflict`/`setRequestConflict` in this file if you like — it now holds publish and restore conflicts; keep behaviour.)

`components/admin/services/service-editor.tsx` — the side panel becomes a render prop (Phase 5 `EditorActionContext`):

```tsx
      aside={(ctx: EditorActionContext<ServiceDto>) =>
        record.data ? (
          <SlugCard
            service={record.data}
            canEdit={canEdit}
            flush={ctx.flush}
            version={ctx.version}
            onChanged={() => setEpoch((n) => n + 1)}
          />
        ) : null
      }
```

and `SlugCard`:

```tsx
/** Thrown when pending edits could not be saved before an address change. */
class UnsavedChangesError extends Error {}

function SlugCard({
  service,
  canEdit,
  flush,
  version,
  onChanged,
}: {
  service: ServiceDto
  canEdit: boolean
  /** Saves pending editor changes; false when invalid or failed. */
  flush: () => Promise<boolean>
  /** The editor's current record version (after any save it just made). */
  version: () => number
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState(service.slug)
  const [error, setError] = useState<string | null>(null)
  const change = useMutation({
    mutationFn: async () => {
      // The editor remounts after the move and reloads from the cache: an
      // unsaved edit would be lost, so save it first (ledger P04-10).
      if (!(await flush())) throw new UnsavedChangesError()
      return unwrap(
        api.services[":id"].slug.$patch({
          param: { id: service.id },
          json: { slug, version: version() },
        })
      )
    },
    onSuccess: (dto) => {
      queryClient.setQueryData(["services", service.id], dto)
      toast.success("Address changed", {
        description: `The page is now at /services/${dto.slug}.`,
      })
      onChanged()
    },
    onError: (err) => {
      if (err instanceof UnsavedChangesError)
        setError(
          "Save your changes first: fix the fields marked in red, then change the address."
        )
      else if (err instanceof ApiError && err.isConflict && err.fieldErrors.slug)
        setError(err.fieldErrors.slug[0])
      else if (err instanceof ApiError && err.isConflict)
        setError(
          "The service changed meanwhile. Reload the page and try again."
        )
      else setError(errorMessage(err))
    },
  })
```

(the rest of `SlugCard` is unchanged; import `type EditorActionContext` from `@/components/admin/editor/versioned-editor`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom && pnpm exec vitest run --project unit tests/unit/admin`
Expected: PASS (all DOM tests, incl. the existing editor/palette/list suites).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

Run: `pnpm test:e2e tests/e2e/page-editor.spec.ts` and, if the Phase 4b axe gate exists, `pnpm test:e2e tests/e2e/admin-a11y.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin hooks/use-autosave.ts tests/dom tests/unit/admin/aria-busy.test.ts
git add components/admin hooks/use-autosave.ts tests/dom/command-palette.test.tsx tests/dom/schema-form-lists.test.tsx tests/dom/sign-out-errors.test.tsx tests/dom/use-autosave.test.tsx tests/dom/versioned-editor.test.tsx tests/dom/service-slug-flush.test.tsx tests/unit/admin/aria-busy.test.ts
git commit -m "$(cat <<'EOF'
fix(admin): deferred a11y and editor conflict findings

Palette alert leaves the listbox; list-item errors describe their group
with stable keys; loading states are announced; the dock keeps its
sign-out error; no save goes out behind a 409; restore conflicts open
the conflict dialog; paged lists refresh after saves; an address change
saves pending edits first.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Production parity for the test servers and the container (master Task 10.3, part 1)

**Files:**
- Create: `scripts/prepare-standalone.mjs`
- Modify: `Dockerfile` (tini, `/data` subdirectories, no `VOLUME`), `docker-entrypoint.sh` (comment), `scripts/build-scripts.ts` (paths from the file, not the cwd), `playwright.config.ts` (standalone `server.js`, server output piped), `tests/e2e/env.ts` (`SERVER_ENV`, `assertE2eDatabase`), `tests/e2e/seed.ts` + `tests/visual/seed.ts` (shared guard), every `tests/visual/*.spec.ts` (darwin guard)
- Test: `tests/unit/scripts-bundle.test.ts` (append), `tests/unit/e2e-env.test.ts` (new), `tests/unit/visual-guard.test.ts` (new)

**Interfaces:**
- Consumes: Phase 0 Playwright projects; Phase 1 Docker files; Phase 3 `tests/visual/seed.ts`.
- Produces:

```ts
// tests/e2e/env.ts
export const SERVER_ENV: Record<string, string>   // E2E_ENV + PORT + HOSTNAME=127.0.0.1 (standalone server.js reads both)
export function assertE2eDatabase(url: string): void   // throws unless the database name ends in _e2e and the host is loopback
// scripts/build-scripts.ts
export const ROOT: string                          // repo root, from import.meta.url
// scripts/prepare-standalone.mjs  (node, no deps)
// copies public/ and .next/static/ into .next/standalone/ like the Dockerfile
```

Playwright `webServer.command` becomes `pnpm build && node scripts/prepare-standalone.mjs && pnpm tsx:server tests/visual/seed.ts && node .next/standalone/server.js` with `env: SERVER_ENV`, `stdout: "pipe"`. The standalone server `chdir`s into `.next/standalone`, so local-disk uploads during E2E land in `.next/standalone/.data/uploads` (rebuilt each run). Visual specs skip on non-macOS (`test.skip(process.platform !== "darwin", …)` at the top of each file).

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/scripts-bundle.test.ts`:

```ts
describe("scripts:build from another working directory (ledger P01-6)", () => {
  it("resolves entries and tsconfig from the repo, not the cwd", () => {
    const elsewhere = mkdtempSync(join(tmpdir(), "sp-cwd-"))
    try {
      const run = spawnSync(
        join(process.cwd(), "node_modules/.bin/tsx"),
        [join(process.cwd(), "scripts/build-scripts.ts")],
        { cwd: elsewhere, encoding: "utf8" }
      )
      expect(run.stderr).toBe("")
      expect(run.status).toBe(0)
      expect(run.stdout).toContain("script(s) → scripts/dist")
    } finally {
      rmSync(elsewhere, { recursive: true, force: true })
    }
  }, 120_000)
})
```

`tests/unit/e2e-env.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { assertE2eDatabase, E2E_ENV, PORT, SERVER_ENV } from "../e2e/env"

describe("E2E database guard (ledger P03-9: one guard for visual and E2E seeds)", () => {
  it("accepts the local E2E database", () => {
    expect(() => assertE2eDatabase(E2E_ENV.DATABASE_URL)).not.toThrow()
    expect(() =>
      assertE2eDatabase("postgres://sp:sp@localhost:5432/ci_e2e")
    ).not.toThrow()
  })

  it.each([
    "postgres://sp:sp@127.0.0.1:5432/sp_dev",
    "postgres://sp:sp@db.example.ie:5432/sp_e2e",
    "postgres://sp:sp@127.0.0.1:5432/sp_e2e_backup",
    "not a url",
  ])("refuses %s", (url) => {
    expect(() => assertE2eDatabase(url)).toThrow("Refusing to reset")
  })

  it("serves the standalone server on loopback at the E2E port", () => {
    expect(SERVER_ENV).toEqual({
      ...E2E_ENV,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
    })
  })
})
```

`tests/unit/visual-guard.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const GUARD = 'test.skip(process.platform !== "darwin"'

describe("visual specs run on macOS only (ledger ruling; P00-2)", () => {
  it("every tests/visual spec starts with the darwin guard", () => {
    const specs = readdirSync("tests/visual").filter((f) => f.endsWith(".spec.ts"))
    expect(specs.length).toBeGreaterThan(0)
    for (const spec of specs)
      expect(readFileSync(join("tests/visual", spec), "utf8"), spec).toContain(GUARD)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/scripts-bundle.test.ts tests/unit/e2e-env.test.ts tests/unit/visual-guard.test.ts`
Expected: FAIL — esbuild cannot resolve `scripts/migrate.ts` from the temp cwd; `assertE2eDatabase`/`SERVER_ENV` not exported; no guard in the visual specs.

- [ ] **Step 3: Implement**

`scripts/build-scripts.ts` — replace the path handling:

```ts
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { build, type Plugin } from "esbuild"

/** Repo root: scripts:build works from any working directory (ledger P01-6). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
```

and inside `buildScripts`:

```ts
export async function buildScripts(
  outdir = resolve(ROOT, "scripts/dist")
): Promise<string[]> {
  await build({
    entryPoints: SCRIPT_ENTRIES.map((name) =>
      resolve(ROOT, "scripts", `${name}.ts`)
    ),
    absWorkingDir: ROOT,
    outdir,
    // … unchanged options …
    tsconfig: resolve(ROOT, "tsconfig.json"),
```

`scripts/prepare-standalone.mjs`:

```js
// Copies public/ and .next/static/ next to .next/standalone/server.js — what
// the Dockerfile does — so Playwright tests the server production runs.
//   node scripts/prepare-standalone.mjs   (after `pnpm build`)
import { cpSync, existsSync, rmSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const standalone = resolve(root, ".next/standalone")
if (!existsSync(resolve(standalone, "server.js"))) {
  console.error("[prepare-standalone] .next/standalone/server.js missing: run `pnpm build` first")
  process.exit(1)
}
for (const dir of ["public", ".next/static"]) {
  rmSync(resolve(standalone, dir), { recursive: true, force: true })
  cpSync(resolve(root, dir), resolve(standalone, dir), { recursive: true })
}
console.log("[prepare-standalone] public/ and .next/static/ copied into .next/standalone/")
```

`tests/e2e/env.ts`:

```ts
// Shared by playwright.config.ts (webServer env), the seeds and the specs.
// No server imports here: playwright.config.ts loads this file.
export const PORT = Number(process.env.PW_PORT ?? 3100)
export const BASE_URL = `http://127.0.0.1:${PORT}`

/** The server under test and the seed scripts all use exactly these values. */
export const E2E_ENV = {
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ?? "postgres://sp:sp@127.0.0.1:5432/sp_e2e",
  BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
  BETTER_AUTH_URL: BASE_URL,
}

/** The standalone server.js reads PORT and HOSTNAME (production parity). */
export const SERVER_ENV: Record<string, string> = {
  ...E2E_ENV,
  PORT: String(PORT),
  HOSTNAME: "127.0.0.1",
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

/** The visual and E2E seeds truncate everything: only a local *_e2e database. */
export function assertE2eDatabase(url: string): void {
  let ok = false
  try {
    const parsed = new URL(url)
    ok =
      LOOPBACK.has(parsed.hostname) &&
      /^\/[A-Za-z0-9_]+_e2e$/.test(parsed.pathname)
  } catch {
    ok = false
  }
  if (!ok)
    throw new Error(
      "Refusing to reset a database that is not a local *_e2e database"
    )
}
```

`tests/e2e/seed.ts` — replace the guard block with:

```ts
const { DATABASE_URL } = getEnv()
assertE2eDatabase(DATABASE_URL)
```

(import `assertE2eDatabase` from `./env`). `tests/visual/seed.ts` — replace its `name.endsWith("_e2e")` check the same way (import from `../e2e/env`; keep `name` for the log line).

`playwright.config.ts` — import `SERVER_ENV` instead of `E2E_ENV` and replace `webServer`:

```ts
  webServer: {
    // Build (no DB), copy static assets next to the standalone server (as
    // the Dockerfile does), reset + seed sp_e2e, then run the production
    // server.js — not `next start` (ledger: prod parity).
    command:
      "pnpm build && node scripts/prepare-standalone.mjs && pnpm tsx:server tests/visual/seed.ts && node .next/standalone/server.js",
    url: `http://127.0.0.1:${PORT}`,
    // Always start our own server: a stale one on the port would serve old
    // code or lack the E2E env (port must be free).
    reuseExistingServer: false,
    timeout: 300_000,
    env: SERVER_ENV,
    // Server logs go to the runner's output (CI scans them for secrets).
    stdout: "pipe",
    stderr: "pipe",
  },
```

Every `tests/visual/*.spec.ts` — add directly after the imports:

```ts
// Baselines are macOS renders (ledger ruling): CI runs E2E only.
test.skip(process.platform !== "darwin", "visual baselines are macOS-only")
```

`Dockerfile` — replace the runtime section from the `pg_dump` comment to the end:

```dockerfile
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
```

`docker-entrypoint.sh` — replace the header comment:

```sh
#!/bin/sh
# Container entrypoint (PID 1 is tini, which forwards SIGTERM): apply pending
# database migrations, then exec the command (default CMD: node server.js).
# A failed migration exits non-zero: the container stops and Docker's restart
# policy starts it again — a crash loop until the cause is fixed. The previous
# container is already gone by then, so read `docker logs` right after a
# deploy (docs/runbook.md "Deploy").
set -eu
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/scripts-bundle.test.ts tests/unit/e2e-env.test.ts tests/unit/visual-guard.test.ts`
Expected: PASS.

Run (port 3100 free, only agent running Playwright): `pnpm test:visual`
Expected: every public baseline 0 px and the admin baselines pass — the standalone server renders identically.

Run: `pnpm test:e2e`
Expected: PASS (no `"next start" does not work with "output: standalone"` warning in the output).

Run: `docker build -t sp:local . && docker run --rm --entrypoint /sbin/tini sp:local -- node -e "console.log('ok')"`
Expected: build succeeds; prints `ok` (tini present).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write scripts/build-scripts.ts tests/e2e/env.ts tests/e2e/seed.ts tests/visual playwright.config.ts tests/unit/scripts-bundle.test.ts tests/unit/e2e-env.test.ts tests/unit/visual-guard.test.ts
git add Dockerfile docker-entrypoint.sh scripts/build-scripts.ts scripts/prepare-standalone.mjs playwright.config.ts tests/e2e/env.ts tests/e2e/seed.ts tests/visual tests/unit/scripts-bundle.test.ts tests/unit/e2e-env.test.ts tests/unit/visual-guard.test.ts
git commit -m "$(cat <<'EOF'
build: test against the standalone server; harden the container

Playwright runs .next/standalone/server.js like production; visual
specs skip off macOS; one E2E database guard; scripts:build works from
any cwd; the image runs tini as PID 1 and drops the anonymous VOLUME.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: E2E suite completion — roles, reset, 2FA off, sheets, headers, coverage manifest (master Task 10.3, part 2)

**Files:**
- Modify: `tests/e2e/seed.ts` (demo user per role, `twoFactorOff`, `resetUser`, SMTP → Mailpit), `tests/e2e/fixtures.ts` (`E2EFixtures`), `tests/e2e/account.spec.ts` (2FA off), `tests/e2e/admin-auth.spec.ts` (no-JS race), `tests/e2e/public-site.spec.ts` (exact "Terms")
- Create: `tests/e2e/roles.spec.ts`, `tests/e2e/password-reset.spec.ts`, `tests/e2e/admin-sheets.spec.ts`, `tests/e2e/security-headers.spec.ts`
- Test: `tests/unit/e2e-coverage.test.ts`

**Interfaces:**
- Consumes: Phase 2 `seedDemoUsers` (`<role>@demo.local`), `findUserByEmail`; Phase 6 `readIntegrationConfig`, `saveIntegration`; `menuSections`, `dockItems` (`components/admin/shell/nav.ts`); `hasPermission`, `ROLES`; Mailpit API (`GET /api/v1/search?query=to:"…"`, `GET /api/v1/message/<ID>` → `Text`, `DELETE /api/v1/search?query=…`; verified by Phase 7); Task 6 headers; Phase 4 T12 `/admin/users`, `/admin/audit`; Phase 6 `/admin/settings/integrations/smtp`; Phase 7 `/admin/leads`.
- Produces:

```ts
// tests/e2e/fixtures.ts
export type E2EFixtures = {
  editor; invitee; twoFactor; account   // unchanged (+ any Phase 4–8 additions)
  twoFactorOff: { email: string; name: string; totpUri: string }
  resetUser: { email: string; name: string }
}
// spec §15 coverage manifest: tests/unit/e2e-coverage.test.ts maps each §15 item to <spec file, test title>
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/e2e-coverage.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

// Spec §15 E2E list → the test that proves it. If a Phase 5–8 spec titled a
// test differently, update the title here to the real one (never drop a row).
const SPEC_15 = [
  { item: "sign-in per role", file: "roles.spec.ts", title: "signs in and sees exactly its menu" },
  { item: "invite → set password", file: "admin-auth.spec.ts", title: "set-password flow works with an invite token" },
  { item: "reset", file: "password-reset.spec.ts", title: "forgot password → email → new password → sign in" },
  { item: "2FA enable", file: "account.spec.ts", title: "turn on 2FA" },
  { item: "2FA disable", file: "account.spec.ts", title: "turn 2FA off" },
  { item: "edit + publish page → visible on site", file: "page-editor.spec.ts", title: "edit hero heading → autosave → preview → publish → public site" },
  { item: "author cannot publish", file: "articles.spec.ts", title: "author drafts and submits, cannot publish via the API" },
  { item: "author vs others' articles via the API (Review Focus 5)", file: "roles.spec.ts", title: "the API refuses publishing and editing someone else's article" },
  { item: "intake sees only leads", file: "roles.spec.ts", title: "signs in and sees exactly its menu" },
  { item: "contact form → lead + Mailpit email", file: "leads.spec.ts", title: "public enquiry → lead in the intake inbox → staff email in Mailpit" },
  { item: "media upload", file: "media.spec.ts", title: "library upload → hero image in the page editor → publish → public home" },
  { item: "redirect works", file: "seo.spec.ts", title: "a manual redirect answers 301 and counts its hit" },
] as const

describe("spec §15 E2E coverage", () => {
  it.each(SPEC_15)("$item → $file", ({ file, title }) => {
    expect(readFileSync(join("tests/e2e", file), "utf8")).toContain(title)
  })
})
```

`tests/e2e/roles.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"

import { dockItems, menuSections } from "@/components/admin/shell/nav"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

/** Screens guarded by requirePermission (forbidden page otherwise). */
const SCREENS: { path: string; permission: PermissionRequest }[] = [
  { path: "/admin/pages", permission: { page: ["read"] } },
  { path: "/admin/settings/site", permission: { settings: ["read"] } },
  { path: "/admin/settings/integrations/smtp", permission: { integration: ["read"] } },
  { path: "/admin/leads", permission: { lead: ["read"] } },
  { path: "/admin/users", permission: { user: ["read"] } },
  { path: "/admin/audit", permission: { audit: ["read"] } },
]

for (const role of ROLES) {
  test(`${role} signs in and sees exactly its menu, screens and API (spec §1.2 #3)`, async ({
    page,
  }) => {
    await signIn(page, `${role}@demo.local`)

    const menu = menuSections([role]).flatMap((s) => s.items.map((i) => i.label))
    const nav = page.getByRole("navigation", { name: "Admin" })
    await expect(nav.getByRole("link")).toHaveCount(menu.length)
    for (const label of menu)
      await expect(
        nav.getByRole("link", { name: new RegExp(`^${escape(label)}`) })
      ).toBeVisible()
    const dock = page.getByRole("navigation", { name: "Account" })
    for (const item of dockItems([role]))
      await expect(dock.getByRole("link", { name: item.label })).toBeVisible()

    for (const { path, permission } of SCREENS) {
      await page.goto(path)
      const denied = page.getByRole("heading", {
        name: "You do not have access to this page",
      })
      if (hasPermission([role], permission)) await expect(denied).toHaveCount(0)
      else await expect(denied).toBeVisible()
    }

    const api = await page.request.get("/api/v1/admin/pages")
    expect(api.status()).toBe(
      hasPermission([role], { page: ["read"] }) ? 200 : 403
    )
  })
}

test("author: the API refuses publishing and editing someone else's article (Review Focus 5)", async ({
  page,
}) => {
  await signIn(page, "author@demo.local")
  const list = await page.request.get("/api/v1/admin/articles?pageSize=1")
  expect(list.status()).toBe(200)
  const [first] = (await list.json()).items as { id: string }[]
  const detail = await (
    await page.request.get(`/api/v1/admin/articles/${first.id}`)
  ).json()
  // Same-origin, so a 403 here is the permission check, not CSRF.
  const headers = { origin: BASE_URL, "content-type": "application/json" }
  const publish = await page.request.post(
    `/api/v1/admin/articles/${first.id}/publish`,
    { headers, data: { version: detail.version } }
  )
  expect(publish.status()).toBe(403)
  expect((await publish.json()).error.message).not.toBe(
    "Cross-origin request rejected"
  )
  const edit = await page.request.put(
    `/api/v1/admin/articles/${first.id}/draft`,
    { headers, data: { version: detail.version, draft: detail.draft } }
  )
  expect(edit.status()).toBe(403)
})
```

`tests/e2e/password-reset.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { clientIpFor, readFixtures } from "./fixtures"

const MAILPIT = "http://127.0.0.1:8025"
const query = (to: string) => encodeURIComponent(`to:"${to}"`)

async function resetLinkFor(to: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${query(to)}`)
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    if (messages.length > 0) {
      const message = (await (
        await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      ).json()) as { Text: string }
      const link = message.Text.match(
        /https?:\/\/\S+\/admin\/reset-password\?token=[A-Za-z0-9_-]+/
      )
      if (link) return link[0]
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`No reset email for ${to} in Mailpit`)
}

test("forgot password → email → new password → sign in (spec §15 reset)", async ({
  page,
  context,
}, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
  const { resetUser } = readFixtures()
  await fetch(`${MAILPIT}/api/v1/search?query=${query(resetUser.email)}`, {
    method: "DELETE",
  })
  await page.goto("/admin/forgot-password")
  await page.getByLabel("Email").fill(resetUser.email)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByRole("status")).toContainText(
    `If ${resetUser.email} has an admin account`
  )

  await page.goto(await resetLinkFor(resetUser.email))
  const password = "a-fresh-password-for-rita"
  await page.getByLabel("New password").fill(password)
  await page.getByLabel("Repeat password").fill(password)
  await page.getByRole("button", { name: "Change password" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in\?notice=/)

  await page.getByLabel("Email").fill(resetUser.email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin$/)
})
```

`tests/e2e/admin-sheets.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

test.use({ viewport: { width: 390, height: 844 } })

test("the mobile navigation sheet keeps focus inside and returns it to its trigger (WCAG 2.4.3)", async ({
  page,
  context,
}, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
  const { editor } = readFixtures()
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(editor.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin$/)

  const trigger = page.getByRole("button", { name: "Toggle navigation" })
  await trigger.click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab")
    expect(
      await sheet.evaluate((el) => el.contains(document.activeElement))
    ).toBe(true)
  }
  await page.keyboard.press("Escape")
  await expect(sheet).toBeHidden()
  await expect(trigger).toBeFocused()
})
```

`tests/e2e/security-headers.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

test("pages, the admin and the API send the hardening headers (spec §13)", async ({
  request,
}) => {
  const home = (await request.get("/")).headers()
  expect(home["x-content-type-options"]).toBe("nosniff")
  expect(home["x-frame-options"]).toBe("SAMEORIGIN")
  expect(home["referrer-policy"]).toBe("strict-origin-when-cross-origin")
  expect(home["permissions-policy"]).toContain("camera=()")
  const admin = (await request.get("/admin/sign-in")).headers()
  expect(admin["x-frame-options"]).toBe("DENY")
  expect(admin["x-robots-tag"]).toBe("noindex")
  const api = (await request.get("/api/v1/health/live")).headers()
  expect(api["x-content-type-options"]).toBe("nosniff")
  expect(api["x-frame-options"]).toBe("SAMEORIGIN")
})
```

Append to `tests/e2e/account.spec.ts` (add `URI` to the `otpauth` import):

```ts
test("account page: turn 2FA off, then sign in without a code (spec §15 2FA disable)", async ({
  page,
}) => {
  const { twoFactorOff } = readFixtures()
  await signIn(page, twoFactorOff.email)
  await expect(page).toHaveURL(/\/admin\/two-factor/)
  await page
    .getByLabel("Authentication code")
    .fill(URI.parse(twoFactorOff.totpUri).generate())
  await page.getByRole("button", { name: "Verify" }).click()
  await expect(page).toHaveURL(/\/admin$/)

  await page.goto("/admin/account")
  await page
    .getByRole("tablist", { name: "Account sections" })
    .getByRole("tab", { name: "Two-factor" })
    .click()
  await page.getByLabel("Your password").fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Turn off" }).click()
  await expect(
    page.getByText("Two-factor authentication turned off.")
  ).toBeVisible()

  await page
    .getByRole("button", { name: `Account menu for ${twoFactorOff.name}` })
    .click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in\?notice=signed-out$/)
  await signIn(page, twoFactorOff.email)
  await expect(page).toHaveURL(/\/admin$/)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/e2e-coverage.test.ts`
Expected: FAIL — `roles.spec.ts`, `password-reset.spec.ts` missing; "turn 2FA off" not in `account.spec.ts`.

- [ ] **Step 3: Implement**

`tests/e2e/fixtures.ts` — extend the type:

```ts
export type E2EFixtures = {
  editor: { email: string; name: string }
  invitee: { email: string; name: string; inviteUrl: string }
  twoFactor: { email: string; name: string; totpUri: string }
  account: { email: string; name: string }
  /** 2FA on; account.spec turns it off. */
  twoFactorOff: { email: string; name: string; totpUri: string }
  /** Its password changes in password-reset.spec. */
  resetUser: { email: string; name: string }
}
```

(keep any fields Phases 4–8 added.)

`tests/e2e/seed.ts` — import `type Role` from `@/lib/auth/roles`, `seedDemoUsers` from `@/server/modules/users/bootstrap`, `findUserByEmail` from `@/server/modules/users/repo`, `readIntegrationConfig`, `saveIntegration` from `@/server/modules/integrations/service`. Replace the inline two-factor enrolment with a helper (and use it for `twoFactor`):

```ts
/** Creates a user with a password, turns TOTP on, returns the otpauth URI. */
async function enrolTotp(
  person: { email: string; name: string },
  roles: Role[]
): Promise<string> {
  await auth.api.createUser({
    body: { ...person, role: roles, password: E2E_PASSWORD },
  })
  const signedIn = await auth.api.signInEmail({
    body: { email: person.email, password: E2E_PASSWORD },
    returnHeaders: true,
  })
  const headers = new Headers({
    cookie: signedIn.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  })
  const enabled = await auth.api.enableTwoFactor({
    body: { password: E2E_PASSWORD },
    headers,
  })
  if (enabled.method !== "totp") throw new Error("expected a TOTP enrolment")
  await auth.api.verifyTOTP({
    body: { code: URI.parse(enabled.totpURI).generate() },
    headers,
  })
  return enabled.totpURI
}

const twoFactor = { email: "twofactor@e2e.test", name: "Tess Twofactor" }
const twoFactorUri = await enrolTotp(twoFactor, ["admin"])
```

and before `const fixtures`:

```ts
// Spec §15: one user per role (<role>@demo.local, password E2E_PASSWORD).
await seedDemoUsers(E2E_PASSWORD)

const twoFactorOff = { email: "twofactor-off@e2e.test", name: "Toby Twofactor" }
const twoFactorOffUri = await enrolTotp(twoFactorOff, ["editor"])

const resetUser = { email: "reset@e2e.test", name: "Rita Reset" }
await auth.api.createUser({
  body: { ...resetUser, role: ["editor"], password: E2E_PASSWORD },
})

// `next start`/server.js run in production mode: no Mailpit default, so
// point SMTP at Mailpit unless an earlier phase's seed already did.
if (!(await readIntegrationConfig("integrations.smtp"))) {
  const owner = await findUserByEmail(getDb(), "owner@demo.local")
  if (!owner) throw new Error("demo owner missing")
  await saveIntegration(
    { userId: owner.id, roles: ["owner"], ip: null, userAgent: null, impersonatorId: null },
    "integrations.smtp",
    {
      version: 0,
      values: {
        host: "127.0.0.1",
        port: 1025,
        secure: false,
        user: "",
        password: "",
        fromName: "Security Partners",
        fromAddress: "no-reply@e2e.test",
      },
    }
  )
}
```

and the fixtures object gains `twoFactor: { ...twoFactor, totpUri: twoFactorUri }`, `twoFactorOff: { ...twoFactorOff, totpUri: twoFactorOffUri }`, `resetUser`. (If the Phase 6 SMTP schema rejects an empty `user`/`password`, use the exact values Phase 7's `tests/e2e/leads.spec.ts` setup saves for Mailpit.)

`tests/e2e/admin-auth.spec.ts` — in "forgot password submitted before hydration…", replace `await page.waitForLoadState()` and the click before it:

```ts
    const posted = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        new URL(res.url()).pathname === "/admin/forgot-password"
    )
    await page.getByRole("button", { name: "Send reset link" }).click()
    await posted
    await page.waitForLoadState("load")
```

`tests/e2e/public-site.spec.ts` — `footer.getByRole("link", { name: "Terms", exact: true })`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/e2e-coverage.test.ts`
Expected: PASS (update a title row only if a Phase 5–8 spec's real title differs).

Run (Postgres + Mailpit up, port 3100 free, only agent on Playwright): `pnpm test:e2e`
Expected: every spec passes, including 7 role tests, the Review-Focus-5 test, reset, 2FA off, sheet focus and headers.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write tests/e2e tests/unit/e2e-coverage.test.ts
git add tests/e2e tests/unit/e2e-coverage.test.ts
git commit -m "$(cat <<'EOF'
test(e2e): complete the spec §15 suite

Every role signs in and sees exactly its menu, screens and API; the
author API is refused on others' articles; password reset through
Mailpit; 2FA off; mobile sheet focus; security headers; a manifest
pins each §15 item to its test.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: CI and deploy gating (master Task 10.4)

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy.yml` (a `ci` job first; trigger unchanged)
- Test: `tests/unit/workflows.test.ts`

**Interfaces:**
- Consumes: scripts `lint`, `typecheck`, `test:unit`, `test:integration`, `build`, `scripts:build`, `test:e2e`, `audit:deps`; `scripts/check-log-secrets.ts`; Dockerfile + scripts `backup`, `restore-drill`, `seed`.
- Produces: workflow `CI` (triggers `pull_request`, `push` to non-`main` branches, `workflow_call`) with jobs `static`, `integration`, `build`, `e2e`, `image`; `deploy.yml` job `ci` (`uses: ./.github/workflows/ci.yml`), `build-and-push` `needs: ci`, `workflow_dispatch` input `skip_ci`.

- [ ] **Step 1: Write the failing test**

`tests/unit/workflows.test.ts`:

```ts
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const ci = readFileSync(".github/workflows/ci.yml", "utf8")
const deploy = readFileSync(".github/workflows/deploy.yml", "utf8")

describe("CI + deploy gating (master 10.4, spec §14)", () => {
  it("CI runs every gate, with Postgres and Mailpit where needed", () => {
    for (const job of ["static:", "integration:", "build:", "e2e:", "image:"])
      expect(ci).toContain(`  ${job}`)
    for (const command of [
      "pnpm lint",
      "pnpm exec next typegen",
      "pnpm typecheck",
      "pnpm test:unit",
      "pnpm exec vitest run --project dom",
      "pnpm audit:deps",
      "pnpm test:integration",
      "pnpm build",
      "pnpm test:e2e",
      "scripts/check-log-secrets.ts",
      "node scripts/dist/seed.mjs --allow-production",
      "node scripts/dist/restore-drill.mjs",
    ])
      expect(ci).toContain(command)
    expect(ci.match(/axllent\/mailpit:v1\.31\.4/g)).toHaveLength(2)
    expect(ci).toContain("workflow_call:")
    expect(ci).not.toContain("test:visual")
  })

  it("deploy keeps its trigger and waits for CI", () => {
    expect(deploy).toMatch(/on:\n  push:\n    branches: \[main\]\n  workflow_dispatch:/)
    expect(deploy).toContain("uses: ./.github/workflows/ci.yml")
    expect(deploy).toContain("needs: ci")
    expect(deploy).toContain("skip_ci")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --project unit tests/unit/workflows.test.ts`
Expected: FAIL — `ENOENT … .github/workflows/ci.yml`.

- [ ] **Step 3: Implement**

`.github/workflows/ci.yml`:

```yaml
name: CI

# Pull requests and feature branches run it directly; main runs it from
# deploy.yml (workflow_call), so a failing check blocks the deploy.
on:
  pull_request:
  push:
    branches-ignore: [main]
  workflow_call:

permissions:
  contents: read

env:
  NEXT_TELEMETRY_DISABLED: "1"

jobs:
  static:
    name: Lint, types, unit, audit
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.32.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm exec next typegen
      - run: pnpm typecheck
      - run: pnpm test:unit
      - run: pnpm exec vitest run --project dom
      - run: pnpm audit:deps

  integration:
    name: Integration (Postgres + Mailpit)
    runs-on: ubuntu-latest
    timeout-minutes: 25
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: sp
          POSTGRES_PASSWORD: sp
          POSTGRES_DB: sp_dev
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U sp -d sp_dev"
          --health-interval 2s --health-timeout 3s --health-retries 30
      mailpit:
        image: axllent/mailpit:v1.31.4
        ports: ["1025:1025", "8025:8025"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.32.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: PostgreSQL 17 client (pg_dump/pg_restore for backup tests)
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-common
          sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
          sudo apt-get install -y postgresql-client-17
          echo "/usr/lib/postgresql/17/bin" >> "$GITHUB_PATH"
      - name: Create sp_test and sp_e2e
        run: |
          docker exec ${{ job.services.postgres.id }} psql -U sp -d sp_dev -c "CREATE DATABASE sp_test" -c "CREATE DATABASE sp_e2e"
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration

  build:
    name: Build without env
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.32.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # Spec §1.2 #4: no DATABASE_URL / BETTER_AUTH_* in this job.
      - run: pnpm build
      - run: pnpm scripts:build

  e2e:
    name: E2E (Postgres + Mailpit)
    runs-on: ubuntu-latest
    timeout-minutes: 40
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: sp
          POSTGRES_PASSWORD: sp
          POSTGRES_DB: sp_dev
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U sp -d sp_dev"
          --health-interval 2s --health-timeout 3s --health-retries 30
      mailpit:
        image: axllent/mailpit:v1.31.4
        ports: ["1025:1025", "8025:8025"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.32.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Create sp_test and sp_e2e
        run: |
          docker exec ${{ job.services.postgres.id }} psql -U sp -d sp_dev -c "CREATE DATABASE sp_test" -c "CREATE DATABASE sp_e2e"
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      # Visual baselines are macOS-only (ledger ruling): E2E only here.
      - name: E2E
        run: |
          set -o pipefail
          pnpm test:e2e 2>&1 | tee e2e.log
      - name: No secrets in the server and test output
        run: pnpm exec tsx scripts/check-log-secrets.ts e2e.log
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: |
            test-results/
            e2e.log
          retention-days: 7

  image:
    name: Docker image smoke
    runs-on: ubuntu-latest
    timeout-minutes: 30
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: sp
          POSTGRES_PASSWORD: sp
          POSTGRES_DB: sp_smoke
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U sp -d sp_smoke"
          --health-interval 2s --health-timeout 3s --health-retries 30
    env:
      SMOKE_ENV: >-
        -e DATABASE_URL=postgres://sp:sp@127.0.0.1:5432/sp_smoke
        -e BETTER_AUTH_SECRET=ci-smoke-secret-0123456789abcdef0123456789
        -e BETTER_AUTH_URL=http://localhost:3000
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          push: false
          tags: sp:ci
          cache-from: type=gha
      # Entrypoint migrates first; seed.mjs needs sharp + public/images (P03 carry).
      - run: docker run --rm --network host $SMOKE_ENV sp:ci node scripts/dist/seed.mjs --allow-production
      - run: docker run -d --name sp --network host $SMOKE_ENV sp:ci
      - name: Server ready (readiness touches the DB)
        run: |
          for i in $(seq 1 60); do
            curl -fsS http://127.0.0.1:3000/api/v1/health && exit 0
            sleep 2
          done
          docker logs sp
          exit 1
      - run: curl -fsS -o /dev/null http://127.0.0.1:3000/
      # Loopback reachable inside the container (scheduler, HEALTHCHECK).
      - run: docker exec sp wget -qO- http://127.0.0.1:3000/api/v1/health/live
      # pg_dump in the image, /data writable, scratch restore works.
      - run: docker exec sp node scripts/dist/backup.mjs
      - run: docker exec sp node scripts/dist/restore-drill.mjs
      - if: always()
        run: docker logs sp || true
      - run: docker stop -t 15 sp
```

`.github/workflows/deploy.yml` — keep everything; change the `on:` block and the start of `jobs:` to:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      skip_ci:
        description: "Emergency only: deploy without waiting for CI"
        type: boolean
        default: false
```

```yaml
jobs:
  # The trigger is unchanged; the deploy now waits for the full CI run.
  ci:
    if: ${{ github.event_name == 'push' || !inputs.skip_ci }}
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read

  build-and-push:
    needs: ci
    if: ${{ !cancelled() && (needs.ci.result == 'success' || (github.event_name == 'workflow_dispatch' && inputs.skip_ci)) }}
    runs-on: ubuntu-latest
```

(the rest of `build-and-push` and the `deploy` job are unchanged).

- [ ] **Step 4: Run the test to verify it passes, and lint the YAML**

Run: `pnpm exec vitest run --project unit tests/unit/workflows.test.ts`
Expected: PASS.

Run (if Docker is available): `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color`
Expected: no findings. (Without Docker, record "actionlint not available" in the report.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml tests/unit/workflows.test.ts
git commit -m "$(cat <<'EOF'
ci: lint, types, unit, integration, build, e2e and image smoke

CI runs on pull requests and branches and is called by the deploy
workflow, so a push to main deploys only after every check passes.
The deploy trigger is unchanged; a manual dispatch can skip CI in an
emergency.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Runbook, launch checklist, README, brief — and final verification (master Task 10.5)

**Files:**
- Modify: `docs/runbook.md` (created by Phase 8 Task 11 with "Custom code and Content-Security-Policy" — keep that section verbatim, add the sections below around it), `docs/brief.md` (Change notes), `README.md` (replace the template text)
- Create: `docs/launch.md`
- Test: `tests/unit/docs.test.ts`

**Interfaces:**
- Consumes: everything above; ledger OWNER MUST CONFIRM items; spec §1.2, §14.
- Produces: `docs/runbook.md`, `docs/launch.md`, `README.md`, brief Change notes; the final report with captured command output for spec §1.2.

- [ ] **Step 1: Write the failing test**

`tests/unit/docs.test.ts`:

```ts
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const read = (file: string) => readFileSync(file, "utf8")

describe("operations docs (spec §14)", () => {
  it("the runbook covers every operation", () => {
    const runbook = read("docs/runbook.md")
    for (const heading of [
      "## Deploy",
      "## First production deploy",
      "## Rollback",
      "## Running scripts in the container",
      "## Backups and the restore drill",
      "## Restore a backup",
      "## Rotate BETTER_AUTH_SECRET",
      "## Copy a database between environments (db:sync)",
      "## Owner locked out",
      "## Client IPs and Traefik",
      "## Background jobs",
      "## Sessions and sign-in",
      "## Security headers",
      "## Custom code and Content-Security-Policy",
      "## Logs",
      "## Dependency audit",
      "## Known limitations",
    ])
      expect(runbook, heading).toContain(heading)
  })

  it("the launch checklist lists what the owner must do and confirm", () => {
    const launch = read("docs/launch.md")
    for (const text of [
      "## Agent did",
      "## Owner must do",
      "## Owner must confirm",
      "dokploy-network",
      "demo:remove",
      "Invisible",
      "Object Read & Write",
      "GDPR processor",
      "consent",
      "Monday–Friday",
      "(085) 8062369",
      "Ext 3",
    ])
      expect(launch, text).toContain(text)
  })

  it("the README is the project's, not the template's", () => {
    const readme = read("README.md")
    expect(readme).not.toContain("This is a Next.js template with shadcn/ui.")
    expect(readme).toContain(
      "docker compose -f docker-compose.dev.yml up -d && pnpm db:migrate && pnpm db:seed && pnpm demo:seed"
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --project unit tests/unit/docs.test.ts`
Expected: FAIL — `docs/launch.md` missing, runbook headings missing, README is the template.

- [ ] **Step 3: Write the docs**

`docs/runbook.md` — final structure (`# Runbook` first; Phase 8's "## Custom code and Content-Security-Policy" section moves, unchanged, to its place in this order):

```markdown
# Runbook

Security Partners site + admin on one Next.js app (standalone Docker image
`ghcr.io/mdnhs/security-partners`), Postgres 17 as a Dokploy database
service, Traefik in front (Dokploy). The container reads exactly three
variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
Everything else (SMTP, R2, Turnstile, AI, tracking) is set in the admin.

## Deploy

- Push to `main` → GitHub Actions `Build & Deploy to Dokploy`: the `ci` job
  (lint, types, unit, integration, build without env, E2E, image smoke) must
  pass, then the image is pushed to GHCR (`:latest` and `:<sha>`) and Dokploy
  redeploys the compose app.
- Manual: Actions → Build & Deploy → Run workflow. `skip_ci` = emergency
  only (a hotfix while CI itself is broken).
- On start the container applies pending migrations, then starts the server.
  A failed migration stops the container and Docker restarts it (crash loop)
  — read `docker logs <container>` right after a deploy; the cause is printed
  as `[migrate] …`.
- Health: `GET /api/v1/health/live` (no DB; Docker HEALTHCHECK) and
  `GET /api/v1/health` (readiness; 503 when the DB is unreachable).

## First production deploy

1. Dokploy: Postgres 17 database service; the app's compose project on the
   same `dokploy-network`, so the DB host name resolves.
2. Environment (Dokploy → Environment): `DATABASE_URL`,
   `BETTER_AUTH_SECRET` (`openssl rand -base64 48`, keep it in the password
   manager — it also derives the encryption keys), `BETTER_AUTH_URL`
   (`https://security.raynx.ie`; https is required in production).
3. Deploy (push to `main` or run the workflow).
4. Seed the site content once:
   `node scripts/dist/seed.mjs --allow-production` (see "Running scripts").
   Never run it again on production: it re-inserts rows an editor deleted.
   Restart the app afterwards (cached empty reads are dropped).
5. First owner: `node scripts/dist/admin-create.mjs --email <owner email> --name "<name>"`
   prints a set-password link (valid 7 days). Sign in, turn on 2FA.
6. Settings ▸ Integrations: SMTP, R2 (then "Move uploads to R2"),
   Turnstile; Settings ▸ Leads: recipients. Then docs/launch.md.
7. Demo accounts never go on production. If `demo:seed` ever ran there:
   `node scripts/dist/demo-remove.mjs`.

## Rollback

- Dokploy → the app → redeploy the previous image tag
  (`ghcr.io/mdnhs/security-partners:<previous sha>`), or revert the commit on
  `main` and push.
- Migrations only go forward. If a rollback needs the old schema, restore the
  backup taken before the deploy ("Restore a backup") — the daily backup runs
  on the first scheduler tick after every start.

## Running scripts in the container

`docker exec -it <app container> node scripts/dist/<name>.mjs [flags]`
(Dokploy: the app → Terminal). Scripts: `migrate`, `seed`
(`--allow-production`), `admin-create`, `owner-recover`, `demo-seed`,
`demo-remove`, `backup`, `restore-drill` (`--keep`), `secrets-rotate`,
`db-sync`. Locally: `pnpm <name>` with `.env.development`
(`db:seed`, `admin:create`, `owner:recover`, `demo:seed`, `demo:remove`,
`backup`, `restore-drill`, `secrets:rotate`, `db:sync`).

## Backups and the restore drill

- Daily (scheduler job `backup`) and on demand (`backup`): `pg_dump` custom
  format in a consistent snapshot plus a `.json` manifest (row counts,
  SHA-256). Named `sp-<db>-<UTC stamp>.dump`. The newest 14 are kept.
- Where: R2 bucket, prefix `backups/` once Settings ▸ Integrations ▸ R2 is
  saved; until then `/data/backups` on the app volume (lost with the server —
  set up R2).
- A failing backup shows on the dashboard ("Background jobs need
  attention") and retries after 60 s.
- Restore drill (monthly, and after any Postgres upgrade): `restore-drill`
  restores the newest backup into `<db>_restore_drill` on the same server,
  compares every table's row count with the manifest and drops it. Needs
  `CREATEDB` for the app's DB role (the Dokploy database user has it).
  Exit code 1 = counts differ: investigate before you need the backup.

## Restore a backup

1. Stop the app (Dokploy → Stop) so nothing writes.
2. Get the dump: from R2 (`backups/<name>.dump`) or `/data/backups/`.
3. `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error -d "$DATABASE_URL" <name>.dump`
   (from the app container: `PGPASSWORD=… pg_restore … -h <db host> -U <user> -d <db>`).
4. Start the app; check `/api/v1/health` and sign in.
Sessions in the dump stay valid (same secret). Rate-limit tables come back
empty.

## Rotate BETTER_AUTH_SECRET

1. Generate the new secret; keep the old one at hand.
2. Dokploy: set the new `BETTER_AUTH_SECRET`, redeploy. Until step 3,
   SMTP/R2/Turnstile/AI cannot decrypt their credentials (email and uploads to
   R2 fail for those minutes).
3. `OLD_BETTER_AUTH_SECRET='<old>' node scripts/dist/secrets-rotate.mjs`
   re-encrypts every integration secret, turns 2FA off for everyone and ends
   all sessions (audit: `secrets.rotated`). Safe to re-run.
4. Tell staff to sign in again and re-enrol 2FA. Preview links and lead-IP
   rate-limit counters reset (derived keys changed).

## Copy a database between environments (db:sync)

For refreshing staging from production. Run with the TARGET's three
variables, target app stopped, from a one-off container on the Dokploy
network:

`docker run --rm --network dokploy-network -e DATABASE_URL=<staging> -e BETTER_AUTH_SECRET=<staging secret> -e BETTER_AUTH_URL=<staging url> ghcr.io/mdnhs/security-partners:latest node scripts/dist/db-sync.mjs --from <production url> --from-secret <production secret> --confirm <staging db name> [--demo-password <pw>] [--verify-url <staging url>]`

It backs up the target first (`/data/backups` of that container — mount a
volume to keep it), copies everything except sessions, verifications and
rate limits in one transaction, re-encrypts secrets for the target key,
clears 2FA, optionally resets demo passwords and checks the result (DB,
every integration decrypts, AI test-connection when enabled, health URL).
Any `FAIL` line → exit code 1. Start the target app afterwards; it applies
newer migrations itself. Lead data is personal data: only sync into an
environment with the same access controls.

## Owner locked out

`node scripts/dist/owner-recover.mjs --email <owner email>`: turns 2FA off,
ends all their sessions, voids older links and prints a 24-hour password
link (also emailed when SMTP works). Audited as `user.owner_recover`.
After promoting someone to owner, they should change their password and
turn on 2FA (promotion ends their sessions).

## Client IPs and Traefik

The app takes the client IP from `X-Forwarded-For` (first value), else
`X-Real-Ip`. Keep Traefik's entrypoint `forwardedHeaders` **untrusted** (the
default; never `insecure: true`): Traefik then replaces client-sent
forwarded headers with the real peer address, so sign-in and enquiry rate
limits cannot be dodged by sending a fake header. If a CDN/proxy (e.g.
Cloudflare) is put in front, add only its ranges to
`forwardedHeaders.trustedIPs`. Better Auth trusts a single-value
`X-Forwarded-For` only and otherwise uses `X-Real-Ip`.

## Background jobs

An in-process scheduler ticks every 60 s in every app container; jobs are
claimed with `FOR UPDATE SKIP LOCKED`, so replicas never run one twice:
scheduled publish, revision pruning (keep 50), lead retention purge (daily),
DB backup (daily), media move to R2 (on request). Jobs expire caches through
`http://127.0.0.1:$PORT` — the image binds `HOSTNAME=0.0.0.0`, which includes
loopback; do not override `HOSTNAME`. Failures are stored on the job row and
listed on the dashboard; a failed job retries after 60 s.

## Sessions and sign-in

Sessions last 7 days and extend while used (an inactivity timeout of about
7 days). Rate limits (production only, in Postgres): sign-in 5/min, 2FA
5/min, password reset 3 per 5 min, everything else 100/min per IP; public
enquiries 5 per 10 min per IP. Revoking a session takes effect at once for
every admin page and API call; a few cookie-cached reads may serve up to
5 minutes longer. "Sign out everywhere" also ends "View as" sessions the
user started. Passwords: 12–128 characters.

## Security headers

Pages: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` (`DENY`
under `/admin`), `Permissions-Policy: camera=(), microphone=(),
geolocation=(), browsing-topics=()`, `Strict-Transport-Security:
max-age=31536000`. API: Hono `secureHeaders()` plus `X-Robots-Tag: noindex`
(also on `/admin`). Unsafe admin API calls must come from the site's own
origin (CSRF). No Content-Security-Policy is sent — see the next section.

## Custom code and Content-Security-Policy

(Phase 8 section, unchanged.)

## Logs

`docker logs <container>`. Lines are prefixed (`[api] <requestId>`,
`[migrate]`, `[mailer]`, `[audit]`, `[db]`, scheduler job names). Never
logged: passwords, secrets, tokens, links from emails, message bodies, full
lead IPs. Watch for `[audit]` errors: an audit write failure never blocks a
sign-in, so the log is the only signal. API error responses carry
`requestId`; search the log for it.

## Dependency audit

`pnpm audit:deps` (CI: `static` job) fails on high/critical advisories in
production dependencies. Fix by updating within the range, or a
`pnpm.overrides` pin to a patched version published at least 2 weeks ago;
a build-only package moves to `devDependencies` (as `shadcn` did). Record
each override here with the advisory id.

## Known limitations

- Visual pixel tests run on macOS only (baselines are macOS renders).
- Uploads and backups live on `/data` until R2 is configured.
- Safari < 16.4 cannot open admin draft previews (no `Sec-Fetch-Site`).
- After seeding from outside the running app, restart it.
- `{…}` in a content field is a placeholder (e.g. `{phone24h}`), not text.
- Migrations are forward-only; roll back schema changes with a backup.
```

`docs/launch.md`:

```markdown
# Launch checklist — security.raynx.ie

## Agent did

- Public site renders entirely from Postgres, pixel-identical to the static
  site (Playwright visual diff, 0 px at 1440 and 390 wide).
- Admin at `/admin`: pages, services, articles (draft → review → schedule →
  publish), team, clients, group companies, categories, media library,
  leads inbox + CSV export, SEO (metadata, JSON-LD, OG images, sitemap,
  robots, redirects), marketing (tracking, consent banner, custom code),
  settings, integrations, users (invite, roles, 2FA, sessions, "View as"),
  audit log, AI assistant, dashboard.
- Seven roles (owner, admin, editor, author, marketer, intake, viewer)
  enforced in the UI and the API.
- Email (SMTP), media (Cloudflare R2, local disk until then), Turnstile and
  AI keys are configured in the admin and stored encrypted.
- Daily backups with a restore drill, secret rotation, environment sync,
  owner recovery, CI with E2E and an image smoke test gating deploys.
- Runbook: `docs/runbook.md`.

## Owner must do

- [ ] DNS: `security.raynx.ie` → the Dokploy server (Traefik gets the
      certificate).
- [ ] Dokploy: Postgres 17 database service; app on `dokploy-network` so it
      reaches the database; the three variables set (runbook "First
      production deploy"). Keep `BETTER_AUTH_SECRET` in the password manager.
- [ ] Traefik: leave `forwardedHeaders` untrusted (runbook "Client IPs").
- [ ] First deploy: seed content once, `admin-create` the first owner, set
      the password, turn on 2FA.
- [ ] Settings ▸ Integrations ▸ SMTP: real credentials; run "Test".
- [ ] Settings ▸ Leads: a real inbox in recipients (default
      `info@securitypartnersltd.com`); retention (default 24 months).
- [ ] Cloudflare R2: a **private** bucket (EU jurisdiction if wanted; no
      public URL needed — media is served through the site), an API token
      with **Object Read & Write** on that bucket; save in Settings ▸
      Integrations ▸ R2, "Test", then "Move uploads to R2". Backups then go
      to `backups/` in the same bucket.
- [ ] Turnstile: create the widget in **Invisible** mode for the domain;
      site + secret key in Settings ▸ Integrations ▸ Turnstile.
- [ ] Tracking: GTM / GA4 / Meta pixel IDs and consent banner copy in
      Marketing; turn tracking on only when ready (the banner appears then).
- [ ] Optional: AI provider key and allowed roles (Settings ▸ Integrations ▸
      AI); sign a data processing agreement with the provider first.
- [ ] Replace the placeholder Privacy and Terms copy (Pages ▸ Privacy/Terms).
- [ ] Invite staff with the right roles; owners turn on 2FA.
- [ ] Remove demo accounts if `demo:seed` ever ran on production:
      `node scripts/dist/demo-remove.mjs` (`pnpm demo:remove`).
- [ ] After a day: the dashboard shows no failing jobs and a backup exists;
      run `restore-drill` once.
- [ ] Optional: move the 41 MB of visual-test PNGs to Git LFS.

## Owner must confirm

- **Consent for enquiries:** the contact form has no consent checkbox (the
  design is frozen). Enquiries are stored with `consent: true` on the basis
  that the visitor submitted the form to be contacted. Confirm this basis
  (or approve a visible consent line, which changes the form design).
- **AI provider as GDPR processor:** when staff use the assistant on a lead,
  the enquiry text and the person's name are sent to the chosen AI provider
  (email and phone are left out). The provider becomes a GDPR processor:
  confirm, or keep the assistant off / away from the intake role.
- **Data to correct or confirm on the site:**
  - office hours are written two ways: "Monday–Friday, 9am to 6pm" (header)
    and "Monday–Friday: 9am to 6pm" (contact card);
  - the HR phone "(085) 8062369" has the same digits as Cleaning Partners
    "085 806 2369";
  - the Accounts line "Tel: (057) 8697670 Ext 3" formats the office number
    differently from "057 8697670" elsewhere.
- Decisions taken on your behalf (spec §1.3, D1–D10), e.g. Postgres as a
  Dokploy service, Turnstile invisible only, 24-month lead retention,
  Europe/Dublin time, shared sections edited once.
- Sessions last 7 days; passwords need 12+ characters.
```

`README.md` — replace the whole file:

~~~markdown
# Security Partners — site and admin

Next.js 16 (App Router, Cache Components) public site + admin panel at
`/admin`, Hono API at `/api`, Better Auth, Drizzle + Postgres 17.
Design spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md`.
Operations: `docs/runbook.md`. Go-live: `docs/launch.md`. Content brief:
`docs/brief.md`.

## Local development

```bash
pnpm install
cp .env.example .env.development   # dev-only values; `next build` never reads them
docker compose -f docker-compose.dev.yml up -d && pnpm db:migrate && pnpm db:seed && pnpm demo:seed --password "<12+ characters>" && pnpm dev
```

Postgres 17 (`sp_dev`, `sp_test`, `sp_e2e`) and Mailpit
(http://localhost:8025) run in Docker (`pnpm db:up` / `pnpm db:down`).
Demo accounts: `<role>@demo.local` with your password.

## Checks

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — build needs no
  env and no database.
- `pnpm test:unit` (no services), `pnpm test:integration` (Postgres + Mailpit),
  `pnpm test:e2e` (Playwright on the standalone server, port 3100),
  `pnpm test:visual` (macOS only, 0 px vs baselines), `pnpm audit:deps`.

## Development notes

- Server code lives in `server/` (`import "server-only"` first);
  `lib/` and template schemas never import it (lint-enforced).
- Only `server/modules/*/repo.ts` and `server/db/**` use Drizzle; routes
  validate → authorise → call a service.
- Never keep `getDb()` in a module-level constant (tests switch databases).
- Raw SQL inserts must supply the uuid v7 `id` (Drizzle's default runs only
  through the query builder).
- `pnpm db:generate --name <change>` after editing `server/db/schema/*`.
- Scripts importing `server/**` run with `pnpm tsx:server <file.ts>`;
  `pnpm scripts:build` bundles them into `scripts/dist` for the image.
~~~

`docs/brief.md` — append under `## Changes`:

```markdown
- 2026-10-16: correction to §14.3: `{phone24hHref}` and `{officeHref}` are not `settings.contact` fields; they are derived at render from `{phone24h}` / `{office}` (tel: links). `{mapsHref}` is a stored field.
- 2026-10-16: Phase 10 operations: daily backups (dump + manifest, 14 kept, R2 `backups/` or `/data/backups`), `restore-drill`, `secrets:rotate`, `db:sync`, `demo:remove`; CI gates the deploy (trigger unchanged); security headers; failing background jobs show on the dashboard. Owner items: `docs/launch.md`.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run --project unit tests/unit/docs.test.ts`
Expected: PASS.

- [ ] **Step 5: Final verification (spec §1.2 Definition of done) — capture each output in the report**

Run on a clean checkout of the branch head, `pnpm db:up`, port 3100 free, no other agent on Playwright/build:

1. `pnpm test:visual` → every public baseline 0 px (criterion 1).
2. `pnpm test:e2e` → all pass, incl. `page-editor.spec.ts` (edit + publish shows on the site, criterion 2) and `roles.spec.ts` (every role, criterion 3).
3. `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm audit:deps` → exit 0 (criterion 4).
4. Fresh clone (criterion 5):
   ```bash
   docker exec security-partners-dev-postgres-1 psql -U sp -d sp_dev -c "DROP DATABASE IF EXISTS sp_fresh_dev" -c "CREATE DATABASE sp_fresh_dev"
   rm -rf /tmp/sp-fresh && git clone . /tmp/sp-fresh && cd /tmp/sp-fresh
   pnpm install --frozen-lockfile
   sed 's/sp_dev/sp_fresh_dev/' .env.example > .env.development
   docker compose -f docker-compose.dev.yml up -d && pnpm db:migrate && pnpm db:seed && pnpm demo:seed --password "fresh-clone-password-1" && (pnpm dev --port 3200 & sleep 20; curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:3200/; curl -fsS http://localhost:3200/api/v1/health; kill %1)
   ```
   Expected: `200` and `{"status":"ok","db":"ok"}`.
5. Production bootstrap (criterion 6): `docker build -t sp:final .`; create `sp_prod_check` in the dev Postgres; `docker run -d --name sp-final -p 3300:3000 -e DATABASE_URL=postgres://sp:sp@host.docker.internal:5432/sp_prod_check -e BETTER_AUTH_SECRET=<48 random chars> -e BETTER_AUTH_URL=http://localhost:3300 sp:final`; then `docker exec sp-final node scripts/dist/seed.mjs --allow-production` and `docker exec sp-final node scripts/dist/admin-create.mjs --email owner@example.test --name "Final Owner"` → prints a set-password link; open it, set a password, sign in at `http://localhost:3300/admin`. Stop and remove the container and drop `sp_prod_check` afterwards.
6. `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7` → clean.

Report: each command, its exit code and the key output lines; the "Owner must confirm" list from `docs/launch.md`; and the ledger note that commit `7a7acd8` swept another task's staged files (history not rewritten).

- [ ] **Step 6: Commit**

```bash
git add docs/runbook.md docs/launch.md docs/brief.md README.md tests/unit/docs.test.ts
git commit -m "$(cat <<'EOF'
docs: runbook, launch checklist and project README

Runbook covers deploy, rollback, scripts, backups and restores, secret
rotation, db:sync, owner recovery, Traefik IPs, jobs, sessions, headers,
logs and audits; the launch checklist lists what the owner must do and
confirm; the brief records the Phase 10 changes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase gate (controller, after Task 13)

- Clean checkout, `pnpm db:up` (Postgres + Mailpit), port 3100 free, one agent on Playwright/build: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm audit:deps`, `pnpm test:visual` (0 px), `pnpm test:e2e` (all green).
- `pnpm backup && pnpm restore-drill` → OK.
- Task 13 Step 5 outputs present in the report.
- Never push; the deploy trigger in `deploy.yml` is still `push: main` + `workflow_dispatch`.
- Ledger: corrections above; OWNER MUST CONFIRM items are in `docs/launch.md`; final report repeats them.
