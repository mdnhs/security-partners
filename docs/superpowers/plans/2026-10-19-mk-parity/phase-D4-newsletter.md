# Phase D4 — Newsletter

> Newsletter removed 2026-10-20 at owner request (migration `0020_remove_newsletter`).

> Part of `docs/superpowers/plans/2026-10-19-mk-parity.md`. Spec §0 (dated note), §3 ruling 2, §7.4, §8 (0017), §11, §13. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship an MK-equivalent newsletter. It covers double opt-in signup, confirmation and unsubscribe, a subscriber list with tabs, search, delete and CSV export, the settings page, retention and a dashboard KPI. The public form is placed only when an admin turns it on; the default is **off**.

**Architecture:**
- MK `server/modules/newsletter/*` is the reference implementation, at `/Users/nazmulhasansourab/ireland/james-whitfield/server/modules/newsletter/service.ts`.
- It is ported onto SP primitives: `getDb`, the repo layer, `consumeRateLimit`/`rateLimitKey`, `hashIp`, `mailer.send`, `verifyTurnstileToken`, `writeAudit`, `toCsv` (D1.8), the HKDF `deriveKey("newsletter")` and the settings key `newsletter` (draft/publish).
- Public pages `/newsletter/[state]` are new URLs that reuse `PageHero` and the legal body styles.

**Tech Stack:** existing, plus React Email (`react-email` 6.11.2) for the confirmation email.

## Global Constraints

The master plan's constraints apply, plus:

- **Ruling 2:** `newsletter.placement` is seeded `"off"`. With it off, `/blog` and `/blog/<slug>` render byte-identically, so the 40 public baselines stay at 0 px.
- **Anti-enumeration:** every valid subscribe answers `201 { ok: true }`. A confirmed address is never re-mailed. An unsubscribe with a forged token answers the same as a real one.
- **Tokens:** confirm tokens are 32 random bytes and only their sha256 is stored, with a 7-day TTL. Unsubscribe tokens are `<id>.<HMAC-SHA256(deriveKey("newsletter"), id) base64url[:32]>`, compared with `timingSafeEqual`.
- **Unsubscribe is POST-only.** `GET /newsletter/unsubscribe?token=` renders a confirm button page. Confirm is GET, which is safe because it is single-use.
- **Abuse limits:** rate limit 5 per 10 min per IP hash and 5 per 10 min per email hash, honeypot `website`, and Turnstile when configured (same `assertHuman` as leads).
- **Referrer:** `/newsletter/*` pages set `referrer: "no-referrer"` and `robots: noindex`.

## Review Focus

1. **Address case and whitespace.** `" Ann@Example.IE "` and `"ann@example.ie"` are the same subscriber: the input is lower-cased and trimmed, and the DB checks `email = lower(email)`. Pinned in D4.1.
2. **Re-subscribe after unsubscribe.** The row goes back to pending, gets a new token and keeps `unsubscribed_at` as history; the admin "Unsubscribed" tab no longer lists it. Pinned in D4.1.
3. **Expired or reused confirm link.** It redirects to `/newsletter/invalid` and the row stays pending. Pinned in D4.1.
4. **Placement turned on, then the newsletter settings left half-filled.** The publish refine requires title, button, success text and confirmation email subject when `placement !== "off"`, so a blank form can never go live. Pinned in D4.3.
5. **SMTP not configured.** Subscribe still answers 201. The failure is logged by recipient domain only, and the dashboard "Next up" SMTP item already covers it. Pinned in D4.1 (mailer mock returns `delivered: false`).

---

### Task D4.1: Data, service, public + admin API, email, permission (migration 0017)

**Files:**

- Create:
  - `server/db/schema/newsletter.ts`
  - `server/db/migrations/0017_newsletter.sql`
  - `server/modules/newsletter/{repo,service,routes,public-routes}.ts`
  - `lib/schemas/api/newsletter.ts`
  - `lib/schemas/settings/newsletter.ts`
  - `emails/newsletter-confirmation.tsx`
  - `tests/integration/api/newsletter.test.ts`
  - `tests/integration/db/newsletter-migration.test.ts`
- Modify:
  - `server/db/schema/index.ts`
  - `lib/schemas/settings/index.ts` (`newsletter` key)
  - `server/lib/crypto.ts` (`KeyPurpose` + `"newsletter"`)
  - `server/lib/mailer.ts` (`MailTemplate` + `"newsletter-confirmation"`)
  - `lib/auth/permissions.ts` (`newsletter: ["read","export","delete"]`; owner/admin all; marketer read+export)
  - `tests/unit/permissions.test.ts`
  - `server/api/app.ts` (mount `/api/v1/public/newsletter` and `/api/v1/admin/newsletter`)
  - `server/lib/cache-tags.ts` (`tag.newsletter`)
  - `server/db/seed/fixtures/settings.ts`

**Interfaces:**

```ts
// server/db/schema/newsletter.ts — spec §7.4 columns; id uuid v7; checks newsletter_email_lower, newsletter_status; index (status, created_at)
export const NEWSLETTER_STATUSES = ["pending", "confirmed", "unsubscribed"] as const
// lib/schemas/settings/newsletter.ts
export const NEWSLETTER_PLACEMENTS = ["off", "blog", "article"] as const
export const newsletterSettings = z.object({
  placement: z.enum(NEWSLETTER_PLACEMENTS), doubleOptIn: z.boolean(), pendingDays: z.number().int().min(1).max(90),
  eyebrow: z.string().max(40), title: z.string().max(120), subtitle: z.string().max(240), emailLabel: z.string().max(40),
  placeholder: z.string().max(60), button: z.string().max(30), success: z.string().max(200),
  errors: z.object({ email: z.string().max(80), rateLimited: z.string().max(160), generic: z.string().max(160) }),
  confirmationEmail: z.object({ subject: z.string().max(120), body: z.string().max(2000) }),
  pages: z.object({ confirmed: statePage, invalid: statePage, unsubscribe: statePage.extend({ button: z.string().max(40) }), unsubscribed: statePage }),
}).superRefine(/* placement !== "off" ⇒ title, button, success, confirmationEmail.subject non-empty */)
const statePage = z.object({ title: z.string().max(80), body: z.string().max(400) })
export type NewsletterPublicCopy = Pick<NewsletterSettings, "eyebrow" | "title" | "subtitle" | "emailLabel" | "placeholder" | "button" | "success" | "errors">
export function toPublicCopy(s: NewsletterSettings): NewsletterPublicCopy
// lib/schemas/api/newsletter.ts
export const newsletterSubmission = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(320)), website: z.unknown().optional(), sourcePath: z.string().max(300).regex(/^\/(?![\/\\])[^\s\\]*$/).optional(), turnstileToken: z.string().max(2048).optional() })
export const subscriberListQuery = listQuery.extend({ status: z.enum(NEWSLETTER_STATUSES).optional() })
export const subscriberExportQuery = z.object({ status: z.enum(["all", "confirmed"]).default("confirmed") })
export type SubscriberDto = { id: string; email: string; status: NewsletterStatus; sourcePath: string; createdAt: string; confirmedAt: string | null; unsubscribedAt: string | null }
// server/modules/newsletter/service.ts
export const NEWSLETTER_LIMIT = { bucket: "newsletter", max: 5, windowMs: 600_000 } as const
export const CONFIRM_TTL_MS = 7 * 86_400_000
export function unsubscribeToken(id: string): string
export function readUnsubscribeToken(token: string): string | null
export async function subscribe(input: NewsletterSubmission, ctx: { ip: string | null; now?: Date }): Promise<{ ok: true }>
export async function confirm(token: string, now?: Date): Promise<boolean>
export async function unsubscribe(token: string, now?: Date): Promise<void>
export async function listSubscribers(actor: Actor, q: SubscriberListQuery): Promise<List<SubscriberDto>>
export async function exportSubscribers(actor: Actor, status: "all" | "confirmed"): Promise<string>   // toCsv; audit "newsletter.exported"
export async function deleteSubscriber(actor: Actor, id: string): Promise<{ ok: true }>               // audit "newsletter.deleted"
export async function purgeStalePending(now?: Date): Promise<number>                                  // pending older than settings.pendingDays (token expiry, else updated_at)
export async function countSubscribers(): Promise<{ confirmed: number; since30d: number }>
export async function findSubscriberByEmail(email: string): Promise<SubscriberDto | null>              // DSAR helper
export async function eraseSubscriberByEmail(actor: Actor, email: string): Promise<number>
// emails/newsletter-confirmation.tsx
export function NewsletterConfirmation(props: { subject: string; body: string; confirmUrl: string; unsubscribeUrl: string; siteName: string }): JSX.Element
```

**Routes.** Every route checks `can()` before `zv()`.

| Route | Rules | Response |
|---|---|---|
| `POST /api/v1/public/newsletter` | `rateLimit(NEWSLETTER_LIMIT)`, `zv(newsletterSubmission)`; also requires the settings `placement !== "off"`, or that a published builder page contains a `newsletter` block (D5 adds that check behind a function `newsletterAcceptsSignups()`; until D5 it means `placement !== "off"`) | 201 `{ ok: true }`, or 404 when not accepting |
| `GET /api/v1/public/newsletter/confirm?token=` | — | 303 to `/newsletter/confirmed` or `/newsletter/invalid` |
| `POST /api/v1/public/newsletter/unsubscribe` | form or JSON `{ token }` | 303 to `/newsletter/unsubscribed` |
| `GET /api/v1/admin/newsletter` | `newsletter:read` | list |
| `GET /api/v1/admin/newsletter/export.csv` | `newsletter:export` | CSV, `Content-Disposition: attachment; filename="subscribers-YYYY-MM-DD.csv"`, `no-store` |
| `DELETE /api/v1/admin/newsletter/:id` | `newsletter:delete` | — |

**Migration 0017.**
1. Generate the table with `pnpm db:generate --name newsletter`.
2. Append an insert for the `settings` row `newsletter`, with `ON CONFLICT DO NOTHING`. Default draft and published values: `placement:"off"`, `doubleOptIn:true`, `pendingDays:30`. The copy comes from the fixture: eyebrow "Newsletter", title "Security insights in your inbox", subtitle "One short email a month. Unsubscribe any time.", button "Subscribe", success "Check your inbox to confirm your subscription.", plus the errors and the state pages.
3. Write the exact JSON with `JSON.stringify(fixture.newsletter)`.

- [ ] **Step 1: Write the failing tests** (port MK's five cases plus SP specifics)

```ts
it("creates a pending row with a hashed token and mails a confirm link", …)            // mailer spy; token not stored in clear; link contains /api/v1/public/newsletter/confirm?token=
it("answers identically for new, pending and confirmed and never re-mails a confirmed one", …)
it("expires confirm tokens after 7 days", …)
it("unsubscribes by POST only; a forged token answers the same", …)
it("confirms directly when doubleOptIn is off; honeypot is silent", …)
it("normalises case/whitespace", …)
it("re-subscribe after unsubscribe → pending with new token, unsubscribed_at kept", …)
it("placement off → POST 404", …)
it("SMTP unconfigured still 201", …)
it("marketer lists/exports, cannot delete; editor 403; export CSV guards formulas", …)
```

Also update the permission matrix test.

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
pnpm test:integration tests/integration/api/newsletter.test.ts
```

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
pnpm test:integration tests/integration/api/newsletter.test.ts tests/integration/db/newsletter-migration.test.ts && pnpm vitest run --project unit tests/unit/permissions.test.ts
```

- [ ] **Step 5: Commit** with the message `feat(newsletter): double opt-in subscribers, public and admin API`

---

### Task D4.2: Public form, state pages, placements (off by default)

**Files:**

- Create:
  - `components/newsletter/newsletter-form.tsx` (client)
  - `components/newsletter/newsletter-section.tsx` (server; reads published settings, returns `null` when placement does not match)
  - `app/(site)/newsletter/[state]/page.tsx`
  - `tests/dom/newsletter-form.test.tsx`
  - `tests/unit/newsletter/placement.test.ts`
  - `tests/e2e/newsletter.spec.ts`
- Modify:
  - `app/(site)/blog/page.tsx`: append `<Suspense fallback={null}><NewsletterSection where="blog" /></Suspense>` after the posts section.
  - `app/(site)/blog/[slug]/page.tsx`: the same with `where="article"` after the article body.
  - `lib/analytics/events.ts`: add `newsletter_sign_up` to the union, `ANALYTICS_EVENTS` and the `EVENT_CATALOGUE` row `newsletter_sign_up | "newsletter signup accepted" | method | sign_up | CompleteRegistration`.
  - `docs/gtm-container.json`: add the trigger.
  - `server/modules/redirects/resolve.ts` / `lib/seo/redirects.ts`: add `/newsletter` to the reserved `fromPathProblem` prefixes.

**Interfaces:**

- Consumes: `NewsletterPublicCopy`, `toPublicCopy` (D4.1); `Container`, `Eyebrow`, `SectionHeading` (`components/home/section.tsx`); `buttonClassName`; `track` (`lib/analytics/events.ts`); the `useTurnstile` hook (`components/home/use-turnstile.ts`).
- Produces:

```ts
export function NewsletterForm(props: { id: string; copy: NewsletterPublicCopy }): JSX.Element
// <section id aria-labelledby>; visible <label> (sr-only allowed) + input type=email autoComplete=email required; honeypot name="website" (same technique as contact form)
// pending: button disabled + aria-busy; 201 → replace form with role="status" success text + track({event:"newsletter_sign_up", method:"newsletter"}); 429 rateLimited; 422/400 email; else generic in role="alert"
export async function NewsletterSection(props: { where: "blog" | "article" }): Promise<JSX.Element | null>
// await connection(); published settings; placement === where ? <NewsletterForm id="newsletter" copy={toPublicCopy(s)} /> : null; any error → null
export function shouldRender(placement: NewsletterPlacement, where: "blog" | "article"): boolean
```

**State pages.** `app/(site)/newsletter/[state]/page.tsx` handles the states `confirmed | invalid | unsubscribe | unsubscribed`; anything else is `notFound()`.
- The layout is `SiteHeader` / `PageHero` (title from the settings page copy) / body paragraph / `SiteFooter`, which is the same pattern as the legal template.
- For `unsubscribe`, render a `<form method="post" action="/api/v1/public/newsletter/unsubscribe">` with a hidden token from `searchParams` and the button.
- Set `metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" }`.
- Make sure `resolvePublicPath` passes `/newsletter/*`. Add it to the pass list if the proxy would otherwise 404 it.

- [ ] **Step 1: Write the failing tests**

```ts
it("shouldRender: off never renders", () => { expect(shouldRender("off", "blog")).toBe(false); expect(shouldRender("blog", "article")).toBe(false); expect(shouldRender("blog", "blog")).toBe(true) })
```

DOM tests:
- The success path swaps to `role=status` and calls `track`.
- 429 shows the rate-limited copy.
- The input has an accessible name.

E2E test, with the owner setting `placement:"blog"` through the API and publishing it: visit `/blog`, subscribe, open the Mailpit link, land on `/newsletter/confirmed`; the admin list then shows the subscriber as confirmed. Then unsubscribe via the email link: the button page leads to `/newsletter/unsubscribed`. Finally restore `placement:"off"` in `afterAll`.

- [ ] **Step 2: Run the tests and confirm they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests and the public gate**

```bash
pnpm test:visual tests/visual/public-pages.spec.ts
pnpm test:e2e tests/e2e/newsletter.spec.ts
```

The visual run must show **0 px**, because the seeded placement is off.

- [ ] **Step 5: Commit** with the message `feat(newsletter): public form behind an off-by-default placement, state pages`

---

### Task D4.3: Admin screen, settings page, KPI, retention, DSAR

**Files:**

- Create:
  - `app/(admin)/admin/(panel)/newsletter/page.tsx`
  - `components/admin/newsletter/newsletter-view.tsx`
  - `tests/dom/newsletter-view.test.tsx`
- Modify:
  - `lib/admin/nav.ts`: item `newsletter`, Menu group after Enquiries, `MailIcon`, `{ newsletter: ["read"] }`, keywords `["subscribers","mailing list","email"]`.
  - `lib/admin/settings-keys.ts`: `newsletter` entry: label "Newsletter", group "Forms", read `{settings:["read"]}`, update `{settings:["update"]}`. The help text says: "Turning on a placement adds the signup form to the public site."
  - Settings nav children (B1 builds them from `EDITABLE_SETTINGS_KEYS`).
  - `server/lib/jobs/purge-leads.ts`, or a new `purge-newsletter.ts` registered in `RECURRING_JOBS` (daily).
  - `server/modules/dashboard/service.ts`: KPI `subscribers` when `newsletter:read` and (`placement !== "off"` or the count > 0).
  - `components/admin/leads/*`: the CSV-by-email privacy helper. It shows "Also on the newsletter list: Yes/No", with an "Erase from newsletter" action for `newsletter:delete`.
  - `tests/visual/admin-screens.spec.ts`

**Interfaces:**

- `NewsletterView()`:
  - PageHeader: "Newsletter", "People who signed up for the newsletter."
  - Actions: "Export CSV" (`newsletter:export`). It exports all statuses on the All tab and confirmed only otherwise.
  - Tabs, bound to `?tab=`: Confirmed, Pending, Unsubscribed, All.
  - Search box (debounced 300 ms).
  - DataTable with the columns Email, Status (`StatusPill`: confirmed success, pending warning, unsubscribed neutral), Source, Subscribed (`confirmedAt ?? createdAt`).
  - Row action Delete (`newsletter:delete`) behind an AlertDialog.
  - Empty state: "No subscribers yet". When placement is off it adds "Turn on a placement in Site settings › Newsletter".

- [ ] **Step 1: Write the failing tests**

DOM tests:
- Tabs drive the `status` query.
- Export is hidden without `newsletter:export`.
- Delete asks for confirmation.

Unit test: the settings refine fails when placement is `"blog"` and the title is blank.

Integration test: the purge job removes stale pending rows only.

- [ ] **Step 2: Run the tests and confirm they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
pnpm vitest run --project dom tests/dom/newsletter-view.test.tsx && pnpm test:integration tests/integration/api/newsletter.test.ts && pnpm test:e2e tests/e2e/newsletter.spec.ts tests/e2e/roles.spec.ts
```

- [ ] **Step 5: Commit** with the message `feat(newsletter): admin list, settings page, KPI, retention and privacy helper`

---

### Task D4.4: Phase D4 gate

- [ ] **Step 1: Full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:e2e
```

- [ ] **Step 2: Public visual gate** — must show 0 px with placement off.

- [ ] **Step 3: Visual baselines**
  - Add the admin screens `newsletter` (seeded with 3 subscribers in the visual seed) and `settings-newsletter`.
  - Add a public visual baseline for `/newsletter/confirmed`. It is a new URL; put it in a separate spec, `tests/visual/newsletter-pages.spec.ts`, and do **not** add it to `PUBLIC_URLS`.
  - Re-shoot, then run the suite twice.

- [ ] **Step 4: Commit** with the message `test(visual): newsletter baselines (phase D4)`
