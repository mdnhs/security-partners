# Phase D3 — Leads, users, dashboard

> Part of `docs/superpowers/plans/2026-10-19-mk-parity.md`. Spec §7.3, §8 (0016), §13. Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the MK-style Enquiries screen:
- UTM, referrer and landing-page attribution
- Inbox and Spam tabs
- a Board/Table toggle
- a side drawer for each enquiry

Also give Users & roles a permission matrix, and give the dashboard KPI deltas, a week-vs-week chart and a content QA list.

**Architecture:**
- Attribution is captured client-side into `sessionStorage` and sent with the existing lead POST. The contact form's markup does not change.
- The leads screen keeps its URL-synced filters and adds `folder`, `view` and `lead` params.
- The dashboard DTO gains fields; the pure helpers live in `lib/`.

**Tech Stack:** existing (dnd-kit core 6.3.1 / sortable 10.0.0).

## Global Constraints

The master plan constraints apply, plus:
- `components/home/contact-form.tsx` markup is untouched; only the POST body changes. The public 0 px gate runs on D3.1.
- Lead statuses stay `new → contacted → qualified → won | lost | spam`.
- Attribution never stores a full referrer URL with a query string. It stores origin + path, each value at most 200 chars.

## Review Focus

1. **Attribution input from hostile URLs.** Examples: `?utm_source=<script>`, 10 KB values, `javascript:` referrers. Values must be trimmed, length-capped and treated as plain text everywhere (drawer, CSV with the formula guard). Pinned in D3.1 (unit and integration).
2. **Drag on the board by keyboard and screen reader.** Space picks up, arrows move between columns, Space drops, and the status change is announced. A failed PATCH snaps the card back with an error toast. Pinned in D3.3 (DOM).
3. **An intake user opening the drawer for a lead that was deleted meanwhile.** The drawer shows "This enquiry no longer exists" and clears `?lead`. Pinned in D3.2 (DOM).
4. **Week boundaries in `Europe/Dublin` around the DST change** (last Sunday of October). The week runs Monday 00:00 local to Sunday 23:59 local, and has 7 buckets. Pinned in D3.5 (unit test with dates 2026-10-26 and 2026-03-30).
5. **KPI delta when the previous period is 0.** It shows "New" and never shows "∞%" or NaN. Pinned in D3.5 (unit).

---

### Task D3.1: Lead attribution (migration 0016)

**Files:**
- Create:
  - `lib/leads/attribution.ts`
  - `components/attribution-capture.tsx` (client, renders nothing)
  - `server/db/migrations/0016_lead_attribution.sql`
  - `tests/unit/leads/attribution.test.ts`
  - `tests/integration/api/leads-attribution.test.ts`
- Modify:
  - `app/(site)/layout.tsx`: mount `<AttributionCapture />`. It renders `null`, so there are no pixels.
  - `components/home/contact-form.tsx`: add `attribution: readAttribution(sessionStorage)` to the JSON body only.
  - `lib/schemas/api/leads.ts`: `leadSubmission.attribution` optional; `LeadDto.attribution`.
  - `server/db/schema/leads.ts`: `attribution: jsonb("attribution").$type<Attribution>()`.
  - `server/modules/leads/service.ts`: store it; CSV columns appended: `Referrer`, `Landing page`, `UTM source`, `UTM medium`, `UTM campaign`, `UTM term`, `UTM content`.
  - Lead detail UI: a "Source" section.

**Interfaces:**

```ts
// lib/leads/attribution.ts
export const ATTRIBUTION_KEY = "sp_attribution"
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const
export const attributionSchema = z.object({ referrer: z.string().max(200).nullable(), landingPath: z.string().max(200), utm: z.partialRecord(z.enum(UTM_KEYS), z.string().max(200)), capturedAt: z.iso.datetime() })
export type Attribution = z.infer<typeof attributionSchema>
export function captureAttribution(loc: { pathname: string; search: string; origin: string }, referrer: string, storage: Pick<Storage, "getItem" | "setItem">, now?: Date): void
// first touch wins (no overwrite if key exists); referrer kept only when external (origin differs) as origin+pathname; control chars stripped; try/catch around storage
export function readAttribution(storage: Pick<Storage, "getItem">): Attribution | null   // parse + schema; null on any failure
```

- [ ] **Step 1: Write the failing tests**

```ts
it("captures UTMs and landing path on first visit only", …)
it("drops internal referrers; keeps external origin+path without query", () => { captureAttribution(loc, "https://google.com/search?q=secret", store); expect(readAttribution(store)!.referrer).toBe("https://google.com/search") })
it("caps values at 200 and strips control characters", …)
it("storage that throws does not break", …)
```

Integration:
- A lead with attribution round-trips to `GET /leads/:id`.
- An oversized value returns 422.
- The CSV has the new columns, and a formula-like UTM gets the `'` guard.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**
  1. Run `pnpm db:generate` with the name `lead_attribution`.
  2. Implement the code.

- [ ] **Step 4: Run the tests and confirm they pass.**
  1. Public gate: `pnpm test:visual tests/visual/public-pages.spec.ts` must show 0 px.
  2. Run `pnpm test:e2e tests/e2e/leads.spec.ts`.

- [ ] **Step 5: Commit** with the message `feat(leads): first-touch UTM, referrer and landing attribution`.

---

### Task D3.2: Inbox/Spam tabs, drawer, detail redirect

**Files:**
- Create:
  - `components/admin/leads/lead-drawer.tsx`
  - `components/admin/leads/use-leads-params.ts`
  - `tests/dom/leads-screen.test.tsx`
- Modify:
  - `components/admin/leads/leads-screen.tsx`
  - `components/admin/leads/lead-detail.tsx`: extract its body into `LeadDetailBody({ id, onMissing })`, used by the drawer.
  - `app/(admin)/admin/(panel)/leads/[id]/page.tsx`: `redirect(\`/admin/leads?lead=${id}\`)` after `requirePage("/admin/leads")`.
  - `lib/admin/legacy-redirects.ts`: not needed (the page handles it). Leave a comment pointing to this file.
  - `tests/e2e/leads.spec.ts`

**Interfaces:**

```ts
// use-leads-params.ts
export type LeadsParams = { folder: "inbox" | "spam"; view: "board" | "table"; lead: string | null; status?: LeadStatus | "open" | "all"; q?: string; page: number }
export function useLeadsParams(): [LeadsParams, (patch: Partial<LeadsParams>) => void]
// view persisted to localStorage "sp-leads-view" (try/catch); folder=spam → status=spam and forces view=table
// lead-drawer.tsx
export function LeadDrawer(props: { id: string | null; onClose(): void }): JSX.Element   // Sheet side="right" w-full sm:max-w-xl; title = lead name; sections Contact, Message, Source, Status & assignee, Notes, Activity
```

- Tabs: "Inbox" and "Spam".
- Board/Table toggle: a `ToggleGroup` with labels and icons.
- Clicking a row (or card) sets `lead`. Esc or the close button clears it.

- [ ] **Step 1: Write the failing tests.**
  - The Spam tab requests `status=spam` and hides the board toggle.
  - A row click opens the drawer with the lead name heading.
  - A missing lead shows the message and clears the param.

  E2E:
  - `/admin/leads/<id>` lands on the drawer.
  - The Back button closes the drawer.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.**

```bash
pnpm vitest run --project dom tests/dom/leads-screen.test.tsx && pnpm test:e2e tests/e2e/leads.spec.ts
```

- [ ] **Step 5: Commit** with the message `feat(leads): inbox/spam tabs and side drawer`.

---

### Task D3.3: Leads board

**Files:**
- Create:
  - `components/admin/leads/leads-board.tsx`
  - `tests/dom/leads-board.test.tsx`
- Modify: `components/admin/leads/leads-screen.tsx` (renders the board when `view=board` and `folder=inbox`)

**Interfaces:**

```ts
export const BOARD_COLUMNS = ["new", "contacted", "qualified", "won", "lost"] as const
export function LeadsBoard(props: { leads: LeadListItem[]; canUpdate: boolean; onOpen(id: string): void; onMove(id: string, status: LeadStatus): Promise<void> }): JSX.Element
```

- Built from `DndContext`, `useDroppable` per column and `useDraggable` per card.
- Sensors: `PointerSensor({ activationConstraint: { distance: 6 } })` and `KeyboardSensor`.
- Announcements: "Picked up enquiry from {name}", "Moved to {column}", "Dropped in {column}".
- Optimistic move with rollback on error; error toast "Couldn't move that enquiry".
- Column header: label + count.
- Card: name, company, service, relative time and assignee initials.
- Each card is also a button that opens the drawer.
- Without `canUpdate`, dragging is disabled, but cards still open.
- Board data: the list query with `pageSize: 100` and `status=open|won|lost`. When more exist, show "Showing the latest 100".

- [ ] **Step 1: Write the failing DOM tests.**
  - Keyboard move: focus a card, Space, ArrowRight, Space. `onMove` is called with `(id, "contacted")` and the live region text is updated.
  - A rejected `onMove` puts the card back in its column.
  - With `canUpdate=false`, Space does not pick up the card.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.**

- [ ] **Step 5: Commit** with the message `feat(leads): kanban board with keyboard drag`.

---

### Task D3.4: Users & roles — People/Roles tabs, permission matrix

**Files:**
- Create:
  - `lib/auth/matrix.ts`
  - `components/admin/users/permission-matrix.tsx`
  - `tests/unit/auth/matrix.test.ts`
  - `tests/dom/permission-matrix.test.tsx`
- Modify:
  - `components/admin/users/users-screen.tsx`: top `Tabs` "People" / "Roles" (`?tab=`).
  - PageHeader "Users & roles".

**Interfaces:**

```ts
// lib/auth/matrix.ts
export type MatrixCell = "yes" | "no" | "own"
export type MatrixRow = { resource: Resource; action: string; cells: Record<Role, MatrixCell> }
export function permissionMatrix(): MatrixRow[]   // from statements × ROLE_GRANTS; "own" for author article update/delete (no updateAny/deleteAny)
export const RESOURCE_LABELS: Record<Resource, string>; export const ACTION_LABELS: Record<string, string>
```

- `PermissionMatrix()` renders a `Table`.
  - Rows are grouped by resource (row header `scope="rowgroup"`).
  - Columns are roles.
  - Cells are a `CheckIcon` with sr "Allowed", a `MinusIcon` with sr "Not allowed", or the pill "Own only".
- Above the table is a `<dl>` with one line per role, using the existing role descriptions.

- [ ] **Step 1: Write the failing tests.**
  - The matrix row for `customCode.update` is "yes" only for owner.
  - `article.update` is "own" for author.
  - Every statement action has a row.
  - DOM: the Roles tab shows the table with an accessible name, "Users & roles: permissions".

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests and confirm they pass.**

- [ ] **Step 5: Commit** with the message `feat(users): People/Roles tabs with permission matrix`.

---

### Task D3.5: Dashboard — deltas, week vs week, content QA, health, Next-up

**Files:**
- Create:
  - `lib/dashboard/week.ts`
  - `lib/content/qa.ts`
  - `components/admin/dashboard/content-qa.tsx`
  - `tests/unit/dashboard/week.test.ts`
  - `tests/unit/content/qa.test.ts`
  - `tests/integration/api/dashboard.test.ts` (extend)
- Modify:
  - `lib/schemas/api/dashboard.ts`
  - `server/modules/dashboard/{service,repo}.ts`
  - `components/admin/dashboard/{dashboard,content-health,next-up}.tsx`
  - `components/admin/kit/format.ts` (`formatDelta`, "New" rule)

**Interfaces:**

```ts
// lib/dashboard/week.ts
export type WeekDay = { key: string; label: string }       // key yyyy-MM-dd (Europe/Dublin), label "Mon"
export function weekWindow(now: Date, tz?: "Europe/Dublin"): { start: Date; end: Date; previousStart: Date; days: WeekDay[]; previousDays: WeekDay[] }
// lib/content/qa.ts
export type QaRuleId = "placeholder-contact" | "placeholder-copy" | "legal-unpublished"
export type QaFinding = { rule: QaRuleId; label: string; href: string; message: string }
export function scanContent(input: { settings: Record<string, unknown>; pages: { key: string; data: unknown; published: boolean; updatedSinceSeed: boolean }[]; services: { id: string; title: string; data: unknown }[] }): QaFinding[]
// placeholder-contact: strings matching /\[(email|phone)\]|example\.(com|ie)|\b0{3,}\b/i in settings.contact/footer
// placeholder-copy: /lorem ipsum|\bTODO\b|\bTBC\b|\[[^\]]{1,40}\]/i in any string of pages/services/settings
// legal-unpublished: privacy/terms not published or updatedSinceSeed=false → href /admin/pages/<key>
// lib/schemas/api/dashboard.ts additions
kpis: { leads30d: { value: number; previous: number } | null; openLeads: number | null; published: …; inReview: number | null; seoScore: number | null }
enquiriesWeek: { days: { key: string; label: string; current: number; previous: number }[]; current: number; previous: number } | null
contentHealth: { complete: number; needsWork: number; missing: number } | null     // from getSeoHealth: missing = entities with description or alt-text failing
qa: QaFinding[] | null                                                              // settings:read or page:read
nextUp: NextUpItem[]                                                                // + { id: "reply", title: `Reply to ${name}`, href: `/admin/leads?lead=${id}` } (oldest new lead, lead:read)
// components/admin/kit/format.ts
export function formatDelta(current: number, previous: number): Delta | null   // previous 0 & current 0 → {label:"No change",direction:"flat"}; previous 0 & current>0 → {label:"New",direction:"up"}; else ±x.x%
```

- Dashboard layout:
  - KPI row: hero "New enquiries" with a delta, Open enquiries, Published content, SEO health (links `/admin/seo`). Every KPI has an `href` (A4).
  - Card "Enquiries this week": `PillBarChart` with the legend This week / Last week.
  - "Content health": a 3-part gauge.
  - "Content QA": a list with links, shown when there are findings.
  - Next up and Team activity are kept.

- [ ] **Step 1: Write the failing tests.**

```ts
it("week window across DST end has 7 Dublin days starting Monday", () => { const w = weekWindow(new Date("2026-10-28T12:00:00Z")); expect(w.days.map((d) => d.key)).toEqual(["2026-10-26", …, "2026-11-01"]) })
it("formatDelta: 0→0 No change, 0→3 New, 10→12 +20.0%", …)
it("QA flags [phone] in contact and unpublished terms", …)
```

  Integration:
  - `enquiriesWeek` counts per day.
  - `kpis.leads30d.previous` counts the prior 30 days.
  - `qa` is null for an intake user.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement.** Remove `leadsTrend` (90 days) and its uses.

- [ ] **Step 4: Run the tests and confirm they pass.**

```bash
pnpm vitest run --project unit tests/unit/dashboard tests/unit/content && pnpm test:integration tests/integration/api/dashboard.test.ts && pnpm vitest run --project dom tests/dom/dashboard.test.tsx
```

- [ ] **Step 5: Commit** with the message `feat(dashboard): KPI deltas, week-vs-week chart, content QA and health`.

---

### Task D3.6: Phase D3 gate

- [ ] **Step 1:** Run the full suite (same command as the earlier gates).
- [ ] **Step 2:** Run the public visual gate. Expect 0 px.
- [ ] **Step 3:** Re-shoot the admin baselines.
  - Add the screens `leads-board`, `leads-drawer`, `users-roles` and `dashboard` (with seeded week data).
  - The visual seed must create leads with fixed timestamps relative to a frozen clock. Use `page.clock.install` in the visual spec.
- [ ] **Step 4: Commit** with the message `test(visual): re-baseline admin for leads, users, dashboard (phase D3)`.
