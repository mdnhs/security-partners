# Phase C — Appearance (theme engine) and AI parity

> Part of `docs/superpowers/plans/2026-10-19-mk-parity.md`. Spec §6, §8 (0010, 0011), §11, §13. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the Appearance screen backed by a pure theme engine for the admin and the public site, with defaults byte-equal to today's CSS and no `<style>` emitted by default. Bring the AI assistant to MK parity: discoverable, MK settings fields, read-only tools, markdown, regenerate and edit.

**Architecture:**
- `lib/theme/*` is MK's engine ported, with SP base tables: `SP_ADMIN` from A1 and `SP_SITE` from `app/globals.css`.
- The theme is the settings row `theme`. It is versioned through `server/lib/versioning.ts` (`VersionedStore`), the same draft/publish/revision path as other settings, with its own module and routes.
- Admin and site emit a `<style>` only when the CSS is non-empty.
- AI keeps the SP NDJSON chat stream (`lib/ai/chat-stream.ts`). The changes are in the server prompt and tools, plus client rendering.

**Tech Stack:** culori 4.0.2 (added in A1), react-colorful 5.8.1, `ai` 7.0.127 `tool()` / `stepCountIs`, `@ai-sdk/google` 4.0.x and `@ai-sdk/openai-compatible` 3.0.x (newest versions ≥ 14 days old, compatible with `ai@7.0.127`).

## Global Constraints

The master plan's constraints apply, plus:
- The **default theme emits no `<style>`**, on the public site and in the admin (ruling 4).
- `SP_SITE` equals the `app/globals.css` `--color-brand-*` values, and a test pins it.
- `checkTheme` blocks publish on the server as well as the client.
- The AI enquiry-details switch can be enabled only by `owner:manage`, and needs an acknowledgement. It defaults to off (ruling 5).
- The AI base URL is SSRF-guarded: https only; no private, loopback or link-local addresses; `http://localhost` allowed only when `NODE_ENV !== "production"`.
- Tools are read-only, run as the actor, and are offered by role. A failure reaches the model as one generic message.

## Review Focus

1. **Colour strings as injection vectors.** Inputs like `red;}body{display:none`, `oklch(1 0 0);--x:1`, `var(--a)` or a 10 KB string must be rejected by `ColorValue`. CSS is rebuilt from numbers only. Pinned in C1 (`parseColor`, `toCss` name regex) and C2 (API 422).
2. **Default public pages after C3.** No `#site-theme` and no extra `<style>` with the seeded DB. Pinned by the C3 integration test and the public visual gate.
3. **The admin's own colours while previewing an unpublished draft.** Only the Appearance page recolours live (`liveDeclarations`), and navigating away restores the published theme. Pinned by the C5 e2e.
4. **AI tools leaking enquiry PII with the switch off.** `getEnquiryStats` output must contain no names, emails, phones or messages. Pinned by the C8 integration test (regex for `@` and digit runs ≥ 7).
5. **Markdown with hostile content.** `<img onerror>`, `[x](javascript:alert(1))` and raw HTML must render as text or as a plain non-link. Pinned by C9 DOM tests.

---

### Task C1: Theme engine `lib/theme/*`

**Files:**
- Create:
  - `lib/theme/{color,tokens,derive,presets,schema,admin,site,css,checks}.ts`
  - `tests/unit/theme/{color,css,presets,checks,admin}.test.ts`
- Modify: `lib/theme/sp-admin.ts`. Re-export `ADMIN_TOKEN_NAMES` as `ADMIN_TOKENS` from `tokens.ts`, so there is one list.

**Interfaces** (exact names; MK files are the reference implementation at `/Users/nazmulhasansourab/ireland/james-whitfield/lib/theme/*`):

```ts
// color.ts — culori; parse only /^#[0-9a-f]{6}$/i or oklch(L C H), ≤64 chars
export type Oklch = { l: number; c: number; h: number }
export const WHITE: Oklch; export const BLACK: Oklch
export function parseColor(input: string): Oklch | null
export function formatOklch(c: Oklch): string           // "oklch(0.5 0.1 140)"
export function toHex(c: Oklch): string
export function contrast(a: Oklch, b: Oklch): number
export function fit(c: Oklch): Oklch
export function scale(base: Oklch): Oklch[]              // 11 steps, MK SCALE_STEPS
export function onColor(bg: Oklch, min?: number): Oklch
export function nudge(moving: Oklch, fixed: Oklch, min: number): Oklch | null
// tokens.ts
export const ADMIN_TOKENS: readonly AdminToken[]         // = ADMIN_TOKEN_NAMES (48)
export type AdminToken
export const SITE_TOKENS: readonly ["brand-navy","brand-blue","brand-blue-deep","brand-green","brand-green-dark","brand-mint","brand-surface","brand-line","brand-ink","brand-muted","brand-placeholder","brand-map"]
export type SiteToken
export const SITE_SURFACES: readonly SiteToken[]         // brand-surface, brand-mint, brand-map
// derive.ts
export const NEUTRAL_CHROMA = 0.015
export function shift(token: Oklch, from: Oklch, to: Oklch, lightness: boolean): Oklch
// presets.ts
export const PRESET_IDS: readonly ["security-partners","evergreen","ocean","plum","terracotta","graphite"]
export type PresetId
export const SP_SITE: Readonly<Record<SiteToken, string>>   // exact app/globals.css hex values
export const PRESETS: Record<PresetId, { label: string; site: { brand: string }; admin: { primary: string } }>
// security-partners: brand "#67bd31", primary "#367318"; evergreen: "#1f6b3a"/"#157d38"; ocean "#2f5f8a"/"#2f5f8a"; plum "#6a3f6b"/"#6a3f6b"; terracotta "#8f4a36"/"#9a4a32"; graphite "#4a4f55"/"#4a4f55"
// schema.ts — spec §6.1
export const ColorValue: z.ZodType<string>               // transforms to canonical formatOklch, error "Use a #rrggbb or oklch(L C H) colour"
export const ADMIN_RADII: readonly [0, 0.25, 0.5, 0.75, 1, 1.25]
export const ThemeConfig: z.ZodObject                    // { site: { preset, brand, tokens }, admin: { preset, primary, accent, tint, radius, mode } }
export type ThemeConfigValue; export type SiteThemeConfig; export type AdminThemeConfig
export const DEFAULT_THEME: ThemeConfigValue             // site.preset/admin.preset "security-partners"
// admin.ts
export function buildAdminTokens(admin: AdminThemeConfig, mode: "light" | "dark"): Record<AdminToken, Oklch>
export const ADMIN_DEFAULT: Record<"light" | "dark", Record<AdminToken, Oklch>>
// site.ts
export function resolveSiteTokens(site: SiteThemeConfig): Record<SiteToken, Oklch>
export const SITE_DEFAULT: Record<SiteToken, Oklch>
// css.ts
export const SCOPES: { site: ":root"; admin: "html[data-admin]"; adminDark: "html[data-admin].dark" }
export function siteThemeCss(site: SiteThemeConfig): string    // "--color-<token>" on :root; "" when default
export function adminThemeCss(admin: AdminThemeConfig): string // "" when default
export function liveDeclarations(admin: AdminThemeConfig, mode: "light" | "dark"): [string, string][]
// checks.ts
export type ContrastIssue = { scope: "site" | "admin-light" | "admin-dark"; text: string; surface: string; ratio: number; min: 3 | 4.5 }
export const SITE_PAIRS: [SiteToken, SiteToken, 3 | 4.5][]
// SITE_PAIRS: brand-ink/brand-surface 4.5, brand-muted/brand-surface 3, brand-navy/brand-mint 4.5, brand-navy/brand-green 4.5 (consent button), brand-blue/brand-surface 4.5
export const ADMIN_PAIRS: [AdminToken, AdminToken, 3 | 4.5][]   // = ADMIN_CONTRAST_PAIRS from A1
export function checkTheme(config: ThemeConfigValue): ContrastIssue[]
export function pairRatings(config: ThemeConfigValue): (ContrastIssue & { rating: "AAA" | "AA" | "fail" })[]
export function describeIssue(issue: ContrastIssue): string
export function fixIssue(config: ThemeConfigValue, issue: ContrastIssue): ThemeConfigValue | null
export function fixAll(config: ThemeConfigValue): { config: ThemeConfigValue; remaining: ContrastIssue[] }
```

Notes on the port:
- `SITE_PAIRS` must pass for `SP_SITE` exactly as-is. If a pair fails on today's colours, remove that pair and write it in the report. Public colours are frozen.
- `buildAdminTokens` follows MK `lib/theme/admin.ts`. The base is `ADMIN_DEFAULT` parsed from `SP_ADMIN_LIGHT`/`SP_ADMIN_DARK`, the anchor is `SP` primary `#367318` (dark `#7cc84a`), and these are FIXED:
  - `destructive`, `success`, `success-soft`, `warning`, `warning-soft`, `danger`, `danger-soft`
  - `hero-foreground`, `hero-chip`, `hero-chip-foreground`, `promo-foreground`
- `resolveSiteTokens` shifts the green family (`brand-green`, `brand-green-dark`, `brand-mint`) from `#67bd31` to `site.brand`. The other tokens change only through `site.tokens`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/theme/presets.test.ts
const globals = readFileSync("app/globals.css", "utf8")
it("SP_SITE equals app/globals.css brand tokens (ruling 4)", () => {
  for (const t of SITE_TOKENS) expect(globals).toContain(`--color-${t}: ${SP_SITE[t]};`)
})
it("SP_ADMIN parses into ADMIN_DEFAULT unchanged", () => {
  for (const t of ADMIN_TOKENS) expect(toHex(ADMIN_DEFAULT.light[t])).toBe(SP_ADMIN_LIGHT[t])
})
// tests/unit/theme/css.test.ts
it("default theme emits nothing", () => {
  expect(siteThemeCss(DEFAULT_THEME.site)).toBe("")
  expect(adminThemeCss(DEFAULT_THEME.admin)).toBe("")
})
it("a brand change emits only the green family on :root", () => {
  const css = siteThemeCss({ ...DEFAULT_THEME.site, brand: ColorValue.parse("#2f5f8a") })
  expect(css).toMatch(/^:root\{--color-brand-green:oklch\([^)]+\);--color-brand-green-dark:oklch\([^)]+\);--color-brand-mint:oklch\([^)]+\)\}$/)
})
it("admin primary change emits light and dark blocks, radius only when changed", () => {
  const css = adminThemeCss({ ...DEFAULT_THEME.admin, primary: ColorValue.parse("#157d38"), radius: 0.5 })
  expect(css).toContain("html[data-admin]{"); expect(css).toContain("html[data-admin].dark{"); expect(css).toContain("--radius:0.5rem")
  expect(css).not.toMatch(/--destructive:/)
})
// tests/unit/theme/color.test.ts
it.each(["red", "rgb(0,0,0)", "var(--x)", "#fff", "#12345g", "oklch(1 0 0);--x:1", "red;}body{", "x".repeat(65)])("rejects %s", (s) => expect(parseColor(s)).toBeNull())
it("round-trips hex", () => expect(toHex(parseColor("#367318")!)).toBe("#367318"))
// tests/unit/theme/checks.test.ts
it("every preset × mode passes admin pairs", () => {
  for (const p of PRESET_IDS) expect(checkTheme({ ...DEFAULT_THEME, admin: { ...DEFAULT_THEME.admin, preset: p, primary: null } })).toEqual([])
})
it("a pale primary fails and fixAll repairs it", () => {
  const bad = { ...DEFAULT_THEME, admin: { ...DEFAULT_THEME.admin, primary: ColorValue.parse("#d4f5c0") } }
  expect(checkTheme(bad).length).toBeGreaterThan(0)
  expect(fixAll(bad).remaining).toEqual([])
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run --project unit tests/unit/theme`

Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the nine files**

Port them from MK and apply the SP base tables. Keep every file pure: no React, no `server/`.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project unit tests/unit/theme tests/unit/admin`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit `lib/theme/*` and `tests/unit/theme/*` with the message:

```
feat(theme): pure theme engine with SP admin/site base tables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task C2: Theme storage, API, `appearance` permission (migration 0010)

**Files:**
- Create:
  - `server/modules/theme/{service,routes,queries}.ts`
  - `lib/schemas/api/theme.ts`
  - `server/db/migrations/0010_theme.sql` (+ `meta/` journal and snapshot)
  - `tests/integration/api/theme.test.ts`
  - `tests/integration/db/theme-migration.test.ts`
- Modify:
  - `lib/auth/permissions.ts`: add `appearance: ["read","update","publish"]`. Grants: owner/admin all; editor, marketer, viewer read.
  - `tests/unit/permissions.test.ts`: the literal matrix.
  - `lib/schemas/settings/index.ts`: add `theme: ThemeConfig` to `settingsSchemas`. Do **not** add it to `PUBLIC_SETTINGS_KEYS` or `EDITABLE_SETTINGS_KEYS`.
  - `server/api/app.ts`: mount `/api/v1/admin/appearance`.
  - `lib/schemas/api/content.ts`: add `"theme"` to the settings revision read allow-list for `appearance:read`.
  - `server/db/seed/fixtures/settings.ts`: `theme: DEFAULT_THEME`.

**Interfaces:**
- Consumes:
  - `ThemeConfig`, `DEFAULT_THEME`, `checkTheme`, `PRESETS` (C1)
  - `saveDraft`, `publish`, `restoreRevision`, `VersionedStore` (`server/lib/versioning.ts`)
  - the settings repo used by `server/modules/settings/service.ts`
  - `invalidate`, `tag.settings`, `writeAudit`
- Produces:

```ts
// lib/schemas/api/theme.ts
export type ThemeDto = { draft: ThemeConfigValue; published: ThemeConfigValue | null; version: number; updatedAt: string; issues: ContrastIssue[]; hasDraft: boolean }
export const themeDraftInput: z.ZodObject<{ version: number; draft: typeof ThemeConfig }>
export const themeResetInput: z.ZodObject<{ version: number; preset: PresetId; scope: "site" | "admin" | "both" }>
export const themeVersionInput: z.ZodObject<{ version: number }>
export const themeRestoreInput: z.ZodObject<{ version: number; revisionId: string }>
// server/modules/theme/service.ts
export async function getTheme(actor: Actor): Promise<ThemeDto>                     // appearance:read
export async function saveThemeDraft(actor: Actor, input: ThemeDraftInput): Promise<ThemeDto>   // appearance:update; 409 stale
export async function publishTheme(actor: Actor, input: { version: number }): Promise<ThemeDto> // appearance:publish; VALIDATION_FAILED {fieldErrors:{draft:[describeIssue…]}} if checkTheme non-empty; revision + audit "appearance.publish" + invalidate(tag.settings("theme"))
export async function discardThemeDraft(actor: Actor, input: { version: number }): Promise<ThemeDto>
export async function resetThemeDraft(actor: Actor, input: ThemeResetInput): Promise<ThemeDto>   // replaces site/admin/both with preset defaults
export async function restoreTheme(actor: Actor, input: ThemeRestoreInput): Promise<ThemeDto>
// server/modules/theme/queries.ts
export async function getPublishedTheme(): Promise<ThemeConfigValue>   // 'use cache'; cacheTag(tag.settings("theme")); DEFAULT_THEME when row missing/invalid
export async function getPreviewableSiteTheme(): Promise<SiteThemeConfig> // isPreviewing() ? draft.site : published.site (no cache when previewing)
```

Routes, base `/api/v1/admin/appearance`, each in the order `can()` → `zv()` → service:

| Method | Path |
|---|---|
| `GET` | `/` |
| `PUT` | `/draft` |
| `POST` | `/publish` |
| `POST` | `/discard` |
| `POST` | `/reset` |
| `POST` | `/restore` |

Revisions are listed through the existing `GET /api/v1/admin/revisions/settings/theme`.

**Migration `0010_theme`:**
- Generate it with `pnpm db:generate --custom --name theme`, then add:

```sql
INSERT INTO "settings" ("key","draft","published","version","updated_at")
VALUES ('theme', '<DEFAULT_THEME json>'::jsonb, '<DEFAULT_THEME json>'::jsonb, 1, now())
ON CONFLICT ("key") DO NOTHING;
```

- The JSON literal is `JSON.stringify(DEFAULT_THEME)`. Paste the exact output; `tests/integration/db/theme-migration.test.ts` asserts `ThemeConfig.parse(row.published)` deep-equals `DEFAULT_THEME`.

- [ ] **Step 1: Write the failing tests**

`tests/integration/api/theme.test.ts`, using the existing `tests/integration/helpers/auth.ts` actors:

```ts
it("owner saves a draft, publish bumps version, writes a revision and audit", async () => { … expect(dto.version).toBe(2); expect(await countRevisions("settings", "theme")).toBe(1) })
it("stale version → 409 with current", async () => { … expect(res.status).toBe(409); expect(body.error.current.version).toBe(2) })
it("publish blocked while contrast fails", async () => { /* primary #d4f5c0 */ expect(res.status).toBe(422); expect(body.error.fieldErrors.draft[0]).toMatch(/needs 4.5:1/) })
it("rejects a colour injection", async () => { /* primary "red;}body{" */ expect(res.status).toBe(422) })
it("reset admin to evergreen keeps site", async () => { … })
it("marketer reads, cannot save (403); viewer reads; author 403 on GET", async () => { … })
```

Also update `tests/unit/permissions.test.ts`: add the `appearance` rows to the literal expected matrix.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test:integration tests/integration/api/theme.test.ts tests/integration/db/theme-migration.test.ts && pnpm vitest run --project unit tests/unit/permissions.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the migration, permissions, schema key, service, routes and queries**

- [ ] **Step 4: Run the same commands, plus `pnpm db:migrate` on `sp_dev`**

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message:

```
feat(theme): settings-backed theme draft/publish API and appearance permission

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task C3: Runtime theme application (admin + site)

**Files:**
- Create:
  - `components/admin/theme/admin-theme-style.tsx` (server)
  - `components/admin/theme/default-mode.tsx` (client)
  - `components/site-theme-style.tsx` (server, public)
  - `tests/integration/theme/runtime.test.tsx`
  - `tests/dom/default-mode.test.tsx`
- Modify:
  - `app/(admin)/admin/layout.tsx`: inside `<body>`, `<Suspense fallback={null}><AdminThemeStyle /></Suspense>`.
  - `app/(site)/layout.tsx`: inside `<body>`, before content, `<Suspense fallback={null}><SiteThemeStyle /></Suspense>`.

**Interfaces:**
- Consumes: `getPublishedTheme`, `getPreviewableSiteTheme` (C2); `adminThemeCss`, `siteThemeCss` (C1); `ADMIN_THEME_STORAGE_KEY = "sp-admin-theme"` (`components/admin/theme-provider.tsx`).
- Produces:
  - **`AdminThemeStyle()`:** `await connection()`, then `const css = adminThemeCss((await getPublishedTheme()).admin)`. It returns `<><DefaultMode mode={admin.mode} />{css ? <style id="theme-tokens">{css}</style> : null}</>`.
  - **`DefaultMode({ mode })`:** client. Marker key `"sp-admin-theme-auto"`. If `localStorage[ADMIN_THEME_STORAGE_KEY]` is missing or equals the stored marker value, call `setTheme(mode)` and store the marker. Otherwise do nothing, because the user chose a theme themselves. Wrap every storage access in try/catch.
  - **`SiteThemeStyle()`:** `await connection()`, then `const css = siteThemeCss(await getPreviewableSiteTheme())`, then `return css ? <style id="site-theme">{css}</style> : null`. It fails closed to `null` on any error.

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/integration/theme/runtime.test.tsx (renders the async server components with react-dom/server)
it("seeded DB: site renders no style tag", async () => { expect(await renderToString(await SiteThemeStyle())).toBe("") })
it("published brand change: site renders :root override", async () => { /* publish via service */ expect(html).toContain('<style id="site-theme">:root{--color-brand-green:') })
it("admin default renders no theme-tokens style", async () => { expect(html).not.toContain("theme-tokens") })
```

```tsx
// tests/dom/default-mode.test.tsx
it("applies the published mode when the user never chose", …)
it("keeps the user's own choice", …)
it("survives localStorage throwing", …)
```

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement and wire both layouts**

- [ ] **Step 4: Run the tests and the public gate**

Run: `pnpm test:integration tests/integration/theme && pnpm vitest run --project dom tests/dom/default-mode.test.tsx && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:visual tests/visual/public-pages.spec.ts tests/visual/consent-banner.spec.ts`

Expected: PASS, 0 px.

- [ ] **Step 5: Commit**

Commit with the message `feat(theme): apply published admin/site theme; default emits nothing`, ending with the co-author line.

---

### Task C4: Appearance widgets

**Files:**
- Create:
  - `components/admin/appearance/{preset-gallery,colour-field,contrast-panel,admin-preview,use-live-admin}.tsx`
  - `tests/dom/appearance-widgets.test.tsx`
- Modify: `package.json` (`react-colorful@5.8.1`, after the 14-day check).

**Interfaces:**

```ts
export function PresetGallery(props: { value: PresetId; onChange(p: PresetId): void; scope: "site" | "admin"; label: string }): JSX.Element
// buttons with aria-pressed, three swatches each, visible label

export function ColourField(props: { id: string; label: string; value: string | null; onChange(v: string | null): void; clearable?: boolean; locked?: boolean; onLockChange?(l: boolean): void; description?: string }): JSX.Element
// swatch button → Popover with HexColorPicker + mono hex input (commit on blur/Enter)
// readout "oklch(…) · #hex"; invalid → "Use #rrggbb or oklch(L C H) colour" (aria-describedby)

export function ContrastPanel(props: { config: ThemeConfigValue; scope: "site" | "admin"; onFix(next: ThemeConfigValue): void }): JSX.Element
// table rows: pair label, ratio "4.62:1", rating badge text AAA/AA/Fails; "Fix automatically" per failing row; "Fix all" button

export function AdminPreview(props: { mode: "light" | "dark" }): JSX.Element
// card with Button primary/secondary/outline, Badge, Input, Switch, StatusPills, 5 chart swatches

export function useLiveAdmin(admin: AdminThemeConfig | null): void
// sets liveDeclarations on document.documentElement.style for the current resolved mode
// restores on unmount or null
```

- [ ] **Step 1: Write the failing DOM tests**

- The preset button sets `aria-pressed` and calls `onChange`.
- ColourField commits a typed hex on Enter; an invalid value shows the error and does not call `onChange`.
- ContrastPanel shows "Fails" and "Fix automatically" for a failing pair, and Fix calls `onFix` with a passing config.
- `useLiveAdmin` sets `--primary` inline and removes it on unmount.

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Install the dep and implement**

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project dom tests/dom/appearance-widgets.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(appearance): preset gallery, colour field, contrast panel, live admin preview`, ending with the co-author line.

---

### Task C5: `/admin/appearance` page

**Files:**
- Create:
  - `app/(admin)/admin/(panel)/appearance/page.tsx`
  - `components/admin/appearance/{appearance-view,brand-assets,theme-history,use-theme-autosave}.tsx`
  - `tests/e2e/appearance.spec.ts`
- Modify:
  - `lib/admin/nav.ts`: add item `appearance` (General group, before Site settings, `PaletteIcon`, keywords `["theme","colours","colors","brand","logo"]`, permission `{ appearance: ["read"] }`).
  - `tests/unit/admin/nav-registry.test.ts`
  - `tests/visual/admin-screens.spec.ts`: `appearance` light/dark.

**Interfaces:**
- Consumes: the C2 API via `api.appearance.*`; the C4 widgets; `ConflictDialog` and `RevisionDrawer` (`components/admin/editor/*`); the `MediaPicker` used by settings; `api.settings[":key"]` for `site` (logo/favicon draft).
- Produces `AppearanceView()`:
  - **Header:** PageHeader "Appearance" with status text (Saving… / Draft saved / Unsaved changes / Changed by someone else).
  - **Actions:**
    - Preview on site: flushes, then opens `previewHref("settings","theme")`. Add `"theme"` to the preview settings handling if `previewPath` needs it.
    - Discard draft.
    - Reset to preset…: a Dialog with a Select and a RadioGroup for scope.
    - Publish: disabled while there are issues or no draft. Needs `appearance:publish`.
  - **Banner** when there are issues: "Publishing is blocked until every pair passes."
  - **Tabs** Site / Admin, as in spec §6.2.
  - **Below the tabs:** BrandAssets and ThemeHistory (revisions with "Load into draft").
  - **Read-only** for roles without `appearance:update`: inputs disabled and no actions.
  - **Autosave:** 1.5 s debounce, single flight. A 409 opens `ConflictDialog`.

- [ ] **Step 1: Write the failing e2e test**

```ts
test("owner publishes an admin preset; admin recolours; reset restores", async ({ owner }) => {
  await owner.goto("/admin/appearance"); await owner.getByRole("tab", { name: "Admin" }).click()
  await owner.getByRole("button", { name: /Evergreen/ }).click()
  await expect(owner.locator("html")).toHaveAttribute("style", /--primary:/)          // live
  await owner.getByRole("button", { name: "Publish" }).click(); await owner.getByRole("button", { name: "Publish" }).last().click()
  await owner.goto("/admin"); await expect(owner.locator("style#theme-tokens")).toHaveCount(1)
  await owner.goto("/admin/appearance"); /* Reset to preset → Security Partners, Admin → Publish */
  await owner.goto("/admin"); await expect(owner.locator("style#theme-tokens")).toHaveCount(0)
})
test("marketer sees Appearance read-only", async ({ marketer }) => { … expect(publish).toHaveCount(0) })
test("site draft preview shows the draft; public stays default", async ({ owner, page }) => { … })
```

If `marketer` is missing from `tests/e2e/fixtures.ts`, add it.

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests**

Run: `pnpm test:e2e tests/e2e/appearance.spec.ts && pnpm vitest run --project unit tests/unit/admin`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(appearance): Appearance screen with site/admin themes, history and brand assets`, ending with the co-author line.

---

### Task C6: AI settings server (fields, providers, status) — migration 0011

**Files:**
- Create:
  - `server/db/migrations/0011_ai_settings.sql`
  - `lib/ai/base-url.ts`
  - `tests/unit/ai/base-url.test.ts`
  - `tests/integration/api/ai-settings.test.ts`
- Modify:
  - `lib/schemas/integrations/ai.ts`: the fields below.
  - `server/modules/ai/providers.ts`: google via `createGoogleGenerativeAI`; openai-compatible via `createOpenAICompatible({ baseURL, apiKey, name: "custom" })`.
  - `server/modules/integrations/service.ts`: the `shareEnquiryDetails` owner gate and acknowledgement stamping; provider/base-URL change drops the stored key.
  - `server/modules/ai/service.ts`: `getAiStatus` shape; `AI_MAX_OUTPUT_TOKENS` → `config.maxOutputTokens`.
  - `server/modules/ai/routes.ts`: `POST /ai/models` (list models, `integration:update`, rate-limited 10/min).
  - `lib/schemas/api/ai.ts`: `AiStatusDto`.
  - `package.json`: the two deps.

New fields in `lib/schemas/integrations/ai.ts`:
- `AI_PROVIDERS = ["anthropic","openai","google","openai-compatible"]`
- `baseUrl`
- `extraInstructions` (≤ 2000)
- `maxOutputTokens` (64–8192, default 1024)
- `shareEnquiryDetails: { enabled, acknowledgedBy, acknowledgedAt }`
- update input: `shareEnquiryDetails?: { enabled: boolean; acknowledge?: boolean }`

**Interfaces:**

```ts
// lib/ai/base-url.ts
export function baseUrlProblem(raw: string, opts: { allowLocalHttp: boolean }): string | null
// https only; rejects IP literals in 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7, fe80::/10, 0.0.0.0, hostnames "localhost"/"*.local"/"*.internal" unless allowLocalHttp and http://localhost
export function normaliseBaseUrl(raw: string): string   // trims, drops trailing "/"
// lib/schemas/api/ai.ts
export type AiStatusDto = { available: boolean; canManage: boolean; reason: "off" | "unconfigured" | "not-allowed" | null; model: string | null; readOnly: boolean }
// server/modules/ai/service.ts
export async function getAiStatus(actor: Actor): Promise<AiStatusDto>   // canManage = hasPermission(actor.roles,{integration:["update"]})
export async function listModels(actor: Actor, input: { provider: AiProvider; baseUrl: string }): Promise<{ models: string[] }> // uses saved key; masked errors
```

Rules:
- Enabling `shareEnquiryDetails` requires `owner:manage` (otherwise 403) **and** `acknowledge: true` (otherwise 422 "Confirm the acknowledgement first").
- Enabling stamps `acknowledgedBy` (user id) and `acknowledgedAt`. Disabling clears both.

**Migration 0011:** a jsonb merge into the `integrations.ai` row's `draft`:

```json
{"baseUrl":"","extraInstructions":"","maxOutputTokens":1024,"shareEnquiryDetails":{"enabled":false,"acknowledgedBy":null,"acknowledgedAt":null}}
```

Existing keys win (`'{…}'::jsonb || draft`). Integrations write no revisions, per the ruling.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/ai/base-url.test.ts
it.each(["http://api.x.com", "https://10.0.0.1", "https://192.168.1.2/v1", "https://[::1]", "https://169.254.169.254", "https://localhost", "https://a.internal"])("rejects %s", (u) => expect(baseUrlProblem(u, { allowLocalHttp: false })).not.toBeNull())
it("accepts https public hosts and dev localhost", () => {
  expect(baseUrlProblem("https://api.groq.com/openai/v1", { allowLocalHttp: false })).toBeNull()
  expect(baseUrlProblem("http://localhost:11434/v1", { allowLocalHttp: true })).toBeNull()
})
// tests/integration/api/ai-settings.test.ts
it("status for an owner on a fresh DB: available false, canManage true, reason unconfigured")
it("status for an editor on a fresh DB: canManage false")
it("admin cannot enable shareEnquiryDetails (403); owner without acknowledge → 422; owner with → stored with acknowledgedBy")
it("changing provider drops the saved key (secret set:false afterwards)")
it("maxOutputTokens 9000 → 422")
it("migration 0011 backfills an existing row without touching apiKey")
```

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Install the deps (14-day check) and implement**

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project unit tests/unit/ai && pnpm test:integration tests/integration/api/ai-settings.test.ts tests/integration/api/ai.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(ai): MK settings fields, Gemini/OpenAI-compatible providers, manager status`, ending with the co-author line.

---

### Task C7: AI settings page + discoverability

**Files:**
- Create:
  - `components/admin/ai/ai-settings-view.tsx`
  - `tests/dom/ai-settings-view.test.tsx`
  - `tests/e2e/ai-setup.spec.ts`
- Modify:
  - `app/(admin)/admin/(panel)/settings/ai-assistant/page.tsx`: render `AiSettingsView`.
  - `components/admin/ai/assistant-button.tsx`: visible when `available || canManage`.
  - `components/admin/ai/assistant-panel.tsx`: empty state when unavailable.
  - `server/modules/dashboard/service.ts`: Next-up `"ai"` item for managers when not available.
  - `lib/schemas/api/dashboard.ts`: `NextUpItem.id` union gets `"ai"`.

**Interfaces:**
- `AiSettingsView()` is a form over `api.integrations[":key"]` for `integrations.ai`. It has the spec §6.3 fields, in order:

| Field | Behaviour |
|---|---|
| Enabled | Switch |
| Provider | RadioGroup |
| Base URL | shown only for openai-compatible |
| API key | Keep / Replace / Remove radio, plus a password input; warning text when the provider or base URL changed |
| Model | Input with `list="ai-models"`, plus a "List models" button |
| Who can use it | Checkbox group; owner/admin checked and disabled |
| Extra instructions | Textarea with a /2000 counter |
| Longest answer | number input 64–8192 |
| Let the assistant read enquiry details | Switch, plus an acknowledgement Checkbox; the whole fieldset is visible only to owners |
| Test | button; disabled with the tooltip "Save first" when dirty |

- Header: PageHeader "AI assistant", "Choose the provider and who can use the assistant."
- The empty state in `AssistantPanel` when `!available`: "The AI assistant is turned off or not set up yet." Below it, for `canManage` only, a `<Link href="/admin/settings/ai-assistant">Set up AI assistant</Link>`.
- Next-up item: `{ id: "ai", title: "Turn on the AI assistant", description: "Draft copy, check SEO and summarise enquiries.", href: "/admin/settings/ai-assistant", done: false }`.

- [ ] **Step 1: Write the failing tests**

DOM tests:
- An admin does not see the enquiry-details fieldset; an owner does.
- The Test button is disabled while dirty.
- The Base URL appears only for openai-compatible.

E2E test:
- On a fresh DB, the owner sees the sparkle button.
- Opening it shows the "Set up AI assistant" link, and clicking it lands on `/admin/settings/ai-assistant`.
- An editor sees no sparkle button.

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project dom tests/dom/ai-settings-view.test.tsx && pnpm test:e2e tests/e2e/ai-setup.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(ai): AI assistant settings page and set-up entry points`, ending with the co-author line.

---

### Task C8: Read-only AI tools + prompt composition

**Files:**
- Create:
  - `server/modules/ai/tools.ts`
  - `server/modules/ai/tool-data.ts`
  - `tests/integration/api/ai-tools.test.ts`
  - `tests/unit/ai/prompt.test.ts`
- Modify:
  - `server/modules/ai/service.ts`: pass `tools`, `stopWhen: stepCountIs(5)`, `instructions: buildSystemPrompt(...)` and `maxOutputTokens: config.maxOutputTokens`. Keep emitting text-delta events only.
  - `server/modules/ai/prompt.ts`: add `buildSystemPrompt`. `ASSISTANT_RULES` stays as the rules section.

**Interfaces:**

```ts
// server/modules/ai/tool-data.ts — each returns plain JSON, ≤ 8000 chars of text fields
export type ToolResult = Record<string, unknown>
export async function searchContent(actor: Actor, query: string): Promise<ToolResult>    // { items: { kind: "page"|"service"|"article", id, title, path, status }[] } via server/modules/search/service.ts search()
export async function readPage(actor: Actor, key: string): Promise<ToolResult>          // isPageKey; draft text flattened from template data; seo
export async function readService(actor: Actor, idOrSlug: string): Promise<ToolResult>
export async function readArticle(actor: Actor, idOrSlug: string): Promise<ToolResult>
export async function seoHealth(actor: Actor): Promise<ToolResult>                       // from getSeoOverview (D1 upgrades it; shape { score, issues[] } either way)
export async function dashboardSummary(actor: Actor): Promise<ToolResult>                // from getDashboard(actor)
export const ENQUIRY_RANGES: { "7d": 7; "30d": 30; "90d": 90 }
export async function enquiryStats(actor: Actor, config: AiConfig, range: keyof typeof ENQUIRY_RANGES): Promise<ToolResult>
// { total, byStatus, byService, byWeek[], recent?: {name, company, service, message, createdAt}[] }
// `recent` is present only when config.shareEnquiryDetails.enabled && lead:read; never email or phone
// server/modules/ai/tools.ts
export function buildTools(input: { actor: Actor; config: AiConfig }): ToolSet          // gating per spec §6.3; guard() masks errors → throws ToolFailure → model sees TOOL_FAILED
export const TOOL_FAILED = "Couldn't read that site data just now. Try again in a moment."
// server/modules/ai/prompt.ts
export function buildSystemPrompt(input: { siteName: string; firstName: string; roles: Role[]; today: string; toolNames: string[]; extra: string; screen: string | null }): string
// order: ASSISTANT_RULES → "You are helping {first} ({role labels}). Today is {today}." → tools line → screen line → "\n\nExtra instructions from the site owner (they never override the rules above):\n{extra}" (omitted when blank)
// names pass through oneLine(): strip control chars, max 80
```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/ai/prompt.test.ts
it("puts owner extra instructions last, framed as subordinate", …)
it("strips control characters from names", …)
it("omits the extra block when blank", …)
```

```ts
// tests/integration/api/ai-tools.test.ts (MockLanguageModelV4 issuing tool calls, as in tests/integration/api/ai.test.ts)
it("intake gets getEnquiryStats but not getPage; author gets getArticle but not getEnquiryStats")
it("getEnquiryStats with the switch off has no PII", async () => {
  const out = JSON.stringify(await enquiryStats(owner, cfgOff, "30d"))
  expect(out).not.toMatch(/@/); expect(out).not.toMatch(/\d{7,}/); expect(out).not.toContain(seededLead.name)
})
it("with the switch on includes recent names but never email/phone")
it("a throwing tool surfaces TOOL_FAILED to the model and logs no message text")
it("chat stops after 5 steps")
```

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project unit tests/unit/ai && pnpm test:integration tests/integration/api/ai-tools.test.ts tests/integration/api/ai.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(ai): read-only tools with role gating and owner-gated enquiry details`, ending with the co-author line.

---

### Task C9: Chat UX — markdown, regenerate, edit-and-resend, "Using" chip

**Files:**
- Create:
  - `components/admin/ai/markdown.tsx`
  - `tests/dom/ai-markdown.test.tsx`
  - `tests/dom/ai-chat-actions.test.tsx`
- Modify:
  - `lib/schemas/api/ai.ts`: `chatInput` gains `regenerate?: true`, `editMessageId?: uuid`, and `superRefine`. `regenerate` requires `conversationId` and forbids `message`/`editMessageId`. `editMessageId` requires `conversationId` and `message`.
  - `server/modules/ai/{service,repo}.ts`: `dropLastReply(conversationId)` deletes the last row only if it is an assistant row; `replaceFrom(conversationId, messageId, newText)` deletes rows with `created_at >= that message's` and inserts the new user message; the ownership check runs first.
  - `components/admin/ai/{message-list,use-assistant-chat,assistant-panel}.tsx`
  - `tests/integration/api/ai.test.ts`

**Interfaces:**

```ts
// components/admin/ai/markdown.tsx
export type MdBlock = { kind: "p"; text: string } | { kind: "h"; level: number; text: string } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[]; start: number } | { kind: "code"; lang: string; text: string } | { kind: "quote"; paragraphs: string[] } | { kind: "table"; head: string[]; rows: string[][] } | { kind: "hr" }
export function parseBlocks(source: string): MdBlock[]
export function safeHref(raw: string): string | null    // https:, mailto: (no query), or "/" relative not starting "/api"; else null
export function Markdown(props: { text: string }): JSX.Element   // never dangerouslySetInnerHTML; headings drawn as <p className="font-semibold">
// use-assistant-chat.ts additions
regenerate(): Promise<void>                        // POST {conversationId, regenerate:true}
edit(messageId: string, text: string): Promise<void>  // POST {conversationId, message:text, editMessageId}; trims local messages from that id
```

- **MessageList:** assistant messages render through `Markdown`; user messages stay plain text.
- **Last assistant message:** a "Regenerate" button.
- **Each user message:** an "Edit" button that opens an inline Textarea with Save & resend / Cancel.
- **"Using: {screen title}" chip** above the composer, with a dismiss button (`aria-label="Don't send this screen"`). Dismissing it removes the context from the next send.

- [ ] **Step 1: Write the failing tests**

```tsx
it("renders lists, tables and code without HTML injection", () => {
  render(<Markdown text={"- a\n- b\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))"} />)
  expect(screen.getAllByRole("listitem")).toHaveLength(2)
  expect(document.querySelector("img")).toBeNull()
  expect(screen.queryByRole("link", { name: "x" })).toBeNull()
})
it("regenerate posts regenerate:true and replaces the last reply", …)
it("edit trims later messages and resends", …)
it("dismissing the Using chip sends no context", …)
```

Integration tests:
- Regenerating someone else's conversation returns 404.
- `editMessageId` of an assistant message returns 422.
- Regenerate removes exactly one assistant row.

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run --project dom tests/dom/ai-markdown.test.tsx tests/dom/ai-chat-actions.test.tsx && pnpm test:integration tests/integration/api/ai.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit with the message `feat(ai): markdown replies, regenerate, edit and resend, context chip`, ending with the co-author line.

---

### Task C10: Phase C gate

- [ ] **Step 1: Run the full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:e2e
```

Expected: green.

- [ ] **Step 2: Confirm the public baselines**

Run: `pnpm test:visual tests/visual/public-pages.spec.ts tests/visual/consent-banner.spec.ts`

Expected: 0 px.

- [ ] **Step 3: Re-shoot the admin baselines**

Run `pnpm test:visual:update tests/visual/admin-*.spec.ts`, then `pnpm test:visual` twice; both runs must be green.

- [ ] **Step 4: Commit**

Commit the screenshots with the message `test(visual): re-baseline admin for Appearance and AI (phase C)`, ending with the co-author line.
