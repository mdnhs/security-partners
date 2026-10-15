# Platform starter prompt

Paste everything below the line into a coding agent at the root of a new or existing Next.js project. Fill in the `PROJECT` block first; delete the lines that do not apply.

---

You are building a production-grade **dynamic website + admin platform** inside this repository: a public site rendered from a database, an authenticated admin panel to manage it, a typed HTTP API, and the operations around it (migrations, seeding, backups, deploy). Work in phases, commit after each phase, and keep the build green.

## PROJECT (fill in)

```
Name:                 <project name>
Public domain:        <https://example.com>   Admin lives at /admin on the same origin
Business:             <one paragraph: what the business does, who the visitors are>
Timezone / locale:    <Europe/Dublin, en-IE>
Content types:        <e.g. pages, articles, services, plans, testimonials, FAQs, team, products>
Lead capture:         <e.g. contact form, quote request, booking request, newsletter>
Roles needed:         <start from the default list below; add or remove>
Integrations:         <email provider, object storage, analytics/ads, AI provider, captcha>
Hosting:              <Dokploy / Docker on a VPS | Vercel | other>
Existing site:        <none | static Next.js site to convert | other CMS to migrate from>
Design reference:     <Figma link / screenshots / "match the public site's tokens">
```

## Before writing code

1. Read the installed framework docs for the exact versions in `package.json` (for Next.js: `node_modules/next/dist/docs/`). Do not rely on remembered APIs; heed deprecations. Verify every library version you add is current and stable (no RCs).
2. Audit the current repo: routes, content that is hard-coded, design tokens, animations that assume static markup, SEO gaps.
3. Write `docs/brief.md`: requirements, decisions taken on the owner's behalf (marked "confirm or correct"), open questions with defaults, success criteria, target architecture, content model, role matrix, API route map, admin IA, phases, risks, out of scope. Then build to that brief and keep it updated when decisions change (dated "Change" notes, never silent edits).

## Stack (defaults; swap only with a written reason)

- Next.js App Router (latest stable) with Cache Components, React 19, TypeScript `strict`, Tailwind CSS 4.
- API: Hono mounted at `app/api/[...route]/route.ts` with `basePath("/api")`, `@hono/zod-validator`, typed RPC client (`hc<AdminApi>`).
- Auth: Better Auth (email + password, admin plugin with custom access control, two-factor TOTP, database rate limiting).
- DB: PostgreSQL 17 + Drizzle ORM + drizzle-kit, `pg` pool. uuid ids, `timestamptz` everywhere.
- Validation: Zod 4 as the single source of truth for API input, forms and types.
- Admin UI: shadcn/ui, TanStack Query + TanStack Table, react-hook-form, sonner, cmdk, Recharts, TipTap (rich text), dnd-kit (reorder).
- Email: React Email templates; Resend (or SMTP) in production, Mailpit in development.
- Media: S3-compatible driver (R2/S3) + local-disk driver; sharp for metadata, blur placeholders and focal crops.
- Tests: Vitest (unit + integration against a real Postgres), Playwright (E2E + visual).
- Local infra: `docker compose` with Postgres and Mailpit.

## Architecture rules (enforce with lint `no-restricted-imports` and review)

```
app/(site)/**        public site, own root layout; RSC that call server/modules/*/queries
app/(admin)/admin/** admin, own root layout; (auth) pages + guarded (panel) shell
app/api/[...route]   → Hono
proxy.ts             optimistic /admin gate (cookie presence only, no DB) + X-Robots-Tag noindex
instrumentation.ts   boot hook: in-process scheduler tick
server/              all server code, every file starts with import "server-only"
  api/app.ts         middleware order + route mounting
  auth/              getAuth() (lazy, memoised), session DAL, hooks
  db/                client, schema/, migrations/, migrate.ts, seed/
  lib/               secrets (AES-256-GCM), email, storage, rate limit, audit
  modules/<domain>/  routes.ts → service.ts → repo.ts (+ queries.ts for public reads, schema.ts)
lib/                 isomorphic: permissions, zod schemas, utils (never imports server code)
blocks/              page-builder block registry (schema + renderer + admin editor per block)
emails/              React Email templates
scripts/             migrate, seed, admin-create, owner-recover, demo-seed, db-sync, restore-drill
tests/{unit,integration,e2e}
```

1. Routes in `app/**` are thin. Public rendering never self-fetches the HTTP API; it calls `queries` directly.
2. Hono route handlers only: validate (Zod) → authorise (`can({ resource: ["action"] })`) → call a service.
3. Services hold all business logic, take an `Actor` (`{ userId, roles, ip, userAgent }`), check ownership, write the audit log, snapshot revisions and invalidate cache. No route can forget a side effect.
4. Repos are the only files containing Drizzle queries.
5. No database access at build time. `next build` must succeed with no DATABASE_URL and no auth secrets.

## API conventions

- Mounting order: global `requestId` · `secureHeaders` · error envelope · `notFound` → `/auth/*` (Better Auth) → `/v1/public/*` (rate limit, 64 KB body) → `/v1/admin/*` (session → signedIn → sameOrigin → 1 MB body; uploads larger) → `/v1/cron/*` (bearer `CRON_SECRET`) → `/v1/health` (readiness, checks DB) and `/v1/health/live` (liveness, no DB).
- Errors: `{ error: { code, message, fieldErrors?, requestId } }`, codes `VALIDATION_FAILED | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMITED | INTERNAL`.
- Lists: `?page&pageSize&sort=field:dir&q&<filters>` → `{ items, page, pageSize, total }`.
- Optimistic concurrency: versioned resources carry `version`; stale writes get 409 with the current state.
- Slugs `^[a-z0-9]+(-[a-z0-9]+)*$`, unique per table. Dates ISO 8601 UTC, displayed in the project timezone.

## Auth and RBAC

- No public sign-up. Accounts exist only by invitation (create user without password → password-reset email styled as "You're invited").
- Password ≥ 12 chars, revoke sessions on reset, 7-day sessions, cookie cache 5 min but admin checks bypass it so bans/role changes apply immediately. Project-specific cookie prefix; `__Secure-` in production; trusted origins = site URL; real client IP header from the reverse proxy.
- 2FA (TOTP + backup codes + trusted devices) **optional for every role**; users turn it on themselves from Account ▸ Security. Dashboard nudges owners/admins to enable it.
- Rate limits (production only): sign-in 5/min, password reset 3/5 min, two-factor 5/min.
- Permissions live in an isomorphic `lib/auth/permissions.ts` (`createAccessControl`), multi-role aware (any role granting a permission is enough). Default roles:
  - **owner**: everything, including other owners and custom code injection.
  - **admin**: everything except custom code and managing owners.
  - **editor**: pages, content types, globals, media, SEO.
  - **author**: own articles only, cannot publish (submits for review).
  - **marketer**: SEO, redirects, tracking, newsletter list; no leads.
  - **intake**: leads inbox only.
  - **viewer**: read-only.
- Defence in depth: proxy (optimistic) → session DAL in the panel layout (`requireActor`, `requirePermission`) → Hono `can()` → service ownership checks → UI `usePermission()` (convenience only).
- Impersonation ("View as") for owner/admin: 1 hour, sticky banner, audited.
- Every sign-in, password change, role change, ban, impersonation and 2FA change goes to the audit log.

## Content model

- **Pages** built from a typed **block registry** (`blocks/<name>/{schema.ts,render.tsx,editor.tsx}`); each block's Zod schema drives its admin form.
- **Collections** for repeatable items (from the PROJECT content types), reorderable, referenced by blocks.
- **Globals** (`settings` table, key → jsonb with `draft`, `version`): site identity, navigation, footer, contact details, microcopy, SEO defaults, consent, tracking, theme, AI.
- **Drafts, publishing, revisions**: draft vs published state, scheduled publishing via the cron tick, revision history with restore, preview of drafts via signed preview mode.
- Public reads use `'use cache'` + `cacheTag`; services call `revalidateTag` on every mutation.

## Admin panel

- Sections: Dashboard (KPIs, leads trend, "Next up" checklist), Pages, Articles, Collections, Media, Leads, Newsletter, SEO (meta, redirects, sitemap), Marketing (consent, tracking, custom code), Appearance (theme tokens with live preview), Settings, Users, Audit log, Account (profile, password, 2FA, sessions).
- Schema-driven forms: Zod schema + UI metadata registry → `SchemaForm` widgets (text, textarea with counter, rich text, link picker, media picker, number, toggle, select, sortable list, group, colour, collection picker). Validate with the same Zod schema.
- Autosave for drafts with a save-state indicator, unsaved-changes guard, ⌘S to save, optimistic UI with rollback.
- ⌘K command palette across sections and records. Empty states with a CTA, skeletons, error boundaries with retry.
- Responsive: sidebar becomes a sheet below 1024 px; tables become cards on phones. WCAG 2.2 AA, keyboard drag and drop, visible focus.
- Optional AI assistant panel: provider + model + API key configured in Settings (key encrypted at rest, only a 4-char hint shown), role allow-list, "Test connection" button, chat with page/screen context, conversation history. Off until configured.

## Forms, leads, email

- Public forms post to `/v1/public/*` with Zod validation, honeypot + optional Turnstile, rate limit, consent capture.
- Leads inbox: status workflow, assignee, notes/activity timeline, CSV export, retention purge via cron.
- Transactional email: invite, password reset, lead notification to staff, lead acknowledgement to visitor, newsletter double opt-in. All templates in `emails/`.

## SEO, marketing, theming

- Per-page meta, canonical, Open Graph image generation, JSON-LD, `sitemap.ts`, `robots.ts`, redirects table resolved before 404.
- Own lightweight consent manager; GTM/GA4/pixel loaders only after consent; typed dataLayer event catalogue; optional server-side conversions API.
- Theme engine: OKLCH tokens, presets, WCAG contrast checks, draft → publish.
- Custom head/body code only for owners, with CSP implications documented.

## Security and privacy

- Secrets at rest (AI keys, API tokens) encrypted with AES-256-GCM using `APP_ENCRYPTION_KEY` and a per-purpose AAD. Never return secrets to the client.
- Validate env with Zod at startup (`server/env.ts`); fail fast with a readable message. `SITE_ENV = development | staging | production`.
- `sameOrigin` on unsafe admin methods, secure headers, body limits, upload MIME/size checks, no secrets in logs.

## Operations (scripts that must exist and be documented)

- `db:up` (docker compose), `db:generate`, `db:migrate`; **migrations also run at container boot** before the server starts.
- `db:seed`: idempotent content seed from fixtures; refuses to run against a database that is not provably disposable unless `--allow-production` is passed.
- `admin:create --email --name`: bootstrap the first owner (sends a set-password link). Bundled for use inside the production container.
- `owner:recover`: regain access when the only owner is locked out.
- `demo:seed`: one account per role (`<role>@demo.local`, one shared password from an env var or flag), idempotent (create or reset password + role). Guarded like `db:seed`. Documented as "remove before handover".
- `db:sync`: copy one environment's database to another: back up the target first, dump the source (skip sessions, verification tokens and rate-limit rows), restore in a single transaction, then fix up environment-bound data: **re-encrypt every encrypted secret from the source `APP_ENCRYPTION_KEY` to the target key**, clear two-factor secrets (they are bound to the auth secret), and re-apply demo passwords. Verify by signing in and calling the AI "test connection" endpoint.
- Daily database backups plus a `restore-drill` script that restores the latest backup into a scratch database and checks row counts.
- Dockerfile (standalone output, non-root, `HEALTHCHECK` on `/api/v1/health/live`), CI (lint, typecheck, unit, integration with a Postgres service, build, E2E), deploy only after CI passes.
- `docs/runbook.md` (deploy, rollback, rotate secrets, restore, owner lockout) and `docs/launch.md` (checklist split into "agent did" and "owner must do").

## Testing

- Unit: permissions matrix, schema validation, theme/colour maths, secret encryption round trip.
- Integration (real Postgres, reset per test): every service, including RBAC denials and audit writes.
- E2E (Playwright, own `_e2e` database seeded with one user per role): sign-in per role, invite → set password, password reset, 2FA on/off, editing and publishing a page, author cannot publish, intake sees only leads, public form → lead appears, visual baselines of the admin shell.

## Phases (commit and verify after each)

0. Brief + repo audit. 1. Infra, env, DB, migrations, Docker. 2. Auth, RBAC, users, audit. 3. Tokenise the public site. 4. Content model, block registry, public rendering from DB with caching. 5. Admin shell + pages/collections editors. 6. Articles, revisions, scheduling, preview. 7. Media. 8. Forms, leads, email, newsletter. 9. SEO + marketing + consent. 10. Theme customisation, AI assistant. 11. Hardening, E2E, ops scripts, docs, launch checklist.

## Definition of done

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass; E2E pass on a fresh `_e2e` database.
- A fresh clone works with: `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm demo:seed && pnpm dev`.
- Every role can sign in and sees exactly what the matrix allows.
- The public site renders entirely from the database, and an edit in the admin shows on the site after publish.
- Production can be bootstrapped with only: env vars set, deploy, `admin-create` in the container.
- Report honestly at the end: what is done and verified, what is pending, and which steps only the owner can do.
