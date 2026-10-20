# Phase D1 — SEO + Redirects

> Part of `docs/superpowers/plans/2026-10-19-mk-parity.md`. Spec §7.1, §8 (0012, 0013, 0014), §13. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring SEO and redirects up to MK's level:
- 8 checks with Fix links and alt-text coverage (media decorative/caption/missing-alt filter)
- an SEO tab inside each editor, with SERP, social card and a live checklist
- social title/description/twitter card
- site-wide noindex, verification tokens and a crawler view
- redirect toggle, note, last hit, automatic badge, 307/308 and CSV import/export

**Architecture:**
- `lib/seo/checks.ts` is pure and runs both server-side (health) and client-side (the live checklist).
- Health is computed in `server/modules/seo/service.ts` and joins the media alt state.
- `SeoPanel` is one component used by the overview sheet, the editors and (D5) the builder.
- Redirect columns come from one migration. The proxy resolver gains the `is_active` filter and records `last_hit_at`.

**Tech Stack:** existing stack only. The CSV parser is written in-house; no new deps.

## Global Constraints

Master plan constraints, plus:
- Per-record SEO saves stay live, last write wins, and do not bump `version` (existing ruling).
- Every new `seo` field is optional. Seeded records produce **identical** metadata. Pinned by `tests/unit/templates/page-meta.test.ts`, which must still pass unchanged apart from new assertions.
- Verification `<meta>` is emitted only when the token is non-empty.
- Robots `noindex` mode changes `robots.txt` and the root metadata only.
- The redirect rules from Phase 8 stay: `fromPathProblem`, `toPathProblem`, `MAX_REDIRECT_HOPS = 5`, external `https://` targets allowed, editors get no `redirect` permission.

## Review Focus

1. **CSV import with hostile or messy content.** Covers formula cells (`=HYPERLINK(...)`), BOM, CRLF, quoted commas and quotes, blank lines, duplicate `from` within the file, more than 1000 rows, and a chain created across two rows. Expected: preview errors per line, commit is all-or-nothing, and export guards formulas by prefixing `'`. Pinned in D1.8.
2. **An inactive redirect whose `from` path later becomes a live page.** The resolver must serve the page, the list must show the redirect as Off, and reactivating it must be refused while the page is live. Pinned in D1.7.
3. **A media item used in several records loses its alt text.** Every record using it gets an `alt-text` issue, and the alt card counts the item once. Pinned in D1.2.
4. **Title uniqueness and case or whitespace.** "About us" and "about us " count as duplicates (normalised trim + lower-case). Pinned in D1.2.
5. **Unsaved SEO changes in an editor tab.** Switching to the Content tab keeps them, and the existing unsaved guard warns on navigation away. Pinned in D1.4.

---

### Task D1.1: Media decorative, caption, missing-alt (migration 0012)

**Files:**
- Create: `server/db/migrations/0012_media_alt.sql` (generated), `tests/integration/api/media-alt.test.ts`
- Modify:
  - `server/db/schema/media.ts`: `isDecorative: boolean("is_decorative").notNull().default(false)`, `caption: text("caption").notNull().default("")`
  - `lib/schemas/api/media.ts`:
    - `mediaUpdateInput` gains `isDecorative?: boolean` and `caption?: string` (≤ 300, control characters stripped like alt)
    - `mediaListQuery` gains `missingAlt?: "true"`
    - `MediaItem` gains `isDecorative` and `caption`
  - `server/modules/media/{repo,service}.ts`: the filter is `mime like 'image/%' and alt = '' and not is_decorative`. Setting `isDecorative: true` keeps the alt text as entered (it is not cleared).
  - `components/admin/media/media-details.tsx`: add a "Decorative image (no alt text needed)" Checkbox, a Caption Textarea and an alt counter `n/500`. When decorative, the alt field is shown but optional.
  - `components/admin/media/library.tsx`: a "Missing alt text" filter chip bound to `?missingAlt=true`, plus support for `?open=<id>` to open the details sheet.
- Test: `tests/integration/api/media-alt.test.ts`, `tests/dom/media-details.test.tsx` (extend)

**Interfaces:**
- Produces:
  - `MediaItem.isDecorative: boolean` and `MediaItem.caption: string`
  - `GET /api/v1/admin/media?missingAlt=true`
  - `server/modules/media/repo.ts` `altSummary(db): Promise<{ images: number; described: number; decorative: number; missing: number }>`, used in D1.2

- [ ] **Step 1: Write the failing tests**

```ts
it("missingAlt lists images with empty alt that are not decorative, never PDFs", async () => { … expect(ids).toEqual([noAltImage.id]) })
it("PATCH isDecorative + caption round-trips; caption > 300 → 422", …)
it("altSummary counts", async () => { expect(await altSummary(db)).toEqual({ images: 3, described: 1, decorative: 1, missing: 1 }) })
```

- [ ] **Step 2: Run them and confirm they fail.** `pnpm test:integration tests/integration/api/media-alt.test.ts`

- [ ] **Step 3: Implement**
  1. Run `pnpm db:generate` (name `media_alt`).
  2. Update the schema, service and UI.

- [ ] **Step 4: Run the tests and confirm they pass.** Add `pnpm vitest run --project dom tests/dom/media-details.test.tsx`.

- [ ] **Step 5: Commit**

Message: `feat(media): decorative flag, caption and missing-alt filter`

---

### Task D1.2: Eight SEO checks + health with Fix links

**Files:**
- Modify:
  - `lib/seo/checks.ts`: full rewrite to the Shared contracts shape. `SEO_CHECK_COUNT` stays exported.
  - `server/modules/seo/{service,repo}.ts`: compute health.
  - `lib/schemas/api/seo.ts`: DTOs.
  - `components/admin/dashboard/content-health.tsx`: consume the new DTO.
- Create: `lib/seo/internal-links.ts`, `lib/seo/share-image.ts`
- Test: `tests/unit/seo/checks.test.ts` (rewrite), `tests/unit/seo/internal-links.test.ts`, `tests/integration/api/seo-health.test.ts`

**Interfaces:**

```ts
// lib/seo/checks.ts — see master Shared contracts; constants:
export const TITLE_RANGE = [30, 60] as const
export const DESCRIPTION_RANGE = [70, 160] as const
// messages (exact):
// title-length  "Title is {n} characters (aim for 30–60)"
// title-unique  "Another page uses the same title"
// description   "Add a meta description" | "Description is {n} characters (aim for 70–160)" | "Uses the site-wide default description"
// og-image      "Share image should be at least 1200×630 (1.91:1)"
// alt-text      "{n} image(s) missing alt text"
// h1            "No main heading (H1)"
// indexable     "Hidden from search engines" | "The whole site is hidden from search engines (SEO › Defaults)"
// internal-link "No links to other pages on this site"
// lib/seo/share-image.ts
export function isShareImageSize(w: number, h: number): boolean   // w>=1200 && h>=630 && |w/h - 1.91| <= 0.05
// lib/seo/internal-links.ts
export function countInternalLinks(doc: RichTextDoc): number      // link marks whose href starts "/" (not "//") or matches site origin
// lib/schemas/api/seo.ts
export type SeoIssueDto = { kind: "page" | "service" | "article" | "builder" | "media"; id: string; title: string; path: string | null; check: SeoCheckId; message: string; fixHref: string }
export type SeoHealthDto = { score: number; passed: number; total: number; entities: { kind; id; title; path; published: boolean; results: CheckResult[] }[]; issues: SeoIssueDto[]; alt: { images: number; described: number; decorative: number; missing: number } }
// server/modules/seo/service.ts
export async function getSeoHealth(actor: Actor): Promise<SeoHealthDto>   // seo:read; replaces getSeoOverview (keep getSeoOverview as a thin alias returning entries for the sheet)
```

Rules:
- `hasH1` is `true` for fixed pages, services and articles; their templates always render one.
- `internalLinks` is `null` (the check passes) for records without rich text.
- `imagesMissingAlt` counts `media_usages` for the record joined to media where alt is empty and the item is not decorative.
- `fixHref` follows spec §7.1. A media issue uses `/admin/media?missingAlt=true&open=<id>`.
- `score = round(passed / total * 100)`, or 100 when `total` is 0.
- `GET /api/v1/admin/seo/health` is served alongside the existing `/overview`.

- [ ] **Step 1: Write the failing tests**

```ts
it("title 29 → title-length fails with the exact message", () => {
  expect(runChecks({ ...ok, title: "x".repeat(29) }).find((r) => r.id === "title-length")).toEqual({ id: "title-length", ok: false, message: "Title is 29 characters (aim for 30–60)" })
})
it("og-image 1200×630 passes; 1200×600 fails; null (generated card) passes", …)
it("siteNoindex makes indexable fail with the site message", …)
it("all eight ids in order", () => expect(runChecks(ok).map((r) => r.id)).toEqual([...SEO_CHECKS]))
// integration
it("duplicate titles (case/space-insensitive) fail title-unique on both records")
it("one shared image without alt: alt card missing=1, both records have alt-text issues, media issue listed once")
it("fixHref per kind")
```

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Confirm they pass.** `pnpm vitest run --project unit tests/unit/seo && pnpm test:integration tests/integration/api/seo-health.test.ts tests/integration/api/seo.test.ts`

- [ ] **Step 5: Commit**

Message: `feat(seo): eight checks, grouped issues with fix links, alt coverage`

---

### Task D1.3: Social title/description/twitter card + metadata

**Files:**
- Modify:
  - `lib/schemas/common.ts` `seo`: add `ogTitle?: string` (≤ 70), `ogDescription?: string` (≤ 200), `twitterCard?: "summary_large_image" | "summary"`
  - `templates/shared/page-meta.ts`: rules below
  - `tests/unit/templates/page-meta.test.ts`
- Test: `tests/unit/templates/page-meta.test.ts` (extend), `tests/unit/schemas/seo.test.ts`

Rules for `page-meta.ts`:
- `openGraph.title` is `filled(ogTitle) ?? title`.
- `openGraph.description` and `twitter.description` are `filled(ogDescription) ?? description`.
- `twitter.card` is `twitterCard ?? "summary_large_image"`.

**Interfaces:** the `Seo` type gains the three optional fields. `SeoPanel` (D1.4) edits them.

- [ ] **Step 1: Write the failing tests.** The existing home test stays as is, which proves seeded output is unchanged. Add:

```ts
it("ogTitle/ogDescription override social only; page title unchanged", () => { … expect(meta.title).toBe(base.title); expect(meta.openGraph).toMatchObject({ title: "Social" }) })
it("twitterCard summary", …)
it("ogTitle > 70 rejected by the schema", …)
```

- [ ] **Step 2: Confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Confirm they pass.** Then run the public gate: `pnpm test:visual tests/visual/public-pages.spec.ts` (expect 0 px) and `pnpm test:e2e tests/e2e/seo.spec.ts`.

- [ ] **Step 5: Commit**

Message: `feat(seo): social title, description and Twitter card per record`

---

### Task D1.4: SeoPanel + SEO tab inside editors

**Files:**
- Create: `components/admin/seo/{seo-panel,social-card,seo-checklist}.tsx`, `tests/dom/seo-panel.test.tsx`, `tests/e2e/seo-tab.spec.ts`
- Modify:
  - `components/admin/seo/serp-preview.tsx`: MK style
  - `components/admin/seo/seo-sheet.tsx`: render `SeoPanel`
  - `components/admin/{pages/page-editor,services/service-editor,articles/article-editor}.tsx`: top `Tabs` Content / SEO bound to `?tab=`; the SEO tab renders `SeoPanel` with `fallback` from the **unsaved** draft (title, excerpt or description)
  - `components/admin/seo/seo-link.tsx`: becomes "SEO" `?tab=seo` on the same page

**Interfaces:**
- Consumes: `runChecks`, `isShareImageSize` (D1.2), `Seo` (D1.3), the `PUT /api/v1/admin/seo/entries/:kind/:id` endpoint, `ogImagePath` and `MediaPicker`.
- Produces: `SeoPanel` and `SeoPanelProps` exactly as in the master plan's Shared contracts, plus:

```ts
export function SerpPreview(props: { host: string; path: string; title: string; description: string }): JSX.Element  // "host › seg › seg"; title colour #1a0dab / dark #8ab4f8
export function SocialCard(props: { host: string; title: string; description: string; imageUrl: string }): JSX.Element // 1.91:1 frame
export function SeoChecklist(props: { results: CheckResult[] }): JSX.Element   // list with ✓/✗ icon + text (not colour only); shows local checks: title-length, description, og-image, indexable
```

Layout: form on the left (fields from D1.3, plus canonical and noindex); aside on the right with SerpPreview, SocialCard and SeoChecklist, which update on every keystroke from the RHF `watch`. `SocialCard.imageUrl` is the ogImage media url, otherwise `ogImagePath(kind, id)`; builder pages use `/og/builder/<id>` (D5.3).

- [ ] **Step 1: Write the failing tests**

DOM:
- Typing a 20-character title shows the title-length check as failed in the checklist, without saving.
- SERP shows "example.ie › services › alarm-responses".
- With no ogImage, the social card img src is `/og/service/<id>`.

E2E:
- Open `/admin/services/<id>?tab=seo`, edit the social title, save, reload; the value persists.
- The Content tab still holds an unsaved content edit after a tab switch.
- An issue Fix link from `/admin/seo` lands on `?tab=seo`.

- [ ] **Step 2: Confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Confirm they pass.** `pnpm vitest run --project dom tests/dom/seo-panel.test.tsx && pnpm test:e2e tests/e2e/seo-tab.spec.ts tests/e2e/seo-admin.spec.ts`

- [ ] **Step 5: Commit**

Message: `feat(seo): SEO tab in editors with SERP, social card and live checklist`

---

### Task D1.5: SEO overview — alt card, grouped issues, Needs work filter

**Files:**
- Modify: `components/admin/seo/seo-overview.tsx`, `tests/e2e/seo-admin.spec.ts`
- Create: `components/admin/seo/{alt-text-card,issues-list}.tsx`, `tests/dom/seo-overview.test.tsx`

**Interfaces:**
- Consumes: `getSeoHealth` via `api.seo.health.$get()` (D1.2).
- Produces:
  - `AltTextCard({ alt })`, showing "{described} of {images} images described · {decorative} decorative" and a link "Find images without alt text" to `/admin/media?missingAlt=true`.
  - `IssuesList({ issues, entities, filter })`, a Tabs-like segmented control "Needs work / All" (`?show=all`). Groups are per entity: title, path, one row per issue, and a **Fix** link (`fixHref`). "All" also lists passing entities with "All checks pass".

- [ ] **Step 1: Write the failing DOM tests.** Cover: the alt card numbers and link; Needs work hides passing entities; the Fix link href; the empty state "Nothing to fix" when there are no issues.

- [ ] **Step 2: Confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Confirm they pass.** Run the DOM test and `tests/e2e/seo-admin.spec.ts`.

- [ ] **Step 5: Commit**

Message: `feat(seo): overview with alt-text card and grouped issues`

---

### Task D1.6: SEO defaults — robots mode, verification, crawler view (migration 0013)

**Files:**
- Create: `server/db/migrations/0013_seo_defaults_robots.sql`, `components/admin/seo/crawl-preview.tsx`, `tests/integration/db/seo-defaults-robots-migration.test.ts`
- Modify:
  - `lib/schemas/settings/seo-defaults.ts`: `robots: z.enum(["index","noindex"])`, `verification: { google: string ≤100 /^[A-Za-z0-9_-]*$/, bing: same }`, and a refine that `titleTemplate` includes `"{title}"` (message "Include {title} where the page name goes")
  - `lib/seo/sitemap.ts`: `buildRobots(origin, mode: "index" | "noindex")`; `noindex` gives `{ rules: [{ userAgent: "*", disallow: "/" }] }` and no sitemap line
  - `app/robots.ts`: passes the published mode
  - `templates/shared/page-meta.ts`: `siteMetadata` adds `robots: { index: false, follow: false }` when noindex; `verification: { google, other: { "msvalidate.01": bing } }` only for non-empty values
  - `lib/seo/checks.ts` input: `siteNoindex`
  - `app/(admin)/admin/(panel)/seo/defaults/page.tsx`: `GrowthSettingsEditor` `aside={<CrawlPreview />}`
  - `server/db/seed/fixtures/settings.ts`
- Test: `tests/unit/seo/robots.test.ts`, `tests/unit/templates/page-meta.test.ts`, `tests/dom/crawl-preview.test.tsx`

**Interfaces:**
- `CrawlPreview()` has client tabs robots.txt / Sitemap.
  - It fetches `/robots.txt` and `/sitemap.xml` (same origin), extracts `<loc>` entries with a regex, and shows the count and the first 20 as links.
  - It shows the note: "Outside production, robots.txt blocks everything."
  - It handles fetch errors with an inline message.

Migration `0013` jsonb merge, following the 0009 pattern, on settings `seo.defaults` draft, published and revisions: `'{"robots":"index","verification":{"google":"","bing":""}}'::jsonb || x`.

- [ ] **Step 1: Write the failing tests**
  - robots `noindex` produces disallow `/` and no sitemap.
  - Seeded `siteMetadata` has no `verification` key and no `robots`; a google token emits `verification.google`.
  - A template without `{title}` gives a 422 on publish (integration test via the marketing API).
  - The migration backfill.
  - The CrawlPreview count.

- [ ] **Step 2: Confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Confirm they pass.** Then run the public gate: `pnpm test:visual tests/visual/public-pages.spec.ts` (expect 0 px) and `pnpm test:e2e tests/e2e/seo.spec.ts tests/e2e/lighthouse-seo.spec.ts`.

- [ ] **Step 5: Commit**

Message: `feat(seo): site-wide noindex, verification tokens, crawler view`

---

### Task D1.7: Redirects — active, note, last hit, source, 307/308 (migration 0014)

**Files:**
- Create: `server/db/migrations/0014_redirects_admin.sql`, `tests/integration/api/redirects-admin.test.ts`
- Modify:
  - `server/db/schema/redirects.ts`: `isActive`, `note`, `lastHitAt`, `source`; checks `redirects_code in (301,302,307,308)` and `redirects_source in ('manual','auto','import')`
  - `lib/schemas/api/redirects.ts`: `REDIRECT_CODES = [301,302,307,308]`; `redirectInput` and `redirectPatch` add `note` (≤ 200) and `isActive`; `RedirectDto` adds `isActive`, `note`, `lastHitAt`, `source`
  - `server/modules/redirects/{repo,service,resolve}.ts`:
    - `findRedirectByFrom` filters `is_active`
    - `incrementRedirectHits` also sets `last_hit_at = now()`
    - `recordMove` inserts `source='auto'`
    - setting `isActive: true` runs the same `fromPathProblem` live-page check as create, returning 422 "That address is a live page now"
    - `PublicPathOutcome.code` widens to `301|302|307|308`
  - `proxy.ts`: no change beyond the type
  - `components/admin/seo/{redirects-screen,redirect-dialog}.tsx`: code Select with 4 options and help text; Note field; columns "Last hit" (RelativeTime or "Never") and status pill On/Off with text; "Automatic" badge; row action "Turn off" / "Turn on"
- Test: `tests/integration/api/redirects-admin.test.ts`, `tests/e2e/redirects.spec.ts` (extend `tests/e2e/seo-admin.spec.ts` if redirects live there)

**Interfaces:** `RedirectDto = { id; fromPath; toPath; code: 301|302|307|308; hits; lastHitAt: string|null; isActive; note; source: "manual"|"auto"|"import"; updatedAt }`.

- [ ] **Step 1: Write the failing tests**
  - An inactive redirect does not resolve.
  - A hit sets `lastHitAt`.
  - A 308 resolves with 308.
  - Turning on when `from` is now a published service slug gives 422.
  - Rename creates `source: "auto"`.
  - A marketer can toggle; an editor gets 403.

- [ ] **Step 2: Confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Confirm they pass.** Then run the public gate (proxy touched): `pnpm test:visual tests/visual/public-pages.spec.ts`.

- [ ] **Step 5: Commit**

Message: `feat(redirects): on/off, note, last hit, automatic badge, 307/308`

---

### Task D1.8: Redirects CSV export/import

**Files:**
- Create: `lib/csv.ts`, `tests/unit/csv.test.ts`, `components/admin/seo/redirect-import-dialog.tsx`, `tests/integration/api/redirects-csv.test.ts`
- Modify:
  - `server/modules/redirects/{routes,service}.ts`
  - `components/admin/seo/redirects-screen.tsx`: "Export CSV" button (`redirect:read`) and "Import CSV" button (`redirect:create`)
  - `server/modules/leads/service.ts`: replace the private CSV helpers with `lib/csv.ts` (same output; existing lead CSV tests stay green)

**Interfaces:**

```ts
// lib/csv.ts
export function parseCsv(text: string, opts?: { maxRows?: number }): { header: string[]; rows: string[][] } // RFC 4180; strips BOM; CRLF/LF; throws CsvError("Line N: …") on unterminated quote or > maxRows
export class CsvError extends Error { readonly line: number }
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null))[]): string // BOM + CRLF; formula guard: cells starting = + - @ \t \r get a leading "'"
// server/modules/redirects/service.ts
export const REDIRECT_IMPORT_MAX_ROWS = 1000
export type ImportRow = { line: number; from: string; to: string; code: 301|302|307|308; note: string; status: "create" | "update" | "error"; message?: string }
export async function exportRedirectsCsv(actor: Actor): Promise<string>   // columns from,to,code,active,note,hits,last_hit_at,source; audit "redirect.exported"
export async function importRedirects(actor: Actor, input: { csv: string; mode: "preview" | "commit" }): Promise<{ rows: ImportRow[]; created: number; updated: number }>
```

Import rules:
- Required header columns are `from,to`; `code` and `note` are optional.
- `code` defaults to 301.
- Each row is validated with `fromPathProblem`, `toPathProblem`, a duplicate `from` in the file (that row errors), and `checkRedirectChain` over existing rows plus earlier valid rows.
- `commit` with any error row returns 422 `{ rows }` and writes nothing. Otherwise it runs in one transaction under `lockRedirects`, inserts or updates with `source='import'`, and writes one audit entry `redirect.imported` with counts.

Routes:
- `GET /api/v1/admin/redirects/export.csv` (`redirect:read`)
- `POST /api/v1/admin/redirects/import` (`redirect:create` and `redirect:update`; body ≤ 1 MB, the admin default)

- [ ] **Step 1: Write the failing tests**

```ts
it("parses quoted commas, escaped quotes, CRLF and BOM", () => expect(parseCsv('﻿from,to\r\n"/a,b","/c ""x"""\r\n').rows).toEqual([["/a,b", '/c "x"']]))
it("rejects > maxRows with the line number", …)
it("toCsv guards formulas", () => expect(toCsv(["a"], [["=1+1"]])).toContain("'=1+1"))
// integration
it("preview flags duplicate from, bad path, chain; commit is all-or-nothing", …)
it("round-trips export → import as updates", …)
```

- [ ] **Step 2: Confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Confirm they pass.** `pnpm vitest run --project unit tests/unit/csv.test.ts && pnpm test:integration tests/integration/api/redirects-csv.test.ts tests/integration/api/leads.test.ts`

- [ ] **Step 5: Commit**

Message: `feat(redirects): CSV export and validated all-or-nothing import`

---

### Task D1.9: Phase D1 gate

- [ ] **Step 1: Run the full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:e2e
```

- [ ] **Step 2: Public visual gate.** Confirm 0 px.

- [ ] **Step 3: Re-shoot admin baselines.** Add screens `seo-overview` (with issues), `seo-tab` (service editor), `media-missing-alt` and `redirects` (with an inactive and an automatic row). Run `pnpm test:visual:update tests/visual/admin-*.spec.ts`, then `pnpm test:visual` twice.

- [ ] **Step 4: Commit**

Message: `test(visual): re-baseline admin for SEO and redirects (phase D1)`
