# Phase D2 — Marketing + events

> Part of `docs/superpowers/plans/2026-10-19-mk-parity.md`. Spec §7.2, §8 (0015), §13. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the following, all on SP's draft/publish model:
- per-channel tracking switches, a status panel and a test event
- a consent version, a re-consent interval and a live banner preview
- structured, consent-gated, route-scoped custom-code snippets with allowed hosts and a DB kill switch plus CLI
- an event catalogue page and an SPA page-view event

**Architecture:**
- Settings keys `tracking`, `consent` and `customCode` gain fields through one migration (`0015_marketing`), which D2.1 creates and D2.3 extends. They run serially.
- Public readers (`server/modules/marketing/public.ts` `loadPublicMarketing`) read **published** values only.
- Public markup changes only when tracking is enabled (seeded off), so the consent-banner baselines stay at 0 px.

**Tech Stack:** existing.

## Global Constraints

Master plan constraints, plus:
- Tag IDs (`gtmId`, `ga4Id`, `metaPixelId`) remain owner-only through `TRACKING_TAG_UPDATE` / `assertMayChangeTrackingTags`. The new channel switches only need `marketing:update`, which follows the existing ruling that marketers keep the enable toggle.
- `customCode` remains owner-only for read, write and revisions.
- The banner is shown iff `tracking.enabled`. That base ruling is unchanged.
- No new env var. The kill switch is a DB flag plus `pnpm custom-code:off`.

## Review Focus

1. **A visitor who consented under consent version 1 when the owner publishes version 2.** The cookie must be treated as absent, the banner shown again, and no analytics loaded until they choose. Pinned in D2.2 (unit test on `readConsent` with a version mismatch; e2e).
2. **Snippet route patterns.** `/blog/*` matches `/blog/x` and `/blog/x/y` but not `/blogs`. An empty list matches all. A trailing slash is normalised. Pinned in D2.3 (unit).
3. **A snippet `src` on a non-allowed host, with credentials, a port or http.** Rejected at save with a field error. Pinned in D2.3 (schema test).
4. **The kill switch while the owner is locked out.** `pnpm custom-code:off` must work with only the three env vars, write an audit row with actor null, and invalidate the cache. Pinned in D2.3 (integration test running the script function).
5. **The test event without consent.** Nothing is pushed, and the admin copy explains that a consent click is needed. Pinned in D2.1 (unit test on the loader).

---

### Task D2.1: Tracking channels, status panel, test event (migration 0015 part 1)

**Files:**
- Create:
  - `server/db/migrations/0015_marketing.sql` (custom; tracking section)
  - `lib/analytics/channel-status.ts`
  - `components/admin/marketing/tracking-status.tsx`
  - `tests/unit/analytics/channel-status.test.ts`
  - `tests/integration/db/marketing-migration.test.ts`
- Modify:
  - `lib/schemas/settings/tracking.ts`: add `gtmEnabled`, `ga4Enabled` and `metaEnabled` (booleans, default false).
  - `server/modules/marketing/public.ts`: `TrackingIds` only includes an ID when its channel is enabled.
  - `lib/analytics/loaders.ts`: `startTracking` honours the per-channel IDs, and the `sp_tracking_test` probe below.
  - `components/admin/marketing/notices.tsx`: replace `TrackingNotice` with `TrackingStatus`.
  - `app/(admin)/admin/(panel)/marketing/page.tsx`: `aside`.
  - `server/db/seed/fixtures/settings.ts`.
- Test: `tests/unit/analytics/loaders.test.ts` (extend), `tests/e2e/consent.spec.ts` (extend)

**Interfaces:**

```ts
// lib/analytics/channel-status.ts
export type Channel = "gtm" | "ga4" | "meta"
export type ChannelStatus = "off" | "ready" | "missing-id" | "needs-banner"
export function channelStatus(t: TrackingSettings, channel: Channel): ChannelStatus
// off: !<ch>Enabled; missing-id: enabled && !id; needs-banner: enabled && id && !t.enabled; ready otherwise
export const CHANNEL_LABELS: Record<Channel, string>              // "Google Tag Manager", "Google Analytics 4", "Meta Pixel"
export const STATUS_TEXT: Record<ChannelStatus, string>           // "Off", "Ready", "Add the ID", "Turn on tracking to show the consent banner"
// lib/analytics/loaders.ts
export const TRACKING_TEST_PARAM = "sp_tracking_test"
export function trackingTestId(search: string): string | null    // /^[A-Za-z0-9-]{8,40}$/ else null
// in startTracking: if analytics consent && trackingTestId(location.search) → push {event:"tracking_test", test_id} and gtag("config", ga4Id, { debug_mode: true })
```

`TrackingStatus({ value }: { value: TrackingSettings })`:
- It shows the unsaved form values (through the editor's `aside` slot, which receives the draft).
- It renders three rows, each with an icon and text (status is not shown by colour alone).
- A "Send test event" button opens `/?sp_tracking_test=<crypto.randomUUID()>` in a new tab. Next to it is the help text: "Accept analytics in the banner on that tab, then look in GTM Preview, GA4 DebugView or Meta Test Events."

Migration (tracking section, applied to the draft, published and revisions rows of `tracking`):

```sql
UPDATE "settings" SET "draft" = "draft" || jsonb_build_object(
  'gtmEnabled', ("draft"->>'enabled')::boolean AND ("draft"->>'gtmId') IS NOT NULL,
  'ga4Enabled', ("draft"->>'enabled')::boolean AND ("draft"->>'ga4Id') IS NOT NULL,
  'metaEnabled', ("draft"->>'enabled')::boolean AND ("draft"->>'metaPixelId') IS NOT NULL)
WHERE "key" = 'tracking' AND jsonb_typeof("draft") = 'object' AND NOT ("draft" ? 'gtmEnabled');
-- same for "published" and revisions(entity_type='settings', entity_id='tracking')
```

- [ ] **Step 1: Write the failing tests**
  - `channelStatus` table test covering every branch.
  - `loaders.startTracking` with `gtmEnabled=false` does not inject the GTM script.
  - `trackingTestId` rejects `<script>` and short values.
  - The test push happens only with analytics consent.
  - Migration backfill: `enabled=true` with a gtmId gives `gtmEnabled` true and `metaEnabled` false; an existing `gtmEnabled` is untouched.
  - E2E: an owner enables GA4 with an ID and the master switch, publishes, opens `/?sp_tracking_test=abcdefgh-1`, accepts, and `window.dataLayer` contains `tracking_test`.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.** Also run the public visual gate for the 40 public pages and the consent banner (0 px expected), and `pnpm test:e2e tests/e2e/consent.spec.ts`.

- [ ] **Step 5: Commit** with the message `feat(marketing): per-channel tracking switches, status panel and test event`.

---

### Task D2.2: Consent version, re-consent interval, live preview

**Files:**
- Create:
  - `components/consent/consent-banner-view.tsx`: pure presentational markup, **byte-identical** to today's banner.
  - `components/admin/marketing/consent-preview.tsx`
  - `tests/dom/consent-banner-view.test.tsx`
- Modify:
  - `lib/schemas/settings/consent.ts`: `version: z.number().int().min(1)` and `reconsentMonths: z.number().int().min(1).max(6)`.
  - `lib/analytics/consent.ts`:
    - `CONSENT_VERSION` is replaced by the parameter `version`.
    - `readConsent(raw, nowMs, version)` returns `null` when the stored version is different.
    - `consentCookie(choice, nowMs, { version, maxAgeSeconds })`.
    - `CONSENT_MAX_AGE` is removed; the max-age is `reconsentMonths * 30 * 86_400`.
  - `components/consent/{consent-banner,consent-provider}.tsx`: use the view, and pass the version and max-age from the published consent copy.
  - `templates/shared/consent.ts`: `consentBannerCopy` carries `version` and `reconsentMonths`.
  - `server/db/migrations/0015_marketing.sql`: append the consent backfill `{"version":1,"reconsentMonths":6}`, existing values winning.
  - `app/(admin)/admin/(panel)/marketing/consent/page.tsx`: aside.
- Test: `tests/unit/analytics/consent.test.ts` (extend), `tests/e2e/consent.spec.ts` (extend)

**Interfaces:**

```ts
// components/consent/consent-banner-view.tsx
export type ConsentBannerViewProps = { copy: ConsentBannerCopy; mode: "first" | "custom" | "closed"; choice: ConsentChoice; onAccept(): void; onReject(): void; onCustomise(): void; onSave(): void; onToggle(category: "analytics" | "marketing", on: boolean): void; onClose(): void; inline?: boolean }
export function ConsentBannerView(props: ConsentBannerViewProps): JSX.Element
// inline=true renders position:static for the admin preview; default keeps today's fixed positioning
// components/admin/marketing/consent-preview.tsx
export function ConsentPreview(props: { value: ConsentSettings }): JSX.Element   // segmented "First layer / Customise"; working switches with no-op persistence
```

The preview renders inside a `div` that sets the public site's CSS custom properties, which a static admin page cannot get from `globals.css`. Use `style={BANNER_PREVIEW_STYLE}`, where `lib/analytics/banner-preview-style.ts` exports the `--color-brand-*` values from `SP_SITE` (C1).

- [ ] **Step 1: Write the failing tests**

```ts
it("readConsent ignores a cookie from an older version", () => { const raw = encodeConsent({ analytics: true, marketing: false }, now, 1); expect(readConsent(raw, now, 2)).toBeNull() })
it("max-age follows reconsentMonths", () => expect(consentCookie(c, now, { version: 1, maxAgeSeconds: 2 * 30 * 86400 })).toContain("Max-Age=5184000"))
```

  - DOM test: `ConsentBannerView` `mode="first"` markup matches a snapshot taken from today's `ConsentBanner` render (capture it in the test before refactoring, via a fixture copy).
  - E2E: bumping the consent version re-shows the banner for a visitor who had already accepted.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.** Refactor `ConsentBanner` to compose `ConsentBannerView`.

- [ ] **Step 4: Run the tests and confirm they pass.** Then run `pnpm test:visual tests/visual/consent-banner.spec.ts tests/visual/public-pages.spec.ts` (**0 px**) and `pnpm test:e2e tests/e2e/consent.spec.ts`.

- [ ] **Step 5: Commit** with the message `feat(consent): versioned re-consent, interval setting and live admin preview`.

---

### Task D2.3: Custom code snippets, gating, kill switch (migration 0015 part 2)

**Files:**
- Create:
  - `lib/analytics/snippets.ts`
  - `scripts/custom-code-off.ts`
  - `components/admin/marketing/snippets-editor.tsx` (a SchemaForm list widget config is acceptable)
  - `tests/unit/analytics/snippets.test.ts`
  - `tests/integration/scripts/custom-code-off.test.ts`
- Modify:
  - `lib/schemas/settings/custom-code.ts`: replaced as below.
  - `components/consent/custom-code.tsx`: per-snippet loader, rules below.
  - `components/site-extras.tsx`: wiring.
  - `server/modules/marketing/public.ts`: `customCode` published value.
  - `package.json`: script `"custom-code:off": "pnpm tsx:server scripts/custom-code-off.ts"`.
  - `scripts/build-scripts.ts`: include the new script.
  - `server/db/migrations/0015_marketing.sql`: append the conversion.
  - `app/(admin)/admin/(panel)/marketing/code/page.tsx`: banner when disabled.

New `lib/schemas/settings/custom-code.ts`:

```ts
export const SNIPPET_CATEGORIES = ["necessary", "analytics", "marketing"] as const
export const routePattern = z.string().trim().max(120).regex(/^\/[\w\-/]*\*?$/, 'Use a path like "/" or "/blog/*"')
export const snippet = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(60), placement: z.enum(["head", "body"]), src: z.string().trim().max(500), html: z.string().max(20_000), category: z.enum(SNIPPET_CATEGORIES), routes: z.array(routePattern).max(20), enabled: z.boolean() })
export const customCodeSettings = z.object({ disabled: z.boolean(), allowedHosts: z.array(hostname).max(20), snippets: z.array(snippet).max(20) })
  .superRefine(/* src XOR html; src https + host ∈ allowedHosts + no credentials/port → path ["snippets", i, "src"] */)
```

Custom code loader rules (`components/consent/custom-code.tsx`):
- `CustomCodeSnippets` is a server component. It emits one inline loader per placement holding a JSON payload of the runnable snippets.
- The JSON is escaped `<` → `<` (the existing `customCodeScript` technique).
- The loader runs a `necessary` snippet immediately. Consent-gated snippets wait on `window.__spConsent` updates; the existing `ConsentProvider` dispatches a `sp:consent` event.
- `html` snippets use `Range.createContextualFragment`. `src` snippets create a `<script src async>`.

**Interfaces:**

```ts
// lib/analytics/snippets.ts
export function routeMatches(pattern: string, pathname: string): boolean   // "/" exact; "/x/*" → "/x" or "/x/…"; others exact; trailing slash ignored
export function runnableSnippets(cfg: CustomCodeSettings, pathname: string, placement: "head" | "body"): Snippet[]  // [] when disabled; enabled && routes match (empty = all)
export function snippetAllowed(s: Snippet, consent: ConsentChoice | null): boolean // necessary → true; analytics/marketing → consent?.[category] === true
export function convertLegacyCustomCode(old: { headHtml: string; bodyEndHtml: string }): CustomCodeSettings
// non-empty head → { name: "Head code", placement: "head", html, category: "necessary", routes: [], enabled: true }; same for body ("Body code"); disabled false; allowedHosts []
// scripts/custom-code-off.ts
export async function customCodeOff(db: Db, now?: Date): Promise<void>  // sets published.disabled=true (and draft), writeAudit(db, null, { action: "customCode.killSwitch" }), POSTs internal revalidate for tag.settings("customCode")
```

The migration conversion is written in SQL. It builds `snippets` with `gen_random_uuid()` cast to text (uuid v4 is acceptable for jsonb snippet ids; note this in the report), only when `draft ? 'headHtml'`. The unit test checks `convertLegacyCustomCode` against the same expected JSON, and the integration test checks the SQL result.

- [ ] **Step 1: Write the failing tests**
  - `routeMatches` cases.
  - `runnableSnippets` returns `[]` when `disabled`.
  - `snippetAllowed` gating.
  - Schema: a src on a non-allowed host gives an error on `snippets.0.src`; `https://user:pw@host` is rejected; `:8080` is rejected; src and html together are rejected.
  - Migration: legacy head HTML becomes one necessary snippet.
  - The kill switch script sets disabled and audits.
  - E2E (owner): add an analytics snippet that sets `window.__probe=1` on `/blog/*`, publish, and enable tracking. Visit `/blog` before consent and `__probe` is undefined; accept and it is 1; visit `/` and it is undefined.
  - E2E: an admin gets 403 on GET `/api/v1/admin/marketing/customCode` (owner-only kept).

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.** Then run the public visual gate (0 px) and `pnpm test:e2e tests/e2e/consent.spec.ts tests/e2e/custom-code.spec.ts`.

- [ ] **Step 5: Commit** with the message `feat(marketing): consent-gated route-scoped snippets with allowed hosts and kill switch`.

---

### Task D2.4: Event catalogue page, SPA page view, GTM container

**Files:**
- Create:
  - `app/(admin)/admin/(panel)/marketing/events/page.tsx`
  - `components/admin/marketing/events-view.tsx`
  - `docs/gtm-container.json`
  - `components/consent/route-tracker.tsx`
  - `tests/unit/analytics/catalogue.test.ts`
  - `tests/dom/route-tracker.test.tsx`
- Modify:
  - `lib/analytics/events.ts`:
    - `ANALYTICS_EVENTS` gains `"page_view_virtual"` and `"tracking_test"`.
    - The union gains `{ event: "page_view_virtual"; page_path: string; page_title: string }` and `{ event: "tracking_test"; test_id: string }`.
    - Add `EVENT_CATALOGUE`.
  - `components/consent/tracking-scripts.tsx`: mount `RouteTracker`.
  - `lib/admin/nav.ts`: Marketing child `marketing-events` "Event catalogue" `/admin/marketing/events` `{ marketing: ["read"] }`, placed between Consent banner and Custom code.

**Interfaces:**

```ts
export const EVENT_CATALOGUE: readonly { event: AnalyticsEvent["event"]; firesWhen: string; params: readonly string[]; ga4: string; meta: string | null }[]
// rows:
// page_view_virtual | "each page change after the first" | page_path, page_title | page_view | PageView
// lead_submitted    | "the contact form was accepted" | source_page | generate_lead | Lead
// cta_click         | "links to /contact" | link_text, link_url | select_content | —
// phone_click       | "tel: links" | link_url | contact | Contact
// email_click       | "mailto: links" | link_url | contact | Contact
// tracking_test     | "the admin's Send test event" | test_id | tracking_test | —
export function RouteTracker(): null   // usePathname effect; skips first render; requestAnimationFrame then track({event:"page_view_virtual", page_path, page_title: document.title})
```

- The events page is a table with the columns Event / Fires when / Params / GA4 / Meta, plus the note: "To set up Google Tag Manager, import `docs/gtm-container.json` (ask your developer for the file)."
- `docs/gtm-container.json` is a valid GTM export (`exportFormatVersion: 2`) with one Custom Event trigger and one GA4 Event tag per catalogue row, plus Data Layer Variables for the params.
- The unit test asserts that every catalogue event has a trigger in the JSON, which keeps the two in sync.

- [ ] **Step 1: Write the failing tests**
  - Every `ANALYTICS_EVENTS` entry has a catalogue row, and every row has a GTM trigger.
  - `RouteTracker` pushes on the second pathname and not the first, and only with consent (it uses `track`, which already checks).
  - E2E: a marketer sees the Event catalogue tab and table.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.** Then run the public gate (0 px).

- [ ] **Step 5: Commit** with the message `feat(marketing): event catalogue, SPA page-view event, GTM container`.

---

### Task D2.5: Phase D2 gate

- [ ] **Step 1: Run the full suite.**

```bash
pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build && pnpm test:e2e
```

- [ ] **Step 2: Run the public and consent visual specs.** Expect 0 px.

- [ ] **Step 3: Re-shoot the admin baselines.** Cover tracking (with the status panel), consent (with the preview), events and code (snippets list). Run the update, then `pnpm test:visual` twice.

- [ ] **Step 4: Commit** with the message `test(visual): re-baseline admin for marketing (phase D2)`.
