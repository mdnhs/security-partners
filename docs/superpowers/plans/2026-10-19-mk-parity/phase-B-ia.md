# Phase B — IA, navigation, shell, settings structure, ⌘K

> Part of `docs/superpowers/plans/2026-10-19-mk-parity.md`. Spec §5, §12, §13. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One nav registry drives the sidebar, the section rails, ⌘K and the page guards. Admin URLs move to MK paths, and the old URLs redirect.

**Architecture:**
- `lib/admin/nav.ts` is isomorphic and replaces `components/admin/shell/nav.ts`.
- Route moves are physical `git mv` of `app/(admin)/admin/(panel)/**` folders. Legacy URLs are served by `next.config.ts` `redirects()` from `lib/admin/legacy-redirects.ts`; that runs before `proxy.ts` and needs no DB.
- `AdminShell` renders `SectionTabs` once, from the registry.
- Every panel page guards with `requirePage(href)`.

**Tech Stack:** Next 16.3.8 (`redirects()` in `next.config.ts`), cmdk 1.1.1, next-themes 0.4.6.

## Global Constraints

The master plan's constraints apply, plus:
- `next.config.ts` changes run the public visual gate. `redirects()` only lists `/admin/...` sources, so it never matches a public URL.
- Keep the SP ruling that `/admin/settings` 307s to the first readable child (now from the registry).

## Review Focus

1. **Old URL with a query or a dynamic id**, for example `/admin/articles/0192…?tab=seo` or `/admin/audit?actor=x`, must land on the new path with the query intact. Covered by B2/B3 unit tests on `ADMIN_LEGACY_REDIRECTS` (source patterns use `:id` and `:path*`) and by `tests/e2e/legacy-redirects.spec.ts`.
2. **A page file missing from the registry** must not render unguarded. B5 adds an fs-scan test: every `page.tsx` under `(panel)` maps to a registered href and calls `requirePage`.
3. **The section rail for someone who can see only one child.** For example, a marketer reading Site settings with no integration access must get no rail, so a single tab is not shown as navigation. Covered by the B4 DOM test.
4. **⌘K must not offer a destination the role cannot open**, such as Custom code to a marketer or AI assistant to an editor. Covered by the B6 DOM test.
5. **Internal links that still point at old paths** after the move. Covered by the B3 grep test `tests/unit/admin/no-legacy-links.test.ts`.

---

### Task B1: Nav registry `lib/admin/nav.ts` + `permissionFor`

**Files:**
- Create:
  - `lib/admin/nav.ts`
  - `tests/unit/admin/nav-registry.test.ts`
- Modify:
  - `components/admin/shell/nav.ts`: becomes `export * from "@/lib/admin/nav"` plus thin adapters (`menuSections`, `dockItems`, `navDestinations`, `isActiveItem`), so the current shell keeps compiling. B4 deletes the adapters.
  - `tests/unit/admin/nav.test.ts`: port its assertions to the new API.

**Interfaces:**
- Consumes: `hasPermission`, `PermissionRequest`, `Role`; `EDITABLE_SETTINGS_KEYS`, `SETTINGS_ENTRIES` (`lib/admin/settings-keys.ts`); `GROWTH_SETTINGS` (`lib/admin/growth-settings.ts`).
- Produces: the `lib/admin/nav.ts` block in the master plan's Shared contracts, built from the table in spec §5.1. Ids:

| Kind | Ids |
|---|---|
| Items | `dashboard`, `pages`, `insights`, `services`, `collections`, `media`, `leads`, `seo`, `marketing`, `settings`, `users`, `activity` |
| Children | `insights-articles`, `insights-categories`, `collections-team`, `collections-clients`, `collections-group-companies`, `seo-overview`, `seo-defaults`, `seo-redirects`, `marketing-tracking`, `marketing-consent`, `marketing-code`, `settings-<key>` (one per `EDITABLE_SETTINGS_KEYS`, label from `SETTINGS_ENTRIES`, href `/admin/settings/<key>`, permission `SETTINGS_ENTRIES[key].read`), `settings-ai-assistant`, `settings-integrations` |
| Links | `help` (`HELP_LINK`); `account`, `design` (`EXTRA_LINKS`) |

`appearance` (C5), `newsletter` (D4.3) and `marketing-events` (D2.4) are added by those tasks.

Rules:
- `match` is `"exact"` only for `/admin`.
- `permissionFor(pathname)`:
  1. Exact href match over items, children and links.
  2. Otherwise the longest registered href that is a `/`-boundary prefix of `pathname`. So `/admin/insights/0192` maps to `insights-articles`, and `/admin/settings/integrations/smtp` maps to `settings-integrations`.
  3. `undefined` when nothing matches.
- B2 and B3 register the new hrefs, which do not exist as routes yet in B1. That is fine: nothing links them until the shell switches in B4.

- [ ] **Step 1: Write the failing tests** (`tests/unit/admin/nav-registry.test.ts`)

```ts
import { activeChild, activeItem, dockLinks, permissionFor, reachableLinks, visibleNav } from "@/lib/admin/nav"

it("groups are Menu, Growth, General in order", () => {
  expect(visibleNav(["owner"]).map((g) => g.label)).toEqual(["Menu", "Growth", "General"])
})
it("permissionFor resolves exact, nested and unknown paths", () => {
  expect(permissionFor("/admin")).toBeNull()
  expect(permissionFor("/admin/insights/0192a")).toEqual({ article: ["read"] })
  expect(permissionFor("/admin/insights/categories")).toEqual({ collection: ["read"] })
  expect(permissionFor("/admin/marketing/code")).toEqual({ customCode: ["read"] })
  expect(permissionFor("/admin/settings/ai-assistant")).toEqual({ integration: ["read"] })
  expect(permissionFor("/admin/settings/integrations/smtp")).toEqual({ integration: ["read"] })
  expect(permissionFor("/admin/design")).toEqual({ customCode: ["update"] })
  expect(permissionFor("/admin/nope")).toBeUndefined()
  expect(permissionFor("/admin/insightsx")).toBeUndefined()
})
it("marketer sees Growth but not Custom code or Site settings AI", () => {
  const ids = reachableLinks(["marketer"]).map((l) => l.id)
  expect(ids).toContain("marketing-tracking")
  expect(ids).not.toContain("marketing-code")
  expect(ids).not.toContain("settings-ai-assistant")
})
it("dock is Users & roles, Activity log, Help for owners; Help only for authors", () => {
  expect(dockLinks(["owner"]).map((l) => l.label)).toEqual(["Users & roles", "Activity log", "Help"])
  expect(dockLinks(["author"]).map((l) => l.label)).toEqual(["Help"])
})
it("activeItem/activeChild use the longest prefix", () => {
  const item = activeItem("/admin/seo/redirects", ["owner"])!
  expect(item.id).toBe("seo")
  expect(activeChild(item, "/admin/seo/redirects")!.id).toBe("seo-redirects")
  expect(activeChild(item, "/admin/seo")!.id).toBe("seo-overview")
})
it("every href is unique and every child permission is a subset of a statement", () => { /* iterate */ })
it("AI assistant child has ⌘K keywords", () => {
  expect(reachableLinks(["owner"]).find((l) => l.id === "settings-ai-assistant")!.keywords)
    .toEqual(expect.arrayContaining(["ai", "assistant", "claude", "openai", "gemini", "chatbot"]))
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run --project unit tests/unit/admin/nav-registry.test.ts`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/admin/nav.ts`**

Re-point `components/admin/shell/nav.ts` to adapters over it, so that `pnpm typecheck` passes.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project unit tests/unit/admin && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit `lib/admin/nav.ts`, `components/admin/shell/nav.ts` and the tests with the message:

```
feat(admin): MK nav registry with permissionFor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task B2: Content route moves (Insights, Collections) + legacy redirects

**Files:**
- Move:
  - `git mv "app/(admin)/admin/(panel)/articles" "app/(admin)/admin/(panel)/insights"`. Its children are `page.tsx`, `new/`, `[id]/`.
  - `(collections)/categories` → `insights/categories`.
  - `(collections)/{team,clients,group-companies}` → `collections/{team,clients,group-companies}`, with `(collections)/layout.tsx` → `collections/layout.tsx`.
- Create:
  - `app/(admin)/admin/(panel)/collections/page.tsx`: `redirect("/admin/collections/team")`, which is a 307.
  - `lib/admin/legacy-redirects.ts`
  - `tests/unit/admin/legacy-redirects.test.ts`
  - `tests/e2e/legacy-redirects.spec.ts`
- Modify:
  - `next.config.ts`: `async redirects() { return [...ADMIN_LEGACY_REDIRECTS] }`.
  - Every literal `/admin/articles`, `/admin/team`, `/admin/clients`, `/admin/group-companies` and `/admin/categories` in `components/`, `server/` (search hrefs, notifications, dashboard), `lib/` and `tests/` (e2e and visual helpers).
  - `server/modules/search/service.ts`: hrefs.

**Interfaces:**
- Produces `ADMIN_LEGACY_REDIRECTS`. Entries in B2 (all `permanent: true`):

| source | destination |
|---|---|
| `/admin/articles` | `/admin/insights` |
| `/admin/articles/:path*` | `/admin/insights/:path*` |
| `/admin/categories` | `/admin/insights/categories` |
| `/admin/team` | `/admin/collections/team` |
| `/admin/clients` | `/admin/collections/clients` |
| `/admin/group-companies` | `/admin/collections/group-companies` |

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/admin/legacy-redirects.test.ts
import { ADMIN_LEGACY_REDIRECTS } from "@/lib/admin/legacy-redirects"
import { match, compile } from "path-to-regexp"   // next bundles it; otherwise use a local matcher in the test
const resolve = (p: string) => { for (const r of ADMIN_LEGACY_REDIRECTS) { const m = match(r.source)(p); if (m) return compile(r.destination)(m.params) } return null }
it.each([
  ["/admin/articles", "/admin/insights"],
  ["/admin/articles/new", "/admin/insights/new"],
  ["/admin/articles/0192abc", "/admin/insights/0192abc"],
  ["/admin/categories", "/admin/insights/categories"],
  ["/admin/team", "/admin/collections/team"],
])("%s → %s", (from, to) => expect(resolve(from)).toBe(to))
it("only admin sources, all permanent", () => {
  for (const r of ADMIN_LEGACY_REDIRECTS) { expect(r.source.startsWith("/admin/")).toBe(true); expect(r.permanent).toBe(true) }
})
```

If `path-to-regexp` is not resolvable from tests, write a 10-line matcher in the test that handles `:name` and `:path*`. Do not add a dep.

```ts
// tests/e2e/legacy-redirects.spec.ts
for (const [from, to] of [["/admin/articles?status=draft", "/admin/insights?status=draft"], ["/admin/team", "/admin/collections/team"]] as const)
  test(`${from} lands on ${to}`, async ({ owner }) => { await owner.goto(from); await expect(owner).toHaveURL(new RegExp(`${to.replace("?", "\\?")}$`)) })
```

- [ ] **Step 2: Run to verify they fail**

Run the unit test. Expected: FAIL.

- [ ] **Step 3: Move the folders and update the links**

Do the `git mv` moves, create the collections index redirect and `legacy-redirects.ts`, and wire `next.config.ts`. Then update every old literal; check with `grep -rn "/admin/\(articles\|team\|clients\|group-companies\|categories\)" components server lib tests app`, which should leave only `legacy-redirects.ts`.

- [ ] **Step 4: Run the checks**

```bash
pnpm vitest run --project unit tests/unit/admin
pnpm typecheck
env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build
pnpm test:e2e tests/e2e/legacy-redirects.spec.ts tests/e2e/articles.spec.ts
pnpm test:visual tests/visual/public-pages.spec.ts
```

Expected: PASS, public 0 px.

- [ ] **Step 5: Commit**

Commit the moved trees (`git add -A "app/(admin)/admin/(panel)"` is allowed here, scoped to that path), `next.config.ts`, `lib/admin/legacy-redirects.ts`, the edited link files and the tests. Message:

```
feat(admin): Insights and Collections URLs with legacy redirects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task B3: Growth/admin route moves (Marketing, Activity log, AI settings)

**Files:**
- Move:
  - `marketing/tracking/page.tsx` content → `marketing/page.tsx`. This replaces the current redirect page.
  - `marketing/custom-code` → `marketing/code`.
  - `audit` → `activity`.
- Create:
  - `app/(admin)/admin/(panel)/settings/ai-assistant/page.tsx`: renders the existing `IntegrationForm` for `integrations.ai` until C7 replaces it.
  - `tests/unit/admin/no-legacy-links.test.ts`
- Modify:
  - `lib/admin/legacy-redirects.ts`: append the redirects below.
  - `lib/admin/growth-settings.ts` hrefs.
  - `components/admin/marketing/*` back links: remove them.
  - `components/admin/integrations/integrations-overview.tsx`: the AI card links to `/admin/settings/ai-assistant`.
  - `app/(admin)/admin/(panel)/settings/integrations/[slug]/page.tsx`: `ai` slug → `redirect("/admin/settings/ai-assistant")`.

Redirects appended to `lib/admin/legacy-redirects.ts`:

| source | destination |
|---|---|
| `/admin/marketing/tracking` | `/admin/marketing` |
| `/admin/marketing/custom-code` | `/admin/marketing/code` |
| `/admin/audit` | `/admin/activity` |
| `/admin/settings/integrations/ai` | `/admin/settings/ai-assistant` |

**Interfaces:**
- Consumes `ADMIN_LEGACY_REDIRECTS` (B2).
- Produces `GROWTH_SETTINGS.tracking.href = "/admin/marketing"` and `GROWTH_SETTINGS.customCode.href = "/admin/marketing/code"`.

- [ ] **Step 1: Write the failing tests**

Add redirect cases to `legacy-redirects.test.ts`, then create the grep test:

```ts
// tests/unit/admin/no-legacy-links.test.ts
const OLD = /["'`]\/admin\/(?:articles|team|clients|group-companies|categories|audit|marketing\/tracking|marketing\/custom-code|settings\/integrations\/ai)(?:["'`/?])/
it("no source file links an old admin path", () => {
  const hits = globSync("{app,components,lib,server,tests}/**/*.{ts,tsx}", { ignore: ["lib/admin/legacy-redirects.ts", "tests/unit/admin/legacy-redirects.test.ts", "tests/e2e/legacy-redirects.spec.ts", "tests/unit/admin/no-legacy-links.test.ts"] })
    .filter((f) => OLD.test(readFileSync(f, "utf8")))
  expect(hits).toEqual([])
})
```

- [ ] **Step 2: Run to verify they fail**

Run both tests. Expected: FAIL.

- [ ] **Step 3: Do the moves and update every hit**

- [ ] **Step 4: Run the checks**

Run: `pnpm vitest run --project unit tests/unit/admin && pnpm typecheck && pnpm test:e2e tests/e2e/legacy-redirects.spec.ts tests/e2e/consent.spec.ts tests/e2e/users-audit.spec.ts tests/e2e/integrations.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message:

```
feat(admin): MK paths for Marketing, Activity log and AI assistant settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task B4: Global SectionTabs in AdminShell, MK headers and copy

**Files:**
- Create: `components/admin/shell/section-rail.tsx`
- Modify:
  - `components/admin/shell/admin-shell.tsx`: wrap `{children}` in `<SectionRail>`.
  - `components/admin/shell/{app-sidebar,nav-main,footer-dock,nav-entry}.tsx`: read `visibleNav` and `dockLinks`.
  - `components/admin/editor/editor-layout.tsx`: drop the inner card when inside the rail. The bar becomes `rounded-card border bg-card` standalone; it keeps History.
  - `app/(admin)/admin/(panel)/settings/page.tsx`: redirect to the first readable settings child from the registry.
  - The page headers and descriptions listed below.
- Delete:
  - `components/admin/shell/nav-child-tabs.tsx`
  - `components/admin/collections/collection-tabs.tsx`
  - `components/admin/settings/settings-tabs.tsx`
  - the `seo/layout.tsx`, `marketing/layout.tsx`, `collections/layout.tsx` and `settings/layout.tsx` rail wrappers
  - the adapters in `components/admin/shell/nav.ts`; repoint importers to `lib/admin/nav`, then delete the file
- Test:
  - `tests/dom/section-rail.test.tsx`
  - update `tests/dom/{nav-child-tabs,settings-editor,admin-shell}.test.tsx`; delete the ones for removed components

**Interfaces:**
- Consumes: `activeItem`, `activeChild` and `visibleNav` (B1); `usePathname`; the session roles.
- Produces `SectionRail({ children }: { children: ReactNode })`:
  - When the active item has ≥ 2 children visible to the roles, it renders `<div className="lg:flex lg:gap-8">`. Inside:
    - `<nav aria-label={item.label}>`: `lg:w-52 lg:shrink-0`.
      - Caption: uppercase `text-[11px] font-semibold tracking-wider text-muted-foreground`.
      - Links get `aria-current="page"` on the active child.
      - Below lg, a horizontal `ScrollArea` row with `min-h-11` links.
    - `<div className="min-w-0 flex-1">{children}</div>`.
  - Otherwise it renders `children` directly.
  - There is no white card wrapper.
- PageHeader descriptions (MK copy; draft/publish wording kept):

| Screen | Description |
|---|---|
| Pages | "Every page of the site. Changes stay in a draft until you publish." |
| Insights | "Articles for the blog. Changes stay in a draft until you publish." |
| Media | "Images and PDFs used across the site." |
| Enquiries | "Messages from the contact form." |
| SEO overview | "How search engines see the site." |
| Tracking | "Tag IDs and switches. Nothing loads until a visitor consents. Changes stay in a draft until you publish." |
| Activity log | "Who changed what, and when. Times are Irish time." |
| Site settings pages | "Changes stay in a draft until you publish." |

- [ ] **Step 1: Write the failing DOM tests**

```tsx
it("renders a labelled rail with the active child for SEO", () => {
  renderAt("/admin/seo/redirects", ["owner"])
  const rail = screen.getByRole("navigation", { name: "SEO" })
  expect(within(rail).getByRole("link", { name: "Redirects" })).toHaveAttribute("aria-current", "page")
})
it("no rail when only one child is visible", () => {
  renderAt("/admin/settings/site", ["viewer"])           // viewer: settings children only, no integrations/ai
  // viewer sees several settings children → rail present; use a role with exactly one:
  renderAt("/admin/marketing", ["viewer"])               // viewer: tracking, consent (events added later) → rail
  renderAt("/admin/insights", ["author"])                // author: Articles only (no collection:read) → no rail
  expect(screen.queryByRole("navigation", { name: "Insights" })).toBeNull()
})
it("content is not wrapped in a card", () => {
  renderAt("/admin/seo", ["owner"])
  expect(document.querySelector("[data-slot=section-content]")).not.toHaveClass("bg-card")
})
```

Fix the second test so each `renderAt` sits in its own `it` with its own assertion. Shown compactly here.

- [ ] **Step 2: Run to verify they fail**

Run the DOM tests. Expected: FAIL.

- [ ] **Step 3: Implement**

Implement `SectionRail`, wire the shell, delete the per-layout rails and old components, update the headers, and repoint every `components/admin/shell/nav` import to `@/lib/admin/nav`.

- [ ] **Step 4: Run the checks**

Run: `pnpm vitest run --project dom && pnpm typecheck && pnpm test:e2e tests/e2e/admin-a11y.spec.ts tests/e2e/roles.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message:

```
feat(admin): global section rail from the nav registry, MK page headers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task B5: `requirePage` guards everywhere

**Files:**
- Modify:
  - `server/auth/session.ts`: add `requirePage`.
  - Every `app/(admin)/admin/(panel)/**/page.tsx`: replace the inline `requirePermission({...})` with `await requirePage("<href>")`. For dynamic routes, pass the static parent href, e.g. `requirePage("/admin/insights")`. Keep any **additional** finer checks the page already does, such as editor-only actions.
- Test:
  - `tests/unit/admin/page-guards.test.ts` (fs scan)
  - `tests/integration/auth/require-page.test.ts`

**Interfaces:**
- Consumes: `permissionFor` (B1); `requirePermission`, `requireActor`.
- Produces `requirePage(href: string): Promise<Actor>`:
  - `undefined` → `notFound()`
  - `null` → `requireActor()`
  - otherwise → `requirePermission(p)`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/admin/page-guards.test.ts
const pages = globSync("app/(admin)/admin/(panel)/**/page.tsx")
it.each(pages)("%s guards with requirePage on a registered href", (file) => {
  const src = readFileSync(file, "utf8")
  if (/\bredirect\(/.test(src) && !/requirePage/.test(src)) return  // pure redirect pages (collections index, settings index) are exempt
  const m = src.match(/requirePage\("([^"]+)"\)/)
  expect(m, "calls requirePage").not.toBeNull()
  expect(permissionFor(m![1])).not.toBeUndefined()
})
```

The integration test runs `requirePage("/admin/marketing/code")` as a marketer (forbidden), `requirePage("/admin/unknown")` (notFound) and `requirePage("/admin")` as an author (ok). It mocks `next/navigation` the same way the existing session tests do.

- [ ] **Step 2: Run to verify they fail**

Run both tests. Expected: FAIL.

- [ ] **Step 3: Implement and convert every page**

- [ ] **Step 4: Run the checks**

Run: `pnpm vitest run --project unit tests/unit/admin/page-guards.test.ts && pnpm test:integration tests/integration/auth/require-page.test.ts && pnpm test:e2e tests/e2e/roles.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(admin): registry-driven page guards (requirePage)`, ending with the co-author line.

---

### Task B6: ⌘K — registry Go to, keywords, theme and sign-out actions

**Files:**
- Create: `components/admin/shell/palette-actions.ts`
- Modify: `components/admin/shell/command-palette.tsx`
- Test: `tests/dom/command-palette.test.tsx` (extend)

**Interfaces:**
- Consumes: `reachableLinks(roles)` (B1); `useTheme().setTheme`; `useShellSignOut()`; `usePermission`.
- Produces:

```ts
export type PaletteAction = { id: string; label: string; keywords: readonly string[]; run(): void }
export function buildActions(input: { setTheme(t: "light" | "dark" | "system"): void; signOut(): void; open(href: string): void; can(p: PermissionRequest): boolean; navigate(href: string): void }): PaletteAction[]
export function matchesQuery(q: string, label: string, keywords?: readonly string[]): boolean   // case-insensitive, every word must hit label or a keyword
```

Actions, in order. Each permission-gated action is omitted when the role lacks it.

| Id | Label | Gate / behaviour |
|---|---|---|
| `new-article` | New article | `article:create`; navigates to `/admin/insights/new` |
| `new-service` | New service | `service:create` |
| `new-page` | New page | added in D5.5 |
| `open-site` | Open the live site | — |
| `theme-light` | Switch to light theme | — |
| `theme-dark` | Switch to dark theme | — |
| `theme-system` | Use the system theme | — |
| `sign-out` | Sign out | — |

- Placeholder: "Search pages and actions…".
- Groups: "Go to" (registry), "Records" and "People" (existing server search, kept), "Actions".

- [ ] **Step 1: Write the failing DOM tests**

```tsx
it("Go to lists registry destinations with keywords", async () => {
  openPalette({ roles: ["owner"] }); await user.type(input(), "chatbot")
  expect(screen.getByRole("option", { name: /AI assistant/ })).toBeInTheDocument()
})
it("hides destinations the role cannot open", async () => {
  openPalette({ roles: ["marketer"] }); await user.type(input(), "custom code")
  expect(screen.queryByRole("option", { name: /Custom code/ })).toBeNull()
})
it("theme and sign-out actions run", async () => {
  const { setTheme, signOut } = openPalette({ roles: ["author"] })
  await user.type(input(), "dark"); await user.keyboard("{Enter}")
  expect(setTheme).toHaveBeenCalledWith("dark")
  await user.type(input(), "sign out"); await user.keyboard("{Enter}")
  expect(signOut).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project dom tests/dom/command-palette.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(admin): ⌘K registry destinations, keywords, theme and sign-out actions`, ending with the co-author line.

---

### Task B7: Dock, Help page, Account top tabs

**Files:**
- Create:
  - `app/(admin)/admin/(panel)/help/page.tsx`
  - `components/admin/help/help-view.tsx`
- Modify:
  - `components/admin/shell/footer-dock.tsx`: render `dockLinks(roles)` and Log out. Account is removed from the dock.
  - `components/admin/shell/user-menu.tsx`: Account and Security (`/admin/account?tab=security`) entries.
  - `app/(admin)/admin/(panel)/account/page.tsx` and `components/admin/account/*`: in-page SectionTabs → `Tabs` with `?tab=profile|security|devices`.
- Test:
  - `tests/dom/footer-dock.test.tsx`
  - `tests/e2e/account.spec.ts` (update)
  - `tests/e2e/help.spec.ts`

**Interfaces:**
- `HelpView({ owners }: { owners: { name: string; email: string }[] })`, rendered on `/admin/help` (`requirePage("/admin/help")`). Sections:
  1. "Keyboard shortcuts": a `<dl>` of ⌘K / Ctrl+K "Search and go", ⌘J / Ctrl+J "AI assistant", ⌘S / Ctrl+S "Save draft", Esc "Close panels".
  2. "Who to contact": owners' names and mailto links, loaded server-side from `server/modules/users/service.ts` via a new `listOwnerContacts(): Promise<{name; email}[]>`, which returns only active owners.
  3. "Guides": links to `docs/runbook.md` sections, rendered as plain text titles because the docs are not served.

- [ ] **Step 1: Write the failing tests**

- Dock for an owner has links "Users & roles", "Activity log", "Help" and a "Log out" button, and no "Account".
- The Help page shows the shortcuts and an owner's mailto.
- Account `?tab=security` selects the Security tab (`aria-selected`).

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project dom tests/dom/footer-dock.test.tsx && pnpm test:e2e tests/e2e/help.spec.ts tests/e2e/account.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(admin): MK dock with Help page; Account top tabs`, ending with the co-author line.

---

### Task B8: Phase B gate

- [ ] **Step 1: Run the full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:e2e
```

Expected: green.

- [ ] **Step 2: Confirm the public baselines**

Run: `pnpm test:visual tests/visual/public-pages.spec.ts tests/visual/consent-banner.spec.ts`

Expected: 0 px.

- [ ] **Step 3: Re-shoot the admin baselines**

Update `tests/visual/admin-screens.spec.ts` URLs to the new paths (insights, collections/team, marketing, marketing/code, activity, help, settings/ai-assistant). Rename the baselines with `git mv` where the screen is the same. Then run `pnpm test:visual:update tests/visual/admin-*.spec.ts` followed by `pnpm test:visual` twice, which must be green both times.

- [ ] **Step 4: Commit**

Commit the visual spec and screenshots with the message `test(visual): re-baseline admin for MK IA (phase B)`, ending with the co-author line.
