# Phase 2 — Auth, RBAC, users, audit

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master, Phase 2 = Tasks 2.1–2.6). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§3, §4, §6, §7, §8.1, §13, §14, §15). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Public design is frozen: visual diff vs Phase 0 baselines must stay 0 px at 1440×900 and 390×844 (`pnpm test:visual`, macOS only, port 3100 free). Task 5 moves the public pages into `app/(site)`; Tasks 5 and 6 run the visual gate.
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (+ platform `NODE_ENV`, `PORT`, `HOSTNAME`). No new env var in this phase (tests use `TEST_DATABASE_URL` / `E2E_DATABASE_URL`, tests only).
- `next build` must succeed with no env vars and no database: `getAuth()` is lazy and memoised, nothing reads env or opens a DB connection at import time.
- Every file under `server/` starts with `import "server-only"` (pinned by `tests/unit/server-only-guard.test.ts`). `lib/**` never imports `server/**` (ESLint boundary from Phase 1).
- Repos are the only files that import Drizzle query builders (`server/modules/*/repo.ts`). Services call repos; routes call services only.
- IDs uuid v7 (Better Auth tables too: `advanced.database.generateId: "uuid"` + Drizzle `$defaultFn(uuidv7)` via the Phase 1 `id()` helper), timestamps `timestamptz`, API dates ISO 8601 UTC, displayed in `Europe/Dublin` / `en-IE`.
- Error envelope `{ error: { code, message, fieldErrors?, requestId } }`; lists `{ items, page, pageSize, total }` with `?page&pageSize&sort=field:dir&q` (`pageSize` ≤ 100, default 20).
- Passwords ≥ 12 chars, sessions 7 days, cookie prefix `sp` (`__Secure-` on https).
- Body limits: public 64 KB (also applied to `/api/auth/*`), admin 1 MB.
- Library versions exact (`--save-exact`): better-auth 1.7.10, react-email 6.11.2, qrcode 1.5.4 (+ @types/qrcode 1.5.6), otpauth 9.5.2 (dev). Follow `docs/superpowers/notes/libraries-api.md` §2 for Better Auth.
- Code style: Prettier config in repo (no semicolons, double quotes, 80 cols). Run `pnpm exec prettier --write <files>` on files you create if your editor does not.
- Commit after every task; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (+ `pnpm test:visual`, `pnpm test:e2e`).

**Prerequisites:** Phase 1 complete (all six tasks committed). `pnpm db:up` running (Postgres 17 with `sp_dev`, `sp_test`, `sp_e2e`), `.env.development` present (`cp .env.example .env.development`), `pnpm db:migrate` applied. Integration tests and E2E need Postgres; port 3100 must be free for Playwright.

**Ledger rulings applied:** `proxy.ts` matcher is `/admin/:path*` only and `X-Robots-Tag` for `/api/*` stays in Hono; session middleware precedes `sameOrigin` in `server/api/app.ts`; `users.title` column; `owner` is special (only owners grant `owner` or change an owner); invite returns `inviteUrl` when SMTP is unset (mailer console fallback); Playwright `reuseExistingServer: false`; Playwright webServer gets DB env through `webServer.env`.

## Corrections to master plan

- Public pages move from `app/*` into `app/(site)/*` in this phase (Task 5) instead of Task 3.5 — why: Next only allows a separate `/admin` root layout when there is no `app/layout.tsx`, so every top-level route must sit in a group; the move is `git mv` + one import path, gated by `pnpm test:visual` (0 px). Task 3.5 keeps the props-driven component work. Unmatched URLs then render Next's built-in 404 document (still status 404) until Task 3.6 adds `app/global-not-found.tsx` (existing ruling) — cost if wrong: the 404 page shows system fonts for the Phase 2–3 window.
- Task 6 (master 2.5) creates `app/(admin)/admin/(panel)/layout.tsx` (requireSession + plain header) and a placeholder `(panel)/page.tsx` ("Welcome, {name}"), not Task 2.6 — why: sign-in needs a landing page; Task 4.1 replaces the layout body, Task 4.7 the page — cost: none.
- Better Auth tables use the spec §5.5 plural names (`users`, `sessions`, `accounts`, `verifications`, `two_factors`, `rate_limits`) through `drizzleAdapter({ usePlural: true })`; Drizzle exports are `users`, `sessions`, `accounts`, `verifications`, `twoFactors`, `rateLimits` — cost: none.
- The Better Auth admin plugin gets its own two-action access control (`user: impersonate | impersonate-admins`, derived from `lib/auth/permissions.ts`; `adminRoles: ["owner"]`) and every `/api/auth/admin/*` endpoint is closed over HTTP (before-hook → 404). User management goes only through `/api/v1/admin/users` (permission checks, owner rules, audit) — why: the plugin's statements (`user:create`, `set-role`, …) differ from ours and a direct call would bypass audit and owner rules — cost: none.
- `ai:use` is granted to every role except `viewer` (spec §6.1 is silent; §8.3 gates the assistant by `integrations.ai.allowedRoles`, which Phase 9 applies on top) — cost if wrong: one line in `ROLE_GRANTS`.
- Invite always returns `inviteUrl` (also when the email was delivered) and the users module adds `POST /users/:id/password-link` (spec §17 "invite/reset links surfaced in admin") — cost: one route.
- `AuditEntry` gains optional `ip` / `userAgent`, used only when there is no actor (failed sign-in, password reset by token) — additive, contract unchanged.
- API input schemas live in `lib/schemas/api/{list,params,audit,users}.ts` (isomorphic, reused by Phase 4 forms); `server/modules/audit/` has no `schema.ts`; `server/modules/users/schema.ts` holds response DTOs — cost: none.
- New helper files not named in the master: `server/auth/tokens.ts` (password-link tokens), `server/lib/ip.ts` (master lists `ip.ts`), `lib/auth/password.ts`, `lib/auth/redirect.ts`, `lib/format.ts` (master lists `format.ts`), `server/modules/users/bootstrap.ts` (logic behind the three operator scripts, unit-testable), `scripts/lib/run-script.ts`, `emails/layout.tsx`, `tests/integration/helpers/auth.ts`, `tests/e2e/{env,fixtures,seed,global.setup}.ts`.
- `server/auth/session.ts` also exports `sessionFromHeaders`, `getSessionContext`, `requireSession` and the `SessionContext` type; the three contract functions keep their signatures — cost: none.
- `useSecureCookies` follows the `BETTER_AUTH_URL` protocol (https → `__Secure-sp.*`) instead of `NODE_ENV` — "__Secure- in production" still holds (production is https) and the E2E production server on `http://127.0.0.1:3100` works — cost: none.
- `experimental.authInterrupts: true` + `app/(admin)/admin/forbidden.tsx` so `requirePermission()` can call `forbidden()`. Inside `<Suspense>` the forbidden UI streams with HTTP 200 (documented Next behaviour) — cost: none.
- E2E-lite runs against `next start` (production build, `pnpm build && pnpm start -p 3100`, the Phase 0 webServer) instead of `next dev` — deterministic and also proves the build. Production rate limits are on there, so every E2E test signs in from its own `X-Forwarded-For` address (`clientIpFor()`); one test asserts the sign-in limit (6th attempt → 429) — cost: none.
- Phase 1's `tests/unit/api/error-envelope.test.ts` changes in Task 3: admin routes now require a session, so the test stubs `sessionFromHeaders` with `vi.mock` (no DB in unit tests) and gains one test pinning "session before sameOrigin" — cost: none.
- Extra hardening in `server/auth/hooks.ts`: `/change-password` always revokes other sessions (before-hook forces `revokeOtherSessions: true`), and an impersonation session cannot call account-changing auth endpoints (403) — cost: none.

**Risk noted for later phases (no change here):** Better Auth's rate limits and the audit IP use the first `X-Forwarded-For` value (spec §4). That is only trustworthy when Traefik overwrites the header for untrusted clients; otherwise a client can rotate `X-Forwarded-For` to dodge the 5/min sign-in limit. The Phase 10 security pass / runbook must check Traefik's forwarded-headers trust settings.

---

### Task 1: Roles + permissions (master Task 2.1)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (add `better-auth@1.7.10`)
- Create: `lib/auth/permissions.ts`
- Test: `tests/unit/permissions.test.ts`
- Unchanged: `lib/auth/roles.ts` (Phase 1 owns it)

**Interfaces:**
- Consumes: `ROLES`, `Role` from `lib/auth/roles.ts` (Phase 1).
- Produces (isomorphic, safe in client code):

```ts
export const statements: { page: ["read","update","publish"], service: [...], article: [...], collection, media, lead, seo, redirect, marketing, customCode, settings, integration, user, owner: ["manage"], audit: ["read"], ai: ["use"] } // exactly the master Shared contracts
export type Resource = keyof typeof statements
export type PermissionRequest = { [R in Resource]?: (typeof statements)[R][number][] }
export const ac            // createAccessControl(statements)
export const ROLE_GRANTS: Record<Role, Grants>   // spec §6.1 matrix
export const roles: Record<Role, ReturnType<typeof ac.newRole>>
export function hasPermission(roles: readonly string[], req: PermissionRequest): boolean // union across roles; unknown roles grant nothing; empty request → false
export function parseRoles(value: string | null | undefined): Role[] // users.role "editor,author" → ["editor","author"], unknown dropped
```

Matrix decisions (spec §6.1 written as grants): owner = everything; admin = everything except `customCode:*` and `owner:*`; editor = all actions on `page, service, article, collection, media, seo` + `settings:read/update` + `ai:use`; author = `article: read, create, update, delete, submit` (own-only enforced by the Phase 5 service: no `updateAny/deleteAny`) + `media: read, create` + `ai:use`; marketer = all on `seo, redirect, marketing` + read on `page, service, article` + `media: read, create` + `ai:use`; intake = `lead: read, update, export` + `ai:use`; viewer = `read` on `page, service, article, collection, media, seo, redirect, marketing, settings`.

- [ ] **Step 1: Install Better Auth**

```bash
pnpm add --save-exact better-auth@1.7.10
```

Expected: `+ better-auth 1.7.10`, no "ignored build scripts" warning.

- [ ] **Step 2: Write the failing test**

`tests/unit/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  hasPermission,
  parseRoles,
  type PermissionRequest,
  type Resource,
  statements,
} from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"

// Spec §6.1 written out literally: every "resource:action" each role holds.
// Anything not listed must be denied.
const EXPECTED: Record<Role, string[]> = {
  owner: [
    "page:read",
    "page:update",
    "page:publish",
    "service:read",
    "service:create",
    "service:update",
    "service:publish",
    "service:delete",
    "article:read",
    "article:create",
    "article:update",
    "article:publish",
    "article:delete",
    "article:submit",
    "article:updateAny",
    "article:deleteAny",
    "collection:read",
    "collection:create",
    "collection:update",
    "collection:delete",
    "media:read",
    "media:create",
    "media:update",
    "media:delete",
    "lead:read",
    "lead:update",
    "lead:delete",
    "lead:export",
    "seo:read",
    "seo:update",
    "redirect:read",
    "redirect:create",
    "redirect:update",
    "redirect:delete",
    "marketing:read",
    "marketing:update",
    "customCode:read",
    "customCode:update",
    "settings:read",
    "settings:update",
    "integration:read",
    "integration:update",
    "integration:test",
    "user:read",
    "user:invite",
    "user:update",
    "user:ban",
    "user:impersonate",
    "user:revokeSessions",
    "owner:manage",
    "audit:read",
    "ai:use",
  ],
  admin: [
    "page:read",
    "page:update",
    "page:publish",
    "service:read",
    "service:create",
    "service:update",
    "service:publish",
    "service:delete",
    "article:read",
    "article:create",
    "article:update",
    "article:publish",
    "article:delete",
    "article:submit",
    "article:updateAny",
    "article:deleteAny",
    "collection:read",
    "collection:create",
    "collection:update",
    "collection:delete",
    "media:read",
    "media:create",
    "media:update",
    "media:delete",
    "lead:read",
    "lead:update",
    "lead:delete",
    "lead:export",
    "seo:read",
    "seo:update",
    "redirect:read",
    "redirect:create",
    "redirect:update",
    "redirect:delete",
    "marketing:read",
    "marketing:update",
    "settings:read",
    "settings:update",
    "integration:read",
    "integration:update",
    "integration:test",
    "user:read",
    "user:invite",
    "user:update",
    "user:ban",
    "user:impersonate",
    "user:revokeSessions",
    "audit:read",
    "ai:use",
  ],
  editor: [
    "page:read",
    "page:update",
    "page:publish",
    "service:read",
    "service:create",
    "service:update",
    "service:publish",
    "service:delete",
    "article:read",
    "article:create",
    "article:update",
    "article:publish",
    "article:delete",
    "article:submit",
    "article:updateAny",
    "article:deleteAny",
    "collection:read",
    "collection:create",
    "collection:update",
    "collection:delete",
    "media:read",
    "media:create",
    "media:update",
    "media:delete",
    "seo:read",
    "seo:update",
    "settings:read",
    "settings:update",
    "ai:use",
  ],
  author: [
    "article:read",
    "article:create",
    "article:update",
    "article:delete",
    "article:submit",
    "media:read",
    "media:create",
    "ai:use",
  ],
  marketer: [
    "page:read",
    "service:read",
    "article:read",
    "media:read",
    "media:create",
    "seo:read",
    "seo:update",
    "redirect:read",
    "redirect:create",
    "redirect:update",
    "redirect:delete",
    "marketing:read",
    "marketing:update",
    "ai:use",
  ],
  intake: ["lead:read", "lead:update", "lead:export", "ai:use"],
  viewer: [
    "page:read",
    "service:read",
    "article:read",
    "collection:read",
    "media:read",
    "seo:read",
    "redirect:read",
    "marketing:read",
    "settings:read",
  ],
}

const ALL_PAIRS = (Object.keys(statements) as Resource[]).flatMap((resource) =>
  statements[resource].map((action) => [resource, action] as const)
)

const req = (resource: Resource, action: string) =>
  ({ [resource]: [action] }) as PermissionRequest

describe("permission matrix (spec §6.1): every role × resource × action", () => {
  it("covers 16 resources and 52 actions", () => {
    expect(Object.keys(statements)).toHaveLength(16)
    expect(ALL_PAIRS).toHaveLength(52)
  })

  for (const role of ROLES) {
    describe(role, () => {
      it.each(ALL_PAIRS)("%s:%s", (resource, action) => {
        expect(hasPermission([role], req(resource, action))).toBe(
          EXPECTED[role].includes(`${resource}:${action}`)
        )
      })
    })
  }

  it("expected lists only name real statements", () => {
    const real = new Set(ALL_PAIRS.map(([r, a]) => `${r}:${a}`))
    for (const role of ROLES)
      for (const pair of EXPECTED[role]) expect(real.has(pair)).toBe(true)
  })
})

describe("hasPermission", () => {
  it("multi-role users get the union across roles", () => {
    const both: Role[] = ["intake", "author"]
    expect(hasPermission(both, { lead: ["export"] })).toBe(true)
    expect(hasPermission(both, { article: ["submit"] })).toBe(true)
    // one request spanning resources granted by different roles
    expect(hasPermission(both, { lead: ["read"], article: ["create"] })).toBe(
      true
    )
    expect(
      hasPermission(["intake"], { lead: ["read"], article: ["create"] })
    ).toBe(false)
  })

  it("requires every requested action", () => {
    expect(hasPermission(["author"], { article: ["create", "publish"] })).toBe(
      false
    )
    expect(hasPermission(["editor"], { article: ["create", "publish"] })).toBe(
      true
    )
  })

  it("unknown roles grant nothing (incl. prototype keys)", () => {
    for (const bogus of [
      "superuser",
      "user",
      "constructor",
      "__proto__",
      "",
      "Owner",
    ])
      expect(hasPermission([bogus], { page: ["read"] })).toBe(false)
    expect(hasPermission([], { page: ["read"] })).toBe(false)
  })

  it("denies empty requests and empty action lists", () => {
    expect(hasPermission(["owner"], {})).toBe(false)
    expect(hasPermission(["owner"], { page: [] })).toBe(false)
  })

  it("owner:manage is owner-only", () => {
    for (const role of ROLES)
      expect(hasPermission([role], { owner: ["manage"] })).toBe(
        role === "owner"
      )
  })

  it("customCode (read and update) is owner-only", () => {
    for (const role of ROLES) {
      expect(hasPermission([role], { customCode: ["read"] })).toBe(
        role === "owner"
      )
      expect(hasPermission([role], { customCode: ["update"] })).toBe(
        role === "owner"
      )
    }
  })
})

describe("parseRoles", () => {
  it("splits the comma-joined Better Auth role column", () => {
    expect(parseRoles("editor,author")).toEqual(["editor", "author"])
    expect(parseRoles(" owner , viewer ")).toEqual(["owner", "viewer"])
  })

  it("drops unknown names and duplicates; null/empty → []", () => {
    expect(parseRoles("user,admin,admin,superuser")).toEqual(["admin"])
    expect(parseRoles(null)).toEqual([])
    expect(parseRoles(undefined)).toEqual([])
    expect(parseRoles("")).toEqual([])
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm test:unit tests/unit/permissions.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/permissions"`.

- [ ] **Step 4: Implement `lib/auth/permissions.ts`**

`lib/auth/permissions.ts`:

```ts
import { createAccessControl } from "better-auth/plugins/access"

import { ROLES, type Role } from "./roles"

/** Every resource and action the platform authorises (spec §6.1). Isomorphic: safe in client code. */
export const statements = {
  page: ["read", "update", "publish"],
  service: ["read", "create", "update", "publish", "delete"],
  article: [
    "read",
    "create",
    "update",
    "publish",
    "delete",
    "submit",
    "updateAny",
    "deleteAny",
  ],
  collection: ["read", "create", "update", "delete"], // team, clients, group companies, categories
  media: ["read", "create", "update", "delete"],
  lead: ["read", "update", "delete", "export"],
  seo: ["read", "update"],
  redirect: ["read", "create", "update", "delete"],
  marketing: ["read", "update"], // consent + tracking
  customCode: ["read", "update"],
  settings: ["read", "update"], // content globals
  integration: ["read", "update", "test"],
  user: ["read", "invite", "update", "ban", "impersonate", "revokeSessions"],
  owner: ["manage"],
  audit: ["read"],
  ai: ["use"],
} as const

export type Resource = keyof typeof statements
export type PermissionRequest = {
  [R in Resource]?: (typeof statements)[R][number][]
}
type Grants = { [R in Resource]?: readonly (typeof statements)[R][number][] }

export const ac = createAccessControl(statements)

const all = <R extends Resource>(resource: R) => statements[resource]

const EVERYTHING = {
  page: all("page"),
  service: all("service"),
  article: all("article"),
  collection: all("collection"),
  media: all("media"),
  lead: all("lead"),
  seo: all("seo"),
  redirect: all("redirect"),
  marketing: all("marketing"),
  customCode: all("customCode"),
  settings: all("settings"),
  integration: all("integration"),
  user: all("user"),
  owner: all("owner"),
  audit: all("audit"),
  ai: all("ai"),
} satisfies Required<Grants>

/**
 * Spec §6.1 role matrix. `article:update/delete` without `updateAny/deleteAny`
 * means "own drafts only" (enforced by the articles service, Phase 5).
 * `settings:update` for editors is limited to content keys by the settings
 * service (Phase 4). `ai:use` is narrowed at runtime by
 * `integrations.ai.allowedRoles` (Phase 9).
 */
export const ROLE_GRANTS: Record<Role, Grants> = {
  owner: EVERYTHING,
  admin: {
    page: all("page"),
    service: all("service"),
    article: all("article"),
    collection: all("collection"),
    media: all("media"),
    lead: all("lead"),
    seo: all("seo"),
    redirect: all("redirect"),
    marketing: all("marketing"),
    settings: all("settings"),
    integration: all("integration"),
    user: all("user"),
    audit: all("audit"),
    ai: all("ai"),
  },
  editor: {
    page: all("page"),
    service: all("service"),
    article: all("article"),
    collection: all("collection"),
    media: all("media"),
    seo: all("seo"),
    settings: ["read", "update"],
    ai: ["use"],
  },
  author: {
    article: ["read", "create", "update", "delete", "submit"],
    media: ["read", "create"],
    ai: ["use"],
  },
  marketer: {
    seo: all("seo"),
    redirect: all("redirect"),
    marketing: all("marketing"),
    page: ["read"],
    service: ["read"],
    article: ["read"],
    media: ["read", "create"],
    ai: ["use"],
  },
  intake: {
    lead: ["read", "update", "export"],
    ai: ["use"],
  },
  viewer: {
    page: ["read"],
    service: ["read"],
    article: ["read"],
    collection: ["read"],
    media: ["read"],
    seo: ["read"],
    redirect: ["read"],
    marketing: ["read"],
    settings: ["read"],
  },
}

/** Better Auth access-control roles built from ROLE_GRANTS. */
export const roles = Object.fromEntries(
  ROLES.map((role) => [role, ac.newRole(ROLE_GRANTS[role])])
) as Record<Role, ReturnType<typeof ac.newRole>>

const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value)

/**
 * True when every requested action is granted by at least one of the roles
 * (union across roles). Unknown roles grant nothing; an empty request is denied.
 */
export function hasPermission(
  userRoles: readonly string[],
  req: PermissionRequest
): boolean {
  const entries = Object.entries(req) as [Resource, readonly string[]][]
  if (entries.length === 0) return false
  const known = userRoles.filter(isRole)
  return entries.every(
    ([resource, actions]) =>
      actions.length > 0 &&
      actions.every((action) =>
        known.some(
          (role) =>
            roles[role].authorize({ [resource]: [action] } as never).success
        )
      )
  )
}

/** Better Auth stores roles comma-joined in users.role. Unknown names are dropped. */
export function parseRoles(value: string | null | undefined): Role[] {
  if (!value) return []
  const out: Role[] = []
  for (const raw of value.split(",")) {
    const role = raw.trim()
    if (isRole(role) && !out.includes(role)) out.push(role)
  }
  return out
}
```

- [ ] **Step 5: Run tests, lint, typecheck**

Run: `pnpm test:unit tests/unit/permissions.test.ts`
Expected: PASS — 374 tests (1 coverage check + 7 roles × 52 actions + 1 sanity + 6 hasPermission + 2 parseRoles).

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/auth/permissions.ts tests/unit/permissions.test.ts
git commit -m "feat: add role permission matrix

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Auth schema + Better Auth config (master Task 2.2)

**Files:**
- Create: `lib/auth/password.ts`
- Create: `server/db/schema/auth.ts`
- Modify: `server/db/schema/index.ts`
- Create (generated): `server/db/migrations/0001_auth.sql`, `server/db/migrations/meta/0001_snapshot.json`, modify `server/db/migrations/meta/_journal.json`
- Create: `server/auth/auth.ts`
- Create: `server/auth/hooks.ts`
- Create: `server/auth/tokens.ts`
- Modify: `server/api/app.ts` (mount Better Auth at `/api/auth/*`)
- Create: `tests/integration/helpers/auth.ts`
- Test: `tests/integration/auth/auth.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `Db` (`server/db/client.ts`), `getEnv()` (`server/env.ts`), `id()`, `tsz()` (`server/db/schema/_shared.ts`), `hasPermission`, `ROLES`, `Role` (Task 1), `limitBody` (`server/api/middleware/body-limit.ts`), `createApp`/`app` (`server/api/app.ts`), `resetDb` (`tests/integration/db.ts`).
- Produces:

```ts
// lib/auth/password.ts
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
// server/db/schema/auth.ts — users (id, name, email, emailVerified, image, title, role, banned, banReason, banExpires, twoFactorEnabled, createdAt, updatedAt),
//   sessions (…, impersonatedBy), accounts, verifications, twoFactors (secret, backupCodes, verified, failedVerificationCount, lockedUntil), rateLimits
// server/auth/auth.ts
export const SESSION_EXPIRES_IN = 604800, IMPERSONATION_EXPIRES_IN = 3600, RESET_TOKEN_EXPIRES_IN = 3600
export function adminUrl(path: string, params?: Record<string, string>): string // absolute URL on BETTER_AUTH_URL
export type Auth
export function getAuth(): Auth // lazy; memoised per (db pool, secret, url, NODE_ENV)
// server/auth/hooks.ts
export function securityHooks(): BetterAuthPlugin // id "sp-security"; closes /api/auth/admin/* over HTTP
// server/auth/tokens.ts
export const INVITE_TOKEN_EXPIRES_IN = 604800, RECOVERY_TOKEN_EXPIRES_IN = 86400
export async function createPasswordToken(userId: string, expiresInSeconds: number): Promise<string>
export function passwordUrl(page: "set-password" | "reset-password", token: string): string // http(s)://…/admin/<page>?token=…
// tests/integration/helpers/auth.ts (tests only)
export const ORIGIN = "http://localhost:3000", TEST_PASSWORD
export async function createUser(opts: { roles: Role[]; email?; name?; password?: string | null }) // null → passwordless
export function cookiesFrom(res: Response): string; export function mergeCookies(cookie: string, res: Response): string; export function cookieNames(res: Response): string[]
export function authPost(path: string, body: unknown, cookie?: string): Promise<Response> // POST /api/auth<path>
export async function signIn(email: string, password?: string): Promise<string> // Cookie header
export async function signedInUser(roles: Role[]): Promise<{ user; cookie }>
export function adminRequest(path: string, opts?: { cookie?; method?; json? }): Promise<Response> // /api/v1/admin<path>, same-origin
```

- Better Auth endpoints live at `/api/auth/*` (Better Auth default `basePath`, mounted inside Hono). Sign-up is disabled (`disableSignUp`). Roles are stored comma-joined in `users.role` (admin plugin). Tokens for invites and admin-issued password links are ordinary Better Auth `reset-password:<token>` verification rows, consumed by `POST /api/auth/reset-password { token, newPassword }`, which also creates the credential account for passwordless users.

- [ ] **Step 1: Write the test helper and the failing test**

`tests/integration/helpers/auth.ts`:

```ts
import type { Role } from "@/lib/auth/roles"
import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"

/** Matches BETTER_AUTH_URL in tests/integration/setup.ts. */
export const ORIGIN = "http://localhost:3000"
export const TEST_PASSWORD = "correct-horse-battery-staple"

let counter = 0
const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${++counter}@example.test`

/** Creates a user through Better Auth's server API (no HTTP, no session needed). */
export async function createUser(opts: {
  roles: Role[]
  email?: string
  name?: string
  /** null → passwordless (invited) user */
  password?: string | null
}) {
  const email = opts.email ?? uniqueEmail(opts.roles.join("-") || "user")
  const { user } = await getAuth().api.createUser({
    body: {
      email,
      name: opts.name ?? email.split("@")[0],
      role: opts.roles,
      ...(opts.password === null
        ? {}
        : { password: opts.password ?? TEST_PASSWORD }),
    },
  })
  return user
}

/** `name=value; name2=value2` from a response's Set-Cookie headers (expired cookies skipped). */
export function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .filter((c) => !/max-age=0/i.test(c))
    .map((c) => c.split(";")[0])
    .join("; ")
}

/** Applies a response's Set-Cookie headers to an existing Cookie header (like a browser). */
export function mergeCookies(cookie: string, res: Response): string {
  const jar = new Map<string, string>()
  for (const pair of cookie.split(/;\s*/).filter(Boolean)) {
    const [name, ...value] = pair.split("=")
    jar.set(name, value.join("="))
  }
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(";")
    const [name, ...value] = pair.split("=")
    if (/max-age=0/i.test(header) || value.join("=") === "") jar.delete(name)
    else jar.set(name, value.join("="))
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

/** Cookie names set by a response, e.g. ["sp.session_token", "sp.session_data"]. */
export function cookieNames(res: Response): string[] {
  return res.headers.getSetCookie().map((c) => c.split("=")[0])
}

export function authPost(path: string, body: unknown, cookie?: string) {
  return app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

/** Signs in over HTTP and returns the Cookie header for later requests. */
export async function signIn(email: string, password = TEST_PASSWORD) {
  const res = await authPost("/sign-in/email", { email, password })
  if (res.status !== 200)
    throw new Error(`sign-in failed (${res.status}): ${await res.text()}`)
  return cookiesFrom(res)
}

export async function signedInUser(roles: Role[]) {
  const user = await createUser({ roles })
  const cookie = await signIn(user.email)
  return { user, cookie }
}

/** Request to the admin API as a signed-in user (same-origin, JSON). */
export function adminRequest(
  path: string,
  opts: { cookie?: string; method?: string; json?: unknown } = {}
) {
  const headers: Record<string, string> = { origin: ORIGIN }
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.json !== undefined) headers["content-type"] = "application/json"
  return app.request(`/api/v1/admin${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.json === undefined ? undefined : JSON.stringify(opts.json),
  })
}
```

`tests/integration/auth/auth.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { createPasswordToken } from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { accounts, sessions, users } from "@/server/db/schema"

import { resetDb } from "../db"
import {
  authPost,
  cookieNames,
  cookiesFrom,
  createUser,
  ORIGIN,
  TEST_PASSWORD,
} from "../helpers/auth"

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

beforeEach(async () => {
  await resetDb()
})

describe("Better Auth config (sp_test)", () => {
  it("auth.api.createUser without a password → users row with a uuid v7 id, roles comma-joined, no credential account", async () => {
    const user = await createUser({
      email: "Invitee@Example.test",
      roles: ["editor", "author"],
      password: null,
    })
    expect(user.id).toMatch(UUID_V7)
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id))
    expect(row.email).toBe("invitee@example.test")
    expect(row.role).toBe("editor,author")
    expect(row.banned).toBe(false)
    expect(row.twoFactorEnabled).toBe(false)
    expect(row.title).toBeNull()
    const accountRows = await getDb()
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user.id))
    expect(accountRows).toEqual([])
  })

  it("public sign-up is disabled (POST /api/auth/sign-up/email → 4xx, no user)", async () => {
    const res = await authPost("/sign-up/email", {
      email: "stranger@example.test",
      password: "a-long-enough-password",
      name: "Stranger",
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(await getDb().select().from(users)).toEqual([])
  })

  it("rejects passwords shorter than 12 characters, then signs in after a valid one is set", async () => {
    const user = await createUser({ roles: ["viewer"], password: null })
    const token = await createPasswordToken(user.id, 3600)

    const short = await authPost("/reset-password", {
      token,
      newPassword: "elevenchars",
    })
    expect(short.status).toBe(400)
    expect((await short.json()).code).toBe("PASSWORD_TOO_SHORT")

    const ok = await authPost("/reset-password", {
      token,
      newPassword: TEST_PASSWORD,
    })
    expect(ok.status).toBe(200)
    const credential = await getDb()
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user.id))
    expect(credential.map((a) => a.providerId)).toEqual(["credential"])
    expect(credential[0].id).toMatch(UUID_V7)

    // the token is single-use
    const reused = await authPost("/reset-password", {
      token,
      newPassword: "another-long-password",
    })
    expect(reused.status).toBe(400)

    const signIn = await authPost("/sign-in/email", {
      email: user.email,
      password: TEST_PASSWORD,
    })
    expect(signIn.status).toBe(200)
  })

  it("sessions last 7 days and cookies use the sp prefix", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const res = await authPost("/sign-in/email", {
      email: user.email,
      password: TEST_PASSWORD,
    })
    expect(res.status).toBe(200)
    const names = cookieNames(res)
    expect(names).toContain("sp.session_token")
    for (const name of names) expect(name).toMatch(/^(__Secure-)?sp\./)

    const [row] = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
    expect(row.id).toMatch(UUID_V7)
    const days = (row.expiresAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.99)
    expect(days).toBeLessThanOrEqual(7)

    const session = await getAuth().api.getSession({
      headers: new Headers({ cookie: cookiesFrom(res) }),
    })
    expect(session?.user.id).toBe(user.id)
  })

  it("wrong password → 401 and no session", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const res = await authPost("/sign-in/email", {
      email: user.email,
      password: "not-the-password-at-all",
    })
    expect(res.status).toBe(401)
    expect(await getDb().select().from(sessions)).toEqual([])
  })

  it("admin-plugin endpoints are closed over HTTP (server-side auth.api calls still work)", async () => {
    const res = await app.request("/api/auth/admin/list-users", {
      headers: { origin: ORIGIN },
    })
    expect(res.status).toBe(404)
    const created = await authPost("/admin/create-user", {
      email: "sneaky@example.test",
      name: "Sneaky",
      password: "a-long-enough-password",
    })
    expect(created.status).toBe(404)
    expect(await getDb().select().from(users)).toEqual([])
  })

  it("auth responses carry X-Robots-Tag: noindex", async () => {
    const res = await app.request("/api/auth/get-session")
    expect(res.status).toBe(200)
    expect(res.headers.get("x-robots-tag")).toBe("noindex")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:integration tests/integration/auth/auth.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/auth/auth"`.

- [ ] **Step 3: Password bounds, auth schema, migration**

`lib/auth/password.ts`:

```ts
/** Spec §6: passwords are at least 12 characters (Better Auth enforces both bounds). */
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
```

`server/db/schema/auth.ts`:

```ts
import "server-only"

import { relations } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"

import { id, tsz } from "./_shared"

// Better Auth tables (email+password, admin and twoFactor plugins, database
// rate limits). Shape follows `npx auth@1.7.10 generate` with three edits:
// ids are uuid v7 ($defaultFn: Better Auth omits ids on insert because of
// advanced.database.generateId "uuid"), timestamps are timestamptz, and
// users.title (byline role) is added. Export names are the plural model names
// Better Auth uses with drizzleAdapter({ usePlural: true }).

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  title: text("title"),
  // admin plugin: roles comma-joined ("editor,author")
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: tsz("ban_expires"),
  // twoFactor plugin
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: tsz("created_at").notNull().defaultNow(),
  updatedAt: tsz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    expiresAt: tsz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // admin plugin: set on impersonation sessions (the impersonator's user id)
    impersonatedBy: uuid("impersonated_by"),
    createdAt: tsz("created_at").notNull().defaultNow(),
    updatedAt: tsz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)]
)

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: tsz("access_token_expires_at"),
    refreshTokenExpiresAt: tsz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: tsz("created_at").notNull().defaultNow(),
    updatedAt: tsz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)]
)

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: tsz("expires_at").notNull(),
    createdAt: tsz("created_at").notNull().defaultNow(),
    updatedAt: tsz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)]
)

export const twoFactors = pgTable(
  "two_factors",
  {
    id: id(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: tsz("locked_until"),
  },
  (t) => [
    index("two_factors_secret_idx").on(t.secret),
    index("two_factors_user_id_idx").on(t.userId),
  ]
)

export const rateLimits = pgTable("rate_limits", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  twoFactors: many(twoFactors),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, { fields: [twoFactors.userId], references: [users.id] }),
}))
```

`server/db/schema/index.ts` (full file):

```ts
import "server-only"

// Every table/enum module is re-exported here; drizzle.config.ts and
// getDb() both read this file. Later phases append `export * from "./<module>"`.
export { contentStatus } from "./_shared"
export * from "./auth"
```

Run: `pnpm db:generate --name auth`
Expected: `[✓] Your SQL migration file ➜ server/db/migrations/0001_auth.sql` with exactly:

```sql
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"impersonated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"title" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factors_secret_idx" ON "two_factors" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factors_user_id_idx" ON "two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
```

Run: `pnpm db:migrate`
Expected: `[migrate] migrations applied`.

- [ ] **Step 4: Better Auth instance, hooks plugin, password tokens**

`server/auth/hooks.ts` (full file):

```ts
import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"

/**
 * Project hooks for Better Auth, packaged as a plugin so they run after the
 * twoFactor plugin's hooks (plugin hooks run in plugin order; options.hooks
 * would run first and see a sign-in that twoFactor later turns into a
 * challenge). Task 3 adds the audit hooks.
 */
export function securityHooks(): BetterAuthPlugin {
  return {
    id: "sp-security",
    hooks: {
      before: [
        {
          // Admin-plugin endpoints are server-only: user management goes
          // through /api/v1/admin/users (permission checks + audit). Direct
          // HTTP calls to /api/auth/admin/* are refused; auth.api.* calls
          // from our own services carry no `request` and pass.
          matcher: (ctx) => ctx.path?.startsWith("/admin/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.request) throw new APIError("NOT_FOUND")
          }),
        },
      ],
    },
  }
}
```

`server/auth/auth.ts` (full file):

```ts
import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"
import { createAccessControl } from "better-auth/plugins/access"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { hasPermission } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"
import { type Db, getDb } from "@/server/db/client"
import * as schema from "@/server/db/schema"
import { getEnv } from "@/server/env"

import { securityHooks } from "./hooks"

export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days (spec §6)
export const IMPERSONATION_EXPIRES_IN = 60 * 60 // 1 hour
export const RESET_TOKEN_EXPIRES_IN = 60 * 60 // forgot-password links: 1 hour

/** Absolute URL of an admin page on the public origin (BETTER_AUTH_URL). */
export function adminUrl(
  path: string,
  params: Record<string, string> = {}
): string {
  const url = new URL(path, getEnv().BETTER_AUTH_URL)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  return url.toString()
}

/**
 * The admin plugin only needs to know who may impersonate whom; every other
 * admin-plugin endpoint is closed over HTTP (see hooks.ts) and our users
 * service authorises with lib/auth/permissions.ts. Derived from the app
 * matrix: `user:impersonate` → "impersonate"; `owner:manage` →
 * "impersonate-admins" (adminRoles = owner, so only owners impersonate owners).
 */
const pluginAc = createAccessControl({
  user: ["impersonate", "impersonate-admins"],
} as const)

function pluginRole(role: Role) {
  const actions: ("impersonate" | "impersonate-admins")[] = []
  if (hasPermission([role], { user: ["impersonate"] }))
    actions.push("impersonate")
  if (hasPermission([role], { owner: ["manage"] }))
    actions.push("impersonate-admins")
  return pluginAc.newRole({ user: actions })
}

const pluginRoles = Object.fromEntries(
  ROLES.map((role) => [role, pluginRole(role)])
) as Record<Role, ReturnType<typeof pluginRole>>

function createAuth(db: Db) {
  const env = getEnv()
  const origin = new URL(env.BETTER_AUTH_URL).origin
  return betterAuth({
    appName: "Security Partners",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    user: {
      additionalFields: {
        title: { type: "string", required: false, input: true },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_EXPIRES_IN,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      // Spec §6: production only, stored in Postgres (rate_limits).
      enabled: env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: "sp",
      // "__Secure-" cookies whenever the public origin is https (production).
      useSecureCookies: origin.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
      database: { generateId: "uuid" },
    },
    plugins: [
      admin({
        ac: pluginAc,
        roles: pluginRoles,
        defaultRole: "viewer",
        adminRoles: ["owner"],
        impersonationSessionDuration: IMPERSONATION_EXPIRES_IN,
        bannedUserMessage: "This account is suspended.",
      }),
      twoFactor({
        issuer: "Security Partners",
        backupCodeOptions: { amount: 10, length: 10 },
      }),
      securityHooks(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

let cached: { db: Db; signature: string; auth: Auth } | undefined

/**
 * Lazy, memoised Better Auth instance. Never call at module scope: `next
 * build` has no env. Rebuilt when the DB pool or the auth env changes (tests).
 */
export function getAuth(): Auth {
  const db = getDb()
  const env = getEnv()
  const signature = `${env.BETTER_AUTH_SECRET}\u0000${env.BETTER_AUTH_URL}\u0000${env.NODE_ENV}`
  if (cached?.db === db && cached.signature === signature) return cached.auth
  const auth = createAuth(db)
  cached = { db, signature, auth }
  return auth
}
```

`server/auth/tokens.ts`:

```ts
import "server-only"

import { randomBytes } from "node:crypto"

import { adminUrl, getAuth } from "./auth"

export const INVITE_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days
export const RECOVERY_TOKEN_EXPIRES_IN = 60 * 60 * 24 // 24 hours

/**
 * Creates a Better Auth password-reset token for `userId` (the same
 * `reset-password:<token>` verification row that /request-password-reset
 * writes), so POST /api/auth/reset-password { token, newPassword } sets the
 * password and creates the credential account for passwordless users.
 */
export async function createPasswordToken(
  userId: string,
  expiresInSeconds: number
): Promise<string> {
  const ctx = await getAuth().$context
  const token = randomBytes(24).toString("base64url")
  await ctx.internalAdapter.createVerificationValue({
    value: userId,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  })
  return token
}

/** Absolute admin URL that lets the holder of `token` choose a password. */
export function passwordUrl(
  page: "set-password" | "reset-password",
  token: string
): string {
  return adminUrl(`/admin/${page}`, { token })
}
```

Notes for the reviewer: `drizzleAdapter` receives `schema` (runtime schema validation is on by default in 1.7 and fails every request without it); Better Auth omits ids on insert because of `generateId: "uuid"`, so Drizzle's `$defaultFn(uuidv7)` fills them; the `pluginAc` gives the admin plugin only the impersonation rules (owners only impersonate owners via `adminRoles: ["owner"]` + `impersonate-admins`).

- [ ] **Step 5: Mount Better Auth in Hono**

`server/api/app.ts` (full file):

```ts
import "server-only"

import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"

import type { AppEnv } from "@/server/api/context"
import { limitBody } from "@/server/api/middleware/body-limit"
import { notFoundHandler, onError } from "@/server/api/middleware/error"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import { getAuth } from "@/server/auth/auth"
import { healthRoutes } from "@/server/modules/health/routes"

/**
 * Admin API routes, chained so `hc<AdminApi>` sees every route type.
 * Later phases add `.route("/<resource>", <resource>Routes)` here.
 */
export const adminRoutes = new Hono<AppEnv>()
export type AdminApi = typeof adminRoutes

/** Builds the API. Mount order follows spec §7; Phase 2 adds Better Auth + session middleware. */
export function createApp() {
  const api = new Hono<AppEnv>().basePath("/api")

  // 1. Global
  api.use("*", requestIdMiddleware)
  api.use("*", secureHeaders())
  api.use("*", async (c, next) => {
    c.set("actor", null)
    await next()
    c.header("X-Robots-Tag", "noindex")
  })
  api.onError(onError)
  api.notFound(notFoundHandler)

  // 2. Better Auth (sign-in, sign-out, password reset, two-factor)
  api.on(["GET", "POST"], "/auth/*", limitBody("public"), (c) =>
    getAuth().handler(c.req.raw)
  )

  // 3. Public endpoints (rate limit added in Phase 7)
  api.use("/v1/public/*", limitBody("public"))

  // 4. Admin endpoints (session + signedIn inserted before sameOrigin in Task 3)
  api.use("/v1/admin/*", sameOrigin(), limitBody("admin"))
  api.route("/v1/admin", adminRoutes)

  // 5. Health
  api.route("/v1/health", healthRoutes)

  return api
}

export const app = createApp()
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test:integration tests/integration/auth/auth.test.ts`
Expected: PASS — 7 tests.

Run: `pnpm test`
Expected: PASS (all unit + integration files; the server-only guard now also lists `server/auth/*.ts` and `server/db/schema/auth.ts`).

- [ ] **Step 7: Build without env, lint, typecheck**

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm lint && pnpm typecheck`
Expected: all exit 0 (`getAuth()` is never called at import time).

- [ ] **Step 8: Commit**

```bash
git add lib/auth/password.ts server/db/schema server/db/migrations server/auth server/api/app.ts tests/integration/helpers/auth.ts tests/integration/auth/auth.test.ts
git commit -m "feat: add better auth with drizzle schema and uuid v7 ids

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Audit log + session DAL + Hono auth middleware (master Task 2.3)

**Files:**
- Create: `server/db/schema/audit.ts`
- Modify: `server/db/schema/index.ts`
- Create (generated): `server/db/migrations/0002_audit.sql` (+ `meta/0002_snapshot.json`, `_journal.json`)
- Create: `server/lib/audit.ts`, `server/lib/ip.ts`
- Create: `server/auth/session.ts`
- Modify: `server/auth/hooks.ts` (audit hooks, forced revoke on password change, sign-out audit)
- Modify: `server/auth/auth.ts` (`onPasswordReset` audit)
- Create: `server/api/middleware/auth.ts`
- Modify: `server/api/app.ts` (session → signedIn → sameOrigin; `/audit` routes)
- Create: `lib/schemas/api/list.ts`, `lib/schemas/api/audit.ts`
- Create: `server/modules/audit/repo.ts`, `server/modules/audit/service.ts`, `server/modules/audit/routes.ts`
- Modify: `tests/unit/api/error-envelope.test.ts` (Phase 1 file)
- Test: `tests/unit/ip.test.ts`, `tests/unit/auth/session-dal.test.ts`, `tests/integration/api/auth-middleware.test.ts`, `tests/integration/auth/audit-hooks.test.ts`, `tests/integration/api/audit.test.ts`

**Interfaces:**
- Consumes: Task 2 (`getAuth`, `securityHooks`, schema, helpers), `Actor` (`server/lib/actor.ts`), `AppError`, `forbidden` (`server/lib/errors.ts`), `zv` (`server/api/validate.ts`), `AppEnv` (`server/api/context.ts`), `hasPermission`, `parseRoles`, `PermissionRequest` (Task 1).
- Produces:

```ts
// server/lib/audit.ts
export type AuditEntry = { action: string; entityType?: string; entityId?: string; diff?: unknown; ip?: string | null; userAgent?: string | null }
export async function writeAudit(db: DbOrTx, actor: Actor | null, entry: AuditEntry): Promise<void>
// server/lib/ip.ts
export function clientIp(headers: Headers): string | null // first X-Forwarded-For value, else X-Real-IP, else null
// server/auth/session.ts (DAL)
export type SessionUser = { id; name; email; title: string | null; twoFactorEnabled: boolean }
export type SessionContext = { actor: Actor; user: SessionUser; session: { id: string; expiresAt: Date; impersonatedBy: string | null } }
export async function sessionFromHeaders(headers: Headers): Promise<SessionContext | null> // fresh DB read; banned → null; no cookie → null without DB
export async function getSessionContext(): Promise<SessionContext | null>
export async function getActor(): Promise<Actor | null>
export async function requireSession(): Promise<SessionContext> // redirect("/admin/sign-in")
export async function requireActor(): Promise<Actor>             // redirect("/admin/sign-in")
export async function requirePermission(req: PermissionRequest): Promise<Actor> // forbidden()
// server/api/middleware/auth.ts
export const sessionMiddleware, requireSignedIn // 401 UNAUTHENTICATED "Sign in to continue"
export const can: (req: PermissionRequest) => MiddlewareHandler<AppEnv> // 401 / 403
export function actorOf(c: Context<AppEnv>): Actor
// server/auth/hooks.ts (in addition to Task 2)
export function actorFor(user: { id: string; role?: string | null }, headers: Headers | undefined, impersonatedBy?: string | null): Actor
export async function auditAuthEvent(actor: Actor | null, entry: AuditEntry): Promise<void> // never throws
// lib/schemas/api/list.ts
export const PAGE_SIZE_DEFAULT = 20, PAGE_SIZE_MAX = 100
export type Sort<F>, SortDir, Paginated<T> = { items: T[]; page; pageSize; total }
export function sortParam(fields, fallback) // "?sort=field:dir" → { field, dir }
export const listQuery // page, pageSize, q
// lib/schemas/api/audit.ts
export const auditListQuery; export type AuditListQuery
// server/modules/audit/service.ts
export type AuditItem = { id; action; entityType; entityId; actor: { id; name; email } | null; impersonatorId; ip; userAgent; diff; createdAt: string }
export async function listAuditLog(actor: Actor, query: AuditListQuery): Promise<Paginated<AuditItem>>
// server/modules/audit/routes.ts
export const auditRoutes // GET / → can({ audit: ["read"] }) → ?page&pageSize&sort=createdAt|action:dir&q&actor&action&entityType&from&to
```

- Audit actions written in this task: `auth.sign_in` (`diff.method`: `password` | `totp` | `backup_code`), `auth.sign_in_failed` (no actor; `entityId` = the account when the email exists; `diff: { method, email, reason }`), `auth.sign_out`, `auth.password_change`, `auth.password_reset`, `auth.2fa_enable`, `auth.2fa_disable`.
- Mount order in `createApp()` after this task: global (requestId → secureHeaders → actor=null + X-Robots-Tag) → `/api/auth/*` (64 KB, Better Auth) → `/v1/public/*` (64 KB) → `/v1/admin/*`: `sessionMiddleware` → `requireSignedIn` → `sameOrigin()` → 1 MB → `adminRoutes` (`/audit`) → `/v1/health`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/ip.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { clientIp } from "@/server/lib/ip"

describe("clientIp (spec §4)", () => {
  it("uses the first X-Forwarded-For value", () => {
    expect(
      clientIp(new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.2" }))
    ).toBe("203.0.113.7")
  })

  it("falls back to X-Real-IP, then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe(
      "198.51.100.1"
    )
    expect(clientIp(new Headers({ "x-forwarded-for": "" }))).toBeNull()
    expect(clientIp(new Headers())).toBeNull()
  })
})
```

`tests/unit/auth/session-dal.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  cookie: "" as string,
  session: null as unknown,
  getSession: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      cookie: state.cookie,
      "x-forwarded-for": "203.0.113.9",
      "user-agent": "dal-test",
    }),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  },
  forbidden: () => {
    throw new Error("NEXT_FORBIDDEN")
  },
}))

vi.mock("@/server/auth/auth", () => ({
  getAuth: () => ({ api: { getSession: state.getSession } }),
}))

import {
  getActor,
  requireActor,
  requirePermission,
} from "@/server/auth/session"

const USER_ID = "0190a6e0-0000-7000-8000-0000000000aa"

function sessionFor(user: Record<string, unknown>, impersonatedBy?: string) {
  return {
    user: {
      id: USER_ID,
      name: "Test",
      email: "t@example.test",
      title: null,
      twoFactorEnabled: false,
      banned: false,
      banExpires: null,
      role: "viewer",
      ...user,
    },
    session: {
      id: "0190a6e0-0000-7000-8000-0000000000bb",
      expiresAt: new Date(Date.now() + 3_600_000),
      impersonatedBy: impersonatedBy ?? null,
    },
  }
}

beforeEach(() => {
  state.cookie = "sp.session_token=abc.def"
  state.session = null
  state.getSession.mockReset()
  state.getSession.mockImplementation(async () => state.session)
})

describe("session DAL", () => {
  it("returns null without a session cookie and never calls Better Auth", async () => {
    state.cookie = ""
    expect(await getActor()).toBeNull()
    expect(state.getSession).not.toHaveBeenCalled()
  })

  it("reads the session fresh (cookie cache disabled) and builds the actor", async () => {
    state.session = sessionFor(
      { role: "editor,author,bogus" },
      "0190a6e0-0000-7000-8000-0000000000cc"
    )
    expect(await getActor()).toEqual({
      userId: USER_ID,
      roles: ["editor", "author"],
      ip: "203.0.113.9",
      userAgent: "dal-test",
      impersonatorId: "0190a6e0-0000-7000-8000-0000000000cc",
    })
    expect(state.getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableCookieCache: true } })
    )
  })

  it("accepts the __Secure- cookie name used over https", async () => {
    state.cookie = "__Secure-sp.session_token=abc.def"
    state.session = sessionFor({})
    expect((await getActor())?.userId).toBe(USER_ID)
  })

  it("treats a banned user as signed out (until the ban expires)", async () => {
    state.session = sessionFor({ banned: true })
    expect(await getActor()).toBeNull()
    state.session = sessionFor({
      banned: true,
      banExpires: new Date(Date.now() - 1000),
    })
    expect(await getActor()).not.toBeNull()
  })

  it("requireActor redirects to /admin/sign-in without a session", async () => {
    await expect(requireActor()).rejects.toThrow("NEXT_REDIRECT /admin/sign-in")
  })

  it("requirePermission → forbidden() when the roles lack the permission", async () => {
    state.session = sessionFor({ role: "editor" })
    await expect(requirePermission({ lead: ["read"] })).rejects.toThrow(
      "NEXT_FORBIDDEN"
    )
    state.session = sessionFor({ role: "intake" })
    expect((await requirePermission({ lead: ["read"] })).roles).toEqual([
      "intake",
    ])
  })
})
```

`tests/integration/api/auth-middleware.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { createApp } from "@/server/api/app"
import { actorOf, can } from "@/server/api/middleware/auth"
import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import { resetDb } from "../db"
import { ORIGIN, signedInUser } from "../helpers/auth"

// Private app instance with test-only routes behind the real admin middleware.
const app = createApp()
app.get("/v1/admin/__test/leads", can({ lead: ["read"] }), (c) =>
  c.json({ ok: true })
)
app.get("/v1/admin/__test/me", (c) => c.json(actorOf(c)))
app.post("/v1/admin/__test/echo", (c) => c.json({ ok: true }))

const get = (path: string, cookie?: string) =>
  app.request(`/api/v1/admin/__test${path}`, {
    headers: cookie ? { cookie } : {},
  })

beforeEach(async () => {
  await resetDb()
})

describe("admin auth middleware", () => {
  it('can({ lead: ["read"] }) → 401 without a session', async () => {
    const res = await get("/leads")
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED")
  })

  it('can({ lead: ["read"] }) → 403 for an editor', async () => {
    const { cookie } = await signedInUser(["editor"])
    const res = await get("/leads", cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("FORBIDDEN")
  })

  it('can({ lead: ["read"] }) → 200 for intake', async () => {
    const { cookie } = await signedInUser(["intake"])
    const res = await get("/leads", cookie)
    expect(res.status).toBe(200)
  })

  it("resolves the actor (roles parsed, ip from X-Forwarded-For, user agent)", async () => {
    const { user, cookie } = await signedInUser(["editor", "author"])
    const res = await app.request("/api/v1/admin/__test/me", {
      headers: {
        cookie,
        "x-forwarded-for": "203.0.113.7, 10.0.0.2",
        "user-agent": "vitest-agent",
      },
    })
    expect(await res.json()).toEqual({
      userId: user.id,
      roles: ["editor", "author"],
      ip: "203.0.113.7",
      userAgent: "vitest-agent",
      impersonatorId: null,
    })
  })

  it("a banned user gets 401 on the very next request (no cookie-cache lag)", async () => {
    const { user, cookie } = await signedInUser(["viewer"])
    expect((await get("/me", cookie)).status).toBe(200)
    // Ban directly in the DB without touching sessions: the session cookie
    // (and its 5-minute cookie cache) are still valid, the user is not.
    await getDb()
      .update(users)
      .set({ banned: true, banReason: "test" })
      .where(eq(users.id, user.id))
    expect((await get("/me", cookie)).status).toBe(401)
  })

  it("an expired ban no longer blocks", async () => {
    const { user, cookie } = await signedInUser(["viewer"])
    await getDb()
      .update(users)
      .set({ banned: true, banExpires: new Date(Date.now() - 1000) })
      .where(eq(users.id, user.id))
    expect((await get("/me", cookie)).status).toBe(200)
  })

  it("a revoked session gets 401 on the next request", async () => {
    const { cookie } = await signedInUser(["viewer"])
    const signOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, origin: ORIGIN },
    })
    expect(signOut.status).toBe(200)
    expect((await get("/me", cookie)).status).toBe(401)
  })

  it("session check runs before sameOrigin: unauthenticated cross-site POST → 401, signed-in cross-site POST → 403", async () => {
    const anonymous = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    })
    expect(anonymous.status).toBe(401)
    const { cookie } = await signedInUser(["viewer"])
    const crossSite = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers: { cookie, origin: "https://evil.example" },
    })
    expect(crossSite.status).toBe(403)
    const sameSite = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers: { cookie, origin: ORIGIN },
    })
    expect(sameSite.status).toBe(200)
  })
})
```

`tests/integration/auth/audit-hooks.test.ts`:

```ts
import { asc } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { createPasswordToken } from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { auditLog } from "@/server/db/schema"

import { resetDb } from "../db"
import {
  authPost,
  cookiesFrom,
  createUser,
  ORIGIN,
  signIn,
  TEST_PASSWORD,
} from "../helpers/auth"

const auditRows = () =>
  getDb()
    .select()
    .from(auditLog)
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id))

beforeEach(async () => {
  await resetDb()
})

describe("Better Auth hooks write audit rows", () => {
  it("successful sign-in → auth.sign_in with actor, ip and user agent", async () => {
    const user = await createUser({ roles: ["editor"] })
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-forwarded-for": "198.51.100.4",
        "user-agent": "audit-test",
      },
      body: JSON.stringify({ email: user.email, password: TEST_PASSWORD }),
    })
    expect(res.status).toBe(200)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in",
      actorId: user.id,
      entityType: "user",
      entityId: user.id,
      ip: "198.51.100.4",
      userAgent: "audit-test",
      diff: { method: "password" },
    })
  })

  it("failed sign-in → auth.sign_in_failed without actor, naming the account", async () => {
    const user = await createUser({ roles: ["editor"] })
    const res = await authPost("/sign-in/email", {
      email: user.email.toUpperCase(),
      password: "definitely-wrong-password",
    })
    expect(res.status).toBe(401)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in_failed",
      actorId: null,
      entityType: "user",
      entityId: user.id,
      diff: { method: "password", email: user.email },
    })
  })

  it("failed sign-in for an unknown email still records the attempt", async () => {
    await authPost("/sign-in/email", {
      email: "nobody@example.test",
      password: "definitely-wrong-password",
    })
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in_failed",
      entityId: null,
      diff: { email: "nobody@example.test" },
    })
  })

  it("sign-out → auth.sign_out", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const cookie = await signIn(user.email)
    const res = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, origin: ORIGIN },
    })
    expect(res.status).toBe(200)
    const actions = (await auditRows()).map((r) => [r.action, r.actorId])
    expect(actions).toEqual([
      ["auth.sign_in", user.id],
      ["auth.sign_out", user.id],
    ])
  })

  it("password change → auth.password_change and always revokes other sessions", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const laptop = await signIn(user.email)
    const phone = await signIn(user.email)
    const res = await authPost(
      "/change-password",
      {
        currentPassword: TEST_PASSWORD,
        newPassword: "a-brand-new-password",
        revokeOtherSessions: false, // ignored: forced to true by a before hook
      },
      laptop
    )
    expect(res.status).toBe(200)
    const current = cookiesFrom(res) || laptop
    const session = (cookie: string) =>
      app.request("/api/auth/get-session?disableCookieCache=true", {
        headers: { cookie },
      })
    expect(await (await session(phone)).json()).toBeNull()
    expect((await (await session(current)).json())?.user.id).toBe(user.id)
    expect((await auditRows()).map((r) => r.action)).toContain(
      "auth.password_change"
    )
  })

  it("password reset by token → auth.password_reset", async () => {
    const user = await createUser({ roles: ["viewer"], password: null })
    const token = await createPasswordToken(user.id, 600)
    const res = await authPost("/reset-password", {
      token,
      newPassword: TEST_PASSWORD,
    })
    expect(res.status).toBe(200)
    const rows = await auditRows()
    expect(rows.map((r) => [r.action, r.actorId])).toEqual([
      ["auth.password_reset", user.id],
    ])
  })
})
```

`tests/integration/api/audit.test.ts`:

```ts
import { sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { writeAudit } from "@/server/lib/audit"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type Item = {
  action: string
  entityType: string | null
  entityId: string | null
  actor: { id: string; email: string | null } | null
  createdAt: string
}

const list = async (cookie: string, query = "") => {
  const res = await adminRequest(`/audit${query}`, { cookie })
  return { res, body: res.status === 200 ? await res.json() : null }
}

beforeEach(async () => {
  await resetDb()
})

/** Seeds 25 rows across two actors, three actions and known timestamps. */
async function seed() {
  const admin = await signedInUser(["admin"])
  const editor = await signedInUser(["editor"])
  // drop the sign-in rows so counts below are exact
  await resetAuditOnly()
  const db = getDb()
  const actorOf = (u: { id: string }) => ({
    userId: u.id,
    roles: [],
    ip: "192.0.2.1",
    userAgent: "seed",
    impersonatorId: null,
  })
  for (let i = 0; i < 25; i++) {
    const who = i % 5 === 0 ? editor.user : admin.user
    await writeAudit(db, actorOf(who), {
      action: i % 2 === 0 ? "page.publish" : "user.ban",
      entityType: i % 2 === 0 ? "page" : "user",
      entityId: i % 2 === 0 ? `page-${i}` : who.id,
      diff: { i },
    })
  }
  return { admin, editor }
}

async function resetAuditOnly() {
  await getDb().execute(sql`truncate table audit_log`)
}

describe("GET /api/v1/admin/audit", () => {
  it("requires audit:read (editor → 403, viewer → 403, no session → 401)", async () => {
    const editor = await signedInUser(["editor"])
    const viewer = await signedInUser(["viewer"])
    expect((await list(editor.cookie)).res.status).toBe(403)
    expect((await list(viewer.cookie)).res.status).toBe(403)
    expect((await adminRequest("/audit")).status).toBe(401)
  })

  it("paginates newest first with the list envelope", async () => {
    const { admin } = await seed()
    const first = await list(admin.cookie, "?pageSize=10")
    expect(first.res.status).toBe(200)
    expect(first.body).toMatchObject({ page: 1, pageSize: 10, total: 25 })
    expect(first.body.items).toHaveLength(10)
    expect(first.body.items[0].diff).toEqual({ i: 24 })
    const third = await list(admin.cookie, "?pageSize=10&page=3")
    expect(third.body.items).toHaveLength(5)
    expect(third.body.items.at(-1).diff).toEqual({ i: 0 })
    const items = first.body.items as Item[]
    const times = items.map((i) => Date.parse(i.createdAt))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it("defaults to pageSize 20 and rejects pageSize > 100", async () => {
    const { admin } = await seed()
    const page = await list(admin.cookie)
    expect(page.body.pageSize).toBe(20)
    expect(page.body.items).toHaveLength(20)
    const tooBig = await list(admin.cookie, "?pageSize=101")
    expect(tooBig.res.status).toBe(422)
  })

  it("filters by actor, action and entityType", async () => {
    const { admin, editor } = await seed()
    const byEditor = await list(admin.cookie, `?actor=${editor.user.id}`)
    expect(byEditor.body.total).toBe(5)
    for (const item of byEditor.body.items as Item[])
      expect(item.actor?.id).toBe(editor.user.id)
    expect((byEditor.body.items as Item[])[0].actor?.email).toBe(
      editor.user.email
    )

    const bans = await list(admin.cookie, "?action=user.ban")
    expect(bans.body.total).toBe(12)
    const pages = await list(admin.cookie, "?entityType=page")
    expect(pages.body.total).toBe(13)
    const both = await list(
      admin.cookie,
      `?entityType=page&actor=${editor.user.id}`
    )
    expect(both.body.total).toBe(3) // i = 0, 10, 20
  })

  it("filters by from/to (inclusive) and searches with q", async () => {
    const { admin } = await seed()
    const all = (await list(admin.cookie, "?pageSize=100&sort=createdAt:asc"))
      .body.items as Item[]
    // API dates have millisecond precision, Postgres stores microseconds:
    // widen `to` by 1 ms so row 9 itself is inside the window.
    const from = all[5].createdAt
    const to = new Date(Date.parse(all[9].createdAt) + 1).toISOString()
    const window = await list(
      admin.cookie,
      `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=100`
    )
    expect(window.body.total).toBeGreaterThanOrEqual(5)
    for (const item of window.body.items as Item[]) {
      expect(Date.parse(item.createdAt)).toBeGreaterThanOrEqual(
        Date.parse(from)
      )
      expect(Date.parse(item.createdAt)).toBeLessThanOrEqual(Date.parse(to))
    }
    const search = await list(admin.cookie, "?q=page-1")
    // page-10, page-12, page-14, page-16, page-18 (odd i are user.ban rows)
    expect(search.body.total).toBe(5)
  })

  it("sorts by action and rejects unknown sort fields or bad dates", async () => {
    const { admin } = await seed()
    const sorted = await list(admin.cookie, "?sort=action:asc&pageSize=100")
    const actions = (sorted.body.items as Item[]).map((i) => i.action)
    expect(actions).toEqual([...actions].sort())
    expect((await list(admin.cookie, "?sort=ip:asc")).res.status).toBe(422)
    expect((await list(admin.cookie, "?from=yesterday")).res.status).toBe(422)
    expect((await list(admin.cookie, "?actor=not-a-uuid")).res.status).toBe(422)
  })
})
```

Update the Phase 1 envelope test (`tests/unit/api/error-envelope.test.ts`) with these exact edits:

1. After the line `import { AppError, conflict } from "@/server/lib/errors"` insert:

```ts

// Since Phase 2, /api/v1/admin/* runs the session middleware first. These
// tests cover the envelope, sameOrigin and body limits only, so the session
// lookup is stubbed: a request carrying UNIT_COOKIE is a signed-in owner.
vi.mock("@/server/auth/session", () => ({
  sessionFromHeaders: async (headers: Headers) =>
    headers.get("cookie")?.includes("sp.session_token=unit-test")
      ? {
          actor: {
            userId: "0190a6e0-0000-7000-8000-000000000001",
            roles: ["owner"],
            ip: null,
            userAgent: null,
            impersonatorId: null,
          },
        }
      : null,
}))
const UNIT_COOKIE = "sp.session_token=unit-test"
```

2. In `describe("body limits")`, replace `const headers = { origin: ORIGIN }` with `const headers = { origin: ORIGIN, cookie: UNIT_COOKIE }`.
3. In `describe("sameOrigin on /api/v1/admin/*")`, in the `post` helper replace the line `      headers,` with `      headers: { cookie: UNIT_COOKIE, ...headers },`.
4. In the test `"lets safe methods through"`, replace `headers: { origin: "https://evil.example" },` with `headers: { origin: "https://evil.example", cookie: UNIT_COOKIE },`.
5. After that test (still inside the same `describe`), add:

```ts

  it("runs after the session check: no session → 401 even from the app origin", async () => {
    const res = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers: { origin: ORIGIN },
      body: "x",
    })
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED")
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:unit tests/unit/ip.test.ts tests/unit/auth/session-dal.test.ts tests/unit/api/error-envelope.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/ip"` and `"@/server/auth/session"`; in `error-envelope.test.ts` only the new test fails (`expected 200 to be 401`).

Run: `pnpm test:integration tests/integration/api/auth-middleware.test.ts tests/integration/auth/audit-hooks.test.ts tests/integration/api/audit.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/api/middleware/auth"` (auth-middleware), `Failed to resolve import "@/server/lib/audit"` (audit), and in audit-hooks `auditLog` is undefined (`Cannot read properties of undefined`).

- [ ] **Step 3: Audit table + migration**

`server/db/schema/audit.ts`:

```ts
import "server-only"

import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { id, tsz } from "./_shared"
import { users } from "./auth"

/** Append-only audit trail (spec §5.5, §6). Rows are never updated. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    impersonatorId: uuid("impersonator_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    diff: jsonb("diff"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_at_idx").on(t.createdAt),
    index("audit_log_actor_id_idx").on(t.actorId),
    index("audit_log_action_idx").on(t.action),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
  ]
)
```

`server/db/schema/index.ts` (full file):

```ts
import "server-only"

// Every table/enum module is re-exported here; drizzle.config.ts and
// getDb() both read this file. Later phases append `export * from "./<module>"`.
export { contentStatus } from "./_shared"
export * from "./auth"
export * from "./audit"
```

Run: `pnpm db:generate --name audit`
Expected: `server/db/migrations/0002_audit.sql` with exactly:

```sql
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"impersonator_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"ip" text,
	"user_agent" text,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_impersonator_id_users_id_fk" FOREIGN KEY ("impersonator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");
```

Run: `pnpm db:migrate`
Expected: `[migrate] migrations applied`.

- [ ] **Step 4: Audit writer, client IP, list schemas, audit module**

`server/lib/ip.ts`:

```ts
import "server-only"

/**
 * Client IP per spec §4: first value of X-Forwarded-For (Traefik), fallback
 * X-Real-IP, else null. Values are stored in the audit log, never logged.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  return headers.get("x-real-ip")?.trim() || null
}
```

`server/modules/audit/repo.ts`:

```ts
import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm"

import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { auditLog, users } from "@/server/db/schema"

export type NewAuditRow = typeof auditLog.$inferInsert

export async function insertAudit(db: DbOrTx, row: NewAuditRow): Promise<void> {
  await db.insert(auditLog).values(row)
}

export type AuditFilters = {
  actorId?: string
  action?: string
  entityType?: string
  from?: Date
  to?: Date
  q?: string
}

export type AuditSortField = "createdAt" | "action"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

function whereFor(filters: AuditFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    filters.actorId ? eq(auditLog.actorId, filters.actorId) : undefined,
    filters.action ? eq(auditLog.action, filters.action) : undefined,
    filters.entityType
      ? eq(auditLog.entityType, filters.entityType)
      : undefined,
    filters.from ? gte(auditLog.createdAt, filters.from) : undefined,
    filters.to ? lte(auditLog.createdAt, filters.to) : undefined,
  ]
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`
    conditions.push(
      or(
        ilike(auditLog.action, pattern),
        ilike(auditLog.entityType, pattern),
        ilike(auditLog.entityId, pattern),
        ilike(users.email, pattern)
      )
    )
  }
  return and(...conditions)
}

export async function listAudit(
  db: DbOrTx,
  opts: {
    filters: AuditFilters
    sort: Sort<AuditSortField>
    page: number
    pageSize: number
  }
) {
  const where = whereFor(opts.filters)
  const [{ total }] = await db
    .select({ total: count() })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(where)
  const column =
    opts.sort.field === "action" ? auditLog.action : auditLog.createdAt
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      actorId: auditLog.actorId,
      actorName: users.name,
      actorEmail: users.email,
      impersonatorId: auditLog.impersonatorId,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      diff: auditLog.diff,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      // uuid v7 ids are time-ordered: stable tiebreak for equal timestamps
      desc(auditLog.id)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}
```

`server/lib/audit.ts`:

```ts
import "server-only"

import type { DbOrTx } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { insertAudit } from "@/server/modules/audit/repo"

export type AuditEntry = {
  action: string
  entityType?: string
  entityId?: string
  diff?: unknown
  /** Request origin when there is no actor (failed sign-in, password reset by token). */
  ip?: string | null
  userAgent?: string | null
}

/**
 * Appends one audit row. Pass the transaction (`tx`) when the audited change
 * runs in one, so the row commits or rolls back with it.
 */
export async function writeAudit(
  db: DbOrTx,
  actor: Actor | null,
  entry: AuditEntry
): Promise<void> {
  await insertAudit(db, {
    actorId: actor?.userId ?? null,
    impersonatorId: actor?.impersonatorId ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    ip: actor?.ip ?? entry.ip ?? null,
    userAgent: actor?.userAgent ?? entry.userAgent ?? null,
    diff: entry.diff ?? null,
  })
}
```

`lib/schemas/api/list.ts`:

```ts
import { z } from "zod"

export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 100

export type SortDir = "asc" | "desc"
export type Sort<F extends string> = { field: F; dir: SortDir }

/** List response envelope (global constraint). */
export type Paginated<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

/** `?sort=field:dir` limited to `fields`; parses to `{ field, dir }`. */
export function sortParam<const F extends string>(
  fields: readonly [F, ...F[]],
  fallback: Sort<NoInfer<F>>
) {
  return z
    .string()
    .regex(/^[A-Za-z]+:(asc|desc)$/, "Use field:asc or field:desc")
    .refine(
      (value) => (fields as readonly string[]).includes(value.split(":")[0]),
      `Sort by one of: ${fields.join(", ")}`
    )
    .transform((value): Sort<F> => {
      const [field, dir] = value.split(":")
      return { field: field as F, dir: dir as SortDir }
    })
    .optional()
    .transform((value) => value ?? fallback)
}

/** `?page&pageSize&q` shared by every list endpoint. */
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAX)
    .default(PAGE_SIZE_DEFAULT),
  q: z.string().trim().max(200).optional(),
})
```

`lib/schemas/api/audit.ts`:

```ts
import { z } from "zod"

import { listQuery, sortParam } from "./list"

/** GET /api/v1/admin/audit query. Dates are ISO 8601 with offset (the UI sends UTC "Z"). */
export const auditListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "action"], { field: "createdAt", dir: "desc" }),
  actor: z.uuid().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(50).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
})

export type AuditListQuery = z.output<typeof auditListQuery>
```

`server/modules/audit/service.ts`:

```ts
import "server-only"

import { hasPermission } from "@/lib/auth/permissions"
import type { AuditListQuery } from "@/lib/schemas/api/audit"
import type { Paginated } from "@/lib/schemas/api/list"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden } from "@/server/lib/errors"

import { listAudit } from "./repo"

export type AuditItem = {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  actor: { id: string; name: string | null; email: string | null } | null
  impersonatorId: string | null
  ip: string | null
  userAgent: string | null
  diff: unknown
  createdAt: string
}

export async function listAuditLog(
  actor: Actor,
  query: AuditListQuery
): Promise<Paginated<AuditItem>> {
  if (!hasPermission(actor.roles, { audit: ["read"] })) throw forbidden()
  const { rows, total } = await listAudit(getDb(), {
    filters: {
      actorId: query.actor,
      action: query.action,
      entityType: query.entityType,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      q: query.q || undefined,
    },
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actor: row.actorId
        ? { id: row.actorId, name: row.actorName, email: row.actorEmail }
        : null,
      impersonatorId: row.impersonatorId,
      ip: row.ip,
      userAgent: row.userAgent,
      diff: row.diff,
      createdAt: row.createdAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}
```


- [ ] **Step 5: Session DAL and Hono middleware**

`server/auth/session.ts`:

```ts
import "server-only"

import { getSessionCookie } from "better-auth/cookies"
import { headers } from "next/headers"
import { forbidden, redirect } from "next/navigation"

import {
  hasPermission,
  parseRoles,
  type PermissionRequest,
} from "@/lib/auth/permissions"
import type { Actor } from "@/server/lib/actor"
import { clientIp } from "@/server/lib/ip"

import { getAuth } from "./auth"

export type SessionUser = {
  id: string
  name: string
  email: string
  title: string | null
  twoFactorEnabled: boolean
}

export type SessionContext = {
  actor: Actor
  user: SessionUser
  session: { id: string; expiresAt: Date; impersonatedBy: string | null }
}

const isBanned = (user: {
  banned?: boolean | null
  banExpires?: Date | null
}) =>
  !!user.banned && !(user.banExpires && user.banExpires.getTime() < Date.now())

/**
 * Resolves the signed-in user from request headers with a fresh database read
 * (cookie cache bypassed), so bans, role changes and revoked sessions apply on
 * the next request. No session cookie → null without touching the database.
 */
export async function sessionFromHeaders(
  requestHeaders: Headers
): Promise<SessionContext | null> {
  if (!getSessionCookie(requestHeaders, { cookiePrefix: "sp" })) return null
  const result = await getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  })
  if (!result || isBanned(result.user)) return null
  const { user, session } = result
  return {
    actor: {
      userId: user.id,
      roles: parseRoles(user.role),
      ip: clientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
      impersonatorId: session.impersonatedBy ?? null,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      title: user.title ?? null,
      twoFactorEnabled: !!user.twoFactorEnabled,
    },
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      impersonatedBy: session.impersonatedBy ?? null,
    },
  }
}

/** Server Components / Server Functions: the current session, read fresh. */
export async function getSessionContext(): Promise<SessionContext | null> {
  return sessionFromHeaders(await headers())
}

/** Fresh session, bypasses the cookie cache. */
export async function getActor(): Promise<Actor | null> {
  return (await getSessionContext())?.actor ?? null
}

/** Redirects to /admin/sign-in when nobody is signed in. */
export async function requireSession(): Promise<SessionContext> {
  const context = await getSessionContext()
  if (!context) redirect("/admin/sign-in")
  return context
}

/** Redirects to /admin/sign-in when nobody is signed in. */
export async function requireActor(): Promise<Actor> {
  return (await requireSession()).actor
}

/** Renders the 403 page (app/(admin)/admin/forbidden.tsx) unless the actor holds `req`. */
export async function requirePermission(
  req: PermissionRequest
): Promise<Actor> {
  const actor = await requireActor()
  if (!hasPermission(actor.roles, req)) forbidden()
  return actor
}
```

`server/api/middleware/auth.ts`:

```ts
import "server-only"

import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { AppEnv } from "@/server/api/context"
import { sessionFromHeaders } from "@/server/auth/session"
import type { Actor } from "@/server/lib/actor"
import { AppError, forbidden } from "@/server/lib/errors"

const unauthenticated = () =>
  new AppError("UNAUTHENTICATED", "Sign in to continue")

/** Resolves the actor from the session cookie (fresh DB read) into c.var.actor. */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const context = await sessionFromHeaders(c.req.raw.headers)
  c.set("actor", context?.actor ?? null)
  await next()
})

/** 401 UNAUTHENTICATED unless a session resolved. */
export const requireSignedIn = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("actor")) throw unauthenticated()
  await next()
})

/** 401 without a session, 403 unless the actor's roles grant every action in `req`. */
export const can = (req: PermissionRequest) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const actor = c.get("actor")
    if (!actor) throw unauthenticated()
    if (!hasPermission(actor.roles, req)) throw forbidden()
    await next()
  })

/** The signed-in actor inside a handler behind requireSignedIn/can. */
export function actorOf(c: Context<AppEnv>): Actor {
  const actor = c.get("actor")
  if (!actor) throw unauthenticated()
  return actor
}
```

`server/modules/audit/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { auditListQuery } from "@/lib/schemas/api/audit"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import { listAuditLog } from "./service"

export const auditRoutes = new Hono<AppEnv>().get(
  "/",
  can({ audit: ["read"] }),
  zv("query", auditListQuery),
  async (c) => c.json(await listAuditLog(actorOf(c), c.req.valid("query")), 200)
)
```


- [ ] **Step 6: Audit hooks, password-reset audit, middleware order**

`server/auth/hooks.ts` (full file):

```ts
import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"

import { parseRoles } from "@/lib/auth/permissions"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { type AuditEntry, writeAudit } from "@/server/lib/audit"
import { clientIp } from "@/server/lib/ip"

type AuthUser = { id: string; role?: string | null }

export function actorFor(
  user: AuthUser,
  headers: Headers | undefined,
  impersonatedBy: string | null = null
): Actor {
  return {
    userId: user.id,
    roles: parseRoles(user.role),
    ip: headers ? clientIp(headers) : null,
    userAgent: headers?.get("user-agent") ?? null,
    impersonatorId: impersonatedBy,
  }
}

/** Audit must never break authentication: failures are logged, not thrown. */
export async function auditAuthEvent(
  actor: Actor | null,
  entry: AuditEntry
): Promise<void> {
  try {
    await writeAudit(getDb(), actor, entry)
  } catch (err) {
    console.error(
      `[audit] could not record ${entry.action}:`,
      err instanceof Error ? err.message : String(err)
    )
  }
}

const SECOND_FACTOR_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
])

const isOk = (returned: unknown) => !isAPIError(returned)

/**
 * Project hooks for Better Auth, packaged as a plugin so they run after the
 * twoFactor plugin's hooks (plugin hooks run in plugin order; options.hooks
 * would run first and see a sign-in that twoFactor later turns into a
 * challenge).
 */
export function securityHooks(): BetterAuthPlugin {
  return {
    id: "sp-security",
    hooks: {
      before: [
        {
          // Admin-plugin endpoints are server-only: user management goes
          // through /api/v1/admin/users (permission checks + audit). Direct
          // HTTP calls to /api/auth/admin/* are refused; auth.api.* calls
          // from our own services carry no `request` and pass.
          matcher: (ctx) => ctx.path?.startsWith("/admin/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.request) throw new APIError("NOT_FOUND")
          }),
        },
        {
          // Changing the password always signs out every other device.
          matcher: (ctx) => ctx.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => ({
            context: { body: { ...ctx.body, revokeOtherSessions: true } },
          })),
        },
        {
          // Sign-out: record who before the session is deleted.
          matcher: (ctx) => ctx.path === "/sign-out",
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx)
            if (!session) return
            await auditAuthEvent(
              actorFor(
                session.user,
                ctx.headers,
                session.session.impersonatedBy ?? null
              ),
              {
                action: "auth.sign_out",
                entityType: "user",
                entityId: session.user.id,
              }
            )
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.headers
            const created = ctx.context.newSession
            if (created) {
              await auditAuthEvent(actorFor(created.user, headers), {
                action: "auth.sign_in",
                entityType: "user",
                entityId: created.user.id,
                diff: { method: "password" },
              })
              return
            }
            const returned = ctx.context.returned
            if (!isAPIError(returned)) return // two-factor challenge pending
            const email =
              typeof ctx.body?.email === "string"
                ? ctx.body.email.toLowerCase()
                : null
            const found = email
              ? await ctx.context.internalAdapter.findUserByEmail(email)
              : null
            await auditAuthEvent(null, {
              action: "auth.sign_in_failed",
              entityType: "user",
              entityId: found?.user.id,
              diff: {
                method: "password",
                email,
                reason: returned.body?.code ?? null,
              },
              ip: headers ? clientIp(headers) : null,
              userAgent: headers?.get("user-agent") ?? null,
            })
          }),
        },
        {
          matcher: (ctx) => SECOND_FACTOR_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.headers
            const method = ctx.path.endsWith("totp") ? "totp" : "backup_code"
            // verifyTwoFactor() stores the pre-existing session here; null
            // means this call completes a sign-in challenge.
            const prior = ctx.context.session
            const created = ctx.context.newSession
            if (!prior && created) {
              await auditAuthEvent(actorFor(created.user, headers), {
                action: "auth.sign_in",
                entityType: "user",
                entityId: created.user.id,
                diff: { method },
              })
            } else if (prior && created && method === "totp") {
              // first successful code while signed in turns 2FA on
              await auditAuthEvent(actorFor(prior.user, headers), {
                action: "auth.2fa_enable",
                entityType: "user",
                entityId: prior.user.id,
              })
            } else if (!prior && isAPIError(ctx.context.returned)) {
              await auditAuthEvent(null, {
                action: "auth.sign_in_failed",
                diff: { method },
                ip: headers ? clientIp(headers) : null,
                userAgent: headers?.get("user-agent") ?? null,
              })
            }
          }),
        },
        {
          matcher: (ctx) =>
            ctx.path === "/two-factor/disable" ||
            ctx.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => {
            const session = ctx.context.session
            if (!session || !isOk(ctx.context.returned)) return
            await auditAuthEvent(
              actorFor(
                session.user,
                ctx.headers,
                session.session.impersonatedBy ?? null
              ),
              {
                action:
                  ctx.path === "/change-password"
                    ? "auth.password_change"
                    : "auth.2fa_disable",
                entityType: "user",
                entityId: session.user.id,
              }
            )
          }),
        },
      ],
    },
  }
}
```

`server/auth/auth.ts` (full file):

```ts
import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"
import { createAccessControl } from "better-auth/plugins/access"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { hasPermission } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"
import { type Db, getDb } from "@/server/db/client"
import * as schema from "@/server/db/schema"
import { getEnv } from "@/server/env"

import { actorFor, auditAuthEvent, securityHooks } from "./hooks"

export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days (spec §6)
export const IMPERSONATION_EXPIRES_IN = 60 * 60 // 1 hour
export const RESET_TOKEN_EXPIRES_IN = 60 * 60 // forgot-password links: 1 hour

/** Absolute URL of an admin page on the public origin (BETTER_AUTH_URL). */
export function adminUrl(
  path: string,
  params: Record<string, string> = {}
): string {
  const url = new URL(path, getEnv().BETTER_AUTH_URL)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  return url.toString()
}

/**
 * The admin plugin only needs to know who may impersonate whom; every other
 * admin-plugin endpoint is closed over HTTP (see hooks.ts) and our users
 * service authorises with lib/auth/permissions.ts. Derived from the app
 * matrix: `user:impersonate` → "impersonate"; `owner:manage` →
 * "impersonate-admins" (adminRoles = owner, so only owners impersonate owners).
 */
const pluginAc = createAccessControl({
  user: ["impersonate", "impersonate-admins"],
} as const)

function pluginRole(role: Role) {
  const actions: ("impersonate" | "impersonate-admins")[] = []
  if (hasPermission([role], { user: ["impersonate"] }))
    actions.push("impersonate")
  if (hasPermission([role], { owner: ["manage"] }))
    actions.push("impersonate-admins")
  return pluginAc.newRole({ user: actions })
}

const pluginRoles = Object.fromEntries(
  ROLES.map((role) => [role, pluginRole(role)])
) as Record<Role, ReturnType<typeof pluginRole>>

function createAuth(db: Db) {
  const env = getEnv()
  const origin = new URL(env.BETTER_AUTH_URL).origin
  return betterAuth({
    appName: "Security Partners",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    user: {
      additionalFields: {
        title: { type: "string", required: false, input: true },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_EXPIRES_IN,
      onPasswordReset: async ({ user }, request) => {
        await auditAuthEvent(actorFor(user, request?.headers), {
          action: "auth.password_reset",
          entityType: "user",
          entityId: user.id,
        })
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      // Spec §6: production only, stored in Postgres (rate_limits).
      enabled: env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: "sp",
      // "__Secure-" cookies whenever the public origin is https (production).
      useSecureCookies: origin.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
      database: { generateId: "uuid" },
    },
    plugins: [
      admin({
        ac: pluginAc,
        roles: pluginRoles,
        defaultRole: "viewer",
        adminRoles: ["owner"],
        impersonationSessionDuration: IMPERSONATION_EXPIRES_IN,
        bannedUserMessage: "This account is suspended.",
      }),
      twoFactor({
        issuer: "Security Partners",
        backupCodeOptions: { amount: 10, length: 10 },
      }),
      securityHooks(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

let cached: { db: Db; signature: string; auth: Auth } | undefined

/**
 * Lazy, memoised Better Auth instance. Never call at module scope: `next
 * build` has no env. Rebuilt when the DB pool or the auth env changes (tests).
 */
export function getAuth(): Auth {
  const db = getDb()
  const env = getEnv()
  const signature = `${env.BETTER_AUTH_SECRET}\u0000${env.BETTER_AUTH_URL}\u0000${env.NODE_ENV}`
  if (cached?.db === db && cached.signature === signature) return cached.auth
  const auth = createAuth(db)
  cached = { db, signature, auth }
  return auth
}
```

`server/api/app.ts` (full file):

```ts
import "server-only"

import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"

import type { AppEnv } from "@/server/api/context"
import {
  requireSignedIn,
  sessionMiddleware,
} from "@/server/api/middleware/auth"
import { limitBody } from "@/server/api/middleware/body-limit"
import { notFoundHandler, onError } from "@/server/api/middleware/error"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import { getAuth } from "@/server/auth/auth"
import { auditRoutes } from "@/server/modules/audit/routes"
import { healthRoutes } from "@/server/modules/health/routes"

/**
 * Admin API routes, chained so `hc<AdminApi>` sees every route type.
 * Later phases add `.route("/<resource>", <resource>Routes)` here.
 */
export const adminRoutes = new Hono<AppEnv>().route("/audit", auditRoutes)
export type AdminApi = typeof adminRoutes

/** Builds the API. Mount order follows spec §7; Phase 2 adds Better Auth + session middleware. */
export function createApp() {
  const api = new Hono<AppEnv>().basePath("/api")

  // 1. Global
  api.use("*", requestIdMiddleware)
  api.use("*", secureHeaders())
  api.use("*", async (c, next) => {
    c.set("actor", null)
    await next()
    c.header("X-Robots-Tag", "noindex")
  })
  api.onError(onError)
  api.notFound(notFoundHandler)

  // 2. Better Auth (sign-in, sign-out, password reset, two-factor)
  api.on(["GET", "POST"], "/auth/*", limitBody("public"), (c) =>
    getAuth().handler(c.req.raw)
  )

  // 3. Public endpoints (rate limit added in Phase 7)
  api.use("/v1/public/*", limitBody("public"))

  // 4. Admin endpoints: session → signed in → same origin → 1 MB body
  api.use(
    "/v1/admin/*",
    sessionMiddleware,
    requireSignedIn,
    sameOrigin(),
    limitBody("admin")
  )
  api.route("/v1/admin", adminRoutes)

  // 5. Health
  api.route("/v1/health", healthRoutes)

  return api
}

export const app = createApp()
```

Why a plugin and not `options.hooks`: Better Auth runs `options.hooks` before plugin hooks, so on `/sign-in/email` a user hook would still see the session that the twoFactor plugin deletes a moment later for a pending 2FA challenge. Plugin hooks run in plugin order, and `securityHooks()` is registered after `twoFactor()`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — new files: `ip.test.ts` (2), `session-dal.test.ts` (6), `error-envelope.test.ts` (17), `auth-middleware.test.ts` (8), `audit-hooks.test.ts` (6), `audit.test.ts` (6); Task 2's `auth.test.ts` still 7.

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm lint && pnpm typecheck`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add server/db/schema server/db/migrations server/lib/audit.ts server/lib/ip.ts server/auth server/api lib/schemas server/modules/audit tests/unit/ip.test.ts tests/unit/auth/session-dal.test.ts tests/unit/api/error-envelope.test.ts tests/integration/api/auth-middleware.test.ts tests/integration/auth/audit-hooks.test.ts tests/integration/api/audit.test.ts
git commit -m "feat: add audit log, session DAL and admin auth middleware

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Users module (invite, roles, ban, sessions, impersonate) (master Task 2.4)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (add `react-email@6.11.2`)
- Create: `emails/layout.tsx`, `emails/invite.tsx`, `emails/reset-password.tsx`
- Create: `server/lib/mailer.ts` (interface + console fallback; SMTP transport arrives in Task 7.2)
- Modify: `server/auth/auth.ts` (forgot-password email via `sendResetPassword`)
- Create: `lib/schemas/api/params.ts`, `lib/schemas/api/users.ts`
- Create: `server/modules/users/repo.ts`, `server/modules/users/schema.ts`, `server/modules/users/service.ts`, `server/modules/users/routes.ts`
- Modify: `server/api/app.ts` (`/users` routes)
- Test: `tests/unit/mailer.test.tsx`, `tests/integration/api/users.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (`hasPermission`, `parseRoles`, `getAuth`, `createPasswordToken`, `passwordUrl`, `INVITE_TOKEN_EXPIRES_IN`, `RECOVERY_TOKEN_EXPIRES_IN`, `writeAudit`, `can`, `actorOf`, `listQuery`, `sortParam`, `Paginated`), `zv`, `AppError`, `forbidden`, `notFound`.
- Produces:

```ts
// server/lib/mailer.ts
export type MailMessage = { to: string; subject: string; react: ReactElement }
export type SendResult = { delivered: boolean; previewUrl?: string }
export const mailer: { send(msg: MailMessage): Promise<SendResult> } // Phase 2: renders, logs subject + recipient, { delivered: false }
// emails/*.tsx
export function InviteEmail(p: { name; inviterName; url; expiresInDays }): JSX.Element
export function ResetPasswordEmail(p: { name; url; expiresInMinutes }): JSX.Element
// lib/schemas/api/params.ts
export const idParam // { id: uuid }
// lib/schemas/api/users.ts
export const roleSchema, rolesSchema, inviteUserInput, updateUserInput, setRolesInput, banUserInput, userListQuery, USER_STATUSES
export type InviteUserInput, UpdateUserInput, SetRolesInput, BanUserInput, UserListQuery
// server/modules/users/schema.ts
export type UserStatus = "active" | "invited" | "banned"
export type UserItem = { id; name; email; title; roles: Role[]; status: UserStatus; banReason; banExpires: string | null; twoFactorEnabled; createdAt: string }
export type UserSessionItem = { id; ipAddress; userAgent; createdAt; expiresAt; impersonatedBy }
export type InviteResult = { user: UserItem; inviteUrl: string; emailDelivered: boolean }
export type PasswordLinkResult = { url: string; emailDelivered: boolean }
// server/modules/users/repo.ts (Drizzle)
export findUserById, findUserByEmail, listUsers, updateUserProfile, setUserRoles, setUserBan, deleteUserSessions, listUserSessions, lockOwners, countActiveOwners, clearTwoFactor, type UserRow
// server/modules/users/service.ts
export listUsers, getUser, inviteUser, updateUser, setRoles, banUser, unbanUser, listSessions, revokeSessions, createPasswordLink, startImpersonation, stopImpersonation
```

Routes under `/api/v1/admin/users` (all behind session + signed-in + sameOrigin):

| Method + path | Permission | Body / query | Response |
|---|---|---|---|
| `GET /` | `user:read` | `?page&pageSize&sort=createdAt\|name\|email:dir&q&role&status=active\|invited\|banned` | `Paginated<UserItem>` |
| `POST /invite` | `user:invite` (+ `owner:manage` to grant `owner`) | `{ email, name, title?, roles[] }` | 201 `InviteResult`; 409 duplicate email |
| `POST /stop-impersonating` | signed in, impersonation session | — | 200 `{ ok: true }` + Set-Cookie; 409 when not impersonating |
| `GET /:id` | `user:read` | — | `UserItem` |
| `PATCH /:id` | `user:update` | `{ name?, title? \| null }` | `UserItem` |
| `PUT /:id/roles` | `user:update` | `{ roles[] }` | `UserItem`; 409 last active owner |
| `POST /:id/ban` | `user:ban` | `{ reason?, expiresInDays? }` | `UserItem` (sessions deleted); 409 self / last owner |
| `DELETE /:id/ban` | `user:ban` | — | `UserItem` |
| `GET /:id/sessions` | `user:read` | — | `{ items: UserSessionItem[] }` |
| `DELETE /:id/sessions` | `user:revokeSessions` | — | `{ revoked: number }` |
| `POST /:id/password-link` | `user:update` | — | `PasswordLinkResult` (set-password for invited users, reset-password otherwise; 24 h) |
| `POST /:id/impersonate` | `user:impersonate` | — | `{ user, expiresAt }` + Set-Cookie (1 h session); 422 self; 409 banned / already impersonating |

Owner rule on every `/:id` write route and on `GET /:id/sessions`: a target holding `owner` (or a request granting `owner`) needs `owner:manage`, else 403 (`GET /` and `GET /:id` only need `user:read`). Audit actions: `user.invite`, `user.update`, `user.roles_change` (`diff: { from, to }`), `user.ban`, `user.unban`, `user.sessions_revoke`, `user.password_link`, `user.impersonate_start`, `user.impersonate_stop` (actor = the impersonator, entity = the impersonated user).

- [ ] **Step 1: Install React Email**

```bash
pnpm add --save-exact react-email@6.11.2
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/mailer.test.tsx`:

```tsx
import { render } from "react-email"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InviteEmail } from "@/emails/invite"
import { ResetPasswordEmail } from "@/emails/reset-password"
import { mailer } from "@/server/lib/mailer"

const LINK = "http://localhost:3000/admin/set-password?token=abc123"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("email templates", () => {
  it("invite: greets the user, names the inviter and links the token URL", async () => {
    const email = (
      <InviteEmail
        name="Dinn Rí"
        inviterName="Owner One"
        url={LINK}
        expiresInDays={7}
      />
    )
    const html = await render(email)
    const text = await render(email, { plainText: true })
    expect(html).toContain(`href="${LINK}"`)
    expect(text).toContain("Hi Dinn Rí,")
    expect(text).toContain("Owner One invited you")
    expect(text).toContain("expires in 7 days")
    expect(text).toContain(LINK)
  })

  it("reset-password: links the token URL and states the expiry", async () => {
    const email = (
      <ResetPasswordEmail name="Sam" url={LINK} expiresInMinutes={60} />
    )
    expect(await render(email)).toContain(`href="${LINK}"`)
    expect(await render(email, { plainText: true })).toContain(
      "expires in 60 minutes"
    )
  })
})

describe("mailer (no transport until Task 7.2)", () => {
  it("renders, reports not delivered and logs subject + recipient only (never the link)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const result = await mailer.send({
      to: "someone@example.test",
      subject: "You're invited",
      react: (
        <InviteEmail name="S" inviterName="O" url={LINK} expiresInDays={7} />
      ),
    })
    expect(result).toEqual({ delivered: false })
    expect(info).toHaveBeenCalledTimes(1)
    const logged = String(info.mock.calls[0][0])
    expect(logged).toContain("You're invited")
    expect(logged).toContain("someone@example.test")
    expect(logged).not.toContain("abc123")
  })
})
```

`tests/integration/api/users.test.ts`:

```ts
import { and, asc, eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getDb } from "@/server/db/client"
import { auditLog, sessions, users } from "@/server/db/schema"
import { mailer } from "@/server/lib/mailer"

import { resetDb } from "../db"
import {
  adminRequest,
  authPost,
  createUser,
  mergeCookies,
  signedInUser,
  signIn,
  TEST_PASSWORD,
} from "../helpers/auth"

const auditFor = async (action: string) =>
  getDb()
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, action))
    .orderBy(asc(auditLog.createdAt))

// Any admin route answers 401 once the session is gone.
const me = (cookie: string) => adminRequest("/audit", { cookie })

beforeEach(async () => {
  await resetDb()
  vi.spyOn(console, "info").mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/v1/admin/users/invite", () => {
  it("creates a passwordless user with roles and returns a working inviteUrl; emailDelivered:false without SMTP (Review Focus 3)", async () => {
    const admin = await signedInUser(["admin"])
    const res = await adminRequest("/users/invite", {
      cookie: admin.cookie,
      method: "POST",
      json: {
        email: "New.Editor@Example.test",
        name: "New Editor",
        title: "Operations Manager",
        roles: ["editor", "author", "editor"],
      },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.emailDelivered).toBe(false)
    expect(body.user).toMatchObject({
      email: "new.editor@example.test",
      name: "New Editor",
      title: "Operations Manager",
      roles: ["editor", "author"],
      status: "invited",
    })
    const url = new URL(body.inviteUrl)
    expect(url.origin).toBe("http://localhost:3000")
    expect(url.pathname).toBe("/admin/set-password")
    const token = url.searchParams.get("token")
    expect(token).toBeTruthy()

    const [audit] = await auditFor("user.invite")
    expect(audit).toMatchObject({
      actorId: admin.user.id,
      entityId: body.user.id,
      diff: { email: "new.editor@example.test", roles: ["editor", "author"] },
    })

    // the link sets the password; the user can then sign in
    const set = await authPost("/reset-password", {
      token,
      newPassword: TEST_PASSWORD,
    })
    expect(set.status).toBe(200)
    const cookie = await signIn("new.editor@example.test")
    const self = await adminRequest(`/users/${body.user.id}`, {
      cookie: admin.cookie,
    })
    expect((await self.json()).status).toBe("active")
    expect(cookie).toContain("sp.session_token=")
  })

  it("still returns inviteUrl when the email was delivered", async () => {
    vi.spyOn(mailer, "send").mockResolvedValue({ delivered: true })
    const admin = await signedInUser(["admin"])
    const res = await adminRequest("/users/invite", {
      cookie: admin.cookie,
      method: "POST",
      json: { email: "mailed@example.test", name: "Mailed", roles: ["viewer"] },
    })
    const body = await res.json()
    expect(body.emailDelivered).toBe(true)
    expect(body.inviteUrl).toContain("/admin/set-password?token=")
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "mailed@example.test" })
    )
  })

  it("rejects duplicates (409), bad input (422) and callers without user:invite (403)", async () => {
    const admin = await signedInUser(["admin"])
    const editor = await signedInUser(["editor"])
    const invite = (cookie: string, json: unknown) =>
      adminRequest("/users/invite", { cookie, method: "POST", json })
    const ok = { email: "dupe@example.test", name: "Dupe", roles: ["viewer"] }
    expect((await invite(admin.cookie, ok)).status).toBe(201)
    expect((await invite(admin.cookie, ok)).status).toBe(409)
    expect(
      (await invite(admin.cookie, { ...ok, email: "x@y.test", roles: [] }))
        .status
    ).toBe(422)
    expect(
      (await invite(admin.cookie, { ...ok, email: "not-an-email" })).status
    ).toBe(422)
    expect(
      (
        await invite(admin.cookie, {
          ...ok,
          email: "r@y.test",
          roles: ["root"],
        })
      ).status
    ).toBe(422)
    expect(
      (await invite(editor.cookie, { ...ok, email: "e@y.test" })).status
    ).toBe(403)
  })

  it("only owners may grant the owner role", async () => {
    const admin = await signedInUser(["admin"])
    const owner = await signedInUser(["owner"])
    const json = {
      email: "o2@example.test",
      name: "Owner Two",
      roles: ["owner"],
    }
    expect(
      (
        await adminRequest("/users/invite", {
          cookie: admin.cookie,
          method: "POST",
          json,
        })
      ).status
    ).toBe(403)
    expect(
      (
        await adminRequest("/users/invite", {
          cookie: owner.cookie,
          method: "POST",
          json,
        })
      ).status
    ).toBe(201)
  })
})

describe("owners are special", () => {
  it("an admin cannot modify an owner (403 on every write); an owner can", async () => {
    const admin = await signedInUser(["admin"])
    const owner = await signedInUser(["owner"])
    const otherOwner = await createUser({ roles: ["owner"] })
    const id = otherOwner.id
    const writes: [string, string, unknown?][] = [
      ["PATCH", `/users/${id}`, { name: "Renamed" }],
      ["PUT", `/users/${id}/roles`, { roles: ["viewer"] }],
      ["POST", `/users/${id}/ban`, {}],
      ["DELETE", `/users/${id}/ban`],
      ["DELETE", `/users/${id}/sessions`],
      ["GET", `/users/${id}/sessions`],
      ["POST", `/users/${id}/password-link`],
      ["POST", `/users/${id}/impersonate`],
    ]
    for (const [method, path, json] of writes) {
      const res = await adminRequest(path, {
        cookie: admin.cookie,
        method,
        json,
      })
      expect([method, path, res.status]).toEqual([method, path, 403])
    }
    // admin cannot promote anyone to owner either
    const editor = await createUser({ roles: ["editor"] })
    const promote = await adminRequest(`/users/${editor.id}/roles`, {
      cookie: admin.cookie,
      method: "PUT",
      json: { roles: ["owner"] },
    })
    expect(promote.status).toBe(403)

    const ownerEdit = await adminRequest(`/users/${id}`, {
      cookie: owner.cookie,
      method: "PATCH",
      json: { title: "Director" },
    })
    expect(ownerEdit.status).toBe(200)
    expect((await ownerEdit.json()).title).toBe("Director")
  })

  it("the last active owner cannot be demoted or banned (409); with a second owner they can", async () => {
    const owner = await signedInUser(["owner"])
    const demoteSelf = () =>
      adminRequest(`/users/${owner.user.id}/roles`, {
        cookie: owner.cookie,
        method: "PUT",
        json: { roles: ["admin"] },
      })
    const demote = await demoteSelf()
    expect(demote.status).toBe(409)
    expect((await demote.json()).error.message).toBe(
      "The last active owner cannot be demoted"
    )
    const ban = await adminRequest(`/users/${owner.user.id}/ban`, {
      cookie: owner.cookie,
      method: "POST",
      json: {},
    })
    expect(ban.status).toBe(409)
    expect((await ban.json()).error.message).toBe(
      "The last active owner cannot be banned"
    )

    // a banned second owner does not count as active
    const banned = await createUser({ roles: ["owner"] })
    await getDb()
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, banned.id))
    expect((await demoteSelf()).status).toBe(409)

    await createUser({ roles: ["owner", "editor"] })
    const ok = await demoteSelf()
    expect(ok.status).toBe(200)
    expect((await ok.json()).roles).toEqual(["admin"])
  })
})

describe("roles, ban, sessions", () => {
  it("role change is audited with from/to and applies on the next request", async () => {
    const admin = await signedInUser(["admin"])
    const target = await signedInUser(["viewer"])
    expect(
      (await adminRequest("/audit", { cookie: target.cookie })).status
    ).toBe(403)
    const res = await adminRequest(`/users/${target.user.id}/roles`, {
      cookie: admin.cookie,
      method: "PUT",
      json: { roles: ["admin"] },
    })
    expect(res.status).toBe(200)
    expect((await auditFor("user.roles_change"))[0].diff).toEqual({
      from: ["viewer"],
      to: ["admin"],
    })
    expect(
      (await adminRequest("/audit", { cookie: target.cookie })).status
    ).toBe(200)
  })

  it("ban revokes sessions, blocks sign-in and is audited; unban restores access", async () => {
    const admin = await signedInUser(["admin"])
    const target = await signedInUser(["editor"])
    const ban = await adminRequest(`/users/${target.user.id}/ban`, {
      cookie: admin.cookie,
      method: "POST",
      json: { reason: "Left the company", expiresInDays: 30 },
    })
    expect(ban.status).toBe(200)
    const banned = await ban.json()
    expect(banned.status).toBe("banned")
    expect(banned.banReason).toBe("Left the company")
    expect(Date.parse(banned.banExpires) - Date.now()).toBeGreaterThan(
      29 * 86_400_000
    )
    expect(
      await getDb()
        .select()
        .from(sessions)
        .where(eq(sessions.userId, target.user.id))
    ).toEqual([])
    expect((await me(target.cookie)).status).toBe(401)

    const signInAgain = await authPost("/sign-in/email", {
      email: target.user.email,
      password: TEST_PASSWORD,
    })
    expect(signInAgain.status).toBe(403)
    expect((await signInAgain.json()).code).toBe("BANNED_USER")
    expect((await auditFor("user.ban"))[0]).toMatchObject({
      actorId: admin.user.id,
      entityId: target.user.id,
      diff: { reason: "Left the company", sessionsRevoked: 1 },
    })

    const unban = await adminRequest(`/users/${target.user.id}/ban`, {
      cookie: admin.cookie,
      method: "DELETE",
    })
    expect(unban.status).toBe(200)
    expect((await unban.json()).status).toBe("active")
    expect(await auditFor("user.unban")).toHaveLength(1)
    await signIn(target.user.email)
  })

  it("cannot ban yourself", async () => {
    const admin = await signedInUser(["admin"])
    const res = await adminRequest(`/users/${admin.user.id}/ban`, {
      cookie: admin.cookie,
      method: "POST",
      json: {},
    })
    expect(res.status).toBe(409)
  })

  it("lists and revokes a user's sessions (audited)", async () => {
    const admin = await signedInUser(["admin"])
    const target = await createUser({ roles: ["viewer"] })
    const a = await signIn(target.email)
    await signIn(target.email)
    const list = await adminRequest(`/users/${target.id}/sessions`, {
      cookie: admin.cookie,
    })
    expect((await list.json()).items).toHaveLength(2)
    const revoke = await adminRequest(`/users/${target.id}/sessions`, {
      cookie: admin.cookie,
      method: "DELETE",
    })
    expect(await revoke.json()).toEqual({ revoked: 2 })
    expect((await me(a)).status).toBe(401)
    expect((await auditFor("user.sessions_revoke"))[0].diff).toEqual({
      revoked: 2,
    })
  })

  it("password-link returns a set-password link for invited users and reset-password otherwise", async () => {
    const admin = await signedInUser(["admin"])
    const invited = await createUser({ roles: ["viewer"], password: null })
    const active = await createUser({ roles: ["viewer"] })
    const link = async (id: string) =>
      (
        await adminRequest(`/users/${id}/password-link`, {
          cookie: admin.cookie,
          method: "POST",
        })
      ).json()
    expect((await link(invited.id)).url).toContain("/admin/set-password?token=")
    const second = await link(active.id)
    expect(second.url).toContain("/admin/reset-password?token=")
    expect(second.emailDelivered).toBe(false)
    expect(await auditFor("user.password_link")).toHaveLength(2)
  })

  it("lists users with status and role filters", async () => {
    const admin = await signedInUser(["admin"])
    await createUser({ roles: ["editor"], name: "Eddie Editor" })
    await createUser({ roles: ["viewer"], password: null })
    const list = async (q: string) =>
      (await adminRequest(`/users${q}`, { cookie: admin.cookie })).json()
    expect((await list("")).total).toBe(3)
    expect((await list("?status=invited")).total).toBe(1)
    expect((await list("?status=active")).total).toBe(2)
    expect(
      (await list("?role=editor")).items.map((u: { name: string }) => u.name)
    ).toEqual(["Eddie Editor"])
    expect((await list("?q=eddie")).total).toBe(1)
    expect((await list("?sort=name:asc&pageSize=2")).items).toHaveLength(2)
  })
})

describe("impersonation", () => {
  it("admin impersonates an editor for 1 hour, audited; stop restores the admin", async () => {
    const admin = await signedInUser(["admin"])
    const editor = await createUser({ roles: ["editor"] })
    const start = await adminRequest(`/users/${editor.id}/impersonate`, {
      cookie: admin.cookie,
      method: "POST",
    })
    expect(start.status).toBe(200)
    const body = await start.json()
    expect(body.user.id).toBe(editor.id)
    const hours = (Date.parse(body.expiresAt) - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(0.98)
    expect(hours).toBeLessThanOrEqual(1)

    const asEditor = mergeCookies(admin.cookie, start)
    const [row] = await getDb()
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, editor.id),
          eq(sessions.impersonatedBy, admin.user.id)
        )
      )
    expect(row).toBeDefined()
    // acting as the editor: no audit:read
    expect((await adminRequest("/audit", { cookie: asEditor })).status).toBe(
      403
    )
    expect((await auditFor("user.impersonate_start"))[0]).toMatchObject({
      actorId: admin.user.id,
      entityId: editor.id,
    })

    const stop = await adminRequest("/users/stop-impersonating", {
      cookie: asEditor,
      method: "POST",
    })
    expect(stop.status).toBe(200)
    const back = mergeCookies(asEditor, stop)
    expect((await adminRequest("/audit", { cookie: back })).status).toBe(200)
    expect((await auditFor("user.impersonate_stop"))[0]).toMatchObject({
      actorId: admin.user.id,
      entityId: editor.id,
    })
  })

  it("cannot impersonate an owner unless owner; never yourself; stop needs an impersonation", async () => {
    const admin = await signedInUser(["admin"])
    const owner = await signedInUser(["owner"])
    const target = await createUser({ roles: ["owner"] })
    const impersonate = (cookie: string, id: string) =>
      adminRequest(`/users/${id}/impersonate`, { cookie, method: "POST" })
    expect((await impersonate(admin.cookie, target.id)).status).toBe(403)
    expect((await impersonate(owner.cookie, target.id)).status).toBe(200)
    expect((await impersonate(admin.cookie, admin.user.id)).status).toBe(422)
    const stop = await adminRequest("/users/stop-impersonating", {
      cookie: admin.cookie,
      method: "POST",
    })
    expect(stop.status).toBe(409)
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test:unit tests/unit/mailer.test.tsx`
Expected: FAIL — `Failed to resolve import "@/emails/invite"`.

Run: `pnpm test:integration tests/integration/api/users.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/mailer"`.

- [ ] **Step 4: Email templates and mailer**

`emails/layout.tsx`:

```tsx
import type { ReactNode } from "react"
import { Body, Container, Head, Hr, Html, Preview, Text } from "react-email"

// Shared frame for transactional emails. Plain inline styles: email clients
// ignore the site's CSS.
export const emailStyles = {
  body: {
    backgroundColor: "#f4f4f5",
    fontFamily: "Arial, Helvetica, sans-serif",
    margin: 0,
    padding: "24px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    margin: "0 auto",
    maxWidth: 520,
    padding: 32,
  },
  heading: { color: "#18181b", fontSize: 22, margin: "0 0 16px" },
  text: {
    color: "#3f3f46",
    fontSize: 15,
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  button: {
    backgroundColor: "#18181b",
    borderRadius: 6,
    color: "#ffffff",
    display: "inline-block",
    fontSize: 15,
    fontWeight: 700,
    padding: "12px 20px",
    textDecoration: "none",
  },
  small: {
    color: "#71717a",
    fontSize: 13,
    lineHeight: "20px",
    margin: "16px 0 0",
  },
  link: { color: "#18181b", wordBreak: "break-all" as const },
}

export function EmailLayout({
  preview,
  children,
}: {
  preview: string
  children: ReactNode
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          {children}
          <Hr />
          <Text style={emailStyles.small}>
            Security Partners Ltd. · This is an automated message.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

`emails/invite.tsx`:

```tsx
import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"

export type InviteEmailProps = {
  name: string
  inviterName: string
  url: string
  expiresInDays: number
}

export function InviteEmail({
  name,
  inviterName,
  url,
  expiresInDays,
}: InviteEmailProps) {
  return (
    <EmailLayout preview="You're invited to the Security Partners admin">
      <Heading as="h1" style={emailStyles.heading}>
        You&apos;re invited
      </Heading>
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        {inviterName} invited you to the Security Partners website admin. Choose
        a password to activate your account.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Choose your password
      </Button>
      <Text style={emailStyles.small}>
        This link works once and expires in {expiresInDays} days. If the button
        does not work, open this address:{" "}
        <Link href={url} style={emailStyles.link}>
          {url}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default InviteEmail
```

`emails/reset-password.tsx`:

```tsx
import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"

export type ResetPasswordEmailProps = {
  name: string
  url: string
  expiresInMinutes: number
}

export function ResetPasswordEmail({
  name,
  url,
  expiresInMinutes,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Reset your Security Partners admin password">
      <Heading as="h1" style={emailStyles.heading}>
        Reset your password
      </Heading>
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        Someone asked to reset the password for your Security Partners admin
        account. If it was you, choose a new password below. Your other sessions
        will be signed out.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Choose a new password
      </Button>
      <Text style={emailStyles.small}>
        This link works once and expires in {expiresInMinutes} minutes. If you
        did not ask for this, ignore this email; your password stays the same.
        Link:{" "}
        <Link href={url} style={emailStyles.link}>
          {url}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default ResetPasswordEmail
```

`server/lib/mailer.ts`:

```ts
import "server-only"

import type { ReactElement } from "react"
import { render } from "react-email"

export type MailMessage = { to: string; subject: string; react: ReactElement }
export type SendResult = { delivered: boolean; previewUrl?: string }

/**
 * Transactional email. Phase 2: no transport is configured yet, so every
 * message is rendered (catching template errors early) and reported as not
 * delivered; callers then surface a copyable link instead (invites, owner
 * recovery). Task 7.2 adds the SMTP transport from `integrations.smtp`
 * behind the same `send` signature. Never logs message bodies: they contain
 * single-use links.
 */
export const mailer = {
  async send({ to, subject, react }: MailMessage): Promise<SendResult> {
    await render(react)
    console.info(
      `[mailer] SMTP is not configured; not sent: "${subject}" to ${to}`
    )
    return { delivered: false }
  },
}
```


- [ ] **Step 5: Forgot-password email in Better Auth**

`server/auth/auth.ts` (full file):

```ts
import "server-only"

import { createElement } from "react"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"
import { createAccessControl } from "better-auth/plugins/access"

import { ResetPasswordEmail } from "@/emails/reset-password"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { hasPermission } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"
import { type Db, getDb } from "@/server/db/client"
import * as schema from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { mailer } from "@/server/lib/mailer"

import { actorFor, auditAuthEvent, securityHooks } from "./hooks"

export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7 // 7 days (spec §6)
export const IMPERSONATION_EXPIRES_IN = 60 * 60 // 1 hour
export const RESET_TOKEN_EXPIRES_IN = 60 * 60 // forgot-password links: 1 hour

/** Absolute URL of an admin page on the public origin (BETTER_AUTH_URL). */
export function adminUrl(
  path: string,
  params: Record<string, string> = {}
): string {
  const url = new URL(path, getEnv().BETTER_AUTH_URL)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  return url.toString()
}

/**
 * The admin plugin only needs to know who may impersonate whom; every other
 * admin-plugin endpoint is closed over HTTP (see hooks.ts) and our users
 * service authorises with lib/auth/permissions.ts. Derived from the app
 * matrix: `user:impersonate` → "impersonate"; `owner:manage` →
 * "impersonate-admins" (adminRoles = owner, so only owners impersonate owners).
 */
const pluginAc = createAccessControl({
  user: ["impersonate", "impersonate-admins"],
} as const)

function pluginRole(role: Role) {
  const actions: ("impersonate" | "impersonate-admins")[] = []
  if (hasPermission([role], { user: ["impersonate"] }))
    actions.push("impersonate")
  if (hasPermission([role], { owner: ["manage"] }))
    actions.push("impersonate-admins")
  return pluginAc.newRole({ user: actions })
}

const pluginRoles = Object.fromEntries(
  ROLES.map((role) => [role, pluginRole(role)])
) as Record<Role, ReturnType<typeof pluginRole>>

function createAuth(db: Db) {
  const env = getEnv()
  const origin = new URL(env.BETTER_AUTH_URL).origin
  return betterAuth({
    appName: "Security Partners",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    user: {
      additionalFields: {
        title: { type: "string", required: false, input: true },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_EXPIRES_IN,
      // Forgot-password: Better Auth creates the token; we link to our page.
      sendResetPassword: async ({ user, token }) => {
        await mailer.send({
          to: user.email,
          subject: "Reset your Security Partners admin password",
          react: createElement(ResetPasswordEmail, {
            name: user.name,
            url: adminUrl("/admin/reset-password", { token }),
            expiresInMinutes: RESET_TOKEN_EXPIRES_IN / 60,
          }),
        })
      },
      onPasswordReset: async ({ user }, request) => {
        await auditAuthEvent(actorFor(user, request?.headers), {
          action: "auth.password_reset",
          entityType: "user",
          entityId: user.id,
        })
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      // Spec §6: production only, stored in Postgres (rate_limits).
      enabled: env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: "sp",
      // "__Secure-" cookies whenever the public origin is https (production).
      useSecureCookies: origin.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
      database: { generateId: "uuid" },
    },
    plugins: [
      admin({
        ac: pluginAc,
        roles: pluginRoles,
        defaultRole: "viewer",
        adminRoles: ["owner"],
        impersonationSessionDuration: IMPERSONATION_EXPIRES_IN,
        bannedUserMessage: "This account is suspended.",
      }),
      twoFactor({
        issuer: "Security Partners",
        backupCodeOptions: { amount: 10, length: 10 },
      }),
      securityHooks(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

let cached: { db: Db; signature: string; auth: Auth } | undefined

/**
 * Lazy, memoised Better Auth instance. Never call at module scope: `next
 * build` has no env. Rebuilt when the DB pool or the auth env changes (tests).
 */
export function getAuth(): Auth {
  const db = getDb()
  const env = getEnv()
  const signature = `${env.BETTER_AUTH_SECRET}\u0000${env.BETTER_AUTH_URL}\u0000${env.NODE_ENV}`
  if (cached?.db === db && cached.signature === signature) return cached.auth
  const auth = createAuth(db)
  cached = { db, signature, auth }
  return auth
}
```

- [ ] **Step 6: Input schemas, repo, DTOs, service, routes**

`lib/schemas/api/params.ts`:

```ts
import { z } from "zod"

/** `/:id` path parameter (uuid v7 ids; any uuid version accepted). */
export const idParam = z.object({ id: z.uuid() })
```

`lib/schemas/api/users.ts`:

```ts
import { z } from "zod"

import { ROLES } from "@/lib/auth/roles"

import { listQuery, sortParam } from "./list"

export const roleSchema = z.enum(ROLES)

/** One or more roles, duplicates removed (order kept). */
export const rolesSchema = z
  .array(roleSchema)
  .min(1, "Choose at least one role")
  .transform((roles) => [...new Set(roles)])

const name = z.string().trim().min(1, "Required").max(100)
const title = z.string().trim().max(100)

export const inviteUserInput = z.object({
  email: z
    .email("Enter a valid email address")
    .max(254)
    .transform((v) => v.toLowerCase()),
  name,
  title: title.optional(),
  roles: rolesSchema,
})

export const updateUserInput = z
  .object({ name: name.optional(), title: title.nullable().optional() })
  .refine((v) => v.name !== undefined || v.title !== undefined, {
    message: "Nothing to update",
  })

export const setRolesInput = z.object({ roles: rolesSchema })

export const banUserInput = z.object({
  reason: z.string().trim().max(200).optional(),
  /** Omit for a ban without end date. */
  expiresInDays: z.number().int().min(1).max(3650).optional(),
})

export const USER_STATUSES = ["active", "invited", "banned"] as const

export const userListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "name", "email"], {
    field: "createdAt",
    dir: "desc",
  }),
  role: roleSchema.optional(),
  status: z.enum(USER_STATUSES).optional(),
})

export type InviteUserInput = z.output<typeof inviteUserInput>
export type UpdateUserInput = z.output<typeof updateUserInput>
export type SetRolesInput = z.output<typeof setRolesInput>
export type BanUserInput = z.output<typeof banUserInput>
export type UserListQuery = z.output<typeof userListQuery>
```

`server/modules/users/repo.ts`:

```ts
import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  ilike,
  isNull,
  ne,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm"

import type { Role } from "@/lib/auth/roles"
import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { accounts, sessions, twoFactors, users } from "@/server/db/schema"

// Any constant: serialises owner-count checks (demote/ban the last owner).
const OWNERS_LOCK_ID = 7_314_002

const hasPassword = exists(
  sql`(select 1 from ${accounts} where ${accounts.userId} = ${users.id} and ${accounts.providerId} = 'credential')`
)

/** Banned now (a ban whose end date passed no longer counts). */
const bannedNow = and(
  eq(users.banned, true),
  or(isNull(users.banExpires), gt(users.banExpires, sql`now()`))
) as SQL

const hasRole = (role: Role) =>
  sql`${role} = any(string_to_array(${users.role}, ','))`

const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  title: users.title,
  role: users.role,
  banned: users.banned,
  banReason: users.banReason,
  banExpires: users.banExpires,
  twoFactorEnabled: users.twoFactorEnabled,
  createdAt: users.createdAt,
  hasPassword: sql<boolean>`${hasPassword}`,
}

export type UserRow = {
  id: string
  name: string
  email: string
  title: string | null
  role: string | null
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
  twoFactorEnabled: boolean | null
  createdAt: Date
  hasPassword: boolean
}

export async function findUserById(
  db: DbOrTx,
  id: string
): Promise<UserRow | null> {
  const [row] = await db.select(userColumns).from(users).where(eq(users.id, id))
  return row ?? null
}

export async function findUserByEmail(
  db: DbOrTx,
  email: string
): Promise<UserRow | null> {
  const [row] = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
  return row ?? null
}

export type UserFilters = {
  role?: Role
  status?: "active" | "invited" | "banned"
  q?: string
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

function whereFor(filters: UserFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = []
  if (filters.role) conditions.push(hasRole(filters.role))
  if (filters.status === "banned") conditions.push(bannedNow)
  if (filters.status === "active")
    conditions.push(and(not(bannedNow), hasPassword))
  if (filters.status === "invited")
    conditions.push(and(not(bannedNow), not(hasPassword)))
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
        ilike(users.title, pattern)
      )
    )
  }
  return and(...conditions)
}

export async function listUsers(
  db: DbOrTx,
  opts: {
    filters: UserFilters
    sort: Sort<"createdAt" | "name" | "email">
    page: number
    pageSize: number
  }
) {
  const where = whereFor(opts.filters)
  const [{ total }] = await db
    .select({ total: count() })
    .from(users)
    .where(where)
  const column = {
    createdAt: users.createdAt,
    name: users.name,
    email: users.email,
  }[opts.sort.field]
  const rows = await db
    .select(userColumns)
    .from(users)
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(users.id)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows: rows as UserRow[], total }
}

export async function updateUserProfile(
  db: DbOrTx,
  id: string,
  values: { name?: string; title?: string | null }
): Promise<void> {
  await db.update(users).set(values).where(eq(users.id, id))
}

export async function setUserRoles(
  db: DbOrTx,
  id: string,
  roles: Role[]
): Promise<void> {
  await db
    .update(users)
    .set({ role: roles.join(",") })
    .where(eq(users.id, id))
}

export async function setUserBan(
  db: DbOrTx,
  id: string,
  ban: { reason: string | null; expiresAt: Date | null } | null
): Promise<void> {
  await db
    .update(users)
    .set(
      ban
        ? { banned: true, banReason: ban.reason, banExpires: ban.expiresAt }
        : { banned: false, banReason: null, banExpires: null }
    )
    .where(eq(users.id, id))
}

export async function deleteUserSessions(
  db: DbOrTx,
  userId: string
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id })
  return deleted.length
}

export async function listUserSessions(db: DbOrTx, userId: string) {
  return db
    .select({
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      impersonatedBy: sessions.impersonatedBy,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, sql`now()`)))
    .orderBy(desc(sessions.createdAt))
}

/** Transaction-scoped lock taken before any owner-count check. */
export async function lockOwners(tx: DbOrTx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${OWNERS_LOCK_ID})`)
}

/** Owners who are not banned now, excluding `exceptUserId`. */
export async function countActiveOwners(
  db: DbOrTx,
  exceptUserId: string
): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(hasRole("owner"), not(bannedNow), ne(users.id, exceptUserId)))
  return n
}

/** Turns two-factor off and deletes the TOTP secret and backup codes. */
export async function clearTwoFactor(
  db: DbOrTx,
  userId: string
): Promise<void> {
  await db.delete(twoFactors).where(eq(twoFactors.userId, userId))
  await db
    .update(users)
    .set({ twoFactorEnabled: false })
    .where(eq(users.id, userId))
}
```

`server/modules/users/schema.ts`:

```ts
import "server-only"

import { parseRoles } from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"

import type { UserRow } from "./repo"

export type UserStatus = "active" | "invited" | "banned"

/** API shape of a user (dates ISO 8601 UTC). */
export type UserItem = {
  id: string
  name: string
  email: string
  title: string | null
  roles: Role[]
  status: UserStatus
  banReason: string | null
  banExpires: string | null
  twoFactorEnabled: boolean
  createdAt: string
}

export type UserSessionItem = {
  id: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
  impersonatedBy: string | null
}

export type InviteResult = {
  user: UserItem
  /** Always returned so an admin can copy it when email is not configured. */
  inviteUrl: string
  emailDelivered: boolean
}

export type PasswordLinkResult = { url: string; emailDelivered: boolean }

export function isBannedNow(row: Pick<UserRow, "banned" | "banExpires">) {
  return (
    !!row.banned && !(row.banExpires && row.banExpires.getTime() <= Date.now())
  )
}

export function toUserItem(row: UserRow): UserItem {
  const banned = isBannedNow(row)
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    roles: parseRoles(row.role),
    status: banned ? "banned" : row.hasPassword ? "active" : "invited",
    banReason: banned ? row.banReason : null,
    banExpires: banned && row.banExpires ? row.banExpires.toISOString() : null,
    twoFactorEnabled: !!row.twoFactorEnabled,
    createdAt: row.createdAt.toISOString(),
  }
}
```

`server/modules/users/service.ts`:

```ts
import "server-only"

import { createElement } from "react"

import { InviteEmail } from "@/emails/invite"
import { ResetPasswordEmail } from "@/emails/reset-password"
import {
  hasPermission,
  parseRoles,
  type PermissionRequest,
} from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"
import type { Paginated } from "@/lib/schemas/api/list"
import type {
  BanUserInput,
  InviteUserInput,
  SetRolesInput,
  UpdateUserInput,
  UserListQuery,
} from "@/lib/schemas/api/users"
import { getAuth } from "@/server/auth/auth"
import {
  createPasswordToken,
  INVITE_TOKEN_EXPIRES_IN,
  passwordUrl,
  RECOVERY_TOKEN_EXPIRES_IN,
} from "@/server/auth/tokens"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { mailer } from "@/server/lib/mailer"

import * as repo from "./repo"
import {
  type InviteResult,
  isBannedNow,
  type PasswordLinkResult,
  toUserItem,
  type UserItem,
  type UserSessionItem,
} from "./schema"

const need = (actor: Actor, req: PermissionRequest) => {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const managesOwners = (actor: Actor) =>
  hasPermission(actor.roles, { owner: ["manage"] })

/** Owners are special: only owners may change an owner or grant `owner`. */
function assertMayTouch(actor: Actor, target: repo.UserRow) {
  if (parseRoles(target.role).includes("owner") && !managesOwners(actor))
    throw forbidden()
}

function assertMayAssign(actor: Actor, roles: Role[]) {
  if (roles.includes("owner") && !managesOwners(actor)) throw forbidden()
}

async function loadTarget(db: DbOrTx, id: string) {
  const target = await repo.findUserById(db, id)
  if (!target) throw notFound("User")
  return target
}

const isActiveOwner = (row: repo.UserRow) =>
  parseRoles(row.role).includes("owner") && !isBannedNow(row)

/** 409 when `target` is the only active owner (call inside a tx after lockOwners). */
async function assertNotLastOwner(
  tx: DbOrTx,
  target: repo.UserRow,
  verb: string
) {
  if (!isActiveOwner(target)) return
  if ((await repo.countActiveOwners(tx, target.id)) === 0)
    throw new AppError("CONFLICT", `The last active owner cannot be ${verb}`)
}

export async function listUsers(
  actor: Actor,
  query: UserListQuery
): Promise<Paginated<UserItem>> {
  need(actor, { user: ["read"] })
  const { rows, total } = await repo.listUsers(getDb(), {
    filters: {
      role: query.role,
      status: query.status,
      q: query.q || undefined,
    },
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toUserItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getUser(actor: Actor, id: string): Promise<UserItem> {
  need(actor, { user: ["read"] })
  return toUserItem(await loadTarget(getDb(), id))
}

export async function inviteUser(
  actor: Actor,
  input: InviteUserInput
): Promise<InviteResult> {
  need(actor, { user: ["invite"] })
  assertMayAssign(actor, input.roles)
  const db = getDb()
  if (await repo.findUserByEmail(db, input.email))
    throw new AppError("CONFLICT", "A user with this email already exists")

  const { user } = await getAuth().api.createUser({
    body: {
      email: input.email,
      name: input.name,
      role: input.roles,
      data: { title: input.title || null },
    },
  })
  const token = await createPasswordToken(user.id, INVITE_TOKEN_EXPIRES_IN)
  const inviteUrl = passwordUrl("set-password", token)
  await writeAudit(db, actor, {
    action: "user.invite",
    entityType: "user",
    entityId: user.id,
    diff: {
      email: input.email,
      roles: input.roles,
      title: input.title ?? null,
    },
  })
  const inviter = await repo.findUserById(db, actor.userId)
  const { delivered } = await mailer.send({
    to: input.email,
    subject: "You're invited to the Security Partners admin",
    react: createElement(InviteEmail, {
      name: input.name,
      inviterName: inviter?.name ?? "An administrator",
      url: inviteUrl,
      expiresInDays: INVITE_TOKEN_EXPIRES_IN / 86_400,
    }),
  })
  const created = await loadTarget(db, user.id)
  return { user: toUserItem(created), inviteUrl, emailDelivered: delivered }
}

export async function updateUser(
  actor: Actor,
  id: string,
  input: UpdateUserInput
): Promise<UserItem> {
  need(actor, { user: ["update"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  await db.transaction(async (tx) => {
    await repo.updateUserProfile(tx, id, input)
    await writeAudit(tx, actor, {
      action: "user.update",
      entityType: "user",
      entityId: id,
      diff: {
        from: { name: target.name, title: target.title },
        to: input,
      },
    })
  })
  return toUserItem(await loadTarget(db, id))
}

export async function setRoles(
  actor: Actor,
  id: string,
  input: SetRolesInput
): Promise<UserItem> {
  need(actor, { user: ["update"] })
  assertMayAssign(actor, input.roles)
  const db = getDb()
  await db.transaction(async (tx) => {
    await repo.lockOwners(tx)
    const target = await loadTarget(tx, id)
    assertMayTouch(actor, target)
    if (!input.roles.includes("owner"))
      await assertNotLastOwner(tx, target, "demoted")
    await repo.setUserRoles(tx, id, input.roles)
    await writeAudit(tx, actor, {
      action: "user.roles_change",
      entityType: "user",
      entityId: id,
      diff: { from: parseRoles(target.role), to: input.roles },
    })
  })
  return toUserItem(await loadTarget(db, id))
}

export async function banUser(
  actor: Actor,
  id: string,
  input: BanUserInput
): Promise<UserItem> {
  need(actor, { user: ["ban"] })
  const db = getDb()
  await db.transaction(async (tx) => {
    await repo.lockOwners(tx)
    const target = await loadTarget(tx, id)
    assertMayTouch(actor, target)
    await assertNotLastOwner(tx, target, "banned")
    if (target.id === actor.userId)
      throw new AppError("CONFLICT", "You cannot ban your own account")
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null
    await repo.setUserBan(tx, id, { reason: input.reason ?? null, expiresAt })
    const revoked = await repo.deleteUserSessions(tx, id)
    await writeAudit(tx, actor, {
      action: "user.ban",
      entityType: "user",
      entityId: id,
      diff: {
        reason: input.reason ?? null,
        expiresAt: expiresAt?.toISOString() ?? null,
        sessionsRevoked: revoked,
      },
    })
  })
  return toUserItem(await loadTarget(db, id))
}

export async function unbanUser(actor: Actor, id: string): Promise<UserItem> {
  need(actor, { user: ["ban"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
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

export async function listSessions(
  actor: Actor,
  id: string
): Promise<UserSessionItem[]> {
  need(actor, { user: ["read"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  const rows = await repo.listUserSessions(db, id)
  return rows.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    impersonatedBy: s.impersonatedBy,
  }))
}

export async function revokeSessions(
  actor: Actor,
  id: string
): Promise<{ revoked: number }> {
  need(actor, { user: ["revokeSessions"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  return db.transaction(async (tx) => {
    const revoked = await repo.deleteUserSessions(tx, id)
    await writeAudit(tx, actor, {
      action: "user.sessions_revoke",
      entityType: "user",
      entityId: id,
      diff: { revoked },
    })
    return { revoked }
  })
}

/**
 * Single-use link to choose a password: "set-password" for invited users,
 * "reset-password" otherwise. Emailed when SMTP works; always returned so an
 * admin can pass it on when it does not (spec §17 bootstrap without SMTP).
 */
export async function createPasswordLink(
  actor: Actor,
  id: string
): Promise<PasswordLinkResult> {
  need(actor, { user: ["update"] })
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  if (isBannedNow(target))
    throw new AppError(
      "CONFLICT",
      "Unban this user before sending a password link"
    )
  const token = await createPasswordToken(id, RECOVERY_TOKEN_EXPIRES_IN)
  const url = passwordUrl(
    target.hasPassword ? "reset-password" : "set-password",
    token
  )
  await writeAudit(db, actor, {
    action: "user.password_link",
    entityType: "user",
    entityId: id,
  })
  const { delivered } = await mailer.send({
    to: target.email,
    subject: "Choose a password for the Security Partners admin",
    react: createElement(ResetPasswordEmail, {
      name: target.name,
      url,
      expiresInMinutes: RECOVERY_TOKEN_EXPIRES_IN / 60,
    }),
  })
  return { url, emailDelivered: delivered }
}

/**
 * "View as": Better Auth's admin plugin creates a 1-hour session for the
 * target with impersonatedBy = actor, and keeps the actor's own session in a
 * signed admin_session cookie. Returns the Set-Cookie headers to forward.
 */
export async function startImpersonation(
  actor: Actor,
  id: string,
  requestHeaders: Headers
): Promise<{ user: UserItem; expiresAt: string; headers: Headers }> {
  need(actor, { user: ["impersonate"] })
  if (actor.impersonatorId)
    throw new AppError("CONFLICT", "Stop the current impersonation first")
  if (id === actor.userId)
    throw new AppError("VALIDATION_FAILED", "You cannot impersonate yourself")
  const db = getDb()
  const target = await loadTarget(db, id)
  assertMayTouch(actor, target)
  if (isBannedNow(target))
    throw new AppError("CONFLICT", "This user is suspended")
  const { headers, response } = await getAuth().api.impersonateUser({
    body: { userId: id },
    headers: requestHeaders,
    returnHeaders: true,
  })
  await writeAudit(db, actor, {
    action: "user.impersonate_start",
    entityType: "user",
    entityId: id,
    diff: { expiresAt: new Date(response.session.expiresAt).toISOString() },
  })
  return {
    user: toUserItem(target),
    expiresAt: new Date(response.session.expiresAt).toISOString(),
    headers,
  }
}

/** Ends "View as" and restores the impersonator's own session. */
export async function stopImpersonation(
  actor: Actor,
  requestHeaders: Headers
): Promise<{ headers: Headers }> {
  if (!actor.impersonatorId)
    throw new AppError("CONFLICT", "You are not impersonating anyone")
  const { headers } = await getAuth().api.stopImpersonating({
    headers: requestHeaders,
    returnHeaders: true,
  })
  await writeAudit(
    getDb(),
    { ...actor, userId: actor.impersonatorId, roles: [], impersonatorId: null },
    {
      action: "user.impersonate_stop",
      entityType: "user",
      entityId: actor.userId,
    }
  )
  return { headers }
}
```

`server/modules/users/routes.ts`:

```ts
import "server-only"

import { type Context, Hono } from "hono"

import { idParam } from "@/lib/schemas/api/params"
import {
  banUserInput,
  inviteUserInput,
  setRolesInput,
  updateUserInput,
  userListQuery,
} from "@/lib/schemas/api/users"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** Copies Better Auth's Set-Cookie headers (impersonation) onto the response. */
function forwardCookies(c: Context<AppEnv>, headers: Headers) {
  for (const cookie of headers.getSetCookie())
    c.header("Set-Cookie", cookie, { append: true })
}

export const usersRoutes = new Hono<AppEnv>()
  .get("/", can({ user: ["read"] }), zv("query", userListQuery), async (c) =>
    c.json(await service.listUsers(actorOf(c), c.req.valid("query")), 200)
  )
  .post(
    "/invite",
    can({ user: ["invite"] }),
    zv("json", inviteUserInput),
    async (c) =>
      c.json(await service.inviteUser(actorOf(c), c.req.valid("json")), 201)
  )
  // Any signed-in session that is an impersonation may end it.
  .post("/stop-impersonating", async (c) => {
    const { headers } = await service.stopImpersonation(
      actorOf(c),
      c.req.raw.headers
    )
    forwardCookies(c, headers)
    return c.json({ ok: true as const }, 200)
  })
  .get("/:id", can({ user: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getUser(actorOf(c), c.req.valid("param").id), 200)
  )
  .patch(
    "/:id",
    can({ user: ["update"] }),
    zv("param", idParam),
    zv("json", updateUserInput),
    async (c) =>
      c.json(
        await service.updateUser(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .put(
    "/:id/roles",
    can({ user: ["update"] }),
    zv("param", idParam),
    zv("json", setRolesInput),
    async (c) =>
      c.json(
        await service.setRoles(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/ban",
    can({ user: ["ban"] }),
    zv("param", idParam),
    zv("json", banUserInput),
    async (c) =>
      c.json(
        await service.banUser(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete("/:id/ban", can({ user: ["ban"] }), zv("param", idParam), async (c) =>
    c.json(await service.unbanUser(actorOf(c), c.req.valid("param").id), 200)
  )
  .get(
    "/:id/sessions",
    can({ user: ["read"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        {
          items: await service.listSessions(
            actorOf(c),
            c.req.valid("param").id
          ),
        },
        200
      )
  )
  .delete(
    "/:id/sessions",
    can({ user: ["revokeSessions"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.revokeSessions(actorOf(c), c.req.valid("param").id),
        200
      )
  )
  .post(
    "/:id/password-link",
    can({ user: ["update"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.createPasswordLink(actorOf(c), c.req.valid("param").id),
        200
      )
  )
  .post(
    "/:id/impersonate",
    can({ user: ["impersonate"] }),
    zv("param", idParam),
    async (c) => {
      const { headers, ...result } = await service.startImpersonation(
        actorOf(c),
        c.req.valid("param").id,
        c.req.raw.headers
      )
      forwardCookies(c, headers)
      return c.json(result, 200)
    }
  )
```

`server/api/app.ts` (full file):

```ts
import "server-only"

import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"

import type { AppEnv } from "@/server/api/context"
import {
  requireSignedIn,
  sessionMiddleware,
} from "@/server/api/middleware/auth"
import { limitBody } from "@/server/api/middleware/body-limit"
import { notFoundHandler, onError } from "@/server/api/middleware/error"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import { getAuth } from "@/server/auth/auth"
import { auditRoutes } from "@/server/modules/audit/routes"
import { healthRoutes } from "@/server/modules/health/routes"
import { usersRoutes } from "@/server/modules/users/routes"

/**
 * Admin API routes, chained so `hc<AdminApi>` sees every route type.
 * Later phases add `.route("/<resource>", <resource>Routes)` here.
 */
export const adminRoutes = new Hono<AppEnv>()
  .route("/audit", auditRoutes)
  .route("/users", usersRoutes)
export type AdminApi = typeof adminRoutes

/** Builds the API. Mount order follows spec §7; Phase 2 adds Better Auth + session middleware. */
export function createApp() {
  const api = new Hono<AppEnv>().basePath("/api")

  // 1. Global
  api.use("*", requestIdMiddleware)
  api.use("*", secureHeaders())
  api.use("*", async (c, next) => {
    c.set("actor", null)
    await next()
    c.header("X-Robots-Tag", "noindex")
  })
  api.onError(onError)
  api.notFound(notFoundHandler)

  // 2. Better Auth (sign-in, sign-out, password reset, two-factor)
  api.on(["GET", "POST"], "/auth/*", limitBody("public"), (c) =>
    getAuth().handler(c.req.raw)
  )

  // 3. Public endpoints (rate limit added in Phase 7)
  api.use("/v1/public/*", limitBody("public"))

  // 4. Admin endpoints: session → signed in → same origin → 1 MB body
  api.use(
    "/v1/admin/*",
    sessionMiddleware,
    requireSignedIn,
    sameOrigin(),
    limitBody("admin")
  )
  api.route("/v1/admin", adminRoutes)

  // 5. Health
  api.route("/v1/health", healthRoutes)

  return api
}

export const app = createApp()
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — `mailer.test.tsx` (3), `users.test.ts` (14), all earlier files green.

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm lint && pnpm typecheck`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml emails server/lib/mailer.ts server/auth/auth.ts lib/schemas/api/params.ts lib/schemas/api/users.ts server/modules/users server/api/app.ts tests/unit/mailer.test.tsx tests/integration/api/users.test.ts
git commit -m "feat: add users module with invites, roles, bans and impersonation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Public pages into the `app/(site)` route group (master Task 2.5, part 1)

**Files:**
- Move: `app/layout.tsx` → `app/(site)/layout.tsx` (one import path changes)
- Move: `app/page.tsx`, `app/about/`, `app/blog/`, `app/contact/`, `app/services/`, `app/team/` → `app/(site)/…`
- Unchanged: `app/globals.css`, `app/favicon.ico`, `app/api/[...route]/route.ts`

**Interfaces:**
- Produces: `app/(site)/layout.tsx` = the public root layout, byte-identical apart from `import "../globals.css"`. Task 6 adds the second root layout `app/(admin)/admin/layout.tsx`. Task 3.5 must not move the pages again (it only makes components props-driven).

This is a pure move (Next requires every top-level route inside a group once `app/layout.tsx` is gone). The guard is the Phase 0 visual suite, so the "failing test first" step is replaced by proving the suite is green before and after.

- [ ] **Step 1: Confirm the visual baseline is green before moving**

Port 3100 must be free (`lsof -iTCP:3100 -sTCP:LISTEN` prints nothing). Run: `pnpm test:visual`
Expected: `38 passed`.

- [ ] **Step 2: Move the public routes**

```bash
mkdir -p "app/(site)"
git mv app/layout.tsx app/page.tsx app/about app/blog app/contact app/services app/team "app/(site)/"
sed -i '' 's#import "./globals.css"#import "../globals.css"#' "app/(site)/layout.tsx"
grep -n 'globals.css' "app/(site)/layout.tsx"
```

Expected: `4:import "../globals.css"`. (On Linux use `sed -i` without `''`.) No other file in the moved folders uses a relative import (`grep -rn 'from "\./\|from "\.\./' "app/(site)"` prints nothing).

- [ ] **Step 3: Regenerate route types, build, typecheck**

Run: `pnpm exec next typegen && pnpm typecheck`
Expected: exit 0 (stale `.next/types/validator.ts` entries for `app/about/page.js` etc. are regenerated).

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: success; the route table lists the same public routes as before (`/`, `/about`, `/blog`, `/blog/[slug]` ×7, `/contact`, `/services`, `/services/[slug]` ×6, `/team`, `/api/[...route]`).

- [ ] **Step 4: Visual gate (0 px)**

Run: `pnpm test:visual`
Expected: `38 passed` (19 URLs × desktop + mobile, `maxDiffPixels: 0`).

Run: `pnpm lint && pnpm test`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app
git commit -m "refactor: move public pages into the (site) route group

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Verify: `git show --stat HEAD` lists only renames (`app/{… => (site)/…}`) plus the one-line change in `app/(site)/layout.tsx`.

---

### Task 6: Admin auth pages + proxy + E2E-lite (master Task 2.5, part 2)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (dev: `otpauth@9.5.2`; script `test:e2e`)
- Create (shadcn CLI): `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx`, `components/ui/alert.tsx`
- Create: `lib/auth/redirect.ts`, `lib/auth-client.ts`
- Create: `proxy.ts`
- Modify: `next.config.ts` (`experimental.authInterrupts`)
- Create: `app/(admin)/admin/layout.tsx` (root layout #2), `app/(admin)/admin/forbidden.tsx`
- Create: `app/(admin)/admin/(auth)/layout.tsx`, `(auth)/sign-in/page.tsx`, `(auth)/two-factor/page.tsx`, `(auth)/set-password/page.tsx`, `(auth)/reset-password/page.tsx`, `(auth)/forgot-password/page.tsx`
- Create: `app/(admin)/admin/(panel)/layout.tsx`, `app/(admin)/admin/(panel)/page.tsx`
- Create: `components/admin/auth/auth-card.tsx`, `form-messages.tsx`, `sign-in-form.tsx`, `two-factor-form.tsx`, `password-form.tsx`, `forgot-password-form.tsx`, `sign-out-button.tsx`
- Modify: `playwright.config.ts` (projects, `webServer.env`, `reuseExistingServer: false`), `.gitignore` (`/tests/e2e/.state/`)
- Create: `tests/e2e/env.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/seed.ts`, `tests/e2e/global.setup.ts`
- Test: `tests/unit/proxy.test.ts`, `tests/unit/auth/redirect.test.ts`, `tests/e2e/admin-auth.spec.ts`

**Interfaces:**
- Consumes: Tasks 2–4 (`/api/auth/*`, `requireSession`, `getAuth`, `createPasswordToken`, `passwordUrl`, `INVITE_TOKEN_EXPIRES_IN`, `PASSWORD_MIN_LENGTH/MAX_LENGTH`), Phase 1 `runMigrations`, `closeDb`, `getEnv`, `resetDb`, `pnpm tsx:server`, Phase 0 `playwright.config.ts` and `tests/visual/**`.
- Produces:

```ts
// lib/auth/redirect.ts
export const ADMIN_AUTH_PATHS: readonly ["/admin/sign-in", "/admin/two-factor", "/admin/set-password", "/admin/reset-password", "/admin/forgot-password"]
export const ADMIN_HOME = "/admin"
export function isAdminAuthPath(pathname: string): boolean
export function safeNext(next: string | null | undefined): string // same-site /admin paths only, never an auth page
// lib/auth-client.ts ("better-auth/react", same origin)
export const authClient // plugins: twoFactorClient(), inferAdditionalFields({ user: { title } })
export function authErrorMessage(error?: { status?; code?; message? } | null): string
// proxy.ts
export function proxy(request: NextRequest): NextResponse // no sp session cookie → 307 /admin/sign-in?next=<path+query>; always X-Robots-Tag: noindex
export const config = { matcher: ["/admin/:path*"] }
// tests/e2e
export const PORT, BASE_URL, E2E_ENV        // env.ts
export const FIXTURES_FILE, E2E_PASSWORD; export type E2EFixtures; export function readFixtures(); export function clientIpFor(title: string): string // fixtures.ts
```

- URLs: `/admin/sign-in?next=…&notice=password-set|password-reset|signed-out`, `/admin/two-factor?next=…`, `/admin/set-password?token=…` (invites), `/admin/reset-password?token=…` (forgot / admin link), `/admin/forgot-password`, `/admin` (placeholder dashboard).
- Playwright: projects `desktop`/`mobile` (visual only), `e2e-setup` (`tests/e2e/global.setup.ts` migrates + seeds `sp_e2e`), `e2e` (depends on setup). `pnpm test:visual` and `pnpm test:e2e` each build and start `next start -p 3100` with `E2E_ENV` (`DATABASE_URL` = `E2E_DATABASE_URL` ?? `postgres://sp:sp@127.0.0.1:5432/sp_e2e`, fixed test secret, `BETTER_AUTH_URL=http://127.0.0.1:3100`).

- [ ] **Step 1: Dependencies, shadcn primitives, scripts**

```bash
pnpm add -D --save-exact otpauth@9.5.2
pnpm exec shadcn add input label card alert --yes
pnpm pkg set scripts.test:e2e="playwright test tests/e2e"
grep -qxF '/tests/e2e/.state/' .gitignore || printf '\n# e2e fixtures written by tests/e2e/seed.ts\n/tests/e2e/.state/\n' >> .gitignore
```

Expected: `✔ Created 4 files: components/ui/input.tsx, components/ui/label.tsx, components/ui/card.tsx, components/ui/alert.tsx` and no other file changed (`git status --short` shows the 4 files, `package.json`, `pnpm-lock.yaml`, `.gitignore`). The pages below use only `Input`, `Label`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Alert`, `AlertDescription`. The CLI output verified for this plan (shadcn 4.21.4, style base-nova) is below; if the registry returns something different, overwrite the files with this content:

`components/ui/input.tsx`:

```tsx
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

`components/ui/label.tsx`:

```tsx
"use client"

import * as React from "react"
import { cn } from "cn"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
```

`components/ui/card.tsx`:

```tsx
import * as React from "react"
import { cn } from "cn"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
```

`components/ui/alert.tsx`:

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
```


- [ ] **Step 2: Write the failing unit tests**

`tests/unit/proxy.test.ts`:

```ts
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { config, proxy } from "@/proxy"

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://127.0.0.1:3100"), {
    headers: cookie ? { cookie } : {},
  })

describe("proxy.ts (optimistic /admin gate)", () => {
  it("matches /admin only (never /api: upload bodies must not be buffered)", () => {
    expect(config.matcher).toEqual(["/admin/:path*"])
  })

  it("redirects /admin without a session cookie to /admin/sign-in?next=/admin", () => {
    const res = proxy(request("/admin"))
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.pathname).toBe("/admin/sign-in")
    expect(location.searchParams.get("next")).toBe("/admin")
    expect(res.headers.get("x-robots-tag")).toBe("noindex")
  })

  it("keeps the query string in next", () => {
    const res = proxy(request("/admin/users?page=2"))
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.searchParams.get("next")).toBe("/admin/users?page=2")
  })

  it("lets the auth pages through without a cookie", () => {
    for (const path of [
      "/admin/sign-in",
      "/admin/two-factor",
      "/admin/set-password",
      "/admin/reset-password",
      "/admin/forgot-password",
    ]) {
      const res = proxy(request(path))
      expect(res.headers.get("location"), path).toBeNull()
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })

  it("lets requests with a session cookie through (http and https cookie names)", () => {
    for (const cookie of [
      "sp.session_token=abc.def",
      "__Secure-sp.session_token=abc.def",
    ]) {
      const res = proxy(request("/admin", cookie))
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })

  it("does not treat look-alike paths as auth pages", () => {
    expect(proxy(request("/admin/sign-in-later")).status).toBe(307)
  })
})
```

`tests/unit/auth/redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { isAdminAuthPath, safeNext } from "@/lib/auth/redirect"

describe("safeNext", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/users?page=2#top", "/admin/users?page=2#top"],
    ["/admin/account", "/admin/account"],
  ])("keeps admin path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })

  it.each([
    null,
    undefined,
    "",
    "https://evil.example/admin",
    "//evil.example/admin",
    "/\\evil.example",
    "/blog",
    "/administrator",
    "/admin/sign-in",
    "/admin/two-factor?next=/admin",
    "javascript:alert(1)",
  ])("falls back to /admin for %s", (input) => {
    expect(safeNext(input)).toBe("/admin")
  })
})

describe("isAdminAuthPath", () => {
  it("matches the five auth pages only", () => {
    expect(isAdminAuthPath("/admin/set-password")).toBe(true)
    expect(isAdminAuthPath("/admin/sign-in/")).toBe(true)
    expect(isAdminAuthPath("/admin")).toBe(false)
    expect(isAdminAuthPath("/admin/sign-in-later")).toBe(false)
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test:unit tests/unit/proxy.test.ts tests/unit/auth/redirect.test.ts`
Expected: FAIL — `Failed to resolve import "@/proxy"` and `"@/lib/auth/redirect"`.

- [ ] **Step 4: Redirect helpers and proxy**

`lib/auth/redirect.ts`:

```ts
/** Admin pages reachable without a session (proxy.ts lets them through). */
export const ADMIN_AUTH_PATHS = [
  "/admin/sign-in",
  "/admin/two-factor",
  "/admin/set-password",
  "/admin/reset-password",
  "/admin/forgot-password",
] as const

export const ADMIN_HOME = "/admin"

export function isAdminAuthPath(pathname: string): boolean {
  return ADMIN_AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

/**
 * Where to go after signing in. Only same-site admin paths are allowed (no
 * open redirects via `?next=https://evil` or `//evil`), and never back to an
 * auth page.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return ADMIN_HOME
  if (next.includes("\\")) return ADMIN_HOME
  let url: URL
  try {
    url = new URL(next, "http://local.invalid")
  } catch {
    return ADMIN_HOME
  }
  if (url.origin !== "http://local.invalid") return ADMIN_HOME
  if (url.pathname !== ADMIN_HOME && !url.pathname.startsWith(`${ADMIN_HOME}/`))
    return ADMIN_HOME
  if (isAdminAuthPath(url.pathname)) return ADMIN_HOME
  return `${url.pathname}${url.search}${url.hash}`
}
```

`proxy.ts`:

```ts
import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

import { isAdminAuthPath } from "@/lib/auth/redirect"

/**
 * Admin gate, optimistic only: checks that a session cookie is present (no
 * DB). The real checks are requireSession() in the panel layout and the Hono
 * middleware. Matches /admin only: /api is excluded so upload bodies are never
 * buffered here (X-Robots-Tag for /api is set by Hono).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  let response: NextResponse
  if (
    !isAdminAuthPath(pathname) &&
    !getSessionCookie(request, { cookiePrefix: "sp" })
  ) {
    const signIn = new URL("/admin/sign-in", request.url)
    signIn.searchParams.set("next", `${pathname}${search}`)
    response = NextResponse.redirect(signIn)
  } else {
    response = NextResponse.next()
  }
  response.headers.set("X-Robots-Tag", "noindex")
  return response
}

export const config = {
  matcher: ["/admin/:path*"],
}
```

Run: `pnpm test:unit tests/unit/proxy.test.ts tests/unit/auth/redirect.test.ts`
Expected: PASS — 6 + 15 tests.

- [ ] **Step 5: Write the E2E harness and the failing E2E spec**

`playwright.config.ts` (full file; keeps Phase 0's snapshot settings):

```ts
import { defineConfig, devices } from "@playwright/test"

import { E2E_ENV, PORT } from "./tests/e2e/env"

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  snapshotPathTemplate: "{testDir}/visual/__screenshots__/{arg}-{projectName}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0, animations: "disabled", caret: "hide", scale: "css" },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop", testMatch: "visual/**/*.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", testMatch: "visual/**/*.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: false, hasTouch: true } },
    // Admin E2E: migrate + seed sp_e2e first (tests/e2e/global.setup.ts).
    { name: "e2e-setup", testMatch: "e2e/global.setup.ts" },
    { name: "e2e", testMatch: "e2e/**/*.spec.ts", dependencies: ["e2e-setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // Always start our own server: a stale one on the port would serve old
    // code or lack the E2E env (port must be free).
    reuseExistingServer: false,
    timeout: 300_000,
    // `next start` never reads .env.development; the server gets the E2E
    // database and auth env here (the build itself needs none).
    env: E2E_ENV,
  },
})
```

`tests/e2e/env.ts`:

```ts
// Shared by playwright.config.ts (webServer env) and the E2E setup/specs.
export const PORT = Number(process.env.PW_PORT ?? 3100)
export const BASE_URL = `http://127.0.0.1:${PORT}`

/** The server under test and the seed script both use exactly these values. */
export const E2E_ENV = {
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ?? "postgres://sp:sp@127.0.0.1:5432/sp_e2e",
  BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
  BETTER_AUTH_URL: BASE_URL,
}
```

`tests/e2e/fixtures.ts`:

```ts
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/** Written by tests/e2e/seed.ts, read by the specs (gitignored). */
export const FIXTURES_FILE = resolve("tests/e2e/.state/fixtures.json")
export const E2E_PASSWORD = "e2e-password-0123456789"

export type E2EFixtures = {
  editor: { email: string; name: string }
  invitee: { email: string; name: string; inviteUrl: string }
  twoFactor: { email: string; name: string; totpUri: string }
  account: { email: string; name: string }
}

/**
 * `next start` runs with production rate limits (sign-in 5/min per IP, keyed
 * on X-Forwarded-For). Each test signs in from its own documentation-range
 * address so the suite never trips a limit meant for one client.
 */
export function clientIpFor(testTitle: string): string {
  const [a, b] = createHash("sha256").update(testTitle).digest()
  return `198.18.${a}.${b}`
}

export function readFixtures(): E2EFixtures {
  return JSON.parse(readFileSync(FIXTURES_FILE, "utf8")) as E2EFixtures
}
```

`tests/e2e/seed.ts`:

```ts
// Prepares sp_e2e for the admin E2E specs. Run by tests/e2e/global.setup.ts:
//   pnpm tsx:server tests/e2e/seed.ts   (env from tests/e2e/env.ts)
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { URI } from "otpauth"

import { getAuth } from "@/server/auth/auth"
import {
  createPasswordToken,
  INVITE_TOKEN_EXPIRES_IN,
  passwordUrl,
} from "@/server/auth/tokens"
import { closeDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import { getEnv } from "@/server/env"

import { resetDb } from "../integration/db"

import { E2E_PASSWORD, type E2EFixtures, FIXTURES_FILE } from "./fixtures"

const { DATABASE_URL } = getEnv()
if (new URL(DATABASE_URL).pathname !== "/sp_e2e")
  throw new Error(
    `Refusing to reset a non-E2E database (${new URL(DATABASE_URL).pathname})`
  )

await runMigrations(DATABASE_URL)
await resetDb()
const auth = getAuth()

const editor = { email: "editor@e2e.test", name: "Edith Editor" }
await auth.api.createUser({
  body: { ...editor, role: ["editor"], password: E2E_PASSWORD },
})

const invitee = { email: "invitee@e2e.test", name: "Ivy Invitee" }
const { user: invited } = await auth.api.createUser({
  body: { ...invitee, role: ["viewer"] },
})
const inviteUrl = passwordUrl(
  "set-password",
  await createPasswordToken(invited.id, INVITE_TOKEN_EXPIRES_IN)
)

// Two-factor user: sign in, enable TOTP, confirm with a generated code.
const twoFactor = { email: "twofactor@e2e.test", name: "Tess Twofactor" }
await auth.api.createUser({
  body: { ...twoFactor, role: ["admin"], password: E2E_PASSWORD },
})
const signedIn = await auth.api.signInEmail({
  body: { email: twoFactor.email, password: E2E_PASSWORD },
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

// Account page user (Task 2.6): turns 2FA on through the UI.
const account = { email: "account@e2e.test", name: "Avery Account" }
await auth.api.createUser({
  body: { ...account, role: ["editor"], password: E2E_PASSWORD },
})

const fixtures: E2EFixtures = {
  editor,
  invitee: { ...invitee, inviteUrl },
  twoFactor: { ...twoFactor, totpUri: enabled.totpURI },
  account,
}
mkdirSync(dirname(FIXTURES_FILE), { recursive: true })
writeFileSync(FIXTURES_FILE, JSON.stringify(fixtures, null, 2))
await closeDb()
console.log("[e2e] sp_e2e migrated and seeded")
```

`tests/e2e/global.setup.ts`:

```ts
import { execFileSync } from "node:child_process"

import { test as setup } from "@playwright/test"

import { E2E_ENV } from "./env"

// Runs before the "e2e" project (playwright.config.ts dependencies). The seed
// imports server code, so it runs under tsx with the server-only hook.
setup("migrate and seed sp_e2e", () => {
  execFileSync("pnpm", ["tsx:server", "tests/e2e/seed.ts"], {
    stdio: "inherit",
    env: { ...process.env, ...E2E_ENV },
  })
})
```

`tests/e2e/admin-auth.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"
import { URI } from "otpauth"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

test.describe("admin auth pages + proxy (Task 2.5)", () => {
  test("/admin without a session cookie redirects to /admin/sign-in?next=/admin", async ({
    page,
    request,
  }) => {
    const res = await request.get("/admin", { maxRedirects: 0 })
    expect(res.status()).toBe(307)
    const location = new URL(res.headers().location, "http://localhost")
    expect(location.pathname).toBe("/admin/sign-in")
    expect(location.searchParams.get("next")).toBe("/admin")

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/)
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  })

  test("/admin/* and /api/* responses carry X-Robots-Tag: noindex; the public site does not", async ({
    request,
  }) => {
    for (const path of [
      "/admin",
      "/admin/sign-in",
      "/admin/forgot-password",
      "/api/v1/health/live",
      "/api/auth/get-session",
      "/api/v1/does-not-exist",
    ]) {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(res.headers()["x-robots-tag"], path).toBe("noindex")
    }
    const home = await request.get("/")
    expect(home.status()).toBe(200)
    expect(home.headers()["x-robots-tag"]).toBeUndefined()
  })

  test("a wrong password shows an error and stays on sign-in", async ({
    page,
  }) => {
    const { editor } = readFixtures()
    await page.goto("/admin/sign-in")
    await signIn(page, editor.email, "not-the-right-password")
    await expect(
      page.getByText("Email or password is incorrect.")
    ).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/sign-in/)
  })

  test("set-password flow works with an invite token (single use)", async ({
    page,
  }) => {
    const { invitee } = readFixtures()
    const password = "invited-user-password-1"
    await page.goto(invitee.inviteUrl)
    await expect(
      page.getByRole("heading", { name: "Set your password" })
    ).toBeVisible()
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByLabel("Repeat password").fill(password)
    await page.getByRole("button", { name: "Set password" }).click()

    await expect(page).toHaveURL(/\/admin\/sign-in\?notice=password-set$/)
    await expect(
      page.getByText("Your password is set. Sign in to continue.")
    ).toBeVisible()
    await signIn(page, invitee.email, password)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${invitee.name}` })
    ).toBeVisible()

    await page.goto(invitee.inviteUrl)
    await page
      .getByLabel("Password", { exact: true })
      .fill("another-password-22")
    await page.getByLabel("Repeat password").fill("another-password-22")
    await page.getByRole("button", { name: "Set password" }).click()
    await expect(
      page.getByText("This link has expired or was already used.")
    ).toBeVisible()
  })

  test("the two-factor challenge page is shown when 2FA is enabled", async ({
    page,
  }) => {
    const { twoFactor } = readFixtures()
    await page.goto("/admin/sign-in?next=%2Fadmin")
    await signIn(page, twoFactor.email, E2E_PASSWORD)
    await expect(page).toHaveURL(/\/admin\/two-factor\?next=%2Fadmin$/)
    await expect(
      page.getByRole("heading", { name: "Two-factor authentication" })
    ).toBeVisible()

    await page.getByLabel("Authentication code").fill("000000")
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page.getByText("That code is not valid.")).toBeVisible()

    await page
      .getByLabel("Authentication code")
      .fill(URI.parse(twoFactor.totpUri).generate())
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${twoFactor.name}` })
    ).toBeVisible()
  })

  test("sign out returns to sign-in and /admin is gated again", async ({
    page,
  }) => {
    const { editor } = readFixtures()
    await page.goto("/admin/sign-in")
    await signIn(page, editor.email, E2E_PASSWORD)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${editor.name}` })
    ).toBeVisible()
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/admin\/sign-in\?notice=signed-out$/)
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/)
  })

  test("forgot password answers the same for any email", async ({ page }) => {
    await page.goto("/admin/forgot-password")
    await page.getByLabel("Email").fill("nobody@e2e.test")
    await page.getByRole("button", { name: "Send reset link" }).click()
    await expect(
      page.getByText("If nobody@e2e.test has an admin account")
    ).toBeVisible()
  })

  test("sign-in is rate limited in production: the 6th attempt in a minute → 429", async ({
    request,
  }) => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await request.post("/api/auth/sign-in/email", {
        headers: { "x-forwarded-for": "198.18.255.1", origin: BASE_URL },
        data: { email: "nobody@e2e.test", password: "wrong-password-123" },
      })
      statuses.push(res.status())
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429])
  })

  test("public pages still render from the (site) group; unknown URLs are 404", async ({
    request,
  }) => {
    const home = await request.get("/")
    expect(await home.text()).toContain(
      "Security Partners Ltd. | Watching Over You"
    )
    expect((await request.get("/this-page-does-not-exist")).status()).toBe(404)
  })
})
```


Run: `pnpm test:e2e`
Expected: the `e2e-setup` project passes (`[e2e] sp_e2e migrated and seeded`), then most `e2e` tests FAIL — the proxy already redirects `/admin` (307) but `/admin/sign-in` is a 404, so `getByRole('heading', { name: 'Sign in' })` is not found; the rate-limit and X-Robots-Tag tests may already pass.

- [ ] **Step 6: Auth client, admin root layout, auth pages**

`lib/auth-client.ts`:

```ts
import {
  inferAdditionalFields,
  twoFactorClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/**
 * Browser client for /api/auth (same origin). Admin-plugin endpoints are not
 * exposed over HTTP; user management goes through /api/v1/admin/users.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    twoFactorClient(),
    inferAdditionalFields({
      user: { title: { type: "string", required: false } },
    }),
  ],
})

/** Readable messages for Better Auth error codes shown on the admin auth pages. */
export function authErrorMessage(
  error: { status?: number; code?: string; message?: string } | null | undefined
): string {
  if (!error) return "Something went wrong. Try again."
  if (error.status === 429)
    return "Too many attempts. Wait a minute and try again."
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email or password is incorrect."
    case "BANNED_USER":
      return "This account is suspended. Contact an administrator."
    case "INVALID_CODE":
    case "INVALID_BACKUP_CODE":
      return "That code is not valid. Check your authenticator app and try again."
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "Your sign-in expired. Sign in again."
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "Too many wrong codes. Two-factor sign-in is locked for 15 minutes."
    case "INVALID_TOKEN":
      return "This link has expired or was already used. Ask an administrator for a new one."
    case "PASSWORD_TOO_SHORT":
      return "Use at least 12 characters."
    case "PASSWORD_TOO_LONG":
      return "Use at most 128 characters."
    case "INVALID_PASSWORD":
      return "Your current password is incorrect."
    default:
      return error.message || "Something went wrong. Try again."
  }
}
```

`next.config.ts` (full file):

```ts
import type { NextConfig } from "next"

// "standalone" traces only the files the server needs, so the Docker image
// ships a small server.js instead of the full node_modules.
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // forbidden() from requirePermission() renders app/(admin)/admin/forbidden.tsx
    authInterrupts: true,
  },
}

export default nextConfig
```

`app/(admin)/admin/layout.tsx`:

```tsx
import type { Metadata } from "next"
import { Geist_Mono, Lato } from "next/font/google"

import "../../globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Admin · Security Partners",
    template: "%s · Security Partners admin",
  },
  robots: { index: false, follow: false },
}

/** Root layout for /admin (separate from the public site's root layout). */
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IE"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        lato.variable
      )}
    >
      <body className="min-h-svh bg-muted/40">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

`app/(admin)/admin/forbidden.tsx`:

```tsx
import Link from "next/link"

/** Rendered (403) when requirePermission() calls forbidden(). */
export default function Forbidden() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex max-w-sm flex-col gap-3 text-center">
        <h1 className="text-xl font-bold">
          You do not have access to this page
        </h1>
        <p className="text-sm text-muted-foreground">
          Your role does not include this area. Ask an owner or administrator if
          you need it.
        </p>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Back to the dashboard
        </Link>
      </div>
    </main>
  )
}
```

`app/(admin)/admin/(auth)/layout.tsx`:

```tsx
import Image from "next/image"

/** Centered card frame for sign-in, two-factor and password pages. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="relative h-[52px] w-[86px]">
            <Image
              src="/images/logo.png"
              alt="Security Partners Ltd."
              fill
              sizes="86px"
              className="object-contain"
              loading="eager"
            />
          </div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Website admin
          </p>
        </div>
        {children}
      </div>
    </main>
  )
}
```

`components/admin/auth/auth-card.tsx`:

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/** Card used by every admin auth page: h1 title, one-line description, form. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-lg font-bold">{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
```

`components/admin/auth/form-messages.tsx`:

```tsx
import { CircleAlert, CircleCheck } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <Alert role="status">
      <CircleCheck aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
```

`components/admin/auth/sign-in-form.tsx`:

```tsx
"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { safeNext } from "@/lib/auth/redirect"
import { authClient, authErrorMessage } from "@/lib/auth-client"

import { FormError, FormNotice } from "./form-messages"

const NOTICES: Record<string, string> = {
  "password-set": "Your password is set. Sign in to continue.",
  "password-reset": "Password changed. Sign in with your new password.",
  "signed-out": "You are signed out.",
}

export function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get("next"))
  const notice = NOTICES[params.get("notice") ?? ""]
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const { data, error: failure } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    })
    if (failure) {
      setError(authErrorMessage(failure))
      setPending(false)
      return
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push(`/admin/two-factor?next=${encodeURIComponent(next)}`)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {notice && !error ? <FormNotice>{notice}</FormNotice> : null}
      {error ? <FormError>{error}</FormError> : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/admin/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
```

`components/admin/auth/two-factor-form.tsx`:

```tsx
"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button, buttonClassName } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { safeNext } from "@/lib/auth/redirect"
import { authClient, authErrorMessage } from "@/lib/auth-client"

import { FormError } from "./form-messages"

const EXPIRED = new Set([
  "INVALID_TWO_FACTOR_COOKIE",
  "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
])

export function TwoFactorForm() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const [method, setMethod] = useState<"totp" | "backup">("totp")
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const code = String(form.get("code") ?? "").replace(/\s+/g, "")
    const trustDevice = form.get("trustDevice") === "on"
    setPending(true)
    setError(null)
    const { error: failure } =
      method === "totp"
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice })
        : await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
    if (failure) {
      setError(authErrorMessage(failure))
      setExpired(EXPIRED.has(failure.code ?? ""))
      setPending(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <FormError>{error}</FormError> : null}
      {expired ? (
        <Link
          href={`/admin/sign-in?next=${encodeURIComponent(next)}`}
          className={buttonClassName({ variant: "outline", size: "lg" })}
        >
          Back to sign in
        </Link>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="code">
              {method === "totp" ? "Authentication code" : "Backup code"}
            </Label>
            <Input
              key={method}
              id="code"
              name="code"
              required
              autoFocus
              autoComplete="one-time-code"
              {...(method === "totp"
                ? {
                    inputMode: "numeric" as const,
                    pattern: "[0-9 ]{6,7}",
                    maxLength: 7,
                    placeholder: "123456",
                  }
                : { maxLength: 32 })}
            />
            <p className="text-xs text-muted-foreground">
              {method === "totp"
                ? "Enter the 6-digit code from your authenticator app."
                : "Enter one of the backup codes you saved when you turned on two-factor authentication. Each code works once."}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="trustDevice"
              className="size-4 accent-primary"
            />
            Trust this device for 30 days
          </label>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Checking…" : "Verify"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setMethod(method === "totp" ? "backup" : "totp")
              setError(null)
            }}
          >
            {method === "totp"
              ? "Use a backup code instead"
              : "Use your authenticator app instead"}
          </button>
        </>
      )}
    </form>
  )
}
```

`components/admin/auth/password-form.tsx`:

```tsx
"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { authClient, authErrorMessage } from "@/lib/auth-client"

import { FormError } from "./form-messages"

/**
 * Sets a password from a single-use token: "set" for invites (first
 * password), "reset" for forgot-password and admin-issued links. Both call
 * POST /api/auth/reset-password; other sessions are signed out.
 */
export function PasswordForm({ mode }: { mode: "set" | "reset" }) {
  const router = useRouter()
  const token = useSearchParams().get("token")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!token)
    return (
      <div className="flex flex-col gap-4">
        <FormError>
          This link is incomplete. Open the link from your email again, or ask
          an administrator for a new one.
        </FormError>
        <Link
          href="/admin/sign-in"
          className="text-center text-sm underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const confirm = String(form.get("confirm") ?? "")
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("The two passwords do not match.")
      return
    }
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.resetPassword({
      newPassword: password,
      token: token as string,
    })
    if (failure) {
      setError(authErrorMessage(failure))
      setPending(false)
      return
    }
    router.replace(
      `/admin/sign-in?notice=${mode === "set" ? "password-set" : "password-reset"}`
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <FormError>{error}</FormError> : null}
      <div className="grid gap-2">
        <Label htmlFor="password">
          {mode === "set" ? "Password" : "New password"}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
          autoFocus
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least {PASSWORD_MIN_LENGTH} characters. A short sentence is easy to
          remember and hard to guess.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Repeat password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending
          ? "Saving…"
          : mode === "set"
            ? "Set password"
            : "Change password"}
      </Button>
    </form>
  )
}
```

`components/admin/auth/forgot-password-form.tsx`:

```tsx
"use client"

import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, authErrorMessage } from "@/lib/auth-client"

import { FormError, FormNotice } from "./form-messages"

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(
      new FormData(event.currentTarget).get("email") ?? ""
    ).trim()
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.requestPasswordReset({ email })
    setPending(false)
    // The answer is the same whether or not the account exists.
    if (failure && failure.status === 429) {
      setError(authErrorMessage(failure))
      return
    }
    setSentTo(email)
  }

  if (sentTo)
    return (
      <div className="flex flex-col gap-4">
        <FormNotice>
          If {sentTo} has an admin account, a reset link is on its way. It works
          once and expires in 1 hour. No email after a few minutes? Email may
          not be set up yet: ask an administrator for a password link.
        </FormNotice>
        <Link
          href="/admin/sign-in"
          className="text-center text-sm underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <FormError>{error}</FormError> : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link
        href="/admin/sign-in"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  )
}
```

`components/admin/auth/sign-out-button.tsx`:

```tsx
"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await authClient.signOut()
        router.replace("/admin/sign-in?notice=signed-out")
        router.refresh()
      }}
    >
      <LogOut aria-hidden />
      Sign out
    </Button>
  )
}
```

`app/(admin)/admin/(auth)/sign-in/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { SignInForm } from "@/components/admin/auth/sign-in-form"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Use your Security Partners admin account."
    >
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  )
}
```

`app/(admin)/admin/(auth)/two-factor/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { TwoFactorForm } from "@/components/admin/auth/two-factor-form"

export const metadata: Metadata = { title: "Two-factor authentication" }

export default function TwoFactorPage() {
  return (
    <AuthCard
      title="Two-factor authentication"
      description="One more step: confirm it is you."
    >
      <Suspense fallback={null}>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  )
}
```

`app/(admin)/admin/(auth)/set-password/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { PasswordForm } from "@/components/admin/auth/password-form"

export const metadata: Metadata = { title: "Set your password" }

export default function SetPasswordPage() {
  return (
    <AuthCard
      title="Set your password"
      description="Choose a password to activate your admin account."
    >
      <Suspense fallback={null}>
        <PasswordForm mode="set" />
      </Suspense>
    </AuthCard>
  )
}
```

`app/(admin)/admin/(auth)/reset-password/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { PasswordForm } from "@/components/admin/auth/password-form"

export const metadata: Metadata = { title: "Choose a new password" }

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="Your other sessions will be signed out."
    >
      <Suspense fallback={null}>
        <PasswordForm mode="reset" />
      </Suspense>
    </AuthCard>
  )
}
```

`app/(admin)/admin/(auth)/forgot-password/page.tsx`:

```tsx
import type { Metadata } from "next"

import { AuthCard } from "@/components/admin/auth/auth-card"
import { ForgotPasswordForm } from "@/components/admin/auth/forgot-password-form"

export const metadata: Metadata = { title: "Forgot password" }

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="We will email you a link to choose a new one."
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
```


- [ ] **Step 7: Minimal signed-in panel (replaced by the Phase 4 shell)**

`app/(admin)/admin/(panel)/layout.tsx` (full file):

```tsx
import Link from "next/link"
import { Suspense } from "react"

import { SignOutButton } from "@/components/admin/auth/sign-out-button"
import { requireSession } from "@/server/auth/session"

/**
 * Minimal signed-in frame until the Phase 4 shell replaces it (sidebar, ⌘K,
 * impersonation banner). The session is read fresh inside Suspense.
 */
export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  )
}

async function PanelFrame({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <Link href="/admin" className="font-bold text-brand-navy">
            Security Partners
          </Link>
          <nav aria-label="Admin" className="flex items-center gap-4 text-sm">
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  )
}
```

`app/(admin)/admin/(panel)/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

/** Placeholder landing page until the Phase 4 dashboard (Task 4.7). */
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  )
}

async function Welcome() {
  const { user } = await requireSession()
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      <p className="text-muted-foreground">
        You are signed in to the Security Partners admin.
      </p>
    </section>
  )
}
```

- [ ] **Step 8: Run everything**

Run: `pnpm exec next typegen && pnpm lint && pnpm typecheck`
Expected: exit 0.

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: success; route table adds `ƒ /admin`, `○ /admin/forgot-password`, `○ /admin/reset-password`, `○ /admin/set-password`, `○ /admin/sign-in`, `○ /admin/two-factor` and `ƒ Proxy (Middleware)`.

Run: `pnpm test:e2e`
Expected: `10 passed` (setup + 9 specs). The webServer log shows `WARN [Better Auth]: Invalid password` / `Reset Password: User not found` (expected for the negative tests) and Phase 0's `"next start" does not work with "output: standalone"` warning (pre-existing).

Run: `pnpm test:visual`
Expected: `38 passed` — the admin root layout does not touch the public pages.

Run: `pnpm test`
Expected: PASS (unit: `proxy.test.ts` 6, `redirect.test.ts` 15; integration unchanged).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore components/ui/input.tsx components/ui/label.tsx components/ui/card.tsx components/ui/alert.tsx lib/auth/redirect.ts lib/auth-client.ts proxy.ts next.config.ts "app/(admin)" components/admin/auth playwright.config.ts tests/e2e tests/unit/proxy.test.ts tests/unit/auth/redirect.test.ts
git commit -m "feat: add admin sign-in, two-factor and password pages with proxy gate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Check: `git status --short` is clean and `tests/e2e/.state/fixtures.json` is not tracked.

---

### Task 7: Account security (2FA, password, sessions) + bootstrap scripts (master Task 2.6)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (`qrcode@1.5.4`, dev `@types/qrcode@1.5.6`; scripts `admin:create`, `owner:recover`, `demo:seed`)
- Create: `lib/format.ts`
- Modify: `server/auth/hooks.ts` (impersonation sessions cannot change account settings)
- Create: `server/db/seed/guard.ts`
- Create: `server/modules/users/bootstrap.ts`
- Create: `scripts/lib/run-script.ts`, `scripts/admin-create.ts`, `scripts/owner-recover.ts`, `scripts/demo-seed.ts`
- Modify: `scripts/build-scripts.ts` (`SCRIPT_ENTRIES`)
- Create: `components/admin/account/account-section.tsx`, `profile-form.tsx`, `change-password-form.tsx`, `two-factor-settings.tsx`, `sessions-list.tsx`
- Create: `app/(admin)/admin/(panel)/account/page.tsx`
- Modify: `app/(admin)/admin/(panel)/layout.tsx` (Account link)
- Test: `tests/unit/format.test.ts`, `tests/unit/seed-guard.test.ts`, `tests/integration/auth/account.test.ts`, `tests/integration/users/bootstrap.test.ts`, `tests/integration/users/scripts.test.ts`, `tests/e2e/account.spec.ts`

**Interfaces:**
- Consumes: everything above; Better Auth endpoints `/two-factor/enable|verify-totp|verify-backup-code|generate-backup-codes|disable`, `/change-password`, `/list-sessions`, `/revoke-session`, `/revoke-other-sessions`, `/update-user`; `SCRIPT_ENTRIES`/`buildScripts` (Phase 1).
- Produces:

```ts
// lib/format.ts
export const SITE_TIME_ZONE = "Europe/Dublin", SITE_LOCALE = "en-IE"
export function formatDateTime(value: string | Date): string // "16 Oct 2026, 14:05"
export function describeUserAgent(userAgent: string | null | undefined): string // "Chrome on macOS"
// server/db/seed/guard.ts
export function describeDatabase(url: string): string // host:port/db, never credentials
export function isDisposableDatabase(url: string): boolean // db name ends _dev|_test|_e2e or host localhost/127.0.0.1/::1
export function assertDisposable(url: string, allowProduction: boolean): void // throws "... Re-run with --allow-production ..."
// server/modules/users/bootstrap.ts
export type LinkResult = { userId: string; url: string; emailDelivered: boolean }
export async function createOwner(input: { email: string; name: string }): Promise<LinkResult> // admin:create
export async function recoverOwner(input: { email: string }): Promise<LinkResult>             // owner:recover
export const DEMO_EMAIL_DOMAIN = "demo.local"; export type DemoUser = { email; role; created }
export async function seedDemoUsers(password: string): Promise<DemoUser[]>                    // demo:seed
// scripts/lib/run-script.ts
export async function runScript(name: string, main: () => Promise<void>): Promise<void>
// scripts/build-scripts.ts
export const SCRIPT_ENTRIES = ["migrate", "admin-create", "owner-recover", "demo-seed"] as const
```

- Commands (dev, `.env.development`): `pnpm admin:create --email <e> --name "<n>"`, `pnpm owner:recover --email <e>`, `pnpm demo:seed --password "<12+>" [--allow-production]`. Container: `node scripts/dist/<name>.mjs …` (self-contained bundles, verified to run without `node_modules`). Audit: `user.invite` (`diff.via: "admin:create"`), `user.owner_recover` (`diff: { via, twoFactorCleared, sessionsRevoked }`), actor `null`.

- [ ] **Step 1: Dependencies and script entries**

```bash
pnpm add --save-exact qrcode@1.5.4
pnpm add -D --save-exact @types/qrcode@1.5.6
pnpm pkg set scripts.admin:create="pnpm tsx:server scripts/admin-create.ts"
pnpm pkg set scripts.owner:recover="pnpm tsx:server scripts/owner-recover.ts"
pnpm pkg set scripts.demo:seed="pnpm tsx:server scripts/demo-seed.ts"
```

In `scripts/build-scripts.ts` replace `export const SCRIPT_ENTRIES = ["migrate"] as const` with:

```ts
export const SCRIPT_ENTRIES = [
  "migrate",
  "admin-create",
  "owner-recover",
  "demo-seed",
] as const
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/format.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { describeUserAgent, formatDateTime } from "@/lib/format"

describe("formatDateTime (Europe/Dublin, en-IE)", () => {
  it("shows Irish summer time (UTC+1)", () => {
    expect(formatDateTime("2026-07-01T12:30:00Z")).toBe("1 Jul 2026, 13:30")
  })

  it("shows Irish winter time (UTC+0)", () => {
    expect(formatDateTime(new Date("2026-12-24T09:05:00Z"))).toBe(
      "24 Dec 2026, 09:05"
    )
  })
})

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Chrome on macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari on iOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      "Firefox on Linux",
    ],
    ["curl/8.7.1", "Unknown device"],
    [null, "Unknown device"],
  ])("%s → %s", (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected)
  })
})
```

`tests/unit/seed-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  assertDisposable,
  describeDatabase,
  isDisposableDatabase,
} from "@/server/db/seed/guard"

describe("seed guard (spec §14)", () => {
  it.each([
    "postgres://sp:sp@db.internal:5432/sp_dev",
    "postgres://sp:sp@db.internal:5432/sp_test",
    "postgres://sp:sp@db.internal:5432/security_e2e",
    "postgres://sp:sp@localhost:5432/security",
    "postgres://sp:sp@127.0.0.1:5432/anything",
    "postgres://sp:sp@[::1]:5432/anything",
  ])("treats %s as disposable", (url) => {
    expect(isDisposableDatabase(url)).toBe(true)
    expect(() => assertDisposable(url, false)).not.toThrow()
  })

  it.each([
    "postgres://sp:secret@db.example.com:5432/security",
    "postgres://sp:secret@10.0.0.5:5432/sp_development",
    "postgres://sp:secret@db.example.com:5432/test_prod",
    "not a url",
  ])("refuses %s without --allow-production", (url) => {
    expect(isDisposableDatabase(url)).toBe(false)
    expect(() => assertDisposable(url, false)).toThrow("--allow-production")
  })

  it("never echoes credentials", () => {
    let message = ""
    try {
      assertDisposable(
        "postgres://sp:supersecret@db.example.com:5432/security",
        false
      )
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toContain("db.example.com:5432/security")
    expect(message).not.toContain("supersecret")
    expect(describeDatabase("postgres://u:p@h:1/d")).toBe("h:1/d")
  })

  it("--allow-production bypasses the check", () => {
    expect(() =>
      assertDisposable(
        "postgres://sp:secret@db.example.com:5432/security",
        true
      )
    ).not.toThrow()
  })
})
```

`tests/integration/auth/account.test.ts`:

```ts
import { asc, eq } from "drizzle-orm"
import { URI } from "otpauth"
import { beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { auditLog, twoFactors, users } from "@/server/db/schema"

import { resetDb } from "../db"
import {
  adminRequest,
  authPost,
  cookiesFrom,
  createUser,
  mergeCookies,
  ORIGIN,
  signIn,
  signedInUser,
  TEST_PASSWORD,
} from "../helpers/auth"

const session = async (cookie: string) =>
  (
    await app.request("/api/auth/get-session?disableCookieCache=true", {
      headers: { cookie },
    })
  ).json()

const actions = async () =>
  (
    await getDb()
      .select()
      .from(auditLog)
      .orderBy(asc(auditLog.createdAt), asc(auditLog.id))
  ).map((r) => r.action)

/** Enables TOTP for the signed-in user; returns the new cookie, URI and backup codes. */
async function enableTotp(cookie: string) {
  const enable = await authPost(
    "/two-factor/enable",
    { password: TEST_PASSWORD },
    cookie
  )
  expect(enable.status).toBe(200)
  const { totpURI, backupCodes } = (await enable.json()) as {
    totpURI: string
    backupCodes: string[]
  }
  const verify = await authPost(
    "/two-factor/verify-totp",
    { code: URI.parse(totpURI).generate() },
    cookie
  )
  expect(verify.status).toBe(200)
  return { cookie: mergeCookies(cookie, verify), totpURI, backupCodes }
}

beforeEach(async () => {
  await resetDb()
})

describe("account security (Task 2.6)", () => {
  it("enables TOTP with a code generated by otpauth, issues 10 backup codes, audited", async () => {
    const { user, cookie } = await signedInUser(["editor"])
    const { cookie: after, backupCodes } = await enableTotp(cookie)
    expect(backupCodes).toHaveLength(10)
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id))
    expect(row.twoFactorEnabled).toBe(true)
    const [secret] = await getDb()
      .select()
      .from(twoFactors)
      .where(eq(twoFactors.userId, user.id))
    expect(secret.verified).toBe(true)
    expect((await session(after))?.user.twoFactorEnabled).toBe(true)
    expect(await actions()).toContain("auth.2fa_enable")
  })

  it("a wrong password cannot start enrolment", async () => {
    const { cookie } = await signedInUser(["editor"])
    const res = await authPost(
      "/two-factor/enable",
      { password: "wrong-password-123" },
      cookie
    )
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("INVALID_PASSWORD")
  })

  it("with 2FA on, sign-in needs a second factor; a backup code works once", async () => {
    const { user, cookie } = await signedInUser(["editor"])
    const { backupCodes } = await enableTotp(cookie)

    const first = await authPost("/sign-in/email", {
      email: user.email,
      password: TEST_PASSWORD,
    })
    expect(first.status).toBe(200)
    expect((await first.json()).twoFactorRedirect).toBe(true)
    expect(cookiesFrom(first)).not.toContain("session_token")
    const challenge = cookiesFrom(first)

    const ok = await authPost(
      "/two-factor/verify-backup-code",
      { code: backupCodes[0] },
      challenge
    )
    expect(ok.status).toBe(200)
    expect((await session(cookiesFrom(ok)))?.user.id).toBe(user.id)

    const again = await authPost("/sign-in/email", {
      email: user.email,
      password: TEST_PASSWORD,
    })
    const reused = await authPost(
      "/two-factor/verify-backup-code",
      { code: backupCodes[0] },
      cookiesFrom(again)
    )
    expect(reused.status).toBe(401)
    expect(await actions()).toEqual(
      expect.arrayContaining([
        "auth.sign_in",
        "auth.2fa_enable",
        "auth.sign_in_failed",
      ])
    )
  })

  it("with 2FA on, a TOTP code completes sign-in (audited as method totp)", async () => {
    const { user, cookie } = await signedInUser(["editor"])
    const { totpURI } = await enableTotp(cookie)
    const first = await authPost("/sign-in/email", {
      email: user.email,
      password: TEST_PASSWORD,
    })
    const ok = await authPost(
      "/two-factor/verify-totp",
      { code: URI.parse(totpURI).generate() },
      cookiesFrom(first)
    )
    expect(ok.status).toBe(200)
    const rows = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "auth.sign_in"))
    expect(rows.map((r) => r.diff)).toContainEqual({ method: "totp" })
  })

  it("new backup codes replace the old ones", async () => {
    const { cookie } = await signedInUser(["editor"])
    const { cookie: after, backupCodes } = await enableTotp(cookie)
    const res = await authPost(
      "/two-factor/generate-backup-codes",
      { password: TEST_PASSWORD },
      after
    )
    expect(res.status).toBe(200)
    const fresh = (await res.json()).backupCodes as string[]
    expect(fresh).toHaveLength(10)
    expect(fresh).not.toEqual(backupCodes)
  })

  it("disables 2FA with the password (audited); sign-in is password-only again", async () => {
    const { user, cookie } = await signedInUser(["editor"])
    const { cookie: after } = await enableTotp(cookie)
    const res = await authPost(
      "/two-factor/disable",
      { password: TEST_PASSWORD },
      after
    )
    expect(res.status).toBe(200)
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id))
    expect(row.twoFactorEnabled).toBe(false)
    expect(
      await getDb()
        .select()
        .from(twoFactors)
        .where(eq(twoFactors.userId, user.id))
    ).toEqual([])
    expect(await actions()).toContain("auth.2fa_disable")
    await signIn(user.email) // no challenge
  })

  it("changing the password revokes the other sessions", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const laptop = await signIn(user.email)
    const phone = await signIn(user.email)
    const res = await authPost(
      "/change-password",
      { currentPassword: TEST_PASSWORD, newPassword: "a-brand-new-password" },
      laptop
    )
    expect(res.status).toBe(200)
    expect(await session(phone)).toBeNull()
    expect((await session(mergeCookies(laptop, res)))?.user.id).toBe(user.id)
  })

  it("lists own sessions and revokes one", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const laptop = await signIn(user.email)
    const phone = await signIn(user.email)
    const list = await app.request("/api/auth/list-sessions", {
      headers: { cookie: laptop },
    })
    const sessions = (await list.json()) as { token: string }[]
    expect(sessions).toHaveLength(2)
    const phoneSession = await session(phone)
    const target = sessions.find((s) => s.token === phoneSession.session.token)
    expect(target).toBeDefined()
    const revoke = await authPost(
      "/revoke-session",
      { token: target?.token },
      laptop
    )
    expect(revoke.status).toBe(200)
    expect(await session(phone)).toBeNull()
    expect(await session(laptop)).not.toBeNull()
  })

  it("an impersonation session cannot change the impersonated user's password or 2FA", async () => {
    const admin = await signedInUser(["admin"])
    const target = await createUser({ roles: ["editor"] })
    const start = await adminRequest(`/users/${target.id}/impersonate`, {
      cookie: admin.cookie,
      method: "POST",
    })
    const asTarget = mergeCookies(admin.cookie, start)
    for (const [path, body] of [
      [
        "/change-password",
        { currentPassword: TEST_PASSWORD, newPassword: "hijacked-password-1" },
      ],
      ["/two-factor/enable", { password: TEST_PASSWORD }],
      ["/update-user", { name: "Hijacked" }],
    ] as const) {
      const res = await app.request(`/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          cookie: asTarget,
        },
        body: JSON.stringify(body),
      })
      expect([path, res.status]).toEqual([path, 403])
    }
  })
})
```

`tests/integration/users/bootstrap.test.ts`:

```ts
import { eq, like } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getDb } from "@/server/db/client"
import { auditLog, sessions, twoFactors, users } from "@/server/db/schema"
import {
  createOwner,
  recoverOwner,
  seedDemoUsers,
} from "@/server/modules/users/bootstrap"

import { resetDb } from "../db"
import { authPost, createUser, signIn, TEST_PASSWORD } from "../helpers/auth"

const tokenOf = (url: string) =>
  new URL(url).searchParams.get("token") as string

beforeEach(async () => {
  await resetDb()
  vi.spyOn(console, "info").mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("createOwner (admin:create)", () => {
  it("creates a passwordless owner and returns a working set-password link", async () => {
    const result = await createOwner({
      email: " Boss@Example.ie ",
      name: "Bea Boss",
    })
    expect(result.emailDelivered).toBe(false)
    expect(result.url).toMatch(
      /^http:\/\/localhost:3000\/admin\/set-password\?token=/
    )
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, result.userId))
    expect(row).toMatchObject({ email: "boss@example.ie", role: "owner" })
    const [audit] = await getDb().select().from(auditLog)
    expect(audit).toMatchObject({
      action: "user.invite",
      actorId: null,
      diff: { via: "admin:create", roles: ["owner"] },
    })
    const set = await authPost("/reset-password", {
      token: tokenOf(result.url),
      newPassword: TEST_PASSWORD,
    })
    expect(set.status).toBe(200)
    await signIn("boss@example.ie")
  })

  it("refuses an existing email and an invalid one", async () => {
    await createOwner({ email: "boss@example.ie", name: "Bea Boss" })
    await expect(
      createOwner({ email: "BOSS@example.ie", name: "Again" })
    ).rejects.toThrow("already exists")
    await expect(
      createOwner({ email: "not-an-email", name: "X" })
    ).rejects.toThrow("Not a valid email address")
  })
})

describe("recoverOwner (owner:recover)", () => {
  it("clears 2FA, revokes sessions, audits and prints a working reset link", async () => {
    const owner = await createUser({ roles: ["owner"] })
    await signIn(owner.email)
    await getDb()
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, owner.id))
    await getDb()
      .insert(twoFactors)
      .values({
        userId: owner.id,
        secret: "x",
        backupCodes: "y",
        verified: true,
      })

    const result = await recoverOwner({ email: owner.email })
    expect(result.url).toContain("/admin/reset-password?token=")
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, owner.id))
    expect(row.twoFactorEnabled).toBe(false)
    expect(await getDb().select().from(twoFactors)).toEqual([])
    expect(
      await getDb().select().from(sessions).where(eq(sessions.userId, owner.id))
    ).toEqual([])
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.owner_recover"))
    expect(audit).toMatchObject({
      actorId: null,
      entityId: owner.id,
      diff: {
        via: "owner:recover",
        twoFactorCleared: true,
        sessionsRevoked: 1,
      },
    })

    const reset = await authPost("/reset-password", {
      token: tokenOf(result.url),
      newPassword: "recovered-password-1",
    })
    expect(reset.status).toBe(200)
    await signIn(owner.email, "recovered-password-1")
  })

  it("refuses non-owners and unknown emails", async () => {
    const editor = await createUser({ roles: ["editor"] })
    await expect(recoverOwner({ email: editor.email })).rejects.toThrow(
      "is not an owner"
    )
    await expect(recoverOwner({ email: "ghost@example.ie" })).rejects.toThrow(
      "User not found"
    )
  })
})

describe("seedDemoUsers (demo:seed)", () => {
  it("is idempotent: twice → 7 users, one per role, passwords reset", async () => {
    const first = await seedDemoUsers("first-demo-password")
    expect(first.map((u) => [u.email, u.created])).toEqual([
      ["owner@demo.local", true],
      ["admin@demo.local", true],
      ["editor@demo.local", true],
      ["author@demo.local", true],
      ["marketer@demo.local", true],
      ["intake@demo.local", true],
      ["viewer@demo.local", true],
    ])
    // drift that a re-run must repair
    await getDb()
      .update(users)
      .set({ role: "owner", banned: true })
      .where(eq(users.email, "viewer@demo.local"))

    const second = await seedDemoUsers("second-demo-password")
    expect(second.every((u) => !u.created)).toBe(true)
    const rows = await getDb()
      .select()
      .from(users)
      .where(like(users.email, "%@demo.local"))
    expect(rows).toHaveLength(7)
    const viewer = rows.find((r) => r.email === "viewer@demo.local")
    expect(viewer).toMatchObject({ role: "viewer", banned: false })

    await signIn("editor@demo.local", "second-demo-password")
    const old = await authPost("/sign-in/email", {
      email: "editor@demo.local",
      password: "first-demo-password",
    })
    expect(old.status).toBe(401)
  })

  it("rejects a password shorter than 12 characters", async () => {
    await expect(seedDemoUsers("short")).rejects.toThrow("12-128 characters")
  })
})
```

`tests/integration/users/scripts.test.ts`:

```ts
import { spawnSync } from "node:child_process"

import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import { TEST_DATABASE_URL } from "../db"
import { resetDb } from "../db"

/** Runs a package script the way an operator does (tsx + server-only hook). */
function run(script: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync("pnpm", ["--silent", script, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
      BETTER_AUTH_URL: "http://localhost:3000",
      ...env,
    },
  })
}

beforeEach(async () => {
  await resetDb()
})

describe("operator scripts", { timeout: 60_000 }, () => {
  it("pnpm admin:create creates an owner and prints the set-password link", async () => {
    const result = run("admin:create", [
      "--email",
      "boss@example.ie",
      "--name",
      "Bea Boss",
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      "[admin:create] Owner created: Bea Boss <boss@example.ie>"
    )
    expect(result.stdout).toMatch(
      /http:\/\/localhost:3000\/admin\/set-password\?token=[\w-]+/
    )
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, "boss@example.ie"))
    expect(row.role).toBe("owner")
  })

  it("pnpm admin:create without arguments prints usage and exits 1", () => {
    const result = run("admin:create", [])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Usage: admin:create --email")
  })

  it("pnpm demo:seed refuses a non-disposable database unless --allow-production", () => {
    const result = run("demo:seed", ["--password", "demo-password-123"], {
      DATABASE_URL: "postgres://sp:sp@db.example.com:5432/security",
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Refusing to write seed or demo data to db.example.com:5432/security"
    )
    expect(result.stderr).not.toContain("sp:sp")
  })

  it("pnpm demo:seed seeds sp_test and prints one line per role", () => {
    const result = run("demo:seed", ["--password", "demo-password-123"])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("created owner@demo.local (owner)")
    expect(result.stdout).toContain("7 demo accounts ready")
  })
})
```

`tests/e2e/account.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"
import { Secret, TOTP } from "otpauth"

import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
}

test("account page: turn on 2FA, then sign in with a backup code (Task 2.6)", async ({
  page,
}) => {
  const { account } = readFixtures()
  await signIn(page, account.email)
  await expect(
    page.getByRole("heading", { name: `Welcome, ${account.name}` })
  ).toBeVisible()
  await page.getByRole("link", { name: "Account" }).click()
  await expect(
    page.getByRole("heading", { name: "Account", exact: true })
  ).toBeVisible()
  await expect(page.getByText("This device")).toBeVisible()

  await page.getByLabel("Your password").fill(E2E_PASSWORD)
  await page
    .getByRole("button", { name: "Set up two-factor authentication" })
    .click()
  const secret = (await page.getByTestId("totp-secret").textContent()) ?? ""
  const backupCodes = await page
    .getByRole("list", { name: "Backup codes" })
    .getByRole("listitem")
    .allTextContents()
  expect(backupCodes).toHaveLength(10)
  const totp = new TOTP({ secret: Secret.fromBase32(secret) })
  await page.getByLabel("Code from the app").fill(totp.generate())
  await page.getByRole("button", { name: "Turn on" }).click()
  await expect(
    page.getByText("Two-factor authentication turned on.")
  ).toBeVisible()
  await expect(page.getByText("Two-factor authentication is on")).toBeVisible()

  await page
    .getByRole("banner")
    .getByRole("button", { name: "Sign out" })
    .click()
  await expect(page).toHaveURL(/\/admin\/sign-in\?notice=signed-out$/)
  await signIn(page, account.email)
  await expect(page).toHaveURL(/\/admin\/two-factor/)
  await page.getByRole("button", { name: "Use a backup code instead" }).click()
  await page.getByLabel("Backup code").fill(backupCodes[0])
  await page.getByRole("button", { name: "Verify" }).click()
  await expect(
    page.getByRole("heading", { name: `Welcome, ${account.name}` })
  ).toBeVisible()
})
```


- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test:unit tests/unit/format.test.ts tests/unit/seed-guard.test.ts tests/unit/scripts-bundle.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/format"`, `"@/server/db/seed/guard"`; `scripts-bundle.test.ts` fails with `Could not resolve "…/scripts/admin-create.ts"`.

Run: `pnpm test:integration tests/integration/auth/account.test.ts tests/integration/users`
Expected: FAIL — `account.test.ts`: only the impersonation test fails (`expected [ '/change-password', 200 ] to deeply equal [ '/change-password', 403 ]`); `bootstrap.test.ts`: `Failed to resolve import "@/server/modules/users/bootstrap"`; `scripts.test.ts`: `expected 1 to be 0` (tsx cannot find `scripts/admin-create.ts`).

- [ ] **Step 4: Impersonation guard in the auth hooks**

`server/auth/hooks.ts` (full file):

```ts
import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api"

import { parseRoles } from "@/lib/auth/permissions"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { type AuditEntry, writeAudit } from "@/server/lib/audit"
import { clientIp } from "@/server/lib/ip"

type AuthUser = { id: string; role?: string | null }

export function actorFor(
  user: AuthUser,
  headers: Headers | undefined,
  impersonatedBy: string | null = null
): Actor {
  return {
    userId: user.id,
    roles: parseRoles(user.role),
    ip: headers ? clientIp(headers) : null,
    userAgent: headers?.get("user-agent") ?? null,
    impersonatorId: impersonatedBy,
  }
}

/** Audit must never break authentication: failures are logged, not thrown. */
export async function auditAuthEvent(
  actor: Actor | null,
  entry: AuditEntry
): Promise<void> {
  try {
    await writeAudit(getDb(), actor, entry)
  } catch (err) {
    console.error(
      `[audit] could not record ${entry.action}:`,
      err instanceof Error ? err.message : String(err)
    )
  }
}

const SECOND_FACTOR_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
])

const isOk = (returned: unknown) => !isAPIError(returned)

/** Account-changing endpoints an impersonation session may not call. */
const SELF_SERVICE_PATHS = new Set([
  "/change-password",
  "/update-user",
  "/change-email",
  "/delete-user",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
])

/**
 * Project hooks for Better Auth, packaged as a plugin so they run after the
 * twoFactor plugin's hooks (plugin hooks run in plugin order; options.hooks
 * would run first and see a sign-in that twoFactor later turns into a
 * challenge).
 */
export function securityHooks(): BetterAuthPlugin {
  return {
    id: "sp-security",
    hooks: {
      before: [
        {
          // Admin-plugin endpoints are server-only: user management goes
          // through /api/v1/admin/users (permission checks + audit). Direct
          // HTTP calls to /api/auth/admin/* are refused; auth.api.* calls
          // from our own services carry no `request` and pass.
          matcher: (ctx) => ctx.path?.startsWith("/admin/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.request) throw new APIError("NOT_FOUND")
          }),
        },
        {
          // "View as" must not change the impersonated person's credentials.
          matcher: (ctx) => SELF_SERVICE_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx)
            if (session?.session.impersonatedBy)
              throw new APIError("FORBIDDEN", {
                message: "Account settings are disabled while impersonating",
              })
          }),
        },
        {
          // Changing the password always signs out every other device.
          matcher: (ctx) => ctx.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => ({
            context: { body: { ...ctx.body, revokeOtherSessions: true } },
          })),
        },
        {
          // Sign-out: record who before the session is deleted.
          matcher: (ctx) => ctx.path === "/sign-out",
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx)
            if (!session) return
            await auditAuthEvent(
              actorFor(
                session.user,
                ctx.headers,
                session.session.impersonatedBy ?? null
              ),
              {
                action: "auth.sign_out",
                entityType: "user",
                entityId: session.user.id,
              }
            )
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.headers
            const created = ctx.context.newSession
            if (created) {
              await auditAuthEvent(actorFor(created.user, headers), {
                action: "auth.sign_in",
                entityType: "user",
                entityId: created.user.id,
                diff: { method: "password" },
              })
              return
            }
            const returned = ctx.context.returned
            if (!isAPIError(returned)) return // two-factor challenge pending
            const email =
              typeof ctx.body?.email === "string"
                ? ctx.body.email.toLowerCase()
                : null
            const found = email
              ? await ctx.context.internalAdapter.findUserByEmail(email)
              : null
            await auditAuthEvent(null, {
              action: "auth.sign_in_failed",
              entityType: "user",
              entityId: found?.user.id,
              diff: {
                method: "password",
                email,
                reason: returned.body?.code ?? null,
              },
              ip: headers ? clientIp(headers) : null,
              userAgent: headers?.get("user-agent") ?? null,
            })
          }),
        },
        {
          matcher: (ctx) => SECOND_FACTOR_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.headers
            const method = ctx.path.endsWith("totp") ? "totp" : "backup_code"
            // verifyTwoFactor() stores the pre-existing session here; null
            // means this call completes a sign-in challenge.
            const prior = ctx.context.session
            const created = ctx.context.newSession
            if (!prior && created) {
              await auditAuthEvent(actorFor(created.user, headers), {
                action: "auth.sign_in",
                entityType: "user",
                entityId: created.user.id,
                diff: { method },
              })
            } else if (prior && created && method === "totp") {
              // first successful code while signed in turns 2FA on
              await auditAuthEvent(actorFor(prior.user, headers), {
                action: "auth.2fa_enable",
                entityType: "user",
                entityId: prior.user.id,
              })
            } else if (!prior && isAPIError(ctx.context.returned)) {
              await auditAuthEvent(null, {
                action: "auth.sign_in_failed",
                diff: { method },
                ip: headers ? clientIp(headers) : null,
                userAgent: headers?.get("user-agent") ?? null,
              })
            }
          }),
        },
        {
          matcher: (ctx) =>
            ctx.path === "/two-factor/disable" ||
            ctx.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => {
            const session = ctx.context.session
            if (!session || !isOk(ctx.context.returned)) return
            await auditAuthEvent(
              actorFor(
                session.user,
                ctx.headers,
                session.session.impersonatedBy ?? null
              ),
              {
                action:
                  ctx.path === "/change-password"
                    ? "auth.password_change"
                    : "auth.2fa_disable",
                entityType: "user",
                entityId: session.user.id,
              }
            )
          }),
        },
      ],
    },
  }
}
```

- [ ] **Step 5: Format helpers, seed guard, bootstrap logic, scripts**

`lib/format.ts`:

```ts
// Display formatting for the admin (global constraint: Europe/Dublin, en-IE).
export const SITE_TIME_ZONE = "Europe/Dublin"
export const SITE_LOCALE = "en-IE"

const dateTime = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: SITE_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
})

/** "16 Oct 2026, 14:05" in Irish time, from an ISO string or Date. */
export function formatDateTime(value: string | Date): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value)
}

/** Short device label from a user agent ("Chrome on macOS"); "Unknown device" if empty. */
export function describeUserAgent(
  userAgent: string | null | undefined
): string {
  if (!userAgent) return "Unknown device"
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : null
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? "Unknown device"
}
```

`server/db/seed/guard.ts`:

```ts
import "server-only"

const DISPOSABLE_NAME = /_(dev|test|e2e)$/
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

/** Host and database name only (never credentials), for messages. */
export function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`
  } catch {
    return "an unparseable DATABASE_URL"
  }
}

/** Spec §14: provably disposable = name ends _dev/_test/_e2e, or a local host. */
export function isDisposableDatabase(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  return DISPOSABLE_NAME.test(name) || LOCAL_HOSTS.has(parsed.hostname)
}

/** Throws unless the target database is disposable or the caller passed --allow-production. */
export function assertDisposable(url: string, allowProduction: boolean): void {
  if (allowProduction || isDisposableDatabase(url)) return
  throw new Error(
    `Refusing to write seed or demo data to ${describeDatabase(url)}: the database name does not end in _dev, _test or _e2e and the host is not local. Re-run with --allow-production if this is intended.`
  )
}
```

`server/modules/users/bootstrap.ts`:

```ts
import "server-only"

import { createElement } from "react"
import { z } from "zod"

import { InviteEmail } from "@/emails/invite"
import { ResetPasswordEmail } from "@/emails/reset-password"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { parseRoles } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"
import { getAuth } from "@/server/auth/auth"
import {
  createPasswordToken,
  INVITE_TOKEN_EXPIRES_IN,
  passwordUrl,
  RECOVERY_TOKEN_EXPIRES_IN,
} from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { writeAudit } from "@/server/lib/audit"
import { AppError, notFound } from "@/server/lib/errors"
import { mailer } from "@/server/lib/mailer"

import * as repo from "./repo"

// Operator commands (scripts/admin-create.ts, owner-recover.ts,
// demo-seed.ts). They run with database access only, so there is no actor:
// audit rows have actorId null and record the command in `diff.via`.

export type LinkResult = {
  userId: string
  url: string
  emailDelivered: boolean
}

const emailSchema = z.email().max(254)

function normaliseEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (!emailSchema.safeParse(email).success)
    throw new AppError(
      "VALIDATION_FAILED",
      `Not a valid email address: ${value}`
    )
  return email
}

/** admin:create: a new owner without a password, plus a set-password link. */
export async function createOwner(input: {
  email: string
  name: string
}): Promise<LinkResult> {
  const email = normaliseEmail(input.email)
  const name = input.name.trim()
  if (!name) throw new AppError("VALIDATION_FAILED", "A name is required")
  const db = getDb()
  if (await repo.findUserByEmail(db, email))
    throw new AppError(
      "CONFLICT",
      `A user with email ${email} already exists (locked-out owner? use owner:recover)`
    )
  const { user } = await getAuth().api.createUser({
    body: { email, name, role: ["owner"] },
  })
  const url = passwordUrl(
    "set-password",
    await createPasswordToken(user.id, INVITE_TOKEN_EXPIRES_IN)
  )
  await writeAudit(db, null, {
    action: "user.invite",
    entityType: "user",
    entityId: user.id,
    diff: { email, roles: ["owner"], via: "admin:create" },
  })
  const { delivered } = await mailer.send({
    to: email,
    subject: "You're invited to the Security Partners admin",
    react: createElement(InviteEmail, {
      name,
      inviterName: "Security Partners",
      url,
      expiresInDays: INVITE_TOKEN_EXPIRES_IN / 86_400,
    }),
  })
  return { userId: user.id, url, emailDelivered: delivered }
}

/**
 * owner:recover: for an owner locked out (lost 2FA device or password).
 * Turns 2FA off, signs out every session and issues a 24-hour password link.
 */
export async function recoverOwner(input: {
  email: string
}): Promise<LinkResult> {
  const email = normaliseEmail(input.email)
  const db = getDb()
  const target = await repo.findUserByEmail(db, email)
  if (!target) throw notFound("User")
  if (!parseRoles(target.role).includes("owner"))
    throw new AppError("VALIDATION_FAILED", `${email} is not an owner`)
  await db.transaction(async (tx) => {
    await repo.clearTwoFactor(tx, target.id)
    const revoked = await repo.deleteUserSessions(tx, target.id)
    await writeAudit(tx, null, {
      action: "user.owner_recover",
      entityType: "user",
      entityId: target.id,
      diff: {
        via: "owner:recover",
        twoFactorCleared: !!target.twoFactorEnabled,
        sessionsRevoked: revoked,
      },
    })
  })
  const url = passwordUrl(
    target.hasPassword ? "reset-password" : "set-password",
    await createPasswordToken(target.id, RECOVERY_TOKEN_EXPIRES_IN)
  )
  const { delivered } = await mailer.send({
    to: email,
    subject: "Recover your Security Partners admin account",
    react: createElement(ResetPasswordEmail, {
      name: target.name,
      url,
      expiresInMinutes: RECOVERY_TOKEN_EXPIRES_IN / 60,
    }),
  })
  return { userId: target.id, url, emailDelivered: delivered }
}

export const DEMO_EMAIL_DOMAIN = "demo.local"

export type DemoUser = { email: string; role: Role; created: boolean }

/**
 * demo:seed: one account per role, `<role>@demo.local`, all with `password`.
 * Idempotent: existing demo accounts get their single role, name and
 * password back, are unbanned and have 2FA turned off.
 */
export async function seedDemoUsers(password: string): Promise<DemoUser[]> {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  )
    throw new AppError(
      "VALIDATION_FAILED",
      `--password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`
    )
  const auth = getAuth()
  const ctx = await auth.$context
  const hash = await ctx.password.hash(password)
  const db = getDb()
  const result: DemoUser[] = []
  for (const role of ROLES) {
    const email = `${role}@${DEMO_EMAIL_DOMAIN}`
    const name = `Demo ${role.charAt(0).toUpperCase()}${role.slice(1)}`
    const existing = await repo.findUserByEmail(db, email)
    let userId: string
    if (existing) {
      userId = existing.id
      await repo.updateUserProfile(db, userId, { name, title: null })
      await repo.setUserRoles(db, userId, [role])
      await repo.setUserBan(db, userId, null)
      await repo.clearTwoFactor(db, userId)
    } else {
      const { user } = await auth.api.createUser({
        body: { email, name, role: [role] },
      })
      userId = user.id
    }
    if (await ctx.internalAdapter.findCredentialAccount(userId))
      await ctx.internalAdapter.updatePassword(userId, hash)
    else
      await ctx.internalAdapter.createAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hash,
      })
    result.push({ email, role, created: !existing })
  }
  return result
}
```

`scripts/lib/run-script.ts`:

```ts
import { closeDb } from "@/server/db/client"
import { getEnv } from "@/server/env"

/**
 * Shared wrapper for operator scripts: validates the env first (readable
 * list of missing vars), prints `[name] message` on failure with exit code 1,
 * and always closes the database pool.
 */
export async function runScript(
  name: string,
  main: () => Promise<void>
): Promise<void> {
  try {
    getEnv()
    await main()
  } catch (err) {
    console.error(
      `[${name}] ${err instanceof Error ? err.message : String(err)}`
    )
    process.exitCode = 1
  } finally {
    await closeDb()
  }
}
```

`scripts/admin-create.ts`:

```ts
// Creates an owner account and prints its set-password link.
//   dev:       pnpm admin:create --email owner@example.ie --name "Jane Owner"
//   container: node scripts/dist/admin-create.mjs --email … --name …
import { parseArgs } from "node:util"

import { createOwner } from "@/server/modules/users/bootstrap"

import { runScript } from "./lib/run-script"

const USAGE = 'Usage: admin:create --email <email> --name "<full name>"'

await runScript("admin:create", async () => {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" } },
  })
  if (!values.email || !values.name) throw new Error(USAGE)
  const result = await createOwner({ email: values.email, name: values.name })
  console.log(
    `[admin:create] Owner created: ${values.name} <${values.email.toLowerCase()}>`
  )
  console.log(
    result.emailDelivered
      ? "[admin:create] Invite email sent. The link (single use, valid 7 days):"
      : "[admin:create] Email is not configured. Give the owner this link (single use, valid 7 days):"
  )
  console.log(result.url)
})
```

`scripts/owner-recover.ts`:

```ts
// Recovers a locked-out owner: turns 2FA off, signs out all sessions and
// prints a password link. Audited (user.owner_recover).
//   dev:       pnpm owner:recover --email owner@example.ie
//   container: node scripts/dist/owner-recover.mjs --email …
import { parseArgs } from "node:util"

import { recoverOwner } from "@/server/modules/users/bootstrap"

import { runScript } from "./lib/run-script"

const USAGE = "Usage: owner:recover --email <owner email>"

await runScript("owner:recover", async () => {
  const { values } = parseArgs({ options: { email: { type: "string" } } })
  if (!values.email) throw new Error(USAGE)
  const result = await recoverOwner({ email: values.email })
  console.log(
    `[owner:recover] Two-factor authentication cleared and all sessions signed out for ${values.email.toLowerCase()}.`
  )
  console.log(
    result.emailDelivered
      ? "[owner:recover] Recovery email sent. The link (single use, valid 24 hours):"
      : "[owner:recover] Email is not configured. Give the owner this link (single use, valid 24 hours):"
  )
  console.log(result.url)
})
```

`scripts/demo-seed.ts`:

```ts
// One demo account per role (<role>@demo.local) sharing one password.
// Remove before handover (docs/launch.md). Refuses non-disposable databases.
//   pnpm demo:seed --password "<12+ chars>" [--allow-production]
import { parseArgs } from "node:util"

import { assertDisposable } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"
import { seedDemoUsers } from "@/server/modules/users/bootstrap"

import { runScript } from "./lib/run-script"

const USAGE =
  'Usage: demo:seed --password "<12+ characters>" [--allow-production]'

await runScript("demo:seed", async () => {
  const { values } = parseArgs({
    options: {
      password: { type: "string" },
      "allow-production": { type: "boolean", default: false },
    },
  })
  if (!values.password) throw new Error(USAGE)
  assertDisposable(getEnv().DATABASE_URL, values["allow-production"] ?? false)
  const users = await seedDemoUsers(values.password)
  for (const user of users)
    console.log(
      `[demo:seed] ${user.created ? "created" : "reset  "} ${user.email} (${user.role})`
    )
  console.log(
    `[demo:seed] ${users.length} demo accounts ready. Remove them before handover.`
  )
})
```


- [ ] **Step 6: Account page**

`components/admin/account/account-section.tsx`:

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AccountSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-bold">{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
```

`components/admin/account/profile-form.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { FormError, FormNotice } from "@/components/admin/auth/form-messages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, authErrorMessage } from "@/lib/auth-client"

export function ProfileForm({
  name,
  email,
  title,
}: {
  name: string
  email: string
  title: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null
  )
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextName = String(form.get("name") ?? "").trim()
    const nextTitle = String(form.get("title") ?? "").trim()
    if (!nextName) {
      setStatus({ ok: false, message: "Enter your name." })
      return
    }
    setPending(true)
    const { error } = await authClient.updateUser({
      name: nextName,
      title: nextTitle || null,
    })
    setPending(false)
    if (error) {
      setStatus({ ok: false, message: authErrorMessage(error) })
      return
    }
    setStatus({ ok: true, message: "Profile saved." })
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      {status ? (
        status.ok ? (
          <FormNotice>{status.message}</FormNotice>
        ) : (
          <FormError>{status.message}</FormError>
        )
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={email} disabled readOnly />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          name="name"
          defaultValue={name}
          maxLength={100}
          autoComplete="name"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-title">Job title</Label>
        <Input
          id="profile-title"
          name="title"
          defaultValue={title ?? ""}
          maxLength={100}
          aria-describedby="profile-title-hint"
        />
        <p id="profile-title-hint" className="text-xs text-muted-foreground">
          Shown as the byline role on articles you write.
        </p>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  )
}
```

`components/admin/account/change-password-form.tsx`:

```tsx
"use client"

import { useState } from "react"

import { FormError, FormNotice } from "@/components/admin/auth/form-messages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password"
import { authClient, authErrorMessage } from "@/lib/auth-client"

export function ChangePasswordForm() {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null
  )
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const currentPassword = String(form.get("currentPassword") ?? "")
    const newPassword = String(form.get("newPassword") ?? "")
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setStatus({
        ok: false,
        message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
      })
      return
    }
    if (newPassword !== form.get("confirm")) {
      setStatus({ ok: false, message: "The two new passwords do not match." })
      return
    }
    setPending(true)
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setPending(false)
    if (error) {
      setStatus({ ok: false, message: authErrorMessage(error) })
      return
    }
    formElement.reset()
    setStatus({
      ok: true,
      message: "Password changed. Your other devices are signed out.",
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      {status ? (
        status.ok ? (
          <FormNotice>{status.message}</FormNotice>
        ) : (
          <FormError>{status.message}</FormError>
        )
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Repeat new password</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  )
}
```

`components/admin/account/two-factor-settings.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { useState } from "react"

import { FormError, FormNotice } from "@/components/admin/auth/form-messages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, authErrorMessage } from "@/lib/auth-client"

type Setup = {
  totpUri: string
  secret: string
  qr: string
  backupCodes: string[]
}

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Save these backup codes somewhere safe. Each one signs you in once if
        you lose your phone. They are shown only now.
      </p>
      <ul
        aria-label="Backup codes"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-3 font-mono text-sm"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  )
}

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [setup, setSetup] = useState<Setup | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(
      new FormData(event.currentTarget).get("password") ?? ""
    )
    setPending(true)
    setError(null)
    const { data, error: failure } = await authClient.twoFactor.enable({
      password,
    })
    setPending(false)
    if (failure || !data || data.method !== "totp") {
      setError(authErrorMessage(failure))
      return
    }
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? ""
    setSetup({
      totpUri: data.totpURI,
      secret,
      qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192 }),
      backupCodes: data.backupCodes,
    })
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(
      new FormData(event.currentTarget).get("code") ?? ""
    ).replace(/\s+/g, "")
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.twoFactor.verifyTotp({ code })
    setPending(false)
    if (failure) {
      setError(authErrorMessage(failure))
      return
    }
    setSetup(null)
    setNotice("Two-factor authentication turned on.")
    router.refresh()
  }

  async function manage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const password = String(
      new FormData(event.currentTarget).get("password") ?? ""
    )
    setPending(true)
    setError(null)
    setNotice(null)
    if (submitter?.value === "disable") {
      const { error: failure } = await authClient.twoFactor.disable({
        password,
      })
      setPending(false)
      if (failure) return setError(authErrorMessage(failure))
      setCodes(null)
      setNotice("Two-factor authentication turned off.")
      router.refresh()
      return
    }
    const { data, error: failure } =
      await authClient.twoFactor.generateBackupCodes({ password })
    setPending(false)
    if (failure || !data) return setError(authErrorMessage(failure))
    setCodes(data.backupCodes)
  }

  const messages = (
    <>
      {error ? <FormError>{error}</FormError> : null}
      {notice ? <FormNotice>{notice}</FormNotice> : null}
    </>
  )

  if (setup)
    return (
      <div className="flex max-w-xl flex-col gap-4">
        {messages}
        <p className="text-sm">
          Scan this code with an authenticator app (Google Authenticator,
          1Password, Microsoft Authenticator…), then enter the 6-digit code it
          shows.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URL */}
        <img
          src={setup.qr}
          alt="QR code for your authenticator app"
          width={192}
          height={192}
          className="rounded-lg border bg-white"
        />
        <p className="text-sm">
          Can&apos;t scan? Enter this key instead:{" "}
          <code
            data-testid="totp-secret"
            className="rounded bg-muted px-1.5 py-0.5 font-mono break-all"
          >
            {setup.secret}
          </code>
        </p>
        <BackupCodes codes={setup.backupCodes} />
        <form onSubmit={confirm} className="flex flex-col gap-3">
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="setup-code">Code from the app</Label>
            <Input
              id="setup-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Checking…" : "Turn on"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSetup(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    )

  if (!enabled)
    return (
      <form onSubmit={start} className="flex max-w-md flex-col gap-4">
        {messages}
        <p className="text-sm">
          Two-factor authentication is <strong>off</strong>. Turn it on so a
          stolen password alone cannot open your account.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="twofactor-enable-password">Your password</Label>
          <Input
            id="twofactor-enable-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Starting…" : "Set up two-factor authentication"}
        </Button>
      </form>
    )

  return (
    <form onSubmit={manage} className="flex max-w-md flex-col gap-4">
      {messages}
      <p className="text-sm">
        Two-factor authentication is <strong>on</strong>.
      </p>
      {codes ? <BackupCodes codes={codes} /> : null}
      <div className="grid gap-2">
        <Label htmlFor="twofactor-manage-password">Your password</Label>
        <Input
          id="twofactor-manage-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="intent"
          value="codes"
          variant="outline"
          disabled={pending}
        >
          New backup codes
        </Button>
        <Button
          type="submit"
          name="intent"
          value="disable"
          variant="destructive"
          disabled={pending}
        >
          Turn off
        </Button>
      </div>
    </form>
  )
}
```

`components/admin/account/sessions-list.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"

import { FormError, FormNotice } from "@/components/admin/auth/form-messages"
import { Button } from "@/components/ui/button"
import { authClient, authErrorMessage } from "@/lib/auth-client"
import { describeUserAgent, formatDateTime } from "@/lib/format"

type Session = {
  id: string
  token: string
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: Date | string
}

export function SessionsList({
  currentSessionId,
}: {
  currentSessionId: string
}) {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: failure } = await authClient.listSessions()
    if (failure) setError(authErrorMessage(failure))
    else setSessions(data as Session[])
  }, [])

  useEffect(() => {
    // Client-only list (it holds session tokens). Reloads when the current
    // session changes (enabling 2FA or a password change rotates it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, currentSessionId])

  async function revoke(session: Session) {
    setError(null)
    const { error: failure } = await authClient.revokeSession({
      token: session.token,
    })
    if (failure) return setError(authErrorMessage(failure))
    setNotice("Device signed out.")
    await load()
  }

  async function revokeOthers() {
    setError(null)
    const { error: failure } = await authClient.revokeOtherSessions()
    if (failure) return setError(authErrorMessage(failure))
    setNotice("All other devices are signed out.")
    await load()
  }

  if (!sessions)
    return error ? (
      <FormError>{error}</FormError>
    ) : (
      <p className="text-sm text-muted-foreground">Loading…</p>
    )

  const others = sessions.filter((s) => s.id !== currentSessionId)
  return (
    <div className="flex flex-col gap-4">
      {error ? <FormError>{error}</FormError> : null}
      {notice ? <FormNotice>{notice}</FormNotice> : null}
      <ul aria-label="Signed-in devices" className="divide-y rounded-lg border">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 p-3"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {describeUserAgent(session.userAgent)}
                {session.id === currentSessionId ? (
                  <span className="ml-2 rounded bg-brand-mint px-1.5 py-0.5 text-xs text-brand-green-dark">
                    This device
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {session.ipAddress ?? "Unknown IP"} · signed in{" "}
                {formatDateTime(new Date(session.createdAt))}
              </span>
            </div>
            {session.id !== currentSessionId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => revoke(session)}
              >
                Sign out
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <Button variant="outline" className="self-start" onClick={revokeOthers}>
          Sign out all other devices
        </Button>
      ) : null}
    </div>
  )
}
```

`app/(admin)/admin/(panel)/account/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { AccountSection } from "@/components/admin/account/account-section"
import { ChangePasswordForm } from "@/components/admin/account/change-password-form"
import { ProfileForm } from "@/components/admin/account/profile-form"
import { SessionsList } from "@/components/admin/account/sessions-list"
import { TwoFactorSettings } from "@/components/admin/account/two-factor-settings"
import { FormNotice } from "@/components/admin/auth/form-messages"
import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Account" }

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <Account />
    </Suspense>
  )
}

async function Account() {
  const { user, session } = await requireSession()
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Account</h1>
      {session.impersonatedBy ? (
        <FormNotice>
          You are viewing the admin as {user.name}. Account settings are
          disabled while impersonating.
        </FormNotice>
      ) : (
        <>
          <AccountSection
            title="Profile"
            description="Your name and job title appear on articles you write."
          >
            <ProfileForm
              name={user.name}
              email={user.email}
              title={user.title}
            />
          </AccountSection>
          <AccountSection
            title="Password"
            description="Changing your password signs out your other devices."
          >
            <ChangePasswordForm />
          </AccountSection>
          <AccountSection
            title="Two-factor authentication"
            description="A code from your phone in addition to your password."
          >
            <TwoFactorSettings enabled={user.twoFactorEnabled} />
          </AccountSection>
          <AccountSection
            title="Devices"
            description="Where your account is signed in. Sign out anything you do not recognise."
          >
            <SessionsList currentSessionId={session.id} />
          </AccountSection>
        </>
      )}
    </div>
  )
}
```

`app/(admin)/admin/(panel)/layout.tsx` (full file; adds the Account link):

```tsx
import Link from "next/link"
import { Suspense } from "react"

import { SignOutButton } from "@/components/admin/auth/sign-out-button"
import { requireSession } from "@/server/auth/session"

/**
 * Minimal signed-in frame until the Phase 4 shell replaces it (sidebar, ⌘K,
 * impersonation banner). The session is read fresh inside Suspense.
 */
export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  )
}

async function PanelFrame({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <Link href="/admin" className="font-bold text-brand-navy">
            Security Partners
          </Link>
          <nav aria-label="Admin" className="flex items-center gap-4 text-sm">
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/account"
              className="text-muted-foreground hover:text-foreground"
            >
              Account
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — `format.test.ts` (8), `seed-guard.test.ts` (12), `scripts-bundle.test.ts` (3, now four bundles), `account.test.ts` (9), `bootstrap.test.ts` (6), `scripts.test.ts` (4).

Run: `pnpm exec next typegen && pnpm lint && pnpm typecheck`
Expected: exit 0.

Run: `pnpm test:e2e`
Expected: `11 passed` (setup + 9 auth specs + account spec).

- [ ] **Step 8: Smoke the operator scripts against sp_dev and as bundles**

```bash
pnpm admin:create --email owner@example.ie --name "Olive Owner"
pnpm owner:recover --email owner@example.ie
pnpm demo:seed --password "demo-password-123"
pnpm demo:seed --password "demo-password-123"
DATABASE_URL=postgres://sp:sp@db.example.com:5432/security pnpm demo:seed --password "demo-password-123"; echo "exit=$?"
```

Expected, in order: `[admin:create] Owner created: Olive Owner <owner@example.ie>` + `Email is not configured…` + a `http://localhost:3000/admin/set-password?token=…` line; `[owner:recover] Two-factor authentication cleared…` + a `…/admin/set-password?token=…` link (the owner has no password yet); seven `created … (role)` lines then seven `reset   … (role)` lines; `[demo:seed] Refusing to write seed or demo data to db.example.com:5432/security: …` and `exit=1` (no connection attempted).

```bash
pnpm scripts:build && ls scripts/dist
```

Expected: `[scripts:build] 4 script(s) → scripts/dist` and `admin-create.mjs demo-seed.mjs migrate.mjs owner-recover.mjs` (≈5 MB each; React Email and Better Auth are bundled).

- [ ] **Step 9: Phase gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:visual && pnpm test:e2e`
Expected: all exit 0; `test:visual` 38 passed, `test:e2e` 11 passed.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-lock.yaml lib/format.ts server/auth/hooks.ts server/db/seed server/modules/users/bootstrap.ts scripts components/admin/account "app/(admin)/admin/(panel)" tests/unit/format.test.ts tests/unit/seed-guard.test.ts tests/integration/auth/account.test.ts tests/integration/users tests/e2e/account.spec.ts
git commit -m "feat: add account security page and owner bootstrap scripts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Check: `git status --short` is clean (`scripts/dist/` is ignored by Phase 1).
