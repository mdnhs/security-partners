# Phase 8 — SEO, marketing, consent

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master Phase 8 = Tasks 8.1–8.3). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§5.4, §5.6, §6.1, §7, §8.1, §10, §13, §15). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Public design is frozen: `pnpm test:visual` keeps every public baseline at **0 px** (1440×900 and 390×844, macOS, port 3100 free). Everything this phase adds to public pages is invisible (metadata, JSON-LD `<script>`s, an empty Suspense boundary) — except the consent banner, which renders **only when `tracking.enabled` is true** (seeded `false`), and admin-only preview UI.
- `next build` succeeds with no env vars and no database (`env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`). Every new DB read on a public route sits after `await connection()` inside `<Suspense>`, in `generateMetadata`, in a route handler, or in `proxy.ts` (never runs at build).
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (+ `NODE_ENV`, `PORT`, `HOSTNAME`). Tracking IDs, consent copy, custom code and SEO defaults live in `settings`.
- Every file under `server/` starts with `import "server-only"`. `lib/**` never imports `server/**`. Only `server/modules/*/repo.ts` and `server/db/**` import `drizzle-orm`; routes never import repos.
- Hono handlers: validate (`zv`) → authorise (`can(...)`) → call a service; services re-check permissions and audit every mutation (`writeAudit`).
- Error envelope `{ error: { code, message, fieldErrors?, current?, requestId } }`; lists `?page&pageSize&sort=field:dir&q` → `{ items, page, pageSize, total }`; ids uuid v7; dates ISO 8601 UTC on the wire, shown in `Europe/Dublin` / `en-IE`.
- Permissions (spec §6.1): `seo` owner/admin/editor/marketer (+viewer read); `redirect` owner/admin/marketer (+viewer read) — **editors have no redirect permission**; `marketing` owner/admin/marketer (+viewer read); `customCode` **owner only**.
- Admin UI follows `phase-04b-jw-parity.md` → "Patterns for later phases (5–10) — binding": new **Growth** section between Content and Configuration with **SEO** (children Overview · Defaults · Redirects) and **Marketing** (children Tracking · Consent banner · Custom code — the last gated `customCode: ["update"]`), each sub-page a route tab (`SectionTabs` route mode, `heading` = section label); screens built from `components/admin/kit/*` (`PageHeader`, `DashboardCard`, `StatusPill`, `EmptyState`, skeletons, `PRIMARY_ACTION`/`FORM_ACTION`); records edited in place open in a right `Sheet` (`w-full bg-card sm:max-w-xl`); the SEO overview uses the ported JW **Gauge** and the dashboard gains the "Content health" gauge card.
- WCAG 2.2 AA in the admin and in the consent banner (visible focus, labelled controls, no colour-only status).
- Code style: repo Prettier (no semicolons, double quotes, 80 cols). Run `pnpm exec prettier --write <files>` on files you create or edit.
- Commit after every task, staging only your paths (`git add <paths>`; never `git add -A`); message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Only one agent at a time runs Playwright (`test:visual`, `test:e2e`) or `next build` (ledger ruling).
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` + `pnpm test:visual` + `pnpm test:e2e` (Postgres and Mailpit up: `pnpm db:up`).

**Prerequisites:** Phases 1–7 and Phase 4b complete. Real files used by name (read from the working tree): `proxy.ts`, `next.config.ts`, `app/(site)/layout.tsx`, `app/(site)/[...notFound]/page.tsx`, `app/(site)/{services,blog}/[slug]/page.tsx`, `templates/shared/{page-meta,views,sources}.ts`, `templates/registry.ts` (`PAGE_PATHS`, `PAGE_KEYS`), `server/modules/pages/sources.ts` (`loadSiteSources`), `server/modules/{pages,services,settings,media}/{queries,repo,service}.ts`, `server/modules/revisions/service.ts`, `server/lib/{versioning,media-usages,cache-tags,audit,errors,pg-errors,site-env}.ts`, `server/db/schema/{redirects,revisions,settings,pages,services,articles,media}.ts`, `server/db/seed/fixtures/{settings,sources}.ts`, `lib/schemas/common.ts` (`seo`, `link`, `httpUrl`, `mediaRef`, `isSafeHref`), `lib/schemas/settings/{seo-defaults,consent,tracking,custom-code,index}.ts`, `lib/schemas/api/{content,list,params}.ts`, `lib/href.ts`, `lib/interpolate.ts`, `lib/admin/{settings-keys,page-labels}.ts`, `lib/api-client.ts`, `lib/auth/permissions.ts`, `hooks/use-permission.ts`, `components/ui/{button,sheet,dialog,alert-dialog,switch,input,label,chart}.tsx`, `components/admin/{page-header,session-provider,providers}.tsx`, `components/admin/kit/*`, `components/admin/section-tabs/section-tabs.tsx`, `components/admin/editor/versioned-editor.tsx`, `components/admin/schema-form/{schema-form,editor-meta}.ts(x)`, `components/admin/data-table/data-table.tsx`, `components/admin/shell/nav.ts`, `components/admin/{pages/page-editor,services/service-editor}.tsx`, `tests/integration/{db.ts,helpers/auth.ts}`, `tests/e2e/{env,fixtures,seed}.ts`, `tests/unit/{proxy,admin/nav}.test.ts`, `tests/unit/templates/views.test.ts`, `tests/e2e/public-site.spec.ts`, `tests/visual/admin-screens.spec.ts`, `tests/e2e/admin-a11y.spec.ts`. From earlier phase plans (built before this phase): Phase 5 `server/modules/articles/{service,repo}.ts` (`changeArticleMeta`, `deleteArticle`, `storeFor`), `components/admin/articles/article-editor.tsx` (`VersionedEditor` with slot `actions`), `PATCH /api/v1/admin/articles/:id/meta`; Phase 6 `server/modules/media/service.ts` (`describeUsage`), `server/lib/media-usages.ts` (`backfillMediaUsages`); Phase 7 `components/home/contact-form.tsx` (posts to the leads API, `setFeedback({ kind: "success", … })`), migrations `0005`–`0007`; 04b `components/admin/kit/*`, `components/admin/dashboard/dashboard.tsx` (`Body`), `tests/e2e/fixtures.ts` fixtures `owner`, `admin`, `editor`. Where real code differs from those plans (names, file layout), apply the same change to the real code and say so in your report.

**Ledger rulings applied:** real 404 status for unknown service/article slugs (replaces the Phase 3 soft 404); redirects resolved before the 404 with a hit counter, loop detection (a→b→a → 422), `to_path` validated by the app href guard (`isSafeHref`), automatic 301 on slug change or delete of a published service/article; crawlers get metadata in `<head>` and the 404 page has a meta description; draft-aware public readers — the sitemap, robots and OG image routes and the consent/tracking/custom-code reader read **published rows only** (no `draftMode()`), while page metadata and JSON-LD go through `loadSiteSources()` (`assertPreviewAccess`); consent banner only when `tracking.enabled`, styled with site tokens and the site's `buttonClassName`, GTM/GA4/Meta pixel only after matching consent, typed `dataLayer` events, `consent.policyLink` rendered through `linkView`; custom code owner-only, CSP notes in the runbook; the revisions read allow-list (Phase 6) is extended per key (`customCode` owner-only); `proxy.ts` matches only GET/HEAD public pages besides `/admin` (never `/api`: the proxy buffers and truncates bodies over 10 MB); `invalidate()` = `revalidateTag(tag, { expire: 0 })`; never cache `getDb()` at module scope; `pg-errors.ts` reused; only one agent runs Playwright/build at a time.

**Verification note (2026-10-16):** the Next.js behaviours this plan relies on were checked against Next 16.3.8 in a scratch app (`scratchpad/p8probe`, outside the repo): (1) a `proxy.ts` that imports a `server-only` module using `pg` + `drizzle-orm` builds under Turbopack and runs per request; `NextResponse.rewrite()` to a path served by the `[...notFound]` catch-all returns a **real 404**, `NextResponse.redirect(url, 301)` returns 301; (2) with `cacheComponents`, a root-layout `generateMetadata` that awaits `connection()` builds and gives the catch-all 404 a meta description; (3) browsers get streamed metadata in `<body>` while bots get it in `<head>`, and **Lighthouse 13.5's user agent no longer contains `Chrome-Lighthouse`** — Lighthouse SEO on the current site scores **0.91** (`meta-description` 0) and **1.0** once `htmlLimitedBots: /.*/` makes metadata blocking for every client; (4) an inline `<script>` rendered by a server component inside `<Suspense>` runs in the browser (custom code uses one such loader from `<body>`, appending to `<head>`/`<body>`); (5) `next/og` `ImageResponse` in a Node route handler renders Lato `woff` fonts (latin subset covers "–" and "í"); Satori requires `display: flex` on any element with more than one child node, so dynamic text is passed as one template literal; (6) `schema-dts@2.1.0` has no `SecurityService` type (it has `LocalBusiness`, `ProfessionalService`, `Article`, `BreadcrumbList`); the JSON-LD builders below type-check against it.

## Corrections to master plan

- **Redirects and the real 404 live in `proxy.ts`, not in `app/(site)/[...notFound]/page.tsx`.** Under Cache Components a DB read before `notFound()` outside `<Suspense>` fails the build, and inside `<Suspense>` both `notFound()` and `redirect()` happen after the 200 is sent (Next docs `02-guides/streaming.md` "Status codes": "run that check in proxy"). The proxy matcher gains public GET routes (never `/api`, `/admin` keeps its gate); for `/services/:slug` and `/blog/:slug` it checks the slug is published, otherwise it looks up `redirects` (301/302 + hit counter) or rewrites to an unmatched path so the catch-all answers **404**; other unknown paths get the redirect lookup, then fall through to the catch-all 404. Requests with the draft-mode cookie skip the slug check (previews of unpublished records keep working, as a soft 404 if missing). The catch-all page stays `notFound()` — cost if wrong: one indexed query per detail/unknown-path request in the proxy.
- **`htmlLimitedBots: /.*/`** in `next.config.ts`: metadata becomes blocking (in `<head>`) for every client. Needed for "Lighthouse SEO 100 on home" (Lighthouse 13 no longer identifies itself as a bot) and gives the 404 page its description in `<head>` — cost: public pages no longer reuse the prerendered shell; TTFB waits for the cached metadata queries.
- **OG images are a route handler `app/og/[kind]/[slug]/route.tsx`**, not file-based `opengraph-image.tsx`: file-based images override `generateMetadata` images, which would make a per-record or default share image impossible. Order: record `seo.ogImage` → `seo.defaults.ogImage` → generated card — cost: none.
- **JSON-LD type:** schema.org has no `SecurityService`; the site-wide block is `LocalBusiness` (or its subtype `ProfessionalService`, chosen in SEO › Defaults). `settings.seo.defaults` gains `organization` (type, structured address, area served, `sameAs`) — custom migration `0008_seo_defaults_organization` backfills it — cost: one migration.
- **`settings.consent` gains `manageLabel`** ("Cookie settings"), the button that reopens the banner after a choice (withdrawal must be as easy as consent and the footer is frozen; the button exists only while tracking is enabled). Custom migration `0009_consent_manage_label` — cost: one small visible button when tracking is on.
- **Marketing/SEO settings API:** `seo.defaults`, `tracking`, `consent` and `customCode` keep the settings draft/publish model (spec §5.1) and are edited through `GET/PUT/POST /api/v1/admin/marketing/:key[/draft|/publish|/restore]` with per-key permissions (`lib/admin/growth-settings.ts`); the public site reads their **published** value only (no draft preview for tracking/custom code) — cost: none.
- **Per-record SEO** is the existing `seo` jsonb column of `pages`/`services`/`articles` (not versioned: saves apply at once, last write wins, the record's `version` is untouched) — `PUT /api/v1/admin/seo/entries/:kind/:id`, edited from SEO › Overview in a Sheet; the page/service/article editors get an "SEO" link to it. `VersionedStore` gains optional `mediaValues(record)` so `seo.ogImage` keeps its `media_usages` row through draft saves (otherwise the image could be deleted while in use and `resolveMedia` would break the page) — cost: one optional store hook.
- **Custom code injection:** React cannot place raw HTML in `<head>`, so each snippet is emitted server-side as one inline loader `<script>` that parses it with `Range.createContextualFragment` and appends it to `<head>`/end of `<body>` (its scripts run, once per page load). Verification `<meta>` tags therefore exist only after JavaScript runs — the runbook says to verify domains by DNS — cost if wrong: none for scripts; HTML-only verification tags would not be seen by non-JS crawlers.
- **Redirect rules beyond the master text:** `from_path` must be a plain path (no query, no trailing slash, no file extension), not `/`, not under `/admin`, `/api`, `/_next`, `/og`, `/images` or `/_…`, and not a live page; chains are capped at 5 hops; automatic moves also re-point redirects that targeted the old address and delete any redirect *from* the new address. Editors (no `redirect` permission) still trigger automatic redirects as a side effect of renaming/deleting — cost: none.
- **Dev dependencies not in the Tech Stack:** `schema-dts@2.1.0` (types only), `lighthouse@13.5.0` + `chrome-launcher@1.2.2` (the Lighthouse SEO gate). Fonts for OG cards: Lato latin `woff` 400/900 from `@fontsource/lato@5.3.0` committed under `assets/fonts/` (OFL) — cost: ~35 KB in the repo.

---

### Task 1: Page metadata — effective SEO, canonical, Open Graph, blocking metadata (master Task 8.1, part 1)

**Files:**
- Create: `lib/seo/urls.ts`, `lib/seo/effective.ts`, `server/lib/site-origin.ts`, `server/db/migrations/0008_seo_defaults_organization.sql` (custom migration + drizzle `meta/` journal entry)
- Modify: `lib/schemas/settings/seo-defaults.ts`, `server/db/seed/fixtures/settings.ts` (`"seo.defaults".organization`), `templates/shared/page-meta.ts` (full rewrite), `app/(site)/layout.tsx` (`generateMetadata`), `next.config.ts` (`htmlLimitedBots`), `tests/unit/templates/views.test.ts` (three `toEqual` → `toMatchObject`)
- Test: `tests/unit/seo/urls.test.ts`, `tests/unit/seo/effective.test.ts`, `tests/unit/templates/page-meta.test.ts`, `tests/integration/db/seo-defaults-migration.test.ts`, `tests/e2e/seo.spec.ts` (new file; later tasks append)

**Interfaces:**
- Consumes: `SiteSources` (`templates/shared/sources.ts`, media resolved to `MediaView`), `placeholders(s)` (`templates/shared/views.ts`), `interpolate` / `Placeholders` (`lib/interpolate.ts`), `PAGE_PATHS` (`templates/registry.ts`), `getEnv().BETTER_AUTH_URL`, `loadSiteSources()`.
- Produces:

```ts
// lib/seo/urls.ts
export function originOf(value: string | null | undefined): string | null
export function siteOrigin(productionUrl: string | null | undefined, fallback: string): string
export function absoluteUrl(origin: string, path: string): string
export const OG_IMAGE_SIZE: { readonly width: 1200; readonly height: 630 }
export const OG_KINDS: readonly ["page", "service", "article"]
export type OgKind = "page" | "service" | "article"
export function isOgKind(value: string): value is OgKind
export function ogImagePath(kind: OgKind, id: string): string            // "/og/<kind>/<id>"
// lib/seo/effective.ts
export function filled(value: string | null | undefined): string | null
export type EffectiveSeoInput = { seo: { title?: string; description?: string }; defaults: { title: string; titleTemplate: string; description: string }; name: string | null; fallbackDescription: string | null; values: Placeholders }
export type EffectiveSeo = { title: string; description: string; usesDefaultDescription: boolean }
export function effectiveSeo(input: EffectiveSeoInput): EffectiveSeo
// server/lib/site-origin.ts
export function publicOrigin(productionUrl: string | null): string      // productionUrl origin, else BETTER_AUTH_URL origin
// lib/schemas/settings/seo-defaults.ts
export const ORGANIZATION_TYPES: readonly ["LocalBusiness", "ProfessionalService"]
export const organizationSettings: z.ZodObject<…>
export type OrganizationSettings
// templates/shared/page-meta.ts (signatures kept, output extended)
export function pageMetadata(s: SiteSources, key: PageKey): Metadata
export function serviceMetadata(s: SiteSources, slug: string): Metadata   // {} for an unknown slug
export function articleMetadata(s: SiteSources, slug: string): Metadata   // {} for an unknown slug
export function siteMetadata(s: SiteSources, origin: string): Metadata    // metadataBase + default description
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/seo/urls.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  absoluteUrl,
  isOgKind,
  ogImagePath,
  originOf,
  siteOrigin,
} from "@/lib/seo/urls"

describe("site URLs", () => {
  it("originOf keeps only http(s) origins", () => {
    expect(originOf("https://www.example.ie/path?x=1")).toBe(
      "https://www.example.ie"
    )
    expect(originOf("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100")
    expect(originOf("javascript:alert(1)")).toBeNull()
    expect(originOf("not a url")).toBeNull()
    expect(originOf(null)).toBeNull()
  })

  it("siteOrigin prefers the production URL, else the deployment origin", () => {
    expect(siteOrigin("https://www.example.ie/", "http://localhost:3000")).toBe(
      "https://www.example.ie"
    )
    expect(siteOrigin(null, "http://localhost:3000/")).toBe(
      "http://localhost:3000"
    )
    expect(() => siteOrigin(null, "nope")).toThrow(/No site origin/)
  })

  it("absoluteUrl and the OG image path", () => {
    expect(absoluteUrl("https://x.ie", "/")).toBe("https://x.ie/")
    expect(absoluteUrl("https://x.ie", "/services/a")).toBe(
      "https://x.ie/services/a"
    )
    expect(ogImagePath("service", "alarm-responses")).toBe(
      "/og/service/alarm-responses"
    )
    expect(isOgKind("article")).toBe(true)
    expect(isOgKind("toString")).toBe(false)
  })
})
```

`tests/unit/seo/effective.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { effectiveSeo, filled } from "@/lib/seo/effective"

const defaults = {
  title: "Security Partners Ltd. | Watching Over You",
  titleTemplate: "{title} | Security Partners Ltd.",
  description: "Default description.",
}
const values = { phone24h: "(085) 8018746" }

describe("effective SEO (record → fallbacks → site defaults)", () => {
  it("filled treats blank strings as unset", () => {
    expect(filled("  ")).toBeNull()
    expect(filled("")).toBeNull()
    expect(filled(undefined)).toBeNull()
    expect(filled("x")).toBe("x")
  })

  it("home: the site title and the default description", () => {
    expect(
      effectiveSeo({
        seo: {},
        defaults,
        name: null,
        fallbackDescription: null,
        values,
      })
    ).toEqual({
      title: defaults.title,
      description: "Default description.",
      usesDefaultDescription: true,
    })
  })

  it("records use the title template and their own fallback description", () => {
    expect(
      effectiveSeo({
        seo: { title: "" },
        defaults,
        name: "Alarm Responses",
        fallbackDescription: "Call {phone24h} any time.",
        values,
      })
    ).toEqual({
      title: "Alarm Responses | Security Partners Ltd.",
      description: "Call (085) 8018746 any time.",
      usesDefaultDescription: false,
    })
  })

  it("explicit SEO fields win and are interpolated", () => {
    expect(
      effectiveSeo({
        seo: { title: "24/7 on {phone24h}", description: "Own text" },
        defaults,
        name: "Ignored",
        fallbackDescription: "Ignored",
        values,
      })
    ).toEqual({
      title: "24/7 on (085) 8018746",
      description: "Own text",
      usesDefaultDescription: false,
    })
  })
})
```

`tests/unit/templates/page-meta.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { interpolate } from "@/lib/interpolate"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import {
  articleMetadata,
  pageMetadata,
  serviceMetadata,
  siteMetadata,
} from "@/templates/shared/page-meta"

const s = fixtureSiteSources()
const defaults = s.settings["seo.defaults"]

describe("public page metadata (spec §10)", () => {
  it("home: site title, canonical /, generated share card, large Twitter card", () => {
    const meta = pageMetadata(s, "home")
    expect(meta.title).toBe("Security Partners Ltd. | Watching Over You")
    expect(meta.alternates).toEqual({ canonical: "/" })
    expect(meta.robots).toBeUndefined()
    expect(meta.openGraph).toMatchObject({
      type: "website",
      url: "/",
      siteName: s.settings.site.name,
      title: "Security Partners Ltd. | Watching Over You",
      images: [{ url: "/og/page/home", width: 1200, height: 630 }],
    })
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/og/page/home"],
    })
  })

  it("a record's own SEO wins; blank fields fall back", () => {
    const custom = structuredClone(s)
    custom.pages.about.seo = {
      title: "",
      description: "Custom about",
      canonical: "https://example.ie/about-us",
      noindex: true,
      ogImage: {
        id: "m1",
        url: "/images/about.png",
        alt: "Our team",
        width: 800,
        height: 600,
        blurDataUrl: null,
      },
    }
    const meta = pageMetadata(custom, "about")
    expect(meta.title).toBe(
      interpolate(defaults.titleTemplate, {
        title: custom.pages.about.data.hero.title,
      })
    )
    expect(meta.description).toBe("Custom about")
    expect(meta.alternates).toEqual({
      canonical: "https://example.ie/about-us",
    })
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(meta.openGraph).toMatchObject({
      images: [
        { url: "/images/about.png", width: 800, height: 600, alt: "Our team" },
      ],
    })
  })

  it("the site default share image applies when a record has none", () => {
    const custom = structuredClone(s)
    custom.settings["seo.defaults"].ogImage = {
      id: "m2",
      url: "/images/banner.png",
      alt: "",
      width: null,
      height: null,
      blurDataUrl: null,
    }
    expect(serviceMetadata(custom, "alarm-responses").openGraph).toMatchObject({
      images: [{ url: "/images/banner.png" }],
    })
  })

  it("services: canonical /services/<slug>, intro as description", () => {
    const service = s.services.find((x) => x.slug === "alarm-responses")!
    const meta = serviceMetadata(s, "alarm-responses")
    expect(meta.alternates).toEqual({ canonical: "/services/alarm-responses" })
    expect(meta.description).toBe(service.content.detail.intro)
    expect(meta.openGraph).toMatchObject({
      type: "website",
      images: [{ url: "/og/service/alarm-responses" }],
    })
    expect(serviceMetadata(s, "nope")).toEqual({})
  })

  it("articles: Open Graph article with published time, section and tags", () => {
    const article = s.articles.find((a) => a.slug === "key-holding-explained")!
    const meta = articleMetadata(s, "key-holding-explained")
    expect(meta.alternates).toEqual({
      canonical: "/blog/key-holding-explained",
    })
    expect(meta.openGraph).toMatchObject({
      type: "article",
      url: "/blog/key-holding-explained",
      section: article.category.name,
      publishedTime: article.publishedAt!.toISOString(),
      images: [{ url: "/og/article/key-holding-explained" }],
    })
    expect(articleMetadata(s, "nope")).toEqual({})
  })

  it("siteMetadata: metadataBase is the origin, default description for pages without one", () => {
    const meta = siteMetadata(s, "https://www.securitypartnersltd.com")
    expect(meta.metadataBase?.toString()).toBe(
      "https://www.securitypartnersltd.com/"
    )
    expect(meta.description).toBe(defaults.description)
  })
})
```

`tests/integration/db/seo-defaults-migration.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { seoDefaultsSettings } from "@/lib/schemas/settings/seo-defaults"
import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) =>
  f.endsWith("_seo_defaults_organization.sql")
)!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

const legacy = {
  title: "T",
  titleTemplate: "{title} | T",
  description: "D",
  ogImage: null,
}

async function migrate() {
  for (const statement of statements) await getDb().execute(sql.raw(statement))
}

beforeEach(resetDb)

describe("0008_seo_defaults_organization (custom data migration)", () => {
  it("adds organization to old rows and keeps values already there", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "seo.defaults",
        draft: { ...legacy, organization: { areaServed: "Leinster" } },
        published: legacy,
        version: 3,
      })
    await migrate()
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "seo.defaults"))
    const published = seoDefaultsSettings.parse(row.published)
    expect(published.organization).toEqual({
      type: "LocalBusiness",
      streetAddress: "Derryguile",
      addressLocality: "Mountmellick",
      addressRegion: "Co. Laois",
      postalCode: "R32 YX49",
      addressCountry: "IE",
      areaServed: "Ireland",
      sameAs: [],
    })
    expect(seoDefaultsSettings.parse(row.draft).organization.areaServed).toBe(
      "Leinster"
    )
    expect(row.version).toBe(3)
  })

  it("leaves an unpublished row's published value null and is safe to re-run", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "seo.defaults", draft: legacy, published: null })
    await migrate()
    await migrate()
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "seo.defaults"))
    expect(row.published).toBeNull()
    expect(seoDefaultsSettings.safeParse(row.draft).success).toBe(true)
  })
})
```

`tests/e2e/seo.spec.ts` (new file; Tasks 2, 3, 5 and 6 append `test.describe` blocks to it):

```ts
import { expect, test } from "@playwright/test"

import { BASE_URL } from "./env"

// Phase 8: what search engines and social networks receive. Metadata is
// blocking (htmlLimitedBots), so it is in <head> for every client.

const headOf = (html: string) => html.slice(0, html.indexOf("</head>"))
const meta = (head: string, key: string) =>
  new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`).exec(
    head
  )?.[1] ?? null
const canonical = (head: string) =>
  /<link rel="canonical" href="([^"]*)"/.exec(head)?.[1] ?? null

test.describe("metadata in <head>", () => {
  test("home: title, description, canonical, Open Graph, Twitter", async ({
    request,
  }) => {
    const res = await request.get("/")
    expect(res.status()).toBe(200)
    const head = headOf(await res.text())
    expect(head).toContain(
      "<title>Security Partners Ltd. | Watching Over You</title>"
    )
    expect(meta(head, "description")).toMatch(/^Proactive, flexible/)
    expect(canonical(head)).toBe(`${BASE_URL}/`)
    expect(meta(head, "og:type")).toBe("website")
    expect(meta(head, "og:image")).toBe(`${BASE_URL}/og/page/home`)
    expect(meta(head, "twitter:card")).toBe("summary_large_image")
  })

  test("service and article pages", async ({ request }) => {
    const service = headOf(
      await (await request.get("/services/alarm-responses")).text()
    )
    expect(canonical(service)).toBe(`${BASE_URL}/services/alarm-responses`)
    expect(meta(service, "og:image")).toBe(
      `${BASE_URL}/og/service/alarm-responses`
    )
    const article = headOf(
      await (await request.get("/blog/key-holding-explained")).text()
    )
    expect(meta(article, "og:type")).toBe("article")
    expect(meta(article, "article:published_time")).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test("the 404 page has the default description and noindex", async ({
    request,
  }) => {
    const res = await request.get("/this-page-does-not-exist")
    expect(res.status()).toBe(404)
    const head = headOf(await res.text())
    expect(meta(head, "description")).toMatch(/^Proactive, flexible/)
    expect(head).toMatch(/<meta name="robots" content="noindex"/)
  })

  test("a browser also gets the description in document.head", async ({
    page,
  }) => {
    await page.goto("/about")
    await expect(page.locator('head meta[name="description"]')).toHaveCount(1)
    await expect(page.locator('body meta[name="description"]')).toHaveCount(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/seo tests/unit/templates/page-meta.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/seo/urls"` / `"@/lib/seo/effective"`; `siteMetadata` is not exported.

Run: `pnpm test:integration tests/integration/db/seo-defaults-migration.test.ts`
Expected: FAIL — `TypeError: Cannot read properties of undefined` (no `*_seo_defaults_organization.sql` file).

- [ ] **Step 3: Implement**

`lib/seo/urls.ts`:

```ts
// Absolute URLs of the public site (canonical, sitemap, JSON-LD, share
// images). Isomorphic: no server imports.

/** Origin of an absolute http(s) URL, or null. */
export function originOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null
  } catch {
    return null
  }
}

/**
 * The origin search engines should see: settings.site.productionUrl when
 * set (staging copies still point canonical URLs at production), else the
 * deployment's own origin (BETTER_AUTH_URL).
 */
export function siteOrigin(
  productionUrl: string | null | undefined,
  fallback: string
): string {
  const origin = originOf(productionUrl) ?? originOf(fallback)
  if (!origin)
    throw new Error(
      "No site origin: set settings.site.productionUrl or BETTER_AUTH_URL"
    )
  return origin
}

export function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString()
}

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const

export const OG_KINDS = ["page", "service", "article"] as const
export type OgKind = (typeof OG_KINDS)[number]

export function isOgKind(value: string): value is OgKind {
  return (OG_KINDS as readonly string[]).includes(value)
}

/** The generated share card of a page (key), service or article (slug). */
export const ogImagePath = (kind: OgKind, id: string) =>
  `/og/${kind}/${encodeURIComponent(id)}`
```

`lib/seo/effective.ts`:

```ts
import { interpolate, type Placeholders } from "@/lib/interpolate"

/** A stored SEO string, or null when blank (a cleared field means "use the fallback"). */
export function filled(value: string | null | undefined): string | null {
  return value && value.trim() !== "" ? value : null
}

export type EffectiveSeoInput = {
  seo: { title?: string; description?: string }
  defaults: { title: string; titleTemplate: string; description: string }
  /** The record's name for "{title} | …"; null = the site title (home). */
  name: string | null
  /** Record-specific description (service intro, article excerpt). */
  fallbackDescription: string | null
  /** Settings › Contact placeholders ({phone24h} …). */
  values: Placeholders
}

export type EffectiveSeo = {
  title: string
  description: string
  /** True when the site-wide default description is used (SEO check). */
  usesDefaultDescription: boolean
}

/**
 * The <title> and description a public URL renders (spec §10): the
 * record's SEO fields, else its own fallbacks, else seo.defaults. Shared by
 * generateMetadata and the admin SEO overview, so both always agree.
 */
export function effectiveSeo(input: EffectiveSeoInput): EffectiveSeo {
  const title =
    filled(input.seo.title) ??
    (input.name === null
      ? input.defaults.title
      : interpolate(input.defaults.titleTemplate, { title: input.name }))
  const own =
    filled(input.seo.description) ?? filled(input.fallbackDescription)
  return {
    title: interpolate(title, input.values),
    description: interpolate(own ?? input.defaults.description, input.values),
    usesDefaultDescription: own === null,
  }
}
```

`server/lib/site-origin.ts`:

```ts
import "server-only"

import { siteOrigin } from "@/lib/seo/urls"
import { getEnv } from "@/server/env"

/** Origin for canonical URLs, sitemap, robots and JSON-LD. Request time only. */
export function publicOrigin(productionUrl: string | null): string {
  return siteOrigin(productionUrl, getEnv().BETTER_AUTH_URL)
}
```

`lib/schemas/settings/seo-defaults.ts` (full file):

```ts
import { z } from "zod"

import { httpUrl, mediaRef, text } from "../common"

/** schema.org types the business presents as (schema.org has no "SecurityService"). */
export const ORGANIZATION_TYPES = [
  "LocalBusiness",
  "ProfessionalService",
] as const

/** Business facts for the site-wide JSON-LD (spec §10). */
export const organizationSettings = z.object({
  type: z.enum(ORGANIZATION_TYPES),
  streetAddress: text,
  addressLocality: text,
  addressRegion: text,
  postalCode: text,
  addressCountry: z
    .string()
    .regex(/^[A-Z]{2}$/, "Two capital letters, e.g. IE"),
  areaServed: text,
  /** Official profiles (LinkedIn, Facebook …). */
  sameAs: z.array(httpUrl).max(10),
})
export type OrganizationSettings = z.infer<typeof organizationSettings>

/** settings.seo.defaults — site title, "{title} | …" template, default description, share image, business facts. */
export const seoDefaultsSettings = z.object({
  title: text,
  titleTemplate: text,
  description: text,
  ogImage: mediaRef.nullable(),
  organization: organizationSettings,
})
export type SeoDefaultsSettings = z.infer<typeof seoDefaultsSettings>
```

`server/db/seed/fixtures/settings.ts` — inside `"seo.defaults"`, after `ogImage: null,` add:

```ts
      organization: {
        type: "LocalBusiness",
        streetAddress: "Derryguile",
        addressLocality: "Mountmellick",
        addressRegion: "Co. Laois",
        postalCode: "R32 YX49",
        addressCountry: "IE",
        areaServed: "Ireland",
        sameAs: [],
      },
```

Create the custom migration:

```bash
pnpm db:generate --custom --name seo_defaults_organization
```

Expected: an empty `server/db/migrations/0008_seo_defaults_organization.sql` (the next free number after Phase 7's `0007`; if the number differs, keep the generated one — the test finds the file by suffix) and an updated `meta/_journal.json`. Write into the SQL file:

```sql
-- Phase 8: settings.seo.defaults gains `organization` (site-wide JSON-LD).
-- Adds missing keys only; values already present win (right side of ||).
UPDATE "settings"
SET
  "draft" = jsonb_set(
    "draft",
    '{organization}',
    '{"type":"LocalBusiness","streetAddress":"Derryguile","addressLocality":"Mountmellick","addressRegion":"Co. Laois","postalCode":"R32 YX49","addressCountry":"IE","areaServed":"Ireland","sameAs":[]}'::jsonb
      || CASE WHEN jsonb_typeof("draft" -> 'organization') = 'object' THEN "draft" -> 'organization' ELSE '{}'::jsonb END
  ),
  "published" = CASE
    WHEN jsonb_typeof("published") = 'object'
    THEN jsonb_set(
      "published",
      '{organization}',
      '{"type":"LocalBusiness","streetAddress":"Derryguile","addressLocality":"Mountmellick","addressRegion":"Co. Laois","postalCode":"R32 YX49","addressCountry":"IE","areaServed":"Ireland","sameAs":[]}'::jsonb
        || CASE WHEN jsonb_typeof("published" -> 'organization') = 'object' THEN "published" -> 'organization' ELSE '{}'::jsonb END
    )
    ELSE "published"
  END
WHERE "key" = 'seo.defaults' AND jsonb_typeof("draft") = 'object';
```

`templates/shared/page-meta.ts` (full file):

```ts
import type { Metadata } from "next"

import { interpolate } from "@/lib/interpolate"
import type { MediaView } from "@/lib/media"
import { effectiveSeo, filled } from "@/lib/seo/effective"
import { OG_IMAGE_SIZE, type OgKind, ogImagePath } from "@/lib/seo/urls"
import { PAGE_PATHS, type PageKey } from "@/templates/registry"

import type { SiteSources } from "./sources"
import { placeholders } from "./views"

// <head> metadata per public URL (spec §10): title/description with
// fallbacks to seo.defaults (lib/seo/effective.ts), canonical, robots,
// Open Graph and Twitter cards. Relative URLs resolve against the
// metadataBase set by app/(site)/layout.tsx (siteMetadata).

type SiteSeo = SiteSources["pages"]["home"]["seo"]

type Subject = {
  kind: OgKind
  /** Page key or slug: the generated card's address (/og/<kind>/<id>). */
  id: string
  path: string
  seo: SiteSeo
  /** Record name for "{title} | …"; null = the site title (home). */
  name: string | null
  fallbackDescription: string | null
  article?: {
    publishedTime: string | null
    section: string
    tags: string[]
    author: string | null
  }
}

type ShareImage = {
  url: string
  width?: number
  height?: number
  alt?: string
}

/** The record's own image, else the site default, else the generated card. */
function shareImage(s: SiteSources, subject: Subject): ShareImage {
  const media: MediaView | null =
    subject.seo.ogImage ?? s.settings["seo.defaults"].ogImage
  if (media)
    return {
      url: media.url,
      ...(media.width && media.height
        ? { width: media.width, height: media.height }
        : {}),
      ...(media.alt ? { alt: media.alt } : {}),
    }
  return { url: ogImagePath(subject.kind, subject.id), ...OG_IMAGE_SIZE }
}

function metadataFor(s: SiteSources, subject: Subject): Metadata {
  const { title, description } = effectiveSeo({
    seo: subject.seo,
    defaults: s.settings["seo.defaults"],
    name: subject.name,
    fallbackDescription: subject.fallbackDescription,
    values: placeholders(s),
  })
  const image = shareImage(s, subject)
  const shared = {
    url: subject.path,
    siteName: s.settings.site.name,
    title,
    description,
    images: [image],
  }
  const { article } = subject
  return {
    title,
    description,
    alternates: { canonical: filled(subject.seo.canonical) ?? subject.path },
    ...(subject.seo.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: article
      ? {
          ...shared,
          type: "article",
          ...(article.publishedTime
            ? { publishedTime: article.publishedTime }
            : {}),
          section: article.section,
          ...(article.tags.length > 0 ? { tags: article.tags } : {}),
          ...(article.author ? { authors: [article.author] } : {}),
        }
      : { ...shared, type: "website" },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  }
}

export function pageMetadata(s: SiteSources, key: PageKey): Metadata {
  const page = s.pages[key]
  return metadataFor(s, {
    kind: "page",
    id: key,
    path: PAGE_PATHS[key],
    seo: page.seo,
    name:
      key === "home"
        ? null
        : (page.data as { hero: { title: string } }).hero.title,
    fallbackDescription: null,
  })
}

export function serviceMetadata(s: SiteSources, slug: string): Metadata {
  const service = s.services.find((x) => x.slug === slug)
  if (!service) return {}
  return metadataFor(s, {
    kind: "service",
    id: slug,
    path: `/services/${slug}`,
    seo: service.seo,
    name: service.content.title,
    fallbackDescription: service.content.detail.intro,
  })
}

export function articleMetadata(s: SiteSources, slug: string): Metadata {
  const article = s.articles.find((a) => a.slug === slug)
  if (!article) return {}
  return metadataFor(s, {
    kind: "article",
    id: slug,
    path: `/blog/${slug}`,
    seo: article.seo,
    name: article.content.title,
    fallbackDescription: article.content.excerpt,
    article: {
      publishedTime: article.publishedAt?.toISOString() ?? null,
      section: article.category.name,
      tags: article.content.tags,
      author: article.author?.name ?? null,
    },
  })
}

/**
 * Root-layout metadata: metadataBase (canonical, og:url and share images
 * become absolute on the production origin) and the default description,
 * which the 404 page (no metadata of its own) inherits.
 */
export function siteMetadata(s: SiteSources, origin: string): Metadata {
  return {
    metadataBase: new URL(origin),
    description: interpolate(
      s.settings["seo.defaults"].description,
      placeholders(s)
    ),
  }
}
```

`app/(site)/layout.tsx` — add imports `import type { Metadata } from "next"`, `import { unstable_rethrow } from "next/navigation"`, `import { connection } from "next/server"`, `import { publicOrigin } from "@/server/lib/site-origin"`, `import { loadSiteSources } from "@/server/modules/pages/sources"`, `import { siteMetadata } from "@/templates/shared/page-meta"`, and add above `export default function RootLayout`:

```tsx
/**
 * Site-wide metadata (metadataBase, default description for the 404 page).
 * Never fails the page: with the database down the page's own boundary
 * (error.tsx) reports it, so this returns nothing instead of throwing.
 */
export async function generateMetadata(): Promise<Metadata> {
  await connection()
  try {
    const s = await loadSiteSources()
    return siteMetadata(s, publicOrigin(s.settings.site.productionUrl))
  } catch (error) {
    unstable_rethrow(error)
    return {}
  }
}
```

`next.config.ts` — inside `nextConfig`, after `cacheComponents: true,`:

```ts
  // Blocking metadata for every client: title, description, canonical and
  // Open Graph tags are in <head>, never streamed into <body>. Lighthouse 13
  // no longer identifies itself as a bot, and the SEO gate (Lighthouse SEO
  // 100) needs the description in <head> (phase-08 correction).
  htmlLimitedBots: /.*/,
```

`tests/unit/templates/views.test.ts` — in "metadata matches the static site's titles and descriptions": change `expect(pageMetadata(s, "home")).toEqual({`, `expect(serviceMetadata(s, "alarm-responses")).toEqual({` and `expect(articleMetadata(s, "key-holding-explained")).toEqual({` to `.toMatchObject({` (the metadata now also carries canonical, Open Graph and Twitter fields). Leave `expect(serviceMetadata(s, "nope")).toEqual({})` unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/seo tests/unit/templates tests/unit/schemas/settings.test.ts`
Expected: PASS (urls 3, effective 4, page-meta 6; views and settings-fixture parsing unchanged).

Run: `pnpm db:migrate && pnpm test:integration tests/integration/db/seo-defaults-migration.test.ts tests/integration/seed/seed.test.ts tests/integration/pages/site-sources.test.ts`
Expected: PASS.

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: clean; the build prints no `blocking-prerender-metadata` error (the (site) layout already holds a dynamic `<PreviewBar>` boundary).

Run: `pnpm test:e2e tests/e2e/seo.spec.ts tests/e2e/public-site.spec.ts` then `pnpm test:visual`
Expected: seo 4 passed, public-site unchanged; visual 0 px on every public baseline (metadata is not rendered).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write lib/seo server/lib/site-origin.ts lib/schemas/settings/seo-defaults.ts server/db/seed/fixtures/settings.ts templates/shared/page-meta.ts "app/(site)/layout.tsx" next.config.ts tests/unit/seo tests/unit/templates/page-meta.test.ts tests/unit/templates/views.test.ts tests/integration/db/seo-defaults-migration.test.ts tests/e2e/seo.spec.ts
git add lib/seo server/lib/site-origin.ts lib/schemas/settings/seo-defaults.ts server/db/seed/fixtures/settings.ts server/db/migrations templates/shared/page-meta.ts "app/(site)/layout.tsx" next.config.ts tests/unit/seo tests/unit/templates/page-meta.test.ts tests/unit/templates/views.test.ts tests/integration/db/seo-defaults-migration.test.ts tests/e2e/seo.spec.ts
git commit -m "$(cat <<'EOF'
feat(seo): canonical, Open Graph and blocking metadata for public pages

Titles and descriptions fall back record -> own fallback -> seo.defaults
in one shared helper; metadataBase comes from the production URL; the
404 page inherits the default description; seo.defaults gains the
business facts for JSON-LD (migration 0008).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Structured data — LocalBusiness, Article, BreadcrumbList (master Task 8.1, part 2)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (`schema-dts@2.1.0`, dev, exact)
- Create: `lib/seo/json-ld.ts`, `components/seo/json-ld.tsx`, `templates/shared/structured-data.ts`, `components/site-extras.tsx`
- Modify: `app/(site)/layout.tsx` (render `<SiteExtras>`), `app/(site)/services/[slug]/page.tsx`, `app/(site)/blog/[slug]/page.tsx`
- Test: `tests/unit/seo/json-ld.test.ts`, `tests/unit/templates/structured-data.test.ts`, `tests/e2e/seo.spec.ts` (append)

**Interfaces:**
- Consumes: Task 1 `absoluteUrl`, `effectiveSeo`, `publicOrigin`, `OrganizationSettings`; `SiteSources`; `settings.microcopy.breadcrumb.{home,services,blog}`.
- Produces:

```ts
// lib/seo/json-ld.ts
export type OrganizationType = "LocalBusiness" | "ProfessionalService"
export type OrganizationInput = { type; url: string /* origin */; name; legalName; logo; telephone; email; address: { streetAddress; addressLocality; addressRegion; postalCode; addressCountry }; areaServed: string; sameAs: string[]; services: { name: string; url: string }[] }
export function organizationId(origin: string): string                  // "<origin>/#organization"
export function organizationJsonLd(i: OrganizationInput): WithContext<LocalBusiness>
export type ArticleInput = { url; headline; description; image; datePublished: string | null; dateModified: string | null; authorName: string | null; section: string; publisher: { origin: string; name: string; logo: string } }
export function articleJsonLd(i: ArticleInput): WithContext<Article>
export function breadcrumbJsonLd(items: readonly { name: string; url: string }[]): WithContext<BreadcrumbList>
export function jsonLdText(data: object): string                         // JSON safe inside <script>
// components/seo/json-ld.tsx
export function JsonLd(props: { data: object | object[] }): JSX.Element
// templates/shared/structured-data.ts
export function siteJsonLd(s: SiteSources, origin: string): WithContext<LocalBusiness>
export function serviceJsonLd(s: SiteSources, slug: string, origin: string): object[] | null
export function articleJsonLdFor(s: SiteSources, slug: string, origin: string): object[] | null
// components/site-extras.tsx (server)
export async function SiteExtras(): Promise<JSX.Element | null>          // Task 10 adds consent + custom code
```

- [ ] **Step 1: Add the dependency**

Run: `pnpm add -D --save-exact schema-dts@2.1.0`
Expected: `package.json` devDependencies gains `"schema-dts": "2.1.0"`; only `package.json` and `pnpm-lock.yaml` change.

- [ ] **Step 2: Write the failing tests**

`tests/unit/seo/json-ld.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  articleJsonLd,
  breadcrumbJsonLd,
  jsonLdText,
  organizationJsonLd,
  type OrganizationInput,
} from "@/lib/seo/json-ld"

const org: OrganizationInput = {
  type: "LocalBusiness",
  url: "https://x.ie",
  name: "Security Partners Ltd.",
  legalName: "Security Partners Limited",
  logo: "https://x.ie/images/logo.png",
  telephone: "057 8697670",
  email: "info@x.ie",
  address: {
    streetAddress: "Derryguile",
    addressLocality: "Mountmellick",
    addressRegion: "Co. Laois",
    postalCode: "R32 YX49",
    addressCountry: "IE",
  },
  areaServed: "Ireland",
  sameAs: [],
  services: [{ name: "Alarm Responses", url: "https://x.ie/services/a" }],
}

describe("JSON-LD builders", () => {
  it("organisation: LocalBusiness with a postal address and offered services", () => {
    const data = organizationJsonLd(org)
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": "https://x.ie/#organization",
      url: "https://x.ie/",
      telephone: "057 8697670",
      address: { "@type": "PostalAddress", postalCode: "R32 YX49" },
      makesOffer: [
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Alarm Responses" },
        },
      ],
    })
    expect(data).not.toHaveProperty("sameAs")
    expect(
      organizationJsonLd({
        ...org,
        type: "ProfessionalService",
        sameAs: ["https://linkedin.com/company/x"],
      })
    ).toMatchObject({
      "@type": "ProfessionalService",
      sameAs: ["https://linkedin.com/company/x"],
    })
  })

  it("article: headline, author and publisher; dates only when known", () => {
    const data = articleJsonLd({
      url: "https://x.ie/blog/a",
      headline: "A",
      description: "D",
      image: "https://x.ie/i.png",
      datePublished: "2026-09-20T09:00:00.000Z",
      dateModified: null,
      authorName: "Jane",
      section: "News",
      publisher: {
        origin: "https://x.ie",
        name: "SP",
        logo: "https://x.ie/l.png",
      },
    })
    expect(data).toMatchObject({
      "@type": "Article",
      mainEntityOfPage: "https://x.ie/blog/a",
      datePublished: "2026-09-20T09:00:00.000Z",
      author: { "@type": "Person", name: "Jane" },
      publisher: { "@id": "https://x.ie/#organization" },
    })
    expect(data).not.toHaveProperty("dateModified")
  })

  it("breadcrumbs are numbered from 1", () => {
    expect(
      breadcrumbJsonLd([
        { name: "Home", url: "https://x.ie/" },
        { name: "Blog", url: "https://x.ie/blog" },
      ]).itemListElement
    ).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://x.ie/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://x.ie/blog",
      },
    ])
  })

  it("jsonLdText cannot close the <script> and round-trips", () => {
    const data = { name: "</script><script>alert(1)</script> &  " }
    const text = jsonLdText(data)
    expect(text).not.toContain("<")
    expect(text).not.toContain(">")
    expect(JSON.parse(text)).toEqual(data)
  })
})
```

`tests/unit/templates/structured-data.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import {
  articleJsonLdFor,
  serviceJsonLd,
  siteJsonLd,
} from "@/templates/shared/structured-data"

const s = fixtureSiteSources()
const ORIGIN = "https://www.securitypartnersltd.com"

describe("structured data from SiteSources", () => {
  it("site: business facts from settings, every published service offered", () => {
    const data = siteJsonLd(s, ORIGIN)
    const org = s.settings["seo.defaults"].organization
    expect(data).toMatchObject({
      "@type": org.type,
      name: s.settings.site.name,
      legalName: s.settings.site.legalName,
      telephone: s.settings.contact.office,
      email: s.settings.contact.email,
      logo: new URL(s.settings.site.logo.url, ORIGIN).toString(),
      address: { streetAddress: org.streetAddress, addressCountry: "IE" },
      areaServed: org.areaServed,
    })
    expect((data as { makesOffer: unknown[] }).makesOffer).toHaveLength(
      s.services.length
    )
  })

  it("service pages: Home › Services › title breadcrumbs", () => {
    const [crumbs] = serviceJsonLd(s, "alarm-responses", ORIGIN)!
    expect(crumbs).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, item: `${ORIGIN}/` },
        { position: 2, item: `${ORIGIN}/services` },
        { position: 3, item: `${ORIGIN}/services/alarm-responses` },
      ],
    })
    expect(serviceJsonLd(s, "nope", ORIGIN)).toBeNull()
  })

  it("articles: Article + Home › Blog › title breadcrumbs", () => {
    const article = s.articles.find((a) => a.slug === "key-holding-explained")!
    const [data, crumbs] = articleJsonLdFor(s, article.slug, ORIGIN)!
    expect(data).toMatchObject({
      "@type": "Article",
      headline: article.content.title,
      articleSection: article.category.name,
      image: [new URL(article.content.cover.url, ORIGIN).toString()],
      datePublished: article.publishedAt!.toISOString(),
    })
    expect(crumbs).toMatchObject({ "@type": "BreadcrumbList" })
    expect(articleJsonLdFor(s, "nope", ORIGIN)).toBeNull()
  })
})
```

In `tests/e2e/seo.spec.ts` change the first import to `import { expect, type Page, test } from "@playwright/test"` and append:

```ts
const jsonLd = async (page: Page) =>
  (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).flatMap((text) => {
    const value = JSON.parse(text) as unknown
    return Array.isArray(value) ? value : [value]
  }) as { "@type": string; [key: string]: unknown }[]

test.describe("structured data", () => {
  test("every page carries the business; articles add Article + breadcrumbs", async ({
    page,
  }) => {
    await page.goto("/")
    expect((await jsonLd(page)).map((d) => d["@type"])).toEqual([
      "LocalBusiness",
    ])
    await page.goto("/blog/key-holding-explained")
    const types = (await jsonLd(page)).map((d) => d["@type"]).sort()
    expect(types).toEqual(["Article", "BreadcrumbList", "LocalBusiness"])
    await page.goto("/services/alarm-responses")
    expect((await jsonLd(page)).map((d) => d["@type"]).sort()).toEqual([
      "BreadcrumbList",
      "LocalBusiness",
    ])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/seo/json-ld.test.ts tests/unit/templates/structured-data.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/seo/json-ld"` / `"@/templates/shared/structured-data"`.

- [ ] **Step 4: Implement**

`lib/seo/json-ld.ts`:

```ts
import type {
  Article,
  BreadcrumbList,
  LocalBusiness,
  WithContext,
} from "schema-dts"

// schema.org JSON-LD (spec §10), typed with schema-dts. Pure builders;
// templates/shared/structured-data.ts maps SiteSources onto them.

export type OrganizationType = "LocalBusiness" | "ProfessionalService"

export type OrganizationInput = {
  type: OrganizationType
  /** Site origin, e.g. https://www.securitypartnersltd.com */
  url: string
  name: string
  legalName: string
  logo: string
  telephone: string
  email: string
  address: {
    streetAddress: string
    addressLocality: string
    addressRegion: string
    postalCode: string
    addressCountry: string
  }
  areaServed: string
  sameAs: string[]
  services: { name: string; url: string }[]
}

export const organizationId = (origin: string) => `${origin}/#organization`

export function organizationJsonLd(
  i: OrganizationInput
): WithContext<LocalBusiness> {
  const common = {
    "@id": organizationId(i.url),
    name: i.name,
    legalName: i.legalName,
    url: `${i.url}/`,
    logo: i.logo,
    image: i.logo,
    telephone: i.telephone,
    email: i.email,
    address: { "@type": "PostalAddress" as const, ...i.address },
    areaServed: i.areaServed,
    ...(i.sameAs.length > 0 ? { sameAs: i.sameAs } : {}),
    makesOffer: i.services.map((service) => ({
      "@type": "Offer" as const,
      itemOffered: {
        "@type": "Service" as const,
        name: service.name,
        url: service.url,
      },
    })),
  }
  return i.type === "ProfessionalService"
    ? {
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        ...common,
      }
    : { "@context": "https://schema.org", "@type": "LocalBusiness", ...common }
}

export type ArticleInput = {
  url: string
  headline: string
  description: string
  image: string
  datePublished: string | null
  dateModified: string | null
  authorName: string | null
  section: string
  publisher: { origin: string; name: string; logo: string }
}

export function articleJsonLd(i: ArticleInput): WithContext<Article> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: i.url,
    headline: i.headline,
    description: i.description,
    image: [i.image],
    ...(i.datePublished ? { datePublished: i.datePublished } : {}),
    ...(i.dateModified ? { dateModified: i.dateModified } : {}),
    ...(i.authorName
      ? { author: { "@type": "Person", name: i.authorName } }
      : {}),
    articleSection: i.section,
    publisher: {
      "@type": "Organization",
      "@id": organizationId(i.publisher.origin),
      name: i.publisher.name,
      logo: { "@type": "ImageObject", url: i.publisher.logo },
    },
  }
}

export function breadcrumbJsonLd(
  items: readonly { name: string; url: string }[]
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/** JSON for a <script type="application/ld+json">: no "<", ">" or "&" can end the script. */
export function jsonLdText(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/ /g, "\\u2028")
    .replace(/ /g, "\\u2029")
}
```

`components/seo/json-ld.tsx`:

```tsx
import { jsonLdText } from "@/lib/seo/json-ld"

/** schema.org structured data (invisible; content cannot close the script). */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdText(data) }}
    />
  )
}
```

`templates/shared/structured-data.ts`:

```ts
import { interpolate } from "@/lib/interpolate"
import { effectiveSeo } from "@/lib/seo/effective"
import {
  articleJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
} from "@/lib/seo/json-ld"
import { absoluteUrl } from "@/lib/seo/urls"

import type { SiteSources } from "./sources"
import { placeholders } from "./views"

// SiteSources → JSON-LD (spec §10): the business on every page, Article on
// articles, BreadcrumbList on detail pages. URLs are absolute on `origin`.

export function siteJsonLd(s: SiteSources, origin: string) {
  const { site, contact } = s.settings
  const org = s.settings["seo.defaults"].organization
  return organizationJsonLd({
    type: org.type,
    url: origin,
    name: site.name,
    legalName: site.legalName,
    logo: absoluteUrl(origin, site.logo.url),
    telephone: contact.office,
    email: contact.email,
    address: {
      streetAddress: org.streetAddress,
      addressLocality: org.addressLocality,
      addressRegion: org.addressRegion,
      postalCode: org.postalCode,
      addressCountry: org.addressCountry,
    },
    areaServed: org.areaServed,
    sameAs: org.sameAs,
    services: s.services.map((service) => ({
      name: interpolate(service.content.title, placeholders(s)),
      url: absoluteUrl(origin, `/services/${service.slug}`),
    })),
  })
}

export function serviceJsonLd(
  s: SiteSources,
  slug: string,
  origin: string
): object[] | null {
  const service = s.services.find((x) => x.slug === slug)
  if (!service) return null
  const crumbs = s.settings.microcopy.breadcrumb
  return [
    breadcrumbJsonLd([
      { name: crumbs.home, url: absoluteUrl(origin, "/") },
      { name: crumbs.services, url: absoluteUrl(origin, "/services") },
      {
        name: interpolate(service.content.title, placeholders(s)),
        url: absoluteUrl(origin, `/services/${slug}`),
      },
    ]),
  ]
}

export function articleJsonLdFor(
  s: SiteSources,
  slug: string,
  origin: string
): object[] | null {
  const article = s.articles.find((a) => a.slug === slug)
  if (!article) return null
  const values = placeholders(s)
  const headline = interpolate(article.content.title, values)
  const { description } = effectiveSeo({
    seo: article.seo,
    defaults: s.settings["seo.defaults"],
    name: article.content.title,
    fallbackDescription: article.content.excerpt,
    values,
  })
  const url = absoluteUrl(origin, `/blog/${slug}`)
  const crumbs = s.settings.microcopy.breadcrumb
  return [
    articleJsonLd({
      url,
      headline,
      description,
      image: absoluteUrl(
        origin,
        article.seo.ogImage?.url ?? article.content.cover.url
      ),
      datePublished: article.publishedAt?.toISOString() ?? null,
      dateModified: null,
      authorName: article.author?.name ?? null,
      section: article.category.name,
      publisher: {
        origin,
        name: s.settings.site.name,
        logo: absoluteUrl(origin, s.settings.site.logo.url),
      },
    }),
    breadcrumbJsonLd([
      { name: crumbs.home, url: absoluteUrl(origin, "/") },
      { name: crumbs.blog, url: absoluteUrl(origin, "/blog") },
      { name: headline, url },
    ]),
  ]
}
```

`components/site-extras.tsx`:

```tsx
import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { JsonLd } from "@/components/seo/json-ld"
import { publicOrigin } from "@/server/lib/site-origin"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { siteJsonLd } from "@/templates/shared/structured-data"

/**
 * Site-wide additions with no visible output: the business JSON-LD (Task
 * 10 adds the consent banner/tracking, rendered only when tracking is
 * enabled, and the custom body code). Rendered inside <Suspense> in the
 * root layout; on any failure it renders nothing, so a database outage
 * still reaches the page's error.tsx instead of breaking the layout.
 */
export async function SiteExtras() {
  await connection()
  try {
    const s = await loadSiteSources()
    return (
      <JsonLd data={siteJsonLd(s, publicOrigin(s.settings.site.productionUrl))} />
    )
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}
```

`app/(site)/layout.tsx` — `import { SiteExtras } from "@/components/site-extras"` and, inside `<body>` directly after the `<Suspense fallback={null}><PreviewBar /></Suspense>` block:

```tsx
        {/* JSON-LD (and, when tracking is on, the consent banner). */}
        <Suspense fallback={null}>
          <SiteExtras />
        </Suspense>
```

`app/(site)/services/[slug]/page.tsx` — imports `import { JsonLd } from "@/components/seo/json-ld"`, `import { publicOrigin } from "@/server/lib/site-origin"`, `import { serviceJsonLd } from "@/templates/shared/structured-data"`; replace the body of `ServiceDetail` after `const { slug } = await params` with:

```tsx
  const s = await loadSiteSources()
  const view = serviceDetailView(s, slug)
  // Unknown slugs never get here as a 200: proxy.ts rewrites them to the
  // 404 (Task 5); drafts in preview keep the soft 404 below.
  if (!view) notFound()
  return (
    <>
      <ServiceDetailTemplate view={view} />
      <JsonLd
        data={
          serviceJsonLd(s, slug, publicOrigin(s.settings.site.productionUrl)) ??
          []
        }
      />
    </>
  )
```

`app/(site)/blog/[slug]/page.tsx` — imports `JsonLd`, `publicOrigin`, `articleJsonLdFor`; replace the body of `Article` after `const { slug } = await params` with:

```tsx
  const s = await loadSiteSources()
  const view = articleView(s, slug)
  // Unknown slugs are a real 404 in proxy.ts (Task 5); previews keep the soft 404.
  if (!view) notFound()
  return (
    <>
      <ArticleTemplate view={view} />
      <JsonLd
        data={
          articleJsonLdFor(
            s,
            slug,
            publicOrigin(s.settings.site.productionUrl)
          ) ?? []
        }
      />
    </>
  )
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/seo tests/unit/templates`
Expected: PASS (json-ld 4, structured-data 3).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: clean.

Run: `pnpm test:e2e tests/e2e/seo.spec.ts tests/e2e/public-site.spec.ts` then `pnpm test:visual`
Expected: seo 5 passed; GSAP motion test still passes (no console errors); visual 0 px everywhere (the `<script>` blocks are invisible — if a public baseline moves, a CSS `:last-child`/`:first-child` rule is reacting to the extra element: report it, do not re-baseline).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write lib/seo/json-ld.ts components/seo/json-ld.tsx templates/shared/structured-data.ts components/site-extras.tsx "app/(site)/layout.tsx" "app/(site)/services/[slug]/page.tsx" "app/(site)/blog/[slug]/page.tsx" tests/unit/seo/json-ld.test.ts tests/unit/templates/structured-data.test.ts tests/e2e/seo.spec.ts
git add package.json pnpm-lock.yaml lib/seo/json-ld.ts components/seo/json-ld.tsx templates/shared/structured-data.ts components/site-extras.tsx "app/(site)/layout.tsx" "app/(site)/services/[slug]/page.tsx" "app/(site)/blog/[slug]/page.tsx" tests/unit/seo/json-ld.test.ts tests/unit/templates/structured-data.test.ts tests/e2e/seo.spec.ts
git commit -m "$(cat <<'EOF'
feat(seo): JSON-LD for the business, articles and breadcrumbs

LocalBusiness (or ProfessionalService) site-wide from seo.defaults and
contact settings, Article on articles, BreadcrumbList on service and
article pages; typed with schema-dts, escaped for <script>.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Generated Open Graph cards in the site's brand (master Task 8.1, part 3)

**Files:**
- Create: `assets/fonts/lato-latin-400-normal.woff`, `assets/fonts/lato-latin-900-normal.woff`, `assets/fonts/LICENSE` (downloaded, Step 1), `lib/seo/og-card.ts`, `server/modules/seo/repo.ts`, `server/modules/seo/queries.ts`, `app/og/[kind]/[slug]/route.tsx`
- Modify: `server/modules/settings/queries.ts` (add `getPublishedSettings`), `next.config.ts` (`outputFileTracingIncludes`)
- Test: `tests/unit/seo/og-card.test.ts`, `tests/integration/queries/seo-queries.test.ts`, `tests/e2e/seo.spec.ts` (append)

**Interfaces:**
- Consumes: Task 1 `OG_IMAGE_SIZE`, `isOgKind`, `OgKind`, `publicOrigin`; `tag` (`server/lib/cache-tags.ts`); `contactPlaceholders`, `interpolate` (`lib/interpolate.ts`); `next/og` `ImageResponse` (Node runtime; fonts as `woff` buffers).
- Produces:

```ts
// server/modules/settings/queries.ts
export async function getPublishedSettings<K extends SettingsKey>(key: K): Promise<SettingsValue<K> | null> // 'use cache', tag settings:<key>; never the draft
// lib/seo/og-card.ts
export type OgCardInput = { kind: OgKind; title: string; siteName: string; origin: string }
export type OgCard = { eyebrow: string; title: string; titleSize: number; siteName: string; host: string }
export function ogCard(input: OgCardInput): OgCard
// server/modules/seo/repo.ts
export async function findPublishedName(db: DbOrTx, kind: OgKind, id: string): Promise<string | null | undefined> // undefined = not published; null = home (site title)
// server/modules/seo/queries.ts
export type OgSubject = { kind: OgKind; title: string; siteName: string; productionUrl: string | null }
export async function getOgSubject(kind: OgKind, id: string): Promise<OgSubject | null>
// app/og/[kind]/[slug]/route.tsx
GET /og/:kind/:slug → 200 image/png 1200×630 | 404
```

- [ ] **Step 1: Add the fonts (Lato latin, OFL)**

```bash
mkdir -p assets/fonts
curl -fsSL -o assets/fonts/lato-latin-400-normal.woff https://cdn.jsdelivr.net/npm/@fontsource/lato@5.3.0/files/lato-latin-400-normal.woff
curl -fsSL -o assets/fonts/lato-latin-900-normal.woff https://cdn.jsdelivr.net/npm/@fontsource/lato@5.3.0/files/lato-latin-900-normal.woff
curl -fsSL -o assets/fonts/LICENSE https://cdn.jsdelivr.net/npm/@fontsource/lato@5.3.0/LICENSE
shasum -a 256 assets/fonts/*.woff
```

Expected:
```
f55abc76e10cc86d799a7189e64e3c6e4cc6ced19b2474b1852a808be46232a8  assets/fonts/lato-latin-400-normal.woff
8498bfffde51ce9d967063da91db306377d057550a97e551f43cf21ba1b2e463  assets/fonts/lato-latin-900-normal.woff
```
Any other hash: stop and report (the files are committed).

- [ ] **Step 2: Write the failing tests**

`tests/unit/seo/og-card.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { ogCard } from "@/lib/seo/og-card"

const base = {
  siteName: "Security Partners Ltd.",
  origin: "https://www.securitypartnersltd.com",
}

describe("OG card model", () => {
  it("labels services and articles; pages show the site name", () => {
    expect(ogCard({ ...base, kind: "service", title: "Alarm Responses" })).toEqual(
      {
        eyebrow: "Service",
        title: "Alarm Responses",
        titleSize: 80,
        siteName: "Security Partners Ltd.",
        host: "www.securitypartnersltd.com",
      }
    )
    expect(ogCard({ ...base, kind: "article", title: "x" }).eyebrow).toBe(
      "Article"
    )
    expect(ogCard({ ...base, kind: "page", title: "About Us" }).eyebrow).toBe(
      "Security Partners Ltd."
    )
  })

  it("collapses whitespace, shrinks long titles and truncates at 110 characters", () => {
    expect(ogCard({ ...base, kind: "page", title: "A\n  B" }).title).toBe("A B")
    expect(
      ogCard({ ...base, kind: "page", title: "x".repeat(40) }).titleSize
    ).toBe(68)
    const long = ogCard({ ...base, kind: "page", title: "word ".repeat(40) })
    expect([...long.title].length).toBeLessThanOrEqual(110)
    expect(long.title.endsWith("…")).toBe(true)
    expect(long.titleSize).toBe(56)
  })
})
```

`tests/integration/queries/seo-queries.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getDb } from "@/server/db/client"
import { services, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { getOgSubject } from "@/server/modules/seo/queries"
import { getPublishedSettings } from "@/server/modules/settings/queries"

import { resetDb } from "../db"

const fx = fixtureSiteSources()

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("published-only SEO readers", () => {
  it("getPublishedSettings ignores the draft", async () => {
    await getDb()
      .update(settings)
      .set({ draft: { enabled: true, gtmId: null, ga4Id: null, metaPixelId: null } })
      .where(eq(settings.key, "tracking"))
    expect(await getPublishedSettings("tracking")).toMatchObject({
      enabled: false,
    })
  })

  it("OG subjects: home uses the site title; pages, services, articles their names", async () => {
    expect(await getOgSubject("page", "home")).toEqual({
      kind: "page",
      title: fx.settings["seo.defaults"].title,
      siteName: fx.settings.site.name,
      productionUrl: null,
    })
    expect((await getOgSubject("page", "about"))?.title).toBe(
      fx.pages.about.data.hero.title
    )
    const service = fx.services.find((s) => s.slug === "alarm-responses")!
    expect((await getOgSubject("service", "alarm-responses"))?.title).toBe(
      service.content.title
    )
    const article = fx.articles[0]
    expect((await getOgSubject("article", article.slug))?.title).toBe(
      article.content.title
    )
  })

  it("unknown or unpublished records have no card; drafts never show", async () => {
    expect(await getOgSubject("page", "nope")).toBeNull()
    expect(await getOgSubject("service", "nope")).toBeNull()
    const [row] = await getDb()
      .select()
      .from(services)
      .where(eq(services.slug, "alarm-responses"))
    await getDb()
      .update(services)
      .set({ draft: { ...row.draft, title: "Draft only title" } })
      .where(eq(services.id, row.id))
    expect((await getOgSubject("service", "alarm-responses"))?.title).not.toBe(
      "Draft only title"
    )
    await getDb()
      .update(services)
      .set({ published: null })
      .where(eq(services.id, row.id))
    expect(await getOgSubject("service", "alarm-responses")).toBeNull()
  })
})
```

Append to `tests/e2e/seo.spec.ts`:

```ts
test.describe("generated share cards", () => {
  test("a 1200×630 PNG per published page; unknown → 404", async ({
    request,
  }) => {
    const res = await request.get("/og/service/alarm-responses")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toBe("image/png")
    const png = await res.body()
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
    expect((await request.get("/og/service/no-such-service")).status()).toBe(
      404
    )
    expect((await request.get("/og/nope/home")).status()).toBe(404)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/seo/og-card.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/seo/og-card"`.

Run: `pnpm test:integration tests/integration/queries/seo-queries.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/modules/seo/queries"`.

- [ ] **Step 4: Implement**

`server/modules/settings/queries.ts` — append:

```ts
/**
 * Published value only, never the draft — not even in draft mode. For
 * public readers that must not leak unpublished copy: sitemap, robots, OG
 * cards, tracking/consent/custom code (ledger ruling).
 */
export async function getPublishedSettings<K extends SettingsKey>(
  key: K
): Promise<SettingsValue<K> | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.settings(key))
  const row = await findSettingsRow(getDb(), key)
  return (row?.published ?? null) as SettingsValue<K> | null
}
```

`lib/seo/og-card.ts`:

```ts
import type { OgKind } from "./urls"

// Text layout of a generated share card (app/og/[kind]/[slug]/route.tsx).

export type OgCardInput = {
  kind: OgKind
  title: string
  siteName: string
  /** Site origin; its host is printed on the card. */
  origin: string
}

export type OgCard = {
  eyebrow: string
  title: string
  /** Font size in px for the title (long titles get smaller). */
  titleSize: number
  siteName: string
  host: string
}

const EYEBROW: Record<OgKind, string | null> = {
  page: null,
  service: "Service",
  article: "Article",
}
const MAX_TITLE = 110

export function ogCard(input: OgCardInput): OgCard {
  const chars = [...input.title.replace(/\s+/g, " ").trim()]
  const title =
    chars.length > MAX_TITLE
      ? `${chars.slice(0, MAX_TITLE - 1).join("").trimEnd()}…`
      : chars.join("")
  const length = [...title].length
  return {
    eyebrow: EYEBROW[input.kind] ?? input.siteName,
    title,
    titleSize: length > 70 ? 56 : length > 36 ? 68 : 80,
    siteName: input.siteName,
    host: new URL(input.origin).host,
  }
}
```

`server/modules/seo/repo.ts`:

```ts
import "server-only"

import { and, eq, isNotNull, sql } from "drizzle-orm"

import type { OgKind } from "@/lib/seo/urls"
import type { DbOrTx } from "@/server/db/client"
import { articles, pages, services } from "@/server/db/schema"

/**
 * The published name of a record: a page's hero title (home: null = use
 * the site title), a service's or article's title. undefined when the
 * record is unknown or not published (drafts never reach share cards).
 */
export async function findPublishedName(
  db: DbOrTx,
  kind: OgKind,
  id: string
): Promise<string | null | undefined> {
  if (kind === "page") {
    const [row] = await db
      .select({ published: pages.published })
      .from(pages)
      .where(eq(pages.key, id))
    if (!row?.published) return undefined
    if (id === "home") return null
    const title = (row.published as { hero?: { title?: unknown } }).hero?.title
    return typeof title === "string" ? title : undefined
  }
  if (kind === "service") {
    const [row] = await db
      .select({ title: sql<string | null>`${services.published}->>'title'` })
      .from(services)
      .where(and(eq(services.slug, id), isNotNull(services.published)))
    return row?.title ?? undefined
  }
  const [row] = await db
    .select({ title: sql<string | null>`${articles.published}->>'title'` })
    .from(articles)
    .where(and(eq(articles.slug, id), isNotNull(articles.published)))
  return row?.title ?? undefined
}
```

`server/modules/seo/queries.ts`:

```ts
import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { contactPlaceholders, interpolate } from "@/lib/interpolate"
import type { OgKind } from "@/lib/seo/urls"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { getPublishedSettings } from "@/server/modules/settings/queries"

import { findPublishedName } from "./repo"

export type OgSubject = {
  kind: OgKind
  title: string
  siteName: string
  productionUrl: string | null
}

const recordTag = (kind: OgKind, id: string) =>
  kind === "page"
    ? tag.page(id)
    : kind === "service"
      ? tag.service(id)
      : tag.article(id)

/** What a share card shows. Published rows only (never draft mode). */
export async function getOgSubject(
  kind: OgKind,
  id: string
): Promise<OgSubject | null> {
  "use cache"
  cacheLife("max")
  cacheTag(
    recordTag(kind, id),
    tag.settings("site"),
    tag.settings("seo.defaults"),
    tag.settings("contact")
  )
  const name = await findPublishedName(getDb(), kind, id)
  if (name === undefined) return null
  const [site, defaults, contact] = await Promise.all([
    getPublishedSettings("site"),
    getPublishedSettings("seo.defaults"),
    getPublishedSettings("contact"),
  ])
  if (!site || !defaults || !contact) return null
  return {
    kind,
    title: interpolate(name ?? defaults.title, contactPlaceholders(contact)),
    siteName: site.name,
    productionUrl: site.productionUrl,
  }
}
```

`app/og/[kind]/[slug]/route.tsx`:

```tsx
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"
import { connection } from "next/server"

import { ogCard } from "@/lib/seo/og-card"
import { isOgKind, OG_IMAGE_SIZE } from "@/lib/seo/urls"
import { publicOrigin } from "@/server/lib/site-origin"
import { getOgSubject } from "@/server/modules/seo/queries"

// Generated share card (spec §10: "OG images generated with next/og in the
// site's existing fonts/colours"): Lato, brand navy/green/mint from
// app/globals.css. Used when a record has no share image of its own.

const NAVY = "#0d1b36"
const GREEN = "#67bd31"
const MINT = "#eef6e8"

let fonts: Promise<[Buffer, Buffer]> | null = null
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/lato-latin-400-normal.woff")),
    readFile(join(process.cwd(), "assets/fonts/lato-latin-900-normal.woff")),
  ])
  return fonts
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/og/[kind]/[slug]">
) {
  await connection()
  const { kind, slug } = await ctx.params
  if (!isOgKind(kind)) return new Response("Not found", { status: 404 })
  const subject = await getOgSubject(kind, slug)
  if (!subject) return new Response("Not found", { status: 404 })
  const card = ogCard({
    kind,
    title: subject.title,
    siteName: subject.siteName,
    origin: publicOrigin(subject.productionUrl),
  })
  const [regular, black] = await loadFonts()
  // Satori: every element with more than one child needs display:flex, so
  // each text is a single template-literal child.
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "72px 80px",
          background: NAVY,
          color: "#ffffff",
          fontFamily: "Lato",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 8,
              borderRadius: 4,
              background: GREEN,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: GREEN,
            }}
          >
            {`${card.eyebrow}`}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: card.titleSize,
            fontWeight: 900,
            lineHeight: 1.1,
          }}
        >
          {`${card.title}`}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 28,
            fontWeight: 400,
            color: MINT,
          }}
        >
          <div style={{ display: "flex" }}>{`${card.siteName}`}</div>
          <div style={{ display: "flex" }}>{`${card.host}`}</div>
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
      fonts: [
        { name: "Lato", data: regular, weight: 400, style: "normal" },
        { name: "Lato", data: black, weight: 900, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  )
}
```

`next.config.ts` — inside `nextConfig`, after `output: "standalone",`:

```ts
  // The share-card route reads its fonts from disk (standalone trace).
  outputFileTracingIncludes: { "/og/**": ["./assets/fonts/**"] },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/seo/og-card.test.ts && pnpm test:integration tests/integration/queries/seo-queries.test.ts`
Expected: PASS (og-card 2, seo-queries 3).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && ls .next/standalone/assets/fonts`
Expected: build lists `ƒ /og/[kind]/[slug]`; `ls` prints both `.woff` files (traced into the standalone output).

Run: `pnpm test:e2e tests/e2e/seo.spec.ts`
Expected: PASS (6). Open `/og/page/home` from the E2E server once in a browser and check the card: navy background, green bar, white Lato Black title, mint footer (report a screenshot path in your summary).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write lib/seo/og-card.ts server/modules/seo server/modules/settings/queries.ts "app/og/[kind]/[slug]/route.tsx" next.config.ts tests/unit/seo/og-card.test.ts tests/integration/queries/seo-queries.test.ts tests/e2e/seo.spec.ts
git add assets/fonts lib/seo/og-card.ts server/modules/seo server/modules/settings/queries.ts "app/og/[kind]/[slug]/route.tsx" next.config.ts tests/unit/seo/og-card.test.ts tests/integration/queries/seo-queries.test.ts tests/e2e/seo.spec.ts
git commit -m "$(cat <<'EOF'
feat(seo): generated share cards in the site's brand

/og/<kind>/<id> renders a 1200x630 PNG with Lato and the brand colours
from published rows only; used when a record and the site defaults have
no share image.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Redirects module — validation, loop detection, admin API, automatic 301s (master Task 8.2, part 1)

**Files:**
- Create: `lib/seo/redirects.ts`, `lib/schemas/api/redirects.ts`, `server/modules/redirects/repo.ts`, `server/modules/redirects/service.ts`, `server/modules/redirects/routes.ts`
- Modify: `server/api/app.ts` (mount `/redirects`), `server/modules/services/service.ts` (`changeServiceSlug`, `deleteService`), `server/modules/articles/service.ts` (`changeArticleMeta`, `deleteArticle`)
- Test: `tests/unit/seo/redirects.test.ts`, `tests/integration/api/redirects.test.ts`

**Interfaces:**
- Consumes: `isSafeHref` (`lib/href.ts`), `PAGE_PATHS`, `listQuery`/`sortParam`/`Paginated`, `idParam`, `writeAudit`, `AppError`/`notFound`/`forbidden`, `pgErrorCode`/`UNIQUE_VIOLATION`, `hasPermission`, the `redirects` table (`from_path` unique, `to_path`, `code` 301|302, `hits`, timestamps; checks `from <> to`, `from like '/%'`).
- Produces:

```ts
// lib/seo/redirects.ts (isomorphic)
export const MAX_REDIRECT_HOPS = 5
export function fromPathProblem(path: string): string | null
export function toPathProblem(to: string): string | null
export type ChainCheck = { ok: true } | { ok: false; reason: "loop" | "too-long"; chain: string[] }
export function checkRedirectChain(existing: ReadonlyMap<string, string>, from: string, to: string): ChainCheck
export function redirectLocation(to: string, requestUrl: URL): URL
// lib/schemas/api/redirects.ts
export const redirectInput, redirectPatch, redirectListQuery
export type RedirectInput, RedirectPatch, RedirectListQuery
export type RedirectDto = { id: string; fromPath: string; toPath: string; code: 301 | 302; hits: number; createdAt: string; updatedAt: string }
// server/modules/redirects/repo.ts
export async function findRedirectByFrom(db, fromPath): Promise<{ id: string; toPath: string; code: number } | null>
export async function incrementRedirectHits(db, id): Promise<void>        // does not touch updatedAt
export async function isPublishedSlug(db, kind: "service" | "article", slug): Promise<boolean>
// (+ listRedirectRows, findRedirectById, listRedirectEdges, insertRedirect, updateRedirectRow, deleteRedirectRow, lockRedirects, moveRedirects)
// server/modules/redirects/service.ts
export async function listRedirectsAdmin(actor, query): Promise<Paginated<RedirectDto>>
export async function createRedirect(actor, input: RedirectInput): Promise<RedirectDto>
export async function updateRedirect(actor, id, patch: RedirectPatch): Promise<RedirectDto>
export async function deleteRedirect(actor, id): Promise<{ ok: true }>
export async function recordMove(tx: DbOrTx, actor: Actor, move: { from: string; to: string; reason: string }): Promise<void>
// HTTP (admin): GET /redirects (redirect:read) · POST /redirects (redirect:create) 201 · PATCH /redirects/:id (redirect:update) · DELETE /redirects/:id (redirect:delete)
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/seo/redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  checkRedirectChain,
  fromPathProblem,
  redirectLocation,
  toPathProblem,
} from "@/lib/seo/redirects"

describe("redirect rules", () => {
  it("from: plain site paths only", () => {
    expect(fromPathProblem("/old-page")).toBeNull()
    expect(fromPathProblem("/services/old-name")).toBeNull()
    for (const bad of [
      "old",
      "/",
      "/old/",
      "//evil",
      "/a?b=1",
      "/a#b",
      "/admin",
      "/admin/x",
      "/api/v1/x",
      "/_next/static/x",
      "/_sp-missing",
      "/og/page/home",
      "/images/logo.png",
      "/old.html",
      "/wp-login.php",
      `/${"x".repeat(300)}`,
    ])
      expect(fromPathProblem(bad), bad).not.toBeNull()
  })

  it("to: the app href guard, site paths or http(s) only", () => {
    expect(toPathProblem("/services/alarm-responses")).toBeNull()
    expect(toPathProblem("/blog?category=news")).toBeNull()
    expect(toPathProblem("https://example.ie/x")).toBeNull()
    for (const bad of [
      "",
      "javascript:alert(1)",
      "//evil.example",
      "/\\evil.example",
      "mailto:a@b.ie",
      "tel:123",
      "#top",
      "{phone24hHref}",
      "data:text/html,x",
    ])
      expect(toPathProblem(bad), bad).not.toBeNull()
  })

  it("loops and long chains are refused; external targets end a chain", () => {
    const edges = new Map([["/b", "/a"]])
    expect(checkRedirectChain(edges, "/a", "/b")).toEqual({
      ok: false,
      reason: "loop",
      chain: ["/a", "/b", "/a"],
    })
    expect(checkRedirectChain(new Map(), "/a", "/a?x=1")).toMatchObject({
      ok: false,
      reason: "loop",
    })
    expect(
      checkRedirectChain(new Map([["/b", "https://x.ie/a"]]), "/a", "/b")
    ).toEqual({ ok: true })
    const chain = new Map([
      ["/h2", "/h3"],
      ["/h3", "/h4"],
      ["/h4", "/h5"],
      ["/h5", "/h6"],
      ["/h6", "/h7"],
    ])
    expect(checkRedirectChain(chain, "/h1", "/h2")).toMatchObject({
      ok: false,
      reason: "too-long",
    })
    chain.delete("/h6")
    expect(checkRedirectChain(chain, "/h1", "/h2")).toEqual({ ok: true })
  })

  it("Location keeps the query unless the target has its own", () => {
    const req = new URL("https://x.ie/old?utm_source=a")
    expect(redirectLocation("/new", req).toString()).toBe(
      "https://x.ie/new?utm_source=a"
    )
    expect(redirectLocation("/new?b=1", req).toString()).toBe(
      "https://x.ie/new?b=1"
    )
    expect(redirectLocation("https://y.ie/z", req).toString()).toBe(
      "https://y.ie/z"
    )
  })
})
```

`tests/integration/api/redirects.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { RedirectDto } from "@/lib/schemas/api/redirects"
import { getDb } from "@/server/db/client"
import { auditLog, redirects } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let marketer: string
let editor: string
let viewer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  marketer = (await signedInUser(["marketer"])).cookie
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
})

const create = (cookie: string, json: unknown) =>
  adminRequest("/redirects", { cookie, method: "POST", json })
const rows = () => getDb().select().from(redirects)
const errorsOf = async (res: Response) =>
  ((await res.json()) as { error: { fieldErrors?: Record<string, string[]> } })
    .error.fieldErrors ?? {}

async function serviceRow(cookie: string, slug: string) {
  const res = await adminRequest(`/services?q=${slug}`, { cookie })
  const { items } = (await res.json()) as {
    items: { id: string; slug: string; version: number }[]
  }
  return items.find((i) => i.slug === slug)!
}

describe("redirects API (master 8.2)", () => {
  it("marketer creates, lists, edits and deletes; every change audited", async () => {
    const created = await create(marketer, {
      fromPath: "/old-alarms",
      toPath: "/services/alarm-responses",
      code: 301,
    })
    expect(created.status).toBe(201)
    const dto = (await created.json()) as RedirectDto
    expect(dto).toMatchObject({ fromPath: "/old-alarms", code: 301, hits: 0 })

    const list = await adminRequest("/redirects?q=alarms", { cookie: viewer })
    expect(list.status).toBe(200)
    expect(((await list.json()) as { total: number }).total).toBe(1)

    const patched = await adminRequest(`/redirects/${dto.id}`, {
      cookie: marketer,
      method: "PATCH",
      json: { code: 302 },
    })
    expect(((await patched.json()) as RedirectDto).code).toBe(302)

    const deleted = await adminRequest(`/redirects/${dto.id}`, {
      cookie: marketer,
      method: "DELETE",
    })
    expect(deleted.status).toBe(200)
    expect(await rows()).toHaveLength(0)
    const actions = (
      await getDb()
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(eq(auditLog.entityType, "redirect"))
    ).map((r) => r.action)
    expect(actions.sort()).toEqual([
      "redirect.created",
      "redirect.deleted",
      "redirect.updated",
    ])
  })

  it("permissions: viewers read, editors have no redirect access", async () => {
    expect((await adminRequest("/redirects", { cookie: editor })).status).toBe(
      403
    )
    expect(
      (await create(viewer, { fromPath: "/x", toPath: "/", code: 301 })).status
    ).toBe(403)
  })

  it("refuses unsafe or reserved paths and live pages (422)", async () => {
    for (const [fromPath, toPath, field] of [
      ["/admin/x", "/", "fromPath"],
      ["/about", "/", "fromPath"],
      ["/services/alarm-responses", "/", "fromPath"],
      ["/old/", "/", "fromPath"],
      ["/old.html", "/", "fromPath"],
      ["/old", "javascript:alert(1)", "toPath"],
      ["/old", "//evil.example", "toPath"],
    ] as const) {
      const res = await create(marketer, { fromPath, toPath, code: 301 })
      expect(res.status, `${fromPath} → ${toPath}`).toBe(422)
      expect(Object.keys(await errorsOf(res))).toContain(field)
    }
  })

  it("a second redirect from the same address → 409", async () => {
    await create(marketer, { fromPath: "/x", toPath: "/", code: 301 })
    const res = await create(marketer, { fromPath: "/x", toPath: "/blog", code: 301 })
    expect(res.status).toBe(409)
    expect(Object.keys(await errorsOf(res))).toEqual(["fromPath"])
  })

  it("loops are rejected on create and on edit (422)", async () => {
    await create(marketer, { fromPath: "/a", toPath: "/b", code: 301 })
    const loop = await create(marketer, { fromPath: "/b", toPath: "/a", code: 301 })
    expect(loop.status).toBe(422)
    expect((await errorsOf(loop)).toPath?.[0]).toMatch(/\/a → \/b → \/a|\/b → \/a → \/b/)
    expect(
      (await create(marketer, { fromPath: "/c", toPath: "/c", code: 301 }))
        .status
    ).toBe(422)

    const c = (await (
      await create(marketer, { fromPath: "/c", toPath: "/blog", code: 301 })
    ).json()) as RedirectDto
    await create(marketer, { fromPath: "/d", toPath: "/c", code: 301 })
    const edit = await adminRequest(`/redirects/${c.id}`, {
      cookie: marketer,
      method: "PATCH",
      json: { toPath: "/d" },
    })
    expect(edit.status).toBe(422)
  })

  it("renaming a published service adds a 301 and re-points older redirects", async () => {
    await create(marketer, {
      fromPath: "/old-alarms",
      toPath: "/services/alarm-responses",
      code: 301,
    })
    const s = await serviceRow(editor, "alarm-responses")
    const renamed = await adminRequest(`/services/${s.id}/slug`, {
      cookie: editor,
      method: "PATCH",
      json: { slug: "alarm-response-team", version: s.version },
    })
    expect(renamed.status).toBe(200)
    const map = new Map((await rows()).map((r) => [r.fromPath, r]))
    expect(map.get("/services/alarm-responses")).toMatchObject({
      toPath: "/services/alarm-response-team",
      code: 301,
    })
    expect(map.get("/old-alarms")?.toPath).toBe("/services/alarm-response-team")

    // Renaming back must not leave a loop.
    const again = await serviceRow(editor, "alarm-response-team")
    await adminRequest(`/services/${again.id}/slug`, {
      cookie: editor,
      method: "PATCH",
      json: { slug: "alarm-responses", version: again.version },
    })
    const after = new Map((await rows()).map((r) => [r.fromPath, r.toPath]))
    expect(after.has("/services/alarm-responses")).toBe(false)
    expect(after.get("/services/alarm-response-team")).toBe(
      "/services/alarm-responses"
    )
    expect(after.get("/old-alarms")).toBe("/services/alarm-responses")
  })

  it("deleting a published service redirects its address to /services", async () => {
    const s = await serviceRow(editor, "event-security")
    const res = await adminRequest(
      `/services/${s.id}?version=${s.version}`,
      { cookie: (await signedInUser(["admin"])).cookie, method: "DELETE" }
    )
    expect(res.status).toBe(200)
    const [row] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.fromPath, "/services/event-security"))
    expect(row?.toPath).toBe("/services")
  })

  it("renaming an unpublished service adds no redirect", async () => {
    const created = await adminRequest("/services", {
      cookie: editor,
      method: "POST",
      json: {
        slug: "draft-only",
        draft: (
          (await (
            await adminRequest(
              `/services/${(await serviceRow(editor, "alarm-responses")).id}`,
              { cookie: editor }
            )
          ).json()) as { draft: unknown }
        ).draft,
      },
    })
    const dto = (await created.json()) as { id: string; version: number }
    await adminRequest(`/services/${dto.id}/slug`, {
      cookie: editor,
      method: "PATCH",
      json: { slug: "draft-only-2", version: dto.version },
    })
    expect(await rows()).toHaveLength(0)
  })

  it("renaming a published article adds a 301 under /blog", async () => {
    const list = await adminRequest("/articles?q=key-holding", {
      cookie: editor,
    })
    const { items } = (await list.json()) as {
      items: { id: string; slug: string; version: number }[]
    }
    const a = items.find((i) => i.slug === "key-holding-explained")!
    const res = await adminRequest(`/articles/${a.id}/meta`, {
      cookie: editor,
      method: "PATCH",
      json: { version: a.version, slug: "key-holding-guide" },
    })
    expect(res.status).toBe(200)
    const [row] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.fromPath, "/blog/key-holding-explained"))
    expect(row?.toPath).toBe("/blog/key-holding-guide")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/seo/redirects.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/seo/redirects"`.

Run: `pnpm test:integration tests/integration/api/redirects.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/schemas/api/redirects"`.

- [ ] **Step 3: Implement**

`lib/seo/redirects.ts`:

```ts
import { isSafeHref } from "@/lib/href"

// Redirect rules shared by the admin form, the API and proxy.ts.

/** Longest allowed chain from a redirect to its final address. */
export const MAX_REDIRECT_HOPS = 5

const RESERVED = ["/admin", "/api", "/_next", "/og", "/images"]
const PATH = /^\/[A-Za-z0-9\-._~%/]*$/
const FILE_EXTENSION = /\.[A-Za-z0-9]+$/

/** Why `path` cannot be a redirect source, or null. Live pages are checked by the server. */
export function fromPathProblem(path: string): string | null {
  if (path.length > 300) return "Keep the address under 300 characters"
  if (!PATH.test(path))
    return "Use an address like /old-page (letters, numbers and - . _ ~ / only, no ? or #)"
  if (path === "/") return "The home page can't be redirected"
  if (path.includes("//")) return "Use single slashes"
  if (path.endsWith("/")) return "Leave off the trailing slash"
  if (
    path.startsWith("/_") ||
    RESERVED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  )
    return "This address belongs to the site itself"
  if (FILE_EXTENSION.test(path))
    return "Addresses ending in a file extension (.html, .php …) can't be redirected"
  return null
}

/** Why `to` cannot be a redirect target, or null (the app's href guard, lib/href.ts). */
export function toPathProblem(to: string): string | null {
  if (to.length === 0) return "Required"
  if (to.length > 2000) return "Keep the address under 2000 characters"
  if (
    !isSafeHref(to) ||
    to.includes("{") ||
    !(to.startsWith("/") || /^https?:\/\//i.test(to))
  )
    return "Use a site address like /services or a full https:// link"
  return null
}

/** The site path a target leads to (query and hash ignored); null for external URLs. */
const targetPath = (to: string): string | null =>
  to.startsWith("/") ? (to.split(/[?#]/)[0] ?? to) : null

export type ChainCheck =
  | { ok: true }
  | { ok: false; reason: "loop" | "too-long"; chain: string[] }

/**
 * Follows `from → to` through the existing redirects (from_path → to_path).
 * A path seen twice is a loop; more than MAX_REDIRECT_HOPS hops is too long.
 */
export function checkRedirectChain(
  existing: ReadonlyMap<string, string>,
  from: string,
  to: string
): ChainCheck {
  const edges = new Map(existing)
  edges.set(from, to)
  const chain = [from]
  let current = targetPath(to)
  while (current !== null) {
    if (chain.includes(current))
      return { ok: false, reason: "loop", chain: [...chain, current] }
    chain.push(current)
    if (chain.length - 1 > MAX_REDIRECT_HOPS)
      return { ok: false, reason: "too-long", chain }
    const next = edges.get(current)
    current = next === undefined ? null : targetPath(next)
  }
  return { ok: true }
}

/** Absolute Location for a matched redirect; a site path keeps the request's query unless it has its own. */
export function redirectLocation(to: string, requestUrl: URL): URL {
  if (!to.startsWith("/")) return new URL(to)
  const url = new URL(to, requestUrl.origin)
  if (!to.includes("?") && requestUrl.search) url.search = requestUrl.search
  return url
}
```

`lib/schemas/api/redirects.ts`:

```ts
import { z } from "zod"

import { fromPathProblem, toPathProblem } from "@/lib/seo/redirects"

import { listQuery, sortParam } from "./list"

const checked = (problem: (value: string) => string | null) =>
  z.string().superRefine((value, ctx) => {
    const message = problem(value)
    if (message) ctx.addIssue({ code: "custom", message })
  })

export const REDIRECT_CODES = [301, 302] as const

/** POST /redirects. Live pages and loops are checked by the service. */
export const redirectInput = z.object({
  fromPath: checked(fromPathProblem),
  toPath: checked(toPathProblem),
  code: z.union([z.literal(301), z.literal(302)]),
})
export type RedirectInput = z.infer<typeof redirectInput>

/** PATCH /redirects/:id — any subset, at least one field. */
export const redirectPatch = redirectInput
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to change")
export type RedirectPatch = z.infer<typeof redirectPatch>

export const redirectListQuery = listQuery.extend({
  sort: sortParam(["fromPath", "hits", "updatedAt"], {
    field: "updatedAt",
    dir: "desc",
  }),
})
export type RedirectListQuery = z.output<typeof redirectListQuery>

export type RedirectDto = {
  id: string
  fromPath: string
  toPath: string
  code: 301 | 302
  hits: number
  createdAt: string
  updatedAt: string
}
```

`server/modules/redirects/repo.ts`:

```ts
import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  or,
  sql,
} from "drizzle-orm"

import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { articles, redirects, services } from "@/server/db/schema"

export type RedirectRow = typeof redirects.$inferSelect
type RedirectValues = { fromPath: string; toPath: string; code: number }

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

export async function listRedirectRows(
  db: DbOrTx,
  opts: {
    q?: string
    sort: Sort<"fromPath" | "hits" | "updatedAt">
    page: number
    pageSize: number
  }
) {
  const pattern = opts.q ? `%${escapeLike(opts.q)}%` : null
  const where = pattern
    ? or(ilike(redirects.fromPath, pattern), ilike(redirects.toPath, pattern))
    : undefined
  const [{ total }] = await db
    .select({ total: count() })
    .from(redirects)
    .where(where)
  const column =
    opts.sort.field === "fromPath"
      ? redirects.fromPath
      : opts.sort.field === "hits"
        ? redirects.hits
        : redirects.updatedAt
  const rows = await db
    .select()
    .from(redirects)
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(redirects.fromPath)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

export async function findRedirectById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(redirects).where(eq(redirects.id, id))
  return row ?? null
}

/** proxy.ts: the redirect for one exact path, if any. */
export async function findRedirectByFrom(db: DbOrTx, fromPath: string) {
  const [row] = await db
    .select({ id: redirects.id, toPath: redirects.toPath, code: redirects.code })
    .from(redirects)
    .where(eq(redirects.fromPath, fromPath))
  return row ?? null
}

/** Every from_path → to_path (loop detection; the table stays small). */
export async function listRedirectEdges(
  db: DbOrTx
): Promise<Map<string, string>> {
  const rows = await db
    .select({ fromPath: redirects.fromPath, toPath: redirects.toPath })
    .from(redirects)
  return new Map(rows.map((r) => [r.fromPath, r.toPath]))
}

export async function insertRedirect(db: DbOrTx, values: RedirectValues) {
  const [row] = await db.insert(redirects).values(values).returning()
  return row
}

export async function updateRedirectRow(
  db: DbOrTx,
  id: string,
  values: RedirectValues
) {
  const [row] = await db
    .update(redirects)
    .set(values)
    .where(eq(redirects.id, id))
    .returning()
  return row ?? null
}

export async function deleteRedirectRow(db: DbOrTx, id: string) {
  const [row] = await db
    .delete(redirects)
    .where(eq(redirects.id, id))
    .returning()
  return row ?? null
}

/** One more hit; updatedAt keeps meaning "last edited". */
export async function incrementRedirectHits(
  db: DbOrTx,
  id: string
): Promise<void> {
  await db
    .update(redirects)
    .set({
      hits: sql`${redirects.hits} + 1`,
      updatedAt: sql`${redirects.updatedAt}`,
    })
    .where(eq(redirects.id, id))
}

/** Serialises redirect writes (loop checks read the whole table). */
export async function lockRedirects(db: DbOrTx): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext('sp:redirects'))`)
}

/** True when a published service/article uses `slug` (its page is live). */
export async function isPublishedSlug(
  db: DbOrTx,
  kind: "service" | "article",
  slug: string
): Promise<boolean> {
  const rows =
    kind === "service"
      ? await db
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.slug, slug), isNotNull(services.published)))
          .limit(1)
      : await db
          .select({ id: articles.id })
          .from(articles)
          .where(and(eq(articles.slug, slug), isNotNull(articles.published)))
          .limit(1)
  return rows.length > 0
}

/**
 * A live address moved from `from` to `to`: nothing may redirect away from
 * the new address, redirects that pointed at the old one follow it, and
 * the old address gets a 301.
 */
export async function moveRedirects(
  db: DbOrTx,
  from: string,
  to: string
): Promise<void> {
  await db.delete(redirects).where(eq(redirects.fromPath, to))
  await db
    .update(redirects)
    .set({ toPath: to })
    .where(eq(redirects.toPath, from))
  await db
    .insert(redirects)
    .values({ fromPath: from, toPath: to, code: 301 })
    .onConflictDoUpdate({
      target: redirects.fromPath,
      set: { toPath: to, code: 301, updatedAt: new Date() },
    })
}
```

`server/modules/redirects/service.ts`:

```ts
import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Paginated } from "@/lib/schemas/api/list"
import type {
  RedirectDto,
  RedirectInput,
  RedirectListQuery,
  RedirectPatch,
} from "@/lib/schemas/api/redirects"
import { checkRedirectChain } from "@/lib/seo/redirects"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { pgErrorCode, UNIQUE_VIOLATION } from "@/server/lib/pg-errors"
import { PAGE_PATHS } from "@/templates/registry"

import {
  deleteRedirectRow,
  findRedirectById,
  insertRedirect,
  isPublishedSlug,
  listRedirectEdges,
  listRedirectRows,
  lockRedirects,
  moveRedirects,
  type RedirectRow,
  updateRedirectRow,
} from "./repo"

const STATIC_PATHS = new Set<string>(Object.values(PAGE_PATHS))
const DETAIL = /^\/(services|blog)\/([^/]+)$/

const decoded = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const invalid = (field: string, message: string) =>
  new AppError("VALIDATION_FAILED", message, {
    fieldErrors: { [field]: [message] },
  })

const duplicate = () =>
  new AppError("CONFLICT", "This address is already redirected", {
    fieldErrors: { fromPath: ["Already redirected — edit that redirect instead"] },
  })

function toDto(row: RedirectRow): RedirectDto {
  return {
    id: row.id,
    fromPath: row.fromPath,
    toPath: row.toPath,
    code: row.code === 302 ? 302 : 301,
    hits: row.hits,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** A live page never redirects (proxy.ts serves it first). */
async function assertFromIsFree(db: DbOrTx, fromPath: string) {
  if (STATIC_PATHS.has(fromPath))
    throw invalid("fromPath", "This address is a live page of the site")
  const detail = DETAIL.exec(fromPath)
  if (
    detail &&
    (await isPublishedSlug(
      db,
      detail[1] === "services" ? "service" : "article",
      decoded(detail[2])
    ))
  )
    throw invalid(
      "fromPath",
      "This address is a live page. Rename or unpublish it first."
    )
}

function assertChain(edges: Map<string, string>, from: string, to: string) {
  const check = checkRedirectChain(edges, from, to)
  if (check.ok) return
  throw invalid(
    "toPath",
    check.reason === "loop"
      ? `This would loop: ${check.chain.join(" → ")}`
      : `Too many hops (${check.chain.join(" → ")}). Point straight at the final address.`
  )
}

function mapUnique(err: unknown): never {
  if (pgErrorCode(err) === UNIQUE_VIOLATION) throw duplicate()
  throw err
}

export async function listRedirectsAdmin(
  actor: Actor,
  query: RedirectListQuery
): Promise<Paginated<RedirectDto>> {
  assertCan(actor, { redirect: ["read"] })
  const { rows, total } = await listRedirectRows(getDb(), {
    q: query.q || undefined,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toDto),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function createRedirect(
  actor: Actor,
  input: RedirectInput
): Promise<RedirectDto> {
  assertCan(actor, { redirect: ["create"] })
  try {
    const row = await getDb().transaction(async (tx) => {
      await lockRedirects(tx)
      await assertFromIsFree(tx, input.fromPath)
      assertChain(await listRedirectEdges(tx), input.fromPath, input.toPath)
      const created = await insertRedirect(tx, input)
      await writeAudit(tx, actor, {
        action: "redirect.created",
        entityType: "redirect",
        entityId: created.id,
        diff: input,
      })
      return created
    })
    return toDto(row)
  } catch (err) {
    return mapUnique(err)
  }
}

export async function updateRedirect(
  actor: Actor,
  id: string,
  patch: RedirectPatch
): Promise<RedirectDto> {
  assertCan(actor, { redirect: ["update"] })
  try {
    const row = await getDb().transaction(async (tx) => {
      await lockRedirects(tx)
      const existing = await findRedirectById(tx, id)
      if (!existing) throw notFound("Redirect")
      const next = {
        fromPath: patch.fromPath ?? existing.fromPath,
        toPath: patch.toPath ?? existing.toPath,
        code: patch.code ?? existing.code,
      }
      if (next.fromPath !== existing.fromPath)
        await assertFromIsFree(tx, next.fromPath)
      const edges = await listRedirectEdges(tx)
      edges.delete(existing.fromPath)
      assertChain(edges, next.fromPath, next.toPath)
      const updated = await updateRedirectRow(tx, id, next)
      if (!updated) throw notFound("Redirect")
      await writeAudit(tx, actor, {
        action: "redirect.updated",
        entityType: "redirect",
        entityId: id,
        diff: {
          from: {
            fromPath: existing.fromPath,
            toPath: existing.toPath,
            code: existing.code,
          },
          to: next,
        },
      })
      return updated
    })
    return toDto(row)
  } catch (err) {
    return mapUnique(err)
  }
}

export async function deleteRedirect(
  actor: Actor,
  id: string
): Promise<{ ok: true }> {
  assertCan(actor, { redirect: ["delete"] })
  await getDb().transaction(async (tx) => {
    const removed = await deleteRedirectRow(tx, id)
    if (!removed) throw notFound("Redirect")
    await writeAudit(tx, actor, {
      action: "redirect.deleted",
      entityType: "redirect",
      entityId: id,
      diff: { fromPath: removed.fromPath, toPath: removed.toPath },
    })
  })
  return { ok: true }
}

/**
 * A published service/article changed address or was deleted: 301 the old
 * address (ledger ruling). Runs inside the caller's transaction, as a side
 * effect of an action the caller was allowed to take (editors have no
 * redirect permission of their own).
 */
export async function recordMove(
  tx: DbOrTx,
  actor: Actor,
  move: { from: string; to: string; reason: string }
): Promise<void> {
  if (move.from === move.to) return
  await lockRedirects(tx)
  await moveRedirects(tx, move.from, move.to)
  await writeAudit(tx, actor, {
    action: "redirect.auto_created",
    entityType: "redirect",
    diff: move,
  })
}
```

`server/modules/redirects/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { idParam } from "@/lib/schemas/api/params"
import {
  redirectInput,
  redirectListQuery,
  redirectPatch,
} from "@/lib/schemas/api/redirects"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

export const redirectsRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ redirect: ["read"] }),
    zv("query", redirectListQuery),
    async (c) =>
      c.json(
        await service.listRedirectsAdmin(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .post(
    "/",
    can({ redirect: ["create"] }),
    zv("json", redirectInput),
    async (c) =>
      c.json(await service.createRedirect(actorOf(c), c.req.valid("json")), 201)
  )
  .patch(
    "/:id",
    can({ redirect: ["update"] }),
    zv("param", idParam),
    zv("json", redirectPatch),
    async (c) =>
      c.json(
        await service.updateRedirect(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:id",
    can({ redirect: ["delete"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.deleteRedirect(actorOf(c), c.req.valid("param").id),
        200
      )
  )
```

`server/api/app.ts` — `import { redirectsRoutes } from "@/server/modules/redirects/routes"` (alphabetical among the module imports) and append `.route("/redirects", redirectsRoutes)` to the `adminRoutes` chain after the last existing `.route(...)`.

`server/modules/services/service.ts` — `import { recordMove } from "@/server/modules/redirects/service"`. In `changeServiceSlug`, inside the transaction directly after the `writeAudit(tx, actor, { action: "service.slug_changed", … })` call:

```ts
      if (existing.published !== null && existing.slug !== input.slug)
        await recordMove(tx, actor, {
          from: `/services/${existing.slug}`,
          to: `/services/${input.slug}`,
          reason: "service.slug_changed",
        })
```

In `deleteService`, inside the transaction directly after the `writeAudit(tx, actor, { action: "service.deleted", … })` call:

```ts
    if (existing.published !== null)
      await recordMove(tx, actor, {
        from: `/services/${existing.slug}`,
        to: "/services",
        reason: "service.deleted",
      })
```

`server/modules/articles/service.ts` (Phase 5) — same import. In `changeArticleMeta`, inside the transaction directly after its `writeAudit(tx, actor, { action: "article.meta_changed", … })`:

```ts
      if (
        row.published !== null &&
        input.slug !== undefined &&
        input.slug !== row.slug
      )
        await recordMove(tx, actor, {
          from: `/blog/${row.slug}`,
          to: `/blog/${input.slug}`,
          reason: "article.slug_changed",
        })
```

In `deleteArticle`, inside the transaction directly after its `writeAudit(tx, actor, { action: "article.deleted", … })`:

```ts
    if (row.published !== null)
      await recordMove(tx, actor, {
        from: `/blog/${row.slug}`,
        to: "/blog",
        reason: "article.deleted",
      })
```

(If the Phase 5 code names the loaded row differently, use that variable; the condition is "the article had published content before this change".)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/seo/redirects.test.ts tests/unit/lint-boundaries.test.ts tests/unit/server-only-guard.test.ts`
Expected: PASS (redirects 4).

Run: `pnpm test:integration tests/integration/api/redirects.test.ts tests/integration/api/collections.test.ts tests/integration/api/articles.test.ts`
Expected: PASS (redirects 9; services/articles suites unchanged — their slug/delete tests now also write `redirect.auto_created` audit rows; if one of them asserts an exact audit list, add `"redirect.auto_created"` to it).

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write lib/seo/redirects.ts lib/schemas/api/redirects.ts server/modules/redirects server/api/app.ts server/modules/services/service.ts server/modules/articles/service.ts tests/unit/seo/redirects.test.ts tests/integration/api/redirects.test.ts
git add lib/seo/redirects.ts lib/schemas/api/redirects.ts server/modules/redirects server/api/app.ts server/modules/services/service.ts server/modules/articles/service.ts tests/unit/seo/redirects.test.ts tests/integration/api/redirects.test.ts
git commit -m "$(cat <<'EOF'
feat(seo): redirects API with loop detection and automatic 301s

Admin CRUD under /api/v1/admin/redirects (redirect permission), paths
checked by the href guard, live pages and reserved paths refused, loops
and chains over five hops rejected with 422. Renaming or deleting a
published service or article 301s the old address and re-points older
redirects.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Proxy — real 404 for unknown slugs, redirects with a hit counter (master Task 8.2, part 2)

**Files:**
- Create: `server/modules/redirects/resolve.ts`
- Modify: `proxy.ts` (full rewrite), `tests/unit/proxy.test.ts` (full rewrite), `tests/e2e/public-site.spec.ts` (unknown slugs are real 404s)
- Test: `tests/unit/redirects-resolve.test.ts`, `tests/integration/redirects/resolve.test.ts`, `tests/e2e/seo.spec.ts` (append)

**Interfaces:**
- Consumes: Task 4 `findRedirectByFrom`, `incrementRedirectHits`, `isPublishedSlug`, `redirectLocation`; `SLUG_PATTERN` (`lib/schemas/common.ts`); `PAGE_PATHS`; `getSessionCookie` (`better-auth/cookies`), `isAdminAuthPath`; `NextFetchEvent.waitUntil`.
- Produces:

```ts
// server/modules/redirects/resolve.ts
export const MISSING_PATH = "/_sp-missing"   // unmatched → app/(site)/[...notFound] → 404
export type PublicPathOutcome =
  | { kind: "pass" }
  | { kind: "missing" }
  | { kind: "redirect"; to: string; code: 301 | 302; recordHit: () => Promise<void> }
export async function resolvePublicPath(pathname: string, options: { draft: boolean }): Promise<PublicPathOutcome>
// proxy.ts
export function adminGate(request: NextRequest): NextResponse
export async function publicGate(request: NextRequest, event: Pick<NextFetchEvent, "waitUntil">): Promise<NextResponse>
export async function proxy(request: NextRequest, event: NextFetchEvent): Promise<NextResponse>
export const config: { matcher: ["/admin/:path*", "/((?!api|admin|_next|og/|images/|favicon.ico|sitemap.xml|robots.txt).*)"] }
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/redirects-resolve.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const repo = vi.hoisted(() => ({
  findRedirectByFrom: vi.fn(),
  incrementRedirectHits: vi.fn(),
  isPublishedSlug: vi.fn(),
}))
vi.mock("@/server/modules/redirects/repo", () => repo)
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }))

import { resolvePublicPath } from "@/server/modules/redirects/resolve"

const live = { draft: false }

beforeEach(() => {
  for (const fn of Object.values(repo)) fn.mockReset()
  repo.findRedirectByFrom.mockResolvedValue(null)
  repo.isPublishedSlug.mockResolvedValue(false)
  repo.incrementRedirectHits.mockResolvedValue(undefined)
})

describe("resolvePublicPath (proxy.ts)", () => {
  it("fixed pages, files and internal paths never touch the database", async () => {
    for (const path of ["/", "/about", "/blog", "/privacy", "/robots-old.txt", "/_sp-missing"])
      expect(await resolvePublicPath(path, live), path).toEqual({ kind: "pass" })
    expect(repo.isPublishedSlug).not.toHaveBeenCalled()
    expect(repo.findRedirectByFrom).not.toHaveBeenCalled()
  })

  it("a published slug passes; an unknown one is missing", async () => {
    repo.isPublishedSlug.mockResolvedValueOnce(true)
    expect(await resolvePublicPath("/services/alarm-responses", live)).toEqual({
      kind: "pass",
    })
    expect(repo.isPublishedSlug).toHaveBeenCalledWith(
      {},
      "service",
      "alarm-responses"
    )
    expect(await resolvePublicPath("/blog/nope", live)).toEqual({
      kind: "missing",
    })
    expect(await resolvePublicPath("/blog/Not_A_Slug", live)).toEqual({
      kind: "missing",
    })
  })

  it("a redirect wins over the 404 and counts its hit on demand", async () => {
    repo.findRedirectByFrom.mockResolvedValue({
      id: "r1",
      toPath: "/services/new",
      code: 301,
    })
    const outcome = await resolvePublicPath("/services/old", live)
    expect(outcome).toMatchObject({
      kind: "redirect",
      to: "/services/new",
      code: 301,
    })
    expect(repo.incrementRedirectHits).not.toHaveBeenCalled()
    if (outcome.kind === "redirect") await outcome.recordHit()
    expect(repo.incrementRedirectHits).toHaveBeenCalledWith({}, "r1")
  })

  it("other unknown paths: redirect if one exists, else pass (catch-all 404)", async () => {
    expect(await resolvePublicPath("/old-page", live)).toEqual({ kind: "pass" })
    repo.findRedirectByFrom.mockResolvedValue({
      id: "r2",
      toPath: "https://x.ie/",
      code: 302,
    })
    expect(await resolvePublicPath("/old-page", live)).toMatchObject({
      kind: "redirect",
      code: 302,
    })
  })

  it("previews skip the slug check; database errors never block a page", async () => {
    expect(await resolvePublicPath("/services/draft", { draft: true })).toEqual({
      kind: "pass",
    })
    expect(repo.isPublishedSlug).not.toHaveBeenCalled()
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    repo.isPublishedSlug.mockRejectedValueOnce(new Error("db down"))
    expect(await resolvePublicPath("/services/x", live)).toEqual({ kind: "pass" })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
```

`tests/unit/proxy.test.ts` (full file):

```ts
import { type NextFetchEvent, NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { resolvePublicPath } = vi.hoisted(() => ({
  resolvePublicPath: vi.fn(),
}))
vi.mock("@/server/modules/redirects/resolve", () => ({
  MISSING_PATH: "/_sp-missing",
  resolvePublicPath,
}))

import { config, proxy } from "@/proxy"

const request = (
  path: string,
  init: { cookie?: string; method?: string } = {}
) =>
  new NextRequest(new URL(path, "http://127.0.0.1:3100"), {
    method: init.method ?? "GET",
    headers: init.cookie ? { cookie: init.cookie } : {},
  })

const event = () => {
  const waitUntil = vi.fn()
  return { event: { waitUntil } as unknown as NextFetchEvent, waitUntil }
}
const run = (path: string, init?: { cookie?: string; method?: string }) =>
  proxy(request(path, init), event().event)

beforeEach(() => {
  resolvePublicPath.mockReset()
  resolvePublicPath.mockResolvedValue({ kind: "pass" })
})

describe("proxy.ts matcher", () => {
  it("admin plus public pages; never /api, static files, OG cards, sitemap or robots", () => {
    expect(config.matcher).toEqual([
      "/admin/:path*",
      "/((?!api|admin|_next|og/|images/|favicon.ico|sitemap.xml|robots.txt).*)",
    ])
  })
})

describe("proxy.ts (optimistic /admin gate)", () => {
  it("redirects /admin without a session cookie to /admin/sign-in?next=/admin", async () => {
    const res = await run("/admin")
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.pathname).toBe("/admin/sign-in")
    expect(location.searchParams.get("next")).toBe("/admin")
    expect(res.headers.get("x-robots-tag")).toBe("noindex")
    expect(resolvePublicPath).not.toHaveBeenCalled()
  })

  it("keeps the query string in next", async () => {
    const res = await run("/admin/users?page=2")
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.searchParams.get("next")).toBe("/admin/users?page=2")
  })

  it("lets the auth pages through without a cookie", async () => {
    for (const path of [
      "/admin/sign-in",
      "/admin/two-factor",
      "/admin/set-password",
      "/admin/reset-password",
      "/admin/forgot-password",
    ]) {
      const res = await run(path)
      expect(res.headers.get("location"), path).toBeNull()
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })

  it("lets requests with a session cookie through (http and https cookie names)", async () => {
    for (const cookie of [
      "sp.session_token=abc.def",
      "__Secure-sp.session_token=abc.def",
    ]) {
      const res = await run("/admin", { cookie })
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })

  it("does not treat look-alike paths as auth pages", async () => {
    expect((await run("/admin/sign-in-later")).status).toBe(307)
  })

  it("gates sub-paths of auth pages (only the exact page is public)", async () => {
    expect((await run("/admin/sign-in/anything")).status).toBe(307)
    expect((await run("/admin/sign-in/")).headers.get("location")).toBeNull()
  })
})

describe("proxy.ts (public pages: real 404 and redirects)", () => {
  it("lets live pages through untouched (no X-Robots-Tag)", async () => {
    const res = await run("/services/alarm-responses")
    expect(res.headers.get("x-middleware-next")).toBe("1")
    expect(res.headers.get("x-robots-tag")).toBeNull()
    expect(resolvePublicPath).toHaveBeenCalledWith(
      "/services/alarm-responses",
      { draft: false }
    )
  })

  it("rewrites a missing record to the catch-all 404", async () => {
    resolvePublicPath.mockResolvedValue({ kind: "missing" })
    const res = await run("/blog/nope")
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "http://127.0.0.1:3100/_sp-missing"
    )
  })

  it("redirects with the stored code and counts the hit after responding", async () => {
    const recordHit = vi.fn().mockResolvedValue(undefined)
    resolvePublicPath.mockResolvedValue({
      kind: "redirect",
      to: "/services/new",
      code: 301,
      recordHit,
    })
    const { event: e, waitUntil } = event()
    const res = await proxy(request("/services/old?utm=x"), e)
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe(
      "http://127.0.0.1:3100/services/new?utm=x"
    )
    expect(recordHit).toHaveBeenCalledTimes(1)
    expect(waitUntil).toHaveBeenCalledTimes(1)
  })

  it("302 for temporary redirects", async () => {
    resolvePublicPath.mockResolvedValue({
      kind: "redirect",
      to: "https://example.ie/x",
      code: 302,
      recordHit: vi.fn().mockResolvedValue(undefined),
    })
    const res = await run("/promo")
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://example.ie/x")
  })

  it("previews (draft-mode cookie) skip the slug check", async () => {
    await run("/services/x", { cookie: "__prerender_bypass=abc" })
    expect(resolvePublicPath).toHaveBeenCalledWith("/services/x", {
      draft: true,
    })
  })

  it("only GET and HEAD are looked up", async () => {
    const res = await run("/contact", { method: "POST" })
    expect(resolvePublicPath).not.toHaveBeenCalled()
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })
})
```

`tests/integration/redirects/resolve.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { redirects, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { resolvePublicPath } from "@/server/modules/redirects/resolve"

import { resetDb } from "../db"

const live = { draft: false }

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("resolvePublicPath against the database", () => {
  it("published slugs pass, unknown and unpublished ones are missing", async () => {
    expect(await resolvePublicPath("/services/alarm-responses", live)).toEqual({
      kind: "pass",
    })
    expect(await resolvePublicPath("/blog/no-such-article", live)).toEqual({
      kind: "missing",
    })
    await getDb()
      .update(services)
      .set({ published: null })
      .where(eq(services.slug, "event-security"))
    expect(await resolvePublicPath("/services/event-security", live)).toEqual({
      kind: "missing",
    })
  })

  it("a redirect hit increments hits once and leaves updatedAt alone", async () => {
    const [row] = await getDb()
      .insert(redirects)
      .values({ fromPath: "/old-alarms", toPath: "/services/alarm-responses" })
      .returning()
    const outcome = await resolvePublicPath("/old-alarms", live)
    expect(outcome).toMatchObject({
      kind: "redirect",
      to: "/services/alarm-responses",
      code: 301,
    })
    if (outcome.kind === "redirect") await outcome.recordHit()
    const [after] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.id, row.id))
    expect(after.hits).toBe(1)
    expect(after.updatedAt.getTime()).toBe(row.updatedAt.getTime())
  })
})
```

`tests/e2e/public-site.spec.ts` — replace the first `for` loop (the soft-404 test) with:

```ts
  for (const path of ["/services/no-such-service", "/blog/no-such-article"]) {
    test(`unknown slug ${path} is a real 404`, async ({ page }) => {
      // proxy.ts checks the slug before the page streams (phase 8).
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
      await expect(
        page.getByRole("heading", { name: "This page could not be found." })
      ).toBeVisible()
      await expect(
        page.locator('meta[name="robots"][content*="noindex"]')
      ).not.toHaveCount(0)
    })
  }
```

Append to `tests/e2e/seo.spec.ts` (add `import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"` to its imports):

```ts
async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

const SAME_ORIGIN = { origin: BASE_URL }

test.describe("redirects (proxy)", () => {
  test.beforeEach(async ({ context }, testInfo) => {
    await context.setExtraHTTPHeaders({
      "x-forwarded-for": clientIpFor(testInfo.title),
    })
  })

  test("a manual redirect answers 301 and counts its hit", async ({ page }) => {
    await signIn(page, readFixtures().owner.email)
    const created = await page.request.post("/api/v1/admin/redirects", {
      headers: SAME_ORIGIN,
      data: { fromPath: "/old-alarms", toPath: "/services/alarm-responses", code: 301 },
    })
    expect(created.status()).toBe(201)
    const { id } = (await created.json()) as { id: string }
    const res = await page.request.get("/old-alarms?utm_source=e2e", {
      maxRedirects: 0,
    })
    expect(res.status()).toBe(301)
    expect(res.headers().location).toBe(
      `${BASE_URL}/services/alarm-responses?utm_source=e2e`
    )
    await expect
      .poll(async () => {
        const list = await page.request.get("/api/v1/admin/redirects?q=old-alarms")
        return ((await list.json()) as { items: { hits: number }[] }).items[0]
          ?.hits
      })
      .toBe(1)
    await page.request.delete(`/api/v1/admin/redirects/${id}`, {
      headers: SAME_ORIGIN,
    })
  })

  test("renaming a published service 301s the old address", async ({ page }) => {
    await signIn(page, readFixtures().owner.email)
    const find = async (slug: string) => {
      const res = await page.request.get(`/api/v1/admin/services?q=${slug}`)
      const { items } = (await res.json()) as {
        items: { id: string; slug: string; version: number }[]
      }
      return items.find((i) => i.slug === slug)!
    }
    const rename = async (from: string, to: string) => {
      const s = await find(from)
      const res = await page.request.patch(`/api/v1/admin/services/${s.id}/slug`, {
        headers: SAME_ORIGIN,
        data: { slug: to, version: s.version },
      })
      expect(res.status()).toBe(200)
    }
    await rename("open-up-lock-ups", "open-up-and-lock-up")
    try {
      const old = await page.request.get("/services/open-up-lock-ups", {
        maxRedirects: 0,
      })
      expect(old.status()).toBe(301)
      expect(old.headers().location).toBe(
        `${BASE_URL}/services/open-up-and-lock-up`
      )
      expect((await page.request.get("/services/open-up-and-lock-up")).status()).toBe(200)
    } finally {
      await rename("open-up-and-lock-up", "open-up-lock-ups")
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/redirects-resolve.test.ts tests/unit/proxy.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/modules/redirects/resolve"`; the matcher test fails (`["/admin/:path*"]`).

- [ ] **Step 3: Implement**

`server/modules/redirects/resolve.ts`:

```ts
import "server-only"

import { SLUG_PATTERN } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import { PAGE_PATHS } from "@/templates/registry"

import {
  findRedirectByFrom,
  incrementRedirectHits,
  isPublishedSlug,
} from "./repo"

/**
 * An unmatched path: app/(site)/[...notFound] answers it with notFound()
 * before anything streams, i.e. a real 404 (probed with Next 16.3.8).
 */
export const MISSING_PATH = "/_sp-missing"

export type PublicPathOutcome =
  | { kind: "pass" }
  | { kind: "missing" }
  | {
      kind: "redirect"
      to: string
      code: 301 | 302
      /** Counts the hit; proxy.ts runs it after responding (waitUntil). */
      recordHit: () => Promise<void>
    }

const PASS = { kind: "pass" } as const
const MISSING = { kind: "missing" } as const
const STATIC_PATHS = new Set<string>(Object.values(PAGE_PATHS))
const DETAIL = /^\/(services|blog)\/([^/]+)$/
const FILE_EXTENSION = /\.[A-Za-z0-9]+$/

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/**
 * What proxy.ts does with a public GET: fixed pages and files pass without
 * a query; /services/:slug and /blog/:slug pass only when published (else
 * a redirect, else a real 404); any other path gets the redirect lookup
 * and otherwise reaches the catch-all 404. Previews (draft mode) skip the
 * slug check. A database failure never blocks the page (the page's own
 * error boundary reports it).
 */
export async function resolvePublicPath(
  pathname: string,
  options: { draft: boolean }
): Promise<PublicPathOutcome> {
  if (
    STATIC_PATHS.has(pathname) ||
    pathname.startsWith("/_") ||
    FILE_EXTENSION.test(pathname)
  )
    return PASS
  const detail = DETAIL.exec(pathname)
  if (detail && options.draft) return PASS
  try {
    const db = getDb()
    if (detail) {
      const slug = detail[2]
      const kind = detail[1] === "services" ? "service" : "article"
      if (SLUG_PATTERN.test(slug) && (await isPublishedSlug(db, kind, slug)))
        return PASS
    }
    const redirect = await findRedirectByFrom(db, pathname)
    if (redirect)
      return {
        kind: "redirect",
        to: redirect.toPath,
        code: redirect.code === 302 ? 302 : 301,
        recordHit: () =>
          incrementRedirectHits(getDb(), redirect.id).catch((error: unknown) => {
            console.error("[proxy] redirect hit not counted:", message(error))
          }),
      }
    return detail ? MISSING : PASS
  } catch (error) {
    console.error("[proxy] public path lookup failed:", message(error))
    return PASS
  }
}
```

`proxy.ts` (full file):

```ts
import { getSessionCookie } from "better-auth/cookies"
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server"

import { isAdminAuthPath } from "@/lib/auth/redirect"
import { redirectLocation } from "@/lib/seo/redirects"
import {
  MISSING_PATH,
  resolvePublicPath,
} from "@/server/modules/redirects/resolve"

/** Next's draft-mode cookie (next/dist/server/api-utils COOKIE_NAME_PRERENDER_BYPASS). */
const DRAFT_COOKIE = "__prerender_bypass"

/**
 * Admin gate, optimistic only: checks that a session cookie is present (no
 * DB). The real checks are requireSession() in the panel layout and the
 * Hono middleware.
 */
export function adminGate(request: NextRequest): NextResponse {
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

/**
 * Public pages (GET/HEAD): real 404 for unknown service/article slugs and
 * the redirects table, decided before the page streams — with Cache
 * Components the status is 200 once streaming starts (Next docs,
 * streaming "Status codes"; phase-08 correction).
 */
export async function publicGate(
  request: NextRequest,
  event: Pick<NextFetchEvent, "waitUntil">
): Promise<NextResponse> {
  if (request.method !== "GET" && request.method !== "HEAD")
    return NextResponse.next()
  const outcome = await resolvePublicPath(request.nextUrl.pathname, {
    draft: request.cookies.has(DRAFT_COOKIE),
  })
  if (outcome.kind === "missing")
    return NextResponse.rewrite(new URL(MISSING_PATH, request.url))
  if (outcome.kind === "redirect") {
    event.waitUntil(outcome.recordHit())
    return NextResponse.redirect(
      redirectLocation(outcome.to, new URL(request.url)),
      outcome.code
    )
  }
  return NextResponse.next()
}

export async function proxy(
  request: NextRequest,
  event: NextFetchEvent
): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  if (pathname === "/admin" || pathname.startsWith("/admin/"))
    return adminGate(request)
  return publicGate(request, event)
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Public pages only. Never /api: the proxy buffers request bodies and
    // truncates them over 10 MB (uploads). Static files, share cards,
    // sitemap and robots need no lookup.
    "/((?!api|admin|_next|og/|images/|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/redirects-resolve.test.ts tests/unit/proxy.test.ts tests/unit/lint-boundaries.test.ts`
Expected: PASS (resolve 5, proxy 12).

Run: `pnpm test:integration tests/integration/redirects/resolve.test.ts`
Expected: PASS (2).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: clean; the build summary lists `ƒ Proxy (Middleware)`.

Run: `pnpm test:e2e tests/e2e/public-site.spec.ts tests/e2e/seo.spec.ts tests/e2e/admin-auth.spec.ts tests/e2e/preview.spec.ts` then `pnpm test:visual`
Expected: unknown slugs answer 404; redirects 301 with hits; "public site does not carry X-Robots-Tag" and the preview flow still pass; visual 0 px (the 404 baseline `/this-page-does-not-exist` is unchanged).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write proxy.ts server/modules/redirects/resolve.ts tests/unit/proxy.test.ts tests/unit/redirects-resolve.test.ts tests/integration/redirects/resolve.test.ts tests/e2e/public-site.spec.ts tests/e2e/seo.spec.ts
git add proxy.ts server/modules/redirects/resolve.ts tests/unit/proxy.test.ts tests/unit/redirects-resolve.test.ts tests/integration/redirects/resolve.test.ts tests/e2e/public-site.spec.ts tests/e2e/seo.spec.ts
git commit -m "$(cat <<'EOF'
feat(seo): real 404 for unknown slugs and redirects in proxy.ts

Public GETs are checked before the page streams: unpublished or unknown
service/article slugs rewrite to the catch-all 404, stored redirects
answer 301/302 and count their hit after the response. /api stays out
of the matcher; previews skip the check; DB errors never block a page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Sitemap and robots from the database (master Task 8.2, part 3)

**Files:**
- Create: `lib/seo/sitemap.ts`, `app/sitemap.ts`, `app/robots.ts`
- Modify: `server/modules/seo/repo.ts` (add `listSitemapRows`), `server/modules/seo/queries.ts` (add `listSitemapEntries`)
- Test: `tests/unit/seo/sitemap.test.ts`, `tests/integration/queries/sitemap.test.ts`, `tests/e2e/seo.spec.ts` (append)

**Interfaces:**
- Consumes: Task 1 `absoluteUrl`, `filled`, `publicOrigin`; Task 3 `getPublishedSettings`; `revisions` (one row per publish: `entity_type` page|service|article, `entity_id` = page key or record id); `PAGE_PATHS`, `PAGE_KEYS`.
- Produces:

```ts
// lib/seo/sitemap.ts
export type SitemapSource = { path: string; lastModified: Date | null; noindex: boolean; canonical: string | null }
export function buildSitemap(sources: readonly SitemapSource[], origin: string): MetadataRoute.Sitemap
export const ROBOTS_DISALLOW: readonly ["/admin", "/api"]
export function buildRobots(origin: string): MetadataRoute.Robots
// server/modules/seo/repo.ts
export type SitemapRow = { kind: "page" | "service" | "article"; key: string; seo: Seo; publishedAt: Date | null; lastPublish: Date | null }
export async function listSitemapRows(db: DbOrTx): Promise<SitemapRow[]>   // published rows only
// server/modules/seo/queries.ts
export async function listSitemapEntries(): Promise<SitemapSource[]>        // 'use cache'; tags services, articles, page:*
// app/sitemap.ts → /sitemap.xml · app/robots.ts → /robots.txt
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/seo/sitemap.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { buildRobots, buildSitemap } from "@/lib/seo/sitemap"

const ORIGIN = "https://www.securitypartnersltd.com"
const when = new Date("2026-10-01T09:00:00Z")

describe("sitemap and robots", () => {
  it("lists indexable canonical URLs once, with lastmod when known", () => {
    expect(
      buildSitemap(
        [
          { path: "/", lastModified: when, noindex: false, canonical: null },
          { path: "/about", lastModified: null, noindex: false, canonical: null },
          { path: "/terms", lastModified: when, noindex: true, canonical: null },
          {
            path: "/blog/a",
            lastModified: when,
            noindex: false,
            canonical: "https://elsewhere.ie/a",
          },
          {
            path: "/blog/b",
            lastModified: when,
            noindex: false,
            canonical: `${ORIGIN}/blog/b`,
          },
          { path: "/", lastModified: when, noindex: false, canonical: null },
        ],
        ORIGIN
      )
    ).toEqual([
      { url: `${ORIGIN}/`, lastModified: when },
      { url: `${ORIGIN}/about` },
      { url: `${ORIGIN}/blog/b`, lastModified: when },
    ])
  })

  it("robots: everything but /admin and /api (media files stay crawlable), plus the sitemap", () => {
    expect(buildRobots(ORIGIN)).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/api/v1/media/file/"],
          disallow: ["/admin", "/api"],
        },
      ],
      sitemap: `${ORIGIN}/sitemap.xml`,
    })
  })
})
```

`tests/integration/queries/sitemap.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getDb } from "@/server/db/client"
import { articles, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { listSitemapEntries } from "@/server/modules/seo/queries"

import { resetDb } from "../db"

const fx = fixtureSiteSources()

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("sitemap entries (published only)", () => {
  it("every page, service and article, in that order, with lastmod", async () => {
    const entries = await listSitemapEntries()
    const paths = entries.map((e) => e.path)
    expect(paths.slice(0, 8).sort()).toEqual(
      ["/", "/about", "/blog", "/contact", "/privacy", "/services", "/team", "/terms"].sort()
    )
    expect(paths).toContain("/services/alarm-responses")
    expect(paths).toHaveLength(8 + fx.services.length + fx.articles.length)
    for (const entry of entries)
      expect(entry.lastModified, entry.path).toBeInstanceOf(Date)
  })

  it("drafts are left out; noindex and canonical are reported", async () => {
    await getDb()
      .update(services)
      .set({ published: null })
      .where(eq(services.slug, "event-security"))
    const article = fx.articles[0]
    await getDb()
      .update(articles)
      .set({ seo: { noindex: true, canonical: "https://x.ie/a" } })
      .where(eq(articles.slug, article.slug))
    const entries = await listSitemapEntries()
    expect(entries.map((e) => e.path)).not.toContain("/services/event-security")
    expect(entries.find((e) => e.path === `/blog/${article.slug}`)).toMatchObject({
      noindex: true,
      canonical: "https://x.ie/a",
    })
  })
})
```

Append to `tests/e2e/seo.spec.ts`:

```ts
test.describe("sitemap and robots", () => {
  test("sitemap.xml lists published URLs on the site origin", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml")
    expect(res.status()).toBe(200)
    const xml = await res.text()
    expect(xml).toContain(`<loc>${BASE_URL}/</loc>`)
    expect(xml).toContain(`<loc>${BASE_URL}/services/alarm-responses</loc>`)
    expect(xml).toContain(`<loc>${BASE_URL}/blog/key-holding-explained</loc>`)
    expect(xml).toContain("<lastmod>")
    expect(xml).not.toContain("/admin")
  })

  test("robots.txt keeps crawlers out of /admin and /api", async ({
    request,
  }) => {
    const text = await (await request.get("/robots.txt")).text()
    expect(text).toContain("Disallow: /admin")
    expect(text).toContain("Disallow: /api")
    expect(text).toContain(`Sitemap: ${BASE_URL}/sitemap.xml`)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/seo/sitemap.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/seo/sitemap"`.

Run: `pnpm test:integration tests/integration/queries/sitemap.test.ts`
Expected: FAIL — `listSitemapEntries is not a function` (not exported).

- [ ] **Step 3: Implement**

`lib/seo/sitemap.ts`:

```ts
import type { MetadataRoute } from "next"

import { absoluteUrl } from "./urls"

export type SitemapSource = {
  path: string
  lastModified: Date | null
  noindex: boolean
  /** The record's canonical override; listed only when it is this URL. */
  canonical: string | null
}

/** Indexable canonical URLs, each once, in source order (spec §10). */
export function buildSitemap(
  sources: readonly SitemapSource[],
  origin: string
): MetadataRoute.Sitemap {
  const seen = new Set<string>()
  const out: MetadataRoute.Sitemap = []
  for (const source of sources) {
    if (source.noindex) continue
    const url = absoluteUrl(origin, source.path)
    if (source.canonical && source.canonical !== url) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(
      source.lastModified ? { url, lastModified: source.lastModified } : { url }
    )
  }
  return out
}

export const ROBOTS_DISALLOW = ["/admin", "/api"] as const

/** Uploaded media is served under /api/v1/media/file/ and stays crawlable. */
export function buildRobots(origin: string): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/v1/media/file/"],
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: absoluteUrl(origin, "/sitemap.xml"),
  }
}
```

`server/modules/seo/repo.ts` — add `asc`, `desc`, `type SQL` to the `drizzle-orm` import, `revisions` to the schema import, `import type { Seo } from "@/lib/schemas/common"`, and append:

```ts
export type SitemapRow = {
  kind: "page" | "service" | "article"
  /** Page key or slug. */
  key: string
  seo: Seo
  publishedAt: Date | null
  /** Time of the newest revision (one is written per publish). */
  lastPublish: Date | null
}

const lastPublish = (entityType: string, entityId: SQL) =>
  sql<Date | null>`(select max(${revisions.createdAt}) from ${revisions} where ${revisions.entityType} = ${entityType} and ${revisions.entityId} = ${entityId})`.mapWith(
    revisions.createdAt
  )

/** Published pages, services and articles for the sitemap (never drafts). */
export async function listSitemapRows(db: DbOrTx): Promise<SitemapRow[]> {
  const pageRows = await db
    .select({
      key: pages.key,
      seo: pages.seo,
      publishedAt: pages.publishedAt,
      lastPublish: lastPublish("page", sql`${pages.key}`),
    })
    .from(pages)
    .where(isNotNull(pages.published))
    .orderBy(asc(pages.key))
  const serviceRows = await db
    .select({
      key: services.slug,
      seo: services.seo,
      publishedAt: services.publishedAt,
      lastPublish: lastPublish("service", sql`${services.id}::text`),
    })
    .from(services)
    .where(isNotNull(services.published))
    .orderBy(asc(services.sortOrder), asc(services.slug))
  const articleRows = await db
    .select({
      key: articles.slug,
      seo: articles.seo,
      publishedAt: articles.publishedAt,
      lastPublish: lastPublish("article", sql`${articles.id}::text`),
    })
    .from(articles)
    .where(isNotNull(articles.published))
    .orderBy(desc(articles.publishedAt))
  return [
    ...pageRows.map((row) => ({ kind: "page" as const, ...row })),
    ...serviceRows.map((row) => ({ kind: "service" as const, ...row })),
    ...articleRows.map((row) => ({ kind: "article" as const, ...row })),
  ]
}
```

`server/modules/seo/queries.ts` — add imports `import { filled } from "@/lib/seo/effective"`, `import type { SitemapSource } from "@/lib/seo/sitemap"`, `import { PAGE_KEYS, PAGE_PATHS, type PageKey } from "@/templates/registry"`, add `listSitemapRows` to the `./repo` import, and append:

```ts
const latest = (a: Date | null, b: Date | null) =>
  a && b ? (a > b ? a : b) : (a ?? b)

/** Sitemap sources from published rows only (draft mode is never read). */
export async function listSitemapEntries(): Promise<SitemapSource[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.services, tag.articles, ...PAGE_KEYS.map((key) => tag.page(key)))
  const rows = await listSitemapRows(getDb())
  return rows.map((row) => ({
    path:
      row.kind === "page"
        ? PAGE_PATHS[row.key as PageKey]
        : row.kind === "service"
          ? `/services/${row.key}`
          : `/blog/${row.key}`,
    lastModified: latest(row.publishedAt, row.lastPublish),
    noindex: row.seo.noindex === true,
    canonical: filled(row.seo.canonical),
  }))
}
```

`app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { buildSitemap } from "@/lib/seo/sitemap"
import { publicOrigin } from "@/server/lib/site-origin"
import { listSitemapEntries } from "@/server/modules/seo/queries"
import { getPublishedSettings } from "@/server/modules/settings/queries"

/** /sitemap.xml from published pages, services and articles (spec §10). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const [site, entries] = await Promise.all([
    getPublishedSettings("site"),
    listSitemapEntries(),
  ])
  return buildSitemap(entries, publicOrigin(site?.productionUrl ?? null))
}
```

`app/robots.ts`:

```ts
import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { buildRobots } from "@/lib/seo/sitemap"
import { publicOrigin } from "@/server/lib/site-origin"
import { getPublishedSettings } from "@/server/modules/settings/queries"

/** /robots.txt: the sitemap on the production origin; no admin or API. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  const site = await getPublishedSettings("site")
  return buildRobots(publicOrigin(site?.productionUrl ?? null))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/seo/sitemap.test.ts && pnpm test:integration tests/integration/queries/sitemap.test.ts`
Expected: PASS (sitemap 2, entries 2).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: clean; `ƒ /robots.txt` and `ƒ /sitemap.xml` (dynamic, no DB at build).

Run: `pnpm test:e2e tests/e2e/seo.spec.ts`
Expected: PASS (all seo tests so far).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write lib/seo/sitemap.ts app/sitemap.ts app/robots.ts server/modules/seo tests/unit/seo/sitemap.test.ts tests/integration/queries/sitemap.test.ts tests/e2e/seo.spec.ts
git add lib/seo/sitemap.ts app/sitemap.ts app/robots.ts server/modules/seo tests/unit/seo/sitemap.test.ts tests/integration/queries/sitemap.test.ts tests/e2e/seo.spec.ts
git commit -m "$(cat <<'EOF'
feat(seo): sitemap.xml and robots.txt from the database

Published pages, services and articles with lastmod from their last
publish, skipping noindex and canonical-elsewhere records; robots keeps
crawlers out of /admin and /api and points at the sitemap.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Admin API — SEO/marketing settings, per-record SEO, SEO overview, revisions allow-list (master Tasks 8.1 + 8.3, API)

**Files:**
- Create: `lib/admin/growth-settings.ts`, `lib/schemas/api/marketing.ts`, `lib/schemas/api/seo.ts`, `lib/seo/checks.ts`, `server/modules/marketing/service.ts`, `server/modules/marketing/routes.ts`, `server/modules/seo/service.ts`, `server/modules/seo/routes.ts`
- Modify: `server/modules/seo/repo.ts` (add `listSeoRows`, `findSeoRow`, `updateSeoColumn`), `server/lib/versioning.ts` (optional `mediaValues`), `server/modules/pages/service.ts` (`pageStore`), `server/modules/services/service.ts` (`serviceStore`), `server/modules/articles/service.ts` (`storeFor`), `server/lib/media-usages.ts` (`backfillMediaUsages`, if it lists page/service/article values), `server/modules/media/service.ts` (`describeUsage`), `server/modules/revisions/service.ts` (per-key allow-list), `server/api/app.ts` (mount `/marketing`, `/seo`)
- Test: `tests/unit/seo/checks.test.ts`, `tests/integration/api/marketing.test.ts`, `tests/integration/api/seo.test.ts`

**Interfaces:**
- Consumes: `saveDraft` / `publish` / `restoreRevision` / `versionedDto` / `VersionedStore` (`server/lib/versioning.ts`), `findSettingsForEdit` / `findSettingsRow` / `updateSettingsIfVersion` / `SettingsEditRow` (`server/modules/settings/repo.ts`), `settingsSchemas`, `SETTINGS_ENTRIES` / `isEditableSettingsKey`, `syncMediaUsages`, `fieldErrorsFromIssues`, Task 1 `effectiveSeo`, `seo` schema (`lib/schemas/common.ts`), `PAGE_LABELS`, `PAGE_PATHS`, `isPageKey`, `contactPlaceholders`.
- Produces:

```ts
// lib/admin/growth-settings.ts
export const GROWTH_SETTINGS_KEYS: readonly ["seo.defaults", "tracking", "consent", "customCode"]
export type GrowthSettingsKey = (typeof GROWTH_SETTINGS_KEYS)[number]
export const GROWTH_SETTINGS: Record<GrowthSettingsKey, { label: string; description: string; href: string; read: PermissionRequest; update: PermissionRequest }>
export function isGrowthSettingsKey(value: string): value is GrowthSettingsKey
// lib/schemas/api/marketing.ts
export const growthKeyParam: z.ZodObject<{ key: z.ZodString }>
export type GrowthSettingsDto = VersionedDto<unknown> & { key: GrowthSettingsKey; label: string; description: string; canEdit: boolean }
// lib/seo/checks.ts
export const SEO_CHECKS: readonly ["title-length", "own-description", "description-length", "indexable"]
export type SeoCheckId; export const SEO_CHECK_COUNT = 4
export const SEO_LIMITS: { titleMin: 15; titleMax: 60; descriptionMin: 50; descriptionMax: 160 }
export function seoIssues(input: { title: string; description: string; usesDefaultDescription: boolean; noindex: boolean }): SeoIssue[]
// lib/schemas/api/seo.ts
export const SEO_KINDS: readonly ["page", "service", "article"]; export type SeoKind
export const seoEntryParam, seoUpdateInput
export type SeoIssue = { check: SeoCheckId; message: string }
export type SeoEntry = { kind: SeoKind; id: string; name: string; path: string; published: boolean; seo: Seo; title: string; description: string; fallback: { title: string; description: string }; image: "own" | "default" | "generated"; issues: SeoIssue[] }
export type SeoOverviewDto = { entries: SeoEntry[]; checks: { passed: number; total: number } }
// server/lib/versioning.ts (VersionedStore, additive)
mediaValues?(record: R): unknown[]      // default [record.draft, record.published]
// HTTP (admin)
GET  /marketing/:key                    per key: GROWTH_SETTINGS[key].read   → GrowthSettingsDto
PUT  /marketing/:key/draft              GROWTH_SETTINGS[key].update         { draft, version }
POST /marketing/:key/publish            GROWTH_SETTINGS[key].update         { version }
POST /marketing/:key/restore            GROWTH_SETTINGS[key].update         { revisionId, version }
GET  /seo/overview                      seo:read                            → SeoOverviewDto
PUT  /seo/entries/:kind/:id             seo:update   { seo }                → SeoEntry   (page id = key; service/article id = uuid)
GET  /revisions/settings/:key[/:revisionId]  content keys: settings:read; seo.defaults: seo:read; tracking/consent: marketing:read; customCode: customCode:read (owner); anything else 404
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/seo/checks.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { SEO_CHECK_COUNT, seoIssues } from "@/lib/seo/checks"

const good = {
  title: "Alarm Responses | Security Partners Ltd.",
  description:
    "Our trained team responds to your alarm day or night, across Laois and beyond.",
  usesDefaultDescription: false,
  noindex: false,
}

describe("SEO checks", () => {
  it("a well-described indexable page passes all four", () => {
    expect(SEO_CHECK_COUNT).toBe(4)
    expect(seoIssues(good)).toEqual([])
  })

  it("reports each problem once, in check order", () => {
    expect(
      seoIssues({
        title: "Hi",
        description: "Short",
        usesDefaultDescription: true,
        noindex: true,
      })
    ).toEqual([
      { check: "title-length", message: "Title is 2 characters; aim for 15–60." },
      {
        check: "own-description",
        message: "Uses the site-wide default description.",
      },
      {
        check: "description-length",
        message: "Description is 5 characters; aim for 50–160.",
      },
      { check: "indexable", message: "Hidden from search engines (noindex)." },
    ])
  })

  it("counts characters, not UTF-16 units", () => {
    // 31 characters, 62 UTF-16 units: within 15–60 characters.
    expect(
      seoIssues({ ...good, title: "🔒".repeat(31) }).map((i) => i.check)
    ).not.toContain("title-length")
    expect(
      seoIssues({ ...good, title: "é".repeat(61) }).map((i) => i.check)
    ).toContain("title-length")
  })
})
```

`tests/integration/api/marketing.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { GrowthSettingsDto } from "@/lib/schemas/api/marketing"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let owner: string
let admin: string
let editor: string
let marketer: string
let viewer: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  owner = (await signedInUser(["owner"])).cookie
  admin = (await signedInUser(["admin"])).cookie
  editor = (await signedInUser(["editor"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  revalidateTag.mockClear()
})

const get = (cookie: string, key: string) =>
  adminRequest(`/marketing/${key}`, { cookie })

async function saveAndPublish(
  cookie: string,
  key: string,
  change: (draft: Record<string, unknown>) => unknown
) {
  const dto = (await (await get(cookie, key)).json()) as GrowthSettingsDto
  const saved = await adminRequest(`/marketing/${key}/draft`, {
    cookie,
    method: "PUT",
    json: { draft: change(dto.draft as Record<string, unknown>), version: dto.version },
  })
  expect(saved.status).toBe(200)
  const { version } = (await saved.json()) as GrowthSettingsDto
  return adminRequest(`/marketing/${key}/publish`, {
    cookie,
    method: "POST",
    json: { version },
  })
}

describe("SEO/marketing settings API (master 8.1, 8.3)", () => {
  it("marketer edits tracking with draft → publish; settings:tracking expires", async () => {
    const res = await saveAndPublish(marketer, "tracking", (d) => ({
      ...d,
      enabled: true,
      gtmId: "GTM-ABC123",
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      key: "tracking",
      label: "Tracking",
      dirty: false,
      canEdit: true,
      published: { enabled: true, gtmId: "GTM-ABC123" },
    })
    expect(revalidateTag).toHaveBeenCalledWith("settings:tracking", {
      expire: 0,
    })
  })

  it("permissions per key; custom code is owner-only", async () => {
    expect((await get(editor, "tracking")).status).toBe(403)
    expect((await get(editor, "seo.defaults")).status).toBe(200)
    expect((await get(viewer, "consent")).status).toBe(200)
    expect(
      (
        await adminRequest("/marketing/consent/draft", {
          cookie: viewer,
          method: "PUT",
          json: { draft: {}, version: 1 },
        })
      ).status
    ).toBe(403)
    expect((await get(admin, "customCode")).status).toBe(403)
    expect(
      (
        await adminRequest("/marketing/customCode/draft", {
          cookie: admin,
          method: "PUT",
          json: { draft: { headHtml: "", bodyEndHtml: "" }, version: 1 },
        })
      ).status
    ).toBe(403)
    const published = await saveAndPublish(owner, "customCode", (d) => ({
      ...d,
      headHtml: '<meta name="x" content="y">',
    }))
    expect(published.status).toBe(200)
  })

  it("keys edited elsewhere are 404 here; these keys stay 404 under /settings", async () => {
    for (const key of ["site", "leads", "integrations.smtp", "nope"])
      expect((await get(owner, key)).status, key).toBe(404)
    expect((await adminRequest("/settings/consent", { cookie: owner })).status).toBe(
      404
    )
  })

  it("invalid values → 422 with field paths", async () => {
    const dto = (await (await get(marketer, "tracking")).json()) as GrowthSettingsDto
    const res = await adminRequest("/marketing/tracking/draft", {
      cookie: marketer,
      method: "PUT",
      json: {
        draft: { ...(dto.draft as object), gtmId: "ABC" },
        version: dto.version,
      },
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toEqual(["gtmId"])
  })

  it("history follows each key's read permission; integrations never", async () => {
    await saveAndPublish(owner, "customCode", (d) => ({
      ...d,
      bodyEndHtml: "<script>window.x=1</script>",
    }))
    await saveAndPublish(marketer, "consent", (d) => ({ ...d, title: "Cookies?" }))
    const history = (cookie: string, key: string) =>
      adminRequest(`/revisions/settings/${key}`, { cookie })
    expect((await history(owner, "customCode")).status).toBe(200)
    expect((await history(admin, "customCode")).status).toBe(403)
    expect((await history(viewer, "customCode")).status).toBe(403)
    expect((await history(marketer, "consent")).status).toBe(200)
    expect((await history(editor, "consent")).status).toBe(403)
    expect((await history(editor, "seo.defaults")).status).toBe(200)
    expect((await history(viewer, "contact")).status).toBe(200)
    expect((await history(owner, "integrations.smtp")).status).toBe(404)
  })
})
```

`tests/integration/api/seo.test.ts`:

```ts
import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"
import { getDb } from "@/server/db/client"
import { auditLog, media, mediaUsages } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let marketer: string
let viewer: string
let author: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  marketer = (await signedInUser(["marketer"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
  author = (await signedInUser(["author"])).cookie
  revalidateTag.mockClear()
})

const put = (cookie: string, kind: string, id: string, seo: unknown) =>
  adminRequest(`/seo/entries/${kind}/${id}`, {
    cookie,
    method: "PUT",
    json: { seo },
  })

async function service(slug: string) {
  const res = await adminRequest(`/services?q=${slug}`, { cookie: editor })
  const { items } = (await res.json()) as {
    items: { id: string; slug: string; version: number }[]
  }
  return items.find((i) => i.slug === slug)!
}

describe("SEO API (master 8.1)", () => {
  it("overview: every page, service and article with effective title and checks", async () => {
    const res = await adminRequest("/seo/overview", { cookie: viewer })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as SeoOverviewDto
    const fx = fixtureSiteSources()
    expect(dto.entries).toHaveLength(8 + fx.services.length + fx.articles.length)
    expect(dto.entries.find((e) => e.kind === "page" && e.id === "home")).toMatchObject(
      {
        name: "Home",
        path: "/",
        published: true,
        image: "generated",
        title: "Security Partners Ltd. | Watching Over You",
      }
    )
    const live = dto.entries.filter((e) => e.published)
    const issues = live.reduce((n, e) => n + e.issues.length, 0)
    expect(dto.checks).toEqual({
      passed: live.length * 4 - issues,
      total: live.length * 4,
    })
  })

  it("marketer saves a service's SEO: live at once, version untouched, audited", async () => {
    const s = await service("alarm-responses")
    const res = await put(marketer, "service", s.id, {
      title: "",
      description:
        "Fast alarm response across Laois, Offaly and Kildare, day and night.",
      noindex: false,
    })
    expect(res.status).toBe(200)
    const entry = (await res.json()) as SeoEntry
    expect(entry.seo).toEqual({
      description:
        "Fast alarm response across Laois, Offaly and Kildare, day and night.",
      noindex: false,
    })
    expect(entry.issues.map((i) => i.check)).not.toContain("own-description")
    expect((await service("alarm-responses")).version).toBe(s.version)
    expect(revalidateTag).toHaveBeenCalledWith("service:alarm-responses", {
      expire: 0,
    })
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "service.seo_updated"),
          eq(auditLog.entityId, s.id)
        )
      )
    expect(audit.diff).toEqual({ fields: ["description", "noindex"] })
  })

  it("validation: canonical must be http(s); a missing image → 422 on ogImage", async () => {
    const bad = await put(editor, "page", "about", {
      canonical: "javascript:alert(1)",
    })
    expect(bad.status).toBe(422)
    const missing = await put(editor, "page", "about", {
      ogImage: { mediaId: "01900000-0000-7000-8000-000000000000" },
    })
    expect(missing.status).toBe(422)
    const body = (await missing.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(body.error.fieldErrors)).toEqual(["ogImage"])
  })

  it("a share image keeps its media usage through later draft saves", async () => {
    const [image] = await getDb().select().from(media).limit(1)
    expect(
      (await put(editor, "page", "about", { ogImage: { mediaId: image.id } }))
        .status
    ).toBe(200)
    const usage = () =>
      getDb()
        .select()
        .from(mediaUsages)
        .where(
          and(
            eq(mediaUsages.entityType, "page"),
            eq(mediaUsages.entityId, "about"),
            eq(mediaUsages.field, "seo.ogImage")
          )
        )
    expect(await usage()).toHaveLength(1)
    const page = (await (
      await adminRequest("/pages/about", { cookie: editor })
    ).json()) as { draft: unknown; version: number }
    const saved = await adminRequest("/pages/about/draft", {
      cookie: editor,
      method: "PUT",
      json: { draft: page.draft, version: page.version },
    })
    expect(saved.status).toBe(200)
    expect(await usage()).toHaveLength(1)
  })

  it("permissions and unknown records", async () => {
    expect((await adminRequest("/seo/overview", { cookie: author })).status).toBe(
      403
    )
    expect((await put(viewer, "page", "about", {})).status).toBe(403)
    expect((await put(editor, "page", "nope", {})).status).toBe(404)
    expect((await put(editor, "service", "not-a-uuid", {})).status).toBe(404)
    expect(
      (await put(editor, "service", "01900000-0000-7000-8000-000000000001", {}))
        .status
    ).toBe(404)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/seo/checks.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/seo/checks"`.

Run: `pnpm test:integration tests/integration/api/marketing.test.ts tests/integration/api/seo.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/schemas/api/marketing"` / `"@/lib/schemas/api/seo"`.

- [ ] **Step 3: Implement**

`lib/admin/growth-settings.ts`:

```ts
import type { PermissionRequest } from "@/lib/auth/permissions"
import type { SettingsKey } from "@/lib/schemas/settings"

/**
 * Settings edited under Growth (SEO › Defaults, Marketing › …), not under
 * Settings (master 4.5 excludes them). Each key has its own permissions
 * (spec §6.1): custom code is owner-only.
 */
export const GROWTH_SETTINGS_KEYS = [
  "seo.defaults",
  "tracking",
  "consent",
  "customCode",
] as const satisfies readonly SettingsKey[]
export type GrowthSettingsKey = (typeof GROWTH_SETTINGS_KEYS)[number]

export const GROWTH_SETTINGS: Record<
  GrowthSettingsKey,
  {
    label: string
    description: string
    href: string
    read: PermissionRequest
    update: PermissionRequest
  }
> = {
  "seo.defaults": {
    label: "SEO defaults",
    description:
      "Title pattern, default description and share image, and the business details search engines show.",
    href: "/admin/seo/defaults",
    read: { seo: ["read"] },
    update: { seo: ["update"] },
  },
  tracking: {
    label: "Tracking",
    description:
      "Google Tag Manager, Google Analytics 4 and Meta Pixel. Turning tracking on shows the cookie banner.",
    href: "/admin/marketing/tracking",
    read: { marketing: ["read"] },
    update: { marketing: ["update"] },
  },
  consent: {
    label: "Consent banner",
    description: "Wording of the cookie banner and its categories.",
    href: "/admin/marketing/consent",
    read: { marketing: ["read"] },
    update: { marketing: ["update"] },
  },
  customCode: {
    label: "Custom code",
    description: "Snippets added to every public page. Owner only.",
    href: "/admin/marketing/custom-code",
    read: { customCode: ["read"] },
    update: { customCode: ["update"] },
  },
}

export function isGrowthSettingsKey(value: string): value is GrowthSettingsKey {
  return Object.hasOwn(GROWTH_SETTINGS, value)
}
```

`lib/schemas/api/marketing.ts`:

```ts
import { z } from "zod"

import type { GrowthSettingsKey } from "@/lib/admin/growth-settings"

import type { VersionedDto } from "./content"

/** `/marketing/:key` — the service answers 404 for keys not edited here. */
export const growthKeyParam = z.object({ key: z.string().min(1).max(64) })

export type GrowthSettingsDto = VersionedDto<unknown> & {
  key: GrowthSettingsKey
  label: string
  description: string
  canEdit: boolean
}
```

`lib/seo/checks.ts`:

```ts
// The SEO overview's checks (admin SEO screen + dashboard "Content health").

export const SEO_CHECKS = [
  "title-length",
  "own-description",
  "description-length",
  "indexable",
] as const
export type SeoCheckId = (typeof SEO_CHECKS)[number]
export const SEO_CHECK_COUNT = SEO_CHECKS.length

export const SEO_LIMITS = {
  titleMin: 15,
  titleMax: 60,
  descriptionMin: 50,
  descriptionMax: 160,
} as const

export type SeoIssue = { check: SeoCheckId; message: string }

const length = (text: string) => [...text].length

/** Problems of one published page's effective SEO, in check order. */
export function seoIssues(input: {
  title: string
  description: string
  usesDefaultDescription: boolean
  noindex: boolean
}): SeoIssue[] {
  const issues: SeoIssue[] = []
  const t = length(input.title)
  if (t < SEO_LIMITS.titleMin || t > SEO_LIMITS.titleMax)
    issues.push({
      check: "title-length",
      message: `Title is ${t} characters; aim for ${SEO_LIMITS.titleMin}–${SEO_LIMITS.titleMax}.`,
    })
  if (input.usesDefaultDescription)
    issues.push({
      check: "own-description",
      message: "Uses the site-wide default description.",
    })
  const d = length(input.description)
  if (d < SEO_LIMITS.descriptionMin || d > SEO_LIMITS.descriptionMax)
    issues.push({
      check: "description-length",
      message: `Description is ${d} characters; aim for ${SEO_LIMITS.descriptionMin}–${SEO_LIMITS.descriptionMax}.`,
    })
  if (input.noindex)
    issues.push({
      check: "indexable",
      message: "Hidden from search engines (noindex).",
    })
  return issues
}
```

`lib/schemas/api/seo.ts`:

```ts
import { z } from "zod"

import type { Seo } from "@/lib/schemas/common"
import type { SeoIssue } from "@/lib/seo/checks"

export type { SeoIssue }

export const SEO_KINDS = ["page", "service", "article"] as const
export type SeoKind = (typeof SEO_KINDS)[number]

/** Page id = page key; service/article id = row id (uuid). */
export const seoEntryParam = z.object({
  kind: z.enum(SEO_KINDS),
  id: z.string().min(1).max(100),
})

/** PUT /seo/entries/:kind/:id — `seo` is validated by the service (field paths without "seo."). */
export const seoUpdateInput = z.object({ seo: z.unknown() })

export type SeoEntry = {
  kind: SeoKind
  id: string
  /** Admin name: page label, service or article title. */
  name: string
  path: string
  published: boolean
  seo: Seo
  /** What the live page renders (lib/seo/effective.ts). */
  title: string
  description: string
  /** What it would render without its own title/description (form previews). */
  fallback: { title: string; description: string }
  image: "own" | "default" | "generated"
  /** Checks of published records only. */
  issues: SeoIssue[]
}

export type SeoOverviewDto = {
  entries: SeoEntry[]
  checks: { passed: number; total: number }
}
```

`server/modules/seo/repo.ts` — add `import type { SeoKind } from "@/lib/schemas/api/seo"` and append:

```ts
export type SeoRow = {
  kind: SeoKind
  /** Page key or row id. */
  id: string
  slug: string | null
  seo: Seo
  draft: unknown
  published: unknown
}

/** Every page, service and article (published or not) for the SEO overview. */
export async function listSeoRows(db: DbOrTx): Promise<SeoRow[]> {
  const [pageRows, serviceRows, articleRows] = await Promise.all([
    db
      .select({ id: pages.key, seo: pages.seo, draft: pages.draft, published: pages.published })
      .from(pages)
      .orderBy(asc(pages.key)),
    db
      .select({
        id: services.id,
        slug: services.slug,
        seo: services.seo,
        draft: services.draft,
        published: services.published,
      })
      .from(services)
      .orderBy(asc(services.sortOrder), asc(services.slug)),
    db
      .select({
        id: articles.id,
        slug: articles.slug,
        seo: articles.seo,
        draft: articles.draft,
        published: articles.published,
      })
      .from(articles)
      .orderBy(desc(articles.publishedAt), asc(articles.slug)),
  ])
  return [
    ...pageRows.map((row) => ({ kind: "page" as const, slug: null, ...row })),
    ...serviceRows.map((row) => ({ kind: "service" as const, ...row })),
    ...articleRows.map((row) => ({ kind: "article" as const, ...row })),
  ]
}

export async function findSeoRow(
  db: DbOrTx,
  kind: SeoKind,
  id: string
): Promise<SeoRow | null> {
  if (kind === "page") {
    const [row] = await db
      .select({ id: pages.key, seo: pages.seo, draft: pages.draft, published: pages.published })
      .from(pages)
      .where(eq(pages.key, id))
    return row ? { kind, slug: null, ...row } : null
  }
  if (kind === "service") {
    const [row] = await db
      .select({
        id: services.id,
        slug: services.slug,
        seo: services.seo,
        draft: services.draft,
        published: services.published,
      })
      .from(services)
      .where(eq(services.id, id))
    return row ? { kind, ...row } : null
  }
  const [row] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      seo: articles.seo,
      draft: articles.draft,
      published: articles.published,
    })
    .from(articles)
    .where(eq(articles.id, id))
  return row ? { kind, ...row } : null
}

/** Writes only the seo column: the record's version and draft stay as they are. */
export async function updateSeoColumn(
  db: DbOrTx,
  kind: SeoKind,
  id: string,
  seo: Seo
): Promise<void> {
  if (kind === "page")
    await db.update(pages).set({ seo }).where(eq(pages.key, id))
  else if (kind === "service")
    await db.update(services).set({ seo }).where(eq(services.id, id))
  else await db.update(articles).set({ seo }).where(eq(articles.id, id))
}
```

`server/modules/seo/service.ts`:

```ts
import "server-only"

import { z } from "zod"

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { contactPlaceholders, type Placeholders } from "@/lib/interpolate"
import type {
  SeoEntry,
  SeoKind,
  SeoOverviewDto,
} from "@/lib/schemas/api/seo"
import { type Seo, seo as seoSchema } from "@/lib/schemas/common"
import type { ContactSettings } from "@/lib/schemas/settings/contact"
import type { SeoDefaultsSettings } from "@/lib/schemas/settings/seo-defaults"
import { SEO_CHECK_COUNT, seoIssues } from "@/lib/seo/checks"
import { effectiveSeo } from "@/lib/seo/effective"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import {
  AppError,
  fieldErrorsFromIssues,
  forbidden,
  notFound,
} from "@/server/lib/errors"
import { syncMediaUsages } from "@/server/lib/media-usages"
import { findSettingsRow } from "@/server/modules/settings/repo"
import { isPageKey, PAGE_PATHS, type PageKey } from "@/templates/registry"

import { findSeoRow, listSeoRows, type SeoRow, updateSeoColumn } from "./repo"

type Context = { defaults: SeoDefaultsSettings; values: Placeholders }

const LABEL: Record<SeoKind, string> = {
  page: "Page",
  service: "Service",
  article: "Article",
}

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const record = (value: unknown) =>
  (value && typeof value === "object" ? value : {}) as Record<string, unknown>
const text = (value: unknown) => (typeof value === "string" ? value : null)

/** Name, URL and title/description fallbacks, mirroring templates/shared/page-meta.ts. */
function describeRow(row: SeoRow) {
  const content = record(row.published ?? row.draft)
  if (row.kind === "page") {
    const key = row.id as PageKey
    return {
      name: PAGE_LABELS[key],
      path: PAGE_PATHS[key],
      titleName:
        key === "home"
          ? null
          : (text(record(content.hero).title) ?? PAGE_LABELS[key]),
      fallbackDescription: null,
    }
  }
  const title = text(content.title) ?? row.slug ?? row.id
  return row.kind === "service"
    ? {
        name: title,
        path: `/services/${row.slug}`,
        titleName: title,
        fallbackDescription: text(record(content.detail).intro),
      }
    : {
        name: title,
        path: `/blog/${row.slug}`,
        titleName: title,
        fallbackDescription: text(content.excerpt),
      }
}

function toEntry(row: SeoRow, ctx: Context): SeoEntry {
  const d = describeRow(row)
  const base = {
    defaults: ctx.defaults,
    name: d.titleName,
    fallbackDescription: d.fallbackDescription,
    values: ctx.values,
  }
  const own = effectiveSeo({ ...base, seo: row.seo })
  const fallback = effectiveSeo({ ...base, seo: {} })
  const published = row.published !== null
  return {
    kind: row.kind,
    id: row.id,
    name: d.name,
    path: d.path,
    published,
    seo: row.seo,
    title: own.title,
    description: own.description,
    fallback: { title: fallback.title, description: fallback.description },
    image: row.seo.ogImage
      ? "own"
      : ctx.defaults.ogImage
        ? "default"
        : "generated",
    issues: published
      ? seoIssues({
          title: own.title,
          description: own.description,
          usesDefaultDescription: own.usesDefaultDescription,
          noindex: row.seo.noindex === true,
        })
      : [],
  }
}

async function loadContext(db: DbOrTx): Promise<Context> {
  const [defaults, contact] = await Promise.all([
    findSettingsRow(db, "seo.defaults"),
    findSettingsRow(db, "contact"),
  ])
  return {
    defaults: (defaults?.published ?? defaults?.draft) as SeoDefaultsSettings,
    values: contactPlaceholders(
      (contact?.published ?? contact?.draft) as ContactSettings
    ),
  }
}

export async function getSeoOverview(actor: Actor): Promise<SeoOverviewDto> {
  assertCan(actor, { seo: ["read"] })
  const db = getDb()
  const [rows, ctx] = await Promise.all([listSeoRows(db), loadContext(db)])
  const entries = rows.map((row) => toEntry(row, ctx))
  const live = entries.filter((entry) => entry.published)
  const total = live.length * SEO_CHECK_COUNT
  const failed = live.reduce((n, entry) => n + entry.issues.length, 0)
  return { entries, checks: { passed: total - failed, total } }
}

/** Blank values mean "use the fallback": they are dropped, never stored. */
function cleanSeo(input: unknown): Seo {
  const kept = Object.fromEntries(
    Object.entries(record(input)).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined
    )
  )
  const parsed = seoSchema.safeParse(kept)
  if (!parsed.success)
    throw new AppError("VALIDATION_FAILED", "Check the highlighted fields", {
      fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
    })
  return parsed.data
}

/** media_usages reports "seo.ogImage"; the SEO form's field is "ogImage". */
function withoutSeoPrefix(err: unknown): unknown {
  if (!(err instanceof AppError) || !err.details?.fieldErrors) return err
  const fieldErrors = Object.fromEntries(
    Object.entries(err.details.fieldErrors).map(([key, value]) => [
      key.replace(/^seo\./, ""),
      value,
    ])
  )
  return new AppError(err.code, err.message, { ...err.details, fieldErrors })
}

const changedFields = (before: Seo, after: Seo) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(
      (key) =>
        JSON.stringify(before[key as keyof Seo]) !==
        JSON.stringify(after[key as keyof Seo])
    )
    .sort()

function tagsFor(row: SeoRow): string[] {
  if (row.kind === "page") return [tag.page(row.id)]
  if (row.kind === "service") return [tag.services, tag.service(row.slug!)]
  return [tag.articles, tag.article(row.slug!)]
}

const validId = (kind: SeoKind, id: string) =>
  kind === "page" ? isPageKey(id) : z.uuid().safeParse(id).success

/**
 * Saves a record's SEO fields (the seo column): live at once, last write
 * wins, the record's version and draft are untouched. The share image is
 * kept in media_usages alongside the record's content images.
 */
export async function updateSeo(
  actor: Actor,
  kind: SeoKind,
  id: string,
  input: { seo: unknown }
): Promise<SeoEntry> {
  assertCan(actor, { seo: ["update"] })
  if (!validId(kind, id)) throw notFound(LABEL[kind])
  const seo = cleanSeo(input.seo)
  const db = getDb()
  const row = await db.transaction(async (tx) => {
    const current = await findSeoRow(tx, kind, id)
    if (!current) throw notFound(LABEL[kind])
    await updateSeoColumn(tx, kind, id, seo)
    try {
      await syncMediaUsages(tx, kind, id, current.draft, current.published, {
        seo,
      })
    } catch (err) {
      throw withoutSeoPrefix(err)
    }
    await writeAudit(tx, actor, {
      action: `${kind}.seo_updated`,
      entityType: kind,
      entityId: id,
      diff: { fields: changedFields(current.seo, seo) },
    })
    return { ...current, seo }
  })
  invalidate(...tagsFor(row))
  return toEntry(row, await loadContext(db))
}
```

`server/modules/seo/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { seoEntryParam, seoUpdateInput } from "@/lib/schemas/api/seo"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

export const seoRoutes = new Hono<AppEnv>()
  .get("/overview", can({ seo: ["read"] }), async (c) =>
    c.json(await service.getSeoOverview(actorOf(c)), 200)
  )
  .put(
    "/entries/:kind/:id",
    can({ seo: ["update"] }),
    zv("param", seoEntryParam),
    zv("json", seoUpdateInput),
    async (c) => {
      const { kind, id } = c.req.valid("param")
      return c.json(
        await service.updateSeo(actorOf(c), kind, id, c.req.valid("json")),
        200
      )
    }
  )
```

`server/modules/marketing/service.ts`:

```ts
import "server-only"

import {
  GROWTH_SETTINGS,
  type GrowthSettingsKey,
  isGrowthSettingsKey,
} from "@/lib/admin/growth-settings"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { GrowthSettingsDto } from "@/lib/schemas/api/marketing"
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
  type SettingsEditRow,
  updateSettingsIfVersion,
} from "@/server/modules/settings/repo"

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

/** SEO defaults, tracking, consent and custom code only; per-key permission. */
function entryFor(actor: Actor, key: string, action: "read" | "update") {
  if (!isGrowthSettingsKey(key)) throw notFound("Settings")
  if (!can(actor, GROWTH_SETTINGS[key][action])) throw forbidden()
  return key
}

function toDto(actor: Actor, row: Row): GrowthSettingsDto {
  const key = row.key as GrowthSettingsKey
  const entry = GROWTH_SETTINGS[key]
  return {
    key,
    label: entry.label,
    description: entry.description,
    canEdit: can(actor, entry.update),
    ...versionedDto<unknown>(row),
  }
}

const storeFor = (actor: Actor): VersionedStore<unknown, Row> => ({
  entityType: "settings",
  label: "Settings",
  schema: (row) => settingsSchemas[row.key as GrowthSettingsKey],
  find: async (db, key) => asVersioned(await findSettingsForEdit(db, key)),
  update: async (db, key, version, patch) =>
    asVersioned(await updateSettingsIfVersion(db, key, version, patch)),
  tags: (row) => [tag.settings(row.key as GrowthSettingsKey)],
  present: (row) => toDto(actor, row),
})

export async function getGrowthSettings(
  actor: Actor,
  key: string
): Promise<GrowthSettingsDto> {
  entryFor(actor, key, "read")
  const row = asVersioned(await findSettingsForEdit(getDb(), key))
  if (!row) throw notFound("Settings")
  return toDto(actor, row)
}

export async function saveGrowthSettingsDraft(
  actor: Actor,
  key: string,
  input: { draft: unknown; version: number }
): Promise<GrowthSettingsDto> {
  entryFor(actor, key, "update")
  return toDto(actor, await saveDraft(getDb(), storeFor(actor), actor, key, input))
}

export async function publishGrowthSettings(
  actor: Actor,
  key: string,
  input: { version: number }
): Promise<GrowthSettingsDto> {
  entryFor(actor, key, "update")
  return toDto(actor, await publish(getDb(), storeFor(actor), actor, key, input))
}

export async function restoreGrowthSettings(
  actor: Actor,
  key: string,
  input: { revisionId: string; version: number }
): Promise<GrowthSettingsDto> {
  entryFor(actor, key, "update")
  return toDto(
    actor,
    await restoreRevision(getDb(), storeFor(actor), actor, key, input)
  )
}
```

`server/modules/marketing/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import { growthKeyParam } from "@/lib/schemas/api/marketing"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// The permission depends on :key (custom code is owner-only), so the
// service authorises every call (lib/admin/growth-settings.ts).
export const marketingRoutes = new Hono<AppEnv>()
  .get("/:key", zv("param", growthKeyParam), async (c) =>
    c.json(
      await service.getGrowthSettings(actorOf(c), c.req.valid("param").key),
      200
    )
  )
  .put(
    "/:key/draft",
    zv("param", growthKeyParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveGrowthSettingsDraft(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/publish",
    zv("param", growthKeyParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishGrowthSettings(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/restore",
    zv("param", growthKeyParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreGrowthSettings(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
```

`server/api/app.ts` — import `marketingRoutes` from `@/server/modules/marketing/routes` and `seoRoutes` from `@/server/modules/seo/routes` (alphabetical among the module imports) and append `.route("/marketing", marketingRoutes)` and `.route("/seo", seoRoutes)` to the `adminRoutes` chain.

`server/modules/revisions/service.ts` — add imports `import { GROWTH_SETTINGS, isGrowthSettingsKey } from "@/lib/admin/growth-settings"` and `SETTINGS_ENTRIES` next to the existing `isEditableSettingsKey` import from `@/lib/admin/settings-keys`; replace Phase 6's `assertCanRead` with:

```ts
/**
 * The permission to read one record's history. Settings rows: per key —
 * content keys (Settings), the Growth keys (SEO defaults: seo; tracking and
 * consent: marketing; custom code: owner only); any other key (integrations)
 * is never served here, whatever its revision rows contain.
 */
function readPermission(
  entity: RevisionEntity,
  entityId: string
): PermissionRequest {
  if (entity !== "settings") return READ[entity]
  if (isEditableSettingsKey(entityId)) return SETTINGS_ENTRIES[entityId].read
  if (isGrowthSettingsKey(entityId)) return GROWTH_SETTINGS[entityId].read
  throw notFound("Revision")
}

function assertCanRead(
  actor: Actor,
  entity: RevisionEntity,
  entityId: string
) {
  if (!hasPermission(actor.roles, readPermission(entity, entityId)))
    throw forbidden()
}
```

(Both callers already pass `entityId` since Phase 6.)

`server/lib/versioning.ts` — in `VersionedStore`, after `present(record: R): unknown`, add:

```ts
  /**
   * Values whose media refs this record uses (media_usages). Default:
   * draft + published. Pages, services and articles add their seo column
   * so a share image stays "in use".
   */
  mediaValues?(record: R): unknown[]
```

add below `versionedDto`:

```ts
const mediaValuesOf = <T, R extends VersionedRecord<T>>(
  store: VersionedStore<T, R>,
  record: R
): unknown[] => store.mediaValues?.(record) ?? [record.draft, record.published]
```

and replace each of the three `await syncMediaUsages(tx, store.entityType, id, updated.draft, updated.published)` calls (saveDraft, publishInTx, restoreRevision) with `await syncMediaUsages(tx, store.entityType, id, ...mediaValuesOf(store, updated))`.

Add `mediaValues: (row) => [row.draft, row.published, { seo: row.seo }],` to `pageStore` (`server/modules/pages/service.ts`), `serviceStore` (`server/modules/services/service.ts`) and the store returned by `storeFor` in `server/modules/articles/service.ts`. Then `grep -n "syncMediaUsages(" server/modules/articles/service.ts server/lib/media-usages.ts`: every other call that syncs a page/service/article row from its `draft`/`published` (Phase 5 workflow transitions, Phase 6 `backfillMediaUsages`) gets `{ seo: row.seo }` appended (read the row's `seo` there if it is not selected yet); creates (`createService`, `createArticle`) stay as they are (a new record's seo is `{}`).

`server/modules/media/service.ts` (Phase 6 `describeUsage`) — import `GROWTH_SETTINGS`, `isGrowthSettingsKey` from `@/lib/admin/growth-settings` and change the `"settings"` case to:

```ts
    case "settings":
      return isEditableSettingsKey(id)
        ? with_(`Settings › ${SETTINGS_ENTRIES[id].label}`, `/admin/settings/${id}`)
        : isGrowthSettingsKey(id)
          ? with_(GROWTH_SETTINGS[id].label, GROWTH_SETTINGS[id].href)
          : with_(`Settings › ${id}`, null)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/seo/checks.test.ts tests/unit/server-only-guard.test.ts tests/unit/lint-boundaries.test.ts`
Expected: PASS (checks 3).

Run: `pnpm test:integration tests/integration/api/marketing.test.ts tests/integration/api/seo.test.ts tests/integration/api/settings.test.ts tests/integration/api/pages.test.ts tests/integration/api/media.test.ts tests/integration/api/articles.test.ts`
Expected: PASS (marketing 5, seo 5; the existing suites unchanged).

Run: `pnpm lint && pnpm typecheck`
Expected: clean (`api.marketing`, `api.seo` appear on the typed client).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write lib/admin/growth-settings.ts lib/schemas/api/marketing.ts lib/schemas/api/seo.ts lib/seo/checks.ts server/modules/marketing server/modules/seo server/lib/versioning.ts server/lib/media-usages.ts server/modules/pages/service.ts server/modules/services/service.ts server/modules/articles/service.ts server/modules/media/service.ts server/modules/revisions/service.ts server/api/app.ts tests/unit/seo/checks.test.ts tests/integration/api/marketing.test.ts tests/integration/api/seo.test.ts
git add lib/admin/growth-settings.ts lib/schemas/api/marketing.ts lib/schemas/api/seo.ts lib/seo/checks.ts server/modules/marketing server/modules/seo server/lib/versioning.ts server/lib/media-usages.ts server/modules/pages/service.ts server/modules/services/service.ts server/modules/articles/service.ts server/modules/media/service.ts server/modules/revisions/service.ts server/api/app.ts tests/unit/seo/checks.test.ts tests/integration/api/marketing.test.ts tests/integration/api/seo.test.ts
git commit -m "$(cat <<'EOF'
feat(seo): admin API for SEO defaults, marketing settings and record SEO

/marketing/:key edits seo.defaults, tracking, consent and customCode with
draft/publish and per-key permissions (custom code owner-only), and the
revisions allow-list follows the same rules. /seo/overview reports each
page's effective title, description and checks; /seo/entries saves a
record's seo column live and keeps its share image in media_usages.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Admin — Growth navigation, SEO overview with the health gauge, record SEO sheet, SEO defaults, dashboard "Content health" (master Task 8.1, admin screens)

**Files:**
- Modify: `components/admin/shell/nav.ts` (Growth section), `tests/unit/admin/nav.test.ts` (expectations + new describe), `components/admin/dashboard/dashboard.tsx` (`Body`: Team activity + Content health row), `components/admin/pages/page-editor.tsx`, `components/admin/services/service-editor.tsx`, `components/admin/articles/article-editor.tsx` (Phase 5; "SEO" link)
- Create: `components/admin/kit/gauge-math.ts`, `components/admin/kit/gauge.tsx`, `components/admin/shell/nav-child-tabs.tsx`, `components/admin/seo/{keys.ts,health.ts,seo-meta.ts,growth-meta.ts,serp-preview.tsx,seo-sheet.tsx,seo-overview.tsx,seo-link.tsx,growth-settings-editor.tsx}`, `components/admin/dashboard/content-health.tsx`, `app/(admin)/admin/(panel)/seo/layout.tsx`, `app/(admin)/admin/(panel)/seo/page.tsx`, `app/(admin)/admin/(panel)/seo/defaults/page.tsx`
- Test: `tests/unit/admin/gauge-math.test.ts`, `tests/dom/gauge.test.tsx`, `tests/dom/seo-overview.test.tsx`, `tests/dom/content-health.test.tsx`

**Interfaces:**
- Consumes: Task 7 `GET /seo/overview`, `PUT /seo/entries/:kind/:id`, `/marketing/:key` (typed `api.seo`, `api.marketing`), `GROWTH_SETTINGS`, `SeoEntry`/`SeoOverviewDto`; `seo` schema; Task 1 `filled`, `publicOrigin`; Task 3 `getPublishedSettings`; kit `PageHeader`, `PRIMARY_ACTION`, `FORM_ACTION`, `DashboardCard`, `EmptyState`, `StatusPill`, `CardSkeleton`, `KpiRowSkeleton`, `formatNumber`; `hooks/use-reduced-motion.ts`; `components/ui/chart.tsx` (`ChartContainer`, `ChartConfig`); `recharts` `RadialBarChart`/`RadialBar`/`PolarAngleAxis`; `SectionTabs` (route mode, `heading`); `navItems`; `VersionedEditor`; `SchemaForm`; `Sheet*`; `usePermission`; `requirePermission`.
- Produces:

```ts
// components/admin/kit/gauge-math.ts (port of JW admin/components/dashboard/chart-math.ts)
export type GaugePart = { key: string; label: string; value: number; tone: "solid" | "dark" | "hatched" }
export function gaugeSummary(parts: readonly GaugePart[], headlineKey?: string): { parts: GaugePart[]; total: number; headline: number; ratio: number }
export function formatShare(part: number, total: number): string          // floor percent, "—" when total is 0
// components/admin/kit/gauge.tsx (port of JW gauge.tsx)
export function Gauge(props: { title: string; parts: readonly GaugePart[]; centerLabel: string; headlineKey?: string }): JSX.Element
// components/admin/shell/nav-child-tabs.tsx
export function NavChildTabs(props: { section: string; children: ReactNode }): JSX.Element   // a nav item's children as route tabs
// components/admin/seo/*
export const SEO_OVERVIEW_KEY: readonly ["seo", "overview"]
export function healthParts(checks: { passed: number; total: number }): GaugePart[]
export const SEO_FIELDS_META: EditorMeta
export const growthEditorMeta: Record<GrowthSettingsKey, EditorMeta>
export function SerpPreview(props: { title: string; url: string; description: string }): JSX.Element
export function SeoSheet(props: { entry: SeoEntry; origin: string; onClose(): void }): JSX.Element
export function SeoOverview(props: { origin: string }): JSX.Element          // ?edit=<kind>:<id> opens the sheet
export function SeoLink(props: { kind: SeoKind; id: string }): JSX.Element | null
export function GrowthSettingsEditor(props: { settingsKey: GrowthSettingsKey; backHref: string; backLabel: string; aside?: ReactNode }): JSX.Element
// components/admin/dashboard/content-health.tsx
export function ContentHealthCard(): JSX.Element | null                    // hidden without seo:read
```

Navigation result (binding pattern): section **Growth** between Content and Configuration —

| Item | Icon | Permission | Children (href · permission) |
|---|---|---|---|
| SEO | `SearchCheck` | `seo:read` | Overview `/admin/seo` · `seo:read`; Defaults `/admin/seo/defaults` · `seo:read`; Redirects `/admin/seo/redirects` · `redirect:read` |
| Marketing | `Megaphone` | `marketing:read` | Tracking `/admin/marketing/tracking` · `marketing:read`; Consent banner `/admin/marketing/consent` · `marketing:read`; Custom code `/admin/marketing/custom-code` · `customCode:update` |

(The Redirects page arrives in Task 9 and the Marketing pages in Task 11; until then those links 404 inside the admin — the tasks run back to back.)

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/gauge-math.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { formatShare, gaugeSummary } from "@/components/admin/kit/gauge-math"

describe("gauge maths (JW chart-math port)", () => {
  it("headlines the named part, else the first; clamps bad values", () => {
    const parts = [
      { key: "passed", label: "Passing", value: 30, tone: "solid" as const },
      { key: "failed", label: "Needs work", value: 10, tone: "hatched" as const },
      { key: "junk", label: "Junk", value: Number.NaN, tone: "dark" as const },
    ]
    expect(gaugeSummary(parts, "failed")).toMatchObject({
      total: 40,
      headline: 10,
      ratio: 0.25,
    })
    expect(gaugeSummary(parts).headline).toBe(30)
    expect(gaugeSummary([], "x")).toMatchObject({ total: 0, ratio: 0 })
  })

  it("formatShare floors and shows a dash for nothing", () => {
    expect(formatShare(7, 8)).toBe("87%")
    expect(formatShare(0, 0)).toBe("—")
  })
})
```

`tests/dom/gauge.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { Gauge } from "@/components/admin/kit/gauge"

beforeAll(() => {
  // Reduced motion, so arcs draw at once; jsdom lays nothing out.
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList
  )
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ width: 640, height: 320 })
  )
})

describe("Gauge (kit)", () => {
  it("shows the headline share, a legend and a screen-reader table", () => {
    render(
      <Gauge
        title="SEO health"
        centerLabel="Passing"
        headlineKey="passed"
        parts={[
          { key: "passed", label: "Passing checks", value: 41, tone: "solid" },
          { key: "failed", label: "Needs work", value: 59, tone: "hatched" },
        ]}
      />
    )
    expect(screen.getByText("41%")).toBeInTheDocument()
    expect(screen.getByText("Passing")).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "SEO health" })
    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(["Passing checks41", "Needs work59"])
  })

  it("an empty gauge shows a dash, never NaN", () => {
    render(
      <Gauge
        title="Empty"
        centerLabel="Passing"
        parts={[{ key: "passed", label: "Passing", value: 0, tone: "solid" }]}
      />
    )
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})
```

`tests/dom/seo-overview.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/seo",
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, refresh: vi.fn() }),
  useSearchParams: () => nav.params,
}))

import { makeQueryClient } from "@/components/admin/providers"
import { SeoOverview } from "@/components/admin/seo/seo-overview"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"

const entry = (over: Partial<SeoEntry>): SeoEntry => ({
  kind: "page",
  id: "home",
  name: "Home",
  path: "/",
  published: true,
  seo: {},
  title: "Security Partners Ltd. | Watching Over You",
  description: "Default description.",
  fallback: {
    title: "Security Partners Ltd. | Watching Over You",
    description: "Default description.",
  },
  image: "generated",
  issues: [],
  ...over,
})

const OVERVIEW: SeoOverviewDto = {
  entries: [
    entry({
      issues: [
        {
          check: "own-description",
          message: "Uses the site-wide default description.",
        },
      ],
    }),
    entry({
      kind: "service",
      id: "00000000-0000-7000-8000-000000000001",
      name: "Alarm Responses",
      path: "/services/alarm-responses",
    }),
    entry({
      kind: "article",
      id: "00000000-0000-7000-8000-000000000002",
      name: "Draft post",
      path: "/blog/draft-post",
      published: false,
    }),
  ],
  checks: { passed: 7, total: 8 },
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input), "http://localhost")
  if (url.pathname === "/api/v1/admin/seo/overview") return json(200, OVERVIEW)
  if (
    init?.method === "PUT" &&
    url.pathname === "/api/v1/admin/seo/entries/page/home"
  )
    return json(
      200,
      entry({ seo: (JSON.parse(String(init.body)) as { seo: object }).seo })
    )
  return json(404, { error: { code: "NOT_FOUND", message: "Not found" } })
})

beforeEach(() => {
  nav.params = new URLSearchParams()
  nav.replace.mockReset()
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

function renderAs(roles: Role[]) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider
        value={{
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
        <SeoOverview origin="https://www.example.ie" />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
}

describe("SEO overview (master 8.1)", () => {
  it("shows the health gauge and every record grouped, with its issues", async () => {
    renderAs(["editor"])
    expect(await screen.findByText("87%")).toBeInTheDocument()
    expect(screen.getByText("1 of 2 published pages need attention.")).toBeInTheDocument()
    expect(
      within(screen.getByRole("region", { name: "Pages" })).getByText(
        "Uses the site-wide default description."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Services" })).toHaveTextContent(
      "All checks pass"
    )
    expect(screen.getByRole("region", { name: "Articles" })).toHaveTextContent(
      "Not published"
    )
  })

  it("Edit SEO puts the record in the address (?edit=)", async () => {
    const user = userEvent.setup()
    renderAs(["editor"])
    await user.click(
      await screen.findByRole("button", { name: "Edit SEO for Home" })
    )
    expect(nav.replace).toHaveBeenCalledWith("/admin/seo?edit=page%3Ahome", {
      scroll: false,
    })
  })

  it("the sheet previews the search result and saves the fields", async () => {
    nav.params = new URLSearchParams("edit=page:home")
    const user = userEvent.setup()
    renderAs(["editor"])
    const sheet = await screen.findByRole("dialog", { name: "SEO: Home" })
    expect(within(sheet).getByText("https://www.example.ie/")).toBeInTheDocument()
    await user.type(
      within(sheet).getByRole("textbox", { name: /^Description/ }),
      "Security services across Ireland with a 24/7 operations team."
    )
    expect(
      within(sheet).getByText(
        "Security services across Ireland with a 24/7 operations team."
      )
    ).toBeInTheDocument()
    await user.click(within(sheet).getByRole("button", { name: "Save SEO" }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/admin/seo/entries/page/home"),
        expect.objectContaining({ method: "PUT" })
      )
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!
    expect(JSON.parse(String(put[1]!.body))).toEqual({
      seo: {
        description:
          "Security services across Ireland with a 24/7 operations team.",
      },
    })
    await waitFor(() =>
      expect(nav.replace).toHaveBeenLastCalledWith("/admin/seo", {
        scroll: false,
      })
    )
  })

  it("viewers can look but not save", async () => {
    nav.params = new URLSearchParams("edit=page:home")
    renderAs(["viewer"])
    await screen.findByRole("dialog", { name: "SEO: Home" })
    expect(screen.queryByRole("button", { name: "Save SEO" })).toBeNull()
    expect(
      screen.getByRole("button", { name: "View SEO for Home", hidden: true })
    ).toBeInTheDocument()
  })

  it("a failed load says so and offers Try again", async () => {
    fetchMock.mockImplementationOnce(async () =>
      json(403, { error: { code: "FORBIDDEN", message: "Not allowed" } })
    )
    renderAs(["editor"])
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("SEO health didn't load")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })
})
```

`tests/dom/content-health.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ContentHealthCard } from "@/components/admin/dashboard/content-health"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"

const fetchMock = vi.fn(
  async () =>
    new Response(
      JSON.stringify({ entries: [], checks: { passed: 30, total: 40 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
)

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

const renderAs = (roles: Role[]) =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider
        value={{
          user: { id: "u", name: "U", email: "u@x.test", title: null, twoFactorEnabled: true },
          roles,
          impersonatedBy: null,
        }}
      >
        <ContentHealthCard />
      </AdminSessionProvider>
    </QueryClientProvider>
  )

describe("dashboard Content health card", () => {
  it("shows the share of passing SEO checks with a link to SEO", async () => {
    renderAs(["marketer"])
    expect(await screen.findByText("75%")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Content health" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open SEO" })).toHaveAttribute(
      "href",
      "/admin/seo"
    )
  })

  it("is absent (and fetches nothing) without seo:read", () => {
    renderAs(["author"])
    expect(screen.queryByRole("region", { name: "Content health" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

`tests/unit/admin/nav.test.ts` — update the existing exact expectations, then append a describe:
- every `menu([...])` list: insert `"SEO"` right after the Content section's last item for roles holding `seo:read` (owner, admin, editor, viewer, marketer), then `"Marketing"` for roles holding `marketing:read` (owner, admin, viewer, marketer); author and intake lists are unchanged;
- every `destinations([...])` list: after the last Content destination insert, for the role, `"Overview"`, `"Defaults"` (seo:read), `"Redirects"` (redirect:read: owner, admin, viewer, marketer), `"Tracking"`, `"Consent banner"` (marketing:read), `"Custom code"` (owner only);
- section-label expectations (e.g. `["Overview", "Content", "Configuration", …]`) gain `"Growth"` between `"Content"` and `"Configuration"` for those roles.

```ts
describe("Growth section (phase 8)", () => {
  const growth = (roles: Role[]) =>
    menuSections(roles)
      .find((s) => s.label === "Growth")
      ?.items.map((i) => [i.label, i.children?.map((c) => c.label)]) ?? null
  const FULL_SEO = ["SEO", ["Overview", "Defaults", "Redirects"]]
  const MARKETING = ["Marketing", ["Tracking", "Consent banner"]]

  it.each<[Role, unknown]>([
    ["owner", [FULL_SEO, ["Marketing", ["Tracking", "Consent banner", "Custom code"]]]],
    ["admin", [FULL_SEO, MARKETING]],
    ["marketer", [FULL_SEO, MARKETING]],
    ["viewer", [FULL_SEO, MARKETING]],
    ["editor", [["SEO", ["Overview", "Defaults"]]]],
    ["author", null],
    ["intake", null],
  ])("%s sees %j", (role, expected) => {
    expect(growth([role])).toEqual(expected)
  })

  it("sits between Content and Configuration", () => {
    const labels = menuSections(["owner"]).map((s) => s.label)
    expect(labels.indexOf("Growth")).toBe(labels.indexOf("Content") + 1)
    expect(labels.indexOf("Configuration")).toBe(labels.indexOf("Growth") + 1)
  })

  it("Marketing opens its first tab; ⌘K lists sub-pages with their parent", () => {
    const marketing = navItems(["marketer"])
      .flatMap((s) => s.items)
      .find((i) => i.label === "Marketing")!
    expect(marketing.href).toBe("/admin/marketing/tracking")
    expect(
      navDestinations(["owner"])
        .filter((d) => d.parent === "SEO" || d.parent === "Marketing")
        .map((d) => `${d.parent} › ${d.label}`)
    ).toEqual([
      "SEO › Overview",
      "SEO › Defaults",
      "SEO › Redirects",
      "Marketing › Tracking",
      "Marketing › Consent banner",
      "Marketing › Custom code",
    ])
    const seo = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.label === "SEO")!
    expect(isActiveItem(seo, "/admin/seo/redirects")).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/admin/gauge-math.test.ts tests/unit/admin/nav.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/admin/kit/gauge-math"`; nav tests fail (no "Growth" section).

Run: `pnpm exec vitest run --project dom tests/dom/gauge.test.tsx tests/dom/seo-overview.test.tsx tests/dom/content-health.test.tsx`
Expected: FAIL — unresolved imports (`kit/gauge`, `seo/seo-overview`, `dashboard/content-health`).

- [ ] **Step 3: Implement**

`components/admin/shell/nav.ts` — add `Megaphone` and `SearchCheck` to the `lucide-react` import and insert this section into `NAV_SECTIONS` directly after the `"Content"` section object:

```ts
  {
    // Phase 8 (04b "Patterns for later phases"): SEO and Marketing, each a
    // section whose sub-pages are route tabs.
    label: "Growth",
    items: [
      {
        label: "SEO",
        href: "/admin/seo",
        icon: SearchCheck,
        permission: { seo: ["read"] },
        match: "prefix",
        children: [
          { label: "Overview", href: "/admin/seo", permission: { seo: ["read"] } },
          {
            label: "Defaults",
            href: "/admin/seo/defaults",
            permission: { seo: ["read"] },
          },
          {
            label: "Redirects",
            href: "/admin/seo/redirects",
            permission: { redirect: ["read"] },
          },
        ],
      },
      {
        label: "Marketing",
        href: "/admin/marketing/tracking",
        icon: Megaphone,
        permission: { marketing: ["read"] },
        match: "prefix",
        children: [
          {
            label: "Tracking",
            href: "/admin/marketing/tracking",
            permission: { marketing: ["read"] },
          },
          {
            label: "Consent banner",
            href: "/admin/marketing/consent",
            permission: { marketing: ["read"] },
          },
          {
            label: "Custom code",
            href: "/admin/marketing/custom-code",
            permission: { customCode: ["update"] },
          },
        ],
      },
    ],
  },
```

`components/admin/shell/nav-child-tabs.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"

import { SectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import { navItems } from "@/components/admin/shell/nav"

/**
 * A nav item's sub-pages (its `children`, permission-filtered) as left
 * route tabs — the JW pattern used by Collections, SEO and Marketing.
 */
export function NavChildTabs({
  section,
  children,
}: {
  section: string
  children: ReactNode
}) {
  const { roles } = useAdminSession()
  const item = navItems(roles)
    .flatMap((s) => s.items)
    .find((i) => i.label === section)
  const items = (item?.children ?? []).map((child) => ({
    id: child.href,
    label: child.label,
    href: child.href,
  }))
  if (items.length < 2) return <>{children}</>
  return (
    <SectionTabs ariaLabel={section} heading={section} items={items}>
      {children}
    </SectionTabs>
  )
}
```

`components/admin/kit/gauge-math.ts`:

```ts
// Port of JW admin/components/dashboard/chart-math.ts (gaugeSummary) plus
// its formatShare: integer percentages that never round up to 100%.

export type GaugePart = {
  key: string
  label: string
  value: number
  tone: "solid" | "dark" | "hatched"
}

/**
 * `ratio` is the headline part's share of the total and `headline` its
 * value: the part named `headlineKey`, else the first. Empty → 0, never NaN.
 */
export function gaugeSummary(
  parts: readonly GaugePart[],
  headlineKey?: string
) {
  const clean = parts.map((part) => ({
    ...part,
    value: Number.isFinite(part.value) ? Math.max(0, part.value) : 0,
  }))
  const total = clean.reduce((sum, part) => sum + part.value, 0)
  const headline =
    headlineKey === undefined
      ? clean[0]
      : clean.find((part) => part.key === headlineKey)
  return {
    parts: clean,
    total,
    headline: headline?.value ?? 0,
    ratio: total === 0 ? 0 : (headline?.value ?? 0) / total,
  }
}

const PERCENT = new Intl.NumberFormat("en-IE", {
  style: "percent",
  maximumFractionDigits: 0,
})

export function formatShare(part: number, total: number): string {
  if (!(total > 0)) return "—"
  return PERCENT.format(Math.floor((part * 100) / total) / 100)
}
```

`components/admin/kit/gauge.tsx`:

```tsx
"use client"

import { useId } from "react"
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts"

import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"

import { formatNumber } from "./format"
import { formatShare, type GaugePart, gaugeSummary } from "./gauge-math"

const SWATCH: Record<GaugePart["tone"], string> = {
  solid: "bg-chart-2",
  dark: "bg-chart-4",
  hatched: "bg-hatch",
}

/**
 * JW signature gauge (admin/components/dashboard/gauge.tsx): a semicircle
 * of stacked solid, dark and hatched arcs with a big centred percentage,
 * a legend, and a screen-reader table carrying the numbers.
 */
export function Gauge({
  title,
  parts,
  centerLabel,
  headlineKey,
}: {
  title: string
  parts: readonly GaugePart[]
  /** Says what the percentage is, e.g. "Passing". */
  centerLabel: string
  /** Part whose share is the centred percentage (default: the first). */
  headlineKey?: string
}) {
  const hatchId = `gauge-hatch-${useId().replace(/:/g, "")}`
  const reduced = useReducedMotion()
  const summary = gaugeSummary(parts, headlineKey)
  const fill: Record<GaugePart["tone"], string> = {
    solid: "var(--chart-2)",
    dark: "var(--chart-4)",
    hatched: `url(#${hatchId})`,
  }
  const row: Record<string, number> = summary.total
    ? Object.fromEntries(summary.parts.map((part) => [part.key, part.value]))
    : { empty: 1 }
  const config = Object.fromEntries(
    summary.parts.map((part) => [part.key, { label: part.label }])
  ) satisfies ChartConfig

  return (
    <figure className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="relative w-full max-w-sm">
        <ChartContainer
          config={config}
          className="aspect-[2/1] w-full"
          aria-hidden
        >
          <RadialBarChart
            data={[row]}
            startAngle={180}
            endAngle={0}
            cy="100%"
            innerRadius="150%"
            outerRadius="200%"
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
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
                  fill="var(--hatch)"
                  fillOpacity={0.25}
                />
                <rect width="3.5" height="8" fill="var(--hatch)" />
              </pattern>
            </defs>
            <PolarAngleAxis
              type="number"
              domain={[0, summary.total || 1]}
              tick={false}
              axisLine={false}
            />
            {summary.total ? (
              summary.parts.map((part) => (
                <RadialBar
                  key={part.key}
                  dataKey={part.key}
                  stackId="gauge"
                  fill={fill[part.tone]}
                  cornerRadius={12}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={!reduced}
                />
              ))
            ) : (
              <RadialBar
                dataKey="empty"
                fill="var(--skeleton)"
                cornerRadius={12}
                isAnimationActive={false}
              />
            )}
          </RadialBarChart>
        </ChartContainer>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <p className="text-kpi tabular-nums">
            {formatShare(summary.headline, summary.total)}
          </p>
          <p className="text-sm text-muted-foreground">{centerLabel}</p>
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Part</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {summary.parts.map((part) => (
            <tr key={part.key}>
              <th scope="row">{part.label}</th>
              <td>{part.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption>
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium">
          {summary.parts.map((part) => (
            <li key={part.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("size-4 rounded-full", SWATCH[part.tone])}
              />
              {part.label}
              <span className="text-muted-foreground tabular-nums">
                {formatNumber(part.value)}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
```

`components/admin/seo/keys.ts`:

```ts
/** TanStack Query key of GET /seo/overview (SEO screen + dashboard card). */
export const SEO_OVERVIEW_KEY = ["seo", "overview"] as const
```

`components/admin/seo/health.ts`:

```ts
import type { GaugePart } from "@/components/admin/kit/gauge-math"

/** Passing vs failing SEO checks for the gauge (headline: "passed"). */
export function healthParts(checks: {
  passed: number
  total: number
}): GaugePart[] {
  return [
    { key: "passed", label: "Passing checks", value: checks.passed, tone: "solid" },
    {
      key: "failed",
      label: "Needs work",
      value: checks.total - checks.passed,
      tone: "hatched",
    },
  ]
}
```

`components/admin/seo/seo-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Labels and help for a record's SEO fields (lib/schemas/common.ts `seo`). */
export const SEO_FIELDS_META: EditorMeta = {
  fields: {
    title: {
      label: "Title",
      help: "Browser tab and search-result headline. Leave empty to use the page name with the site's title pattern. Aim for 15–60 characters.",
      maxLength: 60,
    },
    description: {
      label: "Description",
      help: "The search-result snippet. Leave empty to use the page's own summary or the site default. Aim for 50–160 characters.",
      maxLength: 160,
      rows: 3,
    },
    canonical: {
      label: "Canonical address",
      help: "Only when the main copy of this content lives at another address. Normally empty.",
    },
    ogImage: {
      label: "Share image",
      help: "Shown when the page is shared on social networks. Empty: the site default, or a generated card with the page title. Best at 1200 × 630.",
    },
    noindex: {
      label: "Hide from search engines",
      help: "Adds noindex and leaves the page out of the sitemap.",
    },
  },
}
```

`components/admin/seo/growth-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"
import type { GrowthSettingsKey } from "@/lib/admin/growth-settings"

/** Editor hints for SEO defaults, tracking, consent and custom code. */
export const growthEditorMeta: Record<GrowthSettingsKey, EditorMeta> = {
  "seo.defaults": {
    fields: {
      title: {
        label: "Home page title",
        help: "The home page's browser-tab and search-result title.",
      },
      titleTemplate: {
        label: "Title pattern",
        help: "{title} is replaced by each page's name, e.g. “{title} | Security Partners Ltd.”.",
      },
      description: {
        label: "Default description",
        help: "Used by pages without a description of their own. Aim for 50–160 characters.",
        maxLength: 160,
      },
      ogImage: {
        label: "Default share image",
        help: "Used when a page has no share image. Leave empty to generate a card with each page's title. Best at 1200 × 630.",
      },
      organization: { label: "Business details for search engines", section: true },
      "organization.type": {
        label: "Business type",
        widget: "select",
        options: [
          { value: "LocalBusiness", label: "Local business" },
          { value: "ProfessionalService", label: "Professional service" },
        ],
      },
      "organization.streetAddress": { label: "Street address" },
      "organization.addressLocality": { label: "Town" },
      "organization.addressRegion": { label: "County" },
      "organization.postalCode": { label: "Eircode" },
      "organization.addressCountry": {
        label: "Country code",
        help: "Two capital letters, e.g. IE.",
      },
      "organization.areaServed": {
        label: "Area served",
        help: "e.g. Ireland, or Leinster.",
      },
      "organization.sameAs": {
        label: "Official profiles",
        itemName: "Profile link",
        help: "Full links to the company's own LinkedIn, Facebook … pages.",
      },
    },
  },
  tracking: {
    fields: {
      enabled: {
        label: "Load tracking",
        help: "On: visitors see the cookie banner and the tags below load only after they agree. Off: no banner and no tracking at all.",
      },
      gtmId: {
        label: "Google Tag Manager ID",
        placeholder: "GTM-XXXXXXX",
        help: "Loads after a visitor accepts analytics cookies.",
      },
      ga4Id: {
        label: "Google Analytics 4 ID",
        placeholder: "G-XXXXXXXXXX",
        help: "Loads after analytics consent. Use this or Tag Manager for Analytics, not both, or visits are counted twice.",
      },
      metaPixelId: {
        label: "Meta Pixel ID",
        placeholder: "1234567890",
        help: "Loads after a visitor accepts marketing cookies.",
      },
    },
  },
  consent: {
    fields: {
      title: { label: "Banner title" },
      body: { label: "Banner text", rows: 3 },
      acceptLabel: { label: "Accept button" },
      rejectLabel: { label: "Reject button" },
      customiseLabel: { label: "Customise button" },
      saveLabel: { label: "Save choices button" },
      policyLink: { label: "Privacy policy link" },
      categories: { label: "Cookie categories", section: true },
      "categories.necessary": { label: "Necessary (always on)" },
      "categories.analytics": { label: "Analytics" },
      "categories.marketing": { label: "Marketing" },
    },
  },
  customCode: {
    fields: {
      headHtml: {
        label: "Code in <head>",
        rows: 10,
        help: "Added to the <head> of every public page after it loads.",
      },
      bodyEndHtml: {
        label: "Code at the end of <body>",
        rows: 10,
        help: "Added at the end of every public page after it loads.",
      },
    },
  },
}
```

`components/admin/seo/serp-preview.tsx`:

```tsx
const clip = (text: string, max: number) => {
  const chars = [...text]
  return chars.length > max
    ? `${chars.slice(0, max - 1).join("").trimEnd()}…`
    : text
}

/** How the page may look as a search result (title ~60, snippet ~160 chars). */
export function SerpPreview({
  title,
  url,
  description,
}: {
  title: string
  url: string
  description: string
}) {
  return (
    <figure className="flex flex-col gap-1 rounded-xl border bg-background p-4">
      <figcaption className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Search result preview
      </figcaption>
      <p className="truncate text-sm text-muted-foreground">{url}</p>
      <p className="text-lg leading-snug font-medium text-primary">
        {clip(title, 60)}
      </p>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {clip(description, 160)}
      </p>
    </figure>
  )
}
```

`components/admin/seo/seo-sheet.tsx`:

```tsx
"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { StatusPill } from "@/components/admin/kit/status-pill"
import { FORM_ACTION } from "@/components/admin/page-header"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { SeoEntry, SeoOverviewDto } from "@/lib/schemas/api/seo"
import { type Seo, seo as seoSchema } from "@/lib/schemas/common"
import { filled } from "@/lib/seo/effective"

import { SEO_OVERVIEW_KEY } from "./keys"
import { SEO_FIELDS_META } from "./seo-meta"
import { SerpPreview } from "./serp-preview"

/** One record's SEO fields in a right sheet (JW detail pattern); saves are live. */
export function SeoSheet({
  entry,
  origin,
  onClose,
}: {
  entry: SeoEntry
  origin: string
  onClose: () => void
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const queryClient = useQueryClient()
  const [value, setValue] = useState<Seo>(entry.seo)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.seo.entries[":kind"][":id"].$put({
          param: { kind: entry.kind, id: entry.id },
          json: { seo: value },
        })
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData<SeoOverviewDto>(SEO_OVERVIEW_KEY, (old) =>
        old
          ? {
              ...old,
              entries: old.entries.map((e) =>
                e.kind === saved.kind && e.id === saved.id ? saved : e
              ),
            }
          : old
      )
      void queryClient.invalidateQueries({ queryKey: SEO_OVERVIEW_KEY })
      toast.success("SEO saved", { description: "The live page uses it now." })
      onClose()
    },
    onError: (error) => {
      setErrors(error instanceof ApiError ? error.fieldErrors : {})
      toast.error("Not saved", { description: errorMessage(error) })
    },
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">
            SEO: {entry.name}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-xs text-muted-foreground">
              {entry.path}
            </code>
            <StatusPill tone={entry.published ? "success" : "neutral"}>
              {entry.published ? "Published" : "Not published"}
            </StatusPill>
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <SerpPreview
            title={filled(value.title) ?? entry.fallback.title}
            url={`${origin}${entry.path}`}
            description={
              filled(value.description) ?? entry.fallback.description
            }
          />
          <SchemaForm
            schema={seoSchema}
            meta={SEO_FIELDS_META}
            value={value}
            onChange={(next) => setValue(next as Seo)}
            errors={errors}
            disabled={!canEdit || save.isPending}
            idPrefix={`seo-${entry.kind}-${entry.id}`}
          />
          {canEdit ? (
            <Button
              type="button"
              className={`${FORM_ACTION} self-start`}
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save SEO"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              You can view these settings but not change them.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

`components/admin/seo/seo-overview.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { Gauge } from "@/components/admin/kit/gauge"
import { CardSkeleton, KpiRowSkeleton } from "@/components/admin/kit/skeletons"
import { StatusPill } from "@/components/admin/kit/status-pill"
import { PageHeader, PRIMARY_ACTION } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import type { SeoEntry, SeoKind, SeoOverviewDto } from "@/lib/schemas/api/seo"

import { healthParts } from "./health"
import { SEO_OVERVIEW_KEY } from "./keys"
import { SeoSheet } from "./seo-sheet"

const GROUPS: { kind: SeoKind; title: string }[] = [
  { kind: "page", title: "Pages" },
  { kind: "service", title: "Services" },
  { kind: "article", title: "Articles" },
]

const keyOf = (entry: Pick<SeoEntry, "kind" | "id">) =>
  `${entry.kind}:${entry.id}`

/** SEO › Overview: health gauge, every record's checks, the SEO sheet (?edit=). */
export function SeoOverview({ origin }: { origin: string }) {
  const query = useQuery({
    queryKey: SEO_OVERVIEW_KEY,
    queryFn: () => unwrap(api.seo.overview.$get()),
  })
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const editing = params.get("edit")
  const setEditing = (value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set("edit", value)
    else next.delete("edit")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const entry =
    editing && query.data
      ? (query.data.entries.find((e) => keyOf(e) === editing) ?? null)
      : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="SEO"
        description="How search engines and social networks see each page. Changes apply to the live site as soon as you save."
      />
      {query.isPending ? (
        <>
          <KpiRowSkeleton />
          <CardSkeleton />
        </>
      ) : query.isError ? (
        <EmptyState
          role="alert"
          title="SEO health didn't load"
          description={errorMessage(query.error)}
          action={
            <Button className={PRIMARY_ACTION} onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <Loaded data={query.data} onEdit={(e) => setEditing(keyOf(e))} />
      )}
      {entry ? (
        <SeoSheet
          key={keyOf(entry)}
          entry={entry}
          origin={origin}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function Loaded({
  data,
  onEdit,
}: {
  data: SeoOverviewDto
  onEdit: (entry: SeoEntry) => void
}) {
  const canEdit = usePermission({ seo: ["update"] })
  const live = data.entries.filter((e) => e.published)
  const needWork = live.filter((e) => e.issues.length > 0).length
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <DashboardCard title="SEO health">
        {data.checks.total === 0 ? (
          <EmptyState
            title="Nothing published yet"
            description="Checks run on published pages, services and articles."
          />
        ) : (
          <Gauge
            title="SEO health"
            centerLabel="Passing"
            headlineKey="passed"
            parts={healthParts(data.checks)}
          />
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {needWork === 0
            ? "Every published page passes the checks."
            : `${needWork} of ${live.length} published pages need attention.`}
        </p>
      </DashboardCard>
      <DashboardCard title="Pages and posts">
        <div className="flex flex-col gap-6">
          {GROUPS.map((group) => {
            const entries = data.entries.filter((e) => e.kind === group.kind)
            if (entries.length === 0) return null
            const headingId = `seo-group-${group.kind}`
            return (
              <section
                key={group.kind}
                aria-labelledby={headingId}
                className="flex flex-col gap-2"
              >
                <h3
                  id={headingId}
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {group.title}
                </h3>
                <ul role="list" className="flex flex-col divide-y">
                  {entries.map((entry) => (
                    <li
                      key={keyOf(entry)}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="font-semibold">{entry.name}</p>
                        <code className="font-mono text-xs text-muted-foreground">
                          {entry.path}
                        </code>
                        <div className="flex flex-wrap gap-2">
                          {!entry.published ? (
                            <StatusPill tone="neutral">Not published</StatusPill>
                          ) : entry.issues.length === 0 ? (
                            <StatusPill tone="success">All checks pass</StatusPill>
                          ) : null}
                          {entry.seo.noindex ? (
                            <StatusPill tone="warning">Hidden from search</StatusPill>
                          ) : null}
                        </div>
                        {entry.issues.length > 0 ? (
                          <ul
                            role="list"
                            className="list-disc pl-5 text-sm text-muted-foreground"
                          >
                            {entry.issues.map((issue) => (
                              <li key={issue.check}>{issue.message}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 shrink-0 self-start rounded-xl bg-card"
                        aria-label={`${canEdit ? "Edit" : "View"} SEO for ${entry.name}`}
                        onClick={() => onEdit(entry)}
                      >
                        {canEdit ? "Edit SEO" : "View SEO"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </DashboardCard>
    </div>
  )
}
```

`components/admin/seo/seo-link.tsx`:

```tsx
"use client"

import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import type { SeoKind } from "@/lib/schemas/api/seo"
import { cn } from "@/lib/utils"

/** Editor header link to this record's SEO sheet (SEO › Overview). */
export function SeoLink({ kind, id }: { kind: SeoKind; id: string }) {
  const canRead = usePermission({ seo: ["read"] })
  if (!canRead) return null
  return (
    <Link
      href={`/admin/seo?edit=${encodeURIComponent(`${kind}:${id}`)}`}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "h-12 rounded-xl bg-card px-4"
      )}
    >
      SEO
    </Link>
  )
}
```

`components/admin/seo/growth-settings-editor.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { usePermission } from "@/hooks/use-permission"
import {
  GROWTH_SETTINGS,
  type GrowthSettingsKey,
} from "@/lib/admin/growth-settings"
import { api, unwrap } from "@/lib/api-client"
import { settingsSchemas } from "@/lib/schemas/settings"

import { growthEditorMeta } from "./growth-meta"

/**
 * Draft/publish editor for SEO defaults, tracking, consent and custom code
 * (`/marketing/:key`). No draft preview: the public site reads these keys'
 * published values only.
 */
export function GrowthSettingsEditor({
  settingsKey,
  backHref,
  backLabel,
  aside,
}: {
  settingsKey: GrowthSettingsKey
  backHref: string
  backLabel: string
  aside?: ReactNode
}) {
  const entry = GROWTH_SETTINGS[settingsKey]
  const canEdit = usePermission(entry.update)
  const param = { key: settingsKey }
  return (
    <VersionedEditor
      title={entry.label}
      backHref={backHref}
      backLabel={backLabel}
      queryKey={["marketing", settingsKey]}
      load={() => unwrap(api.marketing[":key"].$get({ param }))}
      saveDraft={(draft, version) =>
        unwrap(
          api.marketing[":key"].draft.$put({ param, json: { draft, version } })
        )
      }
      publish={(version) =>
        unwrap(api.marketing[":key"].publish.$post({ param, json: { version } }))
      }
      restore={(revisionId, version) =>
        unwrap(
          api.marketing[":key"].restore.$post({
            param,
            json: { revisionId, version },
          })
        )
      }
      schema={settingsSchemas[settingsKey]}
      meta={growthEditorMeta[settingsKey]}
      revisions={{ entity: "settings", id: settingsKey }}
      publicHref="/"
      canEdit={canEdit}
      canPublish={canEdit}
      aside={aside}
    />
  )
}
```

`components/admin/dashboard/content-health.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { Gauge } from "@/components/admin/kit/gauge"
import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { healthParts } from "@/components/admin/seo/health"
import { SEO_OVERVIEW_KEY } from "@/components/admin/seo/keys"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"

/** JW dashboard gauge (closes 04b deviation D7): share of passing SEO checks. */
export function ContentHealthCard() {
  const canRead = usePermission({ seo: ["read"] })
  const query = useQuery({
    queryKey: SEO_OVERVIEW_KEY,
    queryFn: () => unwrap(api.seo.overview.$get()),
    enabled: canRead,
    staleTime: 60_000,
  })
  if (!canRead) return null
  return (
    <DashboardCard
      title="Content health"
      action={
        <Link
          href="/admin/seo"
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Open SEO
        </Link>
      }
    >
      {query.isPending ? (
        <CardSkeleton />
      ) : query.isError ? (
        <EmptyState
          role="alert"
          title="Content health didn't load"
          description={errorMessage(query.error)}
        />
      ) : (
        <Gauge
          title="Content health"
          centerLabel="SEO checks passing"
          headlineKey="passed"
          parts={healthParts(query.data.checks)}
        />
      )}
    </DashboardCard>
  )
}
```

`components/admin/dashboard/dashboard.tsx` — `import { ContentHealthCard } from "./content-health"` and in `Body` replace the trailing `{activity ? (<DashboardCard title="Team activity"> … </DashboardCard>) : null}` block with the same block wrapped in a row beside the gauge:

```tsx
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {activity ? (
          <DashboardCard title="Team activity">
            {/* … the existing ActivityFeed, unchanged … */}
          </DashboardCard>
        ) : null}
        <ContentHealthCard />
      </div>
```

If `tests/dom/dashboard.test.tsx` renders as a role holding `seo:read`, make its fetch stub answer `GET /api/v1/admin/seo/overview` with `{ entries: [], checks: { passed: 0, total: 0 } }` (the same way it stubs `/dashboard`).

Editors — "SEO" link before the existing actions:
- `components/admin/pages/page-editor.tsx`: `import { SeoLink } from "@/components/admin/seo/seo-link"` and pass `actions={<SeoLink kind="page" id={pageKey} />}` to `VersionedEditor`.
- `components/admin/services/service-editor.tsx`: same import; `actions={<><SeoLink kind="service" id={id} />{canDelete && record.data ? (<DeleteService service={record.data} onDeleted={() => setDeleted(true)} />) : null}</>}`.
- `components/admin/articles/article-editor.tsx` (Phase 5, slot form): `actions={(ctx) => (<><SeoLink kind="article" id={id} /><WorkflowActions ctx={ctx} /></>)}` (use the editor's article id variable).

`app/(admin)/admin/(panel)/seo/layout.tsx`:

```tsx
import { NavChildTabs } from "@/components/admin/shell/nav-child-tabs"

/** SEO › Overview · Defaults · Redirects as route tabs. */
export default function SeoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <NavChildTabs section="SEO">{children}</NavChildTabs>
}
```

`app/(admin)/admin/(panel)/seo/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { SeoOverview } from "@/components/admin/seo/seo-overview"
import { requirePermission } from "@/server/auth/session"
import { publicOrigin } from "@/server/lib/site-origin"
import { getPublishedSettings } from "@/server/modules/settings/queries"

export const metadata: Metadata = { title: "SEO" }

export default function SeoPage() {
  return (
    <Suspense fallback={null}>
      <Overview />
    </Suspense>
  )
}

async function Overview() {
  await requirePermission({ seo: ["read"] })
  const site = await getPublishedSettings("site")
  return <SeoOverview origin={publicOrigin(site?.productionUrl ?? null)} />
}
```

`app/(admin)/admin/(panel)/seo/defaults/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "SEO defaults" }

export default function SeoDefaultsPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePermission(GROWTH_SETTINGS["seo.defaults"].read)
  return (
    <GrowthSettingsEditor
      settingsKey="seo.defaults"
      backHref="/admin/seo"
      backLabel="SEO overview"
    />
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/admin && pnpm exec vitest run --project dom`
Expected: PASS (gauge-math 2, nav incl. 10 new, gauge 2, seo-overview 5, content-health 2; the `resolve-widget` "every schema renders" test and the dashboard/editor DOM suites stay green).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: clean.

Run: `pnpm dev`, sign in as the seeded owner, open `/admin/seo`: Growth section in the sidebar, SEO tabs Overview · Defaults · Redirects on the left, gauge + list; "Edit SEO for Home" opens the sheet from the right; `/admin/seo/defaults` shows the editor with the "Business details" group; the dashboard shows "Content health" beside Team activity. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/shell/nav.ts components/admin/shell/nav-child-tabs.tsx components/admin/kit/gauge-math.ts components/admin/kit/gauge.tsx components/admin/seo components/admin/dashboard/content-health.tsx components/admin/dashboard/dashboard.tsx components/admin/pages/page-editor.tsx components/admin/services/service-editor.tsx components/admin/articles/article-editor.tsx "app/(admin)/admin/(panel)/seo" tests/unit/admin/gauge-math.test.ts tests/unit/admin/nav.test.ts tests/dom/gauge.test.tsx tests/dom/seo-overview.test.tsx tests/dom/content-health.test.tsx tests/dom/dashboard.test.tsx
git add components/admin/shell/nav.ts components/admin/shell/nav-child-tabs.tsx components/admin/kit/gauge-math.ts components/admin/kit/gauge.tsx components/admin/seo components/admin/dashboard/content-health.tsx components/admin/dashboard/dashboard.tsx components/admin/pages/page-editor.tsx components/admin/services/service-editor.tsx components/admin/articles/article-editor.tsx "app/(admin)/admin/(panel)/seo" tests/unit/admin/gauge-math.test.ts tests/unit/admin/nav.test.ts tests/dom/gauge.test.tsx tests/dom/seo-overview.test.tsx tests/dom/content-health.test.tsx tests/dom/dashboard.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): SEO overview, record SEO sheet and SEO defaults

New Growth section (SEO, Marketing) with route tabs; SEO overview shows
the JW health gauge and each page's checks, editing a record's SEO in a
sheet with a search-result preview; SEO defaults use the versioned
editor; the dashboard gains the Content health gauge.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Admin — Redirects screen (master Task 8.2, admin screen)

**Files:**
- Create: `components/admin/seo/redirects-screen.tsx`, `components/admin/seo/redirect-dialog.tsx`, `app/(admin)/admin/(panel)/seo/redirects/page.tsx`
- Test: `tests/dom/redirects-screen.test.tsx`, `tests/e2e/seo-admin.spec.ts`

**Interfaces:**
- Consumes: Task 4 `GET/POST /redirects`, `PATCH/DELETE /redirects/:id` (`api.redirects`), `RedirectDto`, `Paginated`; `DataTable` (`columnsFor`, `DataTableColumns`), kit `PageHeader`, `PRIMARY_ACTION`, `FORM_ACTION`, `StatusPill`, `relativeTime`, `formatNumber`; `components/ui/{dialog,alert-dialog,input,label,button}.tsx`; `formatDateTime`.
- Produces:

```ts
export function RedirectsScreen(): JSX.Element                                 // SEO › Redirects
export function RedirectDialog(props: { redirect: RedirectDto | null; onClose(): void; onSaved(): void }): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

`tests/dom/redirects-screen.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/seo/redirects",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { RedirectsScreen } from "@/components/admin/seo/redirects-screen"
import { AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { RedirectDto } from "@/lib/schemas/api/redirects"

const ROW: RedirectDto = {
  id: "00000000-0000-7000-8000-0000000000aa",
  fromPath: "/old-alarms",
  toPath: "/services/alarm-responses",
  code: 301,
  hits: 1234,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input), "http://localhost")
  const method = init?.method ?? "GET"
  if (method === "GET" && url.pathname === "/api/v1/admin/redirects")
    return json(200, { items: [ROW], page: 1, pageSize: 20, total: 1 })
  if (method === "POST" && url.pathname === "/api/v1/admin/redirects") {
    const body = JSON.parse(String(init!.body)) as { toPath: string }
    if (body.toPath === "/old-alarms")
      return json(422, {
        error: {
          code: "VALIDATION_FAILED",
          message: "This would loop",
          fieldErrors: { toPath: ["This would loop: /a → /old-alarms → /a"] },
        },
      })
    return json(201, { ...ROW, id: "new", ...body })
  }
  if (method === "DELETE") return json(200, { ok: true })
  return json(404, { error: { code: "NOT_FOUND", message: "x" } })
})

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

const renderAs = (roles: Role[]) =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider
        value={{
          user: { id: "u", name: "U", email: "u@x.test", title: null, twoFactorEnabled: true },
          roles,
          impersonatedBy: null,
        }}
      >
        <RedirectsScreen />
      </AdminSessionProvider>
    </QueryClientProvider>
  )

describe("Redirects screen (master 8.2)", () => {
  it("lists redirects with type, hits and actions for marketers", async () => {
    renderAs(["marketer"])
    const table = await screen.findByRole("table", { name: "Redirects" })
    expect(within(table).getByText("/old-alarms")).toBeInTheDocument()
    expect(within(table).getByText("/services/alarm-responses")).toBeInTheDocument()
    expect(within(table).getByText("Permanent (301)")).toBeInTheDocument()
    expect(within(table).getByText("1,234")).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "Edit redirect from /old-alarms" })
    ).toBeInTheDocument()
  })

  it("viewers get no add, edit or delete", async () => {
    renderAs(["viewer"])
    await screen.findByRole("table", { name: "Redirects" })
    expect(screen.queryByRole("button", { name: "Add redirect" })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Edit redirect/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Delete redirect/ })).toBeNull()
  })

  it("adding shows field errors from the API (loop)", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(await screen.findByRole("button", { name: "Add redirect" }))
    const dialog = screen.getByRole("dialog", { name: "Add redirect" })
    await user.type(within(dialog).getByLabelText("Old address"), "/a")
    await user.type(within(dialog).getByLabelText("New address"), "/old-alarms")
    await user.click(within(dialog).getByRole("button", { name: "Add redirect" }))
    expect(
      await within(dialog).findByText("This would loop: /a → /old-alarms → /a")
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText("New address")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
  })

  it("adding a valid redirect posts it and closes the dialog", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    await user.click(await screen.findByRole("button", { name: "Add redirect" }))
    const dialog = screen.getByRole("dialog", { name: "Add redirect" })
    await user.type(within(dialog).getByLabelText("Old address"), "/promo")
    await user.type(within(dialog).getByLabelText("New address"), "/contact")
    await user.selectOptions(within(dialog).getByLabelText("Type"), "302")
    await user.click(within(dialog).getByRole("button", { name: "Add redirect" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add redirect" })).toBeNull()
    )
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      fromPath: "/promo",
      toPath: "/contact",
      code: 302,
    })
  })

  it("delete asks first, then deletes", async () => {
    const user = userEvent.setup()
    renderAs(["marketer"])
    const table = await screen.findByRole("table", { name: "Redirects" })
    await user.click(
      within(table).getByRole("button", {
        name: "Delete redirect from /old-alarms",
      })
    )
    const confirm = screen.getByRole("alertdialog")
    await user.click(within(confirm).getByRole("button", { name: "Delete" }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/admin/redirects/${ROW.id}`),
        expect.objectContaining({ method: "DELETE" })
      )
    )
  })
})
```

`tests/e2e/seo-admin.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "./env"
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
  await page.waitForURL((url) => url.pathname === "/admin")
}

test("owner adds a redirect in SEO › Redirects; the old address 301s", async ({
  page,
}) => {
  await signIn(page, readFixtures().owner.email)
  await page.goto("/admin/seo/redirects")
  await expect(page.getByRole("heading", { level: 1, name: "Redirects" })).toBeVisible()
  await page.getByRole("button", { name: "Add redirect" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Add redirect" })
  await dialog.getByLabel("Old address").fill("/e2e-old-contact")
  await dialog.getByLabel("New address").fill("/contact")
  await dialog.getByRole("button", { name: "Add redirect" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("table", { name: "Redirects" })).toContainText(
    "/e2e-old-contact"
  )

  const res = await page.request.get("/e2e-old-contact", { maxRedirects: 0 })
  expect(res.status()).toBe(301)
  expect(res.headers().location).toBe(`${BASE_URL}/contact`)

  await page
    .getByRole("button", { name: "Delete redirect from /e2e-old-contact" })
    .click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("table", { name: "Redirects" })).not.toContainText(
    "/e2e-old-contact"
  )
})

test("SEO overview: the sheet saves a page's description", async ({ page }) => {
  await signIn(page, readFixtures().owner.email)
  await page.goto("/admin/seo")
  await page.getByRole("button", { name: "Edit SEO for Terms of use" }).click()
  const sheet = page.getByRole("dialog", { name: "SEO: Terms of use" })
  const description = sheet.getByRole("textbox", { name: /^Description/ })
  const before = await description.inputValue()
  await description.fill("The terms that apply when you use the Security Partners website.")
  await sheet.getByRole("button", { name: "Save SEO" }).click()
  await expect(sheet).toBeHidden()
  const head = await (await page.request.get("/terms")).text()
  expect(head).toContain(
    'content="The terms that apply when you use the Security Partners website."'
  )
  // restore
  await page.getByRole("button", { name: "Edit SEO for Terms of use" }).click()
  await page
    .getByRole("dialog", { name: "SEO: Terms of use" })
    .getByRole("textbox", { name: /^Description/ })
    .fill(before)
  await page
    .getByRole("dialog", { name: "SEO: Terms of use" })
    .getByRole("button", { name: "Save SEO" })
    .click()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/redirects-screen.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/seo/redirects-screen"`.

- [ ] **Step 3: Implement**

`components/admin/seo/redirect-dialog.tsx`:

```tsx
"use client"

import { useMutation } from "@tanstack/react-query"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import { FORM_ACTION } from "@/components/admin/page-header"
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
import { Label } from "@/components/ui/label"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { RedirectDto } from "@/lib/schemas/api/redirects"

function FieldRow({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint: string
  error: string | undefined
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const describedBy = (id: string, error: string | undefined) =>
  error ? `${id}-hint ${id}-error` : `${id}-hint`

/** Add or edit one redirect; API field errors (loops, live pages) show inline. */
export function RedirectDialog({
  redirect,
  onClose,
  onSaved,
}: {
  redirect: RedirectDto | null
  onClose: () => void
  onSaved: () => void
}) {
  const [fromPath, setFromPath] = useState(redirect?.fromPath ?? "")
  const [toPath, setToPath] = useState(redirect?.toPath ?? "")
  const [code, setCode] = useState<301 | 302>(redirect?.code ?? 301)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const title = redirect ? "Edit redirect" : "Add redirect"
  const save = useMutation({
    mutationFn: () =>
      redirect
        ? unwrap(
            api.redirects[":id"].$patch({
              param: { id: redirect.id },
              json: { fromPath, toPath, code },
            })
          )
        : unwrap(api.redirects.$post({ json: { fromPath, toPath, code } })),
    onSuccess: () => {
      toast.success(redirect ? "Redirect saved" : "Redirect added")
      onSaved()
      onClose()
    },
    onError: (error) => {
      const fieldErrors = error instanceof ApiError ? error.fieldErrors : {}
      setErrors(fieldErrors)
      if (Object.keys(fieldErrors).length === 0)
        toast.error("Not saved", { description: errorMessage(error) })
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    save.mutate()
  }
  const fromError = errors.fromPath?.[0]
  const toError = errors.toPath?.[0]
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Visitors and search engines asking for the old address are sent to
            the new one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FieldRow
            id="redirect-from"
            label="Old address"
            hint="A path on this site, e.g. /old-page"
            error={fromError}
          >
            <Input
              id="redirect-from"
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              required
              autoComplete="off"
              aria-invalid={fromError ? true : undefined}
              aria-describedby={describedBy("redirect-from", fromError)}
              className="h-11 rounded-xl font-mono"
            />
          </FieldRow>
          <FieldRow
            id="redirect-to"
            label="New address"
            hint="A site path like /services, or a full https:// link"
            error={toError}
          >
            <Input
              id="redirect-to"
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              required
              autoComplete="off"
              aria-invalid={toError ? true : undefined}
              aria-describedby={describedBy("redirect-to", toError)}
              className="h-11 rounded-xl font-mono"
            />
          </FieldRow>
          <div className="flex flex-col gap-2">
            <Label htmlFor="redirect-code">Type</Label>
            <select
              id="redirect-code"
              value={code}
              onChange={(e) => setCode(Number(e.target.value) === 302 ? 302 : 301)}
              className="h-11 rounded-xl border bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value={301}>Permanent (301) — the page moved for good</option>
              <option value={302}>Temporary (302) — it will come back</option>
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={FORM_ACTION}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className={FORM_ACTION} disabled={save.isPending}>
              {save.isPending ? "Saving…" : redirect ? "Save" : "Add redirect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

`components/admin/seo/redirects-screen.tsx`:

```tsx
"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { createContext, useContext, useState } from "react"
import { toast } from "sonner"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { formatNumber, relativeTime } from "@/components/admin/kit/format"
import { StatusPill } from "@/components/admin/kit/status-pill"
import {
  FORM_ACTION,
  PageHeader,
  PRIMARY_ACTION,
} from "@/components/admin/page-header"
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
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { Paginated } from "@/lib/schemas/api/list"
import type { RedirectDto } from "@/lib/schemas/api/redirects"

import { RedirectDialog } from "./redirect-dialog"

type Row = RedirectDto & Record<string, unknown>
const ch = columnsFor<Row>()
const QUERY_KEY = ["redirects"] as const

type Actions = {
  canUpdate: boolean
  canDelete: boolean
  onEdit: (row: RedirectDto) => void
  onDelete: (row: RedirectDto) => void
}
const ActionsContext = createContext<Actions | null>(null)

function TypePill({ code }: { code: 301 | 302 }) {
  return (
    <StatusPill tone={code === 301 ? "success" : "info"}>
      {code === 301 ? "Permanent (301)" : "Temporary (302)"}
    </StatusPill>
  )
}

function Updated({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="text-muted-foreground">
      {relativeTime(iso, Date.now())}
    </time>
  )
}

function RowActions({ row }: { row: RedirectDto }) {
  const actions = useContext(ActionsContext)!
  if (!actions.canUpdate && !actions.canDelete) return null
  return (
    <div className="flex justify-end gap-2">
      {actions.canUpdate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Edit redirect from ${row.fromPath}`}
          onClick={() => actions.onEdit(row)}
        >
          Edit
        </Button>
      ) : null}
      {actions.canDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          aria-label={`Delete redirect from ${row.fromPath}`}
          onClick={() => actions.onDelete(row)}
        >
          Delete
        </Button>
      ) : null}
    </div>
  )
}

const columns = ch.columns([
  ch.accessor("fromPath", {
    header: "From",
    cell: (info) => (
      <code className="font-mono text-xs">{info.getValue()}</code>
    ),
  }),
  ch.accessor("toPath", {
    header: "To",
    enableSorting: false,
    cell: (info) => (
      <code className="font-mono text-xs break-all text-muted-foreground">
        {info.getValue()}
      </code>
    ),
  }),
  ch.accessor("code", {
    header: "Type",
    enableSorting: false,
    cell: (info) => <TypePill code={info.getValue()} />,
  }),
  ch.accessor("hits", {
    header: "Hits",
    cell: (info) => (
      <span className="tabular-nums">{formatNumber(info.getValue())}</span>
    ),
  }),
  ch.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => <Updated iso={info.getValue()} />,
  }),
  ch.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row.original} />,
  }),
]) as unknown as DataTableColumns<Row>

/** SEO › Redirects (master 8.2): list, add, edit, delete; hits per redirect. */
export function RedirectsScreen() {
  const canCreate = usePermission({ redirect: ["create"] })
  const canUpdate = usePermission({ redirect: ["update"] })
  const canDelete = usePermission({ redirect: ["delete"] })
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<RedirectDto | "new" | null>(null)
  const [deleting, setDeleting] = useState<RedirectDto | null>(null)
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  const remove = useMutation({
    mutationFn: (row: RedirectDto) =>
      unwrap(api.redirects[":id"].$delete({ param: { id: row.id } })),
    onSuccess: (_, row) => {
      toast.success(`Redirect from ${row.fromPath} deleted`)
      setDeleting(null)
      refresh()
    },
    onError: (error) =>
      toast.error("Not deleted", { description: errorMessage(error) }),
  })
  const addButton = (className: string) =>
    canCreate ? (
      <Button className={className} onClick={() => setEditing("new")}>
        <Plus aria-hidden data-icon="inline-start" />
        Add redirect
      </Button>
    ) : undefined

  return (
    <ActionsContext.Provider
      value={{ canUpdate, canDelete, onEdit: setEditing, onDelete: setDeleting }}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Redirects"
          description="Send old addresses to their new home. Renamed or deleted services and articles are redirected automatically."
          actions={addButton(PRIMARY_ACTION)}
        />
        <DataTable<Row>
          label="Redirects"
          queryKey={QUERY_KEY}
          fetchPage={async (params) =>
            (await unwrap(
              api.redirects.$get({
                query: {
                  page: String(params.page),
                  pageSize: String(params.pageSize),
                  sort: params.sort,
                  q: params.q,
                },
              })
            )) as Paginated<Row>
          }
          columns={columns}
          initialSort={[{ id: "updatedAt", desc: true }]}
          searchPlaceholder="Search addresses"
          renderCard={(row) => (
            <div className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-xs">
              <code className="font-mono text-xs">{row.fromPath}</code>
              <code className="font-mono text-xs break-all text-muted-foreground">
                → {row.toPath}
              </code>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <TypePill code={row.code} />
                <span className="tabular-nums">{formatNumber(row.hits)} hits</span>
              </div>
              <RowActions row={row} />
            </div>
          )}
          empty="No redirects yet. Add one when a page moves; renaming a published service or article adds one for you."
          emptyAction={addButton(FORM_ACTION)}
        />
      </div>
      {editing ? (
        <RedirectDialog
          key={editing === "new" ? "new" : editing.id}
          redirect={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this redirect?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `Visitors to ${deleting.fromPath} will see “page not found”.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ActionsContext.Provider>
  )
}
```

`app/(admin)/admin/(panel)/seo/redirects/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { RedirectsScreen } from "@/components/admin/seo/redirects-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Redirects" }

export default function RedirectsPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission({ redirect: ["read"] })
  return <RedirectsScreen />
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/redirects-screen.test.tsx`
Expected: PASS (5). If the DataTable's mobile cards render in jsdom alongside the table (duplicate buttons), scope queries with `within(table)` as written; the "viewer" test queries the whole screen on purpose.

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: clean.

Run: `pnpm test:e2e tests/e2e/seo-admin.spec.ts`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/seo/redirects-screen.tsx components/admin/seo/redirect-dialog.tsx "app/(admin)/admin/(panel)/seo/redirects/page.tsx" tests/dom/redirects-screen.test.tsx tests/e2e/seo-admin.spec.ts
git add components/admin/seo/redirects-screen.tsx components/admin/seo/redirect-dialog.tsx "app/(admin)/admin/(panel)/seo/redirects/page.tsx" tests/dom/redirects-screen.test.tsx tests/e2e/seo-admin.spec.ts
git commit -m "$(cat <<'EOF'
feat(admin): redirects screen under SEO

List with type and hit count, add/edit dialog showing the API's loop and
live-page errors inline, delete with confirmation; read-only for viewers.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Consent banner, consent-gated tracking, typed events, custom code injection (master Task 8.3, part 1)

**Files:**
- Create: `lib/analytics/consent.ts`, `lib/analytics/events.ts`, `lib/analytics/loaders.ts`, `components/consent/consent-provider.tsx`, `components/consent/consent-banner.tsx`, `components/consent/tracking-scripts.tsx`, `components/consent/custom-code.tsx`, `templates/shared/consent.ts`, `server/modules/marketing/public.ts`, `server/db/migrations/0009_consent_manage_label.sql` (custom, + `meta/`)
- Modify: `lib/schemas/settings/consent.ts` (`manageLabel`), `server/db/seed/fixtures/settings.ts` (`consent.manageLabel`), `components/site-extras.tsx` (consent + custom code), `components/home/contact-form.tsx` (`lead_submitted`), `components/admin/seo/growth-meta.ts` (`consent.manageLabel` label)
- Test: `tests/unit/analytics/consent.test.ts`, `tests/unit/analytics/events.test.ts`, `tests/dom/analytics-loaders.test.tsx`, `tests/dom/consent-banner.test.tsx`, `tests/dom/custom-code.test.tsx`, `tests/integration/db/consent-migration.test.ts`, `tests/integration/marketing/public.test.ts`

**Interfaces:**
- Consumes: Task 2 `SiteExtras`/`JsonLd`/`siteJsonLd`; Task 3 `getPublishedSettings`; `trackingSettings`, `consentSettings`, `customCodeSettings`; `linkView`, `placeholders` (`templates/shared/views.ts`); `buttonClassName` (`components/ui/button.tsx`, variants `brand`, `brand-outline`, size `pill-sm`); site tokens `bg-brand-navy`, `text-brand-green`, `accent-brand-green`.
- Produces:

```ts
// lib/analytics/consent.ts
export const CONSENT_COOKIE = "sp_consent"; export const CONSENT_VERSION = 1
export const CONSENT_MAX_AGE = 15_552_000                  // 180 days ≈ 6 months (seconds)
export type ConsentChoice = { analytics: boolean; marketing: boolean }
export function encodeConsent(choice: ConsentChoice, nowMs: number): string          // "1.<a>.<m>.<unix>"
export function readConsent(raw: string | null | undefined, nowMs: number): ConsentChoice | null
export function consentCookie(choice: ConsentChoice, nowMs: number, secure: boolean): string
export function cookieValue(header: string | null | undefined, name: string): string | undefined
export const CONSENT_DEFAULTS: { ad_storage: "denied"; … ; wait_for_update: 500 }
export function consentModeUpdate(choice: ConsentChoice): { analytics_storage; ad_storage; ad_user_data; ad_personalization }
export function withdrawn(previous: ConsentChoice | null, next: ConsentChoice): boolean
export function isTrackingCookie(name: string): boolean
export function cookieDomains(hostname: string): string[]
export function clearTrackingCookies(doc: { cookie: string }, hostname: string): void
// lib/analytics/events.ts
export const ANALYTICS_EVENTS: readonly ["lead_submitted", "cta_click", "phone_click", "email_click"]
export type AnalyticsEvent = { event: "lead_submitted"; source_page: string } | { event: "cta_click"; link_text: string; link_url: string } | { event: "phone_click"; link_url: string } | { event: "email_click"; link_url: string }
export type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: Fbq; _fbq?: Fbq; __spConsent?: ConsentChoice | null }
export function track(event: AnalyticsEvent, win?: AnalyticsWindow): boolean       // no-op without consent
export function classifyClick(href: string, text: string): AnalyticsEvent | null
// lib/analytics/loaders.ts
export type TrackingIds = { gtmId: string | null; ga4Id: string | null; metaPixelId: string | null }
export const GTM_SRC, GA4_SRC: (id: string) => string; export const META_PIXEL_SRC: string
export function startTracking(ids: TrackingIds, choice: ConsentChoice, env: { win: AnalyticsWindow; doc: Document }): string[]   // names newly loaded
// components/consent/*
export function ConsentProvider(props: { children: ReactNode; reload?: () => void }): JSX.Element
export function useConsent(): { choice: ConsentChoice | null | "pending"; bannerOpen: boolean; reopen(): void; save(choice: ConsentChoice): void }
export type ConsentBannerCopy = { title; body; acceptLabel; rejectLabel; customiseLabel; saveLabel; manageLabel: string; policyLink: Link; categories: Record<"necessary" | "analytics" | "marketing", { label: string; description: string }> }
export function ConsentBanner(props: { copy: ConsentBannerCopy }): JSX.Element | null
export function TrackingScripts(props: { ids: TrackingIds }): null
export function customCodeScript(html: string, target: "head" | "body"): string
export function CustomCode(props: { html: string; target: "head" | "body" }): JSX.Element | null
// templates/shared/consent.ts
export function consentBannerCopy(s: SiteSources, consent: ConsentSettings): ConsentBannerCopy   // policyLink through linkView
// server/modules/marketing/public.ts
export type PublicMarketing = { tracking: TrackingSettings; consent: ConsentSettings | null; customCode: CustomCodeSettings }
export async function loadPublicMarketing(): Promise<PublicMarketing>              // published values; invalid → off/empty
```

Load rules (spec §10): **analytics** consent → Google Consent Mode update, then GTM (`gtm.js?id=`) and/or GA4 (`gtag/js?id=` + `gtag('config')`); **marketing** consent → Meta Pixel (`fbevents.js`, `init`, `PageView`). Consent Mode defaults (all denied) are set before any Google tag. Events go to `window.dataLayer` (and `gtag('event')` when GA4 is loaded) only with analytics consent; `lead_submitted` also sends Meta `Lead` with marketing consent. Withdrawing a granted category clears GA/Meta cookies and reloads the page (running tags cannot be unloaded).

- [ ] **Step 1: Write the failing tests**

`tests/unit/analytics/consent.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  CONSENT_MAX_AGE,
  consentCookie,
  consentModeUpdate,
  cookieDomains,
  cookieValue,
  encodeConsent,
  isTrackingCookie,
  readConsent,
  withdrawn,
} from "@/lib/analytics/consent"

const NOW = Date.UTC(2026, 9, 16, 9)
const DAY = 86_400_000

describe("consent cookie", () => {
  it("round-trips a choice", () => {
    const raw = encodeConsent({ analytics: true, marketing: false }, NOW)
    expect(raw).toBe(`1.1.0.${Math.floor(NOW / 1000)}`)
    expect(readConsent(raw, NOW + DAY)).toEqual({
      analytics: true,
      marketing: false,
    })
  })

  it("expires after 6 months; ignores other versions, the future and junk", () => {
    const raw = encodeConsent({ analytics: true, marketing: true }, NOW)
    expect(readConsent(raw, NOW + 179 * DAY)).not.toBeNull()
    expect(readConsent(raw, NOW + 181 * DAY)).toBeNull()
    expect(readConsent(`2.1.1.${Math.floor(NOW / 1000)}`, NOW)).toBeNull()
    expect(readConsent(raw, NOW - DAY)).toBeNull()
    for (const junk of [undefined, null, "", "1.2.0.1", "x", "1.1.1"])
      expect(readConsent(junk, NOW)).toBeNull()
  })

  it("is a 6-month, site-wide, Lax cookie; Secure on https", () => {
    const choice = { analytics: false, marketing: false }
    expect(CONSENT_MAX_AGE).toBe(180 * 86_400)
    expect(consentCookie(choice, NOW, false)).toBe(
      `sp_consent=1.0.0.${Math.floor(NOW / 1000)}; Max-Age=15552000; Path=/; SameSite=Lax`
    )
    expect(consentCookie(choice, NOW, true).endsWith("; Secure")).toBe(true)
    expect(cookieValue("a=1; sp_consent=1.0.0.5; b=2", "sp_consent")).toBe(
      "1.0.0.5"
    )
  })

  it("Consent Mode mirrors the choice", () => {
    expect(consentModeUpdate({ analytics: true, marketing: false })).toEqual({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
  })

  it("withdrawal = taking back something granted", () => {
    const all = { analytics: true, marketing: true }
    const none = { analytics: false, marketing: false }
    expect(withdrawn(null, none)).toBe(false)
    expect(withdrawn(none, all)).toBe(false)
    expect(withdrawn(all, { analytics: true, marketing: false })).toBe(true)
  })

  it("knows GA/Meta cookies and the domains to clear them on", () => {
    for (const name of ["_ga", "_ga_ABC", "_gid", "_gcl_au", "_fbp", "_fbc"])
      expect(isTrackingCookie(name), name).toBe(true)
    expect(isTrackingCookie("sp_consent")).toBe(false)
    expect(cookieDomains("www.securitypartnersltd.com")).toEqual([
      "www.securitypartnersltd.com",
      ".www.securitypartnersltd.com",
      ".securitypartnersltd.com",
    ])
  })
})
```

`tests/unit/analytics/events.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import {
  type AnalyticsWindow,
  classifyClick,
  track,
} from "@/lib/analytics/events"

const fakeWindow = (consent: AnalyticsWindow["__spConsent"]) =>
  ({
    __spConsent: consent,
    dataLayer: [] as unknown[],
    gtag: vi.fn(),
    fbq: Object.assign(vi.fn(), { queue: [], loaded: true, version: "2.0" }),
  }) as unknown as AnalyticsWindow & {
    dataLayer: unknown[]
    gtag: ReturnType<typeof vi.fn>
    fbq: ReturnType<typeof vi.fn>
  }

describe("typed analytics events", () => {
  it("sends nothing without consent", () => {
    for (const consent of [undefined, null]) {
      const win = fakeWindow(consent)
      expect(track({ event: "phone_click", link_url: "tel:1" }, win)).toBe(false)
      expect(win.dataLayer).toEqual([])
    }
  })

  it("analytics consent: dataLayer + gtag event", () => {
    const win = fakeWindow({ analytics: true, marketing: false })
    expect(
      track({ event: "lead_submitted", source_page: "/contact" }, win)
    ).toBe(true)
    expect(win.dataLayer).toEqual([
      { event: "lead_submitted", source_page: "/contact" },
    ])
    expect(win.gtag).toHaveBeenCalledWith("event", "lead_submitted", {
      source_page: "/contact",
    })
    expect(win.fbq).not.toHaveBeenCalled()
  })

  it("marketing consent only: a Meta Lead for enquiries, no dataLayer", () => {
    const win = fakeWindow({ analytics: false, marketing: true })
    track({ event: "lead_submitted", source_page: "/" }, win)
    expect(win.fbq).toHaveBeenCalledWith("track", "Lead")
    expect(win.dataLayer).toEqual([])
  })

  it("classifies clicks on phone, email and contact links", () => {
    expect(classifyClick("tel:0858018746", "(085) 8018746")).toEqual({
      event: "phone_click",
      link_url: "tel:0858018746",
    })
    expect(classifyClick("mailto:info@x.ie", "info@x.ie")).toEqual({
      event: "email_click",
      link_url: "mailto:info@x.ie",
    })
    expect(classifyClick("/contact", "  Get a\n Quote ")).toEqual({
      event: "cta_click",
      link_text: "Get a Quote",
      link_url: "/contact",
    })
    expect(classifyClick("/services", "Services")).toBeNull()
  })
})
```

`tests/dom/analytics-loaders.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from "vitest"

import type { AnalyticsWindow } from "@/lib/analytics/events"
import { startTracking } from "@/lib/analytics/loaders"

const IDS = { gtmId: "GTM-TEST1", ga4Id: "G-TEST1", metaPixelId: "1234567890" }

const srcs = () =>
  [...document.querySelectorAll("script[data-sp-src]")].map(
    (s) => (s as HTMLScriptElement).dataset.spSrc
  )

beforeEach(() => {
  document.head.innerHTML = ""
  const win = window as AnalyticsWindow
  delete win.dataLayer
  delete win.gtag
  delete win.fbq
  delete win._fbq
})

describe("startTracking (after consent)", () => {
  it("analytics only: Consent Mode first, then GTM and GA4; no Meta", () => {
    const win = window as AnalyticsWindow
    const loaded = startTracking(
      IDS,
      { analytics: true, marketing: false },
      { win, doc: document }
    )
    expect(loaded).toEqual(["gtm", "ga4"])
    expect(srcs()).toEqual([
      "https://www.googletagmanager.com/gtm.js?id=GTM-TEST1",
      "https://www.googletagmanager.com/gtag/js?id=G-TEST1",
    ])
    const commands = win.dataLayer!.map((entry) =>
      Array.from(entry as ArrayLike<unknown>).slice(0, 2)
    )
    expect(commands[0]).toEqual(["consent", "default"])
    expect(commands[1]).toEqual(["consent", "update"])
    expect(win.fbq).toBeUndefined()
  })

  it("marketing adds the Meta pixel; a second call loads nothing twice", () => {
    const win = window as AnalyticsWindow
    const env = { win, doc: document }
    startTracking(IDS, { analytics: true, marketing: true }, env)
    expect(srcs()).toContain("https://connect.facebook.net/en_US/fbevents.js")
    expect(startTracking(IDS, { analytics: true, marketing: true }, env)).toEqual(
      []
    )
    expect(srcs()).toHaveLength(3)
  })

  it("nothing granted, nothing loaded", () => {
    expect(
      startTracking(
        IDS,
        { analytics: false, marketing: false },
        { win: window as AnalyticsWindow, doc: document }
      )
    ).toEqual([])
    expect(srcs()).toEqual([])
  })
})
```

`tests/dom/consent-banner.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ConsentBanner,
  type ConsentBannerCopy,
} from "@/components/consent/consent-banner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import type { AnalyticsWindow } from "@/lib/analytics/events"

const COPY: ConsentBannerCopy = {
  title: "We use cookies",
  body: "We use necessary cookies to run this site.",
  acceptLabel: "Accept all",
  rejectLabel: "Reject non-essential",
  customiseLabel: "Customise",
  saveLabel: "Save choices",
  manageLabel: "Cookie settings",
  policyLink: { label: "Privacy Policy", href: "/privacy" },
  categories: {
    necessary: { label: "Necessary", description: "Always on." },
    analytics: { label: "Analytics", description: "How the site is used." },
    marketing: { label: "Marketing", description: "Our advertising." },
  },
}

const clearCookies = () => {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}
const consentCookie = () =>
  document.cookie
    .split("; ")
    .find((c) => c.startsWith("sp_consent="))
    ?.slice("sp_consent=".length)

beforeEach(() => {
  clearCookies()
  delete (window as AnalyticsWindow).__spConsent
})

function renderBanner(reload = vi.fn()) {
  render(
    <ConsentProvider reload={reload}>
      <ConsentBanner copy={COPY} />
    </ConsentProvider>
  )
  return reload
}

describe("consent banner (spec §10)", () => {
  it("asks first-time visitors, with the policy link", () => {
    renderBanner()
    const banner = screen.getByRole("region", { name: "We use cookies" })
    expect(
      within(banner).getByRole("link", { name: "Privacy Policy" })
    ).toHaveAttribute("href", "/privacy")
    expect(banner.firstElementChild).toHaveClass("bg-brand-navy")
  })

  it("Accept all stores 1.1.1 for 6 months and leaves a way back", async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole("button", { name: "Accept all" }))
    expect(consentCookie()).toMatch(/^1\.1\.1\.\d+$/)
    expect((window as AnalyticsWindow).__spConsent).toEqual({
      analytics: true,
      marketing: true,
    })
    expect(screen.queryByRole("region", { name: "We use cookies" })).toBeNull()
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument()
  })

  it("Reject stores 1.0.0", async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole("button", { name: "Reject non-essential" }))
    expect(consentCookie()).toMatch(/^1\.0\.0\./)
  })

  it("Customise saves per category; necessary cannot be turned off", async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole("button", { name: "Customise" }))
    expect(screen.getByRole("checkbox", { name: /Necessary/ })).toBeDisabled()
    await user.click(screen.getByRole("checkbox", { name: /Analytics/ }))
    await user.click(screen.getByRole("button", { name: "Save choices" }))
    expect(consentCookie()).toMatch(/^1\.1\.0\./)
  })

  it("a returning visitor sees only the reopen button; withdrawing reloads", async () => {
    document.cookie = `sp_consent=1.1.1.${Math.floor(Date.now() / 1000)}; Path=/`
    const user = userEvent.setup()
    const reload = renderBanner()
    expect(screen.queryByRole("region", { name: "We use cookies" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Cookie settings" }))
    const marketing = screen.getByRole("checkbox", { name: /Marketing/ })
    expect(marketing).toBeChecked()
    await user.click(marketing)
    await user.click(screen.getByRole("button", { name: "Save choices" }))
    expect(consentCookie()).toMatch(/^1\.1\.0\./)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
```

`tests/dom/custom-code.test.tsx`:

```tsx
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CustomCode, customCodeScript } from "@/components/consent/custom-code"

describe("custom code loader", () => {
  it("renders nothing for empty code", () => {
    const { container } = render(<CustomCode html="  " target="body" />)
    expect(container.innerHTML).toBe("")
  })

  it("cannot close its own <script>, and appends the snippet to the target", () => {
    const html = '<meta name="x-e2e" content="1"></script><p id="custom-p">hi</p>'
    const script = customCodeScript(html, "body")
    expect(script).not.toContain("</script>")
    new Function(script)()
    expect(document.getElementById("custom-p")?.textContent).toBe("hi")
    new Function(customCodeScript('<meta name="x-head" content="2">', "head"))()
    expect(document.head.querySelector('meta[name="x-head"]')).not.toBeNull()
  })
})
```

`tests/integration/db/consent-migration.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) => f.endsWith("_consent_manage_label.sql"))!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

beforeEach(resetDb)

describe("0009_consent_manage_label (custom data migration)", () => {
  it("adds manageLabel where missing and keeps an edited one", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "consent",
        draft: { title: "T", manageLabel: "Privacy choices" },
        published: { title: "T" },
      })
    for (const statement of statements)
      await getDb().execute(sql.raw(statement))
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "consent"))
    expect(row.published).toEqual({ title: "T", manageLabel: "Cookie settings" })
    expect(row.draft).toEqual({ title: "T", manageLabel: "Privacy choices" })
  })
})
```

`tests/integration/marketing/public.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { loadPublicMarketing } from "@/server/modules/marketing/public"

import { resetDb } from "../db"

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("loadPublicMarketing (published values only)", () => {
  it("seeded: tracking off, consent copy, no custom code", async () => {
    const m = await loadPublicMarketing()
    expect(m.tracking.enabled).toBe(false)
    expect(m.consent?.manageLabel).toBe("Cookie settings")
    expect(m.customCode).toEqual({ headHtml: "", bodyEndHtml: "" })
  })

  it("never reads drafts; invalid published values switch tracking off", async () => {
    await getDb()
      .update(settings)
      .set({
        draft: { enabled: true, gtmId: "GTM-X1", ga4Id: null, metaPixelId: null },
      })
      .where(eq(settings.key, "tracking"))
    await getDb()
      .update(settings)
      .set({ draft: { headHtml: "<script>1</script>", bodyEndHtml: "" } })
      .where(eq(settings.key, "customCode"))
    let m = await loadPublicMarketing()
    expect(m.tracking.enabled).toBe(false)
    expect(m.customCode.headHtml).toBe("")

    await getDb()
      .update(settings)
      .set({ published: { enabled: true, gtmId: "nope" } })
      .where(eq(settings.key, "tracking"))
    m = await loadPublicMarketing()
    expect(m.tracking).toEqual({
      enabled: false,
      gtmId: null,
      ga4Id: null,
      metaPixelId: null,
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/analytics && pnpm exec vitest run --project dom tests/dom/analytics-loaders.test.tsx tests/dom/consent-banner.test.tsx tests/dom/custom-code.test.tsx`
Expected: FAIL — unresolved `@/lib/analytics/*` and `@/components/consent/*` imports.

Run: `pnpm test:integration tests/integration/db/consent-migration.test.ts tests/integration/marketing/public.test.ts`
Expected: FAIL — no `*_consent_manage_label.sql`; `@/server/modules/marketing/public` unresolved.

- [ ] **Step 3: Implement**

`lib/schemas/settings/consent.ts` — add after `saveLabel: text,`:

```ts
  /** The small button that reopens the banner after a choice (withdrawal). */
  manageLabel: text,
```

`server/db/seed/fixtures/settings.ts` — in `consent`, after `saveLabel: "Save choices",` add `manageLabel: "Cookie settings",`.

`components/admin/seo/growth-meta.ts` — in `consent.fields`, after `saveLabel`, add:

```ts
      manageLabel: {
        label: "Reopen button",
        help: "The small button that lets visitors change their choice later.",
      },
```

Create the custom migration: `pnpm db:generate --custom --name consent_manage_label` (expected `0009_consent_manage_label.sql`, the next free number) and write:

```sql
-- Phase 8: settings.consent gains manageLabel (the "Cookie settings" button).
-- Adds the key where it is missing; an existing value wins (right side of ||).
UPDATE "settings"
SET
  "draft" = '{"manageLabel":"Cookie settings"}'::jsonb || "draft",
  "published" = CASE
    WHEN jsonb_typeof("published") = 'object'
    THEN '{"manageLabel":"Cookie settings"}'::jsonb || "published"
    ELSE "published"
  END
WHERE "key" = 'consent' AND jsonb_typeof("draft") = 'object';
--> statement-breakpoint
UPDATE "revisions"
SET "data" = '{"manageLabel":"Cookie settings"}'::jsonb || "data"
WHERE "entity_type" = 'settings' AND "entity_id" = 'consent' AND jsonb_typeof("data") = 'object';
```

`lib/analytics/consent.ts`:

```ts
// The consent cookie and Google Consent Mode values (spec §10: own
// lightweight manager, choice kept 6 months). Isomorphic, no React.

export const CONSENT_COOKIE = "sp_consent"
export const CONSENT_VERSION = 1
/** 180 days ≈ 6 months, in seconds (cookie Max-Age). */
export const CONSENT_MAX_AGE = 180 * 86_400
const SKEW_MS = 5 * 60_000

export type ConsentChoice = { analytics: boolean; marketing: boolean }

/** "<version>.<analytics 0|1>.<marketing 0|1>.<unix seconds>" */
export function encodeConsent(choice: ConsentChoice, nowMs: number): string {
  return `${CONSENT_VERSION}.${choice.analytics ? 1 : 0}.${choice.marketing ? 1 : 0}.${Math.floor(nowMs / 1000)}`
}

/** The stored choice, or null when missing, malformed, of another version, from the future or older than 6 months. */
export function readConsent(
  raw: string | null | undefined,
  nowMs: number
): ConsentChoice | null {
  const match = /^(\d+)\.([01])\.([01])\.(\d+)$/.exec(raw ?? "")
  if (!match || Number(match[1]) !== CONSENT_VERSION) return null
  const age = nowMs - Number(match[4]) * 1000
  if (age < -SKEW_MS || age > CONSENT_MAX_AGE * 1000) return null
  return { analytics: match[2] === "1", marketing: match[3] === "1" }
}

export function consentCookie(
  choice: ConsentChoice,
  nowMs: number,
  secure: boolean
): string {
  return `${CONSENT_COOKIE}=${encodeConsent(choice, nowMs)}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`
}

export function cookieValue(
  header: string | null | undefined,
  name: string
): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const at = part.indexOf("=")
    if (at > 0 && part.slice(0, at).trim() === name)
      return part.slice(at + 1).trim()
  }
  return undefined
}

/** Google Consent Mode v2 defaults, set before any Google tag loads. */
export const CONSENT_DEFAULTS = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
} as const

const state = (on: boolean) => (on ? "granted" : "denied")

export function consentModeUpdate(choice: ConsentChoice) {
  return {
    analytics_storage: state(choice.analytics),
    ad_storage: state(choice.marketing),
    ad_user_data: state(choice.marketing),
    ad_personalization: state(choice.marketing),
  } as const
}

/** True when `next` takes back a category `previous` granted. */
export function withdrawn(
  previous: ConsentChoice | null,
  next: ConsentChoice
): boolean {
  return (
    (!!previous?.analytics && !next.analytics) ||
    (!!previous?.marketing && !next.marketing)
  )
}

const TRACKING_COOKIES = [/^_ga(_|$)/, /^_gid$/, /^_gcl_/, /^_fbp$/, /^_fbc$/]

export const isTrackingCookie = (name: string) =>
  TRACKING_COOKIES.some((re) => re.test(name))

/** GA/Meta set cookies on the registrable domain: try the host and each parent. */
export function cookieDomains(hostname: string): string[] {
  const labels = hostname.split(".")
  if (labels.length < 2) return [hostname]
  const out = [hostname]
  for (let i = 0; i <= labels.length - 2; i++)
    out.push(`.${labels.slice(i).join(".")}`)
  return out
}

export function clearTrackingCookies(
  doc: { cookie: string },
  hostname: string
): void {
  const names = doc.cookie
    .split(";")
    .map((part) => part.split("=")[0]!.trim())
    .filter(isTrackingCookie)
  for (const name of names) {
    doc.cookie = `${name}=; Max-Age=0; Path=/`
    for (const domain of cookieDomains(hostname))
      doc.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`
  }
}
```

`lib/analytics/events.ts`:

```ts
import type { ConsentChoice } from "./consent"

// Typed dataLayer event catalogue (spec §10).

export const ANALYTICS_EVENTS = [
  "lead_submitted",
  "cta_click",
  "phone_click",
  "email_click",
] as const

export type AnalyticsEvent =
  | { event: "lead_submitted"; source_page: string }
  | { event: "cta_click"; link_text: string; link_url: string }
  | { event: "phone_click"; link_url: string }
  | { event: "email_click"; link_url: string }

export type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  loaded: boolean
  version: string
  push?: Fbq
}

export type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  fbq?: Fbq
  _fbq?: Fbq
  /** Set by ConsentProvider; undefined when tracking is off (no banner). */
  __spConsent?: ConsentChoice | null
}

const browserWindow = () =>
  typeof window === "undefined" ? undefined : (window as AnalyticsWindow)

/** Sends one event if the visitor consented; false when nothing was sent. */
export function track(
  event: AnalyticsEvent,
  win: AnalyticsWindow | undefined = browserWindow()
): boolean {
  const consent = win?.__spConsent
  if (!win || !consent) return false
  let sent = false
  if (consent.analytics) {
    ;(win.dataLayer ??= []).push({ ...event })
    const { event: name, ...params } = event
    win.gtag?.("event", name, params)
    sent = true
  }
  if (consent.marketing && event.event === "lead_submitted" && win.fbq) {
    win.fbq("track", "Lead")
    sent = true
  }
  return sent
}

const CTA_PATHS = new Set(["/contact"])

/** The event for a click on a link (phone, email, contact CTA), or null. */
export function classifyClick(
  href: string,
  text: string
): AnalyticsEvent | null {
  const url = href.trim()
  if (/^tel:/i.test(url)) return { event: "phone_click", link_url: url }
  if (/^mailto:/i.test(url)) return { event: "email_click", link_url: url }
  const path = url.split(/[?#]/)[0] ?? url
  if (CTA_PATHS.has(path) || /#contact$/i.test(url))
    return {
      event: "cta_click",
      link_text: text.replace(/\s+/g, " ").trim().slice(0, 100),
      link_url: url,
    }
  return null
}
```

`lib/analytics/loaders.ts`:

```ts
import {
  CONSENT_DEFAULTS,
  type ConsentChoice,
  consentModeUpdate,
} from "./consent"
import type { AnalyticsWindow, Fbq } from "./events"

// Loads GTM / GA4 / Meta Pixel after matching consent (spec §10).

export type TrackingIds = {
  gtmId: string | null
  ga4Id: string | null
  metaPixelId: string | null
}

export const GTM_SRC = (id: string) =>
  `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`
export const GA4_SRC = (id: string) =>
  `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
export const META_PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js"

const hasScript = (doc: Document, src: string) =>
  [...doc.querySelectorAll<HTMLScriptElement>("script[data-sp-src]")].some(
    (script) => script.dataset.spSrc === src
  )

function injectScript(doc: Document, src: string) {
  const script = doc.createElement("script")
  script.async = true
  script.src = src
  script.dataset.spSrc = src
  doc.head.appendChild(script)
}

function ensureGtag(win: AnalyticsWindow) {
  win.dataLayer ??= []
  if (win.gtag) return
  const layer = win.dataLayer
  win.gtag = function gtag() {
    // gtag.js only reads `arguments` objects from the dataLayer.
    // eslint-disable-next-line prefer-rest-params
    layer.push(arguments)
  }
  win.gtag("consent", "default", CONSENT_DEFAULTS)
}

function installFbq(win: AnalyticsWindow) {
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  }) as Fbq
  fbq.queue = []
  fbq.loaded = true
  fbq.version = "2.0"
  fbq.push = fbq
  win.fbq = fbq
  win._fbq = fbq
}

/** Starts what `choice` allows; idempotent. Returns the tags loaded by this call. */
export function startTracking(
  ids: TrackingIds,
  choice: ConsentChoice,
  env: { win: AnalyticsWindow; doc: Document }
): string[] {
  const { win, doc } = env
  const loaded: string[] = []
  if (!choice.analytics && !choice.marketing) return loaded
  ensureGtag(win)
  win.gtag!("consent", "update", consentModeUpdate(choice))
  if (choice.analytics && ids.gtmId && !hasScript(doc, GTM_SRC(ids.gtmId))) {
    win.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" })
    injectScript(doc, GTM_SRC(ids.gtmId))
    loaded.push("gtm")
  }
  if (choice.analytics && ids.ga4Id && !hasScript(doc, GA4_SRC(ids.ga4Id))) {
    injectScript(doc, GA4_SRC(ids.ga4Id))
    win.gtag!("js", new Date())
    win.gtag!("config", ids.ga4Id)
    loaded.push("ga4")
  }
  if (choice.marketing && ids.metaPixelId && !hasScript(doc, META_PIXEL_SRC)) {
    if (!win.fbq) installFbq(win)
    injectScript(doc, META_PIXEL_SRC)
    win.fbq!("init", ids.metaPixelId)
    win.fbq!("track", "PageView")
    loaded.push("meta")
  }
  return loaded
}
```

`components/consent/consent-provider.tsx`:

```tsx
"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"

import {
  clearTrackingCookies,
  CONSENT_COOKIE,
  type ConsentChoice,
  consentCookie,
  consentModeUpdate,
  cookieValue,
  readConsent,
  withdrawn,
} from "@/lib/analytics/consent"
import type { AnalyticsWindow } from "@/lib/analytics/events"

/** Server render and hydration: the cookie is not known yet. */
const PENDING = "pending" as const
type ConsentState = ConsentChoice | null | typeof PENDING

type ConsentContextValue = {
  choice: ConsentState
  bannerOpen: boolean
  /** Reopens the banner on its category choices ("Cookie settings"). */
  reopen: () => void
  save: (choice: ConsentChoice) => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext)
  if (!value) throw new Error("useConsent must be used inside <ConsentProvider>")
  return value
}

/** The visitor's choice: read once from the cookie, then kept in memory. */
function createStore() {
  let value: ConsentChoice | null | undefined
  const listeners = new Set<() => void>()
  const publish = (next: ConsentChoice | null) => {
    value = next
    ;(window as AnalyticsWindow).__spConsent = next
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get(): ConsentChoice | null {
      if (value === undefined)
        publish(readConsent(cookieValue(document.cookie, CONSENT_COOKIE), Date.now()))
      return value ?? null
    },
    set(next: ConsentChoice) {
      publish(next)
      for (const listener of listeners) listener()
    },
  }
}

const serverSnapshot = (): ConsentState => PENDING

/**
 * Rendered only when tracking is enabled (components/site-extras.tsx).
 * Stores the choice in the sp_consent cookie for 6 months, mirrors it to
 * Google Consent Mode, and reloads after a withdrawal (running tags cannot
 * be unloaded; their cookies are cleared first).
 */
export function ConsentProvider({
  children,
  reload = () => window.location.reload(),
}: {
  children: ReactNode
  reload?: () => void
}) {
  const [store] = useState(createStore)
  const choice = useSyncExternalStore<ConsentState>(
    store.subscribe,
    store.get,
    serverSnapshot
  )
  const [reopened, setReopened] = useState(false)
  const save = useCallback(
    (next: ConsentChoice) => {
      const previous = store.get()
      document.cookie = consentCookie(
        next,
        Date.now(),
        window.location.protocol === "https:"
      )
      store.set(next)
      ;(window as AnalyticsWindow).gtag?.(
        "consent",
        "update",
        consentModeUpdate(next)
      )
      setReopened(false)
      if (withdrawn(previous, next)) {
        clearTrackingCookies(document, window.location.hostname)
        reload()
      }
    },
    [store, reload]
  )
  const value = useMemo<ConsentContextValue>(
    () => ({
      choice,
      bannerOpen: choice !== PENDING && (choice === null || reopened),
      reopen: () => setReopened(true),
      save,
    }),
    [choice, reopened, save]
  )
  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  )
}
```

`components/consent/consent-banner.tsx`:

```tsx
"use client"

import { useId, useState } from "react"

import { buttonClassName } from "@/components/ui/button"
import type { ConsentChoice } from "@/lib/analytics/consent"
import type { Link } from "@/lib/schemas/common"

import { useConsent } from "./consent-provider"

export type ConsentBannerCopy = {
  title: string
  body: string
  acceptLabel: string
  rejectLabel: string
  customiseLabel: string
  saveLabel: string
  manageLabel: string
  /** Already through linkView (placeholders filled, href re-checked). */
  policyLink: Link
  categories: Record<
    "necessary" | "analytics" | "marketing",
    { label: string; description: string }
  >
}

const OPTIONAL = ["analytics", "marketing"] as const
const NONE: ConsentChoice = { analytics: false, marketing: false }

/**
 * The cookie banner (spec §10): rendered only when tracking is enabled,
 * styled with the site's own tokens and buttons. Accept and Reject carry
 * equal weight; the page stays usable (not modal). After a choice a small
 * "Cookie settings" button lets the visitor change it.
 */
export function ConsentBanner({ copy }: { copy: ConsentBannerCopy }) {
  const { choice, bannerOpen, reopen, save } = useConsent()
  const [customising, setCustomising] = useState(false)
  const [draft, setDraft] = useState<ConsentChoice>(NONE)
  const titleId = useId()
  if (choice === "pending") return null
  if (!bannerOpen)
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(choice ?? NONE)
          setCustomising(true)
          reopen()
        }}
        className={buttonClassName(
          { variant: "brand", size: "pill-sm" },
          "fixed bottom-4 left-4 z-40 shadow-lg"
        )}
      >
        {copy.manageLabel}
      </button>
    )
  const pill = buttonClassName({ variant: "brand", size: "pill-sm" })
  const outline = buttonClassName({ variant: "brand-outline", size: "pill-sm" })
  return (
    <section
      aria-labelledby={titleId}
      data-consent-banner
      className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-5 rounded-2xl bg-brand-navy p-6 text-white shadow-2xl md:p-8">
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-lg font-black md:text-xl">
            {copy.title}
          </h2>
          <p className="text-[15px] leading-[1.6] text-white/85">
            {copy.body}{" "}
            <a
              href={copy.policyLink.href}
              className="font-bold text-brand-green underline underline-offset-4"
            >
              {copy.policyLink.label}
            </a>
          </p>
        </div>
        {customising ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">{copy.customiseLabel}</legend>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-1 size-4 accent-brand-green"
              />
              <span className="flex flex-col">
                <span className="font-bold">
                  {copy.categories.necessary.label}
                </span>
                <span className="text-sm text-white/75">
                  {copy.categories.necessary.description}
                </span>
              </span>
            </label>
            {OPTIONAL.map((key) => (
              <label key={key} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.checked })
                  }
                  className="mt-1 size-4 accent-brand-green"
                />
                <span className="flex flex-col">
                  <span className="font-bold">{copy.categories[key].label}</span>
                  <span className="text-sm text-white/75">
                    {copy.categories[key].description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {customising ? (
            <button type="button" className={pill} onClick={() => save(draft)}>
              {copy.saveLabel}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={pill}
                onClick={() => save({ analytics: true, marketing: true })}
              >
                {copy.acceptLabel}
              </button>
              <button type="button" className={pill} onClick={() => save(NONE)}>
                {copy.rejectLabel}
              </button>
              <button
                type="button"
                className={outline}
                onClick={() => setCustomising(true)}
              >
                {copy.customiseLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
```

`components/consent/tracking-scripts.tsx`:

```tsx
"use client"

import { useEffect } from "react"

import {
  type AnalyticsWindow,
  classifyClick,
  track,
} from "@/lib/analytics/events"
import { startTracking, type TrackingIds } from "@/lib/analytics/loaders"

import { useConsent } from "./consent-provider"

/** Loads the tags the visitor agreed to and reports link clicks (typed events). */
export function TrackingScripts({ ids }: { ids: TrackingIds }) {
  const { choice } = useConsent()
  const { gtmId, ga4Id, metaPixelId } = ids
  useEffect(() => {
    if (choice === "pending" || choice === null) return
    startTracking({ gtmId, ga4Id, metaPixelId }, choice, {
      win: window as AnalyticsWindow,
      doc: document,
    })
  }, [choice, gtmId, ga4Id, metaPixelId])
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null
      const anchor = target?.closest?.("a[href]")
      if (!anchor) return
      const tracked = classifyClick(
        anchor.getAttribute("href") ?? "",
        anchor.textContent ?? ""
      )
      if (tracked) track(tracked)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])
  return null
}
```

`components/consent/custom-code.tsx`:

```tsx
// Owner-only custom code (spec §10). React cannot put raw HTML into
// <head>, so the snippet travels as a JSON string inside one inline
// loader that parses it with Range.createContextualFragment (scripts in
// such a fragment run when inserted) and appends it to <head> or <body>.

/** The loader script; the snippet cannot close it ("<" is escaped). */
export function customCodeScript(html: string, target: "head" | "body") {
  const literal = JSON.stringify(html)
    .replace(/</g, "\\u003c")
    .replace(/ /g, "\\u2028")
    .replace(/ /g, "\\u2029")
  return `(function(){var t=document.${target},r=document.createRange();r.selectNodeContents(t);t.appendChild(r.createContextualFragment(${literal}))})();`
}

export function CustomCode({
  html,
  target,
}: {
  html: string
  target: "head" | "body"
}) {
  if (html.trim() === "") return null
  return (
    <script
      id={`sp-custom-code-${target}`}
      dangerouslySetInnerHTML={{ __html: customCodeScript(html, target) }}
    />
  )
}
```

`templates/shared/consent.ts`:

```ts
import type { ConsentBannerCopy } from "@/components/consent/consent-banner"
import { interpolate } from "@/lib/interpolate"
import type { ConsentSettings } from "@/lib/schemas/settings/consent"

import type { SiteSources } from "./sources"
import { linkView, placeholders } from "./views"

/** Banner copy with {placeholders} filled; the policy link through linkView (ledger ruling). */
export function consentBannerCopy(
  s: SiteSources,
  consent: ConsentSettings
): ConsentBannerCopy {
  const values = placeholders(s)
  const t = (text: string) => interpolate(text, values)
  const category = (c: { label: string; description: string }) => ({
    label: t(c.label),
    description: t(c.description),
  })
  return {
    title: t(consent.title),
    body: t(consent.body),
    acceptLabel: t(consent.acceptLabel),
    rejectLabel: t(consent.rejectLabel),
    customiseLabel: t(consent.customiseLabel),
    saveLabel: t(consent.saveLabel),
    manageLabel: t(consent.manageLabel),
    policyLink: linkView(s, consent.policyLink),
    categories: {
      necessary: category(consent.categories.necessary),
      analytics: category(consent.categories.analytics),
      marketing: category(consent.categories.marketing),
    },
  }
}
```

`server/modules/marketing/public.ts`:

```ts
import "server-only"

import {
  type ConsentSettings,
  consentSettings,
} from "@/lib/schemas/settings/consent"
import {
  type CustomCodeSettings,
  customCodeSettings,
} from "@/lib/schemas/settings/custom-code"
import {
  type TrackingSettings,
  trackingSettings,
} from "@/lib/schemas/settings/tracking"
import { getPublishedSettings } from "@/server/modules/settings/queries"

export type PublicMarketing = {
  tracking: TrackingSettings
  consent: ConsentSettings | null
  customCode: CustomCodeSettings
}

const TRACKING_OFF: TrackingSettings = {
  enabled: false,
  gtmId: null,
  ga4Id: null,
  metaPixelId: null,
}
const NO_CODE: CustomCodeSettings = { headHtml: "", bodyEndHtml: "" }

/**
 * Tracking, consent copy and custom code as the public site uses them:
 * published values only (never drafts, never draft mode); anything that
 * does not validate counts as off/empty.
 */
export async function loadPublicMarketing(): Promise<PublicMarketing> {
  const [tracking, consent, customCode] = await Promise.all([
    getPublishedSettings("tracking"),
    getPublishedSettings("consent"),
    getPublishedSettings("customCode"),
  ])
  const t = trackingSettings.safeParse(tracking)
  const c = consentSettings.safeParse(consent)
  const code = customCodeSettings.safeParse(customCode)
  return {
    tracking: t.success ? t.data : TRACKING_OFF,
    consent: c.success ? c.data : null,
    customCode: code.success ? code.data : NO_CODE,
  }
}
```

`components/site-extras.tsx` (full file):

```tsx
import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { ConsentBanner } from "@/components/consent/consent-banner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import { CustomCode } from "@/components/consent/custom-code"
import { TrackingScripts } from "@/components/consent/tracking-scripts"
import { JsonLd } from "@/components/seo/json-ld"
import { publicOrigin } from "@/server/lib/site-origin"
import { loadPublicMarketing } from "@/server/modules/marketing/public"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { consentBannerCopy } from "@/templates/shared/consent"
import { siteJsonLd } from "@/templates/shared/structured-data"

/**
 * Site-wide additions: the business JSON-LD; the consent banner and
 * consent-gated tags only when tracking is enabled (spec §10 — otherwise
 * nothing visible, so the public design stays pixel-identical); the
 * owner's custom code. On any failure it renders nothing, so a database
 * outage still reaches the page's error.tsx instead of breaking the layout.
 */
export async function SiteExtras() {
  await connection()
  try {
    const [s, marketing] = await Promise.all([
      loadSiteSources(),
      loadPublicMarketing(),
    ])
    const { tracking, consent, customCode } = marketing
    return (
      <>
        <JsonLd
          data={siteJsonLd(s, publicOrigin(s.settings.site.productionUrl))}
        />
        {tracking.enabled && consent ? (
          <ConsentProvider>
            <ConsentBanner copy={consentBannerCopy(s, consent)} />
            <TrackingScripts
              ids={{
                gtmId: tracking.gtmId,
                ga4Id: tracking.ga4Id,
                metaPixelId: tracking.metaPixelId,
              }}
            />
          </ConsentProvider>
        ) : null}
        <CustomCode html={customCode.headHtml} target="head" />
        <CustomCode html={customCode.bodyEndHtml} target="body" />
      </>
    )
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}
```

`components/home/contact-form.tsx` (Phase 7) — `import { track } from "@/lib/analytics/events"` and in `handleSubmit`, directly after `form.reset()` in the `res.ok` branch:

```ts
        // Typed event; sent only if the visitor consented (lib/analytics).
        track({ event: "lead_submitted", source_page: window.location.pathname })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/analytics && pnpm exec vitest run --project dom tests/dom/analytics-loaders.test.tsx tests/dom/consent-banner.test.tsx tests/dom/custom-code.test.tsx tests/dom/contact-form.test.tsx`
Expected: PASS (consent 6, events 4, loaders 3, banner 5, custom code 2; the Phase 7 contact-form DOM test unchanged — `track` is a no-op without consent).

Run: `pnpm db:migrate && pnpm test:integration tests/integration/db/consent-migration.test.ts tests/integration/marketing/public.test.ts tests/integration/seed/seed.test.ts`
Expected: PASS.

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` then `pnpm test:visual`
Expected: clean build; **visual 0 px on every public baseline** (seeded tracking is off: no banner, no scripts; custom code is empty).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write lib/analytics components/consent components/site-extras.tsx templates/shared/consent.ts server/modules/marketing/public.ts lib/schemas/settings/consent.ts server/db/seed/fixtures/settings.ts components/admin/seo/growth-meta.ts components/home/contact-form.tsx tests/unit/analytics tests/dom/analytics-loaders.test.tsx tests/dom/consent-banner.test.tsx tests/dom/custom-code.test.tsx tests/integration/db/consent-migration.test.ts tests/integration/marketing/public.test.ts
git add lib/analytics components/consent components/site-extras.tsx templates/shared/consent.ts server/modules/marketing/public.ts lib/schemas/settings/consent.ts server/db/seed/fixtures/settings.ts server/db/migrations components/admin/seo/growth-meta.ts components/home/contact-form.tsx tests/unit/analytics tests/dom/analytics-loaders.test.tsx tests/dom/consent-banner.test.tsx tests/dom/custom-code.test.tsx tests/integration/db/consent-migration.test.ts tests/integration/marketing/public.test.ts
git commit -m "$(cat <<'EOF'
feat(marketing): consent banner, consent-gated tags and custom code

The banner renders only when tracking is enabled, in the site's tokens
and buttons; GTM/GA4 load after analytics consent and the Meta pixel
after marketing consent, with Consent Mode defaults first. The choice is
kept 6 months; withdrawing clears tracking cookies. Typed dataLayer
events (lead_submitted, cta_click, phone_click, email_click). The owner's
custom code is injected from published settings only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Admin — Marketing screens (tracking, consent banner, custom code) + runbook CSP notes (master Task 8.3, part 2)

**Files:**
- Create: `components/admin/marketing/notices.tsx`, `app/(admin)/admin/(panel)/marketing/{layout.tsx,page.tsx}`, `app/(admin)/admin/(panel)/marketing/tracking/page.tsx`, `app/(admin)/admin/(panel)/marketing/consent/page.tsx`, `app/(admin)/admin/(panel)/marketing/custom-code/page.tsx`, `docs/runbook.md` (create, or add the section if Phase 10 already created it)
- Test: `tests/dom/marketing-notices.test.tsx`, `tests/e2e/consent.spec.ts`

**Interfaces:**
- Consumes: Task 7 `/marketing/:key`, `GROWTH_SETTINGS`; Task 8 `GrowthSettingsEditor`, `NavChildTabs`; Task 10 public behaviour; `components/ui/alert.tsx` (`Alert`, `AlertTitle`, `AlertDescription`), kit `DashboardCard`; `@axe-core/playwright` (04b Task 12).
- Produces: routes `/admin/marketing` (→ Tracking), `/admin/marketing/tracking` (marketing:read), `/admin/marketing/consent` (marketing:read), `/admin/marketing/custom-code` (customCode:read — owner); `TrackingNotice()`, `CustomCodeNotice()`.

- [ ] **Step 1: Write the failing tests**

`tests/dom/marketing-notices.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  CustomCodeNotice,
  TrackingNotice,
} from "@/components/admin/marketing/notices"

describe("marketing screen notices", () => {
  it("tracking: what loads after which consent, and the events sent", () => {
    render(<TrackingNotice />)
    const card = screen.getByRole("region", { name: "What loads when" })
    expect(card).toHaveTextContent("Analytics consent")
    expect(card).toHaveTextContent("Google Tag Manager and Google Analytics 4")
    expect(card).toHaveTextContent("Marketing consent")
    expect(card).toHaveTextContent("Meta Pixel")
    expect(card).toHaveTextContent("lead_submitted")
  })

  it("custom code: warns about trust, DNS verification and CSP", () => {
    render(<CustomCodeNotice />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("every public page")
    expect(alert).toHaveTextContent("DNS")
    expect(alert).toHaveTextContent("Content-Security-Policy")
  })
})
```

`tests/e2e/consent.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Master 8.3: no banner/scripts while tracking is off; with tracking on the
// banner gates GTM, GA4 and the Meta pixel; consent cookie 6 months;
// custom code owner-only. Trackers are stubbed (no network to Google/Meta).

const SAME_ORIGIN = { origin: BASE_URL }
const TRACKER = /googletagmanager\.com|connect\.facebook\.net/

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
  await page.waitForURL((url) => url.pathname === "/admin")
}

async function publishSetting(
  page: Page,
  key: string,
  change: (draft: Record<string, unknown>) => Record<string, unknown>
) {
  const dto = (await (
    await page.request.get(`/api/v1/admin/marketing/${key}`)
  ).json()) as { draft: Record<string, unknown>; version: number }
  const saved = await page.request.put(`/api/v1/admin/marketing/${key}/draft`, {
    headers: SAME_ORIGIN,
    data: { draft: change(dto.draft), version: dto.version },
  })
  expect(saved.status()).toBe(200)
  const { version } = (await saved.json()) as { version: number }
  const published = await page.request.post(
    `/api/v1/admin/marketing/${key}/publish`,
    { headers: SAME_ORIGIN, data: { version } }
  )
  expect(published.status()).toBe(200)
}

async function stubTrackers(page: Page): Promise<string[]> {
  const requested: string[] = []
  await page.route(TRACKER, (route) => {
    requested.push(route.request().url())
    return route.fulfill({ contentType: "text/javascript", body: "" })
  })
  return requested
}

test.describe.serial("consent and tracking (master 8.3)", () => {
  test("tracking off: no banner, no reopen button, no tracker requests", async ({
    page,
  }) => {
    const requested = await stubTrackers(page)
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await expect(page.locator("[data-consent-banner]")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Cookie settings" })).toHaveCount(0)
    expect(requested).toEqual([])
  })

  test("tracking on: the banner gates GTM, GA4 and the Meta pixel", async ({
    page,
    browser,
  }) => {
    await signIn(page, readFixtures().owner.email)
    await page.goto("/admin/marketing/tracking")
    await expect(
      page.getByRole("heading", { level: 1, name: "Tracking" })
    ).toBeVisible()
    await expect(page.getByLabel(/^Google Tag Manager ID/)).toBeVisible()
    await publishSetting(page, "tracking", (d) => ({
      ...d,
      enabled: true,
      gtmId: "GTM-E2ETEST",
      ga4Id: "G-E2ETEST1",
      metaPixelId: "1234567890",
    }))
    try {
      const visitor = await browser.newContext()
      const site = await visitor.newPage()
      const requested = await stubTrackers(site)
      await site.goto("/")
      const banner = site.locator("[data-consent-banner]")
      await expect(banner).toBeVisible()
      await expect(banner.getByRole("heading", { name: "We use cookies" })).toBeVisible()
      await expect(
        banner.getByRole("link", { name: "Privacy Policy" })
      ).toHaveAttribute("href", "/privacy")
      const axe = await new AxeBuilder({ page: site })
        .include("[data-consent-banner]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(axe.violations.map((v) => v.id)).toEqual([])
      await site.waitForLoadState("networkidle")
      expect(requested).toEqual([])

      await banner.getByRole("button", { name: "Accept all" }).click()
      await expect(banner).toBeHidden()
      await expect
        .poll(() => requested.map((u) => new URL(u).pathname).sort())
        .toEqual(["/en_US/fbevents.js", "/gtag/js", "/gtm.js"])
      const cookie = (await visitor.cookies()).find((c) => c.name === "sp_consent")!
      expect(cookie.value).toMatch(/^1\.1\.1\.\d+$/)
      const days = (cookie.expires * 1000 - Date.now()) / 86_400_000
      expect(days).toBeGreaterThan(179)
      expect(days).toBeLessThanOrEqual(180)

      requested.length = 0
      await site.reload()
      await expect(site.locator("[data-consent-banner]")).toHaveCount(0)
      await expect(site.getByRole("button", { name: "Cookie settings" })).toBeVisible()
      await expect.poll(() => requested.length).toBeGreaterThan(0)
      await visitor.close()

      const other = await browser.newContext()
      const page2 = await other.newPage()
      const none = await stubTrackers(page2)
      await page2.goto("/")
      await page2
        .locator("[data-consent-banner]")
        .getByRole("button", { name: "Reject non-essential" })
        .click()
      await page2.waitForLoadState("networkidle")
      expect(none).toEqual([])
      expect(
        (await other.cookies()).find((c) => c.name === "sp_consent")?.value
      ).toMatch(/^1\.0\.0\./)
      await other.close()
    } finally {
      await publishSetting(page, "tracking", (d) => ({
        ...d,
        enabled: false,
        gtmId: null,
        ga4Id: null,
        metaPixelId: null,
      }))
    }
  })

  test("custom code: admins cannot see or change it", async ({ page }) => {
    await signIn(page, readFixtures().admin.email)
    expect(
      (await page.request.get("/api/v1/admin/marketing/customCode")).status()
    ).toBe(403)
    await page.goto("/admin/marketing/tracking")
    await expect(
      page.getByRole("navigation", { name: "Marketing" })
    ).not.toContainText("Custom code")
  })

  test("custom code: the owner's snippets run on public pages", async ({
    page,
    browser,
  }) => {
    await signIn(page, readFixtures().owner.email)
    await page.goto("/admin/marketing/custom-code")
    await expect(
      page.getByRole("heading", { level: 1, name: "Custom code" })
    ).toBeVisible()
    await publishSetting(page, "customCode", () => ({
      headHtml:
        '<meta name="sp-e2e" content="head"><script>window.__spHead = 1</script>',
      bodyEndHtml: "<script>window.__spBody = 2</script>",
    }))
    try {
      const visitor = await browser.newContext()
      const site = await visitor.newPage()
      await site.goto("/about")
      await expect
        .poll(() =>
          site.evaluate(() => {
            const w = window as unknown as Record<string, unknown>
            return [w.__spHead, w.__spBody]
          })
        )
        .toEqual([1, 2])
      await expect(site.locator('head meta[name="sp-e2e"]')).toHaveCount(1)
      await visitor.close()
    } finally {
      await publishSetting(page, "customCode", () => ({
        headHtml: "",
        bodyEndHtml: "",
      }))
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/marketing-notices.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/marketing/notices"`.

- [ ] **Step 3: Implement**

`components/admin/marketing/notices.tsx`:

```tsx
"use client"

import { DashboardCard } from "@/components/admin/kit/dashboard-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ANALYTICS_EVENTS } from "@/lib/analytics/events"

/** Side card on Marketing › Tracking: the consent rules the site follows. */
export function TrackingNotice() {
  return (
    <DashboardCard title="What loads when" headingLevel={2}>
      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="font-semibold">Before a choice, or after Reject</dt>
          <dd className="text-muted-foreground">Nothing is loaded.</dd>
        </div>
        <div>
          <dt className="font-semibold">Analytics consent</dt>
          <dd className="text-muted-foreground">
            Google Tag Manager and Google Analytics 4 (with Consent Mode).
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Marketing consent</dt>
          <dd className="text-muted-foreground">Meta Pixel.</dd>
        </div>
        <div>
          <dt className="font-semibold">Events sent to the data layer</dt>
          <dd className="font-mono text-xs text-muted-foreground">
            {ANALYTICS_EVENTS.join(", ")}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        Visitors keep their choice for 6 months and can change it with the
        “Cookie settings” button.
      </p>
    </DashboardCard>
  )
}

/** Warning on Marketing › Custom code (owner only). */
export function CustomCodeNotice() {
  return (
    <Alert role="alert">
      <AlertTitle>Code here runs on every public page</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>
          It has full access to every visitor&apos;s page. Paste only code from
          vendors you trust, and remove it when you stop using the service.
        </span>
        <span>
          It is added after the page loads, so verify domains (Google, Meta …)
          by DNS rather than with a meta tag.
        </span>
        <span>
          Tracking tags that need consent belong under Tracking, not here. If a
          Content-Security-Policy is added to the site, its script, connect
          and image sources must allow the hosts used here (see the runbook).
        </span>
      </AlertDescription>
    </Alert>
  )
}
```

`app/(admin)/admin/(panel)/marketing/layout.tsx`:

```tsx
import { NavChildTabs } from "@/components/admin/shell/nav-child-tabs"

/** Marketing › Tracking · Consent banner · Custom code as route tabs. */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <NavChildTabs section="Marketing">{children}</NavChildTabs>
}
```

`app/(admin)/admin/(panel)/marketing/page.tsx`:

```tsx
import { redirect } from "next/navigation"

/** Everyone who can open Marketing can read Tracking (its first tab). */
export default function MarketingPage() {
  redirect("/admin/marketing/tracking")
}
```

`app/(admin)/admin/(panel)/marketing/tracking/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { TrackingNotice } from "@/components/admin/marketing/notices"
import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Tracking" }

export default function TrackingPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePermission(GROWTH_SETTINGS.tracking.read)
  return (
    <GrowthSettingsEditor
      settingsKey="tracking"
      backHref="/admin"
      backLabel="Dashboard"
      aside={<TrackingNotice />}
    />
  )
}
```

`app/(admin)/admin/(panel)/marketing/consent/page.tsx` — same as the tracking page with: `metadata.title` "Consent banner", function names `ConsentPage`, `settingsKey="consent"`, `requirePermission(GROWTH_SETTINGS.consent.read)`, `backHref="/admin/marketing/tracking"`, `backLabel="Tracking"`, no `aside`.

`app/(admin)/admin/(panel)/marketing/custom-code/page.tsx` — same as the tracking page with: `metadata.title` "Custom code", function name `CustomCodePage`, `settingsKey="customCode"`, `requirePermission(GROWTH_SETTINGS.customCode.read)` (owner only; others get the admin `forbidden.tsx`), `backHref="/admin/marketing/tracking"`, `backLabel="Tracking"`, `aside={<CustomCodeNotice />}` (import `CustomCodeNotice`).

`docs/runbook.md` — create the file if it does not exist (`# Runbook` heading, then this section); otherwise add the section:

```markdown
## Custom code and Content-Security-Policy

Marketing › Custom code (owner only) adds the published `settings.customCode`
snippets to every public page. Each snippet is sent as one inline loader
`<script id="sp-custom-code-head|body">` that parses the HTML and appends it
to `<head>` / the end of `<body>` after the page loads, so its scripts run
once per page load. Drafts never run on the site; publishing applies at once.

- Only paste code from vendors you trust: it runs with full access to every
  visitor's page and is not covered by the cookie banner. Consent-dependent
  tags (Google, Meta) belong under Marketing › Tracking.
- Verify domains by DNS (Google Search Console, Meta Business), not with a
  `<meta>` tag: the tag only exists after JavaScript runs.
- The site sends no Content-Security-Policy today. If one is added later, it
  must allow:
  - `script-src`: the inline loaders (a per-request nonce on
    `#sp-custom-code-*`, or `'unsafe-inline'`), Next's own scripts, and the
    hosts the snippets load from; for Tracking also
    `https://www.googletagmanager.com` and `https://connect.facebook.net`.
  - `connect-src` / `img-src`: `https://*.google-analytics.com`,
    `https://*.analytics.google.com`, `https://www.googletagmanager.com`,
    `https://www.facebook.com` (pixel beacons), plus any snippet endpoints.
  - `frame-src`: whatever the snippets embed.
- To remove everything quickly: clear both fields and publish (no deploy).
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/marketing-notices.test.tsx && pnpm test:unit tests/unit/admin/nav.test.ts`
Expected: PASS.

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: clean.

Run: `pnpm test:e2e tests/e2e/consent.spec.ts tests/e2e/leads.spec.ts`
Expected: consent 4 passed (tracking and custom code are reset in `finally`); the Phase 7 leads spec unchanged.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/marketing "app/(admin)/admin/(panel)/marketing" tests/dom/marketing-notices.test.tsx tests/e2e/consent.spec.ts
git add components/admin/marketing "app/(admin)/admin/(panel)/marketing" docs/runbook.md tests/dom/marketing-notices.test.tsx tests/e2e/consent.spec.ts
git commit -m "$(cat <<'EOF'
feat(admin): marketing screens for tracking, consent banner and custom code

Route tabs under Marketing with the versioned editor; custom code is
owner-only with a trust/DNS/CSP warning; the runbook documents the
custom-code loader and the CSP sources a future policy must allow.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Phase gate — Lighthouse SEO 100, admin baselines, accessibility URLs (master Tasks 8.1–8.3 acceptance)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (`lighthouse@13.5.0`, `chrome-launcher@1.2.2`, dev, exact), `tests/visual/admin-screens.spec.ts` (three screens), `tests/e2e/admin-a11y.spec.ts` (`PANEL` URLs)
- Create: `tests/e2e/lighthouse-seo.spec.ts`; re-captured baselines `tests/visual/__screenshots__/admin-shell-*`, `admin-dashboard-*`, new `admin-seo-*`, `admin-redirects-*`, `admin-tracking-*`

**Interfaces:**
- Consumes: everything above; `chromium.executablePath()` (Playwright 1.64); Lighthouse node API `lighthouse(url, flags) → RunnerResult` (`lhr.categories.seo.score`, `lhr.audits`).
- Produces: the phase's acceptance evidence: Lighthouse SEO = 1.0 on `/`; admin screens in light/dark baselines; axe clean on the new admin URLs.

- [ ] **Step 1: Add the Lighthouse dependencies**

Run: `pnpm add -D --save-exact lighthouse@13.5.0 chrome-launcher@1.2.2`
Expected: only `package.json` and `pnpm-lock.yaml` change (Node ≥ 22.19 required by lighthouse — the repo runs 22.19).

- [ ] **Step 2: Write the Lighthouse gate**

`tests/e2e/lighthouse-seo.spec.ts`:

```ts
import { chromium, expect, test } from "@playwright/test"

import { BASE_URL } from "./env"

// Master 8.1 acceptance: Lighthouse SEO 100 on the home page. Lighthouse
// drives Playwright's Chromium through chrome-launcher.

test("Lighthouse SEO score is 100 on the home page", async () => {
  test.setTimeout(180_000)
  const { default: lighthouse } = await import("lighthouse")
  const chromeLauncher = await import("chrome-launcher")
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox"],
  })
  try {
    const result = await lighthouse(`${BASE_URL}/`, {
      port: chrome.port,
      onlyCategories: ["seo"],
      output: "json",
      logLevel: "error",
    })
    const lhr = result!.lhr
    const weighted = new Set(
      lhr.categories.seo.auditRefs
        .filter((ref) => ref.weight > 0)
        .map((ref) => ref.id)
    )
    const failing = Object.values(lhr.audits)
      .filter((a) => weighted.has(a.id) && a.score !== null && a.score < 1)
      .map((a) => `${a.id}: ${a.title}`)
    expect(failing).toEqual([])
    expect(lhr.categories.seo.score).toBe(1)
  } finally {
    await chrome.kill()
  }
})
```

- [ ] **Step 3: Add the admin screens to the visual and axe suites**

`tests/visual/admin-screens.spec.ts` — inside the `for (const colorScheme …)` describe, after "admin settings", add:

```ts
    test(`admin seo ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/seo")
      await expect(page.getByRole("heading", { level: 1, name: "SEO" })).toBeVisible()
      await expect(page.getByRole("region", { name: "Pages and posts" })).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-seo-${colorScheme}.png`, {
        mask: masks(page),
      })
    })

    test(`admin redirects ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/seo/redirects")
      await expect(
        page.getByRole("heading", { level: 1, name: "Redirects" })
      ).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-redirects-${colorScheme}.png`, {
        mask: masks(page),
      })
    })

    test(`admin tracking ${colorScheme}`, async ({ page }) => {
      await signIn(page)
      await page.goto("/admin/marketing/tracking")
      await expect(
        page.getByRole("heading", { level: 1, name: "Tracking" })
      ).toBeVisible()
      await expect(page.getByRole("status", { name: /^Save status/ })).toBeVisible()
      await expect(page).toHaveScreenshot(`admin-tracking-${colorScheme}.png`, {
        mask: masks(page),
      })
    })
```

`tests/e2e/admin-a11y.spec.ts` — append to `PANEL`: `"/admin/seo"`, `"/admin/seo?edit=page:home"`, `"/admin/seo/defaults"`, `"/admin/seo/redirects"`, `"/admin/marketing/tracking"`, `"/admin/marketing/consent"`, and — only if that spec signs in as an **owner** — `"/admin/marketing/custom-code"`.

- [ ] **Step 4: Re-capture the admin baselines, then run the whole gate**

```bash
pnpm exec playwright test tests/visual/admin-shell.spec.ts tests/visual/admin-screens.spec.ts --update-snapshots
git status --short tests/visual/__screenshots__
```

Expected: only `admin-*` PNGs change or appear (the sidebar gains the Growth section; the dashboard gains Content health; new `admin-seo-*`, `admin-redirects-*`, `admin-tracking-*` in light/dark × desktop/mobile). **No public baseline may change** — if one does, stop and report. Look at the new SEO, redirects and tracking screenshots (light and dark) before committing.

Run: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: all green.

Run: `pnpm test:visual`
Expected: every public baseline 0 px; admin baselines pass.

Run: `pnpm test:e2e`
Expected: all specs pass, including `lighthouse-seo.spec.ts` (SEO score 1, no failing weighted audit), `seo.spec.ts`, `seo-admin.spec.ts`, `consent.spec.ts`, `public-site.spec.ts` (real 404s) and `admin-a11y.spec.ts` with the new URLs.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write tests/e2e/lighthouse-seo.spec.ts tests/visual/admin-screens.spec.ts tests/e2e/admin-a11y.spec.ts
git add package.json pnpm-lock.yaml tests/e2e/lighthouse-seo.spec.ts tests/visual/admin-screens.spec.ts tests/e2e/admin-a11y.spec.ts tests/visual/__screenshots__
git commit -m "$(cat <<'EOF'
test(seo): Lighthouse SEO gate, admin baselines and axe for phase 8

Lighthouse SEO must score 100 on the home page; SEO, redirects and
tracking screens join the light/dark admin baselines and the axe gate;
shell and dashboard baselines re-captured for the Growth section and
the Content health gauge.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review against the master plan and the ledger

- **Master 8.1** (each public URL has title/description/canonical/OG → Task 1 unit + E2E; JSON-LD validates with schema-dts types → Task 2 (typecheck + unit + E2E parse); Lighthouse SEO 100 on home → Task 12; `lib/seo/*`, `generateMetadata`, OG images, `components/seo/json-ld.tsx`, `/admin/seo/**` → Tasks 1–3, 7, 8). ✔
- **Master 8.2** (sitemap lists published pages/services/articles with lastmod → Task 6; robots disallows `/admin`, `/api` → Task 6; redirect 301 works and increments hits → Tasks 5, 9 (E2E); loop a→b→a rejected 422 → Task 4; admin redirects screen → Task 9). ✔
- **Master 8.3** (tracking disabled → no banner, no scripts, visual 0 → Tasks 10 (visual gate), 11 (E2E); enabled → banner in site tokens, scripts only after matching consent → Tasks 10 (DOM/loader tests), 11 (E2E with stubbed trackers + axe); consent cookie 6 months → Tasks 10, 11; custom code owner-only (admin → 403) → Tasks 7 (API), 11 (E2E)). ✔
- **Ledger rulings:** real 404 (Task 5, E2E `public-site.spec.ts`); redirects before the 404 + auto 301 + loops + hits + href guard (Tasks 4–5); blocking metadata in `<head>` and 404 description (Task 1 E2E); published-only/draft-guarded readers (Tasks 3, 6, 10; metadata/JSON-LD via `loadSiteSources`); banner only when enabled, site tokens, consent-gated GTM/GA4/Meta, typed events, `linkView` policy link, custom code owner-only + CSP notes (Tasks 10–11); revisions allow-list per key incl. `customCode` owner-only (Task 7). ✔
- **04b patterns:** Growth section with SEO/Marketing route tabs (Task 8 nav + `NavChildTabs`), kit-built screens, Sheet for in-place records (SEO sheet), JW gauge ported into the kit with tests and the dashboard "Content health" card (closes D7), per-screen DOM tests + light/dark baselines + axe URLs (Tasks 8, 9, 11, 12). ✔
