# Security Partners — Dynamic Site + Admin Platform (Design Spec)

Date: 2026-10-16 · Status: draft for owner review · Source prompt: `docs/platform-starter-prompt.md`

This spec is the single design for converting the static Security Partners Next.js site into a database-driven site with a full admin panel. It follows `docs/platform-starter-prompt.md` except where a **Deviation** is stated. Phase 0 copies the decision/inventory parts of this spec into `docs/brief.md`, which then becomes the living brief (dated "Change" notes, never silent edits).

---

## 1. Intent

### 1.1 What the owner said

- Make the existing site dynamic with a "perfect" admin panel, following the starter prompt.
- One spec covering all phases (not decomposed into sub-projects).
- **The public frontend design is fixed. Nothing is removed and nothing new is added to it. Only what exists today becomes dynamic.**
- Public pages are **fixed templates**: layout and section order are code; admin edits the fields.
- Email via **SMTP**, media via **Cloudflare R2**. All integration credentials are managed **from the admin panel**, not env.
- Env holds only database and Better Auth values: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
- Tracking is allowed behind a **conditional** consent banner (shown only when tracking is enabled).

### 1.2 Success criteria

1. Every public page renders entirely from the database, and is **pixel-identical** to the current site after seeding (Playwright visual diff against Phase 0 baselines, threshold 0 on desktop 1440 and mobile 390; animations disabled during capture).
2. Every user-visible string, image, link, phone, email and list on the public site is editable in the admin; a publish shows on the site immediately (tag revalidation).
3. Every role signs in and sees exactly what the role matrix allows (E2E per role).
4. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass; `next build` succeeds with no env vars set.
5. Fresh clone works with: `docker compose -f docker-compose.dev.yml up -d && pnpm db:migrate && pnpm db:seed && pnpm demo:seed && pnpm dev`.
6. Production bootstraps with only: 3 env vars set, deploy, `admin:create` inside the container; SMTP/R2/etc. then configured from Settings ▸ Integrations.

### 1.3 Decisions taken on the owner's behalf (confirm or correct)

| # | Decision |
|---|---|
| D1 | Approach A: Hono + Better Auth + Drizzle/Postgres + shadcn admin inside this Next app (not Payload, not Server-Actions-only). |
| D2 | Seven default roles from the prompt (owner, admin, editor, author, marketer, intake, viewer). Editor may publish articles. |
| D3 | Postgres 17 runs as a separate Dokploy service; app connects via `DATABASE_URL`. |
| D4 | Turnstile is optional, invisible mode only (no visible widget), configured in Settings. |
| D5 | AI assistant uses the AI SDK with provider/model/key chosen in Settings; off until configured. |
| D6 | Lead retention default 24 months, editable in Settings. |
| D7 | Site timezone `Europe/Dublin`, locale `en-IE`, stored in `settings.site` but defaulted in code. |
| D8 | Cookie prefix `sp`. |
| D9 | Uploads fall back to local disk at `/data/uploads` (Dokploy volume) until R2 is configured; backups fall back to the same volume. |
| D10 | Shared sections that appear on several pages (Enquire banner, Clients strip, Why Choose Us) are edited once as globals, not per page. |

### 1.4 Deviations from the starter prompt

| Prompt says | This project | Why |
|---|---|---|
| Block-based page builder (`blocks/`) | Fixed templates (`templates/`) | Owner: design is fixed. |
| Section show/hide, new pages | None, except two `legal` pages | Owner: nothing removed or added. Privacy/Terms links already exist in the footer (`href="#"`). |
| Theme engine (Appearance) | Removed | Design tokens stay in code. |
| Newsletter module | Removed | No subscribe UI exists on the site. |
| `APP_ENCRYPTION_KEY`, `CRON_SECRET`, provider env vars | Not used | Owner: env = DB + Better Auth only. Key derived via HKDF; integrations in DB; cron in-process. |
| `SITE_ENV` env var | Derived | `production` when `BETTER_AUTH_URL` origin equals `settings.site.productionUrl`; `development` when `NODE_ENV !== "production"`; else `staging`. |

### 1.5 Out of scope

New public UI of any kind (except the conditional consent banner and the two legal pages that reuse existing components), theme customisation, newsletter, multi-language, public user accounts, e-commerce, block page builder.

---

## 2. Stack

Versions are the current stable releases at Phase 1, verified against npm and the installed docs (`node_modules/next/dist/docs/`) before use. No RCs.

- Next.js 16.3.x App Router with Cache Components, React 19.3, TypeScript strict, Tailwind 4 (existing).
- Hono + `@hono/zod-validator`, typed RPC client `hc<AdminApi>`.
- Better Auth: email+password, `admin` plugin with custom access control, `twoFactor` (TOTP, backup codes, trusted devices), database rate-limit storage.
- PostgreSQL 17, Drizzle ORM + drizzle-kit, `pg` pool. uuid v7 ids, `timestamptz` everywhere.
- Zod 4: single source of truth for API input, forms, types.
- Admin UI: existing shadcn (base-ui) setup + TanStack Query, TanStack Table, react-hook-form, sonner, cmdk, Recharts, TipTap, dnd-kit.
- Email: React Email templates, Nodemailer SMTP transport; Mailpit in dev.
- Media: S3 client against R2 + local-disk driver; sharp for metadata, blur placeholder, focal crop.
- Tests: Vitest (unit + integration on real Postgres), Playwright (E2E + visual).

---

## 3. Architecture

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

Rules, enforced by ESLint `no-restricted-imports` and review:

1. `app/**` files are thin. Public rendering never fetches its own HTTP API; it calls `queries` directly.
2. Hono handlers only: validate (Zod) → authorise `can({ resource: ["action"] })` → call a service.
3. Services hold business logic, take an `Actor` (`{ userId, roles, ip, userAgent }`), check ownership, write the audit log, snapshot revisions, invalidate cache tags.
4. Repos are the only files with Drizzle queries.
5. No DB access at build time. Public routes are dynamic-with-cache (`'use cache'` + `cacheTag`), not build-time static; `generateStaticParams` is removed.
6. `lib/` and `templates/*/schema.ts` never import `server/`.

### 3.1 Existing components

Existing components in `components/**` keep their markup and class names. The only change is that their content arrives as props instead of from `data.ts` imports. GSAP/Lenis motion (`HomeMotion`, `SmoothScroll`) keeps working because the rendered DOM is unchanged; Phase 3 verifies motion selectors against DB-rendered markup. `components/*/data.ts` are deleted after seed fixtures replace them.

---

## 4. Environment and secrets

| Var | Use |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `BETTER_AUTH_SECRET` | Better Auth signing; root for derived keys |
| `BETTER_AUTH_URL` | Public origin; Better Auth base URL and trusted origin |

- `server/env.ts` validates with Zod on first server use and fails with a readable message listing missing/invalid vars.
- **Derived keys**: `HKDF-SHA256(ikm = BETTER_AUTH_SECRET, salt = "sp/v1", info = <purpose>)` → 32 bytes. Purposes: `secrets` (integration credentials), `preview` (draft preview tokens), `cron` (internal job auth if ever exposed).
- **Secrets at rest**: AES-256-GCM, 12-byte random IV, AAD = `<settings key>.<field>`; stored as `v1:<iv>:<ciphertext>:<tag>` base64url. Secret fields are write-only through the API; reads return `{ set: boolean, hint: "••••abcd" }`.
- **Rotation**: `pnpm secrets:rotate --from-secret <old>` decrypts with the old derived key and re-encrypts with the current one in a single transaction; two-factor secrets are bound to the auth secret and are cleared (users re-enrol). Documented in the runbook.
- Client IP: first value of `X-Forwarded-For` (Traefik), fallback `X-Real-IP`.

---

## 5. Content model

### 5.1 Shared versioning pattern

Versioned records (pages, services, articles, settings) carry:

```
draft        jsonb       -- current working copy (autosaved)
published    jsonb null  -- last published copy; public reads use only this
version      int         -- optimistic concurrency; stale writes → 409 with current state
status       enum        -- draft | in_review | scheduled | published (articles use all; others draft|published)
scheduledAt  timestamptz null
publishedAt  timestamptz null
updatedBy    uuid → users
updatedAt    timestamptz
```

Publish = copy `draft` → `published`, bump `version`, insert a `revisions` row (`entityType, entityId, version, data, actorId, createdAt`), `revalidateTag`, audit. Restore = load revision into `draft`.

Collection records whose payload is small (team members, clients, group companies, categories) are not draft-versioned: edits publish immediately, but every change still writes a revision row and an audit entry.

### 5.2 Pages (fixed templates)

`pages` table: `id, key (unique), template, draft, published, seo jsonb, + versioning`. Rows are seeded; the admin cannot create or delete them, except that both `legal` pages exist from seed.

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

**Rule**: Phase 0 produces a field inventory in `docs/brief.md` listing every hard-coded user-visible string, image, link and list in `app/**` and `components/**`, and the field that replaces it. The table above is the section-level outline; the inventory is the exhaustive list and wins where they differ. Nothing in the inventory may remain hard-coded at the end of Phase 3, except structural labels that are part of the design system (e.g. ARIA labels for icons) which become `settings.microcopy` entries.

Each template folder holds `schema.ts` (Zod object for the template's `draft`/`published` shape), `render.tsx` (composes existing components with props), `editor-meta.ts` (labels, help text, widget per field, groups).

### 5.3 Collections

| Table | Fields | Versioning |
|---|---|---|
| `services` | slug, title, description, icon (media), detail: intro, heading, overview, included[], callout · sortOrder · seo | draft/publish |
| `articles` | slug, title, excerpt, categoryId, cover (media), authorId (users), lead, tags[], body (TipTap JSON), readTimeMinutes (computed), sortOrder n/a (date ordered), seo | full workflow |
| `article_categories` | slug, name, sortOrder | immediate |
| `team_members` | name, role, bio, email, photo (media, optional), sortOrder | immediate |
| `clients` | name, logo (media), url (optional), sortOrder | immediate |
| `group_companies` | name, phone, site, logo (media), sortOrder | immediate |

Article author display (name, role) comes from the user profile (`users.name`, `users.title`). Seed creates author users for existing bylines as inactive, no-login accounts (banned, no password) so bylines resolve.

TipTap is restricted to the node types the existing article design renders: paragraph, h2, h3, bullet/ordered list, blockquote with cite, image (media + alt), link, bold, italic. The public renderer maps TipTap JSON to the existing `ArticleBody` markup.

Display dates (e.g. "20 Sep 2026") are formatted from `publishedAt` in `Europe/Dublin`/`en-IE`, matching the current format.

### 5.4 Globals (`settings` table)

`settings(key text pk, draft jsonb, published jsonb, version, updatedBy, updatedAt)`. Zod schema per key in `lib/schemas/settings/`.

| Key | Contents |
|---|---|
| `site` | name, legal name, logo, logo-on-dark, favicon, productionUrl, timezone, locale, copyright line |
| `contact` | phone24h, office, operationsMobile, email, operationsEmail, hours, address lines, mapsHref (tel/mailto hrefs derived) |
| `navigation` | header links[] (label, href), header CTA |
| `footer` | columns/links as currently designed, legal links (privacy, terms) |
| `sections.enquireBanner` | heading, copy, CTA, image |
| `sections.clients` | heading/eyebrow for the clients strip |
| `sections.whyChooseUs` | heading, features[] (title, description, icon) |
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

Bold = encrypted field. Integration keys are not draft-versioned (save applies immediately) and each has a "Test connection" action.

### 5.5 Other tables

`users`, `sessions`, `accounts`, `verifications`, `two_factors`, `rate_limits` (Better Auth) · `media` (id, key, driver, mime, size, width, height, blurDataUrl, focalX, focalY, alt, createdBy) · `media_usages` (mediaId, entityType, entityId, field) · `revisions` · `audit_log` (id, actorId, impersonatorId, action, entityType, entityId, ip, userAgent, diff jsonb, createdAt) · `leads` (id, name, email, phone, company, service, message, consent, status, assigneeId, source page, ip hash, createdAt) · `lead_events` (leadId, type, body, actorId, createdAt) · `redirects` (from, to, code 301/302, hits) · `ai_conversations`, `ai_messages` · `jobs` (name, runAt, lockedAt, lastError) for the scheduler.

### 5.6 Public reads, caching, preview

- `queries.ts` functions use `'use cache'` + `cacheTag(...)` + `cacheLife`. Tags: `page:<key>`, `services`, `service:<slug>`, `articles`, `article:<slug>`, `categories`, `team`, `clients`, `group-companies`, `settings:<key>`, `redirects`.
- Every service mutation calls `revalidateTag` for the affected tags (helper `server/lib/cache-tags.ts` maps entity → tags).
- Preview: admin "Preview" opens `/api/v1/admin/preview?entity&id` which verifies the session, sets Next draft mode and a signed short-lived preview cookie (HMAC with the `preview` derived key), and redirects to the public URL. In draft mode `queries` read `draft` instead of `published` and bypass the cache. A small preview bar is shown only in draft mode (admin-only, not part of the public design).
- Images from media render via `next/image` with blur placeholder; R2 public base URL is added to `images.remotePatterns` at runtime through a custom loader (no build-time config dependency on the DB).

---

## 6. Auth and RBAC

- No public sign-up. Owners/admins invite: user created without password → "You're invited" email containing a set-password link (Better Auth reset flow). If SMTP is not configured, the admin UI shows the link to copy.
- Password ≥ 12 chars; revoke other sessions on reset; 7-day sessions; cookie cache 5 min, but `requireActor` in admin reads the session fresh so bans/role changes apply on the next request. Cookie prefix `sp`, `__Secure-` in production. Trusted origins = `BETTER_AUTH_URL`.
- 2FA (TOTP + backup codes + trusted devices) optional for every role, enabled by the user from Account ▸ Security. Dashboard nudges owners/admins without 2FA.
- Rate limits (production only, DB storage): sign-in 5/min, password reset 3/5 min, two-factor 5/min.
- Impersonation ("View as") for owner/admin: 1 hour, sticky banner in admin, audited; cannot impersonate owners unless actor is owner.
- Audit: sign-in, sign-out, failed sign-in, password change/reset, role change, ban/unban, impersonation start/stop, 2FA enable/disable, invite, every content/settings mutation.

### 6.1 Permission matrix (`lib/auth/permissions.ts`, `createAccessControl`)

Resources: `page, service, article, collection, media, lead, seo, redirect, marketing, customCode, settings, integration, user, owner, audit, ai`.

| Role | Grants |
|---|---|
| owner | all actions on all resources |
| admin | all except `customCode:*`, `owner:*` |
| editor | `page, service, collection, media, seo`: read/create/update/publish/delete · `article`: all incl. publish, any author · `settings`: read/update for content keys (site, contact, navigation, footer, sections.*, microcopy) |
| author | `article`: read all, create, update/delete own while not published, `submit` own · `media`: read/create |
| marketer | `seo, redirect, marketing`: all · `page, service, article`: read · `media`: read/create |
| intake | `lead`: read/update/export |
| viewer | read on everything except `lead`, `integration`, `audit`, `customCode`, `user` |

Multi-role users get the union. Defence in depth: `proxy.ts` (cookie presence) → `(panel)/layout.tsx` `requireActor` + per-page `requirePermission` → Hono `can()` → service ownership checks → UI `usePermission()` (convenience only).

---

## 7. API

Mount order in `server/api/app.ts`:

1. Global: `requestId` · `secureHeaders` · error envelope · `notFound`
2. `/api/auth/*` → Better Auth handler
3. `/api/v1/public/*` → rate limit (DB-backed), 64 KB body
4. `/api/v1/admin/*` → session → signedIn → sameOrigin (unsafe methods) → 1 MB body (uploads route: 20 MB)
5. `/api/v1/health` (readiness, checks DB) · `/api/v1/health/live` (liveness, no DB)

Conventions: error body `{ error: { code, message, fieldErrors?, requestId } }` with codes `VALIDATION_FAILED | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMITED | INTERNAL`. Lists `?page&pageSize&sort=field:dir&q&<filters>` → `{ items, page, pageSize, total }`. Versioned writes send `version`; stale → 409 with current state. Slugs `^[a-z0-9]+(-[a-z0-9]+)*$`, unique per table. Dates ISO 8601 UTC.

Route map (admin): `pages`, `services`, `articles` (+ `/submit`, `/publish`, `/schedule`, `/unpublish`), `categories`, `team`, `clients`, `group-companies`, `revisions/:entity/:id` (+ `/restore`), `media` (+ `/upload`, `/:id/usages`), `leads` (+ `/:id/events`, `/export.csv`), `redirects`, `settings/:key` (+ `/publish`), `integrations/:key` (+ `/test`), `users` (+ `/invite`, `/:id/roles`, `/:id/ban`, `/:id/sessions`, `/:id/impersonate`), `audit`, `ai/chat`, `ai/conversations`, `dashboard`, `search` (⌘K), `preview`, `reorder/:collection`.

Public: `POST leads`, `GET consent-config` (if needed by the banner).

---

## 8. Admin panel

### 8.1 IA

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

Sidebar items hidden when the user lacks read permission.

### 8.2 Editing UX

- `SchemaForm`: Zod schema + `editor-meta` → widgets: text, textarea with counter, rich text (TipTap), link picker (internal page/service/article or URL), media picker, number, toggle, select, sortable list, group, collection picker. Same Zod schema validates client and server.
- Autosave drafts (debounced 1.5 s) with save-state indicator (Saved / Saving / Unsaved / Conflict), unsaved-changes guard, ⌘S, optimistic UI with rollback via TanStack Query.
- Version conflict (409) shows a dialog: reload theirs / overwrite / copy mine.
- Publish button with diff against the published version; revision history drawer with restore.
- ⌘K palette: navigate sections, search records (pages, articles, services, team, leads, users), quick actions.
- Empty states with CTA, skeletons, error boundaries with retry.
- Responsive: sidebar → sheet below 1024 px; tables → cards on phones. WCAG 2.2 AA, keyboard drag-and-drop (dnd-kit sensors), visible focus.

### 8.3 AI assistant

Right-side panel, available to roles in `integrations.ai.allowedRoles`. Context = current screen + record being edited (read-only JSON). Uses AI SDK `streamText`; conversation history stored per user. Capabilities: draft/rewrite copy for the open field, suggest SEO meta, summarise a lead. It never writes to the DB directly; the user applies suggestions into the form. Off and hidden until configured.

---

## 9. Leads and email

- Existing contact form keeps its markup; `handleSubmit` posts to `POST /api/v1/public/leads`. Validation with shared Zod schema; honeypot field (visually hidden, already compatible with design); invisible Turnstile token when enabled; rate limit 5/10 min per IP; consent captured.
- Success/error messages come from `settings.microcopy` and render in the existing form's current feedback location.
- Inbox: status `new → contacted → qualified → won | lost | spam`, assignee, notes and events timeline, CSV export, retention purge job (daily) per `settings.leads.retentionMonths`.
- Emails (`emails/`): invite, password reset, new-lead staff notification, lead acknowledgement (toggle). Sent via SMTP from `integrations.smtp`; if unconfigured, logged and surfaced on the dashboard. Dev uses Mailpit (SMTP defaults point at `localhost:1025` when `NODE_ENV !== "production"` and nothing is configured).

---

## 10. SEO, marketing, consent

- Per page/service/article `seo` (title, description, canonical, OG image, noindex). `generateMetadata` reads it with fallbacks to `seo.defaults`.
- OG images generated with `next/og` in the site's existing fonts/colours when no OG image is set.
- JSON-LD: `SecurityService`/`LocalBusiness` (from `settings.contact`) site-wide, `Article` on articles, `BreadcrumbList` on detail pages.
- `app/sitemap.ts` and `app/robots.ts` from DB (dynamic, cached).
- Redirects: `redirects` table resolved in the `not-found` path (cached lookup) before rendering 404; hit counter.
- Consent: own lightweight manager. The banner renders **only when `tracking.enabled` is true**; styled strictly with existing tokens/fonts/button component. Categories: necessary, analytics, marketing. GTM/GA4/Meta pixel load only after matching consent. Typed `dataLayer` event catalogue (`lead_submitted`, `cta_click`, `phone_click`, `email_click`).
- Custom code: owner-only head/body snippets, injected server-side; runbook documents CSP implications.

---

## 11. Media

- Upload → MIME sniff + allow-list (jpeg, png, webp, avif, svg sanitised, pdf) + 20 MB limit → sharp metadata, blur placeholder, webp/avif renditions handled by `next/image` → stored via active driver (R2 if configured, else disk).
- Disk files served by `/api/v1/media/file/:key` with long cache headers; R2 via its public base URL.
- Seed imports everything referenced from `public/images/*` into the library so seeded content references media ids. Files used purely by design CSS (not content) stay in `public/`.
- Changing driver does not move old files automatically; Settings ▸ Integrations ▸ R2 has "Migrate existing uploads to R2" (background job, idempotent).

---

## 12. Scheduler (in-process)

`instrumentation.ts` (Node runtime, production and dev) starts a 60 s tick. Jobs are claimed with `SELECT … FOR UPDATE SKIP LOCKED` on the `jobs` table so multiple replicas are safe. Jobs: scheduled publish, lead retention purge (daily), daily DB backup, media migration, revision pruning (keep last 50 per entity). Failures recorded on the job row and surfaced on the dashboard.

---

## 13. Security and privacy

- Env validated at startup (Section 4).
- Secrets encrypted (Section 4); never logged or returned.
- `sameOrigin` on unsafe admin methods; `secureHeaders`; body limits; upload checks; no secrets or full IPs in logs (lead IPs stored as salted hash).
- Admin and API responses carry `X-Robots-Tag: noindex`.
- GDPR: consent stored with leads; retention purge; CSV export for subject-access requests.

---

## 14. Operations

- `docker-compose.dev.yml`: Postgres 17 + Mailpit. Production `docker-compose.yml` (Dokploy) gains the `/data` volume and `DATABASE_URL`/auth env; Postgres runs as a Dokploy database service.
- Dockerfile: standalone output, non-root, bundles `scripts/` + migrations; entrypoint runs `migrate` then `node server.js`; `HEALTHCHECK` on `/api/v1/health/live`; `pg_dump` client installed for backups.
- Scripts (`pnpm <name>`; also runnable in the container):
  - `db:up`, `db:generate`, `db:migrate`
  - `db:seed` — idempotent content seed from fixtures; refuses unless the DB is provably disposable (name ends `_dev`/`_test`/`_e2e` or host is localhost) or `--allow-production`.
  - `admin:create --email --name` — first owner, prints/sends set-password link.
  - `owner:recover --email` — resets 2FA and password for an owner, prints link; audited.
  - `demo:seed` — one account per role `<role>@demo.local`, shared password from `--password`; same guard as `db:seed`; "remove before handover".
  - `secrets:rotate --from-secret`.
  - `db:sync --from <url> --to <url> --from-secret --to-secret` — back up target, dump source (skip sessions, verifications, rate limits), restore in one transaction, re-encrypt secrets from source to target derived key, clear 2FA secrets, re-apply demo passwords; verify by health check and AI test-connection.
  - `backup` / `restore-drill` — daily dump to R2 (or `/data/backups`), restore latest into a scratch DB and compare row counts.
- CI (`.github/workflows/`): lint, typecheck, unit, integration (Postgres service), build (no env), E2E (Postgres service + Mailpit). Existing GHCR build + Dokploy deploy runs only after CI passes.
- Docs: `docs/brief.md`, `docs/runbook.md` (deploy, rollback, rotate secrets, restore, owner lockout, CSP for custom code), `docs/launch.md` ("agent did" / "owner must do": DNS, SMTP credentials, R2 bucket + public URL, Turnstile keys, tracking IDs, first owner, remove demo accounts).

---

## 15. Testing

- **Unit**: permission matrix (every role × resource × action), Zod schemas (templates, settings, API inputs), HKDF + AES-GCM round trip and tamper detection, TipTap → markup renderer, date formatting.
- **Integration** (real Postgres, truncate per test): every service incl. RBAC denials, ownership (author), optimistic concurrency 409, audit writes, revision snapshot/restore, cache-tag invalidation calls (mocked `revalidateTag`), scheduler claiming.
- **E2E** (Playwright, `_e2e` DB seeded with one user per role): sign-in per role; invite → set password; reset; 2FA enable/disable; edit + publish page → visible on site; author cannot publish; intake sees only leads; contact form → lead appears + Mailpit email; media upload; redirect works.
- **Visual**: Phase 0 captures baselines of every public URL (desktop 1440, mobile 390, motion disabled) from the current static site; Phase 3 and every later phase must match them exactly after `db:seed`. Admin shell baselines added in Phase 4.

---

## 16. Phases

Each phase ends with lint, typecheck, tests, build green and a commit.

| # | Phase | Exit check |
|---|---|---|
| 0 | Repo audit, field inventory, `docs/brief.md`, visual baselines of current site | Inventory complete; baselines committed |
| 1 | Infra: deps, env, Drizzle, migrations, dev compose, Dockerfile entrypoint, Hono skeleton + health, lint rules | `build` with no env; health endpoints |
| 2 | Auth, RBAC, users, invites, 2FA, impersonation, audit, `admin:create`, `owner:recover`, `demo:seed` | Every role signs in; matrix unit tests |
| 3 | Content model, settings, templates, seed fixtures, route groups, public site from DB with caching, legal pages; delete `data.ts` | Visual diff = 0; motion intact |
| 4 | Admin shell, SchemaForm, pages/settings/collections editors, reorder, ⌘K, dashboard | Edit + publish → site updates |
| 5 | Articles workflow, revisions + restore, scheduling, preview | Author/editor E2E |
| 6 | Media library, sharp, disk + R2 drivers, migration job | Upload E2E |
| 7 | Leads, inbox, SMTP mailer, React Email templates, Turnstile, retention | Form → lead → email E2E |
| 8 | SEO (meta, OG, JSON-LD, sitemap, robots, redirects), consent, tracking, custom code | Lighthouse SEO 100; banner hidden when tracking off |
| 9 | AI assistant | Test connection + chat |
| 10 | Hardening, backups, restore drill, `db:sync`, `secrets:rotate`, CI gates, runbook, launch checklist | Definition of done (Section 1.2) |

---

## 17. Risks

| Risk | Mitigation |
|---|---|
| Pixel drift when components move from imports to props | Visual baselines from Phase 0; diff gate in every later phase. |
| GSAP selectors assume static markup order | Keep DOM identical; E2E smoke checks motion init without console errors. |
| Encryption key tied to `BETTER_AUTH_SECRET` | `secrets:rotate` script + runbook; 2FA re-enrol documented. |
| In-process scheduler with multiple replicas | `SKIP LOCKED` job claiming. |
| Next 16 Cache Components API details | Read `node_modules/next/dist/docs/` before Phase 3; follow installed version. |
| Bootstrap without SMTP | Invite/reset links surfaced in admin; dashboard checklist. |
| Scope size (single spec, 11 phases) | Phase exit checks; brief updated with dated changes. |
