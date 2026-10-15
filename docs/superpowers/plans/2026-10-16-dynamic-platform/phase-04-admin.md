# Phase 4 — Admin shell + editors

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master, Phase 4 = Tasks 4.1–4.7). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§3, §5.1–§5.6, §6.1, §7, §8, §15). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Public design is frozen: `pnpm test:visual` stays at 0 px on every public baseline (1440×900 and 390×844, macOS, port 3100 free). The only allowed public addition is the admin-only draft preview bar (renders nothing outside draft mode). Admin shell baselines are **new** in this phase (spec §15).
- `next build` succeeds with no env vars and no database: every admin page reads the session inside `<Suspense>`; no module touches the DB at import.
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Tests use `TEST_DATABASE_URL` / `E2E_DATABASE_URL`.
- Every file under `server/` starts with `import "server-only"`. `lib/**` and `templates/*/schema.ts` never import `server/**` (one exception added here: **type-only** imports in `lib/api-client.ts`, enforced by `@typescript-eslint/no-restricted-imports` with `allowTypeImports`).
- Repos are the only files outside `server/db/**`/`tests/**` importing `drizzle-orm`; routes never import repos (ESLint, Phase 3).
- Hono handlers: validate (`zv`) → authorise (`can(...)`) → call a service. Services re-check permissions, audit every mutation, write revisions, keep `media_usages` exact and call `invalidate()`.
- Error envelope `{ error: { code, message, fieldErrors?, current?, requestId } }`; stale `version` → **409 with the current state** (Review Focus 2); validation → 422 with dot-path `fieldErrors` (`"hero.heading"`).
- Lists: `?page&pageSize&sort=field:dir&q` → `{ items, page, pageSize, total }`, `pageSize` ≤ 100, default 20.
- IDs uuid v7; dates on the wire ISO 8601 UTC; displayed in `Europe/Dublin`, `en-IE` (`lib/format.ts`).
- Library versions exact (`--save-exact`): `@tanstack/react-query@5.104.3`, `@tanstack/react-table@9.3.1` (**v9 API: `useTable` + `tableFeatures`, notes §4.1–4.2**), `react-hook-form@7.90.0`, `@hookform/resolvers@5.9.1` (`useForm<z.input, unknown, z.output>`), `@tiptap/react|starter-kit|extension-list|extension-blockquote@3.32.0`, `@dnd-kit/core@6.3.1` / `sortable@10.0.0` / `utilities@3.2.2` / `modifiers@9.0.0`, `cmdk@1.1.1`, `sonner@2.0.8`, `recharts@3.8.0` (the version the shadcn `chart` registry item pins); dev: `@testing-library/react@16.3.3`, `@testing-library/user-event@14.6.8`, `@testing-library/dom@10.4.2`, `@testing-library/jest-dom@7.0.1`, `jsdom@30.1.3`.
- UI: existing shadcn setup (`components.json` style `base-nova`, base-ui primitives: compose triggers with the `render` prop, never `asChild`). Responsive: sidebar → sheet below 1024 px; tables → cards below 640 px. WCAG 2.2 AA: labelled controls, visible focus, keyboard-operable everything, SC 2.5.7 (every drag has Move up/Move down buttons).
- Code style: repo Prettier (no semicolons, double quotes, 80 cols). Run `pnpm exec prettier --write <files>` on files you create or edit (not on `components/ui/*` files you did not add).
- Commit after every task, staging only your paths; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Only one agent at a time runs Playwright (`test:visual`, `test:e2e`) or `next build` (ledger ruling).
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` + `pnpm test:visual` + `pnpm test:e2e`.

**Prerequisites:** Phase 3 complete per `docs/superpowers/plans/2026-10-16-dynamic-platform/phase-03-content.md` (Tasks 1–10 committed): content tables incl. migration `0004_content_constraints` (revisions unique per entity+version, `media_usages.media_id` ON DELETE RESTRICT, `jobs.key`), `lib/schemas/{common,settings,content}/**` (with `httpUrl`), `templates/{registry,*/schema}.ts`, `server/lib/{cache-tags,settings-store}.ts`, `lib/media.ts`, `lib/format.ts` (`isoDate`, `formatPostDate`), repos/queries of pages/services/articles/collections/settings/media, `server/modules/pages/sources.ts` (`loadSiteSources`, DB-backed), `server/db/seed` (`seedContent`), `server/db/seed/fixtures/{media,pages}.ts`, `cacheComponents: true`, the Phase 3 `eslint.config.mjs`, `tests/visual/seed.ts`, E2E seed with content. `pnpm db:up` running, port 3100 free.

**Ledger rulings applied:** `invalidate()` = `revalidateTag(tag, { expire: 0 })`, called from the Hono route handlers only (never render/timers); stale writes → 409 with `error.current`; editor `settings:update` limited to content keys (here: `leads` needs `settings:update` + `lead:update`); `consent`/`tracking`/`customCode` are not edited here (Phase 8 module), nor `integrations.*` (Phase 7); cache tags from `server/lib/cache-tags.ts`; collections without a version column write revisions with `version = max + 1` in the same transaction; every save/delete maintains `media_usages` in the same transaction (RESTRICT FK); preview cookie HMAC uses HKDF purpose `"preview"`; unknown service/article slugs stay soft 404 (Phase 8 fixes); proxy matcher `/admin/:path*` only; only one agent runs Playwright/build at a time; never cache `getDb()` at module scope.

**Verification note:** all code in this plan was run in a scratch copy of the repo (Phase 3 state rebuilt from the Phase 3 plan + the committed Phase 3 files): `pnpm lint` clean, `pnpm typecheck` clean, unit + dom 896 tests passing, integration 172 passing (one pre-existing Phase 3 seed-guard case depends on the database name and is unrelated), `next build` with no env passing. Playwright specs (E2E + admin visual baselines) were written but not executed (one-agent Playwright rule) — they run in Tasks 2 and 7.

## Corrections to master plan

- **`lib/api-client.ts`:** `export const api = hc<AdminApi>("/api/v1/admin")` (not `"/api"`): `AdminApi = typeof adminRoutes`, which is mounted at `/api/v1/admin` without a base path. Its `import type { AdminApi } from "@/server/api/app"` is allowed by a one-file ESLint block (`@typescript-eslint/no-restricted-imports`, `allowTypeImports: true`) — cost if wrong: a value import from `server/` in that file would still fail lint.
- **Restore lives on the owning module:** `POST /pages/:key/restore`, `/settings/:key/restore`, `/services/:id/restore` (body `{ revisionId, version }`); `revisions/:entity/:id` and `revisions/:entity/:id/:revisionId` are read-only — cost: none (spec route map lists `/restore` under revisions).
- **Master 4.3 split into Tasks 4–5:** the TipTap editor (`components/admin/rich-text/{extensions.ts,editor.tsx,toolbar.tsx}`, master 5.2 files) is built here, limited to exactly the nodes Phase 3's renderer supports; Phase 5 Task 5.2 extends it (paste test against the article renderer, article-specific UI). Media picking in Phase 4 = read-only `GET /api/v1/admin/media` (+ `/:id`) and `components/admin/media/picker-dialog.tsx` over **existing (seeded) media rows**; uploading, the library screen and alt/focal editing come in Phase 6, which extends the same picker — cost: Phase 6 edits `server/modules/media/{routes,service}.ts` instead of creating them.
- **Settings scope:** Phase 4 edits `site, contact, navigation, footer, microcopy, sections.about, sections.contact, sections.enquireBanner, sections.clients, sections.whyChooseUs, leads`. `seo.defaults` is excluded too (Phase 8 SEO screen) besides `consent/tracking/customCode` (404 here). `leads` needs `settings:update` **and** `lead:update` (editors read only) — cost: Phase 8 adds `seo.defaults` editing.
- **Admin navigation lists only screens that exist** (Dashboard, Pages, Services, Team, Clients, Group companies, Categories, Settings, Account). Phases 5–8 add their items to `components/admin/shell/nav.ts` and refresh the admin shell baselines (`pnpm exec playwright test tests/visual/admin-shell.spec.ts --update-snapshots=changed`) — cost: one re-baseline per later phase.
- **Service slug is not draft content:** `PATCH /services/:id/slug { slug, version }` changes the URL immediately (invalidates `services`, old and new `service:<slug>`); `DELETE /services/:id?version=` also checks the version — cost: none.
- **Settings DTO `publishedAt` is always null and `status` is derived** (`settings` has no such columns, spec §5.4) — cost: none.
- **New helper files** not named in the master: `lib/admin/{page-labels,settings-keys}.ts`, `lib/json.ts`, `lib/schemas/api/{content,search,media,preview,settings,services,collections,dashboard}.ts`, `server/lib/{media-usages,pg-errors}.ts`, `server/modules/{search,revisions,preview,dashboard,reorder}/*`, `components/admin/{session-provider,providers,page-header,sortable-list}.tsx`, `components/admin/{collections,services,settings,pages,dashboard,media}/*`, `components/preview-bar.tsx`, `hooks/{use-permission,use-autosave,use-debounced-value}.ts`, `templates/editor-meta.ts`, `app/(admin)/admin/admin.css`, vitest project `dom` (`tests/dom/**`).
- **Dashboard "Next up" links:** SMTP/R2 items link to `/admin/settings` until Phase 7 adds Settings ▸ Integrations (Phase 7 changes the `href`); review/leads items link to the Phase 5/7 screens and only show counts > 0 once those modules produce data — cost: none.

**Risks for the controller (no change here):** (1) No master task builds the **Users** and **Audit log** admin screens (spec §8.1; APIs exist since Phase 2) — impersonation can only be started via the API until one does; suggest a task in Phase 10 or a Phase 4b. (2) The Phase 3 carry "users service invalidates `articles` on byline profile change" is still open (profile edits go through Better Auth's `/api/auth/update-user`); Phase 5 should add it via a Better Auth `databaseHooks.user.update.after` hook calling `invalidate(tag.articles)`. (3) Phase 5 adds the Articles nav item, `article` search results, and reuses `VersionedEditor`/`RichTextEditor`.

---

### Task 1: Admin foundation — dependencies, theme, providers, API client, permissions hook, shell (master Task 4.1, part 1)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (dependencies below), `vitest.config.ts` (new `dom` project), `eslint.config.mjs` (type-only import block for `lib/api-client.ts`)
- Create (shadcn CLI): `components/ui/{sheet,dialog,alert-dialog,command,input-group,popover,tooltip,sonner,badge,skeleton,switch,textarea,field,separator,kbd,spinner,chart}.tsx`
- Create: `app/(admin)/admin/admin.css`, `lib/api-client.ts`, `components/admin/session-provider.tsx`, `components/admin/providers.tsx`, `components/admin/page-header.tsx`, `hooks/use-permission.ts`, `components/admin/shell/{nav.ts,sidebar.tsx,mobile-nav.tsx,topbar.tsx,impersonation-banner.tsx,admin-shell.tsx}`
- Modify: `app/(admin)/admin/layout.tsx` (imports `admin.css`, `data-admin` on `<html>`), `app/(admin)/admin/(panel)/layout.tsx` (renders the shell)
- Test: `tests/dom/setup.ts`, `tests/unit/admin/nav.test.ts`, `tests/unit/api-client.test.ts`, `tests/dom/admin-shell.test.tsx`

**Interfaces:**
- Consumes: Phase 2 `requireSession()` (`server/auth/session.ts` → `{ user, actor, session }`), `hasPermission`/`PermissionRequest` (`lib/auth/permissions.ts`), `Role`, `SignOutButton` (`components/admin/auth/sign-out-button.tsx`), `AdminApi` (`server/api/app.ts`), `POST /api/v1/admin/users/stop-impersonating`.
- Produces:

```ts
// lib/api-client.ts (client-safe)
export const api: ReturnType<typeof hc<AdminApi>>          // base "/api/v1/admin"
export type ApiErrorBody = { error: { code: string; message: string; fieldErrors?: Record<string, string[]>; current?: unknown; requestId?: string } }
export class ApiError extends Error { status: number; code: string; fieldErrors: Record<string, string[]>; current: unknown; requestId: string | null; get isConflict(): boolean }
export async function unwrap<T>(request: Promise<{ ok: boolean; status: number; json(): Promise<T> }>): Promise<T>   // throws ApiError
export function errorMessage(error: unknown): string
// components/admin/session-provider.tsx
export type AdminSession = { user: { id; name; email; title: string | null; twoFactorEnabled: boolean }; roles: Role[]; impersonatedBy: string | null }
export function AdminSessionProvider(props: { value: AdminSession; children }): JSX.Element
export function useAdminSession(): AdminSession
// hooks/use-permission.ts
export function usePermission(req: PermissionRequest): boolean
// components/admin/providers.tsx
export function makeQueryClient(): QueryClient
export function AdminProviders(props: { children; client?: QueryClient }): JSX.Element   // Query + Tooltip + Toaster
// components/admin/shell/nav.ts
export type NavItem = { label; href; icon: LucideIcon; permission: PermissionRequest | null; match: "exact" | "prefix" }
export const NAV_SECTIONS: NavSection[]
export function navItems(roles: readonly string[]): NavSection[]
export function isActiveItem(item: NavItem, pathname: string): boolean
// components/admin/shell/admin-shell.tsx
export function AdminShell(props: { session: AdminSession; children; queryClient?: QueryClient }): JSX.Element
// components/admin/page-header.tsx
export function PageHeader(props: { title; description?; actions? }): JSX.Element
```

The Phase 2 E2E specs keep passing unchanged: the topbar (`role=banner`) still has a visible **Sign out** button, the sidebar has exactly one link named "Account", and the dashboard keeps the `Welcome, <name>` heading.

- [ ] **Step 1: Install dependencies and shadcn components**

```bash
pnpm add --save-exact @tanstack/react-query@5.104.3 @tanstack/react-table@9.3.1 react-hook-form@7.90.0 @hookform/resolvers@5.9.1 cmdk@1.1.1 sonner@2.0.8 recharts@3.8.0 @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2 @dnd-kit/modifiers@9.0.0 @tiptap/react@3.32.0 @tiptap/starter-kit@3.32.0 @tiptap/extension-list@3.32.0 @tiptap/extension-blockquote@3.32.0
pnpm add -D --save-exact @testing-library/react@16.3.3 @testing-library/user-event@14.6.8 @testing-library/dom@10.4.2 @testing-library/jest-dom@7.0.1 jsdom@30.1.3
yes n | pnpm exec shadcn add --yes sheet dialog alert-dialog command popover tooltip sonner badge skeleton switch textarea field kbd spinner chart
git diff --exit-code components/ui/button.tsx components/ui/input.tsx components/ui/card.tsx components/ui/label.tsx components/ui/alert.tsx app/globals.css
git status --short components/ui
```

Expected: the `shadcn add` run answers "n" to every "already exists, overwrite?" prompt (the brand variants in `button.tsx` must survive), the `git diff --exit-code` prints nothing and exits 0, and `git status` lists exactly the new files `components/ui/{alert-dialog,badge,chart,command,dialog,field,input-group,kbd,popover,separator,sheet,skeleton,sonner,spinner,switch,textarea,tooltip}.tsx`. `package.json` keeps `"recharts": "3.8.0"`. Format only the new ui files: `pnpm exec prettier --write components/ui/{alert-dialog,badge,chart,command,dialog,field,input-group,kbd,popover,separator,sheet,skeleton,sonner,spinner,switch,textarea,tooltip}.tsx`.

- [ ] **Step 2: Add the `dom` test project and write the failing tests**

`vitest.config.ts` (full file):

```ts
import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const serverOnlyStub = fileURLToPath(
  new URL("./tests/stubs/server-only.ts", import.meta.url)
)

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside Next's react-server bundles.
    alias: { "server-only": serverOnlyStub },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/unit/setup.ts"],
        },
      },
      {
        // Admin client components: React Testing Library in jsdom.
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/dom/**/*.test.tsx"],
          setupFiles: ["./tests/dom/setup.ts"],
        },
      },
      {
        // Real Postgres (sp_test). Needs `pnpm db:up` locally; CI provides a
        // postgres service. Files run one at a time: they share one database.
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/integration/global-setup.ts"],
          setupFiles: ["./tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
```

`tests/dom/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom lacks a few browser APIs that base-ui, cmdk and ProseMirror call.
if (!window.matchMedia)
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const noRects = () => [] as unknown as DOMRectList
Range.prototype.getClientRects ??= noRects
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0)
document.elementFromPoint ??= () => null
```

`tests/unit/admin/nav.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import type { Role } from "@/lib/auth/roles"
import {
  isActiveItem,
  NAV_SECTIONS,
  navItems,
} from "@/components/admin/shell/nav"

const labels = (roles: Role[]) =>
  navItems(roles).flatMap((section) => section.items.map((i) => i.label))

const ALL = [
  "Dashboard",
  "Pages",
  "Services",
  "Team",
  "Clients",
  "Group companies",
  "Categories",
  "Settings",
  "Account",
]

describe("navItems(roles) — sidebar filtered by read permission (master 4.1)", () => {
  it.each<[Role, string[]]>([
    ["owner", ALL],
    ["admin", ALL],
    ["editor", ALL],
    ["viewer", ALL],
    ["marketer", ["Dashboard", "Pages", "Services", "Account"]],
    ["author", ["Dashboard", "Account"]],
    ["intake", ["Dashboard", "Account"]],
  ])("%s sees %j", (role, expected) => {
    expect(labels([role])).toEqual(expected)
  })

  it("unions multiple roles and drops empty sections", () => {
    expect(labels(["author", "marketer"])).toEqual([
      "Dashboard",
      "Pages",
      "Services",
      "Account",
    ])
    expect(navItems(["intake"]).map((s) => s.label)).toEqual([
      "Overview",
      "You",
    ])
  })

  it("unknown roles see only the items without a permission", () => {
    expect(labels(["nope" as Role])).toEqual(["Dashboard", "Account"])
  })

  it("every item links inside /admin", () => {
    for (const section of NAV_SECTIONS)
      for (const item of section.items)
        expect(item.href.startsWith("/admin")).toBe(true)
  })
})

describe("isActiveItem", () => {
  const [dashboard] = NAV_SECTIONS[0].items
  const pages = NAV_SECTIONS[1].items[0]

  it("matches the dashboard exactly", () => {
    expect(isActiveItem(dashboard, "/admin")).toBe(true)
    expect(isActiveItem(dashboard, "/admin/pages")).toBe(false)
  })

  it("matches a section and its sub-pages only", () => {
    expect(isActiveItem(pages, "/admin/pages")).toBe(true)
    expect(isActiveItem(pages, "/admin/pages/home")).toBe(true)
    expect(isActiveItem(pages, "/admin/pages-archive")).toBe(false)
  })
})
```

`tests/unit/api-client.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { ApiError, errorMessage, unwrap } from "@/lib/api-client"

const response = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  )

describe("unwrap", () => {
  it("returns the JSON body of a 2xx response", async () => {
    await expect(unwrap(response(200, { ok: true }))).resolves.toEqual({
      ok: true,
    })
  })

  it("throws ApiError with the envelope's code, fieldErrors and current", async () => {
    const error = await unwrap(
      response(409, {
        error: {
          code: "CONFLICT",
          message: "Changed by someone else",
          current: { version: 4 },
          requestId: "r1",
        },
      })
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Changed by someone else",
      current: { version: 4 },
      requestId: "r1",
      isConflict: true,
    })

    const invalid = (await unwrap(
      response(422, {
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid input",
          fieldErrors: { "hero.heading": ["Required"] },
        },
      })
    ).catch((e: unknown) => e)) as ApiError
    expect(invalid.fieldErrors).toEqual({ "hero.heading": ["Required"] })
  })

  it("survives a non-JSON error body", async () => {
    const error = (await unwrap(
      Promise.resolve(new Response("Bad gateway", { status: 502 }))
    ).catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(502)
    expect(error.code).toBe("INTERNAL")
    expect(error.message).toBe("Request failed (502)")
  })
})

describe("errorMessage", () => {
  it("uses the API message, or a generic one for network errors", () => {
    expect(
      errorMessage(
        new ApiError(403, { error: { code: "FORBIDDEN", message: "No" } })
      )
    ).toBe("No")
    expect(errorMessage(new TypeError("fetch failed"))).toBe(
      "Something went wrong. Check your connection and try again."
    )
  })
})
```

`tests/dom/admin-shell.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/admin" } }))
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import type { AdminSession } from "@/components/admin/session-provider"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"

const session = (
  roles: Role[],
  impersonatedBy: string | null = null
): AdminSession => ({
  user: {
    id: "u1",
    name: "Edith Editor",
    email: "edith@example.test",
    title: null,
    twoFactorEnabled: false,
  },
  roles,
  impersonatedBy,
})

beforeEach(() => {
  pathname.current = "/admin"
})

describe("AdminShell (master 4.1)", () => {
  it("shows only the sections the roles may read", () => {
    render(
      <AdminShell session={session(["intake"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["Dashboard", "Account"])
    expect(screen.getByRole("main")).toHaveTextContent("Body")
  })

  it("marks the current section with aria-current", () => {
    pathname.current = "/admin/pages/home"
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(within(nav).getByRole("link", { name: "Pages" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      within(nav).getByRole("link", { name: "Dashboard" })
    ).not.toHaveAttribute("aria-current")
  })

  it("opens the navigation in a sheet from the topbar (< 1024 px)", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    await user.click(within(sheet).getByRole("link", { name: "Services" }))
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
  })

  it("shows the topbar user, sign out and a skip link", () => {
    render(
      <AdminShell session={session(["editor", "author"])}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("banner")
    expect(banner).toHaveTextContent("Edith Editor")
    expect(banner).toHaveTextContent("editor, author")
    expect(
      within(banner).getByRole("button", { name: "Sign out" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Skip to content" })
    ).toHaveAttribute("href", "#main")
  })

  it("shows the impersonation banner only while impersonating", () => {
    const { rerender } = render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    expect(screen.queryByRole("region", { name: "Impersonation" })).toBeNull()
    rerender(
      <AdminShell session={session(["editor"], "owner-1")}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("region", { name: "Impersonation" })
    expect(banner).toHaveTextContent(
      "You are viewing the admin as Edith Editor"
    )
    expect(
      within(banner).getByRole("button", { name: "Stop impersonating" })
    ).toBeEnabled()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/admin/nav.test.ts tests/unit/api-client.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/admin/shell/nav"` and `"@/lib/api-client"`.

Run: `pnpm exec vitest run --project dom tests/dom/admin-shell.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/shell/admin-shell"`.

- [ ] **Step 4: Admin theme, API client, session context, providers**

Admin-only tokens (brand navy primary, navy sidebar, brand chart colours) are scoped to `html[data-admin]`, so `app/globals.css` and the public site are untouched.

`app/(admin)/admin/admin.css`:

```css
/*
 * Admin-only design tokens. Imported by the admin root layout only and
 * scoped to <html data-admin>, so the public site's tokens never change.
 * Brand colours come from globals.css (--color-brand-*).
 */
html[data-admin] {
  --primary: var(--color-brand-navy);
  --primary-foreground: oklch(0.985 0 0);
  --ring: var(--color-brand-blue);
  --accent: var(--color-brand-surface);
  --accent-foreground: var(--color-brand-navy);
  --chart-1: var(--color-brand-blue);
  --chart-2: var(--color-brand-green);
  --chart-3: var(--color-brand-navy);
  --chart-4: var(--color-brand-muted);
  --chart-5: var(--color-brand-blue-deep);
  --sidebar: var(--color-brand-navy);
  --sidebar-foreground: oklch(0.93 0.01 264);
  --sidebar-primary: var(--color-brand-green);
  --sidebar-primary-foreground: var(--color-brand-navy);
  --sidebar-accent: oklch(1 0 0 / 9%);
  --sidebar-accent-foreground: oklch(1 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: var(--color-brand-green);
}

html[data-admin].dark {
  --primary: oklch(0.93 0.01 264);
  --primary-foreground: var(--color-brand-navy);
  --ring: oklch(0.7 0.12 264);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --sidebar: oklch(0.17 0.03 264);
}
```

`app/(admin)/admin/layout.tsx` (full file):

```tsx
import type { Metadata } from "next"
import { Geist_Mono, Lato } from "next/font/google"

import "../../globals.css"
import "./admin.css"
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
      data-admin=""
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

`lib/api-client.ts`:

```ts
import { hc } from "hono/client"

import type { AdminApi } from "@/server/api/app"

/**
 * Typed client for /api/v1/admin (same origin, session cookie). Only the
 * route *types* come from server/ (type-only import, erased at build).
 */
export const api = hc<AdminApi>("/api/v1/admin")

/** The API error envelope (server/api/middleware/error.ts). */
export type ApiErrorBody = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    current?: unknown
    requestId?: string
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: Record<string, string[]>
  readonly current: unknown
  readonly requestId: string | null

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.error?.message ?? `Request failed (${status})`)
    this.name = "ApiError"
    this.status = status
    this.code = body?.error?.code ?? "INTERNAL"
    this.fieldErrors = body?.error?.fieldErrors ?? {}
    this.current = body?.error?.current
    this.requestId = body?.error?.requestId ?? null
  }

  get isConflict(): boolean {
    return this.status === 409
  }
}

type JsonResponse<T> = {
  ok: boolean
  status: number
  json(): Promise<T>
}

/** Awaits an `api.*.$get()/$post()…` call: the JSON body, or throws ApiError. */
export async function unwrap<T>(request: Promise<JsonResponse<T>>): Promise<T> {
  const res = await request
  if (res.ok) return res.json()
  let body: Partial<ApiErrorBody> | null = null
  try {
    body = (await res.json()) as Partial<ApiErrorBody>
  } catch {
    body = null
  }
  throw new ApiError(res.status, body)
}

/** Human message for a failed request (toasts, inline alerts). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return "Something went wrong. Check your connection and try again."
}
```

In `eslint.config.mjs` add this block directly **before** the `server/modules/*/routes.ts` block (the patterns `serverImport`, `drizzleImport` and the `restrict` helper are the Phase 3 constants at the top of the file):

```js
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
```

`components/admin/session-provider.tsx`:

```tsx
"use client"

import { createContext, type ReactNode, useContext } from "react"

import type { Role } from "@/lib/auth/roles"

/** What the admin UI knows about the signed-in user (from requireSession()). */
export type AdminSession = {
  user: {
    id: string
    name: string
    email: string
    title: string | null
    twoFactorEnabled: boolean
  }
  roles: Role[]
  /** Set while an owner/admin is viewing the admin as this user. */
  impersonatedBy: string | null
}

const AdminSessionContext = createContext<AdminSession | null>(null)

export function AdminSessionProvider({
  value,
  children,
}: {
  value: AdminSession
  children: ReactNode
}) {
  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  )
}

export function useAdminSession(): AdminSession {
  const session = useContext(AdminSessionContext)
  if (!session)
    throw new Error("useAdminSession must be used inside <AdminShell>")
  return session
}
```

`hooks/use-permission.ts`:

```ts
"use client"

import { useAdminSession } from "@/components/admin/session-provider"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

/**
 * UI convenience only (hide buttons the user cannot use). The API checks
 * every request again with can() and the services.
 */
export function usePermission(req: PermissionRequest): boolean {
  const { roles } = useAdminSession()
  return hasPermission(roles, req)
}
```

`components/admin/providers.tsx`:

```tsx
"use client"

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import type { ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api-client"

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 4xx answers are final (permissions, validation, not found).
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) &&
          failureCount < 2,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined
function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient()
  return (browserQueryClient ??= makeQueryClient())
}

/** TanStack Query, tooltips and toasts for the signed-in admin. */
export function AdminProviders({
  children,
  client,
}: {
  children: ReactNode
  /** Tests pass their own client. */
  client?: QueryClient
}) {
  // No useState: React drops state if it suspends before the first render.
  const queryClient = client ?? getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
```

`components/admin/page-header.tsx`:

```tsx
import type { ReactNode } from "react"

/** Title row of an admin screen: h1, optional description and actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Navigation model and shell**

`components/admin/shell/nav.ts`:

```ts
import {
  Building2,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
  Wrench,
} from "lucide-react"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** null = every signed-in user. Items are hidden without read permission (spec §8.1). */
  permission: PermissionRequest | null
  /** "exact" for /admin (otherwise every admin URL would match). */
  match: "exact" | "prefix"
}

export type NavSection = { label: string; items: NavItem[] }

/**
 * Admin IA (spec §8.1) for the screens that exist. Later phases add their
 * items here (Articles, Media, Leads, SEO, Marketing, Users, Audit log).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        permission: null,
        match: "exact",
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        label: "Pages",
        href: "/admin/pages",
        icon: FileText,
        permission: { page: ["read"] },
        match: "prefix",
      },
      {
        label: "Services",
        href: "/admin/services",
        icon: Wrench,
        permission: { service: ["read"] },
        match: "prefix",
      },
      {
        label: "Team",
        href: "/admin/team",
        icon: Users,
        permission: { collection: ["read"] },
        match: "prefix",
      },
      {
        label: "Clients",
        href: "/admin/clients",
        icon: ShieldCheck,
        permission: { collection: ["read"] },
        match: "prefix",
      },
      {
        label: "Group companies",
        href: "/admin/group-companies",
        icon: Building2,
        permission: { collection: ["read"] },
        match: "prefix",
      },
      {
        label: "Categories",
        href: "/admin/categories",
        icon: Tags,
        permission: { collection: ["read"] },
        match: "prefix",
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        permission: { settings: ["read"] },
        match: "prefix",
      },
    ],
  },
  {
    label: "You",
    items: [
      {
        label: "Account",
        href: "/admin/account",
        icon: UserRound,
        permission: null,
        match: "prefix",
      },
    ],
  },
]

/** The sections and items `roles` may see; empty sections are dropped. */
export function navItems(roles: readonly string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.filter(
      (item) =>
        item.permission === null || hasPermission(roles, item.permission)
    ),
  })).filter((section) => section.items.length > 0)
}

/** True when `pathname` is this item's page (or below it, for "prefix"). */
export function isActiveItem(item: NavItem, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
```

`components/admin/shell/sidebar.tsx`:

```tsx
"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAdminSession } from "@/components/admin/session-provider"
import { cn } from "@/lib/utils"

import { isActiveItem, navItems } from "./nav"

/** Brand mark + "Website admin" label at the top of the navigation. */
export function SidebarBrand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60"
    >
      <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-white px-1.5">
        <Image
          src="/images/logo.png"
          alt=""
          width={44}
          height={27}
          className="h-auto w-11"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-bold text-white">
          Security Partners
        </span>
        <span className="text-xs text-sidebar-foreground/70">
          Website admin
        </span>
      </span>
    </Link>
  )
}

/** The permission-filtered navigation (desktop sidebar and mobile sheet). */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { roles } = useAdminSession()
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {navItems(roles).map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-bold tracking-[0.08em] text-sidebar-foreground/55 uppercase">
            {section.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActiveItem(item, pathname)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/85 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/60",
                      active &&
                        "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-primary"
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Fixed left sidebar from 1024 px (lg) up; below that the topbar opens MobileNav. */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex">
      <SidebarBrand />
      <SidebarNav />
    </aside>
  )
}
```

`components/admin/shell/mobile-nav.tsx`:

```tsx
"use client"

import { Menu } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { SidebarBrand, SidebarNav } from "./sidebar"

/** Below 1024 px the navigation lives in a left sheet (spec §8.2). */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
          />
        }
      >
        <Menu aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 gap-6 overflow-y-auto border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground [&_[data-slot=sheet-close]]:text-sidebar-foreground"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Admin sections</SheetDescription>
        </SheetHeader>
        <SidebarBrand />
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
```

`components/admin/shell/topbar.tsx`:

```tsx
"use client"

import { ExternalLink } from "lucide-react"

import { SignOutButton } from "@/components/admin/auth/sign-out-button"
import { useAdminSession } from "@/components/admin/session-provider"
import { buttonClassName } from "@/components/ui/button"

import { MobileNav } from "./mobile-nav"

/** Page-level header: navigation trigger (mobile), site link, user, sign out. */
export function Topbar({ search }: { search?: React.ReactNode }) {
  const { user, roles } = useAdminSession()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-4 lg:px-6">
      <MobileNav />
      <div className="min-w-0 flex-1">{search}</div>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className={buttonClassName({ variant: "ghost", size: "sm" })}
      >
        <ExternalLink aria-hidden />
        <span className="max-sm:sr-only">View site</span>
      </a>
      <div className="hidden min-w-0 flex-col items-end leading-tight md:flex">
        <span className="max-w-48 truncate text-sm font-medium">
          {user.name}
        </span>
        <span className="text-xs text-muted-foreground capitalize">
          {roles.join(", ")}
        </span>
      </div>
      <SignOutButton />
    </header>
  )
}
```

`components/admin/shell/impersonation-banner.tsx`:

```tsx
"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { api, errorMessage, unwrap } from "@/lib/api-client"

/** Sticky notice while an owner/admin views the admin as another user (spec §6). */
export function ImpersonationBanner({ name }: { name: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div
      role="region"
      aria-label="Impersonation"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-amber-300 px-4 py-2 text-sm font-medium text-amber-950"
    >
      <span className="flex items-center gap-2">
        <Eye aria-hidden className="size-4" />
        You are viewing the admin as {name}. Changes are made as this user.
      </span>
      {error ? <span role="alert">{error}</span> : null}
      <Button
        size="sm"
        variant="outline"
        className="border-amber-950/30 bg-transparent text-amber-950 hover:bg-amber-950/10"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          try {
            await unwrap(api.users["stop-impersonating"].$post())
            // Every cached query belongs to the impersonated user.
            queryClient.clear()
            router.replace("/admin")
            router.refresh()
          } catch (err) {
            setError(errorMessage(err))
            setPending(false)
          }
        }}
      >
        Stop impersonating
      </Button>
    </div>
  )
}
```

`components/admin/shell/admin-shell.tsx`:

```tsx
"use client"

import type { QueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { AdminProviders } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"

import { ImpersonationBanner } from "./impersonation-banner"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

/** Signed-in admin frame: sidebar (≥ 1024 px), topbar, main landmark. */
export function AdminShell({
  session,
  children,
  queryClient,
}: {
  session: AdminSession
  children: ReactNode
  queryClient?: QueryClient
}) {
  return (
    <AdminSessionProvider value={session}>
      <AdminProviders client={queryClient}>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring/50"
        >
          Skip to content
        </a>
        {session.impersonatedBy ? (
          <ImpersonationBanner name={session.user.name} />
        ) : null}
        <div className="flex min-h-svh">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
            >
              {children}
            </main>
          </div>
        </div>
      </AdminProviders>
    </AdminSessionProvider>
  )
}
```

`app/(admin)/admin/(panel)/layout.tsx` (full file):

```tsx
import { Suspense } from "react"

import { AdminShell } from "@/components/admin/shell/admin-shell"
import { requireSession } from "@/server/auth/session"

/**
 * Signed-in admin frame (spec §8). The session is read fresh inside
 * Suspense (Cache Components: request data never in the static shell).
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
  const { user, actor, session } = await requireSession()
  return (
    <AdminShell
      session={{
        user,
        roles: actor.roles,
        impersonatedBy: session.impersonatedBy,
      }}
    >
      {children}
    </AdminShell>
  )
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/admin/nav.test.ts tests/unit/api-client.test.ts`
Expected: PASS (12 + 4 tests).

Run: `pnpm exec vitest run --project dom tests/dom/admin-shell.test.tsx`
Expected: PASS (5 tests). (jsdom prints `Not implemented: navigation to another Document` for the link click — harmless.)

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts eslint.config.mjs components/ui "app/(admin)/admin/admin.css" "app/(admin)/admin/layout.tsx" "app/(admin)/admin/(panel)/layout.tsx" lib/api-client.ts components/admin/session-provider.tsx components/admin/providers.tsx components/admin/page-header.tsx hooks/use-permission.ts components/admin/shell tests/dom tests/unit/admin/nav.test.ts tests/unit/api-client.test.ts
git commit -m "feat: add admin shell with permission-filtered navigation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Search API, ⌘K palette, admin shell baselines (master Task 4.1, part 2)

**Files:**
- Create: `lib/admin/page-labels.ts`, `lib/schemas/api/search.ts`, `server/modules/search/{repo,service,routes}.ts`, `hooks/use-debounced-value.ts`, `components/admin/shell/command-palette.tsx`
- Modify: `server/api/app.ts` (mount `/search`), `components/admin/shell/admin-shell.tsx` (palette in the topbar), `tests/visual/seed.ts` (visual admin user)
- Create: `tests/visual/admin-user.ts`, `tests/visual/admin-shell.spec.ts`, baselines `tests/visual/__screenshots__/admin-shell-{desktop,mobile}.png`, `admin-shell-nav-mobile.png`
- Test: `tests/integration/api/search.test.ts`, `tests/dom/command-palette.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`AdminShell`, `navItems`, `usePermission`, `api`, `unwrap`); Phase 3 `PAGE_KEYS`, `PAGE_PATHS` (`templates/registry.ts`), tables `services, articles, teamMembers, clients, groupCompanies, articleCategories`, `seedContent`.
- Produces:

```ts
// lib/admin/page-labels.ts
export const PAGE_LABELS: Record<PageKey, string>
// lib/schemas/api/search.ts
export const searchQuery: z.ZodObject<{ q }>                    // 1..100 chars
export const SEARCH_TYPES = ["page","service","team","client","groupCompany","category"] as const
export type SearchResult = { type: SearchType; id: string; title: string; subtitle: string | null; href: string }
export const OPTION_COLLECTIONS = ["articles","services","categories","pages","links"] as const
export type OptionItem = { value: string; label: string; group: string }
export const optionsParam
// GET /api/v1/admin/search?q=           → { items: SearchResult[] }  (≤ 5 per type, filtered by read permission)
// GET /api/v1/admin/search/options/:collection → { items: OptionItem[] }  (403 without read on that collection; "links" merges readable pages/services/articles as URL paths)
// components/admin/shell/command-palette.tsx
export function isPaletteShortcut(event: KeyboardEvent): boolean   // ⌘K / Ctrl+K
export function CommandPalette(): JSX.Element                      // topbar trigger + dialog
// hooks/use-debounced-value.ts
export function useDebouncedValue<T>(value: T, delay: number): T
```

Search covers the records whose admin screens exist in this phase (pages, services, team, clients, group companies, categories). Phase 5 adds `article`, Phase 7 `lead`.

- [ ] **Step 1: Write the failing tests**

`tests/integration/api/search.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest"

import type { OptionItem, SearchResult } from "@/lib/schemas/api/search"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let intake: string
let marketer: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  intake = (await signedInUser(["intake"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
})

async function search(cookie: string, q: string) {
  const res = await adminRequest(`/search?q=${encodeURIComponent(q)}`, {
    cookie,
  })
  expect(res.status).toBe(200)
  return ((await res.json()) as { items: SearchResult[] }).items
}

describe("GET /api/v1/admin/search (⌘K, master 4.1)", () => {
  it("finds pages, services and collection records an editor can read", async () => {
    const alarm = await search(editor, "alarm")
    expect(alarm.map((r) => [r.type, r.title])).toEqual([
      ["service", "Alarm Responses"],
      ["category", "Alarm Response"],
    ])
    expect(alarm[0].href).toMatch(/^\/admin\/services\/[0-9a-f-]{36}$/)
    expect(alarm[0].subtitle).toBe("/services/alarm-responses")

    const home = await search(editor, "home")
    expect(home[0]).toEqual({
      type: "page",
      id: "home",
      title: "Home",
      subtitle: "/",
      href: "/admin/pages/home",
    })

    const team = await search(editor, "moran")
    expect(team).toEqual([
      expect.objectContaining({ type: "team", title: "Sarah Moran" }),
    ])
  })

  it("filters result types by read permission", async () => {
    expect(await search(intake, "alarm")).toEqual([])
    // marketer reads pages and services but not collections
    expect((await search(marketer, "alarm")).map((r) => r.type)).toEqual([
      "service",
    ])
  })

  it("treats LIKE wildcards literally and caps each type", async () => {
    expect(await search(editor, "%")).toEqual([])
    const services = (await search(editor, "s")).filter(
      (r) => r.type === "service"
    )
    expect(services.length).toBeLessThanOrEqual(5)
  })

  it("rejects an empty query and anonymous requests", async () => {
    expect((await adminRequest("/search?q=", { cookie: editor })).status).toBe(
      422
    )
    expect((await adminRequest("/search?q=x")).status).toBe(401)
  })
})

describe("GET /api/v1/admin/search/options/:collection (SchemaForm pickers)", () => {
  async function options(cookie: string, collection: string) {
    const res = await adminRequest(`/search/options/${collection}`, { cookie })
    return {
      status: res.status,
      items: res.ok
        ? ((await res.json()) as { items: OptionItem[] }).items
        : [],
    }
  }

  it("lists articles by slug and links by URL path", async () => {
    const articles = await options(editor, "articles")
    expect(articles.status).toBe(200)
    expect(articles.items).toContainEqual({
      value: "18-years-of-watching-over-ireland",
      label: "18 Years of Watching Over Ireland",
      group: "Articles",
    })
    const links = await options(editor, "links")
    expect(links.items.map((i) => i.value)).toEqual(
      expect.arrayContaining([
        "/",
        "/contact",
        "/services/alarm-responses",
        "/blog/18-years-of-watching-over-ireland",
      ])
    )
  })

  it("enforces read permission per collection", async () => {
    expect((await options(intake, "articles")).status).toBe(403)
    expect((await options(intake, "links")).items).toEqual([])
    expect((await options(editor, "nope")).status).toBe(422)
  })
})
```

`tests/dom/command-palette.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { isPaletteShortcut } from "@/components/admin/shell/command-palette"
import type { Role } from "@/lib/auth/roles"

function renderShell(roles: Role[] = ["editor"]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Edith Editor",
          email: "e@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <p>Body</p>
    </AdminShell>
  )
}

const fetchMock = vi.fn()

beforeEach(() => {
  push.mockReset()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost")
    expect(url.pathname).toBe("/api/v1/admin/search")
    return new Response(
      JSON.stringify({
        items: [
          {
            type: "service",
            id: "s1",
            title: "Alarm Responses",
            subtitle: "/services/alarm-responses",
            href: "/admin/services/s1",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  })
  vi.stubGlobal("fetch", fetchMock)
})

describe("⌘K command palette (master 4.1)", () => {
  it("recognises ⌘K and Ctrl+K only", () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init)
    expect(isPaletteShortcut(key({ key: "k", metaKey: true }))).toBe(true)
    expect(isPaletteShortcut(key({ key: "K", ctrlKey: true }))).toBe(true)
    expect(isPaletteShortcut(key({ key: "k" }))).toBe(false)
    expect(
      isPaletteShortcut(key({ key: "k", ctrlKey: true, shiftKey: true }))
    ).toBe(false)
  })

  it("opens with Ctrl+K, searches records and opens the chosen one", async () => {
    const user = userEvent.setup()
    renderShell()
    await user.keyboard("{Control>}k{/Control}")
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    await user.type(
      within(dialog).getByRole("combobox", { name: "Search" }),
      "alarm"
    )
    const option = await within(dialog).findByRole("option", {
      name: /Alarm Responses/,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=alarm")
    await user.click(option)
    expect(push).toHaveBeenCalledWith("/admin/services/s1")
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Search the admin" })
      ).toBeNull()
    )
  })

  it("lists only the sections and actions the user may use", async () => {
    const user = userEvent.setup()
    renderShell(["intake"])
    await user.click(screen.getByRole("button", { name: /Search/ }))
    const dialog = await screen.findByRole("dialog", {
      name: "Search the admin",
    })
    const options = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent)
    expect(options).toEqual(["Dashboard", "Account", "Open the public site"])
    await user.type(within(dialog).getByRole("combobox"), "acc")
    expect(
      within(dialog)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Account"])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration tests/integration/api/search.test.ts`
Expected: FAIL — `/api/v1/admin/search` answers 404 `Route not found` (expected 200; the test's imports from `lib/schemas/api/search` are type-only).

Run: `pnpm exec vitest run --project dom tests/dom/command-palette.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/shell/command-palette"`.

- [ ] **Step 3: Search module**

`lib/admin/page-labels.ts`:

```ts
import type { PageKey } from "@/templates/registry"

/** Admin names of the eight fixed pages (sidebar, search, page list). */
export const PAGE_LABELS: Record<PageKey, string> = {
  home: "Home",
  about: "About",
  services: "Services",
  team: "Team",
  blog: "Blog",
  contact: "Contact",
  privacy: "Privacy policy",
  terms: "Terms of use",
}
```

`lib/schemas/api/search.ts`:

```ts
import { z } from "zod"

/** GET /api/v1/admin/search?q= (⌘K palette). */
export const searchQuery = z.object({
  q: z.string().trim().min(1, "Type something to search").max(100),
})

export const SEARCH_TYPES = [
  "page",
  "service",
  "team",
  "client",
  "groupCompany",
  "category",
] as const
export type SearchType = (typeof SEARCH_TYPES)[number]

export type SearchResult = {
  type: SearchType
  id: string
  title: string
  subtitle: string | null
  /** Admin URL that edits the record. */
  href: string
}

/** Per-type cap so one busy type cannot crowd out the others. */
export const SEARCH_LIMIT_PER_TYPE = 5

/** Option sources for SchemaForm's collection and link widgets. */
export const OPTION_COLLECTIONS = [
  "articles",
  "services",
  "categories",
  "pages",
  "links",
] as const
export type OptionCollection = (typeof OPTION_COLLECTIONS)[number]
export const optionsParam = z.object({ collection: z.enum(OPTION_COLLECTIONS) })

export type OptionItem = {
  /** Stored value: slug (articles/services), id (categories), URL path (pages/links). */
  value: string
  label: string
  group: string
}
```

`server/modules/search/repo.ts`:

```ts
import "server-only"

import { asc, ilike, or, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  articleCategories,
  articles,
  clients,
  groupCompanies,
  services,
  teamMembers,
} from "@/server/db/schema"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)
const contains = (q: string) => `%${escapeLike(q)}%`

const serviceTitle = sql<string>`${services.draft}->>'title'`
const articleTitle = sql<string>`${articles.draft}->>'title'`

export function searchServices(db: DbOrTx, q: string, limit: number) {
  return db
    .select({ id: services.id, slug: services.slug, title: serviceTitle })
    .from(services)
    .where(
      or(ilike(serviceTitle, contains(q)), ilike(services.slug, contains(q)))
    )
    .orderBy(asc(services.sortOrder))
    .limit(limit)
}

export function searchTeam(db: DbOrTx, q: string, limit: number) {
  return db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .where(
      or(
        ilike(teamMembers.name, contains(q)),
        ilike(teamMembers.role, contains(q))
      )
    )
    .orderBy(asc(teamMembers.sortOrder))
    .limit(limit)
}

export function searchClients(db: DbOrTx, q: string, limit: number) {
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(ilike(clients.name, contains(q)))
    .orderBy(asc(clients.sortOrder))
    .limit(limit)
}

export function searchGroupCompanies(db: DbOrTx, q: string, limit: number) {
  return db
    .select({
      id: groupCompanies.id,
      name: groupCompanies.name,
      site: groupCompanies.site,
    })
    .from(groupCompanies)
    .where(
      or(
        ilike(groupCompanies.name, contains(q)),
        ilike(groupCompanies.site, contains(q))
      )
    )
    .orderBy(asc(groupCompanies.sortOrder))
    .limit(limit)
}

export function searchCategories(db: DbOrTx, q: string, limit: number) {
  return db
    .select({
      id: articleCategories.id,
      name: articleCategories.name,
      slug: articleCategories.slug,
    })
    .from(articleCategories)
    .where(
      or(
        ilike(articleCategories.name, contains(q)),
        ilike(articleCategories.slug, contains(q))
      )
    )
    .orderBy(asc(articleCategories.sortOrder))
    .limit(limit)
}

/** Every service (slug + draft title) in display order (option lists). */
export function serviceOptionRows(db: DbOrTx) {
  return db
    .select({ slug: services.slug, title: serviceTitle })
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.slug))
}

/** Every article (slug + draft title), newest first (option lists). */
export function articleOptionRows(db: DbOrTx) {
  return db
    .select({ slug: articles.slug, title: articleTitle })
    .from(articles)
    .orderBy(sql`${articles.publishedAt} desc nulls first`, asc(articles.slug))
}

export function categoryOptionRows(db: DbOrTx) {
  return db
    .select({ id: articleCategories.id, name: articleCategories.name })
    .from(articleCategories)
    .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.name))
}
```

`server/modules/search/service.ts`:

```ts
import "server-only"

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { hasPermission } from "@/lib/auth/permissions"
import {
  type OptionCollection,
  type OptionItem,
  SEARCH_LIMIT_PER_TYPE,
  type SearchResult,
} from "@/lib/schemas/api/search"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden } from "@/server/lib/errors"
import { PAGE_KEYS, PAGE_PATHS } from "@/templates/registry"

import * as repo from "./repo"

const LIMIT = SEARCH_LIMIT_PER_TYPE

/** ⌘K search across the records whose screens the actor may read. */
export async function search(
  actor: Actor,
  q: string
): Promise<{ items: SearchResult[] }> {
  const db = getDb()
  const can = (req: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.roles, req)
  const needle = q.toLowerCase()
  const items: SearchResult[] = []

  if (can({ page: ["read"] }))
    items.push(
      ...PAGE_KEYS.filter((key) =>
        [key, PAGE_LABELS[key], PAGE_PATHS[key]].some((v) =>
          v.toLowerCase().includes(needle)
        )
      )
        .slice(0, LIMIT)
        .map((key) => ({
          type: "page" as const,
          id: key,
          title: PAGE_LABELS[key],
          subtitle: PAGE_PATHS[key],
          href: `/admin/pages/${key}`,
        }))
    )

  if (can({ service: ["read"] }))
    for (const row of await repo.searchServices(db, q, LIMIT))
      items.push({
        type: "service",
        id: row.id,
        title: row.title,
        subtitle: `/services/${row.slug}`,
        href: `/admin/services/${row.id}`,
      })

  if (can({ collection: ["read"] })) {
    const [team, clientRows, companies, categories] = await Promise.all([
      repo.searchTeam(db, q, LIMIT),
      repo.searchClients(db, q, LIMIT),
      repo.searchGroupCompanies(db, q, LIMIT),
      repo.searchCategories(db, q, LIMIT),
    ])
    for (const row of team)
      items.push({
        type: "team",
        id: row.id,
        title: row.name,
        subtitle: row.role,
        href: `/admin/team?edit=${row.id}`,
      })
    for (const row of clientRows)
      items.push({
        type: "client",
        id: row.id,
        title: row.name,
        subtitle: null,
        href: `/admin/clients?edit=${row.id}`,
      })
    for (const row of companies)
      items.push({
        type: "groupCompany",
        id: row.id,
        title: row.name,
        subtitle: row.site,
        href: `/admin/group-companies?edit=${row.id}`,
      })
    for (const row of categories)
      items.push({
        type: "category",
        id: row.id,
        title: row.name,
        subtitle: row.slug,
        href: `/admin/categories?edit=${row.id}`,
      })
  }

  return { items }
}

/**
 * Values for SchemaForm pickers. `links` merges every internal destination
 * the actor may read (pages, services, articles) as URL paths.
 */
export async function options(
  actor: Actor,
  collection: OptionCollection
): Promise<{ items: OptionItem[] }> {
  const db = getDb()
  const can = (req: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.roles, req)

  const pages = (): OptionItem[] =>
    PAGE_KEYS.map((key) => ({
      value: PAGE_PATHS[key],
      label: PAGE_LABELS[key],
      group: "Pages",
    }))
  const serviceItems = async (byPath: boolean): Promise<OptionItem[]> =>
    (await repo.serviceOptionRows(db)).map((row) => ({
      value: byPath ? `/services/${row.slug}` : row.slug,
      label: row.title,
      group: "Services",
    }))
  const articleItems = async (byPath: boolean): Promise<OptionItem[]> =>
    (await repo.articleOptionRows(db)).map((row) => ({
      value: byPath ? `/blog/${row.slug}` : row.slug,
      label: row.title,
      group: "Articles",
    }))

  switch (collection) {
    case "pages":
      if (!can({ page: ["read"] })) throw forbidden()
      return { items: pages() }
    case "services":
      if (!can({ service: ["read"] })) throw forbidden()
      return { items: await serviceItems(false) }
    case "articles":
      if (!can({ article: ["read"] })) throw forbidden()
      return { items: await articleItems(false) }
    case "categories":
      if (!can({ collection: ["read"] })) throw forbidden()
      return {
        items: (await repo.categoryOptionRows(db)).map((row) => ({
          value: row.id,
          label: row.name,
          group: "Categories",
        })),
      }
    case "links": {
      const items: OptionItem[] = []
      if (can({ page: ["read"] })) items.push(...pages())
      if (can({ service: ["read"] })) items.push(...(await serviceItems(true)))
      if (can({ article: ["read"] })) items.push(...(await articleItems(true)))
      return { items }
    }
  }
}
```

`server/modules/search/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { optionsParam, searchQuery } from "@/lib/schemas/api/search"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** Any signed-in user may search; results are filtered by permission in the service. */
export const searchRoutes = new Hono<AppEnv>()
  .get("/", zv("query", searchQuery), async (c) =>
    c.json(await service.search(actorOf(c), c.req.valid("query").q), 200)
  )
  .get("/options/:collection", zv("param", optionsParam), async (c) =>
    c.json(
      await service.options(actorOf(c), c.req.valid("param").collection),
      200
    )
  )
```

In `server/api/app.ts` add `import { searchRoutes } from "@/server/modules/search/routes"` (alphabetical, after the `healthRoutes` import) and chain `.route("/search", searchRoutes)` after `.route("/users", usersRoutes)` in `adminRoutes`.

- [ ] **Step 4: ⌘K palette**

`hooks/use-debounced-value.ts`:

```ts
"use client"

import { useEffect, useState } from "react"

/** `value`, updated only after it stops changing for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
```

`components/admin/shell/command-palette.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Building2,
  ExternalLink,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Tags,
  Users,
  Wrench,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { useAdminSession } from "@/components/admin/session-provider"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"
import type { SearchType } from "@/lib/schemas/api/search"

import { navItems } from "./nav"

const TYPE_ICONS: Record<SearchType, typeof FileText> = {
  page: FileText,
  service: Wrench,
  team: Users,
  client: ShieldCheck,
  groupCompany: Building2,
  category: Tags,
}

const TYPE_LABELS: Record<SearchType, string> = {
  page: "Page",
  service: "Service",
  team: "Team member",
  client: "Client",
  groupCompany: "Group company",
  category: "Category",
}

/** True for ⌘K (macOS) / Ctrl+K (elsewhere). */
export function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

/**
 * ⌘K palette (spec §8.2): jump to a section, run a quick action or open a
 * record found by the search API. Renders its own topbar trigger.
 */
export function CommandPalette() {
  const router = useRouter()
  const { roles } = useAdminSession()
  const canCreateService = usePermission({ service: ["create"] })
  const canEditPages = usePermission({ page: ["update"] })
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = useDebouncedValue(query.trim(), 200)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isPaletteShortcut(event)) return
      event.preventDefault()
      setOpen((value) => !value)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => unwrap(api.search.$get({ query: { q } })),
    enabled: open && q.length >= 2,
    staleTime: 10_000,
  })

  const needle = query.trim().toLowerCase()
  const sections = navItems(roles)
    .flatMap((section) => section.items)
    .filter((item) => !needle || item.label.toLowerCase().includes(needle))
  const actions = [
    canEditPages && {
      id: "edit-home",
      label: "Edit the home page",
      icon: FileText,
      run: () => router.push("/admin/pages/home"),
    },
    canCreateService && {
      id: "new-service",
      label: "New service",
      icon: Plus,
      run: () => router.push("/admin/services/new"),
    },
    {
      id: "open-site",
      label: "Open the public site",
      icon: ExternalLink,
      run: () => window.open("/", "_blank", "noopener"),
    },
  ].filter(
    (a): a is Exclude<typeof a, false> =>
      !!a && (!needle || a.label.toLowerCase().includes(needle))
  )

  function go(run: () => void) {
    setOpen(false)
    setQuery("")
    run()
  }

  const records = results.data?.items ?? []
  const searching = q.length >= 2 && results.isFetching

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full max-w-sm justify-start gap-2 text-muted-foreground max-sm:w-auto max-sm:border-transparent"
      >
        <Search aria-hidden />
        <span className="max-sm:sr-only">Search…</span>
        <Kbd className="ml-auto max-sm:hidden">⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
        title="Search the admin"
        description="Jump to a section, run an action or find a page, service or team member."
      >
        {/* Server results are already filtered: cmdk must not filter again. */}
        <Command shouldFilter={false} label="Search">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, services, team… or type a section"
          />
          <CommandList>
            <CommandEmpty>
              {searching ? "Searching…" : `No results for “${query.trim()}”.`}
            </CommandEmpty>
            {records.length > 0 ? (
              <CommandGroup heading="Records">
                {records.map((record) => {
                  const Icon = TYPE_ICONS[record.type]
                  return (
                    <CommandItem
                      key={`${record.type}:${record.id}`}
                      value={`${record.type}:${record.id}`}
                      onSelect={() => go(() => router.push(record.href))}
                    >
                      <Icon aria-hidden />
                      <span className="truncate">{record.title}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {TYPE_LABELS[record.type]}
                        {record.subtitle ? ` · ${record.subtitle}` : ""}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
            {sections.length > 0 ? (
              <CommandGroup heading="Go to">
                {sections.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem
                      key={item.href}
                      value={`nav:${item.href}`}
                      onSelect={() => go(() => router.push(item.href))}
                    >
                      <Icon aria-hidden />
                      {item.label}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
            {actions.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  {actions.map((action) => {
                    const Icon = action.icon
                    return (
                      <CommandItem
                        key={action.id}
                        value={`action:${action.id}`}
                        onSelect={() => go(action.run)}
                      >
                        <Icon aria-hidden />
                        {action.label}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
```

In `components/admin/shell/admin-shell.tsx` add `import { CommandPalette } from "./command-palette"` (above the `ImpersonationBanner` import) and replace `<Topbar />` with `<Topbar search={<CommandPalette />} />`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/api/search.test.ts`
Expected: PASS (6 tests).

Run: `pnpm exec vitest run --project dom`
Expected: PASS (8 tests: shell 5, palette 3).

- [ ] **Step 6: Admin shell visual baselines (new, spec §15)**

`tests/visual/admin-user.ts`:

```ts
// The admin the shell screenshots sign in as. Created by tests/visual/seed.ts.
export const VISUAL_ADMIN = {
  email: "vera@visual.test",
  name: "Vera Visual",
  password: "visual-password-0123456789",
} as const
```

`tests/visual/seed.ts` (full file):

```ts
// Gives the server under test (playwright.config.ts webServer) a database
// with exactly the seeded content, so screenshots compare seed → Phase 0
// baselines, plus the admin the shell screenshots sign in as. Runs before
// `next start` on every Playwright run:
//   pnpm tsx:server tests/visual/seed.ts   (env from tests/e2e/env.ts)
import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import { seedContent } from "@/server/db/seed"
import { getEnv } from "@/server/env"

import { resetDb } from "../integration/db"

import { VISUAL_ADMIN } from "./admin-user"

const { DATABASE_URL } = getEnv()
const name = new URL(DATABASE_URL).pathname
if (!name.endsWith("_e2e"))
  throw new Error(`Refusing to reset a non-E2E database (${name})`)

await runMigrations(DATABASE_URL)
await resetDb()
const report = await seedContent(getDb())
await getAuth().api.createUser({
  body: {
    email: VISUAL_ADMIN.email,
    name: VISUAL_ADMIN.name,
    role: ["admin"],
    password: VISUAL_ADMIN.password,
  },
})
await closeDb()
console.log(
  `[visual] ${name.slice(1)} reset and seeded (${report.pages} pages, 1 admin)`
)
```

`tests/visual/admin-shell.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"

import { clientIpFor } from "../e2e/fixtures"

import { VISUAL_ADMIN } from "./admin-user"

// Admin shell baselines (spec §15: "Admin shell baselines added in Phase 4").
// The page content (<main>) is masked: only the frame is pinned here, so
// later dashboard/data changes do not move these screenshots.

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(
      `visual ${testInfo.title} ${testInfo.project.name}`
    ),
  })
})

async function signIn(page: Page) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(VISUAL_ADMIN.email)
  await page.getByLabel("Password", { exact: true }).fill(VISUAL_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(
    page.getByRole("heading", { name: `Welcome, ${VISUAL_ADMIN.name}` })
  ).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test("admin shell frame", async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveScreenshot("admin-shell.png", {
    mask: [page.getByRole("main")],
  })
})

test("admin navigation sheet (below 1024 px)", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "the sheet exists below lg only"
  )
  await signIn(page)
  await page.getByRole("button", { name: "Open navigation" }).click()
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible()
  await expect(page).toHaveScreenshot("admin-shell-nav.png", {
    mask: [page.getByRole("main")],
  })
})
```

Port 3100 must be free and no other agent may be running Playwright or `next build`.

Run: `pnpm exec playwright test tests/visual/admin-shell.spec.ts --update-snapshots=missing`
Expected: `3 passed, 1 skipped` (desktop skips the sheet test) and three new files `tests/visual/__screenshots__/admin-shell-desktop.png`, `admin-shell-mobile.png`, `admin-shell-nav-mobile.png`. Open them: navy sidebar with the logo tile and the nine nav items (desktop), topbar with the menu button (mobile), the navigation sheet (mobile); `<main>` is masked.

Run: `pnpm test:visual` (twice)
Expected: `43 passed, 1 skipped` both times — the 40 public baselines still 0 px, the admin shell is deterministic.

Run: `pnpm test:e2e`
Expected: all Phase 2/3 specs pass (Sign out is still in the banner, one "Account" link, `Welcome, …` heading).

- [ ] **Step 7: Commit**

```bash
git add lib/admin/page-labels.ts lib/schemas/api/search.ts server/modules/search server/api/app.ts hooks/use-debounced-value.ts components/admin/shell tests/integration/api/search.test.ts tests/dom/command-palette.test.tsx tests/visual/admin-user.ts tests/visual/seed.ts tests/visual/admin-shell.spec.ts tests/visual/__screenshots__/admin-shell-desktop.png tests/visual/__screenshots__/admin-shell-mobile.png tests/visual/__screenshots__/admin-shell-nav-mobile.png
git commit -m "feat: add admin search, command palette and shell baselines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Versioning service, revisions, media usages, pages API (master Task 4.2)

**Files:**
- Create: `lib/json.ts`, `lib/schemas/api/content.ts`, `server/lib/versioning.ts`, `server/lib/media-usages.ts`, `server/modules/revisions/{repo,service,routes}.ts`, `server/modules/pages/{service,routes}.ts`
- Modify: `lib/media.ts` (append `collectMediaFields`), `server/modules/media/repo.ts` (usage rows), `server/modules/pages/repo.ts` (edit rows + optimistic update), `server/api/app.ts` (mount `/pages`, `/revisions`)
- Test: `tests/unit/json.test.ts`, `tests/integration/api/pages.test.ts`

**Interfaces:**
- Consumes: Phase 3 tables `pages, revisions, media, mediaUsages, users`, `tag`/`invalidate`, `templateSchemaFor`, `PAGE_PATHS`; Phase 2 `writeAudit`, `AppError`/`conflict`/`notFound`/`fieldErrorsFromIssues`, `can`, `actorOf`, `zv`.
- Produces (master Shared contract `server/lib/versioning.ts`):

```ts
// lib/json.ts
export function stableStringify(value: unknown): string
export function isDeepEqual(a: unknown, b: unknown): boolean          // ignores object key order (jsonb)
export type ValueChange = { path: string; before: unknown; after: unknown }
export function diffValues(before: unknown, after: unknown, path?: string): ValueChange[]
// lib/media.ts (appended)
export type MediaField = { mediaId: string; field: string }
export function collectMediaFields(value: unknown, path?: string): MediaField[]
// lib/schemas/api/content.ts
export const versionInput, draftInput /* { draft: unknown, version } */, restoreInput /* { revisionId, version } */, pageKeyParam
export const REVISION_ENTITIES = ["page","service","settings","team","client","groupCompany","category"] as const
export const revisionListParam, revisionParam
export type ContentStatus; export type VersionedDto<T> = { draft: T; published: T | null; version; status; dirty: boolean; publishedAt: string | null; updatedAt: string; updatedBy: { id; name } | null }
export type PageDto = VersionedDto<unknown> & { key: PageKey; label; template; path }; export type PageListItem; RevisionSummary; RevisionDetail
// server/lib/versioning.ts
export type Versioned<T> = { draft: T; published: T | null; version: number; status: ContentStatus; scheduledAt: Date | null; publishedAt: Date | null }
export type VersionedRecord<T> = Versioned<T> & { updatedAt: Date; updatedBy: string | null; updatedByName: string | null }
export type VersionedPatch<T> = { draft?; published?; status?; publishedAt?; updatedBy: string }
export type VersionedStore<T, R> = { entityType; label; schema(record): ZodType<T>; find(db, id); update(db, id, version, patch): Promise<R | null>; tags(record): string[]; present(record): unknown }
export function versionedDto<T>(row: VersionedRecord<T>): VersionedDto<T>
export function validateContent<T>(schema: ZodType<T>, data: unknown): T             // 422 with dot paths
export async function saveDraft(db, store, actor, id, { draft, version }): Promise<R>          // version + 1, media usages, audit "<type>.draft_saved"
export async function publish(db, store, actor, id, { version }): Promise<R>                   // published = draft, revision(version), audit, invalidate(...tags)
export async function restoreRevision(db, store, actor, id, { revisionId, version }): Promise<R>
export async function snapshotRevision(tx, actor, entityType, entityId, data): Promise<number> // version = max + 1 (collections)
// server/lib/media-usages.ts
export async function syncMediaUsages(tx, entityType, entityId, ...values): Promise<MediaField[]>   // 422 on unknown media
export async function clearMediaUsages(tx, entityType, entityId): Promise<void>
// HTTP (all under /api/v1/admin)
GET  /pages                    page:read    → { items: PageListItem[] }   (site order)
GET  /pages/:key               page:read    → PageDto
PUT  /pages/:key/draft         page:update  { draft, version } → PageDto | 409 { error.current: PageDto } | 422
POST /pages/:key/publish       page:publish { version } → PageDto   (invalidate page:<key>)
POST /pages/:key/restore       page:update  { revisionId, version } → PageDto
GET  /revisions/:entity/:id               read of entity → { items: RevisionSummary[] }   (newest first, ≤ 50)
GET  /revisions/:entity/:id/:revisionId   read of entity → RevisionDetail
```

Rules: the draft must satisfy the record's schema to be saved (it is rendered in preview); a stale `version` never overwrites (UPDATE … WHERE version = $v, then 409 with the current DTO); `media_usages` holds the union of media referenced by draft and published, by dot path, rewritten in the same transaction; drafts never invalidate the cache (draft mode bypasses it).

- [ ] **Step 1: Write the failing tests**

`tests/unit/json.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { diffValues, isDeepEqual, stableStringify } from "@/lib/json"
import { collectMediaFields } from "@/lib/media"

describe("isDeepEqual / stableStringify (jsonb ignores key order)", () => {
  it("ignores object key order, not array order", () => {
    expect(
      isDeepEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })
    ).toBe(true)
    expect(isDeepEqual([1, 2], [2, 1])).toBe(false)
    expect(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(
      '{"a":[{"c":2,"d":1}],"b":1}'
    )
  })

  it("keeps strings byte-identical (Review Focus 1)", () => {
    expect(isDeepEqual({ t: "Monday–Friday" }, { t: "Monday-Friday" })).toBe(
      false
    )
    expect(isDeepEqual({ t: "a  b" }, { t: "a b" })).toBe(false)
  })
})

describe("diffValues (publish dialog)", () => {
  it("lists leaf changes by path; media refs and rich text are leaves", () => {
    const before = {
      hero: { heading: "A", image: { mediaId: "m1" } },
      stats: [{ value: "1" }, { value: "2" }],
      body: { type: "doc", content: [{ type: "paragraph" }] },
    }
    const after = {
      hero: { heading: "B", image: { mediaId: "m2" } },
      stats: [{ value: "1" }, { value: "3" }],
      body: { type: "doc", content: [] },
    }
    expect(diffValues(before, after)).toEqual([
      { path: "hero.heading", before: "A", after: "B" },
      {
        path: "hero.image",
        before: { mediaId: "m1" },
        after: { mediaId: "m2" },
      },
      { path: "stats.1.value", before: "2", after: "3" },
      { path: "body", before: before.body, after: after.body },
    ])
  })

  it("treats a list whose length changed as one change", () => {
    expect(diffValues({ l: [1] }, { l: [1, 2] })).toEqual([
      { path: "l", before: [1], after: [1, 2] },
    ])
    expect(diffValues(null, { a: 1 })).toEqual([
      { path: "", before: null, after: { a: 1 } },
    ])
    expect(diffValues({ a: 1 }, { a: 1 })).toEqual([])
  })
})

describe("collectMediaFields (media_usages rows)", () => {
  it("returns every reference with its dot path", () => {
    expect(
      collectMediaFields({
        hero: { image: { mediaId: "a" } },
        items: [{ icon: { mediaId: "b" } }],
        body: {
          type: "doc",
          content: [
            { type: "image", attrs: { media: { mediaId: "c" }, alt: "" } },
          ],
        },
        notRef: { mediaId: "z", extra: 1 },
      })
    ).toEqual([
      { mediaId: "a", field: "hero.image" },
      { mediaId: "b", field: "items.0.icon" },
      { mediaId: "c", field: "body.content.0.attrs.media" },
    ])
  })
})
```

`tests/integration/api/pages.test.ts`:

```ts
import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Hono runs outside Next here: record invalidations instead of revalidating.
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { PageDto, RevisionSummary } from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import { auditLog, media, pages, revisions } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type HomeDraft = {
  hero: { heading: string; backgroundImage: { mediaId: string } }
}

let editor: string
let viewer: string
let marketer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  revalidateTag.mockClear()
})

async function getHome(cookie = editor) {
  const res = await adminRequest("/pages/home", { cookie })
  expect(res.status).toBe(200)
  return (await res.json()) as PageDto
}

function withHeading(page: PageDto, heading: string) {
  const draft = structuredClone(page.draft) as HomeDraft
  draft.hero.heading = heading
  return draft
}

const saveDraft = (cookie: string, draft: unknown, version: number) =>
  adminRequest("/pages/home/draft", {
    cookie,
    method: "PUT",
    json: { draft, version },
  })

describe("pages API + versioning (master 4.2)", () => {
  it("lists the eight pages in site order with status", async () => {
    const res = await adminRequest("/pages", { cookie: viewer })
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as { items: PageDto[] }
    expect(items.map((p) => p.key)).toEqual([
      "home",
      "about",
      "services",
      "team",
      "blog",
      "contact",
      "privacy",
      "terms",
    ])
    expect(items[0]).toMatchObject({
      label: "Home",
      path: "/",
      template: "home",
      version: 1,
      status: "published",
      dirty: false,
    })
    expect(items[0]).not.toHaveProperty("draft")
  })

  it("saves a draft with the current version → version + 1, site untouched", async () => {
    const home = await getHome()
    const res = await saveDraft(editor, withHeading(home, "Draft heading"), 1)
    expect(res.status).toBe(200)
    const saved = (await res.json()) as PageDto
    expect(saved.version).toBe(2)
    expect(saved.dirty).toBe(true)
    expect((saved.draft as HomeDraft).hero.heading).toBe("Draft heading")
    expect((saved.published as HomeDraft).hero.heading).toBe(
      "Security Partners Ltd."
    )
    expect(saved.updatedBy?.id).toBeTruthy()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("rejects a stale version with 409 and the current state (Review Focus 2)", async () => {
    const home = await getHome()
    // Editor A saves first (version 1 → 2).
    expect(
      (await saveDraft(editor, withHeading(home, "A wins"), 1)).status
    ).toBe(200)
    // Editor B still holds version 1.
    const res = await saveDraft(editor, withHeading(home, "B loses"), 1)
    expect(res.status).toBe(409)
    const body = (await res.json()) as {
      error: { code: string; current: PageDto }
    }
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.current.version).toBe(2)
    expect((body.error.current.draft as HomeDraft).hero.heading).toBe("A wins")
    // Nothing was overwritten.
    expect(((await getHome()).draft as HomeDraft).hero.heading).toBe("A wins")
  })

  it("validates the draft against the template: 422 with field paths", async () => {
    const home = await getHome()
    const res = await saveDraft(editor, withHeading(home, ""), 1)
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(body.error.fieldErrors).toEqual({ "hero.heading": ["Required"] })
    const missing = await saveDraft(editor, { hero: {} }, 1)
    expect(
      Object.keys(((await missing.json()) as typeof body).error.fieldErrors)
    ).toContain("hero.eyebrow")
  })

  it("rejects a reference to an image that is not in the library (422)", async () => {
    const home = await getHome()
    const draft = withHeading(home, "x")
    draft.hero.backgroundImage = {
      mediaId: "00000000-0000-7000-8000-000000000999",
    }
    const res = await saveDraft(editor, draft, 1)
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toEqual([
      "hero.backgroundImage",
    ])
  })

  it("publishes: draft → published, revision, audit, media usages, invalidate page:home", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "Published heading"), 1)
    const res = await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    expect(res.status).toBe(200)
    const page = (await res.json()) as PageDto
    expect(page).toMatchObject({
      version: 3,
      status: "published",
      dirty: false,
    })
    expect((page.published as HomeDraft).hero.heading).toBe("Published heading")
    expect(page.publishedAt).not.toBeNull()
    expect(revalidateTag).toHaveBeenCalledWith("page:home", { expire: 0 })

    const db = getDb()
    const revs = await db
      .select()
      .from(revisions)
      .where(
        and(eq(revisions.entityType, "page"), eq(revisions.entityId, "home"))
      )
    expect(revs.map((r) => r.version)).toEqual([3])
    const audit = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, "home"))
    expect(audit.map((a) => a.action).sort()).toEqual([
      "page.draft_saved",
      "page.published",
    ])
    const usages = await listMediaUsagesFor(db, "page", "home")
    const [hero] = await db
      .select()
      .from(media)
      .where(eq(media.key, "/images/hero.jpg"))
    expect(usages).toContainEqual({
      mediaId: hero.id,
      field: "hero.backgroundImage",
    })
  })

  it("publish with a stale version → 409, nothing published", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "Newer"), 1)
    const res = await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 1 },
    })
    expect(res.status).toBe(409)
    const [row] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "home"))
    expect((row.published as HomeDraft).hero.heading).toBe(
      "Security Partners Ltd."
    )
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("lists revisions and restores one into the draft", async () => {
    const home = await getHome()
    await saveDraft(editor, withHeading(home, "First"), 1)
    await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    await saveDraft(editor, withHeading(home, "Second"), 3)
    await adminRequest("/pages/home/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 4 },
    })

    const list = await adminRequest("/revisions/page/home", { cookie: viewer })
    const { items } = (await list.json()) as { items: RevisionSummary[] }
    expect(items.map((r) => r.version)).toEqual([5, 3])
    expect(items[0].actor?.name).toBeTruthy()

    const detail = await adminRequest(`/revisions/page/home/${items[1].id}`, {
      cookie: viewer,
    })
    expect(
      ((await detail.json()) as { data: HomeDraft }).data.hero.heading
    ).toBe("First")

    const restored = await adminRequest("/pages/home/restore", {
      cookie: editor,
      method: "POST",
      json: { revisionId: items[1].id, version: 5 },
    })
    expect(restored.status).toBe(200)
    const page = (await restored.json()) as PageDto
    expect(page.version).toBe(6)
    expect((page.draft as HomeDraft).hero.heading).toBe("First")
    expect((page.published as HomeDraft).hero.heading).toBe("Second")
    expect(page.dirty).toBe(true)

    const wrong = await adminRequest("/pages/about/restore", {
      cookie: editor,
      method: "POST",
      json: { revisionId: items[1].id, version: 1 },
    })
    expect(wrong.status).toBe(404)
  })

  it("enforces page permissions", async () => {
    const home = await getHome()
    expect((await saveDraft(viewer, withHeading(home, "x"), 1)).status).toBe(
      403
    )
    expect((await adminRequest("/pages", { cookie: marketer })).status).toBe(
      200
    )
    expect(
      (
        await adminRequest("/pages/home/publish", {
          cookie: marketer,
          method: "POST",
          json: { version: 1 },
        })
      ).status
    ).toBe(403)
    expect((await adminRequest("/pages/nope", { cookie: editor })).status).toBe(
      422
    )
    expect(
      (await adminRequest("/revisions/settings/site", { cookie: marketer }))
        .status
    ).toBe(403)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/json.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/json"`.

Run: `pnpm test:integration tests/integration/api/pages.test.ts`
Expected: FAIL — `/api/v1/admin/pages` answers 404 `Route not found` (expected 200) and `listMediaUsagesFor is not a function`.

- [ ] **Step 3: JSON helpers, media fields, API schemas**

`lib/json.ts`:

```ts
// Structural helpers for JSON content (drafts, revisions). Postgres jsonb
// does not keep key order, so comparisons must ignore it.

/** JSON with object keys sorted (stable across jsonb round trips). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          )
        )
      : v
  )
}

/** Deep equality of JSON-like values, ignoring object key order. */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

export type ValueChange = {
  /** Dot path ("hero.heading", "stats.1.label"); "" for the root. */
  path: string
  before: unknown
  after: unknown
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)

/**
 * Leaf-level differences between two JSON values (publish dialog: what will
 * change on the site). Rich text docs and media refs count as one leaf.
 */
export function diffValues(
  before: unknown,
  after: unknown,
  path = ""
): ValueChange[] {
  if (isDeepEqual(before, after)) return []
  const isLeaf = (v: unknown) =>
    isPlainObject(v) && ("mediaId" in v || v.type === "doc")
  if (
    isPlainObject(before) &&
    isPlainObject(after) &&
    !isLeaf(before) &&
    !isLeaf(after)
  ) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    return keys.flatMap((key) =>
      diffValues(before[key], after[key], path ? `${path}.${key}` : key)
    )
  }
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    before.length === after.length
  )
    return before.flatMap((item, i) =>
      diffValues(item, after[i], path ? `${path}.${i}` : String(i))
    )
  return [{ path, before, after }]
}
```

Append to `lib/media.ts` (after `replaceMediaRefs`):

```ts
/** A `{ mediaId }` found in a value, with its dot path ("hero.image", "items.0.icon"). */
export type MediaField = { mediaId: string; field: string }

/** Every media reference in `value` with where it sits (media_usages rows). */
export function collectMediaFields(value: unknown, path = ""): MediaField[] {
  if (isMediaRef(value)) return [{ mediaId: value.mediaId, field: path }]
  const join = (key: string | number) => (path ? `${path}.${key}` : String(key))
  if (Array.isArray(value))
    return value.flatMap((v, i) => collectMediaFields(v, join(i)))
  if (value && typeof value === "object" && !(value instanceof Date))
    return Object.entries(value).flatMap(([k, v]) =>
      collectMediaFields(v, join(k))
    )
  return []
}
```

`lib/schemas/api/content.ts`:

```ts
import { z } from "zod"

import { PAGE_KEYS, type PageKey } from "@/templates/registry"

export const CONTENT_STATUSES = [
  "draft",
  "in_review",
  "scheduled",
  "published",
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

/** Optimistic lock: the version the client last saw (spec §5.1). */
export const versionInput = z.object({ version: z.number().int().min(1) })

/** PUT …/draft. `draft` is validated by the service against the record's schema. */
export const draftInput = versionInput.extend({ draft: z.unknown() })

/** POST …/restore. */
export const restoreInput = versionInput.extend({ revisionId: z.uuid() })

export const pageKeyParam = z.object({
  key: z.enum(PAGE_KEYS as [PageKey, ...PageKey[]]),
})

/** Entity types that keep revision rows (revisions.entity_type). */
export const REVISION_ENTITIES = [
  "page",
  "service",
  "settings",
  "team",
  "client",
  "groupCompany",
  "category",
] as const
export type RevisionEntity = (typeof REVISION_ENTITIES)[number]

export const revisionListParam = z.object({
  entity: z.enum(REVISION_ENTITIES),
  id: z.string().min(1).max(100),
})
export const revisionParam = revisionListParam.extend({
  revisionId: z.uuid(),
})

/** Wire shape of a versioned record (pages, services, settings). Dates are ISO UTC. */
export type VersionedDto<T> = {
  draft: T
  published: T | null
  version: number
  status: ContentStatus
  /** Draft differs from what the site shows. */
  dirty: boolean
  publishedAt: string | null
  updatedAt: string
  updatedBy: { id: string; name: string } | null
}

export type PageDto = VersionedDto<unknown> & {
  key: PageKey
  label: string
  template: string
  path: string
}

export type PageListItem = Omit<PageDto, "draft" | "published">

export type RevisionSummary = {
  id: string
  version: number
  createdAt: string
  actor: { id: string; name: string } | null
}

export type RevisionDetail = RevisionSummary & { data: unknown }
```

- [ ] **Step 4: Media usages, revisions, versioning**

`server/modules/media/repo.ts` (full file):

```ts
import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { media, mediaUsages } from "@/server/db/schema"

export async function findMediaById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id))
  return row ?? null
}

/** The subset of `ids` that exist in the media library. */
export async function existingMediaIds(
  db: DbOrTx,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({ id: media.id })
    .from(media)
    .where(inArray(media.id, ids))
  return new Set(rows.map((r) => r.id))
}

/** Replaces every media_usages row of one entity (same transaction as the save). */
export async function replaceMediaUsages(
  db: DbOrTx,
  entityType: string,
  entityId: string,
  usages: { mediaId: string; field: string }[]
): Promise<void> {
  await deleteMediaUsages(db, entityType, entityId)
  if (usages.length === 0) return
  await db
    .insert(mediaUsages)
    .values(usages.map((u) => ({ ...u, entityType, entityId })))
}

export async function deleteMediaUsages(
  db: DbOrTx,
  entityType: string,
  entityId: string
): Promise<void> {
  await db
    .delete(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId)
      )
    )
}

/** Usage rows of one entity, field order (tests and Phase 6 usages panel). */
export function listMediaUsagesFor(
  db: DbOrTx,
  entityType: string,
  entityId: string
) {
  return db
    .select({ mediaId: mediaUsages.mediaId, field: mediaUsages.field })
    .from(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId)
      )
    )
    .orderBy(mediaUsages.field)
}
```

`server/lib/media-usages.ts`:

```ts
import "server-only"

import { collectMediaFields, type MediaField } from "@/lib/media"
import type { DbOrTx } from "@/server/db/client"
import {
  deleteMediaUsages,
  existingMediaIds,
  replaceMediaUsages,
} from "@/server/modules/media/repo"

import { AppError } from "./errors"

/**
 * Rewrites the media_usages rows of one entity from the values it stores
 * (e.g. draft + published), inside the caller's transaction. media_usages
 * restricts deleting media in use (ledger ruling), so every save keeps
 * these rows exact. A reference to a missing media row → 422 on its field.
 */
export async function syncMediaUsages(
  tx: DbOrTx,
  entityType: string,
  entityId: string,
  ...values: unknown[]
): Promise<MediaField[]> {
  const unique = new Map<string, MediaField>()
  for (const value of values)
    for (const usage of collectMediaFields(value))
      unique.set(`${usage.mediaId} ${usage.field}`, usage)
  const usages = [...unique.values()]
  const found = await existingMediaIds(tx, [
    ...new Set(usages.map((u) => u.mediaId)),
  ])
  const missing = usages.filter((u) => !found.has(u.mediaId))
  if (missing.length > 0) {
    const fieldErrors: Record<string, string[]> = {}
    for (const usage of missing)
      fieldErrors[usage.field] = [
        "This image is no longer in the media library. Choose another.",
      ]
    throw new AppError("VALIDATION_FAILED", "Some images are missing", {
      fieldErrors,
    })
  }
  await replaceMediaUsages(tx, entityType, entityId, usages)
  return usages
}

/** Removes the usage rows of a deleted entity (same transaction as the delete). */
export async function clearMediaUsages(
  tx: DbOrTx,
  entityType: string,
  entityId: string
): Promise<void> {
  await deleteMediaUsages(tx, entityType, entityId)
}
```

`server/modules/revisions/repo.ts`:

```ts
import "server-only"

import { and, desc, eq, max } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { revisions, users } from "@/server/db/schema"

export async function insertRevision(
  db: DbOrTx,
  row: {
    entityType: string
    entityId: string
    version: number
    data: unknown
    actorId: string | null
  }
): Promise<void> {
  await db.insert(revisions).values(row)
}

/** Next revision number of an entity without a version column (max + 1). */
export async function nextRevisionVersion(
  db: DbOrTx,
  entityType: string,
  entityId: string
): Promise<number> {
  const [row] = await db
    .select({ latest: max(revisions.version) })
    .from(revisions)
    .where(
      and(
        eq(revisions.entityType, entityType),
        eq(revisions.entityId, entityId)
      )
    )
  return (row?.latest ?? 0) + 1
}

/** Newest first, with the actor's name (history drawer). */
export function listRevisionRows(
  db: DbOrTx,
  entityType: string,
  entityId: string,
  limit = 50
) {
  return db
    .select({
      id: revisions.id,
      version: revisions.version,
      createdAt: revisions.createdAt,
      actorId: revisions.actorId,
      actorName: users.name,
    })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.actorId))
    .where(
      and(
        eq(revisions.entityType, entityType),
        eq(revisions.entityId, entityId)
      )
    )
    .orderBy(desc(revisions.version))
    .limit(limit)
}

export async function findRevision(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      id: revisions.id,
      entityType: revisions.entityType,
      entityId: revisions.entityId,
      version: revisions.version,
      data: revisions.data,
      createdAt: revisions.createdAt,
      actorId: revisions.actorId,
      actorName: users.name,
    })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.actorId))
    .where(eq(revisions.id, id))
  return row ?? null
}
```

`server/lib/versioning.ts`:

```ts
import "server-only"

import type { z } from "zod"

import { isDeepEqual } from "@/lib/json"
import type { ContentStatus, VersionedDto } from "@/lib/schemas/api/content"
import type { Db, DbOrTx } from "@/server/db/client"
import {
  findRevision,
  insertRevision,
  nextRevisionVersion,
} from "@/server/modules/revisions/repo"

import type { Actor } from "./actor"
import { writeAudit } from "./audit"
import { invalidate } from "./cache-tags"
import { AppError, conflict, fieldErrorsFromIssues, notFound } from "./errors"
import { syncMediaUsages } from "./media-usages"

export type { ContentStatus }

/** Spec §5.1 versioning columns (pages, services, articles, settings). */
export type Versioned<T> = {
  draft: T
  published: T | null
  version: number
  status: ContentStatus
  scheduledAt: Date | null
  publishedAt: Date | null
}

/** A versioned row as a store returns it. */
export type VersionedRecord<T> = Versioned<T> & {
  updatedAt: Date
  updatedBy: string | null
  updatedByName: string | null
}

export type VersionedPatch<T> = {
  draft?: T
  published?: T | null
  status?: ContentStatus
  publishedAt?: Date | null
  updatedBy: string
}

/** Storage adapter for one versioned entity type (implemented in its module). */
export type VersionedStore<
  T,
  R extends VersionedRecord<T> = VersionedRecord<T>,
> = {
  /** revisions.entity_type, media_usages.entity_type, audit "<type>.<action>". */
  entityType: string
  /** For "<label> not found". */
  label: string
  /** Zod schema the draft must satisfy (pages: per template). */
  schema(record: R): z.ZodType<T>
  find(db: DbOrTx, id: string): Promise<R | null>
  /**
   * Applies `patch` and sets version = `version` + 1, only if the stored
   * version still equals `version`. Returns the updated row, or null when
   * the version is stale or the row is gone.
   */
  update(
    db: DbOrTx,
    id: string,
    version: number,
    patch: VersionedPatch<T>
  ): Promise<R | null>
  /** Cache tags to expire when this record is published. */
  tags(record: R): string[]
  /** Wire shape sent back with a 409 (the current state, Review Focus 2). */
  present(record: R): unknown
}

/** Wire fields shared by every versioned DTO (pages, services, settings). */
export function versionedDto<T>(row: VersionedRecord<T>): VersionedDto<T> {
  return {
    draft: row.draft,
    published: row.published,
    version: row.version,
    status: row.status,
    dirty: row.published === null || !isDeepEqual(row.draft, row.published),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy:
      row.updatedBy && row.updatedByName
        ? { id: row.updatedBy, name: row.updatedByName }
        : null,
  }
}

/** Parses with the record's schema; 422 with field paths ("hero.heading"). */
export function validateContent<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success)
    throw new AppError("VALIDATION_FAILED", "Some fields need attention", {
      fieldErrors: fieldErrorsFromIssues(result.error.issues),
    })
  return result.data
}

async function requireRecord<T, R extends VersionedRecord<T>>(
  store: VersionedStore<T, R>,
  db: DbOrTx,
  id: string
): Promise<R> {
  const record = await store.find(db, id)
  if (!record) throw notFound(store.label)
  return record
}

/** After a failed versioned update: 404 if the row is gone, else 409 with the current state. */
async function staleOrMissing<T, R extends VersionedRecord<T>>(
  store: VersionedStore<T, R>,
  db: DbOrTx,
  id: string
): Promise<never> {
  const current = await requireRecord(store, db, id)
  throw conflict(store.present(current))
}

/**
 * Autosave target: validates `draft`, writes it if `version` is current
 * (version + 1), keeps media_usages exact and audits. Never touches the
 * public site (no cache invalidation: drafts are read only in draft mode).
 */
export async function saveDraft<T, R extends VersionedRecord<T>>(
  db: Db,
  store: VersionedStore<T, R>,
  actor: Actor,
  id: string,
  input: { draft: unknown; version: number }
): Promise<R> {
  return db.transaction(async (tx) => {
    const existing = await requireRecord(store, tx, id)
    const draft = validateContent(store.schema(existing), input.draft)
    const updated = await store.update(tx, id, input.version, {
      draft,
      updatedBy: actor.userId,
    })
    if (!updated) return staleOrMissing(store, tx, id)
    await syncMediaUsages(
      tx,
      store.entityType,
      id,
      updated.draft,
      updated.published
    )
    await writeAudit(tx, actor, {
      action: `${store.entityType}.draft_saved`,
      entityType: store.entityType,
      entityId: id,
      diff: { version: updated.version },
    })
    return updated
  })
}

/**
 * Publish = copy draft → published, version + 1, revision row with the
 * published data, audit, then expire the record's cache tags (spec §5.1).
 */
export async function publish<T, R extends VersionedRecord<T>>(
  db: Db,
  store: VersionedStore<T, R>,
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<R> {
  const published = await db.transaction(async (tx) => {
    const existing = await requireRecord(store, tx, id)
    const data = validateContent(store.schema(existing), existing.draft)
    const updated = await store.update(tx, id, input.version, {
      draft: data,
      published: data,
      status: "published",
      publishedAt: new Date(),
      updatedBy: actor.userId,
    })
    if (!updated) return staleOrMissing(store, tx, id)
    await insertRevision(tx, {
      entityType: store.entityType,
      entityId: id,
      version: updated.version,
      data,
      actorId: actor.userId,
    })
    await syncMediaUsages(
      tx,
      store.entityType,
      id,
      updated.draft,
      updated.published
    )
    await writeAudit(tx, actor, {
      action: `${store.entityType}.published`,
      entityType: store.entityType,
      entityId: id,
      diff: { version: updated.version },
    })
    return updated
  })
  invalidate(...store.tags(published))
  return published
}

/** Loads a revision's data into the draft (version + 1). Publishing stays a separate step. */
export async function restoreRevision<T, R extends VersionedRecord<T>>(
  db: Db,
  store: VersionedStore<T, R>,
  actor: Actor,
  id: string,
  input: { revisionId: string; version: number }
): Promise<R> {
  return db.transaction(async (tx) => {
    const existing = await requireRecord(store, tx, id)
    const revision = await findRevision(tx, input.revisionId)
    if (
      !revision ||
      revision.entityType !== store.entityType ||
      revision.entityId !== id
    )
      throw notFound("Revision")
    const parsed = store.schema(existing).safeParse(revision.data)
    if (!parsed.success)
      throw new AppError(
        "VALIDATION_FAILED",
        "This version no longer fits the page's fields and cannot be restored",
        { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) }
      )
    const updated = await store.update(tx, id, input.version, {
      draft: parsed.data,
      updatedBy: actor.userId,
    })
    if (!updated) return staleOrMissing(store, tx, id)
    await syncMediaUsages(
      tx,
      store.entityType,
      id,
      updated.draft,
      updated.published
    )
    await writeAudit(tx, actor, {
      action: `${store.entityType}.restored`,
      entityType: store.entityType,
      entityId: id,
      diff: { revisionId: revision.id, fromVersion: revision.version },
    })
    return updated
  })
}

/**
 * Revision row for records without a version column (team, clients, group
 * companies, categories): version = max + 1 in the caller's transaction
 * (ledger ruling; revisions are unique per entity + version).
 */
export async function snapshotRevision(
  tx: DbOrTx,
  actor: Actor,
  entityType: string,
  entityId: string,
  data: unknown
): Promise<number> {
  const version = await nextRevisionVersion(tx, entityType, entityId)
  await insertRevision(tx, {
    entityType,
    entityId,
    version,
    data,
    actorId: actor.userId,
  })
  return version
}
```

`server/modules/revisions/service.ts`:

```ts
import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type {
  RevisionDetail,
  RevisionEntity,
  RevisionSummary,
} from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden, notFound } from "@/server/lib/errors"

import { findRevision, listRevisionRows } from "./repo"

/** Read permission needed to see an entity's history. */
const READ: Record<RevisionEntity, PermissionRequest> = {
  page: { page: ["read"] },
  service: { service: ["read"] },
  settings: { settings: ["read"] },
  team: { collection: ["read"] },
  client: { collection: ["read"] },
  groupCompany: { collection: ["read"] },
  category: { collection: ["read"] },
}

function assertCanRead(actor: Actor, entity: RevisionEntity) {
  if (!hasPermission(actor.roles, READ[entity])) throw forbidden()
}

const summary = (row: {
  id: string
  version: number
  createdAt: Date
  actorId: string | null
  actorName: string | null
}): RevisionSummary => ({
  id: row.id,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  actor:
    row.actorId && row.actorName
      ? { id: row.actorId, name: row.actorName }
      : null,
})

/** Newest first, at most 50 (Phase 5 prunes older rows). */
export async function listRevisions(
  actor: Actor,
  entity: RevisionEntity,
  entityId: string
): Promise<{ items: RevisionSummary[] }> {
  assertCanRead(actor, entity)
  const rows = await listRevisionRows(getDb(), entity, entityId)
  return { items: rows.map(summary) }
}

export async function getRevision(
  actor: Actor,
  entity: RevisionEntity,
  entityId: string,
  revisionId: string
): Promise<RevisionDetail> {
  assertCanRead(actor, entity)
  const row = await findRevision(getDb(), revisionId)
  if (!row || row.entityType !== entity || row.entityId !== entityId)
    throw notFound("Revision")
  return { ...summary(row), data: row.data }
}
```

`server/modules/revisions/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { revisionListParam, revisionParam } from "@/lib/schemas/api/content"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// Read permission depends on :entity, so the service authorises.
// Restoring is done by the owning module (POST /pages/:key/restore, …).
export const revisionsRoutes = new Hono<AppEnv>()
  .get("/:entity/:id", zv("param", revisionListParam), async (c) => {
    const { entity, id } = c.req.valid("param")
    return c.json(await service.listRevisions(actorOf(c), entity, id), 200)
  })
  .get("/:entity/:id/:revisionId", zv("param", revisionParam), async (c) => {
    const { entity, id, revisionId } = c.req.valid("param")
    return c.json(
      await service.getRevision(actorOf(c), entity, id, revisionId),
      200
    )
  })
```

- [ ] **Step 5: Pages module**

`server/modules/pages/repo.ts` (full file):

```ts
import "server-only"

import { and, asc, eq, getTableColumns } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { pages, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

export async function findPageByKey(db: DbOrTx, key: string) {
  const [row] = await db.select().from(pages).where(eq(pages.key, key))
  return row ?? null
}

const withEditor = {
  ...getTableColumns(pages),
  updatedByName: users.name,
}

/** A page row plus the name of whoever changed it last (admin editor). */
export async function findPageForEdit(db: DbOrTx, key: string) {
  const [row] = await db
    .select(withEditor)
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .where(eq(pages.key, key))
  return row ?? null
}

export type PageEditRow = NonNullable<
  Awaited<ReturnType<typeof findPageForEdit>>
>

export function listPagesForEdit(db: DbOrTx) {
  return db
    .select(withEditor)
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .orderBy(asc(pages.key))
}

/** Optimistic-lock update: only when `version` is current; null otherwise. */
export async function updatePageIfVersion(
  db: DbOrTx,
  key: string,
  version: number,
  patch: VersionedPatch<unknown>
): Promise<PageEditRow | null> {
  const [updated] = await db
    .update(pages)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(pages.key, key), eq(pages.version, version)))
    .returning({ key: pages.key })
  return updated ? findPageForEdit(db, key) : null
}
```

`server/modules/pages/service.ts`:

```ts
import "server-only"

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { PageDto, PageListItem } from "@/lib/schemas/api/content"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { tag } from "@/server/lib/cache-tags"
import { forbidden, notFound } from "@/server/lib/errors"
import {
  publish,
  restoreRevision,
  saveDraft,
  versionedDto,
  type VersionedStore,
} from "@/server/lib/versioning"
import {
  isPageKey,
  PAGE_PATHS,
  PAGES,
  type PageKey,
  templateSchemaFor,
} from "@/templates/registry"

import {
  findPageForEdit,
  listPagesForEdit,
  type PageEditRow,
  updatePageIfVersion,
} from "./repo"

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toDto(row: PageEditRow): PageDto {
  const key = row.key as PageKey
  return {
    key,
    label: PAGE_LABELS[key],
    template: row.template,
    path: PAGE_PATHS[key],
    ...versionedDto<unknown>(row),
  }
}

/** Versioning adapter for pages (id = page key). */
export const pageStore: VersionedStore<unknown, PageEditRow> = {
  entityType: "page",
  label: "Page",
  schema: (row) => templateSchemaFor(row.key as PageKey),
  find: (db, key) => findPageForEdit(db, key),
  update: (db, key, version, patch) =>
    updatePageIfVersion(db, key, version, patch),
  tags: (row) => [tag.page(row.key)],
  present: (row) => toDto(row),
}

export async function listPages(
  actor: Actor
): Promise<{ items: PageListItem[] }> {
  assertCan(actor, { page: ["read"] })
  const rows = await listPagesForEdit(getDb())
  const order = Object.keys(PAGES)
  return {
    items: rows
      .filter((row) => isPageKey(row.key))
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((row) => {
        const dto: Partial<PageDto> = toDto(row)
        delete dto.draft
        delete dto.published
        return dto as PageListItem
      }),
  }
}

export async function getPage(actor: Actor, key: PageKey): Promise<PageDto> {
  assertCan(actor, { page: ["read"] })
  const row = await findPageForEdit(getDb(), key)
  if (!row) throw notFound("Page")
  return toDto(row)
}

export async function savePageDraft(
  actor: Actor,
  key: PageKey,
  input: { draft: unknown; version: number }
): Promise<PageDto> {
  assertCan(actor, { page: ["update"] })
  return toDto(await saveDraft(getDb(), pageStore, actor, key, input))
}

export async function publishPage(
  actor: Actor,
  key: PageKey,
  input: { version: number }
): Promise<PageDto> {
  assertCan(actor, { page: ["publish"] })
  return toDto(await publish(getDb(), pageStore, actor, key, input))
}

export async function restorePage(
  actor: Actor,
  key: PageKey,
  input: { revisionId: string; version: number }
): Promise<PageDto> {
  assertCan(actor, { page: ["update"] })
  return toDto(await restoreRevision(getDb(), pageStore, actor, key, input))
}
```

`server/modules/pages/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  pageKeyParam,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

export const pagesRoutes = new Hono<AppEnv>()
  .get("/", can({ page: ["read"] }), async (c) =>
    c.json(await service.listPages(actorOf(c)), 200)
  )
  .get("/:key", can({ page: ["read"] }), zv("param", pageKeyParam), async (c) =>
    c.json(await service.getPage(actorOf(c), c.req.valid("param").key), 200)
  )
  .put(
    "/:key/draft",
    can({ page: ["update"] }),
    zv("param", pageKeyParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.savePageDraft(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/publish",
    can({ page: ["publish"] }),
    zv("param", pageKeyParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishPage(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/restore",
    can({ page: ["update"] }),
    zv("param", pageKeyParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restorePage(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
```

In `server/api/app.ts` add the imports `import { pagesRoutes } from "@/server/modules/pages/routes"` and `import { revisionsRoutes } from "@/server/modules/revisions/routes"` (alphabetical) and chain, after `.route("/search", searchRoutes)`:

```ts
  .route("/pages", pagesRoutes)
  .route("/revisions", revisionsRoutes)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/json.test.ts tests/unit/media-refs.test.ts`
Expected: PASS (5 + 2 tests).

Run: `pnpm test:integration tests/integration/api/pages.test.ts tests/integration/queries/public-queries.test.ts`
Expected: PASS (9 tests here; the Phase 3 query tests unchanged).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0 (versioning.ts imports no drizzle-orm; repos do).

- [ ] **Step 7: Commit**

```bash
git add lib/json.ts lib/media.ts lib/schemas/api/content.ts server/lib/versioning.ts server/lib/media-usages.ts server/modules/revisions server/modules/media/repo.ts server/modules/pages server/api/app.ts tests/unit/json.test.ts tests/integration/api/pages.test.ts
git commit -m "feat: add versioned drafts, revisions and pages admin API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Rich-text editor and media picker (master Task 4.3, part 1)

**Files:**
- Create: `components/admin/rich-text/{extensions.ts,editor.tsx,toolbar.tsx,image-view.tsx}`, `lib/schemas/api/media.ts`, `server/modules/media/{service,routes}.ts`, `components/admin/media/{picker-dialog.tsx,use-media-item.ts}`
- Modify: `server/modules/media/repo.ts` (paginated list), `server/api/app.ts` (mount `/media`), `app/(admin)/admin/admin.css` (editing surface styles)
- Test: `tests/dom/rich-text-extensions.test.tsx`, `tests/dom/rich-text-editor.test.tsx`, `tests/integration/api/media.test.ts`

**Interfaces:**
- Consumes: Phase 3 `richText`/`paragraphsText`/`isSafeHref` (`lib/schemas/common.ts`) and `mediaUrl` (`server/modules/media/queries.ts`), table `media`; Task 1 `api`, `unwrap`, `makeQueryClient`; Task 2 `useDebouncedValue`; Task 3 `isDeepEqual`.
- Produces:

```ts
// components/admin/rich-text/extensions.ts (no "use client": usable headless)
export type RichTextMode = "full" | "paragraphs"
export const MediaImage: Node                       // "image", attrs { media: { mediaId } | null, alt }
export function richTextExtensions(mode: RichTextMode, options?: { imageView?: NodeViewRenderer }): Extensions
// components/admin/rich-text/editor.tsx
export function RichTextEditor(props: { id; value: JSONContent | null; onChange(doc): void; mode?; label; describedBy?; invalid?; disabled? }): JSX.Element
// lib/schemas/api/media.ts
export const mediaListQuery   // listQuery + sort createdAt|alt + kind?: "image"
export type MediaItem = { id; url; alt; mime; width: number | null; height: number | null; size; createdAt: string }
// GET /api/v1/admin/media?kind=image&q&page&pageSize&sort  media:read → Paginated<MediaItem>
// GET /api/v1/admin/media/:id                               media:read → MediaItem
// components/admin/media/picker-dialog.tsx
export function MediaPickerDialog(props: { open; onOpenChange; onSelect(item: MediaItem): void; selectedId?; title? }): JSX.Element
// components/admin/media/use-media-item.ts
export function useMediaItem(mediaId: string | null | undefined): UseQueryResult<MediaItem>
```

**Scope split (explicit):** the picker lists existing media rows only (the 32 seeded `static` images); there is no upload button in Phase 4. Phase 6 Task 6.2/6.3 adds upload, the media library screen and alt/focal editing to the same `server/modules/media/{routes,service}.ts` and extends `picker-dialog.tsx` with an upload tab.

The editor's ProseMirror schema equals what Phase 3's `richText` Zod schema accepts and `lib/rich-text/render.tsx` renders: paragraph, heading 2/3, bullet/ordered lists of paragraphs (no nesting), blockquote of paragraphs with `cite`, image `{ media, alt }`, hard break, bold, italic, link (safe hrefs only). StarterKit's code, code block, horizontal rule, strike and underline are off; pasted HTML is fitted to that schema. "paragraphs" mode (about copy, service overview) keeps only paragraphs with inline marks.

- [ ] **Step 1: Write the failing tests**

`tests/dom/rich-text-extensions.test.tsx`:

```tsx
import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"

import { richTextExtensions } from "@/components/admin/rich-text/extensions"
import { paragraphsText, richText } from "@/lib/schemas/common"

let editors: Editor[] = []
afterEach(() => {
  for (const e of editors) e.destroy()
  editors = []
})

function parse(html: string, mode: "full" | "paragraphs" = "full") {
  const editor = new Editor({
    extensions: richTextExtensions(mode),
    content: html,
  })
  editors.push(editor)
  return editor.getJSON()
}

const types = (node: { type?: string; content?: unknown[] }): string[] => [
  node.type ?? "",
  ...((node.content ?? []) as { type?: string; content?: unknown[] }[]).flatMap(
    types
  ),
]

describe("rich text editor schema = stored schema (spec §5.3)", () => {
  it("keeps every allowed node and mark, and the result validates", () => {
    const doc = parse(
      [
        "<h2>Title</h2><h3>Sub</h3>",
        '<p>Plain <strong>bold</strong> <em>italic</em> <a href="/contact">link</a><br>next</p>',
        '<ul><li><p>one</p></li></ul><ol start="3"><li><p>two</p></li></ol>',
        '<blockquote cite="Michael"><p>Quote</p></blockquote>',
        '<img data-media-id="00000000-0000-7000-8000-000000000001" alt="Hero">',
      ].join("")
    )
    expect(new Set(types(doc))).toEqual(
      new Set([
        "doc",
        "heading",
        "paragraph",
        "text",
        "hardBreak",
        "bulletList",
        "orderedList",
        "listItem",
        "blockquote",
        "image",
      ])
    )
    const parsed = richText.safeParse(doc)
    expect(parsed.success).toBe(true)
    const blocks = parsed.data!.content
    expect(blocks.find((b) => b.type === "blockquote")).toMatchObject({
      attrs: { cite: "Michael" },
    })
    expect(blocks.find((b) => b.type === "image")).toEqual({
      type: "image",
      attrs: {
        media: { mediaId: "00000000-0000-7000-8000-000000000001" },
        alt: "Hero",
      },
    })
  })

  it("strips what the site cannot render when pasted", () => {
    const doc = parse(
      [
        "<h1>Big</h1><h4>Small</h4>",
        "<pre><code>code()</code></pre><hr><p><s>strike</s> <u>under</u> <code>x</code></p>",
        "<table><tr><td>cell</td></tr></table>",
        '<img src="https://evil.example/x.png">',
        '<p><a href="javascript:alert(1)">bad</a></p>',
        "<ul><li><p>a</p><ul><li><p>nested</p></li></ul></li></ul>",
        "<blockquote><h2>no headings in quotes</h2></blockquote>",
      ].join("")
    )
    const all = types(doc)
    for (const banned of ["codeBlock", "horizontalRule", "table", "code"])
      expect(all).not.toContain(banned)
    expect(JSON.stringify(doc)).not.toContain("javascript:")
    expect(JSON.stringify(doc)).not.toContain("evil.example")
    expect(JSON.stringify(doc)).not.toMatch(/"type":"(strike|underline)"/)
    expect(richText.safeParse(doc).success).toBe(true)
  })

  it("paragraphs mode keeps only paragraphs (with bold, italic, links)", () => {
    const doc = parse(
      '<h2>Heading</h2><p><strong>B</strong> <a href="https://example.com">l</a></p><ul><li><p>item</p></li></ul>',
      "paragraphs"
    )
    expect(new Set(types(doc))).toEqual(new Set(["doc", "paragraph", "text"]))
    expect(paragraphsText.safeParse(doc).success).toBe(true)
  })
})
```

`tests/dom/rich-text-editor.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { makeQueryClient } from "@/components/admin/providers"
import { RichTextEditor } from "@/components/admin/rich-text/editor"
import { richText } from "@/lib/schemas/common"

const LIBRARY = [
  {
    id: "00000000-0000-7000-8000-000000000001",
    url: "/images/hero.jpg",
    alt: "Officer at night",
    mime: "image/jpeg",
    width: 1440,
    height: 748,
    size: 1,
    createdAt: "2026-10-16T00:00:00.000Z",
  },
  {
    id: "00000000-0000-7000-8000-000000000002",
    url: "/images/about.png",
    alt: "Team photo",
    mime: "image/png",
    width: 600,
    height: 400,
    size: 1,
    createdAt: "2026-10-16T00:00:00.000Z",
  },
]

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost")
  const one = url.pathname.match(/^\/api\/v1\/admin\/media\/(.+)$/)
  const body = one
    ? LIBRARY.find((m) => m.id === one[1])
    : {
        items: LIBRARY.filter(
          (m) =>
            !url.searchParams.get("q") ||
            m.alt.includes(url.searchParams.get("q")!)
        ),
        page: 1,
        pageSize: 24,
        total: 2,
      }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
})

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

const doc = (text: string): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

function renderEditor(
  props: Partial<Parameters<typeof RichTextEditor>[0]> = {}
) {
  const onChange = vi.fn()
  const utils = render(
    <QueryClientProvider client={makeQueryClient()}>
      <RichTextEditor
        id="body"
        label="Body"
        value={doc("Hello")}
        onChange={onChange}
        {...props}
      />
    </QueryClientProvider>
  )
  return { ...utils, onChange }
}

describe("RichTextEditor", () => {
  it("renders an accessible textbox with a formatting toolbar", async () => {
    renderEditor()
    const box = await screen.findByRole("textbox", { name: "Body" })
    expect(box).toHaveAttribute("aria-multiline", "true")
    expect(box).toHaveTextContent("Hello")
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" })
    for (const name of [
      "Bold",
      "Italic",
      "Link",
      "Heading",
      "Subheading",
      "Bulleted list",
      "Numbered list",
      "Quote",
      "Insert image",
      "Undo",
      "Redo",
    ])
      expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument()
  })

  it("paragraphs mode offers only inline formatting", async () => {
    renderEditor({ mode: "paragraphs" })
    const toolbar = await screen.findByRole("toolbar", { name: "Formatting" })
    expect(
      within(toolbar)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label"))
    ).toEqual(["Bold", "Italic", "Link", "Undo", "Redo"])
  })

  it("inserts a library image as a { media, alt } node that validates", async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor()
    await screen.findByRole("textbox", { name: "Body" })
    await user.click(screen.getByRole("button", { name: "Insert image" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Choose an image",
    })
    await user.click(
      await within(dialog).findByRole("button", { name: /Team photo/ })
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Use this image" })
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const last = onChange.mock.calls.at(-1)![0] as JSONContent
    const image = last.content!.find((n) => n.type === "image")
    expect(image?.attrs).toEqual({
      media: { mediaId: LIBRARY[1].id },
      alt: "Team photo",
    })
    expect(richText.safeParse(last).success).toBe(true)
  })

  it("replaces its content when the value changes from outside", async () => {
    const { rerender } = renderEditor()
    await screen.findByRole("textbox", { name: "Body" })
    rerender(
      <QueryClientProvider client={makeQueryClient()}>
        <RichTextEditor
          id="body"
          label="Body"
          value={doc("Reloaded")}
          onChange={vi.fn()}
        />
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Body" })).toHaveTextContent(
        "Reloaded"
      )
    )
  })
})

describe("MediaPickerDialog", () => {
  it("searches the library and returns the chosen item", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MediaPickerDialog open onOpenChange={vi.fn()} onSelect={onSelect} />
      </QueryClientProvider>
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Choose an image",
    })
    expect(
      within(dialog).getByRole("button", { name: "Use this image" })
    ).toBeDisabled()
    await user.type(
      within(dialog).getByRole("searchbox", { name: "Search images" }),
      "Officer"
    )
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("button", { name: /Team photo/ })
      ).toBeNull()
    )
    const officer = within(dialog).getByRole("button", {
      name: /Officer at night/,
    })
    await user.click(officer)
    expect(officer).toHaveAttribute("aria-pressed", "true")
    await user.click(
      within(dialog).getByRole("button", { name: "Use this image" })
    )
    expect(onSelect).toHaveBeenCalledWith(LIBRARY[0])
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain("kind=image")
  })
})
```

`tests/integration/api/media.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest"

import type { Paginated } from "@/lib/schemas/api/list"
import type { MediaItem } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let author: string
let intake: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  author = (await signedInUser(["author"])).cookie
  intake = (await signedInUser(["intake"])).cookie
})

async function list(cookie: string, qs: string) {
  const res = await adminRequest(`/media?${qs}`, { cookie })
  return {
    status: res.status,
    body: res.ok ? ((await res.json()) as Paginated<MediaItem>) : null,
  }
}

describe("GET /api/v1/admin/media (picker, Phase 4 read-only)", () => {
  it("pages through seeded library images with their public URLs", async () => {
    const { status, body } = await list(
      author,
      "kind=image&pageSize=10&sort=alt:asc"
    )
    expect(status).toBe(200)
    expect(body!.items).toHaveLength(10)
    expect(body!.total).toBeGreaterThanOrEqual(30)
    expect(body!.items[0].url).toMatch(/^\/images\//)
    expect(body!.items.every((i) => i.mime.startsWith("image/"))).toBe(true)
  })

  it("searches alt text and file names", async () => {
    const { body } = await list(author, "q=hero.jpg")
    expect(body!.items.map((i) => i.url)).toEqual(["/images/hero.jpg"])
    const item = body!.items[0]
    const one = await adminRequest(`/media/${item.id}`, { cookie: author })
    expect(await one.json()).toEqual(item)
  })

  it("requires media:read", async () => {
    expect((await list(intake, "")).status).toBe(403)
    expect(
      (
        await adminRequest("/media/00000000-0000-7000-8000-000000000999", {
          cookie: author,
        })
      ).status
    ).toBe(404)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/rich-text-extensions.test.tsx tests/dom/rich-text-editor.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/rich-text/extensions"` / `"@/components/admin/media/picker-dialog"`.

Run: `pnpm test:integration tests/integration/api/media.test.ts`
Expected: FAIL — 404 `Route not found` for `/api/v1/admin/media` (status 404, expected 200).

- [ ] **Step 3: Read-only media API**

`lib/schemas/api/media.ts`:

```ts
import { z } from "zod"

import { listQuery, sortParam } from "./list"

/** GET /api/v1/admin/media (picker in Phase 4; Phase 6 adds upload and the library screen). */
export const mediaListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "alt"], { field: "createdAt", dir: "desc" }),
  /** "image" = image/* only (pickers); omitted = everything. */
  kind: z.enum(["image"]).optional(),
})
export type MediaListQuery = z.output<typeof mediaListQuery>

export type MediaItem = {
  id: string
  url: string
  alt: string
  mime: string
  width: number | null
  height: number | null
  size: number
  createdAt: string
}
```

`server/modules/media/repo.ts` (full file):

```ts
import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  like,
  or,
} from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { media, mediaUsages } from "@/server/db/schema"

export async function findMediaById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id))
  return row ?? null
}

/** The subset of `ids` that exist in the media library. */
export async function existingMediaIds(
  db: DbOrTx,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({ id: media.id })
    .from(media)
    .where(inArray(media.id, ids))
  return new Set(rows.map((r) => r.id))
}

/** Replaces every media_usages row of one entity (same transaction as the save). */
export async function replaceMediaUsages(
  db: DbOrTx,
  entityType: string,
  entityId: string,
  usages: { mediaId: string; field: string }[]
): Promise<void> {
  await deleteMediaUsages(db, entityType, entityId)
  if (usages.length === 0) return
  await db
    .insert(mediaUsages)
    .values(usages.map((u) => ({ ...u, entityType, entityId })))
}

export async function deleteMediaUsages(
  db: DbOrTx,
  entityType: string,
  entityId: string
): Promise<void> {
  await db
    .delete(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId)
      )
    )
}

/** Usage rows of one entity, field order (tests and Phase 6 usages panel). */
export function listMediaUsagesFor(
  db: DbOrTx,
  entityType: string,
  entityId: string
) {
  return db
    .select({ mediaId: mediaUsages.mediaId, field: mediaUsages.field })
    .from(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId)
      )
    )
    .orderBy(mediaUsages.field)
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

/** Paginated library rows (picker). `q` matches alt text or file key. */
export async function listMediaRows(
  db: DbOrTx,
  opts: {
    q?: string
    imagesOnly: boolean
    sort: { field: "createdAt" | "alt"; dir: "asc" | "desc" }
    page: number
    pageSize: number
  }
) {
  const pattern = opts.q ? `%${escapeLike(opts.q)}%` : null
  const where = and(
    opts.imagesOnly ? like(media.mime, "image/%") : undefined,
    pattern
      ? or(ilike(media.alt, pattern), ilike(media.key, pattern))
      : undefined
  )
  const [{ total }] = await db
    .select({ total: count() })
    .from(media)
    .where(where)
  const column = opts.sort.field === "alt" ? media.alt : media.createdAt
  const rows = await db
    .select()
    .from(media)
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(media.key)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}
```

`server/modules/media/service.ts`:

```ts
import "server-only"

import { hasPermission } from "@/lib/auth/permissions"
import type { Paginated } from "@/lib/schemas/api/list"
import type { MediaItem, MediaListQuery } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden, notFound } from "@/server/lib/errors"

import { mediaUrl } from "./queries"
import { findMediaById, listMediaRows } from "./repo"

type MediaRow = NonNullable<Awaited<ReturnType<typeof findMediaById>>>

function toItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    url: mediaUrl(row),
    alt: row.alt,
    mime: row.mime,
    width: row.width,
    height: row.height,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  }
}

function assertCanRead(actor: Actor) {
  if (!hasPermission(actor.roles, { media: ["read"] })) throw forbidden()
}

/** Library rows for the picker (Phase 6 adds upload, alt/focal edits, usages). */
export async function listMedia(
  actor: Actor,
  query: MediaListQuery
): Promise<Paginated<MediaItem>> {
  assertCanRead(actor)
  const { rows, total } = await listMediaRows(getDb(), {
    q: query.q || undefined,
    imagesOnly: query.kind === "image",
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getMediaItem(
  actor: Actor,
  id: string
): Promise<MediaItem> {
  assertCanRead(actor)
  const row = await findMediaById(getDb(), id)
  if (!row) throw notFound("Media")
  return toItem(row)
}
```

`server/modules/media/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { mediaListQuery } from "@/lib/schemas/api/media"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** Read-only in Phase 4 (picker). Phase 6 adds upload, update, delete, usages. */
export const mediaRoutes = new Hono<AppEnv>()
  .get("/", can({ media: ["read"] }), zv("query", mediaListQuery), async (c) =>
    c.json(await service.listMedia(actorOf(c), c.req.valid("query")), 200)
  )
  .get("/:id", can({ media: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getMediaItem(actorOf(c), c.req.valid("param").id), 200)
  )
```

In `server/api/app.ts` add `import { mediaRoutes } from "@/server/modules/media/routes"` and chain `.route("/media", mediaRoutes)` after `.route("/revisions", revisionsRoutes)`.

- [ ] **Step 4: Picker and editor**

`components/admin/media/use-media-item.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"

import { api, unwrap } from "@/lib/api-client"

/** One library item (thumbnail + alt) for a `{ mediaId }` reference. */
export function useMediaItem(mediaId: string | null | undefined) {
  return useQuery({
    queryKey: ["media", "item", mediaId],
    queryFn: () => unwrap(api.media[":id"].$get({ param: { id: mediaId! } })),
    enabled: !!mediaId,
    staleTime: 5 * 60_000,
  })
}
```

`components/admin/media/picker-dialog.tsx`:

```tsx
"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ImageOff, Search } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { MediaItem } from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 24

/**
 * Pick an existing image from the media library. Phase 4 lists the seeded
 * library read-only; Phase 6 adds uploading from this dialog.
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedId,
  title = "Choose an image",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: MediaItem) => void
  selectedId?: string | null
  title?: string
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [chosen, setChosen] = useState<MediaItem | null>(null)
  const q = useDebouncedValue(query.trim(), 250)

  const result = useQuery({
    queryKey: ["media", "list", { q, page }],
    queryFn: () =>
      unwrap(
        api.media.$get({
          query: {
            kind: "image",
            q: q || undefined,
            page: String(page),
            pageSize: String(PAGE_SIZE),
          },
        })
      ),
    enabled: open,
    placeholderData: keepPreviousData,
  })
  const items = result.data?.items ?? []
  const pages = Math.max(1, Math.ceil((result.data?.total ?? 0) / PAGE_SIZE))
  const current = chosen?.id ?? selectedId ?? null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setChosen(null)
      }}
    >
      <DialogContent className="flex max-h-[min(90svh,720px)] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Images already in the media library.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search images"
            placeholder="Search by description or file name"
            className="pl-8"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="-mx-1 min-h-48 flex-1 overflow-y-auto px-1">
          {result.isError ? (
            <p
              role="alert"
              className="py-8 text-center text-sm text-destructive"
            >
              {errorMessage(result.error)}
            </p>
          ) : result.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <ImageOff aria-hidden className="size-6" />
              No images match “{q}”.
            </div>
          ) : (
            <ul
              aria-label="Images"
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {items.map((item) => {
                const selected = item.id === current
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setChosen(item)}
                      onDoubleClick={() => {
                        onSelect(item)
                        onOpenChange(false)
                      }}
                      className={cn(
                        "group flex w-full flex-col gap-1.5 rounded-lg border p-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "border-primary ring-2 ring-primary"
                          : "hover:border-foreground/30"
                      )}
                    >
                      <span className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails of arbitrary sizes */}
                        <img
                          src={item.url}
                          alt=""
                          loading="lazy"
                          className="max-h-full max-w-full object-contain"
                        />
                      </span>
                      <span className="line-clamp-2 min-h-8 text-xs">
                        {item.alt || item.url.split("/").pop()}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
          <Button
            type="button"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return
              onSelect(chosen)
              onOpenChange(false)
              setChosen(null)
            }}
          >
            Use this image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

`components/admin/rich-text/extensions.ts`:

```ts
import {
  type Extensions,
  mergeAttributes,
  Node,
  type NodeViewRenderer,
} from "@tiptap/core"
import { Blockquote } from "@tiptap/extension-blockquote"
import { ListItem } from "@tiptap/extension-list"
import { StarterKit } from "@tiptap/starter-kit"

import { isSafeHref } from "@/lib/schemas/common"

// The editor's schema is exactly what lib/schemas/common.ts accepts and
// lib/rich-text/render.tsx renders (spec §5.3): paragraph, h2/h3, bullet and
// ordered lists of paragraphs, blockquote (with cite) of paragraphs, image
// (media ref + alt), hard break, bold, italic, link. Anything else pasted in
// is dropped or flattened by ProseMirror's schema.

/** "full": articles and legal pages; "paragraphs": about copy, service overview. */
export type RichTextMode = "full" | "paragraphs"

/** attrs: { media: { mediaId }, alt } — same shape the renderer reads. */
export const MediaImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      media: {
        default: null,
        parseHTML: (element) => {
          const mediaId = element.getAttribute("data-media-id")
          return mediaId ? { mediaId } : null
        },
        renderHTML: (attrs) =>
          attrs.media ? { "data-media-id": attrs.media.mediaId } : {},
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("alt") ?? "",
        renderHTML: (attrs) => ({ alt: attrs.alt }),
      },
    }
  },
  // Only library images survive a paste; arbitrary <img src> is dropped.
  parseHTML() {
    return [{ tag: "img[data-media-id]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)]
  },
})

/** List items hold paragraphs only (no nested lists). */
const ParagraphListItem = ListItem.extend({ content: "paragraph+" })

/** Blockquote of paragraphs with an optional cite (the article quote design). */
const CiteBlockquote = Blockquote.extend({
  content: "paragraph+",
  addAttributes() {
    return {
      cite: {
        default: null,
        parseHTML: (element) => element.getAttribute("cite"),
        renderHTML: (attrs) => (attrs.cite ? { cite: attrs.cite } : {}),
      },
    }
  },
})

const link = {
  openOnClick: false,
  autolink: true,
  defaultProtocol: "https",
  isAllowedUri: (
    url: string,
    ctx: { defaultValidate: (url: string) => boolean }
  ) => ctx.defaultValidate(url) && isSafeHref(url),
}

/**
 * Extensions for one editor mode. `imageView` lets the admin editor render
 * library images through React (thumbnail lookup); headless use (tests,
 * Phase 5 paste checks) omits it.
 */
export function richTextExtensions(
  mode: RichTextMode,
  options: { imageView?: NodeViewRenderer } = {}
): Extensions {
  const common = {
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    listItem: false,
    blockquote: false,
    link,
  } as const
  if (mode === "paragraphs")
    return [
      StarterKit.configure({
        ...common,
        heading: false,
        bulletList: false,
        orderedList: false,
        listKeymap: false,
      }),
    ]
  const image = options.imageView
    ? MediaImage.extend({ addNodeView: () => options.imageView! })
    : MediaImage
  return [
    StarterKit.configure({ ...common, heading: { levels: [2, 3] } }),
    ParagraphListItem,
    CiteBlockquote,
    image,
  ]
}
```

`components/admin/rich-text/image-view.tsx`:

```tsx
"use client"

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"

import { useMediaItem } from "@/components/admin/media/use-media-item"
import { Input } from "@/components/ui/input"

/** Library image inside the editor: thumbnail + editable alt text. */
export function ImageNodeView({
  node,
  updateAttributes,
  selected,
}: ReactNodeViewProps) {
  const media = node.attrs.media as { mediaId: string } | null
  const item = useMediaItem(media?.mediaId)
  return (
    <NodeViewWrapper
      data-drag-handle
      className={`my-4 flex flex-col gap-2 rounded-lg border bg-muted/40 p-2 ${selected ? "ring-2 ring-ring" : ""}`}
    >
      {item.data ? (
        // eslint-disable-next-line @next/next/no-img-element -- editor preview of a library image
        <img
          src={item.data.url}
          alt=""
          className="max-h-64 w-full rounded-md object-contain"
        />
      ) : (
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
          {item.isError ? "Image not found in the library" : "Loading image…"}
        </div>
      )}
      <Input
        aria-label="Image description (alt text)"
        placeholder="Describe the image for screen readers"
        value={(node.attrs.alt as string) ?? ""}
        onChange={(event) => updateAttributes({ alt: event.target.value })}
      />
    </NodeViewWrapper>
  )
}
```

`components/admin/rich-text/toolbar.tsx`:

```tsx
"use client"

import { type Editor, useEditorState } from "@tiptap/react"
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react"
import { useState } from "react"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { isSafeHref } from "@/lib/schemas/common"

import type { RichTextMode } from "./extensions"

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="aria-pressed:bg-muted aria-pressed:text-foreground"
    >
      {children}
    </Button>
  )
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState("")
  const [error, setError] = useState<string | null>(null)
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setHref((editor.getAttributes("link").href as string) ?? "")
          setError(null)
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Link"
            title="Link"
            aria-pressed={active}
            className="aria-pressed:bg-muted aria-pressed:text-foreground"
          />
        }
      >
        <Link2 aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const value = href.trim()
            if (!isSafeHref(value)) {
              setError("Use /path, #anchor, https://…, tel: or mailto:")
              return
            }
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: value })
              .run()
            setOpen(false)
          }}
        >
          <Input
            aria-label="Link address"
            placeholder="/contact or https://…"
            value={href}
            aria-invalid={!!error}
            onChange={(event) => setHref(event.target.value)}
          />
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            {active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .unsetLink()
                    .run()
                  setOpen(false)
                }}
              >
                Remove link
              </Button>
            ) : null}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/** Formatting controls limited to what the site renders (spec §5.3). */
export function RichTextToolbar({
  editor,
  mode,
  editorId,
}: {
  editor: Editor
  mode: RichTextMode
  editorId: string
}) {
  const [picking, setPicking] = useState(false)
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const full = mode === "full"
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-controls={editorId}
      className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1"
    >
      <ToolButton
        label="Bold"
        pressed={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden />
      </ToolButton>
      <ToolButton
        label="Italic"
        pressed={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden />
      </ToolButton>
      <LinkButton editor={editor} active={state.link} />
      {full ? (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <ToolButton
            label="Heading"
            pressed={state.h2}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 aria-hidden />
          </ToolButton>
          <ToolButton
            label="Subheading"
            pressed={state.h3}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 aria-hidden />
          </ToolButton>
          <ToolButton
            label="Bulleted list"
            pressed={state.bullet}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List aria-hidden />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            pressed={state.ordered}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered aria-hidden />
          </ToolButton>
          <ToolButton
            label="Quote"
            pressed={state.quote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote aria-hidden />
          </ToolButton>
          <ToolButton label="Insert image" onClick={() => setPicking(true)}>
            <ImagePlus aria-hidden />
          </ToolButton>
          <MediaPickerDialog
            open={picking}
            onOpenChange={setPicking}
            onSelect={(item) =>
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "image",
                  attrs: { media: { mediaId: item.id }, alt: item.alt },
                })
                .run()
            }
          />
        </>
      ) : null}
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 aria-hidden />
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 aria-hidden />
      </ToolButton>
    </div>
  )
}
```

`components/admin/rich-text/editor.tsx`:

```tsx
"use client"

import {
  EditorContent,
  type JSONContent,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react"
import { useEffect, useMemo } from "react"

import { isDeepEqual } from "@/lib/json"
import { cn } from "@/lib/utils"

import { type RichTextMode, richTextExtensions } from "./extensions"
import { ImageNodeView } from "./image-view"
import { RichTextToolbar } from "./toolbar"

/**
 * TipTap editor for `richText` / `paragraphsText` fields. The JSON it emits
 * is what the public renderer reads (lib/rich-text/render.tsx); Phase 5
 * reuses it for article bodies.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  mode = "full",
  label,
  describedBy,
  invalid,
  disabled,
}: {
  id: string
  value: JSONContent | null
  onChange: (doc: JSONContent) => void
  mode?: RichTextMode
  label: string
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
}) {
  const extensions = useMemo(
    () =>
      richTextExtensions(mode, {
        imageView: ReactNodeViewRenderer(ImageNodeView),
      }),
    [mode]
  )
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: value ?? undefined,
      editable: !disabled,
      editorProps: {
        attributes: {
          id,
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": label,
          ...(describedBy ? { "aria-describedby": describedBy } : {}),
          ...(invalid ? { "aria-invalid": "true" } : {}),
          class: "rich-text-content min-h-36 px-3 py-2 outline-none",
        },
      },
      onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    },
    [extensions]
  )

  // Outside changes (reload after a conflict, restore) replace the content.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (value && !isDeepEqual(editor.getJSON(), value))
      editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20"
      )}
    >
      {editor ? (
        <RichTextToolbar editor={editor} mode={mode} editorId={id} />
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
```

Append to `app/(admin)/admin/admin.css`:

```css
/* Rich text editing surface (components/admin/rich-text/editor.tsx). */
html[data-admin] .rich-text-content {
  font-size: 0.9375rem;
  line-height: 1.65;
}
html[data-admin] .rich-text-content > * + * {
  margin-top: 0.75em;
}
html[data-admin] .rich-text-content h2 {
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1.25;
}
html[data-admin] .rich-text-content h3 {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.3;
}
html[data-admin] .rich-text-content ul {
  list-style: disc;
  padding-left: 1.5rem;
}
html[data-admin] .rich-text-content ol {
  list-style: decimal;
  padding-left: 1.5rem;
}
html[data-admin] .rich-text-content blockquote {
  border-left: 3px solid var(--color-brand-green);
  padding-left: 1rem;
  font-style: italic;
}
html[data-admin] .rich-text-content a {
  color: var(--color-brand-blue);
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/rich-text-extensions.test.tsx tests/dom/rich-text-editor.test.tsx`
Expected: PASS (3 + 5 tests).

Run: `pnpm test:integration tests/integration/api/media.test.ts`
Expected: PASS (3 tests).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/admin/rich-text components/admin/media lib/schemas/api/media.ts server/modules/media server/api/app.ts "app/(admin)/admin/admin.css" tests/dom/rich-text-extensions.test.tsx tests/dom/rich-text-editor.test.tsx tests/integration/api/media.test.ts
git commit -m "feat: add rich-text editor and media picker for admin forms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: SchemaForm, widgets and template editor meta (master Task 4.3, part 2)

**Files:**
- Create: `components/admin/schema-form/{editor-meta.ts,resolve-widget.ts,empty-value.ts,context.ts,field.tsx,schema-form.tsx}`, `components/admin/schema-form/widgets/{field-shell.tsx,basic.tsx,structure.tsx,pickers.tsx}`
- Create: `templates/{home,about,services,team,blog,contact,legal}/editor-meta.ts`, `templates/editor-meta.ts`
- Test: `tests/unit/admin/resolve-widget.test.ts`, `tests/dom/schema-form.test.tsx`

**Interfaces:**
- Consumes: Phase 3 `mediaRef`, `link`, `richText`, `paragraphsText` (by identity), template schemas + `templates`/`PAGES`/`templateSchemaFor`, settings and content schemas, `pagesFixture`/`fixtureMediaLookup` (tests); Task 2 options API (`OptionCollection`); Task 4 `RichTextEditor`, `MediaPickerDialog`, `useMediaItem`; RHF 7.90 + resolvers 5.9 (`zodResolver`), dnd-kit (notes §5.2).
- Produces:

```ts
// components/admin/schema-form/editor-meta.ts
export const WIDGET_KINDS = ["text","textarea","richText","link","media","number","toggle","select","list","group","collection"] as const
export type FieldMeta = { label?; help?; placeholder?; widget?: WidgetKind; rows?; maxLength?; options?; collection?: OptionCollection; itemName?; itemLabel?; section? }
export type EditorMeta = { fields: Record<string, FieldMeta> }   // keys like "hero.stats[].value"
export const EMPTY_META: EditorMeta
export function metaKey(path: string): string; export function metaFor(meta, path): FieldMeta; export function humanize(key: string): string
// components/admin/schema-form/resolve-widget.ts
export function unwrapSchema(schema): { inner; optional; nullable }
export function arrayBounds(schema): { min: number; max: number }
export type ResolvedField = { kind: WidgetKind; schema; optional; nullable; label; meta; format: string | null; richTextMode: "full" | "paragraphs" }
export function resolveWidget(schema, meta: FieldMeta, name: string, path: string): ResolvedField   // throws "No widget for field …"
// components/admin/schema-form/empty-value.ts
export function emptyValue(schema: z.ZodType): unknown
// components/admin/schema-form/schema-form.tsx  (master interface)
export function SchemaForm<S extends z.ZodObject>(props: { schema: S; meta: EditorMeta; value: z.input<S>; onChange(value: z.input<S>): void; errors?: Record<string, string[]>; disabled?; resetKey?; idPrefix? }): JSX.Element
// templates/editor-meta.ts
export const templateEditorMeta: Record<TemplateName, EditorMeta>
```

Widget choice: `meta.widget` first; then by identity `mediaRef` → media, `richText` → rich text (full), `paragraphsText` → rich text (paragraphs), `link` → link; then the Zod type: object → group, array → list, boolean → toggle (switch), number → number, enum → select, string → text (textarea for `description, subheading, intro, copy, bio, body, excerpt, caption, callout, headHtml, bodyEndHtml`; `type=email/url` from the string format). Collections are opt-in via meta (`blog.featuredArticle` → `collection: "articles"`). RHF holds field state (`useForm<z.input<S>, unknown, z.output<S>>`, `mode: "onTouched"`); `errors` (server 422 or a full client check) are applied with `setError`; lists use `useController` on the array with stable keys, Move up/down buttons (keyboard, focus follows the item) and dnd-kit drag handles; removing below the schema minimum and adding above its maximum are disabled.

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/resolve-widget.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  type EditorMeta,
  humanize,
  metaFor,
  metaKey,
} from "@/components/admin/schema-form/editor-meta"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import {
  arrayBounds,
  resolveWidget,
} from "@/components/admin/schema-form/resolve-widget"
import {
  link,
  mediaRef,
  paragraphsText,
  richText,
  text,
} from "@/lib/schemas/common"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { serviceSchema } from "@/lib/schemas/content/service"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"
import { settingsSchemas } from "@/lib/schemas/settings"
import { templateEditorMeta } from "@/templates/editor-meta"
import { templates } from "@/templates/registry"

/** Resolves every node of a schema like SchemaForm does; returns path → kind. */
function walk(
  schema: z.ZodType,
  meta: EditorMeta,
  path = "",
  name = ""
): Record<string, string> {
  const field = resolveWidget(schema, metaFor(meta, path), name, path)
  const out: Record<string, string> = path
    ? { [metaKey(path)]: field.kind }
    : {}
  if (field.kind === "group")
    for (const [key, child] of Object.entries(
      (field.schema as z.ZodObject).shape
    ))
      Object.assign(
        out,
        walk(child as z.ZodType, meta, path ? `${path}.${key}` : key, key)
      )
  if (field.kind === "list")
    Object.assign(
      out,
      walk(
        (field.schema as z.ZodArray<z.ZodType>).element,
        meta,
        `${path}.0`,
        "Item 1"
      )
    )
  return out
}

describe("resolveWidget covers every shipped schema (master 4.3)", () => {
  it.each(Object.entries(templates))(
    "template %s has a widget for every field",
    (name, { schema }) => {
      const kinds = walk(
        schema,
        templateEditorMeta[name as keyof typeof templates]
      )
      expect(Object.keys(kinds).length).toBeGreaterThan(3)
    }
  )

  it.each(Object.entries(settingsSchemas))(
    "settings %s has a widget for every field",
    (_key, schema) => {
      expect(() => walk(schema, { fields: {} })).not.toThrow()
    }
  )

  it.each([
    ["service", serviceSchema],
    ["team member", teamMemberSchema],
    ["client", clientSchema],
    ["group company", groupCompanySchema],
    ["category", categorySchema],
  ] as const)("%s schema has a widget for every field", (_name, schema) => {
    expect(() => walk(schema, { fields: {} })).not.toThrow()
  })

  it("maps the home template as designed", () => {
    const kinds = walk(templates.home.schema, templateEditorMeta.home)
    expect(kinds).toMatchObject({
      hero: "group",
      "hero.heading": "text",
      "hero.subheading": "textarea",
      "hero.backgroundImage": "media",
      "hero.primaryCta": "link",
      "hero.stats": "list",
      "hero.stats[]": "group",
      "hero.stats[].count": "number",
      "blog.count": "number",
    })
    expect(
      walk(templates.blog.schema, templateEditorMeta.blog).featuredArticle
    ).toBe("collection")
    expect(walk(templates.legal.schema, templateEditorMeta.legal).body).toBe(
      "richText"
    )
  })

  it("identifies shared schemas and unwraps optional/nullable", () => {
    expect(
      resolveWidget(mediaRef.nullable(), {}, "logo", "logo")
    ).toMatchObject({ kind: "media", nullable: true })
    expect(resolveWidget(paragraphsText, {}, "body", "body")).toMatchObject({
      kind: "richText",
      richTextMode: "paragraphs",
    })
    expect(resolveWidget(richText, {}, "body", "body").richTextMode).toBe(
      "full"
    )
    expect(resolveWidget(link, {}, "cta", "cta").kind).toBe("link")
    expect(resolveWidget(z.email(), {}, "email", "email")).toMatchObject({
      kind: "text",
      format: "email",
    })
    expect(resolveWidget(z.number().optional(), {}, "n", "n")).toMatchObject({
      kind: "number",
      optional: true,
    })
    expect(resolveWidget(z.boolean(), {}, "enabled", "enabled").kind).toBe(
      "toggle"
    )
    expect(resolveWidget(z.enum(["a", "b"]), {}, "pick", "pick").kind).toBe(
      "select"
    )
    expect(resolveWidget(text, { widget: "textarea" }, "x", "x").kind).toBe(
      "textarea"
    )
    expect(() => resolveWidget(z.date(), {}, "when", "a.when")).toThrow(
      'No widget for field "a.when"'
    )
  })
})

describe("editor meta helpers", () => {
  it("normalises list indexes and humanises keys", () => {
    expect(metaKey("hero.stats.2.value")).toBe("hero.stats[].value")
    expect(metaKey("highlights.10")).toBe("highlights[]")
    expect(humanize("primaryCta")).toBe("Primary cta")
    expect(humanize("phone24hLabel")).toBe("Phone24h label")
  })

  it("reads array bounds and builds blank values", () => {
    expect(arrayBounds(z.array(text).min(1).max(4))).toEqual({ min: 1, max: 4 })
    expect(
      emptyValue(
        z.object({
          a: text,
          b: z.array(text).min(2),
          c: mediaRef,
          d: z.number().optional(),
          e: link,
          f: z.boolean(),
          g: text.nullable(),
        })
      )
    ).toEqual({
      a: "",
      b: ["", ""],
      c: null,
      e: { label: "", href: "" },
      f: false,
      g: null,
    })
    expect(emptyValue(richText)).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    })
  })
})
```

`tests/dom/schema-form.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/admin/providers"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { templateEditorMeta } from "@/templates/editor-meta"
import { type PageKey, templateSchemaFor, PAGES } from "@/templates/registry"
import type { HomeTemplate } from "@/templates/home/schema"

const pages = pagesFixture(fixtureMediaLookup)

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ items: [], page: 1, pageSize: 24, total: 0 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    )
  )
})

function renderForm<K extends PageKey>(
  key: K,
  props: { errors?: Record<string, string[]> } = {}
) {
  const onChange = vi.fn()
  const utils = render(
    <QueryClientProvider client={makeQueryClient()}>
      <SchemaForm
        schema={templateSchemaFor(key)}
        meta={templateEditorMeta[PAGES[key]]}
        value={structuredClone(pages[key].data)}
        onChange={onChange}
        errors={props.errors}
      />
    </QueryClientProvider>
  )
  return { ...utils, onChange }
}

const lastValue = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.at(-1)![0] as HomeTemplate

describe("SchemaForm (master 4.3)", () => {
  it.each(Object.keys(PAGES) as PageKey[])(
    "renders the %s page without a missing widget",
    (key) => {
      renderForm(key)
      expect(screen.getAllByRole("region").length).toBeGreaterThan(0)
    }
  )

  it("renders the home template's sections and values", async () => {
    renderForm("home")
    for (const name of [
      "Hero",
      "Services section",
      "Team section",
      "Blog section",
    ])
      expect(screen.getByRole("region", { name })).toBeInTheDocument()
    const hero = screen.getByRole("region", { name: "Hero" })
    expect(within(hero).getByRole("textbox", { name: "Heading" })).toHaveValue(
      "Security Partners Ltd."
    )
    expect(
      within(hero).getByRole("button", { name: "Change: Background image" })
    ).toBeInTheDocument()
    expect(
      within(hero).getByRole("group", { name: "Primary button" })
    ).toBeInTheDocument()
  })

  it("emits the edited value", async () => {
    const user = userEvent.setup()
    const { onChange } = renderForm("home")
    const hero = screen.getByRole("region", { name: "Hero" })
    const heading = within(hero).getByRole("textbox", { name: "Heading" })
    await user.clear(heading)
    await user.type(heading, "Watching Over You")
    expect(lastValue(onChange).hero.heading).toBe("Watching Over You")
  })

  it("adds, removes and reorders list items with the keyboard", async () => {
    const user = userEvent.setup()
    const { onChange } = renderForm("home")
    const stats = screen.getByRole("group", { name: "Stats" })
    const labels = () => lastValue(onChange).hero.stats.map((s) => s.label)

    within(stats).getByRole("button", { name: "Move Stat 1 down" }).focus()
    await user.keyboard("{Enter}")
    expect(labels()).toEqual([
      "Operations team",
      "Years in business",
      "Coverage across Ireland",
    ])
    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName("Move Stat 2 down")
    )
    expect(
      within(stats).getByRole("listitem", { name: "Stat 2" })
    ).toHaveTextContent("Years in business")

    await user.click(within(stats).getByRole("button", { name: "Add stat" }))
    expect(lastValue(onChange).hero.stats).toHaveLength(4)
    expect(lastValue(onChange).hero.stats[3]).toEqual({ value: "", label: "" })

    await user.click(
      within(stats).getByRole("button", { name: "Remove Stat 4" })
    )
    expect(lastValue(onChange).hero.stats).toHaveLength(3)
    expect(
      within(stats).getByRole("button", { name: "Move Stat 1 up" })
    ).toBeDisabled()
    expect(
      within(stats).getByRole("button", { name: "Move Stat 3 down" })
    ).toBeDisabled()
  })

  it("does not allow removing below the schema minimum", async () => {
    renderForm("about")
    const values = screen.getByRole("group", { name: "Values" })
    const items = within(values).getAllByRole("listitem")
    expect(items.length).toBeGreaterThan(0)
    if (items.length === 1)
      expect(
        within(values).getByRole("button", { name: "Remove Value 1" })
      ).toBeDisabled()
  })

  it("counts characters in a textarea", async () => {
    const user = userEvent.setup()
    renderForm("home")
    const intro = screen.getByRole("textbox", { name: "Introduction" })
    const length = (intro as HTMLTextAreaElement).value.length
    expect(screen.getByText(`${length} / 5000`)).toBeInTheDocument()
    await user.type(intro, "!")
    expect(screen.getByText(`${length + 1} / 5000`)).toBeInTheDocument()
    expect(intro).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("count")
    )
  })

  it("maps Zod errors to fields (client and server)", async () => {
    const user = userEvent.setup()
    renderForm("home", {
      errors: { "hero.tagline": ["Keep it under 40 characters"] },
    })
    expect(
      await screen.findByText("Keep it under 40 characters")
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Tagline" })).toHaveAttribute(
      "aria-invalid",
      "true"
    )

    const hero = screen.getByRole("region", { name: "Hero" })
    const heading = within(hero).getByRole("textbox", { name: "Heading" })
    await user.clear(heading)
    await act(async () => heading.blur())
    await waitFor(() => expect(heading).toHaveAttribute("aria-invalid", "true"))
    expect(heading).toHaveAccessibleDescription(
      expect.stringContaining("Required")
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/admin/resolve-widget.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/admin/schema-form/editor-meta"`.

Run: `pnpm exec vitest run --project dom tests/dom/schema-form.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/schema-form/schema-form"`.

- [ ] **Step 3: Meta, widget resolution, blank values**

`components/admin/schema-form/editor-meta.ts`:

```ts
import type { OptionCollection } from "@/lib/schemas/api/search"

/** Widget kinds SchemaForm renders (master 4.3). */
export const WIDGET_KINDS = [
  "text",
  "textarea",
  "richText",
  "link",
  "media",
  "number",
  "toggle",
  "select",
  "list",
  "group",
  "collection",
] as const
export type WidgetKind = (typeof WIDGET_KINDS)[number]

/** Editor hints for one field; everything is optional (defaults come from the schema). */
export type FieldMeta = {
  label?: string
  help?: string
  placeholder?: string
  /** Force a widget (e.g. "collection" for a slug that picks an article). */
  widget?: WidgetKind
  /** textarea rows (default 3). */
  rows?: number
  /** Counter maximum shown under a textarea (default: the schema's max). */
  maxLength?: number
  /** select: labels for enum values. */
  options?: { value: string; label: string }[]
  /** collection: where the choices come from. */
  collection?: OptionCollection
  /** list: singular noun for one item ("Stat" → "Add stat", "Stat 2"). */
  itemName?: string
  /** list of objects: field whose value titles each item card. */
  itemLabel?: string
  /** group: render as a titled card (default for top-level groups). */
  section?: boolean
}

/**
 * Field hints keyed by path, with [] for list items:
 * "hero.heading", "hero.stats[].value", "highlights[]".
 */
export type EditorMeta = { fields: Record<string, FieldMeta> }

export const EMPTY_META: EditorMeta = { fields: {} }

/** "hero.stats.2.value" → "hero.stats[].value" (meta lookup key). */
export function metaKey(path: string): string {
  return path.replace(/\.\d+(?=\.|$)/g, "[]")
}

export function metaFor(meta: EditorMeta, path: string): FieldMeta {
  return meta.fields[metaKey(path)] ?? {}
}

/** "phone24hLabel" → "Phone24h label", "primaryCta" → "Primary cta". */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
```

`components/admin/schema-form/resolve-widget.ts`:

```ts
import type { z } from "zod"

import { link, mediaRef, paragraphsText, richText } from "@/lib/schemas/common"

import { type FieldMeta, humanize, type WidgetKind } from "./editor-meta"

type Def = {
  type: string
  innerType?: z.ZodType
  checks?: {
    _zod: { def: { check: string; minimum?: number; maximum?: number } }
  }[]
}
const defOf = (schema: z.ZodType) => (schema as unknown as { def: Def }).def

/** Strips optional / nullable / default wrappers and remembers them. */
export function unwrapSchema(schema: z.ZodType): {
  inner: z.ZodType
  optional: boolean
  nullable: boolean
} {
  let inner = schema
  let optional = false
  let nullable = false
  for (;;) {
    const def = defOf(inner)
    if (def.type === "optional" || def.type === "default") optional = true
    else if (def.type === "nullable") nullable = true
    else break
    inner = def.innerType!
  }
  return { inner, optional, nullable }
}

/** min/max item counts of a z.array (`.min(1)` etc.). */
export function arrayBounds(schema: z.ZodType): { min: number; max: number } {
  let min = 0
  let max = Number.POSITIVE_INFINITY
  for (const check of defOf(schema).checks ?? []) {
    const c = check._zod.def
    if (c.check === "min_length" && c.minimum !== undefined) min = c.minimum
    if (c.check === "max_length" && c.maximum !== undefined) max = c.maximum
  }
  return { min, max }
}

/** Long copy gets a textarea unless meta says otherwise. */
const LONG_TEXT = new Set([
  "description",
  "subheading",
  "intro",
  "copy",
  "bio",
  "body",
  "excerpt",
  "caption",
  "callout",
  "headHtml",
  "bodyEndHtml",
])

export type ResolvedField = {
  kind: WidgetKind
  /** The unwrapped schema the widget edits. */
  schema: z.ZodType
  optional: boolean
  nullable: boolean
  label: string
  meta: FieldMeta
  /** "email" | "url" for formatted strings (input type). */
  format: string | null
  /** richText only. */
  richTextMode: "full" | "paragraphs"
}

/**
 * Picks the widget for one field: meta.widget first, then the shared
 * schemas by identity (media, rich text, link), then the Zod type.
 * Throws for a schema no widget can edit (caught by the "every template
 * renders" test, never at runtime for shipped schemas).
 */
export function resolveWidget(
  schema: z.ZodType,
  meta: FieldMeta,
  name: string,
  path: string
): ResolvedField {
  const { inner, optional, nullable } = unwrapSchema(schema)
  const base = {
    schema: inner,
    optional,
    nullable,
    meta,
    label: meta.label ?? humanize(name),
    format: null as string | null,
    richTextMode: "full" as "full" | "paragraphs",
  }
  if (meta.widget) return { ...base, kind: meta.widget }
  if (inner === mediaRef) return { ...base, kind: "media" }
  if (inner === richText) return { ...base, kind: "richText" }
  if (inner === paragraphsText)
    return { ...base, kind: "richText", richTextMode: "paragraphs" }
  if (inner === link) return { ...base, kind: "link" }
  switch (defOf(inner).type) {
    case "object":
      return { ...base, kind: "group" }
    case "array":
      return { ...base, kind: "list" }
    case "boolean":
      return { ...base, kind: "toggle" }
    case "number":
      return { ...base, kind: "number" }
    case "enum":
      return { ...base, kind: "select" }
    case "string": {
      const format =
        (inner as unknown as { format?: string | null }).format ?? null
      const kind = LONG_TEXT.has(name) ? "textarea" : "text"
      return { ...base, kind, format }
    }
    default:
      throw new Error(
        `No widget for field "${path || "(root)"}" (${defOf(inner).type})`
      )
  }
}
```

`components/admin/schema-form/empty-value.ts`:

```ts
import type { z } from "zod"

import { link, mediaRef, paragraphsText, richText } from "@/lib/schemas/common"

import { arrayBounds, unwrapSchema } from "./resolve-widget"

/**
 * A blank value for a schema (new list items, new records). Required
 * fields start empty and fail validation until filled in; media start as
 * null ("Choose an image").
 */
export function emptyValue(schema: z.ZodType): unknown {
  const { inner, optional, nullable } = unwrapSchema(schema)
  if (optional) return undefined
  if (nullable) return null
  if (inner === mediaRef) return null
  if (inner === richText || inner === paragraphsText)
    return { type: "doc", content: [{ type: "paragraph" }] }
  if (inner === link) return { label: "", href: "" }
  const def = (inner as unknown as { def: { type: string } }).def
  switch (def.type) {
    case "object": {
      const shape = (inner as z.ZodObject).shape as Record<string, z.ZodType>
      return Object.fromEntries(
        Object.entries(shape)
          .map(([key, child]) => [key, emptyValue(child)] as const)
          .filter(([, value]) => value !== undefined)
      )
    }
    case "array": {
      const { min } = arrayBounds(inner)
      const element = (inner as z.ZodArray<z.ZodType>).element
      return Array.from({ length: min }, () => emptyValue(element))
    }
    case "boolean":
      return false
    case "number":
      return (inner as z.ZodNumber).minValue ?? 0
    case "enum":
      return (inner as z.ZodEnum).options[0]
    default:
      return ""
  }
}
```

- [ ] **Step 4: Form, field renderer, widgets**

`components/admin/schema-form/context.ts`:

```ts
"use client"

import { createContext, useContext } from "react"

import type { EditorMeta } from "./editor-meta"
import type { ResolvedField } from "./resolve-widget"

export type SchemaFormContextValue = {
  meta: EditorMeta
  disabled: boolean
  /** Prefix for element ids (two forms on one page stay unique). */
  idPrefix: string
}

export const SchemaFormContext = createContext<SchemaFormContextValue | null>(
  null
)

export function useSchemaForm(): SchemaFormContextValue {
  const value = useContext(SchemaFormContext)
  if (!value) throw new Error("Widgets must render inside <SchemaForm>")
  return value
}

/** Props every widget receives. `path` is the RHF field name ("hero.stats.0.value"). */
export type WidgetProps = { field: ResolvedField; path: string }

/** Stable DOM id for a field path. */
export function fieldId(idPrefix: string, path: string): string {
  return `${idPrefix}-${path.replaceAll(".", "-") || "root"}`
}
```

`components/admin/schema-form/widgets/field-shell.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

/**
 * Label, help and error around one input. Ids follow `${id}-help` /
 * `${id}-error`; widgets pass `describedBy(id, …)` to their input.
 */
export function FieldShell({
  id,
  label,
  help,
  error,
  optional,
  extra,
  children,
}: {
  id: string
  label: string
  help?: string
  error?: string
  optional?: boolean
  /** Under the input, before help (e.g. a character counter). */
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">(optional)</span>
        ) : null}
      </FieldLabel>
      {children}
      {extra}
      {help ? (
        <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}

/** aria-describedby for an input inside FieldShell. */
export function describedBy(
  id: string,
  opts: { help?: string; error?: string; extraId?: string }
): string | undefined {
  const ids = [
    opts.extraId,
    opts.help ? `${id}-help` : null,
    opts.error ? `${id}-error` : null,
  ].filter(Boolean)
  return ids.length ? ids.join(" ") : undefined
}

/** RHF error message of a field, including list/group "root" errors. */
export function errorText(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const e = error as { message?: string; root?: { message?: string } }
  return e.message || e.root?.message || undefined
}
```

`components/admin/schema-form/widgets/basic.tsx`:

```tsx
"use client"

import { useController } from "react-hook-form"
import type { z } from "zod"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { describedBy, errorText, FieldShell } from "./field-shell"

/** "" → null / undefined for nullable / optional strings. */
function emptyAs(field: WidgetProps["field"], value: string) {
  if (value !== "") return value
  if (field.nullable) return null
  if (field.optional) return undefined
  return ""
}

export function TextWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <Input
        id={id}
        name={path}
        type={
          field.format === "email"
            ? "email"
            : field.format === "url"
              ? "url"
              : "text"
        }
        value={(value as string | null | undefined) ?? ""}
        placeholder={field.meta.placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { help, error })}
        onChange={(event) => onChange(emptyAs(field, event.target.value))}
        onBlur={onBlur}
        ref={ref}
      />
    </FieldShell>
  )
}

export function TextareaWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const text = (value as string | null | undefined) ?? ""
  const max =
    field.meta.maxLength ?? (field.schema as z.ZodString).maxLength ?? null
  const counterId = `${id}-count`
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
      extra={
        <p
          id={counterId}
          aria-live="polite"
          className={cn(
            "text-right text-xs text-muted-foreground tabular-nums",
            max !== null && text.length > max && "text-destructive"
          )}
        >
          {max === null
            ? `${text.length} characters`
            : `${text.length} / ${max}`}
        </p>
      }
    >
      <Textarea
        id={id}
        name={path}
        rows={field.meta.rows ?? 3}
        value={text}
        placeholder={field.meta.placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { help, error, extraId: counterId })}
        onChange={(event) => onChange(emptyAs(field, event.target.value))}
        onBlur={onBlur}
        ref={ref}
      />
    </FieldShell>
  )
}

export function NumberWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur, ref },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const schema = field.schema as z.ZodNumber
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <Input
        id={id}
        name={path}
        type="number"
        inputMode="numeric"
        className="max-w-40"
        min={schema.minValue ?? undefined}
        max={schema.maxValue ?? undefined}
        step={schema.isInt ? 1 : "any"}
        value={typeof value === "number" && !Number.isNaN(value) ? value : ""}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { help, error })}
        onChange={(event) => {
          const raw = event.target.value
          onChange(
            raw === ""
              ? field.nullable
                ? null
                : field.optional
                  ? undefined
                  : Number.NaN
              : Number(raw)
          )
        }}
        onBlur={onBlur}
        ref={ref}
      />
    </FieldShell>
  )
}

export function ToggleWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
        </label>
        {help ? (
          <p id={`${id}-help`} className="text-sm text-muted-foreground">
            {help}
          </p>
        ) : null}
        {error ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={!!value}
        disabled={disabled}
        aria-describedby={describedBy(id, { help, error })}
        onCheckedChange={(checked) => onChange(checked)}
        onBlur={onBlur}
      />
    </div>
  )
}

export function SelectWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const {
    field: { value, onChange, onBlur },
    fieldState,
  } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error = errorText(fieldState.error)
  const help = field.meta.help
  const values = (field.schema as z.ZodEnum).options as string[]
  const labelOf = (value: string) =>
    field.meta.options?.find((o) => o.value === value)?.label ?? value
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <NativeSelect
        id={id}
        value={(value as string | null | undefined) ?? ""}
        disabled={disabled}
        invalid={!!error}
        describedBy={describedBy(id, { help, error })}
        onChange={(value) =>
          onChange(value === "" ? (field.nullable ? null : undefined) : value)
        }
        onBlur={onBlur}
      >
        {field.optional || field.nullable ? (
          <option value="">— None —</option>
        ) : null}
        {values.map((value) => (
          <option key={value} value={value}>
            {labelOf(value)}
          </option>
        ))}
      </NativeSelect>
    </FieldShell>
  )
}

/** Styled native <select>: accessible and keyboard-friendly everywhere. */
export function NativeSelect({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy: ariaDescribedBy,
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  children: React.ReactNode
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      className="h-8 w-full max-w-md rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
    >
      {children}
    </select>
  )
}
```

`components/admin/schema-form/widgets/structure.tsx`:

```tsx
"use client"

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useController, useFormContext, useWatch } from "react-hook-form"
import type { z } from "zod"

import { Button } from "@/components/ui/button"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { emptyValue } from "../empty-value"
import { Field } from "../field"
import { arrayBounds } from "../resolve-widget"
import { errorText } from "./field-shell"

export function GroupWidget({ field, path }: WidgetProps) {
  const { idPrefix } = useSchemaForm()
  const shape = (field.schema as z.ZodObject).shape as Record<string, z.ZodType>
  const children = Object.entries(shape).map(([key, child]) => (
    <Field
      key={key}
      schema={child}
      name={key}
      path={path ? `${path}.${key}` : key}
    />
  ))
  if (!path) return <div className="flex flex-col gap-6">{children}</div>
  // A list item's object: the item card already titles it.
  if (/\.\d+$/.test(path))
    return <div className="flex flex-col gap-4">{children}</div>
  const id = fieldId(idPrefix, path)
  const section = field.meta.section ?? !path.includes(".")
  if (section)
    return (
      <section
        aria-labelledby={`${id}-title`}
        className="flex flex-col gap-5 rounded-xl border bg-card p-4 shadow-xs sm:p-6"
      >
        <header className="flex flex-col gap-1">
          <h2 id={`${id}-title`} className="text-base font-bold">
            {field.label}
          </h2>
          {field.meta.help ? (
            <p className="text-sm text-muted-foreground">{field.meta.help}</p>
          ) : null}
        </header>
        {children}
      </section>
    )
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-dashed p-4">
      <legend className="px-1 text-sm font-semibold">{field.label}</legend>
      {field.meta.help ? (
        <p className="-mt-2 text-sm text-muted-foreground">{field.meta.help}</p>
      ) : null}
      {children}
    </fieldset>
  )
}

let keySeed = 0
const newKey = () => `item-${++keySeed}`

/** `keys` resized to `length` (after an outside reset) without changing kept keys. */
function fitKeys(keys: string[], length: number): string[] {
  if (keys.length === length) return keys
  return Array.from({ length }, (_, i) => keys[i] ?? `fill-${i}`)
}

export function ListWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const { trigger } = useFormContext()
  const { field: f, fieldState } = useController({ name: path })
  const items = Array.isArray(f.value) ? (f.value as unknown[]) : []
  // Stable React keys per item, moved together with the items.
  const [storedKeys, setKeys] = useState<string[]>(() =>
    items.map(() => newKey())
  )
  const keys = fitKeys(storedKeys, items.length)
  const element = (field.schema as z.ZodArray<z.ZodType>).element
  const { min, max } = arrayBounds(field.schema)
  const itemName = field.meta.itemName ?? "Item"
  const id = fieldId(idPrefix, path)
  const dndId = useId()
  const listRef = useRef<HTMLOListElement>(null)

  /** Keyboard users keep their place: focus moves with the item. */
  function focusLater(focusKey: string) {
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)
        ?.focus()
    )
  }
  function commit(nextItems: unknown[], nextKeys: string[]) {
    setKeys(nextKeys)
    f.onChange(nextItems)
    void trigger(path)
  }
  function add() {
    const key = newKey()
    commit([...items, emptyValue(element)], [...keys, key])
    focusLater(`${key}:first`)
  }
  function remove(index: number) {
    commit(
      items.filter((_, i) => i !== index),
      keys.filter((_, i) => i !== index)
    )
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return
    commit(arrayMove(items, from, to), arrayMove(keys, from, to))
    focusLater(`${keys[from]}:${to < from ? "up" : "down"}`)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const labelFor = (key: string | number) => {
    const index = keys.indexOf(String(key))
    return `${itemName} ${index + 1}`
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelFor(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${labelFor(active.id)} is over ${labelFor(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelFor(active.id)} dropped at ${labelFor(over.id)}.`
        : `${labelFor(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${labelFor(active.id)} cancelled.`,
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    move(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)))
  }
  const error = errorText(fieldState.error)

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {field.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      {field.meta.help ? (
        <p className="-mt-2 text-sm text-muted-foreground">{field.meta.help}</p>
      ) : null}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Press space to pick up. Use the arrow keys to move, space to drop, escape to cancel. Or use the Move up and Move down buttons.",
          },
        }}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <ol ref={listRef} className="flex flex-col gap-3">
            {items.map((_, index) => (
              <ListItem
                key={keys[index]}
                sortId={keys[index]}
                path={`${path}.${index}`}
                element={element}
                index={index}
                count={items.length}
                itemName={itemName}
                itemLabel={field.meta.itemLabel}
                canRemove={!disabled && items.length > min}
                disabled={disabled}
                onMove={(to) => move(index, to)}
                onRemove={() => remove(index)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || items.length >= max}
          onClick={add}
        >
          <Plus aria-hidden />
          Add {itemName.toLowerCase()}
        </Button>
      </div>
    </div>
  )
}

function ListItem({
  sortId,
  path,
  element,
  index,
  count,
  itemName,
  itemLabel,
  canRemove,
  disabled,
  onMove,
  onRemove,
}: {
  sortId: string
  path: string
  element: z.ZodType
  index: number
  count: number
  itemName: string
  itemLabel?: string
  canRemove: boolean
  disabled: boolean
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortId, disabled })
  const title = useWatch({
    name: itemLabel ? `${path}.${itemLabel}` : path,
  }) as unknown
  const position = `${itemName} ${index + 1}`
  const heading =
    itemLabel && typeof title === "string" && title.trim()
      ? `${position}: ${title}`
      : position
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex flex-col gap-3 rounded-lg border bg-background p-3 ${isDragging ? "z-10 shadow-lg" : ""}`}
      aria-label={position}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${position}`}
          className="flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {heading}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${position} up`}
          data-focus-key={`${sortId}:up`}
          disabled={disabled || index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${position} down`}
          data-focus-key={`${sortId}:down`}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${position}`}
          disabled={!canRemove}
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div
        data-focus-key={`${sortId}:first`}
        tabIndex={-1}
        className="flex flex-col gap-4 outline-none"
      >
        <Field schema={element} name={position} path={path} />
      </div>
    </li>
  )
}
```

`components/admin/schema-form/widgets/pickers.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { ImageIcon, Link2 } from "lucide-react"
import { useState } from "react"
import { useController } from "react-hook-form"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { useMediaItem } from "@/components/admin/media/use-media-item"
import { RichTextEditor } from "@/components/admin/rich-text/editor"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { OptionCollection, OptionItem } from "@/lib/schemas/api/search"

import { fieldId, useSchemaForm, type WidgetProps } from "../context"
import { NativeSelect } from "./basic"
import { describedBy, errorText, FieldShell } from "./field-shell"

function useOptions(collection: OptionCollection | undefined, enabled = true) {
  return useQuery({
    queryKey: ["options", collection],
    queryFn: () =>
      unwrap(
        api.search.options[":collection"].$get({
          param: { collection: collection! },
        })
      ),
    enabled: !!collection && enabled,
    staleTime: 60_000,
  })
}

const grouped = (items: OptionItem[]) =>
  items.reduce<Record<string, OptionItem[]>>((acc, item) => {
    ;(acc[item.group] ??= []).push(item)
    return acc
  }, {})

/** Label + destination; "Pick" lists internal pages, services and articles. */
export function LinkWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const label = useController({ name: `${path}.label` })
  const href = useController({ name: `${path}.href` })
  const [open, setOpen] = useState(false)
  const options = useOptions("links", open)
  const id = fieldId(idPrefix, path)
  const labelError = errorText(label.fieldState.error)
  const hrefError = errorText(href.fieldState.error)
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">{field.label}</legend>
      {field.meta.help ? (
        <p className="-mt-1 text-sm text-muted-foreground">{field.meta.help}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldShell id={`${id}-label`} label="Text" error={labelError}>
          <Input
            id={`${id}-label`}
            value={(label.field.value as string) ?? ""}
            disabled={disabled}
            aria-invalid={!!labelError}
            aria-describedby={describedBy(`${id}-label`, { error: labelError })}
            onChange={(event) => label.field.onChange(event.target.value)}
            onBlur={label.field.onBlur}
          />
        </FieldShell>
        <FieldShell id={`${id}-href`} label="Link to" error={hrefError}>
          <div className="flex gap-2">
            <Input
              id={`${id}-href`}
              value={(href.field.value as string) ?? ""}
              placeholder="/contact, https://…, tel:…"
              disabled={disabled}
              aria-invalid={!!hrefError}
              aria-describedby={describedBy(`${id}-href`, { error: hrefError })}
              onChange={(event) => href.field.onChange(event.target.value)}
              onBlur={href.field.onBlur}
            />
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    disabled={disabled}
                    aria-label={`Pick a page for ${field.label}`}
                  />
                }
              >
                <Link2 aria-hidden />
                <span className="max-sm:sr-only">Pick</span>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <Command label="Pages on this site">
                  <CommandInput placeholder="Find a page…" />
                  <CommandList>
                    <CommandEmpty>
                      {options.isPending
                        ? "Loading…"
                        : options.isError
                          ? errorMessage(options.error)
                          : "No pages found."}
                    </CommandEmpty>
                    {Object.entries(grouped(options.data?.items ?? [])).map(
                      ([group, items]) => (
                        <CommandGroup key={group} heading={group}>
                          {items.map((item) => (
                            <CommandItem
                              key={item.value}
                              value={`${item.label} ${item.value}`}
                              onSelect={() => {
                                href.field.onChange(item.value)
                                setOpen(false)
                              }}
                            >
                              <span className="truncate">{item.label}</span>
                              <span className="ml-auto truncate text-xs text-muted-foreground">
                                {item.value}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </FieldShell>
      </div>
    </fieldset>
  )
}

/** One record from a collection (meta.collection), stored as slug/id. */
export function CollectionWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const { field: f, fieldState } = useController({ name: path })
  const options = useOptions(field.meta.collection)
  const id = fieldId(idPrefix, path)
  const error =
    errorText(fieldState.error) ??
    (options.isError ? errorMessage(options.error) : undefined)
  const help = field.meta.help
  const value = (f.value as string | null | undefined) ?? ""
  const items = options.data?.items ?? []
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <NativeSelect
        id={id}
        value={value}
        disabled={disabled || options.isPending}
        invalid={!!error}
        describedBy={describedBy(id, { help, error })}
        onChange={(next) =>
          f.onChange(next === "" ? (field.nullable ? null : undefined) : next)
        }
        onBlur={f.onBlur}
      >
        <option value="">{options.isPending ? "Loading…" : "— None —"}</option>
        {value && !items.some((i) => i.value === value) ? (
          <option value={value}>{value}</option>
        ) : null}
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
    </FieldShell>
  )
}

/** Library image: thumbnail, "Choose…" (picker dialog) and "Remove" when optional. */
export function MediaWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const { field: f, fieldState } = useController({ name: path })
  const [open, setOpen] = useState(false)
  const ref = f.value as { mediaId: string } | null | undefined
  const item = useMediaItem(ref?.mediaId)
  const id = fieldId(idPrefix, path)
  const error = fieldState.error
    ? ref
      ? errorText(fieldState.error)
      : "Choose an image"
    : undefined
  const help = field.meta.help
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <div
        id={id}
        tabIndex={-1}
        className="flex flex-wrap items-center gap-3 outline-none"
      >
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]">
          {item.data ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
            <img
              src={item.data.url}
              alt={item.data.alt}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImageIcon aria-hidden className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-sm text-muted-foreground">
            {ref
              ? item.data
                ? item.data.alt || item.data.url
                : item.isError
                  ? "Image not found"
                  : "Loading…"
              : "No image chosen"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              aria-label={`${ref ? "Change" : "Choose"}: ${field.label}`}
              aria-describedby={describedBy(id, { help, error })}
              onClick={() => setOpen(true)}
            >
              {ref ? "Change image" : "Choose image"}
            </Button>
            {ref && (field.nullable || field.optional) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label={`Remove: ${field.label}`}
                onClick={() => f.onChange(field.nullable ? null : undefined)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <MediaPickerDialog
        open={open}
        onOpenChange={setOpen}
        selectedId={ref?.mediaId}
        title={`Choose: ${field.label}`}
        onSelect={(chosen) => f.onChange({ mediaId: chosen.id })}
      />
    </FieldShell>
  )
}

export function RichTextWidget({ field, path }: WidgetProps) {
  const { idPrefix, disabled } = useSchemaForm()
  const { field: f, fieldState } = useController({ name: path })
  const id = fieldId(idPrefix, path)
  const error =
    errorText(fieldState.error) ??
    (fieldState.error ? "Check the formatting of this text" : undefined)
  const help = field.meta.help
  return (
    <FieldShell
      id={id}
      label={field.label}
      help={help}
      error={error}
      optional={field.optional || field.nullable}
    >
      <RichTextEditor
        id={id}
        label={field.label}
        mode={field.richTextMode}
        value={
          (f.value as Parameters<typeof RichTextEditor>[0]["value"]) ?? null
        }
        onChange={(doc) => f.onChange(doc)}
        describedBy={describedBy(id, { help, error })}
        invalid={!!error}
        disabled={disabled}
      />
    </FieldShell>
  )
}
```

`components/admin/schema-form/field.tsx`:

```tsx
"use client"

import type { ComponentType } from "react"
import type { z } from "zod"

import { useSchemaForm, type WidgetProps } from "./context"
import { metaFor, type WidgetKind } from "./editor-meta"
import { resolveWidget } from "./resolve-widget"
import {
  NumberWidget,
  SelectWidget,
  TextareaWidget,
  TextWidget,
  ToggleWidget,
} from "./widgets/basic"
import {
  CollectionWidget,
  LinkWidget,
  MediaWidget,
  RichTextWidget,
} from "./widgets/pickers"
import { GroupWidget, ListWidget } from "./widgets/structure"

export const WIDGETS: Record<WidgetKind, ComponentType<WidgetProps>> = {
  text: TextWidget,
  textarea: TextareaWidget,
  richText: RichTextWidget,
  link: LinkWidget,
  media: MediaWidget,
  number: NumberWidget,
  toggle: ToggleWidget,
  select: SelectWidget,
  list: ListWidget,
  group: GroupWidget,
  collection: CollectionWidget,
}

/** Renders the widget for one schema node at `path` (recursive via group/list). */
export function Field({
  schema,
  name,
  path,
}: {
  schema: z.ZodType
  /** Key or list position, used for the default label. */
  name: string
  path: string
}) {
  const { meta } = useSchemaForm()
  const field = resolveWidget(schema, metaFor(meta, path), name, path)
  const Widget = WIDGETS[field.kind]
  return <Widget field={field} path={path} />
}
```

`components/admin/schema-form/schema-form.tsx`:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef } from "react"
import {
  type DefaultValues,
  FormProvider,
  type Path,
  type Resolver,
  useForm,
} from "react-hook-form"
import type { z } from "zod"

import { SchemaFormContext } from "./context"
import type { EditorMeta } from "./editor-meta"
import { GroupWidget } from "./widgets/structure"
import { resolveWidget } from "./resolve-widget"

export type SchemaFormProps<S extends z.ZodObject> = {
  schema: S
  meta: EditorMeta
  value: z.input<S>
  onChange: (value: z.input<S>) => void
  /** Field errors by path ("hero.heading"), e.g. from a 422 or a failed publish check. */
  errors?: Record<string, string[]>
  disabled?: boolean
  /** Change it to load `value` again (reload after a conflict, restore). */
  resetKey?: string | number
  idPrefix?: string
}

/**
 * Renders a form for any template/settings/collection Zod schema with
 * widgets chosen from the schema and `meta` (spec §8.2). react-hook-form
 * holds the field state; the same Zod schema validates here (zodResolver,
 * on blur then on change) and on the server.
 */
export function SchemaForm<S extends z.ZodObject>({
  schema,
  meta,
  value,
  onChange,
  errors,
  disabled = false,
  resetKey,
  idPrefix = "sf",
}: SchemaFormProps<S>) {
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    // zodResolver's overloads cannot see through the generic S; the
    // runtime types are exactly <input<S>, unknown, output<S>>.
    resolver: zodResolver(schema) as unknown as Resolver<
      z.input<S>,
      unknown,
      z.output<S>
    >,
    defaultValues: value as DefaultValues<z.input<S>>,
    mode: "onTouched",
  })
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  useEffect(() => {
    onChangeRef.current = onChange
    valueRef.current = value
  })

  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ values }) => onChangeRef.current(structuredClone(values)),
      }),
    [form]
  )

  const firstReset = useRef(true)
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false
      return
    }
    form.reset(valueRef.current as DefaultValues<z.input<S>>)
  }, [form, resetKey])

  useEffect(() => {
    if (!errors) return
    for (const [path, messages] of Object.entries(errors)) {
      if (!messages[0]) continue
      form.setError((path === "_root" ? "root" : path) as Path<z.input<S>>, {
        type: "server",
        message: messages[0],
      })
    }
  }, [form, errors])

  const root = resolveWidget(schema, {}, "", "")
  return (
    <FormProvider {...form}>
      <SchemaFormContext.Provider value={{ meta, disabled, idPrefix }}>
        <form noValidate onSubmit={(event) => event.preventDefault()}>
          <GroupWidget field={root} path="" />
        </form>
      </SchemaFormContext.Provider>
    </FormProvider>
  )
}
```

- [ ] **Step 5: Template editor meta**

`templates/home/editor-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the home page (template "home"). */
export const homeEditorMeta: EditorMeta = {
  fields: {
    hero: {
      label: "Hero",
      help: "The full-screen banner at the top of the home page.",
    },
    "hero.eyebrow": { label: "Eyebrow", help: "Small line above the heading." },
    "hero.heading": { label: "Heading" },
    "hero.tagline": { label: "Tagline" },
    "hero.subheading": { label: "Introduction", rows: 3 },
    "hero.backgroundImage": { label: "Background image" },
    "hero.primaryCta": { label: "Primary button" },
    "hero.secondaryCta": {
      label: "Secondary button",
      help: "{phone24h} and {phone24hHref} are replaced with the 24-hour number from Settings › Contact.",
    },
    "hero.stats": { label: "Stats", itemName: "Stat", itemLabel: "label" },
    "hero.stats[].value": {
      label: "Value",
      help: "Text shown, e.g. 18+ or 24/7.",
    },
    "hero.stats[].label": { label: "Label" },
    "hero.stats[].count": {
      label: "Count-up number",
      help: "Optional. The value animates from 0 to this number.",
    },
    "hero.stats[].suffix": {
      label: "Suffix after the number",
      help: "Optional, e.g. +.",
    },
    services: { label: "Services section" },
    team: { label: "Team section" },
    blog: { label: "Blog section" },
    "blog.cta": { label: "Button" },
    "blog.count": {
      label: "Posts shown",
      help: "How many recent articles appear on the home page.",
    },
  },
}
```

`templates/about/editor-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the About page (template "about"). The About section itself is in Settings › Shared sections. */
export const aboutEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    stats: { label: "Stats", itemName: "Stat", itemLabel: "label" },
    values: { label: "Values section" },
    "values.items": { label: "Values", itemName: "Value", itemLabel: "title" },
    "values.items[].icon": { label: "Icon" },
  },
}
```

`templates/services/editor-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the Services page (template "services"). Service cards are edited under Services. */
export const servicesEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    servicesSection: { label: "Services section" },
  },
}
```

`templates/team/editor-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the Team page (template "team"). People are edited under Team. */
export const teamEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    leadership: { label: "Leadership section" },
    "leadership.photoPlaceholder": {
      label: "Photo placeholder",
      help: "Shown behind every team photo (also on the home page).",
    },
    officers: { label: "Officers section" },
    "officers.qualities": {
      label: "Qualities",
      itemName: "Quality",
      itemLabel: "title",
    },
    "officers.qualities[].icon": { label: "Icon" },
  },
}
```

`templates/blog/editor-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the Blog page (template "blog"). Articles are edited under Articles. */
export const blogEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    featuredArticle: {
      label: "Featured article",
      widget: "collection",
      collection: "articles",
      help: "Shown large above the list. None = the newest article.",
    },
    pageSize: { label: "Articles per page" },
  },
}
```

`templates/contact/editor-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the Contact page (template "contact"). The form and map are in Settings › Shared sections. */
export const contactEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    departments: { label: "Departments section" },
    "departments.items": {
      label: "Departments",
      itemName: "Department",
      itemLabel: "title",
    },
    "departments.items[].icon": { label: "Icon" },
    "departments.items[].name": { label: "Contact person" },
    "departments.items[].role": { label: "Their role" },
    "departments.items[].lines": {
      label: "Contact lines",
      itemName: "Line",
      itemLabel: "text",
    },
    "departments.items[].lines[].text": {
      label: "Text",
      help: "Placeholders such as {office} are filled from Settings › Contact.",
    },
    "departments.items[].lines[].href": {
      label: "Link",
      help: "tel:, mailto: or a placeholder such as {officeHref}.",
    },
  },
}
```

`templates/legal/editor-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor labels for the Privacy and Terms pages (template "legal"). */
export const legalEditorMeta: EditorMeta = {
  fields: {
    hero: { label: "Page hero", help: "Banner at the top of the page." },
    "hero.image": { label: "Banner image" },
    "hero.crumb": { label: "Breadcrumb label" },
    "hero.title": { label: "Title" },
    "hero.description": { label: "Introduction" },
    body: {
      label: "Text",
      help: "Headings, lists, quotes and links use the article styles.",
    },
  },
}
```

`templates/editor-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

import { aboutEditorMeta } from "./about/editor-meta"
import { blogEditorMeta } from "./blog/editor-meta"
import { contactEditorMeta } from "./contact/editor-meta"
import { homeEditorMeta } from "./home/editor-meta"
import { legalEditorMeta } from "./legal/editor-meta"
import { servicesEditorMeta } from "./services/editor-meta"
import type { TemplateName } from "./registry"
import { teamEditorMeta } from "./team/editor-meta"

/** Editor hints per template (SchemaForm meta). */
export const templateEditorMeta: Record<TemplateName, EditorMeta> = {
  home: homeEditorMeta,
  about: aboutEditorMeta,
  services: servicesEditorMeta,
  team: teamEditorMeta,
  blog: blogEditorMeta,
  contact: contactEditorMeta,
  legal: legalEditorMeta,
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/admin/resolve-widget.test.ts`
Expected: PASS (31 tests: 7 templates, 15 settings keys, 5 collection schemas, 2 mapping cases, 2 helper cases).

Run: `pnpm exec vitest run --project dom tests/dom/schema-form.test.tsx`
Expected: PASS (14 tests).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0 (the React Compiler lint rules pass: no ref reads during render, no setState in effects).

- [ ] **Step 7: Commit**

```bash
git add components/admin/schema-form templates/editor-meta.ts templates/home/editor-meta.ts templates/about/editor-meta.ts templates/services/editor-meta.ts templates/team/editor-meta.ts templates/blog/editor-meta.ts templates/contact/editor-meta.ts templates/legal/editor-meta.ts tests/unit/admin/resolve-widget.test.ts tests/dom/schema-form.test.tsx
git commit -m "feat: add schema-driven admin form with widgets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Draft preview — signed link, guard, preview bar (master Task 4.4, part 1)

**Files:**
- Create: `lib/schemas/api/preview.ts`, `server/modules/preview/{token,service,guard,routes}.ts`, `components/preview-bar.tsx`
- Modify: `server/modules/services/repo.ts` (`findServiceById`), `server/modules/pages/sources.ts` (guard before reading), `app/(site)/layout.tsx` (preview bar), `server/api/app.ts` (mount admin `/preview` and public `/v1/preview`)
- Test: `tests/unit/preview.test.ts`, `tests/integration/api/preview.test.ts`

**Interfaces:**
- Consumes: Phase 1 `deriveKey("preview")`, `getEnv`; Phase 2 `getSessionContext`, `actorOf`; Phase 3 `loadSiteSources`, `isPageKey`/`PAGE_PATHS`, `isSettingsKey`; Next `draftMode()` (notes §4: enable/disable only in Route Handlers; draft mode bypasses `'use cache'`), `cookies()`, `redirect()`.
- Produces:

```ts
// lib/schemas/api/preview.ts
export const PREVIEW_ENTITIES = ["page","service","settings"] as const
export const previewQuery
export function previewHref(entity: PreviewEntity, id: string): string   // "/api/v1/admin/preview?entity=…&id=…"
// server/modules/preview/token.ts
export const PREVIEW_COOKIE = "sp.preview"; export const PREVIEW_TTL_SECONDS = 3600
export function signPreviewToken(userId: string, now?: number, secret?: string): string          // "<userId>.<exp>.<hmac>"
export function verifyPreviewToken(token, now?, secret?): { userId: string } | null
// server/modules/preview/service.ts
export async function previewPath(actor, entity, id): Promise<string>    // read permission; settings → "/"
export function safeReturnPath(referer, appOrigin): string
// server/modules/preview/guard.ts
export async function assertPreviewAccess(): Promise<void>              // draft mode needs cookie of the signed-in user, else redirect to exit
// components/preview-bar.tsx
export async function PreviewBar(): Promise<JSX.Element | null>         // null outside draft mode
// HTTP
GET /api/v1/admin/preview?entity&id   signed in + read → draftMode().enable(), Set-Cookie sp.preview (HttpOnly, Lax, 1 h), 302 to the public URL
GET /api/v1/preview/exit              public → draftMode().disable(), clear cookie, 302 to the same-origin Referer path (else "/")
```

"Preview link shows draft only to signed-in user with preview cookie" (master 4.4): Next's `__prerender_bypass` cookie alone is not enough — every public page reads through `loadSiteSources()`, which now calls `assertPreviewAccess()` first; in draft mode without a valid `sp.preview` token for the current session's user it redirects to the exit route before any draft content renders. Outside draft mode the bar renders nothing, so the public markup is unchanged (visual gate).

- [ ] **Step 1: Write the failing tests**

`tests/unit/preview.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { draft, jar, session, redirect } = vi.hoisted(() => ({
  draft: { isEnabled: false },
  jar: new Map<string, string>(),
  session: { current: null as null | { actor: { userId: string } } },
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock("next/headers", () => ({
  draftMode: async () => draft,
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
  }),
}))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/server/auth/session", () => ({
  getSessionContext: async () => session.current,
}))

import { assertPreviewAccess } from "@/server/modules/preview/guard"
import { safeReturnPath } from "@/server/modules/preview/service"
import {
  PREVIEW_COOKIE,
  PREVIEW_TTL_SECONDS,
  signPreviewToken,
  verifyPreviewToken,
} from "@/server/modules/preview/token"

const SECRET = "unit-secret-0123456789abcdef0123456789abcdef"

beforeEach(() => {
  // signPreviewToken() without an explicit secret reads the app env.
  process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:5432/sp_test"
  process.env.BETTER_AUTH_SECRET = SECRET
  process.env.BETTER_AUTH_URL = "http://localhost:3000"
  draft.isEnabled = false
  jar.clear()
  session.current = null
  redirect.mockClear()
})

describe("preview token (HMAC, HKDF purpose 'preview')", () => {
  const now = Date.UTC(2026, 9, 16, 12)

  it("round-trips the user id until it expires", () => {
    const token = signPreviewToken("user-1", now, SECRET)
    expect(token.split(".")).toHaveLength(3)
    expect(verifyPreviewToken(token, now, SECRET)).toEqual({ userId: "user-1" })
    expect(
      verifyPreviewToken(token, now + (PREVIEW_TTL_SECONDS - 1) * 1000, SECRET)
    ).not.toBeNull()
    expect(
      verifyPreviewToken(token, now + PREVIEW_TTL_SECONDS * 1000, SECRET)
    ).toBeNull()
  })

  it("rejects tampering, other secrets and garbage", () => {
    const token = signPreviewToken("user-1", now, SECRET)
    const [, expires, sig] = token.split(".")
    expect(
      verifyPreviewToken(`user-2.${expires}.${sig}`, now, SECRET)
    ).toBeNull()
    expect(
      verifyPreviewToken(`user-1.${Number(expires) + 60}.${sig}`, now, SECRET)
    ).toBeNull()
    expect(
      verifyPreviewToken(
        token,
        now,
        "other-secret-0123456789abcdef0123456789ab"
      )
    ).toBeNull()
    for (const bad of [undefined, "", "a.b", "a.b.c.d", "user-1.x.sig"])
      expect(verifyPreviewToken(bad, now, SECRET)).toBeNull()
  })
})

describe("assertPreviewAccess (draft content only for the signed-in previewer)", () => {
  it("does nothing outside draft mode", async () => {
    await expect(assertPreviewAccess()).resolves.toBeUndefined()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("allows draft mode with a valid cookie for the signed-in user", async () => {
    draft.isEnabled = true
    jar.set(PREVIEW_COOKIE, signPreviewToken("user-1"))
    session.current = { actor: { userId: "user-1" } }
    await expect(assertPreviewAccess()).resolves.toBeUndefined()
  })

  it.each([
    ["no preview cookie", null, "user-1"],
    ["no session (signed out)", "user-1", null],
    ["cookie of another user", "user-2", "user-1"],
  ])("exits preview with %s", async (_case, cookieUser, sessionUser) => {
    draft.isEnabled = true
    if (cookieUser) jar.set(PREVIEW_COOKIE, signPreviewToken(cookieUser))
    session.current = sessionUser ? { actor: { userId: sessionUser } } : null
    await expect(assertPreviewAccess()).rejects.toThrow(
      "NEXT_REDIRECT /api/v1/preview/exit"
    )
  })
})

describe("safeReturnPath", () => {
  const origin = "http://localhost:3000"
  it.each([
    ["http://localhost:3000/about?x=1", "/about?x=1"],
    ["http://localhost:3000/", "/"],
    ["https://evil.example/about", "/"],
    ["http://localhost:3000/admin/pages", "/"],
    ["not a url", "/"],
    [undefined, "/"],
  ])("%s → %s", (referer, expected) => {
    expect(safeReturnPath(referer, origin)).toBe(expected)
  })
})
```

`tests/integration/api/preview.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Hono runs outside Next: record draft-mode calls.
const { enable, disable } = vi.hoisted(() => ({
  enable: vi.fn(),
  disable: vi.fn(),
}))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  draftMode: async () => ({ isEnabled: false, enable, disable }),
}))

import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  PREVIEW_COOKIE,
  verifyPreviewToken,
} from "@/server/modules/preview/token"

import { resetDb } from "../db"
import { adminRequest, ORIGIN, signedInUser } from "../helpers/auth"

let editor: { cookie: string; user: { id: string } }
let intake: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = await signedInUser(["editor"])
  intake = (await signedInUser(["intake"])).cookie
})

beforeEach(() => {
  enable.mockClear()
  disable.mockClear()
})

const previewCookie = (res: Response) =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${PREVIEW_COOKIE}=`))

describe("preview (master 4.4)", () => {
  it("enables draft mode, sets a signed cookie for the user and redirects to the page", async () => {
    const res = await adminRequest("/preview?entity=page&id=about", {
      cookie: editor.cookie,
    })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/about")
    expect(enable).toHaveBeenCalledTimes(1)
    const cookie = previewCookie(res)!
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Max-Age=3600/)
    const token = decodeURIComponent(cookie.split(";")[0].split("=")[1])
    expect(verifyPreviewToken(token)).toEqual({ userId: editor.user.id })
  })

  it("previews services at their public URL and settings on the home page", async () => {
    const [service] = await getDb()
      .select()
      .from(services)
      .where(eq(services.slug, "static-security"))
    const one = await adminRequest(`/preview?entity=service&id=${service.id}`, {
      cookie: editor.cookie,
    })
    expect(one.headers.get("location")).toBe("/services/static-security")
    const settings = await adminRequest("/preview?entity=settings&id=footer", {
      cookie: editor.cookie,
    })
    expect(settings.headers.get("location")).toBe("/")
  })

  it("requires a session and read permission", async () => {
    expect((await adminRequest("/preview?entity=page&id=home")).status).toBe(
      401
    )
    expect(
      (await adminRequest("/preview?entity=page&id=home", { cookie: intake }))
        .status
    ).toBe(403)
    expect(
      (
        await adminRequest("/preview?entity=page&id=nope", {
          cookie: editor.cookie,
        })
      ).status
    ).toBe(404)
    expect(enable).not.toHaveBeenCalled()
  })

  it("exit disables draft mode, clears the cookie and returns to the page", async () => {
    const res = await app.request("/api/v1/preview/exit", {
      headers: { referer: `${ORIGIN}/services/static-security` },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/services/static-security")
    expect(disable).toHaveBeenCalledTimes(1)
    expect(previewCookie(res)).toMatch(/Max-Age=0/)
    const foreign = await app.request("/api/v1/preview/exit", {
      headers: { referer: "https://evil.example/x" },
    })
    expect(foreign.headers.get("location")).toBe("/")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/preview.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/modules/preview/guard"`.

Run: `pnpm test:integration tests/integration/api/preview.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/modules/preview/token"`.

- [ ] **Step 3: Token, service, guard, routes**

`lib/schemas/api/preview.ts`:

```ts
import { z } from "zod"

export const PREVIEW_ENTITIES = ["page", "service", "settings"] as const
export type PreviewEntity = (typeof PREVIEW_ENTITIES)[number]

/** GET /api/v1/admin/preview?entity=page&id=home */
export const previewQuery = z.object({
  entity: z.enum(PREVIEW_ENTITIES),
  id: z.string().min(1).max(100),
})

/** Admin URL that opens the draft of a record on the public site (new tab). */
export function previewHref(entity: PreviewEntity, id: string): string {
  return `/api/v1/admin/preview?${new URLSearchParams({ entity, id })}`
}
```

`server/modules/preview/token.ts`:

```ts
import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { deriveKey } from "@/server/lib/crypto"

/** Signed, short-lived proof that a signed-in admin opened a preview (spec §5.6). */
export const PREVIEW_COOKIE = "sp.preview"
export const PREVIEW_TTL_SECONDS = 60 * 60

const mac = (payload: string, secret?: string) =>
  createHmac("sha256", deriveKey("preview", secret))
    .update(payload)
    .digest("base64url")

/** "<userId>.<expires epoch s>.<HMAC-SHA256 base64url>" (HKDF purpose "preview"). */
export function signPreviewToken(
  userId: string,
  now = Date.now(),
  secret?: string
): string {
  const expires = Math.floor(now / 1000) + PREVIEW_TTL_SECONDS
  const payload = `${userId}.${expires}`
  return `${payload}.${mac(payload, secret)}`
}

/** The user the token was issued to, or null if malformed, forged or expired. */
export function verifyPreviewToken(
  token: string | undefined | null,
  now = Date.now(),
  secret?: string
): { userId: string } | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [userId, expiresRaw, signature] = parts
  const expires = Number(expiresRaw)
  if (!userId || !Number.isInteger(expires)) return null
  const expected = Buffer.from(mac(`${userId}.${expiresRaw}`, secret))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null
  if (expires * 1000 <= now) return null
  return { userId }
}
```

Append to `server/modules/services/repo.ts`:

```ts
export async function findServiceById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(services).where(eq(services.id, id))
  return row ?? null
}
```

`server/modules/preview/service.ts`:

```ts
import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { PreviewEntity } from "@/lib/schemas/api/preview"
import { isSettingsKey } from "@/lib/schemas/settings"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden, notFound } from "@/server/lib/errors"
import { findServiceById } from "@/server/modules/services/repo"
import { isPageKey, PAGE_PATHS } from "@/templates/registry"

const READ: Record<PreviewEntity, PermissionRequest> = {
  page: { page: ["read"] },
  service: { service: ["read"] },
  settings: { settings: ["read"] },
}

/**
 * Public URL that shows the record's draft. Settings (header, footer,
 * shared sections) preview on the home page.
 */
export async function previewPath(
  actor: Actor,
  entity: PreviewEntity,
  id: string
): Promise<string> {
  if (!hasPermission(actor.roles, READ[entity])) throw forbidden()
  switch (entity) {
    case "page":
      if (!isPageKey(id)) throw notFound("Page")
      return PAGE_PATHS[id]
    case "service": {
      const service = await findServiceById(getDb(), id)
      if (!service) throw notFound("Service")
      return `/services/${service.slug}`
    }
    case "settings":
      if (!isSettingsKey(id)) throw notFound("Settings")
      return "/"
  }
}

/** Path of a same-origin public page (Referer) to return to after preview, else "/". */
export function safeReturnPath(
  referer: string | null | undefined,
  appOrigin: string
): string {
  if (!referer) return "/"
  let url: URL
  try {
    url = new URL(referer)
  } catch {
    return "/"
  }
  if (url.origin !== appOrigin) return "/"
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api"))
    return "/"
  return `${url.pathname}${url.search}`
}
```

`server/modules/preview/guard.ts`:

```ts
import "server-only"

import { cookies, draftMode } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionContext } from "@/server/auth/session"

import { PREVIEW_COOKIE, verifyPreviewToken } from "./token"

/**
 * Public pages call this before reading data. In draft mode the request
 * must carry a valid preview cookie issued to the signed-in user;
 * otherwise draft mode is switched off (exit route) before any draft
 * content renders. Outside draft mode it costs one cookie-free check.
 */
export async function assertPreviewAccess(): Promise<void> {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return
  const claim = verifyPreviewToken((await cookies()).get(PREVIEW_COOKIE)?.value)
  const session = claim ? await getSessionContext() : null
  if (!claim || !session || session.actor.userId !== claim.userId)
    redirect("/api/v1/preview/exit")
}
```

`server/modules/preview/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"
import { deleteCookie, setCookie } from "hono/cookie"
import { draftMode } from "next/headers"

import { previewQuery } from "@/lib/schemas/api/preview"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"
import { getEnv } from "@/server/env"

import { previewPath, safeReturnPath } from "./service"
import { PREVIEW_COOKIE, PREVIEW_TTL_SECONDS, signPreviewToken } from "./token"

const secure = () => getEnv().BETTER_AUTH_URL.startsWith("https:")

/**
 * GET /api/v1/admin/preview?entity&id — signed-in only (admin chain):
 * turns on Next draft mode, sets the signed preview cookie and redirects
 * to the public URL, which then renders drafts for this user only.
 */
export const adminPreviewRoutes = new Hono<AppEnv>().get(
  "/",
  zv("query", previewQuery),
  async (c) => {
    const actor = actorOf(c)
    const { entity, id } = c.req.valid("query")
    const path = await previewPath(actor, entity, id)
    ;(await draftMode()).enable()
    setCookie(c, PREVIEW_COOKIE, signPreviewToken(actor.userId), {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: secure(),
      maxAge: PREVIEW_TTL_SECONDS,
    })
    return c.redirect(path, 302)
  }
)

/**
 * GET /api/v1/preview/exit — leaves draft mode (no session needed) and
 * returns to the page the preview bar was on.
 */
export const previewExitRoutes = new Hono<AppEnv>().get("/exit", async (c) => {
  ;(await draftMode()).disable()
  deleteCookie(c, PREVIEW_COOKIE, { path: "/", secure: secure() })
  const origin = new URL(getEnv().BETTER_AUTH_URL).origin
  return c.redirect(safeReturnPath(c.req.header("referer"), origin), 302)
})
```

In `server/api/app.ts`:
1. add the import

```ts
import {
  adminPreviewRoutes,
  previewExitRoutes,
} from "@/server/modules/preview/routes"
```

2. chain `.route("/preview", adminPreviewRoutes)` after `.route("/media", mediaRoutes)` in `adminRoutes`;
3. in `createApp()`, directly above the `// 5. Health` comment, add:

```ts
  // Leaving draft-mode preview needs no session (cookies are cleared).
  api.route("/v1/preview", previewExitRoutes)
```

- [ ] **Step 4: Guard the public data path and add the bar**

In `server/modules/pages/sources.ts` add `import { assertPreviewAccess } from "@/server/modules/preview/guard"` (above the `getSettings` import) and make these the first lines of `loadSiteSources()`:

```ts
  // Draft mode without a valid preview cookie + session → exit preview.
  await assertPreviewAccess()
```

`components/preview-bar.tsx`:

```tsx
import { draftMode } from "next/headers"

/**
 * Admin-only bar while previewing drafts (spec §5.6; global constraint:
 * the one allowed addition to public pages). Renders nothing outside
 * draft mode, so the public markup is unchanged.
 */
export async function PreviewBar() {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return null
  return (
    <div
      role="region"
      aria-label="Preview"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 2147483000,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "10px 16px",
        background: "#0d1b36",
        color: "#fff",
        font: "600 14px/1.4 system-ui, sans-serif",
        boxShadow: "0 -4px 16px rgb(0 0 0 / 0.25)",
      }}
    >
      <span>Preview: you are seeing unpublished changes.</span>
      {/* GET form, never <Link>: prefetching would leave preview (notes §4). */}
      <form method="GET" action="/api/v1/preview/exit">
        <button
          type="submit"
          style={{
            border: "1px solid rgb(255 255 255 / 0.6)",
            borderRadius: "999px",
            padding: "4px 14px",
            background: "transparent",
            color: "#fff",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Exit preview
        </button>
      </form>
    </div>
  )
}
```

In `app/(site)/layout.tsx` add `import { Suspense } from "react"` (after the `next/font/google` import) and `import { PreviewBar } from "@/components/preview-bar"` (after the `SmoothScroll` import), and directly after `<ThemeProvider>{children}</ThemeProvider>` inside `<body>` add:

```tsx
        {/* Draft-mode only (admins); renders nothing for visitors. */}
        <Suspense fallback={null}>
          <PreviewBar />
        </Suspense>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/preview.test.ts`
Expected: PASS (13 tests).

Run: `pnpm test:integration tests/integration/api/preview.test.ts tests/integration/pages/site-sources.test.ts`
Expected: PASS (4 + 3 tests; `site-sources` mocks `draftMode` disabled, so the guard is a no-op there).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0; the route table still shows the public pages as `◐` (draftMode() is false during prerender).

Run (port 3100 free, no other Playwright/build): `pnpm test:visual`
Expected: `43 passed, 1 skipped` — 0 px on every public page (the bar renders nothing).

- [ ] **Step 6: Commit**

```bash
git add lib/schemas/api/preview.ts server/modules/preview server/modules/services/repo.ts server/modules/pages/sources.ts components/preview-bar.tsx "app/(site)/layout.tsx" server/api/app.ts tests/unit/preview.test.ts tests/integration/api/preview.test.ts
git commit -m "feat: add signed draft preview with admin-only preview bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Page editor — autosave, ⌘S, publish with diff, history, conflict, unsaved guard (master Task 4.4, part 2)

**Files:**
- Create: `hooks/use-autosave.ts`, `components/admin/editor/{save-state.tsx,conflict-dialog.tsx,unsaved-guard.tsx,publish-dialog.tsx,revision-drawer.tsx,editor-layout.tsx,versioned-editor.tsx}`, `components/admin/pages/{pages-list.tsx,page-editor.tsx}`, `app/(admin)/admin/(panel)/pages/page.tsx`, `app/(admin)/admin/(panel)/pages/[key]/page.tsx`
- Test: `tests/dom/use-autosave.test.tsx`, `tests/dom/versioned-editor.test.tsx`, `tests/e2e/page-editor.spec.ts`

**Interfaces:**
- Consumes: Task 1 shell/providers/`api`/`ApiError`; Task 3 pages API, `VersionedDto`, `RevisionSummary`, `diffValues`, `isDeepEqual`; Task 5 `SchemaForm`, `templateEditorMeta`, `metaFor`/`humanize`; Task 6 `previewHref`; Phase 2 `formatDateTime`, `requirePermission`.
- Produces:

```ts
// hooks/use-autosave.ts
export type SaveState = "saved" | "saving" | "unsaved" | "invalid" | "conflict" | "error"
export const AUTOSAVE_DELAY_MS = 1500
export function useAutosave<T>(o: { value: T; savedValue: T; save(value: T): Promise<void>; isValid(value: T): boolean; delay?; enabled? }):
  { state: SaveState; dirty: boolean; conflict: ApiError | null; error: unknown; flush(): Promise<boolean>; resolveConflict(): void; clearError(): void }
// components/admin/editor/versioned-editor.tsx
export function issuesToFieldErrors(error: z.ZodError): Record<string, string[]>
export type VersionedEditorProps<Dto extends VersionedDto<unknown>> = { title; backHref; backLabel; queryKey; load(); saveDraft(draft, version); publish(version); restore(revisionId, version); schema: z.ZodObject; meta: EditorMeta; revisions: { entity: RevisionEntity; id: string }; previewHref?; publicHref?; canEdit; canPublish; actions?; aside? }
export function VersionedEditor<Dto>(props: VersionedEditorProps<Dto>): JSX.Element
// components/admin/editor/editor-layout.tsx
export function statusLabel(record: { published: unknown; dirty: boolean }): { text: "Not published" | "Unpublished changes" | "Published"; variant }
export function EditorLayout(props): JSX.Element
// components/admin/editor/publish-dialog.tsx
export function pathLabel(meta: EditorMeta, path: string): string      // "Hero › Heading"
export function previewValue(value: unknown): string
export function PublishDialog(props): JSX.Element
// components/admin/editor/{save-state,conflict-dialog,revision-drawer,unsaved-guard}.tsx
export function SaveStateIndicator(props: { state: SaveState; onRetry? })   // role=status, name "Save status: <label>"
export function ConflictDialog(props: { open; updatedBy; updatedAt; onReload; onOverwrite; onCopyMine })
export function RevisionDrawer(props: { open; onOpenChange; entity; entityId; canRestore; onRestore(revision) })
export const UNSAVED_MESSAGE: string; export function UnsavedGuard(props: { when: boolean })
// components/admin/pages/*
export function PagesList(): JSX.Element; export function PageEditor(props: { pageKey: PageKey }): JSX.Element
```

Editor behaviour (spec §8.2): edits autosave 1.5 s after typing stops, only when the whole draft validates (otherwise "Fix errors to save"); ⌘S/Ctrl+S saves now; the save indicator shows Saved / Saving… / Unsaved changes / Fix errors to save / Conflict / Not saved (+ Retry); TanStack Query cache is updated optimistically and rolled back on failure; the version sent is updated synchronously after each save (a publish right after a save uses the new version); 409 opens the conflict dialog (reload theirs / overwrite with mine / copy mine then reload); Publish validates everything, saves, shows a diff (path labels from editor meta) and publishes; History lists published versions with restore-into-draft; leaving with unsaved changes asks first (beforeunload + in-app link clicks).

- [ ] **Step 1: Write the failing tests**

`tests/dom/use-autosave.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useAutosave } from "@/hooks/use-autosave"
import { ApiError } from "@/lib/api-client"

type Props = { value: { t: string }; savedValue: { t: string } }

function setup(save: (v: { t: string }) => Promise<void>, initial: Props) {
  return renderHook(
    (props: Props) =>
      useAutosave({ ...props, save, isValid: (v) => v.t !== "", delay: 30 }),
    { initialProps: initial }
  )
}

describe("useAutosave (spec §8.2)", () => {
  it("is saved when nothing changed and saves after the debounce", async () => {
    const save = vi.fn(async () => undefined)
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    expect(result.current.state).toBe("saved")
    rerender({ value: { t: "ab" }, savedValue: { t: "a" } })
    expect(result.current.state).toBe("unsaved")
    await waitFor(() => expect(save).toHaveBeenCalledWith({ t: "ab" }))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it("never sends invalid values", async () => {
    const save = vi.fn(async () => undefined)
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    rerender({ value: { t: "" }, savedValue: { t: "a" } })
    expect(result.current.state).toBe("invalid")
    await new Promise((r) => setTimeout(r, 80))
    expect(save).not.toHaveBeenCalled()
    await act(async () => expect(await result.current.flush()).toBe(false))
  })

  it("flush() saves immediately (⌘S) and reports success", async () => {
    const save = vi.fn(async () => undefined)
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    rerender({ value: { t: "now" }, savedValue: { t: "a" } })
    await act(async () => expect(await result.current.flush()).toBe(true))
    expect(save).toHaveBeenCalledWith({ t: "now" })
  })

  it("parks in conflict on 409 until resolved, and in error on other failures", async () => {
    const conflict = new ApiError(409, {
      error: { code: "CONFLICT", message: "Changed", current: { version: 3 } },
    })
    const save = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(new TypeError("offline"))
    const { result, rerender } = setup(save, {
      value: { t: "a" },
      savedValue: { t: "a" },
    })
    rerender({ value: { t: "b" }, savedValue: { t: "a" } })
    await waitFor(() => expect(result.current.state).toBe("conflict"))
    expect(result.current.conflict?.current).toEqual({ version: 3 })
    await new Promise((r) => setTimeout(r, 80))
    expect(save).toHaveBeenCalledTimes(1)
    act(() => result.current.resolveConflict())
    await waitFor(() => expect(result.current.state).toBe("error"))
  })
})
```

`tests/dom/versioned-editor.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/pages/home",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import { PageEditor } from "@/components/admin/pages/page-editor"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { PageDto } from "@/lib/schemas/api/content"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"

const home = pagesFixture(fixtureMediaLookup).home.data

const dto = (version: number, heading: string, published = home): PageDto => ({
  key: "home",
  label: "Home",
  template: "home",
  path: "/",
  draft: { ...home, hero: { ...home.hero, heading } },
  published,
  version,
  status: "published",
  dirty: heading !== published.hero.heading,
  publishedAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  updatedBy: { id: "u2", name: "Other Editor" },
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

let routes: Record<string, (init?: RequestInit) => Response>
const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost")
    const key = `${init?.method ?? "GET"} ${url.pathname}`
    const route = routes[key]
    if (route) return route(init)
    if (url.pathname.startsWith("/api/v1/admin/media/"))
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    return json(200, { items: [], page: 1, pageSize: 24, total: 0 })
  }
)

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
  routes = {
    "GET /api/v1/admin/pages/home": () => json(200, dto(1, home.hero.heading)),
  }
})

function renderEditor() {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Edith",
          email: "e@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles: ["editor"],
        impersonatedBy: null,
      }}
    >
      <PageEditor pageKey="home" />
    </AdminShell>
  )
}

async function headingInput() {
  const hero = await screen.findByRole("region", { name: "Hero" })
  return within(hero).getByRole("textbox", { name: "Heading" })
}

describe("page editor (master 4.4)", () => {
  it("saves with ⌘S and shows Saved", async () => {
    const user = userEvent.setup()
    const put = vi.fn((init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        draft: PageDto["draft"]
        version: number
      }
      expect(body.version).toBe(1)
      return json(200, { ...dto(2, "New heading"), draft: body.draft })
    })
    routes["PUT /api/v1/admin/pages/home/draft"] = put
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    await user.type(heading, "New heading")
    expect(
      screen.getByRole("status", { name: /^Save status/ })
    ).toHaveTextContent("Unsaved changes")
    await user.keyboard("{Control>}s{/Control}")
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: /^Save status/ })
      ).toHaveTextContent("Saved")
    )
    expect(put).toHaveBeenCalledTimes(1)
  })

  it("shows the conflict dialog on 409 and reloads their version", async () => {
    const user = userEvent.setup()
    routes["PUT /api/v1/admin/pages/home/draft"] = () =>
      json(409, {
        error: {
          code: "CONFLICT",
          message: "Changed",
          current: dto(5, "Their heading"),
          requestId: "r",
        },
      })
    renderEditor()
    const heading = await headingInput()
    await user.type(heading, " mine")
    await user.keyboard("{Control>}s{/Control}")
    const dialog = await screen.findByRole("alertdialog", {
      name: "Someone else changed this",
    })
    expect(dialog).toHaveTextContent("Other Editor")
    await user.click(
      within(dialog).getByRole("button", { name: "Reload their version" })
    )
    await waitFor(async () =>
      expect(await headingInput()).toHaveValue("Their heading")
    )
    expect(
      screen.getByRole("status", { name: /^Save status/ })
    ).toHaveTextContent("Saved")
  })

  it("lists the changes before publishing and publishes with the saved version", async () => {
    const user = userEvent.setup()
    routes["PUT /api/v1/admin/pages/home/draft"] = (init) => {
      const body = JSON.parse(String(init?.body)) as { draft: PageDto["draft"] }
      return json(200, { ...dto(2, "Fresh"), draft: body.draft })
    }
    const publish = vi.fn((init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ version: 2 })
      const published = { ...home, hero: { ...home.hero, heading: "Fresh" } }
      return json(200, { ...dto(3, "Fresh", published), dirty: false })
    })
    routes["POST /api/v1/admin/pages/home/publish"] = publish
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    await user.type(heading, "Fresh")
    await user.click(screen.getByRole("button", { name: "Publish" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Publish changes?",
    })
    expect(
      within(dialog).getByRole("list", { name: "Changes" })
    ).toHaveTextContent("Hero › Heading")
    expect(
      within(dialog).getByRole("list", { name: "Changes" })
    ).toHaveTextContent("Fresh")
    await user.click(
      within(dialog).getByRole("button", { name: "Publish now" })
    )
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Publish changes?" })
      ).toBeNull()
    )
    expect(document.querySelector('[data-slot="badge"]')).toHaveTextContent(
      "Published"
    )
  })

  it("asks before leaving with unsaved changes", async () => {
    const user = userEvent.setup()
    const confirm = vi.fn(() => false)
    vi.stubGlobal("confirm", confirm)
    renderEditor()
    const heading = await headingInput()
    await user.clear(heading)
    expect(
      screen.getByRole("status", { name: /^Save status/ })
    ).toHaveTextContent("Fix errors to save")
    await user.click(
      within(screen.getByRole("navigation", { name: "Admin" })).getByRole(
        "link",
        { name: "Services" }
      )
    )
    expect(confirm).toHaveBeenCalledTimes(1)
  })
})
```

`tests/e2e/page-editor.spec.ts`:

```ts
import { type Browser, expect, type Page, test } from "@playwright/test"

import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Master 4.4: edit the home hero heading → autosave → publish → public /
// shows it; preview shows drafts only with the preview cookie; ⌘S; unsaved
// guard; conflict dialog. Specs run serially on the seeded sp_e2e.

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
  await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible()
}

async function openHomeEditor(page: Page) {
  await page.goto("/admin/pages/home")
  await expect(
    page.getByRole("heading", { level: 1, name: "Home" })
  ).toBeVisible()
  return page.getByRole("region", { name: "Hero" })
}

const saveStatus = (page: Page) =>
  page.getByRole("status", { name: /^Save status/ })

async function publicHeading(browser: Browser) {
  const anonymous = await browser.newContext()
  const page = await anonymous.newPage()
  await page.goto("/")
  const text = await page.locator("[data-hero-title]").textContent()
  await anonymous.close()
  return text?.trim()
}

test("edit hero heading → autosave → preview → publish → public site", async ({
  page,
  browser,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const hero = await openHomeEditor(page)
  const heading = hero.getByRole("textbox", { name: "Heading" })
  await expect(heading).toHaveValue("Security Partners Ltd.")

  await heading.fill("Watching Over Laois")
  await expect(saveStatus(page)).toHaveText("Unsaved changes")
  // Debounced autosave (1.5 s) without any further input.
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 10_000 })

  // Drafts are invisible to visitors…
  expect(await publicHeading(browser)).toBe("Security Partners Ltd.")
  // …and visible in preview for this signed-in user.
  const [preview] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "Preview" }).click(),
  ])
  await expect(preview.locator("[data-hero-title]")).toHaveText(
    "Watching Over Laois"
  )
  await expect(preview.getByRole("region", { name: "Preview" })).toBeVisible()
  await preview.getByRole("button", { name: "Exit preview" }).click()
  await expect(preview.locator("[data-hero-title]")).toHaveText(
    "Security Partners Ltd."
  )
  await expect(preview.getByRole("region", { name: "Preview" })).toHaveCount(0)
  await preview.close()

  await page.getByRole("button", { name: "Publish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Publish changes?" })
  await expect(dialog.getByRole("list", { name: "Changes" })).toContainText(
    "Hero › Heading"
  )
  await dialog.getByRole("button", { name: "Publish now" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByText("The site shows the new version now.")
  ).toBeVisible()

  expect(await publicHeading(browser)).toBe("Watching Over Laois")
})

test("a stale preview cookie without a session shows only published content", async ({
  page,
  browser,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const hero = await openHomeEditor(page)
  await hero
    .getByRole("textbox", { name: "Tagline" })
    .fill("Draft-only tagline")
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 10_000 })
  const [preview] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "Preview" }).click(),
  ])
  await expect(preview.getByText("Draft-only tagline")).toBeVisible()
  // Copy only the draft-mode + preview cookies (no session) to a fresh visitor.
  const cookies = (await page.context().cookies()).filter(
    (c) => !c.name.startsWith("sp.")
  )
  expect(cookies.map((c) => c.name)).toContain("__prerender_bypass")
  const visitor = await browser.newContext()
  await visitor.addCookies([
    ...cookies,
    ...(await page.context().cookies()).filter((c) => c.name === "sp.preview"),
  ])
  const other = await visitor.newPage()
  await other.goto("/")
  await expect(other.locator("[data-hero-title]")).toBeVisible()
  await expect(other.getByText("Draft-only tagline")).toHaveCount(0)
  await visitor.close()
})

test("⌘S saves immediately; leaving with unsaved changes asks first", async ({
  page,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const hero = await openHomeEditor(page)
  const tagline = hero.getByRole("textbox", { name: "Tagline" })
  await tagline.fill("Saved with the keyboard")
  const put = page.waitForRequest(
    (r) =>
      r.method() === "PUT" &&
      r.url().endsWith("/api/v1/admin/pages/home/draft"),
    { timeout: 1_000 }
  )
  await page.keyboard.press("ControlOrMeta+s")
  await put
  await expect(saveStatus(page)).toHaveText("Saved")

  await hero.getByRole("textbox", { name: "Heading" }).fill("")
  await expect(saveStatus(page)).toHaveText("Fix errors to save")
  let asked = ""
  page.once("dialog", async (dialog) => {
    asked = dialog.message()
    await dialog.dismiss()
  })
  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Services" })
    .click()
  expect(asked).toContain("not saved")
  await expect(page).toHaveURL(/\/admin\/pages\/home$/)
})

test("two editors: the stale one gets the conflict dialog and reloads theirs", async ({
  page,
  browser,
}, testInfo) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const heroA = await openHomeEditor(page)

  const contextB = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${testInfo.title} B`) },
  })
  const pageB = await contextB.newPage()
  await signIn(pageB, editor.email)
  const heroB = await openHomeEditor(pageB)
  await heroB
    .getByRole("textbox", { name: "Eyebrow" })
    .fill("Changed by editor B")
  await expect(saveStatus(pageB)).toHaveText("Saved", { timeout: 10_000 })
  await contextB.close()

  await heroA
    .getByRole("textbox", { name: "Eyebrow" })
    .fill("Changed by editor A")
  const conflict = page.getByRole("alertdialog", {
    name: "Someone else changed this",
  })
  await expect(conflict).toBeVisible({ timeout: 10_000 })
  await conflict.getByRole("button", { name: "Reload their version" }).click()
  await expect(heroA.getByRole("textbox", { name: "Eyebrow" })).toHaveValue(
    "Changed by editor B"
  )
  await expect(saveStatus(page)).toHaveText("Saved")
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/use-autosave.test.tsx tests/dom/versioned-editor.test.tsx`
Expected: FAIL — `Failed to resolve import "@/hooks/use-autosave"` / `"@/components/admin/pages/page-editor"`.

- [ ] **Step 3: Autosave hook and editor parts**

`hooks/use-autosave.ts`:

```ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { ApiError } from "@/lib/api-client"
import { isDeepEqual } from "@/lib/json"

/** Save-state indicator values (spec §8.2: Saved / Saving / Unsaved / Conflict). */
export type SaveState =
  "saved" | "saving" | "unsaved" | "invalid" | "conflict" | "error"

export const AUTOSAVE_DELAY_MS = 1500

/**
 * Debounced autosave of `value` against the last saved value. Invalid
 * values are never sent (the form shows the errors); a 409 parks the hook
 * in "conflict" until `resolveConflict()`; other failures → "error" with
 * `flush()` to retry. `flush()` saves now (⌘S, before publish).
 */
export function useAutosave<T>({
  value,
  savedValue,
  save,
  isValid,
  delay = AUTOSAVE_DELAY_MS,
  enabled = true,
}: {
  value: T
  savedValue: T
  save: (value: T) => Promise<void>
  isValid: (value: T) => boolean
  delay?: number
  enabled?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<ApiError | null>(null)
  const [error, setError] = useState<unknown>(null)
  const latest = useRef({ value, savedValue, save, isValid })
  useEffect(() => {
    latest.current = { value, savedValue, save, isValid }
  })
  const inFlight = useRef<Promise<boolean> | null>(null)

  const dirty = !isDeepEqual(value, savedValue)
  const valid = isValid(value)

  const flush = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) await inFlight.current
    const {
      value: current,
      savedValue: saved,
      save: run,
      isValid: check,
    } = latest.current
    if (isDeepEqual(current, saved)) return true
    if (!check(current)) return false
    const attempt = (async () => {
      setSaving(true)
      setError(null)
      try {
        await run(current)
        return true
      } catch (err) {
        if (err instanceof ApiError && err.isConflict) setConflict(err)
        else setError(err)
        return false
      } finally {
        setSaving(false)
      }
    })()
    inFlight.current = attempt
    try {
      return await attempt
    } finally {
      inFlight.current = null
    }
  }, [])

  // Editing again after a failed save retries (the error clears).
  const lastValue = useRef(value)
  useEffect(() => {
    if (isDeepEqual(lastValue.current, value)) return
    lastValue.current = value
    setError(null)
  }, [value])

  useEffect(() => {
    if (!enabled || !dirty || !valid || conflict || error || saving) return
    const id = setTimeout(() => void flush(), delay)
    return () => clearTimeout(id)
  }, [value, enabled, dirty, valid, conflict, error, saving, delay, flush])

  const state: SaveState = saving
    ? "saving"
    : conflict
      ? "conflict"
      : error
        ? "error"
        : !dirty
          ? "saved"
          : !valid
            ? "invalid"
            : "unsaved"

  return {
    state,
    dirty,
    conflict,
    error,
    flush,
    resolveConflict: () => setConflict(null),
    clearError: () => setError(null),
  }
}
```

`components/admin/editor/save-state.tsx`:

```tsx
"use client"

import {
  AlertTriangle,
  Check,
  CircleDashed,
  CloudOff,
  GitMerge,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SaveState } from "@/hooks/use-autosave"
import { cn } from "@/lib/utils"

const LABELS: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  invalid: "Fix errors to save",
  conflict: "Conflict",
  error: "Not saved",
}

const ICONS = {
  saved: Check,
  saving: Loader2,
  unsaved: CircleDashed,
  invalid: AlertTriangle,
  conflict: GitMerge,
  error: CloudOff,
} satisfies Record<SaveState, unknown>

/** Live save status next to the editor title (announced politely). */
export function SaveStateIndicator({
  state,
  onRetry,
}: {
  state: SaveState
  onRetry?: () => void
}) {
  const Icon = ICONS[state]
  return (
    <div className="flex items-center gap-2">
      <p
        role="status"
        aria-live="polite"
        aria-label={`Save status: ${LABELS[state]}`}
        data-save-state={state}
        className={cn(
          "flex items-center gap-1.5 text-sm",
          state === "saved" && "text-muted-foreground",
          (state === "invalid" || state === "conflict" || state === "error") &&
            "font-medium text-destructive"
        )}
      >
        <Icon
          aria-hidden
          className={cn("size-4", state === "saving" && "animate-spin")}
        />
        {LABELS[state]}
      </p>
      {state === "error" && onRetry ? (
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}
```

`components/admin/editor/conflict-dialog.tsx`:

```tsx
"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"

/**
 * Shown when a save gets 409 (spec §8.2): someone else saved first. The
 * user keeps theirs (overwrite), takes theirs (reload) or copies their own
 * text to the clipboard before reloading.
 */
export function ConflictDialog({
  open,
  updatedBy,
  updatedAt,
  onReload,
  onOverwrite,
  onCopyMine,
}: {
  open: boolean
  updatedBy: string | null
  updatedAt: string | null
  onReload: () => void
  onOverwrite: () => void
  onCopyMine: () => void
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Someone else changed this</AlertDialogTitle>
          <AlertDialogDescription>
            {updatedBy ?? "Another editor"} saved a newer version
            {updatedAt ? ` (${formatDateTime(updatedAt)})` : ""} while you were
            editing. Your latest changes are not saved yet.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-wrap">
          <Button type="button" variant="outline" onClick={onCopyMine}>
            Copy mine, then reload
          </Button>
          <Button type="button" variant="outline" onClick={onReload}>
            Reload their version
          </Button>
          <Button type="button" variant="destructive" onClick={onOverwrite}>
            Overwrite with mine
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

`components/admin/editor/unsaved-guard.tsx`:

```tsx
"use client"

import { useEffect } from "react"

export const UNSAVED_MESSAGE =
  "You have changes that are not saved yet. Leave this page anyway?"

/**
 * Warns before leaving with unsaved changes (spec §8.2): the browser's
 * beforeunload prompt for reloads/closing, and a confirm() for in-app
 * links (App Router has no navigation-blocking API).
 */
export function UnsavedGuard({ when }: { when: boolean }) {
  useEffect(() => {
    if (!when) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return
      const anchor = (event.target as Element | null)?.closest?.("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== "_self") return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.hash) return
      if (!window.confirm(UNSAVED_MESSAGE)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [when])
  return null
}
```

`components/admin/editor/publish-dialog.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  type EditorMeta,
  humanize,
  metaFor,
} from "@/components/admin/schema-form/editor-meta"
import { diffValues } from "@/lib/json"

/** "hero.stats.1.label" → "Hero › Stats › 2 › Label" using editor labels. */
export function pathLabel(meta: EditorMeta, path: string): string {
  if (!path) return "Everything"
  const parts = path.split(".")
  return parts
    .map((part, i) => {
      if (/^\d+$/.test(part)) return String(Number(part) + 1)
      const prefix = parts.slice(0, i + 1).join(".")
      return metaFor(meta, prefix).label ?? humanize(part)
    })
    .join(" › ")
}

/** Short readable form of a changed value. */
export function previewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)"
  if (typeof value === "string")
    return value.length > 140 ? `${value.slice(0, 140)}…` : value
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (typeof value === "object" && value && "mediaId" in value)
    return "Image changed"
  if (
    typeof value === "object" &&
    value &&
    (value as { type?: string }).type === "doc"
  )
    return "Formatted text changed"
  if (Array.isArray(value)) return `${value.length} items`
  return "Changed"
}

/** Confirms a publish and lists what the site will change (draft vs published). */
export function PublishDialog({
  open,
  onOpenChange,
  meta,
  published,
  draft,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: EditorMeta
  published: unknown
  draft: unknown
  pending: boolean
  onConfirm: () => void
}) {
  const changes = published === null ? [] : diffValues(published, draft)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publish changes?</DialogTitle>
          <DialogDescription>
            {published === null
              ? "This is the first publish: everything becomes visible on the site."
              : changes.length === 0
                ? "Nothing changed since the last publish. Publishing again is harmless."
                : `${changes.length} ${changes.length === 1 ? "change goes" : "changes go"} live on the site right away.`}
          </DialogDescription>
        </DialogHeader>
        {changes.length > 0 ? (
          <ul
            aria-label="Changes"
            className="max-h-80 divide-y overflow-y-auto rounded-lg border text-sm"
          >
            {changes.map((change) => (
              <li key={change.path} className="flex flex-col gap-1 p-3">
                <span className="font-medium">
                  {pathLabel(meta, change.path)}
                </span>
                <span className="text-muted-foreground line-through decoration-muted-foreground/60">
                  {previewValue(change.before)}
                </span>
                <span>{previewValue(change.after)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {pending ? <Spinner /> : null}
            Publish now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

`components/admin/editor/revision-drawer.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { RevisionEntity, RevisionSummary } from "@/lib/schemas/api/content"

/** Published versions of a record, newest first, each restorable into the draft. */
export function RevisionDrawer({
  open,
  onOpenChange,
  entity,
  entityId,
  canRestore,
  onRestore,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: RevisionEntity
  entityId: string
  canRestore: boolean
  onRestore: (revision: RevisionSummary) => Promise<void>
}) {
  const [confirm, setConfirm] = useState<RevisionSummary | null>(null)
  const [pending, setPending] = useState(false)
  const revisions = useQuery({
    queryKey: ["revisions", entity, entityId],
    queryFn: () =>
      unwrap(
        api.revisions[":entity"][":id"].$get({
          param: { entity, id: entityId },
        })
      ),
    enabled: open,
  })
  const items = revisions.data?.items ?? []
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>History</SheetTitle>
            <SheetDescription>
              Every publish is kept. Restoring loads that version into the
              draft; publish it to make it live.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {revisions.isPending ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : revisions.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(revisions.error)}
              </p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <History aria-hidden className="size-6" />
                Nothing published from the admin yet.
              </div>
            ) : (
              <ol
                aria-label="Published versions"
                className="flex flex-col gap-2"
              >
                {items.map((revision, index) => (
                  <li
                    key={revision.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        Version {revision.version}
                        {index === 0 ? " · live" : ""}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatDateTime(revision.createdAt)}
                        {revision.actor ? ` · ${revision.actor.name}` : ""}
                      </span>
                    </div>
                    {canRestore ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Restore version ${revision.version}`}
                        onClick={() => setConfirm(revision)}
                      >
                        Restore
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore version {confirm?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The draft is replaced with this version. The site does not change
              until you publish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (!confirm) return
                setPending(true)
                try {
                  await onRestore(confirm)
                  setConfirm(null)
                  onOpenChange(false)
                } finally {
                  setPending(false)
                }
              }}
            >
              Restore into draft
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

`components/admin/editor/editor-layout.tsx`:

```tsx
"use client"

import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"

/** Status badge text for a versioned record. */
export function statusLabel(record: { published: unknown; dirty: boolean }): {
  text: string
  variant: "default" | "secondary" | "outline"
} {
  if (record.published === null)
    return { text: "Not published", variant: "outline" }
  if (record.dirty) return { text: "Unpublished changes", variant: "secondary" }
  return { text: "Published", variant: "default" }
}

/**
 * Editor frame: back link, title + status, save state and actions in a
 * sticky bar under the topbar; the form below in a readable column.
 */
export function EditorLayout({
  backHref,
  backLabel,
  title,
  status,
  saveState,
  actions,
  aside,
  children,
}: {
  backHref: string
  backLabel: string
  title: string
  status: { text: string; variant: "default" | "secondary" | "outline" }
  saveState: ReactNode
  actions: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-14 z-20 -mx-4 -mt-6 flex flex-col gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8">
        <Link
          href={backHref}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {title}
            </h1>
            <Badge variant={status.variant}>{status.text}</Badge>
            {saveState}
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">{children}</div>
        {aside ? <aside className="flex flex-col gap-4">{aside}</aside> : null}
      </div>
    </div>
  )
}
```

`components/admin/editor/versioned-editor.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, History, Send } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { Button, buttonClassName } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAutosave } from "@/hooks/use-autosave"
import { ApiError, errorMessage } from "@/lib/api-client"
import type { RevisionEntity, VersionedDto } from "@/lib/schemas/api/content"

import { ConflictDialog } from "./conflict-dialog"
import { EditorLayout, statusLabel } from "./editor-layout"
import { PublishDialog } from "./publish-dialog"
import { RevisionDrawer } from "./revision-drawer"
import { SaveStateIndicator } from "./save-state"
import { UnsavedGuard } from "./unsaved-guard"

/** Zod issues → `{ "hero.heading": ["Required"] }` (client-side, before save/publish). */
export function issuesToFieldErrors(
  error: z.ZodError
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_root"
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

export type VersionedEditorProps<Dto extends VersionedDto<unknown>> = {
  title: string
  backHref: string
  backLabel: string
  queryKey: readonly unknown[]
  load: () => Promise<Dto>
  saveDraft: (draft: unknown, version: number) => Promise<Dto>
  publish: (version: number) => Promise<Dto>
  restore: (revisionId: string, version: number) => Promise<Dto>
  schema: z.ZodObject
  meta: EditorMeta
  revisions: { entity: RevisionEntity; id: string }
  previewHref?: string
  publicHref?: string
  canEdit: boolean
  canPublish: boolean
  /** Extra header actions (e.g. delete a service). */
  actions?: ReactNode
  /** Side panel (e.g. a service's slug). */
  aside?: ReactNode
}

/**
 * Draft editor for any versioned record (spec §8.2): autosave (1.5 s),
 * ⌘S, save-state, unsaved guard, publish with diff, history + restore,
 * conflict dialog on 409, optimistic cache with rollback.
 */
export function VersionedEditor<Dto extends VersionedDto<unknown>>(
  props: VersionedEditorProps<Dto>
) {
  const query = useQuery({
    queryKey: props.queryKey,
    queryFn: props.load,
    staleTime: 0,
  })
  if (query.isPending)
    return (
      <div
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Loading editor"
      >
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  if (query.isError)
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border p-6"
      >
        <p className="font-medium">This editor could not be loaded.</p>
        <p className="text-sm text-muted-foreground">
          {errorMessage(query.error)}
        </p>
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )
  return <LoadedEditor {...props} initial={query.data} />
}

function LoadedEditor<Dto extends VersionedDto<unknown>>({
  initial,
  ...props
}: VersionedEditorProps<Dto> & { initial: Dto }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<unknown>(initial.draft)
  const [base, setBase] = useState({
    version: initial.version,
    saved: initial.draft,
  })
  const [record, setRecord] = useState<Dto>(initial)
  const [resetKey, setResetKey] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >()
  const [publishOpen, setPublishOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // The version to send next. Updated synchronously (a publish right after
  // a save must use the version that save returned).
  const baseRef = useRef(base)

  const accept = (dto: Dto, savedDraft: unknown = dto.draft) => {
    const next = { version: dto.version, saved: savedDraft }
    baseRef.current = next
    setBase(next)
    setRecord(dto)
    queryClient.setQueryData(props.queryKey, dto)
  }
  const replaceDraft = (dto: Dto) => {
    accept(dto)
    setDraft(dto.draft)
    setFieldErrors(undefined)
    setResetKey((k) => k + 1)
  }

  const save = useMutation({
    mutationFn: (value: unknown) =>
      props.saveDraft(value, baseRef.current.version),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: props.queryKey })
      const previous = queryClient.getQueryData<Dto>(props.queryKey)
      if (previous)
        queryClient.setQueryData(props.queryKey, { ...previous, draft: value })
      return { previous }
    },
    onError: (error, _value, context) => {
      if (context?.previous)
        queryClient.setQueryData(props.queryKey, context.previous)
      if (error instanceof ApiError && error.status === 422)
        setFieldErrors(error.fieldErrors)
    },
    onSuccess: (dto, value) => {
      accept(dto, value)
      setFieldErrors(undefined)
    },
  })

  const autosave = useAutosave({
    value: draft,
    savedValue: base.saved,
    save: async (value) => {
      await save.mutateAsync(value)
    },
    isValid: (value) => props.schema.safeParse(value).success,
    enabled: props.canEdit,
  })

  const showAllErrors = () => {
    const result = props.schema.safeParse(draft)
    if (result.success) return false
    const errors = issuesToFieldErrors(result.error)
    setFieldErrors(errors)
    toast.error(`Fix ${Object.keys(errors).length} field(s) first`, {
      description: "The fields with problems are marked in red.",
    })
    return true
  }

  // ⌘S / Ctrl+S saves now.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "s" || !(event.metaKey || event.ctrlKey))
        return
      event.preventDefault()
      if (!props.canEdit || showAllErrors()) return
      void autosave.flush()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  const publish = useMutation({
    mutationFn: async () => {
      if (!(await autosave.flush()))
        throw new Error("Save your changes before publishing.")
      return props.publish(baseRef.current.version)
    },
    onSuccess: (dto) => {
      accept(dto)
      setPublishOpen(false)
      void queryClient.invalidateQueries({
        queryKey: ["revisions", props.revisions.entity, props.revisions.id],
      })
      toast.success("Published", {
        description: "The site shows the new version now.",
        action: props.publicHref
          ? {
              label: "View",
              onClick: () =>
                window.open(props.publicHref, "_blank", "noopener"),
            }
          : undefined,
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isConflict) return
      toast.error("Not published", { description: errorMessage(error) })
    },
  })

  const conflict = autosave.conflict
  const current = (conflict?.current ?? null) as Dto | null

  return (
    <>
      <UnsavedGuard when={autosave.state !== "saved"} />
      <EditorLayout
        backHref={props.backHref}
        backLabel={props.backLabel}
        title={props.title}
        status={statusLabel({
          published: record.published,
          dirty: autosave.dirty || record.dirty,
        })}
        saveState={
          props.canEdit ? (
            <SaveStateIndicator
              state={autosave.state}
              onRetry={() => void autosave.flush()}
            />
          ) : null
        }
        actions={
          <>
            {props.actions}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
            >
              <History aria-hidden />
              History
            </Button>
            {props.previewHref ? (
              <a
                href={props.previewHref}
                target="_blank"
                rel="noreferrer"
                className={buttonClassName({ variant: "outline", size: "sm" })}
              >
                <Eye aria-hidden />
                Preview
              </a>
            ) : null}
            {props.canPublish ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (showAllErrors()) return
                  setPublishOpen(true)
                }}
              >
                <Send aria-hidden />
                Publish
              </Button>
            ) : null}
          </>
        }
        aside={props.aside}
      >
        <SchemaForm
          schema={props.schema}
          meta={props.meta}
          value={draft as never}
          onChange={setDraft}
          errors={fieldErrors}
          resetKey={resetKey}
          disabled={!props.canEdit}
        />
      </EditorLayout>
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        meta={props.meta}
        published={record.published}
        draft={draft}
        pending={publish.isPending}
        onConfirm={() => publish.mutate()}
      />
      <RevisionDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entity={props.revisions.entity}
        entityId={props.revisions.id}
        canRestore={props.canEdit}
        onRestore={async (revision) => {
          try {
            const dto = await props.restore(
              revision.id,
              baseRef.current.version
            )
            replaceDraft(dto)
            toast.success(`Version ${revision.version} restored into the draft`)
          } catch (error) {
            toast.error("Not restored", { description: errorMessage(error) })
            throw error
          }
        }}
      />
      <ConflictDialog
        open={conflict !== null}
        updatedBy={current?.updatedBy?.name ?? null}
        updatedAt={current?.updatedAt ?? null}
        onReload={() => {
          if (current) replaceDraft(current)
          autosave.resolveConflict()
        }}
        onOverwrite={() => {
          if (current) {
            baseRef.current = { ...baseRef.current, version: current.version }
            setBase(baseRef.current)
          }
          autosave.resolveConflict()
          void autosave.flush()
        }}
        onCopyMine={async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(draft, null, 2))
            toast.success("Your version is on the clipboard")
          } catch {
            toast.error("Could not copy to the clipboard")
          }
          if (current) replaceDraft(current)
          autosave.resolveConflict()
        }}
      />
    </>
  )
}
```

- [ ] **Step 4: Pages screens**

`components/admin/pages/pages-list.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { statusLabel } from "@/components/admin/editor/editor-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"

/** The eight fixed pages: status and last change (table ≥ 640 px, cards below). */
export function PagesList() {
  const pages = useQuery({
    queryKey: ["pages"],
    queryFn: () => unwrap(api.pages.$get()),
  })
  if (pages.isPending)
    return (
      <div
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Loading pages"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  if (pages.isError)
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border p-6"
      >
        <p className="text-sm">{errorMessage(pages.error)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => pages.refetch()}
        >
          Try again
        </Button>
      </div>
    )
  const items = pages.data.items
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Pages</caption>
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Page
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Last change
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((page) => {
              const status = statusLabel({
                published: page.publishedAt ? true : null,
                dirty: page.dirty,
              })
              return (
                <tr key={page.key} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pages/${page.key}`}
                      className="font-medium hover:underline"
                    >
                      {page.label}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {page.path}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={status.variant}>{status.text}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(page.updatedAt)}
                    {page.updatedBy ? ` · ${page.updatedBy.name}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/pages/${page.key}`}
                      aria-label={`Edit ${page.label}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul aria-label="Pages" className="flex flex-col gap-2 sm:hidden">
        {items.map((page) => {
          const status = statusLabel({
            published: page.publishedAt ? true : null,
            dirty: page.dirty,
          })
          return (
            <li key={page.key}>
              <Link
                href={`/admin/pages/${page.key}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">{page.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {page.path} · {formatDateTime(page.updatedAt)}
                  </span>
                </div>
                <Badge variant={status.variant}>{status.text}</Badge>
                <ChevronRight
                  aria-hidden
                  className="size-4 text-muted-foreground"
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
```

`components/admin/pages/page-editor.tsx`:

```tsx
"use client"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { usePermission } from "@/hooks/use-permission"
import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { api, unwrap } from "@/lib/api-client"
import { previewHref } from "@/lib/schemas/api/preview"
import { templateEditorMeta } from "@/templates/editor-meta"
import {
  PAGE_PATHS,
  PAGES,
  type PageKey,
  templates,
} from "@/templates/registry"

/** Editor for one fixed page (master 4.4). */
export function PageEditor({ pageKey }: { pageKey: PageKey }) {
  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const template = PAGES[pageKey]
  const param = { key: pageKey }
  return (
    <VersionedEditor
      title={PAGE_LABELS[pageKey]}
      backHref="/admin/pages"
      backLabel="All pages"
      queryKey={["pages", pageKey]}
      load={() => unwrap(api.pages[":key"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api.pages[":key"].draft.$put({ param, json: { draft, version } })
        )
      }
      publish={(version) =>
        unwrap(api.pages[":key"].publish.$post({ param, json: { version } }))
      }
      restore={(revisionId, version) =>
        unwrap(
          api.pages[":key"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={templates[template].schema}
      meta={templateEditorMeta[template]}
      revisions={{ entity: "page", id: pageKey }}
      previewHref={previewHref("page", pageKey)}
      publicHref={PAGE_PATHS[pageKey]}
      canEdit={canEdit}
      canPublish={canPublish}
    />
  )
}
```

`app/(admin)/admin/(panel)/pages/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { PagesList } from "@/components/admin/pages/pages-list"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Pages" }

export default function PagesPage() {
  return (
    <Suspense fallback={null}>
      <Pages />
    </Suspense>
  )
}

async function Pages() {
  await requirePermission({ page: ["read"] })
  return (
    <>
      <PageHeader
        title="Pages"
        description="The eight fixed pages of the site. Layout and section order are part of the design; every text, image and link is editable."
      />
      <PagesList />
    </>
  )
}
```

`app/(admin)/admin/(panel)/pages/[key]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageEditor } from "@/components/admin/pages/page-editor"
import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { requirePermission } from "@/server/auth/session"
import { isPageKey } from "@/templates/registry"

export async function generateMetadata({
  params,
}: PageProps<"/admin/pages/[key]">): Promise<Metadata> {
  const { key } = await params
  return { title: isPageKey(key) ? `Edit ${PAGE_LABELS[key]}` : "Page" }
}

export default function EditPagePage({
  params,
}: PageProps<"/admin/pages/[key]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({
  params,
}: Pick<PageProps<"/admin/pages/[key]">, "params">) {
  const { key } = await params
  if (!isPageKey(key)) notFound()
  await requirePermission({ page: ["read"] })
  return <PageEditor pageKey={key} />
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec next typegen && pnpm exec vitest run --project dom tests/dom/use-autosave.test.tsx tests/dom/versioned-editor.test.tsx`
Expected: PASS (4 + 4 tests).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0; `/admin/pages` and `/admin/pages/[key]` are `◐`.

Run (port 3100 free, no other Playwright/build): `pnpm test:e2e`
Expected: all specs pass, including the 4 in `tests/e2e/page-editor.spec.ts`: autosave → "Saved", the draft visible only in preview (with the bar) and gone after "Exit preview", publish → anonymous `/` shows "Watching Over Laois" in `[data-hero-title]`; a copied `__prerender_bypass` + `sp.preview` without a session shows published content; ⌘S sends the PUT within 1 s; the unsaved prompt; the conflict dialog → "Reload their version".

Run: `pnpm test:visual`
Expected: `43 passed, 1 skipped`.

- [ ] **Step 6: Commit**

```bash
git add hooks/use-autosave.ts components/admin/editor components/admin/pages "app/(admin)/admin/(panel)/pages" tests/dom/use-autosave.test.tsx tests/dom/versioned-editor.test.tsx tests/e2e/page-editor.spec.ts
git commit -m "feat: add page editor with autosave, publish, history and conflicts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Settings and shared sections editors (master Task 4.5)

**Files:**
- Create: `lib/admin/settings-keys.ts`, `lib/schemas/api/settings.ts`, `server/modules/settings/{service,routes}.ts`, `components/admin/settings/{settings-meta.ts,settings-overview.tsx,settings-editor.tsx}`, `app/(admin)/admin/(panel)/settings/page.tsx`, `app/(admin)/admin/(panel)/settings/[key]/page.tsx`
- Modify: `server/modules/settings/repo.ts` (edit rows + optimistic update), `server/api/app.ts` (mount `/settings`)
- Test: `tests/integration/api/settings.test.ts`, `tests/dom/settings-editor.test.tsx`

**Interfaces:**
- Consumes: Phase 3 `settingsSchemas`, table `settings`, `tag.settings(key)`; Task 3 versioning (`saveDraft`, `publish`, `restoreRevision`, `versionedDto`); Task 6 `previewHref`; Task 7 `VersionedEditor`, `statusLabel`.
- Produces:

```ts
// lib/admin/settings-keys.ts
export const EDITABLE_SETTINGS_KEYS = ["site","contact","navigation","footer","microcopy","sections.about","sections.contact","sections.enquireBanner","sections.clients","sections.whyChooseUs","leads"] as const
export const SETTINGS_GROUPS = ["General","Shared sections","Leads"] as const
export const SETTINGS_ENTRIES: Record<EditableSettingsKey, { label; description; group; read: PermissionRequest; update: PermissionRequest }>
export function isEditableSettingsKey(value: string): value is EditableSettingsKey
// lib/schemas/api/settings.ts
export const settingsKeyParam; export type SettingsDto = VersionedDto<unknown> & { key; label; description; group; canEdit }; export type SettingsListItem
// HTTP (settings:read / settings:update at the route; per-key group permission in the service; other keys → 404)
GET  /settings              → { items: SettingsListItem[] }  (readable keys, EDITABLE_SETTINGS_KEYS order)
GET  /settings/:key         → SettingsDto
PUT  /settings/:key/draft   { draft, version } → SettingsDto
POST /settings/:key/publish { version } → SettingsDto   (invalidate settings:<key>)
POST /settings/:key/restore { revisionId, version } → SettingsDto
```

Key groups (acceptance "permissions enforced per key group"): content keys need `settings:read`/`settings:update` (editor allowed, spec §6.1); `leads` needs `settings:update` + `lead:update` (owner/admin only; editors see it read-only); `consent`, `tracking`, `customCode` (Phase 8 Marketing), `seo.defaults` (Phase 8 SEO) and `integrations.*` (Phase 7) answer 404 here, even for the owner.

- [ ] **Step 1: Write the failing tests**

`tests/integration/api/settings.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { SettingsDto, SettingsListItem } from "@/lib/schemas/api/settings"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let admin: string
let owner: string
let viewer: string
let marketer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  admin = (await signedInUser(["admin"])).cookie
  owner = (await signedInUser(["owner"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  revalidateTag.mockClear()
})

const get = async (cookie: string, key: string) => {
  const res = await adminRequest(`/settings/${key}`, { cookie })
  return {
    status: res.status,
    body: res.ok ? ((await res.json()) as SettingsDto) : null,
  }
}

describe("settings API (master 4.5)", () => {
  it("lists every content key with its group; editors cannot edit leads", async () => {
    const res = await adminRequest("/settings", { cookie: editor })
    const { items } = (await res.json()) as { items: SettingsListItem[] }
    expect(items.map((i) => i.key)).toEqual([
      "site",
      "contact",
      "navigation",
      "footer",
      "microcopy",
      "sections.about",
      "sections.contact",
      "sections.enquireBanner",
      "sections.clients",
      "sections.whyChooseUs",
      "leads",
    ])
    expect(items.find((i) => i.key === "contact")).toMatchObject({
      group: "General",
      canEdit: true,
      version: 1,
      dirty: false,
    })
    expect(items.find((i) => i.key === "leads")?.canEdit).toBe(false)
    expect(items[0]).not.toHaveProperty("draft")
  })

  it("edits a content key with draft → publish and invalidates settings:<key>", async () => {
    const { body } = await get(editor, "contact")
    const draft = {
      ...(body!.draft as Record<string, string>),
      hours: "Monday–Saturday, 8am to 8pm",
    }
    const saved = await adminRequest("/settings/contact/draft", {
      cookie: editor,
      method: "PUT",
      json: { draft, version: 1 },
    })
    expect(saved.status).toBe(200)
    expect((await saved.json()) as SettingsDto).toMatchObject({
      version: 2,
      dirty: true,
    })
    expect(revalidateTag).not.toHaveBeenCalled()

    const published = await adminRequest("/settings/contact/publish", {
      cookie: editor,
      method: "POST",
      json: { version: 2 },
    })
    expect(published.status).toBe(200)
    const dto = (await published.json()) as SettingsDto
    expect(dto).toMatchObject({ version: 3, dirty: false, status: "published" })
    expect((dto.published as { hours: string }).hours).toBe(
      "Monday–Saturday, 8am to 8pm"
    )
    expect(revalidateTag).toHaveBeenCalledWith("settings:contact", {
      expire: 0,
    })

    const history = await adminRequest("/revisions/settings/contact", {
      cookie: viewer,
    })
    expect(
      ((await history.json()) as { items: { version: number }[] }).items.map(
        (r) => r.version
      )
    ).toEqual([3])
  })

  it("validates with the key's schema and rejects stale versions", async () => {
    const { body } = await get(editor, "contact")
    const bad = await adminRequest("/settings/contact/draft", {
      cookie: editor,
      method: "PUT",
      json: {
        draft: { ...(body!.draft as object), email: "not-an-email" },
        version: 1,
      },
    })
    expect(bad.status).toBe(422)
    expect(
      Object.keys(
        ((await bad.json()) as { error: { fieldErrors: object } }).error
          .fieldErrors
      )
    ).toEqual(["email"])

    await adminRequest("/settings/contact/draft", {
      cookie: editor,
      method: "PUT",
      json: { draft: body!.draft, version: 1 },
    })
    const stale = await adminRequest("/settings/contact/draft", {
      cookie: admin,
      method: "PUT",
      json: { draft: body!.draft, version: 1 },
    })
    expect(stale.status).toBe(409)
    expect(
      ((await stale.json()) as { error: { current: SettingsDto } }).error
        .current.version
    ).toBe(2)
  })

  it("enforces permissions per key group", async () => {
    const leads = await get(editor, "leads")
    expect(leads.status).toBe(200)
    const put = (cookie: string) =>
      adminRequest("/settings/leads/draft", {
        cookie,
        method: "PUT",
        json: { draft: leads.body!.draft, version: leads.body!.version },
      })
    expect((await put(editor)).status).toBe(403)
    expect((await put(admin)).status).toBe(200)
    expect(
      (
        await adminRequest("/settings/site/draft", {
          cookie: viewer,
          method: "PUT",
          json: { draft: {}, version: 1 },
        })
      ).status
    ).toBe(403)
    expect((await adminRequest("/settings", { cookie: marketer })).status).toBe(
      403
    )
  })

  it.each([
    "consent",
    "tracking",
    "customCode",
    "seo.defaults",
    "integrations.smtp",
    "nope",
  ])("rejects %s here (edited in another module)", async (key) => {
    expect((await get(owner, key)).status).toBe(404)
    const res = await adminRequest(`/settings/${key}/draft`, {
      cookie: owner,
      method: "PUT",
      json: { draft: {}, version: 1 },
    })
    expect(res.status).toBe(404)
  })
})
```

`tests/dom/settings-editor.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/settings/leads",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { SettingsEditor } from "@/components/admin/settings/settings-editor"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"

const leads = {
  key: "leads",
  label: "Enquiries",
  description: "",
  group: "Leads",
  canEdit: false,
  draft: {
    recipients: ["info@example.ie"],
    retentionMonths: 24,
    acknowledgement: true,
  },
  published: {
    recipients: ["info@example.ie"],
    retentionMonths: 24,
    acknowledgement: true,
  },
  version: 1,
  status: "published",
  dirty: false,
  publishedAt: null,
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: null,
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(leads), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
  )
})

function renderAs(roles: Role[]) {
  render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u",
          name: "U",
          email: "u@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <SettingsEditor settingsKey="leads" />
    </AdminShell>
  )
}

describe("settings editor (master 4.5)", () => {
  it("is read-only for editors on the leads key (no publish, inputs disabled)", async () => {
    renderAs(["editor"])
    const field = await screen.findByRole("spinbutton", {
      name: "Keep enquiries for (months)",
    })
    expect(field).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull()
    expect(screen.queryByRole("status", { name: /^Save status/ })).toBeNull()
  })

  it("is editable for admins", async () => {
    renderAs(["admin"])
    const field = await screen.findByRole("spinbutton", {
      name: "Keep enquiries for (months)",
    })
    expect(field).toBeEnabled()
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument()
    expect(
      within(
        screen.getByRole("group", { name: "Notify these addresses" })
      ).getByRole("button", { name: "Add recipient" })
    ).toBeEnabled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration tests/integration/api/settings.test.ts`
Expected: FAIL — `/api/v1/admin/settings` answers 404 `Route not found` (expected 200).

Run: `pnpm exec vitest run --project dom tests/dom/settings-editor.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/settings/settings-editor"`.

- [ ] **Step 3: Settings module**

`lib/admin/settings-keys.ts`:

```ts
import type { PermissionRequest } from "@/lib/auth/permissions"
import type { SettingsKey } from "@/lib/schemas/settings"

/**
 * Settings edited under Settings (master 4.5). consent/tracking (Marketing)
 * and customCode (owner) live in the Phase 8 module; seo.defaults in the
 * Phase 8 SEO screen; integrations.* in Phase 7.
 */
export const EDITABLE_SETTINGS_KEYS = [
  "site",
  "contact",
  "navigation",
  "footer",
  "microcopy",
  "sections.about",
  "sections.contact",
  "sections.enquireBanner",
  "sections.clients",
  "sections.whyChooseUs",
  "leads",
] as const satisfies readonly SettingsKey[]
export type EditableSettingsKey = (typeof EDITABLE_SETTINGS_KEYS)[number]

export const SETTINGS_GROUPS = ["General", "Shared sections", "Leads"] as const
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number]

/** Content keys: editors may change them (spec §6.1). */
const CONTENT_UPDATE: PermissionRequest = { settings: ["update"] }

export const SETTINGS_ENTRIES: Record<
  EditableSettingsKey,
  {
    label: string
    description: string
    group: SettingsGroup
    read: PermissionRequest
    update: PermissionRequest
  }
> = {
  site: {
    label: "Site",
    description:
      "Name, logos, production URL, time zone and the copyright line.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  contact: {
    label: "Contact details",
    description:
      "Phone numbers, emails, office hours and address used across the site.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  navigation: {
    label: "Navigation",
    description:
      "Header links (also the footer quick links) and the header button.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  footer: {
    label: "Footer",
    description: "Footer text, headings and the privacy and terms links.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  microcopy: {
    label: "Microcopy",
    description: "Small labels, button text and screen-reader labels.",
    group: "General",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.about": {
    label: "About section",
    description: "Shown on the home page and the About page.",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.contact": {
    label: "Contact section",
    description:
      "Contact details, form labels and map on the home and Contact pages.",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.enquireBanner": {
    label: "Enquire banner",
    description: "The “Enquire about our services” banner on inner pages.",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.clients": {
    label: "Clients strip",
    description: "Heading above the client logos (logos are under Clients).",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  "sections.whyChooseUs": {
    label: "Why choose us",
    description: "Heading, text and features of the “Why choose us” section.",
    group: "Shared sections",
    read: { settings: ["read"] },
    update: CONTENT_UPDATE,
  },
  leads: {
    label: "Enquiries",
    description:
      "Who is notified about new enquiries and how long they are kept.",
    group: "Leads",
    read: { settings: ["read"] },
    // Operational, not content: editors cannot change it (spec §6.1).
    update: { settings: ["update"], lead: ["update"] },
  },
}

export function isEditableSettingsKey(
  value: string
): value is EditableSettingsKey {
  return Object.hasOwn(SETTINGS_ENTRIES, value)
}
```

`lib/schemas/api/settings.ts`:

```ts
import { z } from "zod"

import type { VersionedDto } from "./content"
import type {
  EditableSettingsKey,
  SettingsGroup,
} from "@/lib/admin/settings-keys"

/** `/settings/:key` — any string; the service answers 404 for keys not edited here. */
export const settingsKeyParam = z.object({ key: z.string().min(1).max(64) })

export type SettingsDto = VersionedDto<unknown> & {
  key: EditableSettingsKey
  label: string
  description: string
  group: SettingsGroup
  canEdit: boolean
}

export type SettingsListItem = Omit<SettingsDto, "draft" | "published">
```

`server/modules/settings/repo.ts` (full file):

```ts
import "server-only"

import { and, eq, getTableColumns, inArray } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { settings, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

export async function findSettingsRow(db: DbOrTx, key: string) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  return row ?? null
}

const withEditor = { ...getTableColumns(settings), updatedByName: users.name }

/** A settings row plus the last editor's name (admin editor). */
export async function findSettingsForEdit(db: DbOrTx, key: string) {
  const [row] = await db
    .select(withEditor)
    .from(settings)
    .leftJoin(users, eq(users.id, settings.updatedBy))
    .where(eq(settings.key, key))
  return row ?? null
}

export type SettingsEditRow = NonNullable<
  Awaited<ReturnType<typeof findSettingsForEdit>>
>

export function listSettingsForEdit(db: DbOrTx, keys: readonly string[]) {
  return db
    .select(withEditor)
    .from(settings)
    .leftJoin(users, eq(users.id, settings.updatedBy))
    .where(inArray(settings.key, [...keys]))
}

/**
 * Optimistic-lock update. settings has no status/publishedAt columns
 * (spec §5.4): only draft, published and updatedBy are written.
 */
export async function updateSettingsIfVersion(
  db: DbOrTx,
  key: string,
  version: number,
  patch: VersionedPatch<unknown>
): Promise<SettingsEditRow | null> {
  const [updated] = await db
    .update(settings)
    .set({
      ...(patch.draft !== undefined ? { draft: patch.draft } : {}),
      ...(patch.published !== undefined ? { published: patch.published } : {}),
      updatedBy: patch.updatedBy,
      version: version + 1,
    })
    .where(and(eq(settings.key, key), eq(settings.version, version)))
    .returning({ key: settings.key })
  return updated ? findSettingsForEdit(db, key) : null
}
```

`server/modules/settings/service.ts`:

```ts
import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import {
  EDITABLE_SETTINGS_KEYS,
  type EditableSettingsKey,
  isEditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import type { SettingsDto, SettingsListItem } from "@/lib/schemas/api/settings"
import { settingsSchemas } from "@/lib/schemas/settings"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { tag } from "@/server/lib/cache-tags"
import { forbidden, notFound } from "@/server/lib/errors"
import {
  publish,
  restoreRevision,
  saveDraft,
  type VersionedRecord,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"

import {
  findSettingsForEdit,
  listSettingsForEdit,
  type SettingsEditRow,
  updateSettingsIfVersion,
} from "./repo"

type Row = SettingsEditRow & VersionedRecord<unknown>

/** settings rows lack status/publishedAt/scheduledAt (spec §5.4): derive them. */
function asVersioned(row: SettingsEditRow | null): Row | null {
  if (!row) return null
  return {
    ...row,
    status: row.published === null ? "draft" : "published",
    scheduledAt: null,
    publishedAt: null,
  }
}

const can = (actor: Actor, req: PermissionRequest) =>
  hasPermission(actor.roles, req)

/**
 * Keys edited elsewhere (consent/tracking/customCode → Marketing, Phase 8;
 * seo.defaults → SEO; integrations → Phase 7) are 404 here (master 4.5).
 */
function entryFor(actor: Actor, key: string, action: "read" | "update") {
  if (!isEditableSettingsKey(key)) throw notFound("Settings")
  const entry = SETTINGS_ENTRIES[key]
  if (!can(actor, entry[action])) throw forbidden()
  return { key, entry }
}

function toDto(actor: Actor, row: Row): SettingsDto {
  const key = row.key as EditableSettingsKey
  const entry = SETTINGS_ENTRIES[key]
  return {
    key,
    label: entry.label,
    description: entry.description,
    group: entry.group,
    canEdit: can(actor, entry.update),
    ...versionedDto<unknown>(row),
  }
}

const storeFor = (actor: Actor): VersionedStore<unknown, Row> => ({
  entityType: "settings",
  label: "Settings",
  schema: (row) => settingsSchemas[row.key as EditableSettingsKey],
  find: async (db, key) => asVersioned(await findSettingsForEdit(db, key)),
  update: async (db, key, version, patch) =>
    asVersioned(await updateSettingsIfVersion(db, key, version, patch)),
  tags: (row) => [tag.settings(row.key as EditableSettingsKey)],
  present: (row) => toDto(actor, row),
})

export async function listSettings(
  actor: Actor
): Promise<{ items: SettingsListItem[] }> {
  const readable = EDITABLE_SETTINGS_KEYS.filter((key) =>
    can(actor, SETTINGS_ENTRIES[key].read)
  )
  const rows = await listSettingsForEdit(getDb(), readable)
  const byKey = new Map(rows.map((row) => [row.key, row]))
  const items: SettingsListItem[] = []
  for (const key of readable) {
    const row = asVersioned(byKey.get(key) ?? null)
    if (!row) continue
    const dto: Partial<SettingsDto> = toDto(actor, row)
    delete dto.draft
    delete dto.published
    items.push(dto as SettingsListItem)
  }
  return { items }
}

export async function getSettingsEntry(
  actor: Actor,
  key: string
): Promise<SettingsDto> {
  entryFor(actor, key, "read")
  const row = asVersioned(await findSettingsForEdit(getDb(), key))
  if (!row) throw notFound("Settings")
  return toDto(actor, row)
}

export async function saveSettingsDraft(
  actor: Actor,
  key: string,
  input: { draft: unknown; version: number }
): Promise<SettingsDto> {
  entryFor(actor, key, "update")
  return toDto(
    actor,
    await saveDraft(getDb(), storeFor(actor), actor, key, input)
  )
}

export async function publishSettings(
  actor: Actor,
  key: string,
  input: { version: number }
): Promise<SettingsDto> {
  entryFor(actor, key, "update")
  return toDto(
    actor,
    await publish(getDb(), storeFor(actor), actor, key, input)
  )
}

export async function restoreSettings(
  actor: Actor,
  key: string,
  input: { revisionId: string; version: number }
): Promise<SettingsDto> {
  entryFor(actor, key, "update")
  return toDto(
    actor,
    await restoreRevision(getDb(), storeFor(actor), actor, key, input)
  )
}
```

`server/modules/settings/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import { settingsKeyParam } from "@/lib/schemas/api/settings"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// can() checks the settings resource; the service adds the per-key group
// permission (e.g. leads needs lead:update) and rejects keys edited elsewhere.
export const settingsRoutes = new Hono<AppEnv>()
  .get("/", can({ settings: ["read"] }), async (c) =>
    c.json(await service.listSettings(actorOf(c)), 200)
  )
  .get(
    "/:key",
    can({ settings: ["read"] }),
    zv("param", settingsKeyParam),
    async (c) =>
      c.json(
        await service.getSettingsEntry(actorOf(c), c.req.valid("param").key),
        200
      )
  )
  .put(
    "/:key/draft",
    can({ settings: ["update"] }),
    zv("param", settingsKeyParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveSettingsDraft(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/publish",
    can({ settings: ["update"] }),
    zv("param", settingsKeyParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishSettings(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/restore",
    can({ settings: ["update"] }),
    zv("param", settingsKeyParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreSettings(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
```

In `server/api/app.ts` add `import { settingsRoutes } from "@/server/modules/settings/routes"` and chain `.route("/settings", settingsRoutes)` after `.route("/preview", adminPreviewRoutes)`.

- [ ] **Step 4: Settings screens**

`components/admin/settings/settings-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import type { EditableSettingsKey } from "@/lib/admin/settings-keys"

const PLACEHOLDER_HELP =
  "Placeholders such as {phone24h} or {officeHref} are filled from Contact details."

/** Editor hints per settings key (labels default to the field name). */
export const settingsEditorMeta: Record<EditableSettingsKey, EditorMeta> = {
  site: {
    fields: {
      name: { label: "Site name" },
      legalName: { label: "Legal name" },
      logo: { label: "Logo" },
      logoAlt: { label: "Logo description (alt text)" },
      logoOnDark: { label: "Logo on dark backgrounds" },
      favicon: { label: "Browser tab icon" },
      productionUrl: {
        label: "Production URL",
        help: "The live address, e.g. https://www.securitypartnersltd.com. Decides whether this copy of the site counts as production.",
      },
      timezone: { label: "Time zone", help: "IANA name, e.g. Europe/Dublin." },
      locale: {
        label: "Language",
        help: "Language tag of the public site, e.g. en.",
      },
      copyright: {
        label: "Copyright line",
        help: "{year} is replaced with the current year.",
      },
    },
  },
  contact: {
    fields: {
      phone24h: { label: "24-hour number" },
      office: { label: "Office number" },
      operationsMobile: { label: "Operations mobile" },
      operationsExtension: { label: "Operations extension" },
      email: { label: "Main email" },
      operationsEmail: { label: "Operations email" },
      hours: { label: "Office hours" },
      addressLine1: { label: "Address line 1" },
      addressLine2: { label: "Address line 2" },
      mapsHref: { label: "Map link", help: "Opened by “Get directions”." },
    },
  },
  navigation: {
    fields: {
      headerLinks: {
        label: "Header links",
        itemName: "Link",
        itemLabel: "label",
        help: "Also listed as Quick links in the footer.",
      },
      headerCta: { label: "Header button" },
    },
  },
  footer: {
    fields: {
      tagline: { label: "Tagline" },
      contact: { label: "Contact column" },
      legal: { label: "Legal links" },
      "legal.privacy": { label: "Privacy link" },
      "legal.terms": { label: "Terms link" },
    },
  },
  microcopy: {
    fields: {
      header: { label: "Header" },
      aria: {
        label: "Screen-reader labels",
        help: "Not visible; read aloud by assistive technology.",
      },
      breadcrumb: { label: "Breadcrumbs" },
      serviceCard: { label: "Service cards" },
      service: { label: "Service pages", help: PLACEHOLDER_HELP },
      blog: { label: "Blog" },
      article: {
        label: "Articles",
        help: "{n} is the reading time in minutes.",
      },
      share: { label: "Share buttons" },
      "share.networks": {
        label: "Networks",
        itemName: "Network",
        itemLabel: "name",
      },
    },
  },
  "sections.about": {
    fields: {
      body: { label: "Text" },
      image: { label: "Image" },
      imageAlt: { label: "Image description (alt text)" },
      badge: { label: "Badge" },
      highlights: { label: "Highlights", itemName: "Highlight" },
    },
  },
  "sections.contact": {
    fields: {
      infoItems: {
        label: "Contact blocks",
        itemName: "Block",
        itemLabel: "title",
        help: PLACEHOLDER_HELP,
      },
      "infoItems[].lines": {
        label: "Lines",
        itemName: "Line",
        itemLabel: "text",
      },
      form: { label: "Contact form" },
      "form.mailtoSubject": { label: "Email subject" },
      map: { label: "Map" },
      "map.tiles": {
        label: "Map tile address",
        help: "{col} and {row} are filled in for each tile.",
      },
    },
  },
  "sections.enquireBanner": {
    fields: {
      image: { label: "Background image" },
      cta: { label: "Main button" },
      secondaryCta: { label: "Second button", help: PLACEHOLDER_HELP },
    },
  },
  "sections.clients": { fields: {} },
  "sections.whyChooseUs": {
    fields: {
      features: { label: "Features", itemName: "Feature", itemLabel: "title" },
      "features[].icon": { label: "Icon" },
    },
  },
  leads: {
    fields: {
      recipients: {
        label: "Notify these addresses",
        itemName: "Recipient",
        help: "Each new enquiry is emailed to every address.",
      },
      retentionMonths: {
        label: "Keep enquiries for (months)",
        help: "Older enquiries are deleted automatically.",
      },
      acknowledgement: {
        label: "Send an acknowledgement",
        help: "Email the person who sent the enquiry to confirm it arrived.",
      },
    },
  },
}
```

`components/admin/settings/settings-overview.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { statusLabel } from "@/components/admin/editor/editor-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SETTINGS_GROUPS } from "@/lib/admin/settings-keys"
import { api, errorMessage, unwrap } from "@/lib/api-client"

/** Settings cards grouped as in spec §8.1 (Integrations arrive in Phase 7). */
export function SettingsOverview() {
  const list = useQuery({
    queryKey: ["settings"],
    queryFn: () => unwrap(api.settings.$get()),
  })
  if (list.isPending)
    return (
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy="true"
        aria-label="Loading settings"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  if (list.isError)
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border p-6"
      >
        <p className="text-sm">{errorMessage(list.error)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => list.refetch()}
        >
          Try again
        </Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-8">
      {SETTINGS_GROUPS.map((group) => {
        const items = list.data.items.filter((item) => item.group === group)
        if (items.length === 0) return null
        return (
          <section
            key={group}
            aria-labelledby={`settings-${group}`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`settings-${group}`}
              className="text-sm font-bold tracking-wide text-muted-foreground uppercase"
            >
              {group}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const status = statusLabel({
                  published: item.status === "published" ? true : null,
                  dirty: item.dirty,
                })
                return (
                  <li key={item.key}>
                    <Link
                      href={`/admin/settings/${item.key}`}
                      className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{item.label}</span>
                        <ChevronRight
                          aria-hidden
                          className="size-4 text-muted-foreground"
                        />
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.description}
                      </span>
                      <span className="mt-auto flex gap-2 pt-1">
                        <Badge variant={status.variant}>{status.text}</Badge>
                        {!item.canEdit ? (
                          <Badge variant="outline">Read only</Badge>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
```

`components/admin/settings/settings-editor.tsx`:

```tsx
"use client"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import {
  SETTINGS_ENTRIES,
  type EditableSettingsKey,
} from "@/lib/admin/settings-keys"
import { api, unwrap } from "@/lib/api-client"
import { previewHref } from "@/lib/schemas/api/preview"
import { settingsSchemas } from "@/lib/schemas/settings"
import { useAdminSession } from "@/components/admin/session-provider"
import { hasPermission } from "@/lib/auth/permissions"

import { settingsEditorMeta } from "./settings-meta"

/** Draft/publish editor for one content settings key (master 4.5). */
export function SettingsEditor({
  settingsKey,
}: {
  settingsKey: EditableSettingsKey
}) {
  const { roles } = useAdminSession()
  const entry = SETTINGS_ENTRIES[settingsKey]
  const canEdit = hasPermission(roles, entry.update)
  const param = { key: settingsKey }
  return (
    <VersionedEditor
      title={entry.label}
      backHref="/admin/settings"
      backLabel="All settings"
      queryKey={["settings", settingsKey]}
      load={() => unwrap(api.settings[":key"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api.settings[":key"].draft.$put({ param, json: { draft, version } })
        )
      }
      publish={(version) =>
        unwrap(api.settings[":key"].publish.$post({ param, json: { version } }))
      }
      restore={(revisionId, version) =>
        unwrap(
          api.settings[":key"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={settingsSchemas[settingsKey]}
      meta={settingsEditorMeta[settingsKey]}
      revisions={{ entity: "settings", id: settingsKey }}
      previewHref={
        settingsKey === "leads"
          ? undefined
          : previewHref("settings", settingsKey)
      }
      publicHref={settingsKey === "leads" ? undefined : "/"}
      canEdit={canEdit}
      canPublish={canEdit}
    />
  )
}
```

`app/(admin)/admin/(panel)/settings/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { SettingsOverview } from "@/components/admin/settings/settings-overview"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  )
}

async function Settings() {
  await requirePermission({ settings: ["read"] })
  return (
    <>
      <PageHeader
        title="Settings"
        description="Site-wide details and the sections shared by several pages. Changes go live when you publish them."
      />
      <SettingsOverview />
    </>
  )
}
```

`app/(admin)/admin/(panel)/settings/[key]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { SettingsEditor } from "@/components/admin/settings/settings-editor"
import {
  isEditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import { requirePermission } from "@/server/auth/session"

export async function generateMetadata({
  params,
}: PageProps<"/admin/settings/[key]">): Promise<Metadata> {
  const { key } = await params
  return {
    title: isEditableSettingsKey(key)
      ? SETTINGS_ENTRIES[key].label
      : "Settings",
  }
}

export default function SettingsKeyPage({
  params,
}: PageProps<"/admin/settings/[key]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({
  params,
}: Pick<PageProps<"/admin/settings/[key]">, "params">) {
  const { key } = await params
  if (!isEditableSettingsKey(key)) notFound()
  await requirePermission(SETTINGS_ENTRIES[key].read)
  return <SettingsEditor settingsKey={key} />
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/api/settings.test.ts`
Expected: PASS (10 tests).

Run: `pnpm exec next typegen && pnpm exec vitest run --project dom tests/dom/settings-editor.test.tsx`
Expected: PASS (2 tests).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/settings-keys.ts lib/schemas/api/settings.ts server/modules/settings server/api/app.ts components/admin/settings "app/(admin)/admin/(panel)/settings" tests/integration/api/settings.test.ts tests/dom/settings-editor.test.tsx
git commit -m "feat: add settings and shared sections editors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Services, small collections and reorder APIs (master Task 4.6, part 1)

**Files:**
- Create: `server/lib/pg-errors.ts`, `lib/schemas/api/{services,collections}.ts`, `server/modules/services/{service,routes}.ts`, `server/modules/collections/{service,routes}.ts`, `server/modules/reorder/{repo,service,routes}.ts`
- Modify: `server/modules/services/repo.ts` (admin list, insert, optimistic update, delete), `server/modules/collections/repo.ts` (admin CRUD), `server/api/app.ts`
- Test: `tests/integration/api/collections.test.ts`

**Interfaces:**
- Consumes: Phase 3 tables + record schemas (`serviceContent`, `teamMemberSchema`, `clientSchema`, `groupCompanySchema`, `categorySchema`), `tag`; Task 3 versioning + `snapshotRevision` + media usages.
- Produces:

```ts
// server/lib/pg-errors.ts
export function pgErrorCode(err: unknown): string | undefined; export const UNIQUE_VIOLATION = "23505"; export const FOREIGN_KEY_VIOLATION = "23503"
// lib/schemas/api/services.ts
export const serviceListQuery /* sort sortOrder|title|updatedAt */, createServiceInput /* { slug, draft } */, serviceSlugInput /* { slug, version } */, serviceVersionQuery
export type ServiceDto = VersionedDto<unknown> & { id; slug; sortOrder; title }; export type ServiceListItem
// lib/schemas/api/collections.ts
export const COLLECTIONS = ["team","clients","group-companies","categories"] as const
export const collectionSchemas; export type CollectionInput<C>; export type CollectionItem<C> = CollectionInput<C> & { id; sortOrder; updatedAt }
export type TeamItem, ClientItem, GroupCompanyItem, CategoryItem /* + articleCount */
export const collectionListQuery /* sort sortOrder|name|updatedAt */
export const REORDERABLE = ["services", ...COLLECTIONS] as const; export const reorderParam, reorderInput /* { ids: uuid[] } */
// HTTP
GET/POST /services · GET /services/:id · PUT /services/:id/draft · POST /services/:id/publish · POST /services/:id/restore · PATCH /services/:id/slug · DELETE /services/:id?version=
GET/POST /{team,clients,group-companies,categories} · GET/PUT/DELETE /{…}/:id      (collection:read|create|update|delete)
PUT /reorder/:collection { ids }   (services → service:update, others → collection:update; 409 { current: { ids } } if the set differs)
```

Behaviour: services are versioned like pages (new services start as an unpublished draft at the end of the order; publish invalidates `services` + `service:<slug>`; slug clash → 409 with `fieldErrors.slug`); small collections publish immediately (spec §5.3) — every create/update writes a revision (`version = max + 1`, ledger ruling) and an audit row, rewrites `media_usages`, and expires its tag (`team`, `clients`, `group-companies`, `categories`); duplicate unique name/slug → 409 with the field error; deleting a category that has articles → 409 (message says to move them first); reorder writes `sortOrder = index` in one transaction and expires the tag.

- [ ] **Step 1: Write the failing test**

`tests/integration/api/collections.test.ts`:

```ts
import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type {
  CategoryItem,
  ClientItem,
  TeamItem,
} from "@/lib/schemas/api/collections"
import type { Paginated } from "@/lib/schemas/api/list"
import type { ServiceDto, ServiceListItem } from "@/lib/schemas/api/services"
import { getDb } from "@/server/db/client"
import { media, revisions, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let viewer: string
let author: string
let logoId: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  author = (await signedInUser(["author"])).cookie
  const [logo] = await getDb()
    .select()
    .from(media)
    .where(eq(media.key, "/images/client-hayes.png"))
  logoId = logo.id
  revalidateTag.mockClear()
})

const json = async <T>(res: Response) => (await res.json()) as T

describe("small collections (master 4.6): immediate publish + revision + audit + tag", () => {
  it("lists team members with server pagination, search and sort", async () => {
    const page1 = await json<Paginated<TeamItem>>(
      await adminRequest("/team?pageSize=2&sort=name:asc", { cookie: viewer })
    )
    expect(page1.total).toBe(4)
    expect(page1.items.map((t) => t.name)).toEqual([
      "John McDonald",
      "Louise Sheeran",
    ])
    const search = await json<Paginated<TeamItem>>(
      await adminRequest("/team?q=moran", { cookie: viewer })
    )
    expect(search.items.map((t) => t.name)).toEqual(["Sarah Moran"])
  })

  it("creates, updates and deletes a client; revisions count up per entity", async () => {
    const created = await adminRequest("/clients", {
      cookie: editor,
      method: "POST",
      json: {
        name: "Acme Retail",
        logo: { mediaId: logoId },
        url: "https://acme.example",
      },
    })
    expect(created.status).toBe(201)
    const client = await json<ClientItem>(created)
    expect(client).toMatchObject({
      name: "Acme Retail",
      url: "https://acme.example",
      logo: { mediaId: logoId },
    })
    expect(revalidateTag).toHaveBeenCalledWith("clients", { expire: 0 })
    expect(await listMediaUsagesFor(getDb(), "client", client.id)).toEqual([
      { mediaId: logoId, field: "logo" },
    ])

    const updated = await adminRequest(`/clients/${client.id}`, {
      cookie: editor,
      method: "PUT",
      json: { name: "Acme Retail Ltd", logo: { mediaId: logoId }, url: null },
    })
    expect((await json<ClientItem>(updated)).url).toBeNull()
    const revs = await getDb()
      .select({ version: revisions.version })
      .from(revisions)
      .where(
        and(
          eq(revisions.entityType, "client"),
          eq(revisions.entityId, client.id)
        )
      )
    expect(revs.map((r) => r.version).sort()).toEqual([1, 2])

    expect(
      (
        await adminRequest(`/clients/${client.id}`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(200)
    expect(await listMediaUsagesFor(getDb(), "client", client.id)).toEqual([])
    expect(
      (await adminRequest(`/clients/${client.id}`, { cookie: editor })).status
    ).toBe(404)
  })

  it("rejects invalid input (422) and duplicate names (409)", async () => {
    const bad = await adminRequest("/team", {
      cookie: editor,
      method: "POST",
      json: { name: "", role: "x", bio: "x", email: "nope", photo: null },
    })
    expect(bad.status).toBe(422)
    expect(
      Object.keys(
        (await json<{ error: { fieldErrors: object } }>(bad)).error.fieldErrors
      ).sort()
    ).toEqual(["email", "name"])
    const dup = await adminRequest("/team", {
      cookie: editor,
      method: "POST",
      json: {
        name: "Sarah Moran",
        role: "x",
        bio: "x",
        email: "s@example.ie",
        photo: null,
      },
    })
    expect(dup.status).toBe(409)
    expect(
      (await json<{ error: { fieldErrors: Record<string, string[]> } }>(dup))
        .error.fieldErrors.name
    ).toBeTruthy()
    const javascriptUrl = await adminRequest("/clients", {
      cookie: editor,
      method: "POST",
      json: {
        name: "X",
        logo: { mediaId: logoId },
        url: "javascript:alert(1)",
      },
    })
    expect(javascriptUrl.status).toBe(422)
  })

  it("will not delete a category that has articles (409)", async () => {
    const { items } = await json<Paginated<CategoryItem>>(
      await adminRequest("/categories?pageSize=50", { cookie: editor })
    )
    const news = items.find((c) => c.slug === "company-news")!
    expect(news.articleCount).toBeGreaterThan(0)
    const res = await adminRequest(`/categories/${news.id}`, {
      cookie: editor,
      method: "DELETE",
    })
    expect(res.status).toBe(409)
    expect(
      (await json<{ error: { message: string } }>(res)).error.message
    ).toContain("Move them to another category")
    const dupSlug = await adminRequest("/categories", {
      cookie: editor,
      method: "POST",
      json: { slug: "company-news", name: "Dup", showInFilter: false },
    })
    expect(dupSlug.status).toBe(409)
  })

  it("requires collection permissions", async () => {
    expect((await adminRequest("/team", { cookie: author })).status).toBe(403)
    expect(
      (
        await adminRequest("/team", {
          cookie: viewer,
          method: "POST",
          json: {},
        })
      ).status
    ).toBe(403)
  })
})

describe("services (master 4.6): draft/publish, slug, delete", () => {
  const content = async () => {
    const [row] = await getDb()
      .select()
      .from(services)
      .where(eq(services.slug, "static-security"))
    return structuredClone(row.draft)
  }

  it("creates an unpublished draft at the end; slug clash → 409", async () => {
    const draft = { ...(await content()), title: "K9 Patrols" }
    const res = await adminRequest("/services", {
      cookie: editor,
      method: "POST",
      json: { slug: "k9-patrols", draft },
    })
    expect(res.status).toBe(201)
    const created = await json<ServiceDto>(res)
    expect(created).toMatchObject({
      slug: "k9-patrols",
      title: "K9 Patrols",
      version: 1,
      published: null,
      dirty: true,
      status: "draft",
    })
    const list = await json<Paginated<ServiceListItem>>(
      await adminRequest("/services?pageSize=50", { cookie: viewer })
    )
    expect(list.items.at(-1)?.slug).toBe("k9-patrols")
    expect(revalidateTag).not.toHaveBeenCalled()

    const clash = await adminRequest("/services", {
      cookie: editor,
      method: "POST",
      json: { slug: "k9-patrols", draft },
    })
    expect(clash.status).toBe(409)
    expect(
      (await json<{ error: { fieldErrors: Record<string, string[]> } }>(clash))
        .error.fieldErrors.slug
    ).toBeTruthy()
    const badSlug = await adminRequest("/services", {
      cookie: editor,
      method: "POST",
      json: { slug: "K9 Patrols", draft },
    })
    expect(badSlug.status).toBe(422)
  })

  it("publishes (tags services + service:<slug>), changes the slug, rejects stale versions, deletes", async () => {
    const list = await json<Paginated<ServiceListItem>>(
      await adminRequest("/services?q=static", { cookie: editor })
    )
    const id = list.items[0].id
    const draft = { ...(await content()), title: "Static Guarding" }
    const saved = await json<ServiceDto>(
      await adminRequest(`/services/${id}/draft`, {
        cookie: editor,
        method: "PUT",
        json: { draft, version: 1 },
      })
    )
    expect(saved.version).toBe(2)
    const stale = await adminRequest(`/services/${id}/draft`, {
      cookie: editor,
      method: "PUT",
      json: { draft, version: 1 },
    })
    expect(stale.status).toBe(409)

    const published = await json<ServiceDto>(
      await adminRequest(`/services/${id}/publish`, {
        cookie: editor,
        method: "POST",
        json: { version: 2 },
      })
    )
    expect(published).toMatchObject({
      version: 3,
      dirty: false,
      title: "Static Guarding",
    })
    expect(revalidateTag.mock.calls).toEqual([
      ["services", { expire: 0 }],
      ["service:static-security", { expire: 0 }],
    ])

    revalidateTag.mockClear()
    const moved = await json<ServiceDto>(
      await adminRequest(`/services/${id}/slug`, {
        cookie: editor,
        method: "PATCH",
        json: { slug: "static-guarding", version: 3 },
      })
    )
    expect(moved).toMatchObject({ slug: "static-guarding", version: 4 })
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual([
      "services",
      "service:static-security",
      "service:static-guarding",
    ])

    expect(
      (
        await adminRequest(`/services/${id}?version=3`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(409)
    expect(
      (
        await adminRequest(`/services/${id}?version=4`, {
          cookie: viewer,
          method: "DELETE",
        })
      ).status
    ).toBe(403)
    expect(
      (
        await adminRequest(`/services/${id}?version=4`, {
          cookie: editor,
          method: "DELETE",
        })
      ).status
    ).toBe(200)
    expect(await listMediaUsagesFor(getDb(), "service", id)).toEqual([])
  })
})

describe("PUT /reorder/:collection (master 4.6)", () => {
  it("persists sortOrder and invalidates the collection tag", async () => {
    const { items } = await json<Paginated<TeamItem>>(
      await adminRequest("/team", { cookie: editor })
    )
    const reversed = items.map((t) => t.id).reverse()
    const res = await adminRequest("/reorder/team", {
      cookie: editor,
      method: "PUT",
      json: { ids: reversed },
    })
    expect(res.status).toBe(200)
    const after = await json<Paginated<TeamItem>>(
      await adminRequest("/team", { cookie: editor })
    )
    expect(after.items.map((t) => t.id)).toEqual(reversed)
    expect(after.items.map((t) => t.sortOrder)).toEqual([0, 1, 2, 3])
    expect(revalidateTag).toHaveBeenCalledWith("team", { expire: 0 })
  })

  it("409 when the list is out of date; 403 without update permission", async () => {
    const { items } = await json<Paginated<TeamItem>>(
      await adminRequest("/team", { cookie: editor })
    )
    const res = await adminRequest("/reorder/team", {
      cookie: editor,
      method: "PUT",
      json: { ids: items.slice(1).map((t) => t.id) },
    })
    expect(res.status).toBe(409)
    expect(
      (await json<{ error: { current: { ids: string[] } } }>(res)).error.current
        .ids
    ).toHaveLength(4)
    expect(
      (
        await adminRequest("/reorder/services", {
          cookie: viewer,
          method: "PUT",
          json: { ids: [items[0].id] },
        })
      ).status
    ).toBe(403)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration tests/integration/api/collections.test.ts`
Expected: FAIL — `/api/v1/admin/team` and `/api/v1/admin/services` answer 404 `Route not found`.

- [ ] **Step 3: Services module**

`server/lib/pg-errors.ts`:

```ts
import "server-only"

/** Postgres SQLSTATE of a failed query (drizzle wraps the pg error in `cause`). */
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null
  const code = e?.cause?.code ?? e?.code
  return typeof code === "string" ? code : undefined
}

export const UNIQUE_VIOLATION = "23505"
export const FOREIGN_KEY_VIOLATION = "23503"
```

`lib/schemas/api/services.ts`:

```ts
import { z } from "zod"

import { slug } from "@/lib/schemas/common"

import type { VersionedDto } from "./content"
import { listQuery, sortParam } from "./list"

export const serviceListQuery = listQuery.extend({
  sort: sortParam(["sortOrder", "title", "updatedAt"], {
    field: "sortOrder",
    dir: "asc",
  }),
})
export type ServiceListQuery = z.output<typeof serviceListQuery>

/** POST /services — draft is validated against serviceContent by the service. */
export const createServiceInput = z.object({ slug, draft: z.unknown() })

/** PATCH /services/:id/slug — changes the public URL immediately. */
export const serviceSlugInput = z.object({
  slug,
  version: z.number().int().min(1),
})

export const serviceVersionQuery = z.object({
  version: z.coerce.number().int().min(1),
})

export type ServiceDto = VersionedDto<unknown> & {
  id: string
  slug: string
  sortOrder: number
  title: string
}

export type ServiceListItem = Omit<ServiceDto, "draft" | "published">
```

`server/modules/services/repo.ts` (full file):

```ts
import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  max,
  or,
  sql,
} from "drizzle-orm"

import type { Sort } from "@/lib/schemas/api/list"
import type { ServiceContent } from "@/lib/schemas/content/service"
import type { DbOrTx } from "@/server/db/client"
import { services, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

export function listServiceRows(db: DbOrTx) {
  return db
    .select()
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.slug))
}

export async function findServiceBySlug(db: DbOrTx, slug: string) {
  const [row] = await db.select().from(services).where(eq(services.slug, slug))
  return row ?? null
}

export async function findServiceById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(services).where(eq(services.id, id))
  return row ?? null
}

const withEditor = { ...getTableColumns(services), updatedByName: users.name }
const title = sql<string>`${services.draft}->>'title'`
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

export async function findServiceForEdit(db: DbOrTx, id: string) {
  const [row] = await db
    .select(withEditor)
    .from(services)
    .leftJoin(users, eq(users.id, services.updatedBy))
    .where(eq(services.id, id))
  return row ?? null
}
export type ServiceEditRow = NonNullable<
  Awaited<ReturnType<typeof findServiceForEdit>>
>

/** Admin list: search title/slug, sort, paginate. */
export async function listServicesForAdmin(
  db: DbOrTx,
  opts: {
    q?: string
    sort: Sort<"sortOrder" | "title" | "updatedAt">
    page: number
    pageSize: number
  }
) {
  const pattern = opts.q ? `%${escapeLike(opts.q)}%` : null
  const where = pattern
    ? or(ilike(title, pattern), ilike(services.slug, pattern))
    : undefined
  const [{ total }] = await db
    .select({ total: count() })
    .from(services)
    .where(where)
  const column =
    opts.sort.field === "title"
      ? title
      : opts.sort.field === "updatedAt"
        ? services.updatedAt
        : services.sortOrder
  const rows = await db
    .select(withEditor)
    .from(services)
    .leftJoin(users, eq(users.id, services.updatedBy))
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(services.slug)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

export async function nextServiceSortOrder(db: DbOrTx): Promise<number> {
  const [row] = await db.select({ top: max(services.sortOrder) }).from(services)
  return (row?.top ?? -1) + 1
}

export async function insertService(
  db: DbOrTx,
  values: {
    slug: string
    draft: ServiceContent
    sortOrder: number
    updatedBy: string
  }
): Promise<string> {
  const [row] = await db
    .insert(services)
    .values(values)
    .returning({ id: services.id })
  return row.id
}

export async function updateServiceIfVersion(
  db: DbOrTx,
  id: string,
  version: number,
  patch: VersionedPatch<unknown> & { slug?: string }
): Promise<ServiceEditRow | null> {
  const [updated] = await db
    .update(services)
    .set({
      ...patch,
      draft: patch.draft as ServiceContent | undefined,
      published: patch.published as ServiceContent | null | undefined,
      version: version + 1,
    })
    .where(and(eq(services.id, id), eq(services.version, version)))
    .returning({ id: services.id })
  return updated ? findServiceForEdit(db, id) : null
}

export async function deleteServiceRow(
  db: DbOrTx,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(services)
    .where(eq(services.id, id))
    .returning({ id: services.id })
  return rows.length > 0
}
```

`server/modules/services/service.ts`:

```ts
import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Paginated } from "@/lib/schemas/api/list"
import type {
  ServiceDto,
  ServiceListItem,
  ServiceListQuery,
} from "@/lib/schemas/api/services"
import { serviceContent } from "@/lib/schemas/content/service"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, conflict, forbidden, notFound } from "@/server/lib/errors"
import { clearMediaUsages, syncMediaUsages } from "@/server/lib/media-usages"
import { pgErrorCode, UNIQUE_VIOLATION } from "@/server/lib/pg-errors"
import {
  publish,
  restoreRevision,
  saveDraft,
  validateContent,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"

import {
  deleteServiceRow,
  findServiceForEdit,
  insertService,
  listServicesForAdmin,
  nextServiceSortOrder,
  type ServiceEditRow,
  updateServiceIfVersion,
} from "./repo"

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toDto(row: ServiceEditRow): ServiceDto {
  return {
    id: row.id,
    slug: row.slug,
    sortOrder: row.sortOrder,
    title: row.draft.title,
    ...versionedDto<unknown>(row),
  }
}

const slugTaken = () =>
  new AppError("CONFLICT", "Another service already uses this address", {
    fieldErrors: { slug: ["Already used by another service"] },
  })

/** Versioning adapter for services (id = row id; tags = list + detail). */
export const serviceStore: VersionedStore<unknown, ServiceEditRow> = {
  entityType: "service",
  label: "Service",
  schema: () => serviceContent,
  find: (db, id) => findServiceForEdit(db, id),
  update: (db, id, version, patch) =>
    updateServiceIfVersion(db, id, version, patch),
  tags: (row) => [tag.services, tag.service(row.slug)],
  present: (row) => toDto(row),
}

export async function listServicesAdmin(
  actor: Actor,
  query: ServiceListQuery
): Promise<Paginated<ServiceListItem>> {
  assertCan(actor, { service: ["read"] })
  const { rows, total } = await listServicesForAdmin(getDb(), {
    q: query.q || undefined,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map((row) => {
      const dto: Partial<ServiceDto> = toDto(row)
      delete dto.draft
      delete dto.published
      return dto as ServiceListItem
    }),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getServiceAdmin(
  actor: Actor,
  id: string
): Promise<ServiceDto> {
  assertCan(actor, { service: ["read"] })
  const row = await findServiceForEdit(getDb(), id)
  if (!row) throw notFound("Service")
  return toDto(row)
}

/** New services start as an unpublished draft at the end of the list. */
export async function createService(
  actor: Actor,
  input: { slug: string; draft: unknown }
): Promise<ServiceDto> {
  assertCan(actor, { service: ["create"] })
  const draft = validateContent(serviceContent, input.draft)
  const db = getDb()
  try {
    const id = await db.transaction(async (tx) => {
      const newId = await insertService(tx, {
        slug: input.slug,
        draft,
        sortOrder: await nextServiceSortOrder(tx),
        updatedBy: actor.userId,
      })
      await syncMediaUsages(tx, "service", newId, draft)
      await writeAudit(tx, actor, {
        action: "service.created",
        entityType: "service",
        entityId: newId,
        diff: { slug: input.slug },
      })
      return newId
    })
    return toDto((await findServiceForEdit(db, id))!)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
    throw err
  }
}

export async function saveServiceDraft(
  actor: Actor,
  id: string,
  input: { draft: unknown; version: number }
) {
  assertCan(actor, { service: ["update"] })
  return toDto(await saveDraft(getDb(), serviceStore, actor, id, input))
}

export async function publishService(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  assertCan(actor, { service: ["publish"] })
  return toDto(await publish(getDb(), serviceStore, actor, id, input))
}

export async function restoreService(
  actor: Actor,
  id: string,
  input: { revisionId: string; version: number }
) {
  assertCan(actor, { service: ["update"] })
  return toDto(await restoreRevision(getDb(), serviceStore, actor, id, input))
}

/** The address is a column, not draft content: it changes the public URL now. */
export async function changeServiceSlug(
  actor: Actor,
  id: string,
  input: { slug: string; version: number }
) {
  assertCan(actor, { service: ["update"] })
  const db = getDb()
  try {
    const { before, after } = await db.transaction(async (tx) => {
      const existing = await findServiceForEdit(tx, id)
      if (!existing) throw notFound("Service")
      const updated = await updateServiceIfVersion(tx, id, input.version, {
        slug: input.slug,
        updatedBy: actor.userId,
      })
      if (!updated) {
        const current = await findServiceForEdit(tx, id)
        if (!current) throw notFound("Service")
        throw conflict(toDto(current))
      }
      await writeAudit(tx, actor, {
        action: "service.slug_changed",
        entityType: "service",
        entityId: id,
        diff: { from: existing.slug, to: input.slug },
      })
      return { before: existing, after: updated }
    })
    invalidate(tag.services, tag.service(before.slug), tag.service(after.slug))
    return toDto(after)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
    throw err
  }
}

export async function deleteService(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  assertCan(actor, { service: ["delete"] })
  const removed = await getDb().transaction(async (tx) => {
    const existing = await findServiceForEdit(tx, id)
    if (!existing) throw notFound("Service")
    if (existing.version !== input.version) throw conflict(toDto(existing))
    await clearMediaUsages(tx, "service", id)
    await deleteServiceRow(tx, id)
    await writeAudit(tx, actor, {
      action: "service.deleted",
      entityType: "service",
      entityId: id,
      diff: { slug: existing.slug },
    })
    return existing
  })
  invalidate(tag.services, tag.service(removed.slug))
  return { ok: true as const }
}
```

`server/modules/services/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import { idParam } from "@/lib/schemas/api/params"
import {
  createServiceInput,
  serviceListQuery,
  serviceSlugInput,
  serviceVersionQuery,
} from "@/lib/schemas/api/services"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

export const servicesRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ service: ["read"] }),
    zv("query", serviceListQuery),
    async (c) =>
      c.json(
        await service.listServicesAdmin(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .post(
    "/",
    can({ service: ["create"] }),
    zv("json", createServiceInput),
    async (c) =>
      c.json(await service.createService(actorOf(c), c.req.valid("json")), 201)
  )
  .get("/:id", can({ service: ["read"] }), zv("param", idParam), async (c) =>
    c.json(
      await service.getServiceAdmin(actorOf(c), c.req.valid("param").id),
      200
    )
  )
  .put(
    "/:id/draft",
    can({ service: ["update"] }),
    zv("param", idParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveServiceDraft(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/publish",
    can({ service: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishService(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/restore",
    can({ service: ["update"] }),
    zv("param", idParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreService(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .patch(
    "/:id/slug",
    can({ service: ["update"] }),
    zv("param", idParam),
    zv("json", serviceSlugInput),
    async (c) =>
      c.json(
        await service.changeServiceSlug(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:id",
    can({ service: ["delete"] }),
    zv("param", idParam),
    zv("query", serviceVersionQuery),
    async (c) =>
      c.json(
        await service.deleteService(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("query")
        ),
        200
      )
  )
```

- [ ] **Step 4: Collections and reorder**

`lib/schemas/api/collections.ts`:

```ts
import { z } from "zod"

import type { MediaRef } from "@/lib/schemas/common"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"

import { listQuery, sortParam } from "./list"

/** Small collections: edits publish immediately (spec §5.3). URL segment → record schema. */
export const COLLECTIONS = [
  "team",
  "clients",
  "group-companies",
  "categories",
] as const
export type CollectionName = (typeof COLLECTIONS)[number]

export const collectionSchemas = {
  team: teamMemberSchema,
  clients: clientSchema,
  "group-companies": groupCompanySchema,
  categories: categorySchema,
} as const satisfies Record<CollectionName, z.ZodObject>

export type CollectionInput<C extends CollectionName> = z.output<
  (typeof collectionSchemas)[C]
>

/** Wire shape: the record's fields plus id, sortOrder, updatedAt. */
export type CollectionItem<C extends CollectionName> = CollectionInput<C> & {
  id: string
  sortOrder: number
  updatedAt: string
}

export type TeamItem = CollectionItem<"team">
export type ClientItem = CollectionItem<"clients">
export type GroupCompanyItem = CollectionItem<"group-companies">
export type CategoryItem = CollectionItem<"categories"> & {
  articleCount: number
}

export const collectionListQuery = listQuery.extend({
  sort: sortParam(["sortOrder", "name", "updatedAt"], {
    field: "sortOrder",
    dir: "asc",
  }),
})
export type CollectionListQuery = z.output<typeof collectionListQuery>

/** PUT /reorder/:collection — every id of the collection, in the new order. */
export const REORDERABLE = ["services", ...COLLECTIONS] as const
export type Reorderable = (typeof REORDERABLE)[number]
export const reorderParam = z.object({ collection: z.enum(REORDERABLE) })
export const reorderInput = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate ids"),
})

export type { MediaRef }
```

`server/modules/collections/repo.ts` (full file):

```ts
import "server-only"

import { asc, count, desc, eq, ilike, max, or, type SQL } from "drizzle-orm"

import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import {
  articleCategories,
  articles,
  clients,
  groupCompanies,
  teamMembers,
} from "@/server/db/schema"

export function listCategoryRows(db: DbOrTx) {
  return db
    .select()
    .from(articleCategories)
    .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.name))
}

export function listTeamRows(db: DbOrTx) {
  return db
    .select()
    .from(teamMembers)
    .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.name))
}

export function listClientRows(db: DbOrTx) {
  return db
    .select()
    .from(clients)
    .orderBy(asc(clients.sortOrder), asc(clients.name))
}

export function listGroupCompanyRows(db: DbOrTx) {
  return db
    .select()
    .from(groupCompanies)
    .orderBy(asc(groupCompanies.sortOrder), asc(groupCompanies.name))
}

/** The four small-collection tables, keyed by API name. */
export const COLLECTION_TABLES = {
  team: teamMembers,
  clients,
  "group-companies": groupCompanies,
  categories: articleCategories,
} as const
export type CollectionTable =
  (typeof COLLECTION_TABLES)[keyof typeof COLLECTION_TABLES]
type Name = keyof typeof COLLECTION_TABLES
export type CollectionRow<N extends Name> =
  (typeof COLLECTION_TABLES)[N]["$inferSelect"]
export type CollectionInsert<N extends Name> =
  (typeof COLLECTION_TABLES)[N]["$inferInsert"]

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

function searchWhere(name: Name, q: string | undefined): SQL | undefined {
  if (!q) return undefined
  const p = `%${escapeLike(q)}%`
  switch (name) {
    case "team":
      return or(
        ilike(teamMembers.name, p),
        ilike(teamMembers.role, p),
        ilike(teamMembers.email, p)
      )
    case "clients":
      return ilike(clients.name, p)
    case "group-companies":
      return or(ilike(groupCompanies.name, p), ilike(groupCompanies.site, p))
    case "categories":
      return or(
        ilike(articleCategories.name, p),
        ilike(articleCategories.slug, p)
      )
  }
}

/** Admin list of one collection: search, sort, paginate. */
export async function listCollectionPage<N extends Name>(
  db: DbOrTx,
  name: N,
  opts: {
    q?: string
    sort: Sort<"sortOrder" | "name" | "updatedAt">
    page: number
    pageSize: number
  }
): Promise<{ rows: CollectionRow<N>[]; total: number }> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const where = searchWhere(name, opts.q)
  const [{ total }] = await db
    .select({ total: count() })
    .from(table)
    .where(where)
  const column = table[opts.sort.field]
  const rows = await db
    .select()
    .from(table)
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(table.id)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows: rows as CollectionRow<N>[], total }
}

export async function findCollectionRow<N extends Name>(
  db: DbOrTx,
  name: N,
  id: string
): Promise<CollectionRow<N> | null> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const [row] = await db.select().from(table).where(eq(table.id, id))
  return (row as CollectionRow<N> | undefined) ?? null
}

export async function nextCollectionSortOrder(
  db: DbOrTx,
  name: Name
): Promise<number> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const [row] = await db.select({ top: max(table.sortOrder) }).from(table)
  return (row?.top ?? -1) + 1
}

export async function insertCollectionRow<N extends Name>(
  db: DbOrTx,
  name: N,
  values: CollectionInsert<N>
): Promise<CollectionRow<N>> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const [row] = await db
    .insert(table)
    .values(values as never)
    .returning()
  return row as CollectionRow<N>
}

export async function updateCollectionRow<N extends Name>(
  db: DbOrTx,
  name: N,
  id: string,
  values: Partial<CollectionInsert<N>>
): Promise<CollectionRow<N> | null> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const [row] = await db
    .update(table)
    .set(values as never)
    .where(eq(table.id, id))
    .returning()
  return (row as CollectionRow<N> | undefined) ?? null
}

export async function deleteCollectionRow(
  db: DbOrTx,
  name: Name,
  id: string
): Promise<void> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  await db.delete(table).where(eq(table.id, id))
}

/** Articles per category (blocks deleting a category in use). */
export async function countArticlesInCategory(
  db: DbOrTx,
  categoryId: string
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(articles)
    .where(eq(articles.categoryId, categoryId))
  return row?.n ?? 0
}

export async function articleCountsByCategory(
  db: DbOrTx
): Promise<Map<string, number>> {
  const rows = await db
    .select({ categoryId: articles.categoryId, n: count() })
    .from(articles)
    .groupBy(articles.categoryId)
  return new Map(rows.map((r) => [r.categoryId, r.n]))
}
```

`server/modules/collections/service.ts`:

```ts
import "server-only"

import type { z } from "zod"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import {
  type CategoryItem,
  type CollectionInput,
  type CollectionItem,
  type CollectionListQuery,
  type CollectionName,
  collectionSchemas,
} from "@/lib/schemas/api/collections"
import type { Paginated } from "@/lib/schemas/api/list"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { clearMediaUsages, syncMediaUsages } from "@/server/lib/media-usages"
import { pgErrorCode, UNIQUE_VIOLATION } from "@/server/lib/pg-errors"
import { snapshotRevision, validateContent } from "@/server/lib/versioning"

import {
  articleCountsByCategory,
  type CollectionInsert,
  type CollectionRow,
  countArticlesInCategory,
  deleteCollectionRow,
  findCollectionRow,
  insertCollectionRow,
  listCollectionPage,
  nextCollectionSortOrder,
  updateCollectionRow,
} from "./repo"

/** Per-collection wiring: revision/audit entity, cache tag, row ⇄ record mapping. */
const CONFIG = {
  team: {
    entityType: "team",
    label: "Team member",
    unique: {
      field: "name",
      message: "Someone with this name is already on the team",
    },
    tag: tag.team,
    toRow: (v: CollectionInput<"team">): Partial<CollectionInsert<"team">> => ({
      name: v.name,
      role: v.role,
      bio: v.bio,
      email: v.email,
      photoId: v.photo?.mediaId ?? null,
    }),
    fromRow: (r: CollectionRow<"team">): CollectionInput<"team"> => ({
      name: r.name,
      role: r.role,
      bio: r.bio,
      email: r.email,
      photo: r.photoId ? { mediaId: r.photoId } : null,
    }),
  },
  clients: {
    entityType: "client",
    label: "Client",
    unique: { field: "name", message: "This client is already listed" },
    tag: tag.clients,
    toRow: (
      v: CollectionInput<"clients">
    ): Partial<CollectionInsert<"clients">> => ({
      name: v.name,
      logoId: v.logo.mediaId,
      url: v.url,
    }),
    fromRow: (r: CollectionRow<"clients">): CollectionInput<"clients"> => ({
      name: r.name,
      logo: { mediaId: r.logoId },
      url: r.url,
    }),
  },
  "group-companies": {
    entityType: "groupCompany",
    label: "Group company",
    unique: { field: "name", message: "This company is already listed" },
    tag: tag.groupCompanies,
    toRow: (
      v: CollectionInput<"group-companies">
    ): Partial<CollectionInsert<"group-companies">> => ({
      name: v.name,
      phone: v.phone,
      site: v.site,
      logoId: v.logo.mediaId,
    }),
    fromRow: (
      r: CollectionRow<"group-companies">
    ): CollectionInput<"group-companies"> => ({
      name: r.name,
      phone: r.phone,
      site: r.site,
      logo: { mediaId: r.logoId },
    }),
  },
  categories: {
    entityType: "category",
    label: "Category",
    unique: {
      field: "slug",
      message: "Another category already uses this address",
    },
    tag: tag.categories,
    toRow: (
      v: CollectionInput<"categories">
    ): Partial<CollectionInsert<"categories">> => ({
      slug: v.slug,
      name: v.name,
      showInFilter: v.showInFilter,
    }),
    fromRow: (
      r: CollectionRow<"categories">
    ): CollectionInput<"categories"> => ({
      slug: r.slug,
      name: r.name,
      showInFilter: r.showInFilter,
    }),
  },
} as const

type Config<C extends CollectionName> = {
  entityType: string
  label: string
  unique: { field: string; message: string }
  tag: string
  toRow: (v: CollectionInput<C>) => Partial<CollectionInsert<C>>
  fromRow: (r: CollectionRow<C>) => CollectionInput<C>
}
const configOf = <C extends CollectionName>(name: C) =>
  CONFIG[name] as unknown as Config<C>

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toItem<C extends CollectionName>(
  name: C,
  row: CollectionRow<C>
): CollectionItem<C> {
  return {
    ...configOf(name).fromRow(row),
    id: row.id,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function duplicate(name: CollectionName) {
  const { unique } = CONFIG[name]
  return new AppError("CONFLICT", unique.message, {
    fieldErrors: { [unique.field]: [unique.message] },
  })
}

export async function listCollection<C extends CollectionName>(
  actor: Actor,
  name: C,
  query: CollectionListQuery
): Promise<Paginated<CollectionItem<C> | CategoryItem>> {
  assertCan(actor, { collection: ["read"] })
  const db = getDb()
  const { rows, total } = await listCollectionPage(db, name, {
    q: query.q || undefined,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  const counts =
    name === "categories" ? await articleCountsByCategory(db) : null
  return {
    items: rows.map((row) => {
      const item = toItem(name, row)
      return counts
        ? {
            ...(item as CollectionItem<"categories">),
            articleCount: counts.get(row.id) ?? 0,
          }
        : item
    }),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getCollectionItem<C extends CollectionName>(
  actor: Actor,
  name: C,
  id: string
) {
  assertCan(actor, { collection: ["read"] })
  const row = await findCollectionRow(getDb(), name, id)
  if (!row) throw notFound(CONFIG[name].label)
  return toItem(name, row)
}

/**
 * Create/update/delete publish immediately (spec §5.3): each change writes
 * a revision (version = max + 1), keeps media_usages exact, is audited and
 * expires the collection's cache tag.
 */
export async function createCollectionItem<C extends CollectionName>(
  actor: Actor,
  name: C,
  input: unknown
) {
  assertCan(actor, { collection: ["create"] })
  const config = configOf(name)
  const value = validateContent(
    collectionSchemas[name] as unknown as z.ZodType<CollectionInput<C>>,
    input
  )
  try {
    const row = await getDb().transaction(async (tx) => {
      const created = await insertCollectionRow(tx, name, {
        ...config.toRow(value),
        sortOrder: await nextCollectionSortOrder(tx, name),
      } as CollectionInsert<C>)
      await syncMediaUsages(tx, config.entityType, created.id, value)
      await snapshotRevision(tx, actor, config.entityType, created.id, value)
      await writeAudit(tx, actor, {
        action: `${config.entityType}.created`,
        entityType: config.entityType,
        entityId: created.id,
      })
      return created
    })
    invalidate(config.tag)
    return toItem(name, row)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw duplicate(name)
    throw err
  }
}

export async function updateCollectionItem<C extends CollectionName>(
  actor: Actor,
  name: C,
  id: string,
  input: unknown
) {
  assertCan(actor, { collection: ["update"] })
  const config = configOf(name)
  const value = validateContent(
    collectionSchemas[name] as unknown as z.ZodType<CollectionInput<C>>,
    input
  )
  try {
    const row = await getDb().transaction(async (tx) => {
      const updated = await updateCollectionRow(
        tx,
        name,
        id,
        config.toRow(value)
      )
      if (!updated) throw notFound(config.label)
      await syncMediaUsages(tx, config.entityType, id, value)
      await snapshotRevision(tx, actor, config.entityType, id, value)
      await writeAudit(tx, actor, {
        action: `${config.entityType}.updated`,
        entityType: config.entityType,
        entityId: id,
      })
      return updated
    })
    invalidate(config.tag)
    return toItem(name, row)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw duplicate(name)
    throw err
  }
}

export async function deleteCollectionItem(
  actor: Actor,
  name: CollectionName,
  id: string
) {
  assertCan(actor, { collection: ["delete"] })
  const config = configOf(name)
  await getDb().transaction(async (tx) => {
    const existing = await findCollectionRow(tx, name, id)
    if (!existing) throw notFound(config.label)
    if (name === "categories") {
      const n = await countArticlesInCategory(tx, id)
      if (n > 0)
        throw new AppError(
          "CONFLICT",
          `This category has ${n} article${n === 1 ? "" : "s"}. Move them to another category first.`,
          { current: { articleCount: n } }
        )
    }
    await clearMediaUsages(tx, config.entityType, id)
    await deleteCollectionRow(tx, name, id)
    await writeAudit(tx, actor, {
      action: `${config.entityType}.deleted`,
      entityType: config.entityType,
      entityId: id,
      diff: config.fromRow(existing as CollectionRow<typeof name>),
    })
  })
  invalidate(config.tag)
  return { ok: true as const }
}
```

`server/modules/collections/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"
import { z } from "zod"

import {
  type CollectionName,
  collectionListQuery,
} from "@/lib/schemas/api/collections"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** CRUD for one small collection (/team, /clients, /group-companies, /categories). */
export function collectionRoutes<C extends CollectionName>(name: C) {
  return new Hono<AppEnv>()
    .get(
      "/",
      can({ collection: ["read"] }),
      zv("query", collectionListQuery),
      async (c) =>
        c.json(
          await service.listCollection(actorOf(c), name, c.req.valid("query")),
          200
        )
    )
    .post(
      "/",
      can({ collection: ["create"] }),
      zv("json", z.unknown()),
      async (c) =>
        c.json(
          await service.createCollectionItem(
            actorOf(c),
            name,
            c.req.valid("json")
          ),
          201
        )
    )
    .get(
      "/:id",
      can({ collection: ["read"] }),
      zv("param", idParam),
      async (c) =>
        c.json(
          await service.getCollectionItem(
            actorOf(c),
            name,
            c.req.valid("param").id
          ),
          200
        )
    )
    .put(
      "/:id",
      can({ collection: ["update"] }),
      zv("param", idParam),
      zv("json", z.unknown()),
      async (c) =>
        c.json(
          await service.updateCollectionItem(
            actorOf(c),
            name,
            c.req.valid("param").id,
            c.req.valid("json")
          ),
          200
        )
    )
    .delete(
      "/:id",
      can({ collection: ["delete"] }),
      zv("param", idParam),
      async (c) =>
        c.json(
          await service.deleteCollectionItem(
            actorOf(c),
            name,
            c.req.valid("param").id
          ),
          200
        )
    )
}

export const teamRoutes = collectionRoutes("team")
export const clientsRoutes = collectionRoutes("clients")
export const groupCompaniesRoutes = collectionRoutes("group-companies")
export const categoriesRoutes = collectionRoutes("categories")
```

`server/modules/reorder/repo.ts`:

```ts
import "server-only"

import { asc, eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  articleCategories,
  clients,
  groupCompanies,
  services,
  teamMembers,
} from "@/server/db/schema"

const TABLES = {
  services,
  team: teamMembers,
  clients,
  "group-companies": groupCompanies,
  categories: articleCategories,
} as const
export type ReorderTable = keyof typeof TABLES

/** Current ids in display order. */
export async function orderedIds(
  db: DbOrTx,
  name: ReorderTable
): Promise<string[]> {
  const table = TABLES[name] as (typeof TABLES)["team"]
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .orderBy(asc(table.sortOrder), asc(table.id))
  return rows.map((r) => r.id)
}

/** sortOrder = position in `ids` (caller's transaction). */
export async function applyOrder(
  db: DbOrTx,
  name: ReorderTable,
  ids: string[]
): Promise<void> {
  const table = TABLES[name] as (typeof TABLES)["team"]
  for (const [index, id] of ids.entries())
    await db.update(table).set({ sortOrder: index }).where(eq(table.id, id))
}
```

`server/modules/reorder/service.ts`:

```ts
import "server-only"

import { hasPermission } from "@/lib/auth/permissions"
import type { Reorderable } from "@/lib/schemas/api/collections"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { conflict, forbidden } from "@/server/lib/errors"

import { applyOrder, orderedIds } from "./repo"

const TAGS: Record<Reorderable, string> = {
  services: tag.services,
  team: tag.team,
  clients: tag.clients,
  "group-companies": tag.groupCompanies,
  categories: tag.categories,
}

/**
 * Persists a drag-and-drop order (sortOrder = index). `ids` must list
 * exactly the current records; otherwise someone added or removed one
 * meanwhile → 409 with the current order.
 */
export async function reorder(
  actor: Actor,
  collection: Reorderable,
  ids: string[]
) {
  const permitted =
    collection === "services"
      ? hasPermission(actor.roles, { service: ["update"] })
      : hasPermission(actor.roles, { collection: ["update"] })
  if (!permitted) throw forbidden()
  await getDb().transaction(async (tx) => {
    const current = await orderedIds(tx, collection)
    const same =
      current.length === ids.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => current.includes(id))
    if (!same) throw conflict({ ids: current })
    await applyOrder(tx, collection, ids)
    await writeAudit(tx, actor, {
      action: `${collection}.reordered`,
      entityType: collection,
      diff: { ids },
    })
  })
  invalidate(TAGS[collection])
  return { ids }
}
```

`server/modules/reorder/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { reorderInput, reorderParam } from "@/lib/schemas/api/collections"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import { reorder } from "./service"

// Permission depends on :collection (service:update or collection:update): checked in the service.
export const reorderRoutes = new Hono<AppEnv>().put(
  "/:collection",
  zv("param", reorderParam),
  zv("json", reorderInput),
  async (c) =>
    c.json(
      await reorder(
        actorOf(c),
        c.req.valid("param").collection,
        c.req.valid("json").ids
      ),
      200
    )
)
```

In `server/api/app.ts` add the imports

```ts
import {
  categoriesRoutes,
  clientsRoutes,
  groupCompaniesRoutes,
  teamRoutes,
} from "@/server/modules/collections/routes"
import { reorderRoutes } from "@/server/modules/reorder/routes"
import { servicesRoutes } from "@/server/modules/services/routes"
```

(alphabetical among the module imports) and chain after `.route("/settings", settingsRoutes)`:

```ts
  .route("/services", servicesRoutes)
  .route("/team", teamRoutes)
  .route("/clients", clientsRoutes)
  .route("/group-companies", groupCompaniesRoutes)
  .route("/categories", categoriesRoutes)
  .route("/reorder", reorderRoutes)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:integration tests/integration/api/collections.test.ts tests/integration/queries/public-queries.test.ts`
Expected: PASS (9 tests here; Phase 3 queries unchanged).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/lib/pg-errors.ts lib/schemas/api/services.ts lib/schemas/api/collections.ts server/modules/services server/modules/collections server/modules/reorder server/api/app.ts tests/integration/api/collections.test.ts
git commit -m "feat: add services, collections and reorder admin APIs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Collection screens — data table, sortable list, services editor (master Task 4.6, part 2)

**Files:**
- Create: `components/admin/data-table/data-table.tsx`, `components/admin/sortable-list.tsx`, `components/admin/collections/{reorder-panel.tsx,record-sheet.tsx,media-thumb.tsx,configs.tsx,collection-screen.tsx}`, `components/admin/services/{service-meta.ts,services-screen.tsx,service-editor.tsx,new-service-form.tsx}`
- Create: `app/(admin)/admin/(panel)/{team,clients,group-companies,categories}/page.tsx`, `app/(admin)/admin/(panel)/services/page.tsx`, `services/new/page.tsx`, `services/[id]/page.tsx`
- Test: `tests/dom/collections.test.tsx`

**Interfaces:**
- Consumes: Task 9 APIs/types; Task 7 `VersionedEditor`, `statusLabel`, `issuesToFieldErrors`; Task 5 `SchemaForm`, `emptyValue`; Task 4 `useMediaItem`; TanStack Table v9 (`useTable`, `tableFeatures`, `rowSortingFeature`, `rowPaginationFeature`, `createColumnHelper<TFeatures, TData>`, `table.FlexRender`, `row.getAllCells()` — notes §4.1–4.2), dnd-kit (notes §5.2).
- Produces:

```ts
// components/admin/data-table/data-table.tsx
export const dataTableFeatures; export type DataTableFeatures
export const columnsFor: <T extends Record<string, unknown>>() => ColumnHelper<DataTableFeatures, T>
export type DataTableColumns<T>; export type DataTableParams = { page; pageSize; sort?; q? }
export function DataTable<T extends Record<string, unknown> & { id: string }>(props: { label; queryKey; fetchPage(params): Promise<Paginated<T>>; columns; renderCard(row): ReactNode; initialSort?; searchPlaceholder?; empty }): JSX.Element
// components/admin/sortable-list.tsx
export type SortableItem = { id: string; label: string; description?: string }
export function SortableList(props: { label; items: SortableItem[]; onReorder(next: SortableItem[]): void; disabled? }): JSX.Element
// components/admin/collections/*
export function ReorderPanel(props: { collection: Reorderable; label; queryKey; load(): Promise<SortableItem[]>; onDone(): void })
export function RecordSheet(props: { open; onOpenChange; title; description; schema; meta; initial; onSave(value); onDelete?; deleteLabel? })
export const COLLECTION_CONFIGS: Record<CollectionName, CollectionConfig>
export function CollectionScreen(props: { name: CollectionName }): JSX.Element     // ?edit=<id> opens a record (⌘K)
// components/admin/services/*
export function ServicesScreen(); export function ServiceEditor(props: { id: string }); export function NewServiceForm(); export function slugify(title: string): string
```

- [ ] **Step 1: Write the failing test**

`tests/dom/collections.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push, replace, search } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: { current: new URLSearchParams() },
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/categories",
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => search.current,
}))

import { CollectionScreen } from "@/components/admin/collections/collection-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import { SortableList } from "@/components/admin/sortable-list"
import { slugify } from "@/components/admin/services/new-service-form"
import type { Role } from "@/lib/auth/roles"

const category = (i: number) => ({
  id: `00000000-0000-7000-8000-00000000000${i}`,
  slug: `cat-${i}`,
  name: `Category ${i}`,
  showInFilter: i % 2 === 0,
  sortOrder: i,
  updatedAt: "2026-10-16T09:00:00.000Z",
  articleCount: i,
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn()

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  search.current = new URLSearchParams()
  fetchMock.mockReset()
  fetchMock.mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const method = init?.method ?? "GET"
      if (method === "GET" && url.pathname === "/api/v1/admin/categories") {
        const page = Number(url.searchParams.get("page"))
        const items = page === 1 ? [category(1), category(2)] : [category(3)]
        return json(200, {
          items,
          page,
          pageSize: Number(url.searchParams.get("pageSize")),
          total: 3,
        })
      }
      if (method === "POST" && url.pathname === "/api/v1/admin/categories")
        return json(409, {
          error: {
            code: "CONFLICT",
            message: "Another category already uses this address",
            fieldErrors: { slug: ["Already used"] },
          },
        })
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    }
  )
  vi.stubGlobal("fetch", fetchMock)
})

function renderScreen(roles: Role[] = ["editor"]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u",
          name: "U",
          email: "u@x.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <CollectionScreen name="categories" />
    </AdminShell>
  )
}

const lastUrl = () =>
  new URL(String(fetchMock.mock.calls.at(-1)![0]), "http://localhost")

describe("collection screen + data table (master 4.6)", () => {
  it("pages and sorts on the server and renders table rows and phone cards", async () => {
    const user = userEvent.setup()
    renderScreen()
    const table = await screen.findByRole("table", { name: "Categories" })
    expect(within(table).getAllByRole("row")).toHaveLength(3)
    expect(screen.getByRole("list", { name: "Categories" })).toBeInTheDocument()
    expect(lastUrl().searchParams.get("sort")).toBeNull()

    await user.click(within(table).getByRole("button", { name: /Name/ }))
    await waitFor(() =>
      expect(lastUrl().searchParams.get("sort")).toBe("name:asc")
    )
    expect(
      within(table).getByRole("columnheader", { name: /Name/ })
    ).toHaveAttribute("aria-sort", "ascending")

    const pager = screen.getByRole("navigation", { name: "Pagination" })
    expect(pager).toHaveTextContent("1–3 of 3")
    expect(within(pager).getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("searches with a debounced query", async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    await user.type(
      screen.getByRole("searchbox", { name: "Search categories" }),
      "news"
    )
    await waitFor(() => expect(lastUrl().searchParams.get("q")).toBe("news"))
  })

  it("shows the server's field error when creating a duplicate", async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Categories" })
    await user.click(screen.getByRole("button", { name: "Add category" }))
    const sheet = await screen.findByRole("dialog", { name: "Category" })
    await user.type(
      within(sheet).getByRole("textbox", { name: "Address" }),
      "cat-1"
    )
    await user.type(within(sheet).getByRole("textbox", { name: "Name" }), "Dup")
    await user.click(within(sheet).getByRole("button", { name: "Save" }))
    expect(await within(sheet).findByText("Already used")).toBeInTheDocument()
  })

  it("hides add/order buttons without permission", async () => {
    renderScreen(["viewer"])
    await screen.findByRole("table", { name: "Categories" })
    expect(screen.queryByRole("button", { name: "Add category" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Change order" })).toBeNull()
  })
})

describe("SortableList (keyboard alternative to dragging)", () => {
  it("moves items with the Move buttons and keeps focus on the moved item", async () => {
    const user = userEvent.setup()
    const onReorder = vi.fn()
    const items = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Bravo" },
      { id: "c", label: "Charlie" },
    ]
    const { rerender } = render(
      <SortableList label="Order" items={items} onReorder={onReorder} />
    )
    screen.getByRole("button", { name: "Move Alpha down" }).focus()
    await user.keyboard("{Enter}")
    const next = onReorder.mock.calls[0][0] as typeof items
    expect(next.map((i) => i.id)).toEqual(["b", "a", "c"])
    rerender(<SortableList label="Order" items={next} onReorder={onReorder} />)
    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName("Move Alpha down")
    )
    expect(screen.getByRole("button", { name: "Move Bravo up" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Drag to reorder Charlie" })
    ).toHaveAttribute("aria-roledescription", "sortable")
  })
})

describe("slugify", () => {
  it.each([
    ["Event Security", "event-security"],
    ["Mobile Patrols & Key Holding", "mobile-patrols-and-key-holding"],
    ["  Café  24/7 ", "cafe-24-7"],
  ])("%s → %s", (title, slug) => expect(slugify(title)).toBe(slug))
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --project dom tests/dom/collections.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/collections/collection-screen"`.

- [ ] **Step 3: Data table and sortable list**

`components/admin/data-table/data-table.tsx`:

```tsx
"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  type ColumnDef,
  createColumnHelper,
  type PaginationState,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, Search } from "lucide-react"
import { type ReactNode, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { errorMessage } from "@/lib/api-client"
import type { Paginated } from "@/lib/schemas/api/list"
import { cn } from "@/lib/utils"

/**
 * Server-side pagination + sorting (TanStack Table v9, notes §4.1): no
 * sorted/paginated row models, so the table only renders what the API
 * returned for the current page.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
})
export type DataTableFeatures = typeof dataTableFeatures

/** Column helper bound to the admin table features. */
export const columnsFor = <T extends Record<string, unknown>>() =>
  createColumnHelper<DataTableFeatures, T>()

export type DataTableColumns<T extends Record<string, unknown>> = ColumnDef<
  DataTableFeatures,
  T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columns of mixed value types
  any
>[]

export type DataTableParams = {
  page: number
  pageSize: number
  sort?: string
  q?: string
}

const PAGE_SIZE = 20

/**
 * Admin list: search, sortable headers, pagination; a table from 640 px
 * and cards below it (spec §8.2 "tables → cards on phones").
 */
export function DataTable<T extends Record<string, unknown> & { id: string }>({
  label,
  queryKey,
  fetchPage,
  columns,
  renderCard,
  initialSort,
  searchPlaceholder = "Search",
  empty,
}: {
  /** Accessible name (table caption, list label). */
  label: string
  queryKey: readonly unknown[]
  fetchPage: (params: DataTableParams) => Promise<Paginated<T>>
  /** Module-scope (stable) column definitions. */
  columns: DataTableColumns<T>
  renderCard: (row: T) => ReactNode
  initialSort?: SortingState
  searchPlaceholder?: string
  empty: ReactNode
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? [])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 250)
  const sort = sorting[0]
    ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
    : undefined
  const params: DataTableParams = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sort,
    q: q || undefined,
  }

  const query = useQuery({
    queryKey: [...queryKey, "list", params],
    queryFn: () => fetchPage(params),
    placeholderData: keepPreviousData,
  })
  const rows = query.data?.items ?? EMPTY_ROWS
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows as T[],
    rowCount: query.data?.total ?? 0,
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting(updater)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
  })

  const total = query.data?.total ?? 0
  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder={searchPlaceholder}
          className="pl-8"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPagination((p) => ({ ...p, pageIndex: 0 }))
          }}
        />
      </div>

      {query.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border p-6"
        >
          <p className="text-sm">{errorMessage(query.error)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : query.isPending ? (
        <div
          className="flex flex-col gap-2"
          aria-busy="true"
          aria-label={`Loading ${label.toLowerCase()}`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Inbox aria-hidden className="size-6" />
          {q ? `Nothing matches “${q}”.` : empty}
        </div>
      ) : (
        <>
          <div
            className={cn(
              "hidden overflow-x-auto rounded-xl border bg-card sm:block",
              query.isPlaceholderData && "opacity-60"
            )}
          >
            <table className="w-full text-sm">
              <caption className="sr-only">{label}</caption>
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const sortable = header.column.getCanSort()
                      const dir = header.column.getIsSorted()
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            dir === "asc"
                              ? "ascending"
                              : dir === "desc"
                                ? "descending"
                                : sortable
                                  ? "none"
                                  : undefined
                          }
                          className="px-4 py-3 font-semibold"
                        >
                          {header.isPlaceholder ? null : sortable ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 rounded uppercase outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <table.FlexRender header={header} />
                              {dir === "asc" ? (
                                <ArrowUp aria-hidden className="size-3.5" />
                              ) : dir === "desc" ? (
                                <ArrowDown aria-hidden className="size-3.5" />
                              ) : (
                                <ArrowUpDown
                                  aria-hidden
                                  className="size-3.5 opacity-50"
                                />
                              )}
                            </button>
                          ) : (
                            <table.FlexRender header={header} />
                          )}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul aria-label={label} className="flex flex-col gap-2 sm:hidden">
            {rows.map((row) => (
              <li key={row.id}>{renderCard(row as T)}</li>
            ))}
          </ul>
        </>
      )}

      <nav
        aria-label="Pagination"
        className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
      >
        <span aria-live="polite">
          {total === 0 ? "No results" : `${from}–${to} of ${total}`}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      </nav>
    </div>
  )
}

const EMPTY_ROWS: never[] = []
```

`components/admin/sortable-list.tsx`:

```tsx
"use client"

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react"
import { useId, useRef } from "react"

import { Button } from "@/components/ui/button"

export type SortableItem = { id: string; label: string; description?: string }

/**
 * Reorder records (sortOrder) by drag, keyboard (space + arrows) or the
 * Move up / Move down buttons (WCAG 2.2 SC 2.5.7 single-pointer
 * alternative). Calls `onReorder` with the full new order.
 */
export function SortableList({
  label,
  items,
  onReorder,
  disabled = false,
}: {
  label: string
  items: SortableItem[]
  onReorder: (next: SortableItem[]) => void
  disabled?: boolean
}) {
  const dndId = useId()
  const listRef = useRef<HTMLOListElement>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const nameOf = (id: string | number) =>
    items.find((i) => i.id === id)?.label ?? String(id)
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${nameOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at the place of ${nameOf(over.id)}.`
        : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} cancelled.`,
  }

  function move(from: number, to: number, focus?: "up" | "down") {
    if (to < 0 || to >= items.length || from === to) return
    const id = items[from].id
    onReorder(arrayMove(items, from, to))
    if (focus)
      requestAnimationFrame(() =>
        listRef.current
          ?.querySelector<HTMLElement>(`[data-focus-key="${id}:${focus}"]`)
          ?.focus()
      )
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    move(
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id)
    )
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Press space to pick up. Use the arrow keys to move, space to drop, escape to cancel. Or use the Move up and Move down buttons.",
        },
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol ref={listRef} aria-label={label} className="flex flex-col gap-2">
          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              index={index}
              count={items.length}
              disabled={disabled}
              onMove={(to, focus) => move(index, to, focus)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function Row({
  item,
  index,
  count,
  disabled,
  onMove,
}: {
  item: SortableItem
  index: number
  count: number
  disabled: boolean
  onMove: (to: number, focus: "up" | "down") => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border bg-card p-2 ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${item.label}`}
        className="flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{item.label}</span>
        {item.description ? (
          <span className="truncate text-xs text-muted-foreground">
            {item.description}
          </span>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${item.label} up`}
        data-focus-key={`${item.id}:up`}
        disabled={disabled || index === 0}
        onClick={() => onMove(index - 1, "up")}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${item.label} down`}
        data-focus-key={`${item.id}:down`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(index + 1, "down")}
      >
        <ArrowDown aria-hidden />
      </Button>
    </li>
  )
}
```

- [ ] **Step 4: Collection screens**

`components/admin/collections/reorder-panel.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import {
  type SortableItem,
  SortableList,
} from "@/components/admin/sortable-list"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { Reorderable } from "@/lib/schemas/api/collections"

/**
 * Display-order editor for a whole collection: drag or move items, then
 * "Save order" (PUT /reorder/:collection). The site updates immediately.
 */
export function ReorderPanel({
  collection,
  label,
  queryKey,
  load,
  onDone,
}: {
  collection: Reorderable
  label: string
  queryKey: readonly unknown[]
  /** Every record in the current display order. */
  load: () => Promise<SortableItem[]>
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const all = useQuery({
    queryKey: [...queryKey, "all"],
    queryFn: load,
    staleTime: 0,
  })
  const [order, setOrder] = useState<SortableItem[] | null>(null)
  const items = order ?? all.data ?? []
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.reorder[":collection"].$put({
          param: { collection },
          json: { ids: items.map((i) => i.id) },
        })
      ),
    onSuccess: async () => {
      toast.success("Order saved", {
        description: "The site shows the new order now.",
      })
      await queryClient.invalidateQueries({ queryKey })
      onDone()
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.isConflict) {
        toast.error("The list changed meanwhile", {
          description: "It was reloaded. Arrange it again and save.",
        })
        setOrder(null)
        await all.refetch()
        return
      }
      toast.error("Order not saved", { description: errorMessage(error) })
    },
  })
  if (all.isPending)
    return (
      <div
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Loading"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  if (all.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(all.error)}
      </p>
    )
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Drag the handle, or use the arrow buttons. Keyboard: focus a handle,
        press space, use the arrow keys, press space again.
      </p>
      <SortableList
        label={label}
        items={items}
        onReorder={setOrder}
        disabled={save.isPending}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={order === null || save.isPending}
          onClick={() => save.mutate()}
        >
          Save order
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
```

`components/admin/collections/record-sheet.tsx`:

```tsx
"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { issuesToFieldErrors } from "@/components/admin/editor/versioned-editor"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ApiError, errorMessage } from "@/lib/api-client"

/**
 * Create/edit one small-collection record in a side sheet. Saving publishes
 * immediately (spec §5.3); the same Zod schema validates here and on the API.
 */
export function RecordSheet({
  open,
  onOpenChange,
  title,
  description,
  schema,
  meta,
  initial,
  onSave,
  onDelete,
  deleteLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  schema: z.ZodObject
  meta: EditorMeta
  initial: unknown
  onSave: (value: unknown) => Promise<unknown>
  /** Omitted for new records or without delete permission. */
  onDelete?: () => Promise<unknown>
  deleteLabel?: string
}) {
  const [value, setValue] = useState<unknown>(initial)
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useMutation({
    mutationFn: () => {
      const parsed = schema.safeParse(value)
      if (!parsed.success) {
        setErrors(issuesToFieldErrors(parsed.error))
        throw new Error("Some fields need attention")
      }
      return onSave(parsed.data)
    },
    onSuccess: () => {
      toast.success(`${title} saved`, {
        description: "The site shows the change now.",
      })
      onOpenChange(false)
    },
    onError: (error) => {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length)
        setErrors(error.fieldErrors)
      toast.error("Not saved", {
        description:
          error instanceof ApiError || !(error instanceof Error)
            ? errorMessage(error)
            : error.message,
      })
    },
  })
  const remove = useMutation({
    mutationFn: () => onDelete!(),
    onSuccess: () => {
      toast.success(`${title} deleted`)
      setConfirmDelete(false)
      onOpenChange(false)
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error("Not deleted", { description: errorMessage(error) })
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <SchemaForm
            schema={schema}
            meta={meta}
            value={value as never}
            onChange={setValue}
            errors={errors}
            idPrefix="record"
          />
        </div>
        <SheetFooter className="flex-row justify-between border-t">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              {deleteLabel ?? "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {title.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the site straight away. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
```

`components/admin/collections/media-thumb.tsx`:

```tsx
"use client"

import { ImageIcon } from "lucide-react"

import { useMediaItem } from "@/components/admin/media/use-media-item"

/** Small library thumbnail for list cells and cards. */
export function MediaThumb({
  mediaId,
  size = 40,
}: {
  mediaId: string | null | undefined
  size?: number
}) {
  const item = useMediaItem(mediaId)
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40"
    >
      {item.data ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
        <img
          src={item.data.url}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <ImageIcon aria-hidden className="size-4 text-muted-foreground" />
      )}
    </span>
  )
}
```

`components/admin/collections/configs.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import type { z } from "zod"

import {
  columnsFor,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import { Badge } from "@/components/ui/badge"
import {
  type CategoryItem,
  type ClientItem,
  type CollectionName,
  collectionSchemas,
  type GroupCompanyItem,
  type TeamItem,
} from "@/lib/schemas/api/collections"
import { formatDateTime } from "@/lib/format"

import { MediaThumb } from "./media-thumb"

export type AnyItem = (
  TeamItem | ClientItem | GroupCompanyItem | CategoryItem
) &
  Record<string, unknown>

export type CollectionConfig = {
  title: string
  singular: string
  description: string
  schema: z.ZodObject
  meta: EditorMeta
  columns: DataTableColumns<AnyItem>
  /** Phone card content. */
  card: (item: AnyItem) => ReactNode
  /** Label in the reorder list. */
  itemLabel: (item: AnyItem) => string
  /** Blank record for "Add". */
  blank: () => unknown
  /** Record → form value (drops id/sortOrder/updatedAt/articleCount). */
  toForm: (item: AnyItem) => unknown
  empty: string
}

const team = columnsFor<TeamItem & Record<string, unknown>>()
const clients = columnsFor<ClientItem & Record<string, unknown>>()
const groups = columnsFor<GroupCompanyItem & Record<string, unknown>>()
const categories = columnsFor<CategoryItem & Record<string, unknown>>()

const updated = (value: string) => (
  <span className="text-muted-foreground">{formatDateTime(value)}</span>
)
const pick = (item: AnyItem, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, item[k]]))

// Column definitions live at module scope (TanStack Table v9 needs stable references).
export const COLLECTION_CONFIGS: Record<CollectionName, CollectionConfig> = {
  team: {
    title: "Team",
    singular: "Team member",
    description:
      "People shown on the Team page and the home page, in this order.",
    schema: collectionSchemas.team,
    meta: {
      fields: {
        bio: { label: "Short bio" },
        photo: {
          label: "Photo",
          help: "Optional. Without a photo the placeholder from the Team page is shown.",
        },
      },
    },
    columns: team.columns([
      team.accessor("name", {
        header: "Name",
        cell: (info) => (
          <span className="flex items-center gap-3">
            <MediaThumb mediaId={info.row.original.photo?.mediaId} size={32} />
            <span className="font-medium">{info.getValue()}</span>
          </span>
        ),
      }),
      team.accessor("role", { header: "Role", enableSorting: false }),
      team.accessor("email", { header: "Email", enableSorting: false }),
      team.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => updated(info.getValue()),
      }),
    ]) as unknown as DataTableColumns<AnyItem>,
    card: (item) => {
      const t = item as TeamItem
      return (
        <span className="flex items-center gap-3">
          <MediaThumb mediaId={t.photo?.mediaId} />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">{t.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {t.role}
            </span>
          </span>
        </span>
      )
    },
    itemLabel: (item) => String(item.name),
    blank: () => emptyValue(collectionSchemas.team),
    toForm: (item) => pick(item, ["name", "role", "bio", "email", "photo"]),
    empty: "No team members yet.",
  },
  clients: {
    title: "Clients",
    singular: "Client",
    description: "Logos in the clients strip, in this order.",
    schema: collectionSchemas.clients,
    meta: {
      fields: {
        logo: { label: "Logo" },
        url: { label: "Website", help: "Optional, https://…" },
      },
    },
    columns: clients.columns([
      clients.accessor("name", {
        header: "Client",
        cell: (info) => (
          <span className="flex items-center gap-3">
            <MediaThumb mediaId={info.row.original.logo.mediaId} size={32} />
            <span className="font-medium">{info.getValue()}</span>
          </span>
        ),
      }),
      clients.accessor("url", {
        header: "Website",
        enableSorting: false,
        cell: (info) => info.getValue() ?? "—",
      }),
      clients.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => updated(info.getValue()),
      }),
    ]) as unknown as DataTableColumns<AnyItem>,
    card: (item) => {
      const c = item as ClientItem
      return (
        <span className="flex items-center gap-3">
          <MediaThumb mediaId={c.logo.mediaId} />
          <span className="font-medium">{c.name}</span>
        </span>
      )
    },
    itemLabel: (item) => String(item.name),
    blank: () => emptyValue(collectionSchemas.clients),
    toForm: (item) => pick(item, ["name", "logo", "url"]),
    empty: "No clients yet.",
  },
  "group-companies": {
    title: "Group companies",
    singular: "Group company",
    description: "“Other services in the group” in the footer, in this order.",
    schema: collectionSchemas["group-companies"],
    meta: {
      fields: {
        site: {
          label: "Website domain",
          help: "Domain only, e.g. www.example.ie.",
        },
        logo: { label: "Logo" },
      },
    },
    columns: groups.columns([
      groups.accessor("name", {
        header: "Company",
        cell: (info) => (
          <span className="flex items-center gap-3">
            <MediaThumb mediaId={info.row.original.logo.mediaId} size={32} />
            <span className="font-medium">{info.getValue()}</span>
          </span>
        ),
      }),
      groups.accessor("phone", { header: "Phone", enableSorting: false }),
      groups.accessor("site", { header: "Website", enableSorting: false }),
      groups.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => updated(info.getValue()),
      }),
    ]) as unknown as DataTableColumns<AnyItem>,
    card: (item) => {
      const g = item as GroupCompanyItem
      return (
        <span className="flex items-center gap-3">
          <MediaThumb mediaId={g.logo.mediaId} />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">{g.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {g.site}
            </span>
          </span>
        </span>
      )
    },
    itemLabel: (item) => String(item.name),
    blank: () => emptyValue(collectionSchemas["group-companies"]),
    toForm: (item) => pick(item, ["name", "phone", "site", "logo"]),
    empty: "No group companies yet.",
  },
  categories: {
    title: "Categories",
    singular: "Category",
    description:
      "Article categories. Those shown in the filter appear on the blog page, in this order.",
    schema: collectionSchemas.categories,
    meta: {
      fields: {
        slug: {
          label: "Address",
          help: "Used in /blog?category=…: lowercase letters, numbers and hyphens.",
        },
        showInFilter: { label: "Show in the blog filter" },
      },
    },
    columns: categories.columns([
      categories.accessor("name", {
        header: "Name",
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      categories.accessor("slug", { header: "Address", enableSorting: false }),
      categories.accessor("showInFilter", {
        header: "In filter",
        enableSorting: false,
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="secondary">Shown</Badge>
          ) : (
            <Badge variant="outline">Hidden</Badge>
          ),
      }),
      categories.accessor("articleCount", {
        header: "Articles",
        enableSorting: false,
      }),
    ]) as unknown as DataTableColumns<AnyItem>,
    card: (item) => {
      const c = item as CategoryItem
      return (
        <span className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground">
            {c.articleCount} article{c.articleCount === 1 ? "" : "s"} ·{" "}
            {c.showInFilter ? "in filter" : "not in filter"}
          </span>
        </span>
      )
    },
    itemLabel: (item) => String(item.name),
    blank: () => emptyValue(collectionSchemas.categories),
    toForm: (item) => pick(item, ["slug", "name", "showInFilter"]),
    empty: "No categories yet.",
  },
}
```

`components/admin/collections/collection-screen.tsx`:

```tsx
"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ArrowUpDown, Pencil, Plus } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import {
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"
import type { CollectionName } from "@/lib/schemas/api/collections"
import type { Paginated } from "@/lib/schemas/api/list"

import { type AnyItem, COLLECTION_CONFIGS } from "./configs"
import { RecordSheet } from "./record-sheet"
import { ReorderPanel } from "./reorder-panel"

type ApiParams = { page: string; pageSize: string; sort?: string; q?: string }

/** The four collection routers share one shape; typed loosely so one screen serves all. */
type CollectionClient = {
  $get: (args: { query: ApiParams }) => Promise<Response>
  $post: (args: { json: unknown }) => Promise<Response>
  ":id": {
    $get: (args: { param: { id: string } }) => Promise<Response>
    $put: (args: { param: { id: string }; json: unknown }) => Promise<Response>
    $delete: (args: { param: { id: string } }) => Promise<Response>
  }
}

function client(name: CollectionName) {
  const c = api[name] as unknown as CollectionClient
  return {
    list: (query: ApiParams) => unwrap<Paginated<AnyItem>>(c.$get({ query })),
    create: (json: unknown) => unwrap<AnyItem>(c.$post({ json })),
    update: (id: string, json: unknown) =>
      unwrap<AnyItem>(c[":id"].$put({ param: { id }, json })),
    remove: (id: string) =>
      unwrap<{ ok: true }>(c[":id"].$delete({ param: { id } })),
    get: (id: string) => unwrap<AnyItem>(c[":id"].$get({ param: { id } })),
  }
}

/**
 * List + edit screen for one small collection (master 4.6): server-paged
 * table (cards on phones), add/edit in a sheet, delete, reorder.
 * `?edit=<id>` opens a record (⌘K results link here).
 */
export function CollectionScreen({ name }: { name: CollectionName }) {
  const config = COLLECTION_CONFIGS[name]
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const canCreate = usePermission({ collection: ["create"] })
  const canUpdate = usePermission({ collection: ["update"] })
  const canDelete = usePermission({ collection: ["delete"] })
  const [reordering, setReordering] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AnyItem | null>(null)
  const editId = searchParams.get("edit")
  const api = client(name)
  const queryKey = ["collections", name] as const

  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const closeEdit = () => {
    setEditing(null)
    if (editId) router.replace(pathname)
  }

  const columns: DataTableColumns<AnyItem> = [
    ...config.columns,
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${config.itemLabel(row.original)}`}
          onClick={() => setEditing(row.original)}
        >
          <Pencil aria-hidden />
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setReordering((v) => !v)}
                aria-pressed={reordering}
              >
                <ArrowUpDown aria-hidden />
                {reordering ? "Back to list" : "Change order"}
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Add {config.singular.toLowerCase()}
              </Button>
            ) : null}
          </>
        }
      />
      {reordering ? (
        <ReorderPanel
          collection={name}
          label={`${config.title} order`}
          queryKey={queryKey}
          load={async () => {
            const page = await api.list({
              page: "1",
              pageSize: "100",
              sort: "sortOrder:asc",
            })
            return page.items.map((item) => ({
              id: item.id,
              label: config.itemLabel(item),
            }))
          }}
          onDone={() => setReordering(false)}
        />
      ) : (
        <DataTable<AnyItem>
          label={config.title}
          queryKey={queryKey}
          fetchPage={async (params) => {
            return api.list({
              page: String(params.page),
              pageSize: String(params.pageSize),
              sort: params.sort,
              q: params.q,
            })
          }}
          columns={columns}
          renderCard={(item) => (
            <button
              type="button"
              onClick={() => setEditing(item)}
              className="w-full rounded-xl border bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={`Edit ${config.itemLabel(item)}`}
            >
              {config.card(item)}
            </button>
          )}
          empty={config.empty}
        />
      )}
      {creating ? (
        <RecordSheet
          open
          onOpenChange={(open) => !open && setCreating(false)}
          title={config.singular}
          description={`New ${config.singular.toLowerCase()}. It appears on the site as soon as you save.`}
          schema={config.schema}
          meta={config.meta}
          initial={config.blank()}
          onSave={async (value) => {
            await api.create(value)
            await refresh()
          }}
        />
      ) : null}
      <EditSheet
        key={editing?.id ?? editId ?? "none"}
        name={name}
        item={editing}
        editId={editing ? null : editId}
        canEdit={canUpdate}
        canDelete={canDelete}
        onClose={closeEdit}
        onSaved={refresh}
      />
    </>
  )
}

function EditSheet({
  name,
  item,
  editId,
  canEdit,
  canDelete,
  onClose,
  onSaved,
}: {
  name: CollectionName
  item: AnyItem | null
  editId: string | null
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  onSaved: () => Promise<unknown>
}) {
  const config = COLLECTION_CONFIGS[name]
  const api = client(name)
  const [loaded, setLoaded] = useState<AnyItem | null>(null)
  const [requested, setRequested] = useState<string | null>(null)
  if (editId && requested !== editId) {
    setRequested(editId)
    void api.get(editId).then(setLoaded, onClose)
  }
  const record = item ?? loaded
  if (!record || !canEdit) return null
  return (
    <RecordSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={config.singular}
      description="Changes appear on the site as soon as you save."
      schema={config.schema}
      meta={config.meta}
      initial={config.toForm(record)}
      onSave={async (value) => {
        await api.update(record.id, value)
        await onSaved()
      }}
      onDelete={
        canDelete
          ? async () => {
              await api.remove(record.id)
              await onSaved()
            }
          : undefined
      }
      deleteLabel={`Delete ${config.singular.toLowerCase()}`}
    />
  )
}
```

`app/(admin)/admin/(panel)/team/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { CollectionScreen } from "@/components/admin/collections/collection-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Team" }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ collection: ["read"] })
  return <CollectionScreen name="team" />
}
```

The other three screens are the same file with two substitutions:

| File | `metadata.title` | `name` prop |
|---|---|---|
| `app/(admin)/admin/(panel)/clients/page.tsx` | `"Clients"` | `"clients"` |
| `app/(admin)/admin/(panel)/group-companies/page.tsx` | `"Group companies"` | `"group-companies"` |
| `app/(admin)/admin/(panel)/categories/page.tsx` | `"Categories"` | `"categories"` |

- [ ] **Step 5: Services screens**

`components/admin/services/service-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor hints for a service (card on /services + its own page). */
export const serviceEditorMeta: EditorMeta = {
  fields: {
    title: { label: "Name" },
    description: { label: "Card text", help: "Shown on the service card." },
    icon: { label: "Card icon" },
    heroImage: { label: "Page banner image" },
    image: { label: "Page image" },
    imageAlt: { label: "Page image description (alt text)" },
    detail: { label: "Service page", section: true },
    "detail.intro": { label: "Introduction", widget: "textarea" },
    "detail.heading": { label: "Heading" },
    "detail.overview": { label: "Overview" },
    "detail.included": { label: "What's included", itemName: "Item" },
    "detail.callout": { label: "Callout", widget: "textarea" },
  },
}
```

`components/admin/services/services-screen.tsx`:

```tsx
"use client"

import { ArrowUpDown, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ReorderPanel } from "@/components/admin/collections/reorder-panel"
import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { statusLabel } from "@/components/admin/editor/editor-layout"
import { PageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonClassName } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { ServiceListItem } from "@/lib/schemas/api/services"

type Row = ServiceListItem & Record<string, unknown>
const ch = columnsFor<Row>()

const columns = ch.columns([
  ch.accessor("title", {
    header: "Service",
    cell: (info) => (
      <Link
        href={`/admin/services/${info.row.original.id}`}
        className="font-medium hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  ch.accessor("slug", {
    header: "Address",
    enableSorting: false,
    cell: (info) => (
      <span className="text-muted-foreground">/services/{info.getValue()}</span>
    ),
  }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = statusLabel({
        published: row.original.publishedAt ? true : null,
        dirty: row.original.dirty,
      })
      return <Badge variant={s.variant}>{s.text}</Badge>
    },
  }),
  ch.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => (
      <span className="text-muted-foreground">
        {formatDateTime(info.getValue())}
      </span>
    ),
  }),
]) as unknown as DataTableColumns<Row>

const queryKey = ["services"] as const

/** Services list (draft/publish records), new service, display order. */
export function ServicesScreen() {
  const canCreate = usePermission({ service: ["create"] })
  const canUpdate = usePermission({ service: ["update"] })
  const [reordering, setReordering] = useState(false)
  return (
    <>
      <PageHeader
        title="Services"
        description="Each service has a card on /services and its own page. Edits are drafts until published."
        actions={
          <>
            {canUpdate ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setReordering((v) => !v)}
                aria-pressed={reordering}
              >
                <ArrowUpDown aria-hidden />
                {reordering ? "Back to list" : "Change order"}
              </Button>
            ) : null}
            {canCreate ? (
              <Link href="/admin/services/new" className={buttonClassName({})}>
                <Plus aria-hidden />
                New service
              </Link>
            ) : null}
          </>
        }
      />
      {reordering ? (
        <ReorderPanel
          collection="services"
          label="Services order"
          queryKey={queryKey}
          load={async () => {
            const page = await unwrap(
              api.services.$get({
                query: { page: "1", pageSize: "100", sort: "sortOrder:asc" },
              })
            )
            return page.items.map((s) => ({
              id: s.id,
              label: s.title,
              description: `/services/${s.slug}`,
            }))
          }}
          onDone={() => setReordering(false)}
        />
      ) : (
        <DataTable<Row>
          label="Services"
          queryKey={queryKey}
          fetchPage={async (params) =>
            (await unwrap(
              api.services.$get({
                query: {
                  page: String(params.page),
                  pageSize: String(params.pageSize),
                  sort: params.sort,
                  q: params.q,
                },
              })
            )) as {
              items: Row[]
              page: number
              pageSize: number
              total: number
            }
          }
          columns={columns}
          renderCard={(row) => {
            const s = statusLabel({
              published: row.publishedAt ? true : null,
              dirty: row.dirty,
            })
            return (
              <Link
                href={`/admin/services/${row.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{row.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    /services/{row.slug}
                  </span>
                </span>
                <Badge variant={s.variant}>{s.text}</Badge>
              </Link>
            )
          }}
          empty="No services yet."
        />
      )}
    </>
  )
}
```

`components/admin/services/service-editor.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { previewHref } from "@/lib/schemas/api/preview"
import type { ServiceDto } from "@/lib/schemas/api/services"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { serviceContent } from "@/lib/schemas/content/service"

import { serviceEditorMeta } from "./service-meta"

/** Draft editor for one service + its address (slug) and delete (master 4.6). */
export function ServiceEditor({ id }: { id: string }) {
  const canEdit = usePermission({ service: ["update"] })
  const canPublish = usePermission({ service: ["publish"] })
  const canDelete = usePermission({ service: ["delete"] })
  const queryKey = ["services", id] as const
  const record = useQuery({
    queryKey,
    queryFn: () => unwrap(api.services[":id"].$get({ param: { id } })),
  })
  const param = { id }
  return (
    <VersionedEditor<ServiceDto>
      title={record.data?.title ?? "Service"}
      backHref="/admin/services"
      backLabel="All services"
      queryKey={queryKey}
      load={() => unwrap(api.services[":id"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api.services[":id"].draft.$put({ param, json: { draft, version } })
        )
      }
      publish={(version) =>
        unwrap(api.services[":id"].publish.$post({ param, json: { version } }))
      }
      restore={(revisionId, version) =>
        unwrap(
          api.services[":id"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={serviceContent}
      meta={serviceEditorMeta}
      revisions={{ entity: "service", id }}
      previewHref={previewHref("service", id)}
      publicHref={record.data ? `/services/${record.data.slug}` : undefined}
      canEdit={canEdit}
      canPublish={canPublish}
      actions={
        canDelete && record.data ? (
          <DeleteService service={record.data} />
        ) : null
      }
      aside={
        record.data ? (
          <SlugCard service={record.data} canEdit={canEdit} />
        ) : null
      }
    />
  )
}

function SlugCard({
  service,
  canEdit,
}: {
  service: ServiceDto
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState(service.slug)
  const [error, setError] = useState<string | null>(null)
  const change = useMutation({
    mutationFn: () =>
      unwrap(
        api.services[":id"].slug.$patch({
          param: { id: service.id },
          json: { slug, version: service.version },
        })
      ),
    onSuccess: (dto) => {
      queryClient.setQueryData(["services", service.id], dto)
      toast.success("Address changed", {
        description: `The page is now at /services/${dto.slug}.`,
      })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isConflict && err.fieldErrors.slug)
        setError(err.fieldErrors.slug[0])
      else if (err instanceof ApiError && err.isConflict)
        setError(
          "The service changed meanwhile. Reload the page and try again."
        )
      else setError(errorMessage(err))
    },
  })
  const valid = SLUG_PATTERN.test(slug)
  return (
    <section
      aria-labelledby="slug-title"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <h2 id="slug-title" className="text-sm font-bold">
        Page address
      </h2>
      <label htmlFor="service-slug" className="text-xs text-muted-foreground">
        /services/…
      </label>
      <Input
        id="service-slug"
        value={slug}
        disabled={!canEdit}
        aria-invalid={!valid || !!error}
        aria-describedby="service-slug-help"
        onChange={(event) => {
          setSlug(event.target.value)
          setError(null)
        }}
      />
      <p
        id="service-slug-help"
        className={
          error || !valid
            ? "text-xs text-destructive"
            : "text-xs text-muted-foreground"
        }
      >
        {error ??
          (valid
            ? "Changing it moves the live page immediately."
            : "Lowercase letters, numbers and single hyphens.")}
      </p>
      {canEdit ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!valid || slug === service.slug || change.isPending}
          onClick={() => change.mutate()}
        >
          Change address
        </Button>
      ) : null}
    </section>
  )
}

function DeleteService({ service }: { service: ServiceDto }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        api.services[":id"].$delete({
          param: { id: service.id },
          query: { version: String(service.version) },
        })
      ),
    onSuccess: async () => {
      toast.success(`${service.title} deleted`)
      await queryClient.invalidateQueries({ queryKey: ["services"] })
      router.push("/admin/services")
    },
    onError: (err) => {
      setOpen(false)
      toast.error("Not deleted", { description: errorMessage(err) })
    },
  })
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {service.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The card and the page /services/{service.slug} disappear from the
              site. Links to it will show “not found”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete service
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

`components/admin/services/new-service-form.tsx`:

```tsx
"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { issuesToFieldErrors } from "@/components/admin/editor/versioned-editor"
import { PageHeader } from "@/components/admin/page-header"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { serviceContent } from "@/lib/schemas/content/service"

import { serviceEditorMeta } from "./service-meta"

/** Address from a title: "Event Security" → "event-security". */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** New service: full form, saved as an unpublished draft, then the editor opens. */
export function NewServiceForm() {
  const router = useRouter()
  const [draft, setDraft] = useState<unknown>(() => emptyValue(serviceContent))
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>()
  const title = (draft as { title?: string }).title ?? ""
  const effectiveSlug = slugTouched ? slug : slugify(title)
  const create = useMutation({
    mutationFn: () => {
      const parsed = serviceContent.safeParse(draft)
      if (!parsed.success) {
        setErrors(issuesToFieldErrors(parsed.error))
        throw new Error("Fill in the marked fields first.")
      }
      return unwrap(
        api.services.$post({
          json: { slug: effectiveSlug, draft: parsed.data },
        })
      )
    },
    onSuccess: (dto) => {
      toast.success("Service created", {
        description: "It is a draft until you publish it.",
      })
      router.push(`/admin/services/${dto.id}`)
    },
    onError: (err) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors)
      toast.error("Not created", {
        description: err instanceof ApiError ? errorMessage(err) : err.message,
      })
    },
  })
  const slugValid = SLUG_PATTERN.test(effectiveSlug)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New service"
        description="Fill in the card and page. It stays a draft until you publish it from the editor."
        actions={
          <Button
            type="button"
            disabled={create.isPending || !slugValid}
            onClick={() => create.mutate()}
          >
            Create draft
          </Button>
        }
      />
      <section
        aria-labelledby="new-slug"
        className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:p-6"
      >
        <h2 id="new-slug" className="text-base font-bold">
          Page address
        </h2>
        <label
          htmlFor="new-service-slug"
          className="text-sm text-muted-foreground"
        >
          /services/…
        </label>
        <Input
          id="new-service-slug"
          className="max-w-md"
          value={effectiveSlug}
          aria-invalid={!slugValid || !!errors?.slug}
          onChange={(event) => {
            setSlugTouched(true)
            setSlug(event.target.value)
          }}
        />
        {errors?.slug ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.slug[0]}
          </p>
        ) : null}
      </section>
      <SchemaForm
        schema={serviceContent}
        meta={serviceEditorMeta}
        value={draft as never}
        onChange={setDraft}
        errors={errors}
      />
    </div>
  )
}
```

`app/(admin)/admin/(panel)/services/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { ServicesScreen } from "@/components/admin/services/services-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Services" }

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ service: ["read"] })
  return <ServicesScreen />
}
```

`app/(admin)/admin/(panel)/services/new/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { NewServiceForm } from "@/components/admin/services/new-service-form"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "New service" }

export default function NewServicePage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ service: ["create"] })
  return <NewServiceForm />
}
```

`app/(admin)/admin/(panel)/services/[id]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"

import { ServiceEditor } from "@/components/admin/services/service-editor"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Edit service" }

export default function EditServicePage({
  params,
}: PageProps<"/admin/services/[id]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({
  params,
}: Pick<PageProps<"/admin/services/[id]">, "params">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  await requirePermission({ service: ["read"] })
  return <ServiceEditor id={id} />
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec next typegen && pnpm exec vitest run --project dom tests/dom/collections.test.tsx`
Expected: PASS (8 tests: server paging/sort + cards, debounced search, 409 field error in the sheet, permission-hidden buttons, keyboard reorder with focus, 3 slugify cases).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0; `/admin/{team,clients,group-companies,categories,services}`, `/admin/services/new`, `/admin/services/[id]` are `◐`.

- [ ] **Step 7: Commit**

```bash
git add components/admin/data-table components/admin/sortable-list.tsx components/admin/collections components/admin/services "app/(admin)/admin/(panel)/team" "app/(admin)/admin/(panel)/clients" "app/(admin)/admin/(panel)/group-companies" "app/(admin)/admin/(panel)/categories" "app/(admin)/admin/(panel)/services" tests/dom/collections.test.tsx
git commit -m "feat: add collection and services admin screens with reorder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Dashboard (master Task 4.7)

**Files:**
- Create: `lib/schemas/api/dashboard.ts`, `server/modules/dashboard/{repo,service,routes}.ts`, `components/admin/dashboard/{kpi-card.tsx,leads-chart.tsx,next-up.tsx,dashboard.tsx}`
- Modify: `app/(admin)/admin/(panel)/page.tsx` (dashboard under the existing `Welcome, <name>` heading), `server/api/app.ts` (mount `/dashboard`)
- Test: `tests/integration/api/dashboard.test.ts`, `tests/dom/dashboard.test.tsx`

**Interfaces:**
- Consumes: Phase 3 tables `leads, pages, services, articles, settings, users`; Phase 3 `isoDate` (`lib/format.ts`); shadcn `chart` (Recharts 3.8.0); Task 1 shell.
- Produces:

```ts
// lib/schemas/api/dashboard.ts
export type DashboardDto = { kpis: { leads30d: number | null; openLeads: number | null; published: { pages; services; articles } | null; inReview: number | null }; leadsTrend: { date: string; count: number }[] | null; nextUp: NextUpItem[] }
export type NextUpItem = { id: "smtp" | "r2" | "two-factor" | "review" | "unassigned-leads"; title; description; href; done: boolean }
export const TREND_DAYS = 90
// server/modules/dashboard/service.ts
export function trendDays(now: Date, days?: number): string[]     // Irish calendar dates, oldest first
export async function getDashboard(actor: Actor, now?: Date): Promise<DashboardDto>
// GET /api/v1/admin/dashboard  (any signed-in user; parts hidden by permission)
```

Rules: lead KPIs and the trend need `lead:read` (non-spam leads; open = new|contacted|qualified); published counts need read on pages, services or articles; in-review needs `article:read`. Next up (computed from state, master 4.7): SMTP and R2 (row `integrations.smtp` / `integrations.r2` exists; `integration:read`), two-factor (current owner/admin without 2FA), drafts in review (`article:publish`), unassigned new leads (`lead:update`).

- [ ] **Step 1: Write the failing tests**

`tests/integration/api/dashboard.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"

import type { DashboardDto } from "@/lib/schemas/api/dashboard"
import { getDb } from "@/server/db/client"
import { leads, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { getDashboard, trendDays } from "@/server/modules/dashboard/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const DAY = 86_400_000

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

async function dashboard(cookie: string) {
  const res = await adminRequest("/dashboard", { cookie })
  expect(res.status).toBe(200)
  return (await res.json()) as DashboardDto
}

describe("dashboard (master 4.7)", () => {
  it("counts leads (30 d, open), published content and builds a 90-day trend", async () => {
    const now = Date.now()
    const lead = (
      daysAgo: number,
      status: "new" | "won" | "spam" | "contacted"
    ) => ({
      name: "N",
      email: "n@example.ie",
      message: "Hello",
      status,
      createdAt: new Date(now - daysAgo * DAY),
    })
    await getDb()
      .insert(leads)
      .values([
        lead(0, "new"),
        lead(1, "contacted"),
        lead(10, "won"),
        lead(40, "new"),
        lead(2, "spam"),
      ])
    const { cookie } = await signedInUser(["admin"])
    const dto = await dashboard(cookie)
    expect(dto.kpis.leads30d).toBe(3)
    expect(dto.kpis.openLeads).toBe(3)
    expect(dto.kpis.published).toEqual({
      pages: 8,
      services: 6,
      articles: expect.any(Number),
    })
    expect(dto.kpis.published!.articles).toBeGreaterThan(0)
    expect(dto.kpis.inReview).toBe(0)
    expect(dto.leadsTrend).toHaveLength(90)
    expect(dto.leadsTrend!.reduce((sum, d) => sum + d.count, 0)).toBe(4)
    expect(dto.leadsTrend!.at(-1)!.count).toBeGreaterThanOrEqual(1)
  })

  it("computes Next up from state (SMTP/R2 unset, 2FA off, unassigned leads)", async () => {
    await getDb()
      .insert(leads)
      .values({ name: "N", email: "n@example.ie", message: "Hi" })
    const owner = await signedInUser(["owner"])
    const before = await dashboard(owner.cookie)
    const state = Object.fromEntries(before.nextUp.map((i) => [i.id, i.done]))
    expect(state).toEqual({
      smtp: false,
      r2: false,
      "two-factor": false,
      review: true,
      "unassigned-leads": false,
    })
    expect(before.nextUp.find((i) => i.id === "unassigned-leads")?.title).toBe(
      "Assign 1 new enquiry"
    )

    await getDb()
      .insert(settings)
      .values({ key: "integrations.smtp", draft: { host: "smtp.example.ie" } })
    const after = await dashboard(owner.cookie)
    expect(after.nextUp.find((i) => i.id === "smtp")?.done).toBe(true)
  })

  it("hides what the role may not see", async () => {
    const viewer = await dashboard((await signedInUser(["viewer"])).cookie)
    expect(viewer.kpis.leads30d).toBeNull()
    expect(viewer.leadsTrend).toBeNull()
    expect(viewer.kpis.published).not.toBeNull()
    expect(viewer.nextUp).toEqual([])

    const intake = await dashboard((await signedInUser(["intake"])).cookie)
    expect(intake.kpis.leads30d).toBe(0)
    expect(intake.kpis.published).toBeNull()
    expect(intake.nextUp.map((i) => i.id)).toEqual(["unassigned-leads"])
  })

  it("lists 90 Irish calendar days ending today, across DST changes", () => {
    const days = trendDays(new Date("2026-10-26T00:30:00Z"))
    expect(days).toHaveLength(90)
    expect(days.at(-1)).toBe("2026-10-26")
    expect(new Set(days).size).toBe(90)
    expect(trendDays(new Date("2026-03-29T23:30:00Z")).at(-1)).toBe(
      "2026-03-30"
    )
  })

  it("works through the service for an actor without a session row", async () => {
    const owner = await signedInUser(["owner"])
    const dto = await getDashboard({
      userId: owner.user.id,
      roles: ["owner"],
      ip: null,
      userAgent: null,
      impersonatorId: null,
    })
    expect(dto.nextUp.length).toBeGreaterThan(0)
  })
})
```

`tests/dom/dashboard.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Dashboard } from "@/components/admin/dashboard/dashboard"
import { makeQueryClient } from "@/components/admin/providers"
import type { DashboardDto } from "@/lib/schemas/api/dashboard"

const dto: DashboardDto = {
  kpis: {
    leads30d: 7,
    openLeads: 3,
    published: { pages: 8, services: 6, articles: 8 },
    inReview: 2,
  },
  leadsTrend: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 6, 19 + i)).toISOString().slice(0, 10),
    count: i === 89 ? 4 : i === 80 ? 3 : 0,
  })),
  nextUp: [
    {
      id: "smtp",
      title: "Set up email (SMTP)",
      description: "d",
      href: "/admin/settings",
      done: false,
    },
    {
      id: "two-factor",
      title: "Turn on two-factor authentication",
      description: "d",
      href: "/admin/account",
      done: true,
    },
  ],
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(dto), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
  )
})

describe("dashboard (master 4.7)", () => {
  it("shows KPIs, the trend summary and the Next up checklist", async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <Dashboard />
      </QueryClientProvider>
    )
    expect(await screen.findByText("Enquiries (30 days)")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("22")).toBeInTheDocument()
    expect(
      screen.getByText("8 pages · 6 services · 8 articles")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("img", {
        name: /^7 enquiries in the last 90 days\. Busiest day: 16 Oct with 4\.$/,
      })
    ).toBeInTheDocument()
    const next = screen.getByRole("region", { name: "Next up" })
    expect(next).toHaveTextContent("1 to do")
    expect(
      within(next).getByRole("link", {
        name: /Set up email \(SMTP\).*\(to do\)/,
      })
    ).toHaveAttribute("href", "/admin/settings")
    expect(
      within(next).getByRole("link", { name: /two-factor.*\(done\)/ })
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration tests/integration/api/dashboard.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/modules/dashboard/service"`.

Run: `pnpm exec vitest run --project dom tests/dom/dashboard.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/dashboard/dashboard"`.

- [ ] **Step 3: Dashboard module**

`lib/schemas/api/dashboard.ts`:

```ts
/** GET /api/v1/admin/dashboard (spec §8.1). null = the actor may not see it. */
export type DashboardDto = {
  kpis: {
    leads30d: number | null
    openLeads: number | null
    published: { pages: number; services: number; articles: number } | null
    inReview: number | null
  }
  /** One entry per day (Europe/Dublin), oldest first, 90 days ending today. */
  leadsTrend: { date: string; count: number }[] | null
  nextUp: NextUpItem[]
}

export type NextUpItem = {
  id: "smtp" | "r2" | "two-factor" | "review" | "unassigned-leads"
  title: string
  description: string
  href: string
  done: boolean
}

export const TREND_DAYS = 90
```

`server/modules/dashboard/repo.ts`:

```ts
import "server-only"

import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  articles,
  leads,
  pages,
  services,
  settings,
  users,
} from "@/server/db/schema"

const OPEN = ["new", "contacted", "qualified"] as const

export async function countLeadsSince(
  db: DbOrTx,
  since: Date
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(leads)
    .where(and(gte(leads.createdAt, since), ne(leads.status, "spam")))
  return row.n
}

export async function countOpenLeads(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(leads)
    .where(inArray(leads.status, [...OPEN]))
  return row.n
}

export async function countUnassignedNewLeads(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(leads)
    .where(and(eq(leads.status, "new"), isNull(leads.assigneeId)))
  return row.n
}

/** Non-spam leads per calendar day in Irish time since `since`. */
export function leadsPerDay(db: DbOrTx, since: Date) {
  const day = sql<string>`to_char(${leads.createdAt} at time zone 'Europe/Dublin', 'YYYY-MM-DD')`
  return db
    .select({ date: day, n: count() })
    .from(leads)
    .where(and(gte(leads.createdAt, since), ne(leads.status, "spam")))
    .groupBy(day)
}

export async function publishedCounts(db: DbOrTx) {
  const [[p], [s], [a]] = await Promise.all([
    db.select({ n: count() }).from(pages).where(isNotNull(pages.published)),
    db
      .select({ n: count() })
      .from(services)
      .where(isNotNull(services.published)),
    db
      .select({ n: count() })
      .from(articles)
      .where(eq(articles.status, "published")),
  ])
  return { pages: p.n, services: s.n, articles: a.n }
}

export async function countArticlesInReview(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(articles)
    .where(eq(articles.status, "in_review"))
  return row.n
}

/** Which of `keys` have a settings row (integrations are configured once saved). */
export async function existingSettingsKeys(
  db: DbOrTx,
  keys: string[]
): Promise<Set<string>> {
  const rows = await db
    .select({ key: settings.key })
    .from(settings)
    .where(inArray(settings.key, keys))
  return new Set(rows.map((r) => r.key))
}

export async function twoFactorEnabled(
  db: DbOrTx,
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ on: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
  return !!row?.on
}
```

`server/modules/dashboard/service.ts`:

```ts
import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import {
  type DashboardDto,
  type NextUpItem,
  TREND_DAYS,
} from "@/lib/schemas/api/dashboard"
import { isoDate } from "@/lib/format"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"

import * as repo from "./repo"

const DAY = 86_400_000

/** The last `days` calendar dates (Europe/Dublin), oldest first, ending today. */
export function trendDays(now: Date, days = TREND_DAYS): string[] {
  const [y, m, d] = isoDate(now).split("-").map(Number)
  const todayNoon = Date.UTC(y, m - 1, d, 12)
  return Array.from({ length: days }, (_, i) =>
    new Date(todayNoon - (days - 1 - i) * DAY).toISOString().slice(0, 10)
  )
}

/**
 * KPIs, 90-day lead trend and the "Next up" checklist (spec §8.1), each
 * part only for actors allowed to see it (null otherwise).
 */
export async function getDashboard(
  actor: Actor,
  now = new Date()
): Promise<DashboardDto> {
  const db = getDb()
  const can = (req: PermissionRequest) => hasPermission(actor.roles, req)
  const canLeads = can({ lead: ["read"] })
  const canContent =
    can({ page: ["read"] }) ||
    can({ service: ["read"] }) ||
    can({ article: ["read"] })
  const canArticles = can({ article: ["read"] })
  const days = trendDays(now)
  const since = new Date(now.getTime() - TREND_DAYS * DAY)

  const [
    leads30d,
    openLeads,
    perDay,
    published,
    inReview,
    unassigned,
    configured,
    twoFactor,
  ] = await Promise.all([
    canLeads
      ? repo.countLeadsSince(db, new Date(now.getTime() - 30 * DAY))
      : null,
    canLeads ? repo.countOpenLeads(db) : null,
    canLeads ? repo.leadsPerDay(db, since) : null,
    canContent ? repo.publishedCounts(db) : null,
    canArticles ? repo.countArticlesInReview(db) : null,
    can({ lead: ["update"] }) ? repo.countUnassignedNewLeads(db) : null,
    can({ integration: ["read"] })
      ? repo.existingSettingsKeys(db, ["integrations.smtp", "integrations.r2"])
      : null,
    repo.twoFactorEnabled(db, actor.userId),
  ])

  const byDay = new Map((perDay ?? []).map((row) => [row.date, row.n]))
  const nextUp: NextUpItem[] = []
  if (configured) {
    nextUp.push({
      id: "smtp",
      title: "Set up email (SMTP)",
      description:
        "Needed for invitations, password resets and enquiry notifications. Until then, links are shown here to copy.",
      href: "/admin/settings",
      done: configured.has("integrations.smtp"),
    })
    nextUp.push({
      id: "r2",
      title: "Set up media storage (Cloudflare R2)",
      description:
        "Uploads are kept on the server disk until R2 is configured.",
      href: "/admin/settings",
      done: configured.has("integrations.r2"),
    })
  }
  if (actor.roles.includes("owner") || actor.roles.includes("admin"))
    nextUp.push({
      id: "two-factor",
      title: "Turn on two-factor authentication",
      description:
        "Owners and administrators should protect their sign-in with a code from their phone.",
      href: "/admin/account",
      done: twoFactor,
    })
  if (inReview !== null && can({ article: ["publish"] }))
    nextUp.push({
      id: "review",
      title: inReview
        ? `Review ${inReview} draft${inReview === 1 ? "" : "s"}`
        : "No drafts waiting for review",
      description: "Authors submitted these articles for publishing.",
      href: "/admin/articles",
      done: inReview === 0,
    })
  if (unassigned !== null)
    nextUp.push({
      id: "unassigned-leads",
      title: unassigned
        ? `Assign ${unassigned} new enquir${unassigned === 1 ? "y" : "ies"}`
        : "Every new enquiry has an owner",
      description: "New enquiries nobody has picked up yet.",
      href: "/admin/leads",
      done: unassigned === 0,
    })

  return {
    kpis: { leads30d, openLeads, published, inReview },
    leadsTrend: perDay
      ? days.map((date) => ({ date, count: byDay.get(date) ?? 0 }))
      : null,
    nextUp,
  }
}
```

`server/modules/dashboard/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"

import { getDashboard } from "./service"

/** Every signed-in user has a dashboard; the service hides what they may not see. */
export const dashboardRoutes = new Hono<AppEnv>().get("/", async (c) =>
  c.json(await getDashboard(actorOf(c)), 200)
)
```

In `server/api/app.ts` add `import { dashboardRoutes } from "@/server/modules/dashboard/routes"` and chain `.route("/dashboard", dashboardRoutes)` after `.route("/reorder", reorderRoutes)`.

- [ ] **Step 4: Dashboard screen**

`components/admin/dashboard/kpi-card.tsx`:

```tsx
import type { LucideIcon } from "lucide-react"

/** One headline number (dashboard KPI row). */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        <Icon aria-hidden className="size-4" />
      </div>
      <p className="text-3xl font-black tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
```

`components/admin/dashboard/leads-chart.tsx`:

```tsx
"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const config = {
  count: { label: "Enquiries", color: "var(--chart-1)" },
} satisfies ChartConfig

const dayMonth = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const label = (date: string) => dayMonth.format(new Date(`${date}T12:00:00Z`))

/** Leads per day, last 90 days (spec §8.1). The summary is the accessible name. */
export function LeadsChart({
  data,
}: {
  data: { date: string; count: number }[]
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const busiest = data.reduce(
    (best, d) => (d.count > best.count ? d : best),
    data[0] ?? { date: "", count: 0 }
  )
  const summary =
    total === 0
      ? "No enquiries in the last 90 days."
      : `${total} enquir${total === 1 ? "y" : "ies"} in the last 90 days. Busiest day: ${label(busiest.date)} with ${busiest.count}.`
  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <figcaption className="flex flex-col gap-1">
        <span className="font-semibold">Enquiries, last 90 days</span>
        <span className="text-sm text-muted-foreground">{summary}</span>
      </figcaption>
      <ChartContainer
        config={config}
        className="aspect-auto h-56 w-full"
        role="img"
        aria-label={summary}
      >
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={label}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => label(String(value))}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
```

`components/admin/dashboard/next-up.tsx`:

```tsx
import { CheckCircle2, ChevronRight, Circle } from "lucide-react"
import Link from "next/link"

import type { NextUpItem } from "@/lib/schemas/api/dashboard"
import { cn } from "@/lib/utils"

/** Checklist computed from the platform's state (spec §8.1 "Next up"). */
export function NextUp({ items }: { items: NextUpItem[] }) {
  if (items.length === 0) return null
  const open = items.filter((i) => !i.done).length
  return (
    <section
      aria-labelledby="next-up"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 id="next-up" className="font-semibold">
          Next up
        </h2>
        <span className="text-sm text-muted-foreground">
          {open === 0 ? "All done" : `${open} to do`}
        </span>
      </header>
      <ul className="flex flex-col divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-start gap-3 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {item.done ? (
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-brand-green-dark"
                />
              ) : (
                <Circle
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-sm font-medium",
                    item.done && "text-muted-foreground line-through"
                  )}
                >
                  {item.title}
                  <span className="sr-only">
                    {item.done ? " (done)" : " (to do)"}
                  </span>
                </span>
                {!item.done ? (
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                aria-hidden
                className="mt-0.5 size-4 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

`components/admin/dashboard/dashboard.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { FileCheck2, Hourglass, Inbox, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errorMessage, unwrap } from "@/lib/api-client"

import { KpiCard } from "./kpi-card"
import { LeadsChart } from "./leads-chart"
import { NextUp } from "./next-up"

/** KPIs, 90-day trend and Next up (master 4.7). */
export function Dashboard() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => unwrap(api.dashboard.$get()),
    staleTime: 60_000,
  })
  if (query.isPending)
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy="true"
        aria-label="Loading dashboard"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  if (query.isError)
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border p-6"
      >
        <p className="text-sm">{errorMessage(query.error)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
        >
          Try again
        </Button>
      </div>
    )
  const { kpis, leadsTrend, nextUp } = query.data
  const published = kpis.published
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.leads30d !== null ? (
          <KpiCard
            label="Enquiries (30 days)"
            value={kpis.leads30d}
            icon={MessageSquare}
          />
        ) : null}
        {kpis.openLeads !== null ? (
          <KpiCard
            label="Open enquiries"
            value={kpis.openLeads}
            hint="New, contacted or qualified"
            icon={Inbox}
          />
        ) : null}
        {published ? (
          <KpiCard
            label="Published content"
            value={published.pages + published.services + published.articles}
            hint={`${published.pages} pages · ${published.services} services · ${published.articles} articles`}
            icon={FileCheck2}
          />
        ) : null}
        {kpis.inReview !== null ? (
          <KpiCard
            label="Drafts in review"
            value={kpis.inReview}
            hint="Articles waiting for an editor"
            icon={Hourglass}
          />
        ) : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {leadsTrend ? <LeadsChart data={leadsTrend} /> : null}
        <NextUp items={nextUp} />
      </div>
    </div>
  )
}
```

`app/(admin)/admin/(panel)/page.tsx` (full file):

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { Dashboard } from "@/components/admin/dashboard/dashboard"
import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {user.name}
        </h1>
        <p className="text-muted-foreground">
          Here is what is happening on the website.
        </p>
      </section>
      <Dashboard />
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/api/dashboard.test.ts`
Expected: PASS (5 tests).

Run: `pnpm exec vitest run --project dom tests/dom/dashboard.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Phase gate (HARD GATE)**

Run: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0 (unit, dom and integration projects green; the build needs no database).

Run (port 3100 free, no other agent running Playwright/build): `pnpm test:visual`
Expected: `43 passed, 1 skipped` — 40 public baselines at 0 px, admin shell baselines unchanged (`<main>` masked).

Run: `pnpm test:e2e`
Expected: every spec passes (Phase 2 auth/account, Phase 3 public site, Task 7 page editor).

- [ ] **Step 7: Commit**

```bash
git add lib/schemas/api/dashboard.ts server/modules/dashboard server/api/app.ts components/admin/dashboard "app/(admin)/admin/(panel)/page.tsx" tests/integration/api/dashboard.test.ts tests/dom/dashboard.test.tsx
git commit -m "feat: add admin dashboard with KPIs, lead trend and next steps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
