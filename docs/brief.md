# Security Partners — Project Brief

Living brief for converting the static Security Partners Ltd site into a database-driven site with an admin panel. Source of truth for design decisions: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (the spec). Execution: `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (the master plan). This file is never edited silently: every change after Phase 0 is appended under **Changes** with a date.

---

## 1. Requirements

From the owner (spec §1.1):

- Make the existing site dynamic with a "perfect" admin panel, following the starter prompt.
- One spec covering all phases (not decomposed into sub-projects).
- **The public frontend design is fixed. Nothing is removed and nothing new is added to it. Only what exists today becomes dynamic.**
- Public pages are **fixed templates**: layout and section order are code; admin edits the fields.
- Email via **SMTP**, media via **Cloudflare R2**. All integration credentials are managed **from the admin panel**, not env.
- Env holds only database and Better Auth values: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
- Tracking is allowed behind a **conditional** consent banner (shown only when tracking is enabled).

## 2. Decisions taken on the owner's behalf

From spec §1.3.

| # | Decision |
|---|---|
| D1 | Approach A: Hono + Better Auth + Drizzle/Postgres + shadcn admin inside this Next app (not Payload, not Server-Actions-only). (confirm or correct) |
| D2 | Seven default roles from the prompt (owner, admin, editor, author, marketer, intake, viewer). Editor may publish articles. (confirm or correct) |
| D3 | Postgres 17 runs as a separate Dokploy service; app connects via `DATABASE_URL`. (confirm or correct) |
| D4 | Turnstile is optional, invisible mode only (no visible widget), configured in Settings. (confirm or correct) |
| D5 | AI assistant uses the AI SDK with provider/model/key chosen in Settings; off until configured. (confirm or correct) |
| D6 | Lead retention default 24 months, editable in Settings. (confirm or correct) |
| D7 | Site timezone `Europe/Dublin`, locale `en-IE`, stored in `settings.site` but defaulted in code. (confirm or correct) |
| D8 | Cookie prefix `sp`. (confirm or correct) |
| D9 | Uploads fall back to local disk at `/data/uploads` (Dokploy volume) until R2 is configured; backups fall back to the same volume. (confirm or correct) |
| D10 | Shared sections that appear on several pages (Enquire banner, Clients strip, Why Choose Us) are edited once as globals, not per page. (confirm or correct) |

## 3. Deviations from the starter prompt

From spec §1.4.

| Prompt says | This project | Why |
|---|---|---|
| Block-based page builder (`blocks/`) | Fixed templates (`templates/`) | Owner: design is fixed. |
| Section show/hide, new pages | None, except two `legal` pages | Owner: nothing removed or added. Privacy/Terms links already exist in the footer (`href="#"`). |
| Theme engine (Appearance) | Removed | Design tokens stay in code. |
| Newsletter module | Removed | No subscribe UI exists on the site. |
| `APP_ENCRYPTION_KEY`, `CRON_SECRET`, provider env vars | Not used | Owner: env = DB + Better Auth only. Key derived via HKDF; integrations in DB; cron in-process. |
| `SITE_ENV` env var | Derived | `production` when `BETTER_AUTH_URL` origin equals `settings.site.productionUrl`; `development` when `NODE_ENV !== "production"`; else `staging`. |

## 4. Open questions (with defaults)

Work proceeds on the default until the owner answers.

| Question | Default |
|---|---|
| Final privacy and terms copy | Placeholder legal text, marked for owner review. |
| Lead notification recipients | `info@securitypartnersltd.com` |
| OG image style | Generated from brand. |
| AI provider | None until configured. |

## 5. Success criteria

From spec §1.2.

1. Every public page renders entirely from the database, and is **pixel-identical** to the current site after seeding (Playwright visual diff against Phase 0 baselines, threshold 0 on desktop 1440 and mobile 390; animations disabled during capture).
2. Every user-visible string, image, link, phone, email and list on the public site is editable in the admin; a publish shows on the site immediately (tag revalidation).
3. Every role signs in and sees exactly what the role matrix allows (E2E per role).
4. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass; `next build` succeeds with no env vars set.
5. Fresh clone works with: `docker compose -f docker-compose.dev.yml up -d && pnpm db:migrate && pnpm db:seed && pnpm demo:seed && pnpm dev`.
6. Production bootstraps with only: 3 env vars set, deploy, `admin:create` inside the container; SMTP/R2/etc. then configured from Settings ▸ Integrations.

## 6. Target architecture

From spec §3.

```
app/(site)/**            public site, own root layout; RSC calling server/modules/*/queries
app/(admin)/admin/**     admin, own root layout
  (auth)/                sign-in, two-factor, set-password, reset-password
  (panel)/               guarded shell (requireActor in layout)
app/api/[...route]/      Hono, basePath("/api")
proxy.ts                 /admin cookie-presence gate (no DB) + X-Robots-Tag: noindex on /admin and /api
instrumentation.ts       registers in-process scheduler (Node runtime only)
server/                  every file starts with import "server-only"
  env.ts                 Zod-validated env (3 vars), lazy, never read at build
  api/app.ts             middleware order + route mounting
  auth/                  getAuth() lazy+memoised, session DAL (requireActor, requirePermission), hooks
  db/                    client, schema/, migrations/, migrate.ts, seed/ (fixtures from current data.ts)
  lib/                   crypto, mailer, storage, rate-limit, audit, cache-tags, scheduler, settings
  modules/<domain>/      routes.ts → service.ts → repo.ts (+ queries.ts public reads, schema.ts)
lib/                     isomorphic: auth/permissions.ts, zod schemas, utils (never imports server/)
templates/<name>/        schema.ts (Zod fields) · render.tsx (existing components fed by props) · editor-meta.ts (widget hints)
emails/                  React Email templates
scripts/                 migrate, seed, admin-create, owner-recover, demo-seed, secrets-rotate, db-sync, backup, restore-drill
tests/{unit,integration,e2e}
```

Rules (ESLint `no-restricted-imports` + review): `app/**` files are thin and public rendering calls `queries` directly; Hono handlers only validate → authorise → call a service; services hold business logic, audit, revisions and cache invalidation; repos are the only files with Drizzle queries; no DB access at build time; `lib/` and `templates/*/schema.ts` never import `server/`.

## 7. Content model summary

From spec §5.

**Versioning** (pages, services, articles, settings): `draft`, `published`, `version` (optimistic concurrency, stale → 409), `status` (`draft | in_review | scheduled | published`; only articles use all four), `scheduledAt`, `publishedAt`, `updatedBy`, `updatedAt`. Publish copies draft → published, bumps version, writes a `revisions` row, revalidates tags and audits. Small collections (team, clients, group companies, categories) publish immediately but still write revisions and audit entries.

### 7.1 Pages (fixed templates)

| key | template | URL | Fields (each section maps to an existing component) |
|---|---|---|---|
| `home` | home | `/` | hero (eyebrow, heading, subheading, background image, CTAs) · about intro (heading, copy, image, highlights[]) · services section (eyebrow, heading, intro, count shown) · team section (heading, intro) · blog section (heading, intro, count shown) · contact section copy |
| `about` | about | `/about` | page hero (eyebrow, title, subtitle, image) · about body · stats[] (value, label, description) · values section (eyebrow, title, items[] title/description/icon) |
| `services` | services | `/services` | page hero · services section heading/intro |
| `team` | team | `/team` | page hero · leadership heading/intro · officers section (eyebrow, title, qualities[] title/description/icon) |
| `blog` | blog | `/blog` | page hero · featured article (article picker) |
| `contact` | contact | `/contact` | page hero · departments[] (name, email, phone) · map (embed query, link) |
| `privacy` | legal | `/privacy` | page hero · body (rich text) — renders with existing `PageHero` + article body styles |
| `terms` | legal | `/terms` | same as privacy |

The field inventory (section 14) is the exhaustive list and wins where it differs from this outline.

### 7.2 Collections

| Table | Fields | Versioning |
|---|---|---|
| `services` | slug, title, description, icon (media), detail: intro, heading, overview, included[], callout · sortOrder · seo | draft/publish |
| `articles` | slug, title, excerpt, categoryId, cover (media), authorId (users), lead, tags[], body (TipTap JSON), readTimeMinutes (computed), sortOrder n/a (date ordered), seo | full workflow |
| `article_categories` | slug, name, sortOrder | immediate |
| `team_members` | name, role, bio, email, photo (media, optional), sortOrder | immediate |
| `clients` | name, logo (media), url (optional), sortOrder | immediate |
| `group_companies` | name, phone, site, logo (media), sortOrder | immediate |

Additions from the field inventory (see Changes): `article_categories.showInFilter` (boolean; drives the blog filter bar and the article sidebar Categories nav) and `users.title` (author role shown in article bylines, e.g. "Managing Director").

### 7.3 Globals (`settings` table)

| Key | Contents |
|---|---|
| `site` | name, legal name, logo, logo-on-dark, favicon, productionUrl, timezone, locale, copyright line |
| `contact` | phone24h, office, operationsMobile, email, operationsEmail, hours, address lines, mapsHref (tel/mailto hrefs derived) |
| `navigation` | header links[] (label, href), header CTA |
| `footer` | columns/links as currently designed, legal links (privacy, terms) |
| `sections.enquireBanner` | heading, copy, CTA, image |
| `sections.clients` | heading/eyebrow for the clients strip |
| `sections.whyChooseUs` | heading, features[] (title, description, icon) |
| `sections.about` | About section shared by `/` and `/about`: eyebrow, heading, body (rich text), image + alt, badge (value, label, caption), highlights[] — added by ruling, see Changes |
| `sections.contact` | Contact section shared by `/` and `/contact`: eyebrow, heading, intro, infoItems[] (title, icon, lines[] text/href), form copy (labels, placeholders, submit), map (link, label, aria label, tiles) — added by ruling, see Changes |
| `seo.defaults` | title template, default description, default OG image, organisation JSON-LD |
| `consent` | banner copy, categories, policy link |
| `tracking` | enabled, GTM id, GA4 id, Meta pixel id |
| `customCode` | head html, body-end html (owner only) |
| `microcopy` | form labels, success/error messages, button labels, aria labels |
| `leads` | notification recipients[], retention months, acknowledgement on/off |
| `integrations.smtp` | host, port, secure, user, **password**, from name, from address |
| `integrations.r2` | accountId, bucket, **accessKeyId**, **secretAccessKey**, public base URL |
| `integrations.turnstile` | enabled, siteKey, **secretKey** |
| `integrations.ai` | provider, model, **apiKey**, allowed roles[] |

Bold = encrypted field. Integration keys are not draft-versioned and each has a "Test connection" action.

### 7.4 Other tables

`users`, `sessions`, `accounts`, `verifications`, `two_factors`, `rate_limits` (Better Auth) · `media` · `media_usages` · `revisions` · `audit_log` · `leads` · `lead_events` · `redirects` · `ai_conversations`, `ai_messages` · `jobs`.

## 8. Role matrix

From spec §6.1. Resources: `page, service, article, collection, media, lead, seo, redirect, marketing, customCode, settings, integration, user, owner, audit, ai`.

| Role | Grants |
|---|---|
| owner | all actions on all resources |
| admin | all except `customCode:*`, `owner:*` |
| editor | `page, service, collection, media, seo`: read/create/update/publish/delete · `article`: all incl. publish, any author · `settings`: read/update for content keys (site, contact, navigation, footer, sections.*, microcopy) |
| author | `article`: read all, create, update/delete own while not published, `submit` own · `media`: read/create |
| marketer | `seo, redirect, marketing`: all · `page, service, article`: read · `media`: read/create |
| intake | `lead`: read/update/export |
| viewer | read on everything except `lead`, `integration`, `audit`, `customCode`, `user` |

Multi-role users get the union.

## 9. API route map

From spec §7.

Mount order in `server/api/app.ts`:

1. Global: `requestId` · `secureHeaders` · error envelope · `notFound`
2. `/api/auth/*` → Better Auth handler
3. `/api/v1/public/*` → rate limit (DB-backed), 64 KB body
4. `/api/v1/admin/*` → session → signedIn → sameOrigin (unsafe methods) → 1 MB body (uploads route: 20 MB)
5. `/api/v1/health` (readiness, checks DB) · `/api/v1/health/live` (liveness, no DB)

Admin routes: `pages`, `services`, `articles` (+ `/submit`, `/publish`, `/schedule`, `/unpublish`), `categories`, `team`, `clients`, `group-companies`, `revisions/:entity/:id` (+ `/restore`), `media` (+ `/upload`, `/:id/usages`), `leads` (+ `/:id/events`, `/export.csv`), `redirects`, `settings/:key` (+ `/publish`), `integrations/:key` (+ `/test`), `users` (+ `/invite`, `/:id/roles`, `/:id/ban`, `/:id/sessions`, `/:id/impersonate`), `audit`, `ai/chat`, `ai/conversations`, `dashboard`, `search` (⌘K), `preview`, `reorder/:collection`.

Public routes: `POST leads`, `GET consent-config` (if needed by the banner).

Conventions: error body `{ error: { code, message, fieldErrors?, requestId } }` with codes `VALIDATION_FAILED | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMITED | INTERNAL`; lists `?page&pageSize&sort=field:dir&q&<filters>` → `{ items, page, pageSize, total }`; versioned writes send `version` (stale → 409); slugs `^[a-z0-9]+(-[a-z0-9]+)*$`; dates ISO 8601 UTC.

## 10. Admin IA

From spec §8.1.

```
Dashboard     KPIs (leads 30d, open leads, published content, drafts in review), leads trend (Recharts),
              "Next up" checklist (configure SMTP, configure R2, enable 2FA, review drafts, unassigned leads)
Content       Pages · Articles · Services · Team · Clients · Group companies · Categories
Media         grid/list, upload (drag & drop), alt text, focal point, usages, replace
Leads         inbox table, detail drawer with timeline, status, assignee, notes, CSV export
SEO           per-entity meta overview, redirects, sitemap preview
Marketing     consent, tracking IDs, custom code (owner)
Settings      Site · Contact · Navigation · Footer · Shared sections · Microcopy · Leads · Integrations (SMTP, R2, Turnstile, AI)
Users         list, invite, roles, ban, sessions, impersonate
Audit log     filter by actor, action, entity, date
Account       profile, password, 2FA, sessions
```

Sidebar items are hidden when the user lacks read permission.

## 11. Phases

From the master plan. Each phase ends with `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green and a commit.

| # | Phase | Tasks |
|---|---|---|
| 0 | Audit, inventory, baselines | 0.1 Field inventory and brief · 0.2 Visual baseline harness |
| 1 | Infrastructure | 1.1 Dependencies, scripts, lint boundaries · 1.2 Env + site env · 1.3 Crypto + errors + actor · 1.4 Database client, schema foundation, migrations, dev compose · 1.5 Hono skeleton, error envelope, health · 1.6 Docker entrypoint + compose + build without env |
| 2 | Auth, RBAC, users, audit | 2.1 Roles + permissions (isomorphic) · 2.2 Auth schema + Better Auth config · 2.3 Audit log + session DAL + Hono auth middleware · 2.4 Users module (invite, roles, ban, sessions, impersonate) · 2.5 Admin auth pages + proxy · 2.6 Account security (2FA, password, sessions) + bootstrap scripts |
| 3 | Content model + public site from DB | 3.1 Content schemas (DB + Zod) · 3.2 Template schemas · 3.3 Media seed + fixtures · 3.4 Repos, queries, seed runner · 3.5 Route groups + props-driven components · 3.6 Public pages from DB, caching, metadata, legal pages, 404/error |
| 4 | Admin shell + editors | 4.1 Admin shell, providers, navigation, ⌘K, permissions hook · 4.2 Versioning service + pages API · 4.3 SchemaForm + widgets · 4.4 Page editor screen (autosave, publish, preview, revisions) · 4.5 Settings + shared sections editors · 4.6 Collections (services, team, clients, group companies, categories) + reorder · 4.7 Dashboard |
| 5 | Articles workflow | 5.1 Articles service + API · 5.2 TipTap editor + public renderer · 5.3 Articles admin screens · 5.4 Scheduler + scheduled publish |
| 6 | Media | 6.1 Storage drivers · 6.2 Media service + upload API + file route · 6.3 Media library UI + picker · 6.4 Migrate uploads to R2 job |
| 7 | Leads + email | 7.1 Integrations module (generic) · 7.2 SMTP mailer + email templates · 7.3 Public leads endpoint + contact form wiring · 7.4 Leads inbox UI + export + retention |
| 8 | SEO, marketing, consent | 8.1 SEO fields + metadata + JSON-LD + OG · 8.2 Sitemap, robots, redirects · 8.3 Consent + tracking + custom code |
| 9 | AI assistant | 9.1 AI provider + chat API · 9.2 Assistant panel UI |
| 10 | Hardening, ops, E2E, docs | 10.1 Backups, restore drill, secrets rotate, db sync · 10.2 Security pass · 10.3 E2E suite · 10.4 CI + deploy gating · 10.5 Docs + final verification |

## 12. Risks

From spec §17.

| Risk | Mitigation |
|---|---|
| Pixel drift when components move from imports to props | Visual baselines from Phase 0; diff gate in every later phase. |
| GSAP selectors assume static markup order | Keep DOM identical; E2E smoke checks motion init without console errors. |
| Encryption key tied to `BETTER_AUTH_SECRET` | `secrets:rotate` script + runbook; 2FA re-enrol documented. |
| In-process scheduler with multiple replicas | `SKIP LOCKED` job claiming. |
| Next 16 Cache Components API details | Read `node_modules/next/dist/docs/` before Phase 3; follow installed version. |
| Bootstrap without SMTP | Invite/reset links surfaced in admin; dashboard checklist. |
| Scope size (single spec, 11 phases) | Phase exit checks; brief updated with dated changes. |

## 13. Out of scope

From spec §1.5: new public UI of any kind (except the conditional consent banner and the two legal pages that reuse existing components), theme customisation, newsletter, multi-language, public user accounts, e-commerce, block page builder.

## 14. Field inventory summary

Full list: `docs/brief-inventory.json` (323 entries, validated by `pnpm dlx tsx scripts/check-inventory.ts`).

Scope: `app/**/*.tsx` and `components/**/*.{ts,tsx}`, excluding `components/ui/**`, `components/motion/**` and `components/theme-provider.tsx`.

### 14.1 Entries per page

An entry counts once for every page it renders on, so shared header and footer entries count on all eight routes.

| Page | Entries |
|---|---|
| `/` | 155 |
| `/about` | 90 |
| `/services` | 86 |
| `/services/[slug]` | 98 |
| `/team` | 81 |
| `/blog` | 96 |
| `/blog/[slug]` | 101 |
| `/contact` | 103 |

### 14.2 Entries per kind

| Kind | Entries |
|---|---|
| text | 193 |
| image | 27 |
| href | 19 |
| list | 18 |
| aria | 17 |
| meta | 17 |
| tel | 13 |
| mailto | 8 |
| alt | 7 |
| richText | 4 |
| **Total** | **323** |

### 14.3 Conventions used in the inventory

- `source` is the `file:line` holding the literal; for multi-line strings, the first line of the value.
- Arrays (from `components/*/data.ts` and inline arrays inside components) are recorded once as `kind: "list"` with `value` = item count, plus one entry per field of the item shape, using the first item's value. Collection list entries use the target `<collection>[].*` (for example `clients[].*`); lists stored inside a page or setting use the field path without `[]` (for example `pages.about.stats`), and their fields use `[]` (for example `pages.about.stats[].value`).
- Values that interpolate data use `{name}` placeholders (for example `Call 24/7: {phone24h}`). Placeholders named after a `settings.contact` field (`{phone24h}`, `{phone24hHref}`, `{office}`, `{officeHref}`, `{operationsMobile}`, `{operationsEmail}`, `{mapsHref}`) are interpolated from `settings.contact` at render, so an editor changes a phone number or email once. Other placeholders are runtime values (`{title}`, `{name}`, `{category}`, `{n}`, `{url}`, `{col}`/`{row}`) or fields of the same record (`{slug}`, `{site}`, `{email}`, `{detail.intro}`, `{excerpt}`).
- Rule: an entry whose value contains `{…}` is a template field if it has `template: true` (seeded verbatim, interpolated at render); otherwise it is a derived usage and another entry with the same target and no placeholders must exist. `scripts/check-inventory.ts` enforces this, and `template` must be a boolean when present.
- Provenance: the `categories` list value `"7"` and the `categories.showInFilter` entry (value `true`) come from a review ruling, not from the literal on their source line. The source line holds the five-item filter array (`blogFilters`); the seed adds "Key Holding" and "Open Up & Lock Up" with `showInFilter: false`.
- Contact values (`components/home/data.ts` `contact` object) are recorded once at their definition, with `pages` listing every route that renders them. Usage sites that print a contact value without extra copy are not repeated; usage sites that add copy (for example `Tel:`, `24hr:`, `Ext 2`) have their own entries.
- Decorative assets (check marks, icon tiles, the hero dot, map pin), typographic separators (breadcrumb `/`, article meta `•`, the footer legal separator `"   ·   "`, arrows `→`/`←`) and empty `alt=""` attributes are design system, not content, and are not inventoried.
- Shared template labels on the service detail and article pages (for example "Keep reading", "Related Articles", "What's included") target `settings.microcopy.*`; per-item fields target `services[].…` / `articles[].…`.
- Shared sections reused on several pages target `settings.sections.*` (D10, extended — see Changes): Enquire banner (`/`, `/about`, `/services`, `/services/[slug]`, `/team`, `/blog`), Clients strip (`/`, `/about`, `/services`), Why Choose Us (`/services`), About section (`/`, `/about`) as `settings.sections.about.*`, and Contact section info cards, contact form copy and location map (`/`, `/contact`) as `settings.sections.contact.*` (map under `settings.sections.contact.map.*`, form under `settings.sections.contact.form.*`).

### 14.4 Notes for Phase 3

- **Footer legal links** are `href="#"` today. They are recorded as `settings.footer.legal.privacy.*` and `settings.footer.legal.terms.*`; in Phase 3 they will point to `/privacy` and `/terms`.
- **Footer Quick Links** render the same array as the header nav (`navLinks`), so they are recorded once as `settings.navigation.headerLinks`.
- **Home has no `metadata` export**; `/` uses the root layout title and description (`settings.seo.defaults.*`). Service and article pages build titles from the template `{title} | Security Partners Ltd.` (`settings.seo.defaults.titleTemplate`) and use `detail.intro` / `excerpt` as the description.
- **Sections shared between two page templates** are shared settings, not page fields: the About section (`/` and `/about`) is `settings.sections.about.*`, and the Contact section info cards, contact form copy and location map (`/` and `/contact`) are `settings.sections.contact.*`. Both pages render the same settings record, so the `home`, `about` and `contact` templates do not carry their own copy of these fields (this supersedes "about intro" / "about body" / "contact section copy" / "map" in the §7.1 outline, and adds the `sections.about` / `sections.contact` keys to §7.3; the related field additions `article_categories.showInFilter` and `users.title` are noted under §7.2). The Services and Team section eyebrows ("What we do", "Our people") are recorded per page because their headings are already per page.
- **Home hero naming**: the `<h1>` "Security Partners Ltd." is `pages.home.hero.heading`, "Watching Over You" is `pages.home.hero.tagline`, and the paragraph is `pages.home.hero.subheading`. (The brief example in the Phase 0 task paired `home.hero.heading` with "Watching Over You"; the inventory follows the rendered markup.)
- **Hero stats** carry an animation count and suffix (`data-count`, `data-suffix`) besides the displayed value; both are recorded (`pages.home.hero.stats[].count|suffix`).
- **Team photos** are design placeholders: every member renders two stacked images. The underlay `/images/team-temp.jpg` is the same for every member and targets `pages.team.leadership.photoPlaceholder`; the per-member image (`/images/about.png` today) targets `team[].photo`. Phase 3 must keep both layers to stay pixel-identical.
- **Service detail** uses the same hero image (`/images/hero.jpg`) and body image (`/images/about.png`, alt "Security Partners officer at work") for every service; recorded as `services[].heroImage`, `services[].image`, `services[].imageAlt`. Detail copy for five of the six services reuses company facts until final copy is supplied (comment in `components/home/data.ts`).
- **Blog categories**: the seed has seven categories — the five in the filter set (Company News, Mobile Patrols, Event Security, Retail Security, Alarm Response) plus "Key Holding" and "Open Up & Lock Up", which posts use but the filter set excludes ("Alarm Response" has no posts). `categories[].showInFilter` is `true` for the five and `false` for the other two. Both the blog filter bar (`components/blog/blog-posts.tsx`) and the article sidebar "Categories" nav (`components/blog/article.tsx:222`) iterate the filter set, so both are driven by `showInFilter`, in `sortOrder`.
- **Blog listing** pages through posts six at a time (`PAGE_SIZE = 6`, recorded as `pages.blog.pageSize`); the home blog section shows three (`pages.home.blog.count`).
- **Articles**: only `mobile-patrols-protect-your-business-after-hours` has a designed body (10 blocks) plus `readTime`, `lead` and `tags`; the others render their excerpt as the body. The featured article (`18-years-of-watching-over-ireland`) lives outside the `posts` array and is recorded under `articles[18-years-of-watching-over-ireland].*` plus `pages.blog.featuredArticle`. Bylines come from the author's user profile per spec §5.3: the name ("Michael McDonald") from `users.name`, and the role ("Managing Director") from the new `users.title` field. Display dates (for example "20 Sep 2026") derive from `publishedAt`.
- **Share links**: `settings.microcopy.share.networks[].href` holds one URL template per network and the shape varies: Facebook and LinkedIn interpolate `{url}` only (`https://www.facebook.com/sharer/sharer.php?u={url}`, `https://www.linkedin.com/sharing/share-offsite/?url={url}`), while X interpolates `{url}` and `{title}` (`https://x.com/intent/post?url={url}&text={title}`). Values are URL-encoded at render; the URL is the live page address.
- **Contact form** has no backend: it opens a `mailto:` to `info@securitypartnersltd.com` with subject "Website enquiry from {name}". No success or error messages exist on the page today. Phase 7 replaces this with the leads endpoint.
- **Group companies** carry a `phoneHref` that the footer does not use (the phone renders as plain text).
- **Favicon** (`app/favicon.ico`) maps to `settings.site.favicon`; it is binary, so it has no inventory line.

### 14.5 Data to confirm with the owner

- Office hours read "Monday–Friday, 9am to 6pm" in the header and "Monday–Friday: 9am to 6pm" in the contact card.
- The HR department phone "(085) 8062369" has the same digits as Cleaning Partners "085 806 2369".
- The Accounts line "Tel: (057) 8697670 Ext 3" formats the office number differently from "057 8697670" elsewhere.

## Changes

- 2026-10-16: sections shown on more than one page are shared settings (`sections.about`, `sections.contact`), extending D10.
- 2026-10-16: field additions from the inventory: `article_categories.showInFilter` and `users.title`; inventory entries whose value is a template string carry `template: true`.
- 2026-10-16: public pages moved to app/(site) (route group); inventory source paths updated.
- 2026-10-16: Phase 3 content model. Fields added beyond the inventory: `settings.site.{name,legalName,logoOnDark,favicon,productionUrl,timezone}`, `settings.microcopy.article.readTime` ("{n} min read"), defaults for `seo.defaults`, `consent`, `tracking`, `customCode`, `leads`. About copy and service overviews are paragraph-only rich text; article bodies are TipTap JSON. Byline authors are seeded as banned users `@authors.invalid`. `<html lang>` is fixed in the static shell and `settings.site.locale` is applied after hydration. Unknown service/article slugs show the 404 page with `noindex` but HTTP 200 (Cache Components streaming); unmatched URLs return 404. `/privacy` and `/terms` carry placeholder copy for owner review.
- 2026-10-16: correction to §14.3: `{phone24hHref}` and `{officeHref}` are not `settings.contact` fields; they are derived at render from `{phone24h}` / `{office}` (tel: links). `{mapsHref}` is a stored field.
- 2026-10-19: Phase 10 operations: daily backups (dump + manifest, 14 kept, R2 `backups/` or `/data/backups`), `restore-drill`, `secrets:rotate`, `db:sync`, `demo:remove`; CI gates the deploy (trigger unchanged, `skip_ci` for emergencies); security headers with a non-blocking Content-Security-Policy; failing background jobs show on the dashboard; operator docs in `docs/runbook.md`. Owner items: `docs/launch.md`.
