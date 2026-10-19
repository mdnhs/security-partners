# Phase A — Visual system (MK look, SP colours)

> Part of `docs/superpowers/plans/2026-10-19-mk-parity.md`. Spec: `docs/superpowers/specs/2026-10-19-mk-parity-design.md` §2, §4, §13, §14. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the admin look like MK — self-contained CSS, Plus Jakarta Sans, MK weights, MK components and shell details — using an SP-derived palette.

**Architecture:**
- `app/(admin)/admin/admin.css` becomes its own Tailwind entry and stops importing `app/globals.css`.
- The palette table in spec §4.2 is the single source. It lives in `lib/theme/sp-admin.ts` as `SP_ADMIN`, and a unit test keeps `admin.css` equal to it. Phase C reuses that file as its preset base.
- The visual changes are tokens plus a few components. Admin baselines are re-shot at the end, A8.

**Tech Stack:** Tailwind 4.3, shadcn base-nova on `@base-ui/react@1.9.0`, `next/font/google`. New deps: `culori@4.0.2` and `@types/culori@4.0.1`, used for contrast in tests and in Phase C.

## Global Constraints

The master plan's Global Constraints, plus:
- `app/globals.css` and every public file are **not edited** in this phase.
- Public baselines stay at 0 px. Run `pnpm test:visual tests/visual/public-pages.spec.ts tests/visual/consent-banner.spec.ts` in A1 and A8.
- Admin code must not use the public button variants `brand`, `brand-outline*` or `pill`.
- Coarse-pointer hit areas must be at least 44 px.

## Review Focus

1. **Admin screens that silently used a public-only class or variable**, such as `text-brand-navy`, `bg-brand-mint` or `font-heading`. Once `globals.css` is gone these become unstyled. A1 adds a scan test that fails on any `brand-` utility or `font-heading` under `components/admin`, `app/(admin)` and `components/ui` (shared primitives used by the admin).
2. **Dark-mode contrast of the new palette.** It is pinned by the extended `tests/unit/admin/admin-tokens.test.ts` (A1), which checks every pair at ≥ 4.5:1 and borders and rings at ≥ 3:1 in both modes.
3. **Keyboard and screen-reader use of the new primitives** (Select, Tabs, RadioGroup, Checkbox), including focus visibility and coarse 44 px targets. Pinned by the A2 DOM tests and the A8 axe e2e.
4. **A KPI without a link.** It must still render a chip-less card instead of crashing. `KpiCard` makes `href` required by type, and the A4 DOM test passes `href` for every dashboard KPI.
5. **Toasts at the top centre hiding the sticky editor bar on phones.** A3 sets `offset={{ top: 80 }}`, below the topbar height. The A3 DOM test asserts that props reach Sonner.

---

### Task A1: Self-contained admin CSS, SP palette (MK structure), Plus Jakarta Sans

**Files:**
- Create:
  - `lib/theme/sp-admin.ts`: the §4.2 table as data.
  - `tests/unit/admin/admin-css-scope.test.ts`
- Modify:
  - `app/(admin)/admin/admin.css`: full rewrite. Drop the `@import "../../globals.css"`; add its own entry, `@theme inline` and tokens.
  - `app/(admin)/admin/layout.tsx`: replace Lato with Plus Jakarta Sans.
  - `components.json`: `tailwind.css` → `app/(admin)/admin/admin.css`.
  - `components/ui/{card,dialog,sheet,empty}.tsx`: drop `font-heading`.
  - `components/admin/shell/brand-mark.tsx`: name text `text-base font-semibold`.
  - `package.json`: add `culori` and `@types/culori`.
  - `tests/unit/admin/admin-tokens.test.ts`: extend it.
- Test:
  - `tests/unit/admin/admin-tokens.test.ts`
  - `tests/unit/admin/admin-css-scope.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:

```ts
// lib/theme/sp-admin.ts (isomorphic, no imports)
export const SP_ADMIN_LIGHT: Readonly<Record<AdminTokenName, string>>   // 48 tokens, hex lower-case, spec §4.2 light column
export const SP_ADMIN_DARK: Readonly<Partial<Record<AdminTokenName, string>>> // only tokens the dark block overrides
export const SP_ADMIN_RADIUS = 0.75
export const ADMIN_TOKEN_NAMES: readonly AdminTokenName[]               // the 48 names in spec §4.2/MK order
export type AdminTokenName = "background" | "foreground" | /* … all 48 … */ "promo-foreground"
export const ADMIN_CONTRAST_PAIRS: readonly [text: AdminTokenName, surface: AdminTokenName, min: 3 | 4.5][]
```

`ADMIN_CONTRAST_PAIRS`:

| Pair | Min |
|---|---|
| foreground/background | 4.5 |
| card-foreground/card | 4.5 |
| popover-foreground/popover | 4.5 |
| primary-foreground/primary | 4.5 |
| secondary-foreground/secondary | 4.5 |
| muted-foreground/muted | 4.5 |
| muted-foreground/sidebar | 4.5 |
| muted-foreground/card | 4.5 |
| accent-foreground/accent | 4.5 |
| sidebar-foreground/sidebar | 4.5 |
| sidebar-primary-foreground/sidebar-primary | 4.5 |
| sidebar-accent-foreground/sidebar-accent | 4.5 |
| destructive/card | 4.5 |
| success/success-soft | 4.5 |
| warning/warning-soft | 4.5 |
| danger/danger-soft | 4.5 |
| hero-foreground/hero-from | 4.5 |
| hero-chip-foreground/hero-chip | 4.5 |
| promo-foreground/promo-from | 4.5 |
| input/background | 3 |
| ring/background | 3 |
| primary/background | 3 |

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/admin/admin-tokens.test.ts`. Keep its existing `declarations()` and `luminance()` helpers.

```ts
import {
  ADMIN_CONTRAST_PAIRS,
  ADMIN_TOKEN_NAMES,
  SP_ADMIN_DARK,
  SP_ADMIN_LIGHT,
} from "@/lib/theme/sp-admin"

describe("admin palette = SP_ADMIN (spec §4.2)", () => {
  it("light block declares every token with the table's value", () => {
    for (const name of ADMIN_TOKEN_NAMES)
      expect(light[name], name).toBe(SP_ADMIN_LIGHT[name])
    expect(light.radius).toBe("0.75rem")
  })
  it("dark block equals the dark overrides", () => {
    for (const [name, value] of Object.entries(SP_ADMIN_DARK))
      expect(dark[name], name).toBe(value)
  })
  it("keeps the contrast-tuned destructive and warning (ruling 6)", () => {
    expect(light.destructive).toBe("#b91c1c")
    expect(dark.destructive).toBe("#fca5a5")
    expect(light.warning).toBe("#92400e")
  })
  it.each(["light", "dark"] as const)("%s pairs meet their minimum", (mode) => {
    const t = mode === "light" ? light : dark
    for (const [text, surface, min] of ADMIN_CONTRAST_PAIRS)
      expect(ratio(t[text], t[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(min)
  })
})
```

Here `ratio(a, b)` = `(L1 + 0.05) / (L2 + 0.05)` over the existing `luminance()`. If the current test already has a contrast helper, reuse it.

`tests/unit/admin/admin-css-scope.test.ts`:

```ts
it("admin.css is its own Tailwind entry", () => {
  expect(css).not.toMatch(/globals\.css/)
  expect(css).toMatch(/@import "tailwindcss";/)
  expect(css).toMatch(/--font-sans: var\(--font-jakarta\)/)
  expect(css).toMatch(/--text-title--font-weight: 600/)
  expect(css).toMatch(/--text-card-title--font-weight: 600/)
  expect(css).toMatch(/--text-kpi--font-weight: 600/)
})
it("no admin file uses public-only classes or variants", () => {
  const files = globSync("{components/admin,app/(admin),components/ui}/**/*.{ts,tsx}")
  const offenders = files.filter((f) =>
    /\b(?:text|bg|border|ring|fill|stroke)-brand-|font-heading|variant="(?:brand|brand-outline[\w-]*|pill)"/.test(readFileSync(f, "utf8")))
  expect(offenders).toEqual([])
})
```

`components/ui/button.tsx` keeps its public variants. Exclude it from the scan by file name; it is the definition, not a use.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run --project unit tests/unit/admin/admin-tokens.test.ts tests/unit/admin/admin-css-scope.test.ts`

Expected: FAIL — `Cannot find module '@/lib/theme/sp-admin'` and `expected css not to match /globals\.css/`.

- [ ] **Step 3: Install deps**

Run `npm view culori@4.0.2 time --json` and `npm view @types/culori@4.0.1 time --json`. Confirm each publish date is ≥ 14 days old. Then run `pnpm add -E culori@4.0.2 && pnpm add -E -D @types/culori@4.0.1`.

- [ ] **Step 4: Create `lib/theme/sp-admin.ts`**

Copy the values from spec §4.2 exactly, lower-case hex. `SP_ADMIN_DARK` omits `hero-*`, `promo-*`, `success*`, `warning*` and `danger*`, which inherit from light.

- [ ] **Step 5: Rewrite `app/(admin)/admin/admin.css`**

Order:
1. `@import "tailwindcss"; @import "tw-animate-css"; @import "shadcn/tailwind.css";`
2. `@custom-variant dark (&:is(.dark *));`
3. `@theme` with the type scale (weights 600) and `--radius-card: 1.375rem`.
4. `@theme inline`:
   - `--font-sans: var(--font-jakarta)`, `--font-mono: var(--font-mono)`
   - every `--color-<token>: var(--<token>)` for the 48 tokens
   - `--radius-sm..4xl` calc
5. `html[data-admin] { … }` light values.
6. `html[data-admin].dark { … }` dark overrides.
7. The existing `@utility bg-hatch|bg-hero|bg-promo`, scrollbars, reduced-motion kill switch and `[data-slot="editor-bar"]` rules, moved over unchanged.
8. `@layer base`: `* { @apply border-border outline-ring/50 } body { @apply bg-background text-foreground } html { @apply font-sans }`.
9. `.rich-text-content` rules retargeted: links `color: var(--primary)`, blockquote border `var(--primary)`, h2/h3 `font-weight: 700`.

- [ ] **Step 6: Swap the font in the layout**

In `app/(admin)/admin/layout.tsx`:

```ts
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jakarta", display: "swap" })
```

Use it in `<html className>`. Remove Lato. Keep `Geist_Mono` on `--font-mono`.

- [ ] **Step 7: Remove `font-heading`**

Remove `font-heading` from the `components/ui/{card,dialog,sheet,empty}.tsx` titles. Set the brand mark name to `text-base font-semibold`. Point `components.json` `tailwind.css` at the admin CSS.

- [ ] **Step 8: Run the unit tests**

Run: `pnpm vitest run --project unit tests/unit/admin`

Expected: PASS.

If a contrast pair fails, move that token's OKLCH lightness only, in 0.01 steps, until it passes. Then update `sp-admin.ts`, `admin.css`, and the spec §4.2 row with a dated note "A1 nudge: <token> <old>→<new>".

- [ ] **Step 9: Run the public visual gate and the build**

Run:

```bash
pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:visual tests/visual/public-pages.spec.ts tests/visual/consent-banner.spec.ts
```

Expected: build OK; public 0 px. Admin visual specs are **expected to differ** and are re-shot in A8. Do not update them here.

- [ ] **Step 10: Commit**

```bash
git add lib/theme/sp-admin.ts "app/(admin)/admin/admin.css" "app/(admin)/admin/layout.tsx" components.json components/ui/card.tsx components/ui/dialog.tsx components/ui/sheet.tsx components/ui/empty.tsx components/admin/shell/brand-mark.tsx package.json pnpm-lock.yaml tests/unit/admin/admin-tokens.test.ts tests/unit/admin/admin-css-scope.test.ts
git commit -m "feat(admin): self-contained MK-style admin CSS with SP palette and Plus Jakarta Sans

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A2: shadcn primitives

**Files:**
- Create: `components/ui/{select,tabs,table,checkbox,radio-group,scroll-area,item,breadcrumb}.tsx`
- Test: `tests/dom/ui/primitives.test.tsx`

**Interfaces:**
- Produces the shadcn base-nova exports, generated by `pnpm dlx shadcn@4.21.4 add select tabs table checkbox radio-group scroll-area item breadcrumb` (the shadcn CLI is already a devDep at 4.21.4, so use `pnpm exec shadcn add …`). The generated code is then edited:
  - **`select.tsx`:** `Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator`. The trigger is `h-11 pointer-coarse:min-h-11`.
  - **`tabs.tsx`:** `Tabs, TabsList, TabsTrigger, TabsContent`. Triggers get `pointer-coarse:min-h-11`.
  - **`table.tsx`:** `Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption`. Head is `h-12 px-4`; cell is `px-4 py-3`.
  - **`checkbox.tsx`:** `Checkbox`. Hit area is ≥ 44 px on coarse pointers via `relative after:absolute after:-inset-3 pointer-fine:after:hidden`.
  - **`radio-group.tsx`:** `RadioGroup, RadioGroupItem`, with the same hit-area rule.
  - **`scroll-area.tsx`:** `ScrollArea, ScrollBar`.
  - **`item.tsx`:** `Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemGroup, ItemSeparator`.
  - **`breadcrumb.tsx`:** `Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis`.
  - Every focus style is `focus-visible:ring-3 focus-visible:ring-ring/50`.

- [ ] **Step 1: Write the failing DOM test** `tests/dom/ui/primitives.test.tsx`

```tsx
it("Select is a labelled combobox that picks with the keyboard", async () => {
  render(<><Label htmlFor="s">Status</Label><Select defaultValue="a"><SelectTrigger id="s"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">Alpha</SelectItem><SelectItem value="b">Beta</SelectItem></SelectContent></Select></>)
  const box = screen.getByRole("combobox", { name: "Status" })
  await user.click(box); await user.keyboard("{ArrowDown}{Enter}")
  expect(box).toHaveTextContent("Beta")
})
it("Tabs expose tablist/tab/tabpanel and arrow-key focus", async () => {
  render(<Tabs defaultValue="one"><TabsList aria-label="Sections"><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two">Two</TabsTrigger></TabsList><TabsContent value="one">P1</TabsContent><TabsContent value="two">P2</TabsContent></Tabs>)
  screen.getByRole("tab", { name: "One" }).focus(); await user.keyboard("{ArrowRight}{Enter}")
  expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("tabpanel")).toHaveTextContent("P2")
})
it("Checkbox and RadioGroup toggle by keyboard", async () => { /* space toggles checkbox → aria-checked=true; ArrowDown in radiogroup selects next */ })
it("Table renders semantic table roles", () => { /* getByRole("table"), columnheader, cell */ })
it("Breadcrumb marks the current page", () => { /* BreadcrumbPage has aria-current="page" */ })
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run --project dom tests/dom/ui/primitives.test.tsx`

Expected: FAIL, module not found.

- [ ] **Step 3: Generate and edit the primitives**

Generate them with `pnpm exec shadcn add select tabs table checkbox radio-group scroll-area item breadcrumb`, then apply the edits listed in the Interfaces block.

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run --project dom tests/dom/ui/primitives.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/select.tsx components/ui/tabs.tsx components/ui/table.tsx components/ui/checkbox.tsx components/ui/radio-group.tsx components/ui/scroll-area.tsx components/ui/item.tsx components/ui/breadcrumb.tsx tests/dom/ui/primitives.test.tsx
git commit -m "feat(ui): add shadcn select, tabs, table, checkbox, radio-group, scroll-area, item, breadcrumb

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A3: Shell chrome (brand chip, topbar mail + identity, toasts)

**Files:**
- Create: `components/admin/shell/sp-mark.tsx`, a square SP shield as inline SVG, `currentColor` fill, `aria-hidden`.
- Modify:
  - `components/admin/shell/brand-mark.tsx`: `size-10 rounded-full bg-accent text-accent-foreground` chip wrapping `<SpMark className="size-[22px]" />`, plus the site name.
  - `components/admin/shell/topbar.tsx`: add `EnquiriesLink`.
  - `components/admin/shell/user-menu.tsx`: trigger identity block.
  - `components/admin/providers.tsx`: Toaster position.
- Test: `tests/dom/admin-shell-chrome.test.tsx`

**Interfaces:**
- Consumes: `useAdminSession()` (session `{ user: { name, email }, roles }`), `usePermission`, `NavBadges["new-leads"]`, and `ICON_BUTTON` from `components/admin/shell/constants.ts`.
- Produces:
  - `EnquiriesLink({ count }: { count: number })`, an internal component in `topbar.tsx`. It renders `<Link href="/admin/leads" aria-label={count ? \`Enquiries, ${count} new\` : "Enquiries"} className={ICON_BUTTON}>`, containing a `MailIcon` and a dot when `count > 0`. It renders only with `lead:read`.
  - `UserMenu`: the trigger shows the avatar always; at `lg:` it also shows name, email and a role pill (`ROLE_LABELS[primaryRole]`).
  - Toaster: `<Toaster position="top-center" offset={{ top: 80 }} mobileOffset={{ top: 72 }} richColors closeButton />`.

- [ ] **Step 1: Write the failing DOM tests**

```tsx
it("topbar shows an Enquiries link with the new count for lead readers", () => {
  renderShell({ roles: ["intake"], badges: { "new-leads": 3 } })
  expect(screen.getByRole("link", { name: "Enquiries, 3 new" })).toHaveAttribute("href", "/admin/leads")
})
it("hides the Enquiries link without lead:read", () => {
  renderShell({ roles: ["editor"] })
  expect(screen.queryByRole("link", { name: /Enquiries/ })).toBeNull()
})
it("user menu trigger names the person, email and role", () => {
  renderShell({ roles: ["owner"], user: { name: "Ann Owner", email: "ann@x.ie" } })
  const trigger = screen.getByRole("button", { name: /Ann Owner/ })
  expect(trigger).toHaveTextContent("ann@x.ie"); expect(trigger).toHaveTextContent("Owner")
})
it("toasts are top-center", () => {
  render(<AdminProviders>{null}</AdminProviders>)
  expect(document.querySelector("[data-sonner-toaster]")).toHaveAttribute("data-y-position", "top")
})
```

`renderShell` is the existing helper in `tests/dom/admin-shell.test.tsx`. Move it to `tests/dom/helpers/render-shell.tsx` if it is not exported.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run --project dom tests/dom/admin-shell-chrome.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement**

Implement the changes listed in Files and Interfaces.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project dom tests/dom/admin-shell-chrome.test.tsx tests/dom/admin-shell.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit the listed files:

```bash
git add components/admin/shell/sp-mark.tsx components/admin/shell/brand-mark.tsx components/admin/shell/topbar.tsx components/admin/shell/user-menu.tsx components/admin/providers.tsx tests/dom/admin-shell-chrome.test.tsx
git commit -m "feat(admin): MK shell chrome — brand chip, topbar enquiries link, identity, top toasts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task A4: Kit — KPI chips, two-series chart, PageHeader

**Files:**
- Modify:
  - `components/admin/kit/kpi-card.tsx`
  - `components/admin/kit/pill-bar-chart.tsx`
  - `components/admin/page-header.tsx`
  - `components/admin/dashboard/dashboard.tsx`: pass an `href` for every KPI. The chart data keeps 90-day data until D3.5 and maps it to `{ label, current, previous: null }`.
- Test: `tests/dom/admin-kit.test.tsx` (extend)

**Interfaces:**

```ts
// kpi-card.tsx
export type KpiCardProps = { label: string; value: string; caption?: string; href: string; delta?: Delta | null; variant?: "default" | "hero" }
// pill-bar-chart.tsx
export type PillBarDatum = { key: string; label: string; current: number; previous: number | null }
export function PillBarChart(props: { data: PillBarDatum[]; ariaLabel: string; legend?: { current: string; previous: string }; emptyText?: string }): JSX.Element
// page-header.tsx (keep existing props; add)
export const PRIMARY_ACTION = "h-12 gap-2 rounded-xl px-5 text-[15px] font-semibold"
export const SECONDARY_ACTION = "h-12 gap-2 rounded-xl px-5 text-[15px] font-semibold"
```

`SECONDARY_ACTION` uses the outline variant. `breadcrumbs` now renders the A2 `Breadcrumb` primitives.

**KpiCard:**
- The chip is a `<Link>`, `size-10 rounded-full border`, with `aria-label={\`Open ${label}\`}`.
- It has `after:absolute after:-inset-1 pointer-coarse:after:-inset-[2px]`, so the hit area is ≥ 44 px.
- The hero variant has a white filled chip.

**PillBarChart:**
- `previous` bars use `bg-hatch` with an SVG pattern.
- The legend has two swatches with text.
- When every `current` and `previous` is 0, it shows the `emptyText` overlay.
- The `<figure>` has `aria-label`, plus an sr-only `<table>` of the values. Status is not shown by colour alone.

- [ ] **Step 1: Write the failing tests**

```tsx
it("every KpiCard links its chip", () => {
  render(<KpiCard label="Open enquiries" value="4" href="/admin/leads" />)
  expect(screen.getByRole("link", { name: "Open Open enquiries" })).toHaveAttribute("href", "/admin/leads")
})
it("PillBarChart draws current and hatched previous with a legend and an sr table", () => {
  render(<PillBarChart ariaLabel="Enquiries this week" legend={{ current: "This week", previous: "Last week" }} data={[{ key: "mon", label: "Mon", current: 2, previous: 1 }]} />)
  expect(screen.getByText("This week")).toBeInTheDocument()
  expect(screen.getByRole("table")).toHaveTextContent(/Mon.*2.*1/)
  expect(document.querySelectorAll("[data-series=previous]")).toHaveLength(1)
})
it("PillBarChart shows the empty overlay when all zero", () => {
  render(<PillBarChart ariaLabel="x" emptyText="No enquiries yet" data={[{ key: "mon", label: "Mon", current: 0, previous: 0 }]} />)
  expect(screen.getByText("No enquiries yet")).toBeInTheDocument()
})
it("PageHeader renders breadcrumbs with the current page", () => { /* aria-current="page" */ })
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run --project dom tests/dom/admin-kit.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement**

Implement the three components. Update `dashboard.tsx` callers so that `pnpm typecheck` passes.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project dom tests/dom/admin-kit.test.tsx tests/dom/dashboard.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit the listed files with the message:

```
feat(admin): KPI arrow chips, two-series pill chart, MK page header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task A5: Data tables and filters on shadcn primitives

**Files:**
- Modify:
  - `components/admin/data-table/data-table.tsx`: native `<table>` → `Table*`. Keep sorting, URL sync and phone cards.
  - `components/admin/filter-field.tsx`: native `<select>` → `Select`.
  - Every admin file that `grep -rln "<select\|<table" components/admin app/(admin)` lists. Replace one-for-one. `components/admin/schema-form/**` is out of scope here, because A6 owns it and runs in parallel. The native-controls test ignores that folder until A6 merges, and A6 removes the ignore.
- Test:
  - `tests/dom/data-table.test.tsx` (extend)
  - `tests/unit/admin/native-controls.test.ts` (new)

**Interfaces:**
- `FilterField` props are unchanged (`{ label, value, options: {value,label}[], onChange }`).
- `DataTable` props are unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/admin/native-controls.test.ts
it("admin code uses shadcn Select/Table, not native elements", () => {
  const hits = globSync("{components/admin,app/(admin)}/**/*.tsx")
    .filter((f) => /<select[\s>]|<table[\s>]/.test(readFileSync(f, "utf8")))
  expect(hits).toEqual([])
})
```

In `tests/dom/data-table.test.tsx`, add: "sort header is a button inside a columnheader with aria-sort".

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/unit/admin/native-controls.test.ts`

Expected: FAIL, listing the files.

- [ ] **Step 3: Replace each listed file**

Keep labels and `aria-*`. Base-ui Select needs a visible `<Label htmlFor>`, so wire the `id` through.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project unit tests/unit/admin/native-controls.test.ts && pnpm vitest run --project dom`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message:

```
refactor(admin): tables and filters on shadcn Table/Select

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task A6: SchemaForm widgets on shadcn Select / RadioGroup / Checkbox

**Files:**
- Modify: the `components/admin/schema-form/*` widget files for `select`, `toggle`/boolean-list and enum radios. List them with `grep -ln "select\|radio\|checkbox" components/admin/schema-form/`.
- Test: `tests/dom/schema-form.test.tsx` (extend)

**Interfaces:**
- `editor-meta` widget kinds are unchanged.
- An enum with ≤ 4 options and `widget: "radio"` renders `RadioGroup`.
- `widget: "select"` renders `Select`.
- A multi-select of roles renders a `Checkbox` group with a fieldset and legend.

- [ ] **Step 1: Write the failing tests**

Add tests for:
- the select widget picking by keyboard and RHF receiving the value;
- the radio widget with legend and arrow-key selection;
- the checkbox group with legend and two checked values submitted as an array.

- [ ] **Step 2: Run to verify they fail**

Run the tests and confirm they fail.

- [ ] **Step 3: Implement**

Implement the widgets.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project dom tests/dom/schema-form.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `refactor(admin): SchemaForm select/radio/checkbox widgets on shadcn primitives`, ending with the co-author line.

---

### Task A7: `/admin/design` component gallery (owner)

**Files:**
- Create:
  - `app/(admin)/admin/(panel)/design/page.tsx`
  - `components/admin/design/showcase.tsx`
  - `components/admin/design/sample-data.ts`
- Modify: `tests/visual/admin-screens.spec.ts`, adding a `design` screen for the owner in light and dark.
- Test: `tests/e2e/design.spec.ts`

**Interfaces:**
- The page calls `await requirePermission({ customCode: ["update"] })`, which is owner-only. In Phase B this becomes `requirePage("/admin/design")`.
- `Showcase()` sections, in this order:
  1. PageHeader "Design system" with PRIMARY and SECONDARY actions.
  2. KPI row: hero + 3 default cards.
  3. DashboardCards: chart with two series, Next up, Team activity, Content health gauge.
  4. Status pills (all tones).
  5. Form controls: Input, Textarea, Select, RadioGroup, Checkbox, Switch, Tabs.
  6. Table sample.
  7. Empty and skeleton states.
  8. Breadcrumb and Item list.

- [ ] **Step 1: Write the failing e2e test**

```ts
test("owner sees the design gallery; editor is forbidden", async ({ owner, editor }) => {
  await owner.goto("/admin/design")
  await expect(owner.getByRole("heading", { name: "Design system" })).toBeVisible()
  await expect(owner.getByRole("combobox").first()).toBeVisible()
  await editor.goto("/admin/design")
  await expect(editor.getByText(/don.t have access|forbidden/i)).toBeVisible()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:e2e tests/e2e/design.spec.ts`

Expected: FAIL (404).

- [ ] **Step 3: Implement**

Implement the page and the showcase on static `sample-data.ts`. The gallery has no API calls.

- [ ] **Step 4: Run the test**

Run: `pnpm test:e2e tests/e2e/design.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(admin): /admin/design component gallery (owner only)`, ending with the co-author line.

---

### Task A8: Phase A gate (admin re-shoot, a11y, public 0 px)

**Files:**
- Modify: `tests/visual/__screenshots__/admin-*.png` (re-shot) and the new `admin-design-*.png`.

- [ ] **Step 1: Run the full suite before re-shooting**

```bash
pnpm db:up && pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:e2e
```

Expected: all green. `tests/e2e/admin-a11y.spec.ts` must report no axe violations on every screen.

- [ ] **Step 2: Confirm the public baselines**

Run: `pnpm test:visual tests/visual/public-pages.spec.ts tests/visual/consent-banner.spec.ts`

Expected: 0 px. Stop if any public diff appears.

- [ ] **Step 3: Re-shoot the admin baselines**

Run: `pnpm test:visual:update tests/visual/admin-screens.spec.ts tests/visual/admin-shell.spec.ts`. Then run `pnpm test:visual` twice. Expected: green both times, which proves determinism.

- [ ] **Step 4: Review the contact sheet**

Make a contact sheet: `montage` if ImageMagick is present, otherwise list the paths. Attach dashboard light/dark desktop and mobile to the report for the controller's eyeball check against MK `tests/e2e/__screenshots__/darwin/admin-desktop/dashboard-{light,dark}.png`.

- [ ] **Step 5: Commit**

```bash
git add tests/visual/__screenshots__/admin-*.png
git commit -m "test(visual): re-baseline admin for the MK visual system (phase A)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
