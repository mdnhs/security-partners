# Phase 4b — James Whitfield admin parity

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master, Phase 4 = Tasks 4.1–4.7; this phase restyles what 4.1, 4.4–4.7 built). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§8.1 IA, §8.2 editing UX, §6.1 permissions, §15 testing). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Why this phase exists (ledger, 2026-10-16):** "admin panel must match ireland/james-whitfield admin panel (full parity: shell/layout, styling, components, screen UX patterns) … execute after Task 13 fix + Task 14 land; later phases follow JW patterns." The reference is `/Users/nazmulhasansourab/ireland/james-whitfield` (**read-only — never modify it**): `app/(admin)/**`, `admin/components/**`, `admin/modules/**`, `docs/brief.md` §9. JW is a different client: we take its **layout, structure, components and UX**, never its brand (no "Magda Kennedy", no green "Evergreen" palette, no JW logo). Security Partners keeps its navy/green brand, `public/images/logo.png`, the name "Security Partners".

**Global constraints that bind this phase**

- Public design is frozen: the 40 public baselines in `tests/visual/__screenshots__/` stay at **0 px** (1440×900 and 390×844, macOS, port 3100 free). Nothing in `app/globals.css`, `app/(site)/**`, `components/{home,about,services,team,blog,contact,layout,shared}/**` or `components/theme-provider.tsx` changes. Every admin token lives in `app/(admin)/admin/admin.css` under `html[data-admin]`.
- `next build` succeeds with no env vars and no database (admin request data stays inside `<Suspense>`).
- Permissions unchanged: every nav item, dock link, KPI, card and action stays gated exactly as today (`hasPermission`, `usePermission`, `requirePermission`). This phase moves and restyles; it never widens access.
- WCAG 2.2 AA: text ≥ 4.5:1, control edges and focus indicators ≥ 3:1 (SC 1.4.11), visible focus (`focus-visible:ring-3 ring-ring/50`), every drag has Move up/Move down buttons (SC 2.5.7), no single-character shortcuts (SC 2.1.4 — the admin gets its own theme provider without the public site's "d" hotkey), focus not obscured by sticky UI (SC 2.4.11), reduced motion honoured.
- Responsive: sidebar → sheet below **1024 px** (JW uses the same breakpoint, `hooks/use-mobile.ts` already at 1024); tables → cards below 640 px.
- UI primitives: shadcn `base-nova` (base-ui). Compose triggers with `render`, never `asChild`. New primitives come from the pinned CLI (`pnpm exec shadcn add …`, shadcn 4.21.4 from devDependencies); decline every overwrite prompt.
- Code style: repo Prettier. Run `pnpm exec prettier --write <files>` on files you create or edit.
- Commit after every task, staging only your paths; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Only one agent at a time runs Playwright (`test:visual`, `test:e2e`) or `next build` (ledger ruling).
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` + `pnpm test:visual` (40 public at 0 px + re-baselined admin) + `pnpm test:e2e`.

**Prerequisites:** Phase 4 Tasks 1–10, Task 13 (`6754df3`) + its fix round (`d41b909`), and **Task 14** (shared `SectionTabs` in `components/admin/section-tabs/section-tabs.tsx`, `components/admin/schema-form/form-tabs.tsx`, `components/admin/settings/settings-tabs.tsx`, `app/(admin)/admin/(panel)/settings/layout.tsx`, account page on SectionTabs) committed. Phase 4 **Task 11 (dashboard) and Task 12 (users + audit screens) are not prerequisites** of Tasks 1–10 here; Task 11 of this plan runs **after** phase-04 Task 11, and Task 12 after phase-04 Task 12. Where real code differs from the excerpts quoted here (Task 14 was in progress when this plan was written), apply the same change to the real code and say so in your report.

**Execution order (for the controller):** 04b Tasks 1 → 10, then phase-04 Task 11 (server + DTO as planned; its UI files are replaced by 04b Task 11), then 04b Task 11, then phase-04 Task 12 (with the amendments in "Amendments to phase-04 Task 12" below), then 04b Task 12 (re-baseline + a11y gate, so it captures Users/Audit too). Task 4 → 5 → 6 → 7 → 8 → 9 are sequential (shared files); Tasks 2 and 3 may run in parallel after Task 1 (disjoint files; only one may hold the Playwright/build lock).

**Ledger rulings applied:** sidebar cookie `sidebar_state` scoped to `/admin`, SameSite=Lax (phase-04 Task 13 fix); sheet below 1024 px keeps its visible close button; website card origin from `settings.site.productionUrl` else `BETTER_AUTH_URL` origin (never the Host header); impersonation banner and topbar share one header wrapper in the content column (not under the sidebar); ⌘/Ctrl+B ignores editable targets and prevented events; cmdk `vimBindings={false}`; SectionTabs is the one component for in-page sections and route sub-pages (extend, never replace); starting/stopping impersonation clears the query cache; only one agent runs Playwright/build at a time.

## Corrections to master plan

- **Master 4.1 files renamed/added** (shell): `components/admin/shell/{topbar.tsx,search-pill.tsx,palette-context.tsx,notifications-button.tsx,user-menu.tsx,footer-dock.tsx,brand-mark.tsx}` replace `site-header.tsx` and `nav-user.tsx` — cost: later plans that name `site-header.tsx`/`nav-user.tsx` must use the new files (none of Phases 5–8 edit them).
- **Admin design kit** `components/admin/kit/*` (PageHeader action classes, StatusPill, EmptyState, DashboardCard, skeletons, KpiCard, PillBarChart, ActivityFeed, Swirl, noise, format) is the one source of admin look; Phases 5–10 use it (see "Patterns for later phases") — cost: none.
- **Nav registry shape:** `NavItem` gains `children?: NavChild[]` and `dock?: true`; the "You" section is removed (Account lives in the user menu and the footer dock); Team, Clients, Group companies and Categories become children of one **Collections** item (URLs unchanged, moved into the `(collections)` route group). Section labels stay `Overview / Content / Configuration` so Phases 5–7 insert their items where their plans say — cost: Phase 5's Articles item later takes Categories as a child (see patterns).
- **Master 4.7 UI:** the dashboard renders with the kit (hero KPI, pill bar chart, Next up card, Team activity from `GET /audit`) — `DashboardDto` is unchanged; the content-health gauge waits for Phase 8 SEO data — cost: none.

## Deviations from JW needing controller rulings

| # | JW | This plan | Why | Cost if ruled the other way |
|---|---|---|---|---|
| D1 | Plus Jakarta Sans | **Lato** (SP brand font, already loaded) + Geist Mono | Brand rule: typeface is part of SP's brand | Swap `Lato` for `Plus_Jakarta_Sans` in `app/(admin)/admin/layout.tsx` + re-baseline admin |
| D2 | Green primary everywhere | Primary = AA-darkened SP green `#367318` (dark `#7cc84a`); hero KPI, website card and auth brand panel = **navy** gradients; charts navy/blue/green | SP brand green `#67bd31` with white text is 2.3:1 (fails AA); navy surfaces mirror the public hero | Change 2 token blocks in `admin.css`; contrast test guards |
| D3 | Sections Menu/Growth/General; Collections as one item with tabs | Same structure, but SP section labels **Overview / Content / Configuration** kept; Team/Clients/Group companies/Categories under **Collections** tabs; Account → user menu + dock | Spec §8.1 lists them flat under Content; keeping labels keeps Phase 5–7 plan edits valid | Rename labels in `nav.ts` + update later-phase insert instructions |
| D4 | View-as banner = floating pill at the bottom | Banner stays a strip **above the topbar** in the content column | Ledger ruling (WCAG 2.4.11, banner never covers content) | Move `ImpersonationBanner` to a fixed bottom pill |
| D5 | Collections reorder by dragging table rows inline | Keep the **"Change order" panel** (`ReorderPanel`), restyled | SP lists are server-paginated/searchable; inline drag would only reorder one page | Client-side list of all rows + inline `SortableRoot` (JW `collection-view.tsx`) |
| D6 | Topbar: no breadcrumb, no View site | Same as JW (breadcrumb and View site removed from the header; View site is in the website card and the dashboard) | Parity | Keep breadcrumb in topbar |
| D7 | "Enquiries this week" pill chart with hatched last-week bars; content-health gauge | 90-day trend as **13 weekly pill bars, single series**; gauge deferred to Phase 8 | `DashboardDto.leadsTrend` has no previous period; no SEO data yet | Extend DTO with a previous period (Phase 7) |
| D8 | `@axe-core/playwright` admin a11y suite | Add `@axe-core/playwright@4.13.0` (dev) | Not in master Tech Stack | Drop `tests/e2e/admin-a11y.spec.ts` from Task 12 (manual a11y only) |
| D9 | Page builder live preview pane from xl (1280) | Live preview pane from **2xl (1536)**; below it "Preview" opens a new tab | SP editor already has a left SectionTabs column; three columns at 1280 squeeze the form | Change `2xl:` to `xl:` in `EditorLayout` |
| D10 | Editor header scrolls away | Editor header stays **sticky inside the content panel** | SP already ships a sticky save/publish bar (Task 7) | Remove `sticky` classes |

## Parity map

JW paths are relative to `/Users/nazmulhasansourab/ireland/james-whitfield`. "SP now" is the state after Task 13 fix (`d41b909`) and Task 14.

| JW element (source) | SP now | Change (task) |
|---|---|---|
| Admin root layout: own Tailwind entry `app/(admin)/admin.css`, `data-theme="admin"`, admin-only next-themes key, no hotkey (`app/(admin)/layout.tsx`, `components/theme-provider.tsx`) | `app/(admin)/admin/layout.tsx` imports `globals.css` + `admin.css` separately; shared `ThemeProvider` with the public "d" hotkey; `body bg-muted/40` | `admin.css` becomes the admin Tailwind entry (`@import "../../globals.css"` + admin `@theme`); `components/admin/theme-provider.tsx` (key `sp-admin-theme`, no hotkey); `body bg-background` (Task 1) |
| Evergreen tokens: white canvas, grey panels, white cards; status soft/strong pairs; skeleton; hatch; hero/promo gradients; dark mode as elevation; `--radius .75rem`; type scale `text-title/card-title/kpi`, `rounded-card` 22 px; reduced-motion rule; thin scrollbars (`app/(admin)/admin.css`, brief §9.2) | Navy sidebar tokens only; no type scale; no status tokens | Same token set in SP navy/green (D2), light + dark, contrast-tested (Task 1) |
| Floating-panel shell: 16 px gutters, 288 px floating sidebar panel (`--sidebar-width: 20rem`, `p-4`), 72 px topbar panel, content panel `rounded-card bg-sidebar` with its own scroll, `--content-h` (`admin/components/shell/admin-shell.tsx`) | shadcn `inset` sidebar 16rem navy, sticky 56 px header, `main max-w-6xl` | JW layout (Task 4) |
| Sidebar primitive: floating inner `rounded-card` (no ring/shadow), icon rail `+spacing(8)` (`components/ui/sidebar.tsx`) | floating = `rounded-lg shadow-sm ring-1`, rail `+spacing(4)` | Two class edits (Task 4) |
| BrandMark: round mark + client name + "Admin" pill; inverse tone on dark panels (`admin/components/brand-mark.tsx`) | Logo tile + "Security Partners / Website admin" in a `SidebarMenuButton` | `BrandMark` with SP logo tile (Task 4) |
| Nav groups + sections only; sub-pages as SectionTabs from `children`; `dock` items; badge `new-leads` (`lib/admin/nav.ts`) | `NAV_SECTIONS` flat (Overview/Content/Configuration/You); badge slot exists | `children` + `dock` in `nav.ts`; Collections parent; Account → dock (D3) (Task 3) |
| NavEntry: `h-10 rounded-xl text-[15px]`, muted label, active = bold label + `fill-primary/15 text-primary` icon + 4 px bar at the panel edge; `99+` pill (`nav-entry.tsx`) | shadcn default size, inset shadow bar | JW classes (Task 4) |
| Website card = promo card (dark gradient + swirl, Live dot, "Your website", host, "Open site" h-11) holding the dock row (`website-card.tsx`) | Flat `bg-sidebar-accent` card + icon link in rail | Navy promo card + dock row; rail shows dock column (Task 4) |
| FooterDock: Users & roles, Activity log, Help, Log out as icon buttons with tooltips; row in card, column in rail (`footer-dock.tsx`) | none | `FooterDock` with Account, (Users, Audit log from phase-04 Task 12), Log out (Task 4) |
| Topbar: trigger (round), SearchPill (`h-11 rounded-full`, ⌘K kbd, filter icon), AI button, mail→Enquiries, bell, avatar (`topbar.tsx`, `search-pill.tsx`) | `SiteHeader`: trigger, breadcrumb, outline "Search…" button, View site | `Topbar` + `SearchPill` + palette context; breadcrumb/View site removed (D6); mail icon added by Phase 7, AI by Phase 9 (Task 4) |
| NotificationsButton: bell popover, honest empty state (`notifications-button.tsx`) | none | Same; Phase 7 fills it (Task 4) |
| UserMenu: 44 px avatar; label with name, email, role badge; Account, Security, Theme radio (Light/Dark/System), Sign out (`user-menu.tsx`) | `NavUser` in sidebar footer (Account, Sign out, error alert) | `UserMenu` in topbar keeping SP's sign-out error handling (Task 4) |
| SectionTabs: `lg:w-52`, uppercase section caption, `hover:bg-sidebar-accent/60`, active `bg-sidebar-accent font-semibold`, 4 px primary bar (`section-tabs.tsx`) | Task 14 component (route + in-page modes, ?tab=, roving focus, error dots) | Restyle + optional `heading` prop; behaviour unchanged (Task 5) |
| PageHeader: `text-title`, description 15 px, actions; `PRIMARY_ACTION`/`SECONDARY_ACTION`/`FORM_ACTION`, `LINK_*` (`admin/components/dashboard/page-header.tsx`) | `components/admin/page-header.tsx` (2xl bold) | Same API + JW look + `breadcrumbs`, `titleTestId`; action class exports (Task 2) |
| DashboardCard, StatusPill (`toneForStatus`), EmptyState (dashed `rounded-card`), skeletons `bg-skeleton`, KpiCard hero/default, PillBarChart, ActivityFeed, Swirl, NOISE, format helpers (`admin/components/dashboard/*`) | shadcn `Card`/`Badge`, ad-hoc empty/error blocks | `components/admin/kit/*` (Task 2) |
| DataTable: `rounded-card bg-card` no border, `h-12` heads, cards < 640 px, `aria-busy` fade; DataTablePagination with chevron ButtonGroup + `formatNumber` (`admin/components/data-table/*`) | Bordered table, uppercase muted heads, text Prev/Next, inline empty block | Restyle, keep server paging/sort/search + mobile sort select (Task 6) |
| Pages list: DataTable with Title link, `code` Address, StatusPills (Published/Draft + Unpublished changes), relative Updated (`modules/pages/pages-view.tsx`) | Hand-built table + Badge | JW columns over SP's 8 fixed pages (Task 6) |
| Collections: PageHeader + primary action, StatusPill visibility, delete in `danger-soft`, item Sheet titled "Edit {noun}" (`modules/collections/*`) | `CollectionScreen` + `RecordSheet` + `ReorderPanel` | Restyle; keep reorder panel (D5) (Task 6) |
| Page builder header: back link, `code` path + StatusPills, SaveIndicator pill (dot + "Saved 2 s ago"), History/Preview outline `h-12 bg-card`, Discard, Publish `PRIMARY_ACTION`; panes in `rounded-card bg-card`; live preview iframe with device toggle (`modules/pages/{page-builder,save-indicator,preview-pane}.tsx`) | `EditorLayout` sticky bar, `SaveStateIndicator` icon text, form groups `rounded-xl border shadow-xs` | JW header (sticky, D10), SaveIndicator pill keeping SP states, group cards `rounded-card bg-card`, `PreviewPane` from 2xl (D9) (Tasks 7–8) |
| Settings: section tabs + global editor (`modules/globals/global-editor.tsx`) | Task 14 settings layout + `SettingsOverview` cards | Overview as kit cards; tabs restyled by Task 6 (Task 9) |
| Account: Profile (+ Appearance theme card) / Security (Password + 2FA) / Devices, each a DashboardCard; View-as → EmptyState (`modules/account/account-view.tsx`) | Task 14: four SectionTabs panels of shadcn Cards | Three SectionTabs panels with DashboardCards + ThemePreference (Task 9) |
| Auth: split layout — brand panel (gradient, swirl, noise, BrandMark inverse, headline, chips) + form panel `rounded-[28px] bg-sidebar`; AuthHeader `text-[2rem]`; controls `h-11 rounded-xl` (`app/(admin)/admin/(auth)/layout.tsx`, `modules/auth/{auth-header,styles}.ts`) | Centred shadcn Card with logo | JW split layout in SP navy (Task 10) |
| Dashboard: "Good morning, {first}", New/View site button pair, KPI row (hero first), pill chart, Next up, Team activity, Content health (`modules/dashboard/dashboard-view.tsx`) | Phase-04 Task 11 (pending) | JW layout over `DashboardDto` + `GET /audit` (D7) (Task 11) |
| Panel `error.tsx` (retry) and `not-found.tsx`: centred `text-card-title`, h-11 rounded-xl retry (`app/(admin)/admin/(panel)/{error,not-found}.tsx`) | no panel error boundary; root admin 404/403 plain | Add panel `error.tsx`; restyle `not-found.tsx`/`forbidden.tsx` (Task 9) |
| Admin a11y E2E: axe on every panel URL in light + dark, palette and user menu open (`tests/e2e/admin/a11y/axe.spec.ts`); admin token contrast unit test (`tests/css/admin-tokens.test.ts`) | none | `tests/e2e/admin-a11y.spec.ts` (D8) (Task 12); `tests/unit/admin/admin-tokens.test.ts` (Task 1) |
| Visual: shell + dashboard in light and dark, pinned data via `page.route`, frozen clock, reduced motion (`tests/e2e/admin/visual/shell.spec.ts`) | 4 admin shell baselines, main masked | Light + dark shell, dashboard, pages list, editor, settings, account, sign-in (Task 12) |
| Dependencies JW has, SP lacks: shadcn `table, empty, item, scroll-area, toggle, toggle-group, button-group, select, tabs, checkbox, radio-group, breadcrumb`; `@axe-core/playwright@4.13.0`; `nuqs`, `date-fns`, `@date-fns/tz`, `react-colorful`, `culori` | — | Task 1 adds `empty, toggle, toggle-group, button-group` (the ones this phase uses; `table, item, scroll-area, select, tabs…` arrive with the later phase that first needs them); Task 12 adds axe. **Not added:** `nuqs` (SP keeps `useTabParam`/component state for URL state), `date-fns` (SP has `lib/format.ts` + kit `relativeTime`), colour libs (no Appearance screen in SP spec) |

---

### Task 1: Admin tokens, type scale, admin theme provider, primitives (master Task 4.1 restyle, part 1)

**Files:**
- Modify: `app/(admin)/admin/admin.css` (full rewrite below), `app/(admin)/admin/layout.tsx`, `components/admin/providers.tsx` (Toaster position)
- Create: `components/admin/theme-provider.tsx`
- Create (CLI): `components/ui/{empty,toggle,toggle-group,button-group}.tsx`
- Test: `tests/unit/admin/admin-tokens.test.ts`, `tests/dom/admin-theme-provider.test.tsx`

**Interfaces:**
- Consumes: `app/globals.css` (unchanged: Tailwind entry, `--color-brand-*`, shadcn `@theme inline` colour mapping), `next-themes@0.4.6`.
- Produces:

```ts
// components/admin/theme-provider.tsx
export const ADMIN_THEME_STORAGE_KEY = "sp-admin-theme"
export function AdminThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>): JSX.Element
// Tailwind utilities (admin only): text-title, text-card-title, text-kpi, rounded-card,
// bg-/text- success|success-soft|warning|warning-soft|danger|danger-soft|skeleton|hero-chip|hero-chip-foreground|hero-delta,
// bg-hatch, bg-hero, bg-promo
// CSS variables on html[data-admin] (light) and html[data-admin].dark: see admin.css
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/admin-tokens.test.ts`:

```ts
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const css = readFileSync(
  path.join(import.meta.dirname, "../../../app/(admin)/admin/admin.css"),
  "utf8"
)
const publicCss = readFileSync(
  path.join(import.meta.dirname, "../../../app/globals.css"),
  "utf8"
)

/** Custom properties declared in the first `<selector> {` block. */
function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`admin.css has no "${selector} {" block`)
  const body = css.slice(start, css.indexOf("}", start))
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim().toLowerCase(),
    ])
  )
}

const light = declarations("html[data-admin]")
// Dark only overrides; anything it leaves out falls back to light.
const dark = { ...light, ...declarations("html[data-admin].dark") }

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const REQUIRED = [
  "radius",
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "skeleton",
  "hatch",
  "hero-from",
  "hero-to",
  "hero-foreground",
  "hero-chip",
  "hero-chip-foreground",
  "hero-delta",
  "promo-from",
  "promo-to",
  "promo-foreground",
]

// Text on the surfaces the admin actually puts it on (WCAG 1.4.3).
const TEXT_PAIRS: [text: string, surface: string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "sidebar"],
  ["foreground", "sidebar-accent"],
  ["muted-foreground", "card"],
  ["muted-foreground", "sidebar"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "sidebar-accent"],
  ["primary-foreground", "primary"],
  ["primary", "card"],
  ["primary", "sidebar"],
  ["accent-foreground", "accent"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
  ["hero-foreground", "hero-to"],
  ["hero-delta", "hero-to"],
  ["hero-chip-foreground", "hero-chip"],
  ["promo-foreground", "promo-to"],
]

describe.each([
  ["light", light],
  ["dark", dark],
])("%s admin tokens", (_name, tokens) => {
  it.each(REQUIRED)("defines --%s", (token) => {
    expect(tokens[token]).toBeTruthy()
  })

  it.each(TEXT_PAIRS)("--%s on --%s meets 4.5:1", (text, surface) => {
    expect(contrast(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(4.5)
  })

  // WCAG 1.4.11: control edges and the focus ring on every surface.
  it.each(["background", "card", "sidebar"])(
    "--input and --ring on --%s meet 3:1",
    (surface) => {
      expect(contrast(tokens.input, tokens[surface])).toBeGreaterThanOrEqual(3)
      expect(contrast(tokens.ring, tokens[surface])).toBeGreaterThanOrEqual(3)
    }
  )

  // Floating panels stand off the canvas; cards stand off the panels.
  it.each([
    ["sidebar", "background"],
    ["card", "sidebar"],
  ])("--%s is distinct from --%s", (a, b) => {
    expect(contrast(tokens[a], tokens[b])).toBeGreaterThanOrEqual(1.08)
  })
})

describe("admin stylesheet", () => {
  it("builds on the public entry without redefining it", () => {
    expect(css).toContain('@import "../../globals.css";')
    expect(css).not.toMatch(/(^|\n):root\s*\{/)
    expect(css).not.toMatch(/(^|\n)\.dark\s*\{/)
  })

  it.each([
    "--text-title:",
    "--text-card-title:",
    "--text-kpi:",
    "--radius-card:",
    "--color-success-soft:",
    "--color-skeleton:",
  ])("declares %s", (token) => {
    expect(css).toContain(token)
  })

  it("keeps the admin-only utilities out of the public stylesheet", () => {
    expect(publicCss).not.toContain("--radius-card")
    expect(publicCss).not.toContain("--text-kpi")
  })

  it("honours reduced motion inside the admin only", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*html\[data-admin\] \*/
    )
  })
})
```

`tests/dom/admin-theme-provider.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useTheme } from "next-themes"
import { describe, expect, it } from "vitest"

import {
  ADMIN_THEME_STORAGE_KEY,
  AdminThemeProvider,
} from "@/components/admin/theme-provider"

function Probe() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <p data-testid="theme">{theme}</p>
      <button type="button" onClick={() => setTheme("dark")}>
        Dark
      </button>
      <input aria-label="Field" />
    </>
  )
}

describe("AdminThemeProvider", () => {
  it("stores the choice under the admin's own key", async () => {
    const user = userEvent.setup()
    render(
      <AdminThemeProvider>
        <Probe />
      </AdminThemeProvider>
    )
    await user.click(screen.getByRole("button", { name: "Dark" }))
    expect(localStorage.getItem(ADMIN_THEME_STORAGE_KEY)).toBe("dark")
    expect(localStorage.getItem("theme")).toBeNull()
  })

  it("has no single-key theme shortcut (WCAG 2.1.4)", async () => {
    localStorage.removeItem(ADMIN_THEME_STORAGE_KEY)
    const user = userEvent.setup()
    render(
      <AdminThemeProvider defaultTheme="light">
        <Probe />
      </AdminThemeProvider>
    )
    await user.keyboard("d")
    expect(screen.getByTestId("theme")).toHaveTextContent("light")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/admin/admin-tokens.test.ts`
Expected: FAIL — e.g. `light admin tokens > defines --success`, `defines --background` and `admin stylesheet > builds on the public entry without redefining it` (current admin.css has neither the `@import` nor the status/canvas tokens).

Run: `pnpm exec vitest run --project dom tests/dom/admin-theme-provider.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/theme-provider"`.

- [ ] **Step 3: Add the shadcn primitives the kit needs**

Run: `pnpm exec shadcn add empty toggle toggle-group button-group`
Answer **n** to every "overwrite?" prompt (e.g. `separator.tsx`, `button.tsx`). Then:

Run: `git diff --exit-code components/ui/button.tsx components/ui/separator.tsx app/globals.css components.json package.json pnpm-lock.yaml`
Expected: exit 0 (no changes outside the 4 new files). If `app/globals.css` changed, `git checkout app/globals.css` (public freeze).

Run: `git status --short components/ui`
Expected: exactly `?? components/ui/{button-group,empty,toggle-group,toggle}.tsx`.

- [ ] **Step 4: Implement**

`app/(admin)/admin/admin.css` (full file):

```css
/*
 * The admin's Tailwind entry: the public entry (utilities, shadcn base,
 * brand colours) plus the admin type scale, card radius and colour tokens.
 * Every token is scoped to <html data-admin>, so the public site (which
 * loads app/globals.css alone) never changes.
 * Layout language: the James Whitfield admin (floating grey panels on a
 * white canvas, white cards). Colours: Security Partners navy and green.
 */
@import "../../globals.css";

/* Type scale and card radius (phase-04b Task 1). */
@theme {
  --text-title: 2.25rem;
  --text-title--line-height: 1.1;
  --text-title--letter-spacing: -0.025em;
  --text-title--font-weight: 700;
  --text-card-title: 1.125rem;
  --text-card-title--line-height: 1.35;
  --text-card-title--font-weight: 700;
  --text-kpi: 2.75rem;
  --text-kpi--line-height: 1;
  --text-kpi--letter-spacing: -0.03em;
  --text-kpi--font-weight: 700;
  --radius-card: 1.375rem;
}

@theme inline {
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-skeleton: var(--skeleton);
  --color-hero-chip: var(--hero-chip);
  --color-hero-chip-foreground: var(--hero-chip-foreground);
  --color-hero-delta: var(--hero-delta);
}

html[data-admin] {
  --radius: 0.75rem;
  /* White canvas, cool-grey panels (sidebar, topbar, content), white cards. */
  --background: #ffffff;
  --foreground: #0d1b36;
  --card: #ffffff;
  --card-foreground: #0d1b36;
  --popover: #ffffff;
  --popover-foreground: #0d1b36;
  /* Brand green, darkened for AA with white text (brand #67bd31 is 2.3:1). */
  --primary: #367318;
  --primary-foreground: #ffffff;
  --secondary: #e8edf5;
  --secondary-foreground: #0d1b36;
  --muted: #e8edf5;
  --muted-foreground: #5a6478;
  --accent: #eef6e8;
  --accent-foreground: #2f5f14;
  --destructive: #dc2626;
  --border: #e3e8f2;
  /* Control edges (WCAG 1.4.11): 3:1 on canvas, panels and cards. */
  --input: #7d8799;
  --ring: #4e9a22;
  --chart-1: #2751a3;
  --chart-2: #4e9a22;
  --chart-3: #67bd31;
  --chart-4: #0d1b36;
  --chart-5: #a7d98a;
  --sidebar: #f1f4f9;
  --sidebar-foreground: #0d1b36;
  --sidebar-primary: #367318;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #eef6e8;
  --sidebar-accent-foreground: #2f5f14;
  --sidebar-border: #e3e8f2;
  --sidebar-ring: #4e9a22;
  /* Status pills: soft fill, strong text. */
  --success: #15803d;
  --success-soft: #dcfce7;
  --warning: #b45309;
  --warning-soft: #fef3c7;
  --danger: #b91c1c;
  --danger-soft: #fee2e2;
  /* Loading placeholders, visible on panels and cards. */
  --skeleton: #dde3ec;
  /* Comparison-period stripes in charts and legends. */
  --hatch: #a7d98a;
  /* Hero KPI card and the auth brand panel (navy, like the public hero). */
  --hero-from: #0d1b36;
  --hero-to: #1b3566;
  --hero-foreground: #ffffff;
  --hero-chip: #ffffff;
  --hero-chip-foreground: #0d1b36;
  --hero-delta: #b7e892;
  /* The sidebar's "Your website" card. */
  --promo-from: #071022;
  --promo-to: #13284d;
  --promo-foreground: #ffffff;
}

html[data-admin].dark {
  /* Elevation: canvas darkest, then panels, then cards. */
  --background: #0b1220;
  --foreground: #e6ebf3;
  --card: #1d2840;
  --card-foreground: #e6ebf3;
  --popover: #1d2840;
  --popover-foreground: #e6ebf3;
  --primary: #7cc84a;
  --primary-foreground: #0a1408;
  --secondary: #1a2337;
  --secondary-foreground: #e6ebf3;
  --muted: #1a2337;
  --muted-foreground: #9aa6bb;
  --accent: #1f3318;
  --accent-foreground: #cfeab8;
  --destructive: #f87171;
  --border: #26324a;
  --input: #6b7a95;
  --ring: #7cc84a;
  --chart-1: #7aa2f0;
  --chart-2: #7cc84a;
  --chart-3: #a7d98a;
  --chart-4: #c7d3ea;
  --chart-5: #3f6b25;
  --sidebar: #141c2e;
  --sidebar-foreground: #e6ebf3;
  --sidebar-primary: #7cc84a;
  --sidebar-primary-foreground: #0a1408;
  --sidebar-accent: #1f3318;
  --sidebar-accent-foreground: #cfeab8;
  --sidebar-border: #26324a;
  --sidebar-ring: #7cc84a;
  --success: #4ade80;
  --success-soft: #12301c;
  --warning: #fbbf24;
  --warning-soft: #33270c;
  --danger: #f87171;
  --danger-soft: #3a1414;
  --skeleton: #2a3550;
  --hatch: #3f6b25;
}

@utility bg-hatch {
  background-image: repeating-linear-gradient(
    -45deg,
    var(--hatch) 0 3px,
    transparent 3px 7px
  );
}

@utility bg-hero {
  background-image: linear-gradient(160deg, var(--hero-from), var(--hero-to));
  color: var(--hero-foreground);
}

@utility bg-promo {
  background-image: linear-gradient(160deg, var(--promo-from), var(--promo-to));
  color: var(--promo-foreground);
}

@layer base {
  /* Narrow, quiet scrollbars across the admin (sidebar, tab rows, tables). */
  html[data-admin] * {
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
}

/* Restrained motion, and none for people who ask for less. */
@media (prefers-reduced-motion: reduce) {
  html[data-admin] *,
  html[data-admin] *::before,
  html[data-admin] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

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
/* Brand blue is too dark on the dark admin surface (WCAG 1.4.3). */
html[data-admin].dark .rich-text-content a {
  color: var(--ring);
}
```

The old `scroll-padding-top: calc(var(--admin-header-h, 3.5rem) + 0.5rem)` rule is dropped: from Task 4 the document no longer scrolls (the content panel does) and Task 8 moves the scroll padding onto the panel.

`components/admin/theme-provider.tsx`:

```tsx
"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

/** The admin's own key: a theme chosen here never touches the public site. */
export const ADMIN_THEME_STORAGE_KEY = "sp-admin-theme"

/**
 * Light, dark or system for the admin. Deliberately no single-key hotkey
 * (WCAG 2.1.4): the theme changes from the user menu or the Account page.
 */
export function AdminThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={ADMIN_THEME_STORAGE_KEY}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
```

`app/(admin)/admin/layout.tsx` (full file):

```tsx
import type { Metadata } from "next"
import { Geist_Mono, Lato } from "next/font/google"

import "./admin.css"
import { AdminThemeProvider } from "@/components/admin/theme-provider"
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

/**
 * Root layout for /admin (separate from the public site's). admin.css is
 * the admin's Tailwind entry: it imports the public globals.css and adds
 * the admin tokens, all under html[data-admin].
 */
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IE"
      data-admin=""
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", lato.variable)}
    >
      <body className="min-h-svh bg-background text-foreground">
        <AdminThemeProvider>{children}</AdminThemeProvider>
      </body>
    </html>
  )
}
```

`components/admin/providers.tsx`: change `<Toaster position="bottom-right" richColors closeButton />` to `<Toaster position="top-center" richColors closeButton />` (JW: toasts top-centre, clear of the floating panels' corners).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/admin/admin-tokens.test.ts`
Expected: PASS (2 × (49 + 20 + 3 + 2) + 9 = 157 tests).

Run: `pnpm exec vitest run --project dom tests/dom/admin-theme-provider.test.tsx`
Expected: PASS (2 tests).

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Verify the admin utilities compile and the public CSS does not change**

Run (build lock: only if no other agent runs Playwright/build): `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0.

Run: `grep -l "rounded-card\|--radius-card" .next/static/chunks/*.css .next/static/css/*.css 2>/dev/null | wc -l`
Expected: ≥ 1 (the admin chunk). If it prints 0, Tailwind did not inline `globals.css`: replace the `@import "../../globals.css";` line with the three lines `@import "tailwindcss"; @import "tw-animate-css"; @import "shadcn/tailwind.css";` followed by a verbatim copy of `globals.css` lines 5–60 (`@custom-variant` and the `@theme inline` block) and re-run Steps 5–6; report it.

Run: `pnpm test:visual --project desktop --project mobile tests/visual/public-pages.spec.ts`
Expected: 40 passed, 0 px diff (public untouched). Admin shell baselines may fail here (colours changed): they are re-captured in Task 4.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write "app/(admin)/admin/admin.css" "app/(admin)/admin/layout.tsx" components/admin/theme-provider.tsx components/admin/providers.tsx tests/unit/admin/admin-tokens.test.ts tests/dom/admin-theme-provider.test.tsx
git add "app/(admin)/admin/admin.css" "app/(admin)/admin/layout.tsx" components/admin/theme-provider.tsx components/admin/providers.tsx components/ui/empty.tsx components/ui/toggle.tsx components/ui/toggle-group.tsx components/ui/button-group.tsx tests/unit/admin/admin-tokens.test.ts tests/dom/admin-theme-provider.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): JW-parity design tokens in SP navy and green

Admin Tailwind entry builds on globals.css and adds the type scale,
card radius, status, skeleton, hatch and hero tokens (light and dark,
contrast-tested) under html[data-admin]. Admin-only theme provider
without the public "d" hotkey. Adds empty, toggle, toggle-group and
button-group primitives.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Admin design kit — JW signature components in SP brand (master Task 4.1 restyle, part 2)

**Files:**
- Modify: `components/admin/page-header.tsx` (JW look + `breadcrumbs`, `titleTestId`, action class exports)
- Create: `components/admin/kit/{format.ts,noise.ts,swirl.tsx,status-pill.tsx,empty-state.tsx,dashboard-card.tsx,skeletons.tsx,kpi-card.tsx,pill-bar-chart.tsx,activity-feed.tsx,content-status.tsx}`, `hooks/use-reduced-motion.ts`
- Test: `tests/unit/admin/kit-format.test.ts`, `tests/dom/admin-kit.test.tsx`

**Interfaces:**
- Consumes: Task 1 utilities (`text-title`, `text-card-title`, `text-kpi`, `rounded-card`, `bg-hero`, `bg-promo`, `bg-hatch`, status colours, `bg-skeleton`); `components/ui/{button,empty,skeleton,avatar,chart}.tsx`; `recharts@3.8.0`.
- Produces:

```ts
// components/admin/page-header.tsx
export const PRIMARY_ACTION: string     // "h-12 gap-2 rounded-xl px-5 text-[15px] font-semibold"
export const SECONDARY_ACTION: string   // outline green, same size
export const FORM_ACTION: string        // "h-11 rounded-xl px-5 font-semibold"
export const LINK_PRIMARY: string; export const LINK_SECONDARY: string; export const LINK_FORM: string
export function PageHeader(props: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: ReactNode; titleTestId?: string }): JSX.Element
// components/admin/kit/format.ts
export const formatNumber: (n: number) => string
export const formatPercent: (ratio: number) => string
export type Delta = { label: string; direction: "up" | "down" | "flat" }
export function formatDelta(current: number, previous: number): Delta | null
export function relativeTime(iso: string, now: number): string
export function peakIndex(values: readonly number[]): number
export function initials(name: string): string
// components/admin/kit/status-pill.tsx
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"
export const toneForStatus: (status: string) => StatusTone
export function StatusPill(props: { tone: StatusTone; children: ReactNode; className?: string }): JSX.Element  // data-slot="status-pill"
// components/admin/kit/content-status.tsx
export type ContentState = { published: unknown; dirty: boolean }
export function contentStatus(record: ContentState): { label: string; tone: StatusTone }[]
export function ContentStatusPills(props: { record: ContentState }): JSX.Element
// components/admin/kit/empty-state.tsx
export function EmptyState(props: { title: string; description: ReactNode; action?: ReactNode; icon?: LucideIcon; role?: "alert" | "status" }): JSX.Element
// components/admin/kit/dashboard-card.tsx
export function DashboardCard(props: { title: string; action?: ReactNode; children: ReactNode; className?: string; headingLevel?: 2 | 3 }): JSX.Element
// components/admin/kit/skeletons.tsx
export function KpiRowSkeleton(): JSX.Element; export function CardSkeleton(props: { className?: string }): JSX.Element
// components/admin/kit/kpi-card.tsx
export function KpiCard(props: { label: string; value: string; caption: string; delta?: Delta | null; href?: string; variant?: "hero" | "default" }): JSX.Element
// components/admin/kit/pill-bar-chart.tsx
export type PillBarDatum = { key: string; label: string; current: number; previous?: number }
export function PillBarChart(props: { title: string; data: readonly PillBarDatum[]; currentLabel: string; previousLabel?: string; rowHeader?: string }): JSX.Element
// components/admin/kit/activity-feed.tsx
export type ActivityEntry = { id: string; name: string; description: string; at: string; status?: { label: string; tone: StatusTone } }
export function ActivityFeed(props: { entries: readonly ActivityEntry[]; now: number; emptyTitle: string; emptyDescription: string; label?: string }): JSX.Element
// components/admin/kit/swirl.tsx, noise.ts
export function Swirl(props: { className?: string }): JSX.Element
export const NOISE: string
// hooks/use-reduced-motion.ts
export function useReducedMotion(): boolean   // server snapshot: true
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/kit-format.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  formatDelta,
  formatNumber,
  formatPercent,
  initials,
  peakIndex,
  relativeTime,
} from "@/components/admin/kit/format"
import { toneForStatus } from "@/components/admin/kit/status-pill"
import { contentStatus } from "@/components/admin/kit/content-status"

const NOW = Date.parse("2026-10-16T12:00:00Z")

describe("kit format helpers", () => {
  it("formats numbers and percents for en-IE", () => {
    expect(formatNumber(12345)).toBe("12,345")
    expect(formatPercent(0.425)).toBe("43%")
  })

  it("captions a change only when there is a baseline", () => {
    expect(formatDelta(12, 10)).toEqual({ label: "+20%", direction: "up" })
    expect(formatDelta(5, 10)).toEqual({ label: "-50%", direction: "down" })
    expect(formatDelta(0, 0)).toEqual({ label: "No change", direction: "flat" })
    expect(formatDelta(3, 0)).toBeNull()
  })

  it("says how long ago, from a given clock", () => {
    expect(relativeTime("2026-10-16T11:59:40Z", NOW)).toBe("just now")
    expect(relativeTime("2026-10-16T11:55:00Z", NOW)).toBe("5 minutes ago")
    expect(relativeTime("2026-10-16T09:00:00Z", NOW)).toBe("3 hours ago")
    expect(relativeTime("2026-10-15T12:00:00Z", NOW)).toBe("yesterday")
  })

  it("finds the busiest bar (first on ties, -1 when empty)", () => {
    expect(peakIndex([1, 4, 4, 2])).toBe(1)
    expect(peakIndex([])).toBe(-1)
  })

  it("makes up to two initials", () => {
    expect(initials("Edith Mary Editor")).toBe("EM")
    expect(initials("Cher")).toBe("C")
    expect(initials("  ")).toBe("?")
  })

  it("maps statuses to pill tones", () => {
    expect(toneForStatus("Published")).toBe("success")
    expect(toneForStatus(" draft ")).toBe("neutral")
    expect(toneForStatus("Unpublished changes")).toBe("warning")
    expect(toneForStatus("Something else")).toBe("neutral")
  })

  it("describes a versioned record as JW status pills", () => {
    expect(contentStatus({ published: null, dirty: true })).toEqual([
      { label: "Draft", tone: "neutral" },
    ])
    expect(contentStatus({ published: {}, dirty: false })).toEqual([
      { label: "Published", tone: "success" },
    ])
    expect(contentStatus({ published: {}, dirty: true })).toEqual([
      { label: "Published", tone: "success" },
      { label: "Unpublished changes", tone: "warning" },
    ])
  })
})
```

`tests/dom/admin-kit.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import { Inbox } from "lucide-react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { ActivityFeed } from "@/components/admin/kit/activity-feed"
import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { KpiCard } from "@/components/admin/kit/kpi-card"
import { PillBarChart } from "@/components/admin/kit/pill-bar-chart"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { PageHeader } from "@/components/admin/page-header"

describe("admin kit", () => {
  it("PageHeader: one h1, description, actions and breadcrumbs", () => {
    render(
      <PageHeader
        title="Pages"
        description="Every page of the site."
        breadcrumbs={<a href="/admin">Back</a>}
        actions={<button type="button">New</button>}
        titleTestId="title"
      />
    )
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Pages"
    )
    expect(screen.getByTestId("title")).toHaveClass("text-title")
    expect(screen.getByText("Every page of the site.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument()
  })

  it("StatusPill carries its tone", () => {
    render(<StatusPill tone="warning">Unpublished changes</StatusPill>)
    const pill = screen.getByText("Unpublished changes")
    expect(pill).toHaveAttribute("data-tone", "warning")
    expect(pill).toHaveAttribute("data-slot", "status-pill")
    expect(pill).toHaveClass("bg-warning-soft", "text-warning")
  })

  it("DashboardCard is a region named by its heading", () => {
    render(
      <DashboardCard title="Next up">
        <p>Body</p>
      </DashboardCard>
    )
    const region = screen.getByRole("region", { name: "Next up" })
    expect(within(region).getByRole("heading", { level: 2 })).toHaveClass(
      "text-card-title"
    )
  })

  it("EmptyState says what will appear and offers the next step", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No enquiries yet"
        description="New enquiries appear here."
        action={<button type="button">Open site</button>}
        role="status"
      />
    )
    const box = screen.getByRole("status")
    expect(box).toHaveTextContent("No enquiries yet")
    expect(box).toHaveTextContent("New enquiries appear here.")
    expect(
      within(box).getByRole("button", { name: "Open site" })
    ).toBeInTheDocument()
  })

  it("KpiCard: hero variant with a labelled link and a delta", () => {
    render(
      <KpiCard
        variant="hero"
        label="New enquiries"
        value="7"
        caption="vs the 30 days before"
        delta={{ label: "+40%", direction: "up" }}
        href="/admin/leads"
      />
    )
    const card = screen.getByRole("article")
    expect(card).toHaveAttribute("data-variant", "hero")
    expect(card).toHaveClass("bg-hero")
    expect(
      within(card).getByRole("link", { name: "Open New enquiries" })
    ).toHaveAttribute("href", "/admin/leads")
    expect(card).toHaveTextContent("+40% vs the 30 days before")
  })

  it("PillBarChart: hidden SVG, numbers in a table; one series without a comparison", () => {
    render(
      <PillBarChart
        title="Enquiries by week"
        rowHeader="Week"
        currentLabel="Enquiries"
        data={[
          { key: "a", label: "6 Oct", current: 2 },
          { key: "b", label: "13 Oct", current: 5 },
        ]}
      />
    )
    const table = screen.getByRole("table", { name: "Enquiries by week" })
    expect(within(table).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Week",
      "Enquiries",
    ])
    expect(within(table).getByRole("rowheader", { name: "13 Oct" })).toBeInTheDocument()
    expect(screen.getByText("Enquiries", { selector: "figcaption span" })).toBeInTheDocument()
  })

  it("PillBarChart: two series with a hatched comparison legend", () => {
    render(
      <PillBarChart
        title="Enquiries this week"
        currentLabel="This week"
        previousLabel="Last week"
        data={[{ key: "mon", label: "Mon", current: 1, previous: 3 }]}
      />
    )
    const table = screen.getByRole("table", { name: "Enquiries this week" })
    expect(within(table).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Day",
      "This week",
      "Last week",
    ])
  })

  it("ActivityFeed lists entries with relative times, or an empty state", () => {
    const now = Date.parse("2026-10-16T12:00:00Z")
    const { rerender } = render(
      <ActivityFeed
        now={now}
        emptyTitle="No activity yet"
        emptyDescription="Your team's changes will show here."
        entries={[
          {
            id: "1",
            name: "Edith Editor",
            description: "published the home page",
            at: "2026-10-16T11:00:00Z",
            status: { label: "Published", tone: "success" },
          },
        ]}
      />
    )
    const region = screen.getByRole("region", { name: "Recent activity" })
    const item = within(region).getByRole("listitem")
    expect(item).toHaveTextContent("Edith Editor")
    expect(item).toHaveTextContent("published the home page · 1 hour ago")
    expect(within(item).getByText("Published")).toHaveAttribute(
      "data-tone",
      "success"
    )
    rerender(
      <ActivityFeed
        now={now}
        emptyTitle="No activity yet"
        emptyDescription="Your team's changes will show here."
        entries={[]}
      />
    )
    expect(screen.getByText("No activity yet")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/admin/kit-format.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/admin/kit/format"`.

Run: `pnpm exec vitest run --project dom tests/dom/admin-kit.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/kit/activity-feed"`.

- [ ] **Step 3: Implement**

`hooks/use-reduced-motion.ts`:

```ts
"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** Charts animate only when the user has not asked for less motion (server: reduced). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true
  )
}
```

`components/admin/kit/format.ts`:

```ts
const NUMBER = new Intl.NumberFormat("en-IE")
const PERCENT = new Intl.NumberFormat("en-IE", {
  style: "percent",
  maximumFractionDigits: 0,
})
const CHANGE = new Intl.NumberFormat("en-IE", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})
const RELATIVE = new Intl.RelativeTimeFormat("en-IE", { numeric: "auto" })

export const formatNumber = (n: number) => NUMBER.format(n)
export const formatPercent = (ratio: number) => PERCENT.format(ratio)

export type Delta = { label: string; direction: "up" | "down" | "flat" }

/** A KPI caption's "+3.4%"; without a baseline there is no honest percentage. */
export function formatDelta(current: number, previous: number): Delta | null {
  if (previous === 0) {
    return current === 0 ? { label: "No change", direction: "flat" } : null
  }
  const change = (current - previous) / previous
  if (Math.abs(change) < 0.0005)
    return { label: "No change", direction: "flat" }
  return { label: CHANGE.format(change), direction: change > 0 ? "up" : "down" }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
]

/** "5 minutes ago"; `now` is passed in so server and browser agree. */
export function relativeTime(iso: string, now: number): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  if (Math.abs(seconds) < 45) return "just now"
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return RELATIVE.format(Math.round(seconds / size), unit)
    }
  }
  return RELATIVE.format(Math.round(seconds / 60), "minute")
}

/** Index of the largest value (first on ties); -1 for an empty list. */
export function peakIndex(values: readonly number[]): number {
  let best = -1
  values.forEach((value, index) => {
    if (best === -1 || value > values[best]!) best = index
  })
  return best
}

/** Up to two initials for avatar fallbacks; "?" without a name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.length
    ? parts.map((part) => part[0]!.toUpperCase()).join("")
    : "?"
}
```

`components/admin/kit/noise.ts`:

```ts
/** Fine grain over the navy gradients (hero KPI, auth brand panel). */
export const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
```

`components/admin/kit/swirl.tsx`:

```tsx
const RINGS = Array.from({ length: 16 }, (_, index) => index)

/** Contour line-art for the navy brand surfaces. Decorative only. */
export function Swirl({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 800"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <g transform="translate(640 700) rotate(-32)">
        {RINGS.map((index) => {
          const rx = 90 + index * 38
          return (
            <ellipse
              key={index}
              cx={index * 9}
              cy={index * -6}
              rx={rx}
              ry={rx * 0.58}
              stroke="white"
              strokeOpacity={0.22 - index * 0.011}
              strokeWidth={1.25}
            />
          )
        })}
      </g>
    </svg>
  )
}
```

`components/admin/kit/status-pill.tsx`:

```tsx
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-accent text-accent-foreground",
  neutral: "bg-muted text-muted-foreground",
}

const STATUS_TONES: Record<string, StatusTone> = {
  published: "success",
  live: "success",
  active: "success",
  won: "success",
  "signed in": "success",
  draft: "neutral",
  closed: "neutral",
  hidden: "neutral",
  "in review": "info",
  scheduled: "info",
  new: "info",
  invited: "info",
  "unpublished changes": "warning",
  contacted: "warning",
  qualified: "warning",
  failed: "danger",
  banned: "danger",
  spam: "danger",
  lost: "danger",
}

export const toneForStatus = (status: string): StatusTone =>
  STATUS_TONES[status.trim().toLowerCase()] ?? "neutral"

/** Soft fill, strong text: Published / Draft / Unpublished changes / New … */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      data-slot="status-pill"
      data-tone={tone}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold whitespace-nowrap",
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
```

`components/admin/kit/content-status.tsx`:

```tsx
import { StatusPill, type StatusTone } from "./status-pill"

export type ContentState = { published: unknown; dirty: boolean }

/** Draft, Published, or Published + Unpublished changes (JW pages list). */
export function contentStatus(
  record: ContentState
): { label: string; tone: StatusTone }[] {
  if (record.published === null) return [{ label: "Draft", tone: "neutral" }]
  const pills: { label: string; tone: StatusTone }[] = [
    { label: "Published", tone: "success" },
  ]
  if (record.dirty) pills.push({ label: "Unpublished changes", tone: "warning" })
  return pills
}

export function ContentStatusPills({ record }: { record: ContentState }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {contentStatus(record).map((pill) => (
        <StatusPill key={pill.label} tone={pill.tone}>
          {pill.label}
        </StatusPill>
      ))}
    </span>
  )
}
```

`components/admin/kit/empty-state.tsx`:

```tsx
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/** Says what will appear here and, when there is one, offers the next step. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  role,
}: {
  title: string
  description: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  /** "alert" for a failed load, "status" for a quiet result (e.g. no search hits). */
  role?: "alert" | "status"
}) {
  return (
    <Empty role={role} className="rounded-card border border-dashed bg-card/40">
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia variant="icon">
            <Icon aria-hidden />
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="text-base font-semibold">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
```

`components/admin/kit/dashboard-card.tsx`:

```tsx
"use client"

import { type ReactNode, useId } from "react"

import { cn } from "@/lib/utils"

/**
 * A white card on the grey content panel, named by its heading. Client
 * component so useId stays unique across routes kept mounted by Cache
 * Components' <Activity>.
 */
export function DashboardCard({
  title,
  action,
  children,
  className,
  headingLevel = 2,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  headingLevel?: 2 | 3
}) {
  const id = useId()
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-card flex min-w-0 flex-col gap-5 bg-card p-5 text-card-foreground sm:p-6",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Heading id={id} className="text-card-title">
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  )
}
```

`components/admin/kit/skeletons.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// bg-skeleton, not bg-muted: muted is nearly the panel's own grey.
export function KpiRowSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="rounded-card h-[164px] bg-skeleton" />
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      aria-hidden
      className={cn("rounded-card h-72 bg-skeleton", className)}
    />
  )
}
```

`components/admin/kit/kpi-card.tsx`:

```tsx
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

import type { Delta } from "./format"
import { NOISE } from "./noise"

/** Hero KPI (navy gradient, white chip) and default KPI (outlined chip). */
export function KpiCard({
  label,
  value,
  caption,
  delta,
  href,
  variant = "default",
}: {
  label: string
  value: string
  caption: string
  delta?: Delta | null
  href?: string
  variant?: "hero" | "default"
}) {
  const hero = variant === "hero"
  return (
    <article
      data-variant={variant}
      className={cn(
        "rounded-card relative isolate flex min-h-[164px] flex-col justify-between gap-6 overflow-hidden p-5 sm:p-6",
        hero ? "bg-hero" : "bg-card text-card-foreground"
      )}
    >
      {hero ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14] mix-blend-overlay"
          style={{ backgroundImage: NOISE }}
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-snug font-semibold">{label}</h3>
        {href ? (
          <Link
            href={href}
            aria-label={`Open ${label}`}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3",
              hero
                ? "bg-hero-chip text-hero-chip-foreground hover:bg-hero-chip/85 focus-visible:ring-white/60"
                : "ring-1 ring-foreground/70 hover:bg-muted focus-visible:ring-ring/50"
            )}
          >
            <ArrowUpRight aria-hidden className="size-5" />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-kpi tabular-nums">{value}</p>
        <p
          className={cn(
            "text-xs font-medium",
            hero ? "text-white/85" : "text-muted-foreground"
          )}
        >
          {delta ? (
            <span
              className={cn(
                "font-semibold",
                hero && delta.direction === "up" && "text-hero-delta",
                !hero && delta.direction === "up" && "text-success",
                !hero && delta.direction === "down" && "text-danger"
              )}
            >
              {delta.label}
            </span>
          ) : null}
          {delta ? " " : null}
          {caption}
        </p>
      </div>
    </article>
  )
}
```

`components/admin/kit/pill-bar-chart.tsx`:

```tsx
"use client"

import { useId } from "react"
import {
  Bar,
  BarChart,
  type BarShapeProps,
  Rectangle,
  XAxis,
  YAxis,
} from "recharts"

import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { formatNumber, peakIndex } from "./format"

// At least 1, so an all-zero period keeps a real scale instead of [0, 0].
const maxDomain = (dataMax: number) => Math.max(1, dataMax)

export type PillBarDatum = {
  key: string
  label: string
  current: number
  /** Comparison period (hatched); omit for a single series. */
  previous?: number
}

/**
 * Capsule bars (hatched for a comparison period) with a value tag on the
 * busiest bar. The SVG is hidden from assistive tech; the sr-only table
 * carries the numbers.
 */
export function PillBarChart({
  title,
  data,
  currentLabel,
  previousLabel,
  rowHeader = "Day",
}: {
  title: string
  data: readonly PillBarDatum[]
  currentLabel: string
  previousLabel?: string
  rowHeader?: string
}) {
  const hatchId = `hatch-${useId().replace(/:/g, "")}`
  const reduced = useReducedMotion()
  const compare =
    previousLabel !== undefined && data.some((d) => d.previous !== undefined)
  const currents = data.map((datum) => datum.current)
  const busiest = peakIndex(currents)
  const peak = (currents[busiest] ?? 0) > 0 ? busiest : -1
  const config = {
    current: { label: currentLabel, color: "var(--chart-2)" },
    previous: { label: previousLabel ?? "", color: "var(--hatch)" },
  } satisfies ChartConfig

  return (
    <figure className="flex flex-col gap-4">
      <ChartContainer
        config={config}
        className="aspect-auto h-72 w-full"
        aria-hidden
      >
        <BarChart
          data={[...data]}
          barGap={4}
          barCategoryGap="14%"
          margin={{ top: 44, right: 4, bottom: 0, left: 4 }}
          accessibilityLayer={false}
        >
          <defs>
            <pattern
              id={hatchId}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect
                width="8"
                height="8"
                fill="var(--color-previous)"
                fillOpacity={0.25}
              />
              <rect width="3.5" height="8" fill="var(--color-previous)" />
            </pattern>
          </defs>
          <YAxis hide domain={[0, maxDomain]} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          {compare ? (
            <Bar
              dataKey="previous"
              fill={`url(#${hatchId})`}
              radius={999}
              isAnimationActive={!reduced}
            />
          ) : null}
          <Bar
            dataKey="current"
            fill="var(--color-current)"
            radius={999}
            isAnimationActive={!reduced}
            shape={(props: BarShapeProps) => (
              <PillWithTag {...props} showTag={props.index === peak} />
            )}
          />
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            <th scope="col">{currentLabel}</th>
            {compare ? <th scope="col">{previousLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.key}>
              <th scope="row">{datum.label}</th>
              <td>{datum.current}</td>
              {compare ? <td>{datum.previous ?? 0}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-chart-2" />
          {currentLabel}
        </span>
        {compare ? (
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-full bg-hatch" />
            {previousLabel}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

function PillWithTag({
  showTag,
  ...props
}: BarShapeProps & { showTag: boolean }) {
  const { x, y, width, height, fill } = props
  const value = formatNumber((props.payload as PillBarDatum).current)
  const tagWidth = Math.max(36, value.length * 8 + 18)
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        radius={999}
      />
      {showTag ? (
        <g transform={`translate(${x + width / 2}, ${y - 10})`}>
          <rect
            x={-tagWidth / 2}
            y={-26}
            width={tagWidth}
            height={22}
            rx={8}
            fill="var(--accent)"
            stroke="var(--chart-3)"
          />
          <text
            y={-11}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--accent-foreground)"
          >
            {value}
          </text>
          <circle
            r={4}
            fill="var(--card)"
            stroke="var(--color-current)"
            strokeWidth={2}
          />
        </g>
      ) : null}
    </g>
  )
}
```

The figcaption test selects `figcaption span` text "Enquiries": the legend `<span>` holds the dot span and the text node; `getByText(..., { selector: "figcaption span" })` matches the outer span (its own text is "Enquiries").

`components/admin/kit/activity-feed.tsx`:

```tsx
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { EmptyState } from "./empty-state"
import { initials, relativeTime } from "./format"
import { StatusPill, type StatusTone } from "./status-pill"

export type ActivityEntry = {
  id: string
  name: string
  description: string
  at: string
  status?: { label: string; tone: StatusTone }
}

/** Team activity: avatar, who, what · when, and a status pill. */
export function ActivityFeed({
  entries,
  now,
  emptyTitle,
  emptyDescription,
  label = "Recent activity",
}: {
  entries: readonly ActivityEntry[]
  now: number
  emptyTitle: string
  emptyDescription: string
  /** Names the scrollable region (focusable so it scrolls by keyboard). */
  label?: string
}) {
  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="max-h-130 overflow-y-auto rounded-xl pr-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-h-90"
    >
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 py-2">
            <Avatar aria-hidden className="size-10">
              <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
                {initials(entry.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">
                {entry.name}
              </span>
              <span className="text-sm text-muted-foreground">
                {entry.description} ·{" "}
                <time dateTime={entry.at}>{relativeTime(entry.at, now)}</time>
              </span>
            </div>
            {entry.status ? (
              <StatusPill tone={entry.status.tone}>
                {entry.status.label}
              </StatusPill>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

`components/admin/page-header.tsx` (full file):

```tsx
import type { ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** The admin's button pair: filled primary, outlined primary; 48 px, rounded-xl. */
export const PRIMARY_ACTION =
  "h-12 gap-2 rounded-xl px-5 text-[15px] font-semibold"
export const SECONDARY_ACTION =
  "h-12 gap-2 rounded-xl border-primary bg-card px-5 text-[15px] font-semibold text-primary hover:bg-accent hover:text-accent-foreground"
/** A form's own submit button, and anything beside one. */
export const FORM_ACTION = "h-11 rounded-xl px-5 font-semibold"

// Navigation styled as a button stays a real link (role "link").
export const LINK_PRIMARY = cn(buttonVariants(), PRIMARY_ACTION)
export const LINK_SECONDARY = cn(
  buttonVariants({ variant: "outline" }),
  SECONDARY_ACTION
)
export const LINK_FORM = cn(buttonVariants(), FORM_ACTION)

/** Title row of an admin screen: optional breadcrumbs, h1, description, actions. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  titleTestId,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: ReactNode
  titleTestId?: string
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {breadcrumbs}
        <h1 className="text-title text-balance" data-testid={titleTestId}>
          {title}
        </h1>
        {description ? (
          <div className="max-w-2xl text-[15px] text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  )
}
```

(`PageHeader` keeps its own bottom margin (`mb-6`) so the existing callers need no wrapper; the `<header>` element inside `<main>` is not a banner landmark. The description is a `<div>` so callers may pass pills/`<code>` inside it.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/admin/kit-format.test.ts && pnpm exec vitest run --project dom tests/dom/admin-kit.test.tsx`
Expected: PASS (7 + 8 tests).

Run: `pnpm lint && pnpm typecheck && pnpm exec vitest run --project dom`
Expected: clean; whole dom project green (existing screens still render with the new PageHeader).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/kit components/admin/page-header.tsx hooks/use-reduced-motion.ts tests/unit/admin/kit-format.test.ts tests/dom/admin-kit.test.tsx
git add components/admin/kit components/admin/page-header.tsx hooks/use-reduced-motion.ts tests/unit/admin/kit-format.test.ts tests/dom/admin-kit.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): design kit with the JW signature components

PageHeader with the button pair, status pills, empty state, dashboard
card, skeletons, hero and default KPI cards, pill bar chart (single or
compared series, sr-only table), activity feed, swirl and noise, format
helpers and a reduced-motion hook.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Navigation registry in JW structure — sections only, sub-pages as tabs, dock items (master Task 4.1, nav)

**Files:**
- Modify: `components/admin/shell/nav.ts` (full rewrite below), `components/admin/shell/nav-main.tsx` (menu sections only), `components/admin/shell/command-palette.tsx` ("Go to" uses `navDestinations`)
- Move (git mv, URLs unchanged): `app/(admin)/admin/(panel)/{team,clients,group-companies,categories}` → `app/(admin)/admin/(panel)/(collections)/{team,clients,group-companies,categories}`
- Create: `app/(admin)/admin/(panel)/(collections)/layout.tsx`, `components/admin/collections/collection-tabs.tsx`
- Test: `tests/unit/admin/nav.test.ts` (rewrite), `tests/dom/collection-tabs.test.tsx`, `tests/dom/admin-shell.test.tsx` (two expectations, Step 4)

**Interfaces:**
- Consumes: `hasPermission`, `PermissionRequest` (`lib/auth/permissions.ts`); Task 14 `SectionTabs` (route mode: every item has `href`); `useAdminSession`.
- Produces:

```ts
// components/admin/shell/nav.ts
export type NavBadgeKey = "new-leads"
export type NavBadges = Partial<Record<NavBadgeKey, number>>
export type NavChild = { label: string; href: string; permission: PermissionRequest | null }
export type NavItem = {
  label: string; href: string; icon: LucideIcon
  permission: PermissionRequest | null
  match: "exact" | "prefix"
  badge?: NavBadgeKey
  /** Sub-pages shown as SectionTabs inside the content panel (JW). */
  children?: NavChild[]
  /** Drawn as an icon button in the sidebar's footer dock, not in the menu. */
  dock?: true
}
export type NavSection = { label: string; items: NavItem[] }
export type NavDestination = { label: string; href: string; icon: LucideIcon; parent: string | null }
export const NAV_SECTIONS: NavSection[]
export function navItems(roles: readonly string[]): NavSection[]          // permission-filtered (children too); empty dropped
export function menuSections(roles: readonly string[]): NavSection[]      // navItems without dock items
export function dockItems(roles: readonly string[]): NavItem[]            // dock items in registry order
export function navDestinations(roles: readonly string[]): NavDestination[] // children flattened (⌘K)
export function isActiveItem(item: NavItem, pathname: string): boolean    // own href or any child's
// components/admin/collections/collection-tabs.tsx
export function CollectionTabs(props: { children: ReactNode }): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/nav.test.ts` (full file):

```ts
import { describe, expect, it } from "vitest"

import {
  dockItems,
  isActiveItem,
  menuSections,
  NAV_SECTIONS,
  navDestinations,
  navItems,
} from "@/components/admin/shell/nav"
import type { Role } from "@/lib/auth/roles"

const menu = (roles: Role[]) =>
  menuSections(roles).flatMap((section) => section.items.map((i) => i.label))
const dock = (roles: Role[]) => dockItems(roles).map((i) => i.label)
const destinations = (roles: Role[]) =>
  navDestinations(roles).map((d) => d.label)

const MENU_ALL = ["Dashboard", "Pages", "Services", "Collections", "Settings"]
const DEST_ALL = [
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

describe("navigation registry (JW structure)", () => {
  it.each<[Role, string[]]>([
    ["owner", MENU_ALL],
    ["admin", MENU_ALL],
    ["editor", MENU_ALL],
    ["viewer", MENU_ALL],
    ["marketer", ["Dashboard", "Pages", "Services"]],
    ["author", ["Dashboard"]],
    ["intake", ["Dashboard"]],
  ])("%s sees menu %j", (role, expected) => {
    expect(menu([role])).toEqual(expected)
  })

  it("lists sections only; sub-pages are children", () => {
    const collections = menuSections(["editor"])
      .flatMap((s) => s.items)
      .find((i) => i.label === "Collections")!
    expect(collections.children!.map((c) => c.label)).toEqual([
      "Team",
      "Clients",
      "Group companies",
      "Categories",
    ])
    expect(collections.href).toBe("/admin/team")
  })

  it("keeps Account out of the menu and in the dock", () => {
    expect(menu(["intake"])).not.toContain("Account")
    expect(dock(["intake"])).toEqual(["Account"])
    expect(menuSections(["intake"]).map((s) => s.label)).toEqual(["Overview"])
  })

  it("flattens children for ⌘K, permission-filtered", () => {
    expect(destinations(["editor"])).toEqual(DEST_ALL)
    expect(destinations(["marketer"])).toEqual([
      "Dashboard",
      "Pages",
      "Services",
      "Account",
    ])
    const team = navDestinations(["editor"]).find((d) => d.label === "Team")!
    expect(team).toMatchObject({ href: "/admin/team", parent: "Collections" })
  })

  it("drops a parent whose children are all hidden", () => {
    expect(
      navItems(["author"])
        .flatMap((s) => s.items)
        .map((i) => i.label)
    ).not.toContain("Collections")
  })

  it("marks a parent active on any child's page", () => {
    const collections = NAV_SECTIONS.flatMap((s) => s.items).find(
      (i) => i.label === "Collections"
    )!
    expect(isActiveItem(collections, "/admin/clients")).toBe(true)
    expect(isActiveItem(collections, "/admin/group-companies/x")).toBe(true)
    expect(isActiveItem(collections, "/admin/services")).toBe(false)
    const dashboard = NAV_SECTIONS[0]!.items[0]!
    expect(isActiveItem(dashboard, "/admin")).toBe(true)
    expect(isActiveItem(dashboard, "/admin/pages")).toBe(false)
  })

  it("every link stays inside /admin", () => {
    for (const section of NAV_SECTIONS)
      for (const item of section.items) {
        expect(item.href.startsWith("/admin")).toBe(true)
        for (const child of item.children ?? [])
          expect(child.href.startsWith("/admin/")).toBe(true)
      }
  })
})
```

`tests/dom/collection-tabs.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/admin/team" } }))
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }))
vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { CollectionTabs } from "@/components/admin/collections/collection-tabs"
import { AdminSessionProvider } from "@/components/admin/session-provider"

const session = {
  user: {
    id: "u1",
    name: "Edith Editor",
    email: "edith@example.test",
    title: null,
    twoFactorEnabled: false,
  },
  roles: ["editor" as const],
  impersonatedBy: null,
}

describe("Collections section tabs", () => {
  it("lists the collections as route tabs and marks the current one", () => {
    pathname.current = "/admin/clients"
    render(
      <AdminSessionProvider value={session}>
        <CollectionTabs>
          <p>Clients screen</p>
        </CollectionTabs>
      </AdminSessionProvider>
    )
    const nav = screen.getByRole("navigation", { name: "Collections" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["Team", "Clients", "Group companies", "Categories"])
    expect(within(nav).getByRole("link", { name: "Clients" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByText("Clients screen")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/admin/nav.test.ts`
Expected: FAIL — `menuSections is not a function` (no export).

Run: `pnpm exec vitest run --project dom tests/dom/collection-tabs.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/collections/collection-tabs"`.

- [ ] **Step 3: Implement**

`components/admin/shell/nav.ts` (full file):

```ts
import {
  FileText,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  Settings,
  UserRound,
  Wrench,
} from "lucide-react"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

/** Live counts shown beside nav items (Leads arrives in Phase 7). */
export type NavBadgeKey = "new-leads"
export type NavBadges = Partial<Record<NavBadgeKey, number>>

export type NavChild = {
  label: string
  href: string
  /** null = every signed-in user. */
  permission: PermissionRequest | null
}

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** null = every signed-in user. Items are hidden without read permission (spec §8.1). */
  permission: PermissionRequest | null
  /** "exact" for /admin (otherwise every admin URL would match). */
  match: "exact" | "prefix"
  /** Which count from NavBadges (if any) to show beside the label. */
  badge?: NavBadgeKey
  /** Sub-pages, shown as SectionTabs inside the content panel (JW). */
  children?: NavChild[]
  /** Drawn as an icon button in the sidebar's footer dock, not in the menu. */
  dock?: true
}

export type NavSection = { label: string; items: NavItem[] }

export type NavDestination = {
  label: string
  href: string
  icon: LucideIcon
  /** The section item a sub-page belongs to (⌘K shows it as context). */
  parent: string | null
}

const COLLECTION = { collection: ["read"] } satisfies PermissionRequest

/**
 * Admin IA (spec §8.1) in the James Whitfield structure: the sidebar lists
 * sections; a section's sub-pages are tabs in the content panel; account
 * and administration links sit in the footer dock. Later phases add their
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
        label: "Collections",
        href: "/admin/team",
        icon: Layers,
        permission: COLLECTION,
        match: "prefix",
        children: [
          { label: "Team", href: "/admin/team", permission: COLLECTION },
          { label: "Clients", href: "/admin/clients", permission: COLLECTION },
          {
            label: "Group companies",
            href: "/admin/group-companies",
            permission: COLLECTION,
          },
          {
            label: "Categories",
            href: "/admin/categories",
            permission: COLLECTION,
          },
        ],
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
        dock: true,
      },
    ],
  },
]

const allowed = (
  roles: readonly string[],
  permission: PermissionRequest | null
) => permission === null || hasPermission(roles, permission)

/** The sections and items `roles` may see (children filtered); empty ones dropped. */
export function navItems(roles: readonly string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.flatMap((item): NavItem[] => {
      if (!allowed(roles, item.permission)) return []
      if (!item.children) return [item]
      const children = item.children.filter((child) =>
        allowed(roles, child.permission)
      )
      if (children.length === 0) return []
      // The parent opens its first visible sub-page.
      return [{ ...item, href: children[0]!.href, children }]
    }),
  })).filter((section) => section.items.length > 0)
}

/** The sidebar menu: navItems without the dock's items. */
export function menuSections(roles: readonly string[]): NavSection[] {
  return navItems(roles)
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) => !item.dock),
    }))
    .filter((section) => section.items.length > 0)
}

/** Footer-dock links (Account; Users and Audit log from Phase 4 Task 12). */
export function dockItems(roles: readonly string[]): NavItem[] {
  return navItems(roles).flatMap((section) =>
    section.items.filter((item) => item.dock)
  )
}

/** Every page a role can open from the navigation, sub-pages flattened (⌘K). */
export function navDestinations(roles: readonly string[]): NavDestination[] {
  return navItems(roles).flatMap((section) =>
    section.items.flatMap((item): NavDestination[] =>
      item.children
        ? item.children.map((child) => ({
            label: child.label,
            href: child.href,
            icon: item.icon,
            parent: item.label,
          }))
        : [{ label: item.label, href: item.href, icon: item.icon, parent: null }]
    )
  )
}

const covers = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/** True when `pathname` is this item's page, below it, or one of its sub-pages. */
export function isActiveItem(item: NavItem, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.href
  if (covers(item.href, pathname)) return true
  return (item.children ?? []).some((child) => covers(child.href, pathname))
}
```

`components/admin/shell/nav-main.tsx`: replace `import { isActiveItem, type NavBadges, navItems } from "./nav"` with `import { isActiveItem, menuSections, type NavBadges } from "./nav"` and `navItems(roles).map(` with `menuSections(roles).map(`. Also use the section index (not the label) in the label id (ledger minor P04-1: spaces in labels): `const labelId = \`${idPrefix}-section-${index}\`` with `.map((section, index) => {`.

`components/admin/shell/command-palette.tsx`: replace `import { navItems } from "./nav"` with `import { navDestinations } from "./nav"` and

```ts
  const sections = navItems(roles)
    .flatMap((section) => section.items)
    .filter((item) => !needle || item.label.toLowerCase().includes(needle))
```

with

```ts
  const sections = navDestinations(roles).filter(
    (item) =>
      !needle ||
      item.label.toLowerCase().includes(needle) ||
      item.parent?.toLowerCase().includes(needle)
  )
```

and in the "Go to" `CommandItem`, after `{item.label}` add
`{item.parent ? <span className="ml-auto text-xs text-muted-foreground">{item.parent}</span> : null}`.

Move the four collection routes into a route group (URLs stay `/admin/team` …):

```bash
mkdir -p "app/(admin)/admin/(panel)/(collections)"
git mv "app/(admin)/admin/(panel)/team" "app/(admin)/admin/(panel)/(collections)/team"
git mv "app/(admin)/admin/(panel)/clients" "app/(admin)/admin/(panel)/(collections)/clients"
git mv "app/(admin)/admin/(panel)/group-companies" "app/(admin)/admin/(panel)/(collections)/group-companies"
git mv "app/(admin)/admin/(panel)/categories" "app/(admin)/admin/(panel)/(collections)/categories"
```

`components/admin/collections/collection-tabs.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"

import { SectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import { navItems } from "@/components/admin/shell/nav"

/**
 * The Collections section's sub-pages as left route tabs (JW: the sidebar
 * lists sections; a section's pages are tabs in the content panel).
 */
export function CollectionTabs({ children }: { children: ReactNode }) {
  const { roles } = useAdminSession()
  const collections = navItems(roles)
    .flatMap((section) => section.items)
    .find((item) => item.label === "Collections")
  const items = (collections?.children ?? []).map((child) => ({
    id: child.href,
    label: child.label,
    href: child.href,
  }))
  if (items.length === 0) return <>{children}</>
  return (
    <SectionTabs ariaLabel="Collections" items={items}>
      {children}
    </SectionTabs>
  )
}
```

`app/(admin)/admin/(panel)/(collections)/layout.tsx`:

```tsx
import { CollectionTabs } from "@/components/admin/collections/collection-tabs"

/** Team, Clients, Group companies and Categories share one tab column. */
export default function CollectionsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <CollectionTabs>{children}</CollectionTabs>
}
```

- [ ] **Step 4: Adjust the two shell expectations that the registry changes**

In `tests/dom/admin-shell.test.tsx`:
- "shows only the sections the roles may read": `.toEqual(["Dashboard", "Account"])` → `.toEqual(["Dashboard"])`.
- "names each navigation group by its section label": `.toEqual(["Overview", "Content", "Configuration", "You"])` → `.toEqual(["Overview", "Content", "Configuration"])`.

(Task 4 replaces this file; these keep it green in between.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/admin/nav.test.ts && pnpm exec vitest run --project dom tests/dom/collection-tabs.test.tsx tests/dom/admin-shell.test.tsx tests/dom/command-palette.test.tsx tests/dom/collections.test.tsx`
Expected: PASS (nav 13 tests; collection tabs 1; shell, palette and collections suites unchanged otherwise).

Run: `pnpm lint && pnpm typecheck`
Expected: clean (`.next/types` regenerate the moved routes on the next build; `PageProps<"/admin/team">` keys are URL-based, so nothing changes).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write components/admin/shell/nav.ts components/admin/shell/nav-main.tsx components/admin/shell/command-palette.tsx components/admin/collections/collection-tabs.tsx "app/(admin)/admin/(panel)/(collections)/layout.tsx" tests/unit/admin/nav.test.ts tests/dom/collection-tabs.test.tsx tests/dom/admin-shell.test.tsx
git add components/admin/shell/nav.ts components/admin/shell/nav-main.tsx components/admin/shell/command-palette.tsx components/admin/collections/collection-tabs.tsx "app/(admin)/admin/(panel)/(collections)" "app/(admin)/admin/(panel)/team" "app/(admin)/admin/(panel)/clients" "app/(admin)/admin/(panel)/group-companies" "app/(admin)/admin/(panel)/categories" tests/unit/admin/nav.test.ts tests/dom/collection-tabs.test.tsx tests/dom/admin-shell.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): JW navigation structure with section tabs and dock items

The sidebar lists sections; Team, Clients, Group companies and
Categories become Collections tabs (same URLs, route group layout);
Account moves to the footer dock; ⌘K flattens sub-pages.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Floating-panel shell — sidebar panel, topbar, user menu, notifications, footer dock (master Task 4.1 restyle, part 3)

**Files:**
- Modify: `components/admin/shell/admin-shell.tsx`, `components/admin/shell/app-sidebar.tsx`, `components/admin/shell/nav-entry.tsx`, `components/admin/shell/nav-main.tsx`, `components/admin/shell/website-card.tsx`, `components/admin/shell/constants.ts`, `components/admin/shell/command-palette.tsx`, `components/admin/shell/impersonation-banner.tsx`, `components/ui/sidebar.tsx` (2 class edits)
- Create: `components/admin/shell/{brand-mark.tsx,topbar.tsx,search-pill.tsx,palette-context.tsx,notifications-button.tsx,user-menu.tsx,footer-dock.tsx}`
- Delete: `components/admin/shell/site-header.tsx`, `components/admin/shell/nav-user.tsx`
- Test: `tests/dom/admin-shell.test.tsx` (tests replaced/added as listed in Step 1), `tests/e2e/admin-auth.spec.ts`, `tests/e2e/account.spec.ts` (user-menu selectors)
- Re-baseline: `tests/visual/__screenshots__/admin-shell-{desktop,mobile,nav-mobile,collapsed-desktop}.png`

**Interfaces:**
- Consumes: Task 1 tokens/utilities; Task 2 `Swirl`, `initials`; Task 3 `menuSections`, `dockItems`, `isActiveItem`, `NavItem`, `NavBadges`; `useSignOut(onSignedOut)` (`components/admin/auth/sign-out-button.tsx`); `useAdminSession`; shadcn `Sidebar*`, `DropdownMenu*`, `Popover*`, `Tooltip*`, `Avatar*`, `Badge`, `Kbd`, `KbdGroup`; `next-themes` `useTheme`.
- Produces:

```ts
// components/admin/shell/admin-shell.tsx (props unchanged)
export function AdminShell(props: { session: AdminSession; children: ReactNode; queryClient?: QueryClient; defaultSidebarOpen?: boolean; site?: SiteInfo; badges?: NavBadges }): JSX.Element
// components/admin/shell/constants.ts
export const SIDEBAR_COOKIE = "sidebar_state"; export type SiteInfo; export const DEFAULT_SITE: SiteInfo
export const ICON_BUTTON = "size-11 rounded-full border-border bg-card"
// components/admin/shell/palette-context.tsx
export function CommandPaletteProvider(props: { children: ReactNode }): JSX.Element
export function useCommandPalette(): { open: boolean; setOpen(open: boolean): void }
// components/admin/shell/command-palette.tsx — no longer renders a trigger; open state from useCommandPalette()
export function CommandPalette(): JSX.Element
export function isPaletteShortcut(event: KeyboardEvent): boolean
// components/admin/shell/footer-dock.tsx
export type DockProps = { links: readonly NavItem[]; pathname: string; onNavigate(): void; onSignOut(): void; signingOut: boolean }
export function FooterDock(props: DockProps & { tone: "card" | "rail" }): JSX.Element
// components/admin/shell/brand-mark.tsx
export function BrandMark(props: { tone?: "default" | "inverse"; className?: string }): JSX.Element
// components/admin/shell/nav-entry.tsx
export function formatBadge(count: number): string
export const NAV_BUTTON: string
export function NavEntry(props: { item: NavItem; active: boolean; badge?: number; onNavigate?: () => void }): JSX.Element
// components/admin/shell/{topbar,search-pill,notifications-button,user-menu}.tsx
export function Topbar(): JSX.Element; export function SearchPill(): JSX.Element
export function NotificationsButton(): JSX.Element; export function UserMenu(): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

In `tests/dom/admin-shell.test.tsx`:

1. Add these imports below the existing ones: `import { AdminThemeProvider } from "@/components/admin/theme-provider"`. Change `import { formatBadge, NavEntry } from "@/components/admin/shell/nav-entry"` to stay as is (same exports).
2. **Keep verbatim:** "marks the current section with aria-current", "opens the navigation in a sheet on small screens and closes it on navigation", "collapses the desktop sidebar from the header trigger and Ctrl/⌘+B", "leaves Ctrl/⌘+B to text fields, rich text and handlers that claim it", "shows the impersonation banner only while impersonating", "stop impersonating: calls the API, drops the cache and goes to /admin", "stop impersonating: shows the API error and re-enables the button", "closes the navigation sheet from its close button", "closes the navigation sheet from the brand link too", "labels production as Live", "starts collapsed when the saved sidebar state says so", and the whole `describe("NavEntry")`.
3. **Delete:** "shows where the page sits in the header breadcrumb".
4. **Replace** the remaining `it` blocks of `describe("AdminShell (master 4.1)")` with:

```tsx
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
    ).toEqual(["Dashboard"])
    expect(screen.getByRole("main")).toHaveTextContent("Body")
  })

  it("lists sections only and marks Collections on a collection page", () => {
    pathname.current = "/admin/clients"
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["Dashboard", "Pages", "Services", "Collections", "Settings"])
    const collections = within(nav).getByRole("link", { name: "Collections" })
    expect(collections).toHaveAttribute("aria-current", "page")
    expect(collections).toHaveAttribute("href", "/admin/team")
  })

  it("puts the floating panels on the canvas: sidebar, topbar, content", () => {
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const sidebar = document.querySelector('[data-slot="sidebar"]')!
    expect(sidebar).toHaveAttribute("data-variant", "floating")
    const topbar = screen.getByRole("banner")
    expect(topbar).toHaveAttribute("data-slot", "topbar")
    expect(topbar).toHaveClass("rounded-card", "bg-sidebar", "h-[72px]")
    const main = screen.getByRole("main")
    expect(main).toHaveClass("rounded-card", "bg-sidebar", "overflow-y-auto")
    expect(main).toHaveAttribute("id", "main")
    expect(
      screen.getByRole("link", { name: "Skip to content" })
    ).toHaveAttribute("href", "#main")
  })

  it("opens ⌘K from the search pill", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const pill = within(screen.getByRole("banner")).getByRole("button", {
      name: "Search",
    })
    expect(pill).toHaveAttribute("aria-keyshortcuts", "Meta+K Control+K")
    await user.click(pill)
    expect(
      await screen.findByRole("dialog", { name: "Search the admin" })
    ).toBeInTheDocument()
  })

  it("shows an honest empty notifications popover", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Notifications",
      })
    )
    expect(
      await screen.findByText(/You're all caught up/)
    ).toBeInTheDocument()
  })

  it("user menu in the topbar: identity, roles, Account, Security, theme, sign out", async () => {
    const user = userEvent.setup()
    render(
      <AdminThemeProvider defaultTheme="light">
        <AdminShell session={session(["editor", "author"])}>
          <p>Body</p>
        </AdminShell>
      </AdminThemeProvider>
    )
    const trigger = within(screen.getByRole("banner")).getByRole("button", {
      name: "Account menu for Edith Editor",
    })
    expect(trigger).toHaveTextContent("EE")
    await user.click(trigger)
    const menu = await screen.findByRole("menu")
    expect(menu).toHaveTextContent("Edith Editor")
    expect(menu).toHaveTextContent("edith@example.test")
    expect(menu).toHaveTextContent("editor, author")
    expect(
      within(menu).getByRole("menuitem", { name: "Account" })
    ).toHaveAttribute("href", "/admin/account")
    expect(
      within(menu).getByRole("menuitem", { name: "Security" })
    ).toHaveAttribute("href", "/admin/account?tab=security")
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent)
    ).toEqual(["Light", "Dark", "System"])
    await user.click(within(menu).getByRole("menuitemradio", { name: "Dark" }))
    await waitFor(() =>
      expect(localStorage.getItem("sp-admin-theme")).toBe("dark")
    )
  })

  it("stacks the impersonation banner above the topbar in one header wrapper", () => {
    render(
      <AdminShell session={session(["editor"], "owner-1")}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("region", { name: "Impersonation" })
    const topbar = screen.getByRole("banner")
    const header = topbar.parentElement!
    expect(header).toHaveAttribute("data-slot", "admin-header")
    expect(header.firstElementChild).toBe(banner)
    // The sidebar sits beside the content column, never under the header.
    const sidebar = document.querySelector('[data-slot="sidebar"]')!
    expect(sidebar.contains(header)).toBe(false)
    expect(header.contains(sidebar)).toBe(false)
    expect(header.nextElementSibling).toBe(screen.getByRole("main"))
  })

  it("clears the query cache on sign out", async () => {
    signOut.mockResolvedValue({ error: null })
    const client = makeQueryClient()
    const clear = vi.spyOn(client, "clear")
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])} queryClient={client}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(
      screen.getByRole("button", { name: "Account menu for Edith Editor" })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }))
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/admin/sign-in?notice=signed-out"
      )
    )
    expect(clear).toHaveBeenCalled()
  })

  it("shows a sign-out failure in the topbar, clears it on reopen and keeps the session", async () => {
    signOut.mockResolvedValue({ error: { message: "nope" } })
    const client = makeQueryClient()
    const clear = vi.spyOn(client, "clear")
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])} queryClient={client}>
        <p>Body</p>
      </AdminShell>
    )
    const account = screen.getByRole("button", {
      name: "Account menu for Edith Editor",
    })
    await user.click(account)
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not sign out.")
    expect(screen.queryByRole("menu")).toBeNull()
    expect(alert.closest('[data-slot="topbar"]')).not.toBeNull()
    expect(clear).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
    await user.click(account)
    expect(
      await screen.findByRole("menuitem", { name: "Sign out" })
    ).not.toHaveAttribute("aria-disabled", "true")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("footer dock: Account link and Log out (which clears the cache)", async () => {
    signOut.mockResolvedValue({ error: null })
    const client = makeQueryClient()
    const clear = vi.spyOn(client, "clear")
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["intake"])} queryClient={client}>
        <p>Body</p>
      </AdminShell>
    )
    const footer = document.querySelector(
      '[data-slot="sidebar-footer"]'
    ) as HTMLElement
    // The card's dock row and the icon rail's column (CSS shows one).
    const docks = within(footer).getAllByRole("navigation", { name: "Account" })
    expect(docks).toHaveLength(2)
    expect(
      within(docks[0]).getByRole("link", { name: "Account" })
    ).toHaveAttribute("href", "/admin/account")
    await user.click(within(docks[0]).getByRole("button", { name: "Log out" }))
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/admin/sign-in?notice=signed-out"
      )
    )
    expect(clear).toHaveBeenCalled()
  })

  it("names each navigation group by its section label", () => {
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(
      within(nav)
        .getAllByRole("list")
        .map((list) => list.getAttribute("aria-labelledby"))
        .map((id) => document.getElementById(id!)?.textContent)
    ).toEqual(["Overview", "Content", "Configuration"])
  })

  it("website card: environment, host and Open site", () => {
    render(
      <AdminShell
        session={session(["editor"])}
        site={{ url: "https://example.test", env: "staging" }}
      >
        <p>Body</p>
      </AdminShell>
    )
    const footer = document.querySelector(
      '[data-slot="sidebar-footer"]'
    ) as HTMLElement
    expect(footer).toHaveTextContent("Your website")
    expect(footer).toHaveTextContent("example.test")
    expect(footer).toHaveTextContent("Staging")
    expect(footer).not.toHaveTextContent("Live")
    const link = within(footer).getByRole("link", {
      name: "Open site (opens in a new tab)",
    })
    expect(link).toHaveAttribute("href", "https://example.test")
    expect(link).toHaveAttribute("target", "_blank")
    // JW topbar: no View site and no breadcrumb.
    expect(
      within(screen.getByRole("banner")).queryByRole("link", {
        name: /View site/,
      })
    ).toBeNull()
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" })
    ).toBeNull()
  })
```

5. Add to `describe("NavEntry")`:

```tsx
  it("marks the active entry with a bar, bold label and filled icon", () => {
    render(
      <SidebarProvider>
        <ul>
          <NavEntry item={item} active />
        </ul>
      </SidebarProvider>
    )
    const link = screen.getByRole("link", { name: "Leads" })
    expect(link).toHaveAttribute("aria-current", "page")
    expect(link).toHaveAttribute("data-active")
    expect(link.closest("li")!.querySelector('[data-slot="nav-active-bar"]')).not.toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/admin-shell.test.tsx`
Expected: FAIL — e.g. "puts the floating panels on the canvas" (`data-variant` is `inset`), "opens ⌘K from the search pill" (no button named "Search" in the banner), "user menu in the topbar" (no "Account menu for Edith Editor"), "footer dock" (no `navigation` "Account"), NavEntry "marks the active entry" (no `nav-active-bar`).

- [ ] **Step 3: Implement**

`components/ui/sidebar.tsx` — two class edits (JW floating panel):
- In the inner `data-slot="sidebar-inner"` div, replace `group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border` with `group-data-[variant=floating]:rounded-card`.
- In both `variant === "floating" || variant === "inset"` branches (the gap div and the fixed container), replace `(--spacing(4))` with `(--spacing(8))` (the container's `p-4` is 2 × 16 px around the icon rail).

`components/admin/shell/constants.ts` — append:

```ts
/** Circular icon buttons in the topbar (JW signature component 7). */
export const ICON_BUTTON = "size-11 rounded-full border-border bg-card"
```

`components/admin/shell/brand-mark.tsx`:

```tsx
import Image from "next/image"

import { cn } from "@/lib/utils"

/** The Security Partners logo on a white tile, the name and an "Admin" pill. */
export function BrandMark({
  tone = "default",
  className,
}: {
  tone?: "default" | "inverse"
  className?: string
}) {
  const inverse = tone === "inverse"
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        className={cn(
          "flex h-10 w-14 shrink-0 items-center justify-center rounded-xl bg-white px-1.5",
          !inverse && "ring-1 ring-border"
        )}
      >
        <Image
          src="/images/logo.png"
          alt=""
          width={44}
          height={27}
          className="h-auto w-full"
        />
      </span>
      <span data-slot="brand-name" className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[15px] font-bold tracking-tight">
          Security Partners
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
            inverse
              ? "bg-white/15 text-white"
              : "bg-accent text-accent-foreground"
          )}
        >
          Admin
        </span>
      </span>
    </span>
  )
}
```

`components/admin/shell/nav-entry.tsx` (full file):

```tsx
"use client"

import Link from "next/link"

import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import type { NavItem } from "./nav"

/** "120" → "99+": the pill stays one width. */
export function formatBadge(count: number): string {
  return count > 99 ? "99+" : String(count)
}

/**
 * Muted label and icon; the active item gets a bold label and a filled
 * primary icon. In the icon rail the label turns sr-only (still the name).
 */
export const NAV_BUTTON =
  "h-10 gap-3 rounded-xl px-3 text-[15px] text-muted-foreground hover:bg-sidebar-accent/60 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span]:sr-only data-active:bg-transparent data-active:font-semibold data-active:text-foreground [&_svg]:size-5 data-active:[&_svg]:fill-primary/15 data-active:[&_svg]:text-primary"

/** One sidebar link: icon, label (a tooltip in the icon rail), optional count. */
export function NavEntry({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  badge?: number
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      {/* The 4 px active bar on the panel's edge (the group's p-2 away). */}
      {active ? (
        <span
          aria-hidden
          data-slot="nav-active-bar"
          className="absolute top-1/2 -left-2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary"
        />
      ) : null}
      <SidebarMenuButton
        size="lg"
        isActive={active}
        tooltip={item.label}
        className={NAV_BUTTON}
        render={
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          />
        }
      >
        <Icon aria-hidden />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {badge ? (
        <SidebarMenuBadge
          role="img"
          aria-label={`${badge} new ${item.label.toLowerCase()}`}
          className="top-3! right-2 h-6 rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
        >
          {formatBadge(badge)}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}
```

`components/admin/shell/nav-main.tsx` (full file, keeps Task 3's `menuSections` and index ids):

```tsx
"use client"

import { usePathname } from "next/navigation"
import { useId } from "react"

import { useAdminSession } from "@/components/admin/session-provider"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar"

import { isActiveItem, menuSections, type NavBadges } from "./nav"
import { NavEntry } from "./nav-entry"

/** The permission-filtered sections, one labelled group each (JW sidebar). */
export function NavMain({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname()
  const { roles } = useAdminSession()
  const { isMobile, setOpenMobile } = useSidebar()
  const idPrefix = useId()
  // The mobile sheet stays open on navigation otherwise.
  const onNavigate = isMobile ? () => setOpenMobile(false) : undefined
  return (
    <nav aria-label="Admin">
      {menuSections(roles).map((section, index) => {
        const labelId = `${idPrefix}-section-${index}`
        return (
          <SidebarGroup key={section.label} className="py-1">
            <SidebarGroupLabel
              id={labelId}
              className="h-7 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-labelledby={labelId} className="gap-0.5">
                {section.items.map((item) => (
                  <NavEntry
                    key={item.href}
                    item={item}
                    active={isActiveItem(item, pathname)}
                    badge={item.badge ? badges[item.badge] : undefined}
                    onNavigate={onNavigate}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </nav>
  )
}
```

`components/admin/shell/footer-dock.tsx`:

```tsx
"use client"

import { LogOut } from "lucide-react"
import Link from "next/link"
import type { ReactElement } from "react"

import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { isActiveItem, type NavItem } from "./nav"

// "card" sits on the website card's navy gradient, "rail" on the sidebar.
const DOCK_BUTTON = {
  card: "text-current opacity-80 hover:bg-white/10 hover:text-current hover:opacity-100 aria-[current=page]:bg-white/15 aria-[current=page]:opacity-100 focus-visible:ring-white/60",
  rail: "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-primary",
}

export type DockProps = {
  links: readonly NavItem[]
  pathname: string
  onNavigate: () => void
  onSignOut: () => void
  signingOut: boolean
}

/**
 * Account (and, from Phase 4 Task 12, Users and Audit log) plus Log out as
 * icon buttons: a row in the website card, a column in the icon rail.
 */
export function FooterDock({
  tone,
  links,
  pathname,
  onNavigate,
  onSignOut,
  signingOut,
}: DockProps & { tone: "card" | "rail" }) {
  const button = cn(
    buttonVariants({ variant: "ghost", size: "icon-lg" }),
    "size-10 rounded-lg [&_svg]:size-5",
    DOCK_BUTTON[tone]
  )
  return (
    <nav aria-label="Account">
      <ul
        className={cn(
          "flex items-center gap-1",
          tone === "card" ? "justify-between" : "flex-col"
        )}
      >
        {links.map((link) => {
          const Icon = link.icon
          const active = isActiveItem(link, pathname)
          return (
            <li key={link.href}>
              <DockTip label={link.label}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  aria-label={link.label}
                  aria-current={active ? "page" : undefined}
                  className={button}
                >
                  <Icon aria-hidden />
                </Link>
              </DockTip>
            </li>
          )
        })}
        <li>
          <DockTip label="Log out">
            <button
              type="button"
              aria-label="Log out"
              disabled={signingOut}
              onClick={onSignOut}
              className={button}
            >
              <LogOut aria-hidden />
            </button>
          </DockTip>
        </li>
      </ul>
    </nav>
  )
}

function DockTip({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
```

`components/admin/shell/website-card.tsx` (full file):

```tsx
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"

import { Swirl } from "@/components/admin/kit/swirl"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { SiteInfo } from "./constants"

const STATUS: Record<SiteInfo["env"], { label: string; dot: string }> = {
  production: { label: "Live", dot: "bg-chart-3" },
  staging: { label: "Staging", dot: "bg-amber-400" },
  development: { label: "Development", dot: "bg-white/60" },
}

/** "https://example.ie/x" → "example.ie"; "" for a relative or bad URL. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ""
  }
}

/**
 * "Your website" promo card (navy gradient, swirl): which environment this
 * admin edits, the site's host, Open site, and the footer dock below.
 * Hidden in the icon rail, where the dock stands alone.
 */
export function WebsiteCard({
  site,
  children,
}: {
  site: SiteInfo
  children?: ReactNode
}) {
  const status = STATUS[site.env]
  const host = hostOf(site.url)
  return (
    <div className="bg-promo relative isolate overflow-hidden rounded-[18px] p-5 group-data-[collapsible=icon]:hidden">
      <Swirl className="absolute inset-0 -z-10 size-full" />
      <p className="flex items-center gap-2 text-xs font-medium opacity-80">
        <span aria-hidden className={cn("size-2 rounded-full", status.dot)} />
        {status.label}
      </p>
      <p className="mt-3 text-lg leading-tight font-semibold">Your website</p>
      {host ? <p className="mt-1 truncate text-xs opacity-75">{host}</p> : null}
      <a
        href={site.url}
        target="_blank"
        rel="noreferrer"
        data-slot="button"
        className={cn(buttonVariants(), "mt-4 h-11 w-full rounded-xl font-semibold")}
      >
        Open site
        <ExternalLink aria-hidden data-icon="inline-end" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}
```

`components/admin/shell/app-sidebar.tsx` (full file):

```tsx
"use client"

import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useSignOut } from "@/components/admin/auth/sign-out-button"
import { useAdminSession } from "@/components/admin/session-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

import { BrandMark } from "./brand-mark"
import type { SiteInfo } from "./constants"
import { type DockProps, FooterDock } from "./footer-dock"
import { dockItems, type NavBadges } from "./nav"
import { NavMain } from "./nav-main"
import { WebsiteCard } from "./website-card"

/**
 * The floating sidebar panel (JW): brand, sections, and the website card
 * holding the footer dock. Collapses to an icon rail (⌘/Ctrl+B); a sheet
 * below 1024 px.
 */
export function AppSidebar({
  site,
  badges,
}: {
  site: SiteInfo
  badges?: NavBadges
}) {
  const { roles } = useAdminSession()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { isMobile, setOpenMobile } = useSidebar()
  // The next user must never see this user's cached data.
  const { signOut, pending, error } = useSignOut(() => queryClient.clear())
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }
  const dockProps: DockProps = {
    links: dockItems(roles),
    pathname,
    onNavigate,
    onSignOut: () => void signOut(),
    signingOut: pending,
  }
  return (
    <Sidebar variant="floating" collapsible="icon" className="p-4">
      <SidebarHeader className="px-4 pt-5 pb-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1">
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label="Security Partners admin home"
          className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark className="group-data-[collapsible=icon]:[&_[data-slot=brand-name]]:hidden group-data-[collapsible=icon]:[&>span:first-child]:w-10" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain badges={badges} />
      </SidebarContent>
      {/* Pinned below the scrolling menu. The card (and its dock row) hides
          in the icon rail, where the dock stands alone as a column. */}
      <SidebarFooter className="p-3 pt-2 group-data-[collapsible=icon]:px-1">
        <WebsiteCard site={site}>
          <FooterDock tone="card" {...dockProps} />
        </WebsiteCard>
        <div className="hidden group-data-[collapsible=icon]:block">
          <FooterDock tone="rail" {...dockProps} />
        </div>
        {error ? (
          <p
            role="alert"
            className="px-1 text-xs font-medium text-danger group-data-[collapsible=icon]:sr-only"
          >
            {error}
          </p>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  )
}
```

`components/admin/shell/palette-context.tsx`:

```tsx
"use client"

import { createContext, type ReactNode, useContext, useMemo, useState } from "react"

type PaletteState = { open: boolean; setOpen(open: boolean): void }

const PaletteContext = createContext<PaletteState | null>(null)

/** Open state of the ⌘K palette, shared by the topbar pill and the dialog. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  )
}

export function useCommandPalette(): PaletteState {
  const state = useContext(PaletteContext)
  if (!state)
    throw new Error("useCommandPalette must be used inside <AdminShell>")
  return state
}
```

`components/admin/shell/command-palette.tsx` — three edits:
1. Imports: remove `Search` from the `lucide-react` import, remove `import { Button } from "@/components/ui/button"` and `import { Kbd } from "@/components/ui/kbd"`, add `import { useCommandPalette } from "./palette-context"`; drop `useState` from the React import only if no other use remains (the query string still uses it — keep it).
2. Replace `const [open, setOpen] = useState(false)` with `const { open, setOpen } = useCommandPalette()`.
3. Delete the trigger `<Button …>…</Button>` at the top of the returned fragment (the `SearchPill` opens it now); keep `CommandDialog` and everything inside unchanged. Update the doc comment's last sentence to "Opened by the topbar's SearchPill or ⌘/Ctrl+K."

`components/admin/shell/search-pill.tsx`:

```tsx
"use client"

import { Search, SlidersHorizontal } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Kbd, KbdGroup } from "@/components/ui/kbd"

import { useCommandPalette } from "./palette-context"

const subscribe = () => () => {}
const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent)

/** The topbar's search pill with its ⌘K hint (server assumes ⌘). */
export function SearchPill() {
  const { setOpen } = useCommandPalette()
  const apple = useSyncExternalStore(subscribe, isApple, () => true)
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Search"
      aria-keyshortcuts="Meta+K Control+K"
      className="flex h-11 w-full max-w-sm min-w-0 items-center gap-3 rounded-full bg-card px-4 text-sm text-muted-foreground ring-1 ring-border transition-shadow outline-none hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search</span>
      <KbdGroup aria-hidden className="hidden sm:inline-flex">
        <Kbd>{apple ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
      <SlidersHorizontal aria-hidden className="size-4 shrink-0" />
    </button>
  )
}
```

`components/admin/shell/notifications-button.tsx`:

```tsx
"use client"

import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

import { ICON_BUTTON } from "./constants"

/** The bell. Phase 7 fills it (new leads); until then it is honestly empty. */
export function NotificationsButton() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className={ICON_BUTTON}
            aria-label="Notifications"
          />
        }
      >
        <Bell aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        <div className="max-h-80 overflow-y-auto">
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up. New enquiries and anything that needs
            your attention will show here.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

`components/admin/shell/user-menu.tsx`:

```tsx
"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"

import { useSignOut } from "@/components/admin/auth/sign-out-button"
import { initials } from "@/components/admin/kit/format"
import { useAdminSession } from "@/components/admin/session-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/**
 * The avatar alone in the topbar; name, email and roles sit in the menu
 * (Account, Security, Theme, Sign out). A failed sign-out shows below the
 * avatar and clears when the menu reopens.
 */
export function UserMenu() {
  const { user, roles } = useAdminSession()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  // The next user must never see this user's cached data.
  const { signOut, pending, error, clearError } = useSignOut(() =>
    queryClient.clear()
  )
  return (
    <div className="relative">
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) clearError()
        }}
      >
        <DropdownMenuTrigger
          aria-label={`Account menu for ${user.name}`}
          className="flex shrink-0 rounded-full p-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar aria-hidden className="size-11">
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate font-semibold text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs font-normal">{user.email}</span>
              {roles.length ? (
                <Badge variant="secondary" className="mt-2 w-fit capitalize">
                  {roles.join(", ")}
                </Badge>
              ) : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href="/admin/account" />}>
              <UserRound aria-hidden />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href="/admin/account?tab=security" />}
            >
              <ShieldCheck aria-hidden />
              Security
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(String(value))}
            >
              {THEMES.map(({ value, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon aria-hidden />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={pending} onClick={() => void signOut()}>
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p
          role="alert"
          className="absolute top-full right-0 z-40 mt-2 w-64 rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger shadow-lg"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

`components/admin/shell/topbar.tsx`:

```tsx
"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"

import { NotificationsButton } from "./notifications-button"
import { SearchPill } from "./search-pill"
import { UserMenu } from "./user-menu"

/**
 * The 72 px topbar panel (JW): sidebar toggle, search pill, bell, avatar.
 * Phase 7 adds the Leads mail link before the bell; Phase 9 the AI button.
 */
export function Topbar() {
  return (
    <header
      data-slot="topbar"
      className="rounded-card flex h-[72px] shrink-0 items-center gap-2 bg-sidebar px-3 sm:gap-3 sm:px-5"
    >
      <SidebarTrigger className="size-10 rounded-full" />
      <div className="flex min-w-0 flex-1">
        <SearchPill />
      </div>
      <NotificationsButton />
      <UserMenu />
    </header>
  )
}
```

`components/admin/shell/impersonation-banner.tsx` — restyle only (logic unchanged): the outer `div` className becomes `"rounded-card flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-warning-soft px-4 py-3 text-sm font-medium text-warning"`, and the button's className becomes `"rounded-lg border-warning/40 bg-transparent text-warning hover:bg-warning/10 hover:text-warning"`. Update the doc comment's second line to "Rendered in the content column's header wrapper, above the topbar."

`components/admin/shell/admin-shell.tsx` (full file):

```tsx
"use client"

import type { QueryClient } from "@tanstack/react-query"
import type { CSSProperties, ReactNode } from "react"

import { AdminProviders } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import { SidebarProvider } from "@/components/ui/sidebar"

import { AppSidebar } from "./app-sidebar"
import { CommandPalette } from "./command-palette"
import { DEFAULT_SITE, type SiteInfo } from "./constants"
import { ImpersonationBanner } from "./impersonation-banner"
import type { NavBadges } from "./nav"
import { CommandPaletteProvider } from "./palette-context"
import { Topbar } from "./topbar"

/**
 * Signed-in admin frame (JW floating panels): a 288 px sidebar panel, the
 * 72 px topbar panel and the content panel on a white canvas with 16 px
 * gutters. The content panel scrolls inside its own corners; --content-h is
 * its visible height for sticky panes inside (svh − gutters − topbar − gap).
 */
export function AdminShell({
  session,
  children,
  queryClient,
  defaultSidebarOpen = true,
  site = DEFAULT_SITE,
  badges,
}: {
  session: AdminSession
  children: ReactNode
  queryClient?: QueryClient
  /** Desktop sidebar expanded (the `sidebar_state` cookie remembers it). */
  defaultSidebarOpen?: boolean
  /** The public site (website card). */
  site?: SiteInfo
  /** Counts beside nav items (e.g. new leads, from Phase 7). */
  badges?: NavBadges
}) {
  return (
    <AdminSessionProvider value={session}>
      <AdminProviders
        cacheKey={`${session.user.id}:${session.impersonatedBy ?? ""}`}
        client={queryClient}
      >
        <CommandPaletteProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-xl bg-card px-4 py-2 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:ring-3 focus:ring-ring/50"
          >
            Skip to content
          </a>
          <SidebarProvider
            defaultOpen={defaultSidebarOpen}
            style={{ "--sidebar-width": "20rem" } as CSSProperties}
          >
            <AppSidebar site={site} badges={badges} />
            <div className="flex h-svh min-w-0 flex-1 flex-col gap-4 p-3 [--content-h:calc(100svh-112px)] sm:p-4 sm:[--content-h:calc(100svh-120px)] lg:pl-0">
              {/* One header wrapper: the impersonation banner stacks above
                  the topbar instead of covering it; the sidebar sits beside
                  the column, never underneath (WCAG 2.2 SC 2.4.11). */}
              <div data-slot="admin-header" className="flex shrink-0 flex-col gap-3">
                {session.impersonatedBy ? (
                  <ImpersonationBanner name={session.user.name} />
                ) : null}
                <Topbar />
              </div>
              <main
                id="main"
                tabIndex={-1}
                className="rounded-card relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-sidebar p-4 outline-none sm:p-6 lg:p-8"
              >
                {children}
              </main>
            </div>
          </SidebarProvider>
          <CommandPalette />
        </CommandPaletteProvider>
      </AdminProviders>
    </AdminSessionProvider>
  )
}
```

Delete them: `git rm components/admin/shell/site-header.tsx components/admin/shell/nav-user.tsx` (the deletions are then part of the commit). Run `grep -rn "site-header\|nav-user\|admin-header-h\|--header-height" components app hooks tests` — expected: no hits except `components/admin/editor/editor-layout.tsx` (`sticky top-14`, fixed in Task 7). `initials` was exported by `nav-user.tsx`: `grep -rn "from \"@/components/admin/shell/nav-user\"" .` must be empty (the kit's `initials` replaces it).

E2E selectors (user menu moved to the topbar):
- `tests/e2e/admin-auth.spec.ts`: `openUserMenu` becomes

```ts
/** The signed-in user's menu in the topbar (holds "Sign out"). */
async function openUserMenu(page: Page, name: string) {
  await page.getByRole("button", { name: `Account menu for ${name}` }).click()
}
```

  and in "a failed sign-out shows an error and keeps the session" replace `const footer = page.locator('[data-slot="sidebar-footer"]')` with `const footer = page.locator('[data-slot="topbar"]')` and the comment with `// The error shows under the avatar; the menu can be reopened to retry.`
- `tests/e2e/account.spec.ts`: replace

```ts
  await page
    .locator('[data-slot="sidebar-footer"]')
    .getByRole("button", { name: account.name })
    .click()
```

  with `await page.getByRole("button", { name: \`Account menu for ${account.name}\` }).click()`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/admin-shell.test.tsx tests/dom/command-palette.test.tsx`
Expected: PASS (admin-shell: 11 kept + 12 replaced/new + 3 NavEntry = 26 tests; palette suite unchanged — its trigger is found by `/Search/`).

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: clean / green.

- [ ] **Step 5: Re-baseline the shell and check the public site (Playwright lock)**

Run: `pnpm exec playwright test tests/visual/admin-shell.spec.ts --update-snapshots=changed`
Expected: 4 baselines rewritten (floating panels, topbar, promo card). Inspect each PNG: grey panels on white, 16 px gutters, navy website card, avatar right.

Run: `pnpm test:visual`
Expected: 44 passed (40 public at 0 px; `git status tests/visual/__screenshots__` shows only the 4 `admin-shell-*` files changed).

Run: `pnpm test:e2e tests/e2e/admin-auth.spec.ts tests/e2e/account.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write components/admin/shell components/ui/sidebar.tsx tests/dom/admin-shell.test.tsx tests/e2e/admin-auth.spec.ts tests/e2e/account.spec.ts
git add components/admin/shell components/ui/sidebar.tsx tests/dom/admin-shell.test.tsx tests/e2e/admin-auth.spec.ts tests/e2e/account.spec.ts tests/visual/__screenshots__/admin-shell-desktop.png tests/visual/__screenshots__/admin-shell-mobile.png tests/visual/__screenshots__/admin-shell-nav-mobile.png tests/visual/__screenshots__/admin-shell-collapsed-desktop.png
git commit -m "$(cat <<'EOF'
feat(admin): JW floating-panel shell in Security Partners colours

288 px floating sidebar panel with brand mark, section entries (bar,
bold label, filled icon), navy website card and footer dock; 72 px
topbar with search pill, notifications and the avatar menu (account,
security, theme, sign out); content panel scrolls in its own corners.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: SectionTabs in the JW look — extend Task 14's component (master Task 4.1 / Phase 4 Task 14 restyle)

**Files:**
- Modify: `components/admin/section-tabs/section-tabs.tsx` (style constants + optional `heading`), `components/admin/collections/collection-tabs.tsx` (`heading="Collections"`), `components/admin/settings/settings-tabs.tsx` (`heading="Settings"`)
- Test: `tests/dom/section-tabs.test.tsx` (add 3 tests)

**Interfaces:**
- Consumes: Task 14 `SectionTabs`, `SectionTabsPanel`, `useTabParam`, `useInSectionTabs` (behaviour unchanged: route mode with `aria-current`, in-page ARIA tablist with roving focus, `?tab=`, error dots, nested depth → `xl`).
- Produces (additive):

```ts
export type SectionTabsProps = {
  items: SectionTabItem[]; value?: string; onValueChange?: (id: string) => void
  children: ReactNode; ariaLabel: string; param?: string
  /** Small uppercase caption above the vertical list (JW section label); decorative. */
  heading?: string
}
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/dom/section-tabs.test.tsx` (inside its top-level `describe`, reusing that file's existing `next/navigation` and `next/link` mocks and imports of `SectionTabs`/`SectionTabsPanel`; add `within` to its `@testing-library/react` import if missing):

```tsx
  it("JW look: active tab on the accent fill with a semibold label", () => {
    render(
      <SectionTabs
        ariaLabel="Account"
        items={[
          { id: "profile", label: "Profile" },
          { id: "security", label: "Security" },
        ]}
        value="security"
      >
        <SectionTabsPanel id="profile">Profile body</SectionTabsPanel>
        <SectionTabsPanel id="security">Security body</SectionTabsPanel>
      </SectionTabs>
    )
    const active = screen.getByRole("tab", { name: "Security" })
    expect(active).toHaveClass("bg-sidebar-accent", "font-semibold")
    expect(screen.getByRole("tab", { name: "Profile" })).not.toHaveClass(
      "bg-sidebar-accent"
    )
  })

  it("shows the section caption above the list, hidden from assistive tech", () => {
    render(
      <SectionTabs
        ariaLabel="Settings"
        heading="Settings"
        items={[
          { id: "a", label: "Site", href: "/admin/settings/site" },
          { id: "b", label: "Footer", href: "/admin/settings/footer" },
        ]}
      >
        <p>Body</p>
      </SectionTabs>
    )
    const nav = screen.getByRole("navigation", { name: "Settings" })
    const caption = within(nav).getByText("Settings", { selector: "p" })
    expect(caption).toHaveAttribute("aria-hidden", "true")
    expect(caption).toHaveClass("uppercase")
  })

  it("keeps the 13 rem column (JW lg:w-52)", () => {
    render(
      <SectionTabs
        ariaLabel="Settings"
        items={[{ id: "a", label: "Site", href: "/admin/settings/site" }]}
      >
        <p>Body</p>
      </SectionTabs>
    )
    expect(screen.getByRole("navigation", { name: "Settings" })).toHaveClass(
      "lg:w-52"
    )
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/section-tabs.test.tsx`
Expected: FAIL — the 3 new tests (`bg-sidebar-accent` missing; no caption `p`; class is `lg:w-56`).

- [ ] **Step 3: Implement** (edit Task 14's file; keep every behaviour)

In `components/admin/section-tabs/section-tabs.tsx`:

1. `SectionTabsProps`: add the documented `heading?: string` field (after `param`).
2. Replace the `LAYOUT` constant with:

```ts
const LAYOUT = {
  lg: {
    root: "flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8",
    column: "lg:w-52 lg:shrink-0",
    list: "lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0",
    tab: "lg:w-full",
    marker: "lg:block",
  },
  xl: {
    root: "flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-8",
    column: "xl:w-52 xl:shrink-0",
    list: "xl:flex-col xl:overflow-visible xl:px-0 xl:pb-0",
    tab: "xl:w-full",
    marker: "xl:block",
  },
} as const
```

3. Replace `TAB`, `TAB_ACTIVE` and `LIST` with:

```ts
const TAB =
  "relative flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
const TAB_ACTIVE = "bg-sidebar-accent font-semibold text-foreground"
const LIST = "-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
```

4. In `TabContent`, the active marker span's `h-5` becomes `h-6`.
5. Add a caption component and render it first inside the column element of both modes (inside `<nav>` in `RouteTabs`, inside the column `<div>` before the `role="tablist"` div in `InPageTabs`):

```tsx
function Caption({ text, marker }: { text?: string; marker: string }) {
  if (!text) return null
  return (
    <p
      aria-hidden
      className={cn(
        "mb-2 hidden px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase",
        marker
      )}
    >
      {text}
    </p>
  )
}
```

   `RouteTabs` and `InPageTabs` destructure `heading` and render `<Caption text={heading} marker={layout.marker} />`.

`components/admin/collections/collection-tabs.tsx`: `<SectionTabs ariaLabel="Collections" heading="Collections" items={items}>`.
`components/admin/settings/settings-tabs.tsx`: `<SectionTabs ariaLabel="Settings" heading="Settings" items={ITEMS}>`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/section-tabs.test.tsx tests/dom/collection-tabs.test.tsx tests/dom/settings-editor.test.tsx tests/dom/versioned-editor.test.tsx`
Expected: PASS (all Task 14 behaviour tests unchanged + 3 new).

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/section-tabs/section-tabs.tsx components/admin/collections/collection-tabs.tsx components/admin/settings/settings-tabs.tsx tests/dom/section-tabs.test.tsx
git add components/admin/section-tabs/section-tabs.tsx components/admin/collections/collection-tabs.tsx components/admin/settings/settings-tabs.tsx tests/dom/section-tabs.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): section tabs in the JW look

13 rem column, accent fill and semibold label for the active tab,
24 px primary bar, optional uppercase section caption. Behaviour
(route and in-page modes, ?tab=, roving focus, error dots) unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Lists in the JW pattern — data table, pagination, pages, services, collections (master Tasks 4.4 / 4.6 restyle)

**Files:**
- Create: `components/admin/data-table/data-table-pagination.tsx`
- Modify: `components/admin/data-table/data-table.tsx` (toolbar, card table, kit states, pagination), `components/admin/pages/pages-list.tsx` (full rewrite), `components/admin/services/services-screen.tsx`, `components/admin/collections/collection-screen.tsx`, `components/admin/collections/record-sheet.tsx`, `components/admin/collections/reorder-panel.tsx`
- Test: `tests/dom/admin-lists.test.tsx` (new), `tests/dom/collections.test.tsx` (pagination button names)

**Interfaces:**
- Consumes: Task 2 kit (`EmptyState`, `CardSkeleton`, `ContentStatusPills`, `formatNumber`, `relativeTime`, `FORM_ACTION`, `PRIMARY_ACTION`, `LINK_PRIMARY`), `ButtonGroup` (Task 1), `api.pages.$get()` → `{ items: PageListItem[] }`, existing `DataTable` props (unchanged signature).
- Produces:

```ts
// components/admin/data-table/data-table-pagination.tsx
export function DataTablePagination(props: { page: number; pageSize: number; total: number; onPageChange(page: number): void }): JSX.Element
// DataTable: same props as before; renders toolbar (search, optional phone sort), rounded-card table ≥ 640 px,
// rounded-card cards below, EmptyState (empty / no match / error with "Try again"), CardSkeleton while pending,
// DataTablePagination ("Previous page" / "Next page", "1–20 of 45" / "No results").
```

- [ ] **Step 1: Write the failing tests**

`tests/dom/admin-lists.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { DataTablePagination } from "@/components/admin/data-table/data-table-pagination"
import { PagesList } from "@/components/admin/pages/pages-list"
import { makeQueryClient } from "@/components/admin/providers"

const page = (over: Record<string, unknown>) => ({
  key: "home",
  label: "Home",
  template: "home",
  path: "/",
  version: 3,
  status: "published",
  dirty: false,
  publishedAt: "2026-10-01T10:00:00Z",
  updatedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  updatedBy: { id: "u1", name: "Edith Editor" },
  ...over,
})

function renderPages() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <PagesList />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        items: [
          page({}),
          page({ key: "about", label: "About", path: "/about", dirty: true }),
          page({
            key: "terms",
            label: "Terms",
            path: "/terms",
            publishedAt: null,
            status: "draft",
          }),
        ],
      })
    )
  )
})

describe("pages list (JW pattern)", () => {
  it("shows Title, Address, Status and Updated in a card table", async () => {
    renderPages()
    const table = await screen.findByRole("table", { name: "Pages" })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent)
    ).toEqual(["Title", "Address", "Status", "Updated"])
    expect(table.closest('[data-slot="table-card"]')).toHaveClass(
      "rounded-card",
      "bg-card"
    )
    const rows = within(table).getAllByRole("row").slice(1)
    expect(within(rows[0]).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/admin/pages/home"
    )
    expect(within(rows[0]).getByText("/", { selector: "code" })).toBeInTheDocument()
    expect(rows[0]).toHaveTextContent("Published")
    expect(rows[0]).toHaveTextContent("2 hours ago · Edith Editor")
    expect(rows[1]).toHaveTextContent("PublishedUnpublished changes")
    expect(rows[2]).toHaveTextContent("Draft")
  })

  it("lists cards on phones with the same facts", async () => {
    renderPages()
    const list = await screen.findByRole("list", { name: "Pages" })
    const cards = within(list).getAllByRole("listitem")
    expect(cards).toHaveLength(3)
    expect(cards[2]).toHaveTextContent("Terms")
    expect(cards[2]).toHaveTextContent("/terms")
    expect(cards[2]).toHaveTextContent("Draft")
  })

  it("offers Try again when the list fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          // 4xx is final for the admin QueryClient (no retry delay).
          { error: { code: "FORBIDDEN", message: "Not allowed" } },
          { status: 403 }
        )
      )
    )
    renderPages()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("The pages didn't load")
    expect(alert).toHaveTextContent("Not allowed")
    expect(
      within(alert).getByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
  })
})

describe("DataTablePagination", () => {
  it("shows the range and chevron buttons with names", async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DataTablePagination
        page={2}
        pageSize={20}
        total={45}
        onPageChange={onPageChange}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav).toHaveTextContent("21–40 of 45")
    await user.click(within(nav).getByRole("button", { name: "Next page" }))
    expect(onPageChange).toHaveBeenCalledWith(3)
    await user.click(within(nav).getByRole("button", { name: "Previous page" }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it("says No results and disables both buttons when empty", () => {
    render(
      <DataTablePagination page={1} pageSize={20} total={0} onPageChange={vi.fn()} />
    )
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav).toHaveTextContent("No results")
    expect(within(nav).getByRole("button", { name: "Next page" })).toBeDisabled()
    expect(
      within(nav).getByRole("button", { name: "Previous page" })
    ).toBeDisabled()
  })
})
```

In `tests/dom/collections.test.tsx` replace the three `getByRole("button", { name: "Next" })` with `getByRole("button", { name: "Next page" })` (lines with `within(pager)`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/admin-lists.test.tsx tests/dom/collections.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/data-table/data-table-pagination"`; collections: `Unable to find role="button" and name "Next page"`.

- [ ] **Step 3: Implement**

`components/admin/data-table/data-table-pagination.tsx`:

```tsx
"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { formatNumber } from "@/components/admin/kit/format"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"

/** "21–40 of 45" and a chevron pair (JW). Pages are 1-based. */
export function DataTablePagination({
  page: requested,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requested, pageCount)
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p aria-live="polite" className="text-muted-foreground tabular-nums">
        {total === 0
          ? "No results"
          : `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(total)}`}
      </p>
      <ButtonGroup>
        <Button
          type="button"
          variant="outline"
          className="bg-card"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="bg-card"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </ButtonGroup>
    </nav>
  )
}
```

`components/admin/data-table/data-table.tsx` — keep all state, query and TanStack logic; replace the returned JSX (from `return (` to the matching `)` of the component) with:

```tsx
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder={searchPlaceholder}
            className="h-10 rounded-xl bg-card pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {sortOptions.length ? (
          <div className="flex w-full items-center gap-2 text-sm sm:hidden">
            <label htmlFor={sortId} className="text-muted-foreground">
              Sort by
            </label>
            <select
              id={sortId}
              value={sort ?? ""}
              onChange={(event) => {
                const [id, dir] = event.target.value.split(":")
                setSorting(id ? [{ id, desc: dir === "desc" }] : [])
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Default order</option>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {query.isError ? (
        <EmptyState
          role="alert"
          title={`The ${label.toLowerCase()} didn't load`}
          description={errorMessage(query.error)}
          action={
            <Button
              type="button"
              className={FORM_ACTION}
              onClick={() => query.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading {label.toLowerCase()}…</span>
          <CardSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          role={q ? "status" : undefined}
          title={q ? "No matches" : `No ${label.toLowerCase()} yet`}
          description={q ? `Nothing matches “${q}”.` : empty}
          action={q ? undefined : emptyAction}
        />
      ) : (
        <div
          aria-busy={query.isPlaceholderData || undefined}
          className={cn(
            "flex flex-col gap-3 transition-opacity",
            query.isPlaceholderData && "opacity-60"
          )}
        >
          <div
            data-slot="table-card"
            className="rounded-card hidden overflow-x-auto bg-card sm:block"
          >
            <table className="w-full text-sm">
              <caption className="sr-only">{label}</caption>
              <thead className="border-b text-left text-muted-foreground">
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
                          className="h-12 px-4 font-medium"
                        >
                          {header.isPlaceholder ? null : sortable ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
          <ul aria-label={label} className="flex flex-col gap-3 sm:hidden">
            {rows.map((row) => (
              <li key={row.id}>{renderCard(row as T)}</li>
            ))}
          </ul>
        </div>
      )}

      <DataTablePagination
        page={pagination.pageIndex + 1}
        pageSize={pagination.pageSize}
        total={total}
        onPageChange={(next) =>
          setPagination((p) => ({ ...p, pageIndex: next - 1 }))
        }
      />
    </div>
  )
```

and fix the imports: remove `Skeleton`; add

```ts
import { DataTablePagination } from "@/components/admin/data-table/data-table-pagination"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { FORM_ACTION } from "@/components/admin/page-header"
```

Delete the now-unused `from`/`to` constants (the pagination component computes the range). Keep `total`.

`components/admin/pages/pages-list.tsx` (full file):

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { FileText } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ContentStatusPills } from "@/components/admin/kit/content-status"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { relativeTime } from "@/components/admin/kit/format"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { PageListItem } from "@/lib/schemas/api/content"

const stateOf = (page: PageListItem) => ({
  published: page.publishedAt ? true : null,
  dirty: page.dirty,
})

function Updated({ page, now }: { page: PageListItem; now: number }) {
  return (
    <time dateTime={page.updatedAt} className="whitespace-nowrap">
      {relativeTime(page.updatedAt, now)}
      {page.updatedBy ? ` · ${page.updatedBy.name}` : ""}
    </time>
  )
}

/** The eight fixed pages (JW pages list): card table ≥ 640 px, cards below. */
export function PagesList() {
  const [now] = useState(() => Date.now())
  const pages = useQuery({
    queryKey: ["pages"],
    queryFn: () => unwrap(api.pages.$get()),
  })
  if (pages.isPending)
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading pages…</span>
        <CardSkeleton />
      </div>
    )
  if (pages.isError)
    return (
      <EmptyState
        role="alert"
        title="The pages didn't load"
        description={errorMessage(pages.error)}
        action={
          <Button
            type="button"
            className={FORM_ACTION}
            onClick={() => pages.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  const items = pages.data.items
  if (items.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title="No pages yet"
        description="The site's pages appear here once the content is seeded."
      />
    )
  return (
    <>
      <div
        data-slot="table-card"
        className="rounded-card hidden overflow-x-auto bg-card sm:block"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Pages</caption>
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th scope="col" className="h-12 px-4 font-medium">
                Title
              </th>
              <th scope="col" className="h-12 px-4 font-medium">
                Address
              </th>
              <th scope="col" className="h-12 px-4 font-medium">
                Status
              </th>
              <th scope="col" className="h-12 px-4 font-medium">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((page) => (
              <tr key={page.key} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/pages/${page.key}`}
                    className="font-semibold underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {page.label}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <code className="font-mono text-xs text-muted-foreground">
                    {page.path}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <ContentStatusPills record={stateOf(page)} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Updated page={page} now={now} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label="Pages" className="flex flex-col gap-3 sm:hidden">
        {items.map((page) => (
          <li key={page.key} className="rounded-card bg-card p-4">
            <div className="flex flex-col gap-2 text-sm">
              <Link
                href={`/admin/pages/${page.key}`}
                className="font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {page.label}
              </Link>
              <code className="font-mono text-xs text-muted-foreground">
                {page.path}
              </code>
              <ContentStatusPills record={stateOf(page)} />
              <p className="text-xs text-muted-foreground">
                Updated <Updated page={page} now={now} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
```

`components/admin/services/services-screen.tsx`:
- imports: remove `statusLabel` and `Badge`; add `import { ContentStatusPills } from "@/components/admin/kit/content-status"` and `import { LINK_PRIMARY } from "@/components/admin/page-header"`.
- "Service" column cell link className → `"font-semibold underline-offset-4 hover:text-primary hover:underline"`.
- "Address" cell → `<code className="font-mono text-xs text-muted-foreground">/services/{info.getValue()}</code>`.
- "Status" cell → `<ContentStatusPills record={{ published: row.original.publishedAt ? true : null, dirty: row.original.dirty }} />`.
- `renderCard`: drop the `statusLabel` call; the `Link` className → `"flex items-center gap-3 rounded-card bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"`; title span `font-semibold`; replace the `<Badge …>` with `<ContentStatusPills record={{ published: row.publishedAt ? true : null, dirty: row.dirty }} />`.
- The header's "New service" link className → `LINK_PRIMARY` (keep its `<Plus aria-hidden />` and text); the "Change order" `Button` gets `className={SECONDARY_ACTION}` (import it from `@/components/admin/page-header`) and `variant="outline"`.
- `emptyAction` link className → `LINK_PRIMARY`.

`components/admin/collections/collection-screen.tsx`:
- Header actions: "Change order" `Button` → `variant="outline" className={SECONDARY_ACTION}`; "Add …" `Button` → `className={PRIMARY_ACTION}` (import both from `@/components/admin/page-header`).
- `renderCard` wrappers: both `"w-full rounded-xl border bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"` and `"rounded-xl border bg-card p-3"` → `"w-full rounded-card bg-card p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"` and `"rounded-card bg-card p-4"`.
- `emptyAction` button: `className={FORM_ACTION}` instead of `size="sm"`.

`components/admin/collections/record-sheet.tsx`: `<SheetTitle>` gets `className="text-lg font-semibold"`; the `SheetContent` className becomes `"w-full gap-0 bg-card sm:max-w-xl"`; footer primary button (`Save`/`Create`) gets `className={FORM_ACTION}` (import from `@/components/admin/page-header`).

`components/admin/collections/reorder-panel.tsx`:
- Loading block → `<div role="status" aria-busy="true"><span className="sr-only">Loading {label.toLowerCase()}…</span><CardSkeleton className="h-64" /></div>` (import `CardSkeleton` from `@/components/admin/kit/skeletons`; remove the `Skeleton` import).
- Error block → `<EmptyState role="alert" title="The order didn't load" description={…the existing message expression…} action={<Button type="button" className={FORM_ACTION} onClick={…existing retry…}>Try again</Button>} />` (import `EmptyState`, `FORM_ACTION`).
- Wrap the sortable list (the element after the explanatory `<p>`) in `<div className="rounded-card bg-card p-4">…</div>`; the Save button gets `className={FORM_ACTION}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/admin-lists.test.tsx tests/dom/collections.test.tsx tests/dom/services-screens.test.tsx`
Expected: PASS (admin-lists 5 tests; collections and services suites green).

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/data-table components/admin/pages/pages-list.tsx components/admin/services/services-screen.tsx components/admin/collections tests/dom/admin-lists.test.tsx tests/dom/collections.test.tsx
git add components/admin/data-table components/admin/pages/pages-list.tsx components/admin/services/services-screen.tsx components/admin/collections tests/dom/admin-lists.test.tsx tests/dom/collections.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): JW list pattern for pages, services and collections

White card tables on the grey panel, cards on phones, status pills,
kit empty/error/loading states with Try again, chevron pagination and
the primary/secondary button pair. Server paging, sorting and search
are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Editor screens in the JW page-builder header (master Task 4.4 restyle)

**Files:**
- Modify: `components/admin/editor/editor-layout.tsx` (full rewrite), `components/admin/editor/save-state.tsx` (full rewrite), `components/admin/editor/versioned-editor.tsx` (status, `path`, action classes), `components/admin/pages/page-editor.tsx` and `components/admin/services/service-editor.tsx` (pass `path`), `components/admin/schema-form/widgets/structure.tsx` (group card classes)
- Test: `tests/dom/editor-layout.test.tsx` (new), `tests/dom/versioned-editor.test.tsx` (one selector)

**Interfaces:**
- Consumes: Task 2 `ContentStatusPills`, `ContentState`, `PRIMARY_ACTION`, `FORM_ACTION`; Task 14 `useInSectionTabs`; `SaveState` (`hooks/use-autosave.ts`: `"saved" | "saving" | "unsaved" | "invalid" | "conflict" | "error"`).
- Produces:

```ts
// components/admin/editor/editor-layout.tsx
export function EditorLayout(props: {
  backHref: string; backLabel: string; title: string
  status: ContentState            // was { text; variant } — now JW status pills
  path?: string                   // public path shown as <code>
  saveState: ReactNode; actions: ReactNode; aside?: ReactNode
  preview?: ReactNode             // Task 8: live preview column (2xl)
  children: ReactNode
}): JSX.Element
// statusLabel() is removed (callers use ContentStatusPills / contentStatus)
// components/admin/editor/save-state.tsx (same props)
export function SaveStateIndicator(props: { state: SaveState; onRetry?: () => void }): JSX.Element
// VersionedEditorProps gains: path?: string
```

- [ ] **Step 1: Write the failing tests**

`tests/dom/editor-layout.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { EditorLayout } from "@/components/admin/editor/editor-layout"
import { SaveStateIndicator } from "@/components/admin/editor/save-state"

describe("EditorLayout (JW page-builder header)", () => {
  it("back link, title, path, status pills, save state and actions", () => {
    render(
      <main>
        <EditorLayout
          backHref="/admin/pages"
          backLabel="Pages"
          title="Home"
          path="/"
          status={{ published: {}, dirty: true }}
          saveState={<SaveStateIndicator state="saved" />}
          actions={<button type="button">Publish</button>}
        >
          <p>Form</p>
        </EditorLayout>
      </main>
    )
    const bar = document.querySelector('[data-slot="editor-bar"]') as HTMLElement
    expect(bar).toHaveClass("lg:sticky", "top-0", "bg-sidebar")
    expect(within(bar).getByRole("link", { name: "Pages" })).toHaveAttribute(
      "href",
      "/admin/pages"
    )
    expect(within(bar).getByRole("heading", { level: 1 })).toHaveClass(
      "text-title"
    )
    expect(within(bar).getByText("/", { selector: "code" })).toBeInTheDocument()
    expect(bar).toHaveTextContent("PublishedUnpublished changes")
    expect(within(bar).getByRole("button", { name: "Publish" })).toBeInTheDocument()
    expect(screen.getByText("Form").closest('[data-slot="editor-form"]')).not.toBeNull()
  })
})

describe("SaveStateIndicator (JW pill)", () => {
  it.each([
    ["saved", "Saved", "bg-success"],
    ["saving", "Saving…", "bg-primary"],
    ["unsaved", "Unsaved changes", "bg-warning"],
    ["error", "Not saved", "bg-danger"],
  ] as const)("%s → %s with a %s dot", (state, label, dot) => {
    render(<SaveStateIndicator state={state} />)
    const status = screen.getByRole("status", { name: `Save status: ${label}` })
    expect(status).toHaveTextContent(label)
    expect(status).toHaveClass("rounded-full", "bg-card")
    expect(status.querySelector("[aria-hidden]")).toHaveClass(dot)
  })

  it("offers Retry after a failed save", () => {
    const onRetry = vi.fn()
    render(<SaveStateIndicator state="error" onRetry={onRetry} />)
    screen.getByRole("button", { name: "Retry" }).click()
    expect(onRetry).toHaveBeenCalled()
  })
})
```

In `tests/dom/versioned-editor.test.tsx` replace `document.querySelector('[data-slot="badge"]')` with `document.querySelector('[data-slot="status-pill"]')`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/editor-layout.test.tsx tests/dom/versioned-editor.test.tsx`
Expected: FAIL — no `[data-slot="editor-bar"]`; `Save status: Saved` has no `rounded-full`; versioned-editor: `status-pill` not found.

- [ ] **Step 3: Implement**

`components/admin/editor/editor-layout.tsx` (full file):

```tsx
"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useEffect, useRef } from "react"

import {
  type ContentState,
  ContentStatusPills,
} from "@/components/admin/kit/content-status"
import { useInSectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { cn } from "@/lib/utils"

/**
 * Keeps focused or scrolled-to fields clear of the sticky editor bar
 * (WCAG 2.2 SC 2.4.11): the content panel (<main>) is the scroll
 * container, so its scroll-padding-top follows the bar's height.
 */
function useScrollPaddingFor(bar: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const node = bar.current
    const main = node?.closest("main")
    if (!node || !main || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      main.style.scrollPaddingTop = `${node.offsetHeight + 8}px`
      // Sticky panes beside the form (Task 8 preview) sit below the bar.
      main.style.setProperty("--editor-bar-h", `${node.offsetHeight}px`)
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      main.style.removeProperty("scroll-padding-top")
      main.style.removeProperty("--editor-bar-h")
    }
  }, [bar])
}

/**
 * Editor frame (JW page builder): back link, title, public path and status
 * pills, then save state and actions — sticky at the top of the content
 * panel from lg. The form below; from 2xl a live preview column (Task 8).
 * Inside section tabs (Settings) the bar spans the tab content only.
 */
export function EditorLayout({
  backHref,
  backLabel,
  title,
  status,
  path,
  saveState,
  actions,
  aside,
  preview,
  children,
}: {
  backHref: string
  backLabel: string
  title: string
  status: ContentState
  path?: string
  saveState: ReactNode
  actions: ReactNode
  aside?: ReactNode
  preview?: ReactNode
  children: ReactNode
}) {
  const inTabs = useInSectionTabs()
  const bar = useRef<HTMLDivElement>(null)
  useScrollPaddingFor(bar)
  return (
    <div className="flex flex-col gap-6">
      <div
        ref={bar}
        data-slot="editor-bar"
        className={cn(
          "top-0 z-20 flex flex-col gap-4 bg-sidebar pb-4 lg:sticky xl:flex-row xl:items-end xl:justify-between",
          !inTabs &&
            "-mx-4 -mt-4 px-4 pt-4 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8"
        )}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {backLabel}
          </Link>
          <h1 className="text-title truncate">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {path ? (
              <code className="rounded-md bg-card px-2 py-1 font-mono text-xs text-foreground">
                {path}
              </code>
            ) : null}
            <ContentStatusPills record={status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {saveState}
          {actions}
        </div>
      </div>
      {aside ? (
        <aside className="flex flex-col gap-4 rounded-card bg-card p-5 sm:p-6">
          {aside}
        </aside>
      ) : null}
      <div
        className={cn(
          "grid items-start gap-6",
          preview && "2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
        )}
      >
        <div data-slot="editor-form" className="min-w-0">
          {children}
        </div>
        {preview ? (
          <div className="hidden 2xl:sticky 2xl:top-[calc(var(--editor-bar-h,9rem)+1rem)] 2xl:block">
            {preview}
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

`components/admin/editor/save-state.tsx` (full file):

```tsx
"use client"

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

const DOT: Record<SaveState, string> = {
  saved: "bg-success",
  saving: "bg-primary motion-safe:animate-pulse",
  unsaved: "bg-warning",
  invalid: "bg-danger",
  conflict: "bg-danger",
  error: "bg-danger",
}

/** JW save indicator: a pill with a coloured dot (announced politely). */
export function SaveStateIndicator({
  state,
  onRetry,
}: {
  state: SaveState
  onRetry?: () => void
}) {
  const bad = state === "invalid" || state === "conflict" || state === "error"
  return (
    <div className="flex items-center gap-2">
      <p
        role="status"
        aria-live="polite"
        aria-label={`Save status: ${LABELS[state]}`}
        data-save-state={state}
        className={cn(
          "inline-flex h-9 max-w-full items-center gap-2 rounded-full bg-card px-3.5 text-[13px] font-medium text-muted-foreground",
          bad && "text-danger"
        )}
      >
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", DOT[state])}
        />
        <span className="truncate">{LABELS[state]}</span>
      </p>
      {state === "error" && onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full bg-card px-3"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  )
}
```

(The label stays exactly "Saved" — `tests/e2e/page-editor.spec.ts` asserts `toHaveText("Saved")`; JW's "Saved 2 s ago" suffix is not adopted.)

`components/admin/editor/versioned-editor.tsx`:
- imports: `import { EditorLayout } from "./editor-layout"` (drop `statusLabel`); add `import { FORM_ACTION, PRIMARY_ACTION } from "@/components/admin/page-header"` and `import { cn } from "@/lib/utils"`.
- `VersionedEditorProps`: add `/** Public path shown in the header (e.g. "/services/x"). */ path?: string`.
- `<EditorLayout …>`: `status={{ published: record.published, dirty: autosave.dirty || record.dirty }}` and add `path={props.path}`.
- History `Button`: drop `size="sm"`, add `className={cn(FORM_ACTION, "h-12 bg-card")}`.
- Preview `<a>`: className → `"inline-flex h-12 items-center gap-2 rounded-xl border bg-card px-5 text-[15px] font-semibold transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"`.
- Publish `Button`: drop `size="sm"`, add `className={PRIMARY_ACTION}`.

`components/admin/pages/page-editor.tsx`: add `path={PAGE_PATHS[pageKey]}` to `<VersionedEditor …>`.
`components/admin/services/service-editor.tsx`: add `path={record.data ? \`/services/${record.data.slug}\` : undefined}`.

`components/admin/schema-form/widgets/structure.tsx`: the group card `className="flex flex-col gap-5 rounded-xl border bg-card p-4 shadow-xs sm:p-6"` → `className="rounded-card flex flex-col gap-5 bg-card p-5 sm:p-6"`; its `<h2 … className="text-base font-bold">` → `className="text-card-title"`; the sortable list item `bg-background` → `bg-card`.

Settings overview still imports `statusLabel` until Task 9: in `components/admin/settings/settings-overview.tsx` replace the `statusLabel(...)` call and its `<Badge variant={status.variant}>{status.text}</Badge>` with `<ContentStatusPills record={{ published: item.status === "published" ? true : null, dirty: item.dirty }} />` (import from `@/components/admin/kit/content-status`), and drop the `statusLabel` import (Task 9 restyles the rest of this file).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/editor-layout.test.tsx tests/dom/versioned-editor.test.tsx tests/dom/settings-editor.test.tsx tests/dom/services-screens.test.tsx tests/dom/schema-form.test.tsx tests/dom/schema-form-lists.test.tsx`
Expected: PASS (editor-layout 6 tests; the others unchanged).

Run: `pnpm lint && pnpm typecheck && grep -rn "statusLabel" components app`
Expected: clean; grep prints nothing.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/editor components/admin/pages/page-editor.tsx components/admin/services/service-editor.tsx components/admin/schema-form/widgets/structure.tsx components/admin/settings/settings-overview.tsx tests/dom/editor-layout.test.tsx tests/dom/versioned-editor.test.tsx
git add components/admin/editor components/admin/pages/page-editor.tsx components/admin/services/service-editor.tsx components/admin/schema-form/widgets/structure.tsx components/admin/settings/settings-overview.tsx tests/dom/editor-layout.test.tsx tests/dom/versioned-editor.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): JW page-builder header for every versioned editor

Back link, 36 px title, public path and status pills; save-state pill
with a coloured dot; History/Preview/Publish in the 48 px button
language; form groups as white cards. The bar stays sticky in the
content panel, which keeps scroll padding below it (WCAG 2.4.11).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Live preview pane in the editors (master Task 4.4, JW page-builder pane 3)

**Files:**
- Create: `components/admin/editor/preview-pane.tsx`, `hooks/use-media-query.ts`
- Modify: `components/admin/editor/versioned-editor.tsx` (pass `preview`)
- Test: `tests/dom/preview-pane.test.tsx`

**Interfaces:**
- Consumes: Task 7 `EditorLayout` `preview` slot (rendered from 2xl, sticky under the editor bar); `previewHref(entity, id)` (`lib/schemas/api/preview.ts`, signed-in route that enables draft mode and redirects to the public URL — same origin, `sec-fetch-site: same-origin` for an iframe opened by the admin); `ToggleGroup`/`ToggleGroupItem` (Task 1); `Spinner` (`components/ui/spinner.tsx`).
- Produces:

```ts
// components/admin/editor/preview-pane.tsx
export const PREVIEW_DEVICES: { desktop: 1440; tablet: 834; phone: 390 }
export function PreviewPane(props: { src: string; refreshKey: number; className?: string }): JSX.Element
// hooks/use-media-query.ts
export function useMediaQuery(query: string): boolean   // server snapshot: false
```

The pane is **only mounted from 2xl** (`useMediaQuery("(min-width: 1536px)")`), never merely hidden: a hidden iframe would still load the preview route and switch on draft mode for the session on every editor visit (it would also break `tests/e2e/page-editor.spec.ts`, which checks the public page before publishing). Opening an editor at ≥ 1536 px enables draft mode for this signed-in user, exactly as clicking Preview does (ledger ruling: preview cookie bound to the user).

- [ ] **Step 1: Write the failing test**

`tests/dom/preview-pane.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { PreviewPane } from "@/components/admin/editor/preview-pane"
import { useMediaQuery } from "@/hooks/use-media-query"

const SRC = "/api/v1/admin/preview?entity=page&id=home"

describe("PreviewPane (JW live preview)", () => {
  it("frames the draft preview with a title and a new-tab link", () => {
    render(<PreviewPane src={SRC} refreshKey={1} />)
    const region = screen.getByRole("region", { name: "Live preview" })
    const frame = within(region).getByTitle("Page preview")
    expect(frame.tagName).toBe("IFRAME")
    expect(frame).toHaveAttribute("src", SRC)
    expect(
      within(region).getByRole("link", { name: "Open the preview in a new tab" })
    ).toHaveAttribute("href", SRC)
  })

  it("switches the frame width by device", async () => {
    const user = userEvent.setup()
    render(<PreviewPane src={SRC} refreshKey={1} />)
    const frame = screen.getByTitle("Page preview")
    expect(frame.style.width).toBe("1440px")
    await user.click(screen.getByRole("button", { name: "Phone" }))
    expect(frame.style.width).toBe("390px")
    await user.click(screen.getByRole("button", { name: "Tablet" }))
    expect(frame.style.width).toBe("834px")
  })

  it("reloads the frame when the saved version changes, not on mount", () => {
    const { rerender } = render(<PreviewPane src={SRC} refreshKey={1} />)
    const frame = screen.getByTitle("Page preview") as HTMLIFrameElement
    fireEvent.load(frame)
    const reload = vi.fn()
    Object.defineProperty(frame, "contentWindow", {
      configurable: true,
      value: { location: { reload } },
    })
    rerender(<PreviewPane src={SRC} refreshKey={1} />)
    expect(reload).not.toHaveBeenCalled()
    rerender(<PreviewPane src={SRC} refreshKey={2} />)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText("Refreshing")).toBeInTheDocument()
  })
})

describe("useMediaQuery", () => {
  it("follows matchMedia (false on the server snapshot)", () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query === "(min-width: 1536px)",
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList
    )
    function Probe() {
      return <p>{useMediaQuery("(min-width: 1536px)") ? "wide" : "narrow"}</p>
    }
    render(<Probe />)
    expect(screen.getByText("wide")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --project dom tests/dom/preview-pane.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/editor/preview-pane"`.

- [ ] **Step 3: Implement**

`components/admin/editor/preview-pane.tsx`:

```tsx
"use client"

import { ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export const PREVIEW_DEVICES = { desktop: 1440, tablet: 834, phone: 390 } as const
type Device = keyof typeof PREVIEW_DEVICES

/**
 * The public site in draft mode, scaled to the pane (JW page builder).
 * `refreshKey` is the saved draft version: each autosave reloads the frame
 * (same origin, so the reload keeps its scroll position).
 */
export function PreviewPane({
  src,
  refreshKey,
  className,
}: {
  src: string
  refreshKey: number
  className?: string
}) {
  const [device, setDevice] = useState<Device>("desktop")
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [loading, setLoading] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const shownKey = useRef(refreshKey)
  const width = PREVIEW_DEVICES[device]
  const scale = box.width ? Math.min(1, box.width / width) : 1

  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setBox({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (shownKey.current === refreshKey) return
    shownKey.current = refreshKey
    const win = frame.current?.contentWindow
    if (!win) return
    setLoading(true)
    win.location.reload()
  }, [refreshKey])

  return (
    <section
      aria-label="Live preview"
      className={cn(
        "rounded-card flex min-w-0 flex-col gap-4 bg-card p-4 sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-card-title flex items-center gap-2">
          Preview
          {loading ? (
            <Spinner aria-label="Refreshing" className="size-4 text-primary" />
          ) : null}
        </h2>
        <div className="flex items-center gap-2">
          <ToggleGroup
            value={[device]}
            onValueChange={(value) =>
              value[0] && setDevice(value[0] as Device)
            }
            aria-label="Preview size"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="desktop" aria-label="Desktop">
              <Monitor aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="tablet" aria-label="Tablet">
              <Tablet aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="phone" aria-label="Phone">
              <Smartphone aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            aria-label="Open the preview in a new tab"
            className="flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>
      </div>
      <div
        ref={boxRef}
        className="relative h-[calc(var(--content-h,80svh)-var(--editor-bar-h,9rem)-6rem)] min-h-[28rem] overflow-hidden rounded-xl bg-muted"
      >
        <iframe
          ref={frame}
          title="Page preview"
          src={src}
          onLoad={() => setLoading(false)}
          className={cn(
            "absolute top-0 border-0 bg-white transition-opacity",
            box.width === 0 && "opacity-0",
            scale === 1 && device !== "desktop" && "shadow-lg"
          )}
          style={{
            width,
            height: box.height ? box.height / scale : "100%",
            left: Math.max(0, (box.width - width * scale) / 2),
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </section>
  )
}
```

`hooks/use-media-query.ts`:

```ts
"use client"

import { useCallback, useSyncExternalStore } from "react"

/** True while `query` matches (the server and first hydration render say false). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener("change", onChange)
      return () => media.removeEventListener("change", onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}
```

`components/admin/editor/versioned-editor.tsx`: add `import { PreviewPane } from "./preview-pane"` and `import { useMediaQuery } from "@/hooks/use-media-query"`; in the function that declares `const [base, setBase] = useState(…)`, directly after that declaration, add `const wide = useMediaQuery("(min-width: 1536px)")`, and pass to `<EditorLayout …>`:

```tsx
        preview={
          props.previewHref && wide ? (
            <PreviewPane src={props.previewHref} refreshKey={base.version} />
          ) : undefined
        }
```

(The "Preview" button keeps opening the same URL in a new tab — below 2xl that is the only preview; JW shows the pane from xl, see deviation D9.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/preview-pane.test.tsx tests/dom/versioned-editor.test.tsx tests/dom/settings-editor.test.tsx tests/dom/services-screens.test.tsx`
Expected: PASS (preview-pane 4 tests; the rest unchanged — jsdom's `matchMedia` stub never matches, so editors render no pane there).

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Check it in a browser (Playwright lock)**

Run: `pnpm test:e2e tests/e2e/page-editor.spec.ts`
Expected: PASS (autosave → Saved → publish flow unchanged; at the e2e viewport 1440 no pane is mounted, so no draft-mode cookie is set behind the spec's back).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write components/admin/editor/preview-pane.tsx components/admin/editor/versioned-editor.tsx hooks/use-media-query.ts tests/dom/preview-pane.test.tsx
git add components/admin/editor/preview-pane.tsx components/admin/editor/versioned-editor.tsx hooks/use-media-query.ts tests/dom/preview-pane.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): live draft preview beside the editor (2xl)

The public page in draft mode in a scaled frame with desktop, tablet
and phone sizes, reloaded after every autosave; a new-tab link stays
for smaller screens.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Settings overview, Account and panel states in the JW pattern (master Tasks 4.5 / 2.6 restyle)

**Files:**
- Modify: `components/admin/settings/settings-overview.tsx` (cards, states), `app/(admin)/admin/(panel)/settings/page.tsx` (PageHeader stays), `app/(admin)/admin/(panel)/account/page.tsx` (full rewrite), `app/(admin)/admin/forbidden.tsx`, `app/(admin)/admin/not-found.tsx`
- Create: `components/admin/account/theme-preference.tsx`, `app/(admin)/admin/(panel)/error.tsx`
- Delete: `components/admin/account/account-section.tsx` (replaced by `DashboardCard`)
- Test: `tests/dom/account-and-states.test.tsx` (new), `tests/e2e/account.spec.ts` (tab names)

**Interfaces:**
- Consumes: Task 2 `PageHeader`, `DashboardCard`, `EmptyState`, `StatusPill`, `ContentStatusPills`, `CardSkeleton`, `FORM_ACTION`; Task 5 `SectionTabs` (`heading`); Task 1 `ToggleGroup`, `AdminThemeProvider`; existing `ProfileForm`, `ChangePasswordForm`, `TwoFactorSettings`, `SessionsList`.
- Produces:

```ts
// components/admin/account/theme-preference.tsx
export function ThemePreference(): JSX.Element     // ToggleGroup "Theme": Light | Dark | System
// app/(admin)/admin/(panel)/error.tsx
export default function PanelError(props: { error: Error & { digest?: string }; retry: () => void }): JSX.Element
// Account tabs (?tab=): profile ("Profile": Profile + Appearance), security ("Security": Password + Two-factor), sessions ("Devices")
```

- [ ] **Step 1: Write the failing tests**

`tests/dom/account-and-states.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import PanelError from "@/app/(admin)/admin/(panel)/error"
import { ThemePreference } from "@/components/admin/account/theme-preference"
import { AdminThemeProvider } from "@/components/admin/theme-provider"

describe("ThemePreference", () => {
  it("chooses light, dark or system for the admin", async () => {
    const user = userEvent.setup()
    render(
      <AdminThemeProvider defaultTheme="system">
        <ThemePreference />
      </AdminThemeProvider>
    )
    const group = await screen.findByRole("group", { name: "Theme" })
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent?.trim())
    ).toEqual(["Light", "Dark", "System"])
    await user.click(within(group).getByRole("button", { name: "Dark" }))
    expect(localStorage.getItem("sp-admin-theme")).toBe("dark")
    expect(within(group).getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })
})

describe("panel error boundary", () => {
  it("says what happened, shows the digest and retries", async () => {
    const retry = vi.fn()
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(
      <PanelError
        error={Object.assign(new Error("boom"), { digest: "abc123" })}
        retry={retry}
      />
    )
    const alert = screen.getByRole("alert")
    expect(within(alert).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Something went wrong"
    )
    expect(alert).toHaveTextContent("abc123")
    expect(alert).not.toHaveTextContent("boom")
    await user.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalled()
    spy.mockRestore()
  })
})
```

`tests/e2e/account.spec.ts`: replace `sections.getByRole("tab", { name: "Sessions" })` with `sections.getByRole("tab", { name: "Devices" })` (the URL stays `?tab=sessions`) and `sections.getByRole("tab", { name: "Two-factor" })` with `sections.getByRole("tab", { name: "Security" })`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/account-and-states.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/(admin)/admin/(panel)/error"`.

- [ ] **Step 3: Implement**

`components/admin/account/theme-preference.tsx`:

```tsx
"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const subscribe = () => () => {}

/**
 * The admin theme. The saved choice only exists in the browser, so this
 * renders after mount (server and client never disagree on the pressed item).
 */
export function ThemePreference() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const { theme, setTheme } = useTheme()
  if (!mounted) return <Skeleton className="h-9 w-64 bg-skeleton" />
  return (
    <ToggleGroup
      aria-label="Theme"
      value={[theme ?? "system"]}
      onValueChange={(value) => {
        if (value[0]) setTheme(String(value[0]))
      }}
      variant="outline"
    >
      <ToggleGroupItem value="light">
        <Sun aria-hidden /> Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <Moon aria-hidden /> Dark
      </ToggleGroupItem>
      <ToggleGroupItem value="system">
        <Monitor aria-hidden /> System
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
```

`app/(admin)/admin/(panel)/account/page.tsx` (full file):

```tsx
import { Eye } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { ChangePasswordForm } from "@/components/admin/account/change-password-form"
import { ProfileForm } from "@/components/admin/account/profile-form"
import { SessionsList } from "@/components/admin/account/sessions-list"
import { ThemePreference } from "@/components/admin/account/theme-preference"
import { TwoFactorSettings } from "@/components/admin/account/two-factor-settings"
import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { PageHeader } from "@/components/admin/page-header"
import {
  SectionTabs,
  SectionTabsPanel,
} from "@/components/admin/section-tabs/section-tabs"
import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Account" }

// JW account: Profile (+ Appearance), Security (Password + 2FA), Devices.
const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "sessions", label: "Devices" },
]

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <Account />
    </Suspense>
  )
}

async function Account() {
  const { user, session } = await requireSession()
  if (session.impersonatedBy)
    return (
      <>
        <PageHeader title="Account" description={user.email} />
        <EmptyState
          icon={Eye}
          title={`You're viewing as ${user.name}`}
          description="Their profile, password and devices can only be changed by them. Stop impersonating to manage your own account."
        />
      </>
    )
  return (
    <>
      <PageHeader title="Account" description={user.email} />
      <SectionTabs ariaLabel="Account sections" heading="Account" items={TABS}>
        <SectionTabsPanel id="profile">
          <div className="grid gap-4 xl:grid-cols-2">
            <DashboardCard title="Profile">
              <p className="-mt-3 text-sm text-muted-foreground">
                Your name and job title appear on articles you write.
              </p>
              <ProfileForm
                name={user.name}
                email={user.email}
                title={user.title}
              />
            </DashboardCard>
            <DashboardCard title="Appearance">
              <p className="-mt-3 text-sm text-muted-foreground">
                Light, dark, or follow this device. Only the admin changes.
              </p>
              <ThemePreference />
            </DashboardCard>
          </div>
        </SectionTabsPanel>
        <SectionTabsPanel id="security">
          <div className="grid gap-4 xl:grid-cols-2">
            <DashboardCard title="Password">
              <p className="-mt-3 text-sm text-muted-foreground">
                Changing your password signs out your other devices.
              </p>
              <ChangePasswordForm />
            </DashboardCard>
            <DashboardCard title="Two-factor authentication">
              <p className="-mt-3 text-sm text-muted-foreground">
                A code from your phone in addition to your password.
              </p>
              <TwoFactorSettings enabled={user.twoFactorEnabled} />
            </DashboardCard>
          </div>
        </SectionTabsPanel>
        <SectionTabsPanel id="sessions">
          <DashboardCard title="Signed-in devices">
            <p className="-mt-3 text-sm text-muted-foreground">
              Where your account is signed in. Sign out anything you do not
              recognise.
            </p>
            <SessionsList currentSessionId={session.id} />
          </DashboardCard>
        </SectionTabsPanel>
      </SectionTabs>
    </>
  )
}
```

`git rm components/admin/account/account-section.tsx` (no other importers: `grep -rn "account-section" components app` must be empty after this edit).

`components/admin/settings/settings-overview.tsx`:
- Loading block → `<div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"><span className="sr-only">Loading settings…</span>{Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} className="h-32" />)}</div>` (import `CardSkeleton`; drop `Skeleton`).
- Error block → `<EmptyState role="alert" title="Settings didn't load" description={errorMessage(list.error)} action={<Button type="button" className={FORM_ACTION} onClick={() => list.refetch()}>Try again</Button>} />` (import `EmptyState`, `FORM_ACTION`).
- Group heading `className` → `"px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"`; the list `className` → `"grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"`.
- Card `Link` className → `"rounded-card flex h-full flex-col gap-2 bg-card p-5 transition-shadow outline-none hover:ring-1 hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50"`; label span → `text-card-title`; the "Read only" `Badge` → `<StatusPill tone="neutral">Read only</StatusPill>` (import `StatusPill`; drop `Badge`). The status uses `ContentStatusPills` already (Task 7).

`app/(admin)/admin/(panel)/error.tsx`:

```tsx
"use client"

import { useEffect } from "react"

import { FORM_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"

/** Error boundary inside the shell (spec §8.2): retry re-renders the segment. */
export default function PanelError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
    >
      <h1 className="text-card-title">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This part of the admin didn&apos;t load. Nothing you saved is lost.
        {error.digest ? (
          <>
            {" "}
            Reference <code className="font-mono">{error.digest}</code>.
          </>
        ) : null}
      </p>
      <Button type="button" className={FORM_ACTION} onClick={() => retry()}>
        Try again
      </Button>
    </section>
  )
}
```

`app/(admin)/admin/not-found.tsx` (full file):

```tsx
import Link from "next/link"

import { LINK_FORM } from "@/components/admin/page-header"

/** 404 for /admin/* (admin root layout, not the public site's). */
export default function AdminNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <section className="rounded-card flex max-w-md flex-col items-center gap-4 bg-sidebar px-8 py-12 text-center">
        <h1 className="text-card-title">That page doesn&apos;t exist</h1>
        <p className="text-sm text-muted-foreground">
          Check the address, or go back to the dashboard and use the menu.
        </p>
        <Link href="/admin" className={LINK_FORM}>
          Back to the dashboard
        </Link>
      </section>
    </main>
  )
}
```

`app/(admin)/admin/forbidden.tsx` (full file):

```tsx
import Link from "next/link"

import { LINK_FORM } from "@/components/admin/page-header"

/** Rendered (403) when requirePermission() calls forbidden(). */
export default function Forbidden() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <section className="rounded-card flex max-w-md flex-col items-center gap-4 bg-sidebar px-8 py-12 text-center">
        <h1 className="text-card-title">
          You do not have access to this page
        </h1>
        <p className="text-sm text-muted-foreground">
          Your role does not include this area. Ask an owner or administrator
          if you need it.
        </p>
        <Link href="/admin" className={LINK_FORM}>
          Back to the dashboard
        </Link>
      </section>
    </main>
  )
}
```

Run `grep -rn "Page not found\|You do not have access" tests` — update any assertion on the old 404 heading text "Page not found" to "That page doesn't exist" (the 403 heading is unchanged).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/account-and-states.test.tsx tests/dom/settings-editor.test.tsx tests/dom/section-tabs.test.tsx`
Expected: PASS (account-and-states 2 tests).

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

Run (Playwright lock): `pnpm test:e2e tests/e2e/account.spec.ts tests/e2e/admin-auth.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/account components/admin/settings/settings-overview.tsx "app/(admin)/admin/(panel)/account/page.tsx" "app/(admin)/admin/(panel)/error.tsx" "app/(admin)/admin/not-found.tsx" "app/(admin)/admin/forbidden.tsx" tests/dom/account-and-states.test.tsx tests/e2e/account.spec.ts
git add components/admin/account components/admin/settings/settings-overview.tsx "app/(admin)/admin/(panel)/account/page.tsx" "app/(admin)/admin/(panel)/error.tsx" "app/(admin)/admin/not-found.tsx" "app/(admin)/admin/forbidden.tsx" tests/dom/account-and-states.test.tsx tests/e2e/account.spec.ts
git commit -m "$(cat <<'EOF'
feat(admin): JW account, settings overview and panel states

Account in three tabs (Profile with appearance, Security, Devices) of
white cards; settings keys as cards with status pills; a panel error
boundary with retry; 404 and 403 in the admin's language.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Auth pages in the JW split layout (master Task 2.5 restyle)

**Files:**
- Modify: `app/(admin)/admin/(auth)/layout.tsx` (full rewrite), `components/admin/auth/auth-card.tsx` (full rewrite; same props, used by all 15 auth call sites)
- Test: `tests/dom/auth-layout.test.tsx`

**Interfaces:**
- Consumes: Task 2 `Swirl`, `NOISE`; Task 4 `BrandMark` (`tone="inverse"` on the navy panel); Task 1 `bg-hero`.
- Produces: `AuthLayout` (default export, unchanged route), `AuthCard({ title, description, children })` (unchanged signature; renders a JW `AuthHeader` block, not a shadcn Card).

- [ ] **Step 1: Write the failing test**

`tests/dom/auth-layout.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

// next/image renders a plain <img> in jsdom (the shell tests rely on it too).
import AuthLayout from "@/app/(admin)/admin/(auth)/layout"
import { AuthCard } from "@/components/admin/auth/auth-card"

describe("auth split layout (JW)", () => {
  it("brand panel (decorative) beside the form panel", () => {
    render(
      <AuthLayout>
        <AuthCard title="Sign in" description="Use your admin account.">
          <form aria-label="Sign in form">
            <input aria-label="Email" data-slot="input" />
            <button type="submit">Sign in</button>
          </form>
        </AuthCard>
      </AuthLayout>
    )
    const main = screen.getByRole("main")
    const brand = main.querySelector('[data-slot="auth-brand"]') as HTMLElement
    expect(brand).toHaveAttribute("aria-hidden", "true")
    expect(brand).toHaveClass("bg-hero", "hidden", "lg:flex")
    expect(brand).toHaveTextContent("Your website, securely under control.")
    const panel = main.querySelector('[data-slot="auth-panel"]') as HTMLElement
    expect(panel).toHaveClass("rounded-[28px]", "bg-sidebar")
    expect(within(panel).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sign in"
    )
    expect(panel).toHaveTextContent("Access is by invitation only.")
    // 44 px, rounded-xl controls inside the form panel.
    expect(panel.className).toContain("[&_[data-slot=input]]:h-11")
    expect(panel.className).toContain("[&_button[type=submit]]:h-11")
  })

  it("AuthCard: large title and description, no card chrome", () => {
    render(
      <AuthCard title="Two-step check" description="Enter the code.">
        <p>Form</p>
      </AuthCard>
    )
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1).toHaveClass("text-[2rem]")
    expect(screen.getByText("Enter the code.")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="card"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --project dom tests/dom/auth-layout.test.tsx`
Expected: FAIL — no `[data-slot="auth-brand"]`; AuthCard renders `[data-slot="card"]`.

- [ ] **Step 3: Implement**

`app/(admin)/admin/(auth)/layout.tsx` (full file):

```tsx
import { NOISE } from "@/components/admin/kit/noise"
import { Swirl } from "@/components/admin/kit/swirl"
import { BrandMark } from "@/components/admin/shell/brand-mark"

/**
 * Split layout (JW): navy brand panel left, form panel right. Below
 * 1024 px only the form panel shows. Controls in the form panel are 44 px
 * and rounded-xl.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="grid min-h-svh gap-4 bg-background p-3 sm:p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section
        aria-hidden
        data-slot="auth-brand"
        className="bg-hero relative isolate hidden flex-col justify-between overflow-hidden rounded-[28px] p-10 lg:flex xl:p-12"
      >
        <Swirl className="absolute inset-0 -z-10 size-full" />
        <div
          className="absolute inset-0 -z-10 opacity-[0.12] mix-blend-overlay"
          style={{ backgroundImage: NOISE }}
        />
        <div className="absolute -top-32 -left-24 -z-10 size-96 rounded-full bg-brand-green/25 blur-3xl" />
        <BrandMark tone="inverse" />
        <div className="flex max-w-lg flex-col gap-5">
          <p className="text-[2.5rem] leading-[1.1] font-bold tracking-tight text-balance">
            Your website, securely under control.
          </p>
          <p className="text-[15px] leading-relaxed text-white/75">
            Pages, services, team and settings in one calm place, with every
            change saved as a draft until you publish.
          </p>
          <ul className="flex flex-wrap gap-2 pt-2 text-[13px] font-medium">
            {["Pages", "Services", "Team", "Settings"].map((item) => (
              <li
                key={item}
                className="rounded-full bg-white/10 px-3.5 py-1.5 ring-1 ring-white/15 backdrop-blur-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section
        data-slot="auth-panel"
        className="flex flex-col rounded-[28px] bg-sidebar px-6 py-8 sm:px-10 lg:px-12 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-xl [&_[data-slot=input]]:bg-card [&_[data-slot=input]]:px-3.5 [&_button[type=submit]]:h-11 [&_button[type=submit]]:w-full [&_button[type=submit]]:rounded-xl [&_button[type=submit]]:font-semibold"
      >
        <BrandMark className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Access is by invitation only. Ask an owner if you need an account.
        </p>
      </section>
    </main>
  )
}
```

`components/admin/auth/auth-card.tsx` (full file):

```tsx
import type { ReactNode } from "react"

/** Title block + form for every admin auth page (JW AuthHeader). */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      {children}
    </div>
  )
}
```

(The `<header>` inside `<main>` is not a banner landmark. `BrandMark` on the navy panel is decorative there — the section is `aria-hidden`; on phones the form panel's `BrandMark` shows the logo with `alt=""` beside the visible name "Security Partners".)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/auth-layout.test.tsx`
Expected: PASS (2 tests).

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

Run (Playwright lock): `pnpm test:e2e tests/e2e/admin-auth.spec.ts`
Expected: PASS (labels, button names and headings unchanged).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write "app/(admin)/admin/(auth)/layout.tsx" components/admin/auth/auth-card.tsx tests/dom/auth-layout.test.tsx
git add "app/(admin)/admin/(auth)/layout.tsx" components/admin/auth/auth-card.tsx tests/dom/auth-layout.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): JW split sign-in layout in Security Partners navy

Decorative navy brand panel with swirl and noise beside a grey form
panel; large auth titles; 44 px rounded controls.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Dashboard in the JW layout (master Task 4.7 UI — runs after phase-04 Task 11)

**Prerequisite:** phase-04 Task 11 committed (`lib/schemas/api/dashboard.ts` `DashboardDto`/`NextUpItem`, `GET /api/v1/admin/dashboard` mounted as `api.dashboard`). This task replaces that task's UI files; its server module, DTO and integration tests stay as they are.

**Files:**
- Create: `lib/admin/activity.ts`, `components/admin/dashboard/present.ts`, `components/admin/dashboard/dashboard-skeleton.tsx`, `components/admin/shell/site-context.tsx`
- Modify (full rewrite): `components/admin/dashboard/dashboard.tsx`, `components/admin/dashboard/next-up.tsx`, `app/(admin)/admin/(panel)/page.tsx`; `components/admin/shell/admin-shell.tsx` (provide `SiteInfo`)
- Delete: `components/admin/dashboard/kpi-card.tsx`, `components/admin/dashboard/leads-chart.tsx` (kit replaces them)
- Test: `tests/unit/admin/activity.test.ts`, `tests/unit/admin/dashboard-present.test.ts`, `tests/dom/dashboard.test.tsx` (full rewrite)
- Modify (greeting): `tests/e2e/fixtures.ts` (`greeting()`), `tests/e2e/admin-auth.spec.ts`, `tests/e2e/account.spec.ts`, `tests/e2e/page-editor.spec.ts`, `tests/visual/admin-shell.spec.ts`

**Interfaces:**
- Consumes: `DashboardDto`, `NextUpItem` (phase-04 Task 11); `GET /api/v1/admin/audit?pageSize=6` (`AuditItem`, `audit:read`, newest first by default); Task 2 kit (`PageHeader`, `LINK_PRIMARY`, `LINK_SECONDARY`, `PRIMARY_ACTION`, `KpiCard`, `PillBarChart`, `DashboardCard`, `ActivityFeed`, `EmptyState`, `KpiRowSkeleton`, `CardSkeleton`, `formatNumber`); `usePermission`; `SETTINGS_ENTRIES` (`lib/admin/settings-keys.ts`).
- Produces:

```ts
// lib/admin/activity.ts (isomorphic; phase-04 Task 12's audit screen reuses it)
export type ActivitySummary = { text: string; status?: { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" } }
export function describeActivity(item: { action: string; entityType: string | null; entityId: string | null }): ActivitySummary
// components/admin/dashboard/present.ts
export function greetingFor(date: Date): "Good morning" | "Good afternoon" | "Good evening"   // Europe/Dublin
export const firstName: (name: string) => string
export function weeklyBuckets(trend: readonly { date: string; count: number }[]): PillBarDatum[]  // 7-day buckets, newest last
// components/admin/shell/site-context.tsx
export function SiteInfoProvider(props: { value: SiteInfo; children: ReactNode }): JSX.Element
export function useSiteInfo(): SiteInfo
// components/admin/dashboard/dashboard.tsx
export function Dashboard(props: { firstName: string; renderedAt: string }): JSX.Element
// components/admin/dashboard/next-up.tsx
export function NextUp(props: { items: NextUpItem[] }): JSX.Element
// tests/e2e/fixtures.ts
export function greeting(name: string): RegExp   // /^Good (morning|afternoon|evening), <first name>$/
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/activity.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { describeActivity } from "@/lib/admin/activity"

const row = (action: string, entityType: string | null = null, entityId: string | null = null) => ({
  action,
  entityType,
  entityId,
})

describe("describeActivity", () => {
  it.each([
    [row("page.published", "page", "home"), "published the home page", "Published", "success"],
    [row("page.draft_saved", "page", "about"), "saved a draft of the about page", "Draft", "neutral"],
    [row("settings.published", "settings", "footer"), "published Footer settings", "Published", "success"],
    [row("service.created", "service", "x"), "added a service", undefined, undefined],
    [row("team.deleted", "team", "x"), "deleted a team member", undefined, undefined],
    [row("clients.reordered", "clients", null), "reordered clients", undefined, undefined],
    [row("auth.sign_in"), "signed in", "Signed in", "success"],
    [row("auth.sign_in_failed"), "failed to sign in", "Failed", "danger"],
    [row("user.invite", "user", "u2"), "invited a user", "Invited", "info"],
    [row("user.ban", "user", "u2"), "banned a user", "Banned", "danger"],
  ])("%o → %s", (item, text, label, tone) => {
    const summary = describeActivity(item)
    expect(summary.text).toBe(text)
    expect(summary.status?.label).toBe(label)
    expect(summary.status?.tone).toBe(tone)
  })

  it("falls back to the raw action", () => {
    expect(describeActivity(row("something.odd")).text).toBe("something.odd")
  })
})
```

`tests/unit/admin/dashboard-present.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  firstName,
  greetingFor,
  weeklyBuckets,
} from "@/components/admin/dashboard/present"

describe("dashboard presenters", () => {
  it("greets by the clock in Ireland", () => {
    expect(greetingFor(new Date("2026-10-16T08:30:00Z"))).toBe("Good morning") // 09:30 IST
    expect(greetingFor(new Date("2026-10-16T12:00:00Z"))).toBe("Good afternoon")
    expect(greetingFor(new Date("2026-12-16T18:30:00Z"))).toBe("Good evening") // 18:30 GMT
  })

  it("uses the first name", () => {
    expect(firstName("Edith Mary Editor")).toBe("Edith")
    expect(firstName("  ")).toBe("there")
  })

  it("folds 90 days into 13 weekly pills, newest last", () => {
    const trend = Array.from({ length: 90 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 6, 19 + i)).toISOString().slice(0, 10),
      count: i === 89 ? 4 : i === 80 ? 3 : 0,
    }))
    const weeks = weeklyBuckets(trend)
    expect(weeks).toHaveLength(13)
    expect(weeks.at(-1)).toEqual({
      key: "2026-10-10",
      label: "10 Oct",
      current: 4,
    })
    expect(weeks.at(-2)!.current).toBe(3)
    expect(weeks.reduce((sum, w) => sum + w.current, 0)).toBe(7)
    expect(weeks[0]!.key).toBe("2026-07-19")
  })
})
```

`tests/dom/dashboard.test.tsx` (full file):

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))

import { Dashboard } from "@/components/admin/dashboard/dashboard"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import { SiteInfoProvider } from "@/components/admin/shell/site-context"
import type { Role } from "@/lib/auth/roles"
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
      description: "So enquiries and invites reach people.",
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

const audit = {
  items: [
    {
      id: "a1",
      action: "page.published",
      entityType: "page",
      entityId: "home",
      actor: { id: "u1", name: "Edith Editor", email: "e@example.test" },
      impersonatorId: null,
      ip: null,
      userAgent: null,
      diff: null,
      createdAt: "2026-10-16T10:00:00Z",
    },
  ],
  page: 1,
  pageSize: 6,
  total: 1,
}

function renderDashboard(roles: Role[]) {
  return render(
    <AdminSessionProvider
      value={{
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
      <SiteInfoProvider value={{ url: "https://example.test", env: "production" }}>
        <QueryClientProvider client={makeQueryClient()}>
          <Dashboard firstName="Edith" renderedAt="2026-10-16T08:30:00Z" />
        </QueryClientProvider>
      </SiteInfoProvider>
    </AdminSessionProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://localhost").pathname
      if (path.endsWith("/dashboard")) return Response.json(dto)
      if (path.endsWith("/audit")) return Response.json(audit)
      return Response.json({ error: { code: "NOT_FOUND", message: "x" } }, { status: 404 })
    })
  )
})

describe("dashboard (JW layout)", () => {
  it("greets, offers the button pair and shows the KPI row with the hero first", async () => {
    renderDashboard(["owner"])
    expect(screen.getByTestId("greeting")).toHaveTextContent("Good morning, Edith")
    expect(screen.getByRole("link", { name: "New service" })).toHaveAttribute(
      "href",
      "/admin/services/new"
    )
    expect(
      screen.getByRole("link", { name: "View site (opens in a new tab)" })
    ).toHaveAttribute("href", "https://example.test")
    const cards = await screen.findAllByRole("article")
    expect(cards.map((c) => c.getAttribute("data-variant"))).toEqual([
      "hero",
      "default",
      "default",
      "default",
    ])
    expect(cards[0]).toHaveTextContent("New enquiries")
    expect(cards[0]).toHaveTextContent("7")
    expect(cards[2]).toHaveTextContent("22")
    expect(cards[2]).toHaveTextContent("8 pages · 6 services · 8 articles")
    expect(
      within(cards[2]).getByRole("link", { name: "Open Published content" })
    ).toHaveAttribute("href", "/admin/pages")
  })

  it("draws the 90-day trend as weekly pills with a data table", async () => {
    renderDashboard(["owner"])
    const card = await screen.findByRole("region", { name: "Enquiries, last 90 days" })
    const table = within(card).getByRole("table", { name: "Enquiries, last 90 days" })
    expect(within(table).getAllByRole("row")).toHaveLength(14)
    expect(within(table).getByRole("rowheader", { name: "10 Oct" })).toBeInTheDocument()
  })

  it("Next up: headline, checklist with states and the call to action", async () => {
    renderDashboard(["owner"])
    const next = await screen.findByRole("region", { name: "Next up" })
    expect(next).toHaveTextContent("Set up email (SMTP)")
    expect(next).toHaveTextContent("So enquiries and invites reach people.")
    const list = within(next).getByRole("list", { name: "Setup checklist" })
    expect(within(list).getByRole("link", { name: /Set up email \(SMTP\).*\(to do\)/ })).toHaveAttribute(
      "href",
      "/admin/settings"
    )
    expect(within(list).getByRole("link", { name: /two-factor.*\(done\)/ })).toBeInTheDocument()
    expect(within(next).getByRole("link", { name: "Get started" })).toHaveAttribute(
      "href",
      "/admin/settings"
    )
  })

  it("team activity for audit readers only", async () => {
    renderDashboard(["owner"])
    const feed = await screen.findByRole("region", { name: "Team activity" })
    expect(await within(feed).findByText("Edith Editor")).toBeInTheDocument()
    expect(feed).toHaveTextContent("published the home page")
  })

  it("hides what the role may not see", async () => {
    renderDashboard(["viewer"])
    await screen.findAllByRole("article")
    expect(screen.queryByRole("link", { name: "New service" })).toBeNull()
    expect(screen.queryByRole("region", { name: "Team activity" })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/admin/activity.test.ts tests/unit/admin/dashboard-present.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/admin/activity"` / `".../dashboard/present"`.

Run: `pnpm exec vitest run --project dom tests/dom/dashboard.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/shell/site-context"`.

- [ ] **Step 3: Implement**

`lib/admin/activity.ts`:

```ts
import { SETTINGS_ENTRIES, isEditableSettingsKey } from "@/lib/admin/settings-keys"

type Tone = "success" | "warning" | "danger" | "info" | "neutral"
export type ActivitySummary = { text: string; status?: { label: string; tone: Tone } }

const FIXED: Record<string, ActivitySummary> = {
  "auth.sign_in": { text: "signed in", status: { label: "Signed in", tone: "success" } },
  "auth.sign_out": { text: "signed out" },
  "auth.sign_in_failed": { text: "failed to sign in", status: { label: "Failed", tone: "danger" } },
  "auth.password_reset": { text: "reset their password" },
  "user.invite": { text: "invited a user", status: { label: "Invited", tone: "info" } },
  "user.update": { text: "updated a user" },
  "user.roles_change": { text: "changed a user's roles" },
  "user.ban": { text: "banned a user", status: { label: "Banned", tone: "danger" } },
  "user.unban": { text: "unbanned a user" },
  "user.sessions_revoke": { text: "signed out a user's devices" },
  "user.password_link": { text: "created a password link" },
  "user.owner_recover": { text: "recovered the owner account" },
  "user.impersonate_start": { text: "started viewing as another user" },
  "user.impersonate_stop": { text: "stopped viewing as another user" },
  "service.slug_changed": { text: "changed a service's address" },
}

const SINGULAR: Record<string, string> = {
  service: "a service",
  team: "a team member",
  client: "a client",
  groupCompany: "a group company",
  category: "a category",
  article: "an article",
  media: "a file",
}

const PLURAL: Record<string, string> = {
  services: "services",
  team: "the team",
  clients: "clients",
  "group-companies": "group companies",
  categories: "categories",
}

function subject(entityType: string | null, entityId: string | null): string {
  if (entityType === "page" && entityId) return `the ${entityId} page`
  if (entityType === "settings" && entityId)
    return isEditableSettingsKey(entityId)
      ? `${SETTINGS_ENTRIES[entityId].label} settings`
      : `${entityId} settings`
  return (entityType && SINGULAR[entityType]) ?? "a record"
}

/** One audit row as "who did what" words and an optional status pill. */
export function describeActivity(item: {
  action: string
  entityType: string | null
  entityId: string | null
}): ActivitySummary {
  const fixed = FIXED[item.action]
  if (fixed) return fixed
  const dot = item.action.lastIndexOf(".")
  const verb = dot === -1 ? "" : item.action.slice(dot + 1)
  const what = subject(item.entityType, item.entityId)
  switch (verb) {
    case "published":
      return { text: `published ${what}`, status: { label: "Published", tone: "success" } }
    case "draft_saved":
      return { text: `saved a draft of ${what}`, status: { label: "Draft", tone: "neutral" } }
    case "restored":
      return { text: `restored a version of ${what}` }
    case "created":
      return { text: `added ${what}` }
    case "updated":
      return { text: `edited ${what}` }
    case "deleted":
      return { text: `deleted ${what}` }
    case "reordered":
      return {
        text: `reordered ${(item.entityType && PLURAL[item.entityType]) ?? "a list"}`,
      }
    default:
      return { text: item.action }
  }
}
```

`components/admin/dashboard/present.ts`:

```ts
import type { PillBarDatum } from "@/components/admin/kit/pill-bar-chart"

const HOUR = new Intl.DateTimeFormat("en-IE", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Dublin",
})
// Trend dates are Irish calendar dates ("2026-10-10"): format them as UTC.
const DAY_MONTH = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

/** "Good morning" / "Good afternoon" / "Good evening" by the clock in Ireland. */
export function greetingFor(
  date: Date
): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(HOUR.format(date))
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export const firstName = (name: string) =>
  name.trim().split(/\s+/)[0] || "there"

/** Daily counts (oldest first) → 7-day pills ending today, newest last. */
export function weeklyBuckets(
  trend: readonly { date: string; count: number }[]
): PillBarDatum[] {
  const weeks: PillBarDatum[] = []
  for (let end = trend.length; end > 0; end -= 7) {
    const days = trend.slice(Math.max(0, end - 7), end)
    const start = days[0]!.date
    weeks.unshift({
      key: start,
      label: DAY_MONTH.format(new Date(`${start}T00:00:00Z`)),
      current: days.reduce((sum, day) => sum + day.count, 0),
    })
  }
  return weeks
}
```

(90 days → 12 full weeks plus the oldest 6-day bucket, starting `2026-07-19` in the test; the newest bucket starts `2026-10-10`.)

`components/admin/shell/site-context.tsx`:

```tsx
"use client"

import { createContext, type ReactNode, useContext } from "react"

import { DEFAULT_SITE, type SiteInfo } from "./constants"

const SiteContext = createContext<SiteInfo>(DEFAULT_SITE)

/** The public site this admin edits (configured origin + environment). */
export function SiteInfoProvider({
  value,
  children,
}: {
  value: SiteInfo
  children: ReactNode
}) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export const useSiteInfo = () => useContext(SiteContext)
```

`components/admin/shell/admin-shell.tsx`: import `SiteInfoProvider` from `./site-context` and wrap the `<main>`'s `{children}`: `<SiteInfoProvider value={site}>{children}</SiteInfoProvider>`.

`components/admin/dashboard/dashboard-skeleton.tsx`:

```tsx
import { CardSkeleton, KpiRowSkeleton } from "@/components/admin/kit/skeletons"

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <KpiRowSkeleton />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
```

`components/admin/dashboard/next-up.tsx` (full file):

```tsx
import { CircleCheck, Circle } from "lucide-react"
import Link from "next/link"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { LINK_PRIMARY } from "@/components/admin/page-header"
import type { NextUpItem } from "@/lib/schemas/api/dashboard"
import { cn } from "@/lib/utils"

/** JW "Next up": the first open step as a headline, the checklist, one CTA. */
export function NextUp({ items }: { items: NextUpItem[] }) {
  const next = items.find((item) => !item.done)
  return (
    <DashboardCard title="Next up">
      <div className="flex flex-1 flex-col justify-between gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-2xl leading-tight font-semibold text-primary">
            {next ? next.title : "You're all set"}
          </p>
          <p className="text-sm text-muted-foreground">
            {next
              ? next.description
              : "Every setup step is done. New suggestions appear here as the site grows."}
          </p>
        </div>
        {items.length > 1 ? (
          <ul aria-label="Setup checklist" className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 rounded-md text-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.done ? (
                    <CircleCheck aria-hidden className="size-4 text-success" />
                  ) : (
                    <Circle aria-hidden className="size-4 text-muted-foreground" />
                  )}
                  <span className={cn(item.done && "text-muted-foreground")}>
                    {item.title}
                  </span>
                  <span className="sr-only">
                    {item.done ? " (done)" : " (to do)"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {next ? (
          <Link href={next.href} className={LINK_PRIMARY}>
            Get started
          </Link>
        ) : null}
      </div>
    </DashboardCard>
  )
}
```

`components/admin/dashboard/dashboard.tsx` (full file):

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import Link from "next/link"

import { ActivityFeed } from "@/components/admin/kit/activity-feed"
import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { formatNumber } from "@/components/admin/kit/format"
import { KpiCard } from "@/components/admin/kit/kpi-card"
import { PillBarChart } from "@/components/admin/kit/pill-bar-chart"
import {
  LINK_PRIMARY,
  LINK_SECONDARY,
  PageHeader,
  PRIMARY_ACTION,
} from "@/components/admin/page-header"
import { useSiteInfo } from "@/components/admin/shell/site-context"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { describeActivity } from "@/lib/admin/activity"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { DashboardDto } from "@/lib/schemas/api/dashboard"
import { cn } from "@/lib/utils"

import { DashboardSkeleton } from "./dashboard-skeleton"
import { NextUp } from "./next-up"
import { greetingFor, weeklyBuckets } from "./present"

type Kpi = {
  label: string
  value: string
  caption: string
  href?: string
}

function kpisFor(dto: DashboardDto, canReadPages: boolean): Kpi[] {
  const { kpis } = dto
  const out: Kpi[] = []
  if (kpis.leads30d !== null)
    out.push({
      label: "New enquiries",
      value: formatNumber(kpis.leads30d),
      caption: "last 30 days",
    })
  if (kpis.openLeads !== null)
    out.push({
      label: "Open enquiries",
      value: formatNumber(kpis.openLeads),
      caption: "new, contacted or qualified",
    })
  if (kpis.published) {
    const { pages, services, articles } = kpis.published
    out.push({
      label: "Published content",
      value: formatNumber(pages + services + articles),
      caption: `${pages} pages · ${services} services · ${articles} articles`,
      href: canReadPages ? "/admin/pages" : undefined,
    })
  }
  if (kpis.inReview !== null)
    out.push({
      label: "Drafts in review",
      value: formatNumber(kpis.inReview),
      caption: "articles waiting for an editor",
    })
  return out
}

/** JW dashboard: greeting + button pair, KPI row, trend, Next up, team activity. */
export function Dashboard({
  firstName,
  renderedAt,
}: {
  firstName: string
  renderedAt: string
}) {
  const site = useSiteInfo()
  const canCreateService = usePermission({ service: ["create"] })
  const canReadPages = usePermission({ page: ["read"] })
  const canReadAudit = usePermission({ audit: ["read"] })
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => unwrap(api.dashboard.$get()),
    staleTime: 60_000,
  })
  const activity = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => unwrap(api.audit.$get({ query: { pageSize: "6" } })),
    enabled: canReadAudit,
    staleTime: 60_000,
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greetingFor(new Date(renderedAt))}, ${firstName}`}
        titleTestId="greeting"
        description="Here's what's happening on the website."
        actions={
          <>
            {canCreateService ? (
              <Link href="/admin/services/new" className={LINK_PRIMARY}>
                <Plus aria-hidden data-icon="inline-start" />
                New service
              </Link>
            ) : null}
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer"
              className={LINK_SECONDARY}
            >
              View site
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </>
        }
      />
      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <EmptyState
          role="alert"
          title="The dashboard didn't load"
          description={errorMessage(query.error)}
          action={
            <Button className={PRIMARY_ACTION} onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <Body
          dto={query.data}
          kpis={kpisFor(query.data, canReadPages)}
          activity={
            canReadAudit
              ? {
                  pending: activity.isPending,
                  items: activity.data?.items ?? [],
                }
              : null
          }
          now={Date.parse(renderedAt)}
        />
      )}
    </div>
  )
}

function Body({
  dto,
  kpis,
  activity,
  now,
}: {
  dto: DashboardDto
  kpis: Kpi[]
  activity: {
    pending: boolean
    items: {
      id: string
      action: string
      entityType: string | null
      entityId: string | null
      actor: { name: string | null; email: string | null } | null
      createdAt: string
    }[]
  } | null
  now: number
}) {
  const weeks = dto.leadsTrend ? weeklyBuckets(dto.leadsTrend) : null
  const quiet = weeks?.every((week) => week.current === 0) ?? false
  return (
    <>
      {/* KPI cards title themselves with h3s; keep the outline continuous. */}
      <h2 className="sr-only">Key figures</h2>
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          kpis.length > 3 ? "xl:grid-cols-4" : "xl:grid-cols-3"
        )}
      >
        {kpis.map((kpi, index) => (
          <KpiCard
            key={kpi.label}
            variant={index === 0 ? "hero" : "default"}
            {...kpi}
          />
        ))}
      </div>
      <div
        className={cn(
          "grid gap-4",
          weeks && "xl:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        {weeks ? (
          <DashboardCard title="Enquiries, last 90 days">
            <div className="relative">
              <PillBarChart
                title="Enquiries, last 90 days"
                rowHeader="Week of"
                currentLabel="Enquiries"
                data={weeks}
              />
              {quiet ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 flex h-64 flex-col items-center justify-center gap-1 text-center">
                  <p className="text-base font-semibold">No enquiries yet</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Each week&apos;s enquiries from the contact form will
                    show here.
                  </p>
                </div>
              ) : null}
            </div>
          </DashboardCard>
        ) : null}
        <NextUp items={dto.nextUp} />
      </div>
      {activity ? (
        <DashboardCard title="Team activity">
          <ActivityFeed
            label="Team activity list"
            now={now}
            emptyTitle={activity.pending ? "Loading activity…" : "No activity yet"}
            emptyDescription="Publishing, edits and sign-ins by your team will show here."
            entries={activity.items.map((row) => {
              const summary = describeActivity(row)
              return {
                id: row.id,
                name: row.actor?.name ?? row.actor?.email ?? "System",
                description: summary.text,
                at: row.createdAt,
                status: summary.status,
              }
            })}
          />
        </DashboardCard>
      ) : null}
    </>
  )
}
```

`app/(admin)/admin/(panel)/page.tsx` (full file):

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { Dashboard } from "@/components/admin/dashboard/dashboard"
import { DashboardSkeleton } from "@/components/admin/dashboard/dashboard-skeleton"
import { firstName } from "@/components/admin/dashboard/present"
import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Welcome />
    </Suspense>
  )
}

// The greeting depends on the time of day: request time, never the static
// shell; the client renders the same words from `renderedAt`.
async function Welcome() {
  const { user } = await requireSession()
  await connection()
  return (
    <Dashboard
      firstName={firstName(user.name)}
      renderedAt={new Date().toISOString()}
    />
  )
}
```

`git rm components/admin/dashboard/kpi-card.tsx components/admin/dashboard/leads-chart.tsx` (check `grep -rn "dashboard/kpi-card\|dashboard/leads-chart" components app tests` is empty first).

Greeting in E2E/visual — `tests/e2e/fixtures.ts`: append

```ts
/** The dashboard's h1: "Good morning, Edith" (time of day in Ireland, first name). */
export function greeting(name: string): RegExp {
  const first = name.trim().split(/\s+/)[0]
  return new RegExp(`^Good (morning|afternoon|evening), ${first}$`)
}
```

Then replace every `page.getByRole("heading", { name: \`Welcome, ${X.name}\` })` in `tests/e2e/admin-auth.spec.ts` (5) and `tests/e2e/account.spec.ts` (2) with `page.getByRole("heading", { name: greeting(X.name) })` (import `greeting` from `./fixtures`); in `tests/e2e/page-editor.spec.ts` replace `{ name: /^Welcome, / }` with `{ name: /^Good (morning|afternoon|evening), / }`; in `tests/visual/admin-shell.spec.ts` replace the `getByRole("heading", { name: \`Welcome, ${VISUAL_ADMIN.name}\` })` wait with `page.getByTestId("greeting")`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit tests/unit/admin/activity.test.ts tests/unit/admin/dashboard-present.test.ts`
Expected: PASS (11 + 3 tests).

Run: `pnpm exec vitest run --project dom tests/dom/dashboard.test.tsx`
Expected: PASS (5 tests).

Run: `pnpm test:integration tests/integration/api/dashboard.test.ts && pnpm lint && pnpm typecheck`
Expected: PASS / clean (server untouched).

Run (Playwright lock): `pnpm test:e2e && pnpm test:visual`
Expected: e2e green; visual: 40 public at 0 px; admin shell baselines unchanged (main is masked).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write lib/admin/activity.ts components/admin/dashboard components/admin/shell/site-context.tsx components/admin/shell/admin-shell.tsx "app/(admin)/admin/(panel)/page.tsx" tests/unit/admin/activity.test.ts tests/unit/admin/dashboard-present.test.ts tests/dom/dashboard.test.tsx tests/e2e/fixtures.ts tests/e2e/admin-auth.spec.ts tests/e2e/account.spec.ts tests/e2e/page-editor.spec.ts tests/visual/admin-shell.spec.ts
git add lib/admin/activity.ts components/admin/dashboard components/admin/shell/site-context.tsx components/admin/shell/admin-shell.tsx "app/(admin)/admin/(panel)/page.tsx" tests/unit/admin/activity.test.ts tests/unit/admin/dashboard-present.test.ts tests/dom/dashboard.test.tsx tests/e2e/fixtures.ts tests/e2e/admin-auth.spec.ts tests/e2e/account.spec.ts tests/e2e/page-editor.spec.ts tests/visual/admin-shell.spec.ts
git commit -m "$(cat <<'EOF'
feat(admin): JW dashboard over the Phase 4 dashboard API

"Good morning" greeting with the New service / View site pair, hero and
default KPI cards, the 90-day trend as weekly pill bars, the Next up
card and a team activity feed from the audit log for audit readers.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Admin visual baselines (light + dark) and the axe accessibility gate (master Task 4.1 acceptance, spec §15)

**Prerequisite:** 04b Tasks 1–11 and phase-04 Task 12 (Users + Audit screens, with the amendments below) committed, so the baselines and the axe run cover every Phase 4 screen.

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (`@axe-core/playwright@4.13.0`, dev, exact)
- Create: `tests/visual/admin-screens.spec.ts`, `tests/e2e/admin-a11y.spec.ts`
- Create (baselines): `tests/visual/__screenshots__/admin-{dashboard,pages,page-editor,settings,account,sign-in}-{light,dark}-{desktop,mobile}.png` (24 files)

**Interfaces:**
- Consumes: `VISUAL_ADMIN` (`tests/visual/admin-user.ts`), `clientIpFor`, `E2E_PASSWORD`, `readFixtures` (`tests/e2e/fixtures.ts`), Playwright projects `desktop` (1440×900) / `mobile` (390×844) for `visual/**`, `e2e` (1440×900) for `e2e/**`.
- Produces: 24 admin baselines; an axe gate that fails on any `serious`/`critical` WCAG 2.0–2.2 A/AA violation on the admin screens in light and dark.

- [ ] **Step 1: Add the axe dependency**

Run: `pnpm add -D --save-exact @axe-core/playwright@4.13.0`
Expected: `package.json` devDependencies gains `"@axe-core/playwright": "4.13.0"`; lockfile updated; nothing else changes (`git diff --stat` shows only those two files).

- [ ] **Step 2: Write the failing specs**

`tests/visual/admin-screens.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"

import { clientIpFor } from "../e2e/fixtures"

import { VISUAL_ADMIN } from "./admin-user"

// JW parity baselines (phase-04b Task 12): every Phase 4 admin screen in
// light and dark, desktop and phone. Relative times and the time-of-day
// greeting are masked; the dashboard's numbers are pinned with page.route;
// charts skip their grow-in under reduced motion.

test.use({ reducedMotion: "reduce" })

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(
      `visual ${testInfo.title} ${testInfo.project.name}`
    ),
  })
})

const DASHBOARD = {
  kpis: {
    leads30d: 7,
    openLeads: 3,
    published: { pages: 8, services: 6, articles: 8 },
    inReview: 2,
  },
  leadsTrend: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 6, 19 + i)).toISOString().slice(0, 10),
    count: [0, 1, 0, 2, 1, 0, 3][i % 7]!,
  })),
  nextUp: [
    {
      id: "smtp",
      title: "Set up email (SMTP)",
      description: "So enquiries and invitations reach people.",
      href: "/admin/settings",
      done: false,
    },
    {
      id: "two-factor",
      title: "Turn on two-factor authentication",
      description: "Protect the owner and admin accounts.",
      href: "/admin/account?tab=security",
      done: true,
    },
  ],
}

const AUDIT = {
  items: ["page.published", "settings.draft_saved", "auth.sign_in"].map(
    (action, i) => ({
      id: `a${i}`,
      action,
      entityType: action.startsWith("page")
        ? "page"
        : action.startsWith("settings")
          ? "settings"
          : null,
      entityId: action.startsWith("page")
        ? "home"
        : action.startsWith("settings")
          ? "footer"
          : null,
      actor: { id: "u1", name: "Vera Visual", email: VISUAL_ADMIN.email },
      impersonatorId: null,
      ip: null,
      userAgent: null,
      diff: null,
      createdAt: "2026-10-16T09:00:00Z",
    })
  ),
  page: 1,
  pageSize: 6,
  total: 3,
}

async function signIn(page: Page) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(VISUAL_ADMIN.email)
  await page.getByLabel("Password", { exact: true }).fill(VISUAL_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByTestId("greeting")).toBeVisible()
}

const masks = (page: Page) => [
  page.locator("time"),
  page.getByTestId("greeting"),
  page.locator('[data-slot="website-host"]'),
]

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme })

    test(`admin dashboard ${colorScheme}`, async ({ page }) => {
      await page.route("**/api/v1/admin/dashboard", (route) =>
        route.fulfill({ json: DASHBOARD })
      )
      await page.route("**/api/v1/admin/audit*", (route) =>
        route.fulfill({ json: AUDIT })
      )
      await signIn(page)
      await expect(
        page.getByRole("region", { name: "Team activity" })
      ).toContainText("published the home page")
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(
        `admin-dashboard-${colorScheme}.png`,
        { mask: masks(page) }
      )
    })

    test(`admin pages list ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/pages")
      await expect(page.getByRole("heading", { level: 1, name: "Pages" })).toBeVisible()
      await expect(page.getByText("Home").first()).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-pages-${colorScheme}.png`, {
        mask: masks(page),
      })
    })

    test(`admin page editor ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/pages/home")
      await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible()
      await expect(page.getByRole("status", { name: /^Save status/ })).toBeVisible()
      await expect(page).toHaveScreenshot(
        `admin-page-editor-${colorScheme}.png`,
        { mask: masks(page) }
      )
    })

    test(`admin settings ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/settings")
      await expect(
        page.getByRole("navigation", { name: "Settings" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-settings-${colorScheme}.png`, {
        mask: masks(page),
      })
    })

    test(`admin account ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/account")
      await expect(
        page.getByRole("tablist", { name: "Account sections" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-account-${colorScheme}.png`, {
        mask: masks(page),
      })
    })

    test(`admin sign-in ${colorScheme}`, async ({ page }) => {
      await page.goto("/admin/sign-in")
      await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(`admin-sign-in-${colorScheme}.png`)
    })
  })
}
```

Add `data-slot="website-host"` to the host `<p>` in `components/admin/shell/website-card.tsx` (the host is the test server's `127.0.0.1:3100`, which differs from any real deployment; masking keeps the baseline portable). The `toHaveScreenshot` names get the project suffix automatically (`…-desktop.png` / `…-mobile.png`), as the existing `admin-shell` baselines do.

`tests/e2e/admin-a11y.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

import { clientIpFor, E2E_PASSWORD, greeting, readFixtures } from "./fixtures"

// WCAG 2.2 AA gate for the admin (spec §8.2, JW tests/e2e/admin/a11y):
// no serious or critical axe violations, light and dark.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

async function blocking(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {})
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    // The live preview frames the public site, audited on its own.
    .exclude('iframe[title="Page preview"]')
    .analyze()
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) => `${v.id}: ${v.nodes.map((node) => node.target.join(" ")).join(", ")}`
    )
}

const PANEL = [
  "/admin",
  "/admin/pages",
  "/admin/pages/home",
  "/admin/services",
  "/admin/team",
  "/admin/clients",
  "/admin/group-companies",
  "/admin/categories",
  "/admin/settings",
  "/admin/settings/site",
  "/admin/account",
  "/admin/account?tab=security",
  "/admin/account?tab=sessions",
]

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(`a11y ${testInfo.title}`),
  })
})

async function signIn(page: Page, who: "editor" | "admin" = "editor") {
  // `admin` is added to the E2E fixtures by phase-04 Task 12.
  const user = readFixtures()[who]
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(
    page.getByRole("heading", { name: greeting(user.name) })
  ).toBeVisible()
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`admin a11y (${colorScheme})`, () => {
    test.use({ colorScheme })

    test(`signed-in screens in ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      const failures: string[] = []
      for (const path of PANEL) {
        await page.goto(path)
        for (const violation of await blocking(page))
          failures.push(`${path} → ${violation}`)
      }
      expect(failures).toEqual([])
    })

    test(`administration screens in ${colorScheme}`, async ({ page }) => {
      await signIn(page, "admin")
      const failures: string[] = []
      for (const path of ["/admin/users", "/admin/audit"]) {
        await page.goto(path)
        for (const violation of await blocking(page))
          failures.push(`${path} → ${violation}`)
      }
      expect(failures).toEqual([])
    })

    test(`sign-in in ${colorScheme}`, async ({ page }) => {
      await page.goto("/admin/sign-in")
      expect(await blocking(page)).toEqual([])
    })

    test(`palette and user menu open in ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.getByRole("button", { name: "Search" }).click()
      await expect(
        page.getByRole("dialog", { name: "Search the admin" })
      ).toBeVisible()
      expect(await blocking(page)).toEqual([])
      await page.keyboard.press("Escape")
      const { editor } = readFixtures()
      await page
        .getByRole("button", { name: `Account menu for ${editor.name}` })
        .click()
      await expect(page.getByRole("menu")).toBeVisible()
      expect(await blocking(page)).toEqual([])
    })
  })
}
```

(One sign-in per test keeps the suite under the production sign-in rate limit; each test signs in from its own address.)

- [ ] **Step 3: Run the specs to verify they fail first (Playwright lock)**

Run: `pnpm exec playwright test tests/visual/admin-screens.spec.ts`
Expected: FAIL — `A snapshot doesn't exist at …/admin-dashboard-light-desktop.png, writing actual.` (24 missing baselines).

Run: `pnpm test:e2e tests/e2e/admin-a11y.spec.ts`
Expected: PASS if Tasks 1–11 hold AA; any reported `color-contrast`, `scrollable-region-focusable`, `aria-*` or `landmark-*` violation is a real defect: fix it in the component it names (not in the spec), re-run, and list each fix in the report.

- [ ] **Step 4: Capture and inspect the baselines**

Run: `pnpm exec playwright test tests/visual/admin-screens.spec.ts --update-snapshots=missing`
Expected: 24 files written. Open each and check: grey floating panels on the canvas, white cards, navy website card, hero KPI navy, status pills, dark theme as elevation (canvas darkest), no clipped focus rings, phones show cards not tables.

Run: `pnpm test:visual`
Expected: 40 public baselines at 0 px; 4 `admin-shell-*` + 24 `admin-*` pass.

- [ ] **Step 5: Phase gate (HARD GATE)**

Run: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:visual && pnpm test:e2e`
Expected: all green; `git status tests/visual/__screenshots__` lists no public baseline.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write tests/visual/admin-screens.spec.ts tests/e2e/admin-a11y.spec.ts components/admin/shell/website-card.tsx
git add package.json pnpm-lock.yaml tests/visual/admin-screens.spec.ts tests/e2e/admin-a11y.spec.ts components/admin/shell/website-card.tsx tests/visual/__screenshots__/admin-*.png
git commit -m "$(cat <<'EOF'
test(admin): JW-parity baselines in light and dark plus axe gate

Dashboard, pages, page editor, settings, account and sign-in on desktop
and phone in both themes; axe (WCAG 2.2 A/AA, serious and critical)
over every Phase 4 admin screen, the palette and the user menu.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Amendments to phase-04 Task 12 (Users + Audit screens)

Phase-04 Task 12 runs after 04b Task 11. Its brief must carry these changes (everything else in it stands):

1. **`nav.ts` is not replaced wholesale.** Add to 04b's registry, between the "Configuration" and "You" sections:

   ```ts
   {
     label: "Administration",
     items: [
       { label: "Users", href: "/admin/users", icon: UserCog, permission: { user: ["read"] }, match: "prefix", dock: true },
       { label: "Audit log", href: "/admin/audit", icon: ScrollText, permission: { audit: ["read"] }, match: "prefix", dock: true },
     ],
   },
   ```

   Both are **dock items** (JW: Users & roles and Activity log live in the footer dock). Rebase its `tests/unit/admin/nav.test.ts` expectations on 04b Task 3's file: `menu(["owner"])` stays `["Dashboard","Pages","Services","Collections","Settings"]`; add `expect(dock(["owner"])).toEqual(["Users","Audit log","Account"])`, `expect(dock(["editor"])).toEqual(["Account"])`; `destinations(["owner"])` gains `"Users","Audit log"` before `"Account"`. Its "Administration section" test keeps using `navItems` (dock items are still in the registry). The admin-shell baseline change is the two extra dock icons (not a longer menu).
2. **Screens use the kit:** `PageHeader` (+ `PRIMARY_ACTION` "Invite user"), the restyled `DataTable` (its `toolbar`/`filterKey` additions go into the 04b toolbar row `flex flex-wrap items-center gap-3`, filters as `h-10 rounded-xl bg-card` selects), role/status/2FA badges as `StatusPill` (`toneForStatus`: "Banned" danger, "Invited" info, "Active" success), empty/error states as `EmptyState` with "Try again", loading as `CardSkeleton`.
3. **User detail** (`/admin/users/[id]`): `PageHeader` with a back link breadcrumb, then `SectionTabs` (`heading="User"`, in-page: Profile, Roles, Sessions, Danger zone) with each panel a `DashboardCard`; destructive actions use `variant="destructive"` buttons in a card titled "Danger zone".
4. **Audit log:** rows show `describeActivity(row).text` (from `lib/admin/activity.ts`, 04b Task 11) beside the raw action in `<code>`; the detail opens in a right `Sheet` (`bg-card sm:max-w-xl`, title `text-lg font-semibold`) with the diff in a `rounded-xl bg-muted p-4 font-mono text-xs` block.
5. Starting impersonation still calls `queryClient.clear()` (ledger carry).

## Patterns for later phases (5–10) — binding

Every later phase builds admin UI from these pieces; a phase plan that needs something new adds it to `components/admin/kit/` (with a test) rather than styling inline. JW source for each pattern is named so planners can read it.

**Navigation (`components/admin/shell/nav.ts`):**
- Sections only in the menu; sub-pages as `children` rendered by a route-group layout with `SectionTabs` (route mode, `heading` = section label) — the `(collections)` group is the template.
- Phase 5 Articles: item `{ label: "Articles", href: "/admin/articles", icon: Newspaper, permission: { article: ["read"] }, children: [Articles → /admin/articles, Categories → /admin/categories] }` inserted after "Pages"; move `categories` from the `(collections)` group into an `(articles)` route group with its own tabs layout, and drop Categories from Collections' `children` (URL stays `/admin/categories`). Review queue is a filter, not a tab.
- Phase 6 Media: plain item at the end of "Content". Integrations (settings): add children to Settings via `SettingsTabs` items (Task 14 file), not a new section.
- Phase 7 Leads: item in "Overview" after Dashboard with `badge: "new-leads"` (as its plan says); additionally the **topbar mail link** (JW `topbar.tsx`: `Link` to `/admin/leads`, `aria-label="Leads"`, `className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), ICON_BUTTON)}`, `MailIcon`) shown when `usePermission({ lead: ["read"] })`, placed before `NotificationsButton`; the **notifications popover** lists the newest unassigned leads (`GET /leads?status=new&pageSize=5`) with `relativeTime` and a "View all" link; the dashboard hero KPI gets `href: "/admin/leads"` when `lead:read`.
- Phase 8 SEO / Marketing: a new section `"Growth"` between "Content" and "Configuration" (JW GROWTH) with `SEO` (children Overview · Defaults · Redirects) and `Marketing` (children Tracking · Consent banner · Custom code — the last child gated `customCode: ["update"]`), each via a route-group tabs layout.
- Phase 9 AI: the assistant button sits in the topbar between `SearchPill` and the mail/bell buttons (JW `AiAssistant`), panel as a right `Sheet`; hidden when disabled.
- Every new item: nav unit test rows, ⌘K destination (automatic via `navDestinations`), re-capture `admin-shell-*` baselines.

**Screen anatomy (JW `modules/*`):**
- List screen: `PageHeader` (title, one-line description, `PRIMARY_ACTION` create button or `LINK_PRIMARY`) → toolbar row `flex flex-wrap items-center gap-3` (search `h-10 rounded-xl bg-card sm:w-72`, filters as labelled selects `h-10 rounded-xl`, view toggle as `ToggleGroup variant="outline"` e.g. Leads Board/Table) → `DataTable` (white `rounded-card` table ≥ 640 px, cards below) → `DataTablePagination`. Status as `StatusPill`; dates as `relativeTime` in `<time dateTime>`; ids/slugs/paths as `<code className="font-mono text-xs text-muted-foreground">`.
- Detail: right `Sheet` (`w-full bg-card sm:max-w-xl`, `SheetTitle text-lg font-semibold`, `SheetDescription` with status pills) for records edited in place (leads, media details, audit entry, collection items); a full page with `EditorLayout` for versioned content (articles reuse `VersionedEditor`, so they get the sticky JW header, save pill and the 2xl live preview for free).
- In-page sections: `SectionTabs` in-page mode (`?tab=`), each panel one or two `DashboardCard`s in `grid gap-4 xl:grid-cols-2`.
- Media library (Phase 6): grid/list `ToggleGroup`; grid tiles `rounded-card bg-card p-2` with `aspect-square rounded-xl` thumbnails and a "Missing alt" `StatusPill tone="warning"`; upload drop zone `rounded-card border-2 border-dashed bg-card/40` with per-file progress; details in a right Sheet with the focal-point picker.
- Leads (Phase 7): Board view = one lane per status (lanes `rounded-card bg-card/60 p-3`, cards `rounded-xl bg-card p-4 shadow-xs`), each card movable by keyboard through its status select (SC 2.5.7); Table view = DataTable; drawer per JW `lead-drawer.tsx` (message, mailto/tel buttons, consent record, UTM, timeline, assignee).
- SEO (Phase 8): Overview = KPI row + the **Gauge** (port JW `admin/components/dashboard/gauge.tsx` + `chart-math.ts` `gaugeSummary` into the kit with its tests) + issue list with "Fix" links; the dashboard then adds the "Content health" gauge card (JW layout second row) — closes deviation D7's gauge half.
- Empty states always say what will appear and offer the next step; failed loads are `EmptyState role="alert"` with "Try again"; loading is `CardSkeleton`/`KpiRowSkeleton` (`bg-skeleton`), never a spinner on a blank panel.
- Buttons: page-level `PRIMARY_ACTION` / `SECONDARY_ACTION` (48 px); in forms `FORM_ACTION` (44 px); icon buttons `ICON_BUTTON` (44 px circle); links styled as buttons use `LINK_*` and stay `role="link"`.
- Dialogs/sheets/popovers are `bg-card`/`bg-popover` on the grey panel; destructive confirmations use `AlertDialog` with the destructive variant.
- Charts: kit `PillBarChart` (single or compared series) with the sr-only table; colours `chart-1..5` only; animation off under reduced motion.
- Testing per screen: DOM test of the states (loading/empty/error/data, permission-hidden actions); a light+dark desktop+mobile baseline in `tests/visual/admin-screens.spec.ts` (mask `time` and dynamic text); the screen's URL added to `tests/e2e/admin-a11y.spec.ts`.

## Self-review against the brief

- (a) Shell restyled to JW floating panels: Tasks 4 (sidebar 288 px floating, topbar 72 px, content panel, dock, notifications, user menu), 5 (SectionTabs extended, not replaced), 3 (IA). ✔
- (b) Admin tokens/styling admin-scoped: Task 1 (`html[data-admin]`, contrast-tested light/dark, public CSS untouched; 40 public baselines checked at 0 px in Tasks 1, 4, 11, 12). ✔
- (c) Screens aligned: dashboard (11), pages/services/collections lists (6), editors (7–8), settings + account + error states (9), auth (10). ✔
- (d) Patterns for later phases: section above, incl. nav insert points for Phases 5–9 and the Users/Audit amendments. ✔
- Spec kept: permissions unchanged (nav filters, `usePermission` on every action, server checks untouched), WCAG 2.2 AA (contrast unit test, axe gate, SC 2.4.11 scroll padding, SC 2.1.4 no single-key hotkey, SC 2.5.7 untouched move buttons), 1024 px sheet breakpoint (JW identical — no deviation). ✔
- Re-baseline: Task 4 (shell), Task 12 (24 screen baselines + axe). ✔
