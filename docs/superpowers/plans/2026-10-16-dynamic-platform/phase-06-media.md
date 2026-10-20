# Phase 6 — Media + Integrations

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master Phase 6 = Tasks 6.1–6.4, preceded by master Task 7.1 per ledger ruling "6.1 ↔ 7.1"). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§4, §5.4–§5.6, §6.1, §7, §8.1–§8.2, §11–§13, §15). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Public design is frozen: `pnpm test:visual` keeps every public baseline at 0 px (1440×900 and 390×844, macOS, port 3100 free). Seeded `static` media keep rendering through the default `next/image` loader with the same `src`/`srcset` as today. Only the **admin shell** baselines are re-captured (Task 6: the sidebar gains "Media").
- `next build` succeeds with no env vars and no database.
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (+ platform `NODE_ENV`, `PORT`, `HOSTNAME`). SMTP, R2, Turnstile and AI credentials live in the `settings` table, encrypted.
- Secrets: AES-256-GCM via `server/lib/crypto.ts` with AAD `<settings key>.<field>` (e.g. `integrations.smtp.password`); write-only through the API (reads return `{ set, hint }`); never logged, never in audit diffs, never in test-result messages.
- Every file under `server/` starts with `import "server-only"`. `lib/**` never imports `server/**` (except the type-only import in `lib/api-client.ts`). Repos are the only files outside `server/db/**`/`tests/**` importing `drizzle-orm`; routes never import repos.
- Hono handlers: validate (`zv`) → authorise (`can(...)`) → call a service. Services re-check permissions, audit every mutation, keep `media_usages` exact in the same transaction, call `invalidate()` from request context only.
- Error envelope `{ error: { code, message, fieldErrors?, current?, requestId } }`; stale `version` → 409 with the current state, checked **before** validation (409 before 422).
- Lists `?page&pageSize&sort=field:dir&q&<filters>` → `{ items, page, pageSize, total }`. IDs uuid v7. Dates ISO 8601 UTC on the wire; shown in `Europe/Dublin`, `en-IE`.
- Body limits: public 64 KB, admin 1 MB, uploads (`POST /media/upload`, `POST /media/:id/replace`) 20 MB per file.
- Library versions exactly as listed in each task (latest stable at 2026-10-16; installed with `--save-exact`).
- Code style: repo Prettier (no semicolons, double quotes, 80 cols). Run `pnpm exec prettier --write <files>` on files you create or edit.
- Commit after every task, staging only your paths; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Only one agent at a time runs Playwright (`test:visual`, `test:e2e`) or `next build` (ledger ruling).
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` + `pnpm test:visual` + `pnpm test:e2e`.

**Prerequisites:** Phases 1–5 complete. This plan uses, by their real names: `server/lib/crypto.ts` (`encryptSecret`, `decryptSecret`, `secretHint`, `deriveKey`), `server/lib/errors.ts`, `server/lib/audit.ts` (`writeAudit`), `server/lib/cache-tags.ts` (`tag`, `invalidate`), `server/lib/media-usages.ts` (`syncMediaUsages`, `clearMediaUsages`), `server/lib/pg-errors.ts`, `server/api/{app,context,validate}.ts`, `server/api/middleware/{auth,body-limit,error}.ts`, `server/modules/media/{repo,queries,service,routes}.ts`, `lib/media.ts` (`collectMediaFields`), `lib/schemas/api/{media,list,params}.ts`, `components/admin/media/{picker-dialog.tsx,use-media-item.ts}` (Phase 4 Task 4), `components/admin/schema-form/widgets/pickers.tsx` (`MediaWidget`), `components/admin/session-provider.tsx`, `hooks/use-permission.ts`, `components/admin/page-header.tsx`, `lib/admin/page-labels.ts`; Phase 4 plan files `lib/admin/settings-keys.ts` (`SETTINGS_ENTRIES`, `isEditableSettingsKey`), `components/admin/settings/settings-overview.tsx`, `server/modules/dashboard/service.ts`, `components/admin/shell/nav.ts`, `tests/e2e/{fixtures,seed}.ts` (fixtures `owner`, `admin`, `editor`), `tests/e2e/page-editor.spec.ts`; Phase 5 Task 6 files `server/lib/scheduler.ts`, `server/lib/jobs/index.ts`, `server/modules/jobs/repo.ts`. Where the real code differs from the Phase 4/5 plan text, apply the same change to the real code and say so in your report.

**Ledger rulings applied:** master Task 7.1 runs first (Tasks 1–2) because storage needs decrypted `integrations.r2`; the admin body limit is selected **by path** inside the admin chain (uploads 20 MB, everything else 1 MB) — the outer 1 MB limit would otherwise 413 every upload; `readStaticMedia` checks path containment before media keys can come from DB/uploads; media URLs encode disk/R2 keys **per path segment** (never `encodeURIComponent` on the whole nested key); `media_usages` is backfilled for every seeded reference (team `photoId`, client/group `logoId`, media refs in page/service/article/settings JSON including rich-text image `attrs.media`); `media_usages` FK is RESTRICT, so deleting media in use → 409; uploads go to `/data/uploads` (dev `.data/uploads`); upload MIME is sniffed from the bytes, never trusted from the request; SVG is sanitised; sharp gives metadata + blur; disk files are served with `Cache-Control: public, max-age=31536000, immutable`; R2 S3 client uses `requestChecksumCalculation`/`responseChecksumValidation: "WHEN_REQUIRED"` (libraries notes §5.5); the media migration is a keyed job on the Phase 5 scheduler (claimed `FOR UPDATE SKIP LOCKED`, keyed rows upserted or deleted on completion); `invalidate()` = `revalidateTag(tag, { expire: 0 })` from request context only; never cache `getDb()` at module scope; `server/lib/pg-errors.ts` is reused.

**Verification note:** this plan was written while Phase 4 was in progress and Phase 5 only planned. Phase 1–3 code and Phase 4 Tasks 1–4 were read from the working tree; Phase 4 Tasks 5–12 and Phase 5 were taken from their plan files. Library calls were checked against installed/probed packages: `dompurify@3.4.17` + `jsdom@30.1.3` (SVG sanitising, output below), `nodemailer@10.1.1` (`verify()` against the dev Mailpit: `true` both with and without `auth`), `@aws-sdk/client-s3@3.1152.0` (`requestHandler: { connectionTimeout, requestTimeout }` accepted; config getters return `"WHEN_REQUIRED"`), `sharp@0.35.5` (`metadata().mediaType` = `image/jpeg|png|webp|avif|svg+xml`; GIF/TIFF also detected, so they are rejected by the sniffer, not by sharp), and `node_modules/next/dist/server/next-server.js:198` (see correction 3). Run every step's command and fix mechanical drift.

## Corrections to master plan

- **Order and split:** master 7.1 is Tasks 1 (API) + 2 (screens); 6.1 = Task 3; 6.2 = Tasks 4 (upload pipeline, upload API, file route, body limit) + 5 (alt/focal, delete 409, usages, replace, usages backfill); 6.3 = Tasks 6 (library screen) + 7 (picker upload + E2E); 6.4 = Task 8 — cost: none.
- **Integration schemas live in `lib/schemas/integrations/*.ts`** and API shapes in `lib/schemas/api/integrations.ts` (Phase 2 ruling: input schemas shared with the client), not `server/modules/integrations/schema.ts`; the module gains `repo.ts` and `testers.ts` — cost: none.
- **No custom `next/image` loader.** Verified: when `images.loader !== "default"` (which `loaderFile` forces) Next answers `/_next/image` with 404 (`next-server.js:198`), so a loader file would change every public `<img>` `src`/`srcset` (pixel freeze) and drop optimisation. Instead **disk and R2 media are both served same-origin** by `GET /api/v1/media/file/<key>` (R2 objects streamed through `GetObject`); the default loader and optimizer then handle static, disk and R2 URLs with no `remotePatterns` and no build-time dependency on the DB (the goal of spec §5.6 / the ledger ruling). Cost if wrong: R2 originals pass through the app on optimizer cache misses only (the optimizer serves every optimised image from our server anyway).
- **`integrations.r2` has no "public base URL"** (nothing uses it: media is same-origin, so the bucket can stay private) and gains `jurisdiction: "default" | "eu"` (EU buckets use `<account>.eu.r2.cloudflarestorage.com`). Phase 10 launch doc must not ask for a public bucket URL — cost: none.
- **`StorageDriver` gains `read(key): Promise<Uint8Array | null>`** (file route + migration). `server/lib/storage/static.ts` is a path helper (static files are served by Next from `public/`), not a driver; driver names stay `"disk" | "r2"` — cost: none.
- **Uploads directory = `/data/uploads` when `/data` exists** (the Docker volume; the Dockerfile creates `/data`), else `<cwd>/.data/uploads`. Not keyed on `NODE_ENV`: the E2E/visual servers run `next start` (production) on macOS without `/data` — cost if wrong: a production container without the volume would write to its ephemeral `.data` (the Dockerfile always creates `/data`).
- **`media.original_name` column** (migration `0005_media_original_name`): the uploaded file name, shown and searched in the library and picker (keys are `YYYY/MM/<uuid>.<ext>`); static rows get their `public/images` file name — cost: one column.
- **Upload limits:** the file may be up to 20 MB (`MAX_UPLOAD_BYTES`, 422 above it); the request body limit on the two upload paths is 20 MB + 64 KB of multipart envelope (413 above it) — cost: none.
- **Integration API details:** `PUT /integrations/:key { version, values }` with `version: 0` for the first save (optimistic lock like every other write); an empty secret keeps the stored one; `DELETE /integrations/:key?version=` ("Disconnect") clears everything; `POST /integrations/:key/test` answers **200 `{ ok, message, testedAt }`** even when the connection fails (a failed test is a result, not an HTTP error) and 422 when nothing is saved; Turnstile and AI gain an `enabled` switch; the AI test is `GET /v1/models/<model>` at the provider (no tokens spent); disconnecting R2 while files are stored there → 409 — cost: none.
- **Scheduler extension (Phase 5 code):** `server/lib/jobs/index.ts` gains `TRIGGERED_JOBS` (dispatched by `tick()` but never auto-created by `ensureRecurringJobs`) and `JobResult.done` (the claimed row is **deleted** instead of rescheduled — ledger "delete on completion"). The migration keeps keys, so media URLs do not change and no cache tag needs expiring — cost: none.
- **Integrations write no revision rows, and settings history is limited to editable content keys** (controller ruling): `/revisions/settings/:entityId` is gated only by `settings:read` (viewers, editors), so Task 1 adds an allow-list (`isEditableSettingsKey`) in `server/modules/revisions/service.ts` → 404 for any other settings key; audit diffs list changed field names only. Phase 8 must extend the allow-list if it writes revisions for its keys — cost: none.
- **Media replace** (spec §8.1 "replace", no master task): `POST /media/:id/replace` keeps the id (usages unaffected), writes a new key with the active driver, and only accepts the same kind (image ↔ image, PDF ↔ PDF) — cost: small scope add.
- **Dashboard "Next up" SMTP/R2 links** point at `/admin/settings/integrations/{smtp,r2}` from Task 2 (Phase 4 said Phase 7) — cost: none.
- **CI note for Phase 10:** `tests/integration/api/integrations.test.ts` tests SMTP against Mailpit on `127.0.0.1:1025`; the CI integration job needs the Mailpit service as well as Postgres — cost: one service entry.
- **Media picker renders outside the admin shell** (Phase 4 DOM tests render `SchemaForm` without a session): it reads the session through a new `useOptionalAdminSession()` and shows "Upload" only when a session grants `media:create` — cost: none.

---

### Task 1: Integrations module — encrypted settings, write-only secrets, test connection (master Task 7.1, part 1)

**Files:**
- Create: `lib/schemas/integrations/{smtp,r2,turnstile,ai,index}.ts`, `lib/schemas/api/integrations.ts`, `server/lib/r2-client.ts`, `server/modules/integrations/{repo,testers,service,routes}.ts`
- Modify: `package.json` + `pnpm-lock.yaml` (`nodemailer@10.1.1`, `@aws-sdk/client-s3@3.1152.0`), `server/lib/settings-store.ts` (re-export the integration keys), `server/modules/media/repo.ts` (`countMediaByDriver`), `server/modules/revisions/service.ts` (settings history only for editable content keys — controller ruling), `server/api/app.ts` (mount `/integrations`)
- Test: `tests/unit/integrations/schemas.test.ts`, `tests/unit/integrations/testers.test.ts`, `tests/integration/api/integrations.test.ts`

**Interfaces:**
- Consumes: Phase 1 `encryptSecret`/`decryptSecret`/`secretHint` (AAD `<settings key>.<field>`), `AppError`/`conflict`/`forbidden`/`notFound`/`fieldErrorsFromIssues`, `getDb`/`DbOrTx`; Phase 2 `hasPermission`, `ROLES`, `writeAudit`, `can`/`actorOf`, `zv`; Phase 3 table `settings` (`key, draft, published, version, updatedBy, updatedAt`), `users`, `media` (`MEDIA_DRIVERS`); libraries notes §5.4 (nodemailer `verify()`), §5.5 (R2 client).
- Produces:

```ts
// lib/schemas/integrations/index.ts (isomorphic)
export const INTEGRATION_KEYS = ["integrations.smtp", "integrations.r2", "integrations.turnstile", "integrations.ai"] as const
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number]
export const INTEGRATIONS: Record<IntegrationKey, { slug; label; description; schema: z.ZodType; fields: readonly string[]; secrets: readonly string[]; defaults }>  // `as const`
export type IntegrationConfig<K extends IntegrationKey>        // SmtpConfig | R2Config | TurnstileConfig | AiConfig
export type IntegrationSlug = "smtp" | "r2" | "turnstile" | "ai"
export function isIntegrationKey(value: string): value is IntegrationKey
export function integrationKeyFromSlug(slug: string): IntegrationKey | null
export function isSecretField(key: IntegrationKey, field: string): boolean
// smtp: host, port, secure, user, password*, fromName, fromAddress
// r2: accountId, jurisdiction ("default" | "eu"), bucket, accessKeyId*, secretAccessKey*
// turnstile: enabled, siteKey, secretKey*
// ai: enabled, provider ("anthropic" | "openai"), model, apiKey*, allowedRoles (subset of AI_ROLES = roles holding ai:use)
// lib/schemas/api/integrations.ts
export const integrationKeyParam      // { key: IntegrationKey }
export const saveIntegrationInput     // { version: int ≥ 0 (0 = first save), values: Record<string, unknown> }
export const integrationVersionQuery  // ?version= (int ≥ 1)
export type SecretState = { set: boolean; hint: string | null }   // hint "••••abcd"; null when unset or unreadable
export type IntegrationDto = { key; slug; label; description; configured: boolean; version: number; values: Record<string, unknown> /* non-secret fields */; secrets: Record<string, SecretState>; updatedAt: string | null; updatedBy: { id: string; name: string } | null }
export type IntegrationTestResult = { ok: boolean; message: string; testedAt: string }
// server/lib/r2-client.ts
export function r2Endpoint(c: Pick<R2Config, "accountId" | "jurisdiction">): string
export function createR2Client(c: R2Config): S3Client           // region auto, checksums WHEN_REQUIRED, timeouts
// server/modules/integrations/testers.ts
export type TestResult = { ok: boolean; message: string }
export type TestDeps = { fetch?: typeof fetch; r2Client?: S3Client }
export function redactSecrets(message: string, secrets: readonly string[]): string
export async function testSmtp(c: SmtpConfig): Promise<TestResult>                    // transporter.verify()
export async function testR2(c: R2Config, client?: S3Client): Promise<TestResult>     // HeadBucket
export async function testTurnstile(c: TurnstileConfig, fetchImpl?): Promise<TestResult>  // siteverify with a dummy token
export async function testAi(c: AiConfig, fetchImpl?): Promise<TestResult>            // GET /v1/models/<model>
export async function runIntegrationTest<K>(key: K, config: IntegrationConfig<K>, deps?: TestDeps): Promise<TestResult>
// server/modules/integrations/service.ts
export const secretAad: (key: IntegrationKey, field: string) => string   // "<key>.<field>"
export async function listIntegrations(actor): Promise<{ items: IntegrationDto[] }>
export async function getIntegration(actor, key): Promise<IntegrationDto>
export async function saveIntegration(actor, key, input: SaveIntegrationInput): Promise<IntegrationDto>
export async function deleteIntegration(actor, key, version: number): Promise<{ ok: true }>
export async function testIntegration(actor, key): Promise<IntegrationTestResult>
export async function readIntegrationConfig<K>(key: K, db?: DbOrTx): Promise<IntegrationConfig<K> | null>  // decrypted; server use only
// server/modules/media/repo.ts
export async function countMediaByDriver(db, driver: "static" | "disk" | "r2"): Promise<number>
// server/modules/revisions/service.ts (behaviour change)
// GET /revisions/settings/:entityId[/…] → 404 unless isEditableSettingsKey(entityId) (lib/admin/settings-keys.ts)
// HTTP (owner/admin only through the permission matrix: integration:read/update/test)
GET    /api/v1/admin/integrations              → { items: IntegrationDto[] }         integration:read
GET    /api/v1/admin/integrations/:key         → IntegrationDto                      integration:read
PUT    /api/v1/admin/integrations/:key         { version, values } → IntegrationDto  integration:update (409 stale, 422 invalid)
DELETE /api/v1/admin/integrations/:key?version → { ok: true }                         integration:update (409 stale / R2 in use)
POST   /api/v1/admin/integrations/:key/test    → IntegrationTestResult (200 even when ok=false; 422 if not saved)  integration:test
```

Storage rules: one `settings` row per integration key; `draft` holds the stored object (non-secret fields in plain JSON, each non-empty secret as `encryptSecret(value, "<key>.<field>")`, an empty secret as `""`), `published` stays `null`, `version` starts at 1. Saves apply immediately (spec §5.4: not draft-versioned). The service compares `version` before validating, merges the input with the stored values (absent field → stored/default value; empty secret → stored secret), validates the merged object with the integration's schema, encrypts and writes. **No revision rows** are written for integrations (controller ruling: `/revisions/settings/:entityId` is gated only by `settings:read`, which viewers and editors hold); in addition the revisions service now answers 404 for `settings` history of any key outside `EDITABLE_SETTINGS_KEYS`, so no snapshot of a non-content settings row (integrations, and until Phase 8 extends the allow-list, `seo.defaults`/`consent`/`tracking`/`customCode`) is readable there. Audit actions: `integration.created`, `integration.updated`, `integration.deleted` with `diff: { changed: string[] }` (field names only), `integration.tested` with `diff: { ok }`. No secret value reaches a response, a log line, an audit diff or a test message.

- [ ] **Step 1: Install the libraries**

```bash
pnpm add --save-exact nodemailer@10.1.1 @aws-sdk/client-s3@3.1152.0
```

Expected: both appear under `dependencies` in `package.json`. Do **not** add `@types/nodemailer` (nodemailer 10 bundles its types; libraries notes §5.4). Both run in the Node runtime only; `@aws-sdk/client-s3` is already in Next's built-in `serverExternalPackages`, nodemailer is server-only code (no config change).

- [ ] **Step 2: Write the failing tests**

`tests/unit/integrations/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { z } from "zod"

import {
  AI_ROLES,
  INTEGRATION_KEYS,
  INTEGRATIONS,
  integrationKeyFromSlug,
  isIntegrationKey,
  isSecretField,
} from "@/lib/schemas/integrations"

const shapeKeys = (schema: z.ZodType) =>
  Object.keys((schema as unknown as { shape: Record<string, unknown> }).shape)

describe("integration definitions (spec §5.4)", () => {
  it.each(INTEGRATION_KEYS)("%s lists exactly its schema fields", (key) => {
    const def = INTEGRATIONS[key]
    expect([...def.fields].sort()).toEqual(shapeKeys(def.schema).sort())
    for (const secret of def.secrets) expect(def.fields).toContain(secret)
    for (const field of def.fields)
      if (!isSecretField(key, field)) expect(def.defaults).toHaveProperty(field)
  })

  it("marks the bold fields of spec §5.4 as secrets", () => {
    expect(INTEGRATIONS["integrations.smtp"].secrets).toEqual(["password"])
    expect(INTEGRATIONS["integrations.r2"].secrets).toEqual([
      "accessKeyId",
      "secretAccessKey",
    ])
    expect(INTEGRATIONS["integrations.turnstile"].secrets).toEqual([
      "secretKey",
    ])
    expect(INTEGRATIONS["integrations.ai"].secrets).toEqual(["apiKey"])
  })

  it("maps admin URL slugs to keys", () => {
    expect(integrationKeyFromSlug("smtp")).toBe("integrations.smtp")
    expect(integrationKeyFromSlug("r2")).toBe("integrations.r2")
    expect(integrationKeyFromSlug("nope")).toBeNull()
    expect(isIntegrationKey("integrations.ai")).toBe(true)
    expect(isIntegrationKey("site")).toBe(false)
  })
})

describe("integration schemas", () => {
  const smtp = INTEGRATIONS["integrations.smtp"].schema
  const r2 = INTEGRATIONS["integrations.r2"].schema
  const turnstile = INTEGRATIONS["integrations.turnstile"].schema
  const ai = INTEGRATIONS["integrations.ai"].schema

  const validSmtp = {
    host: "smtp.example.ie",
    port: 587,
    secure: false,
    user: "mailer@example.ie",
    password: "pw-1234",
    fromName: "Security Partners",
    fromAddress: "no-reply@example.ie",
  }

  it("smtp: a user name needs a password; no user needs none", () => {
    expect(smtp.safeParse(validSmtp).success).toBe(true)
    const missing = smtp.safeParse({ ...validSmtp, password: "" })
    expect(missing.success).toBe(false)
    expect(missing.error!.issues[0].path).toEqual(["password"])
    expect(
      smtp.safeParse({ ...validSmtp, user: "", password: "" }).success
    ).toBe(true)
    expect(smtp.safeParse({ ...validSmtp, port: 70000 }).success).toBe(false)
    expect(
      smtp.safeParse({ ...validSmtp, host: "smtp example" }).success
    ).toBe(false)
  })

  it("r2: account id, bucket name and both keys", () => {
    const valid = {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "eu",
      bucket: "sp-media",
      accessKeyId: "AKID",
      secretAccessKey: "SECRET",
    }
    expect(r2.safeParse(valid).success).toBe(true)
    expect(r2.safeParse({ ...valid, accountId: "abc" }).success).toBe(false)
    expect(r2.safeParse({ ...valid, bucket: "Bad_Bucket" }).success).toBe(
      false
    )
    expect(r2.safeParse({ ...valid, accessKeyId: "" }).success).toBe(false)
  })

  it("turnstile: keys are required only while it is on", () => {
    expect(
      turnstile.safeParse({ enabled: false, siteKey: "", secretKey: "" })
        .success
    ).toBe(true)
    const on = turnstile.safeParse({ enabled: true, siteKey: "", secretKey: "" })
    expect(on.success).toBe(false)
    expect(on.error!.issues.map((i) => i.path[0]).sort()).toEqual([
      "secretKey",
      "siteKey",
    ])
  })

  it("ai: model and key while on; allowed roles are roles holding ai:use", () => {
    expect(AI_ROLES).not.toContain("viewer")
    expect(AI_ROLES).toContain("editor")
    const base = {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKey: "sk-ant-1234",
      allowedRoles: ["owner", "editor"],
    }
    expect(ai.safeParse(base).success).toBe(true)
    expect(ai.safeParse({ ...base, apiKey: "" }).success).toBe(false)
    expect(
      ai.safeParse({ ...base, allowedRoles: ["viewer"] }).success
    ).toBe(false)
    expect(
      ai.safeParse({ ...base, allowedRoles: ["editor", "editor"] }).success
    ).toBe(false)
    expect(
      ai.safeParse({ ...base, enabled: false, model: "", apiKey: "" }).success
    ).toBe(true)
  })
})
```

`tests/unit/integrations/testers.test.ts`:

```ts
import { S3ServiceException, type S3Client } from "@aws-sdk/client-s3"
import { describe, expect, it, vi } from "vitest"

import type {
  AiConfig,
  R2Config,
  SmtpConfig,
  TurnstileConfig,
} from "@/lib/schemas/integrations"
import {
  redactSecrets,
  testAi,
  testR2,
  testSmtp,
  testTurnstile,
} from "@/server/modules/integrations/testers"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("redactSecrets", () => {
  it("replaces every occurrence of each secret (4+ chars)", () => {
    expect(redactSecrets("key abcd1234 and abcd1234", ["abcd1234"])).toBe(
      "key •••• and ••••"
    )
    expect(redactSecrets("abc", ["abc"])).toBe("abc")
  })
})

describe("testSmtp", () => {
  it("reports a refused connection without the password", async () => {
    const config: SmtpConfig = {
      host: "127.0.0.1",
      port: 1,
      secure: false,
      user: "mailer",
      password: "super-secret-pw",
      fromName: "SP",
      fromAddress: "no-reply@example.ie",
    }
    const result = await testSmtp(config)
    expect(result.ok).toBe(false)
    expect(result.message).toContain("127.0.0.1:1")
    expect(result.message).not.toContain("super-secret-pw")
  })
})

describe("testR2 (HeadBucket)", () => {
  const config: R2Config = {
    accountId: "0123456789abcdef0123456789abcdef",
    jurisdiction: "default",
    bucket: "sp-media",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "secret-access-key",
  }
  const client = (send: () => Promise<unknown>) =>
    ({ send: vi.fn(send), destroy: vi.fn() }) as unknown as S3Client
  const s3Error = (name: string, status: number) =>
    new S3ServiceException({
      name,
      $fault: "client",
      $metadata: { httpStatusCode: status },
      message: name,
    })

  it("ok when the bucket answers", async () => {
    const c = client(async () => ({}))
    expect(await testR2(config, c)).toEqual({
      ok: true,
      message: "Bucket “sp-media” is reachable with these keys.",
    })
    const command = (c.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(command.constructor.name).toBe("HeadBucketCommand")
    expect(command.input).toEqual({ Bucket: "sp-media" })
  })

  it("maps 404 / 403 / other failures", async () => {
    expect(
      (await testR2(config, client(async () => { throw s3Error("NotFound", 404) }))).message
    ).toMatch(/not found/)
    expect(
      (await testR2(config, client(async () => { throw s3Error("Forbidden", 403) }))).message
    ).toMatch(/Access denied/)
    const network = await testR2(
      config,
      client(async () => {
        throw new Error("getaddrinfo ENOTFOUND secret-access-key")
      })
    )
    expect(network.ok).toBe(false)
    expect(network.message).not.toContain("secret-access-key")
  })
})

describe("testTurnstile (siteverify with a dummy token)", () => {
  const config: TurnstileConfig = {
    enabled: true,
    siteKey: "0x4AAAAAAA",
    secretKey: "0x4AAAAAAA-secret",
  }

  it("a valid secret rejects only the dummy token", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ success: false, "error-codes": ["invalid-input-response"] })
    )
    expect((await testTurnstile(config, fetchImpl)).ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    )
    expect(String(init.body)).toContain("secret=0x4AAAAAAA-secret")
  })

  it("a wrong secret fails; no secret fails without a request", async () => {
    const bad = vi.fn(async () =>
      json({ success: false, "error-codes": ["invalid-input-secret"] })
    )
    expect(await testTurnstile(config, bad)).toEqual({
      ok: false,
      message: "Cloudflare rejected the secret key.",
    })
    const none = vi.fn()
    expect(
      (await testTurnstile({ ...config, secretKey: "" }, none)).ok
    ).toBe(false)
    expect(none).not.toHaveBeenCalled()
  })
})

describe("testAi (GET the model)", () => {
  const anthropic: AiConfig = {
    enabled: true,
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    apiKey: "sk-ant-secret",
    allowedRoles: ["owner"],
  }

  it("calls the provider's model endpoint with the key", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "claude-sonnet-4-5" }))
    expect((await testAi(anthropic, fetchImpl)).ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe("https://api.anthropic.com/v1/models/claude-sonnet-4-5")
    expect(init.headers).toMatchObject({
      "x-api-key": "sk-ant-secret",
      "anthropic-version": "2023-06-01",
    })

    const openai = vi.fn(async () => json({ id: "gpt-5" }))
    await testAi(
      { ...anthropic, provider: "openai", model: "gpt-5", apiKey: "sk-o" },
      openai
    )
    const [openaiUrl, openaiInit] = openai.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(openaiUrl).toBe("https://api.openai.com/v1/models/gpt-5")
    expect(openaiInit.headers).toMatchObject({ authorization: "Bearer sk-o" })
  })

  it("maps 401 and 404", async () => {
    expect(
      (await testAi(anthropic, vi.fn(async () => json({}, 401)))).message
    ).toBe("The API key was rejected.")
    expect(
      (await testAi(anthropic, vi.fn(async () => json({}, 404)))).message
    ).toBe("The key works, but model “claude-sonnet-4-5” was not found.")
  })
})
```

`tests/integration/api/integrations.test.ts`:

```ts
import { S3Client } from "@aws-sdk/client-s3"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
  IntegrationDto,
  IntegrationTestResult,
} from "@/lib/schemas/api/integrations"
import { getDb } from "@/server/db/client"
import { auditLog, media, revisions, settings } from "@/server/db/schema"
import { decryptSecret } from "@/server/lib/crypto"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const SMTP_PASSWORD = "smtp-password-5678"
const R2_SECRET = "r2-secret-access-key-0000"

let owner: string
let admin: string
let editor: string
let viewer: string

beforeEach(async () => {
  await resetDb()
  owner = (await signedInUser(["owner"])).cookie
  admin = (await signedInUser(["admin"])).cookie
  editor = (await signedInUser(["editor"])).cookie
  viewer = (await signedInUser(["viewer"])).cookie
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const smtpValues = (overrides: Record<string, unknown> = {}) => ({
  host: "127.0.0.1",
  port: 1025,
  secure: false,
  user: "mailer@example.test",
  password: SMTP_PASSWORD,
  fromName: "Security Partners",
  fromAddress: "no-reply@example.test",
  ...overrides,
})

async function put(
  cookie: string,
  key: string,
  version: number,
  values: Record<string, unknown>
) {
  const res = await adminRequest(`/integrations/${key}`, {
    cookie,
    method: "PUT",
    json: { version, values },
  })
  return { status: res.status, text: await res.text() }
}
const dto = (text: string) => JSON.parse(text) as IntegrationDto

async function rawDraft(key: string) {
  const [row] = await getDb()
    .select({ draft: settings.draft, version: settings.version })
    .from(settings)
    .where(eq(settings.key, key))
  return row
}

describe("GET /api/v1/admin/integrations (owner/admin only)", () => {
  it("lists the four integrations, unconfigured, with defaults", async () => {
    const res = await adminRequest("/integrations", { cookie: owner })
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as { items: IntegrationDto[] }
    expect(items.map((i) => i.key)).toEqual([
      "integrations.smtp",
      "integrations.r2",
      "integrations.turnstile",
      "integrations.ai",
    ])
    const smtp = items[0]
    expect(smtp).toMatchObject({
      slug: "smtp",
      configured: false,
      version: 0,
      updatedAt: null,
      secrets: { password: { set: false, hint: null } },
    })
    expect(smtp.values).toMatchObject({ port: 587, secure: false })
    expect(smtp.values).not.toHaveProperty("password")
  })

  it("admin may read; editor and viewer may not", async () => {
    expect((await adminRequest("/integrations", { cookie: admin })).status).toBe(200)
    expect((await adminRequest("/integrations", { cookie: editor })).status).toBe(403)
    expect(
      (await adminRequest("/integrations/integrations.smtp", { cookie: viewer })).status
    ).toBe(403)
    expect(
      (await adminRequest("/integrations/integrations.nope", { cookie: owner })).status
    ).toBe(422)
  })
})

describe("PUT /api/v1/admin/integrations/:key", () => {
  it("encrypts secrets at rest and returns only { set, hint }", async () => {
    const { status, text } = await put(owner, "integrations.smtp", 0, smtpValues())
    expect(status).toBe(200)
    expect(text).not.toContain(SMTP_PASSWORD)
    const body = dto(text)
    expect(body).toMatchObject({
      configured: true,
      version: 1,
      secrets: { password: { set: true, hint: "••••5678" } },
    })
    expect(body.values).toMatchObject({ host: "127.0.0.1", port: 1025 })

    const row = await rawDraft("integrations.smtp")
    expect(JSON.stringify(row.draft)).not.toContain(SMTP_PASSWORD)
    const stored = row.draft as Record<string, string>
    expect(stored.password).toMatch(/^v1:/)
    expect(stored.host).toBe("127.0.0.1")
    expect(decryptSecret(stored.password, "integrations.smtp.password")).toBe(
      SMTP_PASSWORD
    )
    // AAD binds the ciphertext to its key + field.
    expect(() =>
      decryptSecret(stored.password, "integrations.r2.secretAccessKey")
    ).toThrow()
  })

  it("an empty secret keeps the stored value", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const before = (await rawDraft("integrations.smtp")).draft as Record<
      string,
      string
    >
    const { status, text } = await put(
      admin,
      "integrations.smtp",
      1,
      smtpValues({ host: "smtp.example.test", password: "" })
    )
    expect(status).toBe(200)
    expect(dto(text)).toMatchObject({
      version: 2,
      values: { host: "smtp.example.test" },
      secrets: { password: { set: true, hint: "••••5678" } },
    })
    const after = (await rawDraft("integrations.smtp")).draft as Record<
      string,
      string
    >
    expect(after.password).toBe(before.password)
    expect(await readIntegrationConfig("integrations.smtp")).toMatchObject({
      host: "smtp.example.test",
      password: SMTP_PASSWORD,
    })
  })

  it("stale version → 409 with the current state, before validation", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const stale = await put(owner, "integrations.smtp", 0, { port: "nope" })
    expect(stale.status).toBe(409)
    const body = JSON.parse(stale.text) as {
      error: { code: string; current: IntegrationDto }
    }
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.current.version).toBe(1)
    expect(stale.text).not.toContain(SMTP_PASSWORD)
  })

  it("invalid values → 422 with field errors; nothing stored", async () => {
    const bad = await put(owner, "integrations.smtp", 0, smtpValues({ port: 0, password: "" }))
    expect(bad.status).toBe(422)
    const { error } = JSON.parse(bad.text) as {
      error: { fieldErrors: Record<string, string[]> }
    }
    expect(Object.keys(error.fieldErrors).sort()).toEqual(["password", "port"])
    expect(await rawDraft("integrations.smtp")).toBeUndefined()
  })

  it("editor cannot write (403)", async () => {
    expect((await put(editor, "integrations.smtp", 0, smtpValues())).status).toBe(403)
  })

  it("audits names of changed fields, never values", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    await put(owner, "integrations.smtp", 1, smtpValues({ port: 2525, password: "" }))
    const rows = await getDb()
      .select({ action: auditLog.action, diff: auditLog.diff })
      .from(auditLog)
      .where(eq(auditLog.entityId, "integrations.smtp"))
      .orderBy(auditLog.createdAt)
    expect(rows.map((r) => r.action)).toEqual([
      "integration.created",
      "integration.updated",
    ])
    expect(rows[1].diff).toEqual({ changed: ["port"] })
    expect(JSON.stringify(rows)).not.toContain(SMTP_PASSWORD)
  })

  it("an unreadable secret (e.g. after an app secret change) shows set without a hint", async () => {
    await put(owner, "integrations.r2", 0, {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "default",
      bucket: "sp-media",
      accessKeyId: "AKID1234",
      secretAccessKey: R2_SECRET,
    })
    await put(owner, "integrations.smtp", 0, smtpValues())
    const smtpStored = (await rawDraft("integrations.smtp")).draft as Record<string, string>
    const r2Stored = (await rawDraft("integrations.r2")).draft as Record<string, string>
    // Ciphertext moved to another field: the AAD no longer matches.
    await getDb()
      .update(settings)
      .set({ draft: { ...r2Stored, secretAccessKey: smtpStored.password } })
      .where(eq(settings.key, "integrations.r2"))
    const res = await adminRequest("/integrations/integrations.r2", { cookie: owner })
    expect(((await res.json()) as IntegrationDto).secrets).toEqual({
      accessKeyId: { set: true, hint: "••••1234" },
      secretAccessKey: { set: true, hint: null },
    })
    await expect(readIntegrationConfig("integrations.r2")).rejects.toThrow(
      /cannot be decrypted/
    )
  })
})

describe("DELETE /api/v1/admin/integrations/:key (Disconnect)", () => {
  it("removes the row with the current version; stale → 409", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    expect(
      (await adminRequest("/integrations/integrations.smtp?version=7", {
        cookie: owner,
        method: "DELETE",
      })).status
    ).toBe(409)
    const res = await adminRequest("/integrations/integrations.smtp?version=1", {
      cookie: owner,
      method: "DELETE",
    })
    expect(res.status).toBe(200)
    expect(await rawDraft("integrations.smtp")).toBeUndefined()
    expect(await readIntegrationConfig("integrations.smtp")).toBeNull()
  })

  it("keeps R2 while files are stored there", async () => {
    await put(owner, "integrations.r2", 0, {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "default",
      bucket: "sp-media",
      accessKeyId: "AKID1234",
      secretAccessKey: R2_SECRET,
    })
    await getDb().insert(media).values({
      key: "2026/10/0190a6e0-0000-7000-8000-000000000001.png",
      driver: "r2",
      mime: "image/png",
      size: 10,
    })
    const res = await adminRequest("/integrations/integrations.r2?version=1", {
      cookie: owner,
      method: "DELETE",
    })
    expect(res.status).toBe(409)
  })
})

describe("POST /api/v1/admin/integrations/:key/test", () => {
  const test = (cookie: string, key: string) =>
    adminRequest(`/integrations/${key}/test`, { cookie, method: "POST" })

  it("422 before anything is saved; editor 403", async () => {
    expect((await test(owner, "integrations.smtp")).status).toBe(422)
    expect((await test(editor, "integrations.smtp")).status).toBe(403)
  })

  it("SMTP: transporter.verify() against the dev Mailpit (pnpm db:up)", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    const res = await test(admin, "integrations.smtp")
    expect(res.status).toBe(200)
    const body = (await res.json()) as IntegrationTestResult
    expect(body.ok).toBe(true)
    expect(body.message).toBe(
      "Connected to 127.0.0.1:1025 and signed in as mailer@example.test."
    )
  })

  it("SMTP: a failure is a 200 result without the password", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues({ port: 1 }))
    const res = await test(owner, "integrations.smtp")
    const text = await res.text()
    expect(res.status).toBe(200)
    expect((JSON.parse(text) as IntegrationTestResult).ok).toBe(false)
    expect(text).not.toContain(SMTP_PASSWORD)
  })

  it("R2: HeadBucket with the decrypted keys", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never)
    await put(owner, "integrations.r2", 0, {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "eu",
      bucket: "sp-media",
      accessKeyId: "AKID1234",
      secretAccessKey: R2_SECRET,
    })
    const body = (await (await test(owner, "integrations.r2")).json()) as IntegrationTestResult
    expect(body.ok).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("Turnstile and AI call the provider (fetch stubbed)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("turnstile")
        ? Response.json({ success: false, "error-codes": ["invalid-input-response"] })
        : Response.json({ id: "claude-sonnet-4-5" })
    )
    vi.stubGlobal("fetch", fetchMock)
    await put(owner, "integrations.turnstile", 0, {
      enabled: true,
      siteKey: "0x4AAAAAAA",
      secretKey: "0x4AAAAAAA-secret",
    })
    await put(owner, "integrations.ai", 0, {
      enabled: true,
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKey: "sk-ant-secret-key",
      allowedRoles: ["owner", "admin", "editor"],
    })
    expect(((await (await test(owner, "integrations.turnstile")).json()) as IntegrationTestResult).ok).toBe(true)
    expect(((await (await test(owner, "integrations.ai")).json()) as IntegrationTestResult).ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("viewer cannot read integration secrets via revisions or audit (controller ruling)", () => {
  it("no revision rows; settings history is limited to editable content keys; audit is closed to viewers", async () => {
    await put(owner, "integrations.smtp", 0, smtpValues())
    expect(
      await getDb()
        .select()
        .from(revisions)
        .where(eq(revisions.entityId, "integrations.smtp"))
    ).toEqual([])
    // Even a planted snapshot (e.g. a future bug) is not served.
    const [planted] = await getDb()
      .insert(revisions)
      .values({
        entityType: "settings",
        entityId: "integrations.smtp",
        version: 1,
        data: smtpValues(),
      })
      .returning({ id: revisions.id })
    for (const cookie of [viewer, editor, owner]) {
      const list = await adminRequest("/revisions/settings/integrations.smtp", { cookie })
      expect(list.status).toBe(404)
      const one = await adminRequest(
        `/revisions/settings/integrations.smtp/${planted.id}`,
        { cookie }
      )
      expect(one.status).toBe(404)
      expect(await one.text()).not.toContain(SMTP_PASSWORD)
    }
    // Content settings history still works for readers.
    expect(
      (await adminRequest("/revisions/settings/site", { cookie: viewer })).status
    ).toBe(200)
    // Audit log: viewers have no audit:read; for the owner it holds field names only.
    expect((await adminRequest("/audit", { cookie: viewer })).status).toBe(403)
    const audit = await adminRequest("/audit?entityType=integration", { cookie: owner })
    expect(audit.status).toBe(200)
    expect(await audit.text()).not.toContain(SMTP_PASSWORD)
  })
})

describe("secrets never reach the logs", () => {
  it("save, read and test log nothing containing a secret", async () => {
    const calls: unknown[][] = []
    for (const method of ["log", "info", "warn", "error", "debug"] as const)
      vi.spyOn(console, method).mockImplementation((...args) => {
        calls.push(args)
      })
    await put(owner, "integrations.smtp", 0, smtpValues({ port: 1 }))
    await adminRequest("/integrations", { cookie: owner })
    await adminRequest("/integrations/integrations.smtp/test", {
      cookie: owner,
      method: "POST",
    })
    expect(JSON.stringify(calls)).not.toContain(SMTP_PASSWORD)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/integrations && pnpm test:integration tests/integration/api/integrations.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/integrations'` / `'@/server/modules/integrations/testers'` / `'@/server/modules/integrations/service'`.

- [ ] **Step 4: Schemas**

`lib/schemas/integrations/smtp.ts`:

```ts
import { z } from "zod"

export const SMTP_FIELDS = [
  "host",
  "port",
  "secure",
  "user",
  "password",
  "fromName",
  "fromAddress",
] as const
export const SMTP_SECRETS = ["password"] as const

/** Settings ▸ Integrations ▸ Email (spec §5.4). `password` is stored encrypted. */
export const smtpConfig = z
  .object({
    host: z
      .string({ error: "Required" })
      .trim()
      .min(1, "Required")
      .max(253)
      .regex(/^[A-Za-z0-9.-]+$/, "Enter a server name, e.g. smtp.example.ie"),
    port: z
      .number({ error: "Enter a port number" })
      .int("Enter a whole number")
      .min(1, "Between 1 and 65535")
      .max(65535, "Between 1 and 65535"),
    /** true = TLS from the first byte (port 465); false = STARTTLS when the server offers it (587, 25). */
    secure: z.boolean({ error: "Required" }),
    /** "" = the server needs no sign-in. */
    user: z.string({ error: "Required" }).trim().max(320),
    password: z.string().max(1000),
    fromName: z.string({ error: "Required" }).trim().min(1, "Required").max(100),
    fromAddress: z.email({ error: "Enter an email address" }),
  })
  .superRefine((value, ctx) => {
    if (value.user !== "" && value.password === "")
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Enter the password for this user name",
      })
  })
export type SmtpConfig = z.output<typeof smtpConfig>

export const SMTP_DEFAULTS = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  fromName: "Security Partners",
  fromAddress: "",
} as const
```

`lib/schemas/integrations/r2.ts`:

```ts
import { z } from "zod"

export const R2_FIELDS = [
  "accountId",
  "jurisdiction",
  "bucket",
  "accessKeyId",
  "secretAccessKey",
] as const
export const R2_SECRETS = ["accessKeyId", "secretAccessKey"] as const
/** EU-jurisdiction buckets live behind <account>.eu.r2.cloudflarestorage.com. */
export const R2_JURISDICTIONS = ["default", "eu"] as const

/**
 * Settings ▸ Integrations ▸ Media storage (spec §5.4, §11). Media is served
 * same-origin by /api/v1/media/file/<key>, so the bucket stays private and
 * needs no public URL (phase 6 correction).
 */
export const r2Config = z.object({
  accountId: z
    .string({ error: "Required" })
    .trim()
    .regex(
      /^[0-9a-f]{32}$/,
      "The 32-character account ID (Cloudflare dashboard › R2)"
    ),
  jurisdiction: z.enum(R2_JURISDICTIONS, {
    error: "Choose where the bucket is stored",
  }),
  bucket: z
    .string({ error: "Required" })
    .trim()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
      "3–63 lowercase letters, digits or hyphens"
    ),
  accessKeyId: z.string({ error: "Required" }).trim().min(1, "Required").max(128),
  secretAccessKey: z
    .string({ error: "Required" })
    .trim()
    .min(1, "Required")
    .max(256),
})
export type R2Config = z.output<typeof r2Config>

export const R2_DEFAULTS = {
  accountId: "",
  jurisdiction: "default",
  bucket: "",
} as const
```

`lib/schemas/integrations/turnstile.ts`:

```ts
import { z } from "zod"

export const TURNSTILE_FIELDS = ["enabled", "siteKey", "secretKey"] as const
export const TURNSTILE_SECRETS = ["secretKey"] as const

/** Settings ▸ Integrations ▸ Spam protection (spec §5.4, §9). */
export const turnstileConfig = z
  .object({
    enabled: z.boolean({ error: "Required" }),
    siteKey: z
      .string({ error: "Required" })
      .trim()
      .max(100)
      .regex(/^[0-9A-Za-z_-]*$/, "Letters, digits, - and _ only"),
    secretKey: z.string().trim().max(200),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return
    for (const field of ["siteKey", "secretKey"] as const)
      if (value[field] === "")
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required while spam protection is on",
        })
  })
export type TurnstileConfig = z.output<typeof turnstileConfig>

export const TURNSTILE_DEFAULTS = { enabled: false, siteKey: "" } as const
```

`lib/schemas/integrations/ai.ts`:

```ts
import { z } from "zod"

import { hasPermission } from "@/lib/auth/permissions"
import { ROLES, type Role } from "@/lib/auth/roles"

export const AI_FIELDS = [
  "enabled",
  "provider",
  "model",
  "apiKey",
  "allowedRoles",
] as const
export const AI_SECRETS = ["apiKey"] as const
export const AI_PROVIDERS = ["anthropic", "openai"] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

/** Roles that may be allowed the assistant: those holding ai:use (spec §6.1). */
export const AI_ROLES: readonly Role[] = ROLES.filter((role) =>
  hasPermission([role], { ai: ["use"] })
)

/** Settings ▸ Integrations ▸ AI assistant (spec §5.4, §8.3). */
export const aiConfig = z
  .object({
    enabled: z.boolean({ error: "Required" }),
    provider: z.enum(AI_PROVIDERS, { error: "Choose a provider" }),
    model: z
      .string({ error: "Required" })
      .trim()
      .max(100)
      .regex(/^[A-Za-z0-9._:/-]*$/, "Use the model ID from the provider"),
    apiKey: z.string().trim().max(500),
    allowedRoles: z
      .array(z.enum(ROLES))
      .max(ROLES.length)
      .refine((roles) => new Set(roles).size === roles.length, {
        message: "Each role once",
      }),
  })
  .superRefine((value, ctx) => {
    value.allowedRoles.forEach((role, index) => {
      if (!AI_ROLES.includes(role))
        ctx.addIssue({
          code: "custom",
          path: ["allowedRoles", index],
          message: `The ${role} role cannot use the assistant`,
        })
    })
    if (!value.enabled) return
    if (value.model === "")
      ctx.addIssue({
        code: "custom",
        path: ["model"],
        message: "Required while the assistant is on",
      })
    if (value.apiKey === "")
      ctx.addIssue({
        code: "custom",
        path: ["apiKey"],
        message: "Required while the assistant is on",
      })
  })
export type AiConfig = z.output<typeof aiConfig>

export const AI_DEFAULTS = {
  enabled: false,
  provider: "anthropic",
  model: "",
  allowedRoles: [...AI_ROLES],
} as const
```

`lib/schemas/integrations/index.ts`:

```ts
import type { z } from "zod"

import {
  AI_DEFAULTS,
  AI_FIELDS,
  AI_SECRETS,
  type AiConfig,
  aiConfig,
} from "./ai"
import { R2_DEFAULTS, R2_FIELDS, R2_SECRETS, type R2Config, r2Config } from "./r2"
import {
  SMTP_DEFAULTS,
  SMTP_FIELDS,
  SMTP_SECRETS,
  type SmtpConfig,
  smtpConfig,
} from "./smtp"
import {
  TURNSTILE_DEFAULTS,
  TURNSTILE_FIELDS,
  TURNSTILE_SECRETS,
  type TurnstileConfig,
  turnstileConfig,
} from "./turnstile"

export { AI_PROVIDERS, AI_ROLES, type AiProvider } from "./ai"
export { R2_JURISDICTIONS } from "./r2"
export type { AiConfig, R2Config, SmtpConfig, TurnstileConfig }

/** Encrypted integration settings rows (spec §5.4). */
export const INTEGRATION_KEYS = [
  "integrations.smtp",
  "integrations.r2",
  "integrations.turnstile",
  "integrations.ai",
] as const
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number]

type IntegrationDefinition = {
  /** Admin URL segment: /admin/settings/integrations/<slug>. */
  slug: string
  label: string
  description: string
  schema: z.ZodType
  fields: readonly string[]
  /** Encrypted at rest, write-only through the API. */
  secrets: readonly string[]
  /** Starting values of a form that was never saved (non-secret fields). */
  defaults: Readonly<Record<string, unknown>>
}

export const INTEGRATIONS = {
  "integrations.smtp": {
    slug: "smtp",
    label: "Email (SMTP)",
    description:
      "Sends invitations, password resets and enquiry notifications.",
    schema: smtpConfig,
    fields: SMTP_FIELDS,
    secrets: SMTP_SECRETS,
    defaults: SMTP_DEFAULTS,
  },
  "integrations.r2": {
    slug: "r2",
    label: "Media storage (Cloudflare R2)",
    description:
      "Keeps uploaded images and documents. Until it is set up, uploads stay on the server disk.",
    schema: r2Config,
    fields: R2_FIELDS,
    secrets: R2_SECRETS,
    defaults: R2_DEFAULTS,
  },
  "integrations.turnstile": {
    slug: "turnstile",
    label: "Spam protection (Cloudflare Turnstile)",
    description: "An invisible check on the contact form.",
    schema: turnstileConfig,
    fields: TURNSTILE_FIELDS,
    secrets: TURNSTILE_SECRETS,
    defaults: TURNSTILE_DEFAULTS,
  },
  "integrations.ai": {
    slug: "ai",
    label: "AI assistant",
    description: "Writing help in the admin for the roles you choose.",
    schema: aiConfig,
    fields: AI_FIELDS,
    secrets: AI_SECRETS,
    defaults: AI_DEFAULTS,
  },
} as const satisfies Record<IntegrationKey, IntegrationDefinition>

export type IntegrationConfigs = {
  "integrations.smtp": SmtpConfig
  "integrations.r2": R2Config
  "integrations.turnstile": TurnstileConfig
  "integrations.ai": AiConfig
}
export type IntegrationConfig<K extends IntegrationKey> = IntegrationConfigs[K]
export type IntegrationSlug = (typeof INTEGRATIONS)[IntegrationKey]["slug"]

export function isIntegrationKey(value: string): value is IntegrationKey {
  return (INTEGRATION_KEYS as readonly string[]).includes(value)
}

export function integrationKeyFromSlug(slug: string): IntegrationKey | null {
  return INTEGRATION_KEYS.find((key) => INTEGRATIONS[key].slug === slug) ?? null
}

export function isSecretField(key: IntegrationKey, field: string): boolean {
  return (INTEGRATIONS[key].secrets as readonly string[]).includes(field)
}
```

`lib/schemas/api/integrations.ts`:

```ts
import { z } from "zod"

import {
  INTEGRATION_KEYS,
  type IntegrationKey,
  type IntegrationSlug,
} from "@/lib/schemas/integrations"

export const integrationKeyParam = z.object({ key: z.enum(INTEGRATION_KEYS) })

/**
 * PUT /integrations/:key. `version` 0 = first save. `values` is validated by
 * the service after merging with the stored config (absent fields keep
 * their value; an empty secret keeps the stored secret).
 */
export const saveIntegrationInput = z.object({
  version: z.number().int().min(0),
  values: z.record(z.string(), z.unknown()),
})
export type SaveIntegrationInput = z.output<typeof saveIntegrationInput>

/** DELETE /integrations/:key?version= */
export const integrationVersionQuery = z.object({
  version: z.coerce.number().int().min(1),
})

/** A write-only secret as the API shows it: hint "••••abcd" (null when unset or unreadable). */
export type SecretState = { set: boolean; hint: string | null }

export type IntegrationDto = {
  key: IntegrationKey
  slug: IntegrationSlug
  label: string
  description: string
  configured: boolean
  /** 0 until the first save. */
  version: number
  /** Non-secret fields only. */
  values: Record<string, unknown>
  secrets: Record<string, SecretState>
  updatedAt: string | null
  updatedBy: { id: string; name: string } | null
}

export type IntegrationTestResult = {
  ok: boolean
  message: string
  testedAt: string
}
```

Replace `server/lib/settings-store.ts` with:

```ts
import "server-only"

export {
  isSettingsKey,
  SETTINGS_KEYS,
  type SettingsKey,
  type SettingsValue,
} from "@/lib/schemas/settings"

/** Encrypted integration settings (Phase 6 Task 1: lib/schemas/integrations). */
export {
  INTEGRATION_KEYS,
  type IntegrationKey,
} from "@/lib/schemas/integrations"
```

- [ ] **Step 5: R2 client, testers, repo, service, routes**

`server/lib/r2-client.ts`:

```ts
import "server-only"

import { S3Client } from "@aws-sdk/client-s3"

import type { R2Config } from "@/lib/schemas/integrations"

/** S3 API endpoint of an R2 account (libraries notes §5.5). */
export function r2Endpoint(
  c: Pick<R2Config, "accountId" | "jurisdiction">
): string {
  return c.jurisdiction === "eu"
    ? `https://${c.accountId}.eu.r2.cloudflarestorage.com`
    : `https://${c.accountId}.r2.cloudflarestorage.com`
}

/**
 * S3 client for R2. Checksums only when an operation requires them: R2
 * does not implement several flexible-checksum headers (notes §5.5).
 */
export function createR2Client(c: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: r2Endpoint(c),
    credentials: {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 10_000, requestTimeout: 60_000 },
  })
}
```

`server/modules/integrations/testers.ts`:

```ts
import "server-only"

import {
  HeadBucketCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import nodemailer from "nodemailer"

import type {
  AiConfig,
  IntegrationConfig,
  IntegrationKey,
  R2Config,
  SmtpConfig,
  TurnstileConfig,
} from "@/lib/schemas/integrations"
import { createR2Client } from "@/server/lib/r2-client"

/** "Test connection" outcome: a failure is a result, not an exception. */
export type TestResult = { ok: boolean; message: string }
export type TestDeps = { fetch?: typeof fetch; r2Client?: S3Client }

const TIMEOUT_MS = 10_000
export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

const pass = (message: string): TestResult => ({ ok: true, message })
const fail = (message: string): TestResult => ({ ok: false, message })
const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

/** Error texts may echo what they were given: mask every secret (4+ chars). */
export function redactSecrets(
  message: string,
  secrets: readonly string[]
): string {
  return secrets
    .filter((secret) => secret.length >= 4)
    .reduce((text, secret) => text.split(secret).join("••••"), message)
}

/** SMTP: open a connection, STARTTLS/TLS and sign in (transporter.verify(), notes §5.4). */
export async function testSmtp(c: SmtpConfig): Promise<TestResult> {
  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.password } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  })
  try {
    await transport.verify()
    return pass(
      c.user
        ? `Connected to ${c.host}:${c.port} and signed in as ${c.user}.`
        : `Connected to ${c.host}:${c.port}.`
    )
  } catch (err) {
    const code = (err as { code?: unknown }).code
    return fail(
      redactSecrets(
        `Could not connect to ${c.host}:${c.port}${typeof code === "string" ? ` (${code})` : ""}: ${errorText(err)}`,
        [c.password]
      )
    )
  } finally {
    transport.close()
  }
}

/** R2: HeadBucket with the saved keys (notes §5.5). */
export async function testR2(
  c: R2Config,
  client: S3Client = createR2Client(c)
): Promise<TestResult> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: c.bucket }))
    return pass(`Bucket “${c.bucket}” is reachable with these keys.`)
  } catch (err) {
    if (err instanceof S3ServiceException) {
      const status = err.$metadata.httpStatusCode
      if (status === 404)
        return fail(`Bucket “${c.bucket}” was not found in this account.`)
      if (status === 401 || status === 403)
        return fail(
          "Access denied: check the access key ID, the secret and the token's bucket permissions."
        )
      return fail(`R2 answered ${status ?? "with an error"} (${err.name}).`)
    }
    return fail(
      redactSecrets(`Could not reach R2: ${errorText(err)}`, [
        c.secretAccessKey,
        c.accessKeyId,
      ])
    )
  } finally {
    client.destroy()
  }
}

/**
 * Turnstile: siteverify with a dummy token. A valid secret rejects only the
 * token ("invalid-input-response"); a wrong one answers "invalid-input-secret".
 */
export async function testTurnstile(
  c: TurnstileConfig,
  fetchImpl: typeof fetch = fetch
): Promise<TestResult> {
  if (c.secretKey === "") return fail("Enter the secret key first.")
  try {
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({
        secret: c.secretKey,
        response: "sp-connection-test",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = (await res.json().catch(() => ({}))) as {
      "error-codes"?: string[]
    }
    const codes = body["error-codes"] ?? []
    if (
      codes.includes("invalid-input-secret") ||
      codes.includes("missing-input-secret")
    )
      return fail("Cloudflare rejected the secret key.")
    if (!res.ok) return fail(`Cloudflare answered ${res.status}.`)
    return pass("Cloudflare accepted the secret key.")
  } catch (err) {
    return fail(
      redactSecrets(`Could not reach Cloudflare: ${errorText(err)}`, [
        c.secretKey,
      ])
    )
  }
}

/** The provider's "retrieve model" endpoint: proves the key and the model, spends no tokens. */
export function aiModelRequest(c: AiConfig): {
  url: string
  headers: Record<string, string>
} {
  const model = encodeURIComponent(c.model)
  if (c.provider === "anthropic")
    return {
      url: `https://api.anthropic.com/v1/models/${model}`,
      headers: { "x-api-key": c.apiKey, "anthropic-version": "2023-06-01" },
    }
  return {
    url: `https://api.openai.com/v1/models/${model}`,
    headers: { authorization: `Bearer ${c.apiKey}` },
  }
}

export async function testAi(
  c: AiConfig,
  fetchImpl: typeof fetch = fetch
): Promise<TestResult> {
  if (c.apiKey === "") return fail("Enter the API key first.")
  if (c.model === "") return fail("Enter the model first.")
  const { url, headers } = aiModelRequest(c)
  try {
    const res = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.ok) return pass(`The key works and model “${c.model}” is available.`)
    if (res.status === 401 || res.status === 403)
      return fail("The API key was rejected.")
    if (res.status === 404)
      return fail(`The key works, but model “${c.model}” was not found.`)
    return fail(`The provider answered ${res.status}.`)
  } catch (err) {
    return fail(
      redactSecrets(`Could not reach the provider: ${errorText(err)}`, [
        c.apiKey,
      ])
    )
  }
}

export async function runIntegrationTest<K extends IntegrationKey>(
  key: K,
  config: IntegrationConfig<K>,
  deps: TestDeps = {}
): Promise<TestResult> {
  switch (key) {
    case "integrations.smtp":
      return testSmtp(config as SmtpConfig)
    case "integrations.r2":
      return testR2(
        config as R2Config,
        deps.r2Client ?? createR2Client(config as R2Config)
      )
    case "integrations.turnstile":
      return testTurnstile(config as TurnstileConfig, deps.fetch)
    case "integrations.ai":
      return testAi(config as AiConfig, deps.fetch)
    default:
      throw new Error(`No test for ${key}`)
  }
}
```

`server/modules/integrations/repo.ts`:

```ts
import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { settings, users } from "@/server/db/schema"

export type IntegrationRow = {
  key: string
  draft: unknown
  version: number
  updatedAt: Date
  updatedBy: string | null
  updatedByName: string | null
}

const columns = {
  key: settings.key,
  draft: settings.draft,
  version: settings.version,
  updatedAt: settings.updatedAt,
  updatedBy: settings.updatedBy,
  updatedByName: users.name,
}

export function listIntegrationRows(
  db: DbOrTx,
  keys: readonly string[]
): Promise<IntegrationRow[]> {
  return db
    .select(columns)
    .from(settings)
    .leftJoin(users, eq(users.id, settings.updatedBy))
    .where(inArray(settings.key, [...keys]))
}

export async function findIntegrationRow(
  db: DbOrTx,
  key: string
): Promise<IntegrationRow | null> {
  const [row] = await db
    .select(columns)
    .from(settings)
    .leftJoin(users, eq(users.id, settings.updatedBy))
    .where(eq(settings.key, key))
  return row ?? null
}

/** First save; false when another request created the row first. */
export async function insertIntegrationRow(
  db: DbOrTx,
  row: { key: string; draft: unknown; updatedBy: string }
): Promise<boolean> {
  const inserted = await db
    .insert(settings)
    .values({ ...row, version: 1 })
    .onConflictDoNothing({ target: settings.key })
    .returning({ key: settings.key })
  return inserted.length > 0
}

/** Optimistic update: false when `version` is stale or the row is gone. */
export async function updateIntegrationIfVersion(
  db: DbOrTx,
  key: string,
  version: number,
  patch: { draft: unknown; updatedBy: string }
): Promise<boolean> {
  const updated = await db
    .update(settings)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(settings.key, key), eq(settings.version, version)))
    .returning({ key: settings.key })
  return updated.length > 0
}

export async function deleteIntegrationIfVersion(
  db: DbOrTx,
  key: string,
  version: number
): Promise<boolean> {
  const deleted = await db
    .delete(settings)
    .where(and(eq(settings.key, key), eq(settings.version, version)))
    .returning({ key: settings.key })
  return deleted.length > 0
}
```

Append to `server/modules/media/repo.ts` (and add `type MEDIA_DRIVERS` usage via the schema import line `import { media, MEDIA_DRIVERS, mediaUsages } from "@/server/db/schema"`):

```ts
/** Rows stored by one driver (integrations: R2 cannot be disconnected while it holds files). */
export async function countMediaByDriver(
  db: DbOrTx,
  driver: (typeof MEDIA_DRIVERS)[number]
): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(media)
    .where(eq(media.driver, driver))
  return n
}
```

`server/modules/integrations/service.ts`:

```ts
import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type {
  IntegrationDto,
  IntegrationTestResult,
  SaveIntegrationInput,
  SecretState,
} from "@/lib/schemas/api/integrations"
import {
  INTEGRATION_KEYS,
  INTEGRATIONS,
  type IntegrationConfig,
  type IntegrationKey,
  isSecretField,
} from "@/lib/schemas/integrations"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { decryptSecret, encryptSecret, secretHint } from "@/server/lib/crypto"
import {
  AppError,
  conflict,
  fieldErrorsFromIssues,
  forbidden,
  notFound,
} from "@/server/lib/errors"
import { countMediaByDriver } from "@/server/modules/media/repo"

import {
  deleteIntegrationIfVersion,
  findIntegrationRow,
  insertIntegrationRow,
  type IntegrationRow,
  listIntegrationRows,
  updateIntegrationIfVersion,
} from "./repo"
import { runIntegrationTest } from "./testers"

type Values = Record<string, unknown>

/** AAD binding each ciphertext to its settings key and field (spec §4). */
export const secretAad = (key: IntegrationKey, field: string) =>
  `${key}.${field}`

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const storedObject = (row: IntegrationRow | null): Values =>
  row && row.draft && typeof row.draft === "object" ? (row.draft as Values) : {}

/**
 * Plaintext values of a stored row. A secret that no longer decrypts (app
 * secret changed, ciphertext moved) becomes "" and is listed in `unreadable`.
 */
function openRow(
  key: IntegrationKey,
  row: IntegrationRow
): { values: Values; unreadable: string[] } {
  const stored = storedObject(row)
  const values: Values = {}
  const unreadable: string[] = []
  for (const field of INTEGRATIONS[key].fields) {
    const raw = stored[field]
    if (!isSecretField(key, field)) {
      values[field] = raw
      continue
    }
    if (typeof raw !== "string" || raw === "") {
      values[field] = ""
      continue
    }
    try {
      values[field] = decryptSecret(raw, secretAad(key, field))
    } catch {
      values[field] = ""
      unreadable.push(field)
    }
  }
  return { values, unreadable }
}

/** Stored form: non-empty secrets encrypted with AAD "<key>.<field>". */
function sealValues(key: IntegrationKey, plain: Values): Values {
  const sealed: Values = {}
  for (const field of INTEGRATIONS[key].fields) {
    const value = plain[field]
    sealed[field] =
      isSecretField(key, field) && typeof value === "string" && value !== ""
        ? encryptSecret(value, secretAad(key, field))
        : value
  }
  return sealed
}

function toDto(key: IntegrationKey, row: IntegrationRow | null): IntegrationDto {
  const def = INTEGRATIONS[key]
  const opened = row ? openRow(key, row) : null
  const stored = storedObject(row)
  const values: Values = {}
  const secrets: Record<string, SecretState> = {}
  for (const field of def.fields) {
    if (isSecretField(key, field)) {
      const raw = stored[field]
      const set = typeof raw === "string" && raw !== ""
      const plain = opened?.values[field]
      secrets[field] = {
        set,
        hint:
          set && typeof plain === "string" && plain !== ""
            ? secretHint(plain)
            : null,
      }
    } else {
      values[field] = opened
        ? opened.values[field]
        : (def.defaults as Values)[field]
    }
  }
  return {
    key,
    slug: def.slug,
    label: def.label,
    description: def.description,
    configured: row !== null,
    version: row?.version ?? 0,
    values,
    secrets,
    updatedAt: row ? row.updatedAt.toISOString() : null,
    updatedBy:
      row?.updatedBy && row.updatedByName
        ? { id: row.updatedBy, name: row.updatedByName }
        : null,
  }
}

/** Input over stored values: absent fields keep theirs, empty secrets keep the stored secret. */
function mergeValues(
  key: IntegrationKey,
  input: Values,
  previous: Values | null
): Values {
  const def = INTEGRATIONS[key]
  const merged: Values = {}
  for (const field of def.fields) {
    const value = input[field]
    if (isSecretField(key, field))
      merged[field] =
        typeof value === "string" && value.trim() !== ""
          ? value
          : (previous?.[field] ?? "")
    else
      merged[field] =
        field in input
          ? value
          : previous
            ? previous[field]
            : (def.defaults as Values)[field]
  }
  return merged
}

/** Names of the fields whose value changed (audit diff: never values). */
function changedFields(
  key: IntegrationKey,
  previous: Values | null,
  next: Values
): string[] {
  return INTEGRATIONS[key].fields.filter(
    (field) =>
      JSON.stringify(previous?.[field] ?? null) !==
      JSON.stringify(next[field] ?? null)
  )
}

export async function listIntegrations(
  actor: Actor
): Promise<{ items: IntegrationDto[] }> {
  assertCan(actor, { integration: ["read"] })
  const rows = await listIntegrationRows(getDb(), INTEGRATION_KEYS)
  const byKey = new Map(rows.map((row) => [row.key, row]))
  return {
    items: INTEGRATION_KEYS.map((key) => toDto(key, byKey.get(key) ?? null)),
  }
}

export async function getIntegration(
  actor: Actor,
  key: IntegrationKey
): Promise<IntegrationDto> {
  assertCan(actor, { integration: ["read"] })
  return toDto(key, await findIntegrationRow(getDb(), key))
}

/**
 * Saves immediately (integrations are not draft-versioned, spec §5.4).
 * Version first (409 with the current state), then validation (422).
 */
export async function saveIntegration(
  actor: Actor,
  key: IntegrationKey,
  input: SaveIntegrationInput
): Promise<IntegrationDto> {
  assertCan(actor, { integration: ["update"] })
  return getDb().transaction(async (tx) => {
    const row = await findIntegrationRow(tx, key)
    if ((row?.version ?? 0) !== input.version) throw conflict(toDto(key, row))
    const previous = row ? openRow(key, row).values : null
    const parsed = INTEGRATIONS[key].schema.safeParse(
      mergeValues(key, input.values, previous)
    )
    if (!parsed.success)
      throw new AppError("VALIDATION_FAILED", "Check the highlighted fields", {
        fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
      })
    const next = parsed.data as Values
    const stored = sealValues(key, next)
    const saved = row
      ? await updateIntegrationIfVersion(tx, key, input.version, {
          draft: stored,
          updatedBy: actor.userId,
        })
      : await insertIntegrationRow(tx, {
          key,
          draft: stored,
          updatedBy: actor.userId,
        })
    if (!saved) throw conflict(toDto(key, await findIntegrationRow(tx, key)))
    await writeAudit(tx, actor, {
      action: row ? "integration.updated" : "integration.created",
      entityType: "integration",
      entityId: key,
      diff: { changed: changedFields(key, previous, next) },
    })
    return toDto(key, await findIntegrationRow(tx, key))
  })
}

/** "Disconnect": removes the row. R2 stays while it stores files (their URLs would break). */
export async function deleteIntegration(
  actor: Actor,
  key: IntegrationKey,
  version: number
): Promise<{ ok: true }> {
  assertCan(actor, { integration: ["update"] })
  await getDb().transaction(async (tx) => {
    const row = await findIntegrationRow(tx, key)
    if (!row) throw notFound("Integration settings")
    if (row.version !== version) throw conflict(toDto(key, row))
    if (key === "integrations.r2") {
      const stored = await countMediaByDriver(tx, "r2")
      if (stored > 0)
        throw new AppError(
          "CONFLICT",
          `${stored} uploaded file${stored === 1 ? " is" : "s are"} stored in R2. Delete ${stored === 1 ? "it" : "them"} from the media library first, or keep R2 connected.`
        )
    }
    if (!(await deleteIntegrationIfVersion(tx, key, version)))
      throw conflict(toDto(key, await findIntegrationRow(tx, key)))
    await writeAudit(tx, actor, {
      action: "integration.deleted",
      entityType: "integration",
      entityId: key,
    })
  })
  return { ok: true }
}

async function loadConfig<K extends IntegrationKey>(
  db: DbOrTx,
  key: K
): Promise<{ config: IntegrationConfig<K>; unreadable: string[] } | null> {
  const row = await findIntegrationRow(db, key)
  if (!row) return null
  const { values, unreadable } = openRow(key, row)
  if (unreadable.length > 0)
    return { config: values as IntegrationConfig<K>, unreadable }
  const parsed = INTEGRATIONS[key].schema.safeParse(values)
  if (!parsed.success)
    throw new AppError("INTERNAL", `Stored ${key} settings are invalid`)
  return { config: parsed.data as IntegrationConfig<K>, unreadable }
}

/**
 * Decrypted settings for server code (mailer, storage, Turnstile, AI).
 * null = not configured. Never send the result to a client or a log.
 */
export async function readIntegrationConfig<K extends IntegrationKey>(
  key: K,
  db: DbOrTx = getDb()
): Promise<IntegrationConfig<K> | null> {
  const loaded = await loadConfig(db, key)
  if (!loaded) return null
  if (loaded.unreadable.length > 0)
    throw new AppError(
      "INTERNAL",
      `${INTEGRATIONS[key].label}: saved secrets cannot be decrypted (was BETTER_AUTH_SECRET changed?)`
    )
  return loaded.config
}

/** "Test connection" with the saved settings. A failed test is a result (200), not an error. */
export async function testIntegration(
  actor: Actor,
  key: IntegrationKey
): Promise<IntegrationTestResult> {
  assertCan(actor, { integration: ["test"] })
  const db = getDb()
  const loaded = await loadConfig(db, key)
  if (!loaded)
    throw new AppError(
      "VALIDATION_FAILED",
      "Save these settings before testing them."
    )
  if (loaded.unreadable.length > 0)
    throw new AppError(
      "VALIDATION_FAILED",
      "Some saved secrets can no longer be read. Enter them again and save.",
      {
        fieldErrors: Object.fromEntries(
          loaded.unreadable.map((field) => [field, ["Enter this again and save"]])
        ),
      }
    )
  const result = await runIntegrationTest(key, loaded.config)
  await writeAudit(db, actor, {
    action: "integration.tested",
    entityType: "integration",
    entityId: key,
    diff: { ok: result.ok },
  })
  return { ...result, testedAt: new Date().toISOString() }
}
```

`server/modules/integrations/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import {
  integrationKeyParam,
  integrationVersionQuery,
  saveIntegrationInput,
} from "@/lib/schemas/api/integrations"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** Settings ▸ Integrations (spec §5.4, §7). Owner/admin through integration:*. */
export const integrationsRoutes = new Hono<AppEnv>()
  .get("/", can({ integration: ["read"] }), async (c) =>
    c.json(await service.listIntegrations(actorOf(c)), 200)
  )
  .get(
    "/:key",
    can({ integration: ["read"] }),
    zv("param", integrationKeyParam),
    async (c) =>
      c.json(
        await service.getIntegration(actorOf(c), c.req.valid("param").key),
        200
      )
  )
  .put(
    "/:key",
    can({ integration: ["update"] }),
    zv("param", integrationKeyParam),
    zv("json", saveIntegrationInput),
    async (c) =>
      c.json(
        await service.saveIntegration(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:key",
    can({ integration: ["update"] }),
    zv("param", integrationKeyParam),
    zv("query", integrationVersionQuery),
    async (c) =>
      c.json(
        await service.deleteIntegration(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("query").version
        ),
        200
      )
  )
  .post(
    "/:key/test",
    can({ integration: ["test"] }),
    zv("param", integrationKeyParam),
    async (c) =>
      c.json(
        await service.testIntegration(actorOf(c), c.req.valid("param").key),
        200
      )
  )
```

In `server/api/app.ts` add `import { integrationsRoutes } from "@/server/modules/integrations/routes"` (alphabetical among the module imports) and append `.route("/integrations", integrationsRoutes)` to the `adminRoutes` chain (after the last existing `.route(...)`).

In `server/modules/revisions/service.ts` (controller ruling: settings history only for editable content keys) add the import `import { isEditableSettingsKey } from "@/lib/admin/settings-keys"` and `notFound` is already imported; replace `assertCanRead` with:

```ts
/**
 * Settings history is limited to the content keys edited in Settings
 * (lib/admin/settings-keys.ts): other settings rows (integrations, and the
 * Phase 8 marketing/SEO keys until that phase extends this list) are never
 * served here, whatever their revision rows contain.
 */
function assertCanRead(actor: Actor, entity: RevisionEntity, entityId: string) {
  if (!hasPermission(actor.roles, READ[entity])) throw forbidden()
  if (entity === "settings" && !isEditableSettingsKey(entityId))
    throw notFound("Revision")
}
```

and pass `entityId` in both callers: `assertCanRead(actor, entity, entityId)` in `listRevisions` and `getRevision`. Run `pnpm test:integration tests/integration/api/settings.test.ts` afterwards too (Phase 4 settings history for editable keys must still pass).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/integrations tests/unit/server-only-guard.test.ts tests/unit/lint-boundaries.test.ts`
Expected: PASS (schemas 7, testers 8, plus the guards for the new `server/` files).

Run (Postgres + Mailpit up: `pnpm db:up`): `pnpm test:integration tests/integration/api/integrations.test.ts`
Expected: PASS (18 tests). The SMTP success test needs Mailpit on `127.0.0.1:1025`.

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write lib/schemas/integrations lib/schemas/api/integrations.ts server/lib/r2-client.ts server/lib/settings-store.ts server/modules/integrations server/modules/media/repo.ts server/modules/revisions/service.ts server/api/app.ts tests/unit/integrations tests/integration/api/integrations.test.ts
git add package.json pnpm-lock.yaml lib/schemas/integrations lib/schemas/api/integrations.ts server/lib/r2-client.ts server/lib/settings-store.ts server/modules/integrations server/modules/media/repo.ts server/modules/revisions/service.ts server/api/app.ts tests/unit/integrations tests/integration/api/integrations.test.ts
git commit -m "feat: add integrations module with encrypted write-only secrets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Settings ▸ Integrations screens (master Task 7.1, part 2)

**Files:**
- Create: `components/admin/integrations/{integration-meta.ts,integrations-overview.tsx,integration-form.tsx}`, `app/(admin)/admin/(panel)/settings/integrations/page.tsx`, `app/(admin)/admin/(panel)/settings/integrations/[slug]/page.tsx`
- Modify: `components/admin/settings/settings-overview.tsx` (Integrations card), `server/modules/dashboard/service.ts` (Next-up SMTP/R2 `href`s) and the dashboard test that asserts those hrefs (if any)
- Test: `tests/dom/integration-form.test.tsx`, `tests/e2e/integrations.spec.ts`

**Interfaces:**
- Consumes: Task 1 HTTP API + `IntegrationDto`, `IntegrationTestResult`, `INTEGRATIONS`, `integrationKeyFromSlug`, `AI_ROLES`, `AI_PROVIDERS`, `R2_JURISDICTIONS`; Phase 4 `api`/`unwrap`/`ApiError`/`errorMessage`, `PageHeader`, `usePermission`, `requirePermission`, `formatDateTime`, shadcn `Button`, `Input`, `Label`, `Switch`, `Badge`, `Skeleton`, `AlertDialog*`, `sonner` `toast`.
- Produces:

```ts
// components/admin/integrations/integration-meta.ts
export type FieldMeta =
  | { name: string; kind: "text"; label: string; help?: string; placeholder?: string; type?: "text" | "email"; autoComplete?: string }
  | { name: string; kind: "number"; label: string; help?: string; min: number; max: number }
  | { name: string; kind: "toggle"; label: string; help?: string }
  | { name: string; kind: "select"; label: string; help?: string; options: readonly { value: string; label: string }[] }
  | { name: string; kind: "secret"; label: string; help?: string }
  | { name: string; kind: "roles"; label: string; help?: string; roles: readonly Role[] }
export type IntegrationFormMeta = { intro: string; fields: readonly FieldMeta[] }
export const INTEGRATION_FORMS: Record<IntegrationKey, IntegrationFormMeta>
export const ROLE_NAMES: Record<Role, string>
// components/admin/integrations/integrations-overview.tsx
export function IntegrationsOverview(): JSX.Element
// components/admin/integrations/integration-form.tsx
export function IntegrationForm(props: { integrationKey: IntegrationKey; children?: ReactNode }): JSX.Element   // children rendered under the form (Task 8: R2 migration panel)
// Routes
/admin/settings/integrations           requirePermission({ integration: ["read"] })
/admin/settings/integrations/[slug]    slug ∈ smtp | r2 | turnstile | ai (else notFound())
```

UI decisions (fixed): one generic form per integration, fields from `INTEGRATION_FORMS`; secrets render as an empty password input (`autoComplete="new-password"`) with the line "Saved: ••••abcd" under it (or "Saved, but it can no longer be read — enter it again." when `hint` is null and `set` is true); leaving it empty keeps the saved value. Buttons: **Save** (disabled while saving or when nothing changed), **Test connection** (only when saved, nothing unsaved, `integration:test`), **Disconnect** (when saved, `integration:update`, confirms in an `AlertDialog`). Test results show in a `role="status"` line (ok) or `role="alert"` (failed). Field errors from 422 show under their field; 409 shows "Someone else changed these settings." with **Reload**. Without `integration:update` the inputs are disabled.

Field table (labels are the accessible names used by the tests):

| Integration | name | kind | label | help / options |
|---|---|---|---|---|
| smtp | host | text | SMTP server | placeholder `smtp.example.ie` |
| smtp | port | number (1–65535) | Port | "587 (STARTTLS) or 465 (TLS)." |
| smtp | secure | toggle | Use TLS from the start | "On for port 465. Off for 587 or 25: the connection is upgraded with STARTTLS when the server offers it." |
| smtp | user | text | User name | "Leave empty if the server needs no sign-in." `autoComplete="off"` |
| smtp | password | secret | Password | — |
| smtp | fromName | text | Sender name | — |
| smtp | fromAddress | text (`type="email"`) | Sender address | "Messages are sent from this address." |
| r2 | accountId | text | Account ID | "Cloudflare dashboard › R2 › Account details." |
| r2 | jurisdiction | select | Location | `default` "Default", `eu` "European Union (EU jurisdiction bucket)" |
| r2 | bucket | text | Bucket name | — |
| r2 | accessKeyId | secret | Access key ID | "From an R2 API token with Object Read & Write on this bucket." |
| r2 | secretAccessKey | secret | Secret access key | — |
| turnstile | enabled | toggle | Protect the contact form | — |
| turnstile | siteKey | text | Site key | "Public key shown in the Turnstile widget settings." |
| turnstile | secretKey | secret | Secret key | — |
| ai | enabled | toggle | Turn on the assistant | — |
| ai | provider | select | Provider | `anthropic` "Anthropic (Claude)", `openai` "OpenAI" |
| ai | model | text | Model ID | placeholder `claude-sonnet-4-5` |
| ai | apiKey | secret | API key | — |
| ai | allowedRoles | roles (`AI_ROLES`) | Who can use it | "Only these roles see the assistant." |

Intros: smtp "Used for invitations, password resets and enquiry emails. Until it is set up, the admin shows links to copy instead."; r2 "New uploads go to this bucket once it is saved. Files already on the server disk can be moved below."; turnstile "Adds Cloudflare's invisible check to the contact form when it is on."; ai "Gives the roles you choose a writing assistant in the admin. Off until you turn it on."

- [ ] **Step 1: Write the failing tests**

`tests/dom/integration-form.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props} />
  ),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { IntegrationForm } from "@/components/admin/integrations/integration-form"
import { makeQueryClient } from "@/components/admin/providers"
import {
  type AdminSession,
  AdminSessionProvider,
} from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { IntegrationDto } from "@/lib/schemas/api/integrations"

const saved: IntegrationDto = {
  key: "integrations.smtp",
  slug: "smtp",
  label: "Email (SMTP)",
  description: "Sends invitations.",
  configured: true,
  version: 3,
  values: {
    host: "smtp.example.ie",
    port: 587,
    secure: false,
    user: "mailer@example.ie",
    fromName: "Security Partners",
    fromAddress: "no-reply@example.ie",
  },
  secrets: { password: { set: true, hint: "••••1234" } },
  updatedAt: "2026-10-16T10:00:00.000Z",
  updatedBy: { id: "u1", name: "Olive Owner" },
}

type Call = { url: string; method: string; body: unknown }
let calls: Call[]
let respond: (call: Call) => Response

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

beforeEach(() => {
  calls = []
  respond = () => json(saved)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = {
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }
      calls.push(call)
      return respond(call)
    })
  )
})

function renderForm(roles: Role[] = ["owner"]) {
  const session: AdminSession = {
    user: {
      id: "u1",
      name: "Olive Owner",
      email: "o@example.test",
      title: null,
      twoFactorEnabled: true,
    },
    roles,
    impersonatedBy: null,
  }
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider value={session}>
        <IntegrationForm integrationKey="integrations.smtp" />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
}

describe("IntegrationForm (master 7.1)", () => {
  it("shows saved values and the secret hint, never a secret value", async () => {
    renderForm()
    expect(await screen.findByLabelText("SMTP server")).toHaveValue(
      "smtp.example.ie"
    )
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(screen.getByText("Saved: ••••1234")).toBeVisible()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).toBeEnabled()
  })

  it("an empty secret is not sent; a typed one is", async () => {
    const user = userEvent.setup()
    renderForm()
    const host = await screen.findByLabelText("SMTP server")
    await user.clear(host)
    await user.type(host, "smtp2.example.ie")
    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PUT")).toBe(true)
    )
    const put = calls.find((c) => c.method === "PUT")!
    expect(put.url).toContain("/integrations/integrations.smtp")
    expect(put.body).toEqual({
      version: 3,
      values: { ...saved.values, host: "smtp2.example.ie" },
    })

    calls = []
    await user.type(screen.getByLabelText("Password"), "new-secret-9999")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PUT")).toBe(true)
    )
    expect(
      (calls.find((c) => c.method === "PUT")!.body as { values: object })
        .values
    ).toMatchObject({ password: "new-secret-9999" })
  })

  it("shows 422 field errors under their fields", async () => {
    const user = userEvent.setup()
    respond = (call) =>
      call.method === "PUT"
        ? json(
            {
              error: {
                code: "VALIDATION_FAILED",
                message: "Check the highlighted fields",
                fieldErrors: { port: ["Between 1 and 65535"] },
                requestId: "r",
              },
            },
            422
          )
        : json(saved)
    renderForm()
    const port = await screen.findByLabelText("Port")
    await user.clear(port)
    await user.type(port, "0")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Between 1 and 65535")).toBeVisible()
    expect(port).toHaveAttribute("aria-invalid", "true")
  })

  it("Test connection shows the result", async () => {
    const user = userEvent.setup()
    respond = (call) =>
      call.url.endsWith("/test")
        ? json({
            ok: false,
            message: "Could not connect to smtp.example.ie:587 (ECONNREFUSED)",
            testedAt: "2026-10-16T10:00:00.000Z",
          })
        : json(saved)
    renderForm()
    await user.click(
      await screen.findByRole("button", { name: "Test connection" })
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not connect to smtp.example.ie:587"
    )
  })

  it("read-only without integration:update", async () => {
    renderForm(["viewer"])
    expect(await screen.findByLabelText("SMTP server")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull()
  })
})
```

`tests/e2e/integrations.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"

import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Master 7.1: SMTP credentials saved through Settings ▸ Integrations come
// back masked, and "Test connection" reaches the dev Mailpit
// (docker-compose.dev.yml, 127.0.0.1:1025). Disconnects at the end so later
// specs still run without SMTP.

const PASSWORD = "smtp-secret-1234"

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

test("save SMTP credentials (masked) and test them against Mailpit", async ({
  page,
}) => {
  const { owner } = readFixtures()
  await signIn(page, owner.email)
  await page.goto("/admin/settings")
  await page.getByRole("link", { name: /Integrations/ }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Integrations" })
  ).toBeVisible()
  await page.getByRole("link", { name: /Email \(SMTP\)/ }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Email (SMTP)" })
  ).toBeVisible()

  await page.getByLabel("SMTP server").fill("127.0.0.1")
  await page.getByLabel("Port").fill("1025")
  await page.getByLabel("User name").fill("mailer@e2e.test")
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByLabel("Sender name").fill("Security Partners")
  await page.getByLabel("Sender address").fill("no-reply@e2e.test")
  await page.getByRole("button", { name: "Save" }).click()

  await expect(page.getByText("Saved: ••••1234")).toBeVisible()
  await expect(page.getByLabel("Password")).toHaveValue("")
  const api = await page.request.get(
    "/api/v1/admin/integrations/integrations.smtp"
  )
  const body = await api.text()
  expect(body).not.toContain(PASSWORD)
  expect(JSON.parse(body).secrets.password).toEqual({
    set: true,
    hint: "••••1234",
  })

  await page.getByRole("button", { name: "Test connection" }).click()
  await expect(page.getByRole("status")).toContainText(
    "Connected to 127.0.0.1:1025 and signed in as mailer@e2e.test."
  )

  await page.getByRole("button", { name: "Disconnect" }).click()
  const dialog = page.getByRole("alertdialog", {
    name: "Disconnect Email (SMTP)?",
  })
  await dialog.getByRole("button", { name: "Disconnect" }).click()
  await expect(page.getByText("Not set up")).toBeVisible()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/integration-form.test.tsx`
Expected: FAIL — `Cannot find module '@/components/admin/integrations/integration-form'`.

- [ ] **Step 3: Implement the screens**

`components/admin/integrations/integration-meta.ts`:

```ts
import type { Role } from "@/lib/auth/roles"
import {
  AI_ROLES,
  type IntegrationKey,
} from "@/lib/schemas/integrations"

export type FieldMeta =
  | {
      name: string
      kind: "text"
      label: string
      help?: string
      placeholder?: string
      type?: "text" | "email"
      autoComplete?: string
    }
  | {
      name: string
      kind: "number"
      label: string
      help?: string
      min: number
      max: number
    }
  | { name: string; kind: "toggle"; label: string; help?: string }
  | {
      name: string
      kind: "select"
      label: string
      help?: string
      options: readonly { value: string; label: string }[]
    }
  | { name: string; kind: "secret"; label: string; help?: string }
  | {
      name: string
      kind: "roles"
      label: string
      help?: string
      roles: readonly Role[]
    }

export type IntegrationFormMeta = { intro: string; fields: readonly FieldMeta[] }

export const ROLE_NAMES: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  editor: "Editor",
  author: "Author",
  marketer: "Marketer",
  intake: "Intake",
  viewer: "Viewer",
}

/** Settings ▸ Integrations forms (fields of lib/schemas/integrations, in order). */
export const INTEGRATION_FORMS: Record<IntegrationKey, IntegrationFormMeta> = {
  "integrations.smtp": {
    intro:
      "Used for invitations, password resets and enquiry emails. Until it is set up, the admin shows links to copy instead.",
    fields: [
      { name: "host", kind: "text", label: "SMTP server", placeholder: "smtp.example.ie" },
      { name: "port", kind: "number", label: "Port", help: "587 (STARTTLS) or 465 (TLS).", min: 1, max: 65535 },
      {
        name: "secure",
        kind: "toggle",
        label: "Use TLS from the start",
        help: "On for port 465. Off for 587 or 25: the connection is upgraded with STARTTLS when the server offers it.",
      },
      {
        name: "user",
        kind: "text",
        label: "User name",
        help: "Leave empty if the server needs no sign-in.",
        autoComplete: "off",
      },
      { name: "password", kind: "secret", label: "Password" },
      { name: "fromName", kind: "text", label: "Sender name" },
      {
        name: "fromAddress",
        kind: "text",
        type: "email",
        label: "Sender address",
        help: "Messages are sent from this address.",
      },
    ],
  },
  "integrations.r2": {
    intro:
      "New uploads go to this bucket once it is saved. Files already on the server disk can be moved below.",
    fields: [
      {
        name: "accountId",
        kind: "text",
        label: "Account ID",
        help: "Cloudflare dashboard › R2 › Account details.",
      },
      {
        name: "jurisdiction",
        kind: "select",
        label: "Location",
        options: [
          { value: "default", label: "Default" },
          { value: "eu", label: "European Union (EU jurisdiction bucket)" },
        ],
      },
      { name: "bucket", kind: "text", label: "Bucket name" },
      {
        name: "accessKeyId",
        kind: "secret",
        label: "Access key ID",
        help: "From an R2 API token with Object Read & Write on this bucket.",
      },
      { name: "secretAccessKey", kind: "secret", label: "Secret access key" },
    ],
  },
  "integrations.turnstile": {
    intro:
      "Adds Cloudflare's invisible check to the contact form when it is on.",
    fields: [
      { name: "enabled", kind: "toggle", label: "Protect the contact form" },
      {
        name: "siteKey",
        kind: "text",
        label: "Site key",
        help: "Public key shown in the Turnstile widget settings.",
      },
      { name: "secretKey", kind: "secret", label: "Secret key" },
    ],
  },
  "integrations.ai": {
    intro:
      "Gives the roles you choose a writing assistant in the admin. Off until you turn it on.",
    fields: [
      { name: "enabled", kind: "toggle", label: "Turn on the assistant" },
      {
        name: "provider",
        kind: "select",
        label: "Provider",
        options: [
          { value: "anthropic", label: "Anthropic (Claude)" },
          { value: "openai", label: "OpenAI" },
        ],
      },
      { name: "model", kind: "text", label: "Model ID", placeholder: "claude-sonnet-4-5" },
      { name: "apiKey", kind: "secret", label: "API key" },
      {
        name: "allowedRoles",
        kind: "roles",
        label: "Who can use it",
        help: "Only these roles see the assistant.",
        roles: AI_ROLES,
      },
    ],
  },
}
```

`components/admin/integrations/integrations-overview.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"

/** The four integrations of spec §5.4 with their state. */
export function IntegrationsOverview() {
  const list = useQuery({
    queryKey: ["integrations", "list"],
    queryFn: () => unwrap(api.integrations.$get()),
  })
  if (list.isPending)
    return (
      <div
        className="grid gap-3 sm:grid-cols-2"
        aria-busy="true"
        aria-label="Loading integrations"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  if (list.isError)
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-sm">{errorMessage(list.error)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => list.refetch()}>
          Try again
        </Button>
      </div>
    )
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.data.items.map((item) => (
        <li key={item.key}>
          <Link
            href={`/admin/settings/integrations/${item.slug}`}
            className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{item.label}</span>
              <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
            </span>
            <span className="text-sm text-muted-foreground">{item.description}</span>
            <span className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Badge variant={item.configured ? "default" : "outline"}>
                {item.configured ? "Set up" : "Not set up"}
              </Badge>
              {item.updatedAt ? (
                <span>
                  Changed {formatDateTime(item.updatedAt)}
                  {item.updatedBy ? ` by ${item.updatedBy.name}` : ""}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

`components/admin/integrations/integration-form.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, CircleAlert } from "lucide-react"
import { type FormEvent, type ReactNode, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { Role } from "@/lib/auth/roles"
import type { IntegrationDto } from "@/lib/schemas/api/integrations"
import type { IntegrationKey } from "@/lib/schemas/integrations"

import { type FieldMeta, INTEGRATION_FORMS, ROLE_NAMES } from "./integration-meta"

type Values = Record<string, unknown>

const fieldId = (key: IntegrationKey, name: string) =>
  `${key.replace(".", "-")}-${name}`

/**
 * One integration's settings (spec §5.4): saves immediately, secrets are
 * write-only (empty = keep), "Test connection" uses the saved settings.
 */
export function IntegrationForm({
  integrationKey: key,
  children,
}: {
  integrationKey: IntegrationKey
  children?: ReactNode
}) {
  const queryClient = useQueryClient()
  const canEdit = usePermission({ integration: ["update"] })
  const canTest = usePermission({ integration: ["test"] })
  const meta = INTEGRATION_FORMS[key]
  const query = useQuery({
    queryKey: ["integrations", key],
    queryFn: () => unwrap(api.integrations[":key"].$get({ param: { key } })),
  })
  const dto = query.data

  const [loaded, setLoaded] = useState<number | null>(null)
  const [values, setValues] = useState<Values>({})
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [conflicted, setConflicted] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  // A new server version (load, save, reload, disconnect) resets the form.
  if (dto && dto.version !== loaded) {
    setLoaded(dto.version)
    setValues(dto.values)
    setSecrets({})
    setErrors({})
    setConflicted(false)
  }

  const typedSecrets = Object.fromEntries(
    Object.entries(secrets).filter(([, v]) => v.trim() !== "")
  )
  const dirty =
    !!dto &&
    (JSON.stringify(values) !== JSON.stringify(dto.values) ||
      Object.keys(typedSecrets).length > 0)

  const accept = (next: IntegrationDto) => {
    queryClient.setQueryData(["integrations", key], next)
    void queryClient.invalidateQueries({ queryKey: ["integrations", "list"] })
  }

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.integrations[":key"].$put({
          param: { key },
          json: { version: dto!.version, values: { ...values, ...typedSecrets } },
        })
      ),
    onSuccess: (next) => {
      accept(next)
      test.reset()
      toast.success("Saved.")
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isConflict) setConflicted(true)
      else if (err instanceof ApiError) setErrors(err.fieldErrors)
    },
  })

  const test = useMutation({
    mutationFn: () =>
      unwrap(api.integrations[":key"].test.$post({ param: { key } })),
  })

  const disconnect = useMutation({
    mutationFn: () =>
      unwrap(
        api.integrations[":key"].$delete({
          param: { key },
          query: { version: String(dto!.version) },
        })
      ),
    onSuccess: async () => {
      setConfirmDisconnect(false)
      test.reset()
      await queryClient.invalidateQueries({ queryKey: ["integrations"] })
      toast.success("Disconnected.")
    },
    onError: (err) => {
      setConfirmDisconnect(false)
      toast.error(errorMessage(err))
    },
  })

  if (query.isPending)
    return (
      <div className="flex max-w-xl flex-col gap-4" aria-busy="true" aria-label="Loading settings">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  if (query.isError || !dto)
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-sm">{errorMessage(query.error)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setErrors({})
    save.mutate()
  }

  const set = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }))

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={dto.configured ? "default" : "outline"}>
          {dto.configured ? "Set up" : "Not set up"}
        </Badge>
        <span>{meta.intro}</span>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {meta.fields.map((field) => (
          <Field
            key={field.name}
            id={fieldId(key, field.name)}
            field={field}
            value={values[field.name]}
            secret={secrets[field.name] ?? ""}
            secretState={dto.secrets[field.name]}
            error={errors[field.name]?.[0]}
            disabled={!canEdit || save.isPending}
            onChange={(value) => set(field.name, value)}
            onSecretChange={(value) =>
              setSecrets((prev) => ({ ...prev, [field.name]: value }))
            }
          />
        ))}

        {conflicted ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-3 text-sm">
            Someone else changed these settings.
            <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
              Reload
            </Button>
          </div>
        ) : save.isError && !(save.error instanceof ApiError && Object.keys(save.error.fieldErrors).length > 0) ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(save.error)}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button type="submit" disabled={!dirty || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          ) : null}
          {canTest && dto.configured ? (
            <Button
              type="button"
              variant="outline"
              disabled={dirty || test.isPending}
              onClick={() => test.mutate()}
            >
              {test.isPending ? "Testing…" : "Test connection"}
            </Button>
          ) : null}
          {canEdit && dto.configured ? (
            <Button
              type="button"
              variant="destructive"
              className="ml-auto"
              onClick={() => setConfirmDisconnect(true)}
            >
              Disconnect
            </Button>
          ) : null}
        </div>
        {dirty && dto.configured && canTest ? (
          <p className="text-xs text-muted-foreground">
            Save your changes to test them.
          </p>
        ) : null}
      </form>

      {test.data ? (
        test.data.ok ? (
          <p role="status" className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
            {test.data.message}
          </p>
        ) : (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {test.data.message}
          </p>
        )
      ) : test.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(test.error)}
        </p>
      ) : null}

      {children}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {dto.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved settings, including secrets, are deleted. You can set
              it up again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Field({
  id,
  field,
  value,
  secret,
  secretState,
  error,
  disabled,
  onChange,
  onSecretChange,
}: {
  id: string
  field: FieldMeta
  value: unknown
  secret: string
  secretState: { set: boolean; hint: string | null } | undefined
  error: string | undefined
  disabled: boolean
  onChange: (value: unknown) => void
  onSecretChange: (value: string) => void
}) {
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy =
    [field.help || field.kind === "secret" ? helpId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined
  const invalid = error ? true : undefined

  let control: ReactNode
  if (field.kind === "toggle") {
    control = (
      <Switch
        id={id}
        checked={value === true}
        disabled={disabled}
        aria-describedby={describedBy}
        onCheckedChange={(checked) => onChange(checked)}
      />
    )
  } else if (field.kind === "select") {
    control = (
      <select
        id={id}
        value={String(value ?? "")}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive"
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  } else if (field.kind === "roles") {
    const selected = Array.isArray(value) ? (value as Role[]) : []
    return (
      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy}>
        <legend className="text-sm font-medium">{field.label}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {field.roles.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.includes(role)}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? field.roles.filter((r) => r === role || selected.includes(r))
                      : selected.filter((r) => r !== role)
                  )
                }
              />
              {ROLE_NAMES[role]}
            </label>
          ))}
        </div>
        {field.help ? <p id={helpId} className="text-xs text-muted-foreground">{field.help}</p> : null}
        {error ? <p id={errorId} className="text-xs text-destructive">{error}</p> : null}
      </fieldset>
    )
  } else if (field.kind === "secret") {
    control = (
      <Input
        id={id}
        type="password"
        autoComplete="new-password"
        value={secret}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder={secretState?.set ? "Leave empty to keep the saved value" : undefined}
        onChange={(e) => onSecretChange(e.target.value)}
      />
    )
  } else if (field.kind === "number") {
    control = (
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={field.min}
        max={field.max}
        value={typeof value === "number" && Number.isFinite(value) ? value : ""}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="w-32"
      />
    )
  } else {
    control = (
      <Input
        id={id}
        type={field.type ?? "text"}
        autoComplete={field.autoComplete}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  const secretLine =
    field.kind === "secret"
      ? secretState?.set
        ? secretState.hint
          ? `Saved: ${secretState.hint}`
          : "Saved, but it can no longer be read — enter it again."
        : "Not saved yet."
      : null

  return (
    <div className={field.kind === "toggle" ? "flex items-start justify-between gap-4" : "flex flex-col gap-1.5"}>
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{field.label}</Label>
        {field.kind === "toggle" && field.help ? (
          <p id={helpId} className="text-xs text-muted-foreground">{field.help}</p>
        ) : null}
      </div>
      {control}
      {field.kind !== "toggle" && (field.help || secretLine) ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {[secretLine, field.help].filter(Boolean).join(" ")}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

Note: the "Saved: ••••1234" line is its own text node (`[secretLine, help].join(" ")` — for the secret fields in the table there is no `help` except R2 `accessKeyId`, so `getByText("Saved: ••••1234")` matches the SMTP line exactly). If the shadcn `AlertDialogAction` in the real code does not accept `variant`, pass `className={buttonVariants({ variant: "destructive" })}` instead.

`app/(admin)/admin/(panel)/settings/integrations/page.tsx`:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { IntegrationsOverview } from "@/components/admin/integrations/integrations-overview"
import { PageHeader } from "@/components/admin/page-header"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Integrations" }

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <Integrations />
    </Suspense>
  )
}

async function Integrations() {
  await requirePermission({ integration: ["read"] })
  return (
    <>
      <Link href="/admin/settings" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Settings
      </Link>
      <PageHeader
        title="Integrations"
        description="Connections to outside services. Secrets are stored encrypted and are never shown again after saving."
      />
      <IntegrationsOverview />
    </>
  )
}
```

`app/(admin)/admin/(panel)/settings/integrations/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { IntegrationForm } from "@/components/admin/integrations/integration-form"
import { PageHeader } from "@/components/admin/page-header"
import {
  INTEGRATIONS,
  integrationKeyFromSlug,
} from "@/lib/schemas/integrations"
import { requirePermission } from "@/server/auth/session"

export async function generateMetadata({
  params,
}: PageProps<"/admin/settings/integrations/[slug]">): Promise<Metadata> {
  const key = integrationKeyFromSlug((await params).slug)
  return { title: key ? INTEGRATIONS[key].label : "Integrations" }
}

export default function IntegrationPage({
  params,
}: PageProps<"/admin/settings/integrations/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Integration params={params} />
    </Suspense>
  )
}

async function Integration({
  params,
}: Pick<PageProps<"/admin/settings/integrations/[slug]">, "params">) {
  const key = integrationKeyFromSlug((await params).slug)
  if (!key) notFound()
  await requirePermission({ integration: ["read"] })
  return (
    <>
      <Link href="/admin/settings/integrations" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Integrations
      </Link>
      <PageHeader title={INTEGRATIONS[key].label} description={INTEGRATIONS[key].description} />
      <IntegrationForm integrationKey={key} />
    </>
  )
}
```

In `components/admin/settings/settings-overview.tsx` (Phase 4 Task 8): add `import { usePermission } from "@/hooks/use-permission"`, call `const canIntegrations = usePermission({ integration: ["read"] })` at the top of `SettingsOverview` (before the early returns — hooks order), drop "(Integrations arrive in Phase 7)" from its doc comment, and add as the **last child** of the returned `<div className="flex flex-col gap-8">`:

```tsx
      {canIntegrations ? (
        <section aria-labelledby="settings-integrations" className="flex flex-col gap-3">
          <h2
            id="settings-integrations"
            className="text-sm font-bold tracking-wide text-muted-foreground uppercase"
          >
            Integrations
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <li>
              <Link
                href="/admin/settings/integrations"
                className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Integrations</span>
                  <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                </span>
                <span className="text-sm text-muted-foreground">
                  Email (SMTP), media storage (R2), spam protection and the AI assistant.
                </span>
              </Link>
            </li>
          </ul>
        </section>
      ) : null}
```

(If `tests/dom/settings-editor.test.tsx` or another DOM test renders `SettingsOverview` without an `AdminSessionProvider`, wrap it in one with an `editor` session there.)

In `server/modules/dashboard/service.ts` set the `smtp` item `href: "/admin/settings/integrations/smtp"` and the `r2` item `href: "/admin/settings/integrations/r2"`; update any dashboard test/E2E assertion that expects `/admin/settings` for these two items (`grep -rn '"/admin/settings"' tests`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec next typegen && pnpm exec vitest run --project dom tests/dom/integration-form.test.tsx`
Expected: PASS (5 tests).

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: exit 0.

Run (port 3100 free, Mailpit up, no other Playwright/build): `pnpm exec playwright test tests/e2e/integrations.spec.ts`
Expected: PASS — hint "Saved: ••••1234", the API body never contains the password, the status line reads "Connected to 127.0.0.1:1025 and signed in as mailer@e2e.test.", then "Not set up" after Disconnect.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/integrations "app/(admin)/admin/(panel)/settings/integrations" components/admin/settings/settings-overview.tsx server/modules/dashboard/service.ts tests/dom/integration-form.test.tsx tests/e2e/integrations.spec.ts
git add components/admin/integrations "app/(admin)/admin/(panel)/settings/integrations" components/admin/settings/settings-overview.tsx server/modules/dashboard/service.ts tests/dom/integration-form.test.tsx tests/e2e/integrations.spec.ts
git commit -m "feat: add integrations settings screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Also `git add` any dashboard/settings test you had to adjust.)

---

### Task 3: Storage drivers and same-origin media URLs (master Task 6.1)

**Files:**
- Create: `server/lib/storage/{types,paths,disk,r2,static,index}.ts`
- Modify: `server/modules/media/queries.ts` (`mediaUrl` moves to storage; `getMedia` uses it), `server/modules/media/service.ts` (import `mediaUrl` from storage), `server/db/seed/media.ts` (path containment via `staticFilePath`)
- Test: `tests/unit/storage/paths.test.ts`, `tests/unit/storage/disk.test.ts`, `tests/unit/storage/r2.test.ts`, `tests/unit/seed/static-media.test.ts` (add containment cases), `tests/integration/storage/get-storage.test.ts`

**Interfaces:**
- Consumes: Task 1 `readIntegrationConfig`, `createR2Client`, `R2Config`; Phase 3 `MEDIA_DRIVERS`, `readStaticMedia`; libraries notes §5.5 (Put/Get/Delete/HeadBucket, NoSuchKey).
- Produces:

```ts
// server/lib/storage/types.ts
export type StorageName = "disk" | "r2"
export type StorageDriver = {
  name: StorageName
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  read(key: string): Promise<Uint8Array | null>          // null = no such object
  delete(key: string): Promise<void>                       // missing object is not an error
  url(key: string): string                                 // same-origin /api/v1/media/file/<key>
  test(): Promise<void>                                    // throws when unusable
}
// server/lib/storage/paths.ts
export const MEDIA_FILE_PATH = "/api/v1/media/file/"
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
export function isValidKey(key: string): boolean           // 1–8 segments of [A-Za-z0-9][A-Za-z0-9._-]{0,127}, no ".."
export function keySegments(key: string): string[]         // throws on an invalid key
export function resolveInside(root: string, key: string): string   // absolute path, throws if it escapes root
export function encodeKeyPath(key: string): string         // encodeURIComponent per segment ("/" kept)
export function decodeKeyPath(path: string): string | null // per-segment decode; null if invalid
export function mediaFileUrl(key: string): string          // MEDIA_FILE_PATH + encodeKeyPath(key)
export function mediaUrl(row: { driver: "static" | "disk" | "r2"; key: string }): string  // static → key, else mediaFileUrl
// server/lib/storage/disk.ts
export function defaultUploadsRoot(): string                // "/data/uploads" if /data exists, else <cwd>/.data/uploads
export function diskStorage(root?: string): StorageDriver
// server/lib/storage/r2.ts
export function r2Storage(config: R2Config, client?: S3Client): StorageDriver
// server/lib/storage/static.ts
export const STATIC_PREFIX = "/images/"
export function staticFilePath(key: string, publicDir?: string): string   // contained in public/, key must start /images/
// server/lib/storage/index.ts (re-exports the above, plus)
export async function getStorage(db?: DbOrTx): Promise<StorageDriver>                  // r2 when integrations.r2 saved, else disk (Review Focus 3)
export async function storageFor(driver: "static" | "disk" | "r2", db?: DbOrTx): Promise<StorageDriver | null>  // driver holding an existing row's file
```

Rules: keys of uploaded files are `YYYY/MM/<uuid v7>.<ext>` (Task 4); every driver call validates the key (`keySegments`) so a key read from the DB or a URL can never leave the uploads root / bucket prefix. Disk writes go to a temp file then `rename` (no half-written file is ever served). R2 objects get `CacheControl: IMMUTABLE_CACHE` and `ContentType`. `mediaUrl` never `encodeURIComponent`s the whole key (ledger ruling: per-segment encoding keeps `/`).

- [ ] **Step 1: Write the failing tests**

`tests/unit/storage/paths.test.ts`:

```ts
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  decodeKeyPath,
  encodeKeyPath,
  isValidKey,
  keySegments,
  mediaFileUrl,
  mediaUrl,
  resolveInside,
} from "@/server/lib/storage/paths"

const KEY = "2026/10/0190a6e0-0000-7000-8000-000000000001.png"

describe("media keys (ledger: containment + per-segment encoding)", () => {
  it("accepts upload keys and rejects anything that could escape", () => {
    expect(isValidKey(KEY)).toBe(true)
    expect(keySegments(KEY)).toEqual(["2026", "10", KEY.split("/")[2]])
    for (const bad of [
      "",
      "../etc/passwd",
      "2026/../../x",
      "/abs/x.png",
      "a//b.png",
      "a/.hidden",
      "a\\b.png",
      "a/b c.png",
      "a/%2e%2e/x",
      "a..b/x",
      "1/2/3/4/5/6/7/8/9",
    ])
      expect(isValidKey(bad), bad).toBe(false)
    expect(() => keySegments("../x")).toThrow(/Invalid media key/)
  })

  it("resolves inside the root only", () => {
    const root = resolve("/tmp/sp-uploads")
    expect(resolveInside(root, KEY)).toBe(`${root}/${KEY}`)
    expect(() => resolveInside(root, "../outside.png")).toThrow()
  })

  it("encodes per segment, keeping slashes", () => {
    expect(encodeKeyPath(KEY)).toBe(KEY)
    expect(encodeKeyPath("a/b")).not.toContain("%2F")
    expect(decodeKeyPath(KEY)).toBe(KEY)
    expect(decodeKeyPath("..%2Fetc/passwd")).toBeNull()
    expect(decodeKeyPath("%E0%A4%A")).toBeNull()
  })

  it("serves disk and R2 rows from our own origin; static rows keep their path", () => {
    expect(mediaFileUrl(KEY)).toBe(`/api/v1/media/file/${KEY}`)
    expect(mediaUrl({ driver: "disk", key: KEY })).toBe(
      `/api/v1/media/file/${KEY}`
    )
    expect(mediaUrl({ driver: "r2", key: KEY })).toBe(
      `/api/v1/media/file/${KEY}`
    )
    expect(mediaUrl({ driver: "static", key: "/images/hero.jpg" })).toBe(
      "/images/hero.jpg"
    )
  })
})
```

`tests/unit/storage/disk.test.ts`:

```ts
import { existsSync } from "node:fs"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { defaultUploadsRoot, diskStorage } from "@/server/lib/storage/disk"

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "sp-disk-"))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe("diskStorage", () => {
  const key = "2026/10/0190a6e0-0000-7000-8000-000000000001.png"

  it("writes, reads and deletes under the root", async () => {
    const disk = diskStorage(root)
    expect(disk.name).toBe("disk")
    await disk.put(key, new Uint8Array([1, 2, 3]), "image/png")
    expect(existsSync(join(root, key))).toBe(true)
    expect(await readdir(join(root, "2026/10"))).toEqual([key.split("/")[2]])
    expect([...((await disk.read(key)) ?? [])]).toEqual([1, 2, 3])
    await disk.delete(key)
    expect(await disk.read(key)).toBeNull()
    await disk.delete(key) // missing is fine
    expect(disk.url(key)).toBe(`/api/v1/media/file/${key}`)
  })

  it("refuses keys that escape the root", async () => {
    const disk = diskStorage(root)
    await expect(disk.put("../x.png", new Uint8Array([1]), "image/png")).rejects.toThrow()
    await expect(disk.read("../../etc/passwd")).rejects.toThrow()
  })

  it("test() proves the directory is writable", async () => {
    await expect(diskStorage(root).test()).resolves.toBeUndefined()
    expect(await readdir(root)).toEqual(["healthcheck"])
  })

  it("defaults to /data/uploads only when /data exists", () => {
    expect(defaultUploadsRoot()).toBe(
      existsSync("/data") ? "/data/uploads" : join(process.cwd(), ".data/uploads")
    )
  })
})
```

`tests/unit/storage/r2.test.ts`:

```ts
import { NoSuchKey, type S3Client } from "@aws-sdk/client-s3"
import { describe, expect, it, vi } from "vitest"

import type { R2Config } from "@/lib/schemas/integrations"
import { createR2Client, r2Endpoint } from "@/server/lib/r2-client"
import { r2Storage } from "@/server/lib/storage/r2"

const config: R2Config = {
  accountId: "0123456789abcdef0123456789abcdef",
  jurisdiction: "default",
  bucket: "sp-media",
  accessKeyId: "AKID",
  secretAccessKey: "SECRET",
}
const KEY = "2026/10/0190a6e0-0000-7000-8000-000000000001.png"

function fakeClient(reply: (command: { constructor: { name: string }; input: Record<string, unknown> }) => unknown) {
  const send = vi.fn(async (command) => reply(command))
  return { client: { send, destroy: vi.fn() } as unknown as S3Client, send }
}

describe("createR2Client (libraries notes §5.5)", () => {
  it("targets the account endpoint with checksums only when required", async () => {
    const client = createR2Client(config)
    expect(await client.config.requestChecksumCalculation()).toBe("WHEN_REQUIRED")
    expect(await client.config.responseChecksumValidation()).toBe("WHEN_REQUIRED")
    expect((await client.config.endpoint!()).hostname).toBe(
      "0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com"
    )
    expect(r2Endpoint({ ...config, jurisdiction: "eu" })).toBe(
      "https://0123456789abcdef0123456789abcdef.eu.r2.cloudflarestorage.com"
    )
    client.destroy()
  })
})

describe("r2Storage", () => {
  it("puts objects with type, length and immutable caching", async () => {
    const { client, send } = fakeClient(() => ({}))
    const r2 = r2Storage(config, client)
    expect(r2.name).toBe("r2")
    await r2.put(KEY, new Uint8Array([1, 2]), "image/png")
    const command = send.mock.calls[0][0]
    expect(command.constructor.name).toBe("PutObjectCommand")
    expect(command.input).toMatchObject({
      Bucket: "sp-media",
      Key: KEY,
      ContentType: "image/png",
      ContentLength: 2,
      CacheControl: "public, max-age=31536000, immutable",
    })
    expect(r2.url(KEY)).toBe(`/api/v1/media/file/${KEY}`)
  })

  it("reads bytes; a missing key reads as null", async () => {
    const { client } = fakeClient((command) => {
      if (command.input.Key === KEY)
        return { Body: { transformToByteArray: async () => new Uint8Array([7]) } }
      throw new NoSuchKey({ message: "missing", $metadata: { httpStatusCode: 404 } })
    })
    const r2 = r2Storage(config, client)
    expect([...((await r2.read(KEY)) ?? [])]).toEqual([7])
    expect(await r2.read("2026/10/missing.png")).toBeNull()
  })

  it("deletes, tests with HeadBucket and validates keys", async () => {
    const { client, send } = fakeClient(() => ({}))
    const r2 = r2Storage(config, client)
    await r2.delete(KEY)
    await r2.test()
    expect(send.mock.calls.map((c) => c[0].constructor.name)).toEqual([
      "DeleteObjectCommand",
      "HeadBucketCommand",
    ])
    await expect(r2.put("../x", new Uint8Array(), "image/png")).rejects.toThrow()
  })
})
```

Append to `tests/unit/seed/static-media.test.ts`:

```ts
import { resolve } from "node:path"

import { staticFilePath } from "@/server/lib/storage/static"

describe("staticFilePath (ledger: containment before keys come from the DB)", () => {
  const publicDir = resolve("public")

  it("maps /images/<file> into public/", () => {
    expect(staticFilePath("/images/hero.jpg", publicDir)).toBe(
      resolve(publicDir, "images/hero.jpg")
    )
  })

  it("rejects keys outside /images/ or escaping public/", () => {
    for (const key of [
      "/images/../../etc/passwd",
      "/images/../.env.development",
      "images/hero.jpg",
      "/api/x.png",
      "/images/",
    ])
      expect(() => staticFilePath(key, publicDir), key).toThrow()
  })
})
```

(Merge the new imports into the file's import block.)

`tests/integration/storage/get-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"

import { getStorage, storageFor } from "@/server/lib/storage"
import type { Actor } from "@/server/lib/actor"
import { saveIntegration } from "@/server/modules/integrations/service"

import { resetDb } from "../db"
import { createUser } from "../helpers/auth"

let actor: Actor

beforeEach(async () => {
  await resetDb()
  const owner = await createUser({ roles: ["owner"] })
  actor = { userId: owner.id, roles: ["owner"], ip: null, userAgent: null, impersonatorId: null }
})

describe("getStorage (Review Focus 3)", () => {
  it("is the disk driver while integrations.r2 is unset", async () => {
    expect((await getStorage()).name).toBe("disk")
    expect(await storageFor("static")).toBeNull()
    expect(await storageFor("r2")).toBeNull()
  })

  it("is R2 once integrations.r2 is saved", async () => {
    await saveIntegration(actor, "integrations.r2", {
      version: 0,
      values: {
        accountId: "0123456789abcdef0123456789abcdef",
        jurisdiction: "default",
        bucket: "sp-media",
        accessKeyId: "AKID",
        secretAccessKey: "SECRET",
      },
    })
    expect((await getStorage()).name).toBe("r2")
    expect((await storageFor("disk"))?.name).toBe("disk")
    expect((await storageFor("r2"))?.name).toBe("r2")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/storage tests/unit/seed/static-media.test.ts`
Expected: FAIL — `Cannot find module '@/server/lib/storage/paths'` (and `…/disk`, `…/r2`, `…/static`).

- [ ] **Step 3: Implement the storage layer**

`server/lib/storage/types.ts`:

```ts
import "server-only"

export type StorageName = "disk" | "r2"

/** Where uploaded files live (spec §11). Keys are validated by every call. */
export type StorageDriver = {
  name: StorageName
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  /** The object's bytes, or null when it does not exist. */
  read(key: string): Promise<Uint8Array | null>
  /** Deleting a missing object is not an error. */
  delete(key: string): Promise<void>
  /** Public URL: same origin for every driver (phase 6 correction). */
  url(key: string): string
  /** Throws when the storage cannot be used. */
  test(): Promise<void>
}
```

`server/lib/storage/paths.ts`:

```ts
import "server-only"

import { resolve, sep } from "node:path"

/** Route of disk and R2 files (server/modules/media/routes.ts mediaFileRoutes). */
export const MEDIA_FILE_PATH = "/api/v1/media/file/"
/** Keys are never reused (replace writes a new key), so files may be cached for a year. */
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const MAX_SEGMENTS = 8

export function isValidKey(key: string): boolean {
  const segments = key.split("/")
  return (
    segments.length >= 1 &&
    segments.length <= MAX_SEGMENTS &&
    segments.every((s) => SEGMENT.test(s) && !s.includes(".."))
  )
}

export function keySegments(key: string): string[] {
  if (!isValidKey(key)) throw new Error(`Invalid media key "${key}"`)
  return key.split("/")
}

/** Absolute path of `key` under `root`; throws if the key is invalid or escapes (ledger ruling). */
export function resolveInside(root: string, key: string): string {
  const base = resolve(root)
  const target = resolve(base, ...keySegments(key))
  if (!target.startsWith(base + sep))
    throw new Error(`Media key "${key}" is outside ${base}`)
  return target
}

/** encodeURIComponent per segment: nested keys keep their "/" (ledger ruling). */
export function encodeKeyPath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/")
}

/** Inverse of encodeKeyPath for a URL path; null for malformed or invalid keys. */
export function decodeKeyPath(path: string): string | null {
  try {
    const key = path.split("/").map(decodeURIComponent).join("/")
    return isValidKey(key) ? key : null
  } catch {
    return null
  }
}

export function mediaFileUrl(key: string): string {
  return MEDIA_FILE_PATH + encodeKeyPath(key)
}

/**
 * Public URL of a media row. Static rows are shipped in public/ (key = URL
 * path, unchanged markup). Disk and R2 rows are served by our own origin,
 * so the default next/image loader and optimizer handle all three
 * (phase 6 correction: a custom loader disables /_next/image).
 */
export function mediaUrl(row: {
  driver: "static" | "disk" | "r2"
  key: string
}): string {
  return row.driver === "static" ? row.key : mediaFileUrl(row.key)
}
```

`server/lib/storage/disk.ts`:

```ts
import "server-only"

import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { mediaFileUrl, resolveInside } from "./paths"
import type { StorageDriver } from "./types"

/** The Docker volume (Dockerfile creates /data, docker-compose mounts it). */
export const DATA_DIR = "/data"

/**
 * Upload directory: /data/uploads in the container, .data/uploads in a
 * checkout (gitignored). Decided by the volume, not NODE_ENV: E2E and
 * visual runs use `next start` (production) on a laptop.
 */
export function defaultUploadsRoot(): string {
  return existsSync(DATA_DIR)
    ? `${DATA_DIR}/uploads`
    : resolve(process.cwd(), ".data/uploads")
}

export function diskStorage(root: string = defaultUploadsRoot()): StorageDriver {
  return {
    name: "disk",
    async put(key, body) {
      const path = resolveInside(root, key)
      await mkdir(dirname(path), { recursive: true })
      // Write then rename: the file route never sees a half-written file.
      const temp = `${path}.${randomUUID()}.tmp`
      try {
        await writeFile(temp, body)
        await rename(temp, path)
      } catch (err) {
        await rm(temp, { force: true })
        throw err
      }
    },
    async read(key) {
      try {
        return new Uint8Array(await readFile(resolveInside(root, key)))
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
        throw err
      }
    },
    async delete(key) {
      await rm(resolveInside(root, key), { force: true })
    },
    url: mediaFileUrl,
    async test() {
      const key = `healthcheck/${randomUUID()}.txt`
      await this.put(key, new TextEncoder().encode("ok"), "text/plain")
      await this.delete(key)
    },
  }
}
```

`server/lib/storage/r2.ts`:

```ts
import "server-only"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"

import type { R2Config } from "@/lib/schemas/integrations"
import { createR2Client } from "@/server/lib/r2-client"

import { IMMUTABLE_CACHE, keySegments, mediaFileUrl } from "./paths"
import type { StorageDriver } from "./types"

/** Cloudflare R2 through the S3 API (libraries notes §5.5). Private bucket; files are served by our origin. */
export function r2Storage(
  config: R2Config,
  client: S3Client = createR2Client(config)
): StorageDriver {
  const Bucket = config.bucket
  return {
    name: "r2",
    async put(key, body, contentType) {
      keySegments(key)
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.byteLength,
          CacheControl: IMMUTABLE_CACHE,
        })
      )
    },
    async read(key) {
      keySegments(key)
      try {
        const out = await client.send(new GetObjectCommand({ Bucket, Key: key }))
        return out.Body ? await out.Body.transformToByteArray() : null
      } catch (err) {
        if (
          err instanceof S3ServiceException &&
          (err.name === "NoSuchKey" || err.$metadata.httpStatusCode === 404)
        )
          return null
        throw err
      }
    },
    async delete(key) {
      keySegments(key)
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }))
    },
    url: mediaFileUrl,
    async test() {
      await client.send(new HeadBucketCommand({ Bucket }))
    },
  }
}
```

`server/lib/storage/static.ts`:

```ts
import "server-only"

import { resolve } from "node:path"

import { resolveInside } from "./paths"

/** Static library files ship in public/images (seed, spec §11). */
export const STATIC_PREFIX = "/images/"

/** File of a "static" media key inside public/; throws for anything else (ledger ruling). */
export function staticFilePath(
  key: string,
  publicDir: string = resolve(process.cwd(), "public")
): string {
  if (!key.startsWith(STATIC_PREFIX))
    throw new Error(`Static media key must start with ${STATIC_PREFIX}: "${key}"`)
  return resolveInside(publicDir, key.slice(1))
}
```

`server/lib/storage/index.ts`:

```ts
import "server-only"

import { type DbOrTx, getDb } from "@/server/db/client"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { diskStorage } from "./disk"
import { r2Storage } from "./r2"
import type { StorageDriver } from "./types"

export { defaultUploadsRoot, diskStorage } from "./disk"
export {
  decodeKeyPath,
  encodeKeyPath,
  IMMUTABLE_CACHE,
  isValidKey,
  keySegments,
  MEDIA_FILE_PATH,
  mediaFileUrl,
  mediaUrl,
  resolveInside,
} from "./paths"
export { r2Storage } from "./r2"
export { STATIC_PREFIX, staticFilePath } from "./static"
export type { StorageDriver, StorageName } from "./types"

/** Driver for new uploads: R2 once integrations.r2 is saved, else the server disk (Review Focus 3). */
export async function getStorage(db: DbOrTx = getDb()): Promise<StorageDriver> {
  const r2 = await readIntegrationConfig("integrations.r2", db)
  return r2 ? r2Storage(r2) : diskStorage()
}

/** Driver holding an existing row's file; null for static rows, or R2 rows once R2 is gone. */
export async function storageFor(
  driver: "static" | "disk" | "r2",
  db: DbOrTx = getDb()
): Promise<StorageDriver | null> {
  if (driver === "disk") return diskStorage()
  if (driver === "static") return null
  const r2 = await readIntegrationConfig("integrations.r2", db)
  return r2 ? r2Storage(r2) : null
}
```

In `server/modules/media/queries.ts`: delete the `mediaUrl` function and the `AppError`-only use inside it (keep the `AppError` import: `resolveMedia` still throws it), add `import { mediaUrl } from "@/server/lib/storage/paths"` (the paths module only — the query bundle must not pull the S3/SMTP clients), and leave `getMedia` calling `mediaUrl(row)`; update the comment above `getMedia` to "Disk and R2 rows are served same-origin by /api/v1/media/file/<key>.". In `server/modules/media/service.ts` replace `import { mediaUrl } from "./queries"` with `import { mediaUrl } from "@/server/lib/storage/paths"`.

In `server/db/seed/media.ts` add `import { staticFilePath } from "@/server/lib/storage/static"` and replace `await readFile(resolve(publicDir, \`.${key}\`))` with `await readFile(staticFilePath(key, publicDir))` (drop the then-unused `resolve` only if nothing else uses it — the default parameter still does, so keep it).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/storage tests/unit/seed/static-media.test.ts tests/unit/server-only-guard.test.ts`
Expected: PASS (paths 4, disk 4, r2 4, static-media 3).

Run: `pnpm test:integration tests/integration/storage/get-storage.test.ts tests/integration/api/media.test.ts tests/integration/queries/public-queries.test.ts tests/integration/seed/seed.test.ts`
Expected: PASS (2 new; Phase 3/4 media, query and seed tests unchanged — static URLs did not change).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write server/lib/storage server/modules/media/queries.ts server/modules/media/service.ts server/db/seed/media.ts tests/unit/storage tests/unit/seed/static-media.test.ts tests/integration/storage
git add server/lib/storage server/modules/media/queries.ts server/modules/media/service.ts server/db/seed/media.ts tests/unit/storage tests/unit/seed/static-media.test.ts tests/integration/storage
git commit -m "feat: add disk and R2 storage drivers with same-origin media URLs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Upload pipeline, upload API, file route, path-selected body limit (master Task 6.2, part 1)

**Files:**
- Create: `server/lib/media-sniff.ts`, `server/lib/svg-sanitize.ts`, `server/lib/image.ts`, migration `server/db/migrations/0005_media_original_name.sql` (+ drizzle `meta/` snapshot/journal from `db:generate`)
- Modify: `package.json` + `pnpm-lock.yaml` (`dompurify@3.4.17`, `jsdom@30.1.3` moved to `dependencies`, `@types/jsdom@30.0.0` dev), `server/db/schema/media.ts` (`originalName`), `server/db/seed/media.ts` (`originalName`), `lib/schemas/api/media.ts` (`MAX_UPLOAD_BYTES`, `ACCEPTED_UPLOAD_TYPES`, `kind: "document"`, richer `MediaItem`), `server/modules/media/{repo,service,routes}.ts`, `server/api/middleware/body-limit.ts` (`limitAdminBody`), `server/api/app.ts` (admin chain uses `limitAdminBody`; mount the public file route)
- Test: `tests/unit/media/sniff.test.ts`, `tests/unit/media/svg-sanitize.test.ts`, `tests/unit/media/image.test.ts`, `tests/unit/api/body-limit.test.ts`, `tests/integration/api/media-upload.test.ts`, `tests/unit/seed/static-media.test.ts` (originalName)

**Interfaces:**
- Consumes: Task 3 `getStorage`, `storageFor`, `mediaUrl`, `decodeKeyPath`, `MEDIA_FILE_PATH`, `IMMUTABLE_CACHE`; Phase 2 `writeAudit`, `can`/`actorOf`; Phase 1 `limitBody`, `BODY_LIMITS`, `errorEnvelope`; sharp 0.35 (`metadata().mediaType`, `autoOrient`, notes §5.6).
- Produces:

```ts
// lib/schemas/api/media.ts
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const ACCEPTED_UPLOAD_TYPES = "image/jpeg,image/png,image/webp,image/avif,image/svg+xml,application/pdf"   // <input accept>
export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
export const MEDIA_KINDS = ["image", "document"] as const
export const mediaListQuery  // + kind?: "image" | "document"
export type MediaDriverName = "static" | "disk" | "r2"
export type MediaItem = { id; url; alt; mime; width; height; size; createdAt; updatedAt: string; originalName: string; driver: MediaDriverName; focalX: number | null; focalY: number | null }
// server/lib/media-sniff.ts
export const UPLOAD_TYPES: { "image/jpeg": "jpg"; "image/png": "png"; "image/webp": "webp"; "image/avif": "avif"; "image/svg+xml": "svg"; "application/pdf": "pdf" }
export type UploadMime = keyof typeof UPLOAD_TYPES
export function sniffMime(bytes: Uint8Array): UploadMime | null      // magic bytes; the client's type is ignored
// server/lib/svg-sanitize.ts
export class SvgSanitizeError extends Error {}
export function sanitizeSvg(source: string): string                  // DOMPurify (svg + svgFilters profiles) on jsdom; one <svg> root; XML output
// server/lib/image.ts
export const MAX_INPUT_PIXELS = 40_000_000
export class ImageReadError extends Error {}
export type ImageInfo = { width: number | null; height: number | null; blurDataUrl: string | null }
export async function inspectImage(bytes: Uint8Array, mime: UploadMime): Promise<ImageInfo>
// server/modules/media/service.ts
export type PreparedUpload = { bytes: Uint8Array; mime: UploadMime; ext: string; size: number; originalName: string } & ImageInfo
export async function prepareUpload(file: unknown): Promise<PreparedUpload>      // 422 { file: [...] } on any problem
export function newMediaKey(ext: string, now?: Date): string                      // "YYYY/MM/<uuid v7>.<ext>" (UTC)
export async function uploadMedia(actor, input: { file: unknown; alt?: unknown }): Promise<MediaItem>
export async function readMediaFile(key: string): Promise<{ bytes: Uint8Array; mime: string; originalName: string } | null>
// server/modules/media/repo.ts
export async function insertMediaRow(db, values: typeof media.$inferInsert)
export async function findServableMedia(db, key: string)            // driver disk|r2 with this key
// server/modules/media/routes.ts
export const mediaFileRoutes: Hono<AppEnv>    // GET /api/v1/media/file/* (public, no session)
// server/api/middleware/body-limit.ts
export const BODY_LIMITS = { public: 64 KiB, admin: 1 MiB, upload: MAX_UPLOAD_BYTES + 64 KiB }
export function isUploadPath(path: string): boolean     // /api/v1/admin/media/upload, /api/v1/admin/media/<uuid>/replace
export const limitAdminBody: MiddlewareHandler<AppEnv>   // ledger ruling: limit chosen by path inside the admin chain
// HTTP
POST /api/v1/admin/media/upload  multipart { file, alt? } → 201 MediaItem   media:create   (413 body > 20 MB + envelope; 422 type/size/unreadable)
GET  /api/v1/media/file/<key>    → 200 bytes, Content-Type from the row, Cache-Control: public, max-age=31536000, immutable; SVG adds a sandbox CSP; 404 otherwise
```

Upload pipeline (spec §11): read the whole file (≤ 20 MB) → `sniffMime` (JPEG `FF D8 FF`, PNG signature, `RIFF….WEBP`, ISO-BMFF `ftyp` with an `avif`/`avis` brand, `%PDF-`, or text whose first element after prolog/comments/doctype is `<svg`; GIF, TIFF, HTML, anything else → 422) → SVG: `sanitizeSvg` (scripts, event handlers, `<style>`, `<foreignObject>`, `<a>`, `<use>`, animation and non-fragment/non-`data:image` `href`s removed) → images: `inspectImage` (sharp `metadata().mediaType` must equal the sniffed type, ≤ 40 MP, EXIF-oriented size, 16 px WebP blur for raster) → key `YYYY/MM/<uuid v7>.<ext>` → `storage.put` (active driver) → insert the row + audit `media.uploaded` in one transaction (on failure the stored object is deleted again). The file route serves only `disk`/`r2` rows (static files are served by Next from `public/`), reads the object through the row's driver and, if it vanished between lookup and read (a migration in flight), looks the row up once more.

- [ ] **Step 1: Install the libraries**

```bash
pnpm remove jsdom
pnpm add --save-exact dompurify@3.4.17 jsdom@30.1.3
pnpm add --save-dev --save-exact @types/jsdom@30.0.0
```

Expected: `dompurify` and `jsdom` under `dependencies`, `@types/jsdom` under `devDependencies`; `pnpm test --project dom` still uses jsdom. `jsdom` is in Next's built-in `serverExternalPackages`; `dompurify` bundles its own types.

- [ ] **Step 2: Write the failing tests**

`tests/unit/media/sniff.test.ts`:

```ts
import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { sniffMime } from "@/server/lib/media-sniff"

const image = (format: "png" | "jpeg" | "webp" | "avif" | "gif" | "tiff") =>
  sharp({ create: { width: 8, height: 6, channels: 3, background: "#336699" } })
    .toFormat(format)
    .toBuffer()
const text = (s: string) => new TextEncoder().encode(s)

describe("sniffMime (ledger: MIME sniffed, not trusted)", () => {
  it.each([
    ["png", "image/png"],
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
    ["avif", "image/avif"],
  ] as const)("detects %s from its bytes", async (format, mime) => {
    expect(sniffMime(new Uint8Array(await image(format)))).toBe(mime)
  })

  it("rejects formats outside the allow-list", async () => {
    expect(sniffMime(new Uint8Array(await image("gif")))).toBeNull()
    expect(sniffMime(new Uint8Array(await image("tiff")))).toBeNull()
    expect(sniffMime(text("<html><body>hi</body></html>"))).toBeNull()
    expect(sniffMime(text("just text"))).toBeNull()
    expect(sniffMime(new Uint8Array())).toBeNull()
  })

  it("detects PDF and SVG (after BOM, XML declaration, comments, doctype)", () => {
    expect(sniffMime(text("%PDF-1.7\n%âãÏÓ\n"))).toBe("application/pdf")
    expect(sniffMime(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("image/svg+xml")
    expect(
      sniffMime(
        text(
          '﻿<?xml version="1.0"?>\n<!-- made by hand -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">\n<svg viewBox="0 0 1 1"></svg>'
        )
      )
    ).toBe("image/svg+xml")
    expect(sniffMime(text("<svgfoo/>"))).toBeNull()
  })
})
```

`tests/unit/media/svg-sanitize.test.ts`:

```ts
import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { sanitizeSvg, SvgSanitizeError } from "@/server/lib/svg-sanitize"

const HOSTILE = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" onload="alert(1)">
  <script>alert(2)</script>
  <style>@import url(https://evil.example/x.css)</style>
  <a href="javascript:alert(3)"><rect width="24" height="24" fill="#0d1b36"/></a>
  <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>
  <use href="https://evil.example/sprite.svg#a"/>
  <image href="https://tracker.example/pixel.png" width="1" height="1"/>
  <image xlink:href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/>
  <set attributeName="onclick" to="alert(4)"/>
  <circle cx="12" cy="12" r="4" fill="url(#g)" onclick="alert(5)"/>
</svg>`

describe("sanitizeSvg (spec §11: SVG sanitised)", () => {
  it("removes scripts, handlers, styles, foreign content and remote references", () => {
    const out = sanitizeSvg(HOSTILE)
    for (const banned of [
      "<script",
      "onload",
      "onclick",
      "<style",
      "javascript:",
      "foreignObject",
      "<use",
      "evil.example",
      "tracker.example",
      "<set",
      "<a ",
    ])
      expect(out, banned).not.toContain(banned)
    expect(out).toContain('<rect width="24" height="24" fill="#0d1b36"/>')
    expect(out).toContain("data:image/png;base64,iVBORw0KGgo=")
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  })

  it("returns well-formed XML that sharp can read", async () => {
    const out = sanitizeSvg('<svg viewBox="0 0 24 12"><text>a&#160;b &amp; c</text></svg>')
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"><text>a b &amp; c</text></svg>'
    )
    const meta = await sharp(Buffer.from(out)).metadata()
    expect(meta.mediaType).toBe("image/svg+xml")
  })

  it("rejects documents that are not exactly one SVG", () => {
    expect(() => sanitizeSvg("<html><body>hi</body></html>")).toThrow(SvgSanitizeError)
    expect(() => sanitizeSvg("<svg></svg><svg></svg>")).toThrow(SvgSanitizeError)
    expect(() => sanitizeSvg("")).toThrow(SvgSanitizeError)
  })
})
```

`tests/unit/media/image.test.ts`:

```ts
import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { ImageReadError, inspectImage } from "@/server/lib/image"

const make = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#123456" } })

describe("inspectImage (sharp metadata + blur, notes §5.6)", () => {
  it("measures raster images and makes a WebP blur placeholder", async () => {
    const png = new Uint8Array(await make(40, 30).png().toBuffer())
    const info = await inspectImage(png, "image/png")
    expect(info).toMatchObject({ width: 40, height: 30 })
    expect(info.blurDataUrl).toMatch(/^data:image\/webp;base64,/)
  })

  it("uses the EXIF-oriented size", async () => {
    const jpeg = new Uint8Array(
      await make(40, 30).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    )
    expect(await inspectImage(jpeg, "image/jpeg")).toMatchObject({ width: 30, height: 40 })
  })

  it("measures SVG without a blur; PDFs have no size", async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"/>'
    )
    expect(await inspectImage(svg, "image/svg+xml")).toEqual({
      width: 24,
      height: 12,
      blurDataUrl: null,
    })
    expect(await inspectImage(new Uint8Array([37]), "application/pdf")).toEqual({
      width: null,
      height: null,
      blurDataUrl: null,
    })
  })

  it("rejects unreadable images and type mismatches", async () => {
    const jpeg = new Uint8Array(await make(4, 4).jpeg().toBuffer())
    await expect(inspectImage(jpeg, "image/png")).rejects.toThrow(ImageReadError)
    await expect(
      inspectImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]), "image/png")
    ).rejects.toThrow(ImageReadError)
  })
})
```

`tests/unit/api/body-limit.test.ts`:

```ts
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import type { AppEnv } from "@/server/api/context"
import {
  BODY_LIMITS,
  isUploadPath,
  limitAdminBody,
} from "@/server/api/middleware/body-limit"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"

const ID = "0190a6e0-0000-7000-8000-000000000001"

const app = new Hono<AppEnv>()
  .use("*", requestIdMiddleware)
  .use("*", limitAdminBody)
  .post("*", async (c) => c.json({ size: (await c.req.arrayBuffer()).byteLength }))

const post = (path: string, bytes: number) =>
  app.request(path, { method: "POST", body: new Uint8Array(bytes) })

describe("admin body limit chosen by path (ledger Phase 1 ruling)", () => {
  it("recognises only the two upload paths", () => {
    expect(isUploadPath("/api/v1/admin/media/upload")).toBe(true)
    expect(isUploadPath(`/api/v1/admin/media/${ID}/replace`)).toBe(true)
    expect(isUploadPath("/api/v1/admin/media/upload/x")).toBe(false)
    expect(isUploadPath(`/api/v1/admin/media/${ID}`)).toBe(false)
    expect(isUploadPath("/api/v1/admin/pages/home/draft")).toBe(false)
  })

  it("uploads may exceed 1 MB up to 20 MB + envelope", async () => {
    expect((await post("/api/v1/admin/media/upload", 2 * 1024 * 1024)).status).toBe(200)
    expect(
      (await post("/api/v1/admin/media/upload", BODY_LIMITS.upload)).status
    ).toBe(200)
    const tooBig = await post("/api/v1/admin/media/upload", BODY_LIMITS.upload + 1)
    expect(tooBig.status).toBe(413)
    expect((await tooBig.json()).error).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Files can be up to 20 MB",
    })
  })

  it("every other admin path keeps 1 MB", async () => {
    expect((await post("/api/v1/admin/pages/home/draft", 1024 * 1024)).status).toBe(200)
    expect((await post("/api/v1/admin/pages/home/draft", 1024 * 1024 + 1)).status).toBe(413)
    expect((await post(`/api/v1/admin/media/${ID}`, 2 * 1024 * 1024)).status).toBe(413)
  })
})
```

In `tests/unit/seed/static-media.test.ts`, extend the `hero.jpg` expectation with `originalName: "hero.jpg"` and the `icon-shield.svg` one with `originalName: "icon-shield.svg"`.

`tests/integration/api/media-upload.test.ts`:

```ts
import { eq } from "drizzle-orm"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { MediaItem } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import { auditLog, media } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { app } from "@/server/api/app"
import { diskStorage } from "@/server/lib/storage"

import { resetDb } from "../db"
import { ORIGIN, signedInUser } from "../helpers/auth"

let editor: string
let author: string
let intake: string
const created: string[] = []

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  author = (await signedInUser(["author"])).cookie
  intake = (await signedInUser(["intake"])).cookie
})

afterAll(async () => {
  const disk = diskStorage()
  for (const key of created) await disk.delete(key)
})

async function upload(
  cookie: string,
  file: { bytes: Uint8Array | Buffer; name: string; type: string },
  alt?: string
) {
  const form = new FormData()
  form.append("file", new File([file.bytes], file.name, { type: file.type }))
  if (alt !== undefined) form.append("alt", alt)
  const res = await app.request("/api/v1/admin/media/upload", {
    method: "POST",
    headers: { origin: ORIGIN, cookie },
    body: form,
  })
  const body = (await res.json()) as MediaItem & {
    error?: { fieldErrors?: Record<string, string[]> }
  }
  if (res.status === 201) created.push(body.url.replace("/api/v1/media/file/", ""))
  return { status: res.status, body }
}

const png = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: "#0d1b36" } })
    .png()
    .toBuffer()

describe("POST /api/v1/admin/media/upload", () => {
  it("stores on disk while R2 is unset and serves it immutable (Review Focus 3)", async () => {
    const bytes = await png()
    const { status, body } = await upload(editor, { bytes, name: "Hero Photo.png", type: "image/png" }, "Night patrol")
    expect(status).toBe(201)
    expect(body).toMatchObject({
      mime: "image/png",
      width: 64,
      height: 48,
      size: bytes.byteLength,
      alt: "Night patrol",
      originalName: "Hero Photo.png",
      driver: "disk",
      focalX: null,
      focalY: null,
    })
    expect(body.url).toMatch(/^\/api\/v1\/media\/file\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/)
    const [row] = await getDb().select().from(media).where(eq(media.id, body.id))
    expect(row.blurDataUrl).toMatch(/^data:image\/webp;base64,/)

    const file = await app.request(body.url)
    expect(file.status).toBe(200)
    expect(file.headers.get("content-type")).toBe("image/png")
    expect(file.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    expect(Buffer.from(await file.arrayBuffer()).equals(bytes)).toBe(true)

    const audit = await getDb()
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, body.id))
    expect(audit.map((a) => a.action)).toEqual(["media.uploaded"])
  })

  it("trusts the bytes, not the declared type", async () => {
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).jpeg().toBuffer()
    const disguised = await upload(author, { bytes: jpeg, name: "x.png", type: "image/png" })
    expect(disguised.status).toBe(201)
    expect(disguised.body.mime).toBe("image/jpeg")
    expect(disguised.body.url).toMatch(/\.jpg$/)

    const textAsPng = await upload(author, { bytes: Buffer.from("not an image"), name: "x.png", type: "image/png" })
    expect(textAsPng.status).toBe(422)
    expect(textAsPng.body.error?.fieldErrors?.file?.[0]).toMatch(/JPEG, PNG, WebP, AVIF, SVG or PDF/)

    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).gif().toBuffer()
    expect((await upload(author, { bytes: gif, name: "a.gif", type: "image/gif" })).status).toBe(422)
  })

  it("sanitises SVG and serves it with a sandbox CSP", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10"/></svg>'
    )
    const { status, body } = await upload(editor, { bytes: svg, name: "logo.svg", type: "image/svg+xml" })
    expect(status).toBe(201)
    expect(body).toMatchObject({ mime: "image/svg+xml", width: 10, height: 10 })
    const file = await app.request(body.url)
    const text = await file.text()
    expect(text).not.toContain("script")
    expect(text).not.toContain("onload")
    expect(file.headers.get("content-security-policy")).toContain("sandbox")
  })

  it("accepts PDFs (no dimensions)", async () => {
    const { status, body } = await upload(editor, {
      bytes: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
      name: "Price list.pdf",
      type: "application/pdf",
    })
    expect(status).toBe(201)
    expect(body).toMatchObject({ mime: "application/pdf", width: null, height: null })
    const file = await app.request(body.url)
    expect(file.headers.get("content-disposition")).toBe(
      "inline; filename*=UTF-8''Price%20list.pdf"
    )
  })

  it("rejects a missing file, an empty file and a file over 20 MB", async () => {
    const empty = await app.request("/api/v1/admin/media/upload", {
      method: "POST",
      headers: { origin: ORIGIN, cookie: editor },
      body: new FormData(),
    })
    expect(empty.status).toBe(422)
    expect((await upload(editor, { bytes: new Uint8Array(), name: "a.png", type: "image/png" })).status).toBe(422)
    const big = new Uint8Array(20 * 1024 * 1024 + 1)
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const tooLarge = await upload(editor, { bytes: big, name: "big.png", type: "image/png" })
    expect(tooLarge.status).toBe(422)
    expect(tooLarge.body.error?.fieldErrors?.file?.[0]).toBe("Files can be up to 20 MB")
    const tooBigBody = await upload(editor, { bytes: new Uint8Array(21 * 1024 * 1024), name: "huge.png", type: "image/png" })
    expect(tooBigBody.status).toBe(413)
  })

  it("needs media:create", async () => {
    expect((await upload(intake, { bytes: await png(), name: "a.png", type: "image/png" })).status).toBe(403)
  })
})

describe("GET /api/v1/media/file/*", () => {
  it("404s for unknown keys, traversal and static rows", async () => {
    expect((await app.request("/api/v1/media/file/2026/10/nope.png")).status).toBe(404)
    expect((await app.request("/api/v1/media/file/..%2F..%2Fetc%2Fpasswd")).status).toBe(404)
    expect((await app.request("/api/v1/media/file/images/hero.jpg")).status).toBe(404)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/media tests/unit/api/body-limit.test.ts`
Expected: FAIL — `Cannot find module '@/server/lib/media-sniff'` (…`svg-sanitize`, `image`) and `isUploadPath`/`limitAdminBody` are not exported.

- [ ] **Step 4: Column `media.original_name` + migration**

In `server/db/schema/media.ts` add after `alt`:

```ts
    /** File name as uploaded (library/picker label and search); static rows: the public/images name. */
    originalName: text("original_name").notNull().default(""),
```

Run: `pnpm db:generate --name media_original_name`
Expected: `server/db/migrations/0005_media_original_name.sql` containing `ALTER TABLE "media" ADD COLUMN "original_name" text DEFAULT '' NOT NULL;`. Append to that file:

```sql
--> statement-breakpoint
UPDATE "media" SET "original_name" = regexp_replace("key", '^.*/', '') WHERE "original_name" = '';
```

Run: `pnpm db:migrate`
Expected: applies 0005.

In `server/db/seed/media.ts`: add `originalName: string` to `StaticMediaRow`, `import { basename } from "node:path"` (merge into the `node:path` import), and `originalName: basename(key),` in the returned object (after `alt`).

- [ ] **Step 5: Sniffer, SVG sanitiser, image inspection**

`server/lib/media-sniff.ts`:

```ts
import "server-only"

/** Upload allow-list (spec §11): MIME → stored file extension. */
export const UPLOAD_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
} as const
export type UploadMime = keyof typeof UPLOAD_TYPES

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((value, i) => bytes[offset + i] === value)

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end))

/** ISO-BMFF `ftyp` box whose major or compatible brands include avif/avis. */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") return false
  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0)
  const end = Math.min(boxSize, bytes.length, 256)
  const brands = [ascii(bytes, 8, 12)]
  for (let at = 16; at + 4 <= end; at += 4) brands.push(ascii(bytes, at, at + 4))
  return brands.includes("avif") || brands.includes("avis")
}

const SVG_PROLOG =
  /^(?:\s+|<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)*/i

/** First element after an optional BOM, XML declaration, comments and doctype is <svg>. */
function isSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 4096))
    .replace(/^﻿/, "")
  return /^<svg[\s>/]/i.test(head.replace(SVG_PROLOG, ""))
}

/** The upload's real type from its bytes; the request's Content-Type is never trusted. */
export function sniffMime(bytes: Uint8Array): UploadMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(bytes, PNG)) return "image/png"
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP")
    return "image/webp"
  if (isAvif(bytes)) return "image/avif"
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "application/pdf"
  if (isSvg(bytes)) return "image/svg+xml"
  return null
}
```

`server/lib/svg-sanitize.ts`:

```ts
import "server-only"

import createDOMPurify, { type WindowLike } from "dompurify"
import { JSDOM } from "jsdom"

export class SvgSanitizeError extends Error {}

/** Internal references and inline raster images only: nothing is fetched from elsewhere. */
const SAFE_REFERENCE =
  /^(?:#[A-Za-z_][\w.-]*|data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]+)$/

type Purifier = {
  purify: ReturnType<typeof createDOMPurify>
  window: JSDOM["window"]
}
let instance: Purifier | null = null

function purifier(): Purifier {
  if (instance) return instance
  const { window } = new JSDOM("")
  const purify = createDOMPurify(window as unknown as WindowLike)
  purify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (
      (data.attrName === "href" || data.attrName === "xlink:href") &&
      !SAFE_REFERENCE.test(data.attrValue.trim())
    )
      data.keepAttr = false
  })
  instance = { purify, window }
  return instance
}

/**
 * Spec §11 "SVG sanitised": DOMPurify's SVG profiles (no script, handlers,
 * animation of attributes), plus no <style> (remote @import), no
 * <foreignObject>, no links, no remote href. Returns one well-formed
 * <svg> element serialised as XML (image/svg+xml must parse as XML).
 */
export function sanitizeSvg(source: string): string {
  const { purify, window } = purifier()
  const fragment = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["style", "foreignObject", "a", "use"],
    RETURN_DOM_FRAGMENT: true,
  })
  const elements = [...fragment.children]
  if (elements.length !== 1 || elements[0].nodeName.toLowerCase() !== "svg")
    throw new SvgSanitizeError("The file is not a single SVG image")
  return new window.XMLSerializer().serializeToString(elements[0])
}
```

`server/lib/image.ts`:

```ts
import "server-only"

import sharp from "sharp"

import type { UploadMime } from "./media-sniff"

/** Larger images are refused (decompression bombs; notes §5.6 `limitInputPixels`). */
export const MAX_INPUT_PIXELS = 40_000_000

export class ImageReadError extends Error {}

export type ImageInfo = {
  width: number | null
  height: number | null
  blurDataUrl: string | null
}

/**
 * sharp metadata + blur placeholder (spec §11, notes §5.6). The decoded
 * type must equal the sniffed one; sizes are EXIF-oriented; raster images
 * get a 16 px WebP data URL for next/image placeholder="blur".
 */
export async function inspectImage(
  bytes: Uint8Array,
  mime: UploadMime
): Promise<ImageInfo> {
  if (mime === "application/pdf")
    return { width: null, height: null, blurDataUrl: null }
  let meta: sharp.Metadata
  try {
    meta = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
  } catch {
    throw new ImageReadError("This image could not be read.")
  }
  if (meta.mediaType !== mime)
    throw new ImageReadError("The file content does not match its image type.")
  const width = meta.autoOrient?.width ?? meta.width ?? null
  const height = meta.autoOrient?.height ?? meta.height ?? null
  if (width && height && width * height > MAX_INPUT_PIXELS)
    throw new ImageReadError("Images can be up to 40 megapixels.")
  if (mime === "image/svg+xml") return { width, height, blurDataUrl: null }
  try {
    const tiny = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .autoOrient()
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer()
    return {
      width,
      height,
      blurDataUrl: `data:image/webp;base64,${tiny.toString("base64")}`,
    }
  } catch {
    throw new ImageReadError("This image could not be read.")
  }
}
```

- [ ] **Step 6: API shapes, repo, service, routes, body limit**

Replace `lib/schemas/api/media.ts` with:

```ts
import { z } from "zod"

import { listQuery, sortParam } from "./list"

/** Largest accepted file (spec §11). The request body may add a small multipart envelope. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
/** <input accept>: the server sniffs the bytes anyway. */
export const ACCEPTED_IMAGE_TYPES =
  "image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
export const ACCEPTED_UPLOAD_TYPES = `${ACCEPTED_IMAGE_TYPES},application/pdf`

export const MEDIA_KINDS = ["image", "document"] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

/** GET /api/v1/admin/media (library + picker). */
export const mediaListQuery = listQuery.extend({
  sort: sortParam(["createdAt", "alt"], { field: "createdAt", dir: "desc" }),
  /** "image" = image/*, "document" = everything else (PDF); omitted = all. */
  kind: z.enum(MEDIA_KINDS).optional(),
})
export type MediaListQuery = z.output<typeof mediaListQuery>

export type MediaDriverName = "static" | "disk" | "r2"

export type MediaItem = {
  id: string
  url: string
  alt: string
  mime: string
  width: number | null
  height: number | null
  size: number
  createdAt: string
  updatedAt: string
  originalName: string
  driver: MediaDriverName
  focalX: number | null
  focalY: number | null
}
```

In `server/modules/media/repo.ts`: change `listMediaRows`'s option `imagesOnly: boolean` to `kind?: "image" | "document"` and its filter to

```ts
    opts.kind === "image"
      ? like(media.mime, "image/%")
      : opts.kind === "document"
        ? notLike(media.mime, "image/%")
        : undefined,
    pattern
      ? or(
          ilike(media.alt, pattern),
          ilike(media.key, pattern),
          ilike(media.originalName, pattern)
        )
      : undefined
```

(add `notLike` to the `drizzle-orm` import), and append:

```ts
export async function insertMediaRow(db: DbOrTx, values: typeof media.$inferInsert) {
  const [row] = await db.insert(media).values(values).returning()
  return row
}

/** A disk or R2 row by key (the public file route never serves static rows). */
export async function findServableMedia(db: DbOrTx, key: string) {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.key, key), inArray(media.driver, ["disk", "r2"])))
    .limit(1)
  return row ?? null
}
```

Replace `server/modules/media/service.ts` with:

```ts
import "server-only"

import { uuidv7 } from "uuidv7"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  MAX_UPLOAD_BYTES,
  type MediaItem,
  type MediaListQuery,
} from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { ImageReadError, type ImageInfo, inspectImage } from "@/server/lib/image"
import { sniffMime, UPLOAD_TYPES, type UploadMime } from "@/server/lib/media-sniff"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { getStorage, storageFor } from "@/server/lib/storage"
import { mediaUrl } from "@/server/lib/storage/paths"
import { sanitizeSvg, SvgSanitizeError } from "@/server/lib/svg-sanitize"

import {
  findMediaById,
  findServableMedia,
  insertMediaRow,
  listMediaRows,
} from "./repo"

type MediaRow = NonNullable<Awaited<ReturnType<typeof findMediaById>>>

export function toItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    url: mediaUrl(row),
    alt: row.alt,
    mime: row.mime,
    width: row.width,
    height: row.height,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    originalName: row.originalName,
    driver: row.driver,
    focalX: row.focalX,
    focalY: row.focalY,
  }
}

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const fileError = (message: string) =>
  new AppError("VALIDATION_FAILED", message, { fieldErrors: { file: [message] } })

const ALT_MAX = 500

function parseAlt(value: unknown): string {
  if (value === undefined || value === null || value === "") return ""
  if (typeof value !== "string" || value.length > ALT_MAX)
    throw new AppError("VALIDATION_FAILED", "Invalid input", {
      fieldErrors: { alt: [`Up to ${ALT_MAX} characters`] },
    })
  return value.trim()
}

/** Last path segment, no control characters, at most 200 characters. */
function cleanFileName(name: string, ext: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200)
  return clean || `upload.${ext}`
}

export type PreparedUpload = {
  bytes: Uint8Array
  mime: UploadMime
  ext: string
  size: number
  originalName: string
} & ImageInfo

/** Spec §11 pipeline up to storage: size, sniffed type, SVG sanitising, sharp metadata + blur. */
export async function prepareUpload(file: unknown): Promise<PreparedUpload> {
  if (!(file instanceof File)) throw fileError("Choose a file to upload")
  if (file.size === 0) throw fileError("This file is empty")
  if (file.size > MAX_UPLOAD_BYTES) throw fileError("Files can be up to 20 MB")
  let bytes = new Uint8Array(await file.arrayBuffer())
  const mime = sniffMime(bytes)
  if (!mime)
    throw fileError("Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file")
  if (mime === "image/svg+xml") {
    try {
      bytes = new TextEncoder().encode(
        sanitizeSvg(new TextDecoder().decode(bytes))
      )
    } catch (err) {
      if (err instanceof SvgSanitizeError) throw fileError(err.message)
      throw err
    }
  }
  let info: ImageInfo
  try {
    info = await inspectImage(bytes, mime)
  } catch (err) {
    if (err instanceof ImageReadError) throw fileError(err.message)
    throw err
  }
  const ext = UPLOAD_TYPES[mime]
  return {
    bytes,
    mime,
    ext,
    size: bytes.byteLength,
    originalName: cleanFileName(file.name, ext),
    ...info,
  }
}

/** "YYYY/MM/<uuid v7>.<ext>" (UTC). Never reused, so files are cached as immutable. */
export function newMediaKey(ext: string, now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}/${month}/${uuidv7()}.${ext}`
}

/** Library rows (picker + library screen). */
export async function listMedia(
  actor: Actor,
  query: MediaListQuery
): Promise<Paginated<MediaItem>> {
  assertCan(actor, { media: ["read"] })
  const { rows, total } = await listMediaRows(getDb(), {
    q: query.q || undefined,
    kind: query.kind,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getMediaItem(actor: Actor, id: string): Promise<MediaItem> {
  assertCan(actor, { media: ["read"] })
  const row = await findMediaById(getDb(), id)
  if (!row) throw notFound("Media")
  return toItem(row)
}

/** POST /media/upload: stored with the active driver (R2 if configured, else disk). */
export async function uploadMedia(
  actor: Actor,
  input: { file: unknown; alt?: unknown }
): Promise<MediaItem> {
  assertCan(actor, { media: ["create"] })
  const alt = parseAlt(input.alt)
  const prepared = await prepareUpload(input.file)
  const storage = await getStorage()
  const key = newMediaKey(prepared.ext)
  await storage.put(key, prepared.bytes, prepared.mime)
  try {
    const row = await getDb().transaction(async (tx) => {
      const created = await insertMediaRow(tx, {
        key,
        driver: storage.name,
        mime: prepared.mime,
        size: prepared.size,
        width: prepared.width,
        height: prepared.height,
        blurDataUrl: prepared.blurDataUrl,
        alt,
        originalName: prepared.originalName,
        createdBy: actor.userId,
      })
      await writeAudit(tx, actor, {
        action: "media.uploaded",
        entityType: "media",
        entityId: created.id,
        diff: {
          name: prepared.originalName,
          mime: prepared.mime,
          size: prepared.size,
          driver: storage.name,
        },
      })
      return created
    })
    return toItem(row)
  } catch (err) {
    await storage.delete(key).catch(() => undefined)
    throw err
  }
}

/** Bytes of a disk/R2 file for the public file route; null = 404. */
export async function readMediaFile(
  key: string
): Promise<{ bytes: Uint8Array; mime: string; originalName: string } | null> {
  const db = getDb()
  // Twice: a migration may move the file between the lookup and the read.
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await findServableMedia(db, key)
    if (!row) return null
    const storage = await storageFor(row.driver, db)
    const bytes = storage ? await storage.read(key) : null
    if (bytes) return { bytes, mime: row.mime, originalName: row.originalName }
  }
  return null
}
```

Replace `server/modules/media/routes.ts` with:

```ts
import "server-only"

import { Hono } from "hono"

import { mediaListQuery } from "@/lib/schemas/api/media"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"
import { notFound } from "@/server/lib/errors"
import {
  decodeKeyPath,
  IMMUTABLE_CACHE,
  MEDIA_FILE_PATH,
} from "@/server/lib/storage/paths"

import * as service from "./service"

/** Multipart body; a malformed one reads as "no file" (422 from the service). */
const formOf = (c: { req: { parseBody(): Promise<Record<string, unknown>> } }) =>
  c.req.parseBody().catch(() => ({}) as Record<string, unknown>)

/** Admin media API (spec §7: media + /upload, /:id/usages). */
export const mediaRoutes = new Hono<AppEnv>()
  .get("/", can({ media: ["read"] }), zv("query", mediaListQuery), async (c) =>
    c.json(await service.listMedia(actorOf(c), c.req.valid("query")), 200)
  )
  .post("/upload", can({ media: ["create"] }), async (c) => {
    const form = await formOf(c)
    return c.json(
      await service.uploadMedia(actorOf(c), { file: form.file, alt: form.alt }),
      201
    )
  })
  .get("/:id", can({ media: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getMediaItem(actorOf(c), c.req.valid("param").id), 200)
  )

const SVG_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox"

/**
 * Public file route for disk and R2 files (spec §11). Same origin, so the
 * default next/image optimizer can fetch it. Keys never change, so the
 * response is immutable; SVGs are sandboxed when opened directly.
 */
export const mediaFileRoutes = new Hono<AppEnv>().get("/*", async (c) => {
  const pathname = new URL(c.req.url).pathname
  const key = pathname.startsWith(MEDIA_FILE_PATH)
    ? decodeKeyPath(pathname.slice(MEDIA_FILE_PATH.length))
    : null
  const file = key ? await service.readMediaFile(key) : null
  if (!file) throw notFound("File")
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Content-Length": String(file.bytes.byteLength),
    "Cache-Control": IMMUTABLE_CACHE,
  }
  if (file.mime === "image/svg+xml") headers["Content-Security-Policy"] = SVG_CSP
  if (file.mime === "application/pdf")
    headers["Content-Disposition"] =
      `inline; filename*=UTF-8''${encodeURIComponent(file.originalName || "document.pdf")}`
  return c.body(file.bytes, 200, headers)
})
```

Replace `server/api/middleware/body-limit.ts` with:

```ts
import "server-only"

import type { MiddlewareHandler } from "hono"
import { bodyLimit } from "hono/body-limit"

import { MAX_UPLOAD_BYTES } from "@/lib/schemas/api/media"
import type { AppEnv } from "@/server/api/context"

import { errorEnvelope } from "./error"

/** Global constraint: public 64 KB, admin 1 MB, uploads 20 MB (+ multipart envelope). */
export const BODY_LIMITS = {
  public: 64 * 1024,
  admin: 1024 * 1024,
  upload: MAX_UPLOAD_BYTES + 64 * 1024,
} as const

export type BodyLimitKind = keyof typeof BODY_LIMITS

const limitMessage = (kind: BodyLimitKind) =>
  kind === "upload"
    ? `Files can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`
    : `Request body exceeds ${BODY_LIMITS[kind] / 1024} KB`

/** 413 with the standard envelope (code VALIDATION_FAILED) when the body exceeds the limit. */
export const limitBody = (kind: BodyLimitKind) =>
  bodyLimit({
    maxSize: BODY_LIMITS[kind],
    onError: (c) =>
      c.json(errorEnvelope(c, "VALIDATION_FAILED", limitMessage(kind)), 413),
  })

const UPLOAD_PATH =
  /^\/api\/v1\/admin\/media\/(?:upload|[0-9a-fA-F-]{36}\/replace)$/

export const isUploadPath = (path: string) => UPLOAD_PATH.test(path)

const adminLimit = limitBody("admin")
const uploadLimit = limitBody("upload")

/**
 * The admin chain's body limit, chosen by path (ledger ruling): the two
 * upload endpoints get 20 MB, everything else 1 MB. A single outer 1 MB
 * limit would reject every upload before its route runs.
 */
export const limitAdminBody: MiddlewareHandler<AppEnv> = (c, next) =>
  isUploadPath(c.req.path) ? uploadLimit(c, next) : adminLimit(c, next)
```

In `server/api/app.ts`: import `limitAdminBody` instead of using `limitBody("admin")` in the admin chain (keep `limitBody` for `/auth/*` and `/v1/public/*`), update its comment to "session → signed in → same origin → body limit (1 MB; uploads 20 MB)", add `mediaFileRoutes` to the media import, and mount it after the health route:

```ts
  // 6. Media files (disk + R2), public and cacheable (spec §11)
  api.route("/v1/media/file", mediaFileRoutes)
```

Callers of `listMediaRows`/`MediaItem` elsewhere (Phase 4 picker/test) keep working: the picker sends `kind: "image"`; `MediaItem` only gained fields.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/media tests/unit/api tests/unit/seed tests/unit/server-only-guard.test.ts`
Expected: PASS (sniff 7, svg 3, image 4, body-limit 3; the Phase 1 envelope test keeps its "admin: 1 MB" case).

Run: `pnpm test:integration tests/integration/api/media-upload.test.ts tests/integration/api/media.test.ts tests/integration/seed/seed.test.ts`
Expected: PASS (7 new; Phase 4 picker list unchanged).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0 (jsdom/dompurify only load at runtime in the media route).

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write server/lib/media-sniff.ts server/lib/svg-sanitize.ts server/lib/image.ts server/db/schema/media.ts server/db/seed/media.ts lib/schemas/api/media.ts server/modules/media server/api/middleware/body-limit.ts server/api/app.ts tests/unit/media tests/unit/api/body-limit.test.ts tests/unit/seed/static-media.test.ts tests/integration/api/media-upload.test.ts
git add package.json pnpm-lock.yaml server/lib/media-sniff.ts server/lib/svg-sanitize.ts server/lib/image.ts server/db/schema/media.ts server/db/migrations server/db/seed/media.ts lib/schemas/api/media.ts server/modules/media server/api/middleware/body-limit.ts server/api/app.ts tests/unit/media tests/unit/api/body-limit.test.ts tests/unit/seed/static-media.test.ts tests/integration/api/media-upload.test.ts
git commit -m "feat: add media upload with sniffed types, SVG sanitising and file route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Media management — alt/focal, delete (409 in use), usages, replace, usages backfill (master Task 6.2, part 2)

**Files:**
- Modify: `lib/schemas/api/media.ts` (`mediaUpdateInput`, `MediaUsage`), `server/modules/media/{repo,service,routes}.ts`, `server/lib/media-usages.ts` (`backfillMediaUsages`), `server/db/seed/index.ts` (backfill at the end of the seed transaction)
- Test: `tests/integration/api/media-manage.test.ts`, `tests/integration/seed/media-usages-backfill.test.ts`

**Interfaces:**
- Consumes: Task 4 `prepareUpload`, `newMediaKey`, `toItem`, `getStorage`, `storageFor`; Phase 4 `syncMediaUsages`, `pgErrorCode`/`FOREIGN_KEY_VIOLATION`, `PAGE_LABELS`, `SETTINGS_ENTRIES`/`isEditableSettingsKey`, entity types written by Phase 4/5 (`page` id = key, `settings` id = key, `service`, `article`, `team` field `photo`, `client`/`groupCompany` field `logo`); `tag.media`, `invalidate`.
- Produces:

```ts
// lib/schemas/api/media.ts
export const mediaUpdateInput   // { alt?: string ≤ 500, focal?: { x: 0..1, y: 0..1 } | null }, at least one
export type MediaUsage = { entityType: string; entityId: string; field: string; label: string; href: string | null }
// server/lib/media-usages.ts
export async function backfillMediaUsages(tx: DbOrTx): Promise<number>   // rewrites usages of every entity that can reference media; returns rows
// server/modules/media/repo.ts
export function listMediaUsages(db, mediaId)                             // { entityType, entityId, field }[]
export async function usageTargets(db, usages): Promise<Map<string, string>>   // "<type>:<id>" → title/name for service/article/team/client/groupCompany
export async function updateMediaRow(db, id, patch): Promise<MediaRow | null>
export async function deleteMediaRow(db, id): Promise<boolean>
export async function listMediaReferencingEntities(db): Promise<{ entityType: string; entityId: string; values: unknown[] }[]>
// server/modules/media/service.ts
export async function updateMedia(actor, id, input): Promise<MediaItem>          // media:update; invalidate media:<id>
export async function listUsages(actor, id): Promise<{ items: MediaUsage[] }>    // media:read
export async function deleteMedia(actor, id): Promise<{ ok: true }>             // media:delete; 409 { current: { usages } } when used
export async function replaceMedia(actor, id, input: { file: unknown }): Promise<MediaItem>   // media:update; same kind only
// HTTP
PATCH  /api/v1/admin/media/:id            { alt?, focal? } → MediaItem
GET    /api/v1/admin/media/:id/usages     → { items: MediaUsage[] }
DELETE /api/v1/admin/media/:id            → { ok: true } | 409 CONFLICT { current: { usages: MediaUsage[] } }
POST   /api/v1/admin/media/:id/replace    multipart { file } → MediaItem (same id, new url)
```

Usage labels/links (fixed): `page` → "<PAGE_LABELS[key]> page", `/admin/pages/<key>`; `settings` → "Settings › <SETTINGS_ENTRIES[key].label>", `/admin/settings/<key>` (other keys: "Settings › <key>", no link); `service` → "Service: <draft title>", `/admin/services/<id>`; `article` → "Article: <draft title>", `/admin/articles/<id>`; `team` → "Team: <name>", `/admin/team?edit=<id>`; `client` → "Client: <name>", `/admin/clients?edit=<id>`; `groupCompany` → "Group company: <name>", `/admin/group-companies?edit=<id>`; anything else → "<entityType> <entityId>", no link.

Backfill (ledger carry): every page (`draft`, `published`), every non-integration settings row (`draft`, `published`), every service and article (`draft`, `published`; rich-text image `attrs.media` included through `collectMediaFields`), team members `{ photo }`, clients `{ logo }`, group companies `{ logo }` — the same shapes and entity types the Phase 4/5 services write, so the backfilled rows equal what the next save writes. Runs at the end of `seedContent`'s transaction on every seed (idempotent; it recomputes from current rows, so admin edits are kept).

Delete: refused (409) while `media_usages` has rows for it, or when the RESTRICT FKs (`team_members.photo_id`, `clients.logo_id`, `group_companies.logo_id`, `media_usages.media_id`) fire anyway (23503 → 409). After commit the stored object is deleted (disk/R2; static files in `public/` stay) and `media:<id>` is expired.

- [ ] **Step 1: Write the failing tests**

`tests/integration/seed/media-usages-backfill.test.ts`:

```ts
import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import {
  articles,
  clients,
  groupCompanies,
  media,
  mediaUsages,
  teamMembers,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { backfillMediaUsages } from "@/server/lib/media-usages"

import { resetDb } from "../db"

const idOf = async (key: string) =>
  (await getDb().select({ id: media.id }).from(media).where(eq(media.key, key)))[0].id

const usagesOf = (entityType: string, entityId: string) =>
  getDb()
    .select({ mediaId: mediaUsages.mediaId, field: mediaUsages.field })
    .from(mediaUsages)
    .where(and(eq(mediaUsages.entityType, entityType), eq(mediaUsages.entityId, entityId)))

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("media_usages backfill (ledger carry: seeded refs)", () => {
  it("covers page, settings and service JSON", async () => {
    expect(await usagesOf("page", "home")).toContainEqual({
      mediaId: await idOf("/images/hero.jpg"),
      field: "hero.backgroundImage",
    })
    expect((await usagesOf("settings", "site")).map((u) => u.mediaId)).toContain(
      await idOf("/images/logo.png")
    )
    const serviceUsages = await getDb()
      .select({ id: mediaUsages.id })
      .from(mediaUsages)
      .where(eq(mediaUsages.entityType, "service"))
    expect(serviceUsages.length).toBeGreaterThan(0)
  })

  it("covers team photo, client and group company logos (FK columns)", async () => {
    const [client] = await getDb().select().from(clients).where(eq(clients.name, "Dinn Rí"))
    expect(await usagesOf("client", client.id)).toEqual([
      { mediaId: client.logoId, field: "logo" },
    ])
    const [group] = await getDb().select().from(groupCompanies).limit(1)
    expect(await usagesOf("groupCompany", group.id)).toEqual([
      { mediaId: group.logoId, field: "logo" },
    ])
    for (const member of await getDb().select().from(teamMembers))
      expect(await usagesOf("team", member.id)).toEqual(
        member.photoId ? [{ mediaId: member.photoId, field: "photo" }] : []
      )
  })

  it("covers rich-text image attrs.media and is idempotent", async () => {
    const [article] = await getDb().select().from(articles).limit(1)
    const bannerId = await idOf("/images/banner.png")
    const draft = {
      ...(article.draft as Record<string, unknown>),
      body: {
        type: "doc",
        content: [{ type: "image", attrs: { media: { mediaId: bannerId }, alt: "" } }],
      },
    }
    await getDb().update(articles).set({ draft }).where(eq(articles.id, article.id))
    const first = await backfillMediaUsages(getDb())
    const second = await backfillMediaUsages(getDb())
    expect(second).toBe(first)
    expect(await usagesOf("article", article.id)).toContainEqual({
      mediaId: bannerId,
      field: "body.content.0.attrs.media",
    })
  })
})
```

`tests/integration/api/media-manage.test.ts`:

```ts
import { eq } from "drizzle-orm"
import sharp from "sharp"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag, cacheLife: vi.fn(), cacheTag: vi.fn() }))

import type { MediaItem, MediaUsage } from "@/lib/schemas/api/media"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { auditLog, media } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { diskStorage } from "@/server/lib/storage"

import { resetDb } from "../db"
import { adminRequest, ORIGIN, signedInUser } from "../helpers/auth"

let editor: string
let author: string
const created: string[] = []

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  author = (await signedInUser(["author"])).cookie
})
beforeEach(() => revalidateTag.mockClear())
afterAll(async () => {
  for (const key of created) await diskStorage().delete(key)
})

const keyOf = (item: MediaItem) => item.url.replace("/api/v1/media/file/", "")

async function send(path: string, cookie: string, bytes: Buffer, name: string) {
  const form = new FormData()
  form.append("file", new File([bytes], name))
  const res = await app.request(`/api/v1/admin/media${path}`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie },
    body: form,
  })
  const body = (await res.json()) as MediaItem
  if (res.ok) created.push(keyOf(body))
  return { status: res.status, body }
}
const png = (color = "#0d1b36") =>
  sharp({ create: { width: 32, height: 16, channels: 3, background: color } }).png().toBuffer()

const heroId = async () =>
  (await getDb().select({ id: media.id }).from(media).where(eq(media.key, "/images/hero.jpg")))[0].id

describe("PATCH /api/v1/admin/media/:id", () => {
  it("updates alt text and focal point; expires media:<id>", async () => {
    const id = await heroId()
    const res = await adminRequest(`/media/${id}`, {
      cookie: editor,
      method: "PATCH",
      json: { alt: "Patrol car at night", focal: { x: 0.25, y: 0.6 } },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ alt: "Patrol car at night", focalX: 0.25, focalY: 0.6 })
    expect(revalidateTag).toHaveBeenCalledWith(`media:${id}`, { expire: 0 })

    const reset = await adminRequest(`/media/${id}`, { cookie: editor, method: "PATCH", json: { focal: null } })
    expect(await reset.json()).toMatchObject({ focalX: null, focalY: null })
  })

  it("validates input and needs media:update", async () => {
    const id = await heroId()
    expect((await adminRequest(`/media/${id}`, { cookie: editor, method: "PATCH", json: { focal: { x: 1.5, y: 0 } } })).status).toBe(422)
    expect((await adminRequest(`/media/${id}`, { cookie: editor, method: "PATCH", json: {} })).status).toBe(422)
    expect((await adminRequest(`/media/${id}`, { cookie: author, method: "PATCH", json: { alt: "x" } })).status).toBe(403)
  })
})

describe("usages and DELETE (media_usages RESTRICT → 409)", () => {
  it("lists where a file is used, with labels and links", async () => {
    const res = await adminRequest(`/media/${await heroId()}/usages`, { cookie: author })
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as { items: MediaUsage[] }
    expect(items).toContainEqual({
      entityType: "page",
      entityId: "home",
      field: "hero.backgroundImage",
      label: "Home page",
      href: "/admin/pages/home",
    })
  })

  it("refuses to delete a file in use and names the places", async () => {
    const res = await adminRequest(`/media/${await heroId()}`, { cookie: editor, method: "DELETE" })
    expect(res.status).toBe(409)
    const { error } = (await res.json()) as { error: { code: string; current: { usages: MediaUsage[] } } }
    expect(error.code).toBe("CONFLICT")
    expect(error.current.usages.map((u) => u.label)).toContain("Home page")
  })

  it("deletes an unused upload, its file and audits it", async () => {
    const { body } = await send("/upload", editor, await png(), "spare.png")
    const res = await adminRequest(`/media/${body.id}`, { cookie: editor, method: "DELETE" })
    expect(res.status).toBe(200)
    expect(await diskStorage().read(keyOf(body))).toBeNull()
    expect(await getDb().select().from(media).where(eq(media.id, body.id))).toEqual([])
    const audit = await getDb().select({ action: auditLog.action }).from(auditLog).where(eq(auditLog.entityId, body.id))
    expect(audit.map((a) => a.action)).toEqual(["media.uploaded", "media.deleted"])
    expect(revalidateTag).toHaveBeenCalledWith(`media:${body.id}`, { expire: 0 })
    expect((await adminRequest(`/media/${body.id}`, { cookie: editor, method: "DELETE" })).status).toBe(404)
  })

  it("authors cannot delete", async () => {
    const { body } = await send("/upload", author, await png(), "mine.png")
    expect((await adminRequest(`/media/${body.id}`, { cookie: author, method: "DELETE" })).status).toBe(403)
  })
})

describe("POST /api/v1/admin/media/:id/replace", () => {
  it("keeps the id, writes a new file and removes the old one", async () => {
    const { body: first } = await send("/upload", editor, await png(), "logo-old.png")
    const jpeg = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#fff" } }).jpeg().toBuffer()
    const { status, body } = await send(`/${first.id}/replace`, editor, jpeg, "logo-new.jpg")
    expect(status).toBe(200)
    expect(body).toMatchObject({ id: first.id, mime: "image/jpeg", width: 20, height: 10, originalName: "logo-new.jpg" })
    expect(body.url).not.toBe(first.url)
    expect(await diskStorage().read(keyOf(first))).toBeNull()
    expect((await app.request(body.url)).status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith(`media:${first.id}`, { expire: 0 })
  })

  it("only replaces an image with an image", async () => {
    const { body } = await send("/upload", editor, await png(), "photo.png")
    const pdf = Buffer.from("%PDF-1.4\n%%EOF\n")
    const res = await send(`/${body.id}/replace`, editor, pdf, "doc.pdf")
    expect(res.status).toBe(422)
    expect((await send(`/${body.id}/replace`, author, await png("#fff"), "x.png")).status).toBe(403)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration tests/integration/seed/media-usages-backfill.test.ts tests/integration/api/media-manage.test.ts`
Expected: FAIL — `backfillMediaUsages` is not exported; `PATCH/DELETE /media/:id`, `/usages`, `/replace` answer 404.

- [ ] **Step 3: Backfill**

Append to `lib/schemas/api/media.ts`:

```ts
/** PATCH /media/:id. focal: point to keep in view when cropped (0..1 from the left/top); null resets. */
export const mediaUpdateInput = z
  .object({
    alt: z.string().max(500, "Up to 500 characters").optional(),
    focal: z
      .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
      .nullable()
      .optional(),
  })
  .refine((v) => v.alt !== undefined || v.focal !== undefined, {
    message: "Nothing to update",
  })
export type MediaUpdateInput = z.output<typeof mediaUpdateInput>

/** One place a file is used (media_usages row with a readable label). */
export type MediaUsage = {
  entityType: string
  entityId: string
  field: string
  label: string
  href: string | null
}
```

Append to `server/modules/media/repo.ts` (add `articles, clients, groupCompanies, pages, services, settings, teamMembers` to the schema import and `notLike, sql` to the `drizzle-orm` import where missing):

```ts
type MediaRow = typeof media.$inferSelect

export function listMediaUsages(db: DbOrTx, mediaId: string) {
  return db
    .select({
      entityType: mediaUsages.entityType,
      entityId: mediaUsages.entityId,
      field: mediaUsages.field,
    })
    .from(mediaUsages)
    .where(eq(mediaUsages.mediaId, mediaId))
    .orderBy(asc(mediaUsages.entityType), asc(mediaUsages.entityId), asc(mediaUsages.field))
}

/** Display names of usage targets, keyed "<entityType>:<entityId>". */
export async function usageTargets(
  db: DbOrTx,
  usages: { entityType: string; entityId: string }[]
): Promise<Map<string, string>> {
  const ids = (type: string) => [
    ...new Set(usages.filter((u) => u.entityType === type).map((u) => u.entityId)),
  ]
  const names = new Map<string, string>()
  const add = (type: string, rows: { id: string; name: string | null }[]) => {
    for (const row of rows) names.set(`${type}:${row.id}`, row.name ?? "")
  }
  const serviceIds = ids("service")
  if (serviceIds.length)
    add(
      "service",
      await db
        .select({ id: services.id, name: sql<string>`${services.draft}->>'title'` })
        .from(services)
        .where(inArray(services.id, serviceIds))
    )
  const articleIds = ids("article")
  if (articleIds.length)
    add(
      "article",
      await db
        .select({ id: articles.id, name: sql<string>`${articles.draft}->>'title'` })
        .from(articles)
        .where(inArray(articles.id, articleIds))
    )
  const teamIds = ids("team")
  if (teamIds.length)
    add("team", await db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers).where(inArray(teamMembers.id, teamIds)))
  const clientIds = ids("client")
  if (clientIds.length)
    add("client", await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds)))
  const groupIds = ids("groupCompany")
  if (groupIds.length)
    add("groupCompany", await db.select({ id: groupCompanies.id, name: groupCompanies.name }).from(groupCompanies).where(inArray(groupCompanies.id, groupIds)))
  return names
}

export async function updateMediaRow(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<typeof media.$inferInsert, "id" | "createdAt" | "createdBy">>
): Promise<MediaRow | null> {
  const [row] = await db.update(media).set(patch).where(eq(media.id, id)).returning()
  return row ?? null
}

/** Throws the FK error (23503) when a RESTRICT reference still points at it. */
export async function deleteMediaRow(db: DbOrTx, id: string): Promise<boolean> {
  const deleted = await db.delete(media).where(eq(media.id, id)).returning({ id: media.id })
  return deleted.length > 0
}

/**
 * Every entity that can reference media, with the values its service syncs
 * (Phase 4/5 shapes: versioned JSON draft + published; collections as
 * { photo } / { logo }). Integration settings never hold media.
 */
export async function listMediaReferencingEntities(
  db: DbOrTx
): Promise<{ entityType: string; entityId: string; values: unknown[] }[]> {
  const out: { entityType: string; entityId: string; values: unknown[] }[] = []
  for (const row of await db.select({ key: pages.key, draft: pages.draft, published: pages.published }).from(pages))
    out.push({ entityType: "page", entityId: row.key, values: [row.draft, row.published] })
  for (const row of await db
    .select({ key: settings.key, draft: settings.draft, published: settings.published })
    .from(settings)
    .where(notLike(settings.key, "integrations.%")))
    out.push({ entityType: "settings", entityId: row.key, values: [row.draft, row.published] })
  for (const row of await db.select({ id: services.id, draft: services.draft, published: services.published }).from(services))
    out.push({ entityType: "service", entityId: row.id, values: [row.draft, row.published] })
  for (const row of await db.select({ id: articles.id, draft: articles.draft, published: articles.published }).from(articles))
    out.push({ entityType: "article", entityId: row.id, values: [row.draft, row.published] })
  for (const row of await db.select({ id: teamMembers.id, photoId: teamMembers.photoId }).from(teamMembers))
    out.push({ entityType: "team", entityId: row.id, values: [{ photo: row.photoId ? { mediaId: row.photoId } : null }] })
  for (const row of await db.select({ id: clients.id, logoId: clients.logoId }).from(clients))
    out.push({ entityType: "client", entityId: row.id, values: [{ logo: { mediaId: row.logoId } }] })
  for (const row of await db.select({ id: groupCompanies.id, logoId: groupCompanies.logoId }).from(groupCompanies))
    out.push({ entityType: "groupCompany", entityId: row.id, values: [{ logo: { mediaId: row.logoId } }] })
  return out
}
```

Append to `server/lib/media-usages.ts` (add `listMediaReferencingEntities` to its media repo import):

```ts
/**
 * Recomputes media_usages for every entity that can reference media
 * (ledger carry: seeded references were never tracked). Same shapes as the
 * services' syncs, so the rows equal what the next save would write.
 * Returns the number of usage rows.
 */
export async function backfillMediaUsages(tx: DbOrTx): Promise<number> {
  let total = 0
  for (const entity of await listMediaReferencingEntities(tx))
    total += (
      await syncMediaUsages(tx, entity.entityType, entity.entityId, ...entity.values)
    ).length
  return total
}
```

In `server/db/seed/index.ts`: `import { backfillMediaUsages } from "@/server/lib/media-usages"` and, as the **last statement inside** the `db.transaction(async (tx) => { … })` callback before it returns the report, `await backfillMediaUsages(tx)`.

- [ ] **Step 4: Service + routes**

Add to `server/modules/media/service.ts` imports: `import { isEditableSettingsKey, SETTINGS_ENTRIES } from "@/lib/admin/settings-keys"`, `import { PAGE_LABELS } from "@/lib/admin/page-labels"`, `type MediaUpdateInput, type MediaUsage` from `@/lib/schemas/api/media`, `import { invalidate, tag } from "@/server/lib/cache-tags"`, `import { FOREIGN_KEY_VIOLATION, pgErrorCode } from "@/server/lib/pg-errors"`, `import type { DbOrTx } from "@/server/db/client"` (merge with the `getDb` import), and `deleteMediaRow, listMediaUsages, updateMediaRow, usageTargets` from `./repo`. Append:

```ts
const kindOf = (mime: string) => (mime.startsWith("image/") ? "image" : "document")

function describeUsage(
  usage: { entityType: string; entityId: string; field: string },
  names: Map<string, string>
): MediaUsage {
  const { entityType: type, entityId: id } = usage
  const name = names.get(`${type}:${id}`) ?? ""
  const with_ = (label: string, href: string | null) => ({ ...usage, label, href })
  switch (type) {
    case "page":
      return with_(
        `${PAGE_LABELS[id as keyof typeof PAGE_LABELS] ?? id} page`,
        `/admin/pages/${id}`
      )
    case "settings":
      return isEditableSettingsKey(id)
        ? with_(`Settings › ${SETTINGS_ENTRIES[id].label}`, `/admin/settings/${id}`)
        : with_(`Settings › ${id}`, null)
    case "service":
      return with_(`Service: ${name}`, `/admin/services/${id}`)
    case "article":
      return with_(`Article: ${name}`, `/admin/articles/${id}`)
    case "team":
      return with_(`Team: ${name}`, `/admin/team?edit=${id}`)
    case "client":
      return with_(`Client: ${name}`, `/admin/clients?edit=${id}`)
    case "groupCompany":
      return with_(`Group company: ${name}`, `/admin/group-companies?edit=${id}`)
    default:
      return with_(`${type} ${id}`, null)
  }
}

async function usagesOf(db: DbOrTx, id: string): Promise<MediaUsage[]> {
  const rows = await listMediaUsages(db, id)
  const names = await usageTargets(db, rows)
  return rows.map((row) => describeUsage(row, names))
}

const inUse = (usages: MediaUsage[]) =>
  new AppError(
    "CONFLICT",
    usages.length > 0
      ? `This file is used in ${usages.length} place${usages.length === 1 ? "" : "s"}. Choose another file there first.`
      : "This file is still used on the site. Choose another file there first.",
    { current: { usages } }
  )

export async function listUsages(
  actor: Actor,
  id: string
): Promise<{ items: MediaUsage[] }> {
  assertCan(actor, { media: ["read"] })
  const db = getDb()
  if (!(await findMediaById(db, id))) throw notFound("Media")
  return { items: await usagesOf(db, id) }
}

/** Alt text and focal point (spec §8.1). Media is not versioned: last write wins. */
export async function updateMedia(
  actor: Actor,
  id: string,
  input: MediaUpdateInput
): Promise<MediaItem> {
  assertCan(actor, { media: ["update"] })
  const row = await getDb().transaction(async (tx) => {
    const existing = await findMediaById(tx, id)
    if (!existing) throw notFound("Media")
    const patch: Parameters<typeof updateMediaRow>[2] = {}
    if (input.alt !== undefined) patch.alt = input.alt.trim()
    if (input.focal !== undefined) {
      patch.focalX = input.focal?.x ?? null
      patch.focalY = input.focal?.y ?? null
    }
    const updated = await updateMediaRow(tx, id, patch)
    if (!updated) throw notFound("Media")
    await writeAudit(tx, actor, {
      action: "media.updated",
      entityType: "media",
      entityId: id,
      diff: {
        ...(input.alt !== undefined ? { alt: { from: existing.alt, to: updated.alt } } : {}),
        ...(input.focal !== undefined ? { focal: input.focal } : {}),
      },
    })
    return updated
  })
  invalidate(tag.media(id))
  return toItem(row)
}

/** Refused while the file is used anywhere (media_usages RESTRICT, ledger ruling). */
export async function deleteMedia(actor: Actor, id: string): Promise<{ ok: true }> {
  assertCan(actor, { media: ["delete"] })
  const row = await getDb().transaction(async (tx) => {
    const existing = await findMediaById(tx, id)
    if (!existing) throw notFound("Media")
    const usages = await usagesOf(tx, id)
    if (usages.length > 0) throw inUse(usages)
    try {
      await deleteMediaRow(tx, id)
    } catch (err) {
      if (pgErrorCode(err) === FOREIGN_KEY_VIOLATION) throw inUse([])
      throw err
    }
    await writeAudit(tx, actor, {
      action: "media.deleted",
      entityType: "media",
      entityId: id,
      diff: { key: existing.key, driver: existing.driver, name: existing.originalName },
    })
    return existing
  })
  const storage = await storageFor(row.driver)
  await storage?.delete(row.key).catch((err) =>
    console.error(`[media] could not delete stored file of ${id}: ${err instanceof Error ? err.message : err}`)
  )
  invalidate(tag.media(id))
  return { ok: true }
}

/**
 * New file for the same media row (spec §8.1 "replace"): usages keep
 * pointing at the id; the new key makes a new immutable URL.
 */
export async function replaceMedia(
  actor: Actor,
  id: string,
  input: { file: unknown }
): Promise<MediaItem> {
  assertCan(actor, { media: ["update"] })
  const existing = await findMediaById(getDb(), id)
  if (!existing) throw notFound("Media")
  const prepared = await prepareUpload(input.file)
  if (kindOf(prepared.mime) !== kindOf(existing.mime))
    throw fileError(
      kindOf(existing.mime) === "image"
        ? "Replace an image with another image, so the pages using it keep working"
        : "Replace a document with another PDF"
    )
  const storage = await getStorage()
  const key = newMediaKey(prepared.ext)
  await storage.put(key, prepared.bytes, prepared.mime)
  let updated: MediaRow
  try {
    updated = await getDb().transaction(async (tx) => {
      const row = await updateMediaRow(tx, id, {
        key,
        driver: storage.name,
        mime: prepared.mime,
        size: prepared.size,
        width: prepared.width,
        height: prepared.height,
        blurDataUrl: prepared.blurDataUrl,
        originalName: prepared.originalName,
        focalX: null,
        focalY: null,
      })
      if (!row) throw notFound("Media")
      await writeAudit(tx, actor, {
        action: "media.replaced",
        entityType: "media",
        entityId: id,
        diff: { from: existing.originalName || existing.key, to: prepared.originalName },
      })
      return row
    })
  } catch (err) {
    await storage.delete(key).catch(() => undefined)
    throw err
  }
  const old = await storageFor(existing.driver)
  await old?.delete(existing.key).catch((err) =>
    console.error(`[media] could not delete replaced file of ${id}: ${err instanceof Error ? err.message : err}`)
  )
  invalidate(tag.media(id))
  return toItem(updated)
}
```

In `server/modules/media/routes.ts`: add `import { mediaUpdateInput } from "@/lib/schemas/api/media"` (merge with `mediaListQuery`) and extend the `mediaRoutes` chain after `.get("/:id", …)`:

```ts
  .patch(
    "/:id",
    can({ media: ["update"] }),
    zv("param", idParam),
    zv("json", mediaUpdateInput),
    async (c) =>
      c.json(
        await service.updateMedia(actorOf(c), c.req.valid("param").id, c.req.valid("json")),
        200
      )
  )
  .delete("/:id", can({ media: ["delete"] }), zv("param", idParam), async (c) =>
    c.json(await service.deleteMedia(actorOf(c), c.req.valid("param").id), 200)
  )
  .get("/:id/usages", can({ media: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.listUsages(actorOf(c), c.req.valid("param").id), 200)
  )
  .post("/:id/replace", can({ media: ["update"] }), zv("param", idParam), async (c) => {
    const form = await formOf(c)
    return c.json(
      await service.replaceMedia(actorOf(c), c.req.valid("param").id, { file: form.file }),
      200
    )
  })
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/seed tests/integration/api/media-manage.test.ts tests/integration/api/media-upload.test.ts tests/integration/api/media-usages-race.test.ts tests/integration/api/pages.test.ts`
Expected: PASS (backfill 3, manage 8; seed idempotency, Phase 4 usages race and pages tests unchanged).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write lib/schemas/api/media.ts server/modules/media server/lib/media-usages.ts server/db/seed/index.ts tests/integration/api/media-manage.test.ts tests/integration/seed/media-usages-backfill.test.ts
git add lib/schemas/api/media.ts server/modules/media server/lib/media-usages.ts server/db/seed/index.ts tests/integration/api/media-manage.test.ts tests/integration/seed/media-usages-backfill.test.ts
git commit -m "feat: add media edit, replace and in-use-safe delete with usages backfill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Media library screen — grid/list, drag-and-drop upload with progress, details (master Task 6.3, part 1)

**Files:**
- Create: `components/admin/media/{upload-request.ts,uploader.tsx,format.ts,focal-point.tsx,media-details.tsx,library.tsx}`, `app/(admin)/admin/(panel)/media/page.tsx`
- Modify: `components/admin/shell/nav.ts` ("Media" item), `tests/unit/admin/nav.test.ts`, admin shell baselines `tests/visual/__screenshots__/admin-shell*.png`
- Test: `tests/dom/media-library.test.tsx`, `tests/unit/admin/media-format.test.ts`

**Interfaces:**
- Consumes: Tasks 4–5 HTTP API (`GET /media`, `POST /media/upload`, `GET|PATCH|DELETE /media/:id`, `GET /media/:id/usages`, `POST /media/:id/replace`), `MediaItem`, `MediaUsage`, `MAX_UPLOAD_BYTES`, `ACCEPTED_UPLOAD_TYPES`; Phase 4 `useMediaItem`, `api`/`unwrap`/`ApiError`/`errorMessage`, `usePermission`, `useDebouncedValue`, `PageHeader`, `formatDateTime`, shadcn `Sheet*`, `AlertDialog*`, `Button`, `Input`, `Textarea`, `Label`, `Skeleton`, `Badge`, `sonner`.
- Produces:

```ts
// components/admin/media/upload-request.ts
export function sendMediaFile(url: string, file: File, opts?: { alt?: string; onProgress?: (fraction: number) => void; signal?: AbortSignal }): Promise<MediaItem>   // XHR (upload progress), rejects with ApiError
export const uploadMediaFile: (file: File, opts?) => Promise<MediaItem>            // POST /api/v1/admin/media/upload
export const replaceMediaFile: (id: string, file: File, opts?) => Promise<MediaItem>   // POST /api/v1/admin/media/:id/replace
// components/admin/media/uploader.tsx
export type UploadEntry = { id: number; name: string; progress: number; status: "uploading" | "done" | "error"; error?: string }
export function useMediaUploads(onUploaded?: (item: MediaItem) => void): { entries: UploadEntry[]; start(files: File[]): void; clearFinished(): void }
export function MediaDropzone(props: { onFiles(files: File[]): void; accept?: string; disabled?: boolean; label?: string }): JSX.Element  // hidden <input data-upload-input>
export function UploadList(props: { entries: UploadEntry[]; onClear(): void }): JSX.Element
// components/admin/media/format.ts
export function formatBytes(bytes: number): string               // "512 B", "1.5 KB", "2.3 MB"
export function mediaName(item: Pick<MediaItem, "originalName" | "alt" | "url">): string   // originalName || alt || last URL segment
export const DRIVER_LABELS: Record<MediaDriverName, string>     // static "Built in", disk "Server disk", r2 "Cloudflare R2"
export function typeLabel(mime: string): string                 // "PNG image", "SVG image", "PDF document"
// components/admin/media/focal-point.tsx
export function FocalPointPicker(props: { src: string; value: { x: number; y: number } | null; onChange(v: { x: number; y: number } | null): void; disabled?: boolean }): JSX.Element
// components/admin/media/media-details.tsx
export function MediaDetails(props: { id: string | null; onClose(): void }): JSX.Element     // Sheet titled with mediaName(item)
// components/admin/media/library.tsx
export function MediaLibrary(): JSX.Element
// Route: /admin/media   requirePermission({ media: ["read"] })
```

UI decisions (fixed): toolbar = search ("Search media", 250 ms debounce, matches alt/file name), kind filter buttons **All / Images / Documents** (`aria-pressed`), view toggle **Grid / List** (`aria-pressed`), page size 24, Previous/Next. Upload (needs `media:create`): dropzone region "Upload files" with a **Choose files** button (keyboard path) — dropping or choosing starts one XHR per file with a progressbar each (`role="progressbar"`, `aria-valuenow` 0–100, labelled with the file name); after each successful upload the list refreshes and the details sheet opens for that file. Files over 20 MB fail locally with "“name” is larger than 20 MB." Details sheet (right): preview, facts (Type, Size, Dimensions, Storage, Added), **Open file** link (new tab), **Alternative text** textarea (500 chars, counter), focal point picker for raster images, **Save details** (`media:update`, toast "File details saved."), **Used in** list (links), **Replace file…** (`media:update`, accept = same kind), **Delete** (`media:delete`, `AlertDialog` "Delete this file?"; a 409 shows the usages in an alert). Grid cards and list rows are buttons named by `mediaName(item)`. Phones: grid 2 columns; list view hides Dimensions/Added columns below `sm`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/media-format.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { formatBytes, mediaName, typeLabel } from "@/components/admin/media/format"

describe("media formatting", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB")
  })

  it("names files and types", () => {
    expect(mediaName({ originalName: "hero.png", alt: "Hero", url: "/x/y.png" })).toBe("hero.png")
    expect(mediaName({ originalName: "", alt: "Hero", url: "/x/y.png" })).toBe("Hero")
    expect(mediaName({ originalName: "", alt: "", url: "/x/y.png" })).toBe("y.png")
    expect(typeLabel("image/svg+xml")).toBe("SVG image")
    expect(typeLabel("image/jpeg")).toBe("JPEG image")
    expect(typeLabel("application/pdf")).toBe("PDF document")
  })
})
```

`tests/dom/media-library.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { uploadMediaFile } = vi.hoisted(() => ({ uploadMediaFile: vi.fn() }))
vi.mock("@/components/admin/media/upload-request", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadMediaFile,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { MediaLibrary } from "@/components/admin/media/library"
import { makeQueryClient } from "@/components/admin/providers"
import { type AdminSession, AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { MediaItem } from "@/lib/schemas/api/media"

const item = (n: number, extra: Partial<MediaItem> = {}): MediaItem => ({
  id: `0190a6e0-0000-7000-8000-00000000000${n}`,
  url: `/api/v1/media/file/2026/10/file-${n}.png`,
  alt: "",
  mime: "image/png",
  width: 64,
  height: 48,
  size: 2048,
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  originalName: `photo-${n}.png`,
  driver: "disk",
  focalX: null,
  focalY: null,
  ...extra,
})

type Call = { url: string; method: string; body?: unknown }
let calls: Call[]
let library: MediaItem[]
let deleteStatus: number

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

beforeEach(() => {
  calls = []
  library = [item(1), item(2, { mime: "application/pdf", originalName: "prices.pdf", width: null, height: null })]
  deleteStatus = 200
  uploadMediaFile.mockReset()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const id = url.match(/media\/([0-9a-f-]{36})/)?.[1]
      if (url.includes("/usages"))
        return json({ items: [{ entityType: "page", entityId: "home", field: "hero.backgroundImage", label: "Home page", href: "/admin/pages/home" }] })
      if (id && method === "DELETE")
        return deleteStatus === 409
          ? json({ error: { code: "CONFLICT", message: "This file is used in 1 place. Choose another file there first.", current: { usages: [] }, requestId: "r" } }, 409)
          : json({ ok: true })
      if (id && method === "PATCH")
        return json({ ...library.find((i) => i.id === id)!, ...(calls.at(-1)!.body as object) })
      if (id) return json(library.find((i) => i.id === id))
      return json({ items: library, page: 1, pageSize: 24, total: library.length })
    })
  )
})

function renderLibrary(roles: Role[] = ["editor"]) {
  const session: AdminSession = {
    user: { id: "u1", name: "Edith Editor", email: "e@example.test", title: null, twoFactorEnabled: false },
    roles,
    impersonatedBy: null,
  }
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AdminSessionProvider value={session}>
        <MediaLibrary />
      </AdminSessionProvider>
    </QueryClientProvider>
  )
}

describe("MediaLibrary (master 6.3)", () => {
  it("lists files and filters by kind", async () => {
    const user = userEvent.setup()
    renderLibrary()
    expect(await screen.findByRole("button", { name: /photo-1\.png/ })).toBeVisible()
    expect(screen.getByRole("button", { name: /prices\.pdf/ })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Documents" }))
    await waitFor(() => expect(calls.at(-1)!.url).toContain("kind=document"))
    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute("aria-pressed", "true")
  })

  it("uploads chosen files with progress and opens the new file", async () => {
    const uploaded = item(3, { originalName: "new.png" })
    uploadMediaFile.mockImplementation(async (_file: File, opts: { onProgress?: (n: number) => void }) => {
      opts.onProgress?.(0.5)
      library = [uploaded, ...library]
      return uploaded
    })
    const { container } = renderLibrary()
    await screen.findByRole("button", { name: /photo-1\.png/ })
    const input = container.querySelector<HTMLInputElement>("[data-upload-input]")!
    // The input is `hidden` (the "Choose files" button opens it): dispatch the change directly.
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], "new.png", { type: "image/png" })] },
    })
    expect(uploadMediaFile).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("dialog", { name: "new.png" })).toBeVisible()
  })

  it("saves alt text from the details sheet", async () => {
    const user = userEvent.setup()
    renderLibrary()
    await user.click(await screen.findByRole("button", { name: /photo-1\.png/ }))
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    expect(await within(sheet).findByRole("link", { name: "Home page" })).toHaveAttribute("href", "/admin/pages/home")
    await user.type(within(sheet).getByLabelText("Alternative text"), "Patrol car")
    await user.click(within(sheet).getByRole("button", { name: "Save details" }))
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true))
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ alt: "Patrol car", focal: null })
  })

  it("explains a refused delete (409)", async () => {
    const user = userEvent.setup()
    deleteStatus = 409
    renderLibrary()
    await user.click(await screen.findByRole("button", { name: /photo-1\.png/ }))
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    await user.click(within(sheet).getByRole("button", { name: "Delete" }))
    const confirm = await screen.findByRole("alertdialog", { name: "Delete this file?" })
    await user.click(within(confirm).getByRole("button", { name: "Delete" }))
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("This file is used in 1 place.")
  })

  it("viewers see no upload, save or delete controls", async () => {
    const user = userEvent.setup()
    const { container } = renderLibrary(["viewer"])
    await user.click(await screen.findByRole("button", { name: /photo-1\.png/ }))
    const sheet = await screen.findByRole("dialog", { name: "photo-1.png" })
    expect(container.querySelector("[data-upload-input]")).toBeNull()
    expect(within(sheet).queryByRole("button", { name: "Save details" })).toBeNull()
    expect(within(sheet).queryByRole("button", { name: "Delete" })).toBeNull()
    expect(within(sheet).getByLabelText("Alternative text")).toHaveAttribute("readonly")
  })
})
```

In `tests/unit/admin/nav.test.ts`: "Media" is the **last item of the Content section**. In every expected list for a role holding `media:read` (owner, admin, editor, viewer, author, marketer — and their unions) insert `"Media"` directly after that list's last Content item (`"Categories"` for full lists; after `"Services"` for marketer; after `"Articles"` for author). Lists for intake and unknown roles do not change.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/media-library.test.tsx && pnpm test:unit tests/unit/admin/media-format.test.ts tests/unit/admin/nav.test.ts`
Expected: FAIL — `Cannot find module '@/components/admin/media/library'` / `…/format`; nav lacks "Media".

- [ ] **Step 3: Implement**

`components/admin/media/format.ts`:

```ts
import type { MediaDriverName, MediaItem } from "@/lib/schemas/api/media"

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const rounded = value >= 10 || Number.isInteger(value) ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

export function mediaName(item: Pick<MediaItem, "originalName" | "alt" | "url">): string {
  return item.originalName || item.alt || item.url.split("/").pop() || "File"
}

export const DRIVER_LABELS: Record<MediaDriverName, string> = {
  static: "Built in",
  disk: "Server disk",
  r2: "Cloudflare R2",
}

const TYPE_NAMES: Record<string, string> = {
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
  "image/webp": "WebP image",
  "image/avif": "AVIF image",
  "image/svg+xml": "SVG image",
  "application/pdf": "PDF document",
}

export function typeLabel(mime: string): string {
  return TYPE_NAMES[mime] ?? mime
}

export const isRaster = (mime: string) => mime.startsWith("image/") && mime !== "image/svg+xml"
```

`components/admin/media/upload-request.ts`:

```ts
"use client"

import { ApiError, type ApiErrorBody } from "@/lib/api-client"
import { MAX_UPLOAD_BYTES, type MediaItem } from "@/lib/schemas/api/media"

export type UploadOptions = {
  alt?: string
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Multipart POST through XMLHttpRequest: fetch() reports no upload
 * progress. Same origin with the session cookie; the server answers with
 * the API envelope, turned into ApiError like `unwrap()`.
 */
export function sendMediaFile(url: string, file: File, opts: UploadOptions = {}): Promise<MediaItem> {
  if (file.size > MAX_UPLOAD_BYTES)
    return Promise.reject(
      new ApiError(413, {
        error: { code: "VALIDATION_FAILED", message: `“${file.name}” is larger than 20 MB.` },
      })
    )
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.responseType = "json"
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) opts.onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as MediaItem)
      else reject(new ApiError(xhr.status, xhr.response as Partial<ApiErrorBody> | null))
    }
    xhr.onerror = () => reject(new Error("Network error"))
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"))
    opts.signal?.addEventListener("abort", () => xhr.abort())
    const form = new FormData()
    form.append("file", file)
    if (opts.alt) form.append("alt", opts.alt)
    xhr.send(form)
  })
}

export const uploadMediaFile = (file: File, opts?: UploadOptions) =>
  sendMediaFile("/api/v1/admin/media/upload", file, opts)

export const replaceMediaFile = (id: string, file: File, opts?: UploadOptions) =>
  sendMediaFile(`/api/v1/admin/media/${id}/replace`, file, opts)
```

`components/admin/media/uploader.tsx`:

```tsx
"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CircleAlert, CircleCheck, Upload } from "lucide-react"
import { type DragEvent, useCallback, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api-client"
import { ACCEPTED_UPLOAD_TYPES, type MediaItem } from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

import { uploadMediaFile } from "./upload-request"

export type UploadEntry = {
  id: number
  name: string
  progress: number
  status: "uploading" | "done" | "error"
  error?: string
}

/** One XHR per file; refreshes every media query after each success. */
export function useMediaUploads(onUploaded?: (item: MediaItem) => void) {
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const nextId = useRef(1)
  const update = (id: number, patch: Partial<UploadEntry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const start = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const id = nextId.current++
        setEntries((prev) => [...prev, { id, name: file.name, progress: 0, status: "uploading" }])
        uploadMediaFile(file, { onProgress: (p) => update(id, { progress: p }) })
          .then((item) => {
            update(id, { status: "done", progress: 1 })
            void queryClient.invalidateQueries({ queryKey: ["media"] })
            onUploaded?.(item)
          })
          .catch((err) => update(id, { status: "error", error: errorMessage(err) }))
      }
    },
    [queryClient, onUploaded]
  )

  const clearFinished = () => setEntries((prev) => prev.filter((e) => e.status === "uploading"))
  return { entries, start, clearFinished }
}

/** Drop zone + "Choose files" button (the keyboard path); hidden input marked data-upload-input. */
export function MediaDropzone({
  onFiles,
  accept = ACCEPTED_UPLOAD_TYPES,
  disabled,
  label = "Drop files here to upload",
  multiple = true,
}: {
  onFiles: (files: File[]) => void
  accept?: string
  disabled?: boolean
  label?: string
  multiple?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = [...event.dataTransfer.files]
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }
  return (
    <section
      aria-label="Upload files"
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      data-dragging={dragging || undefined}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors",
        dragging && "border-primary bg-primary/5 text-foreground"
      )}
    >
      <Upload aria-hidden className="size-5" />
      <p>{label}</p>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
        Choose files
      </Button>
      <p className="text-xs">JPEG, PNG, WebP, AVIF, SVG or PDF, up to 20 MB each.</p>
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        data-upload-input
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ""
          if (files.length) onFiles(files)
        }}
      />
    </section>
  )
}

export function UploadList({ entries, onClear }: { entries: UploadEntry[]; onClear: () => void }) {
  if (entries.length === 0) return null
  const finished = entries.some((e) => e.status !== "uploading")
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Uploads" className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1 rounded-lg border p-2 text-sm">
            <span className="flex items-center gap-2">
              {entry.status === "done" ? (
                <CircleCheck aria-hidden className="size-4 text-emerald-600" />
              ) : entry.status === "error" ? (
                <CircleAlert aria-hidden className="size-4 text-destructive" />
              ) : null}
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              <span className="text-xs text-muted-foreground">
                {entry.status === "done" ? "Uploaded" : entry.status === "error" ? "Failed" : `${Math.round(entry.progress * 100)}%`}
              </span>
            </span>
            {entry.status === "uploading" ? (
              <div
                role="progressbar"
                aria-label={`Uploading ${entry.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(entry.progress * 100)}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full bg-primary transition-[width]" style={{ width: `${entry.progress * 100}%` }} />
              </div>
            ) : null}
            {entry.error ? <p role="alert" className="text-xs text-destructive">{entry.error}</p> : null}
          </li>
        ))}
      </ul>
      {finished ? (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onClear}>
          Clear finished
        </Button>
      ) : null}
    </div>
  )
}
```

`components/admin/media/focal-point.tsx`:

```tsx
"use client"

import { type KeyboardEvent, type MouseEvent, useRef } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Point = { x: number; y: number }
const clamp = (v: number) => Math.min(1, Math.max(0, Math.round(v * 100) / 100))

/**
 * The point to keep in view when an image is cropped. Click the image or
 * use the arrow keys on the marker (Shift = larger steps); "Reset" = centre.
 */
export function FocalPointPicker({
  src,
  value,
  onChange,
  disabled,
}: {
  src: string
  value: Point | null
  onChange: (value: Point | null) => void
  disabled?: boolean
}) {
  const frame = useRef<HTMLDivElement>(null)
  const point = value ?? { x: 0.5, y: 0.5 }
  const pick = (event: MouseEvent) => {
    if (disabled || !frame.current) return
    const rect = frame.current.getBoundingClientRect()
    onChange({ x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) })
  }
  const onKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02
    const moves: Record<string, Point> = {
      ArrowLeft: { x: point.x - step, y: point.y },
      ArrowRight: { x: point.x + step, y: point.y },
      ArrowUp: { x: point.x, y: point.y - step },
      ArrowDown: { x: point.x, y: point.y + step },
    }
    const next = moves[event.key]
    if (!next || disabled) return
    event.preventDefault()
    onChange({ x: clamp(next.x), y: clamp(next.y) })
  }
  return (
    <div className="flex flex-col gap-2">
      <div ref={frame} className="relative inline-block self-start" onClick={pick}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary upload */}
        <img src={src} alt="" className={cn("block max-h-56 w-auto max-w-full rounded-md", !disabled && "cursor-crosshair")} />
        <button
          type="button"
          disabled={disabled}
          onKeyDown={onKey}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Focal point: ${Math.round(point.x * 100)}% from the left, ${Math.round(point.y * 100)}% from the top. Arrow keys move it.`}
          className={cn(
            "absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/70 shadow ring-1 ring-black/40 outline-none focus-visible:ring-3 focus-visible:ring-ring",
            !value && "border-dashed bg-transparent"
          )}
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{value ? `${Math.round(value.x * 100)}% × ${Math.round(value.y * 100)}%` : "Centre (default)"}</span>
        {value && !disabled ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange(null)}>
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  )
}
```

`components/admin/media/media-details.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, FileText } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/hooks/use-permission"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import {
  ACCEPTED_IMAGE_TYPES,
  type MediaItem,
  type MediaUsage,
} from "@/lib/schemas/api/media"

import { FocalPointPicker } from "./focal-point"
import { DRIVER_LABELS, formatBytes, isRaster, mediaName, typeLabel } from "./format"
import { replaceMediaFile } from "./upload-request"
import { useMediaItem } from "./use-media-item"

const ALT_MAX = 500

/** Right-hand sheet with one file's details (spec §8.1: alt text, focal point, usages, replace). */
export function MediaDetails({ id, onClose }: { id: string | null; onClose: () => void }) {
  const item = useMediaItem(id)
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {item.data ? (
          <DetailsBody key={`${item.data.id}:${item.data.updatedAt}`} item={item.data} onDeleted={onClose} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{item.isError ? "File not found" : "Loading…"}</SheetTitle>
            </SheetHeader>
            {item.isError ? null : <Skeleton className="mx-4 h-48 rounded-lg" />}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailsBody({ item, onDeleted }: { item: MediaItem; onDeleted: () => void }) {
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ media: ["update"] })
  const canDelete = usePermission({ media: ["delete"] })
  const [alt, setAlt] = useState(item.alt)
  const [focal, setFocal] = useState(item.focalX !== null && item.focalY !== null ? { x: item.focalX, y: item.focalY } : null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const name = mediaName(item)
  const image = item.mime.startsWith("image/")

  const usages = useQuery({
    queryKey: ["media", "usages", item.id],
    queryFn: () => unwrap(api.media[":id"].usages.$get({ param: { id: item.id } })),
  })

  const accept = (next: MediaItem) => {
    queryClient.setQueryData(["media", "item", next.id], next)
    void queryClient.invalidateQueries({ queryKey: ["media", "list"] })
  }

  const save = useMutation({
    mutationFn: () => unwrap(api.media[":id"].$patch({ param: { id: item.id }, json: { alt, focal } })),
    onSuccess: (next) => {
      accept(next)
      toast.success("File details saved.")
    },
  })

  const remove = useMutation({
    mutationFn: () => unwrap(api.media[":id"].$delete({ param: { id: item.id } })),
    onSuccess: () => {
      setConfirmDelete(false)
      queryClient.removeQueries({ queryKey: ["media", "item", item.id] })
      void queryClient.invalidateQueries({ queryKey: ["media", "list"] })
      toast.success("File deleted.")
      onDeleted()
    },
    onError: () => setConfirmDelete(false),
  })

  const replace = async (file: File) => {
    setReplaceProgress(0)
    try {
      accept(await replaceMediaFile(item.id, file, { onProgress: setReplaceProgress }))
      toast.success("File replaced.")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setReplaceProgress(null)
    }
  }

  const dirty = alt !== item.alt || JSON.stringify(focal) !== JSON.stringify(item.focalX !== null && item.focalY !== null ? { x: item.focalX, y: item.focalY } : null)
  const blockedUsages = remove.error instanceof ApiError && remove.error.isConflict
    ? ((remove.error.current as { usages?: MediaUsage[] } | undefined)?.usages ?? [])
    : null

  return (
    <>
      <SheetHeader>
        <SheetTitle className="break-all">{name}</SheetTitle>
        <SheetDescription>{typeLabel(item.mime)}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        {image && isRaster(item.mime) ? (
          <FocalPointPicker src={item.url} value={focal} onChange={setFocal} disabled={!canUpdate} />
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview
          <img src={item.url} alt="" className="max-h-56 self-start rounded-md" />
        ) : (
          <FileText aria-hidden className="size-12 text-muted-foreground" />
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Type</dt>
          <dd>{typeLabel(item.mime)}</dd>
          <dt className="text-muted-foreground">Size</dt>
          <dd>{formatBytes(item.size)}</dd>
          {item.width && item.height ? (
            <>
              <dt className="text-muted-foreground">Dimensions</dt>
              <dd>{item.width} × {item.height} px</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Storage</dt>
          <dd>{DRIVER_LABELS[item.driver]}</dd>
          <dt className="text-muted-foreground">Added</dt>
          <dd>{formatDateTime(item.createdAt)}</dd>
        </dl>
        <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-sm text-primary underline-offset-4 hover:underline">
          Open file
          <ExternalLink aria-hidden className="size-3.5" />
        </a>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`alt-${item.id}`}>Alternative text</Label>
          <Textarea
            id={`alt-${item.id}`}
            value={alt}
            maxLength={ALT_MAX}
            readOnly={!canUpdate}
            rows={3}
            aria-describedby={`alt-${item.id}-help`}
            onChange={(e) => setAlt(e.target.value)}
          />
          <p id={`alt-${item.id}-help`} className="text-xs text-muted-foreground">
            Describes the image for people who cannot see it. Leave empty for decorative images. {alt.length}/{ALT_MAX}
          </p>
        </div>

        {canUpdate ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save details"}
            </Button>
            <Button type="button" variant="outline" disabled={replaceProgress !== null} onClick={() => replaceInput.current?.click()}>
              {replaceProgress !== null ? `Replacing… ${Math.round(replaceProgress * 100)}%` : "Replace file…"}
            </Button>
            <input
              ref={replaceInput}
              type="file"
              hidden
              tabIndex={-1}
              accept={image ? ACCEPTED_IMAGE_TYPES : "application/pdf"}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (file) void replace(file)
              }}
            />
          </div>
        ) : null}
        {save.isError ? <p role="alert" className="text-sm text-destructive">{errorMessage(save.error)}</p> : null}

        <section aria-labelledby={`usages-${item.id}`} className="flex flex-col gap-2">
          <h3 id={`usages-${item.id}`} className="text-sm font-semibold">Used in</h3>
          {usages.isPending ? (
            <Skeleton className="h-6 w-40" />
          ) : usages.isError ? (
            <p className="text-sm text-destructive">{errorMessage(usages.error)}</p>
          ) : usages.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not used anywhere yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {usages.data.items.map((usage) => (
                <li key={`${usage.entityType}:${usage.entityId}:${usage.field}`}>
                  {usage.href ? (
                    <Link href={usage.href} className="text-primary underline-offset-4 hover:underline">{usage.label}</Link>
                  ) : (
                    usage.label
                  )}{" "}
                  <span className="text-xs text-muted-foreground">({usage.field})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canDelete ? (
          <Button type="button" variant="destructive" className="self-start" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
        {remove.isError ? (
          <div role="alert" className="flex flex-col gap-1 rounded-lg border border-destructive/40 p-3 text-sm">
            <p>{errorMessage(remove.error)}</p>
            {blockedUsages && blockedUsages.length > 0 ? (
              <ul className="list-disc pl-5">
                {blockedUsages.map((u) => (
                  <li key={`${u.entityType}:${u.entityId}:${u.field}`}>{u.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>“{name}” is removed from the library and its storage. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

(The `useMediaItem` query key is `["media", "item", id]`; `setQueryData` there keeps the sheet, the picker thumbnail and the `MediaWidget` in sync. If the real `AlertDialogAction` has no `variant` prop, use `className={buttonVariants({ variant: "destructive" })}`.)

`components/admin/media/library.tsx`:

```tsx
"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { FileText, ImageOff, LayoutGrid, List, Search } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { MediaItem, MediaKind } from "@/lib/schemas/api/media"
import { cn } from "@/lib/utils"

import { formatBytes, mediaName, typeLabel } from "./format"
import { MediaDetails } from "./media-details"
import { MediaDropzone, UploadList, useMediaUploads } from "./uploader"

const PAGE_SIZE = 24
const KINDS: { value: MediaKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "document", label: "Documents" },
]

function Thumb({ item, className }: { item: MediaItem; className?: string }) {
  return (
    <span className={cn("flex items-center justify-center overflow-hidden rounded-md bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[16px_16px]", className)}>
      {item.mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnails of arbitrary sizes
        <img src={item.url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
      ) : (
        <FileText aria-hidden className="size-8 text-muted-foreground" />
      )}
    </span>
  )
}

/** Media library (spec §8.1): grid/list, search, kind filter, drag & drop upload, details sheet. */
export function MediaLibrary() {
  const canUpload = usePermission({ media: ["create"] })
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<MediaKind | "all">("all")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const debounced = useDebouncedValue(query.trim(), 250)
  const q = query.trim() ? debounced : ""

  const list = useQuery({
    queryKey: ["media", "list", { q, page, kind, pageSize: PAGE_SIZE }],
    queryFn: () =>
      unwrap(
        api.media.$get({
          query: {
            q: q || undefined,
            kind: kind === "all" ? undefined : kind,
            page: String(page),
            pageSize: String(PAGE_SIZE),
          },
        })
      ),
    placeholderData: keepPreviousData,
  })
  const onUploaded = useCallback((item: MediaItem) => setSelected(item.id), [])
  const uploads = useMediaUploads(onUploaded)
  const items = list.data?.items ?? []
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      {canUpload ? (
        <div className="flex flex-col gap-3">
          <MediaDropzone onFiles={uploads.start} />
          <UploadList entries={uploads.entries} onClear={uploads.clearFinished} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search media"
            placeholder="Search by description or file name"
            className="pl-8"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div role="group" aria-label="Kind" className="flex gap-1">
          {KINDS.map((k) => (
            <Button
              key={k.value}
              type="button"
              size="sm"
              variant={kind === k.value ? "secondary" : "ghost"}
              aria-pressed={kind === k.value}
              onClick={() => {
                setKind(k.value)
                setPage(1)
              }}
            >
              {k.label}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="View" className="flex gap-1">
          <Button type="button" size="icon-sm" variant={view === "grid" ? "secondary" : "ghost"} aria-pressed={view === "grid"} aria-label="Grid" onClick={() => setView("grid")}>
            <LayoutGrid aria-hidden />
          </Button>
          <Button type="button" size="icon-sm" variant={view === "list" ? "secondary" : "ghost"} aria-pressed={view === "list"} aria-label="List" onClick={() => setView("list")}>
            <List aria-hidden />
          </Button>
        </div>
      </div>

      {list.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
          <p className="text-sm">{errorMessage(list.error)}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => list.refetch()}>Try again</Button>
        </div>
      ) : list.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-busy="true" aria-label="Loading media">
          {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border py-12 text-sm text-muted-foreground">
          <ImageOff aria-hidden className="size-6" />
          {q ? `Nothing matches “${q}”.` : canUpload ? "No files yet. Upload the first one above." : "No files yet."}
        </div>
      ) : view === "grid" ? (
        <ul aria-label="Files" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item.id)}
                className="flex w-full flex-col gap-1.5 rounded-lg border p-1.5 text-left outline-none hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Thumb item={item} className="aspect-square" />
                <span className="line-clamp-2 min-h-8 text-xs break-all">{mediaName(item)}</span>
                <span className="text-[11px] text-muted-foreground">{formatBytes(item.size)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-14 py-2 font-medium"><span className="sr-only">Preview</span></th>
              <th scope="col" className="py-2 font-medium">Name</th>
              <th scope="col" className="py-2 font-medium">Type</th>
              <th scope="col" className="py-2 font-medium">Size</th>
              <th scope="col" className="hidden py-2 font-medium sm:table-cell">Dimensions</th>
              <th scope="col" className="hidden py-2 font-medium sm:table-cell">Added</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="py-1.5"><Thumb item={item} className="size-10" /></td>
                <td className="py-1.5">
                  <button type="button" onClick={() => setSelected(item.id)} className="text-left break-all text-primary underline-offset-4 hover:underline">
                    {mediaName(item)}
                  </button>
                </td>
                <td className="py-1.5">{typeLabel(item.mime)}</td>
                <td className="py-1.5">{formatBytes(item.size)}</td>
                <td className="hidden py-1.5 sm:table-cell">{item.width && item.height ? `${item.width} × ${item.height}` : "—"}</td>
                <td className="hidden py-1.5 sm:table-cell">{formatDateTime(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>

      <MediaDetails id={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
```

`app/(admin)/admin/(panel)/media/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { MediaLibrary } from "@/components/admin/media/library"
import { PageHeader } from "@/components/admin/page-header"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Media" }

export default function MediaPage() {
  return (
    <Suspense fallback={null}>
      <Media />
    </Suspense>
  )
}

async function Media() {
  await requirePermission({ media: ["read"] })
  return (
    <>
      <PageHeader
        title="Media"
        description="Images and documents used on the site. Uploads are kept on the server disk, or in Cloudflare R2 once it is set up."
      />
      <MediaLibrary />
    </>
  )
}
```

In `components/admin/shell/nav.ts`: add `Images` to the `lucide-react` import (alphabetical) and append to the **end** of the "Content" section's `items`:

```ts
      {
        label: "Media",
        href: "/admin/media",
        icon: Images,
        permission: { media: ["read"] },
        match: "prefix",
      },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec next typegen && pnpm exec vitest run --project dom tests/dom/media-library.test.tsx && pnpm test:unit tests/unit/admin`
Expected: PASS (library 5, format 2, nav updated).

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: exit 0.

Run (port 3100 free, no other Playwright/build): `pnpm exec playwright test tests/visual/admin-shell.spec.ts --update-snapshots=changed`
Expected: the admin shell screenshots are re-captured (the sidebar gains "Media"); inspect the new PNGs — only the nav list differs. Then `pnpm test:visual` → all public baselines still 0 px.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/media "app/(admin)/admin/(panel)/media" components/admin/shell/nav.ts tests/dom/media-library.test.tsx tests/unit/admin/media-format.test.ts tests/unit/admin/nav.test.ts
git add components/admin/media "app/(admin)/admin/(panel)/media" components/admin/shell/nav.ts tests/dom/media-library.test.tsx tests/unit/admin/media-format.test.ts tests/unit/admin/nav.test.ts tests/visual/__screenshots__/admin-shell*.png
git commit -m "feat: add media library screen with drag-and-drop upload and details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Upload from the media picker + page-editor E2E (master Task 6.3, part 2)

**Files:**
- Modify: `components/admin/session-provider.tsx` (`useOptionalAdminSession`), `components/admin/media/picker-dialog.tsx` (upload button + progress, auto-select)
- Test: `tests/dom/media-picker-upload.test.tsx`, `tests/e2e/media.spec.ts`

**Interfaces:**
- Consumes: Task 6 `uploadMediaFile`, `ACCEPTED_IMAGE_TYPES`; Phase 4 `MediaPickerDialog` (props unchanged), `MediaWidget` (labels "Change: <field>", picker title "Choose: <field>"), page editor (`/admin/pages/home`, region "Hero", save status, "Publish" → dialog "Publish changes?" → "Publish now"), public hero `[data-hero-media] img`.
- Produces:

```ts
// components/admin/session-provider.tsx
export function useOptionalAdminSession(): AdminSession | null     // null outside <AdminSessionProvider>
// components/admin/media/picker-dialog.tsx — same props; new behaviour:
//   "Upload new image" button (only when a session grants media:create) → hidden <input data-upload-input accept=ACCEPTED_IMAGE_TYPES>
//   → progress "Uploading … 40%" (role=status) → success: media queries refreshed, search cleared, the new image is selected ("Use this image" enabled)
//   → failure: role=alert with the server message
```

Why the optional session: Phase 4 DOM tests render `SchemaForm` (and so the picker) without the admin shell; `usePermission` would throw there.

- [ ] **Step 1: Write the failing tests**

`tests/dom/media-picker-upload.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { uploadMediaFile } = vi.hoisted(() => ({ uploadMediaFile: vi.fn() }))
vi.mock("@/components/admin/media/upload-request", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadMediaFile,
}))

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { makeQueryClient } from "@/components/admin/providers"
import { type AdminSession, AdminSessionProvider } from "@/components/admin/session-provider"
import type { Role } from "@/lib/auth/roles"
import type { MediaItem } from "@/lib/schemas/api/media"

const uploaded: MediaItem = {
  id: "0190a6e0-0000-7000-8000-000000000009",
  url: "/api/v1/media/file/2026/10/new.png",
  alt: "",
  mime: "image/png",
  width: 10,
  height: 10,
  size: 100,
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  originalName: "new-hero.png",
  driver: "disk",
  focalX: null,
  focalY: null,
}

beforeEach(() => {
  uploadMediaFile.mockReset()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ items: [uploaded], page: 1, pageSize: 24, total: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
  )
})

function renderPicker(roles: Role[] | null, onSelect = vi.fn()) {
  const picker = (
    <MediaPickerDialog open onOpenChange={() => undefined} onSelect={onSelect} title="Choose: Background image" />
  )
  const session: AdminSession | null = roles
    ? { user: { id: "u1", name: "E", email: "e@example.test", title: null, twoFactorEnabled: false }, roles, impersonatedBy: null }
    : null
  render(
    <QueryClientProvider client={makeQueryClient()}>
      {session ? <AdminSessionProvider value={session}>{picker}</AdminSessionProvider> : picker}
    </QueryClientProvider>
  )
  return onSelect
}

describe("MediaPickerDialog upload (master 6.3)", () => {
  it("uploads an image and selects it", async () => {
    uploadMediaFile.mockImplementation(async (_f: File, o: { onProgress?: (n: number) => void }) => {
      o.onProgress?.(0.4)
      return uploaded
    })
    const onSelect = renderPicker(["author"])
    expect(await screen.findByRole("button", { name: "Upload new image" })).toBeVisible()
    const input = document.querySelector<HTMLInputElement>("[data-upload-input]")!
    expect(input.accept).toBe("image/jpeg,image/png,image/webp,image/avif,image/svg+xml")
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], "new-hero.png", { type: "image/png" })] } })
    const use = screen.getByRole("button", { name: "Use this image" })
    await waitFor(() => expect(use).toBeEnabled())
    fireEvent.click(use)
    expect(onSelect).toHaveBeenCalledWith(uploaded)
  })

  it("shows the server's message when an upload fails", async () => {
    uploadMediaFile.mockRejectedValue(new Error("Network error"))
    renderPicker(["editor"])
    const input = (await screen.findByRole("button", { name: "Upload new image" })) && document.querySelector<HTMLInputElement>("[data-upload-input]")!
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], "x.png", { type: "image/png" })] } })
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong")
  })

  it("no upload without media:create or outside the admin shell", async () => {
    renderPicker(["intake"])
    await screen.findByRole("dialog")
    expect(screen.queryByRole("button", { name: "Upload new image" })).toBeNull()
  })

  it("renders without a session (SchemaForm tests)", async () => {
    renderPicker(null)
    expect(await screen.findByRole("dialog")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Upload new image" })).toBeNull()
  })
})
```

`tests/e2e/media.spec.ts`:

```ts
import { type Browser, expect, type Page, test } from "@playwright/test"
import sharp from "sharp"

import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Master 6.3: upload in the library → pick it as the home hero in the page
// editor → publish → the public page renders the new image (served
// same-origin by /api/v1/media/file and optimised by next/image).

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": clientIpFor(testInfo.title) })
})

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible()
}

async function publicHero(browser: Browser) {
  const visitor = await browser.newContext()
  const page = await visitor.newPage()
  await page.goto("/")
  const img = page.locator("[data-hero-media] img")
  await expect(img).toBeVisible()
  const src = await img.getAttribute("src")
  const loaded = await img.evaluate(async (el: HTMLImageElement) => {
    await el.decode().catch(() => undefined)
    return el.naturalWidth
  })
  await visitor.close()
  return { src: src ?? "", loaded }
}

test("library upload → hero image in the page editor → publish → public home", async ({ page, browser }) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)

  // 1. Upload in the library.
  await page.goto("/admin/media")
  await expect(page.getByRole("heading", { level: 1, name: "Media" })).toBeVisible()
  const png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#1f6f43" } }).png().toBuffer()
  await page.locator("[data-upload-input]").setInputFiles({ name: "e2e-hero.png", mimeType: "image/png", buffer: png })
  const details = page.getByRole("dialog", { name: "e2e-hero.png" })
  await expect(details).toBeVisible()
  await details.getByLabel("Alternative text").fill("E2E hero upload")
  await details.getByRole("button", { name: "Save details" }).click()
  await expect(page.getByText("File details saved.")).toBeVisible()
  const fileUrl = await details.getByRole("link", { name: "Open file" }).getAttribute("href")
  expect(fileUrl).toMatch(/^\/api\/v1\/media\/file\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/)
  const file = await page.request.get(fileUrl!)
  expect(file.status()).toBe(200)
  expect(file.headers()["cache-control"]).toBe("public, max-age=31536000, immutable")
  await page.keyboard.press("Escape")

  // 2. Pick it as the home hero.
  await page.goto("/admin/pages/home")
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible()
  const hero = page.getByRole("region", { name: "Hero" })
  await hero.getByRole("button", { name: "Change: Background image" }).click()
  const picker = page.getByRole("dialog", { name: "Choose: Background image" })
  await picker.getByRole("searchbox", { name: "Search images" }).fill("e2e-hero")
  await picker.getByRole("button", { name: "E2E hero upload" }).click()
  await picker.getByRole("button", { name: "Use this image" }).click()
  await expect(page.getByRole("status", { name: /^Save status/ })).toHaveText("Saved", { timeout: 10_000 })

  // 3. Publish.
  await page.getByRole("button", { name: "Publish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Publish changes?" })
  await expect(dialog.getByRole("list", { name: "Changes" })).toContainText("Background image")
  await dialog.getByRole("button", { name: "Publish now" }).click()
  await expect(dialog).toBeHidden()

  // 4. The public page uses the new image through the default optimizer.
  const { src, loaded } = await publicHero(browser)
  expect(src).toContain(encodeURIComponent(fileUrl!))
  expect(src.startsWith("/_next/image?url=")).toBe(true)
  expect(loaded).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project dom tests/dom/media-picker-upload.test.tsx`
Expected: FAIL — no "Upload new image" button.

- [ ] **Step 3: Implement**

Append to `components/admin/session-provider.tsx`:

```tsx
/** The session when rendered inside the admin shell, otherwise null (shared widgets in tests). */
export function useOptionalAdminSession(): AdminSession | null {
  return useContext(AdminSessionContext)
}
```

In `components/admin/media/picker-dialog.tsx`:

1. Imports — add `useQueryClient` to the `@tanstack/react-query` import, `Upload` to `lucide-react`, `useRef` to `react`, and:

```ts
import { useOptionalAdminSession } from "@/components/admin/session-provider"
import { hasPermission } from "@/lib/auth/permissions"
import { ACCEPTED_IMAGE_TYPES, type MediaItem } from "@/lib/schemas/api/media"

import { uploadMediaFile } from "./upload-request"
```

(replacing the existing `import type { MediaItem } …` line).

2. Doc comment: "Pick an image from the media library, or upload a new one (Phase 6)."

3. Inside the component, after the `useState` declarations:

```tsx
  const queryClient = useQueryClient()
  const session = useOptionalAdminSession()
  const canUpload = !!session && hasPermission(session.roles, { media: ["create"] })
  const fileInput = useRef<HTMLInputElement>(null)
  const [upload, setUpload] = useState<
    { name: string; progress: number; error?: undefined } | { name: string; error: string } | null
  >(null)

  const uploadFile = async (file: File) => {
    setUpload({ name: file.name, progress: 0 })
    try {
      const item = await uploadMediaFile(file, {
        onProgress: (progress) => setUpload({ name: file.name, progress }),
      })
      await queryClient.invalidateQueries({ queryKey: ["media"] })
      setQuery("")
      setPage(1)
      setChosen(item)
      setUpload(null)
    } catch (err) {
      setUpload({ name: file.name, error: errorMessage(err) })
    }
  }
```

and in the reset-on-open block (`if (open) { … }`) add `setUpload(null)`.

4. Replace the `<DialogDescription>` content with "Images in the media library. Upload a new one if it is not there yet." (keep the element), and directly **after** the search `<div className="relative">…</div>` insert:

```tsx
        {canUpload ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!upload && !upload.error}
              onClick={() => fileInput.current?.click()}
            >
              <Upload aria-hidden />
              Upload new image
            </Button>
            <input
              ref={fileInput}
              type="file"
              hidden
              tabIndex={-1}
              accept={ACCEPTED_IMAGE_TYPES}
              data-upload-input
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void uploadFile(file)
              }}
            />
            {upload && !upload.error ? (
              <span role="status" className="text-xs text-muted-foreground">
                Uploading {upload.name}… {Math.round(upload.progress * 100)}%
              </span>
            ) : upload?.error ? (
              <span role="alert" className="text-xs text-destructive">
                {upload.error}
              </span>
            ) : null}
          </div>
        ) : null}
```

5. Grid item label: replace `{item.alt || item.url.split("/").pop()}` with `{item.alt || item.originalName || item.url.split("/").pop()}` so new uploads show their file name.

The `onSelect`/"Use this image" flow is unchanged: the uploaded item becomes `chosen`, so "Use this image" is enabled and the grid (refetched, search cleared, page 1, newest first) shows it selected.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project dom tests/dom/media-picker-upload.test.tsx tests/dom/schema-form.test.tsx tests/dom/rich-text-editor.test.tsx`
Expected: PASS (4 new; Phase 4 SchemaForm/rich-text DOM tests unchanged — the picker renders without a session).

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: exit 0.

Run (port 3100 free, no other Playwright/build): `pnpm exec playwright test tests/e2e/media.spec.ts tests/e2e/page-editor.spec.ts`
Expected: PASS — the public hero `src` is `/_next/image?url=%2Fapi%2Fv1%2Fmedia%2Ffile%2F…png&w=…&q=75` and the image decodes (`naturalWidth > 0`). If `page-editor.spec.ts` runs after `media.spec.ts` and asserts the original hero image, it is unaffected (it checks the heading only).

Run: `pnpm test:visual`
Expected: all public baselines 0 px (seeded static media unchanged), admin shell baselines from Task 6 pass.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write components/admin/session-provider.tsx components/admin/media/picker-dialog.tsx tests/dom/media-picker-upload.test.tsx tests/e2e/media.spec.ts
git add components/admin/session-provider.tsx components/admin/media/picker-dialog.tsx tests/dom/media-picker-upload.test.tsx tests/e2e/media.spec.ts
git commit -m "feat: upload images from the media picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Move existing uploads to R2 — background job, route, progress (master Task 6.4)

**Files:**
- Create: `server/lib/jobs/migrate-media.ts`, `components/admin/integrations/migrate-media-panel.tsx`
- Modify: `server/lib/jobs/index.ts` (`JobResult.done`, `TRIGGERED_JOBS`, `ALL_JOBS`), `server/lib/scheduler.ts` (dispatch `ALL_JOBS`; delete a finished job's row), `server/modules/jobs/repo.ts` (`enqueueKeyedJob`, `findJobByKey`, `deleteClaimedJob`), `server/modules/media/{repo,service}.ts` (batch move, status, start), `lib/schemas/api/media.ts` (`MediaMigrationStatus`), `server/modules/integrations/routes.ts` (two routes), `app/(admin)/admin/(panel)/settings/integrations/[slug]/page.tsx` (panel on the R2 page)
- Test: `tests/integration/media/migrate-media.test.ts`, `tests/dom/migrate-media-panel.test.tsx`

**Interfaces:**
- Consumes: Phase 5 `tick({ now, jobs, revalidate })`, `JobDefinition`, `claimDueJobs`/`finishJob`, `jobs` table (`key` unique, `locked_at`, `last_error`, `last_run_at`); Task 3 `diskStorage`, `r2Storage`, `StorageDriver`; Task 1 `readIntegrationConfig`; Task 2 `IntegrationForm` `children` slot.
- Produces:

```ts
// server/lib/jobs/index.ts
export type JobResult = { tags?: string[]; warning?: string; done?: boolean }   // done → the job row is deleted
export const TRIGGERED_JOBS: readonly JobDefinition[]   // [migrateMediaJob] — dispatched by tick(), never auto-created
export const ALL_JOBS: readonly JobDefinition[]         // RECURRING_JOBS + TRIGGERED_JOBS (tick's default)
// server/lib/jobs/migrate-media.ts
export const MIGRATE_MEDIA_JOB = { name: "migrate-media", key: "migrate-media" } as const
export const MIGRATE_BUDGET_MS = 40_000
export const migrateMediaJob: JobDefinition       // everyMs 0: runs again on the next tick until done
// server/modules/jobs/repo.ts
export async function enqueueKeyedJob(db, job: { name; key; runAt: Date }): Promise<void>   // insert, or re-queue a waiting row (a running row is left alone)
export async function findJobByKey(db, key: string): Promise<JobRow | null>
export async function deleteClaimedJob(db, id: string, claimedAt: Date): Promise<void>
// server/modules/media/repo.ts
export function listDiskMediaBatch(db, opts: { limit: number; excludeIds: string[] })
export async function markMovedToR2(db, id: string, key: string): Promise<boolean>        // only while still disk with this key
// server/modules/media/service.ts
export async function migrateDiskMediaToR2(opts: { deadline: number; r2?: StorageDriver; disk?: StorageDriver; batchSize?: number }): Promise<{ moved: number; failed: string[]; remaining: number; configured: boolean }>
export async function getMediaMigrationStatus(actor): Promise<MediaMigrationStatus>    // integration:read
export async function startMediaMigration(actor): Promise<MediaMigrationStatus>        // integration:update; 422 when R2 is not set up
// lib/schemas/api/media.ts
export type MediaMigrationStatus = { r2Configured: boolean; onDisk: number; inR2: number; state: "idle" | "queued" | "running"; lastRunAt: string | null; lastError: string | null }
// HTTP
GET  /api/v1/admin/integrations/integrations.r2/migrate-media  → MediaMigrationStatus          integration:read
POST /api/v1/admin/integrations/integrations.r2/migrate-media  → 202 MediaMigrationStatus      integration:update
```

Rules (spec §11 "Migrate existing uploads to R2 (background job, idempotent)"): the route queues the keyed job `migrate-media` (runAt now) — re-queueing a waiting row resets it, a running row is not touched, so pressing twice never runs two migrations. Each run moves disk rows in batches of 20 for up to 40 s: read from disk → `PutObject` to R2 → flip `driver` to `r2` only if the row is still `disk` with the same key (a replace/delete in between wins: the copied object is deleted again) → delete the disk file (best effort). `static` rows are never touched. Keys stay the same, so URLs (`/api/v1/media/file/<key>`) and every cache entry stay valid — no tag to expire. A file missing on disk or failing to upload is skipped for the rest of the run and named in the warning (`jobs.last_error`); the job stays queued (runs again next tick) until no disk rows remain, then its row is deleted. If R2 is no longer configured the job ends (`done`) with that warning.

- [ ] **Step 1: Write the failing tests**

`tests/integration/media/migrate-media.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { MediaMigrationStatus } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import { jobs, media } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { ALL_JOBS } from "@/server/lib/jobs"
import { MIGRATE_MEDIA_JOB } from "@/server/lib/jobs/migrate-media"
import { tick } from "@/server/lib/scheduler"
import { diskStorage, type StorageDriver } from "@/server/lib/storage"
import { migrateDiskMediaToR2 } from "@/server/modules/media/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

/** In-memory R2 stand-in (the real driver is unit-tested in Task 3). */
function memoryR2(failKeys: string[] = []): StorageDriver & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>()
  return {
    name: "r2",
    objects,
    async put(key, body) {
      if (failKeys.includes(key)) throw new Error("R2 put failed")
      objects.set(key, body)
    },
    async read(key) {
      return objects.get(key) ?? null
    },
    async delete(key) {
      objects.delete(key)
    },
    url: (key) => `/api/v1/media/file/${key}`,
    async test() {},
  }
}

let root: string
let disk: StorageDriver
const KEYS = [1, 2, 3].map((n) => `2026/10/0190a6e0-0000-7000-8000-00000000000${n}.png`)

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  root = await mkdtemp(join(tmpdir(), "sp-migrate-"))
  disk = diskStorage(root)
  for (const key of KEYS) {
    await disk.put(key, new Uint8Array([1, 2, 3]), "image/png")
    await getDb().insert(media).values({ key, driver: "disk", mime: "image/png", size: 3 })
  }
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const drivers = async () =>
  Object.fromEntries(
    (await getDb().select({ key: media.key, driver: media.driver }).from(media)).map((r) => [r.key, r.driver])
  )

describe("migrateDiskMediaToR2 (master 6.4)", () => {
  it("moves disk files, flips the driver, keeps keys and skips static rows", async () => {
    const r2 = memoryR2()
    const result = await migrateDiskMediaToR2({ deadline: Date.now() + 30_000, r2, disk })
    expect(result).toEqual({ moved: 3, failed: [], remaining: 0, configured: true })
    const after = await drivers()
    for (const key of KEYS) {
      expect(after[key]).toBe("r2")
      expect([...(r2.objects.get(key) ?? [])]).toEqual([1, 2, 3])
      expect(await disk.read(key)).toBeNull()
    }
    expect(after["/images/hero.jpg"]).toBe("static")
  })

  it("is idempotent and reports failures without losing files", async () => {
    const r2 = memoryR2([KEYS[1]])
    const first = await migrateDiskMediaToR2({ deadline: Date.now() + 30_000, r2, disk })
    expect(first.moved).toBe(2)
    expect(first.failed).toEqual([expect.stringContaining("R2 put failed")])
    expect(first.remaining).toBe(1)
    expect(await disk.read(KEYS[1])).not.toBeNull()
    const again = await migrateDiskMediaToR2({ deadline: Date.now() + 30_000, r2: memoryR2(), disk })
    expect(again).toMatchObject({ moved: 1, remaining: 0 })
    expect(await migrateDiskMediaToR2({ deadline: Date.now() + 30_000, r2: memoryR2(), disk })).toMatchObject({ moved: 0, remaining: 0 })
  })

  it("stops at the deadline and continues later", async () => {
    const result = await migrateDiskMediaToR2({ deadline: Date.now() - 1, r2: memoryR2(), disk })
    expect(result).toMatchObject({ moved: 0, remaining: 3 })
  })

  it("does nothing when R2 is not configured", async () => {
    expect(await migrateDiskMediaToR2({ deadline: Date.now() + 30_000, disk })).toEqual({
      moved: 0,
      failed: [],
      remaining: 3,
      configured: false,
    })
  })
})

describe("migrate-media job + routes", () => {
  const status = async (cookie: string) => {
    const res = await adminRequest("/integrations/integrations.r2/migrate-media", { cookie })
    return { status: res.status, body: (await res.json()) as MediaMigrationStatus }
  }

  it("422 until R2 is set up; viewers and editors are refused", async () => {
    const owner = (await signedInUser(["owner"])).cookie
    const editor = (await signedInUser(["editor"])).cookie
    expect((await status(owner)).body).toMatchObject({ r2Configured: false, onDisk: 3, inR2: 0, state: "idle" })
    expect((await status(editor)).status).toBe(403)
    const start = await adminRequest("/integrations/integrations.r2/migrate-media", { cookie: owner, method: "POST" })
    expect(start.status).toBe(422)
  })

  it("queues one keyed job; a finished run deletes its row", async () => {
    const owner = (await signedInUser(["owner"])).cookie
    await adminRequest("/integrations/integrations.r2", {
      cookie: owner,
      method: "PUT",
      json: {
        version: 0,
        values: {
          accountId: "0123456789abcdef0123456789abcdef",
          jurisdiction: "default",
          bucket: "sp-media",
          accessKeyId: "AKID",
          secretAccessKey: "SECRET",
        },
      },
    })
    for (let i = 0; i < 2; i++) {
      const res = await adminRequest("/integrations/integrations.r2/migrate-media", { cookie: owner, method: "POST" })
      expect(res.status).toBe(202)
      expect(((await res.json()) as MediaMigrationStatus).state).toBe("queued")
    }
    expect(await getDb().select().from(jobs).where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))).toHaveLength(1)

    // Run the job with the in-memory R2 + temp disk (same definition, injected storage).
    const r2 = memoryR2()
    const job = {
      ...ALL_JOBS.find((j) => j.name === MIGRATE_MEDIA_JOB.name)!,
      run: async () => {
        const result = await migrateDiskMediaToR2({ deadline: Date.now() + 30_000, r2, disk })
        return { done: result.remaining === 0 }
      },
    }
    const [result] = await tick({ now: new Date(), jobs: [job], revalidate: async () => undefined })
    expect(result).toMatchObject({ name: "migrate-media", ok: true })
    expect(await getDb().select().from(jobs).where(eq(jobs.key, MIGRATE_MEDIA_JOB.key))).toEqual([])
    expect((await status(owner)).body).toMatchObject({ r2Configured: true, onDisk: 0, inR2: 3, state: "idle" })
  })
})
```

`tests/dom/migrate-media-panel.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MigrateMediaPanel } from "@/components/admin/integrations/migrate-media-panel"
import { makeQueryClient } from "@/components/admin/providers"
import { type AdminSession, AdminSessionProvider } from "@/components/admin/session-provider"
import type { MediaMigrationStatus } from "@/lib/schemas/api/media"

let current: MediaMigrationStatus
const methods: string[] = []

beforeEach(() => {
  methods.length = 0
  current = { r2Configured: true, onDisk: 4, inR2: 1, state: "idle", lastRunAt: null, lastError: null }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      methods.push(init?.method ?? "GET")
      if (init?.method === "POST") current = { ...current, state: "queued" }
      return new Response(JSON.stringify(current), {
        status: init?.method === "POST" ? 202 : 200,
        headers: { "content-type": "application/json" },
      })
    })
  )
})

const session: AdminSession = {
  user: { id: "u1", name: "O", email: "o@example.test", title: null, twoFactorEnabled: true },
  roles: ["owner"],
  impersonatedBy: null,
}

describe("MigrateMediaPanel", () => {
  it("shows counts and queues the move", async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <AdminSessionProvider value={session}>
          <MigrateMediaPanel />
        </AdminSessionProvider>
      </QueryClientProvider>
    )
    expect(await screen.findByText("4 files on the server disk · 1 in R2")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Move uploads to R2" }))
    await waitFor(() => expect(methods).toContain("POST"))
    expect(await screen.findByRole("status")).toHaveTextContent("Queued")
    expect(screen.getByRole("button", { name: "Move uploads to R2" })).toBeDisabled()
  })

  it("explains when R2 is not saved yet", async () => {
    current = { ...current, r2Configured: false }
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <AdminSessionProvider value={session}>
          <MigrateMediaPanel />
        </AdminSessionProvider>
      </QueryClientProvider>
    )
    expect(await screen.findByText("Save the R2 settings above first.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Move uploads to R2" })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration tests/integration/media/migrate-media.test.ts && pnpm exec vitest run --project dom tests/dom/migrate-media-panel.test.tsx`
Expected: FAIL — `migrateDiskMediaToR2`, `ALL_JOBS`, `MIGRATE_MEDIA_JOB` and `MigrateMediaPanel` do not exist; the routes answer 404/422.

- [ ] **Step 3: Scheduler extension (Phase 5 code)**

In `server/modules/jobs/repo.ts` append:

```ts
/**
 * Queues a keyed one-off job to run at `runAt`. A waiting row is re-queued
 * (runAt reset, last error cleared); a running row (locked) is left alone,
 * so triggering twice never runs two copies.
 */
export async function enqueueKeyedJob(
  db: DbOrTx,
  job: { name: string; key: string; runAt: Date }
): Promise<void> {
  await db
    .insert(jobs)
    .values(job)
    .onConflictDoUpdate({
      target: jobs.key,
      set: { name: job.name, runAt: job.runAt, lastError: null },
      setWhere: isNull(jobs.lockedAt),
    })
}

export async function findJobByKey(db: DbOrTx, key: string): Promise<JobRow | null> {
  const [row] = await db.select().from(jobs).where(eq(jobs.key, key))
  return row ?? null
}

/** Removes a finished one-off job (only while this claim still holds it). */
export async function deleteClaimedJob(db: DbOrTx, id: string, claimedAt: Date): Promise<void> {
  await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.lockedAt, claimedAt)))
}
```

In `server/lib/jobs/index.ts`: change `JobResult` to

```ts
/** `tags`: cache tags to expire; `warning`: recorded in jobs.last_error; `done`: one-off job finished → its row is deleted. */
export type JobResult = { tags?: string[]; warning?: string; done?: boolean }
```

add `import { migrateMediaJob } from "./migrate-media"` and append:

```ts
/** One-off jobs queued by a request (enqueueKeyedJob); tick() runs them, ensureRecurringJobs never creates them. */
export const TRIGGERED_JOBS: readonly JobDefinition[] = [migrateMediaJob]

/** Every handler tick() can dispatch. */
export const ALL_JOBS: readonly JobDefinition[] = [...RECURRING_JOBS, ...TRIGGERED_JOBS]
```

and update the `RECURRING_JOBS` comment to "(leads purge and backup come later)".

In `server/lib/scheduler.ts`:
- import `ALL_JOBS` (alongside `RECURRING_JOBS`, `JobDefinition`) and `deleteClaimedJob` (alongside `claimDueJobs`, `finishJob`, `upsertRecurringJob`);
- in `tick()`, default the definitions to `ALL_JOBS`: `const definitions = options.jobs ?? ALL_JOBS`;
- declare `let done = false` next to `let ok = true`, set `done = result.done === true` right after `const result = await definition.run(...)`;
- replace the `await finishJob(db, job.id, now, { … })` call with:

```ts
    if (ok && done) await deleteClaimedJob(db, job.id, now)
    else
      await finishJob(db, job.id, now, {
        runAt: new Date(
          now.getTime() + (ok && definition ? definition.everyMs : RETRY_DELAY_MS)
        ),
        lastRunAt: now,
        lastError: error?.slice(0, ERROR_MAX_LENGTH) ?? null,
        succeeded: ok,
      })
```

(`ensureRecurringJobs` keeps `RECURRING_JOBS`.) Re-run `pnpm test:integration tests/integration/scheduler` afterwards: the Phase 5 scheduler tests must still pass.

`server/lib/jobs/migrate-media.ts`:

```ts
import "server-only"

import { migrateDiskMediaToR2 } from "@/server/modules/media/service"

import type { JobDefinition } from "./index"

export const MIGRATE_MEDIA_JOB = { name: "migrate-media", key: "migrate-media" } as const
/** Work per tick, below the 60 s tick interval. */
export const MIGRATE_BUDGET_MS = 40_000

/**
 * Spec §11/§12: moves disk uploads to R2 in batches until none remain
 * (everyMs 0 → due again on the next tick). Keys do not change, so no
 * cache tag needs expiring.
 */
export const migrateMediaJob: JobDefinition = {
  ...MIGRATE_MEDIA_JOB,
  everyMs: 0,
  async run() {
    const result = await migrateDiskMediaToR2({ deadline: Date.now() + MIGRATE_BUDGET_MS })
    if (!result.configured)
      return { done: true, warning: "R2 is not configured any more; nothing was moved." }
    return {
      done: result.remaining === 0,
      warning: result.failed.length > 0 ? `Not moved: ${result.failed.join("; ")}` : undefined,
    }
  },
}
```

- [ ] **Step 4: Media service + routes + panel**

Append to `lib/schemas/api/media.ts`:

```ts
/** Settings ▸ Integrations ▸ R2 "Move uploads to R2" (master 6.4). */
export type MediaMigrationStatus = {
  r2Configured: boolean
  onDisk: number
  inR2: number
  state: "idle" | "queued" | "running"
  lastRunAt: string | null
  lastError: string | null
}
```

Append to `server/modules/media/repo.ts`:

```ts
export function listDiskMediaBatch(
  db: DbOrTx,
  opts: { limit: number; excludeIds: string[] }
) {
  return db
    .select({ id: media.id, key: media.key, mime: media.mime })
    .from(media)
    .where(
      and(
        eq(media.driver, "disk"),
        opts.excludeIds.length ? notInArray(media.id, opts.excludeIds) : undefined
      )
    )
    .orderBy(asc(media.createdAt), asc(media.id))
    .limit(opts.limit)
}

/** disk → r2 only while the row still holds this key on disk (replace/delete win). */
export async function markMovedToR2(db: DbOrTx, id: string, key: string): Promise<boolean> {
  const moved = await db
    .update(media)
    .set({ driver: "r2" })
    .where(and(eq(media.id, id), eq(media.driver, "disk"), eq(media.key, key)))
    .returning({ id: media.id })
  return moved.length > 0
}
```

(add `notInArray` to its `drizzle-orm` import).

Append to `server/modules/media/service.ts` (imports: `type MediaMigrationStatus` from `@/lib/schemas/api/media`; `countMediaByDriver, listDiskMediaBatch, markMovedToR2` from `./repo`; `diskStorage, r2Storage, type StorageDriver` from `@/server/lib/storage`; `readIntegrationConfig` from `@/server/modules/integrations/service`; `enqueueKeyedJob, findJobByKey` from `@/server/modules/jobs/repo`):

```ts
const MIGRATION_JOB = { name: "migrate-media", key: "migrate-media" } as const
const MIGRATION_BATCH = 20

/**
 * Moves disk files to R2 until `deadline` (master 6.4). Idempotent: rows
 * already in R2 are not disk rows any more; a re-run after a crash re-puts
 * the same key. Failures are skipped for this run and reported.
 */
export async function migrateDiskMediaToR2(opts: {
  deadline: number
  r2?: StorageDriver
  disk?: StorageDriver
  batchSize?: number
}): Promise<{ moved: number; failed: string[]; remaining: number; configured: boolean }> {
  const db = getDb()
  const disk = opts.disk ?? diskStorage()
  let r2 = opts.r2
  if (!r2) {
    const config = await readIntegrationConfig("integrations.r2", db)
    if (!config)
      return { moved: 0, failed: [], remaining: await countMediaByDriver(db, "disk"), configured: false }
    r2 = r2Storage(config)
  }
  let moved = 0
  const failed: string[] = []
  const skip: string[] = []
  while (Date.now() < opts.deadline) {
    const batch = await listDiskMediaBatch(db, { limit: opts.batchSize ?? MIGRATION_BATCH, excludeIds: skip })
    if (batch.length === 0) break
    for (const row of batch) {
      if (Date.now() >= opts.deadline) break
      try {
        const bytes = await disk.read(row.key)
        if (!bytes) throw new Error("file missing on the server disk")
        await r2.put(row.key, bytes, row.mime)
        if (await markMovedToR2(db, row.id, row.key)) {
          moved++
          await disk.delete(row.key).catch(() => undefined)
        } else {
          await r2.delete(row.key).catch(() => undefined)
        }
      } catch (err) {
        skip.push(row.id)
        failed.push(`${row.key}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  return { moved, failed, remaining: await countMediaByDriver(db, "disk"), configured: true }
}

async function migrationStatus(): Promise<MediaMigrationStatus> {
  const db = getDb()
  const [config, onDisk, inR2, job] = [
    await readIntegrationConfig("integrations.r2", db).catch(() => null),
    await countMediaByDriver(db, "disk"),
    await countMediaByDriver(db, "r2"),
    await findJobByKey(db, MIGRATION_JOB.key),
  ]
  return {
    r2Configured: config !== null,
    onDisk,
    inR2,
    state: !job ? "idle" : job.lockedAt ? "running" : "queued",
    lastRunAt: job?.lastRunAt?.toISOString() ?? null,
    lastError: job?.lastError ?? null,
  }
}

export async function getMediaMigrationStatus(actor: Actor): Promise<MediaMigrationStatus> {
  assertCan(actor, { integration: ["read"] })
  return migrationStatus()
}

/** Queues the keyed migrate-media job; the scheduler runs it within a minute. */
export async function startMediaMigration(actor: Actor): Promise<MediaMigrationStatus> {
  assertCan(actor, { integration: ["update"] })
  const db = getDb()
  if (!(await readIntegrationConfig("integrations.r2", db)))
    throw new AppError("VALIDATION_FAILED", "Set up R2 before moving uploads to it.")
  const onDisk = await countMediaByDriver(db, "disk")
  if (onDisk > 0) {
    await enqueueKeyedJob(db, { ...MIGRATION_JOB, runAt: new Date() })
    await writeAudit(db, actor, {
      action: "media.migration_started",
      entityType: "integration",
      entityId: "integrations.r2",
      diff: { onDisk },
    })
  }
  return migrationStatus()
}
```

(`MIGRATION_JOB` duplicates `MIGRATE_MEDIA_JOB` on purpose: the job module imports this service, so the service must not import the job module.)

In `server/modules/integrations/routes.ts`: add `import * as media from "@/server/modules/media/service"` and insert these two routes **before** the `.get("/:key", …)` route (literal paths first):

```ts
  .get("/integrations.r2/migrate-media", can({ integration: ["read"] }), async (c) =>
    c.json(await media.getMediaMigrationStatus(actorOf(c)), 200)
  )
  .post("/integrations.r2/migrate-media", can({ integration: ["update"] }), async (c) =>
    c.json(await media.startMediaMigration(actorOf(c)), 202)
  )
```

`components/admin/integrations/migrate-media-panel.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import { api, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"

const STATE_TEXT = {
  idle: null,
  queued: "Queued — starts within a minute.",
  running: "Moving files…",
} as const

/** R2 page: move files still on the server disk into the bucket (master 6.4). */
export function MigrateMediaPanel() {
  const queryClient = useQueryClient()
  const canStart = usePermission({ integration: ["update"] })
  const key = ["integrations", "r2", "migrate-media"] as const
  const status = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.integrations["integrations.r2"]["migrate-media"].$get()),
    refetchInterval: (query) => (query.state.data && query.state.data.state !== "idle" ? 5_000 : false),
  })
  const start = useMutation({
    mutationFn: () => unwrap(api.integrations["integrations.r2"]["migrate-media"].$post()),
    onSuccess: (next) => queryClient.setQueryData(key, next),
  })
  const data = status.data
  return (
    <section aria-labelledby="migrate-media" className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 id="migrate-media" className="font-semibold">Move existing uploads to R2</h2>
      {status.isError ? (
        <p role="alert" className="text-sm text-destructive">{errorMessage(status.error)}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <p className="text-sm">
            {data.onDisk} file{data.onDisk === 1 ? "" : "s"} on the server disk · {data.inR2} in R2
          </p>
          <p className="text-xs text-muted-foreground">
            Changing storage does not move old files. Moving keeps every link working; built-in site images stay where they are.
          </p>
          {!data.r2Configured ? (
            <p className="text-sm text-muted-foreground">Save the R2 settings above first.</p>
          ) : null}
          {STATE_TEXT[data.state] ? (
            <p role="status" className="text-sm">{STATE_TEXT[data.state]}</p>
          ) : null}
          {data.lastError ? (
            <p role="alert" className="text-sm text-destructive">{data.lastError}</p>
          ) : null}
          {data.lastRunAt ? (
            <p className="text-xs text-muted-foreground">Last run {formatDateTime(data.lastRunAt)}</p>
          ) : null}
          {canStart ? (
            <Button
              type="button"
              className="self-start"
              disabled={!data.r2Configured || data.onDisk === 0 || data.state !== "idle" || start.isPending}
              onClick={() => start.mutate()}
            >
              Move uploads to R2
            </Button>
          ) : null}
          {start.isError ? <p role="alert" className="text-sm text-destructive">{errorMessage(start.error)}</p> : null}
        </>
      )}
    </section>
  )
}
```

In `app/(admin)/admin/(panel)/settings/integrations/[slug]/page.tsx`: `import { MigrateMediaPanel } from "@/components/admin/integrations/migrate-media-panel"` and render `<IntegrationForm integrationKey={key}>{key === "integrations.r2" ? <MigrateMediaPanel /> : null}</IntegrationForm>`. Also invalidate the panel after an R2 save: in `integration-form.tsx`'s `accept()` add `void queryClient.invalidateQueries({ queryKey: ["integrations", "r2", "migrate-media"] })`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/media tests/integration/scheduler tests/integration/api/integrations.test.ts`
Expected: PASS (6 new; Phase 5 scheduler tests unchanged).

Run: `pnpm exec next typegen && pnpm exec vitest run --project dom tests/dom/migrate-media-panel.test.tsx tests/dom/integration-form.test.tsx`
Expected: PASS (2 new).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write server/lib/jobs server/lib/scheduler.ts server/modules/jobs/repo.ts server/modules/media lib/schemas/api/media.ts server/modules/integrations/routes.ts components/admin/integrations "app/(admin)/admin/(panel)/settings/integrations" tests/integration/media tests/dom/migrate-media-panel.test.tsx
git add server/lib/jobs server/lib/scheduler.ts server/modules/jobs/repo.ts server/modules/media lib/schemas/api/media.ts server/modules/integrations/routes.ts components/admin/integrations "app/(admin)/admin/(panel)/settings/integrations" tests/integration/media tests/dom/migrate-media-panel.test.tsx
git commit -m "feat: add background job to move uploads to R2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase gate (controller, after Task 8)

On a clean checkout of the branch HEAD, `pnpm db:up` (Postgres + Mailpit), port 3100 free, only one agent running Playwright/build:

- `pnpm lint && pnpm typecheck && pnpm test` → exit 0 (unit + dom + integration).
- `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` → exit 0.
- `pnpm test:visual` → every public baseline 0 px; admin shell baselines (re-captured in Task 6) pass.
- `pnpm test:e2e` → all specs pass, including `integrations.spec.ts` (Mailpit) and `media.spec.ts` (upload → hero → publish → public).
- Manual spot check: `grep -rn "console\." server/modules/integrations server/lib/r2-client.ts` → nothing logs config values; `select draft from settings where key like 'integrations.%'` shows only `v1:` ciphertexts for secret fields.
- Ledger notes for later phases: Phase 7 mailer reads `readIntegrationConfig("integrations.smtp")` (Mailpit default when unset in dev stays Phase 7's); Phase 7 Turnstile reads `integrations.turnstile` (`enabled`, `siteKey`); Phase 9 reads `integrations.ai` (`enabled`, `provider`, `model`, `apiKey`, `allowedRoles`); Phase 8 must add its settings keys to the revisions allow-list if it writes settings revisions; Phase 10 `secrets:rotate`/`db:sync` re-encrypt `INTEGRATIONS[key].secrets` with AAD `<key>.<field>` and the CI integration job needs Mailpit; launch doc: R2 bucket stays private (no public URL), API token needs Object Read & Write.
