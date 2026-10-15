# Dynamic Platform Implementation Plan (Master)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the static Security Partners Next.js site into a database-driven site with a full admin panel, typed API and operations tooling, without changing the public design by a single pixel.

**Architecture:** One Next.js 16.3 app. Public site in `app/(site)` renders fixed templates from Postgres via cached `queries`; admin in `app/(admin)/admin`; Hono API at `app/api/[...route]`; all server code under `server/` layered routes → service → repo. Better Auth for auth/RBAC, Drizzle for DB, integrations (SMTP, R2, Turnstile, AI) configured from the admin and stored encrypted.

**Tech Stack:** Next.js 16.3.8, React 19.3, TypeScript strict, Tailwind 4, shadcn (base-ui), Hono 4.13, Better Auth 1.7, Drizzle ORM 0.45 + drizzle-kit 0.31, pg 8.23, Postgres 17, Zod 4.6, TanStack Query 5 + Table 9, react-hook-form 7.90, TipTap 3.32, dnd-kit, React Email, nodemailer 10, AWS SDK S3 (R2), sharp 0.35, AI SDK 7, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (read it fully before any task; section numbers below refer to it).

**API references (ground truth over memory):** `docs/superpowers/notes/nextjs-16-api.md`, `docs/superpowers/notes/libraries-api.md`, and `node_modules/next/dist/docs/`.

## How this plan is structured (rolling-wave)

This master plan fixes the phases, every task, its files, its interfaces and its acceptance tests. Because each phase builds on code the previous phase actually produced, the bite-sized TDD steps (exact test code, exact implementation code, commands) for each phase live in a **phase plan** written immediately before that phase starts:

```
docs/superpowers/plans/2026-10-16-dynamic-platform/phase-00-audit.md
docs/superpowers/plans/2026-10-16-dynamic-platform/phase-01-infra.md
...
docs/superpowers/plans/2026-10-16-dynamic-platform/phase-10-hardening.md
```

A phase plan may not change a task's Interfaces or acceptance tests defined here without a dated "Change" note appended to this file. Phase plans follow the writing-plans format (failing test → run → implement → run → commit) with complete code.

## Global Constraints

- Public design is frozen: no markup/class/token change visible in the rendered public pages; visual diff vs Phase 0 baselines must be 0 px at 1440×900 and 390×844 with animations disabled.
- No section of the public site is removed, hidden or added. Only exceptions: `/privacy`, `/terms` (reuse `PageHero` + article body styles), conditional consent banner (only when `tracking.enabled`), admin-only draft preview bar.
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (plus platform `NODE_ENV`, `PORT`, `HOSTNAME`). Everything else lives in the DB.
- `next build` must succeed with no env vars and no database.
- Every file under `server/` starts with `import "server-only"` (scripts import server code through `tsx` with the `server-only` condition handled as documented in the Phase 1 plan).
- `lib/**` and `templates/*/schema.ts` never import `server/**` (ESLint `no-restricted-imports`).
- Repos are the only files that import `drizzle-orm` query builders; routes never import repos.
- IDs: uuid v7. All timestamps `timestamptz`. Dates in API ISO 8601 UTC; displayed in `Europe/Dublin`, `en-IE`.
- Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$`, unique per table.
- Error envelope `{ error: { code, message, fieldErrors?, requestId } }`; codes `VALIDATION_FAILED | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMITED | INTERNAL`.
- List responses `{ items, page, pageSize, total }`; query `?page&pageSize&sort=field:dir&q`. `pageSize` max 100, default 20.
- Passwords ≥ 12 chars. Sessions 7 days. Cookie prefix `sp`.
- Body limits: public 64 KB, admin 1 MB, upload 20 MB.
- Never `git push`. Commit after every task on branch `feat/dynamic-platform`. Conventional commit messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Library versions: use the versions listed in Tech Stack (latest stable at 2026-10-16); no RC/beta.
- Every phase ends green: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Review Focus

1. **Seeded content with characters that break naïve rendering** (en-dash in "Monday–Friday", "Dinn Rí", "&" in "News & Insights", apostrophes, line breaks used with `whitespace-pre`) must render byte-identical to today → pinned by the Phase 3 visual diff plus a unit test in Task 3.4 that round-trips every fixture string through the Zod schemas unchanged (no trimming/normalising of inner whitespace).
2. **Two editors saving the same record** (stale `version`) must get a 409 with the current state, never a silent overwrite → integration test in Task 4.2 (`savePageDraft` with stale version) and Task 5.1 (articles).
3. **Admin with no SMTP/R2 configured on a fresh production deploy** must still be able to invite users (copyable link) and upload media (disk fallback) → tests in Task 2.4 (invite returns `inviteUrl` when mailer is unconfigured) and Task 6.2 (driver resolves to disk when `integrations.r2` is unset).
4. **Public pages when the DB is temporarily unavailable or a record is missing** must not leak stack traces; missing slug → 404 page, DB down → `error.tsx` with the site's styling, health `/api/v1/health` → 503 → tests in Task 3.6 (unknown service slug → 404) and Task 1.5 (readiness returns 503 when DB unreachable).
5. **Author editing someone else's article or publishing directly via the API** (bypassing the UI) must be rejected with 403 → integration tests in Task 5.1 and E2E in Task 10.3.

---

## Shared contracts (defined once, used everywhere)

These names and shapes are fixed. Phase plans implement them exactly.

```ts
// lib/auth/roles.ts
export const ROLES = ["owner", "admin", "editor", "author", "marketer", "intake", "viewer"] as const
export type Role = (typeof ROLES)[number]

// lib/auth/permissions.ts  (isomorphic; built on better-auth createAccessControl)
export const statements = {
  page: ["read", "update", "publish"],
  service: ["read", "create", "update", "publish", "delete"],
  article: ["read", "create", "update", "publish", "delete", "submit", "updateAny", "deleteAny"],
  collection: ["read", "create", "update", "delete"],      // team, clients, group companies, categories
  media: ["read", "create", "update", "delete"],
  lead: ["read", "update", "delete", "export"],
  seo: ["read", "update"],
  redirect: ["read", "create", "update", "delete"],
  marketing: ["read", "update"],                           // consent + tracking
  customCode: ["read", "update"],
  settings: ["read", "update"],                            // content globals
  integration: ["read", "update", "test"],
  user: ["read", "invite", "update", "ban", "impersonate", "revokeSessions"],
  owner: ["manage"],
  audit: ["read"],
  ai: ["use"],
} as const
export type Resource = keyof typeof statements
export type PermissionRequest = { [R in Resource]?: (typeof statements)[R][number][] }
export function hasPermission(roles: readonly Role[], req: PermissionRequest): boolean // union across roles

// server/lib/actor.ts
export type Actor = {
  userId: string
  roles: Role[]
  ip: string | null
  userAgent: string | null
  impersonatorId: string | null
}

// server/lib/errors.ts
export const ERROR_CODES = ["VALIDATION_FAILED", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "INTERNAL"] as const
export type ErrorCode = (typeof ERROR_CODES)[number]
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: { fieldErrors?: Record<string, string[]>; current?: unknown },
  )
  get status(): number // 422, 401, 403, 404, 409, 429, 500
}
export const notFound: (what: string) => AppError
export const forbidden: () => AppError
export const conflict: (current: unknown) => AppError

// server/lib/crypto.ts
export type KeyPurpose = "secrets" | "preview" | "lead-ip"
export function deriveKey(purpose: KeyPurpose, secret?: string): Buffer          // HKDF-SHA256, salt "sp/v1"
export function encryptSecret(plain: string, aad: string, secret?: string): string // "v1:<iv>:<ct>:<tag>" base64url
export function decryptSecret(token: string, aad: string, secret?: string): string
export function secretHint(plain: string): string                                 // "••••" + last 4

// server/lib/cache-tags.ts
export const tag = {
  page: (key: string) => `page:${key}`,
  services: "services",
  service: (slug: string) => `service:${slug}`,
  articles: "articles",
  article: (slug: string) => `article:${slug}`,
  categories: "categories",
  team: "team",
  clients: "clients",
  groupCompanies: "group-companies",
  settings: (key: SettingsKey) => `settings:${key}`,
  redirects: "redirects",
  media: (id: string) => `media:${id}`,
} as const
export function invalidate(...tags: string[]): void   // wraps revalidateTag per notes

// server/lib/audit.ts
export type AuditEntry = { action: string; entityType?: string; entityId?: string; diff?: unknown }
export async function writeAudit(db: DbOrTx, actor: Actor | null, entry: AuditEntry): Promise<void>

// server/lib/versioning.ts  (shared by pages, services, articles, settings)
export type Versioned<T> = { draft: T; published: T | null; version: number; status: ContentStatus; scheduledAt: Date | null; publishedAt: Date | null }
export type ContentStatus = "draft" | "in_review" | "scheduled" | "published"

// server/db/client.ts
export function getDb(): Db             // lazy pg Pool; throws AppError INTERNAL if DATABASE_URL missing
export type Db = NodePgDatabase<typeof schema>
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]

// server/lib/settings-store.ts
export type SettingsKey = "site" | "contact" | "navigation" | "footer" | "sections.enquireBanner" | "sections.clients"
  | "sections.whyChooseUs" | "seo.defaults" | "consent" | "tracking" | "customCode" | "microcopy" | "leads"
export type IntegrationKey = "integrations.smtp" | "integrations.r2" | "integrations.turnstile" | "integrations.ai"

// server/auth/session.ts (DAL)
export async function getActor(): Promise<Actor | null>          // fresh session, bypasses cookie cache
export async function requireActor(): Promise<Actor>              // redirects to /admin/sign-in
export async function requirePermission(req: PermissionRequest): Promise<Actor> // forbidden() page otherwise

// server/api/app.ts
export const app: Hono<AppEnv>   // basePath("/api")
export type AdminApi = typeof adminRoutes
// lib/api-client.ts (client)
export const api = hc<AdminApi>("/api")  // used by TanStack Query hooks
```

---

## File structure

```
app/
  (site)/layout.tsx                 root layout for public (moved from app/layout.tsx; fonts, SmoothScroll, ThemeProvider)
  (site)/page.tsx, about/, services/, services/[slug]/, team/, blog/, blog/[slug]/, contact/, privacy/, terms/
  (site)/not-found.tsx, error.tsx
  (admin)/admin/layout.tsx          root layout for admin (html/body, admin fonts reuse, Providers)
  (admin)/admin/(auth)/sign-in, two-factor, set-password, reset-password
  (admin)/admin/(panel)/layout.tsx  requireActor + shell
  (admin)/admin/(panel)/page.tsx    dashboard
  (admin)/admin/(panel)/{pages,articles,services,team,clients,group-companies,categories,media,leads,seo,marketing,settings,users,audit,account}/**
  api/[...route]/route.ts
  sitemap.ts, robots.ts
proxy.ts
instrumentation.ts
server/
  env.ts
  db/{client.ts, schema/*.ts, migrations/, migrate.ts, seed/{index.ts, fixtures/*.ts}}
  auth/{auth.ts, session.ts, hooks.ts}
  api/{app.ts, middleware/*.ts, context.ts}
  lib/{actor.ts, errors.ts, crypto.ts, cache-tags.ts, audit.ts, versioning.ts, settings-store.ts, mailer.ts, storage/*.ts, rate-limit.ts, scheduler.ts, jobs/*.ts, ip.ts, site-env.ts}
  modules/{pages,services,articles,collections,media,leads,redirects,settings,integrations,users,audit,dashboard,search,ai,preview}/{routes,service,repo,queries,schema}.ts
lib/
  auth/{roles.ts, permissions.ts}
  schemas/{common.ts, settings/*.ts, api/*.ts}
  api-client.ts, format.ts, utils.ts (existing)
templates/{home,about,services,team,blog,contact,legal}/{schema.ts, render.tsx, editor-meta.ts}
components/                          existing public components (props-driven after Phase 3)
components/admin/**                  admin-only UI (shell, SchemaForm widgets, tables, editors)
components/ui/**                     shadcn primitives (added as needed)
emails/{invite,reset-password,lead-notification,lead-acknowledgement}.tsx
scripts/{migrate,seed,admin-create,owner-recover,demo-seed,secrets-rotate,db-sync,backup,restore-drill}.ts
tests/{unit,integration,e2e,visual}/**
docker-compose.dev.yml, docker-entrypoint.sh, Dockerfile (modified), docker-compose.yml (modified)
.github/workflows/ci.yml (new), deploy.yml (gated on CI)
docs/{brief.md, runbook.md, launch.md}
```

---

## Phase 0 — Audit, inventory, baselines

### Task 0.1: Field inventory and brief

**Files:** Create `docs/brief.md`.
**Interfaces:** Produces the exhaustive field inventory table (component → hard-coded value → target field path, e.g. `components/home/hero.tsx:12 "Watching Over You" → pages.home.hero.heading`). Phase 3 consumes it.
**Acceptance:** Every user-visible literal in `app/**` and `components/**` (strings, image paths, hrefs, tel/mailto, list items, alt text, aria labels) appears exactly once in the inventory with a target; decisions D1–D10 and deviations copied from spec with "confirm or correct"; open questions with defaults; role matrix; API route map; admin IA; phases; risks; out of scope.

### Task 0.2: Visual baseline harness

**Files:** Create `playwright.config.ts`, `tests/visual/public-pages.spec.ts`, `tests/visual/urls.ts`; modify `package.json` (scripts `test:visual`, `test:visual:update`); add devDep `@playwright/test`.
**Interfaces:** Produces `tests/visual/urls.ts` exporting `PUBLIC_URLS: string[]` (every public route incl. each service and blog slug) and a `freezeMotion(page)` helper (reduced motion + disables GSAP/Lenis + waits for fonts/images) used by later visual tests.
**Acceptance:** `pnpm test:visual:update` against `next build && next start` of the current static site writes baselines for every URL at desktop 1440×900 and mobile 390×844 (full page); immediately re-running `pnpm test:visual` passes with `maxDiffPixels: 0` twice in a row (proves determinism). Baselines committed under `tests/visual/__screenshots__/`.

---

## Phase 1 — Infrastructure

### Task 1.1: Dependencies, scripts, lint boundaries

**Files:** Modify `package.json`, `eslint.config.mjs`, `tsconfig.json` (target ES2022); create `vitest.config.ts`, `tests/unit/setup.ts`.
**Acceptance:** deps installed at Tech Stack versions; ESLint rule fails when a file in `lib/` imports `@/server/...` (fixture test in `tests/unit/lint-boundaries.test.ts` running ESLint API on two inline sources); `pnpm test` runs Vitest unit project.

### Task 1.2: Env + site env

**Files:** Create `server/env.ts`, `server/lib/site-env.ts`, `tests/unit/env.test.ts`.
**Interfaces:** `getEnv(): { DATABASE_URL: string; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; NODE_ENV }` (lazy, memoised, throws readable multi-line error listing every missing/invalid var); `getSiteEnv(productionUrl?: string): "development" | "staging" | "production"`.
**Acceptance:** missing vars → error message names each var; `BETTER_AUTH_SECRET` < 32 chars rejected; URL must be absolute http(s); site env derivation per spec §1.4 for all three cases.

### Task 1.3: Crypto + errors + actor

**Files:** Create `server/lib/crypto.ts`, `server/lib/errors.ts`, `server/lib/actor.ts`, `tests/unit/crypto.test.ts`, `tests/unit/errors.test.ts`.
**Interfaces:** as Shared contracts.
**Acceptance:** encrypt/decrypt round trip; different AAD → throws; tampered ciphertext → throws; different secret → throws; output format `v1:` prefix with 4 parts; `deriveKey` deterministic per purpose and different across purposes; `AppError.status` mapping for every code.

### Task 1.4: Database client, schema foundation, migrations, dev compose

**Files:** Create `docker-compose.dev.yml` (postgres:17 on 5432 with dbs `sp_dev`, `sp_test`, `sp_e2e` via init script `docker/postgres-init.sql`; mailpit 1025/8025), `drizzle.config.ts`, `server/db/client.ts`, `server/db/schema/index.ts`, `server/db/schema/_shared.ts` (id/timestamps helpers, `contentStatus` enum), `server/db/migrate.ts`, `scripts/migrate.ts`, `tests/integration/setup.ts` (connects to `sp_test`, runs migrations once, `resetDb()` truncates all tables), `vitest` integration project.
**Interfaces:** `getDb()`, `Db`, `DbOrTx`, `runMigrations(url: string): Promise<void>`, `resetDb(): Promise<void>` (tests only).
**Acceptance:** `pnpm db:up && pnpm db:migrate` succeeds; integration test connects and `select 1`; `next build` with no env still passes (client is lazy).

### Task 1.5: Hono skeleton, error envelope, health

**Files:** Create `app/api/[...route]/route.ts`, `server/api/app.ts`, `server/api/context.ts`, `server/api/middleware/{error.ts,request-id.ts,same-origin.ts,body-limit.ts}`, `server/modules/health/routes.ts`, `tests/integration/api/health.test.ts`, `tests/unit/api/error-envelope.test.ts`.
**Interfaces:** `app` (basePath `/api`), `AppEnv` (Variables: `requestId`, `actor: Actor | null`), `zv(target, schema)` wrapper around `zValidator` that throws `AppError("VALIDATION_FAILED")` with `fieldErrors`.
**Acceptance:** `GET /api/v1/health/live` → 200 `{status:"ok"}`; `GET /api/v1/health` → 200 with DB, 503 `{status:"unavailable"}` when DB unreachable (point at closed port); unknown route → 404 envelope with `requestId`; thrown `AppError` → correct status/envelope; unknown error → 500 `INTERNAL` without stack in body; `secureHeaders` present.

### Task 1.6: Docker entrypoint + compose + build without env

**Files:** Modify `Dockerfile` (copy migrations + compiled scripts, install `postgresql17-client` for pg_dump, entrypoint), create `docker-entrypoint.sh` (run `node scripts/dist/migrate.js` then `exec node server.js`), modify `docker-compose.yml` (env vars, `/data` volume), create `scripts/build-scripts.ts` (esbuild/tsx bundle of `scripts/*.ts` to `scripts/dist`), healthcheck → `/api/v1/health/live`.
**Acceptance:** `docker build .` succeeds with no build args; `docker run` with the 3 env vars against the dev Postgres runs migrations then serves `/api/v1/health/live` 200; `pnpm build` with empty env passes.

---

## Phase 2 — Auth, RBAC, users, audit

### Task 2.1: Roles + permissions (isomorphic)

**Files:** Create `lib/auth/roles.ts`, `lib/auth/permissions.ts`, `tests/unit/permissions.test.ts`.
**Acceptance:** table-driven test covering every role × resource × action against the spec §6.1 matrix (expected matrix written out literally in the test); multi-role union; unknown role grants nothing; `owner:manage` only owner; `customCode` only owner.

### Task 2.2: Auth schema + Better Auth config

**Files:** Create `server/db/schema/auth.ts` (users incl. `title`, `roles` text, banned fields, two_factor tables, rate_limit), `server/auth/auth.ts` (`getAuth()` lazy memoised), `server/auth/hooks.ts`, migration.
**Interfaces:** `getAuth()`; users table columns `id, name, email, emailVerified, image, title, role (comma-separated per admin plugin), banned, banReason, banExpires, twoFactorEnabled, createdAt, updatedAt`.
**Acceptance:** integration: create user via `auth.api.createUser` (no password) → row exists with uuid v7 id; sign-up endpoint disabled (POST `/api/auth/sign-up/email` → 4xx); password < 12 rejected; sign-in works after setting password; sessions expire 7 days; cookie names start with `sp`.

### Task 2.3: Audit log + session DAL + Hono auth middleware

**Files:** Create `server/db/schema/audit.ts`, `server/lib/audit.ts`, `server/auth/session.ts`, `server/api/middleware/auth.ts` (`sessionMiddleware`, `requireSignedIn`, `can(req)`), `server/modules/audit/{routes,service,repo}.ts`, tests.
**Acceptance:** `can({ lead: ["read"] })` → 401 without session, 403 for editor, 200 for intake; banned user → 401 on next request (no cookie-cache lag for admin API); sign-in/sign-out/failed sign-in write audit rows (Better Auth hooks); `GET /api/v1/admin/audit` paginated + filters (actor, action, entityType, from/to), requires `audit:read`.

### Task 2.4: Users module (invite, roles, ban, sessions, impersonate)

**Files:** Create `server/modules/users/{routes,service,repo,schema}.ts`, `server/lib/mailer.ts` (interface only + console fallback; SMTP transport added in Task 7.2), `emails/invite.tsx`, `emails/reset-password.tsx`, tests.
**Interfaces:** `mailer.send({ to, subject, react }) : Promise<{ delivered: boolean; previewUrl?: string }>`; invite response `{ user, inviteUrl, emailDelivered }`.
**Acceptance:** invite creates passwordless user with roles and returns `inviteUrl` (`/admin/set-password?token=…`) and `emailDelivered:false` when SMTP unset; admin cannot assign `owner` or modify an owner (403); owner can; role change/ban/unban/revoke sessions audited; impersonation 1 h, cannot impersonate owner unless owner, audited start/stop; last active owner cannot be banned/demoted (409).

### Task 2.5: Admin auth pages + proxy

**Files:** Create `proxy.ts`, `app/(admin)/admin/layout.tsx`, `app/(admin)/admin/(auth)/{layout.tsx,sign-in/page.tsx,two-factor/page.tsx,set-password/page.tsx,reset-password/page.tsx,forgot-password/page.tsx}`, `lib/auth-client.ts`, `components/admin/auth/*`.
**Acceptance:** E2E-lite (Playwright against dev server in Phase 2 plan): `/admin` without cookie → redirect `/admin/sign-in?next=/admin`; `/admin/*` and `/api/*` responses carry `X-Robots-Tag: noindex`; set-password flow works with invite token; 2FA challenge page shown when enabled.

### Task 2.6: Account security (2FA, password, sessions) + bootstrap scripts

**Files:** Create `app/(admin)/admin/(panel)/account/**` (minimal panel layout stub with `requireActor` until Phase 4 shell), `scripts/admin-create.ts`, `scripts/owner-recover.ts`, `scripts/demo-seed.ts`, `server/db/seed/guard.ts` (`assertDisposable(url, allowProduction)`), tests.
**Acceptance:** enable TOTP (verify with generated code from `otpauth` in test), backup codes, disable; change password revokes other sessions; list/revoke sessions; `admin:create` creates owner + prints link; `owner:recover` clears 2FA + prints reset link + audit; `demo:seed` idempotent (twice → 7 users, passwords reset); guard refuses non-disposable URL without `--allow-production`.

---

## Phase 3 — Content model + public site from DB

### Task 3.1: Content schemas (DB + Zod)

**Files:** Create `server/db/schema/{pages,services,articles,collections,settings,revisions,media,redirects,leads,jobs,ai}.ts`, migration; `lib/schemas/common.ts` (slug, mediaRef, link, richText, seo), `lib/schemas/settings/*.ts` (one per `SettingsKey`, per spec §5.4), `lib/schemas/content/{service,article,team-member,client,group-company,category}.ts`.
**Acceptance:** migration applies; unit tests: slug regex, link schema (internal/external/tel/mailto), every settings schema parses its fixture; no whitespace normalisation on strings.

### Task 3.2: Template schemas

**Files:** Create `templates/{home,about,services,team,blog,contact,legal}/schema.ts` + `templates/registry.ts` (`templates: Record<TemplateName, { schema, label }>`), tests.
**Acceptance:** each schema parses its fixture (Task 3.4) and matches the inventory fields for that page (test asserts the set of leaf paths equals the inventory's list for that page, read from a JSON export of the inventory `docs/brief-inventory.json` produced in Task 0.1's phase plan).

### Task 3.3: Media seed + fixtures

**Files:** Create `server/db/seed/fixtures/{pages,services,articles,team,clients,group-companies,categories,settings,media}.ts` (values copied verbatim from `components/*/data.ts`, page literals, and inventory), `server/db/seed/media.ts` (registers every `public/images/*` used by content as a `media` row with `driver:"static"`, `key:"/images/…"`, width/height/blur from sharp).
**Acceptance:** fixtures typecheck against schemas; media rows created with dimensions; `driver:"static"` URLs resolve to the existing `/images/...` paths (so markup `src` stays identical).

### Task 3.4: Repos, queries, seed runner

**Files:** Create `server/modules/{pages,services,articles,collections,settings,media}/{repo,queries}.ts`, `server/db/seed/index.ts`, `scripts/seed.ts`, tests.
**Interfaces (queries, all `'use cache'` + tags, read `published` unless draft mode):** `getPage<T extends TemplateName>(key)`, `listServices()`, `getService(slug)`, `listArticles({ category?, limit? })`, `getArticle(slug)`, `listCategories()`, `listTeam()`, `listClients()`, `listGroupCompanies()`, `getSettings<K extends SettingsKey>(key)`, `getMedia(id)`.
**Acceptance:** seed twice → same row counts (idempotent upserts by natural key); seeded records are published (draft = published, version 1); fixture string round trip unchanged (Review Focus 1); query returns `null` for unknown slug.

### Task 3.5: Route groups + props-driven components

**Files:** Move `app/*` pages into `app/(site)/`, move root layout to `app/(site)/layout.tsx`; modify every component in `components/{home,about,services,team,blog,contact}` to receive data via props (no `data.ts` import), keeping markup identical; create `templates/*/render.tsx`; delete `components/*/data.ts`.
**Acceptance:** `grep -r "data\"" components app` finds no data imports; typecheck passes; no JSX structure change except prop plumbing (reviewer diffs markup).

### Task 3.6: Public pages from DB, caching, metadata, legal pages, 404/error

**Files:** Modify `app/(site)/**/page.tsx` to call queries; `next.config.ts` (`cacheComponents: true` per notes); create `app/(site)/privacy/page.tsx`, `app/(site)/terms/page.tsx`, `app/(site)/not-found.tsx`, `app/(site)/error.tsx`; remove `generateStaticParams`; footer legal links point to `/privacy`, `/terms` (href change only).
**Acceptance:** `pnpm build` with no env passes; with seeded DB `pnpm test:visual` → 0 diff on every baseline URL; unknown service/article slug → 404; GSAP motion initialises (Playwright: no console errors, `.js` class present, a known animated element reaches final state); privacy/terms render with existing PageHero.

---

## Phase 4 — Admin shell + editors

### Task 4.1: Admin shell, providers, navigation, ⌘K, permissions hook

**Files:** `app/(admin)/admin/(panel)/layout.tsx`, `components/admin/shell/{sidebar.tsx,topbar.tsx,mobile-nav.tsx,command-palette.tsx,impersonation-banner.tsx}`, `components/admin/providers.tsx` (QueryClient, Toaster, Tooltip), `lib/api-client.ts`, `hooks/use-permission.ts`, `server/modules/search/*` (`GET /api/v1/admin/search?q`), shadcn components as needed.
**Acceptance:** sidebar items filtered by permission (unit test of `navItems(roles)`); sheet nav < 1024 px; ⌘K opens, searches records; visual baseline of shell at 1440 and 390.

### Task 4.2: Versioning service + pages API

**Files:** `server/lib/versioning.ts` (generic `saveDraft`, `publish`, `listRevisions`, `restoreRevision`), `server/modules/pages/{routes,service,schema}.ts`, `server/modules/revisions/*`, tests.
**Acceptance:** save draft with correct version → version+1; stale version → 409 with current (Review Focus 2); publish copies draft → published, writes revision + audit, calls `invalidate(tag.page(key))`; restore loads revision into draft; template schema validation errors → 422 with fieldErrors paths.

### Task 4.3: SchemaForm + widgets

**Files:** `components/admin/schema-form/{schema-form.tsx,widgets/*.tsx,editor-meta.ts,resolve-widget.ts}`, `templates/*/editor-meta.ts`, tests (React Testing Library unit tests in jsdom project).
**Interfaces:** `<SchemaForm schema meta value onChange errors />`; widget kinds: `text, textarea, richText, link, media, number, toggle, select, list, group, collection`.
**Acceptance:** renders every template schema without missing widget; list add/remove/reorder (keyboard); textarea counter; Zod errors mapped to fields.

### Task 4.4: Page editor screen (autosave, publish, preview, revisions)

**Files:** `app/(admin)/admin/(panel)/pages/{page.tsx,[key]/page.tsx}`, `components/admin/editor/{editor-layout.tsx,save-state.tsx,publish-dialog.tsx,revision-drawer.tsx,conflict-dialog.tsx,unsaved-guard.tsx}`, `hooks/use-autosave.ts`, `server/modules/preview/*`.
**Acceptance:** E2E: edit home hero heading → autosave indicator "Saved" → publish → public `/` shows new heading; ⌘S saves; navigating away with unsaved changes prompts; conflict dialog on 409; preview link shows draft only to signed-in user with preview cookie.

### Task 4.5: Settings + shared sections editors

**Files:** `server/modules/settings/{routes,service}.ts`, `app/(admin)/admin/(panel)/settings/**`.
**Acceptance:** each content settings key editable with draft/publish; marketing/customCode keys rejected here (they live in Phase 8 module); permissions enforced per key group.

### Task 4.6: Collections (services, team, clients, group companies, categories) + reorder

**Files:** `server/modules/{services,collections}/{routes,service,schema}.ts`, `app/(admin)/admin/(panel)/{services,team,clients,group-companies,categories}/**`, `components/admin/data-table/*`, `components/admin/sortable-list.tsx`, `server/modules/reorder/*`.
**Acceptance:** CRUD + reorder persists `sortOrder` and invalidates tags; services have draft/publish; slug uniqueness → 409; deleting a category with articles → 409; TanStack Table server pagination/sort/search; phones show cards.

### Task 4.7: Dashboard

**Files:** `server/modules/dashboard/*`, `app/(admin)/admin/(panel)/page.tsx`, `components/admin/dashboard/*`.
**Acceptance:** KPIs (leads 30d, open leads, published content counts, in-review drafts), leads trend 90d chart, "Next up" checklist items computed from state (SMTP unset, R2 unset, 2FA off for owner/admin, drafts in review, unassigned leads).

---

## Phase 5 — Articles workflow

### Task 5.1: Articles service + API

**Files:** `server/modules/articles/{routes,service,repo,schema}.ts`, tests.
**Acceptance:** author creates/updates own draft, `submit` → `in_review`; author publish → 403; author edit others' → 403 (Review Focus 5); editor publish/schedule/unpublish; scheduled `scheduledAt` in past → 422; readTime computed from body words (200 wpm, min 1); stale version → 409; every transition audited + revision.

### Task 5.2: TipTap editor + public renderer

**Files:** `components/admin/rich-text/{editor.tsx,toolbar.tsx,extensions.ts}`, `lib/rich-text/render.tsx` (TipTap JSON → existing `ArticleBody` markup), tests.
**Acceptance:** only allowed node types (spec §5.3); pasted disallowed nodes stripped; renderer output for the seeded article equals current markup (visual diff 0 on that article); image node uses media ref.

### Task 5.3: Articles admin screens

**Files:** `app/(admin)/admin/(panel)/articles/**`.
**Acceptance:** list with status filters/category/author; editor reuses Task 4.4 editor layout; review queue for editors; schedule dialog in Europe/Dublin time.

### Task 5.4: Scheduler + scheduled publish

**Files:** `instrumentation.ts`, `server/lib/scheduler.ts`, `server/lib/jobs/{publish-scheduled.ts,prune-revisions.ts,index.ts}`, tests.
**Acceptance:** two concurrent `tick()` calls publish a due article exactly once (`SKIP LOCKED`); failures recorded in `jobs.lastError`; scheduler does not start during `next build`; revision pruning keeps the newest 50 per entity.

---

## Phase 6 — Media

### Task 6.1: Storage drivers

**Files:** `server/lib/storage/{index.ts,disk.ts,r2.ts,static.ts}`, tests.
**Interfaces:** `getStorage(): Promise<StorageDriver>`; `StorageDriver = { name: "disk" | "r2"; put(key, body, contentType): Promise<void>; delete(key): Promise<void>; url(key): string; test(): Promise<void> }`.
**Acceptance:** disk driver writes under `/data/uploads` (dev: `.data/uploads`); R2 driver uses S3 client with endpoint per notes (unit-tested with mocked client); `getStorage()` → disk when `integrations.r2` unset (Review Focus 3).

### Task 6.2: Media service + upload API + file route

**Files:** `server/modules/media/{routes,service,schema}.ts`, `server/lib/image.ts` (sharp metadata + blur), tests.
**Acceptance:** upload jpeg/png/webp/avif/svg/pdf ≤ 20 MB; other MIME (sniffed, not trusted from header) → 422; SVG sanitised (scripts/handlers removed); usages tracked; delete in-use → 409; alt/focal update; disk files served by `/api/v1/media/file/:key` with `Cache-Control: public, max-age=31536000, immutable`.

### Task 6.3: Media library UI + picker

**Files:** `app/(admin)/admin/(panel)/media/**`, `components/admin/media/{library.tsx,uploader.tsx,picker-dialog.tsx,focal-point.tsx}`; wire `media` widget in SchemaForm.
**Acceptance:** drag-drop upload with progress; picker used in page editor to change hero image → public page uses new image after publish; `next/image` loader handles static/disk/r2 URLs.

### Task 6.4: Migrate uploads to R2 job

**Files:** `server/lib/jobs/migrate-media.ts`, route `POST /api/v1/admin/integrations/integrations.r2/migrate-media`.
**Acceptance:** idempotent; skips `static`; updates `driver`/`key`; progress visible.

---

## Phase 7 — Leads + email

### Task 7.1: Integrations module (generic)

**Files:** `server/modules/integrations/{routes,service,schema}.ts`, `lib/schemas/integrations/*.ts`, `app/(admin)/admin/(panel)/settings/integrations/**`.
**Acceptance:** secret fields write-only; GET returns `{ set, hint }`; empty secret on update keeps old value; values encrypted in DB (raw row does not contain plaintext); `test` endpoint per integration; owner/admin only.

### Task 7.2: SMTP mailer + email templates

**Files:** `server/lib/mailer.ts` (nodemailer transport from `integrations.smtp`, dev default Mailpit), `emails/{lead-notification,lead-acknowledgement}.tsx`, tests (integration against Mailpit API in CI/dev).
**Acceptance:** invite email arrives in Mailpit; unconfigured production → `delivered:false` + logged; test connection uses `transporter.verify()`.

### Task 7.3: Public leads endpoint + contact form wiring

**Files:** `server/modules/leads/{routes,service,repo,schema}.ts`, `server/lib/rate-limit.ts`, `server/lib/turnstile.ts`, modify `components/home/contact-form.tsx` (submit to API, messages from microcopy, hidden honeypot that does not alter layout).
**Acceptance:** valid post → lead row + staff email + optional acknowledgement; honeypot filled → 200 but no lead; 6th post in 10 min from same IP → 429; Turnstile enabled + bad token → 422; body > 64 KB → 413; IP stored as HMAC hash; visual diff still 0 on contact pages.

### Task 7.4: Leads inbox UI + export + retention

**Files:** `app/(admin)/admin/(panel)/leads/**`, `server/lib/jobs/purge-leads.ts`.
**Acceptance:** status workflow, assignee, notes timeline, CSV export (RFC 4180, formula-injection safe: cells starting with `= + - @` prefixed with `'`), intake sees only leads; retention purge deletes older than N months.

---

## Phase 8 — SEO, marketing, consent

### Task 8.1: SEO fields + metadata + JSON-LD + OG

**Files:** `lib/seo/*.ts`, `app/(site)/**` `generateMetadata`, `app/(site)/opengraph-image.tsx` (+ per-route), `components/seo/json-ld.tsx`, `app/(admin)/admin/(panel)/seo/**`.
**Acceptance:** each public URL has title/description/canonical/OG; JSON-LD validates (schema-dts types); Lighthouse SEO 100 on home.

### Task 8.2: Sitemap, robots, redirects

**Files:** `app/sitemap.ts`, `app/robots.ts`, `server/modules/redirects/*`, `app/(site)/[...missing]/page.tsx` or not-found redirect resolution per notes, admin redirects screen.
**Acceptance:** sitemap lists all published pages/services/articles with lastmod; robots disallows `/admin`, `/api`; redirect 301 works and increments hits; loop detection (a→b→a rejected 422).

### Task 8.3: Consent + tracking + custom code

**Files:** `components/consent/{consent-banner.tsx,consent-provider.tsx,tracking-scripts.tsx}`, `lib/analytics/events.ts`, `server/modules/marketing/*`, admin marketing screens.
**Acceptance:** tracking disabled → no banner, no scripts, visual diff 0; enabled → banner styled with site tokens, scripts load only after matching consent; consent stored in cookie 6 months; custom code owner-only (admin → 403).

---

## Phase 9 — AI assistant

### Task 9.1: AI provider + chat API

**Files:** `server/modules/ai/{routes,service,repo,providers.ts}`, tests.
**Acceptance:** provider/model/key from `integrations.ai`; test connection; role allow-list enforced; streaming response; conversations persisted per user; disabled → 404.

### Task 9.2: Assistant panel UI

**Files:** `components/admin/ai/{assistant-panel.tsx,message-list.tsx}`.
**Acceptance:** panel hidden when disabled; context of current record included; "Insert" applies suggestion to focused field via SchemaForm API.

---

## Phase 10 — Hardening, ops, E2E, docs

### Task 10.1: Backups, restore drill, secrets rotate, db sync

**Files:** `scripts/{backup,restore-drill,secrets-rotate,db-sync}.ts`, `server/lib/jobs/backup.ts`, tests.
**Acceptance:** backup produces `pg_dump` custom-format file to R2 or `/data/backups`, keeps 14; restore drill restores into scratch DB and compares row counts; rotate re-encrypts all secret fields (integration test with two secrets); db-sync per spec §14 (integration test between `sp_test` and a scratch DB).

### Task 10.2: Security pass

**Files:** various.
**Acceptance:** sameOrigin rejects cross-origin POST to admin API (test); CSP-compatible headers documented; no secrets in logs (grep test over a captured log run); rate limits active in production config; dependency audit clean of high/critical.

### Task 10.3: E2E suite

**Files:** `tests/e2e/**`, `tests/e2e/global-setup.ts` (migrate + seed + demo seed `sp_e2e`).
**Acceptance:** spec §15 E2E list all passing.

### Task 10.4: CI + deploy gating

**Files:** `.github/workflows/ci.yml`, modify `.github/workflows/deploy.yml` (`workflow_run` on CI success for `main`).
**Acceptance:** CI YAML validated with `actionlint` if available; jobs: lint, typecheck, unit, integration (postgres service), build (no env), e2e (postgres + mailpit services).

### Task 10.5: Docs + final verification

**Files:** `docs/runbook.md`, `docs/launch.md`, `docs/brief.md` (final Change notes), `README.md`.
**Acceptance:** Definition of done (spec §1.2) verified with command output captured in the final report.

---

## Changes

- 2026-10-16: `SettingsKey` gains `"sections.about"` and `"sections.contact"` (contact info + form copy + map) — sections rendered on more than one page are shared globals (extends spec D10). `article_categories` gains `showInFilter boolean`. `users` gains `title` (byline role). Inventory-discovered fields (e.g. `contact.operationsExtension`, `pages.blog.pageSize`, `services[].heroImage|image|imageAlt`, `pages.team.leadership.photoPlaceholder`) are added in Phase 3.
- 2026-10-16: Scheduler cannot call `revalidateTag`; jobs call internal `/api/v1/internal/revalidate` signed with HKDF purpose `"cron"` (added to `KeyPurpose`). `invalidate()` uses `revalidateTag(tag, { expire: 0 })`. `proxy.ts` matches `/admin/:path*` only; `/api` noindex header set in Hono.

## Execution

- Method: superpowers:subagent-driven-development. All subagents run with `model: "opus"`.
- Before each phase: write that phase's plan file (rolling-wave), using the notes files and the actual code from previous phases.
- After each phase: run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (+ `pnpm test:visual` from Phase 3 onward) and commit.
- Never push.
