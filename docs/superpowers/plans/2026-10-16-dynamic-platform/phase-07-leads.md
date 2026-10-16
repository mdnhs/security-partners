# Phase 7 — Leads + email

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master Phase 7 = Tasks 7.2–7.4; master Task 7.1 "Integrations module" already ran as Phase 6 Tasks 1–2 per ledger ruling "6.1 ↔ 7.1"). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§5.4, §5.5, §7, §8.1, §8.2, §9, §12, §13). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Public design is frozen: `pnpm test:visual` keeps every public baseline at 0 px (1440×900 and 390×844, macOS, port 3100 free) — **including `/` and `/contact`, which carry the contact form**. The honeypot, the Turnstile container and the feedback live region are absolutely positioned (not flex items, so no `gap`), the feedback text only appears after a submit, and nothing is fetched until the form receives focus. Only the **admin shell** baselines are re-captured (Task 5: the sidebar gains "Leads").
- `next build` succeeds with no env vars and no database (`env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`).
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (+ `NODE_ENV`, `PORT`, `HOSTNAME`). SMTP and Turnstile settings come from `integrations.smtp` / `integrations.turnstile` (Phase 6, encrypted).
- Every file under `server/` starts with `import "server-only"`. `lib/**` never imports `server/**`. Only `server/modules/*/repo.ts` and `server/db/**` import `drizzle-orm`; routes never import repos.
- Hono handlers: validate (`zv`) → authorise (`can(...)`) → call a service. Services re-check permissions and audit every mutation (`writeAudit`).
- Error envelope `{ error: { code, message, fieldErrors?, current?, requestId } }`. Lists `?page&pageSize&sort=field:dir&q&<filters>` → `{ items, page, pageSize, total }`. IDs uuid v7. Dates ISO 8601 UTC on the wire; shown in `Europe/Dublin`, `en-IE` (`formatDateTime`).
- Body limits: public 64 KB (already mounted on `/api/v1/public/*`), admin 1 MB.
- Privacy (spec §13): raw client IPs are never stored or logged for leads — only `HMAC-SHA256(deriveKey("lead-ip"), ip)`; the mailer never logs message bodies or error messages.
- Code style: repo Prettier (no semicolons, double quotes, 80 cols). Run `pnpm exec prettier --write <files>` on files you create or edit.
- Commit after every task, staging only your paths (`git add <paths>`; never `git add -A`); message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Only one agent at a time runs Playwright (`test:visual`, `test:e2e`) or `next build` (ledger ruling).
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` + `pnpm test:visual` + `pnpm test:e2e` (Postgres **and Mailpit** up: `pnpm db:up`).

**Prerequisites:** Phases 1–6 complete. Real files used by name: `server/lib/mailer.ts` (Phase 2 console fallback), `emails/{layout,invite,reset-password}.tsx`, `server/lib/{crypto,ip,errors,audit}.ts`, `server/api/{app,context,validate}.ts`, `server/api/middleware/{auth,body-limit,error}.ts`, `server/db/schema/{leads,jobs,settings,auth}.ts` (tables `leads`, `lead_events`, enum `lead_status` already exist since Phase 3), `server/modules/settings/{repo,service}.ts`, `server/modules/search/{repo,service}.ts`, `lib/schemas/api/{list,params,search}.ts`, `lib/schemas/settings/{sections-contact,leads}.ts`, `lib/interpolate.ts`, `lib/format.ts`, `components/home/{contact,contact-form}.tsx`, `templates/shared/views.ts`, `components/admin/{page-header,filter-field,session-provider}.tsx`, `components/admin/data-table/data-table.tsx` (with Phase 4 Task 12 `toolbar`/`filterKey` props), `components/admin/shell/{nav.ts,command-palette.tsx,nav-main.tsx}`, `components/admin/settings/settings-meta.ts`, `hooks/use-permission.ts`, `lib/api-client.ts`, `tests/integration/{db.ts,helpers/auth.ts}`, `tests/e2e/{env,fixtures,seed}.ts`. From earlier phase plans (built before this phase): Phase 4 Task 11 `server/modules/dashboard/service.ts`, Phase 4 Task 14 `components/admin/section-tabs/section-tabs.tsx` (`SectionTabs`), Phase 5 Task 6 `server/lib/scheduler.ts` + `server/lib/jobs/index.ts` (`RECURRING_JOBS`, `JobDefinition`), Phase 6 Task 1 `server/modules/integrations/service.ts` (`readIntegrationConfig`), `lib/schemas/integrations` (`SmtpConfig`, `TurnstileConfig`), `nodemailer@10.1.1` (installed in Phase 6). Where real code differs from those plans (names, file layout), apply the same change to the real code and say so in your report.

**Ledger rulings applied:** the mailer keeps its Phase 2 contract (never throws, `{ delivered: false }` on any failure, never logs bodies/links); email templates import from `react-email` (not `@react-email/components`), nodemailer without `@types/nodemailer`; `KeyPurpose` `"lead-ip"` hashes lead IPs; keyed recurring jobs on the Phase 5 scheduler (`ON CONFLICT (key)` upsert, one row per key); HTTPException headers are now preserved by `onError` (ledger minor, Retry-After); the shell is the shadcn dashboard-01 sidebar driven by `nav.ts`; in-page admin sections use the shared left vertical `SectionTabs` (Phase 4 Task 14); `/revisions/settings/:key` stays limited to editable content keys (Phase 6) — this phase writes no new settings keys; integration test runs need Mailpit (`127.0.0.1:1025`, API `:8025`) as Phase 6 noted for CI.

**Verification note:** written while Phase 4 Tasks 11–14 were in progress and Phases 5–6 only planned. Phase 1–4 code was read from the working tree. Mailpit v1.31 API checked against the local container: `GET /api/v1/search?query=to:"addr"` → `{ messages: [{ ID, Subject, To:[{Name,Address}], From, ReplyTo, … }] }`, `GET /api/v1/message/<ID>` → `{ …, ReplyTo, Text, HTML }`, `DELETE /api/v1/search?query=…` → 200. Hono 4.13 `HTTPException` keeps `res` (headers) — read from `node_modules/hono/dist/http-exception.js`. Turnstile's explicit-render browser API (`render(el, { sitekey, execution: "execute", callback, "error-callback", "expired-callback" })`, `execute(id)`, `reset(id)`, `remove(id)`) is from Cloudflare's docs and could not be exercised offline; the DOM test stubs it.

## Corrections to master plan

- **Task split:** master 7.2 = Task 1; 7.3 = Tasks 2 (public endpoint, rate limit, Turnstile) + 3 (contact form wiring); 7.4 = Tasks 4 (admin API, CSV, ⌘K, nav badge, dashboard link) + 5 (inbox UI) + 6 (retention job); Task 7 = phase E2E — cost: none.
- **Dev Mailpit default only under `NODE_ENV === "development"`** (spec §9 says "!== production"). Vitest runs with `NODE_ENV=test`; with the wider rule every Phase 2 test asserting `emailDelivered: false` (Review Focus 3) would flip whenever Mailpit is running. Tests that need real delivery save an `integrations.smtp` row pointing at Mailpit — cost if wrong: none (only `next dev` behaviour is affected).
- **Consent without a visible checkbox:** adding a checkbox or notice to the form breaks the 0 px freeze. The form posts `consent: true` (the visitor submitted the enquiry so we can reply to it) and the server stores it; `consent` defaults to `false` for other callers. **Owner must confirm** this basis (launch doc item); a visible consent line would need an approved re-baseline — cost if wrong: one form change + re-baseline later.
- **Turnstile site key is fetched by the browser** from `GET /api/v1/public/leads/config` on the form's first focus (not rendered by the server). This keeps public pages free of an `integrations.*` cache dependency and keeps the visual suite network-free. The Cloudflare widget must be created in **Invisible** mode (launch doc) — cost: one tiny request per visitor who focuses the form.
- **Rate-limit store:** new table `public_rate_limits (key pk, count, reset_at)` (migration `0006_public_rate_limits`), fixed 10-minute window via one atomic `INSERT … ON CONFLICT DO UPDATE`; key = `leads:<HMAC(ip)>` (no raw IPs). Better Auth's `rate_limits` table is not reused. The limit applies to `POST /api/v1/public/leads` only (not to the config GET) — cost: one table.
- **Public POST answers `200 { ok: true }`** for both real and honeypot submissions (bots learn nothing); 422/429/413 as specified — cost: none.
- **`settings.sections.contact.form` gains `sendingLabel`, `successMessage`, `errorMessage`, `rateLimitedMessage`** (custom migration `0007_contact_form_feedback` backfills existing draft/published rows and revisions, never overwriting edits). `mailtoSubject` keeps its key and now names the **staff notification email subject** (`{name}` = visitor) — avoids a rename migration — cost: misleading key name.
- **Extra admin leads routes:** `PATCH /leads/:id` (status/assignee), `GET /leads/assignees`, `GET /leads/badge` (sidebar count), `DELETE /leads/:id` (GDPR erasure, `lead:delete` = owner/admin). Status filter accepts a status, `open` (new|contacted|qualified) or `all`; without it spam is hidden. Export accepts `email=` for subject-access requests. Lead detail is a page `/admin/leads/[id]` (linked from the staff email) — cost: small scope add.
- **CSV:** RFC 4180 (CRLF, quotes doubled) with a UTF-8 BOM for Excel; formula guard prefixes `'` to text starting with `= + - @` **and TAB/CR** (OWASP superset). Phone numbers like `+353…` therefore export as `'+353…` — cost: cosmetic.
- **Nav:** "Leads" goes in the "Overview" section right after "Dashboard" with a `new-leads` badge (count of unassigned `new` leads); admin shell baselines re-captured — cost: none.
- **Dashboard:** Phase 4 Task 11 already reads the real `leads` table (no placeholders). This phase only points the "unassigned leads" Next-up item at `/admin/leads?status=new&assignee=none` and adds an integration test that a public submission shows up in the KPIs — cost: none.
- **Lead emails are sent inline** in the POST (not `after()`, which needs a Next request scope and would break `app.request` tests); SMTP timeouts are 10 s — cost: a slow SMTP server slows the visitor's submit.

---

### Task 1: SMTP mailer + lead email templates (master Task 7.2)

**Files:**
- Modify: `server/lib/mailer.ts` (full rewrite, same exports + `createMailer`, `DEV_MAILPIT_SMTP`)
- Create: `emails/lead-notification.tsx`, `emails/lead-acknowledgement.tsx`, `tests/integration/helpers/mailpit.ts`, `tests/integration/helpers/smtp.ts`
- Test: `tests/unit/mailer.test.tsx` (full rewrite), `tests/integration/mail/mailer.test.ts`

**Interfaces:**
- Consumes: Phase 6 `readIntegrationConfig("integrations.smtp")` → `SmtpConfig | null` (throws `AppError` INTERNAL when secrets are unreadable), `SmtpConfig = { host, port, secure, user, password, fromName, fromAddress }`; `nodemailer` 10 (`createTransport`, `sendMail`, `close`; notes §5.4); `react-email` `render(el)` / `render(el, { plainText: true })` (notes §5.3); `emails/layout.tsx` (`EmailLayout`, `emailStyles`).
- Produces:

```ts
// server/lib/mailer.ts
export type MailMessage = { to: string | readonly string[]; subject: string; react: ReactElement; replyTo?: string }
export type SendResult = { delivered: boolean; previewUrl?: string }
export const DEV_MAILPIT_SMTP: SmtpConfig            // 127.0.0.1:1025, no auth — used only when NODE_ENV === "development" and nothing is saved
export type MailTransport = { sendMail(o: { from: { name: string; address: string }; to: string | string[]; replyTo?: string; subject: string; html: string; text: string }): Promise<unknown>; close(): void }
export type MailerDeps = { loadConfig(): Promise<SmtpConfig | null>; nodeEnv(): string | undefined; createTransport(c: SmtpConfig): MailTransport }
export function createMailer(deps?: MailerDeps): { send(m: MailMessage): Promise<SendResult> }
export const mailer: { send(m: MailMessage): Promise<SendResult> }   // createMailer() with real deps; never throws
// emails/lead-notification.tsx
export type LeadNotificationEmailProps = { siteName: string; adminUrl: string; lead: { name: string; email: string; phone: string | null; company: string | null; service: string | null; message: string; sourcePage: string | null; receivedAt: string } }
export function LeadNotificationEmail(p: LeadNotificationEmailProps): JSX.Element
// emails/lead-acknowledgement.tsx
export type LeadAcknowledgementEmailProps = { name: string; siteName: string; message: string; phone24h: string | null }
export function LeadAcknowledgementEmail(p: LeadAcknowledgementEmailProps): JSX.Element
// tests/integration/helpers/mailpit.ts (alias-free: also imported by Playwright specs)
export const MAILPIT_URL: string                       // MAILPIT_URL env or http://127.0.0.1:8025
export type MailpitAddress = { Name: string; Address: string }
export type MailpitMessage = { ID: string; Subject: string; From: MailpitAddress; To: MailpitAddress[]; ReplyTo: MailpitAddress[]; Text: string; HTML: string }
export async function assertMailpitUp(): Promise<void>
export async function waitForMail(to: string, opts?: { subject?: string; timeoutMs?: number }): Promise<MailpitMessage>
export async function countMail(to: string): Promise<number>
export async function deleteMail(to: string): Promise<void>
// tests/integration/helpers/smtp.ts
export async function configureSmtp(values?: Partial<SmtpConfig>): Promise<void>   // writes the integrations.smtp row (Mailpit by default)
```

Behaviour: `send` renders HTML + plain text first (a template error → `{ delivered: false }` + one `console.error` naming subject/recipients and the error **name**); then resolves the SMTP config (saved row → else `DEV_MAILPIT_SMTP` when `NODE_ENV === "development"` → else none; a config read error counts as none and logs `[mailer] SMTP settings could not be read (<name>)`); with none it logs one `console.info('[mailer] SMTP is not configured; not sent: "<subject>" to <recipients>')` and returns `{ delivered: false }`; otherwise it sends `from: { name: fromName, address: fromAddress }`, `to`, optional `replyTo`, `subject`, `html`, `text`, returns `{ delivered: true }`, and on a send error logs `[mailer] sending "<subject>" to <recipients> failed (<code or name>)` and returns `{ delivered: false }`. The transport is closed after every send. "Test connection" (`transporter.verify()`) is Phase 6's `testSmtp` (covered by `tests/unit/integrations/testers.test.ts`, re-run below).

- [ ] **Step 1: Write the failing tests**

`tests/unit/mailer.test.tsx` (full file — replaces the Phase 2 version):

```tsx
import type { ReactElement } from "react"
import { render } from "react-email"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InviteEmail } from "@/emails/invite"
import { LeadAcknowledgementEmail } from "@/emails/lead-acknowledgement"
import { LeadNotificationEmail } from "@/emails/lead-notification"
import { ResetPasswordEmail } from "@/emails/reset-password"
import type { SmtpConfig } from "@/lib/schemas/integrations"
import {
  createMailer,
  DEV_MAILPIT_SMTP,
  type MailerDeps,
  type MailTransport,
} from "@/server/lib/mailer"

const LINK = "http://localhost:3000/admin/set-password?token=abc123"

const SAVED: SmtpConfig = {
  host: "smtp.example.ie",
  port: 587,
  secure: false,
  user: "mailer",
  password: "pw-123456",
  fromName: "Security Partners",
  fromAddress: "website@example.ie",
}

afterEach(() => {
  vi.restoreAllMocks()
})

function fakeTransport(sendMail: MailTransport["sendMail"] = async () => ({})) {
  return { sendMail: vi.fn(sendMail), close: vi.fn() }
}

function deps(over: Partial<MailerDeps> & { transport?: MailTransport } = {}) {
  const transport = over.transport ?? fakeTransport()
  const createTransport = vi.fn(() => transport)
  return {
    transport,
    createTransport,
    deps: {
      loadConfig: over.loadConfig ?? (async () => null),
      nodeEnv: over.nodeEnv ?? (() => "production"),
      createTransport: over.createTransport ?? createTransport,
    } satisfies MailerDeps,
  }
}

const invite = (
  <InviteEmail name="S" inviterName="O" url={LINK} expiresInDays={7} />
)

describe("email templates", () => {
  it("invite: greets the user, names the inviter and links the token URL", async () => {
    const email = (
      <InviteEmail
        name="Dinn Rí"
        inviterName="Owner One"
        url={LINK}
        expiresInDays={7}
      />
    )
    const html = await render(email)
    const text = await render(email, { plainText: true })
    expect(html).toContain(`href="${LINK}"`)
    expect(text).toContain("Hi Dinn Rí,")
    expect(text).toContain("Owner One invited you")
    expect(text).toContain("expires in 7 days")
    expect(text).toContain(LINK)
  })

  it("reset-password: links the token URL and states the expiry", async () => {
    const email = (
      <ResetPasswordEmail name="Sam" url={LINK} expiresInMinutes={60} />
    )
    expect(await render(email)).toContain(`href="${LINK}"`)
    expect(await render(email, { plainText: true })).toContain(
      "expires in 60 minutes"
    )
  })

  it("lead notification: every field, the message as written and the admin link", async () => {
    const email = (
      <LeadNotificationEmail
        siteName="Security Partners"
        adminUrl="http://localhost:3000/admin/leads/0190a6e0-0000-7000-8000-000000000001"
        lead={{
          name: "Dinn Rí",
          email: "dinn@example.ie",
          phone: "085 000 0000",
          company: null,
          service: null,
          message: "Line one\nLine two & more",
          sourcePage: "/contact",
          receivedAt: "16 Oct 2026, 14:05",
        }}
      />
    )
    const html = await render(email)
    const text = await render(email, { plainText: true })
    expect(html).toContain('href="mailto:dinn@example.ie"')
    expect(html).toContain(
      'href="http://localhost:3000/admin/leads/0190a6e0-0000-7000-8000-000000000001"'
    )
    expect(html).toContain("white-space:pre-wrap")
    expect(text).toContain("Dinn Rí")
    expect(text).toContain("085 000 0000")
    expect(text).toContain("Line one")
    expect(text).toContain("Line two & more")
    expect(text).toContain("/contact")
    expect(text).toContain("16 Oct 2026, 14:05")
    expect(text).not.toContain("Company")
  })

  it("lead acknowledgement: thanks the visitor, repeats the message, names the 24/7 line", async () => {
    const email = (
      <LeadAcknowledgementEmail
        name="Sam"
        siteName="Security Partners"
        message="Need a quote"
        phone24h="0818 000 000"
      />
    )
    const text = await render(email, { plainText: true })
    expect(text).toContain("Hi Sam,")
    expect(text).toContain("Need a quote")
    expect(text).toContain("0818 000 000")
    const without = await render(
      <LeadAcknowledgementEmail
        name="Sam"
        siteName="Security Partners"
        message="Need a quote"
        phone24h={null}
      />,
      { plainText: true }
    )
    expect(without).not.toContain("24/7")
  })
})

describe("mailer (master 7.2)", () => {
  it("sends through the saved SMTP settings: from, to, reply-to, subject, html + text", async () => {
    const { deps: d, transport, createTransport } = deps({
      loadConfig: async () => SAVED,
    })
    const result = await createMailer(d).send({
      to: ["a@example.ie", "b@example.ie"],
      replyTo: "visitor@example.ie",
      subject: "You're invited",
      react: invite,
    })
    expect(result).toEqual({ delivered: true })
    expect(createTransport).toHaveBeenCalledWith(SAVED)
    const options = vi.mocked(transport.sendMail).mock.calls[0][0]
    expect(options.from).toEqual({
      name: "Security Partners",
      address: "website@example.ie",
    })
    expect(options.to).toEqual(["a@example.ie", "b@example.ie"])
    expect(options.replyTo).toBe("visitor@example.ie")
    expect(options.subject).toBe("You're invited")
    expect(options.html).toContain(`href="${LINK}"`)
    expect(options.text).toContain(LINK)
    expect(transport.close).toHaveBeenCalledTimes(1)
  })

  it("unconfigured in production: not delivered, one info line with subject + recipient only (never the link)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const { deps: d, createTransport } = deps()
    const result = await createMailer(d).send({
      to: "someone@example.test",
      subject: "You're invited",
      react: invite,
    })
    expect(result).toEqual({ delivered: false })
    expect(createTransport).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
    const logged = String(info.mock.calls[0][0])
    expect(logged).toContain("You're invited")
    expect(logged).toContain("someone@example.test")
    expect(logged).not.toContain("abc123")
  })

  it("unconfigured under `next dev`: uses the dev Mailpit (spec §9)", async () => {
    const { deps: d, createTransport } = deps({ nodeEnv: () => "development" })
    const result = await createMailer(d).send({
      to: "someone@example.test",
      subject: "Hi",
      react: invite,
    })
    expect(result).toEqual({ delivered: true })
    expect(createTransport).toHaveBeenCalledWith(DEV_MAILPIT_SMTP)
    expect(DEV_MAILPIT_SMTP).toMatchObject({ host: "127.0.0.1", port: 1025 })
  })

  it("unconfigured under vitest (NODE_ENV=test): not delivered (phase correction)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    const { deps: d } = deps({ nodeEnv: () => "test" })
    expect(
      await createMailer(d).send({ to: "x@example.test", subject: "S", react: invite })
    ).toEqual({ delivered: false })
  })

  it("a send failure is { delivered: false }, logged with the error code but never its message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const transport = fakeTransport(async () => {
      throw Object.assign(new Error(`rejected near ${LINK}`), {
        code: "EENVELOPE",
      })
    })
    const { deps: d } = deps({ loadConfig: async () => SAVED, transport })
    const result = await createMailer(d).send({
      to: "someone@example.test",
      subject: "You're invited",
      react: invite,
    })
    expect(result).toEqual({ delivered: false })
    expect(transport.close).toHaveBeenCalledTimes(1)
    const line = error.mock.calls.map((c) => c.map(String).join(" ")).join("\n")
    expect(line).toContain("EENVELOPE")
    expect(line).not.toContain("abc123")
  })

  it("unreadable SMTP settings count as unconfigured (never throws)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    const { deps: d } = deps({
      loadConfig: async () => {
        throw new Error("secrets cannot be decrypted")
      },
    })
    expect(
      await createMailer(d).send({ to: "x@example.test", subject: "S", react: invite })
    ).toEqual({ delivered: false })
  })

  it("never throws: a template error is { delivered: false }, logged without the error message or link", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const Broken = () => {
      throw new Error(`template broke near ${LINK}`)
    }
    const { deps: d, createTransport } = deps({ loadConfig: async () => SAVED })
    const result = await createMailer(d).send({
      to: "someone@example.test",
      subject: "You're invited",
      react: <Broken />,
    })
    expect(result).toEqual({ delivered: false })
    expect(createTransport).not.toHaveBeenCalled()
    const ours = error.mock.calls
      .map((call) => call.map(String).join(" "))
      .filter((line) => line.startsWith("[mailer]"))
    expect(ours).toHaveLength(1)
    expect(ours[0]).toContain("You're invited")
    expect(ours[0]).not.toContain("abc123")
  })
})

describe("link expiry wording", () => {
  it("uses hours or days instead of large minute counts", async () => {
    const text = (email: ReactElement) => render(email, { plainText: true })
    expect(
      await text(
        <ResetPasswordEmail name="Sam" url={LINK} expiresInMinutes={1440} />
      )
    ).toContain("expires in 24 hours")
    expect(
      await text(
        <InviteEmail name="S" inviterName="O" url={LINK} expiresInDays={1} />
      )
    ).toContain("expires in 24 hours")
  })
})
```

`tests/integration/helpers/mailpit.ts`:

```ts
// Mailpit HTTP API (docker-compose.dev.yml, UI/API on :8025). No "@/"
// imports: Playwright specs import this file too.
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025"

export type MailpitAddress = { Name: string; Address: string }
export type MailpitMessage = {
  ID: string
  Subject: string
  From: MailpitAddress
  To: MailpitAddress[]
  ReplyTo: MailpitAddress[]
  Text: string
  HTML: string
}
type Summary = Pick<MailpitMessage, "ID" | "Subject" | "To">

const query = (to: string) => encodeURIComponent(`to:"${to}"`)

export async function assertMailpitUp(): Promise<void> {
  try {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`)
    if (res.ok) return
  } catch {
    // fall through
  }
  throw new Error(
    `Mailpit is not reachable at ${MAILPIT_URL}. Start it with \`pnpm db:up\`.`
  )
}

async function search(to: string): Promise<Summary[]> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query(to)}`)
  if (!res.ok) throw new Error(`Mailpit search failed (${res.status})`)
  return ((await res.json()) as { messages: Summary[] }).messages
}

export async function countMail(to: string): Promise<number> {
  return (await search(to)).length
}

/** Polls until a message to `to` (and with `subject`, if given) arrives. */
export async function waitForMail(
  to: string,
  opts: { subject?: string; timeoutMs?: number } = {}
): Promise<MailpitMessage> {
  const deadline = Date.now() + (opts.timeoutMs ?? 10_000)
  while (Date.now() < deadline) {
    const hit = (await search(to)).find(
      (m) => opts.subject === undefined || m.Subject === opts.subject
    )
    if (hit) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/message/${hit.ID}`)
      return (await res.json()) as MailpitMessage
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`No email to ${to} arrived in Mailpit`)
}

export async function deleteMail(to: string): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${query(to)}`, {
    method: "DELETE",
  })
}
```

`tests/integration/helpers/smtp.ts`:

```ts
import type { SmtpConfig } from "@/lib/schemas/integrations"
import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

/**
 * Saves integrations.smtp the way the Phase 6 integrations service stores
 * it (values in `draft`, empty secret as "", published null). Defaults to
 * the dev Mailpit without authentication.
 */
export async function configureSmtp(values: Partial<SmtpConfig> = {}) {
  const draft: SmtpConfig = {
    host: "127.0.0.1",
    port: 1025,
    secure: false,
    user: "",
    password: "",
    fromName: "Security Partners Test",
    fromAddress: "website@example.test",
    ...values,
  }
  await getDb()
    .insert(settings)
    .values({ key: "integrations.smtp", draft, published: null, version: 1 })
    .onConflictDoUpdate({ target: settings.key, set: { draft } })
}
```

`tests/integration/mail/mailer.test.ts`:

```ts
import { createElement } from "react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { InviteEmail } from "@/emails/invite"
import { mailer } from "@/server/lib/mailer"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"
import { assertMailpitUp, deleteMail, waitForMail } from "../helpers/mailpit"
import { configureSmtp } from "../helpers/smtp"

const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@mail.test`

const LINK = "http://localhost:3000/admin/set-password?token=zz9"
const invite = createElement(InviteEmail, {
  name: "Dinn Rí",
  inviterName: "Owner",
  url: LINK,
  expiresInDays: 7,
})

beforeAll(assertMailpitUp)
beforeEach(async () => {
  await resetDb()
})

describe("SMTP mailer against Mailpit (master 7.2)", () => {
  it("delivers HTML + text with from, reply-to and subject from integrations.smtp", async () => {
    await configureSmtp()
    const to = unique("mailer")
    await deleteMail(to)
    const result = await mailer.send({
      to,
      replyTo: "visitor@example.test",
      subject: "Mailer test",
      react: invite,
    })
    expect(result).toEqual({ delivered: true })
    const mail = await waitForMail(to, { subject: "Mailer test" })
    expect(mail.From).toEqual({
      Name: "Security Partners Test",
      Address: "website@example.test",
    })
    expect(mail.ReplyTo.map((a) => a.Address)).toEqual(["visitor@example.test"])
    expect(mail.HTML).toContain(`href="${LINK}"`)
    expect(mail.Text).toContain("Hi Dinn Rí,")
  })

  it("invite email arrives in Mailpit and the API reports emailDelivered:true", async () => {
    await configureSmtp()
    const { cookie } = await signedInUser(["admin"])
    const email = unique("invitee")
    const res = await adminRequest("/users/invite", {
      cookie,
      method: "POST",
      json: { email, name: "Ivy Invitee", roles: ["viewer"] },
    })
    expect(res.status).toBe(201)
    expect(((await res.json()) as { emailDelivered: boolean }).emailDelivered).toBe(true)
    const mail = await waitForMail(email, {
      subject: "You're invited to the Security Partners admin",
    })
    expect(mail.Text).toContain("Hi Ivy Invitee,")
  })

  it("without SMTP settings (NODE_ENV=test) nothing is sent: delivered:false + logged", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const result = await mailer.send({
      to: unique("nobody"),
      subject: "Not sent",
      react: invite,
    })
    expect(result).toEqual({ delivered: false })
    expect(String(info.mock.calls[0][0])).toContain("SMTP is not configured")
    info.mockRestore()
  })

  it("an unreachable SMTP server is { delivered: false }, never an exception", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await configureSmtp({ port: 1 })
    expect(
      await mailer.send({ to: unique("down"), subject: "Down", react: invite })
    ).toEqual({ delivered: false })
    error.mockRestore()
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm test:unit tests/unit/mailer.test.tsx`
Expected: FAIL — `Failed to resolve import "@/emails/lead-acknowledgement"` (and `createMailer` is not exported).

Run (Postgres + Mailpit up: `pnpm db:up`): `pnpm test:integration tests/integration/mail/mailer.test.ts`
Expected: FAIL — the first two tests get `{ delivered: false }` / `emailDelivered: false` (no transport yet).

- [ ] **Step 3: Implement**

`server/lib/mailer.ts` (full file):

```ts
import "server-only"

import nodemailer from "nodemailer"
import type { ReactElement } from "react"
import { render } from "react-email"

import type { SmtpConfig } from "@/lib/schemas/integrations"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

export type MailMessage = {
  to: string | readonly string[]
  subject: string
  react: ReactElement
  replyTo?: string
}
export type SendResult = { delivered: boolean; previewUrl?: string }

/**
 * Spec §9: `next dev` with no saved SMTP settings sends to the dev Mailpit
 * (docker-compose.dev.yml). Only NODE_ENV "development" — tests and
 * production without settings send nothing (phase correction).
 */
export const DEV_MAILPIT_SMTP: SmtpConfig = {
  host: "127.0.0.1",
  port: 1025,
  secure: false,
  user: "",
  password: "",
  fromName: "Security Partners (dev)",
  fromAddress: "website@localhost.test",
}

export type MailTransport = {
  sendMail(options: {
    from: { name: string; address: string }
    to: string | string[]
    replyTo?: string
    subject: string
    html: string
    text: string
  }): Promise<unknown>
  close(): void
}

export type MailerDeps = {
  loadConfig(): Promise<SmtpConfig | null>
  nodeEnv(): string | undefined
  createTransport(config: SmtpConfig): MailTransport
}

const TIMEOUT_MS = 10_000

const defaultDeps: MailerDeps = {
  loadConfig: () => readIntegrationConfig("integrations.smtp"),
  nodeEnv: () => process.env.NODE_ENV,
  createTransport: (c) =>
    nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: c.user ? { user: c.user, pass: c.password } : undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS * 2,
    }),
}

const errorName = (err: unknown) =>
  err instanceof Error ? err.name : "unknown error"
const errorCode = (err: unknown) => {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === "string" ? code : errorName(err)
}

/**
 * Transactional email (spec §9). Never throws: every failure is
 * `{ delivered: false }`. Logs name the subject and recipients only — never
 * bodies or error messages, which can contain single-use links.
 */
export function createMailer(deps: MailerDeps = defaultDeps) {
  async function resolveConfig(): Promise<SmtpConfig | null> {
    let saved: SmtpConfig | null
    try {
      saved = await deps.loadConfig()
    } catch (err) {
      console.error(`[mailer] SMTP settings could not be read (${errorName(err)})`)
      return null
    }
    if (saved) return saved
    return deps.nodeEnv() === "development" ? DEV_MAILPIT_SMTP : null
  }

  return {
    async send({ to, subject, react, replyTo }: MailMessage): Promise<SendResult> {
      const recipients = typeof to === "string" ? to : to.join(", ")
      let html: string
      let text: string
      try {
        html = await render(react)
        text = await render(react, { plainText: true })
      } catch (err) {
        console.error(
          `[mailer] could not render "${subject}" to ${recipients} (${errorName(err)})`
        )
        return { delivered: false }
      }
      const config = await resolveConfig()
      if (!config) {
        console.info(
          `[mailer] SMTP is not configured; not sent: "${subject}" to ${recipients}`
        )
        return { delivered: false }
      }
      let transport: MailTransport | null = null
      try {
        transport = deps.createTransport(config)
        await transport.sendMail({
          from: { name: config.fromName, address: config.fromAddress },
          to: typeof to === "string" ? to : [...to],
          ...(replyTo ? { replyTo } : {}),
          subject,
          html,
          text,
        })
        return { delivered: true }
      } catch (err) {
        console.error(
          `[mailer] sending "${subject}" to ${recipients} failed (${errorCode(err)})`
        )
        return { delivered: false }
      } finally {
        transport?.close()
      }
    },
  }
}

export const mailer = createMailer()
```

(Callers — `server/auth/auth.ts`, `server/modules/users/{service,bootstrap}.ts` — keep calling `mailer.send({ to, subject, react })` unchanged; existing `vi.spyOn(mailer, "send")` tests keep working.)

`emails/lead-notification.tsx`:

```tsx
import { Button, Heading, Link, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"

export type LeadNotificationEmailProps = {
  siteName: string
  adminUrl: string
  lead: {
    name: string
    email: string
    phone: string | null
    company: string | null
    service: string | null
    message: string
    sourcePage: string | null
    receivedAt: string
  }
}

const row = { ...emailStyles.text, margin: "0 0 8px" }

/** Staff notification for a new website enquiry (spec §9). */
export function LeadNotificationEmail({
  siteName,
  adminUrl,
  lead,
}: LeadNotificationEmailProps) {
  return (
    <EmailLayout preview={`New enquiry from ${lead.name}`}>
      <Heading as="h1" style={emailStyles.heading}>
        New website enquiry
      </Heading>
      <Text style={row}>
        <strong>Name:</strong> {lead.name}
      </Text>
      <Text style={row}>
        <strong>Email:</strong>{" "}
        <Link href={`mailto:${lead.email}`} style={emailStyles.link}>
          {lead.email}
        </Link>
      </Text>
      {lead.phone ? (
        <Text style={row}>
          <strong>Phone:</strong> {lead.phone}
        </Text>
      ) : null}
      {lead.company ? (
        <Text style={row}>
          <strong>Company:</strong> {lead.company}
        </Text>
      ) : null}
      {lead.service ? (
        <Text style={row}>
          <strong>Service:</strong> {lead.service}
        </Text>
      ) : null}
      <Text style={row}>
        <strong>Received:</strong> {lead.receivedAt}
        {lead.sourcePage ? ` from ${lead.sourcePage}` : ""}
      </Text>
      <Text style={{ ...emailStyles.text, whiteSpace: "pre-wrap" }}>
        {lead.message}
      </Text>
      <Button href={adminUrl} style={emailStyles.button}>
        Open in the {siteName} admin
      </Button>
      <Text style={emailStyles.small}>
        Reply to this email to answer {lead.name} directly. Admin link:{" "}
        <Link href={adminUrl} style={emailStyles.link}>
          {adminUrl}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default LeadNotificationEmail
```

`emails/lead-acknowledgement.tsx`:

```tsx
import { Heading, Text } from "react-email"

import { EmailLayout, emailStyles } from "./layout"

export type LeadAcknowledgementEmailProps = {
  name: string
  siteName: string
  message: string
  phone24h: string | null
}

/** Optional confirmation to the visitor (settings.leads.acknowledgement). */
export function LeadAcknowledgementEmail({
  name,
  siteName,
  message,
  phone24h,
}: LeadAcknowledgementEmailProps) {
  return (
    <EmailLayout preview={`We received your message to ${siteName}`}>
      <Heading as="h1" style={emailStyles.heading}>
        Thanks for your message
      </Heading>
      <Text style={emailStyles.text}>Hi {name},</Text>
      <Text style={emailStyles.text}>
        We received your message and will reply as soon as we can.
      </Text>
      {phone24h ? (
        <Text style={emailStyles.text}>
          For anything urgent, call our 24/7 line on {phone24h}.
        </Text>
      ) : null}
      <Text style={emailStyles.small}>Your message:</Text>
      <Text style={{ ...emailStyles.text, whiteSpace: "pre-wrap" }}>
        {message}
      </Text>
    </EmailLayout>
  )
}

export default LeadAcknowledgementEmail
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test:unit tests/unit/mailer.test.tsx tests/unit/integrations/testers.test.ts`
Expected: PASS (templates + mailer + Phase 6 `testSmtp`/`verify()` tests).

Run: `pnpm test:integration tests/integration/mail/mailer.test.ts tests/integration/api/users.test.ts tests/integration/users/bootstrap.test.ts`
Expected: PASS — the Phase 2 `emailDelivered: false` tests still pass (no SMTP row, NODE_ENV=test).

Run: `pnpm lint && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/lib/mailer.ts emails/lead-notification.tsx emails/lead-acknowledgement.tsx tests/unit/mailer.test.tsx tests/integration/helpers/mailpit.ts tests/integration/helpers/smtp.ts tests/integration/mail/mailer.test.ts
git commit -m "feat: send email through the saved SMTP settings with lead templates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Public leads endpoint — validation, honeypot, Turnstile, DB rate limit, notifications (master Task 7.3, part 1)

**Files:**
- Create: `lib/schemas/api/leads.ts`, `server/db/schema/rate-limits.ts`, `server/db/migrations/0006_public_rate_limits.sql` (+ drizzle `meta/` snapshot/journal from `db:generate`), `server/modules/rate-limit/repo.ts`, `server/lib/rate-limit.ts`, `server/api/middleware/rate-limit.ts`, `server/lib/turnstile.ts`, `server/modules/leads/{repo,service,routes}.ts`
- Modify: `server/db/schema/index.ts` (export rate-limits), `server/lib/ip.ts` (`hashIp`), `server/api/middleware/error.ts` (keep HTTPException headers — ledger minor), `server/modules/settings/service.ts` (`getPublishedSettings`), `server/api/app.ts` (mount `/v1/public/leads`)
- Test: `tests/unit/ip-hash.test.ts`, `tests/unit/turnstile.test.ts`, `tests/unit/api/http-exception-headers.test.ts`, `tests/unit/schemas/leads.test.ts`, `tests/integration/api/leads-public.test.ts`

**Interfaces:**
- Consumes: `deriveKey("lead-ip")`, `encryptSecret` (tests); `clientIp(headers)`; `errorEnvelope`; `limitBody("public")` (already on `/v1/public/*`); `writeAudit(db, null, …)`; Phase 6 `readIntegrationConfig("integrations.turnstile")` → `TurnstileConfig = { enabled, siteKey, secretKey } | null`; Task 1 `mailer`, `LeadNotificationEmail`, `LeadAcknowledgementEmail`; `interpolate`; `formatDateTime`; tables `leads`, `lead_events`, `settings`; `settingsSchemas` (`lib/schemas/settings`).
- Produces:

```ts
// lib/schemas/api/leads.ts (isomorphic)
export const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost", "spam"] as const   // = DB enum lead_status
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export const LEAD_STATUS_LABELS: Record<LeadStatus, string>
export const OPEN_LEAD_STATUSES: readonly LeadStatus[]          // new, contacted, qualified
export const LEAD_EVENT_TYPES = ["created", "status", "assigned", "note", "email"] as const
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number]
export const leadSubmission: z.ZodType                           // name, email, phone?, company?, service?, message, consent (default false), sourcePage?, website? (honeypot), turnstileToken?
export type LeadSubmission = z.output<typeof leadSubmission>     // phone/company/service: string | null
export type LeadPublicConfig = { turnstileSiteKey: string | null }
export const LEADS_ENDPOINT = "/api/v1/public/leads"
export const LEADS_CONFIG_ENDPOINT = "/api/v1/public/leads/config"
// server/db/schema/rate-limits.ts
export const publicRateLimits   // public_rate_limits(key text pk, count int not null, reset_at timestamptz not null) + index on reset_at
// server/lib/ip.ts
export function hashIp(ip: string, secret?: string): string      // HMAC-SHA256(deriveKey("lead-ip"), ip) base64url (43 chars)
// server/modules/rate-limit/repo.ts
export async function hitRateLimit(db: DbOrTx, key: string, now: Date, windowMs: number): Promise<{ count: number; resetAt: Date }>
export async function deleteExpiredRateLimits(db: DbOrTx, now: Date): Promise<number>
// server/lib/rate-limit.ts
export type RateLimitResult = { allowed: boolean; count: number; retryAfterSeconds: number }
export const LEAD_RATE_LIMIT = { bucket: "leads", max: 5, windowMs: 600_000 } as const
export function rateLimitKey(bucket: string, ip: string | null): string   // "<bucket>:<hashIp(ip)>" | "<bucket>:unknown"
export async function consumeRateLimit(key: string, opts: { max: number; windowMs: number; now?: Date }, db?: DbOrTx): Promise<RateLimitResult>
// server/api/middleware/rate-limit.ts
export const rateLimit: (opts: { bucket: string; max: number; windowMs: number }) => MiddlewareHandler<AppEnv>   // 429 envelope RATE_LIMITED + Retry-After
// server/lib/turnstile.ts
export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
export async function verifyTurnstileToken(input: { secret: string; token: string | undefined; ip: string | null }, fetchImpl?: typeof fetch): Promise<boolean>
// server/modules/settings/service.ts
export async function getPublishedSettings<K extends SettingsKey>(key: K, db?: DbOrTx): Promise<SettingsValue<K> | null>   // published value parsed by its schema; null when unpublished/invalid
// server/modules/leads/repo.ts
export type LeadRow = typeof leads.$inferSelect
export async function insertLead(db: DbOrTx, row: typeof leads.$inferInsert): Promise<LeadRow>
export async function insertLeadEvent(db: DbOrTx, row: { leadId: string; type: LeadEventType; body: string | null; actorId: string | null }): Promise<void>
// server/modules/leads/service.ts
export async function submitLead(input: LeadSubmission, meta: { ip: string | null }): Promise<{ ok: true; leadId: string | null }>
export async function publicFormConfig(): Promise<LeadPublicConfig>
// HTTP (public, 64 KB body limit, no session)
GET  /api/v1/public/leads/config → 200 LeadPublicConfig (Cache-Control: no-store)
POST /api/v1/public/leads        → 200 { ok: true } | 422 VALIDATION_FAILED (fieldErrors) | 429 RATE_LIMITED (Retry-After) | 413
```

Rules: the rate limit runs **before** validation, so every POST from an IP counts (6th within the window → 429). Honeypot (`website` non-blank) → 200, no row, no email. When `integrations.turnstile.enabled`, the token is verified with Cloudflare (`secret`, `response`, `remoteip`); missing/invalid/network error → 422 `fieldErrors.turnstileToken`; an unreadable Turnstile row is logged and skips the check (leads are not lost). A lead row + a `created` event + audit `lead.created` (actor null, ip null) commit in one transaction; then notifications run and **never fail the request**: staff email to `settings.leads.recipients` (published), `replyTo` = visitor, subject = `sections.contact.form.mailtoSubject` with `{name}`; acknowledgement to the visitor when `settings.leads.acknowledgement`; each outcome is a lead `email` event.

- [ ] **Step 1: Write the failing tests**

`tests/unit/ip-hash.test.ts`:

```ts
import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

import { deriveKey } from "@/server/lib/crypto"
import { hashIp } from "@/server/lib/ip"

const SECRET = "s".repeat(40)

describe("hashIp (spec §13: lead IPs stored as a salted hash)", () => {
  it("is HMAC-SHA256 with the lead-ip key, base64url, stable per secret", () => {
    const hash = hashIp("203.0.113.7", SECRET)
    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hash).toBe(hashIp("203.0.113.7", SECRET))
    expect(hash).toBe(
      createHmac("sha256", deriveKey("lead-ip", SECRET))
        .update("203.0.113.7")
        .digest("base64url")
    )
    expect(hash).not.toContain("203")
  })

  it("differs per IP and per secret, and does not reuse other key purposes", () => {
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(hashIp("203.0.113.8", SECRET))
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(
      hashIp("203.0.113.7", "t".repeat(40))
    )
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(
      createHmac("sha256", deriveKey("preview", SECRET))
        .update("203.0.113.7")
        .digest("base64url")
    )
  })
})
```

`tests/unit/turnstile.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import {
  TURNSTILE_SITEVERIFY_URL,
  verifyTurnstileToken,
} from "@/server/lib/turnstile"

const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe("verifyTurnstileToken (server-side siteverify)", () => {
  it("posts secret, token and remote IP; true only for success:true", async () => {
    const fetchImpl = reply({ success: true })
    expect(
      await verifyTurnstileToken(
        { secret: "sec", token: "tok", ip: "203.0.113.7" },
        fetchImpl as unknown as typeof fetch
      )
    ).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL)
    expect(init.method).toBe("POST")
    const body = init.body as URLSearchParams
    expect(body.get("secret")).toBe("sec")
    expect(body.get("response")).toBe("tok")
    expect(body.get("remoteip")).toBe("203.0.113.7")
  })

  it("false for success:false, a non-2xx answer, junk JSON or a network error", async () => {
    const run = (f: unknown) =>
      verifyTurnstileToken(
        { secret: "sec", token: "tok", ip: null },
        f as typeof fetch
      )
    expect(await run(reply({ success: false, "error-codes": ["invalid-input-response"] }))).toBe(false)
    expect(await run(reply({ success: true }, 500))).toBe(false)
    expect(await run(vi.fn(async () => new Response("<html>")))).toBe(false)
    expect(
      await run(
        vi.fn(async () => {
          throw new TypeError("fetch failed")
        })
      )
    ).toBe(false)
  })

  it("a missing token is false without calling Cloudflare", async () => {
    const fetchImpl = reply({ success: true })
    expect(
      await verifyTurnstileToken(
        { secret: "sec", token: undefined, ip: null },
        fetchImpl as unknown as typeof fetch
      )
    ).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
```

`tests/unit/api/http-exception-headers.test.ts`:

```ts
import { HTTPException } from "hono/http-exception"
import { describe, expect, it } from "vitest"

import { createApp } from "@/server/api/app"

// Ledger minor (Phase 1 Task 5): onError dropped HTTPException headers.
const app = createApp()
app.get("/v1/__test/http-429", () => {
  throw new HTTPException(429, {
    message: "Slow down",
    res: new Response(null, {
      headers: { "Retry-After": "42", "content-type": "text/plain" },
    }),
  })
})

describe("onError keeps HTTPException headers", () => {
  it("returns the envelope with the exception's Retry-After header", async () => {
    const res = await app.request("/api/v1/__test/http-429")
    expect(res.status).toBe(429)
    expect(res.headers.get("retry-after")).toBe("42")
    expect(res.headers.get("content-type")).toMatch(/^application\/json/)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error).toMatchObject({ code: "RATE_LIMITED", message: "Slow down" })
  })
})
```

`tests/unit/schemas/leads.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { LEAD_STATUSES, leadSubmission } from "@/lib/schemas/api/leads"
import { LEAD_STATUSES as DB_LEAD_STATUSES } from "@/server/db/schema"

const valid = {
  name: "  Dinn Rí ",
  email: " dinn@example.ie ",
  message: "Line one\nLine two\ttabbed",
}

describe("leadSubmission (shared Zod schema, spec §9)", () => {
  it("trims, keeps inner text, defaults consent to false and empty optionals to null", () => {
    expect(
      leadSubmission.parse({ ...valid, phone: "  ", sourcePage: "/contact" })
    ).toEqual({
      name: "Dinn Rí",
      email: "dinn@example.ie",
      phone: null,
      company: null,
      service: null,
      message: "Line one\nLine two\ttabbed",
      consent: false,
      sourcePage: "/contact",
    })
  })

  it("rejects bad email, empty message, control characters and long text", () => {
    const issues = (input: object) =>
      leadSubmission.safeParse({ ...valid, ...input }).error?.issues.map(
        (i) => i.path.join(".")
      ) ?? []
    expect(issues({ email: "nope" })).toEqual(["email"])
    expect(issues({ message: "   " })).toEqual(["message"])
    expect(issues({ name: "A\nB" })).toEqual(["name"])
    expect(issues({ message: "nul\u0000byte" })).toEqual(["message"])
    expect(issues({ message: "x".repeat(5001) })).toEqual(["message"])
    expect(issues({ sourcePage: "https://evil.example" })).toEqual(["sourcePage"])
    expect(issues({ sourcePage: "//evil.example" })).toEqual(["sourcePage"])
  })

  it("accepts the honeypot and Turnstile token fields", () => {
    expect(
      leadSubmission.parse({ ...valid, website: "x", turnstileToken: "t" })
    ).toMatchObject({ website: "x", turnstileToken: "t" })
  })

  it("lists the same statuses as the database enum", () => {
    expect([...LEAD_STATUSES]).toEqual([...DB_LEAD_STATUSES])
  })
})
```

`tests/integration/api/leads-public.test.ts`:

```ts
import { and, eq } from "drizzle-orm"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { auditLog, leadEvents, leads, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { encryptSecret } from "@/server/lib/crypto"
import { hashIp } from "@/server/lib/ip"
import { mailer } from "@/server/lib/mailer"
import { consumeRateLimit, LEAD_RATE_LIMIT } from "@/server/lib/rate-limit"

import { resetDb } from "../db"
import { assertMailpitUp, waitForMail } from "../helpers/mailpit"
import { configureSmtp } from "../helpers/smtp"

let ipCounter = 0
const freshIp = () => `198.51.100.${++ipCounter}`

const BODY = {
  name: "Dinn Rí",
  email: "dinn@example.ie",
  phone: "085 000 0000",
  message: "Please quote for static security.",
  consent: true,
  sourcePage: "/contact",
}

function post(body: unknown, ip = freshIp()) {
  return app.request("/api/v1/public/leads", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

async function setLeadsSettings(value: {
  recipients: string[]
  retentionMonths: number
  acknowledgement: boolean
}) {
  await getDb()
    .update(settings)
    .set({ draft: value, published: value })
    .where(eq(settings.key, "leads"))
}

async function saveTurnstile(enabled: boolean) {
  await getDb()
    .insert(settings)
    .values({
      key: "integrations.turnstile",
      draft: {
        enabled,
        siteKey: "0x4AAAAAAAtestsitekey",
        secretKey: encryptSecret(
          "turnstile-secret-value",
          "integrations.turnstile.secretKey"
        ),
      },
      published: null,
      version: 1,
    })
}

let send: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  send = vi.spyOn(mailer, "send").mockResolvedValue({ delivered: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/v1/public/leads (master 7.3)", () => {
  it("valid post → lead row (IP hashed), created event, audit and staff email", async () => {
    const ip = freshIp()
    const res = await post(BODY, ip)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const [row] = await getDb().select().from(leads)
    expect(row).toMatchObject({
      name: "Dinn Rí",
      email: "dinn@example.ie",
      phone: "085 000 0000",
      company: null,
      message: "Please quote for static security.",
      consent: true,
      status: "new",
      assigneeId: null,
      sourcePage: "/contact",
      ipHash: hashIp(ip),
    })
    expect(row.ipHash).not.toContain(ip)

    const events = await getDb()
      .select()
      .from(leadEvents)
      .where(eq(leadEvents.leadId, row.id))
    expect(events.map((e) => e.type).sort()).toEqual(["created", "email"])
    expect(events.find((e) => e.type === "email")?.body).toBe(
      "Staff notification sent to 1 recipient."
    )

    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.action, "lead.created"), eq(auditLog.entityId, row.id))
      )
    expect(audit).toMatchObject({ actorId: null, ip: null })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({
      to: ["info@securitypartnersltd.com"],
      replyTo: "dinn@example.ie",
      subject: "Website enquiry from Dinn Rí",
    })
  })

  it("sends the optional acknowledgement to the visitor when enabled", async () => {
    await setLeadsSettings({
      recipients: ["ops@example.ie", "hr@example.ie"],
      retentionMonths: 24,
      acknowledgement: true,
    })
    expect((await post(BODY)).status).toBe(200)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0]).toMatchObject({
      to: ["ops@example.ie", "hr@example.ie"],
    })
    expect(send.mock.calls[1][0]).toMatchObject({ to: "dinn@example.ie" })
  })

  it("a failed or unconfigured email never fails the request", async () => {
    send.mockResolvedValue({ delivered: false })
    expect((await post(BODY)).status).toBe(200)
    const [row] = await getDb().select().from(leads)
    const [email] = await getDb()
      .select()
      .from(leadEvents)
      .where(and(eq(leadEvents.leadId, row.id), eq(leadEvents.type, "email")))
    expect(email.body).toBe(
      "Staff notification not sent: email is not configured or failed."
    )
  })

  it("honeypot filled → 200 { ok: true } but no lead and no email", async () => {
    const res = await post({ ...BODY, website: "http://spam.example" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(await getDb().select().from(leads)).toHaveLength(0)
    expect(send).not.toHaveBeenCalled()
  })

  it("6th post in 10 minutes from the same IP → 429 with Retry-After; other IPs unaffected", async () => {
    const ip = freshIp()
    for (let i = 0; i < 5; i++) {
      expect((await post({ ...BODY, website: "bot" }, ip)).status).toBe(200)
    }
    const limited = await post(BODY, ip)
    expect(limited.status).toBe(429)
    const retryAfter = Number(limited.headers.get("retry-after"))
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(600)
    const body = (await limited.json()) as { error: { code: string } }
    expect(body.error.code).toBe("RATE_LIMITED")
    expect((await post(BODY)).status).toBe(200)
  })

  it("invalid bodies count too, and the window resets after 10 minutes", async () => {
    const ip = freshIp()
    for (let i = 0; i < 5; i++) expect((await post({}, ip)).status).toBe(422)
    expect((await post(BODY, ip)).status).toBe(429)
    const key = `leads:${hashIp(ip)}`
    const later = new Date(Date.now() + LEAD_RATE_LIMIT.windowMs + 1_000)
    expect(
      await consumeRateLimit(key, { ...LEAD_RATE_LIMIT, now: later })
    ).toMatchObject({ allowed: true, count: 1 })
  })

  it("invalid fields → 422 with fieldErrors", async () => {
    const res = await post({ ...BODY, email: "not-an-email", message: "" })
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { code: string; fieldErrors: Record<string, string[]> }
    }
    expect(body.error.code).toBe("VALIDATION_FAILED")
    expect(Object.keys(body.error.fieldErrors).sort()).toEqual(["email", "message"])
  })

  it("body over 64 KB → 413", async () => {
    const res = await post({ ...BODY, message: "x".repeat(70 * 1024) })
    expect(res.status).toBe(413)
  })

  it("Turnstile enabled: missing or rejected token → 422; accepted token → lead", async () => {
    await saveTurnstile(true)
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

    const missing = await post(BODY)
    expect(missing.status).toBe(422)
    const missingBody = (await missing.json()) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(missingBody.error.fieldErrors.turnstileToken).toBeDefined()
    expect(fetchSpy).not.toHaveBeenCalled()

    const ip = freshIp()
    expect((await post({ ...BODY, turnstileToken: "bad" }, ip)).status).toBe(422)
    const sent = fetchSpy.mock.calls[0][1] as RequestInit
    expect((sent.body as URLSearchParams).get("secret")).toBe(
      "turnstile-secret-value"
    )
    expect((sent.body as URLSearchParams).get("remoteip")).toBe(ip)
    expect(await getDb().select().from(leads)).toHaveLength(0)

    expect((await post({ ...BODY, turnstileToken: "good" })).status).toBe(200)
    expect(await getDb().select().from(leads)).toHaveLength(1)
  })

  it("Turnstile saved but disabled → no check", async () => {
    await saveTurnstile(false)
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    expect((await post(BODY)).status).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe("GET /api/v1/public/leads/config", () => {
  it("exposes the Turnstile site key only while enabled, never cached", async () => {
    const get = async () => {
      const res = await app.request("/api/v1/public/leads/config")
      expect(res.status).toBe(200)
      expect(res.headers.get("cache-control")).toBe("no-store")
      return res.json()
    }
    expect(await get()).toEqual({ turnstileSiteKey: null })
    await saveTurnstile(true)
    expect(await get()).toEqual({ turnstileSiteKey: "0x4AAAAAAAtestsitekey" })
    await getDb()
      .update(settings)
      .set({ draft: { enabled: false, siteKey: "0x4AAAAAAAtestsitekey", secretKey: "" } })
      .where(eq(settings.key, "integrations.turnstile"))
    expect(await get()).toEqual({ turnstileSiteKey: null })
  })
})

describe("staff email through SMTP (Mailpit)", () => {
  beforeAll(assertMailpitUp)

  it("arrives with the visitor as reply-to", async () => {
    vi.restoreAllMocks()
    await configureSmtp()
    const inbox = `leads-${Date.now()}@mail.test`
    await setLeadsSettings({
      recipients: [inbox],
      retentionMonths: 24,
      acknowledgement: false,
    })
    expect((await post(BODY)).status).toBe(200)
    const mail = await waitForMail(inbox, {
      subject: "Website enquiry from Dinn Rí",
    })
    expect(mail.ReplyTo.map((a) => a.Address)).toEqual(["dinn@example.ie"])
    expect(mail.Text).toContain("Please quote for static security.")
    expect(mail.HTML).toMatch(/\/admin\/leads\/[0-9a-f-]{36}/)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm test:unit tests/unit/ip-hash.test.ts tests/unit/turnstile.test.ts tests/unit/api/http-exception-headers.test.ts tests/unit/schemas/leads.test.ts`
Expected: FAIL — `hashIp` / `@/server/lib/turnstile` / `@/lib/schemas/api/leads` do not exist; the HTTPException test gets no `retry-after` header.

Run: `pnpm test:integration tests/integration/api/leads-public.test.ts`
Expected: FAIL — `@/server/lib/rate-limit` cannot be resolved.

- [ ] **Step 3: Implement**

`lib/schemas/api/leads.ts`:

```ts
import { z } from "zod"

/** Same order as the DB enum lead_status (server/db/schema/leads.ts). */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
  "spam",
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
}

/** Spec §8.1 "open leads" (dashboard KPI, inbox filter). */
export const OPEN_LEAD_STATUSES: readonly LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
]

export const LEAD_EVENT_TYPES = [
  "created",
  "status",
  "assigned",
  "note",
  "email",
] as const
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number]

export const LEADS_ENDPOINT = "/api/v1/public/leads"
export const LEADS_CONFIG_ENDPOINT = "/api/v1/public/leads/config"

/** C0 controls and DEL; `allow` keeps e.g. tab/newlines in the message. */
function hasControlChars(value: string, allow = ""): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if ((code < 32 || code === 127) && !allow.includes(ch)) return true
  }
  return false
}

const oneLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .refine((v) => !hasControlChars(v), "Use a single line of text")

const optionalLine = (max: number) =>
  oneLine(max)
    .default("")
    .transform((v) => (v ? v : null))

/** POST /api/v1/public/leads (contact form). Shared by the form and the API. */
export const leadSubmission = z.object({
  name: oneLine(200).pipe(z.string().min(1, "Enter your name")),
  email: z
    .string()
    .trim()
    .max(320, "Use at most 320 characters")
    .pipe(z.email("Enter a valid email address")),
  phone: optionalLine(50),
  company: optionalLine(200),
  service: optionalLine(200),
  message: z
    .string()
    .trim()
    .min(1, "Enter a message")
    .max(5000, "Keep the message under 5,000 characters")
    .refine((v) => !hasControlChars(v, "\t\n\r"), "Remove special characters"),
  /** The visitor sent the form so we can answer it (phase correction). */
  consent: z.boolean().default(false),
  sourcePage: z
    .string()
    .max(300)
    .regex(/^\/(?!\/)\S*$/, "Must be a path on this site")
    .optional(),
  /** Honeypot: hidden from people, filled by bots. */
  website: z.string().max(500).optional(),
  turnstileToken: z.string().max(2048).optional(),
})
export type LeadSubmission = z.output<typeof leadSubmission>

export type LeadPublicConfig = { turnstileSiteKey: string | null }
```

(Implementer: if `oneLine(200).pipe(z.string().min(1, …))` reports the message twice or under a different path, use `z.string().trim().min(1, "Enter your name").max(200).refine(…)` instead — the unit test pins only the path.)

`server/db/schema/rate-limits.ts`:

```ts
import "server-only"

import { index, integer, pgTable, text } from "drizzle-orm/pg-core"

import { tsz } from "./_shared"

/**
 * Fixed-window counters for public endpoints (spec §7 "rate limit
 * (DB-backed)"). key = "<bucket>:<HMAC of the client IP>", never a raw IP.
 */
export const publicRateLimits = pgTable(
  "public_rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: tsz("reset_at").notNull(),
  },
  (t) => [index("public_rate_limits_reset_at_idx").on(t.resetAt)]
)
```

In `server/db/schema/index.ts` append:

```ts
export * from "./rate-limits"
```

Generate the migration:

```bash
pnpm db:generate --name public_rate_limits
```

Expected: `server/db/migrations/0006_public_rate_limits.sql` (the next free number after Phase 6's `0005`) containing only `CREATE TABLE "public_rate_limits" (…)` and `CREATE INDEX "public_rate_limits_reset_at_idx" …`. If it contains anything else, the schema drifted — stop and report.

`server/lib/ip.ts` (full file):

```ts
import "server-only"

import { createHmac } from "node:crypto"

import { deriveKey } from "@/server/lib/crypto"

/**
 * Client IP per spec §4: first value of X-Forwarded-For (Traefik), fallback
 * X-Real-IP, else null. Values are stored in the audit log, never logged.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  return headers.get("x-real-ip")?.trim() || null
}

/** Spec §13: lead IPs are stored (and rate-limited) as HMAC-SHA256 with the "lead-ip" key. */
export function hashIp(ip: string, secret?: string): string {
  return createHmac("sha256", deriveKey("lead-ip", secret))
    .update(ip)
    .digest("base64url")
}
```

`server/modules/rate-limit/repo.ts`:

```ts
import "server-only"

import { lte, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { publicRateLimits } from "@/server/db/schema"

/**
 * One atomic upsert: a new key or an expired window starts at 1 with a new
 * reset time, otherwise the count goes up and the reset time stays.
 */
export async function hitRateLimit(
  db: DbOrTx,
  key: string,
  now: Date,
  windowMs: number
): Promise<{ count: number; resetAt: Date }> {
  const at = sql`${now.toISOString()}::timestamptz`
  const [row] = await db
    .insert(publicRateLimits)
    .values({ key, count: 1, resetAt: new Date(now.getTime() + windowMs) })
    .onConflictDoUpdate({
      target: publicRateLimits.key,
      set: {
        count: sql`case when ${publicRateLimits.resetAt} <= ${at} then 1 else ${publicRateLimits.count} + 1 end`,
        resetAt: sql`case when ${publicRateLimits.resetAt} <= ${at} then excluded.reset_at else ${publicRateLimits.resetAt} end`,
      },
    })
    .returning({
      count: publicRateLimits.count,
      resetAt: publicRateLimits.resetAt,
    })
  return row
}

export async function deleteExpiredRateLimits(
  db: DbOrTx,
  now: Date
): Promise<number> {
  const rows = await db
    .delete(publicRateLimits)
    .where(lte(publicRateLimits.resetAt, now))
    .returning({ key: publicRateLimits.key })
  return rows.length
}
```

`server/lib/rate-limit.ts`:

```ts
import "server-only"

import { type DbOrTx, getDb } from "@/server/db/client"
import { hashIp } from "@/server/lib/ip"
import { hitRateLimit } from "@/server/modules/rate-limit/repo"

export type RateLimitResult = {
  allowed: boolean
  count: number
  retryAfterSeconds: number
}

/** Spec §9: 5 enquiries per 10 minutes per IP. */
export const LEAD_RATE_LIMIT = {
  bucket: "leads",
  max: 5,
  windowMs: 10 * 60_000,
} as const

export function rateLimitKey(bucket: string, ip: string | null): string {
  return `${bucket}:${ip ? hashIp(ip) : "unknown"}`
}

export async function consumeRateLimit(
  key: string,
  opts: { max: number; windowMs: number; now?: Date },
  db: DbOrTx = getDb()
): Promise<RateLimitResult> {
  const now = opts.now ?? new Date()
  const { count, resetAt } = await hitRateLimit(db, key, now, opts.windowMs)
  return {
    allowed: count <= opts.max,
    count,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt.getTime() - now.getTime()) / 1000)
    ),
  }
}
```

`server/api/middleware/rate-limit.ts`:

```ts
import "server-only"

import { createMiddleware } from "hono/factory"

import type { AppEnv } from "@/server/api/context"
import { clientIp } from "@/server/lib/ip"
import { consumeRateLimit, rateLimitKey } from "@/server/lib/rate-limit"

import { errorEnvelope } from "./error"

/** DB-backed fixed window per client IP; over the limit → 429 + Retry-After. */
export const rateLimit = (opts: {
  bucket: string
  max: number
  windowMs: number
}) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const result = await consumeRateLimit(
      rateLimitKey(opts.bucket, clientIp(c.req.raw.headers)),
      opts
    )
    if (!result.allowed)
      return c.json(
        errorEnvelope(c, "RATE_LIMITED", "Too many requests. Try again later."),
        429,
        { "Retry-After": String(result.retryAfterSeconds) }
      )
    await next()
  })
```

`server/api/middleware/error.ts`: replace the `HTTPException` branch of `onError` with:

```ts
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode
    const code = codeForStatus(status)
    const message =
      status >= 500 ? "Internal server error" : err.message || "Request failed"
    const response = c.json(errorEnvelope(c, code, message), status)
    // Keep headers the thrower set (e.g. Retry-After); the body is ours.
    err.res?.headers.forEach((value, name) => {
      const lower = name.toLowerCase()
      if (lower !== "content-type" && lower !== "content-length")
        response.headers.set(name, value)
    })
    return response
  }
```

`server/lib/turnstile.ts`:

```ts
import "server-only"

export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

const TIMEOUT_MS = 10_000

/** Cloudflare Turnstile server check (spec §9). Any failure is `false`. */
export async function verifyTurnstileToken(
  input: { secret: string; token: string | undefined; ip: string | null },
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (!input.token) return false
  const body = new URLSearchParams({
    secret: input.secret,
    response: input.token,
  })
  if (input.ip) body.set("remoteip", input.ip)
  try {
    const res = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: unknown }
    return data.success === true
  } catch {
    return false
  }
}
```

`server/modules/settings/service.ts` — add (merge the imports with the existing ones):

```ts
import { settingsSchemas } from "@/lib/schemas/settings"
import type { SettingsKey, SettingsValue } from "@/server/lib/settings-store"
import { type DbOrTx, getDb } from "@/server/db/client"
import { findSettingsRow } from "./repo"

/**
 * Published value of a content settings key for server code that runs
 * outside the cached public queries (leads, jobs). null when unpublished
 * or when the stored value no longer matches its schema.
 */
export async function getPublishedSettings<K extends SettingsKey>(
  key: K,
  db: DbOrTx = getDb()
): Promise<SettingsValue<K> | null> {
  const row = await findSettingsRow(db, key)
  if (!row?.published) return null
  const parsed = settingsSchemas[key].safeParse(row.published)
  return parsed.success ? (parsed.data as SettingsValue<K>) : null
}
```

`server/modules/leads/repo.ts`:

```ts
import "server-only"

import type { LeadEventType } from "@/lib/schemas/api/leads"
import type { DbOrTx } from "@/server/db/client"
import { leadEvents, leads } from "@/server/db/schema"

export type LeadRow = typeof leads.$inferSelect
export type NewLeadRow = typeof leads.$inferInsert

export async function insertLead(db: DbOrTx, row: NewLeadRow): Promise<LeadRow> {
  const [inserted] = await db.insert(leads).values(row).returning()
  return inserted
}

export async function insertLeadEvent(
  db: DbOrTx,
  row: {
    leadId: string
    type: LeadEventType
    body: string | null
    actorId: string | null
  }
): Promise<void> {
  await db.insert(leadEvents).values(row)
}
```

`server/modules/leads/service.ts`:

```ts
import "server-only"

import { createElement } from "react"

import { LeadAcknowledgementEmail } from "@/emails/lead-acknowledgement"
import { LeadNotificationEmail } from "@/emails/lead-notification"
import type { TurnstileConfig } from "@/lib/schemas/integrations"
import type {
  LeadPublicConfig,
  LeadSubmission,
} from "@/lib/schemas/api/leads"
import { formatDateTime } from "@/lib/format"
import { interpolate } from "@/lib/interpolate"
import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import { writeAudit } from "@/server/lib/audit"
import { AppError } from "@/server/lib/errors"
import { hashIp } from "@/server/lib/ip"
import { mailer } from "@/server/lib/mailer"
import { verifyTurnstileToken } from "@/server/lib/turnstile"
import { readIntegrationConfig } from "@/server/modules/integrations/service"
import { getPublishedSettings } from "@/server/modules/settings/service"

import * as repo from "./repo"

const DEFAULT_SUBJECT = "Website enquiry from {name}"
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`
const errorName = (err: unknown) =>
  err instanceof Error ? err.name : "unknown error"

async function readTurnstile(): Promise<TurnstileConfig | null | "unreadable"> {
  try {
    return await readIntegrationConfig("integrations.turnstile")
  } catch (err) {
    console.error(
      `[leads] Turnstile settings could not be read (${errorName(err)})`
    )
    return "unreadable"
  }
}

/** Site key for the invisible widget, only while spam protection is on. */
export async function publicFormConfig(): Promise<LeadPublicConfig> {
  const config = await readTurnstile()
  if (config === "unreadable" || !config?.enabled || !config.siteKey)
    return { turnstileSiteKey: null }
  return { turnstileSiteKey: config.siteKey }
}

async function assertHuman(token: string | undefined, ip: string | null) {
  const config = await readTurnstile()
  // Unreadable settings must not lose real enquiries: skip, logged above.
  if (config === "unreadable" || !config?.enabled) return
  if (await verifyTurnstileToken({ secret: config.secretKey, token, ip })) return
  throw new AppError("VALIDATION_FAILED", "Spam check failed", {
    fieldErrors: {
      turnstileToken: ["Spam check failed. Reload the page and try again."],
    },
  })
}

/**
 * Public contact form (spec §9). Honeypot submissions look successful but
 * store nothing. Emails run after the commit and never fail the request.
 */
export async function submitLead(
  input: LeadSubmission,
  meta: { ip: string | null }
): Promise<{ ok: true; leadId: string | null }> {
  if (input.website && input.website.trim() !== "") {
    console.info("[leads] honeypot filled; submission dropped")
    return { ok: true, leadId: null }
  }
  await assertHuman(input.turnstileToken, meta.ip)
  const lead = await getDb().transaction(async (tx) => {
    const row = await repo.insertLead(tx, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      service: input.service,
      message: input.message,
      consent: input.consent,
      sourcePage: input.sourcePage ?? null,
      ipHash: meta.ip ? hashIp(meta.ip) : null,
    })
    await repo.insertLeadEvent(tx, {
      leadId: row.id,
      type: "created",
      body: input.sourcePage
        ? `Sent from ${input.sourcePage}`
        : "Sent from the website",
      actorId: null,
    })
    await writeAudit(tx, null, {
      action: "lead.created",
      entityType: "lead",
      entityId: row.id,
    })
    return row
  })
  try {
    await notifyNewLead(lead)
  } catch (err) {
    console.error(`[leads] notification step failed (${errorName(err)})`)
  }
  return { ok: true, leadId: lead.id }
}

async function notifyNewLead(lead: repo.LeadRow): Promise<void> {
  const db = getDb()
  const [leadsSettings, site, contact, contactSection] = await Promise.all([
    getPublishedSettings("leads", db),
    getPublishedSettings("site", db),
    getPublishedSettings("contact", db),
    getPublishedSettings("sections.contact", db),
  ])
  const siteName = site?.name ?? "Security Partners"
  const outcomes: string[] = []

  const recipients = leadsSettings?.recipients ?? []
  if (recipients.length === 0) {
    outcomes.push("Staff notification not sent: no recipients in Settings ▸ Leads.")
  } else {
    const { delivered } = await mailer.send({
      to: recipients,
      replyTo: lead.email,
      subject: interpolate(
        contactSection?.form.mailtoSubject ?? DEFAULT_SUBJECT,
        { name: lead.name }
      ),
      react: createElement(LeadNotificationEmail, {
        siteName,
        adminUrl: new URL(
          `/admin/leads/${lead.id}`,
          getEnv().BETTER_AUTH_URL
        ).toString(),
        lead: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          service: lead.service,
          message: lead.message,
          sourcePage: lead.sourcePage,
          receivedAt: formatDateTime(lead.createdAt),
        },
      }),
    })
    outcomes.push(
      delivered
        ? `Staff notification sent to ${plural(recipients.length, "recipient")}.`
        : "Staff notification not sent: email is not configured or failed."
    )
  }

  if (leadsSettings?.acknowledgement) {
    const { delivered } = await mailer.send({
      to: lead.email,
      subject: `We received your message – ${siteName}`,
      react: createElement(LeadAcknowledgementEmail, {
        name: lead.name,
        siteName,
        message: lead.message,
        phone24h: contact?.phone24h ?? null,
      }),
    })
    outcomes.push(
      delivered
        ? "Acknowledgement sent to the visitor."
        : "Acknowledgement not sent: email is not configured or failed."
    )
  }

  for (const body of outcomes)
    await repo.insertLeadEvent(db, {
      leadId: lead.id,
      type: "email",
      body,
      actorId: null,
    })
}
```

`server/modules/leads/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { leadSubmission } from "@/lib/schemas/api/leads"
import type { AppEnv } from "@/server/api/context"
import { rateLimit } from "@/server/api/middleware/rate-limit"
import { zv } from "@/server/api/validate"
import { clientIp } from "@/server/lib/ip"
import { LEAD_RATE_LIMIT } from "@/server/lib/rate-limit"

import * as service from "./service"

/** /api/v1/public/leads — no session; 64 KB body limit is mounted in app.ts. */
export const publicLeadsRoutes = new Hono<AppEnv>()
  .get("/config", async (c) => {
    c.header("Cache-Control", "no-store")
    return c.json(await service.publicFormConfig(), 200)
  })
  .post(
    "/",
    // Before validation: every attempt from an IP counts.
    rateLimit(LEAD_RATE_LIMIT),
    zv("json", leadSubmission),
    async (c) => {
      await service.submitLead(c.req.valid("json"), {
        ip: clientIp(c.req.raw.headers),
      })
      return c.json({ ok: true as const }, 200)
    }
  )
```

`server/api/app.ts`: add `import { publicLeadsRoutes } from "@/server/modules/leads/routes"` and replace the public block with:

```ts
  // 3. Public endpoints: 64 KB body; leads add their own DB rate limit
  api.use("/v1/public/*", limitBody("public"))
  api.route("/v1/public/leads", publicLeadsRoutes)
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test:unit tests/unit/ip-hash.test.ts tests/unit/ip.test.ts tests/unit/turnstile.test.ts tests/unit/api tests/unit/schemas/leads.test.ts`
Expected: PASS (the Phase 1 `error-envelope.test.ts` still passes).

Run: `pnpm test:integration tests/integration/api/leads-public.test.ts tests/integration/db`
Expected: PASS (Mailpit needed for the last test).

Run: `pnpm lint && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/api/leads.ts server/db/schema/rate-limits.ts server/db/schema/index.ts server/db/migrations server/modules/rate-limit/repo.ts server/lib/rate-limit.ts server/api/middleware/rate-limit.ts server/api/middleware/error.ts server/lib/turnstile.ts server/lib/ip.ts server/modules/settings/service.ts server/modules/leads server/api/app.ts tests/unit/ip-hash.test.ts tests/unit/turnstile.test.ts tests/unit/api/http-exception-headers.test.ts tests/unit/schemas/leads.test.ts tests/integration/api/leads-public.test.ts
git commit -m "feat: accept website enquiries with spam checks and rate limiting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Contact form posts to the API — feedback copy, honeypot, invisible Turnstile, pixel freeze (master Task 7.3, part 2)

**Files:**
- Modify: `lib/schemas/settings/sections-contact.ts` (form copy fields), `server/db/seed/fixtures/settings.ts` (values), `components/home/contact-form.tsx` (full rewrite), `templates/shared/views.ts` (`contactSectionView` form props), `components/admin/settings/settings-meta.ts` (labels)
- Create: `components/home/use-turnstile.ts`, `server/db/migrations/0007_contact_form_feedback.sql` (custom migration via `db:generate --custom`, + `meta/` journal/snapshot)
- Test: `tests/dom/contact-form.test.tsx`, `tests/integration/db/contact-form-migration.test.ts`, `tests/unit/templates/contact-form-view.test.ts`; gate `pnpm test:visual` (0 px on `/` and `/contact`)

**Interfaces:**
- Consumes: Task 2 `LEADS_ENDPOINT`, `LEADS_CONFIG_ENDPOINT`, `LeadPublicConfig`; public endpoint behaviour (200 / 422 / 429); `fixtureSiteSources()` (`server/db/seed/fixtures/sources.ts`); `buttonClassName`, `cn`.
- Produces:

```ts
// lib/schemas/settings/sections-contact.ts — form gains (all `text`):
//   sendingLabel, successMessage, errorMessage, rateLimitedMessage
//   (mailtoSubject stays: subject of the staff notification email, {name} = visitor)
// components/home/contact-form.tsx
export type ContactFormLabels = { nameLabel; namePlaceholder; emailLabel; emailPlaceholder; phoneLabel; phonePlaceholder; messageLabel; messagePlaceholder; submitLabel; sendingLabel; successMessage; errorMessage; rateLimitedMessage: string }
export type ContactFormProps = { labels: ContactFormLabels }        // `mailto` prop removed
export function ContactForm(props: ContactFormProps): JSX.Element
// components/home/use-turnstile.ts
export const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
export type TurnstileApi = { render(el: HTMLElement, o: TurnstileRenderOptions): string; execute(id: string): void; reset(id: string): void; remove(id: string): void }
export function useTurnstile(container: RefObject<HTMLDivElement | null>): { prepare(): Promise<unknown>; getToken(): Promise<string | null>; reset(): void }
```

Rendered DOM contract (pixel freeze): the five visible fields and the button keep their exact markup and classes. Added inside the `<form>`, all **absolutely positioned** (out of flex flow → no extra `gap`): (1) `<div aria-hidden="true" class="pointer-events-none absolute -left-[10000px] top-0 h-px w-px overflow-hidden opacity-0">` holding the honeypot `<label for="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off">`; (2) `<div class="absolute h-0 w-0 overflow-hidden">` Turnstile container (widget must be "Invisible" mode); (3) the feedback `<p role="status" aria-live="polite">` with class `sr-only` while empty, switching to visible text classes after a submit. Nothing is fetched until the form first receives focus.

- [ ] **Step 1: Write the failing tests**

`tests/dom/contact-form.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ContactForm, type ContactFormLabels } from "@/components/home/contact-form"
import type { TurnstileApi } from "@/components/home/use-turnstile"

const labels: ContactFormLabels = {
  nameLabel: "Your Name",
  namePlaceholder: "John Smith",
  emailLabel: "Email",
  emailPlaceholder: "you@company.ie",
  phoneLabel: "Phone",
  phonePlaceholder: "085 000 0000",
  messageLabel: "Message",
  messagePlaceholder: "Tell us…",
  submitLabel: "Send Message",
  sendingLabel: "Sending…",
  successMessage: "Thank you, your message has been sent.",
  errorMessage: "Sorry, your message could not be sent.",
  rateLimitedMessage: "Please wait a few minutes and try again.",
}

type Reply = () => Promise<Response>
let leadReply: Reply
let siteKey: string | null
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url === "/api/v1/public/leads/config")
    return new Response(JSON.stringify({ turnstileSiteKey: siteKey }))
  return leadReply()
})

const json = (body: unknown, status = 200) => async () =>
  new Response(JSON.stringify(body), { status })

beforeEach(() => {
  siteKey = null
  leadReply = json({ ok: true })
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  delete window.turnstile
})

async function fillAndSend() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Your Name"), "Dinn Rí")
  await user.type(screen.getByLabelText("Email"), "dinn@example.ie")
  await user.type(screen.getByLabelText("Phone"), "085 123 4567")
  await user.type(screen.getByLabelText("Message"), "Need a quote")
  await user.click(screen.getByRole("button", { name: "Send Message" }))
  return user
}

const leadPosts = () =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/v1/public/leads")

describe("ContactForm (master 7.3)", () => {
  it("adds only out-of-flow elements: hidden honeypot, Turnstile slot, empty sr-only status", () => {
    const { container } = render(<ContactForm labels={labels} />)
    const honeypot = container.querySelector<HTMLInputElement>('input[name="website"]')!
    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.autocomplete).toBe("off")
    const trap = honeypot.closest("div")!
    expect(trap).toHaveAttribute("aria-hidden", "true")
    expect(trap.className).toContain("absolute")
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("")
    expect(status.className).toBe("sr-only")
    // Hidden from assistive tech: not in the accessibility tree.
    expect(screen.queryByRole("textbox", { name: "Website" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts JSON to the leads API and shows the success copy, then clears the form", async () => {
    render(<ContactForm labels={labels} />)
    await fillAndSend()
    expect(await screen.findByText(labels.successMessage)).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(labels.successMessage)
    const [, init] = leadPosts()[0]
    expect(init?.method).toBe("POST")
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Dinn Rí",
      email: "dinn@example.ie",
      phone: "085 123 4567",
      message: "Need a quote",
      consent: true,
      sourcePage: "/",
      website: "",
    })
    expect(screen.getByLabelText("Your Name")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Send Message" })).toBeEnabled()
  })

  it("shows the sending label and blocks double submits while waiting", async () => {
    let release!: (r: Response) => void
    leadReply = () => new Promise<Response>((resolve) => (release = resolve))
    render(<ContactForm labels={labels} />)
    const user = await fillAndSend()
    const button = await screen.findByRole("button", { name: "Sending…" })
    expect(button).toBeDisabled()
    await user.click(button)
    release(new Response(JSON.stringify({ ok: true })))
    await screen.findByText(labels.successMessage)
    expect(leadPosts()).toHaveLength(1)
  })

  it.each([
    ["429", json({ error: { code: "RATE_LIMITED" } }, 429), labels.rateLimitedMessage],
    ["422", json({ error: { code: "VALIDATION_FAILED" } }, 422), labels.errorMessage],
    ["500", json({}, 500), labels.errorMessage],
    [
      "network error",
      async () => {
        throw new TypeError("Failed to fetch")
      },
      labels.errorMessage,
    ],
  ] as [string, Reply, string][])("%s → the matching error copy, fields kept", async (_, reply, text) => {
    leadReply = reply
    render(<ContactForm labels={labels} />)
    await fillAndSend()
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.getByLabelText("Your Name")).toHaveValue("Dinn Rí")
  })

  it("with Turnstile enabled, renders the invisible widget on focus and sends its token", async () => {
    siteKey = "0x4AAAAAAAtestsitekey"
    let options: Parameters<TurnstileApi["render"]>[1] | undefined
    const api: TurnstileApi = {
      render: vi.fn((_el, o) => {
        options = o
        return "widget-1"
      }),
      execute: vi.fn(() => options?.callback("tok-123")),
      reset: vi.fn(),
      remove: vi.fn(),
    }
    window.turnstile = api
    render(<ContactForm labels={labels} />)
    await fillAndSend()
    await screen.findByText(labels.successMessage)
    expect(api.render).toHaveBeenCalledTimes(1)
    expect(options).toMatchObject({
      sitekey: "0x4AAAAAAAtestsitekey",
      execution: "execute",
    })
    expect(JSON.parse(String(leadPosts()[0][1]?.body)).turnstileToken).toBe(
      "tok-123"
    )
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith("widget-1"))
  })
})
```

`tests/unit/templates/contact-form-view.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { contactSectionView } from "@/templates/shared/views"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"

describe("contactSectionView form props (master 7.3)", () => {
  it("passes every label and the feedback copy; no mailto hand-off any more", () => {
    const { form } = contactSectionView(fixtureSiteSources())
    expect(Object.keys(form)).toEqual(["labels"])
    expect(form.labels).toEqual({
      nameLabel: "Your Name",
      namePlaceholder: "John Smith",
      emailLabel: "Email",
      emailPlaceholder: "you@company.ie",
      phoneLabel: "Phone",
      phonePlaceholder: "085 000 0000",
      messageLabel: "Message",
      messagePlaceholder: "Tell us about your security requirements...",
      submitLabel: "Send Message",
      sendingLabel: "Sending…",
      successMessage:
        "Thank you, your message has been sent. We will be in touch shortly.",
      errorMessage:
        "Sorry, your message could not be sent. Please try again or call us.",
      rateLimitedMessage:
        "You have sent several messages in a short time. Please wait a few minutes and try again.",
    })
  })
})
```

`tests/integration/db/contact-form-migration.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { revisions, settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) => f.endsWith("_contact_form_feedback.sql"))!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

const OLD_FORM = {
  nameLabel: "Your Name",
  namePlaceholder: "John Smith",
  emailLabel: "Email",
  emailPlaceholder: "you@company.ie",
  phoneLabel: "Phone",
  phonePlaceholder: "085 000 0000",
  messageLabel: "Message",
  messagePlaceholder: "Tell us",
  submitLabel: "Send Message",
  mailtoSubject: "Website enquiry from {name}",
}

beforeEach(async () => {
  await resetDb()
})

describe("0007_contact_form_feedback (custom data migration)", () => {
  it("adds the feedback copy to draft, published and revisions without overwriting edits", async () => {
    const db = getDb()
    await db.insert(settings).values({
      key: "sections.contact",
      draft: { heading: "Contact", form: OLD_FORM },
      published: {
        heading: "Contact",
        form: { ...OLD_FORM, successMessage: "Edited by the owner" },
      },
      version: 3,
    })
    await db.insert(revisions).values({
      entityType: "settings",
      entityId: "sections.contact",
      version: 2,
      data: { heading: "Contact", form: OLD_FORM },
    })
    for (const statement of statements) await db.execute(sql.raw(statement))

    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "sections.contact"))
    const draft = row.draft as { form: Record<string, string> }
    const published = row.published as { form: Record<string, string> }
    expect(draft.form).toMatchObject({
      ...OLD_FORM,
      sendingLabel: "Sending…",
      successMessage:
        "Thank you, your message has been sent. We will be in touch shortly.",
      errorMessage:
        "Sorry, your message could not be sent. Please try again or call us.",
      rateLimitedMessage:
        "You have sent several messages in a short time. Please wait a few minutes and try again.",
    })
    expect(published.form.successMessage).toBe("Edited by the owner")
    expect(published.form.sendingLabel).toBe("Sending…")
    const [revision] = await db.select().from(revisions)
    expect((revision.data as { form: Record<string, string> }).form.errorMessage).toBe(
      "Sorry, your message could not be sent. Please try again or call us."
    )
  })

  it("is a no-op when the row does not exist", async () => {
    for (const statement of statements) await getDb().execute(sql.raw(statement))
    expect(await getDb().select().from(settings)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run --project dom tests/dom/contact-form.test.tsx && pnpm test:unit tests/unit/templates/contact-form-view.test.ts`
Expected: FAIL — `ContactFormLabels` / `@/components/home/use-turnstile` missing; the view still returns `mailto`.

Run: `pnpm test:integration tests/integration/db/contact-form-migration.test.ts`
Expected: FAIL — `Cannot read properties of undefined` (no `*_contact_form_feedback.sql` yet).

- [ ] **Step 3: Implement**

`lib/schemas/settings/sections-contact.ts` — replace the `form` object with:

```ts
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
    /** Button text while the enquiry is being sent. */
    sendingLabel: text,
    successMessage: text,
    errorMessage: text,
    /** Shown on 429 (more than 5 enquiries in 10 minutes). */
    rateLimitedMessage: text,
    /** Subject of the staff notification email; {name} = the visitor. */
    mailtoSubject: text,
  }),
```

`server/db/seed/fixtures/settings.ts` — in `"sections.contact".form`, insert after `submitLabel: "Send Message",`:

```ts
        sendingLabel: "Sending…",
        successMessage:
          "Thank you, your message has been sent. We will be in touch shortly.",
        errorMessage:
          "Sorry, your message could not be sent. Please try again or call us.",
        rateLimitedMessage:
          "You have sent several messages in a short time. Please wait a few minutes and try again.",
```

Create the custom migration:

```bash
pnpm db:generate --custom --name contact_form_feedback
```

Expected: an empty `server/db/migrations/0007_contact_form_feedback.sql` and an updated `meta/_journal.json`. Write into the SQL file:

```sql
-- Phase 7: contact form feedback copy (settings.sections.contact.form).
-- Adds missing keys only; values the owner already edited win (right side of ||).
UPDATE "settings"
SET
  "draft" = jsonb_set("draft", '{form}', '{"sendingLabel":"Sending…","successMessage":"Thank you, your message has been sent. We will be in touch shortly.","errorMessage":"Sorry, your message could not be sent. Please try again or call us.","rateLimitedMessage":"You have sent several messages in a short time. Please wait a few minutes and try again."}'::jsonb || ("draft" -> 'form')),
  "published" = CASE
    WHEN jsonb_typeof("published" -> 'form') = 'object'
    THEN jsonb_set("published", '{form}', '{"sendingLabel":"Sending…","successMessage":"Thank you, your message has been sent. We will be in touch shortly.","errorMessage":"Sorry, your message could not be sent. Please try again or call us.","rateLimitedMessage":"You have sent several messages in a short time. Please wait a few minutes and try again."}'::jsonb || ("published" -> 'form'))
    ELSE "published"
  END
WHERE "key" = 'sections.contact' AND jsonb_typeof("draft" -> 'form') = 'object';
--> statement-breakpoint
UPDATE "revisions"
SET "data" = jsonb_set("data", '{form}', '{"sendingLabel":"Sending…","successMessage":"Thank you, your message has been sent. We will be in touch shortly.","errorMessage":"Sorry, your message could not be sent. Please try again or call us.","rateLimitedMessage":"You have sent several messages in a short time. Please wait a few minutes and try again."}'::jsonb || ("data" -> 'form'))
WHERE "entity_type" = 'settings' AND "entity_id" = 'sections.contact' AND jsonb_typeof("data" -> 'form') = 'object';
```

`components/home/use-turnstile.ts`:

```ts
"use client"

import { type RefObject, useCallback, useEffect, useRef } from "react"

import {
  LEADS_CONFIG_ENDPOINT,
  type LeadPublicConfig,
} from "@/lib/schemas/api/leads"

export type TurnstileRenderOptions = {
  sitekey: string
  execution: "execute"
  callback: (token: string) => void
  "error-callback": () => void
  "expired-callback": () => void
}

export type TurnstileApi = {
  render(el: HTMLElement, options: TurnstileRenderOptions): string
  execute(id: string): void
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
const TOKEN_TIMEOUT_MS = 15_000

let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("Turnstile unavailable"))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("Turnstile failed to load"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

type Widget = {
  api: TurnstileApi
  id: string
  pending: ((token: string | null) => void) | null
}

/**
 * Invisible Cloudflare Turnstile for the contact form (spec §9). Nothing
 * loads until prepare() (first focus); without a site key every token is
 * null and the server decides.
 */
export function useTurnstile(container: RefObject<HTMLDivElement | null>) {
  const ready = useRef<Promise<Widget | null> | null>(null)
  const widget = useRef<Widget | null>(null)

  const prepare = useCallback(() => {
    ready.current ??= (async (): Promise<Widget | null> => {
      try {
        const res = await fetch(LEADS_CONFIG_ENDPOINT)
        if (!res.ok) return null
        const { turnstileSiteKey } = (await res.json()) as LeadPublicConfig
        if (!turnstileSiteKey || !container.current) return null
        const api = await loadTurnstileScript()
        const w: Widget = { api, id: "", pending: null }
        const settle = (token: string | null) => {
          const pending = w.pending
          w.pending = null
          pending?.(token)
        }
        w.id = api.render(container.current, {
          sitekey: turnstileSiteKey,
          execution: "execute",
          callback: (token) => settle(token),
          "error-callback": () => settle(null),
          "expired-callback": () => undefined,
        })
        widget.current = w
        return w
      } catch {
        return null
      }
    })()
    return ready.current
  }, [container])

  const getToken = useCallback(async (): Promise<string | null> => {
    const w = await prepare()
    if (!w) return null
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        w.pending = null
        resolve(null)
      }, TOKEN_TIMEOUT_MS)
      w.pending = (token) => {
        clearTimeout(timer)
        resolve(token)
      }
      w.api.execute(w.id)
    })
  }, [prepare])

  /** Tokens are single-use: reset after every submit. */
  const reset = useCallback(() => {
    const w = widget.current
    if (w) w.api.reset(w.id)
  }, [])

  useEffect(
    () => () => {
      const w = widget.current
      if (w) w.api.remove(w.id)
    },
    []
  )

  return { prepare, getToken, reset }
}
```

`components/home/contact-form.tsx` (full file — the five fields and the button are unchanged):

```tsx
"use client"

import { useRef, useState } from "react"

import { buttonClassName } from "@/components/ui/button"
import { LEADS_ENDPOINT } from "@/lib/schemas/api/leads"
import { cn } from "@/lib/utils"

import { useTurnstile } from "./use-turnstile"

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

export type ContactFormLabels = {
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  messageLabel: string
  messagePlaceholder: string
  submitLabel: string
  sendingLabel: string
  successMessage: string
  errorMessage: string
  rateLimitedMessage: string
}

export type ContactFormProps = { labels: ContactFormLabels }

type Feedback = { kind: "success" | "error"; message: string }

/**
 * Enquiry form (spec §9): posts to the leads API. Everything added for the
 * API is absolutely positioned (outside the flex flow) so the form looks
 * exactly as before until it is submitted.
 */
export function ContactForm({ labels }: ContactFormProps) {
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const turnstileSlot = useRef<HTMLDivElement>(null)
  const turnstile = useTurnstile(turnstileSlot)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return
    const form = event.currentTarget
    const data = new FormData(form)
    const field = (name: string) => String(data.get(name) ?? "")
    setSending(true)
    setFeedback(null)
    try {
      const turnstileToken = await turnstile.getToken()
      const res = await fetch(LEADS_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: field("name"),
          email: field("email"),
          phone: field("phone"),
          message: field("message"),
          consent: true,
          sourcePage: window.location.pathname,
          website: field("website"),
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      })
      if (res.ok) {
        form.reset()
        setFeedback({ kind: "success", message: labels.successMessage })
      } else {
        setFeedback({
          kind: "error",
          message:
            res.status === 429 ? labels.rateLimitedMessage : labels.errorMessage,
        })
      }
    } catch {
      setFeedback({ kind: "error", message: labels.errorMessage })
    } finally {
      setSending(false)
      turnstile.reset()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={() => void turnstile.prepare()}
      className="flex flex-col gap-5"
    >
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
        disabled={sending}
        className={buttonClassName(
          { variant: "brand", size: "pill" },
          "w-full"
        )}
      >
        {sending ? labels.sendingLabel : labels.submitLabel}
      </button>
      {/* Honeypot: invisible to people and assistive tech, filled by bots. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 -left-[10000px] h-px w-px overflow-hidden opacity-0"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div ref={turnstileSlot} className="absolute h-0 w-0 overflow-hidden" />
      <p
        role="status"
        aria-live="polite"
        className={
          feedback
            ? cn(
                "text-[15px] leading-normal font-bold",
                feedback.kind === "success"
                  ? "text-brand-green-dark"
                  : "text-red-700"
              )
            : "sr-only"
        }
      >
        {feedback?.message ?? ""}
      </p>
    </form>
  )
}
```

`templates/shared/views.ts` — in `contactSectionView`, replace `const { mailtoSubject, ...labels } = section.form` and the `form:` property with:

```ts
  const f = section.form
  // …
    form: {
      labels: {
        nameLabel: f.nameLabel,
        namePlaceholder: f.namePlaceholder,
        emailLabel: f.emailLabel,
        emailPlaceholder: f.emailPlaceholder,
        phoneLabel: f.phoneLabel,
        phonePlaceholder: f.phonePlaceholder,
        messageLabel: f.messageLabel,
        messagePlaceholder: f.messagePlaceholder,
        submitLabel: f.submitLabel,
        sendingLabel: f.sendingLabel,
        successMessage: f.successMessage,
        errorMessage: f.errorMessage,
        rateLimitedMessage: f.rateLimitedMessage,
      },
    },
```

(`mailtoSubject` is no longer passed to the browser; `s.settings.contact.email` is no longer read here.)

`components/admin/settings/settings-meta.ts` — in `"sections.contact".fields`, replace the `"form.mailtoSubject"` entry with:

```ts
      "form.sendingLabel": { label: "Button text while sending" },
      "form.successMessage": {
        label: "Message after sending",
        widget: "textarea",
        rows: 2,
      },
      "form.errorMessage": {
        label: "Message when sending fails",
        widget: "textarea",
        rows: 2,
      },
      "form.rateLimitedMessage": {
        label: "Message after too many attempts",
        help: "Shown when one visitor sends more than 5 messages in 10 minutes.",
        widget: "textarea",
        rows: 2,
      },
      "form.mailtoSubject": {
        label: "Notification email subject",
        help: "Subject of the email staff receive for each enquiry. {name} is the visitor's name.",
      },
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm vitest run --project dom tests/dom/contact-form.test.tsx tests/dom/settings-editor.test.tsx && pnpm test:unit tests/unit/templates tests/unit/schemas tests/unit/seed`
Expected: PASS (inventory/fixture round-trip tests still pass: fields were only added).

Run: `pnpm test:integration tests/integration/db/contact-form-migration.test.ts tests/integration/seed tests/integration/queries tests/integration/pages`
Expected: PASS.

Run (port 3100 free; nobody else running Playwright/build): `pnpm test:visual`
Expected: every public baseline passes with 0 px difference (`/` and `/contact` included); admin shell baselines unchanged.

Run: `pnpm lint && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/settings/sections-contact.ts server/db/seed/fixtures/settings.ts server/db/migrations components/home/contact-form.tsx components/home/use-turnstile.ts templates/shared/views.ts components/admin/settings/settings-meta.ts tests/dom/contact-form.test.tsx tests/unit/templates/contact-form-view.test.ts tests/integration/db/contact-form-migration.test.ts
git commit -m "feat: send the contact form to the leads API with feedback copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Leads admin API — list, detail, status/assignee, notes, delete, CSV export, ⌘K, badge, dashboard link (master Task 7.4, part 1)

**Files:**
- Create: `lib/csv.ts`
- Modify: `lib/schemas/api/leads.ts` (admin schemas + DTO types), `server/modules/leads/{repo,service,routes}.ts` (admin functions + `leadsRoutes`), `server/api/app.ts` (mount `/leads` in `adminRoutes`), `lib/schemas/api/search.ts` (`"lead"`), `server/modules/search/{repo,service}.ts` (lead search), `components/admin/shell/command-palette.tsx` (icon + label for `lead`), `server/modules/dashboard/service.ts` (Next-up link)
- Test: `tests/unit/csv.test.ts`, `tests/integration/api/leads.test.ts`, `tests/integration/api/search-leads.test.ts`, `tests/integration/api/dashboard-leads.test.ts`

**Interfaces:**
- Consumes: Task 2 repo/service/schemas; `listQuery`, `sortParam`, `Paginated` (`lib/schemas/api/list.ts`); `idParam`; `can`/`actorOf`; `hasPermission`, `parseRoles`; `writeAudit`; `notFound`/`forbidden`/`AppError`; `isoDate` (`lib/format.ts`); table `users` (`id, name, email, role, banned`); Phase 4 Task 11 `getDashboard` (`nextUp` item `unassigned-leads`).
- Produces:

```ts
// lib/csv.ts (isomorphic)
export type CsvValue = string | number | boolean | null | undefined
export const CSV_BOM = "﻿"
export function csvCell(value: CsvValue): string      // formula guard: text starting with = + - @ TAB CR gets a leading '; RFC 4180 quoting
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string   // CRLF line ends, trailing CRLF
// lib/schemas/api/leads.ts (additions)
export const LEAD_STATUS_FILTERS = [...LEAD_STATUSES, "open", "all"] as const
export type LeadStatusFilter = (typeof LEAD_STATUS_FILTERS)[number]
export const leadListQuery     // listQuery + sort (createdAt|name|status, default createdAt:desc) + status? + assignee? ("me" | "none" | uuid) + from? + to? (ISO with offset)
export type LeadListQuery = z.output<typeof leadListQuery>
export const leadExportQuery   // q? status? assignee? from? to? email?
export type LeadExportQuery = z.output<typeof leadExportQuery>
export const updateLeadInput   // { status?: LeadStatus; assigneeId?: uuid | null } — at least one
export type UpdateLeadInput = z.output<typeof updateLeadInput>
export const leadNoteInput     // { body: 1..5000 chars, trimmed }
export type LeadPerson = { id: string; name: string }
export type LeadListItem = { id: string; name: string; email: string; phone: string | null; company: string | null; status: LeadStatus; assignee: LeadPerson | null; sourcePage: string | null; createdAt: string }
export type LeadEventItem = { id: string; type: LeadEventType; body: string | null; actor: LeadPerson | null; createdAt: string }
export type LeadDto = LeadListItem & { service: string | null; message: string; consent: boolean; updatedAt: string; events: LeadEventItem[] }
export type LeadAssignee = { id: string; name: string; email: string }
export type LeadBadge = { newLeads: number }
export const LEAD_EXPORT_LIMIT = 50_000
export const LEAD_CSV_HEADER: readonly string[]
// server/modules/leads/service.ts (additions)
export async function listLeads(actor: Actor, query: LeadListQuery): Promise<Paginated<LeadListItem>>
export async function getLead(actor: Actor, id: string): Promise<LeadDto>
export async function updateLead(actor: Actor, id: string, input: UpdateLeadInput): Promise<LeadDto>
export async function addLeadNote(actor: Actor, id: string, input: { body: string }): Promise<LeadDto>
export async function deleteLead(actor: Actor, id: string): Promise<{ ok: true }>
export async function exportLeads(actor: Actor, query: LeadExportQuery, now?: Date): Promise<{ csv: string; filename: string; count: number }>
export async function listAssignees(actor: Actor): Promise<{ items: LeadAssignee[] }>
export async function leadBadge(actor: Actor): Promise<LeadBadge>
// server/modules/leads/routes.ts
export const leadsRoutes: Hono<AppEnv>   // mounted at /api/v1/admin/leads
// HTTP (admin; session + sameOrigin on unsafe methods)
GET    /leads                    → Paginated<LeadListItem>            lead:read
GET    /leads/export.csv         → text/csv attachment                 lead:export
GET    /leads/assignees          → { items: LeadAssignee[] }           lead:read
GET    /leads/badge              → LeadBadge                           lead:read
GET    /leads/:id                → LeadDto                             lead:read
PATCH  /leads/:id  { status?, assigneeId? } → LeadDto                  lead:update (422 assignee who cannot work on leads)
POST   /leads/:id/events { body } → 201 LeadDto                        lead:update
DELETE /leads/:id                → { ok: true }                        lead:delete (owner/admin)
// search
SEARCH_TYPES += "lead"   // gated on lead:read; title = name, subtitle = email, href /admin/leads/:id
```

Rules: without `status`, lists hide spam; `open` = new|contacted|qualified; `all` = everything; `email=` (export only) matches case-insensitively and includes spam (subject-access requests). Status and assignee changes write `status` (`"New → Contacted"`) / `assigned` (`"Assigned to <name>"` | `"Unassigned"`) events with the actor, and audit `lead.updated` with `diff: { status?: {from,to}, assigneeId?: {from,to} }`; a change to the current value writes nothing. Notes: event `note`, audit `lead.note_added`. Delete: audit `lead.deleted` (no personal data in the diff), events cascade. Export: audit `lead.exported` with `diff: { count, filters: string[] }` (filter names only). Intake (`lead:read/update/export`) reaches only leads; every other admin resource stays 403 for intake.

- [ ] **Step 1: Write the failing tests**

`tests/unit/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { CSV_BOM, csvCell, toCsv } from "@/lib/csv"

describe("CSV (RFC 4180 + formula-injection guard, master 7.4)", () => {
  it("quotes only when needed and doubles quotes", () => {
    expect(csvCell("plain")).toBe("plain")
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell("a,b")).toBe('"a,b"')
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"')
    expect(csvCell("cr\r\nlf")).toBe('"cr\r\nlf"')
    expect(csvCell(null)).toBe("")
    expect(csvCell(undefined)).toBe("")
    expect(csvCell(true)).toBe("true")
    expect(csvCell(-5)).toBe("-5")
  })

  it.each(["=SUM(A1)", "+353 85 000", "-2+3", "@cmd", "\tTAB", "\rCR"])(
    "prefixes %j with an apostrophe",
    (value) => {
      expect(csvCell(value).replace(/^"|"$/g, "").startsWith("'")).toBe(true)
    }
  )

  it("guards before quoting", () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(
      `"'=HYPERLINK(""http://x"",""y"")"`
    )
  })

  it("joins rows with CRLF and ends with CRLF; BOM is exported separately", () => {
    expect(toCsv(["A", "B"], [["1", "x,y"], [null, "=1"]])).toBe(
      'A,B\r\n1,"x,y"\r\n,\'=1\r\n'
    )
    expect(CSV_BOM).toBe("﻿")
  })
})
```

`tests/integration/api/leads.test.ts`:

```ts
import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import type { LeadAssignee, LeadDto, LeadListItem } from "@/lib/schemas/api/leads"
import type { Paginated } from "@/lib/schemas/api/list"
import { getDb } from "@/server/db/client"
import { auditLog, leadEvents, leads, users } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const DAY = 86_400_000
let intake: { cookie: string; userId: string; name: string }
let admin: { cookie: string; userId: string; name: string }
let editor: string
let viewer: string

type NewLead = Partial<typeof leads.$inferInsert>
async function addLead(over: NewLead = {}) {
  const [row] = await getDb()
    .insert(leads)
    .values({
      name: "Visitor",
      email: "visitor@example.ie",
      message: "Hello",
      consent: true,
      ...over,
    })
    .returning()
  return row
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status)
  return (await res.json()) as T
}

const list = async (cookie: string, query = "") =>
  json<Paginated<LeadListItem>>(await adminRequest(`/leads${query}`, { cookie }))

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  const i = await signedInUser(["intake"])
  intake = { cookie: i.cookie, userId: i.user.id, name: i.user.name }
  const a = await signedInUser(["admin"])
  admin = { cookie: a.cookie, userId: a.user.id, name: a.user.name }
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
})

describe("GET /leads (inbox list)", () => {
  it("lists newest first, hides spam unless asked, filters by status, assignee and text", async () => {
    const now = Date.now()
    await addLead({ name: "Old", createdAt: new Date(now - 3 * DAY) })
    await addLead({
      name: "Assigned",
      status: "contacted",
      assigneeId: intake.userId,
      createdAt: new Date(now - 2 * DAY),
    })
    await addLead({ name: "Spammy", status: "spam", createdAt: new Date(now - DAY) })
    await addLead({ name: "Won deal", status: "won", company: "Acme Ltd", createdAt: new Date(now) })

    const all = await list(intake.cookie)
    expect(all.items.map((l) => l.name)).toEqual(["Won deal", "Assigned", "Old"])
    expect(all.total).toBe(3)
    expect(all.items[1].assignee).toEqual({ id: intake.userId, name: intake.name })

    expect((await list(intake.cookie, "?status=spam")).items.map((l) => l.name)).toEqual(["Spammy"])
    expect((await list(intake.cookie, "?status=all")).total).toBe(4)
    expect((await list(intake.cookie, "?status=open")).items.map((l) => l.name)).toEqual(["Assigned", "Old"])
    expect((await list(intake.cookie, "?assignee=me")).items.map((l) => l.name)).toEqual(["Assigned"])
    expect((await list(intake.cookie, "?assignee=none")).items.map((l) => l.name)).toEqual(["Won deal", "Old"])
    expect((await list(intake.cookie, "?q=acme")).items.map((l) => l.name)).toEqual(["Won deal"])
    expect((await list(intake.cookie, "?sort=name:asc")).items.map((l) => l.name)).toEqual(["Assigned", "Old", "Won deal"])
    const paged = await list(intake.cookie, "?page=2&pageSize=2")
    expect(paged).toMatchObject({ page: 2, pageSize: 2, total: 3 })
    expect(paged.items.map((l) => l.name)).toEqual(["Old"])
  })

  it("is for lead readers only; intake reaches nothing else", async () => {
    expect((await adminRequest("/leads", { cookie: editor })).status).toBe(403)
    expect((await adminRequest("/leads", { cookie: viewer })).status).toBe(403)
    expect((await adminRequest("/leads")).status).toBe(401)
    for (const path of ["/pages", "/services", "/settings", "/users", "/audit"])
      expect((await adminRequest(path, { cookie: intake.cookie })).status).toBe(403)
  })
})

describe("GET /leads/:id", () => {
  it("returns the full lead with its timeline", async () => {
    const lead = await addLead({ phone: "085", sourcePage: "/contact" })
    await getDb().insert(leadEvents).values([
      { leadId: lead.id, type: "created", body: "Sent from /contact", actorId: null, createdAt: new Date(Date.now() - 1000) },
      { leadId: lead.id, type: "note", body: "Called back", actorId: admin.userId },
    ])
    const dto = await json<LeadDto>(await adminRequest(`/leads/${lead.id}`, { cookie: intake.cookie }))
    expect(dto).toMatchObject({
      id: lead.id,
      message: "Hello",
      consent: true,
      phone: "085",
      sourcePage: "/contact",
      status: "new",
    })
    expect(dto.events.map((e) => [e.type, e.body, e.actor?.name ?? null])).toEqual([
      ["created", "Sent from /contact", null],
      ["note", "Called back", admin.name],
    ])
  })

  it("404 for an unknown id, 422 for a malformed one", async () => {
    expect((await adminRequest("/leads/0190a6e0-0000-7000-8000-000000000999", { cookie: intake.cookie })).status).toBe(404)
    expect((await adminRequest("/leads/not-a-uuid", { cookie: intake.cookie })).status).toBe(422)
  })
})

describe("PATCH /leads/:id (status workflow + assignee)", () => {
  it("moves the status, assigns, records events and audits", async () => {
    const lead = await addLead()
    const dto = await json<LeadDto>(
      await adminRequest(`/leads/${lead.id}`, {
        cookie: intake.cookie,
        method: "PATCH",
        json: { status: "contacted", assigneeId: admin.userId },
      })
    )
    expect(dto.status).toBe("contacted")
    expect(dto.assignee).toEqual({ id: admin.userId, name: admin.name })
    expect(dto.events.map((e) => [e.type, e.body, e.actor?.id])).toEqual([
      ["status", "New → Contacted", intake.userId],
      ["assigned", `Assigned to ${admin.name}`, intake.userId],
    ])
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "lead.updated"), eq(auditLog.entityId, lead.id)))
    expect(audit.diff).toEqual({
      status: { from: "new", to: "contacted" },
      assigneeId: { from: null, to: admin.userId },
    })

    const cleared = await json<LeadDto>(
      await adminRequest(`/leads/${lead.id}`, {
        cookie: intake.cookie,
        method: "PATCH",
        json: { assigneeId: null, status: "contacted" },
      })
    )
    expect(cleared.assignee).toBeNull()
    expect(cleared.events.at(-1)?.body).toBe("Unassigned")
    expect(cleared.events.filter((e) => e.type === "status")).toHaveLength(1)
  })

  it("rejects assignees who cannot work on leads (editor, banned) and empty changes", async () => {
    const lead = await addLead()
    const editorUser = await signedInUser(["editor"])
    const patch = (json: unknown) =>
      adminRequest(`/leads/${lead.id}`, { cookie: admin.cookie, method: "PATCH", json })
    const bad = await patch({ assigneeId: editorUser.user.id })
    expect(bad.status).toBe(422)
    expect(Object.keys(((await bad.json()) as { error: { fieldErrors: object } }).error.fieldErrors)).toEqual(["assigneeId"])
    const bannedIntake = await signedInUser(["intake"])
    await getDb().update(users).set({ banned: true }).where(eq(users.id, bannedIntake.user.id))
    expect((await patch({ assigneeId: bannedIntake.user.id })).status).toBe(422)
    expect((await patch({})).status).toBe(422)
    expect((await patch({ status: "maybe" })).status).toBe(422)
    expect(
      (await adminRequest(`/leads/${lead.id}`, { cookie: viewer, method: "PATCH", json: { status: "won" } })).status
    ).toBe(403)
  })
})

describe("POST /leads/:id/events (notes)", () => {
  it("adds a note to the timeline", async () => {
    const lead = await addLead()
    const dto = await json<LeadDto>(
      await adminRequest(`/leads/${lead.id}/events`, {
        cookie: intake.cookie,
        method: "POST",
        json: { body: "  Left a voicemail  " },
      }),
      201
    )
    expect(dto.events.at(-1)).toMatchObject({
      type: "note",
      body: "Left a voicemail",
      actor: { id: intake.userId, name: intake.name },
    })
    expect(
      (await adminRequest(`/leads/${lead.id}/events`, { cookie: intake.cookie, method: "POST", json: { body: " " } })).status
    ).toBe(422)
    const [audit] = await getDb().select().from(auditLog).where(eq(auditLog.action, "lead.note_added"))
    expect(audit.entityId).toBe(lead.id)
  })
})

describe("DELETE /leads/:id (GDPR erasure)", () => {
  it("is owner/admin only, removes the lead and its events, audits without personal data", async () => {
    const lead = await addLead({ email: "erase-me@example.ie" })
    await getDb().insert(leadEvents).values({ leadId: lead.id, type: "note", body: "x", actorId: null })
    expect((await adminRequest(`/leads/${lead.id}`, { cookie: intake.cookie, method: "DELETE" })).status).toBe(403)
    expect(await json(await adminRequest(`/leads/${lead.id}`, { cookie: admin.cookie, method: "DELETE" }))).toEqual({ ok: true })
    expect(await getDb().select().from(leads)).toHaveLength(0)
    expect(await getDb().select().from(leadEvents)).toHaveLength(0)
    const [audit] = await getDb().select().from(auditLog).where(eq(auditLog.action, "lead.deleted"))
    expect(audit.entityId).toBe(lead.id)
    expect(JSON.stringify(audit.diff ?? null)).not.toContain("erase-me")
    expect((await adminRequest(`/leads/${lead.id}`, { cookie: admin.cookie, method: "DELETE" })).status).toBe(404)
  })
})

describe("GET /leads/export.csv", () => {
  it("exports RFC 4180 CSV with a formula guard, notes and an audit row", async () => {
    const lead = await addLead({
      name: '=HYPERLINK("http://evil","x")',
      email: "a@example.ie",
      phone: "+353 85 000 0000",
      message: 'He said "hi",\nthen left',
      createdAt: new Date("2026-10-01T09:00:00Z"),
    })
    await getDb().insert(leadEvents).values({
      leadId: lead.id,
      type: "note",
      body: "Rang back",
      actorId: admin.userId,
      createdAt: new Date("2026-10-02T10:00:00Z"),
    })
    const res = await adminRequest("/leads/export.csv", { cookie: intake.cookie })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"$/)
    const text = await res.text()
    expect(text.startsWith("﻿")).toBe(true)
    const lines = text.slice(1).split("\r\n")
    expect(lines[0]).toBe(
      "Received (UTC),Status,Name,Email,Phone,Company,Service,Message,Consent,Source page,Assignee,Notes,Lead ID"
    )
    expect(lines[1]).toBe(
      `2026-10-01T09:00:00.000Z,New,"'=HYPERLINK(""http://evil"",""x"")",a@example.ie,'+353 85 000 0000,,,"He said ""hi"",\nthen left",yes,,,2026-10-02T10:00:00.000Z ${admin.name}: Rang back,${lead.id}`
    )
    const [audit] = await getDb().select().from(auditLog).where(eq(auditLog.action, "lead.exported"))
    expect(audit.diff).toEqual({ count: 1, filters: [] })
  })

  it("subject-access export by email includes spam and nothing else", async () => {
    await addLead({ email: "Subject@Example.ie", status: "spam" })
    await addLead({ email: "subject@example.ie" })
    await addLead({ email: "other@example.ie" })
    const res = await adminRequest(`/leads/export.csv?email=${encodeURIComponent("subject@example.ie")}`, { cookie: admin.cookie })
    const rows = (await res.text()).slice(1).trim().split("\r\n").slice(1)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => /subject@example\.ie/i.test(r))).toBe(true)
  })

  it("needs lead:export", async () => {
    expect((await adminRequest("/leads/export.csv", { cookie: editor })).status).toBe(403)
    expect((await adminRequest("/leads/export.csv", { cookie: viewer })).status).toBe(403)
  })
})

describe("assignees and badge", () => {
  it("assignees = active users who can work on leads, by name", async () => {
    const banned = await signedInUser(["intake"])
    await getDb().update(users).set({ banned: true }).where(eq(users.id, banned.user.id))
    const { items } = await json<{ items: LeadAssignee[] }>(await adminRequest("/leads/assignees", { cookie: intake.cookie }))
    const ids = items.map((u) => u.id)
    expect(ids).toContain(intake.userId)
    expect(ids).toContain(admin.userId)
    expect(ids).not.toContain(banned.user.id)
    expect(items.map((u) => u.name)).toEqual([...items.map((u) => u.name)].sort((a, b) => a.localeCompare(b)))
    expect((await adminRequest("/leads/assignees", { cookie: editor })).status).toBe(403)
  })

  it("badge counts unassigned new leads", async () => {
    await addLead()
    await addLead()
    await addLead({ assigneeId: intake.userId })
    await addLead({ status: "contacted" })
    expect(await json(await adminRequest("/leads/badge", { cookie: intake.cookie }))).toEqual({ newLeads: 2 })
    expect((await adminRequest("/leads/badge", { cookie: viewer })).status).toBe(403)
  })
})
```

`tests/integration/api/search-leads.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest"

import type { SearchResult } from "@/lib/schemas/api/search"
import { getDb } from "@/server/db/client"
import { leads } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let leadId: string
let intake: string
let editor: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  const [row] = await getDb()
    .insert(leads)
    .values({ name: "Zelda Quartz", email: "zelda@example.ie", company: "Quartz Ltd", message: "Hi" })
    .returning()
  leadId = row.id
  intake = (await signedInUser(["intake"])).cookie
  editor = (await signedInUser(["editor"])).cookie
})

const search = async (cookie: string, q: string) => {
  const res = await adminRequest(`/search?q=${encodeURIComponent(q)}`, { cookie })
  expect(res.status).toBe(200)
  return ((await res.json()) as { items: SearchResult[] }).items
}

describe("⌘K lead results (gated on lead:read)", () => {
  it("intake finds leads by name, email or company", async () => {
    for (const q of ["zelda", "zelda@example", "quartz"])
      expect(await search(intake, q)).toEqual([
        { type: "lead", id: leadId, title: "Zelda Quartz", subtitle: "zelda@example.ie", href: `/admin/leads/${leadId}` },
      ])
  })

  it("roles without lead:read never see leads", async () => {
    expect((await search(editor, "zelda")).filter((r) => r.type === "lead")).toEqual([])
  })
})
```

`tests/integration/api/dashboard-leads.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { DashboardDto } from "@/lib/schemas/api/dashboard"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import { mailer } from "@/server/lib/mailer"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  vi.spyOn(mailer, "send").mockResolvedValue({ delivered: false })
})

describe("dashboard uses real lead data (master 4.7 × 7.3)", () => {
  it("a public enquiry raises leads 30d / open leads and links Next up to the filtered inbox", async () => {
    const { cookie } = await signedInUser(["admin"])
    const before = (await (await adminRequest("/dashboard", { cookie })).json()) as DashboardDto
    const res = await app.request("/api/v1/public/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.200" },
      body: JSON.stringify({ name: "Dash", email: "dash@example.ie", message: "Hi" }),
    })
    expect(res.status).toBe(200)
    const after = (await (await adminRequest("/dashboard", { cookie })).json()) as DashboardDto
    expect(after.kpis.leads30d).toBe((before.kpis.leads30d ?? 0) + 1)
    expect(after.kpis.openLeads).toBe((before.kpis.openLeads ?? 0) + 1)
    expect(after.leadsTrend!.at(-1)!.count).toBeGreaterThanOrEqual(1)
    expect(after.nextUp.find((i) => i.id === "unassigned-leads")?.href).toBe(
      "/admin/leads?status=new&assignee=none"
    )
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm test:unit tests/unit/csv.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/csv"`.

Run: `pnpm test:integration tests/integration/api/leads.test.ts tests/integration/api/search-leads.test.ts tests/integration/api/dashboard-leads.test.ts`
Expected: FAIL — `/leads` answers 404 (`Route not found`), no `lead` search results, Next-up href is `/admin/leads`.

- [ ] **Step 3: Implement**

`lib/csv.ts`:

```ts
// CSV export (RFC 4180) with a spreadsheet formula-injection guard (OWASP).
export type CsvValue = string | number | boolean | null | undefined

/** Prepended to downloads so Excel reads UTF-8 ("Dinn Rí"). */
export const CSV_BOM = "﻿"

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  let text = String(value)
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(
  header: readonly string[],
  rows: readonly (readonly CsvValue[])[]
): string {
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .map((line) => `${line}\r\n`)
    .join("")
}
```

`lib/schemas/api/leads.ts` — add (after the existing exports; add `import { listQuery, sortParam } from "./list"`):

```ts
export const LEAD_STATUS_FILTERS = [...LEAD_STATUSES, "open", "all"] as const
export type LeadStatusFilter = (typeof LEAD_STATUS_FILTERS)[number]

const leadFilters = {
  /** none = everything except spam; open = new|contacted|qualified; all = everything */
  status: z.enum(LEAD_STATUS_FILTERS).optional(),
  assignee: z.union([z.literal("me"), z.literal("none"), z.uuid()]).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
}

/** GET /api/v1/admin/leads */
export const leadListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "name", "status"], {
    field: "createdAt",
    dir: "desc",
  }),
  ...leadFilters,
})
export type LeadListQuery = z.output<typeof leadListQuery>

/** GET /api/v1/admin/leads/export.csv — `email` for subject-access requests. */
export const leadExportQuery = z.object({
  q: z.string().trim().max(200).optional(),
  ...leadFilters,
  email: z.email().optional(),
})
export type LeadExportQuery = z.output<typeof leadExportQuery>

export const updateLeadInput = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    assigneeId: z.uuid().nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.assigneeId !== undefined, {
    message: "Change the status or the assignee",
  })
export type UpdateLeadInput = z.output<typeof updateLeadInput>

export const leadNoteInput = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a note")
    .max(5000, "Keep notes under 5,000 characters"),
})

export type LeadPerson = { id: string; name: string }
export type LeadListItem = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  status: LeadStatus
  assignee: LeadPerson | null
  sourcePage: string | null
  createdAt: string
}
export type LeadEventItem = {
  id: string
  type: LeadEventType
  body: string | null
  /** null = the website (created/email events) or a deleted user */
  actor: LeadPerson | null
  createdAt: string
}
export type LeadDto = LeadListItem & {
  service: string | null
  message: string
  consent: boolean
  updatedAt: string
  events: LeadEventItem[]
}
export type LeadAssignee = { id: string; name: string; email: string }
export type LeadBadge = { newLeads: number }

export const LEAD_EXPORT_LIMIT = 50_000
export const LEAD_CSV_HEADER = [
  "Received (UTC)",
  "Status",
  "Name",
  "Email",
  "Phone",
  "Company",
  "Service",
  "Message",
  "Consent",
  "Source page",
  "Assignee",
  "Notes",
  "Lead ID",
] as const
```

`server/modules/leads/repo.ts` — full file (Task 2 functions + admin queries):

```ts
import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm"

import {
  type LeadEventType,
  type LeadStatus,
  type LeadStatusFilter,
  OPEN_LEAD_STATUSES,
} from "@/lib/schemas/api/leads"
import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { leadEvents, leads, users } from "@/server/db/schema"

export type LeadRow = typeof leads.$inferSelect
export type NewLeadRow = typeof leads.$inferInsert

export async function insertLead(db: DbOrTx, row: NewLeadRow): Promise<LeadRow> {
  const [inserted] = await db.insert(leads).values(row).returning()
  return inserted
}

export async function insertLeadEvent(
  db: DbOrTx,
  row: {
    leadId: string
    type: LeadEventType
    body: string | null
    actorId: string | null
  }
): Promise<void> {
  await db.insert(leadEvents).values(row)
}

export type LeadFilters = {
  status?: LeadStatusFilter
  /** user id, or "none" for unassigned */
  assigneeId?: string
  q?: string
  from?: Date
  to?: Date
  email?: string
}
export type LeadSortField = "createdAt" | "name" | "status"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

function whereFor(f: LeadFilters): SQL | undefined {
  const c: (SQL | undefined)[] = []
  if (f.status === "open") c.push(inArray(leads.status, [...OPEN_LEAD_STATUSES]))
  else if (f.status && f.status !== "all") c.push(eq(leads.status, f.status))
  else if (!f.status && !f.email) c.push(ne(leads.status, "spam"))
  if (f.assigneeId === "none") c.push(isNull(leads.assigneeId))
  else if (f.assigneeId) c.push(eq(leads.assigneeId, f.assigneeId))
  if (f.q) {
    const p = `%${escapeLike(f.q)}%`
    c.push(
      or(
        ilike(leads.name, p),
        ilike(leads.email, p),
        ilike(leads.company, p),
        ilike(leads.phone, p)
      )
    )
  }
  if (f.email) c.push(sql`lower(${leads.email}) = ${f.email.toLowerCase()}`)
  if (f.from) c.push(gte(leads.createdAt, f.from))
  if (f.to) c.push(lte(leads.createdAt, f.to))
  return and(...c)
}

const leadColumns = {
  id: leads.id,
  name: leads.name,
  email: leads.email,
  phone: leads.phone,
  company: leads.company,
  service: leads.service,
  message: leads.message,
  consent: leads.consent,
  status: leads.status,
  sourcePage: leads.sourcePage,
  assigneeId: leads.assigneeId,
  assigneeName: users.name,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
}
export type LeadWithAssignee = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  service: string | null
  message: string
  consent: boolean
  status: LeadStatus
  sourcePage: string | null
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  updatedAt: Date
}

export async function listLeadRows(
  db: DbOrTx,
  opts: {
    filters: LeadFilters
    sort: Sort<LeadSortField>
    page: number
    pageSize: number
  }
): Promise<{ rows: LeadWithAssignee[]; total: number }> {
  const where = whereFor(opts.filters)
  const [{ total }] = await db.select({ total: count() }).from(leads).where(where)
  const column =
    opts.sort.field === "name"
      ? leads.name
      : opts.sort.field === "status"
        ? leads.status
        : leads.createdAt
  const rows = await db
    .select(leadColumns)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      desc(leads.id)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

export async function findLeadRow(
  db: DbOrTx,
  id: string
): Promise<LeadWithAssignee | null> {
  const [row] = await db
    .select(leadColumns)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(eq(leads.id, id))
  return row ?? null
}

export async function listLeadEventRows(db: DbOrTx, leadId: string) {
  return db
    .select({
      id: leadEvents.id,
      type: leadEvents.type,
      body: leadEvents.body,
      actorId: leadEvents.actorId,
      actorName: users.name,
      createdAt: leadEvents.createdAt,
    })
    .from(leadEvents)
    .leftJoin(users, eq(users.id, leadEvents.actorId))
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(asc(leadEvents.createdAt), asc(leadEvents.id))
}

export async function updateLeadRow(
  db: DbOrTx,
  id: string,
  patch: { status?: LeadStatus; assigneeId?: string | null }
): Promise<void> {
  await db.update(leads).set(patch).where(eq(leads.id, id))
}

export async function deleteLeadRow(db: DbOrTx, id: string): Promise<boolean> {
  const rows = await db
    .delete(leads)
    .where(eq(leads.id, id))
    .returning({ id: leads.id })
  return rows.length > 0
}

export async function exportLeadRows(
  db: DbOrTx,
  filters: LeadFilters,
  limit: number
): Promise<LeadWithAssignee[]> {
  return db
    .select(leadColumns)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(whereFor(filters))
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(limit)
}

export async function listNoteRows(db: DbOrTx, leadIds: readonly string[]) {
  if (leadIds.length === 0) return []
  return db
    .select({
      leadId: leadEvents.leadId,
      body: leadEvents.body,
      actorName: users.name,
      createdAt: leadEvents.createdAt,
    })
    .from(leadEvents)
    .leftJoin(users, eq(users.id, leadEvents.actorId))
    .where(and(inArray(leadEvents.leadId, [...leadIds]), eq(leadEvents.type, "note")))
    .orderBy(asc(leadEvents.createdAt), asc(leadEvents.id))
}

export async function listStaffUsers(db: DbOrTx) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      banned: users.banned,
    })
    .from(users)
    .orderBy(asc(users.name))
}

export async function findStaffUser(db: DbOrTx, id: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, role: users.role, banned: users.banned })
    .from(users)
    .where(eq(users.id, id))
  return row ?? null
}

export async function countUnassignedNewLeads(db: DbOrTx): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(eq(leads.status, "new"), isNull(leads.assigneeId)))
  return total
}
```

`server/modules/leads/service.ts` — add these imports (merge with the Task 2 imports) and functions:

```ts
import { CSV_BOM, toCsv } from "@/lib/csv"
import { hasPermission, parseRoles, type PermissionRequest } from "@/lib/auth/permissions"
import {
  LEAD_CSV_HEADER,
  LEAD_EXPORT_LIMIT,
  LEAD_STATUS_LABELS,
  type LeadAssignee,
  type LeadBadge,
  type LeadDto,
  type LeadEventType,
  type LeadExportQuery,
  type LeadListItem,
  type LeadListQuery,
  type LeadStatus,
  type UpdateLeadInput,
} from "@/lib/schemas/api/leads"
import type { Paginated } from "@/lib/schemas/api/list"
import { isoDate } from "@/lib/format"
import type { Actor } from "@/server/lib/actor"
import { forbidden, notFound } from "@/server/lib/errors"

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const canWorkLeads = (role: string | null, banned: boolean | null) =>
  !banned && hasPermission(parseRoles(role), { lead: ["update"] })

function toListItem(row: repo.LeadWithAssignee): LeadListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    status: row.status,
    assignee: row.assigneeId
      ? { id: row.assigneeId, name: row.assigneeName ?? "Deleted user" }
      : null,
    sourcePage: row.sourcePage,
    createdAt: row.createdAt.toISOString(),
  }
}

function filtersFrom(
  actor: Actor,
  q: Pick<LeadExportQuery, "q" | "status" | "assignee" | "from" | "to" | "email">
): repo.LeadFilters {
  return {
    status: q.status,
    assigneeId: q.assignee === "me" ? actor.userId : q.assignee,
    q: q.q || undefined,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    email: q.email,
  }
}

export async function listLeads(
  actor: Actor,
  query: LeadListQuery
): Promise<Paginated<LeadListItem>> {
  assertCan(actor, { lead: ["read"] })
  const { rows, total } = await repo.listLeadRows(getDb(), {
    filters: filtersFrom(actor, query),
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toListItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getLead(actor: Actor, id: string): Promise<LeadDto> {
  assertCan(actor, { lead: ["read"] })
  const db = getDb()
  const row = await repo.findLeadRow(db, id)
  if (!row) throw notFound("Lead")
  const events = await repo.listLeadEventRows(db, id)
  return {
    ...toListItem(row),
    service: row.service,
    message: row.message,
    consent: row.consent,
    updatedAt: row.updatedAt.toISOString(),
    events: events.map((e) => ({
      id: e.id,
      type: e.type as LeadEventType,
      body: e.body,
      actor: e.actorId
        ? { id: e.actorId, name: e.actorName ?? "Deleted user" }
        : null,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}

/** Status workflow new → contacted → qualified → won | lost | spam, and assignee. */
export async function updateLead(
  actor: Actor,
  id: string,
  input: UpdateLeadInput
): Promise<LeadDto> {
  assertCan(actor, { lead: ["update"] })
  await getDb().transaction(async (tx) => {
    const row = await repo.findLeadRow(tx, id)
    if (!row) throw notFound("Lead")
    const patch: { status?: LeadStatus; assigneeId?: string | null } = {}
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    const events: { type: LeadEventType; body: string }[] = []
    if (input.status !== undefined && input.status !== row.status) {
      patch.status = input.status
      diff.status = { from: row.status, to: input.status }
      events.push({
        type: "status",
        body: `${LEAD_STATUS_LABELS[row.status]} → ${LEAD_STATUS_LABELS[input.status]}`,
      })
    }
    if (input.assigneeId !== undefined && input.assigneeId !== row.assigneeId) {
      let name: string | null = null
      if (input.assigneeId) {
        const user = await repo.findStaffUser(tx, input.assigneeId)
        if (!user || !canWorkLeads(user.role, user.banned))
          throw new AppError("VALIDATION_FAILED", "Invalid input", {
            fieldErrors: {
              assigneeId: ["Choose someone who can work on leads"],
            },
          })
        name = user.name
      }
      patch.assigneeId = input.assigneeId
      diff.assigneeId = { from: row.assigneeId, to: input.assigneeId }
      events.push({
        type: "assigned",
        body: name ? `Assigned to ${name}` : "Unassigned",
      })
    }
    if (events.length === 0) return
    await repo.updateLeadRow(tx, id, patch)
    for (const event of events)
      await repo.insertLeadEvent(tx, { leadId: id, ...event, actorId: actor.userId })
    await writeAudit(tx, actor, {
      action: "lead.updated",
      entityType: "lead",
      entityId: id,
      diff,
    })
  })
  return getLead(actor, id)
}

export async function addLeadNote(
  actor: Actor,
  id: string,
  input: { body: string }
): Promise<LeadDto> {
  assertCan(actor, { lead: ["update"] })
  await getDb().transaction(async (tx) => {
    if (!(await repo.findLeadRow(tx, id))) throw notFound("Lead")
    await repo.insertLeadEvent(tx, {
      leadId: id,
      type: "note",
      body: input.body,
      actorId: actor.userId,
    })
    await writeAudit(tx, actor, {
      action: "lead.note_added",
      entityType: "lead",
      entityId: id,
    })
  })
  return getLead(actor, id)
}

/** GDPR erasure: the lead and its events (cascade). The audit row keeps no personal data. */
export async function deleteLead(actor: Actor, id: string): Promise<{ ok: true }> {
  assertCan(actor, { lead: ["delete"] })
  await getDb().transaction(async (tx) => {
    if (!(await repo.deleteLeadRow(tx, id))) throw notFound("Lead")
    await writeAudit(tx, actor, {
      action: "lead.deleted",
      entityType: "lead",
      entityId: id,
    })
  })
  return { ok: true }
}

/** CSV export (RFC 4180, formula-guarded); `email` serves subject-access requests. */
export async function exportLeads(
  actor: Actor,
  query: LeadExportQuery,
  now: Date = new Date()
): Promise<{ csv: string; filename: string; count: number }> {
  assertCan(actor, { lead: ["export"] })
  const db = getDb()
  const rows = await repo.exportLeadRows(db, filtersFrom(actor, query), LEAD_EXPORT_LIMIT)
  const notes = new Map<string, string[]>()
  for (const note of await repo.listNoteRows(db, rows.map((r) => r.id))) {
    const line = `${note.createdAt.toISOString()} ${note.actorName ?? "Deleted user"}: ${note.body ?? ""}`
    notes.set(note.leadId, [...(notes.get(note.leadId) ?? []), line])
  }
  const csv =
    CSV_BOM +
    toCsv(
      LEAD_CSV_HEADER,
      rows.map((r) => [
        r.createdAt.toISOString(),
        LEAD_STATUS_LABELS[r.status],
        r.name,
        r.email,
        r.phone,
        r.company,
        r.service,
        r.message,
        r.consent ? "yes" : "no",
        r.sourcePage,
        r.assigneeId ? (r.assigneeName ?? "Deleted user") : null,
        (notes.get(r.id) ?? []).join("\n"),
        r.id,
      ])
    )
  await writeAudit(db, actor, {
    action: "lead.exported",
    entityType: "lead",
    diff: {
      count: rows.length,
      filters: Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key]) => key),
    },
  })
  return { csv, filename: `leads-${isoDate(now)}.csv`, count: rows.length }
}

export async function listAssignees(actor: Actor): Promise<{ items: LeadAssignee[] }> {
  assertCan(actor, { lead: ["read"] })
  const rows = await repo.listStaffUsers(getDb())
  return {
    items: rows
      .filter((u) => canWorkLeads(u.role, u.banned))
      .map((u) => ({ id: u.id, name: u.name, email: u.email })),
  }
}

/** Sidebar badge: unassigned new leads. */
export async function leadBadge(actor: Actor): Promise<LeadBadge> {
  assertCan(actor, { lead: ["read"] })
  return { newLeads: await repo.countUnassignedNewLeads(getDb()) }
}
```

(`listStaffUsers` orders by `users.name` in SQL; the test compares with `localeCompare` — if the DB collation orders differently for the seeded names, sort in the service with `localeCompare` instead.)

`server/modules/leads/routes.ts` — add imports and the admin router (keep `publicLeadsRoutes`):

```ts
import {
  leadExportQuery,
  leadListQuery,
  leadNoteInput,
  updateLeadInput,
} from "@/lib/schemas/api/leads"
import { idParam } from "@/lib/schemas/api/params"
import { actorOf, can } from "@/server/api/middleware/auth"

/** /api/v1/admin/leads — static paths before /:id. */
export const leadsRoutes = new Hono<AppEnv>()
  .get("/", can({ lead: ["read"] }), zv("query", leadListQuery), async (c) =>
    c.json(await service.listLeads(actorOf(c), c.req.valid("query")), 200)
  )
  .get(
    "/export.csv",
    can({ lead: ["export"] }),
    zv("query", leadExportQuery),
    async (c) => {
      const { csv, filename } = await service.exportLeads(
        actorOf(c),
        c.req.valid("query")
      )
      return c.body(csv, 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      })
    }
  )
  .get("/assignees", can({ lead: ["read"] }), async (c) =>
    c.json(await service.listAssignees(actorOf(c)), 200)
  )
  .get("/badge", can({ lead: ["read"] }), async (c) =>
    c.json(await service.leadBadge(actorOf(c)), 200)
  )
  .get("/:id", can({ lead: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getLead(actorOf(c), c.req.valid("param").id), 200)
  )
  .patch(
    "/:id",
    can({ lead: ["update"] }),
    zv("param", idParam),
    zv("json", updateLeadInput),
    async (c) =>
      c.json(
        await service.updateLead(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/events",
    can({ lead: ["update"] }),
    zv("param", idParam),
    zv("json", leadNoteInput),
    async (c) =>
      c.json(
        await service.addLeadNote(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        201
      )
  )
  .delete("/:id", can({ lead: ["delete"] }), zv("param", idParam), async (c) =>
    c.json(await service.deleteLead(actorOf(c), c.req.valid("param").id), 200)
  )
```

`server/api/app.ts`: import `leadsRoutes` alongside `publicLeadsRoutes` and add `.route("/leads", leadsRoutes)` to the `adminRoutes` chain (after `.route("/reorder", reorderRoutes)` or the last existing route).

`lib/schemas/api/search.ts`: append `"lead",` as the last entry of `SEARCH_TYPES`.

`server/modules/search/repo.ts` — add (import `desc` and `leads`):

```ts
export function searchLeads(db: DbOrTx, q: string, limit: number) {
  return db
    .select({ id: leads.id, name: leads.name, email: leads.email })
    .from(leads)
    .where(
      or(
        ilike(leads.name, contains(q)),
        ilike(leads.email, contains(q)),
        ilike(leads.company, contains(q))
      )
    )
    .orderBy(desc(leads.createdAt))
    .limit(limit)
}
```

`server/modules/search/service.ts` — in `search()`, before `return { items }`:

```ts
  if (can({ lead: ["read"] }))
    for (const row of await repo.searchLeads(db, q, LIMIT))
      items.push({
        type: "lead",
        id: row.id,
        title: row.name,
        subtitle: row.email,
        href: `/admin/leads/${row.id}`,
      })
```

`components/admin/shell/command-palette.tsx`: import `Inbox` from `lucide-react`; add `lead: Inbox,` to `TYPE_ICONS` and `lead: "Lead",` to `TYPE_LABELS`.

`server/modules/dashboard/service.ts`: in the `unassigned-leads` Next-up item, change `href: "/admin/leads"` to `href: "/admin/leads?status=new&assignee=none"`; update the same literal in `tests/integration/api/dashboard.test.ts` / `tests/dom/dashboard.test.tsx` if they assert it. If the Phase 4 dashboard components render any static/sample lead numbers or rows (search `components/admin/dashboard/` for hard-coded arrays), replace them with the `DashboardDto` fields — the dashboard test above pins the real data.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test:unit tests/unit/csv.test.ts && pnpm vitest run --project dom tests/dom/command-palette.test.tsx`
Expected: PASS.

Run: `pnpm test:integration tests/integration/api/leads.test.ts tests/integration/api/search-leads.test.ts tests/integration/api/search.test.ts tests/integration/api/dashboard-leads.test.ts tests/integration/api/dashboard.test.ts`
Expected: PASS.

Run: `pnpm lint && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/csv.ts lib/schemas/api/leads.ts lib/schemas/api/search.ts server/modules/leads server/modules/search server/api/app.ts server/modules/dashboard/service.ts components/admin/shell/command-palette.tsx tests/unit/csv.test.ts tests/integration/api/leads.test.ts tests/integration/api/search-leads.test.ts tests/integration/api/dashboard-leads.test.ts
git commit -m "feat: add leads admin API with notes, CSV export and search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Also `git add` the dashboard test files if Step 3 changed them.)

---
### Task 5: Leads inbox UI — list, detail with section tabs, sidebar item + badge (master Task 7.4, part 2)

**Files:**
- Create: `lib/admin/leads.ts`, `components/admin/leads/{lead-status-badge.tsx,leads-screen.tsx,lead-detail.tsx}`, `app/(admin)/admin/(panel)/leads/page.tsx`, `app/(admin)/admin/(panel)/leads/[id]/page.tsx`
- Modify: `components/admin/shell/nav.ts` ("Leads" item, `badge: "new-leads"`), `app/(admin)/admin/(panel)/layout.tsx` (pass `badges` to `AdminShell`), `tests/unit/admin/nav.test.ts` (expectations)
- Modify (re-baseline): `tests/visual/__screenshots__/admin-shell-*.png`
- Test: `tests/unit/admin/leads.test.ts`, `tests/dom/leads.test.tsx`

**Interfaces:**
- Consumes: Task 4 HTTP API and types (`LeadListItem`, `LeadDto`, `LeadAssignee`, `LEAD_STATUSES`, `LEAD_STATUS_LABELS`, `LEAD_STATUS_FILTERS`), `leadBadge(actor)`; `DataTable` (`toolbar`, `filterKey`), `columnsFor`, `DataTableColumns`; `FilterSelect`; `PageHeader`; `SectionTabs`, `SectionTabsPanel` (`components/admin/section-tabs/section-tabs.tsx`: `items: { id, label, badge? }[]`, `ariaLabel`, selection in `?tab=`); `Badge`, `Button`, `buttonClassName`, `Textarea`, `AlertDialog*`, `Skeleton`; `toast` (sonner); `api`/`unwrap`/`errorMessage`; `usePermission`; `formatDateTime`; `requirePermission`; `idParam`; shell `NavBadges` / `NavItem.badge` (`components/admin/shell/nav.ts`, rendered by `NavEntry`).
- Produces:

```ts
// lib/admin/leads.ts (isomorphic)
export const LEAD_STATUS_BADGE: Record<LeadStatus, "default" | "secondary" | "outline" | "destructive">
export type LeadInboxFilters = { status: "" | LeadStatusFilter; assignee: string }   // "" = off; assignee "me" | "none" | uuid
export function parseLeadFilters(params: URLSearchParams): LeadInboxFilters         // unknown values → ""
export function leadFilterQuery(f: LeadInboxFilters): { status?: string; assignee?: string }
export function leadExportHref(f: { status?: string; assignee?: string; email?: string }): string   // /api/v1/admin/leads/export.csv[?…]
// components/admin/leads/*
export function LeadStatusBadge(props: { status: LeadStatus }): JSX.Element
export function LeadsScreen(): JSX.Element
export function LeadDetail(props: { id: string }): JSX.Element
// Routes: /admin/leads (lead:read; ?status= & ?assignee= preselect filters), /admin/leads/[id] (lead:read; non-uuid → 404)
// Nav: Overview ▸ Leads (after Dashboard), icon Inbox, permission { lead: ["read"] }, badge "new-leads" = unassigned new leads (server-computed in the panel layout)
```

UI decisions (fixed here): list columns Received (sortable, default newest first) · Name (link to the detail page, email underneath) · Status (badge, sortable) · Assignee ("Unassigned" in muted text) · Page (source path); phone cards show name, status badge, email, received time. Filters: Status (Inbox = all but spam · Open · each status · Everything), Assignee (Anyone · Me · Unassigned · each assignee). "Export CSV" (lead:export) downloads with the current status/assignee filters. Detail page: header = name + status badge, actions "Export this person's data" (lead:export → CSV `?email=<email>&status=all`) and "Delete" (lead:delete, AlertDialog "Delete this lead? Its notes and history are deleted too. This cannot be undone."); body = left vertical `SectionTabs` (ariaLabel "Lead sections") with **Details** (status select, assignee select — disabled without lead:update —, contact facts list, message in `whitespace-pre-wrap`), **Notes** (badge = note count; notes newest last; textarea "Add a note" + "Add note" button for lead:update) and **Activity** (every event in order: "Website" for actor-less events, formatted time). Status/assignee save immediately on change (toast "Lead updated"); every mutation calls `router.refresh()` so the sidebar badge updates.

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/leads.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  LEAD_STATUS_BADGE,
  leadExportHref,
  leadFilterQuery,
  parseLeadFilters,
} from "@/lib/admin/leads"
import { LEAD_STATUSES } from "@/lib/schemas/api/leads"

describe("lead inbox helpers", () => {
  it("parses only known filter values from the URL", () => {
    expect(parseLeadFilters(new URLSearchParams("status=new&assignee=none"))).toEqual({ status: "new", assignee: "none" })
    expect(parseLeadFilters(new URLSearchParams("status=open&assignee=me"))).toEqual({ status: "open", assignee: "me" })
    expect(
      parseLeadFilters(new URLSearchParams("assignee=0190a6e0-0000-7000-8000-000000000001"))
    ).toEqual({ status: "", assignee: "0190a6e0-0000-7000-8000-000000000001" })
    expect(parseLeadFilters(new URLSearchParams("status=maybe&assignee=bob"))).toEqual({ status: "", assignee: "" })
  })

  it("omits empty filters from queries and export links", () => {
    expect(leadFilterQuery({ status: "", assignee: "" })).toEqual({})
    expect(leadFilterQuery({ status: "spam", assignee: "me" })).toEqual({ status: "spam", assignee: "me" })
    expect(leadExportHref({})).toBe("/api/v1/admin/leads/export.csv")
    expect(leadExportHref({ status: "open", assignee: "" })).toBe("/api/v1/admin/leads/export.csv?status=open")
    expect(leadExportHref({ email: "a+b@example.ie", status: "all" })).toBe(
      "/api/v1/admin/leads/export.csv?status=all&email=a%2Bb%40example.ie"
    )
  })

  it("has a badge variant for every status", () => {
    expect(Object.keys(LEAD_STATUS_BADGE).sort()).toEqual([...LEAD_STATUSES].sort())
  })
})
```

`tests/unit/admin/nav.test.ts` — update the expectations (the rest of the file stays):
- the expected label lists for `owner` and `admin` gain `"Leads"` directly after `"Dashboard"` (give them their own list instead of the shared one if editors/viewers share it — editors and viewers do **not** get Leads);
- `["intake", ["Dashboard", "Account"]]` becomes `["intake", ["Dashboard", "Leads", "Account"]]`;
- `navItems(["intake"]).map((s) => s.label)` stays `["Overview", "You"]` (Leads lives in Overview);
- add:

```ts
  it("Leads carries the new-leads badge and needs lead:read", () => {
    const leads = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.label === "Leads")
    expect(leads).toMatchObject({
      href: "/admin/leads",
      permission: { lead: ["read"] },
      match: "prefix",
      badge: "new-leads",
    })
  })
```

`tests/dom/leads.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
const refresh = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/leads",
  useRouter: () => ({ push, replace: vi.fn(), refresh }),
  useSearchParams: () => new URLSearchParams(search),
}))

import { LeadDetail } from "@/components/admin/leads/lead-detail"
import { LeadsScreen } from "@/components/admin/leads/leads-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type { LeadDto } from "@/lib/schemas/api/leads"

const ID = "0190a6e0-0000-7000-8000-0000000000aa"
const lead: LeadDto = {
  id: ID,
  name: "Dinn Rí",
  email: "dinn@example.ie",
  phone: "085 000 0000",
  company: null,
  service: null,
  status: "new",
  assignee: null,
  sourcePage: "/contact",
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
  message: "Line one\nLine two",
  consent: true,
  events: [
    { id: "e1", type: "created", body: "Sent from /contact", actor: null, createdAt: "2026-10-16T09:00:00.000Z" },
    { id: "e2", type: "note", body: "Rang back", actor: { id: "u", name: "Ian Intake" }, createdAt: "2026-10-16T10:00:00.000Z" },
  ],
}

const calls: { url: string; method: string; body: unknown }[] = []
beforeEach(() => {
  calls.length = 0
  search = ""
  push.mockClear()
  refresh.mockClear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const method = init?.method ?? (input instanceof Request ? input.method : "GET")
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ url, method, body })
      const reply = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })
      if (url.includes("/leads/assignees"))
        return reply({ items: [{ id: "u", name: "Ian Intake", email: "ian@x.test" }] })
      if (url.includes(`/leads/${ID}/events`))
        return reply({ ...lead, events: [...lead.events, { id: "e3", type: "note", body: body.body, actor: { id: "u", name: "Ian Intake" }, createdAt: "2026-10-16T11:00:00.000Z" }] }, 201)
      if (url.includes(`/leads/${ID}`)) {
        if (method === "PATCH") return reply({ ...lead, ...body })
        if (method === "DELETE") return reply({ ok: true })
        return reply(lead)
      }
      return reply({ items: [lead], page: 1, pageSize: 20, total: 1 })
    })
  )
})

function renderAs(roles: Role[], ui: React.ReactNode) {
  render(
    <AdminShell
      queryClient={makeQueryClient()}
      site={{ url: "http://localhost:3000", env: "development" }}
      session={{
        user: { id: "u", name: "Ian Intake", email: "ian@x.test", title: null, twoFactorEnabled: true },
        roles,
        impersonatedBy: null,
      }}
    >
      {ui}
    </AdminShell>
  )
}

describe("leads inbox (master 7.4)", () => {
  it("lists leads with status, link to the detail page, filters and CSV export", async () => {
    search = "status=new&assignee=none"
    renderAs(["intake"], <LeadsScreen />)
    const table = await screen.findByRole("table", { name: "Leads" })
    const link = within(table).getByRole("link", { name: "Dinn Rí" })
    expect(link).toHaveAttribute("href", `/admin/leads/${ID}`)
    expect(within(table).getByText("New")).toBeInTheDocument()
    expect(within(table).getByText("Unassigned")).toBeInTheDocument()
    expect(screen.getByLabelText("Status")).toHaveValue("new")
    expect(screen.getByLabelText("Assignee")).toHaveValue("none")
    expect(calls.some((c) => c.url.includes("status=new") && c.url.includes("assignee=none"))).toBe(true)
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute(
      "href",
      "/api/v1/admin/leads/export.csv?status=new&assignee=none"
    )
    await userEvent.setup().selectOptions(screen.getByLabelText("Status"), "spam")
    await waitFor(() => expect(calls.some((c) => c.url.includes("status=spam"))).toBe(true))
  })

  it("detail: vertical section tabs, message, immediate status change, notes", async () => {
    const user = userEvent.setup()
    renderAs(["intake"], <LeadDetail id={ID} />)
    expect(await screen.findByRole("heading", { level: 1, name: "Dinn Rí" })).toBeInTheDocument()
    const tablist = screen.getByRole("tablist", { name: "Lead sections" })
    expect(within(tablist).getAllByRole("tab").map((t) => t.textContent?.replace(/\d+$/, "").trim())).toEqual([
      "Details",
      "Notes",
      "Activity",
    ])
    expect(screen.getByText(/Line one/)).toHaveClass("whitespace-pre-wrap")

    await user.selectOptions(screen.getByLabelText("Lead status"), "contacted")
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ status: "contacted" })
    )
    expect(refresh).toHaveBeenCalled()

    await user.click(within(tablist).getByRole("tab", { name: /Notes/ }))
    const panel = () => screen.getByRole("tabpanel")
    expect(within(panel()).getByText("Rang back")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Add a note"), "Sent a quote")
    await user.click(screen.getByRole("button", { name: "Add note" }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({ body: "Sent a quote" })
    )
    expect(await within(panel()).findByText("Sent a quote")).toBeInTheDocument()

    await user.click(within(tablist).getByRole("tab", { name: "Activity" }))
    expect(within(panel()).getByText("Sent from /contact")).toBeInTheDocument()
    expect(within(panel()).getByText(/^Website ·/)).toBeInTheDocument()

    // intake cannot delete (lead:delete is owner/admin)
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull()
    expect(screen.getByRole("link", { name: "Export this person's data" })).toHaveAttribute(
      "href",
      "/api/v1/admin/leads/export.csv?status=all&email=dinn%40example.ie"
    )
  })

  it("admins can delete after confirming", async () => {
    const user = userEvent.setup()
    renderAs(["admin"], <LeadDetail id={ID} />)
    await user.click(await screen.findByRole("button", { name: "Delete" }))
    await user.click(await screen.findByRole("button", { name: "Delete lead" }))
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true))
    expect(push).toHaveBeenCalledWith("/admin/leads")
  })
})
```

(`AdminShell`'s props are whatever Phase 4 Task 13 settled on — copy the `render(<AdminShell …>)` call from `tests/dom/admin-shell.test.tsx` if `site` differs.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm test:unit tests/unit/admin/leads.test.ts tests/unit/admin/nav.test.ts && pnpm vitest run --project dom tests/dom/leads.test.tsx`
Expected: FAIL — `@/lib/admin/leads` and `@/components/admin/leads/*` do not exist; nav has no "Leads".

- [ ] **Step 3: Implement**

`lib/admin/leads.ts`:

```ts
import {
  LEAD_STATUS_FILTERS,
  type LeadStatus,
  type LeadStatusFilter,
} from "@/lib/schemas/api/leads"

export const LEAD_STATUS_BADGE: Record<
  LeadStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  new: "default",
  contacted: "secondary",
  qualified: "secondary",
  won: "outline",
  lost: "outline",
  spam: "destructive",
}

export type LeadInboxFilters = { status: "" | LeadStatusFilter; assignee: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseLeadFilters(params: URLSearchParams): LeadInboxFilters {
  const status = params.get("status") ?? ""
  const assignee = params.get("assignee") ?? ""
  return {
    status: (LEAD_STATUS_FILTERS as readonly string[]).includes(status)
      ? (status as LeadStatusFilter)
      : "",
    assignee:
      assignee === "me" || assignee === "none" || UUID.test(assignee)
        ? assignee
        : "",
  }
}

export function leadFilterQuery(f: LeadInboxFilters): {
  status?: string
  assignee?: string
} {
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.assignee ? { assignee: f.assignee } : {}),
  }
}

export function leadExportHref(f: {
  status?: string
  assignee?: string
  email?: string
}): string {
  const params = new URLSearchParams()
  for (const key of ["status", "assignee", "email"] as const)
    if (f[key]) params.set(key, f[key])
  const query = params.toString()
  return `/api/v1/admin/leads/export.csv${query ? `?${query}` : ""}`
}
```

`components/admin/leads/lead-status-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge"
import { LEAD_STATUS_BADGE } from "@/lib/admin/leads"
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/schemas/api/leads"

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={LEAD_STATUS_BADGE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>
  )
}
```

`components/admin/leads/leads-screen.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Download } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { FilterSelect } from "@/components/admin/filter-field"
import { PageHeader } from "@/components/admin/page-header"
import { buttonClassName } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import {
  type LeadInboxFilters,
  leadExportHref,
  leadFilterQuery,
  parseLeadFilters,
} from "@/lib/admin/leads"
import { api, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type LeadAssignee,
  type LeadListItem,
} from "@/lib/schemas/api/leads"

import { LeadStatusBadge } from "./lead-status-badge"

type Row = LeadListItem & Record<string, unknown>
const ch = columnsFor<Row>()

const columns = ch.columns([
  ch.accessor("createdAt", {
    header: "Received",
    cell: (info) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {formatDateTime(info.getValue())}
      </span>
    ),
  }),
  ch.accessor("name", {
    header: "Name",
    cell: (info) => (
      <span className="flex flex-col">
        <Link
          href={`/admin/leads/${info.row.original.id}`}
          className="font-medium hover:underline"
        >
          {info.getValue()}
        </Link>
        <span className="text-xs text-muted-foreground">
          {info.row.original.email}
        </span>
      </span>
    ),
  }),
  ch.accessor("status", {
    header: "Status",
    cell: (info) => <LeadStatusBadge status={info.getValue()} />,
  }),
  ch.display({
    id: "assignee",
    header: "Assignee",
    cell: ({ row }) =>
      row.original.assignee ? (
        row.original.assignee.name
      ) : (
        <span className="text-muted-foreground">Unassigned</span>
      ),
  }),
  ch.display({
    id: "sourcePage",
    header: "Page",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.sourcePage ?? "—"}
      </span>
    ),
  }),
]) as unknown as DataTableColumns<Row>

/** Leads inbox (spec §8.1): search, status/assignee filters, CSV export. */
export function LeadsScreen() {
  const params = useSearchParams()
  const [filters, setFilters] = useState<LeadInboxFilters>(() =>
    parseLeadFilters(new URLSearchParams(params.toString()))
  )
  const canExport = usePermission({ lead: ["export"] })
  const assignees = useQuery({
    queryKey: ["leads", "assignees"],
    queryFn: async () =>
      (await unwrap(api.leads.assignees.$get())).items as LeadAssignee[],
  })
  const query = leadFilterQuery(filters)
  const filterKey =
    filters.status || filters.assignee
      ? `${filters.status}|${filters.assignee}`
      : ""
  return (
    <>
      <PageHeader
        title="Leads"
        description="Enquiries sent through the website contact form. Spam is hidden unless you filter for it."
        actions={
          canExport ? (
            <a
              href={leadExportHref(query)}
              download
              className={buttonClassName({ variant: "outline" })}
            >
              <Download aria-hidden />
              Export CSV
            </a>
          ) : null
        }
      />
      <DataTable<Row>
        label="Leads"
        queryKey={["leads", query]}
        filterKey={filterKey}
        initialSort={[{ id: "createdAt", desc: true }]}
        searchPlaceholder="Search name, email, company or phone"
        toolbar={
          <>
            <FilterSelect
              id="leads-status"
              label="Status"
              value={filters.status}
              onChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  status: value as LeadInboxFilters["status"],
                }))
              }
            >
              <option value="">Inbox (all but spam)</option>
              <option value="open">Open</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
              <option value="all">Everything</option>
            </FilterSelect>
            <FilterSelect
              id="leads-assignee"
              label="Assignee"
              value={filters.assignee}
              onChange={(value) =>
                setFilters((f) => ({ ...f, assignee: value }))
              }
            >
              <option value="">Anyone</option>
              <option value="me">Me</option>
              <option value="none">Unassigned</option>
              {(assignees.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </FilterSelect>
          </>
        }
        fetchPage={async (p) =>
          (await unwrap(
            api.leads.$get({
              query: {
                page: String(p.page),
                pageSize: String(p.pageSize),
                sort: p.sort,
                q: p.q,
                ...query,
              },
            })
          )) as { items: Row[]; page: number; pageSize: number; total: number }
        }
        columns={columns}
        renderCard={(lead) => (
          <Link
            href={`/admin/leads/${lead.id}`}
            className="flex flex-col gap-1.5 rounded-xl border bg-card p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{lead.name}</span>
              <LeadStatusBadge status={lead.status} />
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {lead.email}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(lead.createdAt)}
            </span>
          </Link>
        )}
        empty="No enquiries yet. They appear here when someone sends the contact form."
      />
    </>
  )
}
```

(If `assignee` is a `uuid` that is not in the assignee list — e.g. a demoted user — the select shows "Anyone"; the query still filters by it. If `api.leads.$get`'s inferred query type rejects `status`/`assignee` as plain strings, cast `query` to `Record<string, string>`.)

`components/admin/leads/lead-detail.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Download, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import {
  SectionTabs,
  SectionTabsPanel,
} from "@/components/admin/section-tabs/section-tabs"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button, buttonClassName } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/hooks/use-permission"
import { leadExportHref } from "@/lib/admin/leads"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type LeadAssignee,
  type LeadDto,
  type LeadEventItem,
  type LeadStatus,
  type UpdateLeadInput,
} from "@/lib/schemas/api/leads"

import { LeadStatusBadge } from "./lead-status-badge"

const select =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

function EventLine({ event }: { event: LeadEventItem }) {
  return (
    <li className="flex flex-col gap-1 border-l-2 pl-3">
      <span className="text-xs text-muted-foreground">
        {event.actor?.name ?? "Website"} · {formatDateTime(event.createdAt)}
      </span>
      <span className="text-sm whitespace-pre-wrap">{event.body}</span>
    </li>
  )
}

/** One lead (spec §8.1): details, notes, activity timeline, delete, subject-access export. */
export function LeadDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ lead: ["update"] })
  const canDelete = usePermission({ lead: ["delete"] })
  const canExport = usePermission({ lead: ["export"] })
  const [note, setNote] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const statusId = useId()
  const assigneeId = useId()
  const noteId = useId()
  const key = ["leads", "detail", id] as const

  const lead = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await unwrap(api.leads[":id"].$get({ param: { id } }))) as LeadDto,
  })
  const assignees = useQuery({
    queryKey: ["leads", "assignees"],
    queryFn: async () =>
      (await unwrap(api.leads.assignees.$get())).items as LeadAssignee[],
    enabled: canUpdate,
  })

  const applied = (dto: LeadDto) => {
    queryClient.setQueryData(key, dto)
    void queryClient.invalidateQueries({
      queryKey: ["leads"],
      predicate: (q) => q.queryKey[1] !== "detail",
    })
    router.refresh()
  }

  const update = useMutation({
    mutationFn: async (json: UpdateLeadInput) =>
      (await unwrap(
        api.leads[":id"].$patch({ param: { id }, json })
      )) as LeadDto,
    onSuccess: (dto) => {
      applied(dto)
      toast.success("Lead updated")
    },
    onError: (error) => toast.error("Not saved", { description: errorMessage(error) }),
  })
  const addNote = useMutation({
    mutationFn: async (body: string) =>
      (await unwrap(
        api.leads[":id"].events.$post({ param: { id }, json: { body } })
      )) as LeadDto,
    onSuccess: (dto) => {
      applied(dto)
      setNote("")
    },
    onError: (error) => toast.error("Note not added", { description: errorMessage(error) }),
  })
  const remove = useMutation({
    mutationFn: async () =>
      unwrap(api.leads[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Lead deleted")
      router.push("/admin/leads")
      router.refresh()
    },
    onError: (error) => toast.error("Not deleted", { description: errorMessage(error) }),
  })

  if (lead.isPending)
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Loading lead…</span>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    )
  if (lead.isError)
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-sm">{errorMessage(lead.error)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => lead.refetch()}>
          Try again
        </Button>
      </div>
    )

  const data = lead.data
  const notes = data.events.filter((e) => e.type === "note")

  return (
    <>
      <Link
        href="/admin/leads"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All leads
      </Link>
      <PageHeader
        title={data.name}
        description={
          <span className="inline-flex items-center gap-2">
            <LeadStatusBadge status={data.status} />
            Received {formatDateTime(data.createdAt)}
          </span>
        }
        actions={
          <>
            {canExport ? (
              <a
                href={leadExportHref({ status: "all", email: data.email })}
                download
                className={buttonClassName({ variant: "outline" })}
              >
                <Download aria-hidden />
                Export this person&apos;s data
              </a>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            ) : null}
          </>
        }
      />
      <SectionTabs
        ariaLabel="Lead sections"
        items={[
          { id: "details", label: "Details" },
          { id: "notes", label: "Notes", badge: notes.length || undefined },
          { id: "activity", label: "Activity" },
        ]}
      >
        <SectionTabsPanel id="details">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="flex flex-col gap-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Fact label="Email">
                  <a href={`mailto:${data.email}`} className="hover:underline">
                    {data.email}
                  </a>
                </Fact>
                <Fact label="Phone">
                  {data.phone ? (
                    <a href={`tel:${data.phone.replace(/\s+/g, "")}`} className="hover:underline">
                      {data.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </Fact>
                <Fact label="Company">{data.company ?? "—"}</Fact>
                <Fact label="Service">{data.service ?? "—"}</Fact>
                <Fact label="Sent from">{data.sourcePage ?? "—"}</Fact>
                <Fact label="Consent to be contacted">{data.consent ? "Yes" : "No"}</Fact>
              </dl>
              <div className="flex flex-col gap-1">
                <h2 className="text-xs font-medium text-muted-foreground">Message</h2>
                <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {data.message}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={statusId} className="text-xs font-medium text-muted-foreground">
                  Lead status
                </label>
                <select
                  id={statusId}
                  className={select}
                  value={data.status}
                  disabled={!canUpdate || update.isPending}
                  onChange={(event) =>
                    update.mutate({ status: event.target.value as LeadStatus })
                  }
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={assigneeId} className="text-xs font-medium text-muted-foreground">
                  Assigned to
                </label>
                <select
                  id={assigneeId}
                  className={select}
                  value={data.assignee?.id ?? ""}
                  disabled={!canUpdate || update.isPending}
                  onChange={(event) =>
                    update.mutate({ assigneeId: event.target.value || null })
                  }
                >
                  <option value="">Unassigned</option>
                  {data.assignee &&
                  !(assignees.data ?? []).some((u) => u.id === data.assignee?.id) ? (
                    <option value={data.assignee.id}>{data.assignee.name}</option>
                  ) : null}
                  {(assignees.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </SectionTabsPanel>
        <SectionTabsPanel id="notes">
          <div className="flex max-w-2xl flex-col gap-4">
            {notes.length ? (
              <ol className="flex flex-col gap-3">
                {notes.map((event) => (
                  <EventLine key={event.id} event={event} />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            )}
            {canUpdate ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (note.trim()) addNote.mutate(note.trim())
                }}
              >
                <label htmlFor={noteId} className="text-sm font-medium">
                  Add a note
                </label>
                <Textarea
                  id={noteId}
                  rows={3}
                  maxLength={5000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button
                  type="submit"
                  className="self-start"
                  disabled={addNote.isPending || !note.trim()}
                >
                  Add note
                </Button>
              </form>
            ) : null}
          </div>
        </SectionTabsPanel>
        <SectionTabsPanel id="activity">
          <ol className="flex max-w-2xl flex-col gap-3">
            {data.events.map((event) => (
              <EventLine key={event.id} event={event} />
            ))}
          </ol>
        </SectionTabsPanel>
      </SectionTabs>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Its notes and history are deleted too. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete lead
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

(The DOM test scopes panel content with `screen.getByRole("tabpanel")`, which only matches the visible panel whether or not `SectionTabsPanel` keeps inactive panels mounted.)

`app/(admin)/admin/(panel)/leads/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { LeadsScreen } from "@/components/admin/leads/leads-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Leads" }

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ lead: ["read"] })
  return <LeadsScreen />
}
```

`app/(admin)/admin/(panel)/leads/[id]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { LeadDetail } from "@/components/admin/leads/lead-detail"
import { idParam } from "@/lib/schemas/api/params"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Lead" }

export default function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission({ lead: ["read"] })
  const { id } = await params
  if (!idParam.safeParse({ id }).success) notFound()
  return <LeadDetail id={id} />
}
```

`components/admin/shell/nav.ts`: import `Inbox` from `lucide-react`; in the "Overview" section add after the Dashboard item:

```ts
      {
        label: "Leads",
        href: "/admin/leads",
        icon: Inbox,
        permission: { lead: ["read"] },
        match: "prefix",
        badge: "new-leads",
      },
```

and change the `NavBadgeKey` comment to "Live counts shown beside nav items".

`app/(admin)/admin/(panel)/layout.tsx` — in `PanelFrame`, after the `Promise.all`, compute the badge and pass it (imports `hasPermission` from `@/lib/auth/permissions`, `leadBadge` from `@/server/modules/leads/service`):

```tsx
  const badges = hasPermission(actor.roles, { lead: ["read"] })
    ? { "new-leads": (await leadBadge(actor)).newLeads }
    : {}
```

and add `badges={badges}` to `<AdminShell …>`. (`NavEntry` already hides a 0/undefined badge.)

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test:unit tests/unit/admin && pnpm vitest run --project dom tests/dom/leads.test.tsx tests/dom/admin-shell.test.tsx tests/dom/command-palette.test.tsx`
Expected: PASS.

Re-capture the admin shell baselines (the visual admin is an `admin`, so the sidebar gains "Leads"; port 3100 free, nobody else running Playwright/build):

```bash
pnpm test:visual:update tests/visual/admin-shell.spec.ts
pnpm test:visual
```

Expected: the update rewrites only `tests/visual/__screenshots__/admin-shell-*.png` (open them: the only change is the "Leads" row under Dashboard, badge hidden at 0); the full run passes with every public baseline at 0 px.

Run: `pnpm lint && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/leads.ts components/admin/leads "app/(admin)/admin/(panel)/leads" "app/(admin)/admin/(panel)/layout.tsx" components/admin/shell/nav.ts tests/unit/admin/leads.test.ts tests/unit/admin/nav.test.ts tests/dom/leads.test.tsx tests/visual/__screenshots__
git commit -m "feat: add leads inbox with detail tabs and sidebar badge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Retention purge — daily keyed job on the scheduler (master Task 7.4, part 3)

**Files:**
- Create: `server/lib/jobs/purge-leads.ts`
- Modify: `server/lib/jobs/index.ts` (append to `RECURRING_JOBS`), `server/modules/leads/repo.ts` (`deleteLeadsCreatedBefore`), `server/modules/leads/service.ts` (`retentionCutoff`, `purgeExpiredLeads`)
- Test: `tests/unit/leads-retention.test.ts`, `tests/integration/leads/purge.test.ts`

**Interfaces:**
- Consumes: Phase 5 scheduler — `JobDefinition = { name, key, everyMs, run(ctx: { now, payload }): Promise<JobResult> }`, `JobResult = { tags?, warning?, done? }` (Phase 6 added `done`), `RECURRING_JOBS`, `ensureRecurringJobs(now)`, `tick({ now, revalidate })` (rows upserted `ON CONFLICT (key)`, claimed `FOR UPDATE SKIP LOCKED`); `getPublishedSettings("leads")` (`retentionMonths` 1–120); Task 2 `deleteExpiredRateLimits`; `writeAudit`.
- Produces:

```ts
// server/modules/leads/service.ts
export function retentionCutoff(now: Date, months: number): Date        // same UTC time `months` calendar months earlier, day clamped to month end
export async function purgeExpiredLeads(now?: Date): Promise<{ deleted: number; cutoff: Date | null; rateLimitsCleared: number }>   // cutoff null = settings.leads unpublished → nothing deleted
// server/modules/leads/repo.ts
export async function deleteLeadsCreatedBefore(db: DbOrTx, cutoff: Date): Promise<number>
// server/lib/jobs/purge-leads.ts
export const purgeLeadsJob: JobDefinition   // name/key "purge-leads", everyMs 24 h; warning when settings.leads is unpublished
```

Rules: deletes leads with `created_at < cutoff` (events cascade) and expired `public_rate_limits` rows; audit `lead.purged` (actor null, `diff: { count, cutoff }`) only when something was deleted; no cache tags (leads are never cached).

- [ ] **Step 1: Write the failing tests**

`tests/unit/leads-retention.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { retentionCutoff } from "@/server/modules/leads/service"

describe("retentionCutoff (settings.leads.retentionMonths)", () => {
  it.each([
    ["2026-10-16T12:00:00.000Z", 24, "2024-10-16T12:00:00.000Z"],
    ["2026-10-16T12:00:00.000Z", 1, "2026-09-16T12:00:00.000Z"],
    ["2026-03-31T08:30:00.000Z", 1, "2026-02-28T08:30:00.000Z"],
    ["2028-03-31T08:30:00.000Z", 1, "2028-02-29T08:30:00.000Z"],
    ["2026-01-15T00:00:00.000Z", 13, "2024-12-15T00:00:00.000Z"],
  ])("%s minus %i months → %s", (now, months, expected) => {
    expect(retentionCutoff(new Date(now), months).toISOString()).toBe(expected)
  })
})
```

`tests/integration/leads/purge.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag, cacheLife: vi.fn(), cacheTag: vi.fn() }))

import { getDb } from "@/server/db/client"
import { auditLog, jobs, leadEvents, leads, publicRateLimits, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { RECURRING_JOBS } from "@/server/lib/jobs"
import { purgeLeadsJob } from "@/server/lib/jobs/purge-leads"
import { ensureRecurringJobs, tick } from "@/server/lib/scheduler"

import { resetDb } from "../db"

const NOW = new Date("2026-10-16T12:00:00.000Z")

async function addLead(name: string, createdAt: Date) {
  const [row] = await getDb()
    .insert(leads)
    .values({ name, email: `${name}@example.ie`, message: "Hi", createdAt })
    .returning()
  await getDb().insert(leadEvents).values({ leadId: row.id, type: "created", body: null, actorId: null })
  return row
}

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb()) // settings.leads published: retentionMonths 24
})

describe("purge-leads job (spec §9 retention, §12)", () => {
  it("deletes leads older than retentionMonths with their events, keeps newer ones, audits", async () => {
    await addLead("ancient", new Date("2024-10-15T11:59:59.000Z"))
    const kept = await addLead("recent", new Date("2024-10-16T12:00:01.000Z"))
    await getDb().insert(publicRateLimits).values([
      { key: "leads:old", count: 3, resetAt: new Date(NOW.getTime() - 1000) },
      { key: "leads:live", count: 1, resetAt: new Date(NOW.getTime() + 60_000) },
    ])

    const result = await purgeLeadsJob.run({ now: NOW, payload: null })
    expect(result.warning).toBeUndefined()

    expect((await getDb().select().from(leads)).map((l) => l.id)).toEqual([kept.id])
    expect(await getDb().select().from(leadEvents)).toHaveLength(1)
    expect((await getDb().select().from(publicRateLimits)).map((r) => r.key)).toEqual(["leads:live"])
    const [audit] = await getDb().select().from(auditLog).where(eq(auditLog.action, "lead.purged"))
    expect(audit).toMatchObject({ actorId: null })
    expect(audit.diff).toEqual({ count: 1, cutoff: "2024-10-16T12:00:00.000Z" })
  })

  it("does nothing (with a warning) while settings.leads is unpublished", async () => {
    await addLead("ancient", new Date("2000-01-01T00:00:00.000Z"))
    await getDb().update(settings).set({ published: null }).where(eq(settings.key, "leads"))
    const result = await purgeLeadsJob.run({ now: NOW, payload: null })
    expect(result.warning).toBe("settings.leads is not published; no leads purged")
    expect(await getDb().select().from(leads)).toHaveLength(1)
  })

  it("is a daily keyed recurring job the scheduler runs", async () => {
    expect(RECURRING_JOBS.map((j) => j.key)).toContain("purge-leads")
    expect(purgeLeadsJob.everyMs).toBe(24 * 60 * 60_000)
    await addLead("ancient", new Date(Date.now() - 30 * 31 * 86_400_000))
    await ensureRecurringJobs(new Date())
    await tick({ now: new Date(Date.now() + 60_000), revalidate: vi.fn() })
    const [row] = await getDb().select().from(jobs).where(eq(jobs.key, "purge-leads"))
    expect(row.lastError).toBeNull()
    expect(row.lastRunAt).not.toBeNull()
    expect(await getDb().select().from(leads)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm test:unit tests/unit/leads-retention.test.ts && pnpm test:integration tests/integration/leads/purge.test.ts`
Expected: FAIL — `retentionCutoff` is not exported; `@/server/lib/jobs/purge-leads` cannot be resolved.

- [ ] **Step 3: Implement**

`server/modules/leads/repo.ts` — add (`lt` joins the `drizzle-orm` import):

```ts
export async function deleteLeadsCreatedBefore(
  db: DbOrTx,
  cutoff: Date
): Promise<number> {
  const rows = await db
    .delete(leads)
    .where(lt(leads.createdAt, cutoff))
    .returning({ id: leads.id })
  return rows.length
}
```

`server/modules/leads/service.ts` — add (import `deleteExpiredRateLimits` from `@/server/modules/rate-limit/repo`):

```ts
/** `months` calendar months before `now` (UTC), day clamped to the month's end. */
export function retentionCutoff(now: Date, months: number): Date {
  const day = now.getUTCDate()
  const target = new Date(now.getTime())
  target.setUTCDate(1)
  target.setUTCMonth(target.getUTCMonth() - months)
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target
}

/** Daily retention purge (spec §9): leads older than settings.leads.retentionMonths. */
export async function purgeExpiredLeads(
  now: Date = new Date()
): Promise<{ deleted: number; cutoff: Date | null; rateLimitsCleared: number }> {
  const db = getDb()
  const rateLimitsCleared = await deleteExpiredRateLimits(db, now)
  const config = await getPublishedSettings("leads", db)
  if (!config) return { deleted: 0, cutoff: null, rateLimitsCleared }
  const cutoff = retentionCutoff(now, config.retentionMonths)
  const deleted = await db.transaction(async (tx) => {
    const count = await repo.deleteLeadsCreatedBefore(tx, cutoff)
    if (count > 0)
      await writeAudit(tx, null, {
        action: "lead.purged",
        entityType: "lead",
        diff: { count, cutoff: cutoff.toISOString() },
      })
    return count
  })
  return { deleted, cutoff, rateLimitsCleared }
}
```

`server/lib/jobs/purge-leads.ts`:

```ts
import "server-only"

import { purgeExpiredLeads } from "@/server/modules/leads/service"

import type { JobDefinition } from "./index"

/** Spec §12: lead retention purge, daily. */
export const purgeLeadsJob: JobDefinition = {
  name: "purge-leads",
  key: "purge-leads",
  everyMs: 24 * 60 * 60_000,
  async run({ now }) {
    const { cutoff } = await purgeExpiredLeads(now)
    return cutoff
      ? {}
      : { warning: "settings.leads is not published; no leads purged" }
  },
}
```

`server/lib/jobs/index.ts`: add `import { purgeLeadsJob } from "./purge-leads"`, append `purgeLeadsJob` to `RECURRING_JOBS` (after `pruneRevisionsJob`), and change its comment to "(backup comes later)".

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm test:unit tests/unit/leads-retention.test.ts && pnpm test:integration tests/integration/leads/purge.test.ts tests/integration/scheduler`
Expected: PASS (the Phase 5 scheduler tests keep passing: they compare against `RECURRING_JOBS`).

Run: `pnpm lint && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/lib/jobs/purge-leads.ts server/lib/jobs/index.ts server/modules/leads/repo.ts server/modules/leads/service.ts tests/unit/leads-retention.test.ts tests/integration/leads/purge.test.ts
git commit -m "feat: purge leads past the retention period daily

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end — public enquiry → intake inbox → Mailpit; honeypot; 429 (master Tasks 7.3/7.4 acceptance)

**Files:**
- Modify: `tests/e2e/fixtures.ts` (`intake`, `leadsInbox`), `tests/e2e/seed.ts` (intake user, `settings.leads` recipients, `integrations.smtp` → Mailpit)
- Create: `tests/e2e/leads.spec.ts`

**Interfaces:**
- Consumes: everything above; `tests/integration/helpers/mailpit.ts` (alias-free); `clientIpFor`, `E2E_PASSWORD`, `readFixtures`; `BASE_URL` (`tests/e2e/env.ts`).
- Produces: `E2EFixtures` gains `intake: { email: string; name: string }` and `leadsInbox: string`.

The E2E server is `next start` (`NODE_ENV=production`), so the seed saves an `integrations.smtp` row pointing at Mailpit (no dev default in production). Each test sends from its own `X-Forwarded-For` (rate limits are per IP).

- [ ] **Step 1: Write the failing test and the fixtures**

`tests/e2e/fixtures.ts` — add to `E2EFixtures`:

```ts
  intake: { email: string; name: string }
  /** settings.leads.recipients[0] in sp_e2e; mail lands in Mailpit. */
  leadsInbox: string
```

`tests/e2e/seed.ts` — add before the fixtures object (imports: `eq` from `drizzle-orm`, `settings` from `@/server/db/schema`):

```ts
// Leads (Phase 7): an intake user, staff notifications to a Mailpit inbox.
const intake = { email: "intake@e2e.test", name: "Ian Intake" }
await auth.api.createUser({
  body: { ...intake, role: ["intake"], password: E2E_PASSWORD },
})
const leadsInbox = "leads@e2e.test"
const leadsSettings = {
  recipients: [leadsInbox],
  retentionMonths: 24,
  acknowledgement: false,
}
await getDb()
  .update(settings)
  .set({ draft: leadsSettings, published: leadsSettings })
  .where(eq(settings.key, "leads"))
// `next start` is production: no dev Mailpit default, so save SMTP explicitly
// (stored like the integrations service does: empty secret = "").
const smtp = {
  host: "127.0.0.1",
  port: 1025,
  secure: false,
  user: "",
  password: "",
  fromName: "Security Partners E2E",
  fromAddress: "website@e2e.test",
}
await getDb()
  .insert(settings)
  .values({ key: "integrations.smtp", draft: smtp, published: null, version: 1 })
  .onConflictDoUpdate({ target: settings.key, set: { draft: smtp } })
```

and add `intake, leadsInbox,` to the `fixtures` object.

`tests/e2e/leads.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"

import {
  assertMailpitUp,
  deleteMail,
  waitForMail,
} from "../integration/helpers/mailpit"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Master 7.3/7.4: the public form creates a lead the intake user works in
// the inbox, and the staff email reaches Mailpit; honeypot → no lead; the
// 6th post from one IP in 10 minutes → 429.

const SUCCESS = "Thank you, your message has been sent. We will be in touch shortly."

test.beforeAll(assertMailpitUp)

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
  await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible()
}

async function sendEnquiry(
  page: Page,
  name: string,
  opts: { honeypot?: string } = {}
) {
  await page.goto("/contact")
  const form = page.locator("form").filter({ has: page.getByLabel("Your Name") })
  await form.getByLabel("Your Name").fill(name)
  await form.getByLabel("Email").fill("visitor@example.test")
  await form.getByLabel("Phone").fill("085 123 4567")
  await form.getByLabel("Message").fill("Please quote for static security.")
  if (opts.honeypot)
    await form.locator("#website").fill(opts.honeypot, { force: true })
  await form.getByRole("button", { name: "Send Message" }).click()
  await expect(form.getByText(SUCCESS)).toBeVisible()
}

test("public enquiry → lead in the intake inbox → staff email in Mailpit", async ({
  page,
  browser,
}) => {
  const { intake, leadsInbox } = readFixtures()
  const name = `Visitor ${Date.now()}`
  await deleteMail(leadsInbox)

  const visitor = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${name} visitor`) },
  })
  await sendEnquiry(await visitor.newPage(), name)
  await visitor.close()

  const mail = await waitForMail(leadsInbox, {
    subject: `Website enquiry from ${name}`,
  })
  expect(mail.ReplyTo.map((a) => a.Address)).toEqual(["visitor@example.test"])
  expect(mail.Text).toContain("Please quote for static security.")

  await signIn(page, intake.email)
  // Intake sees only leads (plus Dashboard/Account) and the API agrees.
  const nav = page.getByRole("navigation", { name: "Admin" })
  await expect(nav.getByRole("link", { name: /^Leads/ })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Pages" })).toHaveCount(0)
  expect((await page.request.get("/api/v1/admin/pages")).status()).toBe(403)

  await nav.getByRole("link", { name: /^Leads/ }).click()
  await page.getByRole("searchbox", { name: "Search leads" }).fill(name)
  await page.getByRole("link", { name }).first().click()
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()

  await page.getByLabel("Lead status").selectOption("contacted")
  await expect(page.getByText("Lead updated")).toBeVisible()
  await page.getByRole("tab", { name: /Notes/ }).click()
  await page.getByLabel("Add a note").fill("Called, sending a quote")
  await page.getByRole("button", { name: "Add note" }).click()
  await expect(
    page.getByRole("tabpanel").getByText("Called, sending a quote")
  ).toBeVisible()
  await page.getByRole("tab", { name: "Activity" }).click()
  await expect(page.getByRole("tabpanel").getByText("New → Contacted")).toBeVisible()
})

test("honeypot filled → success shown, but no lead is stored", async ({
  page,
  browser,
}) => {
  const { intake } = readFixtures()
  const name = `Bot ${Date.now()}`
  const bot = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${name} bot`) },
  })
  await sendEnquiry(await bot.newPage(), name, { honeypot: "http://spam.example" })
  await bot.close()

  await signIn(page, intake.email)
  const res = await page.request.get(
    `/api/v1/admin/leads?status=all&q=${encodeURIComponent(name)}`
  )
  expect(res.status()).toBe(200)
  expect(((await res.json()) as { total: number }).total).toBe(0)
})

test("6th enquiry from one IP within 10 minutes → 429 with Retry-After", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor("rate-limit-6th") },
  })
  // Honeypot bodies: counted by the limiter, but no lead or email is created.
  const data = {
    name: "Rate",
    email: "rate@example.test",
    message: "Hi",
    website: "bot",
  }
  for (let i = 0; i < 5; i++)
    expect((await api.post("/api/v1/public/leads", { data })).status()).toBe(200)
  const sixth = await api.post("/api/v1/public/leads", { data })
  expect(sixth.status()).toBe(429)
  expect(Number(sixth.headers()["retry-after"])).toBeGreaterThan(0)
  expect(((await sixth.json()) as { error: { code: string } }).error.code).toBe(
    "RATE_LIMITED"
  )
  await api.dispose()
})
```

- [ ] **Step 2: Run the spec** (Tasks 1–6 already implement the behaviour; without Step 1's seed change the first test fails at `waitForMail` — `No email to leads@e2e.test arrived in Mailpit`)

Run (Postgres + Mailpit up; port 3100 free; nobody else running Playwright/build): `pnpm test:e2e tests/e2e/leads.spec.ts`
Expected: PASS (3 tests). If the first test fails at `waitForMail`, check that `integrations.smtp` is in `sp_e2e` and that `readIntegrationConfig` accepts the seeded row (Phase 6 storage format). If the searchbox name differs, use the DataTable's real `aria-label` (`Search leads`, from `label="Leads"`).

- [ ] **Step 3: Phase gate**

Run, in order (Postgres + Mailpit up; port 3100 free):

```bash
pnpm lint && pnpm typecheck && pnpm test
env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build
pnpm test:visual
pnpm test:e2e
```

Expected: all green; `test:visual` reports 0 px differences for every public URL (including `/` and `/contact`) and the re-captured admin shell baselines; `test:e2e` passes every earlier spec plus `leads.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/fixtures.ts tests/e2e/seed.ts tests/e2e/leads.spec.ts
git commit -m "test: cover enquiries from the public form to the leads inbox end to end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase gate (controller, after Task 7)

- `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` green; `pnpm test:visual` (0 px public incl. `/`, `/contact`; admin shell re-baselined in Task 5 only); `pnpm test:e2e` green — Mailpit must be running for integration and E2E.
- Launch-doc items for Phase 10: owner confirms the consent basis (no visible checkbox); Turnstile widget created in **Invisible** mode; CI integration + E2E jobs need the Mailpit service; `settings.leads.recipients` must hold a real inbox before go-live.
