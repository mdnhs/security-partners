# Phase D5 — Page builder (`/p/<slug>`)

> Part of `docs/superpowers/plans/2026-10-19-mk-parity.md`. Spec §0, §3 ruling 3, §7.5, §8 (0018), §11, §13, §14. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Editors can create new pages at `/p/<slug>` from blocks that wrap SP's existing public section components. The builder has a block library, outline, reorder, hide, autosave, preview, history, SEO tab and draft/publish. A fixed page can also be copied into a new builder page. The 8 fixed pages and their routes are not touched.

**Architecture:**
- New table `builder_pages`, kept separate from `pages`, so `PAGE_KEYS`, `loadSiteSources` and the sitemap's fixed rows stay as they are.
- `blocks/*` is isomorphic (schemas, registry, document rules). It is modelled on MK `blocks/*` but its block set maps one-to-one to SP components through `templates/shared/views.ts` builders.
- Versioning reuses `server/lib/versioning.ts` (`VersionedStore`), with revisions entity `"builder-page"`.
- Public render: `app/(site)/p/[slug]/page.tsx`, inside `<Suspense>` after `connection()`.
- `proxy.ts` answers 404 or a redirect for `/p/*` before streaming starts.

**Tech Stack:** existing (dnd-kit, TipTap restricted node set via `lib/rich-text/render`).

## Global Constraints

The master plan's constraints apply, plus:
- **No public component file changes.** Blocks wrap components; they do not edit them. A unit test diff-guards `components/home/**`, `components/about/**`, `components/services/**`, `components/contact/**` and `components/blog/**` against `git show HEAD~0` at phase start (the file list and hashes are recorded in the D5.1 test fixture).
- The 40 public baselines stay at **0 px**. Builder pages are only covered by new baselines (`tests/visual/builder-pages.spec.ts`), seeded in `tests/visual/seed.ts`, never in `db:seed`.
- Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$` (≤ 60 characters) and are unique. The full path is always `/p/<slug>`.
- Permissions: `page:create` / `page:delete` are new. `page:update` / `page:publish` keep their meaning for builder pages. SEO edits need `seo:update`.

## Review Focus

1. **Path collisions and reserved names.** `/p/` itself, `/p/admin`, uppercase, trailing slash, unicode and 61+ characters are rejected. Two editors creating the same slug at once: one gets 409. Pinned in D5.2.
2. **An unpublished, draft-only or deleted builder page requested publicly.** The result must be a real 404 status from the proxy, not a 200 soft-404. The draft-mode cookie with preview access shows the draft. Pinned in D5.3 (integration on `resolvePublicPath` plus e2e status check).
3. **A block referencing media that is later deleted.** Media deletion is blocked by `media_usages` RESTRICT, because builder saves maintain usages for every `mediaRef` in block data. Pinned in D5.2.
4. **Reorder by keyboard and screen reader in the outline.** Covered by the D5.4 DOM test using the dnd-kit keyboard sensor, with announcements.
5. **Autosave racing publish.** Publish flushes the pending autosave first, then publishes with the latest `version`. A 409 during autosave pauses saving and opens the conflict dialog; it never overwrites silently. Pinned in D5.5.

---

### Task D5.1: Block registry (`blocks/*`)

**Files:**
- Create:
  - `blocks/define-block.ts`
  - `blocks/fields.ts`
  - `blocks/registry.ts`
  - `blocks/document.ts`
  - `blocks/media-refs.ts`
  - `tests/unit/blocks/{registry,document,media-refs}.test.ts`
  - `tests/unit/blocks/public-components-frozen.test.ts`
- Modify: `eslint.config.mjs` (add `blocks/**` to the "never import `server/**`" rule)

**Interfaces:**

```ts
// blocks/define-block.ts
export type BlockDefinition<T extends string, S extends z.ZodType> = { type: T; label: string; icon: string /* lucide name */; description: string; schema: S; max?: number; first?: boolean }
export function defineBlock<const T extends string, S extends z.ZodType>(d: BlockDefinition<T, S>): BlockDefinition<T, S>
// blocks/registry.ts — 15 blocks (spec §7.5); data fields:
// hero.page      { image: mediaRef; crumb: string≤40; title: string≤80; description: string≤240 }              first, max 1
// about          { useShared: boolean }  (renders settings.sections.about via aboutSectionView)                 max 1
// stats          { items: { value: string≤12; label: string≤40; description: string≤160 }[1..4] }
// iconCards      { eyebrow: string≤40; title: string≤80; description: string≤240; items: iconCard[1..6] }
// services       { eyebrow; heading; intro; count: 1..12 }  (published services collection)                     max 1
// whyChooseUs    { useShared: true }                                                                          max 1
// enquireBanner  { useShared: true }                                                                          max 1
// clients        { useShared: true }                                                                          max 1
// team           { heading: string≤80; intro: string≤240 }                                                    max 1
// blog           { heading: string≤80; intro: string≤240; count: 1..6 }                                       max 1
// departments    { eyebrow; heading; intro; items: department[1..6] }  (schema reused from templates/contact/schema.ts)
// contact        { useShared: true }  (Contact + ContactForm with settings.sections.contact)                  max 1
// map            { useShared: true }                                                                          max 1
// richtext       { doc: richText }                                                                            —
// newsletter     { useShared: true }  (NewsletterForm with published newsletter copy, D4)                     max 1
export const BLOCKS: readonly BlockDefinition<BlockType, z.ZodType>[]
export type BlockType = "hero.page" | "about" | "stats" | "iconCards" | "services" | "whyChooseUs" | "enquireBanner" | "clients" | "team" | "blog" | "departments" | "contact" | "map" | "richtext" | "newsletter"
export const BLOCK_BY_TYPE: { [T in BlockType]: BlockDefinition<T, z.ZodType> }
export const BlockId: z.ZodString           // /^[A-Za-z0-9_-]{4,48}$/
export const Anchor: z.ZodString            // /^[a-z][a-z0-9-]{0,39}$/
export const BlockInstance: z.ZodDiscriminatedUnion  // { id, type, anchor, hidden: boolean, data }
export type BlockInstance
// blocks/document.ts
export const BuilderDocument = z.object({ blocks: z.array(BlockInstance).min(1).max(40) })
export type BuilderDocument = z.infer<typeof BuilderDocument>
export const DraftDocument = z.object({ blocks: z.array(z.object({ id: BlockId, type: z.enum(BLOCK_TYPES), anchor: z.string().max(40), hidden: z.boolean(), data: z.record(z.string(), z.unknown()) })).max(40) }) // loose autosave shape
export function validateDocument(doc: unknown): { ok: true; doc: BuilderDocument } | { ok: false; fieldErrors: Record<string, string[]> } // keys "blocks.<i>.<path>"; rules: unique ids, unique anchors, first ⇒ index 0, max per type
export function emptyBlock(type: BlockType, existing: BuilderDocument | { blocks: { anchor: string }[] }): BlockInstance  // uuid id, unique anchor from type, schema defaults
// blocks/media-refs.ts
export function collectMediaIds(doc: { blocks: { data: unknown }[] }): string[]   // walks every {mediaId}
```

- [ ] **Step 1: Write the failing tests**

```ts
it("every block type has a definition and a unique label", …)
it("validateDocument enforces first/max/unique anchors with indexed keys", () => {
  const r = validateDocument({ blocks: [emptyBlock("stats", none), emptyBlock("hero.page", none)] })
  expect(r).toEqual({ ok: false, fieldErrors: expect.objectContaining({ "blocks.1.type": ["Page hero must be the first block"] }) })
})
it("emptyBlock gives unique anchors (stats, stats-2)", …)
it("collectMediaIds finds nested refs in hero, iconCards and richtext images", …)
it("public section components are unchanged since phase start", () => { for (const [file, sha] of Object.entries(FROZEN)) expect(sha256(readFileSync(file))).toBe(sha) })
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `pnpm vitest run --project unit tests/unit/blocks`

- [ ] **Step 3: Implement.** Record `FROZEN` hashes in `tests/unit/blocks/frozen-components.json`.

- [ ] **Step 4: Run the tests and confirm they pass.** Also run `pnpm lint`.

- [ ] **Step 5: Commit** — `feat(builder): block registry wrapping existing public sections`

---

### Task D5.2: `builder_pages` data, service, API, permissions (migration 0018)

**Files:**
- Create:
  - `server/db/schema/builder-pages.ts`
  - `server/db/migrations/0018_builder_pages.sql`
  - `server/modules/builder-pages/{repo,service,routes,queries}.ts`
  - `lib/schemas/api/builder-pages.ts`
  - `tests/integration/api/builder-pages.test.ts`
- Modify:
  - `server/db/schema/index.ts`
  - `lib/auth/permissions.ts`: `page: ["read","create","update","publish","delete"]`
  - `tests/unit/permissions.test.ts`
  - `lib/schemas/api/content.ts`: `REVISION_ENTITIES` + `"builder-page"`
  - `server/lib/cache-tags.ts`: `builderPages`, `builderPage(slug)`
  - `server/api/app.ts`: mount `/api/v1/admin/builder-pages`
  - `server/modules/redirects/service.ts`: `recordMove` accepts `/p/` paths
  - `lib/seo/redirects.ts` `fromPathProblem`: `/p` and `/p/` alone are rejected

**Interfaces:**

```ts
// server/db/schema/builder-pages.ts
export const builderPages = pgTable("builder_pages", { id: id(), slug: text("slug").notNull().unique(), title: text("title").notNull(), seo: jsonb("seo").$type<Seo>().notNull().default({}), ...versioned<BuilderDocument>(), createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }), ...timestamps() }, (t) => [check("builder_pages_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 60`)])
// lib/schemas/api/builder-pages.ts
export const builderSlug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case words joined by hyphens").max(60)
export const newBuilderPageInput = z.object({ title: z.string().trim().min(1).max(80), slug: builderSlug })
export const builderDraftInput = z.object({ version: z.number().int().min(1), draft: DraftDocument })
export const builderMetaInput = z.object({ version: z.number().int(), title: z.string().trim().min(1).max(80).optional(), slug: builderSlug.optional() })
export type BuilderPageDto = VersionedDto<BuilderDocument> & { id: string; slug: string; title: string; path: string; seo: Seo; createdAt: string }
export type BuilderPageListItem = { id: string; slug: string; title: string; path: string; status: ContentStatus; hasUnpublishedChanges: boolean; updatedAt: string; updatedByName: string | null }
// server/modules/builder-pages/service.ts
export async function listBuilderPages(actor: Actor): Promise<BuilderPageListItem[]>                                  // page:read
export async function createBuilderPage(actor: Actor, input: NewBuilderPageInput, seed?: BuilderDocument): Promise<BuilderPageDto> // page:create; default doc = [hero.page empty]; 409 on slug taken (unique violation → conflict)
export async function getBuilderPage(actor: Actor, id: string): Promise<BuilderPageDto>
export async function saveBuilderDraft(actor: Actor, id: string, input: BuilderDraftInput): Promise<BuilderPageDto>   // page:update; loose DraftDocument; media_usages updated
export async function publishBuilderPage(actor: Actor, id: string, input: { version: number }): Promise<BuilderPageDto> // page:publish; validateDocument → 422 fieldErrors; revision; invalidate(builderPages, builderPage(slug))
export async function restoreBuilderPage(actor: Actor, id: string, input: { version: number; revisionId: string }): Promise<BuilderPageDto>
export async function changeBuilderMeta(actor: Actor, id: string, input: BuilderMetaInput): Promise<BuilderPageDto>  // slug change on published page → recordMove("/p/old","/p/new") source auto
export async function deleteBuilderPage(actor: Actor, id: string, input: { redirectHome: boolean }): Promise<void>    // page:delete; removes usages; optional recordMove to "/"
// server/modules/builder-pages/queries.ts
export async function getPublishedBuilderPage(slug: string): Promise<{ id: string; title: string; seo: Seo; doc: BuilderDocument; updatedAt: Date } | null> // 'use cache'; cacheTag(tag.builderPages, tag.builderPage(slug)); draftMode → draft (validated loosely, invalid blocks dropped)
export async function isPublishedBuilderSlug(slug: string): Promise<boolean>    // for proxy (repo call, not cached)
export async function newsletterBlockPublished(): Promise<boolean>              // used by D4 newsletterAcceptsSignups()
```

Routes (`can()` → `zv()` → service):

| Method | Path |
|---|---|
| `GET` | `/` |
| `POST` | `/` |
| `GET` | `/:id` |
| `PUT` | `/:id/draft` |
| `POST` | `/:id/publish` |
| `POST` | `/:id/restore` |
| `PATCH` | `/:id/meta` |
| `DELETE` | `/:id` |

SEO uses the existing `PUT /api/v1/admin/seo/entries/:kind/:id`, with `SEO_KINDS` gaining `"builder"`.

Wire D4's `newsletterAcceptsSignups()` to `placement !== "off" || await newsletterBlockPublished()`.

- [ ] **Step 1: Write the failing tests**

```ts
it("editor creates /p/landing; duplicate slug 409; marketer 403 on create", …)
it("bad slugs → 422", async () => { for (const slug of ["", "Landing", "a/b", "a-", "x".repeat(61), "é"]) expect((await post({ title: "x", slug })).status).toBe(422) })
it("draft accepts an incomplete block; publish rejects with blocks.<i> fieldErrors", …)
it("stale version → 409 with current", …)
it("publish writes a revision; restore loads it into draft", …)
it("slug change on a published page creates an automatic redirect /p/a → /p/b", …)
it("hero image media cannot be deleted while used (usages RESTRICT)", …)
it("delete with redirectHome creates /p/x → / ; without, nothing", …)
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.** Run `pnpm db:generate --name builder_pages` and write the code.

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `pnpm test:integration tests/integration/api/builder-pages.test.ts && pnpm vitest run --project unit tests/unit/permissions.test.ts`

- [ ] **Step 5: Commit** — `feat(builder): builder_pages storage, versioned API and page create/delete permissions`

---

### Task D5.3: Public `/p/[slug]` render, proxy, sitemap, OG, preview

**Files:**
- Create:
  - `app/(site)/p/[slug]/page.tsx`
  - `templates/builder/render.tsx`
  - `templates/builder/views.ts`
  - `tests/integration/builder/public.test.ts`
  - `tests/e2e/builder-public.spec.ts`
  - `tests/visual/builder-pages.spec.ts`
- Modify:
  - `server/modules/redirects/resolve.ts`: `/p/<slug>` handling, before the redirect lookup:
    - published → pass
    - draft cookie → pass
    - otherwise → redirect lookup, then `missing`
  - `server/modules/seo/{queries,repo}.ts`: sitemap rows for published, indexable builder pages; `cacheTag(tag.builderPages)`
  - `lib/seo/urls.ts`: `OG_KINDS` + `"builder"`
  - `app/og/[kind]/[slug]/*`
  - `templates/shared/page-meta.ts`: `builderPageMetadata(s, page)`
  - `lib/schemas/api/preview.ts`: `PREVIEW_ENTITIES` + `"builder-page"`
  - `server/modules/preview/*`: `previewPath` validates the uuid first, then `/p/<slug>`
  - `tests/visual/seed.ts`: creates `/p/visual-fixture` with every block except `newsletter`

**Interfaces:**

```ts
// templates/builder/views.ts — maps a block instance + SiteSources → props of the existing component
export function blockView(block: BlockInstance, s: SiteSources): BlockViewResult  // discriminated by type; uses pageHeroView, aboutSectionView, enquireBannerView, clientsView, teamView, serviceCard, listedArticles, contactSectionView, locationMapView
// templates/builder/render.tsx
export function BuilderTemplate(props: { chrome: ChromeView; blocks: { block: BlockInstance; view: BlockViewResult }[]; newsletterCopy: NewsletterPublicCopy | null }): JSX.Element
// <SiteHeader {...chrome.header}/><main>{visible blocks in order, each wrapped in nothing extra except id={anchor} on a <div> when the component has no id prop}</main><SiteFooter/><HomeMotion/><SiteLocale/>
// templates/shared/page-meta.ts
export function builderPageMetadata(s: SiteSources, page: { id: string; slug: string; title: string; seo: Seo; firstHeroDescription: string | null }): Metadata  // canonical "/p/<slug>", og image record → defaults → /og/builder/<id>
```

The page file:
- Validates `slug` with `builderSlug` (else `notFound()`).
- Runs `generateMetadata` via `loadSiteSources()` + `getPublishedBuilderPage`.
- Body: `<Suspense fallback={null}>` → `await connection()` → data → `BuilderTemplate`, or `notFound()`.

- [ ] **Step 1: Write the failing tests**

Integration tests:
- `resolvePublicPath("/p/missing")` returns `{ kind: "missing" }`.
- `/p/published` returns pass.
- `/p/old` after a slug change returns a 301 to `/p/new`.
- Draft cookie on an unpublished page returns pass.
- The sitemap includes `/p/published` and excludes the noindex one.

E2E tests:
- `GET /p/missing` has status 404.
- A published page renders its blocks in order.
- A hidden block is absent.
- The `<title>` follows the SEO title.
- Preview of an unpublished page shows the draft with the preview bar.

Visual: `/p/visual-fixture` desktop and mobile (new baselines).

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.** Then run the public gate (the proxy changed):

```bash
pnpm test:visual tests/visual/public-pages.spec.ts tests/visual/consent-banner.spec.ts   # 0 px
pnpm test:visual:update tests/visual/builder-pages.spec.ts && pnpm test:visual tests/visual/builder-pages.spec.ts
pnpm test:e2e tests/e2e/builder-public.spec.ts tests/e2e/seo.spec.ts
```

- [ ] **Step 5: Commit** — `feat(builder): public /p/<slug> pages with proxy 404/redirects, sitemap, OG and preview`

---

### Task D5.4: Builder state, outline, block library, block form

**Files:**
- Create:
  - `components/admin/builder/{builder-state,block-outline,block-library,block-form,block-meta}.tsx`
  - `tests/unit/builder/builder-state.test.ts`
  - `tests/dom/block-outline.test.tsx`
  - `tests/dom/block-library.test.tsx`

**Interfaces:**

```ts
// builder-state.ts (pure reducer)
export type DocAction =
  | { type: "add"; blockType: BlockType; at: number }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; to: number }
  | { type: "duplicate"; id: string }
  | { type: "data"; id: string; data: unknown }
  | { type: "meta"; id: string; patch: { anchor?: string; hidden?: boolean } }
  | { type: "replace"; doc: DraftDocumentValue }
export function docReducer(doc: DraftDocumentValue, action: DocAction): DraftDocumentValue
export function addableTypes(doc: DraftDocumentValue): BlockType[]          // respects max and "first"
export function errorsByBlock(fieldErrors: Record<string, string[]>, doc: DraftDocumentValue): Record<string, string[]> // "blocks.<i>.x" → block id
// block-outline.tsx
export function BlockOutline(props: { doc: DraftDocumentValue; selectedId: string | null; errors: Record<string, string[]>; onSelect(id: string): void; dispatch(a: DocAction): void; readOnly: boolean }): JSX.Element
// sortable list (reuse components/admin/sortable-list.tsx); per row: label, anchor, hidden toggle (eye button aria-pressed), duplicate, delete (AlertDialog); error badge with count (text)
// block-library.tsx
export function BlockLibrary(props: { available: BlockType[]; onAdd(t: BlockType): void }): JSX.Element  // Dialog with Item list (icon, label, description); disabled reasons as text
// block-form.tsx
export function BlockForm(props: { block: DraftBlock; onChange(data: unknown): void; errors: string[]; readOnly: boolean }): JSX.Element  // SchemaForm over BLOCK_BY_TYPE[type].schema with editor meta derived from the schema (labels from field names via a BLOCK_FIELD_LABELS map)
// block-meta.tsx
export function BlockMeta(props: { block: DraftBlock; onChange(p: { anchor?: string; hidden?: boolean }): void }): JSX.Element  // anchor input with Anchor regex + uniqueness message; hidden switch
```

- [ ] **Step 1: Write the failing tests**

Reducer:
- `add` hero when one exists is a no-op (`addableTypes` excludes it).
- `move` keeps ids.
- `duplicate` gives a new id and anchor `x-2`.
- `remove` the selected block.
- `errorsByBlock` maps indexes to ids.

DOM:
- Keyboard reorder (Space, ArrowDown, Space) dispatches `move` and announces it.
- The hide toggle sets `aria-pressed`.
- The library disables "Page hero" with "Only one per page".
- Delete asks for confirmation.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `pnpm vitest run --project unit tests/unit/builder && pnpm vitest run --project dom tests/dom/block-outline.test.tsx tests/dom/block-library.test.tsx`

- [ ] **Step 5: Commit** — `feat(builder): builder state, outline with keyboard reorder, block library and forms`

---

### Task D5.5: Builder page, Pages list, Copy fixed page

**Files:**
- Create:
  - `app/(admin)/admin/(panel)/pages/custom/[id]/page.tsx`
  - `components/admin/builder/{page-builder,use-builder-autosave,new-page-dialog}.tsx`
  - `templates/builder/from-template.ts`
  - `tests/unit/builder/from-template.test.ts`
  - `tests/e2e/builder.spec.ts`
  - `tests/visual/builder-copy.spec.ts`
- Modify:
  - `components/admin/pages/pages-list.tsx`: sections "Site pages" (unchanged rows) and "Custom pages" (`listBuilderPages`), "New page" button for `page:create`
  - `components/admin/pages/page-editor.tsx`: action "Copy to new page" for `page:create`
  - `lib/admin/nav.ts`: `permissionFor("/admin/pages/custom/x")` resolves via the `pages` item; no change needed, but add a test case
  - `components/admin/shell/palette-actions.ts`: `new-page` action
  - `tests/visual/admin-screens.spec.ts`: builder screen

**Interfaces:**

```ts
// use-builder-autosave.ts
export function useBuilderAutosave(input: { id: string; version: number; doc: DraftDocumentValue; enabled: boolean; save(doc, version): Promise<BuilderPageDto> }): { state: "saved" | "saving" | "unsaved" | "conflict" | "error"; flush(): Promise<BuilderPageDto | null>; accept(dto: BuilderPageDto): void; conflict: BuilderPageDto | null }
// 1500 ms debounce; one request in flight; 409 → state "conflict" + pause until accept(); transient error → retry after 5 s; flush on visibilitychange hidden and before publish/restore
// page-builder.tsx
export function PageBuilder(props: { id: string }): JSX.Element
// layout: PageHeader with Breadcrumb Pages › {title}; actions SaveState, History (RevisionDrawer entity "builder-page"), Preview (previewHref("builder-page", id)), Discard, Publish (PublishDialog)
// Tabs Content | SEO (?tab=); Content = 3 columns at xl: BlockOutline | BlockForm+BlockMeta | PreviewPane (desktop/tablet/phone, reload on save); < xl stacked with preview behind a toggle
// SEO tab = <SeoPanel kind="builder" id path={`/p/${slug}`} fallback={{ title, description: heroDescription }} …/> + title/slug fields (changeBuilderMeta) with "Changing the address adds a redirect from the old one" note
// ConflictDialog on conflict; unsaved guard via existing UnsavedChangesProvider
// new-page-dialog.tsx
export function NewPageDialog(props: { open: boolean; onOpenChange(o: boolean): void; seed?: { title: string; doc: BuilderDocument } }): JSX.Element  // title + slug (auto from title, editable); creates and navigates to /admin/pages/custom/<id>
// templates/builder/from-template.ts
export function blocksFromTemplate(key: PageKey, data: PageData<PageKey>): BuilderDocument
// home → hero is not a builder block → starts with hero.page built from home hero (image, heading→title, subheading→description), then about, services, enquireBanner, clients, team, blog, contact, map
// about → hero.page, about, stats, iconCards(values); services → hero.page, services, whyChooseUs, enquireBanner, clients; team → hero.page, team, iconCards(officers); blog → hero.page, blog; contact → hero.page, departments, contact, map; legal → hero.page, richtext
```

- [ ] **Step 1: Write the failing tests**

```ts
it("blocksFromTemplate(about) yields hero.page, about, stats, iconCards with the template's copy", …)
it("every fixed page converts to a document that passes validateDocument", () => { for (const k of PAGE_KEYS) expect(validateDocument(blocksFromTemplate(k, fixture.pages[k].data)).ok).toBe(true) })
```

E2E:
- An editor creates "Spring campaign" → `/admin/pages/custom/<id>`, adds a Stats block, types values, waits for "Saved", publishes, opens `/p/spring-campaign` and sees the stats.
- A second browser context saving a stale version → conflict dialog → "Reload theirs".
- Slug change → `/p/spring-campaign` 301 → new slug.
- A marketer sees the list read-only and has no New page button.
- ⌘K "New page" opens the dialog.

Visual (`tests/visual/builder-copy.spec.ts`):
- "Copy to new page" from About → publish.
- `/p/about-copy` vs `/about`: compare the `<main>` element screenshots with `maxDiffPixels: 0`, excluding the breadcrumb row.
- If the hero breadcrumb differs, which is expected because the crumb trail is the page's, mask the `nav[aria-label]` inside the hero.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `pnpm vitest run --project unit tests/unit/builder && pnpm test:e2e tests/e2e/builder.spec.ts && pnpm test:visual tests/visual/builder-copy.spec.ts`

- [ ] **Step 5: Commit** — `feat(builder): page builder screen with autosave, preview, history, SEO and copy-from-template`

---

### Task D5.6: Phase D5 gate (final)

- [ ] **Step 1: Full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:e2e
```

- [ ] **Step 2: Visual gate.** `pnpm test:visual` must be all green.
  - Public 40 and consent: 0 px.
  - Builder and newsletter pages: green.
  - Admin: re-shoot the screens with builder content (`pages` list with a custom row, `builder` editor light/dark desktop/mobile), then run twice.

- [ ] **Step 3: Coverage re-check.** Re-read spec §1–§14 and tick each item against the commits. Append a dated "Done" note to the master plan with the commit range and any deviations.

- [ ] **Step 4: Commit** — `test(visual): builder baselines; MK parity complete (phase D5)`
