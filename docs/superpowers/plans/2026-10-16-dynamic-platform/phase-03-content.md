# Phase 3 — Content model + public site from DB

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master, Phase 3 = Tasks 3.1–3.6). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§3, §3.1, §5, §5.6, §11, §14, §15). Inputs that define every field: `docs/brief.md` §7, §14 and `docs/brief-inventory.json`. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Public design is frozen: `pnpm test:visual` must stay at 0 px on every baseline (1440×900 and 390×844, macOS only, port 3100 free). From Task 9 on it runs against a freshly seeded database. GSAP/Lenis motion must keep working (DOM identical).
- No section of the public site is removed or added. Only exceptions in this phase: `/privacy` and `/terms` (existing `PageHero` + article body styles).
- `next build` must succeed with no env vars and no database: every DB read sits inside `<Suspense fallback={null}>` after `await connection()`; `getDb()` is never called at module scope.
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Tests use `TEST_DATABASE_URL` / `E2E_DATABASE_URL` only.
- Every file under `server/` starts with `import "server-only"` (`tests/unit/server-only-guard.test.ts`). `lib/**` and `templates/*/schema.ts` never import `server/**`.
- Repos (`server/modules/*/repo.ts`) are the only files outside `server/db/**` and `tests/**` that import `drizzle-orm`; routes never import repos — both enforced by ESLint from Task 6.
- IDs uuid v7, timestamps `timestamptz`, slugs `^[a-z0-9]+(-[a-z0-9]+)*$` (unique per table, CHECK constraint), dates displayed in `Europe/Dublin`.
- Strings are stored and rendered byte-identical: no `.trim()`, no whitespace normalisation (Review Focus 1).
- Library versions exact (`--save-exact`): `sharp@0.35.5`, `@tiptap/core@3.32.0`, `@tiptap/pm@3.32.0`. Next.js 16.3.8 Cache Components per `docs/superpowers/notes/nextjs-16-api.md` §0–§3, §7–§8.
- Code style: repo Prettier config (no semicolons, double quotes, 80 cols). Run `pnpm exec prettier --write <files>` on files you create.
- Commit after every task; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`. Stage only your own paths.
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (no env) + `pnpm test:visual` + `pnpm test:e2e`.

**Prerequisites:** Phase 2 complete (Tasks 1–7 committed: users table with `title`, audit, session DAL, `app/(site)` route group with `app/(site)/[...notFound]/page.tsx`, admin root layout, Phase 2 `playwright.config.ts` with `webServer.env: E2E_ENV` and `reuseExistingServer: false`, `tests/e2e/{env,seed,global.setup}.ts`, `server/db/seed/guard.ts`, `scripts/lib/run-script.ts`, `lib/format.ts`, migrations `0000`–`0002`). `pnpm db:up` running (Postgres 17 with `sp_dev`, `sp_test`, `sp_e2e`), `.env.development` present, `pnpm db:migrate` applied. Port 3100 free (`lsof -iTCP:3100 -sTCP:LISTEN` prints nothing).

**Ledger rulings applied:** shared multi-page sections are `settings.sections.about` / `settings.sections.contact` (+ `sections.enquireBanner`, `sections.clients`, `sections.whyChooseUs`); `article_categories.showInFilter` (+ `sortOrder`); `template: true` inventory values are seeded verbatim and filled by `interpolate()` from `settings.contact` (`*Href` derived from the numbers, `mapsHref` stored); inventory-discovered fields added (`contact.operationsExtension`, `pages.blog.pageSize`, `services[].heroImage|image|imageAlt`, `pages.team.leadership.photoPlaceholder`); `cacheComponents` enabled in Task 6 (master 3.4); queries use `'use cache'` + `cacheLife` + `cacheTag`; `invalidate()` = `revalidateTag(tag, { expire: 0 })`; public pages wrap DB content in `<Suspense fallback={null}>` + `await connection()` outside the cache scope; `generateStaticParams` removed; article bodies are TipTap JSON and `lib/rich-text/render.tsx` (created here) reproduces the `ArticleBody` markup exactly; never cache `getDb()` at module scope; drizzle-orm repo-only ESLint boundary (exempt `server/db/**`, `tests/**`); Playwright `webServer` passes DB env, `reuseExistingServer: false`. **Superseded:** no `app/global-not-found.tsx` — Phase 2 added `app/(site)/[...notFound]/page.tsx` and the visual suite has 40 baselines including `/this-page-does-not-exist` (Next's default 404 inside the site layout), so this phase adds no `not-found.tsx` either.

**Pixel-parity rule for every component change (verified while writing this plan).** Chrome positions glyphs per DOM text node, so a label that used to be one text node must stay one, and `Label: {value}` must stay two nodes (`"Label: "` + value). Concretely: write ``{`${label} `}{value}`` (never `{label} {value}`, which makes three nodes and moved one pixel in the top bar of every page), render template strings with placeholders through `interpolateParts()` (text parts, like JSX `Call {office}`), and keep strings that were one JS string (`` `Tel: ${office} Ext 2` ``) as one string via `interpolate()`. The code below already follows this; do not "tidy" it.

**Verification note:** the code in this plan was run in a scratch copy of the repo (Phase 2 state simulated): lint, typecheck, 752 unit+integration tests, `next build` with no env, `pnpm test:visual` 38/38 against the seeded DB (the 404 baseline did not exist yet), and the new E2E spec 9/9.

## Corrections to master plan

- **Fixtures move earlier:** settings fixtures (`server/db/seed/fixtures/{media,rich-text,settings}.ts`) are created in Task 1 (master 3.1) and page fixtures (`fixtures/pages.ts`) in Task 3 (master 3.2), because those tasks' acceptance tests parse them; Task 4 (master 3.3) adds the collection fixtures — cost: none.
- **Task split:** master 3.4 → Tasks 5 (seed runner) + 6 (repos, cached queries, `cacheComponents`); master 3.5/3.6 → Tasks 7 (render helpers + TipTap renderer), 8 (props-driven components + templates + pages), 9 (pages read the DB, seeded visual gate), 10 (legal pages, error page, E2E). Page wiring moves from 3.6 into Task 8: deleting `components/*/data.ts` (3.5) needs a data source, so pages call `loadSiteSources()` from Task 8 on — first backed by the seed fixtures (proves the props refactor alone is pixel-identical), then by the DB in Task 9 — cost: one 10-line interim implementation.
- **`getPage<K extends PageKey>(key: K)`** instead of `getPage<T extends TemplateName>(key)`: `privacy` and `terms` share the `legal` template, so the key types the data; returns `{ key, data, seo } | null` — cost: none.
- **404s:** no `app/global-not-found.tsx` and no `app/(site)/not-found.tsx` (controller ruling; the 404 baseline is Next's default UI in the site layout). Unknown service/article slugs call `notFound()` inside the page's Suspense boundary: under Cache Components the shell has already streamed, so Next renders the 404 UI with `<meta name="robots" content="noindex">` and HTTP 200 (Next docs: streaming "Status codes"). Master 3.6 "unknown slug → 404" is met as the 404 page + noindex, not the status. Unmatched URLs keep a real 404 (Phase 2 catch-all) — cost if wrong: unknown slugs are soft 404s; a real status needs a DB lookup in `proxy.ts`.
- **`<html lang>`** is part of the static shell (built without a DB), so the site layout keeps `lang="en"` and `components/site-locale.tsx` applies `settings.site.locale` after hydration (seeded `"en"`, so nothing changes today) — cost: SSR HTML shows `en` if the owner changes the locale.
- **Media references are `{ mediaId }` objects** in JSON payloads (pages, settings, services, articles; article image nodes use `attrs: { media: { mediaId }, alt }`); a generic resolver swaps them for `{ id, url, alt, width, height, blurDataUrl }`. Small collections store media as FK columns (`photo_id`, `logo_id`, ON DELETE RESTRICT) and their queries return `{ mediaId }` — cost: Phase 5's TipTap image node must use the `media` attribute shape.
- **Paragraph-only rich text:** `settings.sections.about.body` and `services[].detail.overview` use `paragraphsText` (TipTap doc of paragraphs, marks allowed) because their designs render only paragraphs — cost: Phase 4 SchemaForm needs a "paragraphs only" rich-text widget mode.
- **Nullable article fields** `lead`, `body`, `readTimeMinutes`, `authorId` (and empty `tags`) reproduce the six articles without designed copy (lead → excerpt, body → excerpt paragraph, tags → category, no read time, no byline) — cost: none.
- **Additions not in the inventory:** `settings.site.{name,legalName,logoOnDark,favicon,productionUrl,timezone}` (spec §5.4), `settings.microcopy.article.readTime` ("{n} min read"), defaults for `seo.defaults.ogImage`, `consent`, `tracking`, `customCode`, `leads` (D6 24 months, recipients `info@securitypartnersltd.com`, open question default). Phase 8 extends `seo.defaults`/`consent` — cost: none (jsonb).
- **Seed is insert-only** (`ON CONFLICT DO NOTHING` by natural key): re-running never overwrites admin edits; the visual and E2E harnesses reset the DB first. Byline authors are seeded as banned, password-less users `@authors.invalid` (spec §5.3) — cost: changing a fixture needs a DB reset in dev.
- **`sharp` becomes a direct dependency** (`readStaticMedia`), kept external in the scripts bundle (`seed` is added to `SCRIPT_ENTRIES`; in the image it resolves from the standalone `node_modules`, verified present in `.next/standalone/node_modules/sharp`) — cost if wrong: `node scripts/dist/seed.mjs` fails in the container; Phase 10 smoke-tests it.
- **New helper files** not named in the master: `lib/media.ts`, `lib/interpolate.ts`, `lib/schemas/content/*` record schemas, `templates/shared/{sources,views,page-meta}.ts`, `templates/*/view.ts`, `server/modules/pages/sources.ts`, `server/db/seed/{media.ts,fixtures/*}`, `server/db/schema/_versioned.ts`, `components/site-locale.tsx`, `tests/visual/seed.ts`.

**Risks for later phases (no change here):** (1) `media_usages` is not filled by the seed — Phase 6 must backfill usages before enforcing "delete in-use → 409". (2) Article bylines come from `users.name/title`; the users service must `invalidate(tag.articles)` when a profile changes (Phase 4/5). (3) Enabling `cacheComponents` (Task 6) also applies to Phase 2's admin routes; they already read the session inside `<Suspense>`, Task 6 Step 5 has the fix if one does not. (4) The TipTap renderer's `h3`/ordered list/link styles are new (no seeded content uses them).

---

### Task 1: Content Zod schemas + settings fixtures (master Task 3.1, part 1)

**Files:**
- Create: `lib/schemas/common.ts`
- Create: `lib/schemas/settings/{site,contact,navigation,footer,sections-enquire-banner,sections-clients,sections-why-choose-us,sections-about,sections-contact,seo-defaults,consent,tracking,custom-code,microcopy,leads,index}.ts`
- Create: `lib/schemas/content/{service,article,category,team-member,client,group-company}.ts`
- Create: `server/db/seed/fixtures/{media,rich-text,settings}.ts`
- Test: `tests/unit/schemas/common.test.ts`, `tests/unit/schemas/settings.test.ts`

**Interfaces:**
- Consumes: `zod` 4.6.7 (`z.uuid()`, `z.email()`, `z.url()`); nothing from earlier phases.
- Produces (isomorphic unless noted):

```ts
// lib/schemas/common.ts
export const SLUG_PATTERN: RegExp                  // ^[a-z0-9]+(-[a-z0-9]+)*$
export const slug, text, href, link, mediaRef, richText, paragraphsText, pageHero, iconCard, seo // Zod schemas
export function isSafeHref(value: string): boolean // /path, #anchor, http(s), tel:, mailto:, whole-value {placeholder}
export type Link, MediaRef /* { mediaId: string } */, Mark, TextNode, InlineNode, ParagraphNode, ListItemNode,
  RichTextBlock, RichTextDoc, ParagraphsDoc, Seo, PageHero, IconCard
// lib/schemas/settings/index.ts
export const settingsSchemas: { site, contact, navigation, footer, "sections.enquireBanner", "sections.clients",
  "sections.whyChooseUs", "sections.about", "sections.contact", "seo.defaults", consent, tracking, customCode, microcopy, leads }
export type SettingsKey = keyof typeof settingsSchemas
export const SETTINGS_KEYS: SettingsKey[]
export type SettingsValue<K extends SettingsKey>
export const PUBLIC_SETTINGS_KEYS  // the 11 keys every public page reads
export type PublicSettingsKey
export function isSettingsKey(value: string): value is SettingsKey
// lib/schemas/content/*.ts
export const serviceContent, serviceSchema, articleContent, articleSchema, categorySchema, teamMemberSchema, clientSchema, groupCompanySchema
export type ServiceContent, ServiceInput, ArticleContent, ArticleInput, CategoryInput, TeamMemberInput, ClientInput, GroupCompanyInput
// server/db/seed/fixtures/media.ts (server-only)
export const MEDIA: readonly { key: "/images/…"; alt: string }[]   // 32 library images
export type MediaKey; export type MediaLookup = (key: MediaKey) => MediaRef
export function fixtureMediaId(key: MediaKey): string            // "00000000-0000-7000-8000-000000000001"…
export const fixtureMediaLookup: MediaLookup
export function fixtureMediaKey(id: string): MediaKey
// server/db/seed/fixtures/rich-text.ts — paragraph, doc, paragraphs, heading2, bulletList, quote, image builders
// server/db/seed/fixtures/settings.ts
export type SettingsFixture = { [K in SettingsKey]: SettingsValue<K> }
export function settingsFixture(media: MediaLookup): SettingsFixture
```

Field names follow `docs/brief-inventory.json` exactly (Task 3 asserts it). Strings are copied verbatim from the static site, collapsed exactly as JSX renders them (multi-line JSX text → one line with single spaces; `&apos;` → `'`). Values with `{placeholders}` are the inventory's `template: true` values; the other contact lines use `{phone24h}`, `{addressLine1}`, `{operationsEmail}`… so contact data is edited once in `settings.contact`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/schemas/common.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  href,
  link,
  mediaRef,
  richText,
  slug,
  text,
} from "@/lib/schemas/common"

const ok = (
  schema: { safeParse: (v: unknown) => { success: boolean } },
  v: unknown
) => schema.safeParse(v).success

describe("slug", () => {
  it.each(["a", "alarm-responses", "inside-our-24-7-operations-team", "x1-2y"])(
    "accepts %s",
    (value) => expect(ok(slug, value)).toBe(true)
  )
  it.each(["", "-a", "a-", "a--b", "A-b", "a_b", "a b", "ä"])(
    "rejects %j",
    (value) => expect(ok(slug, value)).toBe(false)
  )
})

describe("href / link", () => {
  it.each([
    "/about",
    "/services/alarm-responses",
    "#services",
    "#",
    "https://www.mjseco.ie",
    "http://example.ie/x?y=1",
    "tel:+353858018746",
    "mailto:info@securitypartnersltd.com",
    "{phone24hHref}",
    "mailto:{operationsEmail}",
    "https://www.facebook.com/sharer/sharer.php?u={url}",
  ])("accepts %s", (value) => expect(ok(href, value)).toBe(true))

  it.each([
    "",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,x",
    "//evil.example",
    "ftp://x.ie",
    "about",
    "{not a placeholder}",
  ])("rejects %j", (value) => expect(ok(href, value)).toBe(false))

  it("link needs a label and a safe href", () => {
    expect(ok(link, { label: "About", href: "/about" })).toBe(true)
    expect(ok(link, { label: "", href: "/about" })).toBe(false)
    expect(ok(link, { label: "x", href: "javascript:void(0)" })).toBe(false)
  })
})

describe("text: no whitespace normalisation (Review Focus 1)", () => {
  it.each([
    "Monday–Friday, 9am to 6pm",
    "Mountmellick, Co. Laois  •  Since 2008",
    "Read Article  →",
    "News & insights",
    "Dinn Rí",
    "We are dedicated to safeguarding our clients' business",
    "   ·   ",
    "line one\nline two",
  ])("round-trips %j unchanged", (value) => {
    expect(text.parse(value)).toBe(value)
  })
})

describe("mediaRef", () => {
  it("requires a uuid", () => {
    expect(
      ok(mediaRef, { mediaId: "0199a0b2-4c1d-7e3f-8a5b-0123456789ab" })
    ).toBe(true)
    expect(ok(mediaRef, { mediaId: "/images/hero.jpg" })).toBe(false)
  })
})

describe("richText (TipTap subset, spec §5.3)", () => {
  const media = { mediaId: "0199a0b2-4c1d-7e3f-8a5b-0123456789ab" }
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Plain " },
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "hardBreak" },
          {
            type: "text",
            text: "link",
            marks: [
              { type: "italic" },
              { type: "link", attrs: { href: "/contact" } },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "H2" }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "H3" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Item" }] },
            ],
          },
        ],
      },
      {
        type: "orderedList",
        attrs: { start: 1 },
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "One" }] },
            ],
          },
        ],
      },
      {
        type: "blockquote",
        attrs: { cite: "Ops" },
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Quote" }] },
        ],
      },
      { type: "image", attrs: { media, alt: "Officer" } },
    ],
  }

  it("accepts every allowed node and round-trips unchanged", () => {
    expect(richText.parse(doc)).toEqual(doc)
  })

  it.each([
    ["h1", { type: "heading", attrs: { level: 1 }, content: [] }],
    ["code block", { type: "codeBlock", content: [] }],
    ["horizontal rule", { type: "horizontalRule" }],
    [
      "image by URL",
      { type: "image", attrs: { src: "/images/x.png", alt: "" } },
    ],
  ])("rejects %s", (_, block) => {
    expect(ok(richText, { type: "doc", content: [block] })).toBe(false)
  })

  it("rejects unknown marks and javascript: links", () => {
    const withMark = (m: unknown) => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [m] }],
        },
      ],
    })
    expect(ok(richText, withMark({ type: "strike" }))).toBe(false)
    expect(
      ok(
        richText,
        withMark({ type: "link", attrs: { href: "javascript:alert(1)" } })
      )
    ).toBe(false)
  })

  it("rejects an empty document", () => {
    expect(ok(richText, { type: "doc", content: [] })).toBe(false)
  })
})
```


`tests/unit/schemas/settings.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  isSettingsKey,
  PUBLIC_SETTINGS_KEYS,
  SETTINGS_KEYS,
  settingsSchemas,
} from "@/lib/schemas/settings"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

const fixture = settingsFixture(fixtureMediaLookup)

describe("settings schemas (spec §5.4 + shared sections ruling)", () => {
  it("covers exactly the content settings keys", () => {
    expect(SETTINGS_KEYS).toEqual([
      "site",
      "contact",
      "navigation",
      "footer",
      "sections.enquireBanner",
      "sections.clients",
      "sections.whyChooseUs",
      "sections.about",
      "sections.contact",
      "seo.defaults",
      "consent",
      "tracking",
      "customCode",
      "microcopy",
      "leads",
    ])
    expect(Object.keys(fixture).sort()).toEqual([...SETTINGS_KEYS].sort())
    expect(PUBLIC_SETTINGS_KEYS.every(isSettingsKey)).toBe(true)
    expect(isSettingsKey("integrations.smtp")).toBe(false)
    expect(isSettingsKey("toString")).toBe(false)
  })

  it.each(SETTINGS_KEYS)(
    "%s parses its fixture and round-trips it unchanged",
    (key) => {
      const parsed = settingsSchemas[key].parse(fixture[key])
      expect(parsed).toEqual(fixture[key])
    }
  )

  it("rejects an unsafe link in navigation", () => {
    const bad = structuredClone(fixture.navigation)
    bad.headerLinks[0].href = "javascript:alert(1)"
    expect(settingsSchemas.navigation.safeParse(bad).success).toBe(false)
  })

  it("rejects malformed tracking ids", () => {
    expect(
      settingsSchemas.tracking.safeParse({ ...fixture.tracking, gtmId: "UA-1" })
        .success
    ).toBe(false)
  })

  it("keeps template placeholders verbatim", () => {
    expect(fixture["sections.enquireBanner"].secondaryCta).toEqual({
      label: "Call {office}",
      href: "{officeHref}",
    })
    expect(fixture.microcopy.aria.pageNumber).toBe("Page {n}")
  })
})
```


- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/schemas`
Expected: FAIL — `Failed to resolve import "@/lib/schemas/common"` and `Failed to resolve import "@/lib/schemas/settings"`.

- [ ] **Step 3: Shared schemas**

`lib/schemas/common.ts`:

```ts
import { z } from "zod"

// Building blocks shared by settings, template and collection schemas.
// Strings are never trimmed or normalised: seeded copy must render
// byte-identical (en-dashes, double spaces, "→", apostrophes).

/** Global constraint: slugs match ^[a-z0-9]+(-[a-z0-9]+)*$. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const slug = z
  .string()
  .max(120)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens")

/** Required editable copy (may contain {placeholders}, see lib/interpolate.ts). */
export const text = z.string().min(1, "Required").max(5000)

/** A whole-value placeholder such as "{phone24hHref}". */
const WHOLE_PLACEHOLDER = /^\{[A-Za-z]\w*\}$/
const ABSOLUTE = /^(https?:\/\/|tel:|mailto:)\S+$/i

/** Internal path, #anchor, http(s), tel:, mailto: or a {placeholder}. Never javascript: or //host. */
export function isSafeHref(value: string): boolean {
  if (WHOLE_PLACEHOLDER.test(value)) return true
  if (value.startsWith("/")) return !value.startsWith("//")
  if (value.startsWith("#")) return !/\s/.test(value)
  return ABSOLUTE.test(value)
}

export const href = z
  .string()
  .min(1, "Required")
  .max(2000)
  .refine(
    isSafeHref,
    "Use /path, #anchor, https://…, tel:, mailto: or {placeholder}"
  )

export const link = z.object({ label: text, href })

/** Reference to a row in the media library (resolved to a URL at render). */
export const mediaRef = z.object({ mediaId: z.uuid() })

// Rich text: TipTap JSON restricted to what the article design renders
// (spec §5.3). Unknown attributes are stripped on parse.
const mark = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("link"), attrs: z.object({ href }) }),
])
const textNode = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: z.array(mark).optional(),
})
const hardBreak = z.object({ type: z.literal("hardBreak") })
const inline = z.discriminatedUnion("type", [textNode, hardBreak])
const paragraph = z.object({
  type: z.literal("paragraph"),
  content: z.array(inline).optional(),
})
const heading = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
  content: z.array(inline).optional(),
})
const listItem = z.object({
  type: z.literal("listItem"),
  content: z.array(paragraph).min(1),
})
const bulletList = z.object({
  type: z.literal("bulletList"),
  content: z.array(listItem).min(1),
})
const orderedList = z.object({
  type: z.literal("orderedList"),
  attrs: z.object({ start: z.number().int().min(1) }).optional(),
  content: z.array(listItem).min(1),
})
const blockquote = z.object({
  type: z.literal("blockquote"),
  attrs: z.object({ cite: z.string().nullable() }).optional(),
  content: z.array(paragraph).min(1),
})
const image = z.object({
  type: z.literal("image"),
  attrs: z.object({ media: mediaRef, alt: z.string() }),
})
const block = z.discriminatedUnion("type", [
  paragraph,
  heading,
  bulletList,
  orderedList,
  blockquote,
  image,
])

export const richText = z.object({
  type: z.literal("doc"),
  content: z.array(block).min(1),
})

/** Rich text limited to paragraphs (marks allowed): about copy, service overview. */
export const paragraphsText = z.object({
  type: z.literal("doc"),
  content: z.array(paragraph).min(1),
})

/** The PageHero block of an inner page (image, breadcrumb label, title, intro). */
export const pageHero = z.object({
  image: mediaRef,
  crumb: text,
  title: text,
  description: text,
})

/** Icon + title + description cards (values, officer qualities, features). */
export const iconCard = z.object({
  title: text,
  description: text,
  icon: mediaRef,
})

/** Per page/service/article SEO overrides (Phase 8 adds the UI and fallbacks). */
export const seo = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  canonical: z.url().optional(),
  ogImage: mediaRef.optional(),
  noindex: z.boolean().optional(),
})

export type Link = z.infer<typeof link>
export type MediaRef = z.infer<typeof mediaRef>
export type Mark = z.infer<typeof mark>
export type TextNode = z.infer<typeof textNode>
export type InlineNode = z.infer<typeof inline>
export type ParagraphNode = z.infer<typeof paragraph>
export type ListItemNode = z.infer<typeof listItem>
export type RichTextBlock = z.infer<typeof block>
export type RichTextDoc = z.infer<typeof richText>
export type ParagraphsDoc = z.infer<typeof paragraphsText>
export type Seo = z.infer<typeof seo>
export type PageHero = z.infer<typeof pageHero>
export type IconCard = z.infer<typeof iconCard>
```


- [ ] **Step 4: Settings schemas (one file per key)**

`lib/schemas/settings/site.ts`:

```ts
import { z } from "zod"

import { mediaRef, text } from "../common"

/** settings.site — brand and locale (spec §5.4, D7). */
export const siteSettings = z.object({
  name: text,
  legalName: text,
  logo: mediaRef,
  logoAlt: text,
  logoOnDark: mediaRef.nullable(),
  favicon: mediaRef.nullable(),
  productionUrl: z.url().nullable(),
  timezone: text,
  /** <html lang> of the public site. */
  locale: text,
  copyright: text,
})
export type SiteSettings = z.infer<typeof siteSettings>
```


`lib/schemas/settings/contact.ts`:

```ts
import { z } from "zod"

import { href, text } from "../common"

/**
 * settings.contact — numbers and addresses edited once. tel: hrefs are
 * derived at render (lib/interpolate.ts telHref); mapsHref is stored.
 */
export const contactSettings = z.object({
  phone24h: text,
  office: text,
  operationsMobile: text,
  operationsExtension: text,
  email: z.email(),
  operationsEmail: z.email(),
  hours: text,
  addressLine1: text,
  addressLine2: text,
  mapsHref: href,
})
export type ContactSettings = z.infer<typeof contactSettings>
```


`lib/schemas/settings/navigation.ts`:

```ts
import { z } from "zod"

import { link } from "../common"

/** settings.navigation — header links (also the footer Quick Links) and CTA. */
export const navigationSettings = z.object({
  headerLinks: z.array(link).min(1),
  headerCta: link,
})
export type NavigationSettings = z.infer<typeof navigationSettings>
```


`lib/schemas/settings/footer.ts`:

```ts
import { z } from "zod"

import { link, text } from "../common"

/** settings.footer — footer copy and legal links. */
export const footerSettings = z.object({
  tagline: text,
  quickLinksHeading: text,
  contactHeading: text,
  contact: z.object({ telLabel: text, phone24hLabel: text }),
  groupHeading: text,
  groupTelLabel: text,
  legal: z.object({ privacy: link, terms: link }),
})
export type FooterSettings = z.infer<typeof footerSettings>
```


`lib/schemas/settings/sections-enquire-banner.ts`:

```ts
import { z } from "zod"

import { link, mediaRef, text } from "../common"

/** settings.sections.enquireBanner — shared "Enquire About Our Services" banner (D10). */
export const enquireBannerSettings = z.object({
  image: mediaRef,
  eyebrow: text,
  heading: text,
  copy: text,
  cta: link,
  secondaryCta: link,
})
export type EnquireBannerSettings = z.infer<typeof enquireBannerSettings>
```


`lib/schemas/settings/sections-clients.ts`:

```ts
import { z } from "zod"

import { text } from "../common"

/** settings.sections.clients — heading of the shared clients strip (D10). */
export const clientsSectionSettings = z.object({ eyebrow: text, heading: text })
export type ClientsSectionSettings = z.infer<typeof clientsSectionSettings>
```


`lib/schemas/settings/sections-why-choose-us.ts`:

```ts
import { z } from "zod"

import { iconCard, text } from "../common"

/** settings.sections.whyChooseUs — shared "Why Choose Us" section (D10). */
export const whyChooseUsSettings = z.object({
  eyebrow: text,
  heading: text,
  copy: text,
  features: z.array(iconCard).min(1),
})
export type WhyChooseUsSettings = z.infer<typeof whyChooseUsSettings>
```


`lib/schemas/settings/sections-about.ts`:

```ts
import { z } from "zod"

import { mediaRef, paragraphsText, text } from "../common"

/** settings.sections.about — About section shared by / and /about (ruling). */
export const aboutSectionSettings = z.object({
  eyebrow: text,
  heading: text,
  body: paragraphsText,
  image: mediaRef,
  imageAlt: text,
  badge: z.object({ value: text, label: text, caption: text }),
  highlights: z.array(text).min(1),
})
export type AboutSectionSettings = z.infer<typeof aboutSectionSettings>
```


`lib/schemas/settings/sections-contact.ts`:

```ts
import { z } from "zod"

import { href, mediaRef, text } from "../common"

/** settings.sections.contact — Contact section, form copy and map shared by / and /contact (ruling). */
export const contactSectionSettings = z.object({
  eyebrow: text,
  heading: text,
  intro: text,
  infoItems: z
    .array(
      z.object({
        title: text,
        icon: mediaRef,
        lines: z.array(z.object({ text, href: href.optional() })).min(1),
      })
    )
    .min(1),
  form: z.object({
    nameLabel: text,
    namePlaceholder: text,
    emailLabel: text,
    emailPlaceholder: text,
    phoneLabel: text,
    phonePlaceholder: text,
    messageLabel: text,
    messagePlaceholder: text,
    submitLabel: text,
    mailtoSubject: text,
  }),
  map: z.object({
    link: href,
    ariaLabel: text,
    label: text,
    /** Tile URL template, {col} 0–8 and {row} 0–1. */
    tiles: text,
  }),
})
export type ContactSectionSettings = z.infer<typeof contactSectionSettings>
```


`lib/schemas/settings/seo-defaults.ts`:

```ts
import { z } from "zod"

import { mediaRef, text } from "../common"

/** settings.seo.defaults — site title, "{title} | …" template, default description. */
export const seoDefaultsSettings = z.object({
  title: text,
  titleTemplate: text,
  description: text,
  ogImage: mediaRef.nullable(),
})
export type SeoDefaultsSettings = z.infer<typeof seoDefaultsSettings>
```


`lib/schemas/settings/consent.ts`:

```ts
import { z } from "zod"

import { link, text } from "../common"

const category = z.object({ label: text, description: text })

/** settings.consent — banner copy (Phase 8 renders it only when tracking is enabled). */
export const consentSettings = z.object({
  title: text,
  body: text,
  acceptLabel: text,
  rejectLabel: text,
  customiseLabel: text,
  saveLabel: text,
  policyLink: link,
  categories: z.object({
    necessary: category,
    analytics: category,
    marketing: category,
  }),
})
export type ConsentSettings = z.infer<typeof consentSettings>
```


`lib/schemas/settings/tracking.ts`:

```ts
import { z } from "zod"

/** settings.tracking — off by default; Phase 8 loads scripts only after consent. */
export const trackingSettings = z.object({
  enabled: z.boolean(),
  gtmId: z
    .string()
    .regex(/^GTM-[A-Z0-9]+$/, "Looks like GTM-XXXXXXX")
    .nullable(),
  ga4Id: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, "Looks like G-XXXXXXXXXX")
    .nullable(),
  metaPixelId: z.string().regex(/^\d+$/, "Digits only").nullable(),
})
export type TrackingSettings = z.infer<typeof trackingSettings>
```


`lib/schemas/settings/custom-code.ts`:

```ts
import { z } from "zod"

/** settings.customCode — owner-only snippets (Phase 8 injects them). */
export const customCodeSettings = z.object({
  headHtml: z.string().max(20000),
  bodyEndHtml: z.string().max(20000),
})
export type CustomCodeSettings = z.infer<typeof customCodeSettings>
```


`lib/schemas/settings/leads.ts`:

```ts
import { z } from "zod"

/** settings.leads — notification recipients, retention (D6) and acknowledgement. */
export const leadsSettings = z.object({
  recipients: z.array(z.email()).min(1),
  retentionMonths: z.number().int().min(1).max(120),
  acknowledgement: z.boolean(),
})
export type LeadsSettings = z.infer<typeof leadsSettings>
```


`lib/schemas/settings/microcopy.ts`:

```ts
import { z } from "zod"

import { href, text } from "../common"

/**
 * settings.microcopy — shared labels, aria labels and template strings
 * ({title}, {n}, {category}, {name}, {url} are filled in at render).
 */
export const microcopySettings = z.object({
  header: z.object({ phone24hLabel: text, hoursLabel: text }),
  aria: z.object({
    mainNav: text,
    openMenu: text,
    closeMenu: text,
    mobileNav: text,
    footerNav: text,
    breadcrumb: text,
    serviceCardReadMore: text,
    allServices: text,
    blogFilter: text,
    pagination: text,
    previousPage: text,
    pageNumber: text,
    nextPage: text,
    categories: text,
    shareOn: text,
  }),
  breadcrumb: z.object({
    home: text,
    services: text,
    servicesHref: href,
    blog: text,
    blogHref: href,
  }),
  serviceCard: z.object({ readMore: text }),
  service: z.object({
    overviewEyebrow: text,
    includedHeading: text,
    allServicesHeading: text,
    helpEyebrow: text,
    helpHeading: text,
    telLabel: text,
    orLabel: text,
    phone24hLabel: text,
    ctaLabel: text,
    ctaHref: href,
    otherEyebrow: text,
    otherHeading: text,
    otherIntro: text,
  }),
  blog: z.object({
    allPostsFilter: text,
    readArticle: text,
    featuredBadge: text,
    emptyCategory: text,
  }),
  article: z.object({
    readTime: text,
    relatedEyebrow: text,
    relatedHeading: text,
    tagsLabel: text,
    shareLabel: text,
    recentPostsHeading: text,
    categoriesHeading: text,
    ctaEyebrow: text,
    ctaHeading: text,
    ctaCopy: text,
    ctaLabel: text,
    ctaHref: href,
  }),
  share: z.object({
    networks: z.array(z.object({ label: text, name: text, href: text })).min(1),
  }),
})
export type MicrocopySettings = z.infer<typeof microcopySettings>
```


`lib/schemas/settings/index.ts`:

```ts
import { z } from "zod"

import { aboutSectionSettings } from "./sections-about"
import { clientsSectionSettings } from "./sections-clients"
import { consentSettings } from "./consent"
import { contactSettings } from "./contact"
import { contactSectionSettings } from "./sections-contact"
import { customCodeSettings } from "./custom-code"
import { enquireBannerSettings } from "./sections-enquire-banner"
import { footerSettings } from "./footer"
import { leadsSettings } from "./leads"
import { microcopySettings } from "./microcopy"
import { navigationSettings } from "./navigation"
import { seoDefaultsSettings } from "./seo-defaults"
import { siteSettings } from "./site"
import { trackingSettings } from "./tracking"
import { whyChooseUsSettings } from "./sections-why-choose-us"

/** One Zod schema per content settings key (spec §5.4). Integrations live in lib/schemas/integrations (Phase 7). */
export const settingsSchemas = {
  site: siteSettings,
  contact: contactSettings,
  navigation: navigationSettings,
  footer: footerSettings,
  "sections.enquireBanner": enquireBannerSettings,
  "sections.clients": clientsSectionSettings,
  "sections.whyChooseUs": whyChooseUsSettings,
  "sections.about": aboutSectionSettings,
  "sections.contact": contactSectionSettings,
  "seo.defaults": seoDefaultsSettings,
  consent: consentSettings,
  tracking: trackingSettings,
  customCode: customCodeSettings,
  microcopy: microcopySettings,
  leads: leadsSettings,
} as const

export type SettingsKey = keyof typeof settingsSchemas
export const SETTINGS_KEYS = Object.keys(settingsSchemas) as SettingsKey[]
export type SettingsValue<K extends SettingsKey> = z.infer<
  (typeof settingsSchemas)[K]
>

/** Keys the public site reads on every page (header, footer, shared sections). */
export const PUBLIC_SETTINGS_KEYS = [
  "site",
  "contact",
  "navigation",
  "footer",
  "sections.enquireBanner",
  "sections.clients",
  "sections.whyChooseUs",
  "sections.about",
  "sections.contact",
  "seo.defaults",
  "microcopy",
] as const satisfies readonly SettingsKey[]
export type PublicSettingsKey = (typeof PUBLIC_SETTINGS_KEYS)[number]

export function isSettingsKey(value: string): value is SettingsKey {
  return Object.hasOwn(settingsSchemas, value)
}
```


- [ ] **Step 5: Collection record schemas**

`serviceContent` / `articleContent` are the draft/published payloads; slug, relations, sort order and read time are columns (Task 2).

`lib/schemas/content/service.ts`:

```ts
import { z } from "zod"

import { mediaRef, paragraphsText, slug, text } from "../common"

/** The draft/published payload of a service (slug and sortOrder are columns). */
export const serviceContent = z.object({
  title: text,
  description: text,
  icon: mediaRef,
  heroImage: mediaRef,
  image: mediaRef,
  imageAlt: text,
  detail: z.object({
    intro: text,
    heading: text,
    overview: paragraphsText,
    included: z.array(text).min(1),
    callout: text,
  }),
})

/** A service as edited: slug + payload. */
export const serviceSchema = serviceContent.extend({ slug })

export type ServiceContent = z.infer<typeof serviceContent>
export type ServiceInput = z.infer<typeof serviceSchema>
```


`lib/schemas/content/article.ts`:

```ts
import { z } from "zod"

import { mediaRef, richText, slug, text } from "../common"

/**
 * The draft/published payload of an article. lead falls back to the
 * excerpt, empty tags fall back to the category name and a null body shows
 * the excerpt (articles seeded without designed copy).
 */
export const articleContent = z.object({
  title: text,
  excerpt: text,
  cover: mediaRef,
  lead: text.nullable(),
  tags: z.array(text),
  body: richText.nullable(),
})

/** An article as edited: slug, relations (columns) + payload. */
export const articleSchema = articleContent.extend({
  slug,
  categoryId: z.uuid(),
  authorId: z.uuid().nullable(),
})

export type ArticleContent = z.infer<typeof articleContent>
export type ArticleInput = z.infer<typeof articleSchema>
```


`lib/schemas/content/category.ts`:

```ts
import { z } from "zod"

import { slug, text } from "../common"

/** article_categories; showInFilter drives the blog filter bar and article sidebar. */
export const categorySchema = z.object({
  slug,
  name: text,
  showInFilter: z.boolean(),
})
export type CategoryInput = z.infer<typeof categorySchema>
```


`lib/schemas/content/team-member.ts`:

```ts
import { z } from "zod"

import { mediaRef, text } from "../common"

export const teamMemberSchema = z.object({
  name: text,
  role: text,
  bio: text,
  email: z.email(),
  photo: mediaRef.nullable(),
})
export type TeamMemberInput = z.infer<typeof teamMemberSchema>
```


`lib/schemas/content/client.ts`:

```ts
import { z } from "zod"

import { mediaRef, text } from "../common"

export const clientSchema = z.object({
  name: text,
  logo: mediaRef,
  url: z.url().nullable(),
})
export type ClientInput = z.infer<typeof clientSchema>
```


`lib/schemas/content/group-company.ts`:

```ts
import { z } from "zod"

import { mediaRef, text } from "../common"

/** Footer "Other services in the group"; tel: href derived from phone, link is https://{site}. */
export const groupCompanySchema = z.object({
  name: text,
  phone: text,
  site: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domain only, e.g. www.example.ie"),
  logo: mediaRef,
})
export type GroupCompanyInput = z.infer<typeof groupCompanySchema>
```


- [ ] **Step 6: Media list, rich-text builders and the settings fixture**

`server/db/seed/fixtures/media.ts`:

```ts
import "server-only"

import type { MediaRef } from "@/lib/schemas/common"

/**
 * Every public/images file that content references. Seeded as media rows
 * with driver "static" and key = URL path, so rendered src stays identical.
 * Design-only assets (check.svg, ellipse.svg, map-pin.svg, icon-phone.svg,
 * map tiles) stay in public/ and are not in the library.
 */
export const MEDIA = [
  { key: "/images/logo.png", alt: "Security Partners Ltd." },
  { key: "/images/hero.jpg", alt: "" },
  {
    key: "/images/about.png",
    alt: "Security Partners officer reviewing paperwork",
  },
  { key: "/images/banner.png", alt: "" },
  { key: "/images/team-temp.jpg", alt: "" },
  { key: "/images/service-alarm.png", alt: "" },
  { key: "/images/service-patrols.png", alt: "" },
  { key: "/images/service-lockups.png", alt: "" },
  { key: "/images/service-static.png", alt: "" },
  { key: "/images/service-commercial.png", alt: "" },
  { key: "/images/service-event.png", alt: "" },
  { key: "/images/client-dinn-ri.png", alt: "Dinn Rí" },
  { key: "/images/client-langton.png", alt: "Langton House Hotel" },
  { key: "/images/client-hayes.png", alt: "Hayes Hotel" },
  { key: "/images/client-martin-reddin.png", alt: "Martin Reddin" },
  { key: "/images/client-killeen.png", alt: "Killeen Civil Engineering" },
  { key: "/images/client-greenfield.png", alt: "Greenfield" },
  { key: "/images/client-telfords.png", alt: "Telfords" },
  { key: "/images/client-laois-hire.png", alt: "Laois Hire" },
  { key: "/images/group-mjs-eco.png", alt: "MJS Eco" },
  { key: "/images/group-cleaning-partners.png", alt: "Cleaning Partners" },
  { key: "/images/icon-shield.svg", alt: "" },
  { key: "/images/icon-clock.svg", alt: "" },
  { key: "/images/icon-users.svg", alt: "" },
  { key: "/images/icon-map.svg", alt: "" },
  { key: "/images/icon-award.svg", alt: "" },
  { key: "/images/icon-chart.svg", alt: "" },
  { key: "/images/icon-file.svg", alt: "" },
  { key: "/images/clock.svg", alt: "" },
  { key: "/images/phone.svg", alt: "" },
  { key: "/images/pin.svg", alt: "" },
  { key: "/images/mail.svg", alt: "" },
] as const

export type MediaKey = (typeof MEDIA)[number]["key"]

/** Fixtures reference media by key; the seed runner maps keys to row ids. */
export type MediaLookup = (key: MediaKey) => MediaRef

/**
 * Deterministic ids (valid uuid v7 shape) for unit tests and for the
 * fixture-backed site sources: "00000000-0000-7000-8000-000000000001", …
 */
export function fixtureMediaId(key: MediaKey): string {
  const index = MEDIA.findIndex((m) => m.key === key)
  if (index < 0) throw new Error(`Unknown media key ${key}`)
  return `00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`
}

export const fixtureMediaLookup: MediaLookup = (key) => ({
  mediaId: fixtureMediaId(key),
})

/** Reverse of fixtureMediaId. */
export function fixtureMediaKey(id: string): MediaKey {
  const index = Number(id.slice(-12)) - 1
  const entry = MEDIA[index]
  if (!entry || fixtureMediaId(entry.key) !== id)
    throw new Error(`Not a fixture media id: ${id}`)
  return entry.key
}
```


`server/db/seed/fixtures/rich-text.ts`:

```ts
import "server-only"

import type {
  MediaRef,
  ParagraphNode,
  ParagraphsDoc,
  RichTextBlock,
  RichTextDoc,
} from "@/lib/schemas/common"

// Tiny builders for TipTap JSON in fixtures (plain text, no marks).

export const paragraph = (text: string): ParagraphNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
})

export const doc = (...content: RichTextBlock[]): RichTextDoc => ({
  type: "doc",
  content,
})

/** A doc of plain paragraphs. */
export const paragraphs = (...texts: string[]): ParagraphsDoc => ({
  type: "doc",
  content: texts.map(paragraph),
})

export const heading2 = (text: string): RichTextBlock => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
})

export const bulletList = (...items: string[]): RichTextBlock => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(item)],
  })),
})

export const quote = (text: string, cite: string): RichTextBlock => ({
  type: "blockquote",
  attrs: { cite },
  content: [paragraph(text)],
})

export const image = (media: MediaRef, alt: string): RichTextBlock => ({
  type: "image",
  attrs: { media, alt },
})
```


`server/db/seed/fixtures/settings.ts`:

```ts
import "server-only"

import type { SettingsKey, SettingsValue } from "@/lib/schemas/settings"

import type { MediaLookup } from "./media"
import { paragraphs } from "./rich-text"

export type SettingsFixture = { [K in SettingsKey]: SettingsValue<K> }

/**
 * Seed values for every settings key, copied verbatim from the static site
 * (docs/brief-inventory.json). {placeholders} are filled in at render
 * (lib/interpolate.ts), so contact numbers are edited once.
 */
export function settingsFixture(media: MediaLookup): SettingsFixture {
  return {
    site: {
      name: "Security Partners Ltd.",
      legalName: "Security Partners Ltd.",
      logo: media("/images/logo.png"),
      logoAlt: "Security Partners Ltd.",
      logoOnDark: null,
      favicon: null,
      productionUrl: null,
      timezone: "Europe/Dublin",
      locale: "en",
      copyright: "© 2026 Security Partners Ltd. All rights reserved.",
    },
    contact: {
      phone24h: "(085) 8018746",
      office: "057 8697670",
      operationsMobile: "085 859 1299",
      operationsExtension: "Ext 2",
      email: "info@securitypartnersltd.com",
      operationsEmail: "operations@securitypartnersltd.com",
      hours: "Monday–Friday, 9am to 6pm",
      addressLine1: "Derryguile, Mountmellick",
      addressLine2: "Co. Laois, R32 YX49",
      mapsHref:
        "https://www.google.com/maps/search/?api=1&query=Security+Partners+Ltd+Derryguile+Mountmellick+Co.+Laois+R32+YX49",
    },
    navigation: {
      headerLinks: [
        { label: "About", href: "/about" },
        { label: "Services", href: "/services" },
        { label: "Team", href: "/team" },
        { label: "Blog", href: "/blog" },
        { label: "Contact", href: "/contact" },
      ],
      headerCta: { label: "Get a Quote", href: "/contact" },
    },
    footer: {
      tagline:
        "A family-run security company based in Mountmellick, Co. Laois, providing first class security services across Ireland since 2008.",
      quickLinksHeading: "Quick Links",
      contactHeading: "Contact",
      contact: { telLabel: "Tel:", phone24hLabel: "24hr:" },
      groupHeading: "OTHER SERVICES IN THE GROUP",
      groupTelLabel: "Tel:",
      legal: {
        privacy: { label: "Privacy Policy", href: "/privacy" },
        terms: { label: "Terms", href: "/terms" },
      },
    },
    "sections.enquireBanner": {
      image: media("/images/banner.png"),
      eyebrow: "Get in touch",
      heading: "Enquire About Our Services",
      copy: "Tell us what you need protecting and our team will come back to you with a tailored, no-obligation quote.",
      cta: { label: "Get a Quote", href: "/contact" },
      secondaryCta: { label: "Call {office}", href: "{officeHref}" },
    },
    "sections.clients": { eyebrow: "Trusted by", heading: "Our Clients" },
    "sections.whyChooseUs": {
      eyebrow: "Why Security Partners",
      heading: "Why Choose Us",
      copy: "We are dedicated to providing our clients with the best possible services.",
      features: [
        {
          title: "24/7 Operations Team",
          description:
            "A dedicated team who are there for all your security requirements.",
          icon: media("/images/icon-clock.svg"),
        },
        {
          title: "Nationwide Coverage",
          description:
            "Our midlands location lets us carry out contracts throughout Ireland.",
          icon: media("/images/icon-map.svg"),
        },
        {
          title: "Exceptional Training",
          description:
            "Every officer is trained so you get a first class service.",
          icon: media("/images/icon-award.svg"),
        },
        {
          title: "Real-Time Reporting",
          description:
            "Clocking and tag point systems you can view in real time.",
          icon: media("/images/icon-chart.svg"),
        },
      ],
    },
    "sections.about": {
      eyebrow: "Who we are",
      heading: "A family-run security company you can trust",
      body: paragraphs(
        "Security Partners Ltd is a privately owned security company based in Mountmellick, Co. Laois. We are strategically based in the midlands, allowing us to provide services across Ireland.",
        "Since our foundation in 2008, our objective has been and still is to provide a first class service to all sectors of business. We are dedicated to safeguarding our clients' business and investment, and giving them peace of mind."
      ),
      image: media("/images/about.png"),
      imageAlt: "Security Partners officer reviewing paperwork",
      badge: {
        value: "2008",
        label: "Established",
        caption: "Mountmellick, Co. Laois",
      },
      highlights: [
        "Dedicated 24/7 Operations Team for all your security requirements",
        "Midlands location lets us carry out contracts throughout Ireland",
        "Family-run business that has grown by word of mouth",
        "Exceptional training so you get a first class service",
        "24/7 IT service with real-time reporting, clocking and tag point systems",
      ],
    },
    "sections.contact": {
      eyebrow: "Contact",
      heading: "Get In Touch",
      intro:
        "Send us a message and we'll get back to you within one working day.",
      infoItems: [
        {
          title: "Office Hours",
          icon: media("/images/clock.svg"),
          lines: [{ text: "Monday–Friday: 9am to 6pm" }],
        },
        {
          title: "24 Hour Number",
          icon: media("/images/phone.svg"),
          lines: [{ text: "{phone24h}", href: "{phone24hHref}" }],
        },
        {
          title: "Address",
          icon: media("/images/pin.svg"),
          lines: [{ text: "{addressLine1}" }, { text: "{addressLine2}" }],
        },
        {
          title: "Operations",
          icon: media("/images/mail.svg"),
          lines: [
            { text: "Tel: {office} Ext 2", href: "{officeHref}" },
            { text: "or {operationsMobile}", href: "{operationsMobileHref}" },
            { text: "{operationsEmail}", href: "mailto:{operationsEmail}" },
          ],
        },
      ],
      form: {
        nameLabel: "Your Name",
        namePlaceholder: "John Smith",
        emailLabel: "Email",
        emailPlaceholder: "you@company.ie",
        phoneLabel: "Phone",
        phonePlaceholder: "085 000 0000",
        messageLabel: "Message",
        messagePlaceholder: "Tell us about your security requirements...",
        submitLabel: "Send Message",
        mailtoSubject: "Website enquiry from {name}",
      },
      map: {
        link: "{mapsHref}",
        ariaLabel: "Open Security Partners Ltd. location in Google Maps",
        label: "Security Partners Ltd.",
        tiles: "/images/map/tile-{col}-{row}.png",
      },
    },
    "seo.defaults": {
      title: "Security Partners Ltd. | Watching Over You",
      titleTemplate: "{title} | Security Partners Ltd.",
      description:
        "Proactive, flexible and customer-focused security services across Ireland, backed by a dedicated 24/7 operations team. Based in Mountmellick, Co. Laois since 2008.",
      ogImage: null,
    },
    consent: {
      title: "We use cookies",
      body: "We use necessary cookies to run this site. With your consent we also use analytics and marketing cookies to understand how the site is used.",
      acceptLabel: "Accept all",
      rejectLabel: "Reject non-essential",
      customiseLabel: "Customise",
      saveLabel: "Save choices",
      policyLink: { label: "Privacy Policy", href: "/privacy" },
      categories: {
        necessary: {
          label: "Necessary",
          description: "Required for the site to work. Always on.",
        },
        analytics: {
          label: "Analytics",
          description: "Helps us understand how visitors use the site.",
        },
        marketing: {
          label: "Marketing",
          description: "Lets us measure our advertising.",
        },
      },
    },
    tracking: { enabled: false, gtmId: null, ga4Id: null, metaPixelId: null },
    customCode: { headHtml: "", bodyEndHtml: "" },
    microcopy: {
      header: { phone24hLabel: "24 Hour Number:", hoursLabel: "Office hours:" },
      aria: {
        mainNav: "Main",
        openMenu: "Open menu",
        closeMenu: "Close menu",
        mobileNav: "Mobile",
        footerNav: "Footer",
        breadcrumb: "Breadcrumb",
        serviceCardReadMore: "Read more about {title}",
        allServices: "All services",
        blogFilter: "Filter posts by category",
        pagination: "Pagination",
        previousPage: "Previous page",
        pageNumber: "Page {n}",
        nextPage: "Next page",
        categories: "Categories",
        shareOn: "Share on {name}",
      },
      breadcrumb: {
        home: "Home",
        services: "Services",
        servicesHref: "/services",
        blog: "Blog",
        blogHref: "/blog",
      },
      serviceCard: { readMore: "Read More" },
      service: {
        overviewEyebrow: "Service overview",
        includedHeading: "What's included",
        allServicesHeading: "All Services",
        helpEyebrow: "Need help?",
        helpHeading: "Talk to our Operations Team",
        telLabel: "Tel:",
        orLabel: "or",
        phone24hLabel: "24 Hour Number",
        ctaLabel: "Get a Quote",
        ctaHref: "/contact",
        otherEyebrow: "More services",
        otherHeading: "Other Services",
        otherIntro: "Explore the rest of our security services.",
      },
      blog: {
        allPostsFilter: "All Posts",
        readArticle: "Read Article  →",
        featuredBadge: "Featured",
        emptyCategory: "No posts in {category} yet. Check back soon.",
      },
      article: {
        readTime: "{n} min read",
        relatedEyebrow: "Keep reading",
        relatedHeading: "Related Articles",
        tagsLabel: "Tags:",
        shareLabel: "Share:",
        recentPostsHeading: "Recent Posts",
        categoriesHeading: "Categories",
        ctaEyebrow: "Need security?",
        ctaHeading: "Protect your premises after hours",
        ctaCopy:
          "Tell us about your site and we'll come back with a tailored, no-obligation quote.",
        ctaLabel: "Get a Quote",
        ctaHref: "/contact",
      },
      share: {
        networks: [
          {
            label: "f",
            name: "Facebook",
            href: "https://www.facebook.com/sharer/sharer.php?u={url}",
          },
          {
            label: "in",
            name: "LinkedIn",
            href: "https://www.linkedin.com/sharing/share-offsite/?url={url}",
          },
          {
            label: "X",
            name: "X",
            href: "https://x.com/intent/post?url={url}&text={title}",
          },
        ],
      },
    },
    leads: {
      recipients: ["info@securitypartnersltd.com"],
      retentionMonths: 24,
      acknowledgement: false,
    },
  }
}
```


- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/schemas tests/unit/server-only-guard.test.ts`
Expected: PASS (67 schema tests; the server-only guard now also lists the three fixture files).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add lib/schemas/common.ts lib/schemas/settings lib/schemas/content server/db/seed/fixtures/media.ts server/db/seed/fixtures/rich-text.ts server/db/seed/fixtures/settings.ts tests/unit/schemas
git commit -m "feat: add content and settings schemas with seed fixtures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Content tables + migration (master Task 3.1, part 2)

**Files:**
- Create: `server/db/schema/_versioned.ts`, `server/db/schema/{media,pages,services,articles,collections,settings,revisions,redirects,leads,jobs,ai}.ts`
- Modify: `server/db/schema/index.ts`
- Create (generated): `server/db/migrations/0003_content.sql`, `server/db/migrations/meta/0003_snapshot.json`; modify `server/db/migrations/meta/_journal.json`
- Test: `tests/integration/db/content-schema.test.ts`

**Interfaces:**
- Consumes: Phase 1 `id()`, `tsz()`, `timestamps()`, `contentStatus` (`server/db/schema/_shared.ts`); Phase 2 `users` (`server/db/schema/auth.ts`); Task 1 types `Seo`, `ServiceContent`, `ArticleContent`.
- Produces (Drizzle exports, all re-exported from `server/db/schema/index.ts`):

```ts
versioned<T>()  // draft (jsonb not null), published (jsonb), version int=1, status content_status='draft', scheduledAt, publishedAt, updatedBy → users (set null)
media, mediaUsages, mediaDriver ("static"|"disk"|"r2"), MEDIA_DRIVERS   // unique(driver, key)
pages (key unique, template, seo jsonb default {}, …versioned, timestamps)
services (slug unique + CHECK format, sortOrder, seo, …versioned<ServiceContent>)
articleCategories (slug unique + CHECK, name, sortOrder, showInFilter bool default true)
articles (slug unique + CHECK, categoryId → article_categories RESTRICT, authorId → users SET NULL, readTimeMinutes int null, seo, …versioned<ArticleContent>)
teamMembers (name unique, role, bio, email, photoId → media RESTRICT null, sortOrder)
clients (name unique, logoId → media RESTRICT, url null, sortOrder)
groupCompanies (name unique, phone, site, logoId → media RESTRICT, sortOrder)
settings (key pk, draft jsonb, published jsonb, version, updatedBy, updatedAt)
revisions (entityType, entityId, version, data jsonb, actorId, createdAt)
redirects (fromPath unique, toPath, code CHECK in (301,302) default 301, hits)
leads (+ leadStatus enum new|contacted|qualified|won|lost|spam, LEAD_STATUSES), leadEvents
jobs (name, payload, runAt, lockedAt, attempts, lastRunAt, lastError)
aiConversations, aiMessages
```

Spec §5.1/§5.3/§5.5 columns; names are the natural keys the seed upserts on (pages.key, settings.key, slugs, collection names, media driver+key).

- [ ] **Step 1: Write the failing test**

`tests/integration/db/content-schema.test.ts`:

```ts
import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import {
  articleCategories,
  articles,
  media,
  pages,
  redirects,
  services,
} from "@/server/db/schema"

import { resetDb } from "../db"

const CONTENT_TABLES = [
  "ai_conversations",
  "ai_messages",
  "article_categories",
  "articles",
  "clients",
  "group_companies",
  "jobs",
  "lead_events",
  "leads",
  "media",
  "media_usages",
  "pages",
  "redirects",
  "revisions",
  "services",
  "settings",
  "team_members",
]

const serviceContent = {
  title: "T",
  description: "D",
  icon: { mediaId: "00000000-0000-7000-8000-000000000001" },
  heroImage: { mediaId: "00000000-0000-7000-8000-000000000001" },
  image: { mediaId: "00000000-0000-7000-8000-000000000001" },
  imageAlt: "A",
  detail: {
    intro: "I",
    heading: "H",
    overview: {
      type: "doc" as const,
      content: [{ type: "paragraph" as const }],
    },
    included: ["x"],
    callout: "C",
  },
}

/** Postgres error code of a rejected statement (drizzle wraps it in `cause`). */
async function pgCode(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run
    return undefined
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } }
    return e.cause?.code ?? e.code
  }
}

beforeEach(resetDb)

describe("content schema migration (0003_content)", () => {
  it("creates every content table", async () => {
    const { rows } = await getDb().execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public' order by tablename`
    )
    const names = rows.map((r) => r.tablename)
    for (const table of CONTENT_TABLES) expect(names).toContain(table)
  })

  it("defaults versioned rows to draft, version 1, empty seo", async () => {
    const db = getDb()
    const [row] = await db
      .insert(pages)
      .values({ key: "home", template: "home", draft: { a: 1 } })
      .returning()
    expect(row).toMatchObject({
      status: "draft",
      version: 1,
      seo: {},
      published: null,
      publishedAt: null,
    })
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
  })

  it("rejects malformed slugs (23514) and duplicates (23505)", async () => {
    const db = getDb()
    expect(
      await pgCode(
        db.insert(services).values({ slug: "Bad Slug", draft: serviceContent })
      )
    ).toBe("23514")
    await db.insert(services).values({ slug: "ok-slug", draft: serviceContent })
    expect(
      await pgCode(
        db.insert(services).values({ slug: "ok-slug", draft: serviceContent })
      )
    ).toBe("23505")
  })

  it("will not delete a category that has articles (23503)", async () => {
    const db = getDb()
    const [category] = await db
      .insert(articleCategories)
      .values({ slug: "news", name: "News" })
      .returning()
    await db.insert(articles).values({
      slug: "a",
      categoryId: category.id,
      draft: {
        title: "T",
        excerpt: "E",
        cover: { mediaId: "00000000-0000-7000-8000-000000000001" },
        lead: null,
        tags: [],
        body: null,
      },
    })
    expect(
      await pgCode(
        db
          .delete(articleCategories)
          .where(eq(articleCategories.id, category.id))
      )
    ).toBe("23503")
  })

  it("keeps one media row per driver + key", async () => {
    const db = getDb()
    const row = {
      key: "/images/hero.jpg",
      driver: "static" as const,
      mime: "image/jpeg",
      size: 1,
    }
    await db.insert(media).values(row)
    expect(await pgCode(db.insert(media).values(row))).toBe("23505")
    await db.insert(media).values({ ...row, driver: "disk" })
  })

  it("only allows 301/302 redirects", async () => {
    const db = getDb()
    await db.insert(redirects).values({ fromPath: "/a", toPath: "/b" })
    expect(
      await pgCode(
        db.insert(redirects).values({ fromPath: "/c", toPath: "/d", code: 307 })
      )
    ).toBe("23514")
  })
})
```


- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration tests/integration/db/content-schema.test.ts`
Expected: FAIL — `Failed to resolve import` / `articleCategories` is not exported from `@/server/db/schema`.

- [ ] **Step 3: Table modules**

`server/db/schema/_versioned.ts`:

```ts
import "server-only"

import { integer, jsonb, uuid } from "drizzle-orm/pg-core"

import { contentStatus, tsz } from "./_shared"
import { users } from "./auth"

/**
 * Spec §5.1 versioning columns shared by pages, services and articles:
 * public reads use `published` only; `version` is the optimistic lock.
 */
export const versioned = <T>() => ({
  draft: jsonb("draft").$type<T>().notNull(),
  published: jsonb("published").$type<T>(),
  version: integer("version").notNull().default(1),
  status: contentStatus("status").notNull().default("draft"),
  scheduledAt: tsz("scheduled_at"),
  publishedAt: tsz("published_at"),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
})
```


`server/db/schema/media.ts`:

```ts
import "server-only"

import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { id, timestamps } from "./_shared"
import { users } from "./auth"

/** static = shipped in public/ (key is the URL path); disk/r2 come in Phase 6. */
export const MEDIA_DRIVERS = ["static", "disk", "r2"] as const
export const mediaDriver = pgEnum("media_driver", MEDIA_DRIVERS)

export const media = pgTable(
  "media",
  {
    id: id(),
    key: text("key").notNull(),
    driver: mediaDriver("driver").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    blurDataUrl: text("blur_data_url"),
    focalX: real("focal_x"),
    focalY: real("focal_y"),
    alt: text("alt").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [unique("media_driver_key_unique").on(t.driver, t.key)]
)

/** Where a media row is used (Phase 6 blocks deleting media in use). */
export const mediaUsages = pgTable(
  "media_usages",
  {
    id: id(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    field: text("field").notNull(),
  },
  (t) => [
    unique("media_usages_unique").on(
      t.mediaId,
      t.entityType,
      t.entityId,
      t.field
    ),
    index("media_usages_entity_idx").on(t.entityType, t.entityId),
  ]
)
```


`server/db/schema/pages.ts`:

```ts
import "server-only"

import { jsonb, pgTable, text } from "drizzle-orm/pg-core"

import type { Seo } from "@/lib/schemas/common"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"

/** Fixed-template pages (spec §5.2). Rows are seeded; the admin never creates or deletes them. */
export const pages = pgTable("pages", {
  id: id(),
  key: text("key").notNull().unique(),
  template: text("template").notNull(),
  seo: jsonb("seo").$type<Seo>().notNull().default({}),
  ...versioned<unknown>(),
  ...timestamps(),
})
```


`server/db/schema/services.ts`:

```ts
import "server-only"

import { sql } from "drizzle-orm"
import { check, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"

import type { Seo } from "@/lib/schemas/common"
import type { ServiceContent } from "@/lib/schemas/content/service"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"

export const services = pgTable(
  "services",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    seo: jsonb("seo").$type<Seo>().notNull().default({}),
    ...versioned<ServiceContent>(),
    ...timestamps(),
  },
  (t) => [
    check("services_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ]
)
```


`server/db/schema/articles.ts`:

```ts
import "server-only"

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"

import type { Seo } from "@/lib/schemas/common"
import type { ArticleContent } from "@/lib/schemas/content/article"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"
import { users } from "./auth"

export const articleCategories = pgTable(
  "article_categories",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    showInFilter: boolean("show_in_filter").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    check(
      "article_categories_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`
    ),
  ]
)

export const articles = pgTable(
  "articles",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => articleCategories.id, { onDelete: "restrict" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Computed from the body on save (Phase 5); null = not shown. */
    readTimeMinutes: integer("read_time_minutes"),
    seo: jsonb("seo").$type<Seo>().notNull().default({}),
    ...versioned<ArticleContent>(),
    ...timestamps(),
  },
  (t) => [
    check("articles_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    index("articles_published_at_idx").on(t.publishedAt),
    index("articles_category_id_idx").on(t.categoryId),
    index("articles_author_id_idx").on(t.authorId),
  ]
)
```


`server/db/schema/collections.ts`:

```ts
import "server-only"

import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { id, timestamps } from "./_shared"
import { media } from "./media"

// Small collections publish immediately (spec §5.3); names are the natural
// keys the seed upserts on.

export const teamMembers = pgTable("team_members", {
  id: id(),
  name: text("name").notNull().unique(),
  role: text("role").notNull(),
  bio: text("bio").notNull(),
  email: text("email").notNull(),
  photoId: uuid("photo_id").references(() => media.id, {
    onDelete: "restrict",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
})

export const clients = pgTable("clients", {
  id: id(),
  name: text("name").notNull().unique(),
  logoId: uuid("logo_id")
    .notNull()
    .references(() => media.id, { onDelete: "restrict" }),
  url: text("url"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
})

export const groupCompanies = pgTable("group_companies", {
  id: id(),
  name: text("name").notNull().unique(),
  phone: text("phone").notNull(),
  site: text("site").notNull(),
  logoId: uuid("logo_id")
    .notNull()
    .references(() => media.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
})
```


`server/db/schema/settings.ts`:

```ts
import "server-only"

import { integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { tsz } from "./_shared"
import { users } from "./auth"

/** Globals (spec §5.4): content keys are draft/published; integrations (Phase 7) store encrypted values in `draft`. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  draft: jsonb("draft").notNull(),
  published: jsonb("published"),
  version: integer("version").notNull().default(1),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: tsz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
```


`server/db/schema/revisions.ts`:

```ts
import "server-only"

import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { id, tsz } from "./_shared"
import { users } from "./auth"

/** Snapshot per publish/collection change (spec §5.1). */
export const revisions = pgTable(
  "revisions",
  {
    id: id(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    version: integer("version").notNull(),
    data: jsonb("data").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("revisions_entity_idx").on(t.entityType, t.entityId, t.version)]
)
```


`server/db/schema/redirects.ts`:

```ts
import "server-only"

import { sql } from "drizzle-orm"
import { check, integer, pgTable, text } from "drizzle-orm/pg-core"

import { id, timestamps } from "./_shared"

export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    code: integer("code").notNull().default(301),
    hits: integer("hits").notNull().default(0),
    ...timestamps(),
  },
  (t) => [check("redirects_code", sql`${t.code} in (301, 302)`)]
)
```


`server/db/schema/leads.ts`:

```ts
import "server-only"

import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"

import { id, timestamps, tsz } from "./_shared"
import { users } from "./auth"

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
  "spam",
] as const
export const leadStatus = pgEnum("lead_status", LEAD_STATUSES)

export const leads = pgTable(
  "leads",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    company: text("company"),
    service: text("service"),
    message: text("message").notNull(),
    consent: boolean("consent").notNull().default(false),
    status: leadStatus("status").notNull().default("new"),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourcePage: text("source_page"),
    /** HMAC of the client IP (HKDF purpose "lead-ip"), never the raw IP. */
    ipHash: text("ip_hash"),
    ...timestamps(),
  },
  (t) => [
    index("leads_created_at_idx").on(t.createdAt),
    index("leads_status_idx").on(t.status),
  ]
)

export const leadEvents = pgTable(
  "lead_events",
  {
    id: id(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    body: text("body"),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("lead_events_lead_id_idx").on(t.leadId)]
)
```


`server/db/schema/jobs.ts`:

```ts
import "server-only"

import { index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"

import { id, timestamps, tsz } from "./_shared"

/** In-process scheduler queue (spec §12), claimed with FOR UPDATE SKIP LOCKED in Phase 5. */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    name: text("name").notNull(),
    payload: jsonb("payload"),
    runAt: tsz("run_at").notNull(),
    lockedAt: tsz("locked_at"),
    attempts: integer("attempts").notNull().default(0),
    lastRunAt: tsz("last_run_at"),
    lastError: text("last_error"),
    ...timestamps(),
  },
  (t) => [index("jobs_run_at_idx").on(t.runAt)]
)
```


`server/db/schema/ai.ts`:

```ts
import "server-only"

import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { id, timestamps, tsz } from "./_shared"
import { users } from "./auth"

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    context: jsonb("context"),
    ...timestamps(),
  },
  (t) => [index("ai_conversations_user_id_idx").on(t.userId)]
)

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_messages_conversation_id_idx").on(t.conversationId)]
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
export * from "./media"
export * from "./pages"
export * from "./services"
export * from "./articles"
export * from "./collections"
export * from "./settings"
export * from "./revisions"
export * from "./redirects"
export * from "./leads"
export * from "./jobs"
export * from "./ai"
```


- [ ] **Step 4: Generate and apply the migration**

Run: `pnpm db:generate --name content`
Expected: `[✓] Your SQL migration file ➜ server/db/migrations/0003_content.sql` with exactly (do not hand-edit the generated files):

```sql
CREATE TYPE "public"."media_driver" AS ENUM('static', 'disk', 'r2');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'won', 'lost', 'spam');--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"driver" "media_driver" NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"blur_data_url" text,
	"focal_x" real,
	"focal_y" real,
	"alt" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_driver_key_unique" UNIQUE("driver","key")
);
--> statement-breakpoint
CREATE TABLE "media_usages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"media_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field" text NOT NULL,
	CONSTRAINT "media_usages_unique" UNIQUE("media_id","entity_type","entity_id","field")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"template" text NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug"),
	CONSTRAINT "services_slug_format" CHECK ("services"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "article_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"show_in_filter" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "article_categories_slug_format" CHECK ("article_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid NOT NULL,
	"author_id" uuid,
	"read_time_minutes" integer,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "articles_slug_format" CHECK ("articles"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_id" uuid NOT NULL,
	"url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "group_companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"site" text NOT NULL,
	"logo_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_companies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"bio" text NOT NULL,
	"email" text NOT NULL,
	"photo_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"code" integer DEFAULT 301 NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_from_path_unique" UNIQUE("from_path"),
	CONSTRAINT "redirects_code" CHECK ("redirects"."code" in (301, 302))
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" text NOT NULL,
	"body" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"service" text,
	"message" text NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"assignee_id" uuid,
	"source_page" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb,
	"run_at" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_article_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."article_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_companies" ADD CONSTRAINT "group_companies_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_usages_entity_idx" ON "media_usages" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_category_id_idx" ON "articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "articles_author_id_idx" ON "articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "revisions_entity_idx" ON "revisions" USING btree ("entity_type","entity_id","version");--> statement-breakpoint
CREATE INDEX "lead_events_lead_id_idx" ON "lead_events" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_run_at_idx" ON "jobs" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages" USING btree ("conversation_id");
```

Run: `pnpm db:migrate`
Expected: `[migrate] migrations applied`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:integration tests/integration/db/content-schema.test.ts tests/integration/db/client.test.ts`
Expected: PASS (6 + 3 tests).

Run: `pnpm lint && pnpm typecheck && pnpm test:unit tests/unit/server-only-guard.test.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/db/schema server/db/migrations tests/integration/db/content-schema.test.ts
git commit -m "feat: add content, media, leads and scheduler tables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Template schemas + registry + page fixtures (master Task 3.2)

**Files:**
- Create: `templates/{home,about,services,team,blog,contact,legal}/schema.ts`, `templates/registry.ts`
- Create: `server/db/seed/fixtures/pages.ts`
- Test: `tests/unit/helpers/schema-paths.ts`, `tests/unit/templates/inventory.test.ts`

**Interfaces:**
- Consumes: Task 1 (`text`, `link`, `href`, `slug`, `mediaRef`, `pageHero`, `iconCard`, `richText`, `paragraphsText`, `seo`, settings and content schemas, `fixtureMediaLookup`, fixture builders).
- Produces:

```ts
// templates/*/schema.ts (isomorphic; ESLint forbids server imports here)
export const homeTemplate, aboutTemplate, servicesTemplate, teamTemplate, blogTemplate, contactTemplate, legalTemplate
export type HomeTemplate, AboutTemplate, ServicesTemplate, TeamTemplate, BlogTemplate, ContactTemplate, LegalTemplate
// templates/registry.ts
export const templates: Record<TemplateName, { schema; label }>   // home about services team blog contact legal
export type TemplateName; export type TemplateData<T extends TemplateName>
export const PAGES = { home: "home", about: "about", services: "services", team: "team", blog: "blog", contact: "contact", privacy: "legal", terms: "legal" }
export type PageKey; export const PAGE_KEYS: PageKey[]; export type PageData<K extends PageKey>
export const PAGE_PATHS: Record<PageKey, string>
export function isPageKey(value: string): value is PageKey
export function templateSchemaFor(key: PageKey)
// server/db/seed/fixtures/pages.ts
export type PageFixture<K extends PageKey> = { data: PageData<K>; seo: Seo }
export type PagesFixture = { [K in PageKey]: PageFixture<K> }
export function pagesFixture(media: MediaLookup): PagesFixture
// tests/unit/helpers/schema-paths.ts (test helper)
export type SchemaPaths = { leaves: Set<string>; lists: Set<string> }
export function schemaPaths(schema: z.ZodType): SchemaPaths   // "hero.heading", "stats[].value", "highlights[]"; media/rich text are leaves
```

The inventory test is the master acceptance: for each of the six inventoried pages the template's leaf paths **equal** the inventory's fields (`pages.<key>.seo.*` map onto the `seo` column schema); every `settings.*` and collection target exists in its schema, except values derived at render (`settings.contact.*Href`, `groupCompanies[].phoneHref`, article bylines from `users`, `publishedAt`/`readTimeMinutes` columns). `pages.team.leadership.photoPlaceholder` is also rendered on `/` (the inventory's choice), so the home view reads it from the team page in Task 8. Legal pages are new (spec §5.2) and not in the inventory; their copy is placeholder text for owner review (brief §4).

- [ ] **Step 1: Write the failing tests**

`tests/unit/helpers/schema-paths.ts`:

```ts
import { z } from "zod"

import { mediaRef, paragraphsText, richText } from "@/lib/schemas/common"

/**
 * Field paths of a Zod object schema, in the inventory's notation:
 * "hero.heading", "stats[].value", "highlights[]". `lists` holds the array
 * paths themselves ("stats"); media refs and rich text are leaves.
 */
export type SchemaPaths = { leaves: Set<string>; lists: Set<string> }

function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  )
    current = current.def.innerType as z.ZodType
  return current
}

function walk(schema: z.ZodType, path: string, out: SchemaPaths): void {
  const inner = unwrap(schema)
  if (inner === mediaRef || inner === richText || inner === paragraphsText) {
    out.leaves.add(path)
    return
  }
  if (inner instanceof z.ZodObject) {
    for (const [key, child] of Object.entries(inner.shape))
      walk(child as z.ZodType, path ? `${path}.${key}` : key, out)
    return
  }
  if (inner instanceof z.ZodArray) {
    out.lists.add(path)
    const element = unwrap(inner.element as z.ZodType)
    if (element instanceof z.ZodObject && element !== mediaRef)
      walk(element, `${path}[]`, out)
    else out.leaves.add(`${path}[]`)
    return
  }
  out.leaves.add(path)
}

export function schemaPaths(schema: z.ZodType): SchemaPaths {
  const out: SchemaPaths = { leaves: new Set(), lists: new Set() }
  walk(schema, "", out)
  return out
}
```


`tests/unit/templates/inventory.test.ts`:

```ts
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { seo } from "@/lib/schemas/common"
import { articleSchema } from "@/lib/schemas/content/article"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { serviceSchema } from "@/lib/schemas/content/service"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"
import { settingsSchemas, type SettingsKey } from "@/lib/schemas/settings"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { PAGE_KEYS, PAGES, templates } from "@/templates/registry"

import { schemaPaths } from "../helpers/schema-paths"

type Entry = { id: string; kind: string; target: string; value: string }
const { entries } = JSON.parse(
  readFileSync("docs/brief-inventory.json", "utf8")
) as { entries: Entry[] }

/** "articles[18-years-…].title" → "articles[].title". */
const normalise = (target: string) => target.replace(/\[[a-z0-9-]+\]/g, "[]")

/** Inventory field paths under `prefix` (prefix stripped), minus collection markers. */
function inventoryPaths(prefix: string): Set<string> {
  return new Set(
    entries
      .map((e) => normalise(e.target))
      .filter((t) => t.startsWith(prefix) && !t.endsWith("[].*"))
      .map((t) => t.slice(prefix.length))
  )
}

/** Values derived at render instead of stored (ruling: *Href from numbers). */
const DERIVED: Record<string, string[]> = {
  "settings.contact.": ["phone24hHref", "officeHref", "operationsMobileHref"],
  "groupCompanies[].": ["phoneHref"],
  // byline from users (name, title); publishedAt/readTimeMinutes are columns
  "articles[].": [
    "author.name",
    "author.role",
    "publishedAt",
    "readTimeMinutes",
  ],
}

function expectInventoryCovered(
  prefix: string,
  schemaPathsOf: ReturnType<typeof schemaPaths>
) {
  const known = new Set([
    ...schemaPathsOf.leaves,
    ...schemaPathsOf.lists,
    ...(DERIVED[prefix] ?? []),
  ])
  const missing = [...inventoryPaths(prefix)].filter((p) => !known.has(p))
  expect(
    missing,
    `inventory fields under ${prefix} with no schema field`
  ).toEqual([])
}

describe("template schemas match docs/brief-inventory.json (master Task 3.2)", () => {
  const fixture = pagesFixture(fixtureMediaLookup)

  it("registry maps the eight pages to seven templates", () => {
    expect(PAGE_KEYS).toEqual([
      "home",
      "about",
      "services",
      "team",
      "blog",
      "contact",
      "privacy",
      "terms",
    ])
    expect(Object.keys(templates).sort()).toEqual([
      "about",
      "blog",
      "contact",
      "home",
      "legal",
      "services",
      "team",
    ])
  })

  it.each(PAGE_KEYS)(
    "pages.%s fixture parses and round-trips unchanged",
    (key) => {
      const schema = templates[PAGES[key]].schema
      expect(schema.parse(fixture[key].data)).toEqual(fixture[key].data)
      expect(seo.parse(fixture[key].seo)).toEqual(fixture[key].seo)
    }
  )

  it.each(["home", "about", "services", "team", "blog", "contact"] as const)(
    "pages.%s: schema leaf paths equal the inventory's fields",
    (key) => {
      const prefix = `pages.${key}.`
      const inventory = new Set(
        [...inventoryPaths(prefix)].filter((p) => !p.startsWith("seo."))
      )
      const paths = schemaPaths(templates[PAGES[key]].schema)
      // every inventory field exists in the schema …
      expect(
        [...inventory].filter(
          (p) => !paths.leaves.has(p) && !paths.lists.has(p)
        )
      ).toEqual([])
      // … and every schema leaf is in the inventory (a list of strings may
      // be recorded as the list itself, e.g. "tags")
      expect(
        [...paths.leaves].filter(
          (p) =>
            !inventory.has(p) &&
            !(p.endsWith("[]") && inventory.has(p.slice(0, -2)))
        )
      ).toEqual([])
    }
  )

  it("page seo.* fields map onto the seo column schema", () => {
    const seoPaths = schemaPaths(seo).leaves
    const seoFields = entries
      .map((e) => e.target)
      .filter((t) => /^pages\.\w+\.seo\./.test(t))
      .map((t) => t.replace(/^pages\.\w+\.seo\./, ""))
    expect(seoFields.length).toBeGreaterThan(0)
    expect(seoFields.filter((f) => !seoPaths.has(f))).toEqual([])
  })

  it("legal pages are new (spec §5.2) and absent from the inventory", () => {
    expect(inventoryPaths("pages.privacy.").size).toBe(0)
    expect(inventoryPaths("pages.terms.").size).toBe(0)
  })
})

describe("settings and collection schemas cover the inventory", () => {
  const settingsKeys = Object.keys(settingsSchemas) as SettingsKey[]

  it("every settings.* target names a known settings key", () => {
    const unknown = entries
      .map((e) => e.target)
      .filter((t) => t.startsWith("settings."))
      .filter((t) => !settingsKeys.some((k) => t.startsWith(`settings.${k}.`)))
    expect(unknown).toEqual([])
  })

  it.each(settingsKeys)("settings.%s", (key) => {
    expectInventoryCovered(
      `settings.${key}.`,
      schemaPaths(settingsSchemas[key])
    )
  })

  it.each([
    ["services[].", serviceSchema],
    ["articles[].", articleSchema],
    ["categories[].", categorySchema],
    ["team[].", teamMemberSchema],
    ["clients[].", clientSchema],
    ["groupCompanies[].", groupCompanySchema],
  ] as const)("%s", (prefix, schema) => {
    expect(inventoryPaths(prefix).size).toBeGreaterThan(0)
    expectInventoryCovered(prefix, schemaPaths(schema))
  })
})
```


- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit tests/unit/templates/inventory.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/db/seed/fixtures/pages"` (and `@/templates/registry`).

- [ ] **Step 3: Template schemas and registry**

`templates/home/schema.ts`:

```ts
import { z } from "zod"

import { link, mediaRef, text } from "@/lib/schemas/common"

const sectionCopy = z.object({ eyebrow: text, heading: text, intro: text })

/** Page "home" (/): hero, section headings and how many posts the blog strip shows. */
export const homeTemplate = z.object({
  hero: z.object({
    eyebrow: text,
    heading: text,
    tagline: text,
    subheading: text,
    backgroundImage: mediaRef,
    primaryCta: link,
    secondaryCta: link,
    stats: z
      .array(
        z.object({
          value: text,
          label: text,
          /** Counts up from 0 to this number on load (GSAP data-count). */
          count: z.number().int().min(0).optional(),
          suffix: z.string().max(10).optional(),
        })
      )
      .min(1),
  }),
  services: sectionCopy,
  team: sectionCopy,
  blog: sectionCopy.extend({
    cta: link,
    count: z.number().int().min(1).max(12),
  }),
})
export type HomeTemplate = z.infer<typeof homeTemplate>
```


`templates/about/schema.ts`:

```ts
import { z } from "zod"

import { iconCard, pageHero, text } from "@/lib/schemas/common"

/** Page "about" (/about). The About section itself is settings.sections.about. */
export const aboutTemplate = z.object({
  hero: pageHero,
  stats: z
    .array(z.object({ value: text, label: text, description: text }))
    .min(1),
  values: z.object({
    eyebrow: text,
    title: text,
    description: text,
    items: z.array(iconCard).min(1),
  }),
})
export type AboutTemplate = z.infer<typeof aboutTemplate>
```


`templates/services/schema.ts`:

```ts
import { z } from "zod"

import { pageHero, text } from "@/lib/schemas/common"

/** Page "services" (/services). Cards come from the services collection. */
export const servicesTemplate = z.object({
  hero: pageHero,
  servicesSection: z.object({ eyebrow: text, heading: text, intro: text }),
})
export type ServicesTemplate = z.infer<typeof servicesTemplate>
```


`templates/team/schema.ts`:

```ts
import { z } from "zod"

import { iconCard, mediaRef, pageHero, text } from "@/lib/schemas/common"

/** Page "team" (/team). photoPlaceholder sits behind every member photo (also on /). */
export const teamTemplate = z.object({
  hero: pageHero,
  leadership: z.object({
    eyebrow: text,
    heading: text,
    intro: text,
    photoPlaceholder: mediaRef,
  }),
  officers: z.object({
    eyebrow: text,
    title: text,
    description: text,
    qualities: z.array(iconCard).min(1),
  }),
})
export type TeamTemplate = z.infer<typeof teamTemplate>
```


`templates/blog/schema.ts`:

```ts
import { z } from "zod"

import { pageHero, slug } from "@/lib/schemas/common"

/** Page "blog" (/blog): featured article (by slug) and posts per page. */
export const blogTemplate = z.object({
  hero: pageHero,
  featuredArticle: slug.nullable(),
  pageSize: z.number().int().min(1).max(24),
})
export type BlogTemplate = z.infer<typeof blogTemplate>
```


`templates/contact/schema.ts`:

```ts
import { z } from "zod"

import { href, mediaRef, pageHero, text } from "@/lib/schemas/common"

/** Page "contact" (/contact). The contact section and map are settings.sections.contact. */
export const contactTemplate = z.object({
  hero: pageHero,
  departments: z.object({
    eyebrow: text,
    heading: text,
    intro: text,
    items: z
      .array(
        z.object({
          title: text,
          icon: mediaRef,
          name: text,
          role: text,
          lines: z.array(z.object({ text, href })).min(1),
        })
      )
      .min(1),
  }),
})
export type ContactTemplate = z.infer<typeof contactTemplate>
```


`templates/legal/schema.ts`:

```ts
import { z } from "zod"

import { pageHero, richText } from "@/lib/schemas/common"

/** Pages "privacy" and "terms": PageHero + article-styled rich text. */
export const legalTemplate = z.object({ hero: pageHero, body: richText })
export type LegalTemplate = z.infer<typeof legalTemplate>
```


`templates/registry.ts`:

```ts
import { z } from "zod"

import { aboutTemplate } from "./about/schema"
import { blogTemplate } from "./blog/schema"
import { contactTemplate } from "./contact/schema"
import { homeTemplate } from "./home/schema"
import { legalTemplate } from "./legal/schema"
import { servicesTemplate } from "./services/schema"
import { teamTemplate } from "./team/schema"

/** Fixed templates (spec §5.2): schema validates a page's draft/published data. */
export const templates = {
  home: { schema: homeTemplate, label: "Home" },
  about: { schema: aboutTemplate, label: "About" },
  services: { schema: servicesTemplate, label: "Services" },
  team: { schema: teamTemplate, label: "Team" },
  blog: { schema: blogTemplate, label: "Blog" },
  contact: { schema: contactTemplate, label: "Contact" },
  legal: { schema: legalTemplate, label: "Legal page" },
} as const

export type TemplateName = keyof typeof templates
export type TemplateData<T extends TemplateName> = z.infer<
  (typeof templates)[T]["schema"]
>

/** Every page row: key → template. Seeded; never created or deleted in the admin. */
export const PAGES = {
  home: "home",
  about: "about",
  services: "services",
  team: "team",
  blog: "blog",
  contact: "contact",
  privacy: "legal",
  terms: "legal",
} as const satisfies Record<string, TemplateName>

export type PageKey = keyof typeof PAGES
export const PAGE_KEYS = Object.keys(PAGES) as PageKey[]
export type PageData<K extends PageKey> = TemplateData<(typeof PAGES)[K]>

/** Public URL of each page. */
export const PAGE_PATHS = {
  home: "/",
  about: "/about",
  services: "/services",
  team: "/team",
  blog: "/blog",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
} as const satisfies Record<PageKey, string>

export function isPageKey(value: string): value is PageKey {
  return Object.hasOwn(PAGES, value)
}

export function templateSchemaFor(key: PageKey) {
  return templates[PAGES[key]].schema
}
```


- [ ] **Step 4: Page fixtures**

`server/db/seed/fixtures/pages.ts`:

```ts
import "server-only"

import type { Seo } from "@/lib/schemas/common"
import type { PageData, PageKey } from "@/templates/registry"

import type { MediaLookup } from "./media"
import { doc, heading2, paragraph } from "./rich-text"

export type PageFixture<K extends PageKey> = { data: PageData<K>; seo: Seo }
export type PagesFixture = { [K in PageKey]: PageFixture<K> }

/** Seed data for the eight fixed pages, copied verbatim from the static site. */
export function pagesFixture(media: MediaLookup): PagesFixture {
  return {
    home: {
      seo: {},
      data: {
        hero: {
          eyebrow: "Mountmellick, Co. Laois  •  Since 2008",
          heading: "Security Partners Ltd.",
          tagline: "Watching Over You",
          subheading:
            "Proactive, flexible and customer-focused security services across Ireland, backed by a dedicated 24/7 operations team.",
          backgroundImage: media("/images/hero.jpg"),
          primaryCta: { label: "Our Services", href: "#services" },
          secondaryCta: {
            label: "Call 24/7: {phone24h}",
            href: "{phone24hHref}",
          },
          stats: [
            {
              value: "18+",
              label: "Years in business",
              count: 18,
              suffix: "+",
            },
            { value: "24/7", label: "Operations team" },
            { value: "Nationwide", label: "Coverage across Ireland" },
          ],
        },
        services: {
          eyebrow: "What we do",
          heading: "Our Services",
          intro:
            "Professional security solutions for every sector, from a single alarm response to full-time static guarding.",
        },
        team: {
          eyebrow: "Our people",
          heading: "Meet The Team",
          intro: "The people behind Security Partners.",
        },
        blog: {
          eyebrow: "News & insights",
          heading: "From Our Blog",
          intro:
            "Security tips, company news and advice from the Security Partners team.",
          cta: { label: "View All Posts", href: "/blog" },
          count: 3,
        },
      },
    },
    about: {
      seo: {
        title: "About Us | Security Partners Ltd.",
        description:
          "A family-run security company based in Mountmellick, Co. Laois, providing first class security services across Ireland since 2008.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "About Us",
          title: "About Security Partners",
          description:
            "A family-run security company based in Mountmellick, Co. Laois, providing first class security services across Ireland since 2008.",
        },
        stats: [
          {
            value: "2008",
            label: "Founded",
            description:
              "Family-run, and grown through the years by word of mouth.",
          },
          {
            value: "24/7",
            label: "Operations Team",
            description:
              "There for all your security requirements, day or night.",
          },
          {
            value: "Nationwide",
            label: "Coverage",
            description:
              "Our midlands base lets us carry out contracts throughout Ireland.",
          },
          {
            value: "Real-time",
            label: "Reporting",
            description:
              "Clocking and tag point systems you can view as they happen.",
          },
        ],
        values: {
          eyebrow: "Our values",
          title: "What We Stand For",
          description:
            "Security Partners Ltd has an excellent reputation for providing a proactive, flexible and quality service that is completely customer focused.",
          items: [
            {
              title: "Proactive",
              description:
                "We deal with risks early, safeguarding your business, your investment and your peace of mind.",
              icon: media("/images/icon-shield.svg"),
            },
            {
              title: "Flexible",
              description:
                "Services planned around your premises and your schedule, from a single alarm response to full-time guarding.",
              icon: media("/images/icon-clock.svg"),
            },
            {
              title: "Customer Focused",
              description:
                "Exceptional training for every officer, and a dedicated point of contact for every query.",
              icon: media("/images/icon-users.svg"),
            },
          ],
        },
      },
    },
    services: {
      seo: {
        title: "Our Services | Security Partners Ltd.",
        description:
          "Professional security solutions for every sector, from a single alarm response to full-time static guarding.",
      },
      data: {
        hero: {
          image: media("/images/banner.png"),
          crumb: "Services",
          title: "Our Services",
          description:
            "Professional security solutions for every sector, from a single alarm response to full-time static guarding.",
        },
        servicesSection: {
          eyebrow: "What we do",
          heading: "Security For Every Sector",
          intro:
            "Six specialist services, all backed by our dedicated 24/7 Operations Team.",
        },
      },
    },
    team: {
      seo: {
        title: "Our Team | Security Partners Ltd.",
        description:
          "The experienced people behind Security Partners, from operations to HR and accounts.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Our Team",
          title: "Meet The Team",
          description:
            "The experienced people behind Security Partners, from operations to HR and accounts.",
        },
        leadership: {
          eyebrow: "Our people",
          heading: "Leadership & Management",
          intro: "Contact the right person directly for your query.",
          photoPlaceholder: media("/images/team-temp.jpg"),
        },
        officers: {
          eyebrow: "On the ground",
          title: "Our Officers",
          description:
            "Behind our management team is a team of licensed, uniformed officers working across Ireland.",
          qualities: [
            {
              title: "Exceptional Training",
              description:
                "Exceptional training is provided to our staff so you get a first class service.",
              icon: media("/images/icon-award.svg"),
            },
            {
              title: "Licensed & Uniformed",
              description:
                "Clearly identifiable officers who provide a visible deterrent on your premises.",
              icon: media("/images/icon-shield.svg"),
            },
            {
              title: "Experienced Teams",
              description:
                "Officers with years of experience in hotels, bars, retail and high profile late venues.",
              icon: media("/images/icon-users.svg"),
            },
          ],
        },
      },
    },
    blog: {
      seo: {
        title: "News & Insights | Security Partners Ltd.",
        description:
          "Security tips, company news and advice from the Security Partners team.",
      },
      data: {
        hero: {
          image: media("/images/banner.png"),
          crumb: "Blog",
          title: "News & Insights",
          description:
            "Security tips, company news and advice from the Security Partners team.",
        },
        featuredArticle: "18-years-of-watching-over-ireland",
        pageSize: 6,
      },
    },
    contact: {
      seo: {
        title: "Contact Us | Security Partners Ltd.",
        description:
          "Get in touch with our team. For urgent matters, our 24 Hour Number is {phone24h}.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Contact",
          title: "Contact Us",
          description:
            "Get in touch with our team. For urgent matters, our 24 Hour Number is {phone24h}.",
        },
        departments: {
          eyebrow: "Departments",
          heading: "Reach The Right Team",
          intro:
            "Contact the right person directly for faster help with your query.",
          items: [
            {
              title: "Operations",
              icon: media("/images/icon-shield.svg"),
              name: "John McDonald",
              role: "Operations Director",
              lines: [
                { text: "Tel: {office} Ext 2", href: "{officeHref}" },
                {
                  text: "or {operationsMobile}",
                  href: "{operationsMobileHref}",
                },
                {
                  text: "{operationsEmail}",
                  href: "mailto:{operationsEmail}",
                },
              ],
            },
            {
              title: "HR",
              icon: media("/images/icon-users.svg"),
              name: "Sarah Moran",
              role: "HR/Operations Manager",
              lines: [
                { text: "Tel: (085) 8062369", href: "tel:+353858062369" },
                {
                  text: "HR@securitypartnersltd.com",
                  href: "mailto:HR@securitypartnersltd.com",
                },
              ],
            },
            {
              title: "Accounts",
              icon: media("/images/icon-file.svg"),
              name: "Louise Sheeran",
              role: "Accounts Manager",
              lines: [
                { text: "Tel: (057) 8697670 Ext 3", href: "{officeHref}" },
                {
                  text: "accounts@securitypartnersltd.com",
                  href: "mailto:accounts@securitypartnersltd.com",
                },
              ],
            },
          ],
        },
      },
    },
    privacy: {
      seo: {
        title: "Privacy Policy | Security Partners Ltd.",
        description:
          "How Security Partners Ltd collects, uses and protects personal information.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Privacy Policy",
          title: "Privacy Policy",
          description:
            "How Security Partners Ltd collects, uses and protects personal information.",
        },
        // Placeholder copy (docs/brief.md open question): owner to review.
        body: doc(
          paragraph(
            "This privacy policy is a placeholder awaiting review by Security Partners Ltd. It explains how we handle personal information you share with us through this website."
          ),
          heading2("Information we collect"),
          paragraph(
            "When you contact us we collect the details you provide, such as your name, email address, phone number and message, so that we can respond to your enquiry."
          ),
          heading2("How we use it"),
          paragraph(
            "We use your details only to answer your enquiry and to provide our services. We do not sell your information to anyone."
          ),
          heading2("Your rights"),
          paragraph(
            "You can ask us for a copy of the information we hold about you, or ask us to correct or delete it, by emailing info@securitypartnersltd.com."
          )
        ),
      },
    },
    terms: {
      seo: {
        title: "Terms of Use | Security Partners Ltd.",
        description: "The terms that apply when you use this website.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Terms",
          title: "Terms of Use",
          description: "The terms that apply when you use this website.",
        },
        // Placeholder copy (docs/brief.md open question): owner to review.
        body: doc(
          paragraph(
            "These terms are a placeholder awaiting review by Security Partners Ltd. By using this website you agree to them."
          ),
          heading2("Using this website"),
          paragraph(
            "The content of this website is for general information about our services. It may change without notice."
          ),
          heading2("Contact"),
          paragraph(
            "Questions about these terms can be sent to info@securitypartnersltd.com."
          )
        ),
      },
    },
  }
}
```


- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/templates tests/unit/lint-boundaries.test.ts`
Expected: PASS (39 inventory tests; lint-boundaries unchanged).

Mutation check (proves the equality test bites): temporarily rename `tagline` to `taglineX` in `templates/home/schema.ts` and re-run `pnpm test:unit tests/unit/templates` — expect `pages.home: schema leaf paths equal the inventory's fields` to fail with `expected [ 'hero.tagline' ] to deeply equal []`. Revert.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add templates server/db/seed/fixtures/pages.ts tests/unit/helpers/schema-paths.ts tests/unit/templates/inventory.test.ts
git commit -m "feat: add page template schemas matched against the field inventory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Collection fixtures + static media reader (master Task 3.3)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (`sharp@0.35.5`)
- Create: `server/db/seed/fixtures/{services,categories,authors,articles,team,clients,group-companies,index}.ts`
- Create: `server/db/seed/media.ts`
- Test: `tests/unit/seed/fixtures.test.ts`, `tests/unit/seed/static-media.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas and fixture helpers, Task 3 `pagesFixture`, `sharp` 0.35 (`metadata().mediaType`, `autoOrient`).
- Produces:

```ts
// server/db/seed/fixtures/*.ts (server-only)
export type ServiceFixture = { slug: string; content: ServiceContent; seo: Seo }
export function servicesFixture(media: MediaLookup): ServiceFixture[]            // display order = sortOrder
export const CATEGORIES: CategoryInput[]                                          // 7; first 5 showInFilter
export const AUTHORS: readonly { email; name; title }[]; export type AuthorEmail // "michael.mcdonald@authors.invalid"
export type ArticleFixture = { slug; categorySlug; authorEmail: AuthorEmail | null; publishedAt: Date; readTimeMinutes: number | null; content: ArticleContent; seo: Seo }
export function articlesFixture(media: MediaLookup): ArticleFixture[]            // newest first; [0] is the featured article
export function teamFixture(media): TeamMemberInput[]; clientsFixture(media): ClientInput[]; groupCompaniesFixture(media): GroupCompanyInput[]
export function contentFixtures(media: MediaLookup): { settings, pages, services, categories, authors, articles, team, clients, groupCompanies }
export type ContentFixtures
// server/db/seed/media.ts
export type StaticMediaRow = { key: MediaKey; driver: "static"; mime; size; width; height; blurDataUrl: string | null; alt }
export async function readStaticMedia(publicDir?: string): Promise<StaticMediaRow[]>  // default <cwd>/public
```

Values are copied verbatim from `components/home/data.ts`, `components/{about,services,team}/data.ts` and inline component arrays (they are deleted in Task 8). The mobile-patrols article body (10 `PostBlock`s) becomes TipTap JSON (ruling): `p` → paragraph, `h2` → heading 2, `list` → bulletList, `quote` → blockquote with `attrs.cite`, `image` → image with `attrs.media` + `alt`. Article dates are 09:00 UTC on the static site's date (10:00 Irish summer time). Media rows are `driver: "static"` with `key` = the URL path, so rendered `src` values stay identical.

- [ ] **Step 1: Install sharp**

```bash
pnpm add --save-exact sharp@0.35.5
```

Expected: `+ sharp 0.35.5` (already present as Next's optional dependency; this makes it importable from our code).

- [ ] **Step 2: Write the failing tests**

`tests/unit/seed/fixtures.test.ts`:

```ts
import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { seo } from "@/lib/schemas/common"
import { articleContent } from "@/lib/schemas/content/article"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { serviceSchema } from "@/lib/schemas/content/service"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"
import { contentFixtures } from "@/server/db/seed/fixtures"
import {
  fixtureMediaId,
  fixtureMediaKey,
  fixtureMediaLookup,
  MEDIA,
} from "@/server/db/seed/fixtures/media"

const fx = contentFixtures(fixtureMediaLookup)

/** Every { mediaId } in a value. */
function mediaIds(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) mediaIds(v, out)
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.mediaId === "string") out.add(record.mediaId)
    for (const v of Object.values(record)) mediaIds(v, out)
  }
  return out
}

describe("seed fixtures (master Task 3.3)", () => {
  it("parse against the content schemas and round-trip unchanged", () => {
    for (const s of fx.services) {
      const input = { slug: s.slug, ...s.content }
      expect(serviceSchema.parse(input)).toEqual(input)
      expect(seo.parse(s.seo)).toEqual(s.seo)
    }
    for (const a of fx.articles)
      expect(articleContent.parse(a.content)).toEqual(a.content)
    for (const c of fx.categories) expect(categorySchema.parse(c)).toEqual(c)
    for (const t of fx.team) expect(teamMemberSchema.parse(t)).toEqual(t)
    for (const c of fx.clients) expect(clientSchema.parse(c)).toEqual(c)
    for (const g of fx.groupCompanies)
      expect(groupCompanySchema.parse(g)).toEqual(g)
  })

  it("has the static site's records in display order", () => {
    expect(fx.services.map((s) => s.slug)).toEqual([
      "alarm-responses",
      "mobile-patrols-key-holding",
      "open-up-lock-ups",
      "static-security",
      "commercial-retail-security",
      "event-security",
    ])
    expect(fx.articles.map((a) => a.slug)).toEqual([
      "18-years-of-watching-over-ireland",
      "mobile-patrols-protect-your-business-after-hours",
      "planning-security-for-your-next-event",
      "inside-our-24-7-operations-team",
      "key-holding-explained",
      "loss-prevention-trained-retail-officers",
      "open-up-lock-up-keeps-staff-safe",
    ])
    const dates = fx.articles.map((a) => a.publishedAt.getTime())
    expect([...dates].sort((x, y) => y - x)).toEqual(dates)
    expect(
      fx.categories.filter((c) => c.showInFilter).map((c) => c.name)
    ).toEqual([
      "Company News",
      "Mobile Patrols",
      "Event Security",
      "Retail Security",
      "Alarm Response",
    ])
    expect(fx.team).toHaveLength(4)
    expect(fx.clients).toHaveLength(8)
    expect(fx.groupCompanies).toHaveLength(2)
  })

  it("references only known categories, authors and the featured article", () => {
    const categories = new Set(fx.categories.map((c) => c.slug))
    const authors = new Set(fx.authors.map((a) => a.email))
    for (const a of fx.articles) {
      expect(categories).toContain(a.categorySlug)
      if (a.authorEmail) expect(authors).toContain(a.authorEmail)
    }
    expect(fx.articles.map((a) => a.slug)).toContain(
      fx.pages.blog.data.featuredArticle
    )
  })

  it("uses every library image and only library images", () => {
    const used = mediaIds(fx)
    expect([...used].map(fixtureMediaKey).sort()).toEqual(
      MEDIA.map((m) => m.key).sort()
    )
  })

  it("library keys are files in public/", () => {
    for (const { key } of MEDIA)
      expect(existsSync(resolve("public", `.${key}`)), key).toBe(true)
    expect(fixtureMediaKey(fixtureMediaId("/images/hero.jpg"))).toBe(
      "/images/hero.jpg"
    )
  })
})
```


`tests/unit/seed/static-media.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { MEDIA } from "@/server/db/seed/fixtures/media"
import { readStaticMedia } from "@/server/db/seed/media"

describe("readStaticMedia (sharp)", () => {
  it("measures every library image", { timeout: 30_000 }, async () => {
    const rows = await readStaticMedia()
    expect(rows.map((r) => r.key)).toEqual(MEDIA.map((m) => m.key))
    for (const row of rows) {
      expect(row.driver).toBe("static")
      expect(row.size).toBeGreaterThan(0)
      expect(row.width).toBeGreaterThan(0)
      expect(row.height).toBeGreaterThan(0)
    }
    const byKey = new Map(rows.map((r) => [r.key, r]))
    expect(byKey.get("/images/hero.jpg")).toMatchObject({
      mime: "image/jpeg",
      width: 1440,
      height: 748,
    })
    expect(byKey.get("/images/logo.png")).toMatchObject({
      mime: "image/png",
      width: 140,
      height: 85,
      alt: "Security Partners Ltd.",
    })
    expect(byKey.get("/images/hero.jpg")?.blurDataUrl).toMatch(
      /^data:image\/webp;base64,/
    )
    expect(byKey.get("/images/icon-shield.svg")).toMatchObject({
      mime: "image/svg+xml",
      width: 24,
      height: 24,
      blurDataUrl: null,
    })
  })
})
```


- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/seed`
Expected: FAIL — `Failed to resolve import "@/server/db/seed/fixtures"` and `"@/server/db/seed/media"`.

- [ ] **Step 4: Collection fixtures**

`server/db/seed/fixtures/services.ts`:

```ts
import "server-only"

import type { Seo } from "@/lib/schemas/common"
import type { ServiceContent } from "@/lib/schemas/content/service"

import type { MediaLookup } from "./media"
import { paragraphs } from "./rich-text"

export type ServiceFixture = { slug: string; content: ServiceContent; seo: Seo }

type ServiceCopy = {
  slug: string
  title: string
  description: string
  icon: Parameters<MediaLookup>[0]
  detail: {
    intro: string
    heading: string
    overview: string
    included: string[]
    callout: string
  }
}

// Detail copy for Alarm Responses comes from the design; the other services
// reuse company facts from elsewhere on the site until final copy is supplied.
const SERVICES: ServiceCopy[] = [
  {
    slug: "alarm-responses",
    title: "Alarm Responses",
    description: "Rapid response to alarm activations, day or night.",
    icon: "/images/service-alarm.png",
    detail: {
      intro:
        "Our highly trained security team will be dispatched to your premises and deal with the situation, day or night.",
      heading: "Fast, professional alarm response",
      overview:
        "Security Partners Ltd specialise in alarm response and key holding services. Our highly trained security team will be dispatched to your premises and deal with the situation, giving you the peace of mind your premises is safe and secure in our hands.",
      included: [
        "Rapid dispatch of trained, uniformed officers to your premises",
        "Key holding, so your site can be accessed and secured without calling you out",
        "A dedicated 24/7 Operations Team on call for every activation",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Alarm activated? Call our 24 Hour Number",
    },
  },
  {
    slug: "mobile-patrols-key-holding",
    title: "Mobile Patrols & Key Holding",
    description: "Scheduled patrols and secure key holding for your premises.",
    icon: "/images/service-patrols.png",
    detail: {
      intro:
        "Scheduled patrols and secure key holding, so your premises are checked and accessible whenever you need.",
      heading: "Visible patrols, secure key holding",
      overview:
        "Our mobile patrol officers carry out scheduled checks of your premises, deterring intruders and spotting issues early. With our key holding service, your keys are held securely so your site can be accessed and secured without calling you out.",
      included: [
        "Scheduled patrols planned around your premises",
        "Secure key holding for fast access to your site",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need a patrol or key holder? Call our 24 Hour Number",
    },
  },
  {
    slug: "open-up-lock-ups",
    title: "Open Up & Lock Ups",
    description: "Reliable opening and locking of sites on your schedule.",
    icon: "/images/service-lockups.png",
    detail: {
      intro:
        "Reliable opening and locking of your sites, on your schedule, so you never have to make the trip yourself.",
      heading: "Your site, opened and secured on time",
      overview:
        "Our officers open up and lock up your premises at the times you set, checking that the site is secure before they leave. It is a simple way to make sure your business starts and ends each day safely.",
      included: [
        "Opening and locking of sites at times that suit you",
        "Security checks of the premises at every visit",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need a site opened or locked? Call our 24 Hour Number",
    },
  },
  {
    slug: "static-security",
    title: "Static Security",
    description: "Trained officers on site to protect people and property.",
    icon: "/images/service-static.png",
    detail: {
      intro:
        "Trained, uniformed officers on site to protect your people, property and assets.",
      heading: "Trained officers, on site",
      overview:
        "Our static security officers provide a visible, professional presence at your premises. Every officer receives exceptional training so you get a first class service, backed by our dedicated 24/7 Operations Team.",
      included: [
        "Trained, uniformed officers on your premises",
        "Access control and monitoring of people and property",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need officers on site? Call our 24 Hour Number",
    },
  },
  {
    slug: "commercial-retail-security",
    title: "Commercial & Retail Security",
    description: "Tailored security for offices, shops and retail centres.",
    icon: "/images/service-commercial.png",
    detail: {
      intro:
        "Tailored security for offices, shops and retail centres, planned around how your business runs.",
      heading: "Security tailored to your business",
      overview:
        "We work with commercial and retail clients to put the right security in place, from officers on the shop floor to patrols and alarm response. Every service is planned around your premises and your schedule.",
      included: [
        "Security planned around your premises and opening hours",
        "Trained officers for offices, shops and retail centres",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need commercial security? Call our 24 Hour Number",
    },
  },
  {
    slug: "event-security",
    title: "Event Security",
    description:
      "Professional crowd and access control for events of any size.",
    icon: "/images/service-event.png",
    detail: {
      intro:
        "Professional crowd and access control for events of any size, so your guests can enjoy the day safely.",
      heading: "Safe, well-run events",
      overview:
        "Our event security officers manage access, crowds and incidents so your event runs smoothly. We plan every event with you, from small private functions to large public gatherings.",
      included: [
        "Access control and crowd management",
        "Trained, uniformed officers for events of any size",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Planning an event? Call our 24 Hour Number",
    },
  },
]

/** The six services in display order (sortOrder = index). */
export function servicesFixture(media: MediaLookup): ServiceFixture[] {
  return SERVICES.map(({ slug, title, description, icon, detail }) => ({
    slug,
    seo: {},
    content: {
      title,
      description,
      icon: media(icon),
      heroImage: media("/images/hero.jpg"),
      image: media("/images/about.png"),
      imageAlt: "Security Partners officer at work",
      detail: { ...detail, overview: paragraphs(detail.overview) },
    },
  }))
}
```


`server/db/seed/fixtures/categories.ts`:

```ts
import "server-only"

import type { CategoryInput } from "@/lib/schemas/content/category"

/**
 * Display order = sortOrder. The first five are the blog filter bar; the
 * last two only label articles (ruling: showInFilter).
 */
export const CATEGORIES: CategoryInput[] = [
  { slug: "company-news", name: "Company News", showInFilter: true },
  { slug: "mobile-patrols", name: "Mobile Patrols", showInFilter: true },
  { slug: "event-security", name: "Event Security", showInFilter: true },
  { slug: "retail-security", name: "Retail Security", showInFilter: true },
  { slug: "alarm-response", name: "Alarm Response", showInFilter: true },
  { slug: "key-holding", name: "Key Holding", showInFilter: false },
  { slug: "open-up-lock-up", name: "Open Up & Lock Up", showInFilter: false },
]
```


`server/db/seed/fixtures/authors.ts`:

```ts
import "server-only"

/**
 * Byline-only users (spec §5.3): created banned and without a password so
 * they can never sign in. `.invalid` addresses cannot collide with a real
 * account (e.g. an owner invited as info@securitypartnersltd.com).
 */
export const AUTHORS = [
  {
    email: "michael.mcdonald@authors.invalid",
    name: "Michael McDonald",
    title: "Managing Director",
  },
] as const

export type AuthorEmail = (typeof AUTHORS)[number]["email"]
```


`server/db/seed/fixtures/articles.ts`:

```ts
import "server-only"

import type { Seo } from "@/lib/schemas/common"
import type { ArticleContent } from "@/lib/schemas/content/article"

import type { AuthorEmail } from "./authors"
import type { MediaLookup } from "./media"
import { bulletList, doc, heading2, image, paragraph, quote } from "./rich-text"

export type ArticleFixture = {
  slug: string
  categorySlug: string
  authorEmail: AuthorEmail | null
  /** Display date in Europe/Dublin is the date part. */
  publishedAt: Date
  readTimeMinutes: number | null
  content: ArticleContent
  seo: Seo
}

const MICHAEL: AuthorEmail = "michael.mcdonald@authors.invalid"

/** 09:00 UTC (10:00 Irish summer time) on the given day. */
const on = (day: string) => new Date(`${day}T09:00:00Z`)

/** Newest first. The first one is the blog's featured article (pages.blog.featuredArticle). */
export function articlesFixture(media: MediaLookup): ArticleFixture[] {
  return [
    {
      slug: "18-years-of-watching-over-ireland",
      categorySlug: "company-news",
      authorEmail: MICHAEL,
      publishedAt: on("2026-09-20"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "18 Years of Watching Over Ireland",
        excerpt:
          "Since 2008, Security Partners has grown from a family business in Mountmellick into a security team trusted by hotels, retailers and businesses across Ireland. Here's how we got here.",
        cover: media("/images/hero.jpg"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "mobile-patrols-protect-your-business-after-hours",
      categorySlug: "mobile-patrols",
      authorEmail: MICHAEL,
      publishedAt: on("2026-09-12"),
      readTimeMinutes: 5,
      seo: {},
      content: {
        title: "How Mobile Patrols Protect Your Business After Hours",
        excerpt:
          "What a scheduled patrol actually covers, and why visible security deters break-ins.",
        cover: media("/images/hero.jpg"),
        lead: "What a scheduled patrol actually covers, and why a visible security presence deters break-ins.",
        tags: ["Mobile Patrols", "Key Holding", "Business Security"],
        body: doc(
          paragraph(
            "When your business closes for the night, it becomes an easy target. A mobile patrol puts clearly identifiable security officers on your premises at set times, so problems are found early and unwanted activity is deterred."
          ),
          heading2("What a scheduled patrol covers"),
          paragraph(
            "Every patrol is planned around your site and your schedule. Our officers check the areas that matter most to you and report back to our Operations Team as they go."
          ),
          bulletList(
            "Perimeter, doors and windows checked for signs of entry",
            "Lights, alarms and equipment left in a safe state",
            "Tag point checks logged at every stop, in real time",
            "Any issue reported straight to our 24/7 Operations Team"
          ),
          quote(
            "A visible security presence is one of the simplest ways to deter break-ins, vandalism and anti-social behaviour.",
            "Security Partners Operations Team"
          ),
          heading2("Pairing patrols with key holding"),
          paragraph(
            "With key holding, our team holds secure keys to your premises. If your alarm is activated, an officer can be dispatched to deal with the situation, so you are not called out in the middle of the night."
          ),
          image(
            media("/images/about.png"),
            "Security Partners officer completing a patrol report"
          ),
          heading2("Is a mobile patrol right for you?"),
          paragraph(
            "Mobile patrols suit offices, retail units, building sites and any premises left empty after hours. Get in touch and our team will recommend a patrol plan that fits your site."
          )
        ),
      },
    },
    {
      slug: "planning-security-for-your-next-event",
      categorySlug: "event-security",
      authorEmail: null,
      publishedAt: on("2026-08-28"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Planning Security for Your Next Event",
        excerpt:
          "From access control to crowd management: a checklist for organisers of events of any size.",
        cover: media("/images/banner.png"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "inside-our-24-7-operations-team",
      categorySlug: "company-news",
      authorEmail: null,
      publishedAt: on("2026-08-05"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Inside Our 24/7 Operations Team",
        excerpt:
          "How real-time reporting, clocking and tag point systems keep our clients informed around the clock.",
        cover: media("/images/about.png"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "key-holding-explained",
      categorySlug: "key-holding",
      authorEmail: null,
      publishedAt: on("2026-07-02"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Key Holding Explained: Who Responds When Your Alarm Goes Off",
        excerpt:
          "What happens after an alarm activation, and why a key holder saves you a call-out.",
        cover: media("/images/about.png"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "loss-prevention-trained-retail-officers",
      categorySlug: "retail-security",
      authorEmail: null,
      publishedAt: on("2026-06-18"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Loss Prevention: What Trained Retail Officers Do Differently",
        excerpt:
          "How our retail team keeps shops safe for the public while cutting losses.",
        cover: media("/images/hero.jpg"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "open-up-lock-up-keeps-staff-safe",
      categorySlug: "open-up-lock-up",
      authorEmail: null,
      publishedAt: on("2026-06-04"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Why Open Up & Lock Up Services Keep Your Staff Safe",
        excerpt:
          "A simple, secure way to make sure staff get in and out of work safely.",
        cover: media("/images/banner.png"),
        lead: null,
        tags: [],
        body: null,
      },
    },
  ]
}
```


`server/db/seed/fixtures/team.ts`:

```ts
import "server-only"

import type { TeamMemberInput } from "@/lib/schemas/content/team-member"

import type { MediaLookup } from "./media"

/** Display order = sortOrder. Photos are the design's temporary image. */
export function teamFixture(media: MediaLookup): TeamMemberInput[] {
  const photo = media("/images/about.png")
  return [
    {
      name: "Michael McDonald",
      role: "Managing Director",
      bio: "Michael has over 20 years experience in the security industry. Having worked on the ground, he started his own security business in 2008 and takes pride in the reputation he has grown.",
      email: "info@securitypartnersltd.com",
      photo,
    },
    {
      name: "John McDonald",
      role: "Operations Director",
      bio: "John has many years of security experience. He operationally runs the business and is dedicated to deploying officers on the ground and inducting on-site training.",
      email: "operations@securitypartnersltd.com",
      photo,
    },
    {
      name: "Sarah Moran",
      role: "HR/Operations Manager",
      bio: "Sarah is CIPD qualified and is HR Manager. She also oversees the business day to day and is the point of contact for all operational queries.",
      email: "HR@securitypartnersltd.com",
      photo,
    },
    {
      name: "Louise Sheeran",
      role: "Accounts Manager",
      bio: "Louise is IPASS qualified and looks after all accounts and invoicing. She is the point of contact for all invoicing queries.",
      email: "accounts@securitypartnersltd.com",
      photo,
    },
  ]
}
```


`server/db/seed/fixtures/clients.ts`:

```ts
import "server-only"

import type { ClientInput } from "@/lib/schemas/content/client"

import type { MediaLookup } from "./media"

/** Display order = sortOrder; the logo alt is the client name. */
export function clientsFixture(media: MediaLookup): ClientInput[] {
  return [
    { name: "Dinn Rí", logo: media("/images/client-dinn-ri.png"), url: null },
    {
      name: "Langton House Hotel",
      logo: media("/images/client-langton.png"),
      url: null,
    },
    { name: "Hayes Hotel", logo: media("/images/client-hayes.png"), url: null },
    {
      name: "Martin Reddin",
      logo: media("/images/client-martin-reddin.png"),
      url: null,
    },
    {
      name: "Killeen Civil Engineering",
      logo: media("/images/client-killeen.png"),
      url: null,
    },
    {
      name: "Greenfield",
      logo: media("/images/client-greenfield.png"),
      url: null,
    },
    { name: "Telfords", logo: media("/images/client-telfords.png"), url: null },
    {
      name: "Laois Hire",
      logo: media("/images/client-laois-hire.png"),
      url: null,
    },
  ]
}
```


`server/db/seed/fixtures/group-companies.ts`:

```ts
import "server-only"

import type { GroupCompanyInput } from "@/lib/schemas/content/group-company"

import type { MediaLookup } from "./media"

/** Footer "Other services in the group"; display order = sortOrder. */
export function groupCompaniesFixture(media: MediaLookup): GroupCompanyInput[] {
  return [
    {
      name: "MJS Eco",
      phone: "(087) 924 8880",
      site: "www.mjseco.ie",
      logo: media("/images/group-mjs-eco.png"),
    },
    {
      name: "Cleaning Partners",
      phone: "085 806 2369",
      site: "www.cleaningpartners.ie",
      logo: media("/images/group-cleaning-partners.png"),
    },
  ]
}
```


`server/db/seed/fixtures/index.ts`:

```ts
import "server-only"

import { articlesFixture } from "./articles"
import { AUTHORS } from "./authors"
import { CATEGORIES } from "./categories"
import { clientsFixture } from "./clients"
import { groupCompaniesFixture } from "./group-companies"
import type { MediaLookup } from "./media"
import { pagesFixture } from "./pages"
import { servicesFixture } from "./services"
import { settingsFixture } from "./settings"
import { teamFixture } from "./team"

/** Every seed fixture, with media references resolved through `media`. */
export function contentFixtures(media: MediaLookup) {
  return {
    settings: settingsFixture(media),
    pages: pagesFixture(media),
    services: servicesFixture(media),
    categories: CATEGORIES,
    authors: AUTHORS,
    articles: articlesFixture(media),
    team: teamFixture(media),
    clients: clientsFixture(media),
    groupCompanies: groupCompaniesFixture(media),
  }
}

export type ContentFixtures = ReturnType<typeof contentFixtures>
```


- [ ] **Step 5: Static media reader**

`server/db/seed/media.ts`:

```ts
import "server-only"

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import sharp from "sharp"

import { MEDIA, type MediaKey } from "./fixtures/media"

export type StaticMediaRow = {
  key: MediaKey
  driver: "static"
  mime: string
  size: number
  width: number | null
  height: number | null
  blurDataUrl: string | null
  alt: string
}

/**
 * Reads every library image from public/ (key "/images/x.png" →
 * public/images/x.png) and measures it with sharp. Raster images get a
 * 16px WebP blur placeholder; SVGs do not.
 */
export async function readStaticMedia(
  publicDir = resolve(process.cwd(), "public")
): Promise<StaticMediaRow[]> {
  return Promise.all(
    MEDIA.map(async ({ key, alt }) => {
      const file = await readFile(resolve(publicDir, `.${key}`))
      const meta = await sharp(file).metadata()
      const raster = meta.format !== "svg"
      const blur = raster
        ? await sharp(file)
            .resize(16, 16, { fit: "inside" })
            .webp({ quality: 40 })
            .toBuffer()
        : null
      return {
        key,
        driver: "static" as const,
        mime: meta.mediaType ?? `image/${meta.format}`,
        size: file.byteLength,
        width: meta.autoOrient?.width ?? meta.width ?? null,
        height: meta.autoOrient?.height ?? meta.height ?? null,
        blurDataUrl: blur
          ? `data:image/webp;base64,${blur.toString("base64")}`
          : null,
        alt,
      }
    })
  )
}
```


- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/seed tests/unit/server-only-guard.test.ts`
Expected: PASS (6 seed tests; `hero.jpg` measures 1440×748, `logo.png` 140×85, SVGs have no blur).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml server/db/seed/fixtures server/db/seed/media.ts tests/unit/seed
git commit -m "feat: add collection seed fixtures and static media reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Seed runner + `db:seed` (master Task 3.4, part 1)

**Files:**
- Create: `server/db/seed/index.ts`, `scripts/seed.ts`
- Modify: `package.json` (script `db:seed`), `scripts/build-scripts.ts` (`SCRIPT_ENTRIES` + `seed`, `sharp` external)
- Test: `tests/integration/seed/seed.test.ts`; modify `tests/unit/scripts-bundle.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 (`contentFixtures`, `MEDIA`, `readStaticMedia`, schemas, `PAGE_KEYS`, `PAGES`, `templateSchemaFor`, `SETTINGS_KEYS`, `settingsSchemas`, tables); Phase 2 `assertDisposable` (`server/db/seed/guard.ts`), `runScript` (`scripts/lib/run-script.ts`), `users` table; Phase 1 `getDb`, `getEnv`.
- Produces:

```ts
// server/db/seed/index.ts
export const SEED_TABLES: readonly ["media","users","articleCategories","settings","pages","services","articles","teamMembers","clients","groupCompanies"]
export type SeedReport = Record<(typeof SEED_TABLES)[number], number>   // rows inserted by this run
export async function seedContent(db: Db, options?: { publicDir?: string }): Promise<SeedReport>
```

- Command: `pnpm db:seed [--allow-production]` (dev, `.env.development`); container: `node scripts/dist/seed.mjs --allow-production` (first production deploy, after `admin:create`; runbook in Phase 10). Refuses non-disposable databases (Phase 2 guard).
- Behaviour: one transaction; inserts only missing rows by natural key (media `driver+key`, users `email`, categories/services/articles `slug`, pages/settings `key`, team/clients/group companies `name`) and never overwrites — admin edits survive a re-run. Versioned rows start published (`draft = published`, `version 1`, `status "published"`, `publishedAt` = seed time; articles use their fixture date). Every payload is parsed with its Zod schema before insert. Byline authors are banned, password-less users (spec §5.3).

- [ ] **Step 1: Write the failing tests**

`tests/integration/seed/seed.test.ts`:

```ts
import { spawnSync } from "node:child_process"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { SETTINGS_KEYS } from "@/lib/schemas/settings"
import { getDb } from "@/server/db/client"
import {
  accounts,
  articles,
  media,
  pages,
  services,
  settings,
  users,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { contentFixtures } from "@/server/db/seed/fixtures"
import type { MediaLookup } from "@/server/db/seed/fixtures/media"

import { resetDb } from "../db"

const TABLES = [
  "media",
  "users",
  "article_categories",
  "settings",
  "pages",
  "services",
  "articles",
  "team_members",
  "clients",
  "group_companies",
] as const

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const table of TABLES) {
    const { rows } = await getDb().execute<{ n: number }>(
      sql.raw(`select count(*)::int as n from "${table}"`)
    )
    out[table] = rows[0].n
  }
  return out
}

/** Fixtures built with the ids the seed actually inserted. */
async function dbFixtures() {
  const rows = await getDb()
    .select({ id: media.id, key: media.key })
    .from(media)
  const byKey = new Map(rows.map((r) => [r.key, r.id]))
  const lookup: MediaLookup = (key) => ({ mediaId: byKey.get(key)! })
  return contentFixtures(lookup)
}

beforeEach(resetDb)

describe("seedContent (master Task 3.4)", () => {
  it("is idempotent: a second run inserts nothing and counts stay equal", async () => {
    const first = await seedContent(getDb())
    expect(first).toEqual({
      media: 32,
      users: 1,
      articleCategories: 7,
      settings: 15,
      pages: 8,
      services: 6,
      articles: 7,
      teamMembers: 4,
      clients: 8,
      groupCompanies: 2,
    })
    const before = await counts()
    const second = await seedContent(getDb())
    expect(Object.values(second).every((n) => n === 0)).toBe(true)
    expect(await counts()).toEqual(before)
  })

  it("restores only a missing row and never overwrites edits", async () => {
    await seedContent(getDb())
    const db = getDb()
    await db
      .update(services)
      .set({ sortOrder: 99 })
      .where(eq(services.slug, "event-security"))
    await db.delete(services).where(eq(services.slug, "static-security"))
    const report = await seedContent(db)
    expect(report.services).toBe(1)
    const [edited] = await db
      .select({ sortOrder: services.sortOrder })
      .from(services)
      .where(eq(services.slug, "event-security"))
    expect(edited.sortOrder).toBe(99)
  })

  it("seeds versioned rows published: draft = published, version 1", async () => {
    await seedContent(getDb())
    const db = getDb()
    for (const table of [pages, services, articles]) {
      const rows = await db.select().from(table)
      for (const row of rows) {
        expect(row.status).toBe("published")
        expect(row.version).toBe(1)
        expect(row.publishedAt).toBeInstanceOf(Date)
        expect(row.published).toEqual(row.draft)
      }
    }
    const settingsRows = await db.select().from(settings)
    expect(settingsRows.map((r) => r.key).sort()).toEqual(
      [...SETTINGS_KEYS].sort()
    )
    for (const row of settingsRows) expect(row.published).toEqual(row.draft)
  })

  it("stores every fixture string unchanged (Review Focus 1)", async () => {
    await seedContent(getDb())
    const fx = await dbFixtures()
    const db = getDb()
    for (const row of await db.select().from(settings))
      expect(row.published).toEqual(
        fx.settings[row.key as keyof typeof fx.settings]
      )
    for (const row of await db.select().from(pages)) {
      const page = fx.pages[row.key as keyof typeof fx.pages]
      expect(row.published).toEqual(page.data)
      expect(row.seo).toEqual(page.seo)
    }
    for (const s of fx.services) {
      const [row] = await db
        .select()
        .from(services)
        .where(eq(services.slug, s.slug))
      expect(row.published).toEqual(s.content)
    }
    for (const a of fx.articles) {
      const [row] = await db
        .select()
        .from(articles)
        .where(eq(articles.slug, a.slug))
      expect(row.published).toEqual(a.content)
      expect(row.publishedAt).toEqual(a.publishedAt)
      expect(row.readTimeMinutes).toBe(a.readTimeMinutes)
    }
    const [contact] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "contact"))
    expect((contact.published as { hours: string }).hours).toBe(
      "Monday–Friday, 9am to 6pm"
    )
    const [home] = await db.select().from(pages).where(eq(pages.key, "home"))
    expect((home.published as { hero: { eyebrow: string } }).hero.eyebrow).toBe(
      "Mountmellick, Co. Laois  •  Since 2008"
    )
  })

  it("registers library images as static media with dimensions", async () => {
    await seedContent(getDb())
    const rows = await getDb().select().from(media)
    expect(rows).toHaveLength(32)
    for (const row of rows) {
      expect(row.driver).toBe("static")
      expect(row.key).toMatch(/^\/images\//)
      expect(row.width).toBeGreaterThan(0)
      expect(row.height).toBeGreaterThan(0)
    }
  })

  it("creates byline authors that cannot sign in", async () => {
    await seedContent(getDb())
    const db = getDb()
    const [author] = await db
      .select()
      .from(users)
      .where(eq(users.email, "michael.mcdonald@authors.invalid"))
    expect(author).toMatchObject({
      name: "Michael McDonald",
      title: "Managing Director",
      banned: true,
    })
    expect(
      await db.select().from(accounts).where(eq(accounts.userId, author.id))
    ).toEqual([])
    const linked = await db
      .select({ slug: articles.slug })
      .from(articles)
      .where(eq(articles.authorId, author.id))
    expect(linked.map((r) => r.slug).sort()).toEqual([
      "18-years-of-watching-over-ireland",
      "mobile-patrols-protect-your-business-after-hours",
    ])
  })
})

describe("pnpm db:seed guard", () => {
  it("refuses a non-disposable database without --allow-production", () => {
    const run = spawnSync("pnpm", ["db:seed"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgres://sp:sp@db.example.com:5432/security",
      },
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain("--allow-production")
  }, 30_000)
})
```


In `tests/unit/scripts-bundle.test.ts`, insert this test directly before `it("migrate.mjs runs standalone and exits 1 listing every missing env var", …)`:

```ts
  it("seed.mjs imports sharp at runtime (native, from the standalone node_modules)", () => {
    const code = readFileSync(join(outdir, "seed.mjs"), "utf8")
    expect(code).toMatch(/from "sharp"/)
    expect(code).not.toContain("libvips")
  })

```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration tests/integration/seed/seed.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/db/seed"`.

Run: `pnpm test:unit tests/unit/scripts-bundle.test.ts`
Expected: FAIL — `ENOENT … seed.mjs` (not an entry yet).

- [ ] **Step 3: Seed runner and script**

`server/db/seed/index.ts`:

```ts
import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import { articleContent } from "@/lib/schemas/content/article"
import { serviceContent } from "@/lib/schemas/content/service"
import { SETTINGS_KEYS, settingsSchemas } from "@/lib/schemas/settings"
import type { Db } from "@/server/db/client"
import {
  articleCategories,
  articles,
  clients,
  groupCompanies,
  media,
  pages,
  services,
  settings,
  teamMembers,
  users,
} from "@/server/db/schema"
import { PAGE_KEYS, PAGES, templateSchemaFor } from "@/templates/registry"

import { contentFixtures } from "./fixtures"
import { MEDIA, type MediaLookup } from "./fixtures/media"
import { readStaticMedia } from "./media"

export const SEED_TABLES = [
  "media",
  "users",
  "articleCategories",
  "settings",
  "pages",
  "services",
  "articles",
  "teamMembers",
  "clients",
  "groupCompanies",
] as const
export type SeedReport = Record<(typeof SEED_TABLES)[number], number>

/**
 * Idempotent content seed (spec §14 db:seed): inserts every fixture row
 * that is missing, keyed by its natural key, and never overwrites existing
 * rows (admin edits survive a re-run). Versioned rows start published:
 * draft = published, version 1. Returns rows inserted per table.
 */
export async function seedContent(
  db: Db,
  options: { publicDir?: string } = {}
): Promise<SeedReport> {
  const staticMedia = await readStaticMedia(options.publicDir)
  const now = new Date()

  return db.transaction(async (tx) => {
    const insertedMedia = await tx
      .insert(media)
      .values(staticMedia)
      .onConflictDoNothing({ target: [media.driver, media.key] })
      .returning({ id: media.id })
    const mediaRows = await tx
      .select({ id: media.id, key: media.key })
      .from(media)
      .where(
        and(
          eq(media.driver, "static"),
          inArray(
            media.key,
            MEDIA.map((m) => m.key)
          )
        )
      )
    const mediaIdByKey = new Map(mediaRows.map((r) => [r.key, r.id]))
    const lookup: MediaLookup = (key) => {
      const id = mediaIdByKey.get(key)
      if (!id) throw new Error(`Seed: media ${key} is missing`)
      return { mediaId: id }
    }
    const fx = contentFixtures(lookup)

    const insertedUsers = await tx
      .insert(users)
      .values(
        fx.authors.map((a) => ({
          email: a.email,
          name: a.name,
          title: a.title,
          role: "author",
          banned: true,
          banReason: "Byline only: cannot sign in",
        }))
      )
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id })
    const authorRows = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        inArray(
          users.email,
          fx.authors.map((a) => a.email)
        )
      )
    const authorIdByEmail = new Map(authorRows.map((r) => [r.email, r.id]))

    const insertedCategories = await tx
      .insert(articleCategories)
      .values(fx.categories.map((c, sortOrder) => ({ ...c, sortOrder })))
      .onConflictDoNothing({ target: articleCategories.slug })
      .returning({ id: articleCategories.id })
    const categoryRows = await tx
      .select({ id: articleCategories.id, slug: articleCategories.slug })
      .from(articleCategories)
    const categoryIdBySlug = new Map(categoryRows.map((r) => [r.slug, r.id]))

    const insertedSettings = await tx
      .insert(settings)
      .values(
        SETTINGS_KEYS.map((key) => {
          const value = settingsSchemas[key].parse(fx.settings[key])
          return { key, draft: value, published: value }
        })
      )
      .onConflictDoNothing({ target: settings.key })
      .returning({ key: settings.key })

    const insertedPages = await tx
      .insert(pages)
      .values(
        PAGE_KEYS.map((key) => {
          const data = templateSchemaFor(key).parse(fx.pages[key].data)
          return {
            key,
            template: PAGES[key],
            seo: fx.pages[key].seo,
            draft: data,
            published: data,
            status: "published" as const,
            publishedAt: now,
          }
        })
      )
      .onConflictDoNothing({ target: pages.key })
      .returning({ id: pages.id })

    const insertedServices = await tx
      .insert(services)
      .values(
        fx.services.map((s, sortOrder) => {
          const content = serviceContent.parse(s.content)
          return {
            slug: s.slug,
            sortOrder,
            seo: s.seo,
            draft: content,
            published: content,
            status: "published" as const,
            publishedAt: now,
          }
        })
      )
      .onConflictDoNothing({ target: services.slug })
      .returning({ id: services.id })

    const insertedArticles = await tx
      .insert(articles)
      .values(
        fx.articles.map((a) => {
          const categoryId = categoryIdBySlug.get(a.categorySlug)
          if (!categoryId)
            throw new Error(`Seed: category ${a.categorySlug} is missing`)
          const content = articleContent.parse(a.content)
          return {
            slug: a.slug,
            categoryId,
            authorId: a.authorEmail
              ? (authorIdByEmail.get(a.authorEmail) ?? null)
              : null,
            readTimeMinutes: a.readTimeMinutes,
            seo: a.seo,
            draft: content,
            published: content,
            status: "published" as const,
            publishedAt: a.publishedAt,
          }
        })
      )
      .onConflictDoNothing({ target: articles.slug })
      .returning({ id: articles.id })

    const insertedTeam = await tx
      .insert(teamMembers)
      .values(
        fx.team.map((t, sortOrder) => ({
          name: t.name,
          role: t.role,
          bio: t.bio,
          email: t.email,
          photoId: t.photo?.mediaId ?? null,
          sortOrder,
        }))
      )
      .onConflictDoNothing({ target: teamMembers.name })
      .returning({ id: teamMembers.id })

    const insertedClients = await tx
      .insert(clients)
      .values(
        fx.clients.map((c, sortOrder) => ({
          name: c.name,
          logoId: c.logo.mediaId,
          url: c.url,
          sortOrder,
        }))
      )
      .onConflictDoNothing({ target: clients.name })
      .returning({ id: clients.id })

    const insertedGroup = await tx
      .insert(groupCompanies)
      .values(
        fx.groupCompanies.map((g, sortOrder) => ({
          name: g.name,
          phone: g.phone,
          site: g.site,
          logoId: g.logo.mediaId,
          sortOrder,
        }))
      )
      .onConflictDoNothing({ target: groupCompanies.name })
      .returning({ id: groupCompanies.id })

    return {
      media: insertedMedia.length,
      users: insertedUsers.length,
      articleCategories: insertedCategories.length,
      settings: insertedSettings.length,
      pages: insertedPages.length,
      services: insertedServices.length,
      articles: insertedArticles.length,
      teamMembers: insertedTeam.length,
      clients: insertedClients.length,
      groupCompanies: insertedGroup.length,
    }
  })
}
```


`scripts/seed.ts`:

```ts
// Seeds the public site content (pages, settings, services, articles,
// team, clients, group companies, media library) from the fixtures.
// Idempotent: only missing rows are inserted. Refuses non-disposable
// databases unless --allow-production (first production deploy).
//   dev:       pnpm db:seed
//   container: node scripts/dist/seed.mjs --allow-production
import { parseArgs } from "node:util"

import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import { assertDisposable } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"

import { runScript } from "./lib/run-script"

await runScript("db:seed", async () => {
  const { values } = parseArgs({
    options: { "allow-production": { type: "boolean", default: false } },
  })
  assertDisposable(getEnv().DATABASE_URL, values["allow-production"] ?? false)
  const report = await seedContent(getDb())
  const inserted = Object.entries(report)
    .map(([table, n]) => `${table} +${n}`)
    .join(", ")
  console.log(`[db:seed] content seeded (${inserted})`)
})
```


```bash
pnpm pkg set scripts.db:seed="pnpm tsx:server scripts/seed.ts"
```

In `scripts/build-scripts.ts`:
1. add `"seed",` as the last element of `SCRIPT_ENTRIES` (after `"demo-seed",`), so it reads `["migrate", "admin-create", "owner-recover", "demo-seed", "seed"]`;
2. replace

```ts
    // pg lazily requires the optional native binding; it is never installed.
    external: ["pg-native"],
```

with

```ts
    // pg lazily requires the optional native binding (never installed); sharp
    // is native and ships in the standalone node_modules (Next traces it).
    external: ["pg-native", "sharp"],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/seed/seed.test.ts`
Expected: PASS (7 tests; first run inserts `media 32, users 1, articleCategories 7, settings 15, pages 8, services 6, articles 7, teamMembers 4, clients 8, groupCompanies 2`).

Run: `pnpm test:unit tests/unit/scripts-bundle.test.ts`
Expected: PASS.

Run (dev database): `pnpm db:seed && pnpm db:seed`
Expected: first `[db:seed] content seeded (media +32, users +1, articleCategories +7, settings +15, pages +8, services +6, articles +7, teamMembers +4, clients +8, groupCompanies +2)`, second the same line with `+0` everywhere.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/db/seed/index.ts scripts/seed.ts scripts/build-scripts.ts package.json tests/integration/seed tests/unit/scripts-bundle.test.ts
git commit -m "feat: add idempotent content seed and db:seed script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Repos, cached queries, cache tags, Cache Components, repo-only lint boundary (master Task 3.4, part 2)

**Files:**
- Create: `lib/media.ts`, `server/lib/settings-store.ts`, `server/lib/cache-tags.ts`
- Create: `server/modules/{pages,services,articles,collections,settings,media}/{repo,queries}.ts`
- Modify: `next.config.ts` (`cacheComponents: true`), `eslint.config.mjs` (drizzle-orm + routes→repo boundaries)
- Modify (temporary, replaced in Task 8): `app/(site)/blog/page.tsx`, `app/(site)/services/[slug]/page.tsx`, `app/(site)/blog/[slug]/page.tsx`
- Test: `tests/unit/cache-tags.test.ts`, `tests/unit/media-refs.test.ts`, `tests/integration/queries/public-queries.test.ts`; modify `tests/unit/lint-boundaries.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5; `next/cache` (`cacheLife`, `cacheTag`, `revalidateTag`), `next/headers` (`draftMode`), Phase 1 `getDb`, `AppError`.
- Produces (master Shared contracts + Task 3.4 interfaces):

```ts
// lib/media.ts (isomorphic)
export type MediaView = { id: string; url: string; alt: string; width: number | null; height: number | null; blurDataUrl: string | null }
export type WithMedia<T>                       // T with every { mediaId } replaced by MediaView (Dates kept)
export function collectMediaIds(value: unknown, out?: Set<string>): Set<string>
export function replaceMediaRefs<T>(value: T, resolve: (id: string) => MediaView): WithMedia<T>
// server/lib/settings-store.ts
export { isSettingsKey, SETTINGS_KEYS, type SettingsKey, type SettingsValue } from "@/lib/schemas/settings"
export const INTEGRATION_KEYS; export type IntegrationKey = "integrations.smtp" | "integrations.r2" | "integrations.turnstile" | "integrations.ai"
// server/lib/cache-tags.ts
export const tag = { page(key), services, service(slug), articles, article(slug), categories, team, clients, groupCompanies, settings(key: SettingsKey), redirects, media(id) }
export function invalidate(...tags: string[]): void          // revalidateTag(t, { expire: 0 }) — Route Handlers / Server Actions only
// queries: 'use cache' + cacheLife("max") + cacheTag; published data, draft data in draft mode
export async function getPage<K extends PageKey>(key: K): Promise<{ key: K; data: PageData<K>; seo: Seo } | null>   // tag page:<key>
export async function listServices(): Promise<ServiceRecord[]>              // tag services
export async function getService(slug: string): Promise<ServiceRecord | null> // tags services, service:<slug>
export async function listArticles(options?: { category?: string; limit?: number }): Promise<ArticleRecord[]> // tags articles, categories; category = slug
export async function getArticle(slug: string): Promise<ArticleRecord | null> // tags articles, article:<slug>, categories
export async function listCategories(): Promise<CategoryRecord[]>; listTeam(): Promise<TeamMemberRecord[]>
export async function listClients(): Promise<ClientRecord[]>; listGroupCompanies(): Promise<GroupCompanyRecord[]>
export async function getSettings<K extends SettingsKey>(key: K): Promise<SettingsValue<K> | null>  // tag settings:<key>
export async function getMedia(id: string): Promise<MediaView | null>     // tag media:<id>
export async function resolveMedia<T>(value: T): Promise<WithMedia<T>>     // throws INTERNAL for a missing media row
export function mediaUrl(row: { driver; key }): string                     // static → key; disk → /api/v1/media/file/<key>; r2 → Phase 6
export type ServiceRecord = { id; slug; sortOrder; seo; content: ServiceContent }
export type ArticleRecord = { id; slug; publishedAt: Date | null; readTimeMinutes; seo; category: { slug; name }; author: { name; title } | null; content: ArticleContent }
export type CategoryRecord = { id; slug; name; showInFilter }; TeamMemberRecord = { id; name; role; bio; email; photo: MediaRef | null }
export type ClientRecord = { id; name; logo: MediaRef; url }; GroupCompanyRecord = { id; name; phone; site; logo: MediaRef }
```

Rules (notes §2): every query is `async`, takes only serialisable arguments, calls `getDb()` inside (never at module scope), and reads `(await draftMode()).isEnabled` (allowed in a cache scope; draft mode bypasses the cache). Public reads use `published`; a row whose `published` is null is hidden. Small collections have no draft. Queries return raw data with `{ mediaId }` references; `resolveMedia` turns them into URLs (seeded images: `driver "static"`, url = `/images/…`).

Cache Components is enabled here (ruling). The still-static pages need two fixes until Task 8 rewrites them: `export const dynamicParams` fails the build under Cache Components, and `/blog` reads `searchParams`, which must sit inside `<Suspense>`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/cache-tags.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag }))

import { invalidate, tag } from "@/server/lib/cache-tags"

beforeEach(() => revalidateTag.mockClear())

describe("cache tags (spec §5.6)", () => {
  it("names every tag", () => {
    expect(tag.page("home")).toBe("page:home")
    expect(tag.service("alarm-responses")).toBe("service:alarm-responses")
    expect(tag.article("key-holding-explained")).toBe(
      "article:key-holding-explained"
    )
    expect(tag.settings("sections.contact")).toBe("settings:sections.contact")
    expect(tag.media("abc")).toBe("media:abc")
    expect([
      tag.services,
      tag.articles,
      tag.categories,
      tag.team,
      tag.clients,
      tag.groupCompanies,
      tag.redirects,
    ]).toEqual([
      "services",
      "articles",
      "categories",
      "team",
      "clients",
      "group-companies",
      "redirects",
    ])
  })

  it("invalidate expires each tag immediately (read-your-writes)", () => {
    invalidate(tag.services, tag.service("x"))
    expect(revalidateTag.mock.calls).toEqual([
      ["services", { expire: 0 }],
      ["service:x", { expire: 0 }],
    ])
  })
})
```


`tests/unit/media-refs.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { collectMediaIds, type MediaView, replaceMediaRefs } from "@/lib/media"

const view = (id: string): MediaView => ({
  id,
  url: `/images/${id}.png`,
  alt: "",
  width: 10,
  height: 10,
  blurDataUrl: null,
})

const data = {
  hero: { image: { mediaId: "a" }, title: "T" },
  items: [{ icon: { mediaId: "b" } }, { icon: { mediaId: "a" } }],
  body: {
    type: "doc",
    content: [{ type: "image", attrs: { media: { mediaId: "c" }, alt: "x" } }],
  },
  // not a reference: has more than one key
  other: { mediaId: "z", extra: true },
  when: new Date("2026-09-20T09:00:00Z"),
}

describe("media references", () => {
  it("collects every { mediaId } once", () => {
    expect([...collectMediaIds(data)].sort()).toEqual(["a", "b", "c"])
  })

  it("replaces references and leaves everything else as is", () => {
    const out = replaceMediaRefs(data, view)
    expect(out.hero.image.url).toBe("/images/a.png")
    expect(out.items.map((i) => i.icon.id)).toEqual(["b", "a"])
    expect(out.body.content[0].attrs.media).toEqual(view("c"))
    expect(out.other).toEqual({ mediaId: "z", extra: true })
    expect(out.when).toEqual(data.when)
    expect(out.hero.title).toBe("T")
    expect(data.hero.image).toEqual({ mediaId: "a" })
  })
})
```


`tests/integration/queries/public-queries.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Outside Next there is no cache scope or request: record tags, toggle draft mode.
const { cacheTag, draft } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  draft: { isEnabled: false },
}))
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag }))
vi.mock("next/headers", () => ({ draftMode: async () => draft }))

import { getDb } from "@/server/db/client"
import { articles, media, pages, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { contentFixtures } from "@/server/db/seed/fixtures"
import type { MediaLookup } from "@/server/db/seed/fixtures/media"
import { getArticle, listArticles } from "@/server/modules/articles/queries"
import {
  listCategories,
  listClients,
  listGroupCompanies,
  listTeam,
} from "@/server/modules/collections/queries"
import { getMedia, resolveMedia } from "@/server/modules/media/queries"
import { getPage } from "@/server/modules/pages/queries"
import { getService, listServices } from "@/server/modules/services/queries"
import { getSettings } from "@/server/modules/settings/queries"

import { resetDb } from "../db"

let fx: ReturnType<typeof contentFixtures>

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  const rows = await getDb()
    .select({ id: media.id, key: media.key })
    .from(media)
  const byKey = new Map(rows.map((r) => [r.key, r.id]))
  const lookup: MediaLookup = (key) => ({ mediaId: byKey.get(key)! })
  fx = contentFixtures(lookup)
})

beforeEach(() => {
  cacheTag.mockClear()
  draft.isEnabled = false
})

describe("public queries (master Task 3.4)", () => {
  it("getPage returns the published data and seo, tagged page:<key>", async () => {
    const home = await getPage("home")
    expect(home).toEqual({ key: "home", data: fx.pages.home.data, seo: {} })
    expect(cacheTag).toHaveBeenCalledWith("page:home")
    expect((await getPage("about"))?.seo).toEqual(fx.pages.about.seo)
  })

  it("getSettings returns the published value, tagged settings:<key>", async () => {
    expect(await getSettings("contact")).toEqual(fx.settings.contact)
    expect(cacheTag).toHaveBeenCalledWith("settings:contact")
  })

  it("lists services in display order and finds one by slug", async () => {
    const list = await listServices()
    expect(list.map((s) => s.slug)).toEqual(fx.services.map((s) => s.slug))
    expect(list[0].content).toEqual(fx.services[0].content)
    const one = await getService("event-security")
    expect(one?.content.title).toBe("Event Security")
    expect(cacheTag).toHaveBeenCalledWith("services", "service:event-security")
  })

  it("returns null for unknown slugs", async () => {
    expect(await getService("no-such-service")).toBeNull()
    expect(await getArticle("no-such-article")).toBeNull()
  })

  it("lists articles newest first with category and byline", async () => {
    const list = await listArticles()
    expect(list.map((a) => a.slug)).toEqual(fx.articles.map((a) => a.slug))
    expect(list[1]).toMatchObject({
      slug: "mobile-patrols-protect-your-business-after-hours",
      readTimeMinutes: 5,
      category: { slug: "mobile-patrols", name: "Mobile Patrols" },
      author: { name: "Michael McDonald", title: "Managing Director" },
    })
    expect(list[2].author).toBeNull()
    expect(list[0].publishedAt).toEqual(new Date("2026-09-20T09:00:00Z"))
  })

  it("filters articles by category slug and limits", async () => {
    const news = await listArticles({ category: "company-news" })
    expect(news.map((a) => a.slug)).toEqual([
      "18-years-of-watching-over-ireland",
      "inside-our-24-7-operations-team",
    ])
    expect(await listArticles({ limit: 2 })).toHaveLength(2)
  })

  it("hides unpublished records, shows drafts in draft mode", async () => {
    const db = getDb()
    await db
      .update(articles)
      .set({ published: null })
      .where(eq(articles.slug, "key-holding-explained"))
    const [page] = await db
      .select()
      .from(pages)
      .where(eq(pages.key, "services"))
    const draftData = structuredClone(page.draft) as {
      hero: { title: string }
    }
    draftData.hero.title = "Draft title"
    await db
      .update(pages)
      .set({ draft: draftData })
      .where(eq(pages.key, "services"))
    await db
      .update(services)
      .set({ published: null })
      .where(eq(services.slug, "static-security"))
    try {
      expect(await getArticle("key-holding-explained")).toBeNull()
      expect((await listArticles()).map((a) => a.slug)).not.toContain(
        "key-holding-explained"
      )
      expect((await getPage("services"))?.data.hero.title).toBe("Our Services")
      expect(await getService("static-security")).toBeNull()
      draft.isEnabled = true
      expect((await getPage("services"))?.data.hero.title).toBe("Draft title")
      expect((await getArticle("key-holding-explained"))?.slug).toBe(
        "key-holding-explained"
      )
      expect((await listServices()).map((s) => s.slug)).toContain(
        "static-security"
      )
    } finally {
      await resetDb()
      await seedContent(db)
      const rows = await db.select({ id: media.id, key: media.key }).from(media)
      const byKey = new Map(rows.map((r) => [r.key, r.id]))
      fx = contentFixtures((key) => ({ mediaId: byKey.get(key)! }))
    }
  })

  it("lists the small collections in display order", async () => {
    expect((await listCategories()).map((c) => c.name)).toEqual(
      fx.categories.map((c) => c.name)
    )
    expect(await listTeam()).toEqual(
      fx.team.map((t) => ({ ...t, id: expect.any(String) }))
    )
    expect(await listClients()).toEqual(
      fx.clients.map((c) => ({ ...c, id: expect.any(String) }))
    )
    expect(await listGroupCompanies()).toEqual(
      fx.groupCompanies.map((g) => ({ ...g, id: expect.any(String) }))
    )
  })

  it("serves static media at its public/ path and resolves references", async () => {
    const page = await getPage("home")
    const resolved = await resolveMedia(page!.data)
    expect(resolved.hero.backgroundImage).toMatchObject({
      url: "/images/hero.jpg",
      width: 1440,
      height: 748,
    })
    const view = await getMedia(fx.pages.home.data.hero.backgroundImage.mediaId)
    expect(view?.url).toBe("/images/hero.jpg")
    expect(await getMedia("00000000-0000-7000-8000-000000000999")).toBeNull()
    await expect(
      resolveMedia({
        image: { mediaId: "00000000-0000-7000-8000-000000000999" },
      })
    ).rejects.toThrow("not found")
  })
})
```


Append to `tests/unit/lint-boundaries.test.ts`:

```ts

const drizzleImport = 'import { eq } from "drizzle-orm"\n\nexport const x = eq\n'
const pgCoreImport =
  'import { text } from "drizzle-orm/pg-core"\n\nexport const x = text\n'

describe(
  "lint boundaries: only repos (and server/db, tests) import drizzle-orm",
  { timeout: 30_000 },
  () => {
    it.each([
      "server/modules/pages/service.ts",
      "server/modules/pages/queries.ts",
      "server/lib/fixture.ts",
      "app/(site)/fixture.tsx",
      "components/fixture.tsx",
      "scripts/fixture.ts",
    ])("flags drizzle-orm in %s", async (file) => {
      const errors = await boundaryErrors(drizzleImport, file)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain("server/modules/*/repo.ts")
      expect(await boundaryErrors(pgCoreImport, file)).toHaveLength(1)
    })

    it("flags drizzle-orm in lib/ and still flags server/ imports there", async () => {
      expect(await boundaryErrors(drizzleImport, "lib/fixture.ts")).toHaveLength(1)
      expect(await boundaryErrors(aliasImport, "lib/fixture.ts")).toHaveLength(1)
    })

    it.each([
      "server/modules/pages/repo.ts",
      "server/db/schema/fixture.ts",
      "server/db/seed/index.ts",
      "tests/integration/fixture.test.ts",
    ])("allows drizzle-orm in %s", async (file) => {
      expect(await boundaryErrors(drizzleImport, file)).toEqual([])
    })

    it("flags routes importing a repo (relative or alias)", async () => {
      const relative = 'import * as repo from "./repo"\n\nexport const x = repo\n'
      const alias =
        'import * as repo from "@/server/modules/users/repo"\n\nexport const x = repo\n'
      expect(
        await boundaryErrors(relative, "server/modules/pages/routes.ts")
      ).toHaveLength(1)
      expect(
        await boundaryErrors(alias, "server/modules/pages/routes.ts")
      ).toHaveLength(1)
      expect(
        await boundaryErrors(relative, "server/modules/pages/service.ts")
      ).toEqual([])
    })
  }
)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/cache-tags.test.ts tests/unit/media-refs.test.ts tests/unit/lint-boundaries.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/cache-tags"` / `"@/lib/media"`, and the new lint-boundary cases fail (`expected [] to have a length of 1`).

Run: `pnpm test:integration tests/integration/queries/public-queries.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/modules/articles/queries"`.

- [ ] **Step 3: Media references, settings store, cache tags**

`lib/media.ts`:

```ts
import type { MediaRef } from "@/lib/schemas/common"

/** A media row as the public site needs it (spec §5.6). */
export type MediaView = {
  id: string
  url: string
  alt: string
  width: number | null
  height: number | null
  blurDataUrl: string | null
}

/** `T` with every `{ mediaId }` replaced by its MediaView. */
export type WithMedia<T> = T extends MediaRef
  ? MediaView
  : T extends Date
    ? T
    : T extends readonly (infer U)[]
      ? WithMedia<U>[]
      : T extends object
        ? { [K in keyof T]: WithMedia<T[K]> }
        : T

function isMediaRef(value: unknown): value is MediaRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return (
    keys.length === 1 &&
    keys[0] === "mediaId" &&
    typeof (value as MediaRef).mediaId === "string"
  )
}

/** Every media id referenced anywhere in `value` (JSON-like data). */
export function collectMediaIds(value: unknown, out = new Set<string>()) {
  if (isMediaRef(value)) out.add(value.mediaId)
  else if (Array.isArray(value)) for (const v of value) collectMediaIds(v, out)
  else if (value && typeof value === "object" && !(value instanceof Date))
    for (const v of Object.values(value)) collectMediaIds(v, out)
  return out
}

/** Copy of `value` with each `{ mediaId }` replaced by `resolve(id)`. */
export function replaceMediaRefs<T>(
  value: T,
  resolve: (id: string) => MediaView
): WithMedia<T> {
  const walk = (v: unknown): unknown => {
    if (isMediaRef(v)) return resolve(v.mediaId)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === "object" && !(v instanceof Date))
      return Object.fromEntries(
        Object.entries(v).map(([k, child]) => [k, walk(child)])
      )
    return v
  }
  return walk(value) as WithMedia<T>
}
```


`server/lib/settings-store.ts`:

```ts
import "server-only"

export {
  isSettingsKey,
  SETTINGS_KEYS,
  type SettingsKey,
  type SettingsValue,
} from "@/lib/schemas/settings"

/** Encrypted integration settings (schemas and module in Phase 7). */
export const INTEGRATION_KEYS = [
  "integrations.smtp",
  "integrations.r2",
  "integrations.turnstile",
  "integrations.ai",
] as const
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number]
```


`server/lib/cache-tags.ts`:

```ts
import "server-only"

import { revalidateTag } from "next/cache"

import type { SettingsKey } from "./settings-store"

/** Cache tags of the public queries (spec §5.6). */
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

/**
 * Expires tags now, so the next request (an admin checking their publish)
 * gets fresh data. Callable from Route Handlers (the Hono API) and Server
 * Actions only — never during render or from a timer (notes §2).
 */
export function invalidate(...tags: string[]): void {
  for (const t of tags) revalidateTag(t, { expire: 0 })
}
```


- [ ] **Step 4: Repos and queries**

`server/modules/pages/repo.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { pages } from "@/server/db/schema"

export async function findPageByKey(db: DbOrTx, key: string) {
  const [row] = await db.select().from(pages).where(eq(pages.key, key))
  return row ?? null
}
```


`server/modules/pages/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import type { Seo } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import type { PageData, PageKey } from "@/templates/registry"

import { findPageByKey } from "./repo"

export type PageRecord<K extends PageKey> = {
  key: K
  data: PageData<K>
  seo: Seo
}

/** Published page data (draft in draft mode); null if missing or never published. */
export async function getPage<K extends PageKey>(
  key: K
): Promise<PageRecord<K> | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.page(key))
  const { isEnabled: draft } = await draftMode()
  const row = await findPageByKey(getDb(), key)
  const data = draft ? row?.draft : row?.published
  if (!row || !data) return null
  return { key, data: data as PageData<K>, seo: row.seo }
}
```


`server/modules/services/repo.ts`:

```ts
import "server-only"

import { asc, eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { services } from "@/server/db/schema"

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
```


`server/modules/services/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import type { Seo } from "@/lib/schemas/common"
import type { ServiceContent } from "@/lib/schemas/content/service"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"

import { findServiceBySlug, listServiceRows } from "./repo"

export type ServiceRecord = {
  id: string
  slug: string
  sortOrder: number
  seo: Seo
  content: ServiceContent
}

type Row = Awaited<ReturnType<typeof findServiceBySlug>>

function toRecord(row: NonNullable<Row>, draft: boolean): ServiceRecord | null {
  const content = draft ? row.draft : row.published
  if (!content) return null
  return {
    id: row.id,
    slug: row.slug,
    sortOrder: row.sortOrder,
    seo: row.seo,
    content,
  }
}

/** Published services in display order. */
export async function listServices(): Promise<ServiceRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.services)
  const { isEnabled: draft } = await draftMode()
  const rows = await listServiceRows(getDb())
  return rows
    .map((row) => toRecord(row, draft))
    .filter((r): r is ServiceRecord => r !== null)
}

/** One published service; null for an unknown or unpublished slug. */
export async function getService(slug: string): Promise<ServiceRecord | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.services, tag.service(slug))
  const { isEnabled: draft } = await draftMode()
  const row = await findServiceBySlug(getDb(), slug)
  return row ? toRecord(row, draft) : null
}
```


`server/modules/articles/repo.ts`:

```ts
import "server-only"

import { desc, eq, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { articleCategories, articles, users } from "@/server/db/schema"

const columns = {
  id: articles.id,
  slug: articles.slug,
  draft: articles.draft,
  published: articles.published,
  publishedAt: articles.publishedAt,
  readTimeMinutes: articles.readTimeMinutes,
  seo: articles.seo,
  category: { slug: articleCategories.slug, name: articleCategories.name },
  authorName: users.name,
  authorTitle: users.title,
}

function baseQuery(db: DbOrTx) {
  return db
    .select(columns)
    .from(articles)
    .innerJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
    .leftJoin(users, eq(articles.authorId, users.id))
}

/** Newest first (unpublished drafts first in draft mode). */
export function listArticleRows(
  db: DbOrTx,
  filter: { categorySlug?: string } = {}
) {
  const query = baseQuery(db)
  const filtered = filter.categorySlug
    ? query.where(eq(articleCategories.slug, filter.categorySlug))
    : query
  return filtered.orderBy(
    sql`${articles.publishedAt} desc nulls first`,
    desc(articles.createdAt)
  )
}

export async function findArticleBySlug(db: DbOrTx, slug: string) {
  const [row] = await baseQuery(db).where(eq(articles.slug, slug))
  return row ?? null
}

export type ArticleRow = NonNullable<
  Awaited<ReturnType<typeof findArticleBySlug>>
>
```


`server/modules/articles/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import type { Seo } from "@/lib/schemas/common"
import type { ArticleContent } from "@/lib/schemas/content/article"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"

import { type ArticleRow, findArticleBySlug, listArticleRows } from "./repo"

export type ArticleRecord = {
  id: string
  slug: string
  publishedAt: Date | null
  readTimeMinutes: number | null
  seo: Seo
  category: { slug: string; name: string }
  /** Byline from the author's profile (users.name, users.title). */
  author: { name: string; title: string | null } | null
  content: ArticleContent
}

function toRecord(row: ArticleRow, draft: boolean): ArticleRecord | null {
  const content = draft ? row.draft : row.published
  if (!content) return null
  return {
    id: row.id,
    slug: row.slug,
    publishedAt: row.publishedAt,
    readTimeMinutes: row.readTimeMinutes,
    seo: row.seo,
    category: row.category,
    author:
      row.authorName === null
        ? null
        : { name: row.authorName, title: row.authorTitle },
    content,
  }
}

/** Published articles, newest first; optionally one category (slug) and a limit. */
export async function listArticles(
  options: { category?: string; limit?: number } = {}
): Promise<ArticleRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.articles, tag.categories)
  const { isEnabled: draft } = await draftMode()
  const rows = await listArticleRows(getDb(), {
    categorySlug: options.category,
  })
  const records = rows
    .map((row) => toRecord(row, draft))
    .filter((r): r is ArticleRecord => r !== null)
  return options.limit === undefined ? records : records.slice(0, options.limit)
}

/** One published article; null for an unknown or unpublished slug. */
export async function getArticle(slug: string): Promise<ArticleRecord | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.articles, tag.article(slug), tag.categories)
  const { isEnabled: draft } = await draftMode()
  const row = await findArticleBySlug(getDb(), slug)
  return row ? toRecord(row, draft) : null
}
```


`server/modules/collections/repo.ts`:

```ts
import "server-only"

import { asc } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  articleCategories,
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
```


`server/modules/collections/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import type { MediaRef } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"

import {
  listCategoryRows,
  listClientRows,
  listGroupCompanyRows,
  listTeamRows,
} from "./repo"

// Small collections publish immediately (spec §5.3): no draft mode.

export type CategoryRecord = {
  id: string
  slug: string
  name: string
  showInFilter: boolean
}
export type TeamMemberRecord = {
  id: string
  name: string
  role: string
  bio: string
  email: string
  photo: MediaRef | null
}
export type ClientRecord = {
  id: string
  name: string
  logo: MediaRef
  url: string | null
}
export type GroupCompanyRecord = {
  id: string
  name: string
  phone: string
  site: string
  logo: MediaRef
}

export async function listCategories(): Promise<CategoryRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.categories)
  const rows = await listCategoryRows(getDb())
  return rows.map(({ id, slug, name, showInFilter }) => ({
    id,
    slug,
    name,
    showInFilter,
  }))
}

export async function listTeam(): Promise<TeamMemberRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.team)
  const rows = await listTeamRows(getDb())
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    bio: r.bio,
    email: r.email,
    photo: r.photoId ? { mediaId: r.photoId } : null,
  }))
}

export async function listClients(): Promise<ClientRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.clients)
  const rows = await listClientRows(getDb())
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    logo: { mediaId: r.logoId },
    url: r.url,
  }))
}

export async function listGroupCompanies(): Promise<GroupCompanyRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.groupCompanies)
  const rows = await listGroupCompanyRows(getDb())
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    site: r.site,
    logo: { mediaId: r.logoId },
  }))
}
```


`server/modules/settings/repo.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { settings } from "@/server/db/schema"

export async function findSettingsRow(db: DbOrTx, key: string) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  return row ?? null
}
```


`server/modules/settings/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import type { SettingsKey, SettingsValue } from "@/server/lib/settings-store"

import { findSettingsRow } from "./repo"

/** Published value of a content settings key (draft in draft mode); null if unset. */
export async function getSettings<K extends SettingsKey>(
  key: K
): Promise<SettingsValue<K> | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.settings(key))
  const { isEnabled: draft } = await draftMode()
  const row = await findSettingsRow(getDb(), key)
  const value = draft ? row?.draft : row?.published
  return (value ?? null) as SettingsValue<K> | null
}
```


`server/modules/media/repo.ts`:

```ts
import "server-only"

import { eq } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { media } from "@/server/db/schema"

export async function findMediaById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id))
  return row ?? null
}
```


`server/modules/media/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import {
  collectMediaIds,
  type MediaView,
  replaceMediaRefs,
  type WithMedia,
} from "@/lib/media"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { AppError } from "@/server/lib/errors"

import { findMediaById } from "./repo"

type MediaRow = NonNullable<Awaited<ReturnType<typeof findMediaById>>>

/**
 * Public URL of a media row. "static" files ship in public/ (key is the
 * path), so seeded content renders the same src as the static site. The
 * disk and R2 drivers are wired by the storage layer in Phase 6.
 */
export function mediaUrl(row: Pick<MediaRow, "driver" | "key">): string {
  if (row.driver === "static") return row.key
  if (row.driver === "disk")
    return `/api/v1/media/file/${encodeURIComponent(row.key)}`
  throw new AppError("INTERNAL", "R2 media URLs need the storage driver")
}

export async function getMedia(id: string): Promise<MediaView | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.media(id))
  const row = await findMediaById(getDb(), id)
  if (!row) return null
  return {
    id: row.id,
    url: mediaUrl(row),
    alt: row.alt,
    width: row.width,
    height: row.height,
    blurDataUrl: row.blurDataUrl,
  }
}

/**
 * Replaces every `{ mediaId }` in `value` with its MediaView. A reference
 * to a missing media row is a content bug: it throws (error page) instead
 * of rendering a broken image.
 */
export async function resolveMedia<T>(value: T): Promise<WithMedia<T>> {
  const ids = [...collectMediaIds(value)]
  const views = await Promise.all(ids.map((id) => getMedia(id)))
  const byId = new Map<string, MediaView>()
  ids.forEach((id, i) => {
    const view = views[i]
    if (!view) throw new AppError("INTERNAL", `Media ${id} not found`)
    byId.set(id, view)
  })
  return replaceMediaRefs(value, (id) => byId.get(id)!)
}
```


- [ ] **Step 5: Lint boundaries and Cache Components**

`eslint.config.mjs` (full file):

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Isomorphic code (lib/, template schemas) also ships to the browser: it
// must never import server/ (secrets, database, Node-only APIs).
const serverImport = {
  regex: "^(?:@/server|(?:\\.\\./)+server)(?:/|$)",
  message:
    "lib/ and templates/*/schema.ts are isomorphic: never import server/ code.",
};
// Only repositories talk to Drizzle (global constraint). Schema, migrations
// and the seed live in server/db/; tests may query directly.
const drizzleImport = {
  regex: "^drizzle-orm(?:/|$)",
  message:
    "Only server/modules/*/repo.ts (and server/db/**) may import drizzle-orm. Call a repo function instead.",
};
// Routes validate, authorise and call a service; never a repo.
const repoImport = {
  regex: "^(?:\\./repo|@/server/modules/[^/]+/repo)$",
  message: "Routes call services, never repos.",
};

const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A later block replaces the rule for the files it matches, so each block
  // lists every pattern that applies to its files.
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: ["server/db/**", "server/modules/*/repo.ts", "tests/**"],
    rules: restrict(drizzleImport),
  },
  {
    files: ["lib/**/*.{ts,tsx}", "templates/*/schema.ts"],
    rules: restrict(serverImport, drizzleImport),
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


`next.config.ts` (full file; keeps Phase 2's `authInterrupts`):

```ts
import type { NextConfig } from "next"

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
}

export default nextConfig
```

In `app/(site)/services/[slug]/page.tsx` and `app/(site)/blog/[slug]/page.tsx` delete the line `export const dynamicParams = false` and the blank line after it (unknown slugs already call `notFound()`; `generateStaticParams` stays until Task 8).

`app/(site)/blog/page.tsx` (full file, temporary until Task 8):

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { BlogPosts } from "@/components/blog/blog-posts"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"

export const metadata: Metadata = {
  title: "News & Insights | Security Partners Ltd.",
  description:
    "Security tips, company news and advice from the Security Partners team.",
}

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          image="/images/banner.png"
          crumb="Blog"
          title="News & Insights"
          description="Security tips, company news and advice from the Security Partners team."
        />
        {/* cacheComponents: searchParams is request data, read inside Suspense. */}
        <Suspense fallback={null}>
          <Posts searchParams={searchParams} />
        </Suspense>
        <EnquireBanner />
      </main>
      <SiteFooter />
      <HomeMotion />
    </>
  )
}

async function Posts({
  searchParams,
}: Pick<PageProps<"/blog">, "searchParams">) {
  const { category } = await searchParams
  return (
    <BlogPosts
      initialCategory={typeof category === "string" ? category : undefined}
    />
  )
}
```

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: success; the route table marks `/`, `/about`, … with `○`/`◐` and `ƒ /api/[...route]`. If a Phase 2 admin route fails with `Route "/admin/…": Next.js encountered uncached or runtime data during prerendering`, wrap the component that reads the session or `searchParams` in that page in `<Suspense fallback={null}>` (the pattern Phase 2 already uses in `(panel)/layout.tsx`) and rebuild.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/cache-tags.test.ts tests/unit/media-refs.test.ts tests/unit/lint-boundaries.test.ts`
Expected: PASS (2 + 2 + 18 tests).

Run: `pnpm test:integration tests/integration/queries/public-queries.test.ts`
Expected: PASS (9 tests).

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: exit 0 (no file outside repos/`server/db`/tests imports drizzle-orm).

Run: `pnpm test:visual`
Expected: `40 passed` (pages are still static; proves Cache Components + the blog Suspense change nothing visible).

- [ ] **Step 7: Commit**

```bash
git add lib/media.ts server/lib/settings-store.ts server/lib/cache-tags.ts server/modules/pages server/modules/services server/modules/articles server/modules/collections server/modules/settings server/modules/media next.config.ts eslint.config.mjs "app/(site)/blog/page.tsx" "app/(site)/services/[slug]/page.tsx" "app/(site)/blog/[slug]/page.tsx" tests/unit/cache-tags.test.ts tests/unit/media-refs.test.ts tests/unit/lint-boundaries.test.ts tests/integration/queries
git commit -m "feat: add cached public queries and enable cache components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Render helpers — interpolation, article dates, TipTap renderer (master Task 3.5, part 1; ruling: renderer in Phase 3)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (`@tiptap/core@3.32.0`, `@tiptap/pm@3.32.0`)
- Create: `lib/interpolate.ts`, `lib/rich-text/render.tsx`
- Modify: `lib/format.ts` (Phase 2) — append article date helpers
- Test: `tests/unit/interpolate.test.ts`, `tests/unit/post-dates.test.ts`, `tests/unit/rich-text/legacy-article-block.tsx`, `tests/unit/rich-text/render.test.tsx`

**Interfaces:**
- Consumes: Task 1 types and fixtures, Task 6 `MediaView`/`WithMedia`/`replaceMediaRefs`, Phase 2 `SITE_TIME_ZONE` (`lib/format.ts`), `@tiptap/core` (`JSONContent` type only).
- Produces (isomorphic):

```ts
// lib/interpolate.ts
export type Placeholders = Record<string, string | number>
export function interpolate(template: string, values: Placeholders): string        // unknown {x} kept, never re-expanded
export function interpolateParts(template: string, values: Placeholders): string[]  // literal/value parts = separate text nodes
export function telHref(phone: string): string                                      // "(085) 8018746" → "tel:+353858018746"
export function contactPlaceholders(contact: ContactSettings): Placeholders         // contact fields + phone24hHref, officeHref, operationsMobileHref
// lib/format.ts (appended)
export function isoDate(value: Date): string        // "2026-09-20" in Europe/Dublin
export function formatPostDate(value: Date): string // "20 Sep 2026" (fixed month names: Intl en-IE prints "Sept")
// lib/rich-text/render.tsx
export function toJSONContent(doc: RichTextDoc): JSONContent  // stored docs are valid TipTap content (Phase 5 editor)
export function renderInline(nodes: InlineNode[] | undefined): ReactNode  // single plain text node → bare string
export function ArticleBlocks({ doc }: { doc: WithMedia<RichTextDoc> }): ReactNode // the static site's ArticleBody block markup
```

Acceptance (ruling): the renderer's output for the seeded article equals the static site's markup — the test renders the original `Block` component (kept verbatim as a test fixture, since `components/blog/article.tsx` changes in Task 8) and the new renderer and compares the HTML strings. `h3`, ordered lists and links are allowed by spec §5.3 but have no design yet; they get minimal brand styles.

- [ ] **Step 1: Install TipTap core**

```bash
pnpm add --save-exact @tiptap/core@3.32.0 @tiptap/pm@3.32.0
```

Expected: `+ @tiptap/core 3.32.0`, `+ @tiptap/pm 3.32.0` (`pm` is core's peer; libraries notes §5.1). Only types are used now; Phase 5 adds the editor.

- [ ] **Step 2: Write the failing tests**

`tests/unit/interpolate.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  contactPlaceholders,
  interpolate,
  interpolateParts,
  telHref,
} from "@/lib/interpolate"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

const contact = settingsFixture(fixtureMediaLookup).contact

describe("telHref", () => {
  // Every hard-coded tel: href of the static site, from its display number.
  it.each([
    ["(085) 8018746", "tel:+353858018746"],
    ["057 8697670", "tel:+353578697670"],
    ["085 859 1299", "tel:+353858591299"],
    ["(087) 924 8880", "tel:+353879248880"],
    ["085 806 2369", "tel:+353858062369"],
    ["+353 85 801 8746", "tel:+353858018746"],
    ["0044 20 7946 0000", "tel:+442079460000"],
  ])("%s → %s", (phone, expected) => {
    expect(telHref(phone)).toBe(expected)
  })
})

describe("interpolate", () => {
  it("fills known placeholders and keeps unknown ones", () => {
    expect(interpolate("Call {office} or {other}", { office: "057" })).toBe(
      "Call 057 or {other}"
    )
    expect(interpolate("Page {n}", { n: 2 })).toBe("Page 2")
  })

  it("never re-expands inserted values", () => {
    expect(interpolate("{a}", { a: "{b}", b: "x" })).toBe("{b}")
  })

  it("ignores inherited keys", () => {
    expect(interpolate("{toString}", {})).toBe("{toString}")
  })

  it("reproduces the static site's contact strings", () => {
    const values = contactPlaceholders(contact)
    expect(interpolate("Call 24/7: {phone24h}", values)).toBe(
      "Call 24/7: (085) 8018746"
    )
    expect(interpolate("{phone24hHref}", values)).toBe("tel:+353858018746")
    expect(interpolate("{officeHref}", values)).toBe("tel:+353578697670")
    expect(interpolate("{operationsMobileHref}", values)).toBe(
      "tel:+353858591299"
    )
    expect(interpolate("Tel: {office} Ext 2", values)).toBe(
      "Tel: 057 8697670 Ext 2"
    )
    expect(interpolate("mailto:{operationsEmail}", values)).toBe(
      "mailto:operations@securitypartnersltd.com"
    )
    expect(interpolate("{mapsHref}", values)).toBe(contact.mapsHref)
  })
})

describe("interpolateParts (text-node parity)", () => {
  it("splits literal text and values like JSX `Call {office}`", () => {
    expect(interpolateParts("Call {office}", { office: "057" })).toEqual([
      "Call ",
      "057",
    ])
    expect(
      interpolateParts("No posts in {category} yet.", { category: "X" })
    ).toEqual(["No posts in ", "X", " yet."])
    expect(interpolateParts("Plain", {})).toEqual(["Plain"])
    expect(interpolateParts("{a}{b}", { a: "1", b: "2" })).toEqual(["1", "2"])
    expect(interpolateParts("Keep {unknown}", {})).toEqual(["Keep {unknown}"])
  })
})
```


`tests/unit/post-dates.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { formatPostDate, isoDate } from "@/lib/format"

describe("article dates (Europe/Dublin)", () => {
  it.each([
    ["2026-09-20T09:00:00Z", "2026-09-20", "20 Sep 2026"],
    ["2026-08-05T09:00:00Z", "2026-08-05", "05 Aug 2026"],
    ["2026-07-02T09:00:00Z", "2026-07-02", "02 Jul 2026"],
    ["2026-06-04T09:00:00Z", "2026-06-04", "04 Jun 2026"],
    // 23:30 UTC on 31 Mar is already 1 Apr in Irish summer time
    ["2026-03-31T23:30:00Z", "2026-04-01", "01 Apr 2026"],
    // winter: Irish time = UTC
    ["2026-12-31T23:30:00Z", "2026-12-31", "31 Dec 2026"],
  ])("%s → %s, %s", (iso, date, display) => {
    expect(isoDate(new Date(iso))).toBe(date)
    expect(formatPostDate(new Date(iso))).toBe(display)
  })

  it("prints Sep, not Intl's en-IE 'Sept'", () => {
    expect(formatPostDate(new Date("2026-09-12T09:00:00Z"))).toBe("12 Sep 2026")
  })
})
```


`tests/unit/rich-text/legacy-article-block.tsx` (verbatim copy of the pre-Phase-3 block renderer and the seeded body):

```tsx
import Image from "next/image"

// Verbatim copy of the static site's ArticleBody block renderer
// (components/blog/article.tsx before Phase 3) and the seeded article body,
// kept as the reference the TipTap renderer must reproduce.
export type PostBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string; cite: string }
  | { type: "image"; src: string; alt: string }
const paragraph = "text-lg leading-[1.75] text-[#3b4556]"
export function LegacyBlock({ block }: { block: PostBlock }) {
  switch (block.type) {
    case "p":
      return <p className={paragraph}>{block.text}</p>
    case "h2":
      return (
        <h2 className="mt-7 text-[26px] leading-[1.25] font-black tracking-[-0.005em] text-brand-navy md:text-[30px]">
          {block.text}
        </h2>
      )
    case "list":
      return (
        <ul className="flex flex-col gap-3.5">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3.5">
              <Image
                src="/images/check.svg"
                alt=""
                width={24}
                height={24}
                className="shrink-0"
              />
              <span className="text-[17px] leading-normal font-medium text-brand-navy">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )
    case "quote":
      return (
        <figure className="flex flex-col gap-3 rounded-[20px] border-l-5 border-brand-green bg-brand-mint px-7 py-8 font-bold md:px-9">
          <blockquote className="text-xl leading-normal text-brand-navy md:text-[22px]">
            “{block.text}”
          </blockquote>
          <figcaption className="text-sm leading-[normal] text-brand-green-dark">
            {block.cite}
          </figcaption>
        </figure>
      )
    case "image":
      return (
        <div className="relative h-64 overflow-hidden rounded-3xl md:h-[400px]">
          <Image
            src={block.src}
            alt={block.alt}
            fill
            sizes="(min-width: 1280px) 776px, 100vw"
            className="object-cover"
          />
        </div>
      )
  }
}
export const legacyBody: PostBlock[] = [
  {
    type: "p",
    text: "When your business closes for the night, it becomes an easy target. A mobile patrol puts clearly identifiable security officers on your premises at set times, so problems are found early and unwanted activity is deterred.",
  },
  { type: "h2", text: "What a scheduled patrol covers" },
  {
    type: "p",
    text: "Every patrol is planned around your site and your schedule. Our officers check the areas that matter most to you and report back to our Operations Team as they go.",
  },
  {
    type: "list",
    items: [
      "Perimeter, doors and windows checked for signs of entry",
      "Lights, alarms and equipment left in a safe state",
      "Tag point checks logged at every stop, in real time",
      "Any issue reported straight to our 24/7 Operations Team",
    ],
  },
  {
    type: "quote",
    text: "A visible security presence is one of the simplest ways to deter break-ins, vandalism and anti-social behaviour.",
    cite: "Security Partners Operations Team",
  },
  { type: "h2", text: "Pairing patrols with key holding" },
  {
    type: "p",
    text: "With key holding, our team holds secure keys to your premises. If your alarm is activated, an officer can be dispatched to deal with the situation, so you are not called out in the middle of the night.",
  },
  {
    type: "image",
    src: "/images/about.png",
    alt: "Security Partners officer completing a patrol report",
  },
  { type: "h2", text: "Is a mobile patrol right for you?" },
  {
    type: "p",
    text: "Mobile patrols suit offices, retail units, building sites and any premises left empty after hours. Get in touch and our team will recommend a patrol plan that fits your site.",
  },
]
```


`tests/unit/rich-text/render.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { replaceMediaRefs, type MediaView } from "@/lib/media"
import { ArticleBlocks, renderInline } from "@/lib/rich-text/render"
import { richText, type RichTextDoc } from "@/lib/schemas/common"
import { articlesFixture } from "@/server/db/seed/fixtures/articles"
import {
  fixtureMediaKey,
  fixtureMediaLookup,
} from "@/server/db/seed/fixtures/media"

import { LegacyBlock, legacyBody } from "./legacy-article-block"

const staticMedia = (id: string): MediaView => ({
  id,
  url: fixtureMediaKey(id),
  alt: "",
  width: null,
  height: null,
  blurDataUrl: null,
})

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>)

describe("TipTap JSON → article markup (ruling: renderer in Phase 3)", () => {
  it("renders the seeded article body exactly like the static site", () => {
    const article = articlesFixture(fixtureMediaLookup).find(
      (a) => a.slug === "mobile-patrols-protect-your-business-after-hours"
    )!
    const doc = replaceMediaRefs(article.content.body!, staticMedia)
    const legacy = html(
      legacyBody.map((block, i) => <LegacyBlock key={i} block={block} />)
    )
    expect(html(<ArticleBlocks doc={doc} />)).toBe(legacy)
  })

  it("renders a plain text node as a bare string", () => {
    expect(renderInline([{ type: "text", text: "Dinn Rí" }])).toBe("Dinn Rí")
    expect(renderInline(undefined)).toBeNull()
  })

  it("renders marks, links and line breaks", () => {
    expect(
      html(
        renderInline([
          { type: "text", text: "a", marks: [{ type: "bold" }] },
          { type: "hardBreak" },
          {
            type: "text",
            text: "b",
            marks: [
              { type: "italic" },
              { type: "link", attrs: { href: "/contact" } },
            ],
          },
        ])
      )
    ).toBe(
      '<strong>a</strong><br/><a href="/contact" class="font-bold text-brand-blue hover:underline"><em>b</em></a>'
    )
  })

  it("renders h3, ordered lists and a quote without cite", () => {
    const doc = richText.parse({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Sub" }],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "One" }] },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Q" }] },
          ],
        },
      ],
    }) as RichTextDoc
    const out = html(<ArticleBlocks doc={replaceMediaRefs(doc, staticMedia)} />)
    expect(out).toContain(">Sub</h3>")
    expect(out).toContain("<li>One</li>")
    expect(out).toContain("“Q”</blockquote>")
    expect(out).not.toContain("figcaption")
  })
})
```


- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/interpolate.test.ts tests/unit/post-dates.test.ts tests/unit/rich-text`
Expected: FAIL — `Failed to resolve import "@/lib/interpolate"`, `formatPostDate is not a function` / not exported, `Failed to resolve import "@/lib/rich-text/render"`.

- [ ] **Step 4: Implement**

`lib/interpolate.ts`:

```ts
import type { ContactSettings } from "@/lib/schemas/settings/contact"

export type Placeholders = Record<string, string | number>

/**
 * Fills "{name}" placeholders (docs/brief.md §14.3). Unknown placeholders
 * stay as written; values are inserted once (never re-expanded).
 */
export function interpolate(template: string, values: Placeholders): string {
  return template.replace(/\{([A-Za-z]\w*)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  )
}

/**
 * Same as interpolate, but returns the literal text and each inserted value
 * as separate strings. Rendered as children they become separate text nodes,
 * exactly like JSX `Call {office}` — Chrome positions glyphs per text node,
 * so this keeps such labels pixel-identical.
 */
export function interpolateParts(
  template: string,
  values: Placeholders
): string[] {
  const parts: string[] = []
  let literal = ""
  let last = 0
  for (const match of template.matchAll(/\{([A-Za-z]\w*)\}/g)) {
    if (!Object.hasOwn(values, match[1])) continue
    literal += template.slice(last, match.index)
    if (literal) parts.push(literal)
    literal = ""
    parts.push(String(values[match[1]]))
    last = match.index + match[0].length
  }
  literal += template.slice(last)
  if (literal) parts.push(literal)
  return parts
}

/** "(085) 8018746" → "tel:+353858018746" (Irish numbers; +/00 kept international). */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return `tel:${digits}`
  if (digits.startsWith("00")) return `tel:+${digits.slice(2)}`
  if (digits.startsWith("0")) return `tel:+353${digits.slice(1)}`
  return `tel:${digits}`
}

/** Every settings.contact field plus the derived tel: hrefs (ruling: all *Href except mapsHref). */
export function contactPlaceholders(contact: ContactSettings): Placeholders {
  return {
    ...contact,
    phone24hHref: telHref(contact.phone24h),
    officeHref: telHref(contact.office),
    operationsMobileHref: telHref(contact.operationsMobile),
  }
}
```


Append to `lib/format.ts` (after `describeUserAgent`):

```ts
// Article dates. Intl's en-IE short month for September is "Sept", but the
// site prints "20 Sep 2026", so month names come from a fixed list.
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const calendarDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Calendar date in Irish time as "2026-09-20" (for <time dateTime>). */
export function isoDate(value: Date): string {
  const parts = Object.fromEntries(
    calendarDate.formatToParts(value).map((p) => [p.type, p.value])
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** "20 Sep 2026" in Irish time (article cards and headers). */
export function formatPostDate(value: Date): string {
  const [year, month, day] = isoDate(value).split("-")
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`
}
```

`lib/rich-text/render.tsx`:

```tsx
import { Fragment, type ReactNode } from "react"
import Image from "next/image"
import type { JSONContent } from "@tiptap/core"

import type { WithMedia } from "@/lib/media"
import type {
  InlineNode,
  ParagraphNode,
  RichTextBlock,
  RichTextDoc,
} from "@/lib/schemas/common"

// Server-safe TipTap JSON → React for the public site. Article blocks
// reproduce the static site's ArticleBody markup exactly (Phase 5 adds the
// editor on top of the same JSON).

/** Stored docs are valid TipTap content (the editor loads them as is). */
export function toJSONContent(doc: RichTextDoc): JSONContent {
  return doc
}

function withMarks(node: Extract<InlineNode, { type: "text" }>): ReactNode {
  let out: ReactNode = node.text
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>
    else if (mark.type === "italic") out = <em>{out}</em>
    else
      out = (
        <a
          href={mark.attrs.href}
          className="font-bold text-brand-blue hover:underline"
        >
          {out}
        </a>
      )
  }
  return out
}

/**
 * Inline content. A single unmarked text node renders as a bare string, so
 * seeded copy produces exactly the text node the static site rendered.
 */
export function renderInline(nodes: InlineNode[] | undefined): ReactNode {
  if (!nodes?.length) return null
  if (nodes.length === 1 && nodes[0].type === "text" && !nodes[0].marks?.length)
    return nodes[0].text
  return nodes.map((node, i) => (
    <Fragment key={i}>
      {node.type === "hardBreak" ? <br /> : withMarks(node)}
    </Fragment>
  ))
}

/** Several paragraphs inside one element (list items, quotes) separated by line breaks. */
function renderParagraphs(paragraphs: ParagraphNode[]): ReactNode {
  if (paragraphs.length === 1) return renderInline(paragraphs[0].content)
  return paragraphs.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(p.content)}
    </Fragment>
  ))
}

const paragraphClass = "text-lg leading-[1.75] text-[#3b4556]"

function ArticleBlock({ block }: { block: WithMedia<RichTextBlock> }) {
  switch (block.type) {
    case "paragraph":
      return <p className={paragraphClass}>{renderInline(block.content)}</p>
    case "heading":
      return block.attrs.level === 2 ? (
        <h2 className="mt-7 text-[26px] leading-[1.25] font-black tracking-[-0.005em] text-brand-navy md:text-[30px]">
          {renderInline(block.content)}
        </h2>
      ) : (
        <h3 className="mt-5 text-[22px] leading-[1.3] font-black text-brand-navy md:text-[24px]">
          {renderInline(block.content)}
        </h3>
      )
    case "bulletList":
      return (
        <ul className="flex flex-col gap-3.5">
          {block.content.map((item, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <Image
                src="/images/check.svg"
                alt=""
                width={24}
                height={24}
                className="shrink-0"
              />
              <span className="text-[17px] leading-normal font-medium text-brand-navy">
                {renderParagraphs(item.content)}
              </span>
            </li>
          ))}
        </ul>
      )
    case "orderedList":
      return (
        <ol
          start={block.attrs?.start}
          className="flex list-decimal flex-col gap-3.5 pl-6 text-[17px] leading-normal font-medium text-brand-navy"
        >
          {block.content.map((item, i) => (
            <li key={i}>{renderParagraphs(item.content)}</li>
          ))}
        </ol>
      )
    case "blockquote":
      return (
        <figure className="flex flex-col gap-3 rounded-[20px] border-l-5 border-brand-green bg-brand-mint px-7 py-8 font-bold md:px-9">
          <blockquote className="text-xl leading-normal text-brand-navy md:text-[22px]">
            “{renderParagraphs(block.content)}”
          </blockquote>
          {block.attrs?.cite && (
            <figcaption className="text-sm leading-[normal] text-brand-green-dark">
              {block.attrs.cite}
            </figcaption>
          )}
        </figure>
      )
    case "image":
      return (
        <div className="relative h-64 overflow-hidden rounded-3xl md:h-[400px]">
          <Image
            src={block.attrs.media.url}
            alt={block.attrs.alt}
            fill
            sizes="(min-width: 1280px) 776px, 100vw"
            className="object-cover"
          />
        </div>
      )
  }
}

/** Article body blocks (also the legal pages), as siblings in the article column. */
export function ArticleBlocks({ doc }: { doc: WithMedia<RichTextDoc> }) {
  return doc.content.map((block, i) => <ArticleBlock key={i} block={block} />)
}
```


- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/interpolate.test.ts tests/unit/post-dates.test.ts tests/unit/rich-text tests/unit/format.test.ts`
Expected: PASS (the renderer reproduces the legacy markup byte-for-byte; Phase 2's format tests still pass).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/interpolate.ts lib/format.ts lib/rich-text tests/unit/interpolate.test.ts tests/unit/post-dates.test.ts tests/unit/rich-text
git commit -m "feat: add placeholder interpolation, post dates and TipTap renderer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Props-driven components, templates and pages; delete `data.ts` (master Task 3.5, part 2 + page wiring from 3.6)

**Files:**
- Modify (props instead of `data.ts`; markup unchanged): `components/home/{site-header,site-footer,hero,about,services,clients-team-blog,contact,contact-form,page-hero,icon-cards}.tsx`, `components/about/stats.tsx`, `components/services/{why-choose-us,service-body,other-services}.tsx`, `components/contact/departments.tsx`, `components/blog/{blog-card,blog-posts,article,share-links}.tsx`
- Delete: `components/home/data.ts`, `components/about/data.ts`, `components/services/data.ts`, `components/team/data.ts`
- Create: `components/site-locale.tsx`
- Create: `templates/shared/{sources,views,page-meta}.ts`, `templates/{home,about,services,team,blog,contact}/{view.ts,render.tsx}`
- Create: `server/db/seed/fixtures/sources.ts`, `server/modules/pages/sources.ts` (interim: fixture-backed)
- Modify: `app/(site)/layout.tsx`, `app/(site)/page.tsx`, `app/(site)/{about,services,team,blog,contact}/page.tsx`, `app/(site)/services/[slug]/page.tsx`, `app/(site)/blog/[slug]/page.tsx`
- Test: `tests/unit/templates/views.test.ts`, `tests/unit/no-data-modules.test.ts`

**Interfaces:**
- Consumes: Tasks 1–7 (record types from the queries, `WithMedia`, `replaceMediaRefs`, `interpolate`, `interpolateParts`, `contactPlaceholders`, `formatPostDate`, `isoDate`, `renderInline`, `ArticleBlocks`, `contentFixtures`, `fixtureMediaLookup`, `fixtureMediaKey`, `PUBLIC_SETTINGS_KEYS`, `PAGE_KEYS`).
- Produces:

```ts
// templates/shared/sources.ts
export type SiteSources = {
  settings: { [K in PublicSettingsKey]: WithMedia<SettingsValue<K>> }
  pages: { [K in PageKey]: { data: WithMedia<PageData<K>>; seo: WithMedia<Seo> } }
  services: WithMedia<ServiceRecord>[]; articles: WithMedia<ArticleRecord>[]; categories: CategoryRecord[]
  team: WithMedia<TeamMemberRecord>[]; clients: WithMedia<ClientRecord>[]; groupCompanies: WithMedia<GroupCompanyRecord>[]
}
export type SiteArticle; export type SiteService
// templates/shared/views.ts — shared builders (pure)
export type ChromeView = { header: SiteHeaderProps; footer: SiteFooterProps; locale: string }
export function placeholders(s), chromeView(s), pageHeroView(s, hero, extra?), enquireBannerView(s), clientsView(s),
  aboutSectionView(s), contactSectionView(s), locationMapView(s), teamView(s, heading), serviceCard(service),
  serviceCardLabels(s), articleDates(article), blogCard(article), authorOf(article), featuredArticle(s), listedArticles(s)
// templates/<name>/view.ts — one builder per page (pure, unit-tested)
export function homeView(s): HomeView; aboutView(s): AboutView; servicesView(s): ServicesView
export function serviceDetailView(s, slug): ServiceDetailView | null; teamView(s): TeamView
export function blogView(s): BlogView; articleView(s, slug): ArticleView | null; contactView(s): ContactView
// templates/<name>/render.tsx — compose the existing components (section order = design)
export function HomeTemplate, AboutTemplate, ServicesTemplate, ServiceDetailTemplate, TeamTemplate, BlogTemplate, ArticleTemplate, ContactTemplate
// templates/shared/page-meta.ts
export function pageMetadata(s, key: PageKey): Metadata; serviceMetadata(s, slug): Metadata; articleMetadata(s, slug): Metadata
// server/modules/pages/sources.ts
export async function loadSiteSources(): Promise<SiteSources>   // Task 8: fixtures; Task 9: cached queries
// server/db/seed/fixtures/sources.ts
export function fixtureSiteSources(): SiteSources                // also the expected value in Task 9's DB test
// components/site-locale.tsx
export function SiteLocale({ lang }: { lang: string }): null      // sets <html lang> after hydration
```

How the pieces fit: a page is `<Suspense fallback={null}>` → async component → `await connection()` → `loadSiteSources()` → `<XTemplate view={xView(sources)} />`. `generateMetadata` does the same (`await connection()` first). The build therefore prerenders an empty shell plus the site layout and never reads data; content streams per request. In this task `loadSiteSources()` returns the seed fixtures, so the visual gate proves the props refactor on its own; Task 9 switches it to the database.

Every component keeps its markup and class names; only literals become props. Pay attention to text-node parity (header section of this plan): ``{`${label} `}{value}``, `interpolateParts()` for template labels (hero and banner secondary CTAs, empty-category message), and `{office}{` ${extension}`}` in the service help box. `GSAP` hooks (`data-*` attributes) are untouched; `data-count` is omitted when a stat has no count, as before. `PostMeta`'s boolean `featured` becomes `featuredLabel` (the badge text).

- [ ] **Step 1: Write the failing tests**

`tests/unit/templates/views.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { aboutView } from "@/templates/about/view"
import { articleView, blogView } from "@/templates/blog/view"
import { contactView } from "@/templates/contact/view"
import { homeView } from "@/templates/home/view"
import { serviceDetailView, servicesView } from "@/templates/services/view"
import {
  articleMetadata,
  pageMetadata,
  serviceMetadata,
} from "@/templates/shared/page-meta"
import { teamView } from "@/templates/team/view"

const s = fixtureSiteSources()

describe("view builders reproduce the static site's data (fixture sources)", () => {
  it("chrome: header, footer, locale", () => {
    const { chrome } = homeView(s)
    expect(chrome.locale).toBe("en")
    expect(chrome.header.topBar).toEqual({
      phone24hLabel: "24 Hour Number:",
      phone24h: "(085) 8018746",
      phone24hHref: "tel:+353858018746",
      email: "info@securitypartnersltd.com",
      hoursLabel: "Office hours:",
      hours: "Monday–Friday, 9am to 6pm",
    })
    expect(chrome.header.links.map((l) => l.href)).toEqual([
      "/about",
      "/services",
      "/team",
      "/blog",
      "/contact",
    ])
    expect(chrome.footer.contact.officeHref).toBe("tel:+353578697670")
    expect(chrome.footer.group.companies.map((c) => c.logo)).toEqual([
      "/images/group-mjs-eco.png",
      "/images/group-cleaning-partners.png",
    ])
    expect(chrome.footer.legal).toEqual({
      privacy: { label: "Privacy Policy", href: "/privacy" },
      terms: { label: "Terms", href: "/terms" },
    })
  })

  it("home: hero CTA parts, every service, 3 newest non-featured posts", () => {
    const view = homeView(s)
    expect(view.hero.secondaryCta).toEqual({
      label: ["Call 24/7: ", "(085) 8018746"],
      href: "tel:+353858018746",
    })
    expect(view.hero.backgroundImage).toBe("/images/hero.jpg")
    expect(view.services.services).toHaveLength(6)
    expect(view.blog.posts.map((p) => p.slug)).toEqual([
      "mobile-patrols-protect-your-business-after-hours",
      "planning-security-for-your-next-event",
      "inside-our-24-7-operations-team",
    ])
    expect(view.blog.posts[0]).toMatchObject({
      date: "2026-09-12",
      displayDate: "12 Sep 2026",
      category: "Mobile Patrols",
      cover: "/images/hero.jpg",
    })
    expect(view.enquireBanner.secondaryCta).toEqual({
      label: ["Call ", "057 8697670"],
      href: "tel:+353578697670",
    })
    expect(view.team.photoPlaceholder).toBe("/images/team-temp.jpg")
    expect(view.map.href).toBe(s.settings.contact.mapsHref)
  })

  it("contact section and departments interpolate contact values", () => {
    const view = contactView(s)
    expect(view.hero.description).toBe(
      "Get in touch with our team. For urgent matters, our 24 Hour Number is (085) 8018746."
    )
    expect(view.hero.wideDescription).toBe(true)
    expect(view.contact.infoItems[1].lines).toEqual([
      { text: "(085) 8018746", href: "tel:+353858018746" },
    ])
    expect(view.contact.infoItems[2].lines).toEqual([
      { text: "Derryguile, Mountmellick" },
      { text: "Co. Laois, R32 YX49" },
    ])
    expect(view.contact.infoItems[3].lines).toEqual([
      { text: "Tel: 057 8697670 Ext 2", href: "tel:+353578697670" },
      { text: "or 085 859 1299", href: "tel:+353858591299" },
      {
        text: "operations@securitypartnersltd.com",
        href: "mailto:operations@securitypartnersltd.com",
      },
    ])
    expect(view.departments.items[2].lines[0]).toEqual({
      text: "Tel: (057) 8697670 Ext 3",
      href: "tel:+353578697670",
    })
    expect(view.contact.form.mailto).toEqual({
      email: "info@securitypartnersltd.com",
      subject: "Website enquiry from {name}",
    })
  })

  it("about, services and team pages", () => {
    expect(aboutView(s).values.items.map((i) => i.icon)).toEqual([
      "/images/icon-shield.svg",
      "/images/icon-clock.svg",
      "/images/icon-users.svg",
    ])
    expect(servicesView(s).services.title).toBe("Security For Every Sector")
    expect(teamView(s).officers.className).toBe("bg-brand-surface")
    expect(teamView(s).team.title).toBe("Leadership & Management")
  })

  it("service detail: breadcrumb trail and the next three services, wrapping", () => {
    const view = serviceDetailView(s, "commercial-retail-security")!
    expect(view.hero.trail).toEqual([{ label: "Services", href: "/services" }])
    expect(view.hero.image).toBe("/images/hero.jpg")
    expect(view.others.services.map((x) => x.slug)).toEqual([
      "event-security",
      "alarm-responses",
      "mobile-patrols-key-holding",
    ])
    expect(view.body.operations).toEqual({
      office: "057 8697670",
      officeHref: "tel:+353578697670",
      extension: "Ext 2",
      mobile: "085 859 1299",
      mobileHref: "tel:+353858591299",
      email: "operations@securitypartnersltd.com",
    })
    expect(serviceDetailView(s, "no-such-service")).toBeNull()
  })

  it("blog: featured separate, five filters, page size 6", () => {
    const view = blogView(s)
    expect(view.posts.featured).toMatchObject({
      slug: "18-years-of-watching-over-ireland",
      displayDate: "20 Sep 2026",
      author: { name: "Michael McDonald", role: "Managing Director" },
    })
    expect(view.posts.posts).toHaveLength(6)
    expect(view.posts.filters).toEqual([
      "Company News",
      "Mobile Patrols",
      "Event Security",
      "Retail Security",
      "Alarm Response",
    ])
    expect(view.posts.pageSize).toBe(6)
  })

  it("article: header fallbacks, related/recent exclude the featured article", () => {
    const patrols = articleView(
      s,
      "mobile-patrols-protect-your-business-after-hours"
    )!
    expect(patrols.header.article).toMatchObject({
      readTime: "5 min read",
      lead: "What a scheduled patrol actually covers, and why a visible security presence deters break-ins.",
    })
    expect(patrols.body.tags).toEqual([
      "Mobile Patrols",
      "Key Holding",
      "Business Security",
    ])
    expect(patrols.related.posts.map((p) => p.slug)).toEqual([
      "planning-security-for-your-next-event",
      "inside-our-24-7-operations-team",
      "key-holding-explained",
    ])

    const featured = articleView(s, "18-years-of-watching-over-ireland")!
    expect(featured.header.article.readTime).toBeNull()
    expect(featured.header.article.lead).toBe(s.articles[0].content.excerpt)
    expect(featured.body.body).toBeNull()
    expect(featured.body.tags).toEqual(["Company News"])
    expect(featured.related.posts.map((p) => p.slug)).toEqual([
      "inside-our-24-7-operations-team",
      "mobile-patrols-protect-your-business-after-hours",
      "planning-security-for-your-next-event",
    ])
    expect(featured.body.recent.map((p) => p.slug)).toEqual([
      "mobile-patrols-protect-your-business-after-hours",
      "planning-security-for-your-next-event",
      "inside-our-24-7-operations-team",
    ])
    expect(featured.body.categories).toEqual([
      { name: "Company News", count: 2 },
      { name: "Mobile Patrols", count: 1 },
      { name: "Event Security", count: 1 },
      { name: "Retail Security", count: 1 },
      { name: "Alarm Response", count: 0 },
    ])
    expect(articleView(s, "no-such-article")).toBeNull()
  })

  it("metadata matches the static site's titles and descriptions", () => {
    expect(pageMetadata(s, "home")).toEqual({
      title: "Security Partners Ltd. | Watching Over You",
      description:
        "Proactive, flexible and customer-focused security services across Ireland, backed by a dedicated 24/7 operations team. Based in Mountmellick, Co. Laois since 2008.",
    })
    expect(pageMetadata(s, "about").title).toBe(
      "About Us | Security Partners Ltd."
    )
    expect(pageMetadata(s, "contact").description).toBe(
      "Get in touch with our team. For urgent matters, our 24 Hour Number is (085) 8018746."
    )
    expect(serviceMetadata(s, "alarm-responses")).toEqual({
      title: "Alarm Responses | Security Partners Ltd.",
      description:
        "Our highly trained security team will be dispatched to your premises and deal with the situation, day or night.",
    })
    expect(articleMetadata(s, "key-holding-explained")).toEqual({
      title:
        "Key Holding Explained: Who Responds When Your Alarm Goes Off | Security Partners Ltd.",
      description:
        "What happens after an alarm activation, and why a key holder saves you a call-out.",
    })
    expect(serviceMetadata(s, "nope")).toEqual({})
  })
})
```


`tests/unit/no-data-modules.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

describe("public content comes from the database (master Task 3.5)", () => {
  it("components/*/data.ts are gone", () => {
    for (const dir of ["home", "about", "services", "team"])
      expect(existsSync(`components/${dir}/data.ts`), dir).toBe(false)
  })

  it("nothing in app/ or components/ imports a data module", () => {
    const offenders = [...walk("app"), ...walk("components")].filter((file) =>
      /from "[^"]*\/data"/.test(readFileSync(file, "utf8"))
    )
    expect(offenders).toEqual([])
  })
})
```


- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/templates/views.test.ts tests/unit/no-data-modules.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/db/seed/fixtures/sources"`; `components/*/data.ts are gone` fails (`expected true to be false`) and lists the pages/components importing `@/components/home/data`.

- [ ] **Step 3: Props-driven components**

Replace each file with the full content below. Diff each against its previous version before moving on: only literals → props, `data.ts` imports removed, prop types added.

`components/home/site-header.tsx`:

```tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon, XIcon } from "lucide-react"

import { buttonClassName } from "@/components/ui/button"
import { Container } from "@/components/home/section"
import { cn } from "@/lib/utils"

type NavLink = { label: string; href: string }

// Label and value stay separate text nodes ("24 Hour Number: " + number),
// as on the static site: Chrome positions glyphs per text node.
export type SiteHeaderProps = {
  topBar: {
    phone24hLabel: string
    phone24h: string
    phone24hHref: string
    email: string
    hoursLabel: string
    hours: string
  }
  logo: { src: string; alt: string }
  links: NavLink[]
  cta: NavLink
  aria: {
    mainNav: string
    openMenu: string
    closeMenu: string
    mobileNav: string
  }
}

export function SiteHeader({
  topBar,
  logo,
  links,
  cta,
  aria,
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <div className="bg-brand-navy px-6 py-2.5 text-[13px] md:px-10">
        <Container className="flex flex-wrap items-center justify-between gap-x-7 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-1">
            <a href={topBar.phone24hHref} className="font-medium text-white">
              {`${topBar.phone24hLabel} `}
              {topBar.phone24h}
            </a>
            <a
              href={`mailto:${topBar.email}`}
              className="text-white/75 hover:text-white"
            >
              {topBar.email}
            </a>
          </div>
          <p className="hidden text-white/75 md:block">
            {`${topBar.hoursLabel} `}
            {topBar.hours}
          </p>
        </Container>
      </div>

      <header className="sticky top-0 z-50 bg-white px-6 py-3.5 shadow-[0px_4px_20px_0px_rgba(13,26,51,0.08)] md:px-10">
        <div
          aria-hidden
          data-scroll-progress
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-brand-green"
        />
        <Container className="flex items-center justify-between gap-6">
          <Link
            href={pathname === "/" ? "#top" : "/"}
            className="relative h-[68px] w-[112px] shrink-0"
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              fill
              sizes="112px"
              className="object-contain"
              priority
            />
          </Link>

          <nav
            aria-label={aria.mainNav}
            className="hidden items-center gap-9 text-base font-bold text-brand-navy lg:flex"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "transition-colors hover:text-brand-green",
                  isActive(link.href) && "text-brand-green"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={cta.href}
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "max-sm:px-5 max-sm:py-3 max-sm:text-sm"
              )}
            >
              {cta.label}
            </Link>
            <button
              type="button"
              aria-label={open ? aria.closeMenu : aria.openMenu}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-11 items-center justify-center rounded-full text-brand-navy hover:bg-brand-surface lg:hidden"
            >
              {open ? (
                <XIcon className="size-6" />
              ) : (
                <MenuIcon className="size-6" />
              )}
            </button>
          </div>
        </Container>

        {open && (
          <nav
            id="mobile-nav"
            aria-label={aria.mobileNav}
            className="border-t border-brand-line pt-2 lg:hidden"
          >
            <Container className="flex flex-col py-2 text-base font-bold text-brand-navy">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-2 py-3 hover:bg-brand-surface",
                    isActive(link.href) && "text-brand-green"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </Container>
          </nav>
        )}
      </header>
    </>
  )
}
```


`components/home/site-footer.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"

import { Container } from "@/components/home/section"

const headingClass = "text-base font-black tracking-[0.04em] text-brand-green"
const linkClass = "text-[15px] leading-normal text-white/80 hover:text-white"

type FooterLink = { label: string; href: string }

export type SiteFooterProps = {
  logo: { src: string; alt: string }
  tagline: string
  quickLinks: { heading: string; ariaLabel: string; links: FooterLink[] }
  contact: {
    heading: string
    addressLine1: string
    addressLine2: string
    telLabel: string
    office: string
    officeHref: string
    phone24hLabel: string
    phone24h: string
    phone24hHref: string
    email: string
  }
  group: {
    heading: string
    telLabel: string
    companies: { name: string; phone: string; site: string; logo: string }[]
  }
  copyright: string
  legal: { privacy: FooterLink; terms: FooterLink }
}

export function SiteFooter({
  logo,
  tagline,
  quickLinks,
  contact,
  group,
  copyright,
  legal,
}: SiteFooterProps) {
  return (
    <footer className="bg-brand-navy px-6 pt-20 pb-8 md:px-10">
      <Container className="flex flex-col gap-12">
        <div
          data-stagger
          className="grid gap-12 md:grid-cols-2 xl:flex xl:gap-14"
        >
          <div className="flex flex-col items-start gap-5 xl:w-[340px] xl:shrink-0">
            <div className="rounded-[14px] bg-white px-4 py-2.5">
              <div className="relative h-[66px] w-[110px]">
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  fill
                  sizes="110px"
                  className="object-contain"
                />
              </div>
            </div>
            <p className="text-[15px] leading-[1.65] text-white/70">
              {tagline}
            </p>
          </div>

          <nav
            aria-label={quickLinks.ariaLabel}
            className="flex flex-1 flex-col gap-3.5"
          >
            <p className={headingClass}>{quickLinks.heading}</p>
            {quickLinks.links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </nav>

          <address className="flex flex-1 flex-col gap-3.5 not-italic">
            <p className={headingClass}>{contact.heading}</p>
            <p className={linkClass}>{contact.addressLine1}</p>
            <p className={linkClass}>{contact.addressLine2}</p>
            <a href={contact.officeHref} className={linkClass}>
              {`${contact.telLabel} `}
              {contact.office}
            </a>
            <a href={contact.phone24hHref} className={linkClass}>
              {`${contact.phone24hLabel} `}
              {contact.phone24h}
            </a>
            <a href={`mailto:${contact.email}`} className={linkClass}>
              {contact.email}
            </a>
          </address>

          <div className="flex flex-col gap-4 xl:w-[300px] xl:shrink-0">
            <p className={headingClass}>{group.heading}</p>
            {group.companies.map((company) => (
              <a
                key={company.name}
                href={`https://${company.site}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 rounded-2xl bg-white/6 px-4 py-3.5 transition-colors hover:bg-white/10"
              >
                <div className="flex h-14 w-[72px] shrink-0 items-center justify-center rounded-[10px] bg-white p-1.5">
                  <div className="relative h-11 w-[60px]">
                    <Image
                      src={company.logo}
                      alt=""
                      fill
                      sizes="60px"
                      className="object-contain"
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[15px] font-bold text-white">
                    {company.name}
                  </p>
                  <p className="text-[13px] text-white/70">
                    {`${group.telLabel} `}
                    {company.phone}
                  </p>
                  <p className="text-[13px] text-white/70">{company.site}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/12" />

        <div className="flex flex-col justify-between gap-3 text-sm text-white/60 sm:flex-row">
          <p>{copyright}</p>
          <p className="whitespace-pre">
            <a href={legal.privacy.href} className="hover:text-white">
              {legal.privacy.label}
            </a>
            {"   ·   "}
            <a href={legal.terms.href} className="hover:text-white">
              {legal.terms.label}
            </a>
          </p>
        </div>
      </Container>
    </footer>
  )
}
```


`components/home/hero.tsx`:

```tsx
import Image from "next/image"

import { buttonClassName } from "@/components/ui/button"
import { Container } from "@/components/home/section"

type HeroLink = { label: string; href: string }

export type HeroProps = {
  eyebrow: string
  heading: string
  tagline: string
  subheading: string
  backgroundImage: string
  primaryCta: HeroLink
  /** Label as text parts (lib/interpolate interpolateParts). */
  secondaryCta: { label: string[]; href: string }
  stats: { value: string; label: string; count?: number; suffix?: string }[]
}

export function Hero({
  eyebrow,
  heading,
  tagline,
  subheading,
  backgroundImage,
  primaryCta,
  secondaryCta,
  stats,
}: HeroProps) {
  return (
    <section
      id="top"
      data-hero
      className="relative flex min-h-[640px] items-center overflow-hidden px-6 py-20 md:px-10 lg:h-[720px] lg:py-0"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div data-hero-media className="absolute inset-0 will-change-transform">
          <Image
            src={backgroundImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-r from-[rgba(13,27,54,0.92)] via-[rgba(13,27,54,0.6)] via-55% to-[rgba(13,27,54,0.1)] max-lg:to-[rgba(13,27,54,0.6)]" />
      </div>

      <Container className="relative">
        <div
          data-hero-content
          className="flex max-w-[640px] flex-col items-start gap-6"
        >
          <div
            data-hero-item
            className="flex items-center gap-2 rounded-full border border-brand-green/60 bg-brand-green/18 px-4 py-2"
          >
            <Image src="/images/ellipse.svg" alt="" width={8} height={8} />
            <p className="text-[13px] font-bold tracking-[0.04em] whitespace-pre text-white">
              {eyebrow}
            </p>
          </div>

          <h1
            data-hero-title
            className="text-5xl leading-[1.05] font-black tracking-[-0.01em] text-white md:text-[68px] md:whitespace-nowrap"
          >
            {heading}
          </h1>
          <p
            data-hero-item
            className="text-2xl font-bold text-brand-green md:text-[28px]"
          >
            {tagline}
          </p>
          <p
            data-hero-item
            className="text-lg leading-[1.55] text-white/85 md:text-[19px]"
          >
            {subheading}
          </p>

          <div data-hero-item className="flex flex-wrap gap-4 pt-3">
            <a
              href={primaryCta.href}
              className={buttonClassName({ variant: "brand", size: "pill" })}
            >
              {primaryCta.label}
            </a>
            <a
              href={secondaryCta.href}
              className={buttonClassName({
                variant: "brand-outline",
                size: "pill",
              })}
            >
              {secondaryCta.label}
            </a>
          </div>

          <dl className="flex flex-wrap gap-x-10 gap-y-6 pt-7">
            {stats.map((stat) => (
              <div
                key={stat.value}
                data-hero-item
                className="flex flex-col-reverse gap-1"
              >
                <dt className="text-sm text-white/70">{stat.label}</dt>
                <dd
                  data-count={stat.count}
                  data-suffix={stat.suffix}
                  className="text-[26px] font-black text-white tabular-nums"
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  )
}
```


`components/home/about.tsx`:

```tsx
import Image from "next/image"

import { Container, Eyebrow } from "@/components/home/section"
import { renderInline } from "@/lib/rich-text/render"
import type { ParagraphsDoc } from "@/lib/schemas/common"

export type AboutProps = {
  eyebrow: string
  heading: string
  body: ParagraphsDoc
  image: { src: string; alt: string }
  badge: { value: string; label: string; caption: string }
  highlights: string[]
}

export function About({
  eyebrow,
  heading,
  body,
  image,
  badge,
  highlights,
}: AboutProps) {
  return (
    <section
      id="about"
      data-about
      className="scroll-mt-28 bg-brand-surface px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-12 lg:flex-row lg:items-stretch">
        <div
          data-about-card
          className="flex flex-1 flex-col gap-[22px] rounded-[28px] bg-brand-blue p-8 md:p-14"
        >
          <div data-about-copy className="flex flex-col gap-3.5">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="text-4xl leading-[1.15] font-black tracking-[-0.01em] text-white md:text-[44px]">
              {heading}
            </h2>
          </div>
          {body.content.map((paragraph, i) => (
            <p
              key={i}
              data-about-copy
              className="text-[17px] leading-[1.65] text-white/88"
            >
              {renderInline(paragraph.content)}
            </p>
          ))}
          <ul className="flex flex-col gap-3.5 pt-2.5">
            {highlights.map((item) => (
              <li
                key={item}
                data-highlight
                className="flex items-center gap-3.5"
              >
                <Image
                  src="/images/check.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="shrink-0"
                />
                <span className="text-base leading-normal font-medium text-white">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div
          data-about-media
          className="relative flex min-h-[420px] shrink-0 flex-col justify-end overflow-hidden rounded-[28px] pb-6 pl-6 lg:w-[480px]"
        >
          <div
            data-parallax
            className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover"
            />
          </div>
          <div
            data-about-badge
            className="relative flex w-fit items-center gap-3.5 rounded-[18px] bg-white px-5 py-4 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.15)]"
          >
            <p className="text-[30px] font-black text-brand-blue">
              {badge.value}
            </p>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-brand-navy">{badge.label}</p>
              <p className="text-[13px] text-brand-ink">{badge.caption}</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
```


`components/home/services.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { Container, Eyebrow, SectionHeading } from "@/components/home/section"
import { interpolate } from "@/lib/interpolate"

export type ServiceCardData = {
  slug: string
  title: string
  description: string
  icon: string
}

/** "Read More" and the aria-label template "Read more about {title}". */
export type ServiceCardLabels = { readMore: string; ariaReadMore: string }

export type ServicesProps = {
  eyebrow: string
  title: string
  description: string
  services: ServiceCardData[]
  labels: ServiceCardLabels
}

export function Services({
  eyebrow,
  title,
  description,
  services,
  labels,
}: ServicesProps) {
  return (
    <section
      id="services"
      className="scroll-mt-28 bg-white px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
        />

        <ul
          data-stagger
          className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} labels={labels} />
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function ServiceCard({
  service,
  labels,
}: {
  service: ServiceCardData
  labels: ServiceCardLabels
}) {
  return (
    <li className="flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-8 py-9 shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)]">
      <div
        data-service-icon
        className="flex size-[88px] items-center justify-center overflow-hidden rounded-[20px] bg-brand-mint"
      >
        <div className="relative size-[120px] shrink-0">
          <Image
            src={service.icon}
            alt=""
            fill
            sizes="120px"
            className="object-contain"
          />
        </div>
      </div>
      <h3 className="text-[22px] leading-[normal] font-black text-brand-navy">
        {service.title}
      </h3>
      <p className="text-base leading-[1.6] text-brand-ink">
        {service.description}
      </p>
      <Link
        href={`/services/${service.slug}`}
        className="flex items-center gap-2 text-[15px] leading-[normal] font-bold text-brand-blue hover:underline"
        aria-label={interpolate(labels.ariaReadMore, { title: service.title })}
      >
        {`${labels.readMore} `}
        <span aria-hidden>→</span>
      </Link>
    </li>
  )
}

type BannerLink = { label: string; href: string }

export type EnquireBannerProps = {
  image: string
  eyebrow: string
  heading: string
  copy: string
  cta: BannerLink
  /** Label as text parts (lib/interpolate interpolateParts). */
  secondaryCta: { label: string[]; href: string }
}

export function EnquireBanner({
  image,
  eyebrow,
  heading,
  copy,
  cta,
  secondaryCta,
}: EnquireBannerProps) {
  return (
    <section className="bg-white px-6 py-20 md:px-10 lg:py-28">
      <Container>
        <div
          data-banner
          className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[32px] px-6 py-16 text-center md:p-20"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              data-parallax
              className="absolute inset-x-0 -top-[15%] h-[130%] will-change-transform"
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="(min-width: 1280px) 1200px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-linear-to-r from-brand-blue/95 to-brand-blue-deep/85" />
          </div>
          <Eyebrow data-banner-item className="relative">
            {eyebrow}
          </Eyebrow>
          <h2
            data-banner-item
            className="relative text-4xl font-black tracking-[-0.01em] text-white md:text-5xl"
          >
            {heading}
          </h2>
          <p
            data-banner-item
            className="relative max-w-[620px] text-lg leading-[1.6] text-white/85"
          >
            {copy}
          </p>
          <div
            data-banner-item
            className="relative flex flex-wrap justify-center gap-4 pt-2"
          >
            <Link
              href={cta.href}
              className={buttonClassName({ variant: "brand", size: "pill" })}
            >
              {cta.label}
            </Link>
            <a
              href={secondaryCta.href}
              className={buttonClassName({
                variant: "brand-outline",
                size: "pill",
              })}
            >
              {secondaryCta.label}
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
```


`components/home/clients-team-blog.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { Container, SectionHeading } from "@/components/home/section"
import { BlogCard, type BlogCardPost } from "@/components/blog/blog-card"

export type ClientsProps = {
  eyebrow: string
  heading: string
  clients: { name: string; logo: string }[]
}

export function Clients({ eyebrow, heading, clients }: ClientsProps) {
  return (
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-24">
      <Container className="flex flex-col gap-14">
        <SectionHeading eyebrow={eyebrow} title={heading} />
        <ul data-stagger className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {clients.map((client) => (
            <li
              key={client.name}
              className="flex h-[120px] items-center justify-center rounded-[20px] border border-brand-line bg-white px-7 py-5"
            >
              <div className="relative h-[76px] w-[200px] max-w-full">
                <Image
                  src={client.logo}
                  alt={client.name}
                  fill
                  sizes="200px"
                  className="object-contain"
                />
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export type TeamProps = {
  eyebrow: string
  title: string
  description: string
  /** Shown behind each member photo (pages.team.leadership.photoPlaceholder). */
  photoPlaceholder: string
  members: {
    name: string
    role: string
    bio: string
    email: string
    photo: string | null
  }[]
}

export function Team({
  eyebrow,
  title,
  description,
  photoPlaceholder,
  members,
}: TeamProps) {
  return (
    <section
      id="team"
      className="scroll-mt-28 bg-white px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
        <ul data-stagger className="grid gap-6 lg:grid-cols-2">
          {members.map((member) => (
            <li
              key={member.name}
              className="flex flex-col overflow-hidden rounded-3xl bg-brand-blue shadow-[0px_20px_40px_0px_rgba(0,0,0,0.18)] sm:h-[320px] sm:flex-row"
            >
              <div className="relative h-72 shrink-0 overflow-hidden sm:h-full sm:w-[240px]">
                <div
                  data-parallax
                  className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
                >
                  <Image
                    src={photoPlaceholder}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 240px, 100vw"
                    className="object-cover"
                  />
                  {member.photo && (
                    <Image
                      src={member.photo}
                      alt={member.name}
                      fill
                      sizes="(min-width: 640px) 240px, 100vw"
                      className="object-cover"
                    />
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3.5 px-8 pt-8 pb-7">
                <div className="flex flex-col gap-1 pt-1.5">
                  <h3 className="text-[22px] leading-[normal] font-black text-white">
                    {member.name}
                  </h3>
                  <p className="text-sm leading-[normal] font-bold tracking-[0.02em] text-brand-green">
                    {member.role}
                  </p>
                </div>
                <p className="text-[15px] leading-[1.6] text-white/82">
                  {member.bio}
                </p>
                <div className="flex-1" />
                <div className="h-px bg-white/20" />
                <a
                  href={`mailto:${member.email}`}
                  className="text-[13px] leading-[normal] font-medium break-all text-white hover:underline"
                >
                  {member.email}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export type BlogProps = {
  eyebrow: string
  heading: string
  intro: string
  cta: { label: string; href: string }
  posts: BlogCardPost[]
  readArticle: string
}

export function Blog({
  eyebrow,
  heading,
  intro,
  cta,
  posts,
  readArticle,
}: BlogProps) {
  return (
    <section
      id="blog"
      className="scroll-mt-28 bg-brand-surface px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-14">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            align="start"
            eyebrow={eyebrow}
            title={heading}
            description={intro}
            className="max-w-[640px]"
          />
          <Link
            href={cta.href}
            data-reveal
            className={buttonClassName({
              variant: "brand-outline-blue",
              size: "pill-sm",
            })}
          >
            {`${cta.label} `}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <ul data-stagger className="grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <BlogCard post={post} readArticle={readArticle} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
```


`components/home/contact.tsx`:

```tsx
import Image from "next/image"

import {
  ContactForm,
  type ContactFormProps,
} from "@/components/home/contact-form"
import { Container, SectionHeading } from "@/components/home/section"
import { interpolate } from "@/lib/interpolate"

export type ContactProps = {
  eyebrow: string
  heading: string
  intro: string
  infoItems: {
    title: string
    icon: string
    lines: { text: string; href?: string }[]
  }[]
  form: ContactFormProps
}

export function Contact({
  eyebrow,
  heading,
  intro,
  infoItems,
  form,
}: ContactProps) {
  return (
    <section
      id="contact"
      className="scroll-mt-28 bg-white px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-8 lg:flex-row lg:items-stretch">
        <div
          data-reveal
          className="flex flex-1 flex-col gap-5 rounded-[28px] border border-brand-line bg-white p-6 shadow-[0px_16px_40px_0px_rgba(13,26,51,0.08)] md:p-12"
        >
          <SectionHeading
            align="start"
            eyebrow={eyebrow}
            title={heading}
            className="[&_h2]:text-[36px] [&_p:last-child]:text-base"
            description={intro}
          />
          <ContactForm {...form} />
        </div>

        <ul
          data-reveal
          className="flex shrink-0 flex-col gap-7 rounded-[28px] bg-brand-blue px-10 py-12 lg:w-[440px]"
        >
          {infoItems.map((item) => (
            <li key={item.title} className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-green">
                <Image src={item.icon} alt="" width={22} height={22} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-[17px] leading-[normal] font-black text-white">
                  {item.title}
                </p>
                {item.lines.map((line) =>
                  line.href ? (
                    <a
                      key={line.text}
                      href={line.href}
                      className="text-[15px] leading-normal break-words text-white/85 hover:text-white hover:underline"
                    >
                      {line.text}
                    </a>
                  ) : (
                    <p
                      key={line.text}
                      className="text-[15px] leading-normal text-white/85"
                    >
                      {line.text}
                    </p>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export type LocationMapProps = {
  href: string
  ariaLabel: string
  label: string
  logo: string
  /** Tile URL template with {col} (0–8) and {row} (0–1). */
  tiles: string
}

// Static map tiles from the design, laid out on a 9×2 grid of 256px tiles.
const mapTiles = Array.from({ length: 9 }, (_, col) =>
  [0, 1].map((row) => ({ col, row }))
).flat()

export function LocationMap({
  href,
  ariaLabel,
  label,
  logo,
  tiles,
}: LocationMapProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      data-map
      className="relative block h-[480px] overflow-hidden bg-brand-map"
    >
      <div className="absolute top-[calc(50%+5px)] left-[calc(50%+8.5px)] h-[512px] w-[2304px] -translate-x-1/2 -translate-y-1/2">
        <div
          data-map-tiles
          className="relative size-full will-change-transform"
        >
          {mapTiles.map(({ col, row }) => (
            <Image
              key={`${col}-${row}`}
              src={interpolate(tiles, { col, row })}
              alt=""
              width={256}
              height={256}
              className="absolute size-64 max-w-none"
              style={{ left: col * 256, top: row * 256 }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 bg-brand-blue/6" />
      <div className="absolute top-[calc(50%-17px)] left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
        <div
          data-map-label
          className="flex items-center gap-2.5 rounded-full bg-white py-2 pr-4 pl-2 shadow-[0px_6px_18px_0px_rgba(0,0,0,0.18)]"
        >
          <div className="relative size-9 overflow-hidden rounded-full border border-brand-green/25 bg-white">
            <div className="absolute top-px left-px size-8">
              <Image
                src={logo}
                alt=""
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
          </div>
          <p className="text-base font-black whitespace-nowrap text-brand-navy">
            {label}
          </p>
        </div>
        <Image
          data-map-pin
          src="/images/map-pin.svg"
          alt=""
          width={120}
          height={96}
        />
      </div>
    </a>
  )
}
```


`components/home/contact-form.tsx`:

```tsx
"use client"

import { buttonClassName } from "@/components/ui/button"
import { interpolate } from "@/lib/interpolate"
import { cn } from "@/lib/utils"

const inputClass =
  "w-full rounded-xl border border-brand-line bg-brand-surface px-[18px] text-[15px] text-brand-navy outline-none placeholder:text-brand-placeholder focus-visible:border-brand-blue focus-visible:ring-3 focus-visible:ring-brand-blue/20"

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm leading-[normal] font-bold text-brand-navy"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

export type ContactFormProps = {
  labels: {
    nameLabel: string
    namePlaceholder: string
    emailLabel: string
    emailPlaceholder: string
    phoneLabel: string
    phonePlaceholder: string
    messageLabel: string
    messagePlaceholder: string
    submitLabel: string
  }
  /** Until Phase 7 the enquiry opens the visitor's mail client. */
  mailto: { email: string; subject: string }
}

export function ContactForm({ labels, mailto }: ContactFormProps) {
  // No backend yet: hand the enquiry to the visitor's mail client.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get("name") ?? "")
    const body = [
      `Name: ${name}`,
      `Email: ${data.get("email") ?? ""}`,
      `Phone: ${data.get("phone") ?? ""}`,
      "",
      String(data.get("message") ?? ""),
    ].join("\n")
    const subject = interpolate(mailto.subject, { name })
    window.location.href = `mailto:${mailto.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Field label={labels.nameLabel} htmlFor="name" className="flex-1">
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            placeholder={labels.namePlaceholder}
            className={cn(inputClass, "h-[54px]")}
          />
        </Field>
        <Field label={labels.emailLabel} htmlFor="email" className="flex-1">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={labels.emailPlaceholder}
            className={cn(inputClass, "h-[54px]")}
          />
        </Field>
      </div>
      <Field label={labels.phoneLabel} htmlFor="phone">
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder={labels.phonePlaceholder}
          className={cn(inputClass, "h-[54px]")}
        />
      </Field>
      <Field label={labels.messageLabel} htmlFor="message">
        <textarea
          id="message"
          name="message"
          required
          placeholder={labels.messagePlaceholder}
          className={cn(inputClass, "h-[130px] resize-y pt-4")}
        />
      </Field>
      <button
        type="submit"
        className={buttonClassName(
          { variant: "brand", size: "pill" },
          "w-full"
        )}
      >
        {labels.submitLabel}
      </button>
    </form>
  )
}
```


`components/home/page-hero.tsx`:

```tsx
import { Fragment } from "react"
import Image from "next/image"
import Link from "next/link"

import { Container } from "@/components/home/section"
import { cn } from "@/lib/utils"

export type PageHeroProps = {
  image: string
  trail?: { label: string; href: string }[]
  crumb: string
  title: string
  description: string
  wideDescription?: boolean
  /** Breadcrumb "Home" label and the nav's aria-label (settings.microcopy). */
  homeLabel: string
  ariaLabel: string
}

export function PageHero({
  image,
  trail = [],
  crumb,
  title,
  description,
  wideDescription,
  homeLabel,
  ariaLabel,
}: PageHeroProps) {
  return (
    <section
      data-hero
      className="relative overflow-hidden px-6 pt-20 pb-24 md:px-10 lg:pt-28 lg:pb-30"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div data-hero-media className="absolute inset-0 will-change-transform">
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-r from-[rgba(13,27,54,0.92)] via-[rgba(13,27,54,0.6)] via-55% to-[rgba(13,27,54,0.1)] max-lg:to-[rgba(13,27,54,0.6)]" />
      </div>

      <Container className="relative">
        <div data-hero-content className="flex flex-col items-start gap-[22px]">
          <nav data-hero-item aria-label={ariaLabel}>
            <ol className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] leading-[normal] font-bold">
              <li>
                <Link href="/" className="text-white/85 hover:text-white">
                  {homeLabel}
                </Link>
              </li>
              {trail.map((item) => (
                <Fragment key={item.href}>
                  <li aria-hidden className="text-white/50">
                    /
                  </li>
                  <li>
                    <Link
                      href={item.href}
                      className="text-white/85 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                </Fragment>
              ))}
              <li aria-hidden className="text-white/50">
                /
              </li>
              <li aria-current="page" className="text-brand-green">
                {crumb}
              </li>
            </ol>
          </nav>

          <h1
            data-hero-title
            className="max-w-[820px] text-5xl leading-[1.1] font-black tracking-[-0.01em] text-white md:text-[64px]"
          >
            {title}
          </h1>
          <p
            data-hero-item
            className={cn(
              "text-lg leading-[1.6] text-white/85 md:text-[19px]",
              wideDescription ? "max-w-[760px]" : "max-w-[640px]"
            )}
          >
            {description}
          </p>
        </div>
      </Container>
    </section>
  )
}
```


`components/home/icon-cards.tsx` (only the props type is now exported):

```tsx
import Image from "next/image"

import { Container, SectionHeading } from "@/components/home/section"
import { cn } from "@/lib/utils"

type IconCard = { title: string; description: string; icon: string }

export type IconCardsProps = {
  eyebrow: string
  title: string
  description: string
  items: IconCard[]
  className?: string
}

export function IconCards({
  eyebrow,
  title,
  description,
  items,
  className,
}: IconCardsProps) {
  return (
    <section className={cn("bg-white px-6 py-20 md:px-10 lg:py-28", className)}>
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
        />

        <ul data-stagger className="grid gap-6 lg:grid-cols-3">
          {items.map((value) => (
            <li
              key={value.title}
              className="flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-8 py-9 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-green">
                <Image src={value.icon} alt="" width={24} height={24} />
              </div>
              <h3 className="text-[22px] leading-[normal] font-black text-brand-navy">
                {value.title}
              </h3>
              <p className="text-base leading-[1.6] text-brand-ink">
                {value.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
```


`components/about/stats.tsx`:

```tsx
import { Container } from "@/components/home/section"

export type StatsProps = {
  stats: { value: string; label: string; description: string }[]
}

export function Stats({ stats }: StatsProps) {
  return (
    <section className="bg-brand-navy px-6 py-16 md:px-10 lg:py-20">
      <Container>
        <ul data-stagger className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <li key={stat.label} className="flex flex-col gap-2">
              <p className="text-[44px] leading-[normal] font-black tracking-[-0.01em] text-brand-green">
                {stat.value}
              </p>
              <p className="text-lg leading-[normal] font-black text-white">
                {stat.label}
              </p>
              <p className="text-[15px] leading-[1.6] text-white/70">
                {stat.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
```


`components/services/why-choose-us.tsx`:

```tsx
import Image from "next/image"

import { Container, Eyebrow } from "@/components/home/section"

export type WhyChooseUsProps = {
  eyebrow: string
  heading: string
  copy: string
  features: { title: string; description: string; icon: string }[]
}

export function WhyChooseUs({
  eyebrow,
  heading,
  copy,
  features,
}: WhyChooseUsProps) {
  return (
    <section className="bg-brand-blue px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <div
          data-stagger
          className="flex flex-col items-center gap-3.5 text-center"
        >
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-4xl leading-[1.15] font-black tracking-[-0.01em] text-white md:text-[44px]">
            {heading}
          </h2>
          <p className="max-w-[680px] text-lg leading-[1.6] text-white/85">
            {copy}
          </p>
        </div>

        <ul data-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="flex flex-col items-start gap-3.5 rounded-3xl border border-white/18 bg-white/8 px-7 py-8"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-green">
                <Image src={feature.icon} alt="" width={24} height={24} />
              </div>
              <h3 className="text-xl leading-[normal] font-black text-white">
                {feature.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-white/80">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
```


`components/services/service-body.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { Container, Eyebrow } from "@/components/home/section"
import { renderInline } from "@/lib/rich-text/render"
import type { ParagraphsDoc } from "@/lib/schemas/common"
import { cn } from "@/lib/utils"

export type ServiceBodyProps = {
  slug: string
  image: { src: string; alt: string }
  heading: string
  overview: ParagraphsDoc
  included: string[]
  callout: string
  phone24h: string
  phone24hHref: string
  allServices: { slug: string; title: string }[]
  operations: {
    office: string
    officeHref: string
    extension: string
    mobile: string
    mobileHref: string
    email: string
  }
  labels: {
    overviewEyebrow: string
    includedHeading: string
    allServicesAria: string
    allServicesHeading: string
    helpEyebrow: string
    helpHeading: string
    telLabel: string
    orLabel: string
    phone24hLabel: string
    cta: { label: string; href: string }
  }
}

export function ServiceBody({
  slug,
  image,
  heading,
  overview,
  included,
  callout,
  phone24h,
  phone24hHref,
  allServices,
  operations,
  labels,
}: ServiceBodyProps) {
  return (
    <section className="bg-white px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-12 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div
            data-reveal
            className="relative h-72 overflow-hidden rounded-[28px] md:h-[440px]"
          >
            <div
              data-parallax
              className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 1280px) 760px, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div data-stagger className="mt-8 flex flex-col gap-3.5">
            <Eyebrow>{labels.overviewEyebrow}</Eyebrow>
            <h2 className="text-3xl leading-[1.15] font-black tracking-[-0.01em] text-brand-navy md:text-[40px]">
              {heading}
            </h2>
          </div>
          {overview.content.map((paragraph, i) => (
            <p key={i} className="text-lg leading-[1.7] text-brand-ink">
              {renderInline(paragraph.content)}
            </p>
          ))}

          <h3 className="text-[26px] leading-[normal] font-black text-brand-navy">
            {labels.includedHeading}
          </h3>
          <ul data-stagger className="flex flex-col gap-3.5">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3.5">
                <Image
                  src="/images/check.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="shrink-0"
                />
                <span className="text-base leading-normal font-medium text-brand-navy">
                  {item}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-5 rounded-3xl bg-brand-mint px-6 py-7 md:px-8">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-green">
              <Image
                src="/images/icon-phone.svg"
                alt=""
                width={24}
                height={24}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1 leading-[normal]">
              <p className="text-base leading-[normal] font-bold text-brand-navy">
                {callout}
              </p>
              <a
                href={phone24hHref}
                className="text-[28px] font-black text-brand-blue hover:underline"
              >
                {phone24h}
              </a>
            </div>
          </div>
        </div>

        <aside className="flex w-full flex-col gap-6 lg:w-[392px] lg:shrink-0">
          <nav
            aria-label={labels.allServicesAria}
            className="flex flex-col gap-2.5 rounded-3xl border border-brand-line bg-white px-6 py-7 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
          >
            <p className="mb-3.5 text-xl leading-[normal] font-black text-brand-navy">
              {labels.allServicesHeading}
            </p>
            {allServices.map((item) => {
              const active = item.slug === slug
              return (
                <Link
                  key={item.slug}
                  href={`/services/${item.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[14px] px-[18px] py-4 leading-[normal] font-bold transition-colors",
                    active
                      ? "bg-brand-blue text-white"
                      : "bg-brand-surface text-brand-navy hover:bg-brand-mint"
                  )}
                >
                  <span className="text-[15px]">{item.title}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "text-base leading-[normal]",
                      active ? "text-white" : "text-brand-blue"
                    )}
                  >
                    →
                  </span>
                </Link>
              )
            })}
          </nav>

          <div className="flex flex-col items-start gap-3.5 rounded-3xl bg-brand-blue px-8 py-9">
            <Eyebrow>{labels.helpEyebrow}</Eyebrow>
            <p className="text-[26px] leading-[1.2] font-black text-white">
              {labels.helpHeading}
            </p>
            <div className="text-[15px] leading-[1.65] text-white/85">
              <p>
                {labels.telLabel}{" "}
                <a href={operations.officeHref} className="hover:text-white">
                  {operations.office}
                  {` ${operations.extension}`}
                </a>{" "}
                {labels.orLabel}{" "}
                <a href={operations.mobileHref} className="hover:text-white">
                  {operations.mobile}
                </a>
              </p>
              <a
                href={`mailto:${operations.email}`}
                className="break-all hover:text-white"
              >
                {operations.email}
              </a>
            </div>
            <div className="h-px w-full bg-white/18" />
            <p className="text-sm leading-[normal] font-bold text-white/70">
              {labels.phone24hLabel}
            </p>
            <a
              href={phone24hHref}
              className="text-[28px] leading-[normal] font-black text-white"
            >
              {phone24h}
            </a>
            <Link
              href={labels.cta.href}
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "w-full"
              )}
            >
              {labels.cta.label}
            </Link>
          </div>
        </aside>
      </Container>
    </section>
  )
}
```


`components/services/other-services.tsx`:

```tsx
import { Container, SectionHeading } from "@/components/home/section"
import {
  ServiceCard,
  type ServiceCardData,
  type ServiceCardLabels,
} from "@/components/home/services"

export type OtherServicesProps = {
  eyebrow: string
  heading: string
  intro: string
  /** The next three services after the current one, wrapping around. */
  services: ServiceCardData[]
  labels: ServiceCardLabels
}

export function OtherServices({
  eyebrow,
  heading,
  intro,
  services,
  labels,
}: OtherServicesProps) {
  return (
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading eyebrow={eyebrow} title={heading} description={intro} />
        <ul data-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} labels={labels} />
          ))}
        </ul>
      </Container>
    </section>
  )
}
```


`components/contact/departments.tsx`:

```tsx
import Image from "next/image"

import { Container, SectionHeading } from "@/components/home/section"

export type DepartmentsProps = {
  eyebrow: string
  heading: string
  intro: string
  items: {
    title: string
    icon: string
    name: string
    role: string
    lines: { text: string; href: string }[]
  }[]
}

export function Departments({
  eyebrow,
  heading,
  intro,
  items,
}: DepartmentsProps) {
  return (
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading eyebrow={eyebrow} title={heading} description={intro} />
        <ul data-stagger className="grid gap-6 lg:grid-cols-3">
          {items.map((department) => (
            <li
              key={department.title}
              className="flex flex-col items-start gap-4 rounded-3xl border border-brand-line bg-white px-8 py-9 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-green">
                <Image src={department.icon} alt="" width={24} height={24} />
              </div>
              <h3 className="text-[22px] leading-[normal] font-black text-brand-navy">
                {department.title}
              </h3>
              <div className="flex flex-col gap-0.5 leading-[normal] font-bold">
                <p className="text-base leading-[normal] text-brand-navy">
                  {department.name}
                </p>
                <p className="text-sm leading-[normal] text-brand-green-dark">
                  {department.role}
                </p>
              </div>
              <div className="h-px w-full bg-brand-line" />
              {department.lines.map((line) => (
                <a
                  key={line.text}
                  href={line.href}
                  className="text-[15px] leading-[normal] break-all text-brand-ink hover:text-brand-blue"
                >
                  {line.text}
                </a>
              ))}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
```


`components/blog/blog-card.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

/** An article as cards and lists show it (dates already formatted). */
export type BlogCardPost = {
  slug: string
  title: string
  excerpt: string
  category: string
  /** "2026-09-20" for <time dateTime>. */
  date: string
  /** "20 Sep 2026". */
  displayDate: string
  cover: string
}

export type Author = { name: string; role: string }

export function BlogCard({
  post,
  readArticle,
}: {
  post: BlogCardPost
  readArticle: string
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-brand-line bg-white shadow-[0px_10px_30px_0px_rgba(13,26,51,0.06)]">
      <div className="relative h-[230px] shrink-0 overflow-hidden">
        <Image
          src={post.cover}
          alt=""
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col items-start gap-3.5 px-7 pt-7 pb-8">
        <PostMeta category={post.category} date={post.date}>
          {post.displayDate}
        </PostMeta>
        <h3 className="text-[22px] leading-[1.3] font-black text-brand-navy">
          {post.title}
        </h3>
        <p className="text-[15px] leading-[1.6] text-brand-ink">
          {post.excerpt}
        </p>
        <Link
          href={`/blog/${post.slug}`}
          className="pt-1 text-[15px] leading-[normal] font-bold whitespace-pre text-brand-blue hover:underline"
        >
          {readArticle}
        </Link>
      </div>
    </article>
  )
}

export function PostMeta({
  category,
  date,
  featuredLabel,
  children,
}: {
  category: string
  date: string
  /** Shows the "Featured" badge when set. */
  featuredLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 leading-[normal]">
      {featuredLabel && (
        <span className="rounded-full bg-brand-blue px-3 py-1.5 text-xs leading-[normal] font-bold text-white">
          {featuredLabel}
        </span>
      )}
      <span className="rounded-full bg-brand-mint px-3 py-1.5 text-xs leading-[normal] font-bold text-brand-green-dark">
        {category}
      </span>
      <time
        dateTime={date}
        className="text-[13px] font-medium text-brand-muted"
      >
        {children}
      </time>
    </div>
  )
}

export function AuthorBadge({
  author,
  size = "sm",
}: {
  author: Author
  size?: "sm" | "lg"
}) {
  const initials = author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
  const lg = size === "lg"

  return (
    <div
      className={cn(
        "flex items-center leading-[normal]",
        lg ? "gap-3.5" : "gap-3"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-full bg-brand-blue font-bold text-white",
          lg ? "size-[52px] text-[17px]" : "size-11 text-[15px]"
        )}
      >
        {initials}
      </span>
      <div className="flex flex-col gap-0.5">
        <p
          className={cn(
            "font-bold text-brand-navy",
            lg ? "text-base leading-[normal]" : "text-[15px]"
          )}
        >
          {author.name}
        </p>
        <p
          className={cn(
            "text-brand-muted",
            lg ? "text-sm leading-[normal]" : "text-[13px]"
          )}
        >
          {author.role}
        </p>
      </div>
    </div>
  )
}
```


`components/blog/blog-posts.tsx`:

```tsx
"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

import {
  type Author,
  AuthorBadge,
  BlogCard,
  type BlogCardPost,
  PostMeta,
} from "@/components/blog/blog-card"
import { Container } from "@/components/home/section"
import { interpolate, interpolateParts } from "@/lib/interpolate"
import { cn } from "@/lib/utils"

const pill =
  "rounded-full px-[22px] py-3 text-[15px] leading-[normal] font-bold transition-colors"
const pageButton =
  "flex size-12 items-center justify-center rounded-full text-base leading-[normal] font-bold transition-colors"

export type BlogPostsProps = {
  /** Every article except the featured one, newest first. */
  posts: BlogCardPost[]
  featured: (BlogCardPost & { author: Author | null }) | null
  /** Category names in the filter bar (categories with showInFilter). */
  filters: string[]
  pageSize: number
  initialCategory?: string
  labels: {
    allPosts: string
    readArticle: string
    featuredBadge: string
    /** "No posts in {category} yet. Check back soon." */
    emptyCategory: string
    filterAria: string
    paginationAria: string
    previousPage: string
    /** "Page {n}" */
    pageNumber: string
    nextPage: string
  }
}

export function BlogPosts({
  posts,
  featured,
  filters,
  pageSize,
  initialCategory,
  labels,
}: BlogPostsProps) {
  const all = labels.allPosts
  const [category, setCategory] = useState(
    initialCategory && filters.includes(initialCategory) ? initialCategory : all
  )
  const [page, setPage] = useState(1)
  const sectionRef = useRef<HTMLElement>(null)

  const filtered =
    category === all ? posts : posts.filter((p) => p.category === category)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const showFeatured =
    featured !== null &&
    page === 1 &&
    (category === all || category === featured.category)

  const selectCategory = (next: string) => {
    setCategory(next)
    setPage(1)
  }
  const goTo = (next: number) => {
    setPage(next)
    sectionRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section
      ref={sectionRef}
      className="scroll-mt-28 bg-brand-surface px-6 py-20 md:px-10 lg:py-28"
    >
      <Container className="flex flex-col gap-10">
        <div
          role="group"
          aria-label={labels.filterAria}
          className="flex flex-wrap gap-3"
        >
          {[all, ...filters].map((item) => {
            const active = item === category
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => selectCategory(item)}
                className={cn(
                  pill,
                  active
                    ? "bg-brand-blue text-white"
                    : "border border-brand-line bg-white text-brand-navy hover:border-brand-blue"
                )}
              >
                {item}
              </button>
            )
          })}
        </div>

        {showFeatured && (
          <article className="group flex flex-col overflow-hidden rounded-[28px] border border-brand-line bg-white shadow-[0px_12px_40px_0px_rgba(13,26,51,0.06)] lg:h-[451px] lg:flex-row">
            <div className="relative h-64 shrink-0 overflow-hidden md:h-80 lg:h-auto lg:w-[600px]">
              <Image
                src={featured.cover}
                alt=""
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col items-start justify-center gap-[18px] p-8 md:p-14">
              <PostMeta
                featuredLabel={labels.featuredBadge}
                category={featured.category}
                date={featured.date}
              >
                {featured.displayDate}
              </PostMeta>
              <h2 className="text-3xl leading-[1.2] font-black tracking-[-0.01em] text-brand-navy md:text-4xl md:leading-[1.2]">
                {featured.title}
              </h2>
              <p className="text-[17px] leading-[1.65] text-brand-ink">
                {featured.excerpt}
              </p>
              {featured.author && <AuthorBadge author={featured.author} />}
              <Link
                href={`/blog/${featured.slug}`}
                className="pt-1.5 text-base leading-[normal] font-bold whitespace-pre text-brand-blue hover:underline"
              >
                {labels.readArticle}
              </Link>
            </div>
          </article>
        )}

        {visible.length > 0 ? (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) => (
              <li key={post.slug}>
                <BlogCard post={post} readArticle={labels.readArticle} />
              </li>
            ))}
          </ul>
        ) : (
          !showFeatured && (
            <p className="rounded-3xl border border-brand-line bg-white px-8 py-16 text-center text-lg text-brand-ink">
              {interpolateParts(labels.emptyCategory, { category })}
            </p>
          )
        )}

        <nav
          aria-label={labels.paginationAria}
          className="flex items-center justify-center gap-2.5"
        >
          <button
            type="button"
            aria-label={labels.previousPage}
            disabled={page === 1}
            onClick={() => goTo(page - 1)}
            className={cn(
              pageButton,
              "border border-brand-line bg-white text-brand-navy hover:border-brand-blue disabled:opacity-40"
            )}
          >
            ←
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={interpolate(labels.pageNumber, { n })}
              aria-current={n === page ? "page" : undefined}
              onClick={() => goTo(n)}
              className={cn(
                pageButton,
                n === page
                  ? "bg-brand-blue text-white"
                  : "border border-brand-line bg-white text-brand-navy hover:border-brand-blue"
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            aria-label={labels.nextPage}
            disabled={page === pageCount}
            onClick={() => goTo(page + 1)}
            className={cn(
              pageButton,
              "border border-brand-line bg-white text-brand-navy hover:border-brand-blue disabled:opacity-40"
            )}
          >
            →
          </button>
        </nav>
      </Container>
    </section>
  )
}
```


`components/blog/share-links.tsx`:

```tsx
"use client"

import { interpolate } from "@/lib/interpolate"

export type ShareLinksProps = {
  title: string
  label: string
  /** "Share on {name}" */
  ariaTemplate: string
  /** href templates with {url} and {title} (filled in URI-encoded). */
  networks: { label: string; name: string; href: string }[]
}

// Builds share URLs from the live page address, so no site URL config is needed.
export function ShareLinks({
  title,
  label,
  ariaTemplate,
  networks,
}: ShareLinksProps) {
  return (
    <div className="flex items-center gap-2.5">
      <p className="text-sm leading-[normal] font-bold text-brand-navy">
        {label}
      </p>
      {networks.map((network) => (
        <button
          key={network.name}
          type="button"
          aria-label={interpolate(ariaTemplate, { name: network.name })}
          onClick={() =>
            window.open(
              interpolate(network.href, {
                url: encodeURIComponent(window.location.href),
                title: encodeURIComponent(title),
              }),
              "_blank",
              "noopener,noreferrer"
            )
          }
          className="flex size-9 items-center justify-center rounded-full bg-brand-blue text-[13px] leading-[normal] font-black text-white transition-colors hover:bg-brand-navy"
        >
          {network.label}
        </button>
      ))}
    </div>
  )
}
```


`components/blog/article.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"

import { buttonClassName } from "@/components/ui/button"
import { type Author, AuthorBadge } from "@/components/blog/blog-card"
import { ShareLinks, type ShareLinksProps } from "@/components/blog/share-links"
import { Container, Eyebrow } from "@/components/home/section"
import type { WithMedia } from "@/lib/media"
import { ArticleBlocks } from "@/lib/rich-text/render"
import type { RichTextDoc } from "@/lib/schemas/common"

export type ArticleHeaderProps = {
  article: {
    title: string
    /** Lead paragraph (falls back to the excerpt). */
    lead: string
    category: string
    date: string
    displayDate: string
    /** "5 min read", or null to hide it. */
    readTime: string | null
    author: Author | null
    cover: string
  }
  breadcrumb: {
    ariaLabel: string
    home: string
    blog: string
    blogHref: string
  }
}

export function ArticleHeader({ article, breadcrumb }: ArticleHeaderProps) {
  return (
    <section className="bg-brand-surface px-6 py-14 md:px-10 lg:py-[72px]">
      <Container className="flex flex-col items-start gap-6">
        <nav aria-label={breadcrumb.ariaLabel}>
          <ol className="flex flex-wrap items-center gap-2.5 rounded-full border border-brand-line bg-white px-4 py-2 text-[13px] leading-[normal] font-bold">
            <li>
              <Link href="/" className="text-brand-ink hover:text-brand-navy">
                {breadcrumb.home}
              </Link>
            </li>
            <li aria-hidden className="text-brand-placeholder">
              /
            </li>
            <li>
              <Link
                href={breadcrumb.blogHref}
                className="text-brand-ink hover:text-brand-navy"
              >
                {breadcrumb.blog}
              </Link>
            </li>
            <li aria-hidden className="text-brand-placeholder">
              /
            </li>
            <li aria-current="page" className="text-brand-green-dark">
              {article.category}
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center gap-3 text-sm leading-[normal] font-medium text-brand-muted">
          <span className="rounded-full bg-brand-mint px-3 py-1.5 text-xs leading-[normal] font-bold text-brand-green-dark">
            {article.category}
          </span>
          <time dateTime={article.date}>{article.displayDate}</time>
          {article.readTime && (
            <>
              <span aria-hidden className="font-bold text-brand-placeholder">
                •
              </span>
              <span>{article.readTime}</span>
            </>
          )}
        </div>

        <h1 className="max-w-[960px] text-4xl leading-[1.12] font-black tracking-[-0.015em] text-brand-navy md:text-[56px]">
          {article.title}
        </h1>
        <p className="max-w-[820px] text-lg leading-[1.6] text-brand-ink md:text-xl md:leading-[1.6]">
          {article.lead}
        </p>
        {article.author && <AuthorBadge author={article.author} size="lg" />}

        <div
          data-reveal
          className="relative mt-8 h-72 w-full overflow-hidden rounded-[28px] md:h-[560px]"
        >
          <div
            data-parallax
            className="absolute inset-x-0 -top-[8%] h-[116%] will-change-transform"
          >
            <Image
              src={article.cover}
              alt=""
              fill
              priority
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}

const paragraph = "text-lg leading-[1.75] text-[#3b4556]"
const card =
  "flex flex-col rounded-3xl border border-brand-line bg-white px-6 py-7 shadow-[0px_12px_20px_0px_rgba(13,26,51,0.06)]"
const cardTitle = "text-xl leading-[normal] font-black text-brand-navy"

export type ArticleBodyProps = {
  /** null: the article has no designed body yet and shows its excerpt. */
  body: WithMedia<RichTextDoc> | null
  excerpt: string
  tags: string[]
  share: ShareLinksProps
  recent: {
    slug: string
    title: string
    cover: string
    date: string
    displayDate: string
  }[]
  categories: { name: string; count: number }[]
  labels: {
    tagsLabel: string
    recentPostsHeading: string
    categoriesAria: string
    categoriesHeading: string
  }
  cta: {
    eyebrow: string
    heading: string
    copy: string
    link: { label: string; href: string }
  }
}

export function ArticleBody({
  body,
  excerpt,
  tags,
  share,
  recent,
  categories,
  labels,
  cta,
}: ArticleBodyProps) {
  return (
    <section className="bg-white px-6 pt-14 pb-20 md:px-10 lg:pt-20 lg:pb-28">
      <Container className="flex flex-col gap-16 lg:flex-row lg:items-start">
        <article className="flex min-w-0 flex-1 flex-col gap-[22px]">
          {body ? (
            <ArticleBlocks doc={body} />
          ) : (
            <p className={paragraph}>{excerpt}</p>
          )}

          <div className="h-px bg-brand-line" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-sm leading-[normal] font-bold text-brand-navy">
                {labels.tagsLabel}
              </p>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-brand-surface px-3 py-1.5 text-xs leading-[normal] font-bold text-brand-ink"
                >
                  {tag}
                </span>
              ))}
            </div>
            <ShareLinks {...share} />
          </div>
        </article>

        <aside className="flex w-full flex-col gap-6 lg:w-[360px] lg:shrink-0">
          <div className={`${card} gap-[18px]`}>
            <p className={cardTitle}>{labels.recentPostsHeading}</p>
            {recent.map((item) => (
              <Link
                key={item.slug}
                href={`/blog/${item.slug}`}
                className="group flex items-center gap-3.5"
              >
                <div className="relative size-[76px] shrink-0 overflow-hidden rounded-[14px]">
                  <Image
                    src={item.cover}
                    alt=""
                    fill
                    sizes="76px"
                    className="object-cover"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="text-[15px] leading-[1.35] font-bold text-brand-navy group-hover:text-brand-blue">
                    {item.title}
                  </p>
                  <time
                    dateTime={item.date}
                    className="text-[13px] leading-[normal] font-medium text-brand-muted"
                  >
                    {item.displayDate}
                  </time>
                </div>
              </Link>
            ))}
          </div>

          <nav aria-label={labels.categoriesAria} className={`${card} gap-1.5`}>
            <p className={`${cardTitle} mb-1.5`}>{labels.categoriesHeading}</p>
            {categories.map((category) => (
              <Link
                key={category.name}
                href={`/blog?category=${encodeURIComponent(category.name)}`}
                className="flex items-center justify-between py-3 text-[15px] leading-[normal] font-medium text-brand-navy hover:text-brand-blue"
              >
                {category.name}
                <span className="rounded-full bg-brand-mint px-2.5 py-[3px] text-xs leading-[normal] font-bold text-brand-green-dark">
                  {category.count}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-col items-start gap-3.5 rounded-3xl bg-brand-blue px-7 py-8">
            <Eyebrow>{cta.eyebrow}</Eyebrow>
            <p className="text-2xl leading-[1.2] font-black text-white">
              {cta.heading}
            </p>
            <p className="text-[15px] leading-[1.6] text-white/85">
              {cta.copy}
            </p>
            <Link
              href={cta.link.href}
              className={buttonClassName(
                { variant: "brand", size: "pill" },
                "w-full"
              )}
            >
              {cta.link.label}
            </Link>
          </div>
        </aside>
      </Container>
    </section>
  )
}
```


`components/site-locale.tsx`:

```tsx
"use client"

import { useEffect } from "react"

/**
 * Applies settings.site.locale to <html lang>. The root layout is part of
 * the static shell (built without a database), so it ships lang="en" and
 * this corrects it after hydration when the setting differs. Renders nothing.
 */
export function SiteLocale({ lang }: { lang: string }) {
  useEffect(() => {
    if (document.documentElement.lang !== lang)
      document.documentElement.lang = lang
  }, [lang])
  return null
}
```


Delete the data modules (their values live in `server/db/seed/fixtures/*` since Tasks 1–4):

```bash
git rm components/home/data.ts components/about/data.ts components/services/data.ts components/team/data.ts
```

- [ ] **Step 4: Sources, view builders, metadata and templates**

`templates/shared/sources.ts`:

```ts
import type { WithMedia } from "@/lib/media"
import type { Seo } from "@/lib/schemas/common"
import type { PublicSettingsKey, SettingsValue } from "@/lib/schemas/settings"
import type { ArticleRecord } from "@/server/modules/articles/queries"
import type {
  CategoryRecord,
  ClientRecord,
  GroupCompanyRecord,
  TeamMemberRecord,
} from "@/server/modules/collections/queries"
import type { ServiceRecord } from "@/server/modules/services/queries"
import type { PageData, PageKey } from "@/templates/registry"

/**
 * Everything the public templates render, with media resolved to URLs.
 * Loaded per request by server/modules/pages/sources.ts (cached queries);
 * the view builders in templates/* are pure functions of it.
 */
export type SiteSources = {
  settings: { [K in PublicSettingsKey]: WithMedia<SettingsValue<K>> }
  pages: {
    [K in PageKey]: { data: WithMedia<PageData<K>>; seo: WithMedia<Seo> }
  }
  /** Published services in display order. */
  services: WithMedia<ServiceRecord>[]
  /** Published articles, newest first. */
  articles: WithMedia<ArticleRecord>[]
  categories: CategoryRecord[]
  team: WithMedia<TeamMemberRecord>[]
  clients: WithMedia<ClientRecord>[]
  groupCompanies: WithMedia<GroupCompanyRecord>[]
}

export type SiteArticle = SiteSources["articles"][number]
export type SiteService = SiteSources["services"][number]
```


`templates/shared/views.ts`:

```ts
import type { Author, BlogCardPost } from "@/components/blog/blog-card"
import type { AboutProps } from "@/components/home/about"
import type {
  ClientsProps,
  TeamProps,
} from "@/components/home/clients-team-blog"
import type { ContactProps, LocationMapProps } from "@/components/home/contact"
import type { PageHeroProps } from "@/components/home/page-hero"
import type {
  EnquireBannerProps,
  ServiceCardData,
  ServiceCardLabels,
} from "@/components/home/services"
import type { SiteFooterProps } from "@/components/home/site-footer"
import type { SiteHeaderProps } from "@/components/home/site-header"
import { formatPostDate, isoDate } from "@/lib/format"
import {
  contactPlaceholders,
  interpolate,
  interpolateParts,
} from "@/lib/interpolate"
import type { PageHero } from "@/lib/schemas/common"
import type { WithMedia } from "@/lib/media"

import type { SiteArticle, SiteService, SiteSources } from "./sources"

// Builders shared by several templates: header, footer and the shared
// sections (D10 + ruling), plus card shapes. Pure functions of SiteSources.

/** Settings.contact fields + derived tel: hrefs for {placeholders}. */
export const placeholders = (s: SiteSources) =>
  contactPlaceholders(s.settings.contact)

export type ChromeView = {
  header: SiteHeaderProps
  footer: SiteFooterProps
  /** <html lang> (settings.site.locale), applied by SiteLocale. */
  locale: string
}

export function chromeView(s: SiteSources): ChromeView {
  const { site, contact, navigation, footer, microcopy } = s.settings
  const values = placeholders(s)
  return {
    locale: site.locale,
    header: {
      topBar: {
        phone24hLabel: microcopy.header.phone24hLabel,
        phone24h: contact.phone24h,
        phone24hHref: String(values.phone24hHref),
        email: contact.email,
        hoursLabel: microcopy.header.hoursLabel,
        hours: contact.hours,
      },
      logo: { src: site.logo.url, alt: site.logoAlt },
      links: navigation.headerLinks,
      cta: navigation.headerCta,
      aria: {
        mainNav: microcopy.aria.mainNav,
        openMenu: microcopy.aria.openMenu,
        closeMenu: microcopy.aria.closeMenu,
        mobileNav: microcopy.aria.mobileNav,
      },
    },
    footer: {
      logo: { src: site.logo.url, alt: site.logoAlt },
      tagline: footer.tagline,
      quickLinks: {
        heading: footer.quickLinksHeading,
        ariaLabel: microcopy.aria.footerNav,
        links: navigation.headerLinks,
      },
      contact: {
        heading: footer.contactHeading,
        addressLine1: contact.addressLine1,
        addressLine2: contact.addressLine2,
        telLabel: footer.contact.telLabel,
        office: contact.office,
        officeHref: String(values.officeHref),
        phone24hLabel: footer.contact.phone24hLabel,
        phone24h: contact.phone24h,
        phone24hHref: String(values.phone24hHref),
        email: contact.email,
      },
      group: {
        heading: footer.groupHeading,
        telLabel: footer.groupTelLabel,
        companies: s.groupCompanies.map((g) => ({
          name: g.name,
          phone: g.phone,
          site: g.site,
          logo: g.logo.url,
        })),
      },
      copyright: site.copyright,
      legal: footer.legal,
    },
  }
}

export function pageHeroView(
  s: SiteSources,
  hero: WithMedia<PageHero>,
  extra: Pick<PageHeroProps, "trail" | "wideDescription"> = {}
): PageHeroProps {
  return {
    image: hero.image.url,
    crumb: hero.crumb,
    title: interpolate(hero.title, placeholders(s)),
    description: interpolate(hero.description, placeholders(s)),
    homeLabel: s.settings.microcopy.breadcrumb.home,
    ariaLabel: s.settings.microcopy.aria.breadcrumb,
    ...extra,
  }
}

export function enquireBannerView(s: SiteSources): EnquireBannerProps {
  const banner = s.settings["sections.enquireBanner"]
  const values = placeholders(s)
  return {
    image: banner.image.url,
    eyebrow: banner.eyebrow,
    heading: banner.heading,
    copy: banner.copy,
    cta: banner.cta,
    secondaryCta: {
      label: interpolateParts(banner.secondaryCta.label, values),
      href: interpolate(banner.secondaryCta.href, values),
    },
  }
}

export function clientsView(s: SiteSources): ClientsProps {
  const section = s.settings["sections.clients"]
  return {
    eyebrow: section.eyebrow,
    heading: section.heading,
    clients: s.clients.map((c) => ({ name: c.name, logo: c.logo.url })),
  }
}

export function aboutSectionView(s: SiteSources): AboutProps {
  const about = s.settings["sections.about"]
  return {
    eyebrow: about.eyebrow,
    heading: about.heading,
    body: about.body,
    image: { src: about.image.url, alt: about.imageAlt },
    badge: about.badge,
    highlights: about.highlights,
  }
}

export function contactSectionView(s: SiteSources): ContactProps {
  const section = s.settings["sections.contact"]
  const values = placeholders(s)
  const { mailtoSubject, ...labels } = section.form
  return {
    eyebrow: section.eyebrow,
    heading: section.heading,
    intro: section.intro,
    infoItems: section.infoItems.map((item) => ({
      title: item.title,
      icon: item.icon.url,
      lines: item.lines.map((line) => ({
        text: interpolate(line.text, values),
        ...(line.href ? { href: interpolate(line.href, values) } : {}),
      })),
    })),
    form: {
      labels,
      mailto: { email: s.settings.contact.email, subject: mailtoSubject },
    },
  }
}

export function locationMapView(s: SiteSources): LocationMapProps {
  const map = s.settings["sections.contact"].map
  return {
    href: interpolate(map.link, placeholders(s)),
    ariaLabel: map.ariaLabel,
    label: map.label,
    logo: s.settings.site.logo.url,
    tiles: map.tiles,
  }
}

export function teamView(
  s: SiteSources,
  heading: { eyebrow: string; heading: string; intro: string }
): TeamProps {
  return {
    eyebrow: heading.eyebrow,
    title: heading.heading,
    description: heading.intro,
    photoPlaceholder: s.pages.team.data.leadership.photoPlaceholder.url,
    members: s.team.map((m) => ({
      name: m.name,
      role: m.role,
      bio: m.bio,
      email: m.email,
      photo: m.photo?.url ?? null,
    })),
  }
}

export function serviceCard(service: SiteService): ServiceCardData {
  return {
    slug: service.slug,
    title: service.content.title,
    description: service.content.description,
    icon: service.content.icon.url,
  }
}

export function serviceCardLabels(s: SiteSources): ServiceCardLabels {
  return {
    readMore: s.settings.microcopy.serviceCard.readMore,
    ariaReadMore: s.settings.microcopy.aria.serviceCardReadMore,
  }
}

/** Published date as shown on cards ("2026-09-20" / "20 Sep 2026"). */
export function articleDates(article: SiteArticle) {
  const at = article.publishedAt ?? new Date(0)
  return { date: isoDate(at), displayDate: formatPostDate(at) }
}

export function blogCard(article: SiteArticle): BlogCardPost {
  return {
    slug: article.slug,
    title: article.content.title,
    excerpt: article.content.excerpt,
    category: article.category.name,
    cover: article.content.cover.url,
    ...articleDates(article),
  }
}

export function authorOf(article: SiteArticle): Author | null {
  return article.author
    ? { name: article.author.name, role: article.author.title ?? "" }
    : null
}

/** pages.blog.featuredArticle, if it is published. */
export function featuredArticle(s: SiteSources): SiteArticle | null {
  const slug = s.pages.blog.data.featuredArticle
  return s.articles.find((a) => a.slug === slug) ?? null
}

/** Every published article except the featured one (the static site's `posts`). */
export function listedArticles(s: SiteSources): SiteArticle[] {
  const featured = s.pages.blog.data.featuredArticle
  return s.articles.filter((a) => a.slug !== featured)
}
```


`templates/shared/page-meta.ts`:

```ts
import type { Metadata } from "next"

import { interpolate } from "@/lib/interpolate"
import type { PageKey } from "@/templates/registry"

import type { SiteSources } from "./sources"
import { placeholders } from "./views"

// <title> and description per public URL. Page rows carry explicit seo
// (seeded from the static site); otherwise "{title} | Security Partners
// Ltd." and the default description apply. Phase 8 adds canonical, OG and
// JSON-LD on top.

function described(
  s: SiteSources,
  title: string,
  description: string | undefined
): Metadata {
  const values = placeholders(s)
  return {
    title: interpolate(title, values),
    description: interpolate(
      description ?? s.settings["seo.defaults"].description,
      values
    ),
  }
}

export function pageMetadata(s: SiteSources, key: PageKey): Metadata {
  const defaults = s.settings["seo.defaults"]
  if (key === "home") {
    const { seo } = s.pages.home
    return described(s, seo.title ?? defaults.title, seo.description)
  }
  const page = s.pages[key]
  const title =
    page.seo.title ??
    interpolate(defaults.titleTemplate, { title: page.data.hero.title })
  return described(s, title, page.seo.description)
}

export function serviceMetadata(s: SiteSources, slug: string): Metadata {
  const service = s.services.find((x) => x.slug === slug)
  if (!service) return {}
  const title =
    service.seo.title ??
    interpolate(s.settings["seo.defaults"].titleTemplate, {
      title: service.content.title,
    })
  return described(
    s,
    title,
    service.seo.description ?? service.content.detail.intro
  )
}

export function articleMetadata(s: SiteSources, slug: string): Metadata {
  const article = s.articles.find((a) => a.slug === slug)
  if (!article) return {}
  const title =
    article.seo.title ??
    interpolate(s.settings["seo.defaults"].titleTemplate, {
      title: article.content.title,
    })
  return described(s, title, article.seo.description ?? article.content.excerpt)
}
```


`templates/home/view.ts`:

```ts
import type { AboutProps } from "@/components/home/about"
import type {
  BlogProps,
  ClientsProps,
  TeamProps,
} from "@/components/home/clients-team-blog"
import type { ContactProps, LocationMapProps } from "@/components/home/contact"
import type { HeroProps } from "@/components/home/hero"
import type {
  EnquireBannerProps,
  ServicesProps,
} from "@/components/home/services"
import { interpolate, interpolateParts } from "@/lib/interpolate"
import type { SiteSources } from "@/templates/shared/sources"
import {
  aboutSectionView,
  blogCard,
  type ChromeView,
  chromeView,
  clientsView,
  contactSectionView,
  enquireBannerView,
  listedArticles,
  locationMapView,
  placeholders,
  serviceCard,
  serviceCardLabels,
  teamView,
} from "@/templates/shared/views"

export type HomeView = {
  chrome: ChromeView
  hero: HeroProps
  about: AboutProps
  services: ServicesProps
  enquireBanner: EnquireBannerProps
  clients: ClientsProps
  team: TeamProps
  blog: BlogProps
  contact: ContactProps
  map: LocationMapProps
}

export function homeView(s: SiteSources): HomeView {
  const page = s.pages.home.data
  const values = placeholders(s)
  return {
    chrome: chromeView(s),
    hero: {
      eyebrow: page.hero.eyebrow,
      heading: page.hero.heading,
      tagline: page.hero.tagline,
      subheading: page.hero.subheading,
      backgroundImage: page.hero.backgroundImage.url,
      primaryCta: page.hero.primaryCta,
      secondaryCta: {
        label: interpolateParts(page.hero.secondaryCta.label, values),
        href: interpolate(page.hero.secondaryCta.href, values),
      },
      stats: page.hero.stats,
    },
    about: aboutSectionView(s),
    services: {
      eyebrow: page.services.eyebrow,
      title: page.services.heading,
      description: page.services.intro,
      services: s.services.map(serviceCard),
      labels: serviceCardLabels(s),
    },
    enquireBanner: enquireBannerView(s),
    clients: clientsView(s),
    team: teamView(s, page.team),
    blog: {
      eyebrow: page.blog.eyebrow,
      heading: page.blog.heading,
      intro: page.blog.intro,
      cta: page.blog.cta,
      posts: listedArticles(s).slice(0, page.blog.count).map(blogCard),
      readArticle: s.settings.microcopy.blog.readArticle,
    },
    contact: contactSectionView(s),
    map: locationMapView(s),
  }
}
```


`templates/home/render.tsx`:

```tsx
import { About } from "@/components/home/about"
import { Blog, Clients, Team } from "@/components/home/clients-team-blog"
import { Contact, LocationMap } from "@/components/home/contact"
import { Hero } from "@/components/home/hero"
import { EnquireBanner, Services } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"

import type { HomeView } from "./view"

/** "/" — section order is the design's; content comes from the view. */
export function HomeTemplate({ view }: { view: HomeView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <Hero {...view.hero} />
        <About {...view.about} />
        <Services {...view.services} />
        <EnquireBanner {...view.enquireBanner} />
        <Clients {...view.clients} />
        <Team {...view.team} />
        <Blog {...view.blog} />
        <Contact {...view.contact} />
        <LocationMap {...view.map} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
```


`templates/about/view.ts`:

```ts
import type { AboutProps } from "@/components/home/about"
import type { StatsProps } from "@/components/about/stats"
import type { ClientsProps } from "@/components/home/clients-team-blog"
import type { IconCardsProps } from "@/components/home/icon-cards"
import type { PageHeroProps } from "@/components/home/page-hero"
import type { EnquireBannerProps } from "@/components/home/services"
import type { SiteSources } from "@/templates/shared/sources"
import {
  aboutSectionView,
  type ChromeView,
  chromeView,
  clientsView,
  enquireBannerView,
  pageHeroView,
} from "@/templates/shared/views"

export type AboutView = {
  chrome: ChromeView
  hero: PageHeroProps
  about: AboutProps
  stats: StatsProps
  values: IconCardsProps
  clients: ClientsProps
  enquireBanner: EnquireBannerProps
}

export function aboutView(s: SiteSources): AboutView {
  const page = s.pages.about.data
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    about: aboutSectionView(s),
    stats: { stats: page.stats },
    values: {
      eyebrow: page.values.eyebrow,
      title: page.values.title,
      description: page.values.description,
      items: page.values.items.map((item) => ({
        title: item.title,
        description: item.description,
        icon: item.icon.url,
      })),
    },
    clients: clientsView(s),
    enquireBanner: enquireBannerView(s),
  }
}
```


`templates/about/render.tsx`:

```tsx
import { Stats } from "@/components/about/stats"
import { About } from "@/components/home/about"
import { Clients } from "@/components/home/clients-team-blog"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"

import type { AboutView } from "./view"

/** "/about" */
export function AboutTemplate({ view }: { view: AboutView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <About {...view.about} />
        <Stats {...view.stats} />
        <IconCards {...view.values} />
        <Clients {...view.clients} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
```


`templates/services/view.ts`:

```ts
import type { ClientsProps } from "@/components/home/clients-team-blog"
import type { PageHeroProps } from "@/components/home/page-hero"
import type {
  EnquireBannerProps,
  ServicesProps,
} from "@/components/home/services"
import type { OtherServicesProps } from "@/components/services/other-services"
import type { ServiceBodyProps } from "@/components/services/service-body"
import type { WhyChooseUsProps } from "@/components/services/why-choose-us"
import type { SiteSources } from "@/templates/shared/sources"
import {
  type ChromeView,
  chromeView,
  clientsView,
  enquireBannerView,
  pageHeroView,
  placeholders,
  serviceCard,
  serviceCardLabels,
} from "@/templates/shared/views"

export type ServicesView = {
  chrome: ChromeView
  hero: PageHeroProps
  services: ServicesProps
  whyChooseUs: WhyChooseUsProps
  clients: ClientsProps
  enquireBanner: EnquireBannerProps
}

export function servicesView(s: SiteSources): ServicesView {
  const page = s.pages.services.data
  const why = s.settings["sections.whyChooseUs"]
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    services: {
      eyebrow: page.servicesSection.eyebrow,
      title: page.servicesSection.heading,
      description: page.servicesSection.intro,
      services: s.services.map(serviceCard),
      labels: serviceCardLabels(s),
    },
    whyChooseUs: {
      eyebrow: why.eyebrow,
      heading: why.heading,
      copy: why.copy,
      features: why.features.map((f) => ({
        title: f.title,
        description: f.description,
        icon: f.icon.url,
      })),
    },
    clients: clientsView(s),
    enquireBanner: enquireBannerView(s),
  }
}

export type ServiceDetailView = {
  chrome: ChromeView
  hero: PageHeroProps
  body: ServiceBodyProps
  others: OtherServicesProps
  enquireBanner: EnquireBannerProps
}

/** /services/[slug]; null for an unknown or unpublished slug (→ 404). */
export function serviceDetailView(
  s: SiteSources,
  slug: string
): ServiceDetailView | null {
  const index = s.services.findIndex((service) => service.slug === slug)
  if (index < 0) return null
  const service = s.services[index]
  const { content } = service
  const { microcopy } = s.settings
  const values = placeholders(s)
  // The next three services after this one, wrapping around the list.
  const others = [1, 2, 3]
    .map((offset) => s.services[(index + offset) % s.services.length])
    .filter((other) => other.slug !== slug)
  return {
    chrome: chromeView(s),
    hero: {
      image: content.heroImage.url,
      trail: [
        {
          label: microcopy.breadcrumb.services,
          href: microcopy.breadcrumb.servicesHref,
        },
      ],
      crumb: content.title,
      title: content.title,
      description: content.detail.intro,
      homeLabel: microcopy.breadcrumb.home,
      ariaLabel: microcopy.aria.breadcrumb,
    },
    body: {
      slug,
      image: { src: content.image.url, alt: content.imageAlt },
      heading: content.detail.heading,
      overview: content.detail.overview,
      included: content.detail.included,
      callout: content.detail.callout,
      phone24h: s.settings.contact.phone24h,
      phone24hHref: String(values.phone24hHref),
      allServices: s.services.map((x) => ({
        slug: x.slug,
        title: x.content.title,
      })),
      operations: {
        office: s.settings.contact.office,
        officeHref: String(values.officeHref),
        extension: s.settings.contact.operationsExtension,
        mobile: s.settings.contact.operationsMobile,
        mobileHref: String(values.operationsMobileHref),
        email: s.settings.contact.operationsEmail,
      },
      labels: {
        overviewEyebrow: microcopy.service.overviewEyebrow,
        includedHeading: microcopy.service.includedHeading,
        allServicesAria: microcopy.aria.allServices,
        allServicesHeading: microcopy.service.allServicesHeading,
        helpEyebrow: microcopy.service.helpEyebrow,
        helpHeading: microcopy.service.helpHeading,
        telLabel: microcopy.service.telLabel,
        orLabel: microcopy.service.orLabel,
        phone24hLabel: microcopy.service.phone24hLabel,
        cta: {
          label: microcopy.service.ctaLabel,
          href: microcopy.service.ctaHref,
        },
      },
    },
    others: {
      eyebrow: microcopy.service.otherEyebrow,
      heading: microcopy.service.otherHeading,
      intro: microcopy.service.otherIntro,
      services: others.map(serviceCard),
      labels: serviceCardLabels(s),
    },
    enquireBanner: enquireBannerView(s),
  }
}
```


`templates/services/render.tsx`:

```tsx
import { Clients } from "@/components/home/clients-team-blog"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner, Services } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { OtherServices } from "@/components/services/other-services"
import { ServiceBody } from "@/components/services/service-body"
import { WhyChooseUs } from "@/components/services/why-choose-us"
import { SiteLocale } from "@/components/site-locale"

import type { ServiceDetailView, ServicesView } from "./view"

/** "/services" */
export function ServicesTemplate({ view }: { view: ServicesView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <Services {...view.services} />
        <WhyChooseUs {...view.whyChooseUs} />
        <Clients {...view.clients} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}

/** "/services/[slug]" */
export function ServiceDetailTemplate({ view }: { view: ServiceDetailView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <ServiceBody {...view.body} />
        <OtherServices {...view.others} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
```


`templates/team/view.ts`:

```ts
import type { TeamProps } from "@/components/home/clients-team-blog"
import type { IconCardsProps } from "@/components/home/icon-cards"
import type { PageHeroProps } from "@/components/home/page-hero"
import type { EnquireBannerProps } from "@/components/home/services"
import type { SiteSources } from "@/templates/shared/sources"
import {
  type ChromeView,
  chromeView,
  enquireBannerView,
  pageHeroView,
  teamView as teamSectionView,
} from "@/templates/shared/views"

export type TeamView = {
  chrome: ChromeView
  hero: PageHeroProps
  team: TeamProps
  officers: IconCardsProps
  enquireBanner: EnquireBannerProps
}

export function teamView(s: SiteSources): TeamView {
  const page = s.pages.team.data
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    team: teamSectionView(s, page.leadership),
    officers: {
      eyebrow: page.officers.eyebrow,
      title: page.officers.title,
      description: page.officers.description,
      items: page.officers.qualities.map((q) => ({
        title: q.title,
        description: q.description,
        icon: q.icon.url,
      })),
      className: "bg-brand-surface",
    },
    enquireBanner: enquireBannerView(s),
  }
}
```


`templates/team/render.tsx`:

```tsx
import { Team } from "@/components/home/clients-team-blog"
import { IconCards } from "@/components/home/icon-cards"
import { PageHero } from "@/components/home/page-hero"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"

import type { TeamView } from "./view"

/** "/team" */
export function TeamTemplate({ view }: { view: TeamView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <Team {...view.team} />
        <IconCards {...view.officers} />
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
```


`templates/blog/view.ts`:

```ts
import type {
  ArticleBodyProps,
  ArticleHeaderProps,
} from "@/components/blog/article"
import type { BlogCardPost } from "@/components/blog/blog-card"
import type { BlogPostsProps } from "@/components/blog/blog-posts"
import type { PageHeroProps } from "@/components/home/page-hero"
import type { EnquireBannerProps } from "@/components/home/services"
import { interpolate } from "@/lib/interpolate"
import type { SiteSources } from "@/templates/shared/sources"
import {
  articleDates,
  authorOf,
  blogCard,
  type ChromeView,
  chromeView,
  enquireBannerView,
  featuredArticle,
  listedArticles,
  pageHeroView,
} from "@/templates/shared/views"

export type BlogView = {
  chrome: ChromeView
  hero: PageHeroProps
  posts: Omit<BlogPostsProps, "initialCategory">
  enquireBanner: EnquireBannerProps
}

export function blogView(s: SiteSources): BlogView {
  const page = s.pages.blog.data
  const { microcopy } = s.settings
  const featured = featuredArticle(s)
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    posts: {
      posts: listedArticles(s).map(blogCard),
      featured: featured
        ? { ...blogCard(featured), author: authorOf(featured) }
        : null,
      filters: s.categories.filter((c) => c.showInFilter).map((c) => c.name),
      pageSize: page.pageSize,
      labels: {
        allPosts: microcopy.blog.allPostsFilter,
        readArticle: microcopy.blog.readArticle,
        featuredBadge: microcopy.blog.featuredBadge,
        emptyCategory: microcopy.blog.emptyCategory,
        filterAria: microcopy.aria.blogFilter,
        paginationAria: microcopy.aria.pagination,
        previousPage: microcopy.aria.previousPage,
        pageNumber: microcopy.aria.pageNumber,
        nextPage: microcopy.aria.nextPage,
      },
    },
    enquireBanner: enquireBannerView(s),
  }
}

export type ArticleView = {
  chrome: ChromeView
  header: ArticleHeaderProps
  body: ArticleBodyProps
  related: {
    eyebrow: string
    heading: string
    posts: BlogCardPost[]
    readArticle: string
  }
}

/** /blog/[slug]; null for an unknown or unpublished slug (→ 404). */
export function articleView(s: SiteSources, slug: string): ArticleView | null {
  const article = s.articles.find((a) => a.slug === slug)
  if (!article) return null
  const { microcopy } = s.settings
  const { content } = article
  const category = article.category.name
  // The static site's lists never include the featured article.
  const others = listedArticles(s).filter((a) => a.slug !== slug)
  // Same category first, then the most recent posts.
  const related = [
    ...others.filter((a) => a.category.name === category),
    ...others.filter((a) => a.category.name !== category),
  ].slice(0, 3)
  return {
    chrome: chromeView(s),
    header: {
      article: {
        title: content.title,
        lead: content.lead ?? content.excerpt,
        category,
        ...articleDates(article),
        readTime:
          article.readTimeMinutes === null
            ? null
            : interpolate(microcopy.article.readTime, {
                n: article.readTimeMinutes,
              }),
        author: authorOf(article),
        cover: content.cover.url,
      },
      breadcrumb: {
        ariaLabel: microcopy.aria.breadcrumb,
        home: microcopy.breadcrumb.home,
        blog: microcopy.breadcrumb.blog,
        blogHref: microcopy.breadcrumb.blogHref,
      },
    },
    body: {
      body: content.body,
      excerpt: content.excerpt,
      tags: content.tags.length ? content.tags : [category],
      share: {
        title: content.title,
        label: microcopy.article.shareLabel,
        ariaTemplate: microcopy.aria.shareOn,
        networks: microcopy.share.networks,
      },
      recent: others.slice(0, 3).map((a) => ({
        slug: a.slug,
        title: a.content.title,
        cover: a.content.cover.url,
        ...articleDates(a),
      })),
      categories: s.categories
        .filter((c) => c.showInFilter)
        .map((c) => ({
          name: c.name,
          count: s.articles.filter((a) => a.category.slug === c.slug).length,
        })),
      labels: {
        tagsLabel: microcopy.article.tagsLabel,
        recentPostsHeading: microcopy.article.recentPostsHeading,
        categoriesAria: microcopy.aria.categories,
        categoriesHeading: microcopy.article.categoriesHeading,
      },
      cta: {
        eyebrow: microcopy.article.ctaEyebrow,
        heading: microcopy.article.ctaHeading,
        copy: microcopy.article.ctaCopy,
        link: {
          label: microcopy.article.ctaLabel,
          href: microcopy.article.ctaHref,
        },
      },
    },
    related: {
      eyebrow: microcopy.article.relatedEyebrow,
      heading: microcopy.article.relatedHeading,
      posts: related.map(blogCard),
      readArticle: microcopy.blog.readArticle,
    },
  }
}
```


`templates/blog/render.tsx`:

```tsx
import { ArticleBody, ArticleHeader } from "@/components/blog/article"
import { BlogCard } from "@/components/blog/blog-card"
import { PageHero } from "@/components/home/page-hero"
import { Container, SectionHeading } from "@/components/home/section"
import { EnquireBanner } from "@/components/home/services"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"

import type { ArticleView, BlogView } from "./view"

/**
 * "/blog". `posts` is passed separately because the initial category comes
 * from ?category= (request data, read inside Suspense by the page).
 */
export function BlogTemplate({
  view,
  posts,
}: {
  view: BlogView
  posts: React.ReactNode
}) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        {posts}
        <EnquireBanner {...view.enquireBanner} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}

/** "/blog/[slug]" */
export function ArticleTemplate({ view }: { view: ArticleView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <ArticleHeader {...view.header} />
        <ArticleBody {...view.body} />
        <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
          <Container className="flex flex-col gap-14">
            <SectionHeading
              eyebrow={view.related.eyebrow}
              title={view.related.heading}
            />
            <ul
              data-stagger
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {view.related.posts.map((item) => (
                <li key={item.slug}>
                  <BlogCard
                    post={item}
                    readArticle={view.related.readArticle}
                  />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
```


`templates/contact/view.ts`:

```ts
import type { ContactProps, LocationMapProps } from "@/components/home/contact"
import type { DepartmentsProps } from "@/components/contact/departments"
import type { PageHeroProps } from "@/components/home/page-hero"
import { interpolate } from "@/lib/interpolate"
import type { SiteSources } from "@/templates/shared/sources"
import {
  type ChromeView,
  chromeView,
  contactSectionView,
  locationMapView,
  pageHeroView,
  placeholders,
} from "@/templates/shared/views"

export type ContactView = {
  chrome: ChromeView
  hero: PageHeroProps
  contact: ContactProps
  departments: DepartmentsProps
  map: LocationMapProps
}

export function contactView(s: SiteSources): ContactView {
  const page = s.pages.contact.data
  const values = placeholders(s)
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero, { wideDescription: true }),
    contact: contactSectionView(s),
    departments: {
      eyebrow: page.departments.eyebrow,
      heading: page.departments.heading,
      intro: page.departments.intro,
      items: page.departments.items.map((item) => ({
        title: item.title,
        icon: item.icon.url,
        name: item.name,
        role: item.role,
        lines: item.lines.map((line) => ({
          text: interpolate(line.text, values),
          href: interpolate(line.href, values),
        })),
      })),
    },
    map: locationMapView(s),
  }
}
```


`templates/contact/render.tsx`:

```tsx
import { Departments } from "@/components/contact/departments"
import { Contact, LocationMap } from "@/components/home/contact"
import { PageHero } from "@/components/home/page-hero"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"

import type { ContactView } from "./view"

/** "/contact" */
export function ContactTemplate({ view }: { view: ContactView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <Contact {...view.contact} />
        <Departments {...view.departments} />
        <LocationMap {...view.map} />
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
```


`server/db/seed/fixtures/sources.ts`:

```ts
import "server-only"

import { type MediaView, replaceMediaRefs } from "@/lib/media"
import { PUBLIC_SETTINGS_KEYS } from "@/lib/schemas/settings"
import type { ArticleRecord } from "@/server/modules/articles/queries"
import { PAGE_KEYS } from "@/templates/registry"
import type { SiteSources } from "@/templates/shared/sources"

import { contentFixtures } from "./index"
import { fixtureMediaKey, fixtureMediaLookup, MEDIA } from "./media"

/** A fixture image served from public/ (no dimensions: the site does not use them). */
function staticMedia(id: string): MediaView {
  const key = fixtureMediaKey(id)
  return {
    id,
    url: key,
    alt: MEDIA.find((m) => m.key === key)?.alt ?? "",
    width: null,
    height: null,
    blurDataUrl: null,
  }
}

/**
 * SiteSources built straight from the seed fixtures, without a database:
 * the expected value for the DB-backed loader (tests/integration) and the
 * interim data source of the public pages until it exists.
 */
export function fixtureSiteSources(): SiteSources {
  const fx = contentFixtures(fixtureMediaLookup)
  const categories = fx.categories.map((c) => ({
    id: `category:${c.slug}`,
    ...c,
  }))
  const authors = new Map(fx.authors.map((a) => [a.email, a]))
  const articles: ArticleRecord[] = fx.articles.map((a) => {
    const category = categories.find((c) => c.slug === a.categorySlug)!
    const author = a.authorEmail ? authors.get(a.authorEmail)! : null
    return {
      id: `article:${a.slug}`,
      slug: a.slug,
      publishedAt: a.publishedAt,
      readTimeMinutes: a.readTimeMinutes,
      seo: a.seo,
      category: { slug: category.slug, name: category.name },
      author: author ? { name: author.name, title: author.title } : null,
      content: a.content,
    }
  })
  const sources = {
    settings: Object.fromEntries(
      PUBLIC_SETTINGS_KEYS.map((key) => [key, fx.settings[key]])
    ),
    pages: Object.fromEntries(
      PAGE_KEYS.map((key) => [
        key,
        { data: fx.pages[key].data, seo: fx.pages[key].seo },
      ])
    ),
    services: fx.services.map((s, sortOrder) => ({
      id: `service:${s.slug}`,
      slug: s.slug,
      sortOrder,
      seo: s.seo,
      content: s.content,
    })),
    articles,
    categories,
    team: fx.team.map((t) => ({ id: `team:${t.name}`, ...t })),
    clients: fx.clients.map((c) => ({ id: `client:${c.name}`, ...c })),
    groupCompanies: fx.groupCompanies.map((g) => ({
      id: `group:${g.name}`,
      ...g,
    })),
  }
  return replaceMediaRefs(sources, staticMedia) as SiteSources
}
```


`server/modules/pages/sources.ts` (interim; Task 9 replaces the body):

```ts
import "server-only"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import type { SiteSources } from "@/templates/shared/sources"

/**
 * Data for the public templates. Interim: served from the seed fixtures
 * (no database) so the props refactor can be verified on its own; the
 * next task reads it from the cached queries instead.
 */
export async function loadSiteSources(): Promise<SiteSources> {
  return fixtureSiteSources()
}
```

- [ ] **Step 5: Pages**

The root layout loses its static `metadata` (titles now come from each page); everything else is unchanged.

`app/(site)/layout.tsx` (full file):

```tsx
import { Geist_Mono, Lato } from "next/font/google"

import "../globals.css"
import { SmoothScroll } from "@/components/motion/smooth-scroll"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Title and description come from each page's generateMetadata (DB).
  // lang is part of the static shell; SiteLocale applies settings.site.locale.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        lato.variable
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body>
        <SmoothScroll />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```


`app/(site)/page.tsx`:

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { HomeTemplate } from "@/templates/home/render"
import { homeView } from "@/templates/home/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "home")
}

// Content is read per request inside Suspense (after connection()), so the
// build never touches the database. The fallback renders nothing.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  )
}

async function Home() {
  await connection()
  return <HomeTemplate view={homeView(await loadSiteSources())} />
}
```


`app/(site)/about/page.tsx`:

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { AboutTemplate } from "@/templates/about/render"
import { aboutView } from "@/templates/about/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "about")
}

export default function AboutPage() {
  return (
    <Suspense fallback={null}>
      <About />
    </Suspense>
  )
}

async function About() {
  await connection()
  return <AboutTemplate view={aboutView(await loadSiteSources())} />
}
```


`app/(site)/services/page.tsx`:

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { ServicesTemplate } from "@/templates/services/render"
import { servicesView } from "@/templates/services/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "services")
}

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <Services />
    </Suspense>
  )
}

async function Services() {
  await connection()
  return <ServicesTemplate view={servicesView(await loadSiteSources())} />
}
```


`app/(site)/services/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { ServiceDetailTemplate } from "@/templates/services/render"
import { serviceDetailView } from "@/templates/services/view"
import { serviceMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  return serviceMetadata(await loadSiteSources(), slug)
}

export default function ServiceDetailPage({
  params,
}: PageProps<"/services/[slug]">) {
  return (
    <Suspense fallback={null}>
      <ServiceDetail params={params} />
    </Suspense>
  )
}

async function ServiceDetail({
  params,
}: Pick<PageProps<"/services/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const view = serviceDetailView(await loadSiteSources(), slug)
  // Inside Suspense this is a soft 404 (200 + noindex): the shell has
  // already streamed (Cache Components; Next docs "Status codes").
  if (!view) notFound()
  return <ServiceDetailTemplate view={view} />
}
```


`app/(site)/team/page.tsx`:

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { TeamTemplate } from "@/templates/team/render"
import { teamView } from "@/templates/team/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "team")
}

export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <Team />
    </Suspense>
  )
}

async function Team() {
  await connection()
  return <TeamTemplate view={teamView(await loadSiteSources())} />
}
```


`app/(site)/blog/page.tsx`:

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { BlogPosts } from "@/components/blog/blog-posts"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { BlogTemplate } from "@/templates/blog/render"
import { blogView } from "@/templates/blog/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "blog")
}

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <Suspense fallback={null}>
      <Blog searchParams={searchParams} />
    </Suspense>
  )
}

async function Blog({
  searchParams,
}: Pick<PageProps<"/blog">, "searchParams">) {
  await connection()
  const [{ category }, sources] = await Promise.all([
    searchParams,
    loadSiteSources(),
  ])
  const view = blogView(sources)
  return (
    <BlogTemplate
      view={view}
      posts={
        <BlogPosts
          {...view.posts}
          initialCategory={typeof category === "string" ? category : undefined}
        />
      }
    />
  )
}
```


`app/(site)/blog/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { ArticleTemplate } from "@/templates/blog/render"
import { articleView } from "@/templates/blog/view"
import { articleMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  await connection()
  const { slug } = await params
  return articleMetadata(await loadSiteSources(), slug)
}

export default function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Article params={params} />
    </Suspense>
  )
}

async function Article({ params }: Pick<PageProps<"/blog/[slug]">, "params">) {
  await connection()
  const { slug } = await params
  const view = articleView(await loadSiteSources(), slug)
  // Soft 404 inside Suspense (see services/[slug]/page.tsx).
  if (!view) notFound()
  return <ArticleTemplate view={view} />
}
```


`app/(site)/contact/page.tsx`:

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { ContactTemplate } from "@/templates/contact/render"
import { contactView } from "@/templates/contact/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "contact")
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <Contact />
    </Suspense>
  )
}

async function Contact() {
  await connection()
  return <ContactTemplate view={contactView(await loadSiteSources())} />
}
```


`app/(site)/[...notFound]/page.tsx` (Phase 2) is unchanged.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/templates tests/unit/no-data-modules.test.ts`
Expected: PASS.

Run: `grep -rn 'data"' components app`
Expected: no output (master acceptance).

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: exit 0.

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: success; public routes show `◐` (Partial Prerender: static shell + streamed content), `/api/[...route]` `ƒ`.

- [ ] **Step 7: Visual gate (props refactor alone)**

Run: `pnpm test:visual`
Expected: `40 passed`. If a page differs by a few pixels in a line of text, look for a label/value pair rendered as three text nodes (`{a} {b}`) instead of two (see the parity rule); the diff image in `test-results/` shows where.

- [ ] **Step 8: Commit**

```bash
git add components templates server/db/seed/fixtures/sources.ts server/modules/pages/sources.ts "app/(site)" tests/unit/templates/views.test.ts tests/unit/no-data-modules.test.ts
git commit -m "refactor: render public pages from props built by page templates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Public pages read the database; seeded visual gate (master Task 3.6, part 1)

**Files:**
- Modify: `server/modules/pages/sources.ts` (cached queries instead of fixtures)
- Create: `tests/visual/seed.ts`
- Modify: `playwright.config.ts` (`webServer.command` seeds before `next start`), `tests/e2e/seed.ts` (content after the reset)
- Test: `tests/integration/pages/site-sources.test.ts`

**Interfaces:**
- Consumes: Task 6 queries + `resolveMedia`, Task 8 `SiteSources`/`fixtureSiteSources`, Task 5 `seedContent`, Phase 1 `runMigrations`/`closeDb`/`getEnv`, `tests/integration/db.ts` `resetDb`, Phase 2 `tests/e2e/env.ts` (`E2E_ENV`, `PORT`).
- Produces: `loadSiteSources(): Promise<SiteSources>` — `Promise.all` over `getSettings` (11 public keys), `getPage` (8 keys), `listServices`, `listArticles`, `listCategories`, `listTeam`, `listClients`, `listGroupCompanies`, then one `resolveMedia`. Missing published content throws `AppError("INTERNAL", "Missing published content: <what>. Run pnpm db:seed.")` (→ the site's error page in Task 10). Each query is cached and tagged, so a request costs memory lookups after the first.
- Visual harness: every Playwright run builds, then `pnpm tsx:server tests/visual/seed.ts` migrates `sp_e2e`, truncates it and seeds the content, then `next start` (fresh process = empty cache). The E2E setup (Phase 2) resets `sp_e2e` again and now re-seeds the content before creating its users, so `pnpm test:e2e` also has a public site.

- [ ] **Step 1: Write the failing test**

`tests/integration/pages/site-sources.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))

import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { loadSiteSources } from "@/server/modules/pages/sources"

import { resetDb } from "../db"

/** Ids differ between DB and fixtures; media compare by URL. */
function comparable(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (key === "id") return undefined
      if (v && typeof v === "object" && "url" in v && "blurDataUrl" in v)
        return v.url
      return v
    })
  )
}

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("loadSiteSources (DB) — Review Focus 1", () => {
  it("returns exactly what the static site rendered (the seed fixtures)", async () => {
    expect(comparable(await loadSiteSources())).toEqual(
      comparable(fixtureSiteSources())
    )
  })

  it("resolves seeded images to their public/ paths", async () => {
    const sources = await loadSiteSources()
    expect(sources.settings.site.logo).toMatchObject({
      url: "/images/logo.png",
      width: 140,
      height: 85,
    })
    expect(sources.clients[0].logo.url).toBe("/images/client-dinn-ri.png")
  })

  it("fails loudly (error page) when content is not seeded", async () => {
    await getDb().delete(settings).where(eq(settings.key, "footer"))
    await expect(loadSiteSources()).rejects.toThrow(
      "Missing published content: settings.footer. Run pnpm db:seed."
    )
  })
})
```


- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration tests/integration/pages/site-sources.test.ts`
Expected: FAIL — 2 of 3: `resolves seeded images to their public/ paths` (fixture media have no dimensions: `width: null`) and `fails loudly (error page) when content is not seeded` (`promise resolved … instead of rejecting`). The equality test already passes because the interim loader returns the fixtures themselves; it becomes meaningful once the loader reads the DB.

- [ ] **Step 3: Read the database**

`server/modules/pages/sources.ts` (full file):

```ts
import "server-only"

import { PUBLIC_SETTINGS_KEYS } from "@/lib/schemas/settings"
import { AppError } from "@/server/lib/errors"
import { listArticles } from "@/server/modules/articles/queries"
import {
  listCategories,
  listClients,
  listGroupCompanies,
  listTeam,
} from "@/server/modules/collections/queries"
import { resolveMedia } from "@/server/modules/media/queries"
import { getPage } from "@/server/modules/pages/queries"
import { listServices } from "@/server/modules/services/queries"
import { getSettings } from "@/server/modules/settings/queries"
import { PAGE_KEYS } from "@/templates/registry"
import type { SiteSources } from "@/templates/shared/sources"

function required<T>(value: T | null, what: string): T {
  if (value === null)
    throw new AppError(
      "INTERNAL",
      `Missing published content: ${what}. Run pnpm db:seed.`
    )
  return value
}

/**
 * Everything the public templates render, from the cached queries ('use
 * cache' + tags), with media resolved to URLs. Call only after
 * `await connection()` inside <Suspense> (no database at build time).
 */
export async function loadSiteSources(): Promise<SiteSources> {
  const [
    settingsValues,
    pageRecords,
    services,
    articles,
    categories,
    team,
    clients,
    groupCompanies,
  ] = await Promise.all([
    Promise.all(PUBLIC_SETTINGS_KEYS.map((key) => getSettings(key))),
    Promise.all(PAGE_KEYS.map((key) => getPage(key))),
    listServices(),
    listArticles(),
    listCategories(),
    listTeam(),
    listClients(),
    listGroupCompanies(),
  ])
  const settings = Object.fromEntries(
    PUBLIC_SETTINGS_KEYS.map((key, i) => [
      key,
      required(settingsValues[i], `settings.${key}`),
    ])
  )
  const pages = Object.fromEntries(
    PAGE_KEYS.map((key, i) => {
      const page = required(pageRecords[i], `page ${key}`)
      return [key, { data: page.data, seo: page.seo }]
    })
  )
  return (await resolveMedia({
    settings,
    pages,
    services,
    articles,
    categories,
    team,
    clients,
    groupCompanies,
  })) as SiteSources
}
```


- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:integration tests/integration/pages/site-sources.test.ts`
Expected: PASS (3 tests: DB sources equal the fixtures field for field, ids and media aside — Review Focus 1 end to end).

- [ ] **Step 5: Seed the database under test before `next start`**

`tests/visual/seed.ts`:

```ts
// Gives the server under test (playwright.config.ts webServer) a database
// with exactly the seeded content, so screenshots compare seed → Phase 0
// baselines. Runs before `next start` on every Playwright run:
//   pnpm tsx:server tests/visual/seed.ts   (env from tests/e2e/env.ts)
import { closeDb, getDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import { seedContent } from "@/server/db/seed"
import { getEnv } from "@/server/env"

import { resetDb } from "../integration/db"

const { DATABASE_URL } = getEnv()
const name = new URL(DATABASE_URL).pathname
if (!name.endsWith("_e2e"))
  throw new Error(`Refusing to reset a non-E2E database (${name})`)

await runMigrations(DATABASE_URL)
await resetDb()
const report = await seedContent(getDb())
await closeDb()
console.log(
  `[visual] ${name.slice(1)} reset and seeded (${report.pages} pages)`
)
```


In `playwright.config.ts` replace

```ts
    command: `pnpm build && pnpm start -p ${PORT}`,
```

with

```ts
    // Build (no DB), then reset + migrate + seed sp_e2e so pages render the
    // seeded content (tests/visual/seed.ts), then serve it.
    command: `pnpm build && pnpm tsx:server tests/visual/seed.ts && pnpm start -p ${PORT}`,
```

In `tests/e2e/seed.ts` (Phase 2): change `import { closeDb } from "@/server/db/client"` to `import { closeDb, getDb } from "@/server/db/client"`, add `import { seedContent } from "@/server/db/seed"` below it, and replace

```ts
await resetDb()
```

with

```ts
await resetDb()
// The public site needs its content (Phase 3); users are created below.
await seedContent(getDb())
```

- [ ] **Step 6: Visual gate against the seeded database (HARD GATE)**

Port 3100 must be free. Run: `pnpm test:visual`
Expected: `40 passed` — every public page now renders from Postgres (`sp_e2e`), 0 px difference on every baseline.

Check that the pages really read the DB: `psql postgres://sp:sp@127.0.0.1:5432/sp_e2e -tAc "select count(*) from pages"` → `8`.

Run: `pnpm test:e2e`
Expected: all Phase 2 E2E specs still pass.

Run: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0; the build still needs no database.

- [ ] **Step 7: Commit**

```bash
git add server/modules/pages/sources.ts tests/visual/seed.ts playwright.config.ts tests/e2e/seed.ts tests/integration/pages
git commit -m "feat: render public pages from the database

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Legal pages, public error page, public-site E2E (master Task 3.6, part 2)

**Files:**
- Create: `templates/legal/{view.ts,render.tsx}`, `app/(site)/privacy/page.tsx`, `app/(site)/terms/page.tsx`, `app/(site)/error.tsx`
- Modify: `docs/brief.md` (dated Change note)
- Test: `tests/unit/site-error.test.tsx`, `tests/e2e/public-site.spec.ts`

**Interfaces:**
- Consumes: Task 8 (`chromeView`, `pageHeroView`, `pageMetadata`, `loadSiteSources`, `SiteLocale`, `PageHero`, `ArticleBlocks`), Task 3 legal page data (seeded in Task 5), Phase 2 E2E harness (`e2e-setup` → `tests/e2e/seed.ts`, now seeding content).
- Produces:

```ts
// templates/legal/view.ts
export type LegalView = { chrome: ChromeView; hero: PageHeroProps; body: WithMedia<RichTextDoc> }
export function legalView(s: SiteSources, key: "privacy" | "terms"): LegalView
// templates/legal/render.tsx
export function LegalTemplate({ view }: { view: LegalView }): JSX.Element
// app/(site)/error.tsx — default export SiteError({ error, retry }) (Next 16.3 error boundary props)
```

- `/privacy` and `/terms` (spec §1.4 exception): header, existing `PageHero`, the article body styles in an 820px column, footer; copy is the seeded placeholder (owner review, brief §4). The footer links already point here (seeded `settings.footer.legal`).
- `app/(site)/error.tsx` (Review Focus 4): when a page cannot load (DB unreachable, content missing) the site's `PageHero` shows fixed copy and a "Try again" button calling `retry()`. It never prints the error (server errors reach the client as a digest only). It cannot read settings, so its copy is fixed in code.
- No `not-found.tsx` (ruling): unknown slugs render Next's default 404 UI inside the site layout — the same UI the `/this-page-does-not-exist` baseline pins — with `noindex`. Master acceptance "GSAP motion initialises" is tested with motion enabled: no console errors, `.js` on `<html>`, hero title revealed, the `18+` counter reaches its final value.

- [ ] **Step 1: Write the failing tests**

`tests/unit/site-error.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import SiteError from "@/app/(site)/error"

describe("public error page (Review Focus 4)", () => {
  it("renders the site's PageHero and a retry button, never error details", () => {
    const error = Object.assign(
      new Error(
        "connect ECONNREFUSED 127.0.0.1:5432 at Pool.connect (/app/server/db/client.ts:42)"
      ),
      { digest: "123" }
    )
    const html = renderToStaticMarkup(
      <SiteError error={error} retry={() => undefined} />
    )
    expect(html).toContain("data-hero")
    expect(html).toContain("Something went wrong")
    expect(html).toContain("Try again")
    expect(html).not.toContain("ECONNREFUSED")
    expect(html).not.toContain("client.ts")
  })
})
```


`tests/e2e/public-site.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

// Public site served from the seeded sp_e2e database (tests/e2e/seed.ts).

test.describe("public site from the database", () => {
  for (const path of ["/services/no-such-service", "/blog/no-such-article"]) {
    test(`unknown slug ${path} renders the 404 page, noindex`, async ({
      page,
    }) => {
      // Cache Components stream the shell first, so notFound() inside the
      // page's Suspense boundary is a soft 404: status 200 + noindex.
      await page.goto(path)
      await expect(
        page.getByRole("heading", { name: "This page could not be found." })
      ).toBeVisible()
      await expect(
        page.locator('meta[name="robots"][content*="noindex"]')
      ).not.toHaveCount(0)
    })
  }

  test("an unmatched URL is a real 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist")
    expect(response?.status()).toBe(404)
  })

  for (const [path, title] of [
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms of Use"],
  ] as const) {
    test(`${path} renders with the site's PageHero`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page.locator("[data-hero] h1")).toHaveText(title)
      await expect(
        page.getByRole("navigation", { name: "Breadcrumb" })
      ).toBeVisible()
      await expect(page.locator("article h2").first()).toBeVisible()
      await expect(page).toHaveTitle(`${title} | Security Partners Ltd.`)
    })
  }

  test("footer legal links point at /privacy and /terms", async ({ page }) => {
    await page.goto("/")
    const footer = page.locator("footer")
    await expect(
      footer.getByRole("link", { name: "Privacy Policy" })
    ).toHaveAttribute("href", "/privacy")
    await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms"
    )
  })
})

test.describe("GSAP motion still initialises on DB-rendered markup", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } })

  for (const path of ["/", "/services/alarm-responses"]) {
    test(`motion on ${path}`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (err) => errors.push(err.message))
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text())
      })
      await page.goto(path)
      await expect(page.locator("html")).toHaveClass(/\bjs\b/)
      // CSS hides hero pieces until GSAP's intro reveals them.
      await expect(page.locator("[data-hero-title]")).toBeVisible()
      await expect(page.locator("[data-hero-item]").first()).toHaveCSS(
        "opacity",
        "1"
      )
      if (path === "/")
        // the 18+ counter animates from 0 to its final value
        await expect(page.locator("[data-count]")).toHaveText("18+", {
          timeout: 10_000,
        })
      expect(errors).toEqual([])
    })
  }
})
```


- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/site-error.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/(site)/error"`.

Run: `pnpm exec playwright test tests/e2e/public-site.spec.ts` (the `e2e-setup` dependency still runs)
Expected: FAIL — the `/privacy` and `/terms` tests (the catch-all answers 404: `Expected: 200, Received: 404`); the 404, footer and motion tests pass.

- [ ] **Step 3: Legal template and pages**

`templates/legal/view.ts`:

```ts
import type { PageHeroProps } from "@/components/home/page-hero"
import type { WithMedia } from "@/lib/media"
import type { RichTextDoc } from "@/lib/schemas/common"
import type { SiteSources } from "@/templates/shared/sources"
import {
  type ChromeView,
  chromeView,
  pageHeroView,
} from "@/templates/shared/views"

export type LegalView = {
  chrome: ChromeView
  hero: PageHeroProps
  body: WithMedia<RichTextDoc>
}

export function legalView(s: SiteSources, key: "privacy" | "terms"): LegalView {
  const page = s.pages[key].data
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    body: page.body,
  }
}
```


`templates/legal/render.tsx`:

```tsx
import { PageHero } from "@/components/home/page-hero"
import { Container } from "@/components/home/section"
import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { HomeMotion } from "@/components/motion/home-motion"
import { SiteLocale } from "@/components/site-locale"
import { ArticleBlocks } from "@/lib/rich-text/render"

import type { LegalView } from "./view"

/**
 * "/privacy" and "/terms" (spec §1.4 exception): the existing PageHero and
 * the article body styles, in a single readable column.
 */
export function LegalTemplate({ view }: { view: LegalView }) {
  return (
    <>
      <SiteHeader {...view.chrome.header} />
      <main>
        <PageHero {...view.hero} />
        <section className="bg-white px-6 pt-14 pb-20 md:px-10 lg:pt-20 lg:pb-28">
          <Container>
            <article className="mx-auto flex max-w-[820px] min-w-0 flex-col gap-[22px]">
              <ArticleBlocks doc={view.body} />
            </article>
          </Container>
        </section>
      </main>
      <SiteFooter {...view.chrome.footer} />
      <HomeMotion />
      <SiteLocale lang={view.chrome.locale} />
    </>
  )
}
```


`app/(site)/privacy/page.tsx`:

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { LegalTemplate } from "@/templates/legal/render"
import { legalView } from "@/templates/legal/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "privacy")
}

export default function PrivacyPage() {
  return (
    <Suspense fallback={null}>
      <Privacy />
    </Suspense>
  )
}

async function Privacy() {
  await connection()
  return <LegalTemplate view={legalView(await loadSiteSources(), "privacy")} />
}
```


`app/(site)/terms/page.tsx`:

```tsx
import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { loadSiteSources } from "@/server/modules/pages/sources"
import { LegalTemplate } from "@/templates/legal/render"
import { legalView } from "@/templates/legal/view"
import { pageMetadata } from "@/templates/shared/page-meta"

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  return pageMetadata(await loadSiteSources(), "terms")
}

export default function TermsPage() {
  return (
    <Suspense fallback={null}>
      <Terms />
    </Suspense>
  )
}

async function Terms() {
  await connection()
  return <LegalTemplate view={legalView(await loadSiteSources(), "terms")} />
}
```


- [ ] **Step 4: Error page**

`app/(site)/error.tsx`:

```tsx
"use client"

import { useEffect } from "react"

import { buttonClassName } from "@/components/ui/button"
import { PageHero } from "@/components/home/page-hero"
import { Container } from "@/components/home/section"
import { HomeMotion } from "@/components/motion/home-motion"

/**
 * Public error boundary (Review Focus 4): shown when a page cannot load,
 * e.g. the database is unreachable. It cannot read settings, so its copy
 * is fixed here, styled with the site's own PageHero. No error details are
 * shown (production errors from the server carry only a digest).
 */
export default function SiteError({
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
    <>
      <main>
        <PageHero
          image="/images/hero.jpg"
          crumb="Error"
          title="Something went wrong"
          description="This page could not be loaded. Please try again in a moment."
          homeLabel="Home"
          ariaLabel="Breadcrumb"
        />
        <section className="bg-white px-6 py-20 md:px-10">
          <Container className="flex justify-center">
            <button
              type="button"
              onClick={() => retry()}
              className={buttonClassName({ variant: "brand", size: "pill" })}
            >
              Try again
            </button>
          </Container>
        </section>
      </main>
      <HomeMotion />
    </>
  )
}
```


- [ ] **Step 5: Brief change note**

Append to the `## Changes` list at the end of `docs/brief.md`:

```md
- 2026-10-16: Phase 3 content model. Fields added beyond the inventory: `settings.site.{name,legalName,logoOnDark,favicon,productionUrl,timezone}`, `settings.microcopy.article.readTime` ("{n} min read"), defaults for `seo.defaults`, `consent`, `tracking`, `customCode`, `leads`. About copy and service overviews are paragraph-only rich text; article bodies are TipTap JSON. Byline authors are seeded as banned users `@authors.invalid`. `<html lang>` is fixed in the static shell and `settings.site.locale` is applied after hydration. Unknown service/article slugs show the 404 page with `noindex` but HTTP 200 (Cache Components streaming); unmatched URLs return 404. `/privacy` and `/terms` carry placeholder copy for owner review.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/site-error.test.tsx`
Expected: PASS.

Run: `pnpm test:e2e`
Expected: all specs pass, including `tests/e2e/public-site.spec.ts` (9 tests: two soft 404s with noindex, real 404 for an unmatched URL, `/privacy`, `/terms`, footer legal links, motion on `/` and `/services/alarm-responses`).

- [ ] **Step 7: Phase gate**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: exit 0 (unit + integration).

Run: `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: success with no env and no database; `/privacy` and `/terms` listed as `◐`.

Run: `pnpm test:visual`
Expected: `40 passed` (seeded DB; legal pages are not in the baseline set and change nothing else).

- [ ] **Step 8: Commit**

```bash
git add templates/legal "app/(site)/privacy" "app/(site)/terms" "app/(site)/error.tsx" docs/brief.md tests/unit/site-error.test.tsx tests/e2e/public-site.spec.ts
git commit -m "feat: add legal pages, public error page and public-site e2e

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
