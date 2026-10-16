# Phase 5 — Articles workflow

> Part of `docs/superpowers/plans/2026-10-16-dynamic-platform.md` (master, Phase 5 = Tasks 5.1–5.4). Spec: `docs/superpowers/specs/2026-10-16-dynamic-platform-design.md` (§5.1, §5.3, §5.6, §6.1, §7, §8.1–§8.2, §12, §15). Branch `feat/dynamic-platform`. Never push.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Global constraints that bind this phase**

- Public design is frozen: `pnpm test:visual` keeps every public baseline at 0 px (1440×900 and 390×844, macOS, port 3100 free). Seeded articles render byte-identical; the blog filter bar, featured post and pagination behave exactly as before. Only the **admin shell** baselines are re-captured (the sidebar gains "Articles").
- `next build` succeeds with no env vars and no database. The scheduler never starts during `next build` (Next skips `register()`; `startScheduler()` also checks `NEXT_PHASE`).
- Env vars: exactly `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (+ platform `NODE_ENV`, `PORT`, `HOSTNAME`). No new env var (the scheduler reads `PORT`).
- Every file under `server/` starts with `import "server-only"`. `lib/**` never imports `server/**` (except the type-only import in `lib/api-client.ts`).
- Repos are the only files outside `server/db/**`/`tests/**` importing `drizzle-orm`; routes never import repos.
- Hono handlers: validate (`zv`) → authorise (`can(...)`) → call a service. Services re-check permissions and ownership, audit every mutation, write revisions, keep `media_usages` exact in the same transaction and call `invalidate()` from request context only.
- Error envelope `{ error: { code, message, fieldErrors?, current?, requestId } }`; stale `version` → **409 with the current state** (Review Focus 2); an author publishing (or editing someone else's / a published article) via the API → **403** (Review Focus 5).
- Lists `?page&pageSize&sort=field:dir&q&<filters>` → `{ items, page, pageSize, total }`. IDs uuid v7; dates ISO 8601 UTC on the wire; shown in `Europe/Dublin`, `en-IE`.
- Library versions as installed (no new dependency in this phase).
- Code style: repo Prettier (no semicolons, double quotes, 80 cols). Run `pnpm exec prettier --write <files>` on files you create or edit.
- Commit after every task, staging only your paths; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git push`.
- Only one agent at a time runs Playwright (`test:visual`, `test:e2e`) or `next build` (ledger ruling).
- Phase ends green: `pnpm lint && pnpm typecheck && pnpm test && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` + `pnpm test:visual` + `pnpm test:e2e`.

**Prerequisites:** Phase 4 complete per `phase-04-admin.md` Tasks 1–12: `server/lib/versioning.ts` (`saveDraft`, `restoreRevision`, `validateContent`, `versionedDto`, `VersionedStore`, `VersionedPatch`), `server/lib/media-usages.ts`, `server/lib/pg-errors.ts`, `server/modules/revisions/*` (`insertRevision`), `lib/schemas/api/{content,search,preview}.ts`, `lib/json.ts`, `server/modules/{pages,search,preview,dashboard}/*`, `components/admin/{editor,rich-text,schema-form,data-table,media,services}/*`, `components/admin/filter-field.tsx` (Task 12), `hooks/{use-autosave,use-permission,use-debounced-value}.ts`, admin shell + `tests/visual/admin-shell.spec.ts` baselines, `tests/e2e/{seed,fixtures}.ts` with `owner`/`admin` (Task 12). Phase 4's plan code is the reference; where the real code differs, apply the same change to the real code and say so in your report.

**Ledger rulings applied:** scheduler cannot call `revalidateTag` → it POSTs to internal `/api/v1/internal/revalidate`, HMAC-signed with HKDF purpose `"cron"`; keyed recurring jobs upsert `ON CONFLICT (key) DO UPDATE` and are rescheduled in place; jobs claimed with `FOR UPDATE SKIP LOCKED`; revisions `UNIQUE(entity_type, entity_id, version)`; `media_usages` maintained in-tx (RESTRICT FK); byline cache: Better Auth `databaseHooks.user.update.after` → `invalidate(tag.articles)` and the users module's name/title updates do the same; author edits only own unpublished articles and never publishes (403 via API too); stale version → 409; read time 200 wpm, min 1; `scheduledAt` in the past → 422; schedule dialog in Europe/Dublin; revision pruning keeps the newest 50; scheduler not started during `next build`; rich-text links reject `{placeholder}` hrefs (ledger minor, folded into Task 3); `invalidate()` = `revalidateTag(tag, { expire: 0 })`; unknown article slug stays a soft 404 (Phase 8 restores the status); never cache `getDb()` at module scope; publish clears `scheduledAt` (Phase 4 `VersionedPatch` gains `scheduledAt`; `ArticlePatch` re-declares it with the same type, which is harmless); `server/lib/pg-errors.ts` (435f8be) is reused, not recreated; `draft_saved` audit rows are coalesced per actor + entity within 10 min (tests below assert sets of actions, never counts of draft saves); the version check precedes validation (409 before 422) — article transitions check the version before validating the draft or the schedule time.

**Verification note:** this plan was written against the Phase 4 plan (Tasks 3, 9 and 12 code checked against the files already in the working tree: `server/lib/versioning.ts`, `lib/schemas/api/content.ts`, `server/modules/revisions/*`, `server/modules/search/*`, `components/admin/shell/command-palette.tsx`). The code below was not executed (most Phase 4 files did not exist yet); run every step's command and fix mechanical drift.

## Corrections to master plan

- **Article input schemas/DTOs live in `lib/schemas/api/articles.ts`**, not `server/modules/articles/schema.ts` (Phase 2 ruling: API input schemas in `lib/schemas/api/*`, shared with the admin client) — cost: none.
- **Extra article routes:** `GET /articles/options` (categories + possible bylines), `PATCH /articles/:id/meta` (slug, category, byline — columns, live immediately like `PATCH /services/:id/slug`) and `POST /articles/:id/unschedule` (cancel a schedule) besides the spec's `/submit`, `/publish`, `/schedule`, `/unpublish` — cost: none.
- **Status semantics:** `status` is the draft's workflow state (`draft → in_review → scheduled/published`); public visibility is `published IS NOT NULL`. Editing a live article keeps `status = "published"` (+ `dirty`). An author may update/delete/submit their **own** article only while `published IS NULL` and `status ∈ {draft, in_review}` (a scheduled article is approved content → locked for authors). Publish keeps the first `publishedAt` (republishing an edit does not redate the post); unpublish clears it. The blog's featured article (pages.blog `featuredArticle`) cannot be unpublished, deleted or re-addressed (409) — otherwise the featured block would silently vanish from `/blog` — cost if wrong: an editor must change the featured article first.
- **`readTimeMinutes` (column) is the read time of the published body**, computed at publish (200 wpm, rounded up, min 1; `null` when the body is `null`, as for six seeded articles). The editor shows a live word count. Seeded rows keep their seeded values until an editor republishes them — cost: none (visual baselines use seeded data).
- **"Every transition audited + revision":** revision rows are written on create (v1) and on submit, publish, schedule, unschedule and unpublish (data = the draft at that version); autosaves write audit rows only. The article history drawer therefore lists workflow steps, not only publishes — cost: none.
- **Empty editor body is stored as `null`** (no words, no images → "no body" → the site shows the excerpt). The public renderer ignores empty paragraphs at the end of a rich-text doc (TipTap's trailing-node paragraph) — no seeded doc has one, so markup is unchanged — cost: none.
- **Rich-text links may not contain `{` or `}`** (`isSafeRichTextHref`, used by the schema, the editor's link extension and toolbar, and the renderer): placeholders are only interpolated in link *fields*, never inside formatted text (ledger minor P03-7) — cost: none (no seeded rich-text link).
- **⌘K inside the rich-text editor opens the link popover** (`preventDefault`), and the ⌘K palette ignores keydown events whose default was prevented — cost: none.
- **Master 5.1 split into Tasks 1–2** (byline invalidation is Task 2); **master 5.3 split into Tasks 4–5** (list/new vs editor) — cost: none.
- **Scheduler design:** two keyed recurring jobs — `publish-scheduled` (every tick) and `prune-revisions` (daily) — upserted each tick with `ON CONFLICT (key) DO UPDATE SET name` (schedule kept) and rescheduled in place; claim = one `UPDATE jobs … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`; a claim older than 10 min is taken over; failures → `last_error` + retry in 60 s. Due articles are found by `status = 'scheduled' AND scheduled_at <= now()` with row-level `FOR UPDATE SKIP LOCKED` (no per-article job rows to keep in sync). Internal revalidation: `POST /api/v1/internal/revalidate`, headers `x-sp-timestamp`/`x-sp-signature` = HMAC-SHA256 (HKDF `"cron"`) of `<timestamp>.<body>`, ±300 s; the scheduler calls `http://127.0.0.1:$PORT` — cost if wrong: a scheduled article only appears after the next unrelated invalidation (Phase 10 runbook: `HOSTNAME` must bind loopback, e.g. `0.0.0.0`).
- **Phase 4 component extensions (backwards compatible):** `VersionedEditor` accepts render-prop `actions`/`aside` (`EditorActionContext`) and a `status` formatter; the Phase 4 search test's "alarm" expectations gain the article "Key Holding Explained: … Alarm …"; the dashboard "review" item links to `/admin/articles?status=in_review` — cost: none.

---

### Task 1: Articles service + admin API (master Task 5.1, part 1)

**Files:**
- Create: `lib/rich-text/read-time.ts`, `lib/schemas/api/articles.ts`, `server/modules/articles/service.ts`, `server/modules/articles/routes.ts`
- Modify: `server/modules/articles/repo.ts` (admin rows, insert, optimistic update, delete, option lists), `lib/schemas/api/content.ts` (`REVISION_ENTITIES` + `"article"`), `server/modules/revisions/service.ts` (read permission for `article`), `server/api/app.ts` (mount `/articles`)
- Test: `tests/unit/read-time.test.ts`, `tests/integration/api/articles.test.ts`

**Interfaces:**
- Consumes: Phase 3 tables `articles, articleCategories, users, media, revisions, auditLog`, `articleContent`/`ArticleContent`, `RichTextDoc`, `tag`/`invalidate`, `seedContent`; Phase 4 `saveDraft`, `restoreRevision`, `validateContent`, `versionedDto`, `VersionedStore`, `VersionedPatch` (`server/lib/versioning.ts`), `syncMediaUsages`/`clearMediaUsages`, `insertRevision`, `pgErrorCode`/`UNIQUE_VIOLATION`, `findPageByKey` (`server/modules/pages/repo.ts`), `CONTENT_STATUSES`/`ContentStatus`/`VersionedDto`/`versionInput`/`draftInput`/`restoreInput`, `listQuery`/`sortParam`/`Paginated`, `idParam`; Phase 2 `hasPermission`/`parseRoles`, `writeAudit`, `can`/`actorOf`, `zv`, `AppError`/`conflict`/`forbidden`/`notFound`.
- Produces:

```ts
// lib/rich-text/read-time.ts (isomorphic)
export const WORDS_PER_MINUTE = 200
export function countTextWords(text: string): number
export function minutesFor(words: number): number                    // max(1, ceil(words / 200))
export function countWords(doc: RichTextDoc | null): number          // block texts; image alt and quote cite excluded
export function readTimeMinutes(doc: RichTextDoc | null): number | null
export function isEmptyDoc(doc: RichTextDoc | null): boolean         // no words and no images
// lib/schemas/api/articles.ts
export const articleListQuery /* listQuery + sort updatedAt|publishedAt|title|scheduledAt (default updatedAt:desc) + status? + category?: uuid + author?: uuid | "me" */
export const createArticleInput /* { slug, categoryId, authorId?: uuid | null, draft } */
export const articleMetaInput /* { version, slug?, categoryId?, authorId?: uuid | null } (at least one) */
export const scheduleInput /* { version, scheduledAt: ISO datetime } */
export const articleVersionQuery /* ?version= */
export type ArticlePermissions = { update; delete; submit; publish; changeAuthor: boolean }
export type ArticleDto = VersionedDto<ArticleContent> & { id; slug; title; live: boolean; category: { id; slug; name }; author: { id; name; title } | null; scheduledAt: string | null; readTimeMinutes: number | null; createdAt: string; permissions: ArticlePermissions }
export type ArticleListItem = Omit<ArticleDto, "draft" | "published">
export type ArticleOptions = { categories: { id; slug; name }[]; authors: { id; name; title }[] }
// server/modules/articles/service.ts
export function articlePermissions(actor, row): ArticlePermissions
export async function listArticlesAdmin(actor, query): Promise<Paginated<ArticleListItem>>
export async function getArticleAdmin(actor, id): Promise<ArticleDto>
export async function getArticleOptions(actor): Promise<ArticleOptions>
export async function createArticle(actor, input): Promise<ArticleDto>
export async function saveArticleDraft(actor, id, { draft, version }): Promise<ArticleDto>
export async function restoreArticle(actor, id, { revisionId, version }): Promise<ArticleDto>
export async function changeArticleMeta(actor, id, input): Promise<ArticleDto>
export async function submitArticle | publishArticle | unscheduleArticle | unpublishArticle(actor, id, { version }): Promise<ArticleDto>
export async function scheduleArticle(actor, id, { version, scheduledAt }): Promise<ArticleDto>
export async function deleteArticle(actor, id, { version }): Promise<{ ok: true }>
// HTTP (all under /api/v1/admin)
GET    /articles                 article:read    → Paginated<ArticleListItem>
GET    /articles/options         article:read    → ArticleOptions
POST   /articles                 article:create  → 201 ArticleDto
GET    /articles/:id             article:read    → ArticleDto
PUT    /articles/:id/draft       article:update  { draft, version }          (own unpublished for authors)
POST   /articles/:id/restore     article:update  { revisionId, version }
PATCH  /articles/:id/meta        article:update  { version, slug?, categoryId?, authorId? }
POST   /articles/:id/submit      article:submit  { version }   draft → in_review
POST   /articles/:id/publish     article:publish { version }   → published (invalidates articles + article:<slug>)
POST   /articles/:id/schedule    article:publish { version, scheduledAt }   (past → 422)
POST   /articles/:id/unschedule  article:publish { version }
POST   /articles/:id/unpublish   article:publish { version }   (invalidates)
DELETE /articles/:id?version=    article:delete               (own unpublished for authors)
GET    /revisions/article/:id    article:read
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/read-time.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  countTextWords,
  countWords,
  isEmptyDoc,
  minutesFor,
  readTimeMinutes,
} from "@/lib/rich-text/read-time"
import type { RichTextDoc } from "@/lib/schemas/common"

const text = (value: string) => ({ type: "text" as const, text: value })
const paragraph = (value: string) => ({
  type: "paragraph" as const,
  content: [text(value)],
})
const doc = (...content: RichTextDoc["content"]): RichTextDoc => ({
  type: "doc",
  content,
})
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(" ")

describe("read time (master 5.1: 200 words per minute, at least 1)", () => {
  it("rounds up and never shows less than a minute", () => {
    expect(minutesFor(1)).toBe(1)
    expect(minutesFor(200)).toBe(1)
    expect(minutesFor(201)).toBe(2)
    expect(minutesFor(450)).toBe(3)
    expect(readTimeMinutes(doc(paragraph(words(450))))).toBe(3)
    expect(readTimeMinutes(doc(paragraph("Hi")))).toBe(1)
  })

  it("has no read time without a body", () => {
    expect(readTimeMinutes(null)).toBeNull()
    expect(countWords(null)).toBe(0)
  })

  it("counts every block's text; marks inside a word do not split it", () => {
    const body = doc(
      {
        type: "heading",
        attrs: { level: 2 },
        content: [text("Two words")],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hel", marks: [{ type: "bold" }] },
          text("lo world"),
          { type: "hardBreak" },
          text("again"),
        ],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [paragraph("one item")] },
          { type: "listItem", content: [paragraph("two")] },
        ],
      },
      {
        type: "blockquote",
        attrs: { cite: "Not counted at all" },
        content: [paragraph("quoted words")],
      },
      {
        type: "image",
        attrs: {
          media: { mediaId: "00000000-0000-7000-8000-000000000001" },
          alt: "Alt text is not read",
        },
      }
    )
    // 2 + 3 (Hello world again) + 3 + 2
    expect(countWords(body)).toBe(10)
  })

  it("treats any whitespace (incl. no-break space) as a separator, keeps en-dashes", () => {
    expect(countTextWords("Monday–Friday  9 to 5\n")).toBe(4)
    expect(countTextWords("   ")).toBe(0)
  })

  it("knows an empty editor document", () => {
    expect(isEmptyDoc(null)).toBe(true)
    expect(isEmptyDoc(doc({ type: "paragraph" }))).toBe(true)
    expect(isEmptyDoc(doc(paragraph("  ")))).toBe(true)
    expect(isEmptyDoc(doc(paragraph("x")))).toBe(false)
    expect(
      isEmptyDoc(
        doc({
          type: "image",
          attrs: {
            media: { mediaId: "00000000-0000-7000-8000-000000000001" },
            alt: "",
          },
        })
      )
    ).toBe(false)
  })
})
```

`tests/integration/api/articles.test.ts`:

```ts
import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Hono runs outside Next here: record invalidations instead of revalidating.
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type {
  ArticleDto,
  ArticleListItem,
  ArticleOptions,
} from "@/lib/schemas/api/articles"
import type { RevisionSummary } from "@/lib/schemas/api/content"
import type { Paginated } from "@/lib/schemas/api/list"
import type { RichTextDoc } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import {
  articleCategories,
  articles,
  auditLog,
  media,
  revisions,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listMediaUsagesFor } from "@/server/modules/media/repo"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

type Who = { cookie: string; user: { id: string } }
type ErrorBody = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    current?: ArticleDto
  }
}

let editor: Who
let author: Who
let otherAuthor: Who
let viewer: Who
let intake: Who
let categoryId: string
let newsCategoryId: string
let coverId: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = await signedInUser(["editor"])
  author = await signedInUser(["author"])
  otherAuthor = await signedInUser(["author"])
  viewer = await signedInUser(["viewer"])
  intake = await signedInUser(["intake"])
  const db = getDb()
  const category = async (slug: string) => {
    const [row] = await db
      .select()
      .from(articleCategories)
      .where(eq(articleCategories.slug, slug))
    return row.id
  }
  categoryId = await category("mobile-patrols")
  newsCategoryId = await category("company-news")
  const [hero] = await db
    .select()
    .from(media)
    .where(eq(media.key, "/images/hero.jpg"))
  coverId = hero.id
  revalidateTag.mockClear()
})

const json = async <T>(res: Response) => (await res.json()) as T
const text = (value: string) => ({ type: "text" as const, text: value })
const paragraph = (value: string) => ({
  type: "paragraph" as const,
  content: [text(value)],
})
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(" ")
/** 449 words + a one-word heading = 450 words → 3 min at 200 wpm. */
const longBody: RichTextDoc = {
  type: "doc",
  content: [
    paragraph(words(449)),
    { type: "heading", attrs: { level: 2 }, content: [text("Summary")] },
  ],
}

const draftOf = (title: string, body: RichTextDoc | null = null) => ({
  title,
  excerpt: "What a night patrol covers.",
  cover: { mediaId: coverId },
  lead: null,
  tags: [],
  body,
})

const call = (who: Who, path: string, method = "GET", body?: unknown) =>
  adminRequest(path, { cookie: who.cookie, method, json: body })

async function create(
  who: Who,
  slug = "night-patrols",
  body: RichTextDoc | null = null
) {
  const res = await call(who, "/articles", "POST", {
    slug,
    categoryId,
    draft: draftOf("Night Patrols", body),
  })
  expect(res.status).toBe(201)
  return json<ArticleDto>(res)
}

const saveDraft = (
  who: Who,
  article: { id: string; draft: unknown },
  version: number,
  title = "Night Patrols, updated"
) =>
  call(who, `/articles/${article.id}/draft`, "PUT", {
    draft: { ...(article.draft as object), title },
    version,
  })

const step = (
  who: Who,
  id: string,
  action: "submit" | "publish" | "unschedule" | "unpublish",
  version: number
) => call(who, `/articles/${id}/${action}`, "POST", { version })

async function row(slug: string) {
  const [found] = await getDb()
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
  return found
}

async function auditActions(id: string) {
  const rows = await getDb()
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(eq(auditLog.entityId, id))
  return rows.map((r) => r.action).sort()
}

async function revisionVersions(id: string) {
  const rows = await getDb()
    .select({ version: revisions.version })
    .from(revisions)
    .where(
      and(eq(revisions.entityType, "article"), eq(revisions.entityId, id))
    )
  return rows.map((r) => r.version).sort((a, b) => a - b)
}

describe("articles API (master 5.1)", () => {
  it("an author creates a draft under their own byline", async () => {
    const article = await create(author)
    expect(article).toMatchObject({
      slug: "night-patrols",
      title: "Night Patrols",
      status: "draft",
      version: 1,
      live: false,
      published: null,
      dirty: true,
      author: { id: author.user.id },
      category: { id: categoryId, slug: "mobile-patrols" },
      permissions: {
        update: true,
        delete: true,
        submit: true,
        publish: false,
        changeAuthor: false,
      },
    })
    expect(
      await listMediaUsagesFor(getDb(), "article", article.id)
    ).toEqual([{ mediaId: coverId, field: "cover" }])
    expect(revalidateTag).not.toHaveBeenCalled()

    const asSomeoneElse = await call(author, "/articles", "POST", {
      slug: "under-another-name",
      categoryId,
      authorId: editor.user.id,
      draft: draftOf("Not mine"),
    })
    expect(asSomeoneElse.status).toBe(403)

    const forAuthor = await call(editor, "/articles", "POST", {
      slug: "for-the-author",
      categoryId,
      authorId: author.user.id,
      draft: draftOf("Written for the author"),
    })
    expect(forAuthor.status).toBe(201)
    expect((await json<ArticleDto>(forAuthor)).author?.id).toBe(
      author.user.id
    )
  })

  it("validates the address, category and fields; stores an empty body as none", async () => {
    expect(
      (
        await call(author, "/articles", "POST", {
          slug: "Bad Slug",
          categoryId,
          draft: draftOf("x"),
        })
      ).status
    ).toBe(422)
    const clash = await call(author, "/articles", "POST", {
      slug: "key-holding-explained",
      categoryId,
      draft: draftOf("x"),
    })
    expect(clash.status).toBe(409)
    expect((await json<ErrorBody>(clash)).error.fieldErrors?.slug).toBeTruthy()
    const noCategory = await call(author, "/articles", "POST", {
      slug: "no-category",
      categoryId: "00000000-0000-7000-8000-000000000999",
      draft: draftOf("x"),
    })
    expect(noCategory.status).toBe(422)
    expect(
      Object.keys((await json<ErrorBody>(noCategory)).error.fieldErrors ?? {})
    ).toEqual(["categoryId"])
    const noTitle = await call(author, "/articles", "POST", {
      slug: "no-title",
      categoryId,
      draft: draftOf(""),
    })
    expect((await json<ErrorBody>(noTitle)).error.fieldErrors).toEqual({
      title: ["Required"],
    })

    const emptyBody = await create(author, "empty-body", {
      type: "doc",
      content: [{ type: "paragraph" }],
    })
    expect(emptyBody.draft.body).toBeNull()
  })

  it("author: saves own draft, submits it for review, keeps editing in review", async () => {
    const article = await create(author)
    const saved = await saveDraft(author, article, 1)
    expect(saved.status).toBe(200)
    expect((await json<ArticleDto>(saved)).version).toBe(2)

    const submitted = await step(author, article.id, "submit", 2)
    expect(submitted.status).toBe(200)
    expect(await json<ArticleDto>(submitted)).toMatchObject({
      status: "in_review",
      version: 3,
      live: false,
    })
    expect((await step(author, article.id, "submit", 3)).status).toBe(409)

    const edited = await saveDraft(author, article, 3, "Reviewed title")
    expect(await json<ArticleDto>(edited)).toMatchObject({
      status: "in_review",
      version: 4,
      title: "Reviewed title",
    })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("Review Focus 5: an author cannot publish via the API, nor edit others' or published articles", async () => {
    const mine = await create(author)
    for (const action of ["publish", "unpublish", "unschedule"] as const) {
      const res = await step(author, mine.id, action, 1)
      expect(res.status).toBe(403)
      expect((await json<ErrorBody>(res)).error.code).toBe("FORBIDDEN")
    }
    expect(
      (
        await call(author, `/articles/${mine.id}/schedule`, "POST", {
          version: 1,
          scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
      ).status
    ).toBe(403)

    // Someone else's draft: readable, not writable.
    expect((await call(otherAuthor, `/articles/${mine.id}`)).status).toBe(200)
    expect((await saveDraft(otherAuthor, mine, 1)).status).toBe(403)
    expect((await step(otherAuthor, mine.id, "submit", 1)).status).toBe(403)
    expect(
      (await call(otherAuthor, `/articles/${mine.id}?version=1`, "DELETE"))
        .status
    ).toBe(403)

    // A seeded, published article under another byline.
    const live = await row("mobile-patrols-protect-your-business-after-hours")
    expect(
      (await saveDraft(author, { id: live.id, draft: live.draft }, live.version))
        .status
    ).toBe(403)

    // Their own article once an editor published it.
    expect((await step(editor, mine.id, "publish", 1)).status).toBe(200)
    expect((await saveDraft(author, mine, 2)).status).toBe(403)
    expect(
      (await call(author, `/articles/${mine.id}?version=2`, "DELETE")).status
    ).toBe(403)
    const view = await json<ArticleDto>(
      await call(author, `/articles/${mine.id}`)
    )
    expect(view.permissions).toEqual({
      update: false,
      delete: false,
      submit: false,
      publish: false,
      changeAuthor: false,
    })
    expect((await row("night-patrols")).version).toBe(2)
  })

  it("an editor publishes: live copy, read time, revision, cache tags; republishing keeps the date", async () => {
    const article = await create(author, "night-patrols", longBody)
    const res = await step(editor, article.id, "publish", 1)
    expect(res.status).toBe(200)
    const published = await json<ArticleDto>(res)
    expect(published).toMatchObject({
      status: "published",
      version: 2,
      live: true,
      dirty: false,
      readTimeMinutes: 3,
      scheduledAt: null,
    })
    expect(published.publishedAt).not.toBeNull()
    expect(published.published).toEqual(published.draft)
    expect(revalidateTag.mock.calls).toEqual([
      ["articles", { expire: 0 }],
      ["article:night-patrols", { expire: 0 }],
    ])

    const edited = await json<ArticleDto>(
      await saveDraft(editor, published, 2, "Night Patrols (2026 edition)")
    )
    expect(edited).toMatchObject({ status: "published", dirty: true })
    const again = await json<ArticleDto>(
      await step(editor, article.id, "publish", 3)
    )
    expect(again.publishedAt).toBe(published.publishedAt)
    expect(again.published?.title).toBe("Night Patrols (2026 edition)")
    expect(await revisionVersions(article.id)).toEqual([1, 2, 4])
  })

  it("rejects stale versions with 409 and the current state (Review Focus 2)", async () => {
    const article = await create(author)
    expect((await saveDraft(author, article, 1, "First")).status).toBe(200)
    const stale = await saveDraft(author, article, 1, "Second")
    expect(stale.status).toBe(409)
    const body = await json<ErrorBody>(stale)
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.current).toMatchObject({ version: 2, title: "First" })
    expect((await step(editor, article.id, "publish", 1)).status).toBe(409)
    expect((await row("night-patrols")).published).toBeNull()
  })

  it("schedules for a future time only (422 in the past) and unschedules", async () => {
    const article = await create(author)
    const path = `/articles/${article.id}/schedule`
    const past = await call(editor, path, "POST", {
      version: 1,
      scheduledAt: "2020-01-01T09:00:00Z",
    })
    expect(past.status).toBe(422)
    expect((await json<ErrorBody>(past)).error.fieldErrors).toEqual({
      scheduledAt: ["Choose a time in the future"],
    })
    expect(
      (await call(editor, path, "POST", { version: 1, scheduledAt: "tomorrow" }))
        .status
    ).toBe(422)

    const at = new Date(Date.now() + 86_400_000).toISOString()
    const scheduled = await json<ArticleDto>(
      await call(editor, path, "POST", { version: 1, scheduledAt: at })
    )
    expect(scheduled).toMatchObject({
      status: "scheduled",
      scheduledAt: at,
      live: false,
      version: 2,
    })
    expect(revalidateTag).not.toHaveBeenCalled()
    // Approved content is locked for its author until it is unscheduled.
    expect((await saveDraft(author, article, 2)).status).toBe(403)

    const cancelled = await json<ArticleDto>(
      await step(editor, article.id, "unschedule", 2)
    )
    expect(cancelled).toMatchObject({
      status: "draft",
      scheduledAt: null,
      version: 3,
    })
    expect((await step(editor, article.id, "unschedule", 3)).status).toBe(409)
  })

  it("unpublishes (off the site, back to draft) but protects the blog's featured article", async () => {
    const live = await row("mobile-patrols-protect-your-business-after-hours")
    const res = await step(editor, live.id, "unpublish", live.version)
    expect(res.status).toBe(200)
    expect(await json<ArticleDto>(res)).toMatchObject({
      status: "draft",
      live: false,
      publishedAt: null,
    })
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual([
      "articles",
      "article:mobile-patrols-protect-your-business-after-hours",
    ])

    const featured = await row("18-years-of-watching-over-ireland")
    const blocked = await step(editor, featured.id, "unpublish", featured.version)
    expect(blocked.status).toBe(409)
    expect((await json<ErrorBody>(blocked)).error.message).toContain(
      "featured"
    )
  })

  it("changes address, category and byline (live at once) with the usual guards", async () => {
    const article = await create(author)
    await step(editor, article.id, "publish", 1)
    revalidateTag.mockClear()
    const moved = await call(editor, `/articles/${article.id}/meta`, "PATCH", {
      version: 2,
      slug: "night-patrol-guide",
      categoryId: newsCategoryId,
      authorId: otherAuthor.user.id,
    })
    expect(moved.status).toBe(200)
    expect(await json<ArticleDto>(moved)).toMatchObject({
      slug: "night-patrol-guide",
      version: 3,
      category: { id: newsCategoryId },
      author: { id: otherAuthor.user.id },
    })
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual([
      "articles",
      "article:night-patrols",
      "article:night-patrol-guide",
    ])

    const clash = await call(editor, `/articles/${article.id}/meta`, "PATCH", {
      version: 3,
      slug: "key-holding-explained",
    })
    expect(clash.status).toBe(409)
    expect((await json<ErrorBody>(clash)).error.fieldErrors?.slug).toBeTruthy()

    const featured = await row("18-years-of-watching-over-ireland")
    expect(
      (
        await call(editor, `/articles/${featured.id}/meta`, "PATCH", {
          version: featured.version,
          slug: "eighteen-years",
        })
      ).status
    ).toBe(409)

    const draft = await create(author, "author-draft")
    expect(
      (
        await call(author, `/articles/${draft.id}/meta`, "PATCH", {
          version: 1,
          categoryId: newsCategoryId,
        })
      ).status
    ).toBe(200)
    expect(
      (
        await call(author, `/articles/${draft.id}/meta`, "PATCH", {
          version: 2,
          authorId: editor.user.id,
        })
      ).status
    ).toBe(403)
    expect(
      (await call(author, `/articles/${draft.id}/meta`, "PATCH", { version: 2 }))
        .status
    ).toBe(422)
  })

  it("deletes own drafts (author) or any article (editor), checking the version", async () => {
    const article = await create(author)
    expect(
      (await call(author, `/articles/${article.id}?version=9`, "DELETE"))
        .status
    ).toBe(409)
    expect(
      (await call(author, `/articles/${article.id}?version=1`, "DELETE"))
        .status
    ).toBe(200)
    expect(await listMediaUsagesFor(getDb(), "article", article.id)).toEqual(
      []
    )
    expect((await call(author, `/articles/${article.id}`)).status).toBe(404)
    expect(revalidateTag).not.toHaveBeenCalled()

    const live = await row("key-holding-explained")
    expect(
      (
        await call(
          editor,
          `/articles/${live.id}?version=${live.version}`,
          "DELETE"
        )
      ).status
    ).toBe(200)
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual([
      "articles",
      "article:key-holding-explained",
    ])
  })

  it("lists with status, category, author and text filters; intake cannot read", async () => {
    await create(author, "first-draft")
    const second = await create(author, "second-draft")
    await step(author, second.id, "submit", 1)

    const mine = await json<Paginated<ArticleListItem>>(
      await call(author, "/articles?author=me")
    )
    expect(mine.total).toBe(2)
    expect(mine.items.map((a) => a.slug).sort()).toEqual([
      "first-draft",
      "second-draft",
    ])
    expect(mine.items[0]).not.toHaveProperty("draft")

    const queue = await json<Paginated<ArticleListItem>>(
      await call(editor, "/articles?status=in_review")
    )
    expect(queue.items.map((a) => a.slug)).toEqual(["second-draft"])

    const patrols = await json<Paginated<ArticleListItem>>(
      await call(viewer, `/articles?category=${categoryId}&pageSize=50`)
    )
    expect(patrols.items.map((a) => a.slug)).toContain(
      "mobile-patrols-protect-your-business-after-hours"
    )
    expect(
      patrols.items.every((a) => !a.permissions.update && !a.permissions.publish)
    ).toBe(true)

    const search = await json<Paginated<ArticleListItem>>(
      await call(editor, "/articles?q=open%20up")
    )
    expect(search.items.map((a) => a.slug)).toEqual([
      "open-up-lock-up-keeps-staff-safe",
    ])

    expect((await call(intake, "/articles")).status).toBe(403)
    expect((await call(editor, "/articles?status=nope")).status).toBe(422)
  })

  it("options: categories for every reader, possible bylines for editors only", async () => {
    const forAuthor = await json<ArticleOptions>(
      await call(author, "/articles/options")
    )
    expect(forAuthor.categories.map((c) => c.slug)).toContain("mobile-patrols")
    expect(forAuthor.authors).toEqual([])

    const forEditor = await json<ArticleOptions>(
      await call(editor, "/articles/options")
    )
    const ids = forEditor.authors.map((a) => a.id)
    expect(ids).toEqual(
      expect.arrayContaining([editor.user.id, author.user.id])
    )
    // The seeded byline (no-login account) stays selectable.
    expect(forEditor.authors.map((a) => a.name)).toContain("Michael McDonald")
    expect(ids).not.toContain(viewer.user.id)
  })

  it("audits and snapshots every transition; history restores into the draft", async () => {
    const article = await create(author) // v1 (revision)
    await saveDraft(author, article, 1, "Second title") // v2 (no revision)
    await step(author, article.id, "submit", 2) // v3
    await step(editor, article.id, "publish", 3) // v4
    await step(editor, article.id, "unpublish", 4) // v5
    expect(await auditActions(article.id)).toEqual(
      [
        "article.created",
        "article.draft_saved",
        "article.submitted",
        "article.published",
        "article.unpublished",
      ].sort()
    )
    expect(await revisionVersions(article.id)).toEqual([1, 3, 4, 5])

    const history = await json<{ items: RevisionSummary[] }>(
      await call(viewer, `/revisions/article/${article.id}`)
    )
    expect(history.items.map((r) => r.version)).toEqual([5, 4, 3, 1])
    expect(
      (await call(intake, `/revisions/article/${article.id}`)).status
    ).toBe(403)

    const first = history.items.find((r) => r.version === 1)!
    const restored = await call(author, `/articles/${article.id}/restore`, "POST", {
      revisionId: first.id,
      version: 5,
    })
    expect(restored.status).toBe(200)
    expect(await json<ArticleDto>(restored)).toMatchObject({
      version: 6,
      title: "Night Patrols",
      status: "draft",
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/read-time.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/rich-text/read-time"`.

Run: `pnpm test:integration tests/integration/api/articles.test.ts`
Expected: FAIL — `/api/v1/admin/articles` answers 404 `Route not found` (the test's imports from `lib/schemas/api/articles` are type-only).

- [ ] **Step 3: Read time and API schemas**

`lib/rich-text/read-time.ts`:

```ts
import type {
  InlineNode,
  ParagraphNode,
  RichTextBlock,
  RichTextDoc,
} from "@/lib/schemas/common"

// "N min read" for articles (spec §5.3: computed from the body).

export const WORDS_PER_MINUTE = 200

/** Words in plain text: runs of non-whitespace (no-break spaces separate too). */
export function countTextWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** Rounded up, at least one minute. */
export function minutesFor(words: number): number {
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

// Text nodes of one block join without a separator (marks may split a
// word); a hard break separates like a space.
function inlineText(nodes: InlineNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (node.type === "text" ? node.text : " "))
    .join("")
}

function paragraphsText(paragraphs: ParagraphNode[]): string {
  return paragraphs.map((p) => inlineText(p.content)).join(" ")
}

function blockText(block: RichTextBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return inlineText(block.content)
    case "bulletList":
    case "orderedList":
      return block.content.map((item) => paragraphsText(item.content)).join(" ")
    case "blockquote":
      // The cite is attribution, not reading.
      return paragraphsText(block.content)
    case "image":
      return ""
  }
}

/** Words a reader reads: every block's text (image alt and quote cite excluded). */
export function countWords(doc: RichTextDoc | null): number {
  if (!doc) return 0
  return countTextWords(doc.content.map(blockText).join(" "))
}

/** Minutes at 200 words per minute; null without a body (not shown). */
export function readTimeMinutes(doc: RichTextDoc | null): number | null {
  if (!doc) return null
  return minutesFor(countWords(doc))
}

/** No words and no images: what an emptied editor leaves behind. */
export function isEmptyDoc(doc: RichTextDoc | null): boolean {
  if (!doc) return true
  return (
    countWords(doc) === 0 && !doc.content.some((block) => block.type === "image")
  )
}
```

`lib/schemas/api/articles.ts`:

```ts
import { z } from "zod"

import { slug } from "@/lib/schemas/common"
import type { ArticleContent } from "@/lib/schemas/content/article"

import { CONTENT_STATUSES, type VersionedDto, versionInput } from "./content"
import { listQuery, sortParam } from "./list"

/** GET /articles — filters for the admin list and the review queue. */
export const articleListQuery = listQuery.extend({
  sort: sortParam(["updatedAt", "publishedAt", "title", "scheduledAt"], {
    field: "updatedAt",
    dir: "desc",
  }),
  status: z.enum(CONTENT_STATUSES).optional(),
  category: z.uuid().optional(),
  /** A user id, or "me" for the signed-in user. */
  author: z.union([z.literal("me"), z.uuid()]).optional(),
})
export type ArticleListQuery = z.output<typeof articleListQuery>

/** POST /articles — the draft is validated against articleContent by the service. */
export const createArticleInput = z.object({
  slug,
  categoryId: z.uuid(),
  /** Editors pick the byline (null = none); authors always write as themselves. Omit → the signed-in user. */
  authorId: z.uuid().nullable().optional(),
  draft: z.unknown(),
})

/** PATCH /articles/:id/meta — columns outside the draft; they change the site at once. */
export const articleMetaInput = versionInput
  .extend({
    slug: slug.optional(),
    categoryId: z.uuid().optional(),
    authorId: z.uuid().nullable().optional(),
  })
  .refine(
    (v) =>
      v.slug !== undefined ||
      v.categoryId !== undefined ||
      v.authorId !== undefined,
    { message: "Nothing to change" }
  )

/** POST /articles/:id/schedule — an ISO 8601 instant (UTC or with an offset). */
export const scheduleInput = versionInput.extend({
  scheduledAt: z.iso.datetime({ offset: true }),
})

/** DELETE /articles/:id?version= */
export const articleVersionQuery = z.object({
  version: z.coerce.number().int().min(1),
})

/** What the signed-in user may do with one article (the API checks again). */
export type ArticlePermissions = {
  update: boolean
  delete: boolean
  submit: boolean
  publish: boolean
  /** Pick someone else's byline (editors and up). */
  changeAuthor: boolean
}

export type ArticleDto = VersionedDto<ArticleContent> & {
  id: string
  slug: string
  title: string
  /** True while the site shows a published version. */
  live: boolean
  category: { id: string; slug: string; name: string }
  author: { id: string; name: string; title: string | null } | null
  scheduledAt: string | null
  /** Of the published body (what the site shows); null without a body. */
  readTimeMinutes: number | null
  createdAt: string
  permissions: ArticlePermissions
}

export type ArticleListItem = Omit<ArticleDto, "draft" | "published">

export type ArticleOptions = {
  categories: { id: string; slug: string; name: string }[]
  /** Possible bylines (only for users who may change them; else empty). */
  authors: { id: string; name: string; title: string | null }[]
}
```

- [ ] **Step 4: Repository (full file)**

`server/modules/articles/repo.ts`:

```ts
import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNotNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import type { ContentStatus } from "@/lib/schemas/api/content"
import type { Sort } from "@/lib/schemas/api/list"
import type { ArticleContent } from "@/lib/schemas/content/article"
import type { DbOrTx } from "@/server/db/client"
import { articleCategories, articles, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

// ---------------------------------------------------------------- public site

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

// ---------------------------------------------------------------- admin

const authors = alias(users, "article_author")
const editors = alias(users, "article_editor")

const adminColumns = {
  ...getTableColumns(articles),
  categoryName: articleCategories.name,
  categorySlug: articleCategories.slug,
  authorName: authors.name,
  authorTitle: authors.title,
  updatedByName: editors.name,
}

function adminQuery(db: DbOrTx) {
  return db
    .select(adminColumns)
    .from(articles)
    .innerJoin(articleCategories, eq(articleCategories.id, articles.categoryId))
    .leftJoin(authors, eq(authors.id, articles.authorId))
    .leftJoin(editors, eq(editors.id, articles.updatedBy))
}

/** One article with its category, byline and last editor (admin editor). */
export async function findArticleForEdit(db: DbOrTx, id: string) {
  const [row] = await adminQuery(db).where(eq(articles.id, id))
  return row ?? null
}

export type ArticleEditRow = NonNullable<
  Awaited<ReturnType<typeof findArticleForEdit>>
>

const title = sql<string>`${articles.draft}->>'title'`
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

export type ArticleSortField = "updatedAt" | "publishedAt" | "title" | "scheduledAt"

/** Admin list: filters, text search on title/slug, sort, pagination. */
export async function listArticlesForAdmin(
  db: DbOrTx,
  opts: {
    q?: string
    status?: ContentStatus
    categoryId?: string
    authorId?: string
    sort: Sort<ArticleSortField>
    page: number
    pageSize: number
  }
) {
  const conditions: SQL[] = []
  if (opts.q) {
    const pattern = `%${escapeLike(opts.q)}%`
    conditions.push(or(ilike(title, pattern), ilike(articles.slug, pattern))!)
  }
  if (opts.status) conditions.push(eq(articles.status, opts.status))
  if (opts.categoryId) conditions.push(eq(articles.categoryId, opts.categoryId))
  if (opts.authorId) conditions.push(eq(articles.authorId, opts.authorId))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [{ total }] = await db
    .select({ total: count() })
    .from(articles)
    .where(where)
  const column =
    opts.sort.field === "title"
      ? title
      : opts.sort.field === "publishedAt"
        ? articles.publishedAt
        : opts.sort.field === "scheduledAt"
          ? articles.scheduledAt
          : articles.updatedAt
  const order =
    opts.sort.dir === "asc"
      ? sql`${column} asc nulls last`
      : sql`${column} desc nulls last`
  const rows = await adminQuery(db)
    .where(where)
    .orderBy(order, asc(articles.slug))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

export async function insertArticle(
  db: DbOrTx,
  values: {
    slug: string
    categoryId: string
    authorId: string | null
    draft: ArticleContent
    updatedBy: string
  }
): Promise<string> {
  const [row] = await db
    .insert(articles)
    .values({ ...values, status: "draft" })
    .returning({ id: articles.id })
  return row.id
}

/** Versioned columns plus the article's own (all optional except via the caller). */
export type ArticlePatch = Omit<VersionedPatch<ArticleContent>, "updatedBy"> & {
  updatedBy?: string | null
  scheduledAt?: Date | null
  readTimeMinutes?: number | null
  slug?: string
  categoryId?: string
  authorId?: string | null
}

/** Optimistic-lock update: only when `version` is current; null otherwise. */
export async function updateArticleIfVersion(
  db: DbOrTx,
  id: string,
  version: number,
  patch: ArticlePatch
): Promise<ArticleEditRow | null> {
  const [updated] = await db
    .update(articles)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(articles.id, id), eq(articles.version, version)))
    .returning({ id: articles.id })
  return updated ? findArticleForEdit(db, id) : null
}

export async function deleteArticleIfVersion(
  db: DbOrTx,
  id: string,
  version: number
): Promise<boolean> {
  const rows = await db
    .delete(articles)
    .where(and(eq(articles.id, id), eq(articles.version, version)))
    .returning({ id: articles.id })
  return rows.length > 0
}

export async function categoryExists(db: DbOrTx, id: string) {
  const [row] = await db
    .select({ id: articleCategories.id })
    .from(articleCategories)
    .where(eq(articleCategories.id, id))
  return Boolean(row)
}

export async function userExists(db: DbOrTx, id: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
  return Boolean(row)
}

export function listCategoryOptions(db: DbOrTx) {
  return db
    .select({
      id: articleCategories.id,
      slug: articleCategories.slug,
      name: articleCategories.name,
    })
    .from(articleCategories)
    .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.name))
}

/** Every user with what a byline needs (filtered by role in the service). */
export function listUsersForByline(db: DbOrTx) {
  return db
    .select({
      id: users.id,
      name: users.name,
      title: users.title,
      role: users.role,
    })
    .from(users)
    .orderBy(asc(users.name))
}

/** Users who already sign an article (e.g. the seeded no-login bylines). */
export async function bylineAuthorIds(db: DbOrTx): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ id: articles.authorId })
    .from(articles)
    .where(isNotNull(articles.authorId))
  return new Set(rows.flatMap((r) => (r.id ? [r.id] : [])))
}
```

- [ ] **Step 5: Service**

`server/modules/articles/service.ts`:

```ts
import "server-only"

import type { z } from "zod"

import { hasPermission, parseRoles } from "@/lib/auth/permissions"
import { isEmptyDoc, readTimeMinutes } from "@/lib/rich-text/read-time"
import type {
  ArticleDto,
  ArticleListItem,
  ArticleListQuery,
  ArticleOptions,
  ArticlePermissions,
} from "@/lib/schemas/api/articles"
import type { ContentStatus } from "@/lib/schemas/api/content"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  type ArticleContent,
  articleContent,
} from "@/lib/schemas/content/article"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, conflict, forbidden, notFound } from "@/server/lib/errors"
import { clearMediaUsages, syncMediaUsages } from "@/server/lib/media-usages"
import { pgErrorCode, UNIQUE_VIOLATION } from "@/server/lib/pg-errors"
import {
  restoreRevision,
  saveDraft,
  validateContent,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"
import { findPageByKey } from "@/server/modules/pages/repo"
import { insertRevision } from "@/server/modules/revisions/repo"

import * as repo from "./repo"

type ArticleAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "submit"
  | "publish"
  | "updateAny"
  | "deleteAny"

const roleCan = (actor: Actor, action: ArticleAction) =>
  hasPermission(actor.roles, { article: [action] })

function need(actor: Actor, action: ArticleAction) {
  if (!roleCan(actor, action)) throw forbidden()
}

/**
 * What an article draft must satisfy to be saved, published or restored. An
 * editor body without words or images is stored as "no body" (the site then
 * shows the excerpt, like the seeded articles without designed copy).
 */
const storedContent: z.ZodType<ArticleContent> = articleContent.transform(
  (content) => ({
    ...content,
    body: isEmptyDoc(content.body) ? null : content.body,
  })
)

type PermissionRow = {
  authorId: string | null
  published: unknown
  status: ContentStatus
}

const isOwn = (actor: Actor, row: PermissionRow) =>
  row.authorId !== null && row.authorId === actor.userId

/**
 * Spec §6.1: editors and up change any article. Authors change, delete and
 * submit only their own, and only while it is not on the site and not yet
 * scheduled (scheduled = approved by an editor). Publishing, scheduling and
 * unpublishing are never author rights (Review Focus 5).
 */
export function articlePermissions(
  actor: Actor,
  row: PermissionRow
): ArticlePermissions {
  const authorMayEdit =
    isOwn(actor, row) &&
    row.published === null &&
    (row.status === "draft" || row.status === "in_review")
  return {
    update:
      roleCan(actor, "updateAny") || (roleCan(actor, "update") && authorMayEdit),
    delete:
      roleCan(actor, "deleteAny") || (roleCan(actor, "delete") && authorMayEdit),
    submit:
      row.status === "draft" &&
      (roleCan(actor, "updateAny") ||
        (roleCan(actor, "submit") && authorMayEdit)),
    publish: roleCan(actor, "publish"),
    changeAuthor: roleCan(actor, "updateAny"),
  }
}

function toDto(row: repo.ArticleEditRow, actor: Actor): ArticleDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.draft.title,
    live: row.published !== null,
    category: {
      id: row.categoryId,
      slug: row.categorySlug,
      name: row.categoryName,
    },
    author:
      row.authorId && row.authorName !== null
        ? { id: row.authorId, name: row.authorName, title: row.authorTitle }
        : null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    readTimeMinutes: row.readTimeMinutes,
    createdAt: row.createdAt.toISOString(),
    permissions: articlePermissions(actor, row),
    ...versionedDto<ArticleContent>(row),
  }
}

function listItem(dto: ArticleDto): ArticleListItem {
  const item: Partial<ArticleDto> = dto
  delete item.draft
  delete item.published
  return item as ArticleListItem
}

/** Versioning adapter (Phase 4 saveDraft/restoreRevision); 409s carry the actor's view. */
const storeFor = (
  actor: Actor
): VersionedStore<ArticleContent, repo.ArticleEditRow> => ({
  entityType: "article",
  label: "Article",
  schema: () => storedContent,
  find: (db, id) => repo.findArticleForEdit(db, id),
  update: (db, id, version, patch) =>
    repo.updateArticleIfVersion(db, id, version, patch),
  tags: (row) => [tag.articles, tag.article(row.slug)],
  present: (row) => toDto(row, actor),
})

async function loadRow(db: DbOrTx, id: string) {
  const row = await repo.findArticleForEdit(db, id)
  if (!row) throw notFound("Article")
  return row
}

/** After a lost optimistic update: 404 if the article is gone, else 409 with its current state. */
async function staleOrMissing(
  db: DbOrTx,
  id: string,
  actor: Actor
): Promise<never> {
  throw conflict(toDto(await loadRow(db, id), actor))
}

const slugTaken = () =>
  new AppError("CONFLICT", "Another article already uses this address", {
    fieldErrors: { slug: ["Already used by another article"] },
  })

async function assertCategory(db: DbOrTx, id: string) {
  if (!(await repo.categoryExists(db, id)))
    throw new AppError("VALIDATION_FAILED", "Choose a category", {
      fieldErrors: { categoryId: ["This category no longer exists"] },
    })
}

async function assertAuthor(db: DbOrTx, id: string) {
  if (!(await repo.userExists(db, id)))
    throw new AppError("VALIDATION_FAILED", "Choose a byline", {
      fieldErrors: { authorId: ["This user no longer exists"] },
    })
}

/**
 * The blog page features one article by slug (pages.blog featuredArticle):
 * hiding it or changing its address would empty the featured block.
 */
async function assertNotFeatured(db: DbOrTx, slug: string, field?: string) {
  const blog = await findPageByKey(db, "blog")
  const featured = [blog?.draft, blog?.published].map(
    (data) => (data as { featuredArticle?: string | null } | null)?.featuredArticle
  )
  if (!featured.includes(slug)) return
  const message =
    "The blog page features this article. Choose another featured article on the Blog page first."
  throw new AppError(
    "CONFLICT",
    message,
    field ? { fieldErrors: { [field]: [message] } } : undefined
  )
}

// ---------------------------------------------------------------- reads

export async function listArticlesAdmin(
  actor: Actor,
  query: ArticleListQuery
): Promise<Paginated<ArticleListItem>> {
  need(actor, "read")
  const { rows, total } = await repo.listArticlesForAdmin(getDb(), {
    q: query.q || undefined,
    status: query.status,
    categoryId: query.category,
    authorId: query.author === "me" ? actor.userId : query.author,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map((row) => listItem(toDto(row, actor))),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getArticleAdmin(
  actor: Actor,
  id: string
): Promise<ArticleDto> {
  need(actor, "read")
  return toDto(await loadRow(getDb(), id), actor)
}

/** Category list for every reader; byline candidates only for editors and up. */
export async function getArticleOptions(actor: Actor): Promise<ArticleOptions> {
  need(actor, "read")
  const db = getDb()
  const categories = await repo.listCategoryOptions(db)
  if (!roleCan(actor, "updateAny")) return { categories, authors: [] }
  const [people, bylines] = await Promise.all([
    repo.listUsersForByline(db),
    repo.bylineAuthorIds(db),
  ])
  return {
    categories,
    authors: people
      .filter(
        (person) =>
          bylines.has(person.id) ||
          hasPermission(parseRoles(person.role), { article: ["create"] })
      )
      .map(({ id, name, title }) => ({ id, name, title })),
  }
}

// ---------------------------------------------------------------- writes

/** New articles start as a draft under the actor's byline (editors may choose another). */
export async function createArticle(
  actor: Actor,
  input: {
    slug: string
    categoryId: string
    authorId?: string | null
    draft: unknown
  }
): Promise<ArticleDto> {
  need(actor, "create")
  const authorId = input.authorId === undefined ? actor.userId : input.authorId
  if (authorId !== actor.userId && !roleCan(actor, "updateAny"))
    throw forbidden()
  const draft = validateContent(storedContent, input.draft)
  const db = getDb()
  try {
    const id = await db.transaction(async (tx) => {
      await assertCategory(tx, input.categoryId)
      if (authorId) await assertAuthor(tx, authorId)
      const newId = await repo.insertArticle(tx, {
        slug: input.slug,
        categoryId: input.categoryId,
        authorId,
        draft,
        updatedBy: actor.userId,
      })
      await syncMediaUsages(tx, "article", newId, draft)
      await insertRevision(tx, {
        entityType: "article",
        entityId: newId,
        version: 1,
        data: draft,
        actorId: actor.userId,
      })
      await writeAudit(tx, actor, {
        action: "article.created",
        entityType: "article",
        entityId: newId,
        diff: { slug: input.slug, authorId },
      })
      return newId
    })
    return toDto(await loadRow(db, id), actor)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
    throw err
  }
}

/**
 * Autosave. The permission check reads the current row; the save itself
 * only succeeds while the version is unchanged, so a publish in between
 * (version + 1) turns the author's save into a 409, never an edit of live
 * content.
 */
export async function saveArticleDraft(
  actor: Actor,
  id: string,
  input: { draft: unknown; version: number }
): Promise<ArticleDto> {
  need(actor, "update")
  const db = getDb()
  if (!articlePermissions(actor, await loadRow(db, id)).update) throw forbidden()
  return toDto(await saveDraft(db, storeFor(actor), actor, id, input), actor)
}

export async function restoreArticle(
  actor: Actor,
  id: string,
  input: { revisionId: string; version: number }
): Promise<ArticleDto> {
  need(actor, "update")
  const db = getDb()
  if (!articlePermissions(actor, await loadRow(db, id)).update) throw forbidden()
  return toDto(
    await restoreRevision(db, storeFor(actor), actor, id, input),
    actor
  )
}

/** Address, category and byline are columns: they change the site at once. */
export async function changeArticleMeta(
  actor: Actor,
  id: string,
  input: {
    version: number
    slug?: string
    categoryId?: string
    authorId?: string | null
  }
): Promise<ArticleDto> {
  need(actor, "update")
  const db = getDb()
  try {
    const { before, after } = await db.transaction(async (tx) => {
      const row = await loadRow(tx, id)
      const permissions = articlePermissions(actor, row)
      if (!permissions.update) throw forbidden()
      if (
        input.authorId !== undefined &&
        input.authorId !== row.authorId &&
        !permissions.changeAuthor
      )
        throw forbidden()
      if (row.version !== input.version) throw conflict(toDto(row, actor))
      if (input.slug !== undefined && input.slug !== row.slug)
        await assertNotFeatured(tx, row.slug, "slug")
      if (input.categoryId !== undefined) await assertCategory(tx, input.categoryId)
      if (input.authorId) await assertAuthor(tx, input.authorId)
      const patch: repo.ArticlePatch = { updatedBy: actor.userId }
      if (input.slug !== undefined) patch.slug = input.slug
      if (input.categoryId !== undefined) patch.categoryId = input.categoryId
      if (input.authorId !== undefined) patch.authorId = input.authorId
      const updated = await repo.updateArticleIfVersion(
        tx,
        id,
        input.version,
        patch
      )
      if (!updated) return staleOrMissing(tx, id, actor)
      await writeAudit(tx, actor, {
        action: "article.meta_changed",
        entityType: "article",
        entityId: id,
        diff: {
          from: {
            slug: row.slug,
            categoryId: row.categoryId,
            authorId: row.authorId,
          },
          to: {
            slug: updated.slug,
            categoryId: updated.categoryId,
            authorId: updated.authorId,
          },
        },
      })
      return { before: row, after: updated }
    })
    if (before.published !== null)
      invalidate(
        tag.articles,
        tag.article(before.slug),
        ...(after.slug !== before.slug ? [tag.article(after.slug)] : [])
      )
    return toDto(after, actor)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
    throw err
  }
}

export async function deleteArticle(
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<{ ok: true }> {
  need(actor, "delete")
  const removed = await getDb().transaction(async (tx) => {
    const row = await loadRow(tx, id)
    if (!articlePermissions(actor, row).delete) throw forbidden()
    if (row.version !== input.version) throw conflict(toDto(row, actor))
    await assertNotFeatured(tx, row.slug)
    await clearMediaUsages(tx, "article", id)
    if (!(await repo.deleteArticleIfVersion(tx, id, input.version)))
      return staleOrMissing(tx, id, actor)
    await writeAudit(tx, actor, {
      action: "article.deleted",
      entityType: "article",
      entityId: id,
      diff: { slug: row.slug, version: row.version },
    })
    return row
  })
  if (removed.published !== null)
    invalidate(tag.articles, tag.article(removed.slug))
  return { ok: true }
}

// ---------------------------------------------------------------- workflow

/** One status change of the review/publish workflow (spec §5.1, §6.1). */
type Transition = {
  action: "submitted" | "published" | "scheduled" | "unscheduled" | "unpublished"
  /** 403 unless the actor may do this to this article. */
  authorize(actor: Actor, row: repo.ArticleEditRow): void
  /** Why the article's state does not allow it (→ 409), or null. */
  blockedBy(row: repo.ArticleEditRow): string | null
  /** Extra checks that need the database (→ 409/422). */
  guard?(db: DbOrTx, row: repo.ArticleEditRow): Promise<void>
  /** Column changes (may throw 422 for an invalid draft). */
  patch(row: repo.ArticleEditRow, now: Date): repo.ArticlePatch
  /** The public site changes (expire the article tags). */
  changesSite: boolean
}

const publisherOnly = (actor: Actor) => need(actor, "publish")

const SUBMIT: Transition = {
  action: "submitted",
  authorize: (actor, row) => {
    if (
      !roleCan(actor, "updateAny") &&
      !(roleCan(actor, "submit") && isOwn(actor, row) && row.published === null)
    )
      throw forbidden()
  },
  blockedBy: (row) =>
    row.status === "draft" ? null : "Only drafts can be submitted for review",
  patch: () => ({ status: "in_review" }),
  changesSite: false,
}

const PUBLISH: Transition = {
  action: "published",
  authorize: publisherOnly,
  blockedBy: () => null,
  patch: (row, now) => {
    const data = validateContent(storedContent, row.draft)
    return {
      draft: data,
      published: data,
      status: "published",
      // The post date is the first publication; edits do not redate it.
      publishedAt: row.publishedAt ?? now,
      scheduledAt: null,
      readTimeMinutes: readTimeMinutes(data.body),
    }
  },
  changesSite: true,
}

const scheduleFor = (at: Date): Transition => ({
  action: "scheduled",
  authorize: publisherOnly,
  blockedBy: () => null,
  // Runs after the version check (ledger: 409 before 422).
  patch: (row, now) => {
    if (at.getTime() <= now.getTime())
      throw new AppError("VALIDATION_FAILED", "Choose a time in the future", {
        fieldErrors: { scheduledAt: ["Choose a time in the future"] },
      })
    // It will be published unattended: it must be publishable now.
    validateContent(storedContent, row.draft)
    return { status: "scheduled", scheduledAt: at }
  },
  changesSite: false,
})

const UNSCHEDULE: Transition = {
  action: "unscheduled",
  authorize: publisherOnly,
  blockedBy: (row) =>
    row.status === "scheduled" ? null : "This article is not scheduled",
  patch: (row) => ({
    status: row.published === null ? "draft" : "published",
    scheduledAt: null,
  }),
  changesSite: false,
}

const UNPUBLISH: Transition = {
  action: "unpublished",
  authorize: publisherOnly,
  blockedBy: (row) =>
    row.published === null ? "This article is not on the site" : null,
  guard: (db, row) => assertNotFeatured(db, row.slug),
  patch: () => ({
    published: null,
    status: "draft",
    publishedAt: null,
    scheduledAt: null,
  }),
  changesSite: true,
}

/**
 * Applies a transition inside the caller's transaction: optimistic update,
 * revision (data = the draft at the new version), media usages, audit.
 * `actor` is null for the scheduler. Returns null when the version is stale.
 */
async function applyTransition(
  tx: DbOrTx,
  actor: Actor | null,
  row: repo.ArticleEditRow,
  version: number,
  transition: Transition,
  now: Date,
  extra: Record<string, unknown> = {}
): Promise<repo.ArticleEditRow | null> {
  const updated = await repo.updateArticleIfVersion(tx, row.id, version, {
    ...transition.patch(row, now),
    updatedBy: actor ? actor.userId : row.updatedBy,
  })
  if (!updated) return null
  await insertRevision(tx, {
    entityType: "article",
    entityId: row.id,
    version: updated.version,
    data: updated.draft,
    actorId: actor?.userId ?? null,
  })
  await syncMediaUsages(tx, "article", row.id, updated.draft, updated.published)
  await writeAudit(tx, actor, {
    action: `article.${transition.action}`,
    entityType: "article",
    entityId: row.id,
    diff: { version: updated.version, status: updated.status, ...extra },
  })
  return updated
}

async function runTransition(
  actor: Actor,
  id: string,
  version: number,
  transition: Transition,
  extra?: Record<string, unknown>
): Promise<ArticleDto> {
  const after = await getDb().transaction(async (tx) => {
    const row = await loadRow(tx, id)
    transition.authorize(actor, row)
    if (row.version !== version) throw conflict(toDto(row, actor))
    const blocked = transition.blockedBy(row)
    if (blocked)
      throw new AppError("CONFLICT", blocked, { current: toDto(row, actor) })
    await transition.guard?.(tx, row)
    const updated = await applyTransition(
      tx,
      actor,
      row,
      version,
      transition,
      new Date(),
      extra
    )
    if (!updated) return staleOrMissing(tx, id, actor)
    return updated
  })
  if (transition.changesSite) invalidate(tag.articles, tag.article(after.slug))
  return toDto(after, actor)
}

export const submitArticle = (
  actor: Actor,
  id: string,
  input: { version: number }
) => runTransition(actor, id, input.version, SUBMIT)

export async function publishArticle(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  need(actor, "publish")
  return runTransition(actor, id, input.version, PUBLISH)
}

/** Publish later; the scheduler (spec §12) publishes it at `scheduledAt`. */
export async function scheduleArticle(
  actor: Actor,
  id: string,
  input: { version: number; scheduledAt: string }
) {
  need(actor, "publish")
  const at = new Date(input.scheduledAt)
  // The past-time check (422) lives in the transition, after the version
  // check (409), like every other validation (ledger ruling).
  return runTransition(actor, id, input.version, scheduleFor(at), {
    scheduledAt: at.toISOString(),
  })
}

export async function unscheduleArticle(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  need(actor, "publish")
  return runTransition(actor, id, input.version, UNSCHEDULE)
}

export async function unpublishArticle(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  need(actor, "publish")
  return runTransition(actor, id, input.version, UNPUBLISH)
}
```

Task 6 appends `publishDueArticles` to this file and reuses `loadRow`, `applyTransition` and `PUBLISH` (keep them module-private).

- [ ] **Step 6: Routes, revisions, mounting**

`server/modules/articles/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import {
  articleListQuery,
  articleMetaInput,
  articleVersionQuery,
  createArticleInput,
  scheduleInput,
} from "@/lib/schemas/api/articles"
import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// Ownership (authors: own, unpublished) is checked by the service; `can`
// only needs the role grant. "/options" is registered before "/:id".
export const articlesRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ article: ["read"] }),
    zv("query", articleListQuery),
    async (c) =>
      c.json(
        await service.listArticlesAdmin(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .get("/options", can({ article: ["read"] }), async (c) =>
    c.json(await service.getArticleOptions(actorOf(c)), 200)
  )
  .post(
    "/",
    can({ article: ["create"] }),
    zv("json", createArticleInput),
    async (c) =>
      c.json(await service.createArticle(actorOf(c), c.req.valid("json")), 201)
  )
  .get("/:id", can({ article: ["read"] }), zv("param", idParam), async (c) =>
    c.json(
      await service.getArticleAdmin(actorOf(c), c.req.valid("param").id),
      200
    )
  )
  .put(
    "/:id/draft",
    can({ article: ["update"] }),
    zv("param", idParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveArticleDraft(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/restore",
    can({ article: ["update"] }),
    zv("param", idParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .patch(
    "/:id/meta",
    can({ article: ["update"] }),
    zv("param", idParam),
    zv("json", articleMetaInput),
    async (c) =>
      c.json(
        await service.changeArticleMeta(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/submit",
    can({ article: ["submit"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.submitArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/publish",
    can({ article: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/schedule",
    can({ article: ["publish"] }),
    zv("param", idParam),
    zv("json", scheduleInput),
    async (c) =>
      c.json(
        await service.scheduleArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/unschedule",
    can({ article: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.unscheduleArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/unpublish",
    can({ article: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.unpublishArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:id",
    can({ article: ["delete"] }),
    zv("param", idParam),
    zv("query", articleVersionQuery),
    async (c) =>
      c.json(
        await service.deleteArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("query")
        ),
        200
      )
  )
```

In `lib/schemas/api/content.ts`, add `"article",` to `REVISION_ENTITIES` directly after `"service",`.

In `server/modules/revisions/service.ts`, add to the `READ` record directly after the `service:` line:

```ts
  article: { article: ["read"] },
```

In `server/api/app.ts` add `import { articlesRoutes } from "@/server/modules/articles/routes"` (alphabetical: first of the `@/server/modules/*` imports) and chain `.route("/articles", articlesRoutes)` directly after `.route("/pages", pagesRoutes)` in `adminRoutes`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/read-time.test.ts`
Expected: PASS (5 tests).

Run: `pnpm test:integration tests/integration/api/articles.test.ts tests/integration/api/pages.test.ts tests/integration/queries/public-queries.test.ts`
Expected: PASS (13 article tests; the Phase 4 pages and Phase 3 query tests unchanged).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0 (`service.ts`/`routes.ts` import no `drizzle-orm`; `routes.ts` imports no repo).

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write lib/rich-text/read-time.ts lib/schemas/api/articles.ts lib/schemas/api/content.ts server/modules/articles server/modules/revisions/service.ts server/api/app.ts tests/unit/read-time.test.ts tests/integration/api/articles.test.ts
git add lib/rich-text/read-time.ts lib/schemas/api/articles.ts lib/schemas/api/content.ts server/modules/articles server/modules/revisions/service.ts server/api/app.ts tests/unit/read-time.test.ts tests/integration/api/articles.test.ts
git commit -m "feat: add articles admin API with review workflow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Byline cache invalidation (master Task 5.1, part 2)

**Files:**
- Modify: `server/auth/hooks.ts` (add `onUserUpdated`), `server/auth/auth.ts` (`databaseHooks.user.update.after`), `server/modules/users/service.ts` (`updateUser` expires `articles`), `tests/integration/api/users.test.ts` (mock `next/cache`: the users service now invalidates)
- Test: `tests/integration/auth/byline-cache.test.ts`

**Interfaces:**
- Consumes: Better Auth 1.7 `databaseHooks.user.update.after(user, context)` (context = the endpoint context, `context.path` e.g. `"/update-user"`, or null; verified in `better-auth/dist/db/with-hooks.mjs`), `invalidate`/`tag`.
- Produces: `export async function onUserUpdated(context: { path?: string } | null): Promise<void>` (`server/auth/hooks.ts`). Article bylines (spec §5.3: `users.name`, `users.title`) are cached under `tag.articles`; both ways to change them now expire it: the account profile form (`POST /api/auth/update-user`) and the admin users screen (`PATCH /api/v1/admin/users/:id`).

Rules: only the profile endpoint invalidates (bans, role changes and sign-ins also update `users` and must not churn the public cache); the hook never fails the auth request — outside a Next request (scripts) `revalidateTag` throws, which is logged, not rethrown.

- [ ] **Step 1: Write the failing test**

`tests/integration/auth/byline-cache.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { resetDb } from "../db"
import {
  adminRequest,
  authPost,
  createUser,
  signedInUser,
} from "../helpers/auth"

beforeEach(async () => {
  await resetDb()
  revalidateTag.mockClear()
})

const expiredArticles = () =>
  revalidateTag.mock.calls.filter(([t]) => t === "articles")

describe("bylines come from user profiles (spec §5.3, ledger carry)", () => {
  it("a profile change through Better Auth expires the cached articles", async () => {
    const { cookie } = await signedInUser(["author"])
    expect(expiredArticles()).toEqual([])
    const res = await authPost(
      "/update-user",
      { name: "Arthur Author", title: "Operations Lead" },
      cookie
    )
    expect(res.status).toBe(200)
    expect(expiredArticles()).toEqual([["articles", { expire: 0 }]])
  })

  it("an admin renaming a user expires the cached articles", async () => {
    const admin = await signedInUser(["admin"])
    const target = await createUser({ roles: ["author"] })
    revalidateTag.mockClear()
    const res = await adminRequest(`/users/${target.id}`, {
      cookie: admin.cookie,
      method: "PATCH",
      json: { title: "Managing Director" },
    })
    expect(res.status).toBe(200)
    expect(expiredArticles()).toEqual([["articles", { expire: 0 }]])
  })

  it("role changes and bans do not touch the public cache", async () => {
    const admin = await signedInUser(["admin"])
    const target = await createUser({ roles: ["author"] })
    revalidateTag.mockClear()
    await adminRequest(`/users/${target.id}/roles`, {
      cookie: admin.cookie,
      method: "PUT",
      json: { roles: ["editor"] },
    })
    await adminRequest(`/users/${target.id}/ban`, {
      cookie: admin.cookie,
      method: "POST",
      json: {},
    })
    expect(expiredArticles()).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:integration tests/integration/auth/byline-cache.test.ts`
Expected: FAIL — the first two tests: `expected [] to deeply equal [ [ 'articles', { expire: 0 } ] ]`.

- [ ] **Step 3: Hook, auth config, users service**

In `server/auth/hooks.ts` add `import { invalidate, tag } from "@/server/lib/cache-tags"` (after the `@/server/lib/audit` import) and append:

```ts
/** Better Auth endpoints that change a byline (users.name / users.title). */
const BYLINE_PATHS: ReadonlySet<string> = new Set(["/update-user"])

/**
 * Article bylines are the author's profile (spec §5.3), cached under the
 * `articles` tag: a profile change expires it. Never breaks the auth
 * request — outside a Next request (scripts) revalidateTag throws, which is
 * logged here, not rethrown.
 */
export async function onUserUpdated(
  context: { path?: string } | null
): Promise<void> {
  if (!context?.path || !BYLINE_PATHS.has(context.path)) return
  try {
    invalidate(tag.articles)
  } catch (err) {
    console.error(
      "[cache] could not expire articles after a profile change:",
      err instanceof Error ? err.message : String(err)
    )
  }
}
```

In `server/auth/auth.ts` change the hooks import to `import { actorFor, auditAuthEvent, onUserUpdated, securityHooks } from "./hooks"` and add, directly after the `user: { additionalFields: … },` block inside `betterAuth({ … })`:

```ts
    databaseHooks: {
      user: {
        update: {
          // Bylines (spec §5.3): a profile change expires cached articles.
          after: async (_user, context) => onUserUpdated(context),
        },
      },
    },
```

In `server/modules/users/service.ts` add `import { invalidate, tag } from "@/server/lib/cache-tags"` (after the `@/server/lib/audit` import) and in `updateUser`, directly after the `await db.transaction(…)` statement and before `return toUserItem(…)`, add:

```ts
  // Article bylines show users.name / users.title (spec §5.3).
  invalidate(tag.articles)
```

In `tests/integration/api/users.test.ts`, directly after the `import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"` line, add:

```ts

// The users service expires cached articles on name/title changes (Phase 5);
// Hono runs outside Next here, so record instead of revalidating.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:integration tests/integration/auth/byline-cache.test.ts tests/integration/api/users.test.ts tests/integration/auth`
Expected: PASS (3 new tests; the Phase 2 users/auth/account tests unchanged — the impersonated `/update-user` attempt is refused before any update, so the hook does not run).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write server/auth/hooks.ts server/auth/auth.ts server/modules/users/service.ts tests/integration/api/users.test.ts tests/integration/auth/byline-cache.test.ts
git add server/auth/hooks.ts server/auth/auth.ts server/modules/users/service.ts tests/integration/api/users.test.ts tests/integration/auth/byline-cache.test.ts
git commit -m "feat: expire cached articles when a byline profile changes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rich text — editor ↔ renderer parity, link guard, word count, ⌘K (master Task 5.2)

**Files:**
- Modify: `lib/href.ts` (`isSafeRichTextHref`), `lib/schemas/common.ts` (rich-text link marks use it), `lib/rich-text/render.tsx` (renderer uses it; trailing empty paragraphs ignored), `components/admin/rich-text/extensions.ts` (link `isAllowedUri`), `components/admin/rich-text/toolbar.tsx` (full file: controlled link popover), `components/admin/rich-text/editor.tsx` (full file: ⌘K → link, word count), `components/admin/shell/command-palette.tsx` (ignore prevented ⌘K)
- Test: `tests/unit/schemas/rich-text-links.test.ts`, `tests/unit/rich-text/trailing-paragraphs.test.tsx`, `tests/dom/article-body.test.tsx`, `tests/dom/rich-text-shortcuts.test.tsx`

**Interfaces:**
- Consumes: Phase 3 `richText`, `href`, `isSafeHref`/`WHOLE_PLACEHOLDER`, `ArticleBlocks`, `UNSAFE_HREF_FALLBACK`, `replaceMediaRefs`/`MediaView`, fixtures `articlesFixture`/`pagesFixture`/`fixtureMediaLookup`/`fixtureMediaKey`; Phase 4 `richTextExtensions`, `RichTextEditor`, `RichTextToolbar`, `MediaPickerDialog`, `isPaletteShortcut`; Task 1 `countTextWords`, `minutesFor`.
- Produces:

```ts
// lib/href.ts
export function isSafeRichTextHref(value: string): boolean     // isSafeHref and no "{" / "}" anywhere
// components/admin/rich-text/editor.tsx
export function isLinkShortcut(event: KeyboardEvent): boolean    // ⌘K / Ctrl+K
export function RichTextEditor(props: same as Phase 4)           // + ⌘K opens the link popover; "full" mode shows "N words · about M min read"
// components/admin/rich-text/toolbar.tsx
export function RichTextToolbar(props: { editor; mode; editorId; linkOpen: boolean; onLinkOpenChange(open: boolean): void })
```

Master acceptance mapped to tests: only allowed node types and pasted disallowed nodes stripped (Phase 4 `tests/dom/rich-text-extensions.test.tsx`, plus here: pasting the public article's own HTML yields a valid doc); renderer output for the seeded article equals the current markup (Phase 3 unit test + here: every seeded body loaded into the editor and saved renders identical markup; visual gate on `/blog/mobile-patrols-protect-your-business-after-hours`); image node uses a media ref (here: the rendered `<img src>` comes from the media row, and an `<img src>` without a library id is dropped on paste).

- [ ] **Step 1: Write the failing tests**

`tests/unit/schemas/rich-text-links.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { isSafeRichTextHref } from "@/lib/href"
import { href, richText } from "@/lib/schemas/common"

const withLink = (target: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Call us",
          marks: [{ type: "link", attrs: { href: target } }],
        },
      ],
    },
  ],
})

describe("links inside rich text (ledger minor P03-7)", () => {
  it.each([
    "/contact",
    "#top",
    "https://www.securitypartnersltd.com/a?b=c",
    "tel:+353578662400",
    "mailto:info@example.ie",
  ])("accepts %s", (target) => {
    expect(isSafeRichTextHref(target)).toBe(true)
    expect(richText.safeParse(withLink(target)).success).toBe(true)
  })

  it.each([
    "{phone24hHref}",
    "tel:{phone24h}",
    "mailto:{email}",
    "/{x}",
    "javascript:alert(1)",
    "//evil.example",
  ])("rejects %s (placeholders are not interpolated inside formatted text)", (target) => {
    expect(isSafeRichTextHref(target)).toBe(false)
    const result = richText.safeParse(withLink(target))
    expect(result.success).toBe(false)
  })

  it("explains why a placeholder is refused", () => {
    const result = richText.safeParse(withLink("{phone24hHref}"))
    expect(result.error?.issues[0].message).toContain("placeholders")
  })

  it("link fields outside rich text still take whole placeholders (they are interpolated)", () => {
    expect(href.safeParse("{phone24hHref}").success).toBe(true)
  })
})
```

`tests/unit/rich-text/trailing-paragraphs.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ArticleBlocks } from "@/lib/rich-text/render"

const p = (text: string) => ({
  type: "paragraph" as const,
  content: [{ type: "text" as const, text }],
})

const html = (content: Parameters<typeof ArticleBlocks>[0]["doc"]["content"]) =>
  renderToStaticMarkup(<ArticleBlocks doc={{ type: "doc", content }} />)

describe("renderer ignores the editor's trailing empty paragraph", () => {
  it("drops empty paragraphs at the end only", () => {
    expect(html([p("a"), { type: "paragraph" }, p("  ")])).toBe(html([p("a")]))
    expect(html([p("a"), { type: "paragraph" }, p("b")])).toContain(
      "<p class"
    )
    expect(
      (html([p("a"), { type: "paragraph" }, p("b")]).match(/<p /g) ?? [])
        .length
    ).toBe(3)
  })

  it("renders a stored javascript: or placeholder link target as #", () => {
    const markup = html([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", attrs: { href: "{phone24hHref}" } }],
          },
        ],
      },
    ])
    expect(markup).toContain('href="#"')
  })
})
```

`tests/dom/article-body.test.tsx`:

```tsx
import { Editor } from "@tiptap/core"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

import { richTextExtensions } from "@/components/admin/rich-text/extensions"
import { type MediaView, replaceMediaRefs } from "@/lib/media"
import { ArticleBlocks } from "@/lib/rich-text/render"
import { type RichTextDoc, richText } from "@/lib/schemas/common"
import { articlesFixture } from "@/server/db/seed/fixtures/articles"
import {
  fixtureMediaKey,
  fixtureMediaLookup,
} from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"

const staticMedia = (id: string): MediaView => ({
  id,
  url: fixtureMediaKey(id),
  alt: "",
  width: null,
  height: null,
  blurDataUrl: null,
})

const html = (doc: RichTextDoc) =>
  renderToStaticMarkup(
    <ArticleBlocks doc={replaceMediaRefs(doc, staticMedia)} />
  )

let editors: Editor[] = []
afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
})

/** What the admin editor stores after loading `content` (HTML = a paste). */
function throughEditor(content: RichTextDoc | string) {
  const editor = new Editor({
    extensions: richTextExtensions("full"),
    content,
  })
  editors.push(editor)
  return editor.getJSON()
}

const pages = pagesFixture(fixtureMediaLookup)
const seededBodies: [string, RichTextDoc][] = [
  ...articlesFixture(fixtureMediaLookup).flatMap((a) =>
    a.content.body ? [[a.slug, a.content.body] as [string, RichTextDoc]] : []
  ),
  ["privacy", pages.privacy.data.body],
  ["terms", pages.terms.data.body],
]

describe("editor ↔ public renderer (master 5.2)", () => {
  it("covers the seeded article body", () => {
    expect(seededBodies.map(([name]) => name)).toContain(
      "mobile-patrols-protect-your-business-after-hours"
    )
  })

  it.each(seededBodies)(
    "%s: opening and saving it in the editor changes nothing on the site",
    (_name, stored) => {
      const saved = richText.parse(throughEditor(stored))
      expect(html(saved)).toBe(html(stored))
    }
  )

  it("pasting the public article's own HTML gives a valid doc with its text", () => {
    const article = articlesFixture(fixtureMediaLookup).find(
      (a) => a.slug === "mobile-patrols-protect-your-business-after-hours"
    )!
    const pasted = throughEditor(html(article.content.body!))
    const parsed = richText.safeParse(pasted)
    expect(parsed.success).toBe(true)
    const serialized = JSON.stringify(pasted)
    expect(serialized).toContain("What a scheduled patrol covers")
    expect(serialized).toContain(
      "Tag point checks logged at every stop, in real time"
    )
    expect(serialized).toContain("Security Partners Operations Team")
    // Public <img> tags carry no library id: no image node survives.
    expect(serialized).not.toContain('"type":"image"')
    const lists = parsed.data!.content.filter((b) => b.type === "bulletList")
    expect(lists).toHaveLength(1)
    expect(lists[0].type === "bulletList" && lists[0].content).toHaveLength(4)
  })

  it("an image node renders the library file it references", () => {
    const hero = fixtureMediaLookup("/images/hero.jpg")
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        { type: "image", attrs: { media: hero, alt: "Officer on patrol" } },
      ],
    }
    const stored = richText.parse(throughEditor(doc))
    expect(stored.content[0]).toEqual({
      type: "image",
      attrs: { media: { mediaId: hero.mediaId }, alt: "Officer on patrol" },
    })
    const markup = html(stored)
    expect(markup).toContain('alt="Officer on patrol"')
    expect(markup).toContain(encodeURIComponent("/images/hero.jpg"))
  })

  it("drops placeholder and unsafe link targets on paste, keeps safe ones", () => {
    const json = JSON.stringify(
      throughEditor(
        '<p><a href="{phone24hHref}">call</a> <a href="tel:{phone24h}">now</a> <a href="/contact">contact</a></p>'
      )
    )
    expect(json).not.toContain("{phone24h")
    expect(json).toContain('"href":"/contact"')
  })
})
```

`tests/dom/rich-text-shortcuts.test.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/admin/providers"
import {
  isLinkShortcut,
  RichTextEditor,
} from "@/components/admin/rich-text/editor"

const doc = (...paragraphs: string[]): JSONContent => ({
  type: "doc",
  content: paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  })),
})

function renderEditor(props: Partial<Parameters<typeof RichTextEditor>[0]> = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <RichTextEditor
        id="body"
        label="Article text"
        value={doc("One two three")}
        onChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  )
}

const seen: KeyboardEvent[] = []
const onWindowKeyDown = (event: KeyboardEvent) => seen.push(event)
afterEach(() => {
  window.removeEventListener("keydown", onWindowKeyDown)
  seen.length = 0
})

describe("rich text editor shortcuts and counts (Phase 5)", () => {
  it("recognises ⌘K / Ctrl+K only", () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init)
    expect(isLinkShortcut(key({ key: "k", metaKey: true }))).toBe(true)
    expect(isLinkShortcut(key({ key: "K", ctrlKey: true }))).toBe(true)
    expect(isLinkShortcut(key({ key: "k" }))).toBe(false)
    expect(isLinkShortcut(key({ key: "k", ctrlKey: true, altKey: true }))).toBe(
      false
    )
  })

  it("⌘K in the text opens the link popover and keeps the page palette closed", async () => {
    window.addEventListener("keydown", onWindowKeyDown)
    renderEditor()
    const box = await screen.findByRole("textbox", { name: "Article text" })
    // ProseMirror listens on its own DOM node; the event then bubbles to
    // window, where the ⌘K palette ignores it because it was prevented.
    fireEvent.keyDown(box, { key: "k", ctrlKey: true })
    expect(
      await screen.findByRole("textbox", { name: "Link address" })
    ).toBeInTheDocument()
    const shortcut = seen.find((e) => e.key.toLowerCase() === "k")
    expect(shortcut?.defaultPrevented).toBe(true)
  })

  it("refuses a placeholder as a link target", async () => {
    const user = userEvent.setup()
    renderEditor()
    const toolbar = await screen.findByRole("toolbar", { name: "Formatting" })
    await user.click(within(toolbar).getByRole("button", { name: "Link" }))
    const input = await screen.findByRole("textbox", { name: "Link address" })
    fireEvent.change(input, { target: { value: "{phone24hHref}" } })
    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use /path, #anchor, https://…, tel: or mailto:"
    )
  })

  it("shows the word count and read time in full mode only", async () => {
    const { unmount } = renderEditor()
    expect(
      await screen.findByText("3 words · about 1 min read")
    ).toBeInTheDocument()
    unmount()
    renderEditor({ value: doc("Hello"), mode: "paragraphs" })
    await screen.findByRole("textbox", { name: "Article text" })
    await waitFor(() =>
      expect(screen.queryByText(/min read/)).not.toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/schemas/rich-text-links.test.ts tests/unit/rich-text/trailing-paragraphs.test.tsx`
Expected: FAIL — `isSafeRichTextHref` is not exported from `@/lib/href`; the trailing-paragraph markup has 2 `<p` too many; `{phone24hHref}` renders as `href="{phone24hHref}"`.

Run: `pnpm exec vitest run --project dom tests/dom/article-body.test.tsx tests/dom/rich-text-shortcuts.test.tsx`
Expected: FAIL — `isLinkShortcut` is not exported; placeholder link targets survive the paste (`{phone24h` found); the word count text is missing. (The round-trip cases may already pass — they pin the behaviour.)

- [ ] **Step 3: Link guard (schema, renderer, editor)**

Append to `lib/href.ts`:

```ts
/**
 * Links inside formatted text are rendered exactly as stored (placeholders
 * are interpolated only in link fields), so no "{…}" anywhere in them.
 */
export function isSafeRichTextHref(value: string): boolean {
  return isSafeHref(value) && !/[{}]/.test(value)
}
```

In `lib/schemas/common.ts`:
1. change `import { isSafeHref } from "../href"` to `import { isSafeHref, isSafeRichTextHref } from "../href"`;
2. directly above the `// Rich text: TipTap JSON restricted …` comment add:

```ts
/** A link target inside rich text: like `href`, but never a {placeholder}. */
const richTextHref = z
  .string()
  .min(1, "Required")
  .max(2000)
  .refine(
    isSafeRichTextHref,
    "Use /path, #anchor, https://…, tel: or mailto: ({placeholders} do not work inside formatted text)"
  )
```

3. in the `mark` union replace `z.object({ type: z.literal("link"), attrs: z.object({ href }) }),` with `z.object({ type: z.literal("link"), attrs: z.object({ href: richTextHref }) }),`.

In `lib/rich-text/render.tsx`:
1. change `import { isSafeHref } from "@/lib/href"` to `import { isSafeRichTextHref } from "@/lib/href"` and in `withMarks` replace `isSafeHref(mark.attrs.href)` with `isSafeRichTextHref(mark.attrs.href)`;
2. replace the `ArticleBlocks` function with:

```tsx
/** An empty paragraph (no text but whitespace), e.g. the editor's trailing one. */
function isEmptyParagraph(block: { type: string }): boolean {
  if (block.type !== "paragraph") return false
  const content = (block as { content?: { type: string; text?: string }[] })
    .content
  return !content?.some(
    (node) => node.type === "hardBreak" || (node.text ?? "").trim() !== ""
  )
}

/**
 * Article body blocks (also the legal pages), as siblings in the article
 * column. Empty paragraphs at the end are skipped: the editor keeps one
 * there so the cursor can move below a final list, quote or image.
 */
export function ArticleBlocks({ doc }: { doc: WithMedia<RichTextDoc> }) {
  let end = doc.content.length
  while (end > 0 && isEmptyParagraph(doc.content[end - 1])) end--
  return doc.content
    .slice(0, end)
    .map((block, i) => <ArticleBlock key={i} block={block} />)
}
```

In `components/admin/rich-text/extensions.ts`:
1. replace `import { isSafeHref } from "@/lib/schemas/common"` with `import { isSafeRichTextHref } from "@/lib/href"`;
2. in the `link` options replace `ctx.defaultValidate(url) && isSafeHref(url)` with `ctx.defaultValidate(url) && isSafeRichTextHref(url)`.

- [ ] **Step 4: Toolbar (full file) and editor (full file)**

`components/admin/rich-text/toolbar.tsx`:

```tsx
"use client"

import { type Editor, useEditorState } from "@tiptap/react"
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react"
import { useState } from "react"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { isSafeRichTextHref } from "@/lib/href"

import type { RichTextMode } from "./extensions"

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="aria-pressed:bg-muted aria-pressed:text-foreground"
    >
      {children}
    </Button>
  )
}

/** Form inside the link popover; mounted per opening, so it starts from the current link. */
function LinkForm({
  editor,
  active,
  onDone,
}: {
  editor: Editor
  active: boolean
  onDone: () => void
}) {
  const [href, setHref] = useState(
    () => (editor.getAttributes("link").href as string | undefined) ?? ""
  )
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const value = href.trim()
        if (!isSafeRichTextHref(value)) {
          setError("Use /path, #anchor, https://…, tel: or mailto:")
          return
        }
        editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: value })
          .run()
        onDone()
      }}
    >
      <Input
        aria-label="Link address"
        placeholder="/contact or https://…"
        value={href}
        aria-invalid={!!error}
        onChange={(event) => {
          setHref(event.target.value)
          setError(null)
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
              onDone()
            }}
          >
            Remove link
          </Button>
        ) : null}
        <Button type="submit" size="sm">
          Apply
        </Button>
      </div>
    </form>
  )
}

/** Link button + popover; open state is the editor's (⌘K opens it too). */
function LinkButton({
  editor,
  active,
  open,
  onOpenChange,
}: {
  editor: Editor
  active: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Popover open={open} onOpenChange={(next) => onOpenChange(next)}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Link"
            title="Link (⌘K)"
            aria-pressed={active}
            className="aria-pressed:bg-muted aria-pressed:text-foreground"
          />
        }
      >
        <Link2 aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        {open ? (
          <LinkForm
            editor={editor}
            active={active}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** Formatting controls limited to what the site renders (spec §5.3). */
export function RichTextToolbar({
  editor,
  mode,
  editorId,
  linkOpen,
  onLinkOpenChange,
}: {
  editor: Editor
  mode: RichTextMode
  editorId: string
  linkOpen: boolean
  onLinkOpenChange: (open: boolean) => void
}) {
  const [picking, setPicking] = useState(false)
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const full = mode === "full"
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-controls={editorId}
      className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1"
    >
      <ToolButton
        label="Bold"
        pressed={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden />
      </ToolButton>
      <ToolButton
        label="Italic"
        pressed={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden />
      </ToolButton>
      <LinkButton
        editor={editor}
        active={state.link}
        open={linkOpen}
        onOpenChange={onLinkOpenChange}
      />
      {full ? (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <ToolButton
            label="Heading"
            pressed={state.h2}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 aria-hidden />
          </ToolButton>
          <ToolButton
            label="Subheading"
            pressed={state.h3}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 aria-hidden />
          </ToolButton>
          <ToolButton
            label="Bulleted list"
            pressed={state.bullet}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List aria-hidden />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            pressed={state.ordered}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered aria-hidden />
          </ToolButton>
          <ToolButton
            label="Quote"
            pressed={state.quote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote aria-hidden />
          </ToolButton>
          <ToolButton label="Insert image" onClick={() => setPicking(true)}>
            <ImagePlus aria-hidden />
          </ToolButton>
          <MediaPickerDialog
            open={picking}
            onOpenChange={setPicking}
            onSelect={(item) =>
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "image",
                  attrs: { media: { mediaId: item.id }, alt: item.alt },
                })
                .run()
            }
          />
        </>
      ) : null}
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 aria-hidden />
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 aria-hidden />
      </ToolButton>
    </div>
  )
}
```

`components/admin/rich-text/editor.tsx`:

```tsx
"use client"

import {
  type Editor,
  EditorContent,
  type JSONContent,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react"
import { useEffect, useMemo, useState } from "react"

import { isDeepEqual } from "@/lib/json"
import { countTextWords, minutesFor } from "@/lib/rich-text/read-time"
import { cn } from "@/lib/utils"

import { type RichTextMode, richTextExtensions } from "./extensions"
import { ImageNodeView } from "./image-view"
import { RichTextToolbar } from "./toolbar"

/** ⌘K (macOS) / Ctrl+K: inside the editor it means "link", not the admin palette. */
export function isLinkShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

/** "N words · about M min read" under article bodies (same 200 wpm as the site). */
function WordCount({ editor }: { editor: Editor }) {
  const words = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      countTextWords(
        e.state.doc.textBetween(0, e.state.doc.content.size, " ", " ")
      ),
  })
  return (
    <p className="border-t bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
      {words === 0
        ? "No text yet"
        : `${words} ${words === 1 ? "word" : "words"} · about ${minutesFor(words)} min read`}
    </p>
  )
}

/**
 * TipTap editor for `richText` / `paragraphsText` fields. The JSON it emits
 * is what the public renderer reads (lib/rich-text/render.tsx). ⌘K opens
 * the link popover (and is kept from the admin ⌘K palette).
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  mode = "full",
  label,
  describedBy,
  invalid,
  disabled,
}: {
  id: string
  value: JSONContent | null
  onChange: (doc: JSONContent) => void
  mode?: RichTextMode
  label: string
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const extensions = useMemo(
    () =>
      richTextExtensions(mode, {
        imageView: ReactNodeViewRenderer(ImageNodeView),
      }),
    [mode]
  )
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: value ?? undefined,
      editable: !disabled,
      editorProps: {
        attributes: {
          id,
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": label,
          ...(describedBy ? { "aria-describedby": describedBy } : {}),
          ...(invalid ? { "aria-invalid": "true" } : {}),
          class: "rich-text-content min-h-36 px-3 py-2 outline-none",
        },
        handleKeyDown: (view, event) => {
          if (!view.editable || !isLinkShortcut(event)) return false
          event.preventDefault()
          setLinkOpen(true)
          return true
        },
      },
      onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    },
    [extensions]
  )

  // Outside changes (reload after a conflict, restore) replace the content.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (value && !isDeepEqual(editor.getJSON(), value))
      editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20"
      )}
    >
      {editor ? (
        <RichTextToolbar
          editor={editor}
          mode={mode}
          editorId={id}
          linkOpen={linkOpen}
          onLinkOpenChange={setLinkOpen}
        />
      ) : null}
      <EditorContent editor={editor} />
      {editor && mode === "full" ? <WordCount editor={editor} /> : null}
    </div>
  )
}
```

`components/admin/shell/command-palette.tsx` already ignores prevented events since commit 647ff41 — verify the `onKeyDown` effect handler's first line reads exactly as below (change it only if it does not):

```ts
      // A focused widget (the rich-text editor's ⌘K = link) may claim it.
      if (event.defaultPrevented || !isPaletteShortcut(event)) return
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/schemas tests/unit/rich-text`
Expected: PASS (the new link and trailing-paragraph tests; the Phase 3 `common`/`render` tests unchanged).

Run: `pnpm exec vitest run --project dom tests/dom/article-body.test.tsx tests/dom/rich-text-shortcuts.test.tsx tests/dom/rich-text-extensions.test.tsx tests/dom/rich-text-editor.test.tsx tests/dom/command-palette.test.tsx tests/dom/schema-form.test.tsx`
Expected: PASS (new 9 + the Phase 4 editor/palette/form tests unchanged).

Run: `pnpm lint && pnpm typecheck`
Expected: exit 0.

Run (port 3100 free, no other Playwright/build): `pnpm test:visual`
Expected: every public baseline still 0 px, incl. `/blog/mobile-patrols-protect-your-business-after-hours`, `/privacy`, `/terms` (`43 passed, 1 skipped` with the Phase 4 admin shell baselines).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write lib/href.ts lib/schemas/common.ts lib/rich-text/render.tsx components/admin/rich-text components/admin/shell/command-palette.tsx tests/unit/schemas/rich-text-links.test.ts tests/unit/rich-text/trailing-paragraphs.test.tsx tests/dom/article-body.test.tsx tests/dom/rich-text-shortcuts.test.tsx
git add lib/href.ts lib/schemas/common.ts lib/rich-text/render.tsx components/admin/rich-text components/admin/shell/command-palette.tsx tests/unit/schemas/rich-text-links.test.ts tests/unit/rich-text/trailing-paragraphs.test.tsx tests/dom/article-body.test.tsx tests/dom/rich-text-shortcuts.test.tsx
git commit -m "feat: harden rich text links and pin editor-renderer parity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Articles list, review queue, new article, navigation and ⌘K (master Task 5.3, part 1)

**Files:**
- Create: `lib/admin/article-status.ts`, `components/admin/articles/{article-meta.ts,articles-screen.tsx,new-article-form.tsx}`, `app/(admin)/admin/(panel)/articles/page.tsx`, `app/(admin)/admin/(panel)/articles/new/page.tsx`
- Modify: `components/admin/shell/nav.ts` (Articles item), `tests/unit/admin/nav.test.ts`, `lib/schemas/api/search.ts` (`article` type), `server/modules/search/{repo,service}.ts`, `tests/integration/api/search.test.ts`, `components/admin/shell/command-palette.tsx` (article results + "New article"), `server/modules/dashboard/service.ts` (review link)
- Re-baseline: `tests/visual/__screenshots__/admin-shell-desktop.png`, `tests/visual/__screenshots__/admin-shell-nav-mobile.png`
- Test: `tests/unit/admin/article-status.test.ts`, `tests/dom/articles-screen.test.tsx`, `tests/dom/new-article-form.test.tsx`, `tests/dom/command-palette-articles.test.tsx`

**Interfaces:**
- Consumes: Task 1 API + `ArticleListItem`/`ArticleDto`/`ArticleOptions`; Phase 4 `DataTable` (+ Task 12 `toolbar`/`filterKey`), `columnsFor`, `FilterSelect` (`components/admin/filter-field.tsx`), `PageHeader`, `SchemaForm`, `emptyValue`, `issuesToFieldErrors`, `slugify` (`components/admin/services/new-service-form.tsx`), `useAdminSession`, `usePermission`, `api`/`unwrap`/`ApiError`/`errorMessage`, `formatDateTime`, `NativeSelect`, `AdminShell`/`makeQueryClient` (tests), search module (`SEARCH_TYPES`, `SEARCH_LIMIT_PER_TYPE`).
- Produces:

```ts
// lib/admin/article-status.ts (isomorphic)
export type StatusBadge = { text: string; variant: "default" | "secondary" | "outline" }
export function articleStatusLabel(a: { status: ContentStatus; live: boolean; dirty: boolean; scheduledAt: string | null }): StatusBadge
export const ARTICLE_STATUS_FILTERS: readonly { value: ContentStatus | null; label: string }[]
export function parseStatusParam(value: string | null): ContentStatus | null
export function articleListHref(status: ContentStatus | null): string      // "/admin/articles[?status=…]"
// components/admin/articles/*
export const articleEditorMeta: EditorMeta
export function ArticlesScreen(): JSX.Element          // ?status= from the URL (dashboard "review" link)
export function NewArticleForm(): JSX.Element
// lib/schemas/api/search.ts
SEARCH_TYPES += "article"    // gated on article:read; href /admin/articles/:id (the editor applies the reader's permissions: others' articles open read-only)
// Routes: /admin/articles (article:read), /admin/articles/new (article:create)
```

Screen decisions (fixed): status filter = a button group "All · Drafts · In review · Scheduled · Published" (the "In review" button reads "Review queue" for users who may publish), reflected in `?status=` (`router.replace`, no scroll); Category and Byline selects next to the search box ("Byline" lists "Anyone", "Me" and, for editors, every possible byline); columns Article (title link + `/blog/<slug>`), Status (badge), Category, Byline, Published (sortable), Updated (sortable, default newest first); phones get cards. New article asks for address (from the title), category, byline (editors only, default themselves), title, excerpt and cover, creates the draft and opens its editor.

- [ ] **Step 1: Write the failing tests**

`tests/unit/admin/article-status.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  ARTICLE_STATUS_FILTERS,
  articleListHref,
  articleStatusLabel,
  parseStatusParam,
} from "@/lib/admin/article-status"
import { formatDateTime } from "@/lib/format"

const base = { live: false, dirty: true, scheduledAt: null }

describe("article status badges", () => {
  it("names each workflow state", () => {
    expect(articleStatusLabel({ ...base, status: "draft" })).toEqual({
      text: "Draft",
      variant: "outline",
    })
    expect(articleStatusLabel({ ...base, status: "in_review" })).toEqual({
      text: "In review",
      variant: "secondary",
    })
    expect(
      articleStatusLabel({
        ...base,
        status: "scheduled",
        scheduledAt: "2099-07-01T09:00:00.000Z",
      })
    ).toEqual({
      text: `Scheduled · ${formatDateTime("2099-07-01T09:00:00.000Z")}`,
      variant: "secondary",
    })
    expect(
      articleStatusLabel({ status: "published", live: true, dirty: false, scheduledAt: null })
    ).toEqual({ text: "Published", variant: "default" })
    expect(
      articleStatusLabel({ status: "published", live: true, dirty: true, scheduledAt: null })
    ).toEqual({ text: "Unpublished changes", variant: "secondary" })
  })

  it("parses the ?status= filter and builds list links", () => {
    expect(parseStatusParam("in_review")).toBe("in_review")
    expect(parseStatusParam("nope")).toBeNull()
    expect(parseStatusParam(null)).toBeNull()
    expect(articleListHref(null)).toBe("/admin/articles")
    expect(articleListHref("scheduled")).toBe("/admin/articles?status=scheduled")
    expect(ARTICLE_STATUS_FILTERS.map((f) => f.label)).toEqual([
      "All",
      "Drafts",
      "In review",
      "Scheduled",
      "Published",
    ])
  })
})
```

`tests/unit/admin/nav.test.ts` — Task 12's file with these exact changes:
1. in `CONTENT` and in `ALL`, insert `"Articles",` directly after `"Pages",`;
2. replace `["marketer", ["Dashboard", "Pages", "Services", "Account"]],` with `["marketer", ["Dashboard", "Pages", "Articles", "Services", "Account"]],`;
3. replace `["author", ["Dashboard", "Account"]],` with `["author", ["Dashboard", "Articles", "Account"]],`;
4. in "unions multiple roles and drops empty sections", replace the expected `["Dashboard", "Pages", "Services", "Account"]` with `["Dashboard", "Pages", "Articles", "Services", "Account"]`;
5. append inside the first `describe`:

```ts
  it("Articles sits right after Pages in Content (spec §8.1)", () => {
    const content = NAV_SECTIONS.find((s) => s.label === "Content")!
    expect(content.items.slice(0, 2).map((i) => [i.label, i.href])).toEqual([
      ["Pages", "/admin/pages"],
      ["Articles", "/admin/articles"],
    ])
    expect(labels(["intake"])).not.toContain("Articles")
  })
```

`tests/integration/api/search.test.ts` — Phase 4's file with these changes:
1. replace

```ts
    expect(alarm.map((r) => [r.type, r.title])).toEqual([
      ["service", "Alarm Responses"],
      ["category", "Alarm Response"],
    ])
```

with

```ts
    expect(alarm.map((r) => [r.type, r.title])).toEqual([
      ["service", "Alarm Responses"],
      [
        "article",
        "Key Holding Explained: Who Responds When Your Alarm Goes Off",
      ],
      ["category", "Alarm Response"],
    ])
```

2. replace the comment `// marketer reads pages and services but not collections` with `// marketer reads pages, services and articles but not collections` and the expected `["service"]` list after it with `["service", "article"]`;
3. append inside the first `describe`:

```ts
  it("finds articles for every article reader; others' articles open read-only (Phase 5)", async () => {
    const author = await signedInUser(["author"])
    const results = (await search(author.cookie, "patrols")).filter(
      (r) => r.type === "article"
    )
    expect(results).toEqual([
      expect.objectContaining({
        title: "How Mobile Patrols Protect Your Business After Hours",
        subtitle: "/blog/mobile-patrols-protect-your-business-after-hours",
      }),
    ])
    expect(results[0].href).toMatch(/^\/admin\/articles\/[0-9a-f-]{36}$/)
    const opened = await adminRequest(
      results[0].href.replace("/admin", ""),
      { cookie: author.cookie }
    )
    expect(opened.status).toBe(200)
    expect(
      ((await opened.json()) as { permissions: { update: boolean } })
        .permissions.update
    ).toBe(false)
    expect(
      (await search(intake, "patrols")).filter((r) => r.type === "article")
    ).toEqual([])
  })
```

`tests/dom/articles-screen.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push, replace, search } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: { current: new URLSearchParams() },
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/articles",
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => search.current,
}))

import { ArticlesScreen } from "@/components/admin/articles/articles-screen"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type {
  ArticleListItem,
  ArticleOptions,
} from "@/lib/schemas/api/articles"

const item = (
  over: Partial<ArticleListItem> & Pick<ArticleListItem, "id" | "title">
): ArticleListItem => ({
  slug: over.id,
  live: false,
  category: { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
  author: { id: "u2", name: "Arthur Author", title: null },
  scheduledAt: null,
  readTimeMinutes: null,
  createdAt: "2026-10-16T09:00:00.000Z",
  permissions: {
    update: true,
    delete: true,
    submit: false,
    publish: true,
    changeAuthor: true,
  },
  version: 1,
  status: "draft",
  dirty: true,
  publishedAt: null,
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: null,
  ...over,
})

const ITEMS = [
  item({ id: "draft-one", title: "Draft one" }),
  item({ id: "review-me", title: "Review me", status: "in_review" }),
]

let options: ArticleOptions
const listCalls: URL[] = []
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  listCalls.length = 0
  search.current = new URLSearchParams()
  options = {
    categories: [
      { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
      { id: "c2", slug: "company-news", name: "Company News" },
    ],
    authors: [{ id: "u1", name: "Edith Editor", title: null }],
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname === "/api/v1/admin/articles/options")
        return json(options)
      if (url.pathname === "/api/v1/admin/articles") {
        listCalls.push(url)
        const status = url.searchParams.get("status")
        const items = ITEMS.filter((i) => !status || i.status === status)
        return json({ items, page: 1, pageSize: 20, total: items.length })
      }
      return json({ items: [], page: 1, pageSize: 24, total: 0 })
    })
  )
})

function renderScreen(roles: Role[] = ["editor"]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Edith Editor",
          email: "e@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <ArticlesScreen />
    </AdminShell>
  )
}

describe("articles list (master 5.3)", () => {
  it("opens the review queue from ?status=in_review and switches back to all", async () => {
    const user = userEvent.setup()
    search.current = new URLSearchParams("status=in_review")
    renderScreen()
    const table = await screen.findByRole("table", { name: "Articles" })
    expect(within(table).getByText("Review me")).toBeInTheDocument()
    expect(within(table).queryByText("Draft one")).toBeNull()
    expect(within(table).getByText("In review")).toBeInTheDocument()
    expect(listCalls.at(-1)?.searchParams.get("status")).toBe("in_review")
    expect(listCalls.at(-1)?.searchParams.get("sort")).toBe("updatedAt:desc")
    const queue = screen.getByRole("button", { name: "Review queue" })
    expect(queue).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "All" }))
    expect(replace).toHaveBeenCalledWith("/admin/articles", { scroll: false })
  })

  it("filters by category and byline", async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByRole("table", { name: "Articles" })
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("Category")).getByRole("option", {
          name: "Company News",
        })
      ).toBeInTheDocument()
    )
    await user.selectOptions(screen.getByLabelText("Category"), "c2")
    await waitFor(() =>
      expect(listCalls.at(-1)?.searchParams.get("category")).toBe("c2")
    )
    expect(listCalls.at(-1)?.searchParams.get("page")).toBe("1")
    expect(
      within(screen.getByLabelText("Byline"))
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Anyone", "Me", "Edith Editor"])
    await user.selectOptions(screen.getByLabelText("Byline"), "me")
    await waitFor(() =>
      expect(listCalls.at(-1)?.searchParams.get("author")).toBe("me")
    )
  })

  it("authors get New article and their own filter; viewers only read", async () => {
    options = { ...options, authors: [] }
    const { unmount } = renderScreen(["author"])
    await screen.findByRole("table", { name: "Articles" })
    expect(screen.getByRole("link", { name: "New article" })).toHaveAttribute(
      "href",
      "/admin/articles/new"
    )
    expect(screen.queryByRole("button", { name: "Review queue" })).toBeNull()
    expect(screen.getByRole("button", { name: "In review" })).toBeInTheDocument()
    expect(
      within(screen.getByLabelText("Byline"))
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Anyone", "Me"])
    unmount()
    renderScreen(["viewer"])
    await screen.findByRole("table", { name: "Articles" })
    expect(screen.queryByRole("link", { name: "New article" })).toBeNull()
  })
})
```

`tests/dom/new-article-form.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/articles/new",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { NewArticleForm } from "@/components/admin/articles/new-article-form"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"

const CATEGORY = "0190f0e0-0000-7000-8000-0000000000c1"
const IMAGE = {
  id: "0190f0e0-0000-7000-8000-0000000000m1",
  url: "/images/hero.jpg",
  alt: "Officer at night",
  mime: "image/jpeg",
  width: 1440,
  height: 748,
  size: 1,
  createdAt: "2026-10-16T00:00:00.000Z",
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const posted: unknown[] = []
beforeEach(() => {
  push.mockReset()
  posted.length = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname === "/api/v1/admin/articles/options")
        return json(200, {
          categories: [
            { id: CATEGORY, slug: "mobile-patrols", name: "Mobile Patrols" },
          ],
          authors: [{ id: "u1", name: "Edith Editor", title: null }],
        })
      if (url.pathname === "/api/v1/admin/articles" && init?.method === "POST") {
        posted.push(JSON.parse(String(init.body)))
        return json(201, { id: "0190f0e0-0000-7000-8000-0000000000a1" })
      }
      if (url.pathname === `/api/v1/admin/media/${IMAGE.id}`)
        return json(200, IMAGE)
      if (url.pathname === "/api/v1/admin/media")
        return json(200, { items: [IMAGE], page: 1, pageSize: 24, total: 1 })
      return json(404, { error: { code: "NOT_FOUND", message: "x" } })
    })
  )
})

describe("new article (master 5.3)", () => {
  it("derives the address, requires a category and opens the new draft", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell
        queryClient={makeQueryClient()}
        session={{
          user: {
            id: "u1",
            name: "Edith Editor",
            email: "e@example.test",
            title: null,
            twoFactorEnabled: true,
          },
          roles: ["editor"],
          impersonatedBy: null,
        }}
      >
        <NewArticleForm />
      </AdminShell>
    )
    await user.type(
      await screen.findByRole("textbox", { name: "Title" }),
      "Night Patrols & Key Holding"
    )
    expect(screen.getByLabelText("Address")).toHaveValue(
      "night-patrols-and-key-holding"
    )
    await user.type(
      screen.getByRole("textbox", { name: "Excerpt" }),
      "What a night patrol covers."
    )
    await user.click(screen.getByRole("button", { name: "Choose: Cover image" }))
    const picker = await screen.findByRole("dialog", {
      name: "Choose: Cover image",
    })
    await user.click(
      await within(picker).findByRole("button", { name: /Officer at night/ })
    )
    await user.click(
      within(picker).getByRole("button", { name: "Use this image" })
    )

    await user.click(screen.getByRole("button", { name: "Create draft" }))
    expect(await screen.findByText("Choose a category")).toBeInTheDocument()
    expect(posted).toEqual([])

    await user.selectOptions(screen.getByLabelText("Category"), CATEGORY)
    expect(screen.getByLabelText("Byline")).toHaveValue("u1")
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      slug: "night-patrols-and-key-holding",
      categoryId: CATEGORY,
      authorId: "u1",
      draft: {
        title: "Night Patrols & Key Holding",
        excerpt: "What a night patrol covers.",
        cover: { mediaId: IMAGE.id },
        lead: null,
        tags: [],
        body: null,
      },
    })
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/admin/articles/0190f0e0-0000-7000-8000-0000000000a1"
      )
    )
  })
})
```

`tests/dom/command-palette-articles.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"

function renderShell(roles: Role[]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Arthur Author",
          email: "a@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <p>Body</p>
    </AdminShell>
  )
}

beforeEach(() => {
  push.mockReset()
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                type: "article",
                id: "a1",
                title: "Key Holding Explained",
                subtitle: "/blog/key-holding-explained",
                href: "/admin/articles/a1",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    )
  )
})

async function openPalette() {
  const user = userEvent.setup()
  await user.keyboard("{Control>}k{/Control}")
  const dialog = await screen.findByRole("dialog", { name: "Search the admin" })
  return { user, dialog }
}

describe("⌘K palette and articles (Phase 5)", () => {
  it("offers Articles and New article to authors and opens article results", async () => {
    renderShell(["author"])
    const { user, dialog } = await openPalette()
    const labels = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent)
    expect(labels).toEqual(
      expect.arrayContaining(["Articles", "New article"])
    )
    await user.click(within(dialog).getByRole("option", { name: "New article" }))
    expect(push).toHaveBeenCalledWith("/admin/articles/new")

    const again = await openPalette()
    await again.user.type(
      within(again.dialog).getByRole("combobox", { name: "Search" }),
      "key"
    )
    const result = await within(again.dialog).findByRole("option", {
      name: /Key Holding Explained/,
    })
    expect(result).toHaveTextContent("Article · /blog/key-holding-explained")
    await again.user.click(result)
    expect(push).toHaveBeenCalledWith("/admin/articles/a1")
  })

  it("viewers can find articles but get no New article action", async () => {
    renderShell(["viewer"])
    const { dialog } = await openPalette()
    const labels = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent)
    expect(labels).toContain("Articles")
    expect(labels).not.toContain("New article")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit tests/unit/admin/article-status.test.ts tests/unit/admin/nav.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/admin/article-status"`; nav: `author sees ["Dashboard","Articles","Account"]` gets `["Dashboard","Account"]`.

Run: `pnpm test:integration tests/integration/api/search.test.ts`
Expected: FAIL — the "alarm" list has no `article` entry; the new test finds no article results.

Run: `pnpm exec vitest run --project dom tests/dom/articles-screen.test.tsx tests/dom/new-article-form.test.tsx tests/dom/command-palette-articles.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/articles/articles-screen"` / `new-article-form`; the palette has no "Articles"/"New article" options.

- [ ] **Step 3: Status helpers, editor meta, navigation, search, palette, dashboard link**

`lib/admin/article-status.ts`:

```ts
import { formatDateTime } from "@/lib/format"
import {
  CONTENT_STATUSES,
  type ContentStatus,
} from "@/lib/schemas/api/content"

export type StatusBadge = {
  text: string
  variant: "default" | "secondary" | "outline"
}

/** Badge for an article: its workflow step, or whether the site is up to date. */
export function articleStatusLabel(article: {
  status: ContentStatus
  live: boolean
  dirty: boolean
  scheduledAt: string | null
}): StatusBadge {
  if (article.status === "scheduled")
    return {
      text: article.scheduledAt
        ? `Scheduled · ${formatDateTime(article.scheduledAt)}`
        : "Scheduled",
      variant: "secondary",
    }
  if (article.status === "in_review")
    return { text: "In review", variant: "secondary" }
  if (!article.live) return { text: "Draft", variant: "outline" }
  if (article.dirty) return { text: "Unpublished changes", variant: "secondary" }
  return { text: "Published", variant: "default" }
}

/** The list's status buttons ("In review" reads "Review queue" for publishers). */
export const ARTICLE_STATUS_FILTERS: readonly {
  value: ContentStatus | null
  label: string
}[] = [
  { value: null, label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "in_review", label: "In review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
]

export function parseStatusParam(value: string | null): ContentStatus | null {
  return (CONTENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as ContentStatus)
    : null
}

export function articleListHref(status: ContentStatus | null): string {
  return status ? `/admin/articles?status=${status}` : "/admin/articles"
}
```

`components/admin/articles/article-meta.ts`:

```ts
import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor hints for an article (card on /blog + its own page). */
export const articleEditorMeta: EditorMeta = {
  fields: {
    title: { label: "Title" },
    excerpt: {
      label: "Excerpt",
      widget: "textarea",
      help: "Shown on blog cards. Also the intro when there is no lead.",
    },
    cover: { label: "Cover image" },
    lead: {
      label: "Lead",
      widget: "textarea",
      help: "The large intro under the title. Leave empty to use the excerpt.",
    },
    tags: {
      label: "Tags",
      itemName: "Tag",
      help: "Leave empty to show the category as the only tag.",
    },
    body: {
      label: "Article text",
      help: "Leave empty to show the excerpt instead.",
    },
  },
}
```

In `components/admin/shell/nav.ts`: add `Newspaper` to the `lucide-react` import (alphabetical) and insert this item in the "Content" section directly after the "Pages" item:

```ts
      {
        label: "Articles",
        href: "/admin/articles",
        icon: Newspaper,
        permission: { article: ["read"] },
        match: "prefix",
      },
```

In `lib/schemas/api/search.ts`: insert `"article",` in `SEARCH_TYPES` directly after `"service",`.

In `server/modules/search/repo.ts` append:

```ts
export function searchArticles(db: DbOrTx, q: string, limit: number) {
  return db
    .select({ id: articles.id, slug: articles.slug, title: articleTitle })
    .from(articles)
    .where(
      or(ilike(articleTitle, contains(q)), ilike(articles.slug, contains(q)))
    )
    .orderBy(sql`${articles.publishedAt} desc nulls first`, asc(articles.slug))
    .limit(limit)
}
```

In `server/modules/search/service.ts`, directly after the `if (can({ service: ["read"] })) for (…) items.push({ type: "service", … })` statement, add:

```ts
  // Every article reader may find every article; the editor then applies
  // that reader's rights (others' articles open read-only for authors).
  if (can({ article: ["read"] }))
    for (const row of await repo.searchArticles(db, q, LIMIT))
      items.push({
        type: "article",
        id: row.id,
        title: row.title,
        subtitle: `/blog/${row.slug}`,
        href: `/admin/articles/${row.id}`,
      })
```

In `components/admin/shell/command-palette.tsx`:
1. add `Newspaper` to the `lucide-react` import (alphabetical);
2. add `article: Newspaper,` to `TYPE_ICONS` and `article: "Article",` to `TYPE_LABELS` (each directly after the `service` entry);
3. directly after `const canCreateService = usePermission({ service: ["create"] })` add `const canCreateArticle = usePermission({ article: ["create"] })`;
4. in the `actions` array, directly after the `canCreateService && { id: "new-service", … }` entry, add:

```ts
    canCreateArticle && {
      id: "new-article",
      label: "New article",
      icon: Plus,
      run: () => router.push("/admin/articles/new"),
    },
```

5. change the dialog `description` to `"Jump to a section, run an action or find a page, service, article or team member."`.

In `server/modules/dashboard/service.ts`, in the `id: "review"` Next-up item, replace `href: "/admin/articles",` with `href: "/admin/articles?status=in_review",`.

- [ ] **Step 4: Articles list screen**

`components/admin/articles/articles-screen.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import {
  columnsFor,
  DataTable,
  type DataTableColumns,
} from "@/components/admin/data-table/data-table"
import { FilterSelect } from "@/components/admin/filter-field"
import { PageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonClassName } from "@/components/ui/button"
import { usePermission } from "@/hooks/use-permission"
import {
  ARTICLE_STATUS_FILTERS,
  articleListHref,
  articleStatusLabel,
  parseStatusParam,
} from "@/lib/admin/article-status"
import { api, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { ArticleListItem } from "@/lib/schemas/api/articles"
import type { ContentStatus } from "@/lib/schemas/api/content"
import type { Paginated } from "@/lib/schemas/api/list"

type Row = ArticleListItem & Record<string, unknown>
const ch = columnsFor<Row>()

const columns = ch.columns([
  ch.accessor("title", {
    header: "Article",
    cell: (info) => (
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/admin/articles/${info.row.original.id}`}
          className="font-medium hover:underline"
        >
          {info.getValue()}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          /blog/{info.row.original.slug}
        </span>
      </div>
    ),
  }),
  ch.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = articleStatusLabel(row.original)
      return <Badge variant={s.variant}>{s.text}</Badge>
    },
  }),
  ch.display({
    id: "category",
    header: "Category",
    cell: ({ row }) => row.original.category.name,
  }),
  ch.display({
    id: "author",
    header: "Byline",
    cell: ({ row }) =>
      row.original.author?.name ?? (
        <span className="text-muted-foreground">None</span>
      ),
  }),
  ch.accessor("publishedAt", {
    header: "Published",
    cell: (info) => (
      <span className="text-muted-foreground">
        {info.getValue() ? formatDateTime(info.getValue()!) : "—"}
      </span>
    ),
  }),
  ch.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => (
      <span className="text-muted-foreground">
        {formatDateTime(info.getValue())}
      </span>
    ),
  }),
]) as unknown as DataTableColumns<Row>

/** Articles (spec §8.1): status filters incl. the review queue, category, byline. */
export function ArticlesScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = parseStatusParam(searchParams.get("status"))
  const canCreate = usePermission({ article: ["create"] })
  const canReview = usePermission({ article: ["publish"] })
  const [category, setCategory] = useState("")
  const [author, setAuthor] = useState("")
  const options = useQuery({
    queryKey: ["articles", "options"],
    queryFn: () => unwrap(api.articles.options.$get()),
  })
  const filters = {
    status: status ?? undefined,
    category: category || undefined,
    author: author || undefined,
  }
  const filterKey =
    status || category || author ? `${status ?? ""}|${category}|${author}` : ""
  const setStatus = (next: ContentStatus | null) =>
    router.replace(articleListHref(next), { scroll: false })

  return (
    <>
      <PageHeader
        title="Articles"
        description="Blog posts. Authors write drafts and submit them for review; editors publish them now or schedule them."
        actions={
          canCreate ? (
            <Link href="/admin/articles/new" className={buttonClassName({})}>
              <Plus aria-hidden />
              New article
            </Link>
          ) : null
        }
      />
      <div role="group" aria-label="Status" className="mb-4 flex flex-wrap gap-2">
        {ARTICLE_STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.label}
            type="button"
            size="sm"
            variant={status === filter.value ? "default" : "outline"}
            aria-pressed={status === filter.value}
            onClick={() => setStatus(filter.value)}
          >
            {filter.value === "in_review" && canReview
              ? "Review queue"
              : filter.label}
          </Button>
        ))}
      </div>
      <DataTable<Row>
        label="Articles"
        queryKey={["articles", filters]}
        filterKey={filterKey}
        searchPlaceholder="Search titles and addresses"
        initialSort={[{ id: "updatedAt", desc: true }]}
        toolbar={
          <>
            <FilterSelect
              id="articles-category"
              label="Category"
              value={category}
              onChange={setCategory}
            >
              <option value="">All categories</option>
              {(options.data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              id="articles-author"
              label="Byline"
              value={author}
              onChange={setAuthor}
            >
              <option value="">Anyone</option>
              <option value="me">Me</option>
              {(options.data?.authors ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </FilterSelect>
          </>
        }
        fetchPage={async (params) =>
          (await unwrap(
            api.articles.$get({
              query: {
                page: String(params.page),
                pageSize: String(params.pageSize),
                sort: params.sort,
                q: params.q,
                status: filters.status,
                category: filters.category,
                author: filters.author,
              },
            })
          )) as Paginated<Row>
        }
        columns={columns}
        renderCard={(row) => {
          const s = articleStatusLabel(row)
          return (
            <Link
              href={`/admin/articles/${row.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{row.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {row.category.name}
                  {row.author ? ` · ${row.author.name}` : ""}
                </span>
              </span>
              <Badge variant={s.variant}>{s.text}</Badge>
            </Link>
          )
        }}
        empty={
          status === "in_review"
            ? "Nothing is waiting for review."
            : "No articles yet."
        }
      />
    </>
  )
}
```

`components/admin/articles/new-article-form.tsx`:

```tsx
"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { issuesToFieldErrors } from "@/components/admin/editor/versioned-editor"
import { FilterSelect } from "@/components/admin/filter-field"
import { PageHeader } from "@/components/admin/page-header"
import { emptyValue } from "@/components/admin/schema-form/empty-value"
import { SchemaForm } from "@/components/admin/schema-form/schema-form"
import { useAdminSession } from "@/components/admin/session-provider"
import { slugify } from "@/components/admin/services/new-service-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { articleContent } from "@/lib/schemas/content/article"

import { articleEditorMeta } from "./article-meta"

/** What a new article needs before its editor opens (the rest is written there). */
const basics = articleContent.pick({ title: true, excerpt: true, cover: true })

/** New article: address, category, byline and the card fields → draft → editor. */
export function NewArticleForm() {
  const router = useRouter()
  const { user } = useAdminSession()
  const options = useQuery({
    queryKey: ["articles", "options"],
    queryFn: () => unwrap(api.articles.options.$get()),
  })
  const [draft, setDraft] = useState<unknown>(() => emptyValue(basics))
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [categoryId, setCategoryId] = useState("")
  const [authorId, setAuthorId] = useState(user.id)
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>()
  const title = (draft as { title?: string }).title ?? ""
  const effectiveSlug = slugTouched ? slug : slugify(title)
  const slugValid = SLUG_PATTERN.test(effectiveSlug)
  // Only editors get byline candidates (Task 1 options).
  const authors = options.data?.authors ?? []

  const create = useMutation({
    mutationFn: async () => {
      const parsed = basics.safeParse(draft)
      const fieldErrors = parsed.success ? {} : issuesToFieldErrors(parsed.error)
      if (!categoryId) fieldErrors.categoryId = ["Choose a category"]
      if (!parsed.success || !categoryId) {
        setErrors(fieldErrors)
        throw new Error("Fill in the marked fields first.")
      }
      return unwrap(
        api.articles.$post({
          json: {
            slug: effectiveSlug,
            categoryId,
            ...(authors.length > 0 ? { authorId: authorId || null } : {}),
            draft: { ...parsed.data, lead: null, tags: [], body: null },
          },
        })
      )
    },
    onSuccess: (dto) => {
      toast.success("Draft created", {
        description: "Write the article, then submit it for review or publish it.",
      })
      router.push(`/admin/articles/${dto.id}`)
    },
    onError: (err) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors)
      toast.error("Not created", {
        description: err instanceof ApiError ? errorMessage(err) : err.message,
      })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New article"
        description="Start with the blog card. The draft stays private until it is published."
        actions={
          <Button
            type="button"
            disabled={create.isPending || !slugValid}
            onClick={() => create.mutate()}
          >
            Create draft
          </Button>
        }
      />
      <section
        aria-labelledby="new-article-place"
        className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6"
      >
        <h2 id="new-article-place" className="text-base font-bold">
          Address and category
        </h2>
        <div className="flex flex-col gap-2">
          <label htmlFor="new-article-slug" className="text-sm font-medium">
            Address
          </label>
          <div className="flex max-w-md items-center gap-2">
            <span className="text-sm text-muted-foreground">/blog/</span>
            <Input
              id="new-article-slug"
              value={effectiveSlug}
              aria-invalid={!slugValid || !!errors?.slug}
              aria-describedby="new-article-slug-help"
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value)
              }}
            />
          </div>
          <p
            id="new-article-slug-help"
            className={
              errors?.slug || (effectiveSlug && !slugValid)
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {errors?.slug?.[0] ??
              "Lowercase letters, numbers and single hyphens. Follows the title until you change it."}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <FilterSelect
            id="new-article-category"
            label="Category"
            value={categoryId}
            onChange={(value) => {
              setCategoryId(value)
              setErrors((e) => (e ? { ...e, categoryId: [] } : e))
            }}
          >
            <option value="">Choose…</option>
            {(options.data?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          {authors.length > 0 ? (
            <FilterSelect
              id="new-article-author"
              label="Byline"
              value={authorId}
              onChange={setAuthorId}
            >
              <option value="">No byline</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </FilterSelect>
          ) : null}
        </div>
        {errors?.categoryId?.[0] ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.categoryId[0]}
          </p>
        ) : null}
      </section>
      <SchemaForm
        schema={basics}
        meta={articleEditorMeta}
        value={draft as never}
        onChange={setDraft}
        errors={errors}
      />
    </div>
  )
}
```

`app/(admin)/admin/(panel)/articles/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { ArticlesScreen } from "@/components/admin/articles/articles-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Articles" }

export default function ArticlesPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ article: ["read"] })
  return <ArticlesScreen />
}
```

`app/(admin)/admin/(panel)/articles/new/page.tsx`:

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { NewArticleForm } from "@/components/admin/articles/new-article-form"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "New article" }

export default function NewArticlePage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ article: ["create"] })
  return <NewArticleForm />
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec next typegen && pnpm exec vitest run --project unit tests/unit/admin`
Expected: PASS (article-status 2 tests; nav incl. the new Articles test).

Run: `pnpm test:integration tests/integration/api/search.test.ts tests/integration/api/dashboard.test.ts`
Expected: PASS.

Run: `pnpm exec vitest run --project dom tests/dom/articles-screen.test.tsx tests/dom/new-article-form.test.tsx tests/dom/command-palette-articles.test.tsx tests/dom/command-palette.test.tsx tests/dom/admin-shell.test.tsx tests/dom/dashboard.test.tsx`
Expected: PASS (3 + 1 + 2 new; Phase 4 shell/palette/dashboard tests unchanged).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0; `/admin/articles` and `/admin/articles/new` are `◐`.

- [ ] **Step 6: Re-baseline the admin shell (sidebar gains "Articles")**

Port 3100 must be free and no other agent may be running Playwright or `next build`.

Run: `pnpm exec playwright test tests/visual/admin-shell.spec.ts --update-snapshots=changed`
Expected: `3 passed, 1 skipped`; `git status` shows exactly `tests/visual/__screenshots__/admin-shell-desktop.png` and `admin-shell-nav-mobile.png` modified. Open both: "Articles" sits between "Pages" and "Services"; nothing else moved.

Run: `pnpm test:visual` (twice)
Expected: `43 passed, 1 skipped` both times (40 public baselines 0 px).

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write lib/admin/article-status.ts components/admin/articles "app/(admin)/admin/(panel)/articles" components/admin/shell/nav.ts components/admin/shell/command-palette.tsx lib/schemas/api/search.ts server/modules/search server/modules/dashboard/service.ts tests/unit/admin tests/integration/api/search.test.ts tests/dom/articles-screen.test.tsx tests/dom/new-article-form.test.tsx tests/dom/command-palette-articles.test.tsx
git add lib/admin/article-status.ts components/admin/articles "app/(admin)/admin/(panel)/articles" components/admin/shell/nav.ts components/admin/shell/command-palette.tsx lib/schemas/api/search.ts server/modules/search server/modules/dashboard/service.ts tests/unit/admin/article-status.test.ts tests/unit/admin/nav.test.ts tests/integration/api/search.test.ts tests/dom/articles-screen.test.tsx tests/dom/new-article-form.test.tsx tests/dom/command-palette-articles.test.tsx tests/visual/__screenshots__/admin-shell-desktop.png tests/visual/__screenshots__/admin-shell-nav-mobile.png
git commit -m "feat: add articles list, review queue and new article screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Article editor — workflow actions, schedule dialog (Europe/Dublin), settings, preview, E2E (master Task 5.3, part 2)

**Files:**
- Create: `components/admin/articles/{article-editor.tsx,workflow-actions.tsx,schedule-dialog.tsx,article-settings.tsx}`, `app/(admin)/admin/(panel)/articles/[id]/page.tsx`
- Modify: `lib/format.ts` (Irish wall-clock ↔ instant), `components/admin/editor/versioned-editor.tsx` (render-prop `actions`/`aside`, `status` formatter), `lib/schemas/api/preview.ts` + `server/modules/preview/service.ts` (`article` preview), `tests/e2e/fixtures.ts`, `tests/e2e/seed.ts` (author user)
- Test: `tests/unit/format-dublin.test.ts`, `tests/dom/schedule-dialog.test.tsx`, `tests/dom/article-editor.test.tsx`, `tests/integration/api/article-preview.test.ts`, `tests/e2e/articles.spec.ts`

**Interfaces:**
- Consumes: Task 1 API/DTOs; Task 3 `RichTextEditor` (via SchemaForm); Task 4 `articleEditorMeta`, `articleStatusLabel`; Phase 4 `VersionedEditor`, `SchemaForm`, `NativeSelect`, `previewHref`/`previewPath`, `api`/`unwrap`/`ApiError`/`errorMessage`, `formatDateTime`, `SITE_TIME_ZONE`, shadcn `dialog`/`alert-dialog`/`input`/`button`/`spinner`, `AdminShell`/`makeQueryClient` (tests); e2e `clientIpFor`/`readFixtures`/`E2E_PASSWORD`/`BASE_URL`.
- Produces:

```ts
// lib/format.ts (appended)
export function toDublinInput(date: Date): string                 // "2026-07-01T10:00" (Irish wall clock, for <input type="datetime-local">)
export function fromDublinInput(value: string): Date | null        // spring gap → one hour later; autumn repeat → the later (GMT) instant
// components/admin/editor/versioned-editor.tsx (additive)
export type EditorActionContext<Dto> = { record: Dto; draft: unknown; flush(): Promise<boolean>; version(): number; accept(dto: Dto): void; showAllErrors(): boolean }
VersionedEditorProps += { actions?: ReactNode | ((ctx) => ReactNode); aside?: ReactNode | ((ctx) => ReactNode); status?: (record: Dto, dirty: boolean) => { text; variant } }
// components/admin/articles/*
export function ScheduleDialog(props: { open; onOpenChange; initial: string | null; pending: boolean; onConfirm(scheduledAt: string): void; now?: () => Date }): JSX.Element
export function WorkflowActions(props: { ctx: EditorActionContext<ArticleDto> }): JSX.Element
export function ArticleSettings(props: { ctx: EditorActionContext<ArticleDto> }): JSX.Element
export function ArticleEditor(props: { id: string }): JSX.Element
// lib/schemas/api/preview.ts
PREVIEW_ENTITIES += "article"     // GET /api/v1/admin/preview?entity=article&id=<uuid> → 302 /blog/<slug>
// Route: /admin/articles/[id] (article:read; uuid else 404)
```

Editor decisions (fixed): the editor reuses Phase 4's `VersionedEditor` (autosave, ⌘S, conflict dialog, history, preview, publish with diff). Edit rights come from the article's `permissions` (an author's own unpublished, unscheduled draft is editable; everything else opens read-only). Header actions: "Submit for review" (authors; drafts only), "Schedule"/"Reschedule" + "Cancel schedule" + "Unpublish" (publishers), then History, Preview, Publish. Submit and Schedule first save pending edits and refuse invalid drafts. The side panel holds "Address and category" (slug, category, byline for editors; saved with "Save settings", live at once), "Details" (on the site since, scheduled for, read time, created, last change) and "Delete article" (when allowed). The schedule dialog takes an Irish wall-clock time (`datetime-local`, minute steps, minimum = now), shows how it reads ("Goes live 1 Jul 2026, 10:00 (Irish time).") and sends the UTC instant.

- [ ] **Step 1: Write the failing tests**

`tests/unit/format-dublin.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { fromDublinInput, toDublinInput } from "@/lib/format"

describe("Irish wall-clock time ↔ instant (schedule dialog, Europe/Dublin)", () => {
  it("shows an instant as Irish local time", () => {
    expect(toDublinInput(new Date("2026-07-01T09:00:00Z"))).toBe(
      "2026-07-01T10:00"
    )
    expect(toDublinInput(new Date("2026-12-01T10:00:00Z"))).toBe(
      "2026-12-01T10:00"
    )
  })

  it("reads summer (IST, UTC+1) and winter (GMT) times", () => {
    expect(fromDublinInput("2026-07-01T10:00")?.toISOString()).toBe(
      "2026-07-01T09:00:00.000Z"
    )
    expect(fromDublinInput("2026-12-01T10:00")?.toISOString()).toBe(
      "2026-12-01T10:00:00.000Z"
    )
  })

  it("handles the clock changes (29 Mar and 25 Oct 2026)", () => {
    // 01:30 does not exist on 29 March: it means 02:30 IST.
    expect(fromDublinInput("2026-03-29T01:30")?.toISOString()).toBe(
      "2026-03-29T01:30:00.000Z"
    )
    // 01:30 happens twice on 25 October: the later (GMT) one.
    expect(fromDublinInput("2026-10-25T01:30")?.toISOString()).toBe(
      "2026-10-25T01:30:00.000Z"
    )
  })

  it("round-trips and rejects malformed values", () => {
    const at = new Date("2026-10-20T08:15:00Z")
    expect(fromDublinInput(toDublinInput(at))?.toISOString()).toBe(
      at.toISOString()
    )
    for (const bad of ["", "2026-07-01", "2026-13-01T10:00", "2026-07-01T24:00", "tomorrow"])
      expect(fromDublinInput(bad)).toBeNull()
  })
})
```

`tests/dom/schedule-dialog.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ScheduleDialog } from "@/components/admin/articles/schedule-dialog"

const NOW = () => new Date("2026-06-01T12:00:00Z")

function renderDialog(initial: string | null = null) {
  const onConfirm = vi.fn()
  render(
    <ScheduleDialog
      open
      onOpenChange={vi.fn()}
      initial={initial}
      pending={false}
      onConfirm={onConfirm}
      now={NOW}
    />
  )
  const dialog = screen.getByRole("dialog", { name: "Schedule publishing" })
  return { dialog, onConfirm, input: within(dialog).getByLabelText("Publish on") }
}

describe("schedule dialog (master 5.3: Europe/Dublin)", () => {
  it("starts an hour from now in Irish time, or at the current schedule", () => {
    expect(renderDialog().input).toHaveValue("2026-06-01T14:00")
  })

  it("shows an existing schedule in Irish time", () => {
    expect(renderDialog("2026-12-24T09:30:00.000Z").input).toHaveValue(
      "2026-12-24T09:30"
    )
  })

  it("sends the UTC instant of the Irish time picked", async () => {
    const user = userEvent.setup()
    const { dialog, input, onConfirm } = renderDialog()
    fireEvent.change(input, { target: { value: "2026-07-01T10:00" } })
    expect(dialog).toHaveTextContent("Goes live")
    await user.click(within(dialog).getByRole("button", { name: "Schedule" }))
    expect(onConfirm).toHaveBeenCalledWith("2026-07-01T09:00:00.000Z")
  })

  it("refuses a time in the past", async () => {
    const user = userEvent.setup()
    const { dialog, input, onConfirm } = renderDialog()
    fireEvent.change(input, { target: { value: "2026-05-31T10:00" } })
    await user.click(within(dialog).getByRole("button", { name: "Schedule" }))
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose a time in the future."
    )
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
```

`tests/dom/article-editor.test.tsx`:

```tsx
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/articles/x",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { ArticleEditor } from "@/components/admin/articles/article-editor"
import { makeQueryClient } from "@/components/admin/providers"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"
import type {
  ArticleDto,
  ArticlePermissions,
} from "@/lib/schemas/api/articles"
import { articlesFixture } from "@/server/db/seed/fixtures/articles"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"

const ID = "0190f0e0-0000-7000-8000-0000000000a1"
const seeded = articlesFixture(fixtureMediaLookup).find((a) => a.content.body)!
const AUTHOR: ArticlePermissions = {
  update: true,
  delete: true,
  submit: true,
  publish: false,
  changeAuthor: false,
}
const EDITOR: ArticlePermissions = {
  update: true,
  delete: true,
  submit: true,
  publish: true,
  changeAuthor: true,
}

const dto = (over: Partial<ArticleDto> = {}): ArticleDto => ({
  id: ID,
  slug: "night-patrols",
  title: "Night Patrols",
  live: false,
  category: { id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" },
  author: { id: "u1", name: "Arthur Author", title: null },
  scheduledAt: null,
  readTimeMinutes: null,
  createdAt: "2026-10-16T09:00:00.000Z",
  permissions: AUTHOR,
  draft: { ...seeded.content, title: "Night Patrols" },
  published: null,
  version: 1,
  status: "draft",
  dirty: true,
  publishedAt: null,
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: { id: "u1", name: "Arthur Author" },
  ...over,
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

let routes: Record<string, (init?: RequestInit) => Response>
const calls: { key: string; body: unknown }[] = []

beforeEach(() => {
  calls.length = 0
  routes = {
    [`GET /api/v1/admin/articles/${ID}`]: () => json(200, dto()),
    "GET /api/v1/admin/articles/options": () =>
      json(200, {
        categories: [{ id: "c1", slug: "mobile-patrols", name: "Mobile Patrols" }],
        authors: [],
      }),
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const key = `${init?.method ?? "GET"} ${url.pathname}`
      calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : null })
      const route = routes[key]
      if (route) return route(init)
      if (url.pathname.startsWith("/api/v1/admin/media/"))
        return json(404, { error: { code: "NOT_FOUND", message: "x" } })
      return json(200, { items: [], page: 1, pageSize: 24, total: 0 })
    })
  )
})

function renderEditor(roles: Role[]) {
  return render(
    <AdminShell
      queryClient={makeQueryClient()}
      session={{
        user: {
          id: "u1",
          name: "Arthur Author",
          email: "a@example.test",
          title: null,
          twoFactorEnabled: true,
        },
        roles,
        impersonatedBy: null,
      }}
    >
      <ArticleEditor id={ID} />
    </AdminShell>
  )
}

const badge = () =>
  screen.getByRole("main").querySelector('[data-slot="badge"]')

describe("article editor (master 5.3)", () => {
  it("author: Submit for review saves first and sends the new version; no Publish or Schedule", async () => {
    const user = userEvent.setup()
    routes[`PUT /api/v1/admin/articles/${ID}/draft`] = (init) => {
      const body = JSON.parse(String(init?.body)) as { draft: ArticleDto["draft"] }
      return json(200, dto({ version: 2, draft: body.draft, title: body.draft.title }))
    }
    routes[`POST /api/v1/admin/articles/${ID}/submit`] = () =>
      json(200, dto({ version: 3, status: "in_review", title: "Night Patrols 2" }))
    renderEditor(["author"])
    const title = await screen.findByRole("textbox", { name: "Title" })
    expect(
      screen.queryByRole("button", { name: "Publish", exact: true })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Schedule" })).toBeNull()
    await user.type(title, " 2")
    await user.click(screen.getByRole("button", { name: "Submit for review" }))
    await waitFor(() => expect(badge()).toHaveTextContent("In review"))
    const keys = calls.map((c) => c.key)
    const put = keys.indexOf(`PUT /api/v1/admin/articles/${ID}/draft`)
    const submit = keys.indexOf(`POST /api/v1/admin/articles/${ID}/submit`)
    expect(put).toBeGreaterThan(-1)
    expect(submit).toBeGreaterThan(put)
    expect(calls[submit].body).toEqual({ version: 2 })
  })

  it("editor: Schedule takes Irish time and posts the UTC instant", async () => {
    const user = userEvent.setup()
    routes[`GET /api/v1/admin/articles/${ID}`] = () =>
      json(200, dto({ permissions: EDITOR }))
    routes[`POST /api/v1/admin/articles/${ID}/schedule`] = (init) => {
      const body = JSON.parse(String(init?.body)) as { scheduledAt: string }
      return json(
        200,
        dto({
          permissions: EDITOR,
          version: 2,
          status: "scheduled",
          scheduledAt: body.scheduledAt,
        })
      )
    }
    renderEditor(["editor"])
    await user.click(await screen.findByRole("button", { name: "Schedule" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Schedule publishing",
    })
    fireEvent.change(within(dialog).getByLabelText("Publish on"), {
      target: { value: "2099-07-01T10:00" },
    })
    await user.click(within(dialog).getByRole("button", { name: "Schedule" }))
    await waitFor(() => expect(badge()).toHaveTextContent(/^Scheduled · /))
    const post = calls.find(
      (c) => c.key === `POST /api/v1/admin/articles/${ID}/schedule`
    )
    expect(post?.body).toEqual({
      version: 1,
      scheduledAt: "2099-07-01T09:00:00.000Z",
    })
    expect(
      screen.getByRole("button", { name: "Cancel schedule" })
    ).toBeInTheDocument()
  })

  it("opens read-only when the user may not change the article", async () => {
    routes[`GET /api/v1/admin/articles/${ID}`] = () =>
      json(
        200,
        dto({
          live: true,
          status: "published",
          published: dto().draft,
          dirty: false,
          publishedAt: "2026-10-16T10:00:00.000Z",
          permissions: { ...AUTHOR, update: false, delete: false, submit: false },
        })
      )
    renderEditor(["author"])
    expect(await screen.findByRole("textbox", { name: "Title" })).toBeDisabled()
    expect(screen.queryByRole("status", { name: /^Save status/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Delete article" })).toBeNull()
    expect(screen.getByLabelText("Address")).toBeDisabled()
  })
})
```

`tests/integration/api/article-preview.test.ts`:

```ts
import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"

const { enable } = vi.hoisted(() => ({ enable: vi.fn() }))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  draftMode: async () => ({ isEnabled: false, enable, disable: vi.fn() }),
}))

import { getDb } from "@/server/db/client"
import { articles } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let author: string
let intake: string
let id: string

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  author = (await signedInUser(["author"])).cookie
  intake = (await signedInUser(["intake"])).cookie
  const [row] = await getDb()
    .select()
    .from(articles)
    .where(eq(articles.slug, "key-holding-explained"))
  id = row.id
})

describe("article preview (master 5.3)", () => {
  it("opens the article's public URL in draft mode for any article reader", async () => {
    const res = await adminRequest(`/preview?entity=article&id=${id}`, {
      cookie: author,
    })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/blog/key-holding-explained")
    expect(enable).toHaveBeenCalledTimes(1)
  })

  it("needs article:read and an existing article", async () => {
    expect(
      (await adminRequest(`/preview?entity=article&id=${id}`, { cookie: intake }))
        .status
    ).toBe(403)
    expect(
      (
        await adminRequest(
          "/preview?entity=article&id=0190f0e0-0000-7000-8000-000000000999",
          { cookie: author }
        )
      ).status
    ).toBe(404)
    expect(
      (await adminRequest("/preview?entity=article&id=nope", { cookie: author }))
        .status
    ).toBe(404)
  })
})
```

`tests/e2e/articles.spec.ts`:

```ts
import { type Browser, expect, type Page, test } from "@playwright/test"

import type { ArticleDto } from "@/lib/schemas/api/articles"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Master 5.3 + Review Focus 5: an author drafts and submits; publishing via
// the API is refused; an editor publishes from the review queue; the article
// is then on /blog and at /blog/<slug>. Runs on the seeded sp_e2e.

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

const TITLE = "Night Patrol Checklist"
const SLUG = "night-patrol-checklist"
const BODY = "Check every door and window before you leave the site."

const saveStatus = (page: Page) =>
  page.getByRole("status", { name: /^Save status/ })
const badge = (page: Page) =>
  page.getByRole("main").locator('[data-slot="badge"]').first()

async function visitor(browser: Browser) {
  const context = await browser.newContext()
  return { context, page: await context.newPage() }
}

test("author drafts and submits, cannot publish via the API; an editor publishes; the blog shows it", async ({
  page,
  browser,
}, testInfo) => {
  const { author, editor } = readFixtures()

  // Author: new draft.
  await signIn(page, author.email)
  await page.goto("/admin/articles/new")
  await page.getByRole("textbox", { name: "Title" }).fill(TITLE)
  await expect(page.getByLabel("Address")).toHaveValue(SLUG)
  await page
    .getByRole("textbox", { name: "Excerpt" })
    .fill("Ten checks our officers make on every night patrol.")
  await page.getByLabel("Category").selectOption({ label: "Mobile Patrols" })
  await page.getByRole("button", { name: "Choose: Cover image" }).click()
  const picker = page.getByRole("dialog", { name: "Choose: Cover image" })
  await picker.getByRole("searchbox", { name: "Search images" }).fill("hero")
  await picker
    .getByRole("list", { name: "Images" })
    .getByRole("button")
    .first()
    .click()
  await picker.getByRole("button", { name: "Use this image" }).click()
  await expect(picker).toBeHidden()
  await page.getByRole("button", { name: "Create draft" }).click()
  await expect(page).toHaveURL(/\/admin\/articles\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible()
  await expect(badge(page)).toHaveText("Draft")

  // Author: write, autosave, submit. No Publish/Schedule for authors.
  await page.getByRole("textbox", { name: "Article text" }).click()
  await page.keyboard.type(BODY)
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 10_000 })
  await expect(
    page.getByRole("button", { name: "Publish", exact: true })
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Schedule" })).toHaveCount(0)
  await page.getByRole("button", { name: "Submit for review" }).click()
  await expect(badge(page)).toHaveText("In review")

  // Review Focus 5 through the API: the same request path accepts the
  // author's draft save but refuses their publish.
  const id = new URL(page.url()).pathname.split("/").pop()!
  const headers = { origin: BASE_URL }
  const current = (await (
    await page.request.get(`/api/v1/admin/articles/${id}`)
  ).json()) as ArticleDto
  const save = await page.request.put(`/api/v1/admin/articles/${id}/draft`, {
    headers,
    data: { draft: current.draft, version: current.version },
  })
  expect(save.status()).toBe(200)
  const { version } = (await save.json()) as ArticleDto
  const publish = await page.request.post(
    `/api/v1/admin/articles/${id}/publish`,
    { headers, data: { version } }
  )
  expect(publish.status()).toBe(403)
  expect(
    ((await publish.json()) as { error: { code: string } }).error.code
  ).toBe("FORBIDDEN")

  // Not on the site yet.
  const anon = await visitor(browser)
  await anon.page.goto(`/blog/${SLUG}`)
  await expect(
    anon.page.getByRole("heading", { level: 1, name: TITLE })
  ).toHaveCount(0)

  // Editor: review queue → publish.
  const editorContext = await browser.newContext({
    extraHTTPHeaders: {
      "x-forwarded-for": clientIpFor(`${testInfo.title} editor`),
    },
  })
  const editorPage = await editorContext.newPage()
  await signIn(editorPage, editor.email)
  await editorPage.goto("/admin/articles")
  await editorPage.getByRole("button", { name: "Review queue" }).click()
  await editorPage.getByRole("link", { name: TITLE }).click()
  await expect(
    editorPage.getByRole("heading", { level: 1, name: TITLE })
  ).toBeVisible()
  await editorPage.getByRole("button", { name: "Publish", exact: true }).click()
  await editorPage
    .getByRole("dialog", { name: "Publish changes?" })
    .getByRole("button", { name: "Publish now" })
    .click()
  await expect(
    editorPage.getByText("The site shows the new version now.")
  ).toBeVisible()
  await expect(badge(editorPage)).toHaveText("Published")
  await editorContext.close()

  // Public: newest card on /blog, and its own page.
  await anon.page.goto("/blog")
  await expect(
    anon.page.getByRole("heading", { level: 3, name: TITLE })
  ).toBeVisible()
  await anon.page.goto(`/blog/${SLUG}`)
  await expect(
    anon.page.getByRole("heading", { level: 1, name: TITLE })
  ).toBeVisible()
  await expect(anon.page.getByText(BODY)).toBeVisible()
  await anon.context.close()
})
```

`tests/e2e/fixtures.ts`: in `type E2EFixtures`, after the `admin` line (Phase 4 Task 12), add:

```ts
  author: { email: string; name: string }
```

`tests/e2e/seed.ts`: directly after the `admin` `createUser` call (Phase 4 Task 12) add

```ts
// Articles workflow (Phase 5): an author who drafts and submits.
const author = { email: "author@e2e.test", name: "Arthur Author" }
await auth.api.createUser({
  body: { ...author, role: ["author"], password: E2E_PASSWORD },
})
```

and add `author,` to the `const fixtures: E2EFixtures = { … }` object after `admin,`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/format-dublin.test.ts`
Expected: FAIL — `toDublinInput is not a function` (not exported from `@/lib/format`).

Run: `pnpm exec vitest run --project dom tests/dom/schedule-dialog.test.tsx tests/dom/article-editor.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/articles/schedule-dialog"` / `article-editor`.

Run: `pnpm test:integration tests/integration/api/article-preview.test.ts`
Expected: FAIL — 422 (`entity` must be one of page, service, settings) instead of 302.

- [ ] **Step 3: Irish time helpers, VersionedEditor extension, preview**

Append to `lib/format.ts`:

```ts
// Schedule dialog: <input type="datetime-local"> holds Irish wall-clock time.
const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: SITE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function wallClockParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    wallClock.formatToParts(date).map((p) => [p.type, p.value])
  )
}

/** Minutes Irish time is ahead of UTC at `date` (0 in winter, 60 in summer). */
function dublinOffsetMinutes(date: Date): number {
  const p = wallClockParts(date)
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  )
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000)
}

/** "2026-07-01T10:00": the Irish wall-clock time of an instant (datetime-local value). */
export function toDublinInput(date: Date): string {
  const p = wallClockParts(date)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * The instant an Irish wall-clock time denotes; null when malformed. A time
 * skipped by the spring change (01:xx on the last Sunday of March) moves
 * one hour later; a time repeated in autumn takes the later (GMT) instant.
 */
export function fromDublinInput(value: string): Date | null {
  const match = LOCAL_INPUT.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59)
    return null
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  const first = naive - dublinOffsetMinutes(new Date(naive)) * 60_000
  return new Date(naive - dublinOffsetMinutes(new Date(first)) * 60_000)
}
```

In `components/admin/editor/versioned-editor.tsx` (Phase 4 Task 7 file; additive — pages, services and settings keep passing plain nodes):

1. replace the last three props of `VersionedEditorProps`

```ts
  /** Extra header actions (e.g. delete a service). */
  actions?: ReactNode
  /** Side panel (e.g. a service's slug). */
  aside?: ReactNode
}
```

with

```ts
  /** Extra header actions (e.g. delete a service, an article's workflow). */
  actions?: ReactNode | ((ctx: EditorActionContext<Dto>) => ReactNode)
  /** Side panel (e.g. a service's slug, an article's settings). */
  aside?: ReactNode | ((ctx: EditorActionContext<Dto>) => ReactNode)
  /** Status badge (default: Not published / Unpublished changes / Published). */
  status?: (
    record: Dto,
    dirty: boolean
  ) => { text: string; variant: "default" | "secondary" | "outline" }
}

/** What render-prop actions and side panels get from the editor. */
export type EditorActionContext<Dto> = {
  /** The record as last returned by the API. */
  record: Dto
  /** The form's current (possibly unsaved) draft. */
  draft: unknown
  /** Saves pending edits now; false when the draft is invalid or the save failed. */
  flush: () => Promise<boolean>
  /** The version to send with the next request (updated after every save). */
  version: () => number
  /** Takes a record returned by another request (new status/version). */
  accept: (dto: Dto) => void
  /** Marks every invalid field; true when there were errors. */
  showAllErrors: () => boolean
}
```

2. in `LoadedEditor`, directly after `const current = (conflict?.current ?? null) as Dto | null`, add:

```ts
  const actionContext: EditorActionContext<Dto> = {
    record,
    draft,
    flush: autosave.flush,
    version: () => baseRef.current.version,
    accept: (dto) => accept(dto),
    showAllErrors,
  }
  const slot = (value: VersionedEditorProps<Dto>["actions"]) =>
    typeof value === "function" ? value(actionContext) : value
```

3. replace

```tsx
        status={statusLabel({
          published: record.published,
          dirty: autosave.dirty || record.dirty,
        })}
```

with

```tsx
        status={
          props.status
            ? props.status(record, autosave.dirty || record.dirty)
            : statusLabel({
                published: record.published,
                dirty: autosave.dirty || record.dirty,
              })
        }
```

4. replace `{props.actions}` with `{slot(props.actions)}` and `aside={props.aside}` with `aside={slot(props.aside)}`.

In `lib/schemas/api/preview.ts` change `PREVIEW_ENTITIES` to `["page", "service", "article", "settings"] as const`.

In `server/modules/preview/service.ts`:
1. add `import { z } from "zod"` (first import group) and `import { findArticleForEdit } from "@/server/modules/articles/repo"` (before the services repo import);
2. add `article: { article: ["read"] },` to `READ` after `service:`;
3. add this case to the `switch` after the `"service"` case:

```ts
    case "article": {
      const article = z.uuid().safeParse(id).success
        ? await findArticleForEdit(getDb(), id)
        : null
      if (!article) throw notFound("Article")
      // In draft mode the public queries read drafts: unpublished articles show too.
      return `/blog/${article.slug}`
    }
```

- [ ] **Step 4: Article editor components and route**

`components/admin/articles/schedule-dialog.tsx`:

```tsx
"use client"

import { useState } from "react"

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
import { Spinner } from "@/components/ui/spinner"
import { formatDateTime, fromDublinInput, toDublinInput } from "@/lib/format"

const HOUR = 60 * 60_000

/** Pick when an article goes live, in Irish time (Europe/Dublin). */
export function ScheduleDialog({
  open,
  onOpenChange,
  initial,
  pending,
  onConfirm,
  now = () => new Date(),
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The current schedule (ISO), if any. */
  initial: string | null
  pending: boolean
  onConfirm: (scheduledAt: string) => void
  /** Clock (tests). */
  now?: () => Date
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule publishing</DialogTitle>
          <DialogDescription>
            The article goes live on its own within a minute of this time.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ScheduleForm
            initial={initial}
            pending={pending}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
            now={now}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Mounted per opening, so it starts from the current schedule. */
function ScheduleForm({
  initial,
  pending,
  onConfirm,
  onCancel,
  now,
}: {
  initial: string | null
  pending: boolean
  onConfirm: (scheduledAt: string) => void
  onCancel: () => void
  now: () => Date
}) {
  const [value, setValue] = useState(() =>
    toDublinInput(
      initial ? new Date(initial) : new Date(now().getTime() + HOUR)
    )
  )
  const [error, setError] = useState<string | null>(null)
  const at = fromDublinInput(value)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!at) {
          setError("Enter a date and a time.")
          return
        }
        if (at.getTime() <= now().getTime()) {
          setError("Choose a time in the future.")
          return
        }
        onConfirm(at.toISOString())
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="schedule-at" className="text-sm font-medium">
          Publish on
        </label>
        <Input
          id="schedule-at"
          type="datetime-local"
          step={60}
          min={toDublinInput(now())}
          value={value}
          aria-invalid={!!error}
          aria-describedby="schedule-at-help"
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
        />
        {error ? (
          <p
            id="schedule-at-help"
            role="alert"
            className="text-xs text-destructive"
          >
            {error}
          </p>
        ) : (
          <p id="schedule-at-help" className="text-xs text-muted-foreground">
            {at
              ? `Goes live ${formatDateTime(at)} (Irish time).`
              : "Irish time (Europe/Dublin)."}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Schedule
        </Button>
      </DialogFooter>
    </form>
  )
}
```

`components/admin/articles/workflow-actions.tsx`:

```tsx
"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, CalendarX, EyeOff, Inbox } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { EditorActionContext } from "@/components/admin/editor/versioned-editor"
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
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import type { ArticleDto } from "@/lib/schemas/api/articles"

import { ScheduleDialog } from "./schedule-dialog"

type Step =
  | { kind: "submit" }
  | { kind: "schedule"; at: string }
  | { kind: "unschedule" }
  | { kind: "unpublish" }

const DONE: Record<Step["kind"], { title: string; description: string }> = {
  submit: {
    title: "Submitted for review",
    description: "An editor will publish it or get back to you.",
  },
  schedule: {
    title: "Scheduled",
    description: "It goes live on its own at the chosen time.",
  },
  unschedule: {
    title: "Schedule cancelled",
    description: "Nothing changes on the site until someone publishes.",
  },
  unpublish: {
    title: "Unpublished",
    description: "The article is no longer on the site.",
  },
}

/** Review/publish workflow buttons in the editor header (spec §5.1, §6.1). */
export function WorkflowActions({
  ctx,
}: {
  ctx: EditorActionContext<ArticleDto>
}) {
  const { record } = ctx
  const { permissions } = record
  const queryClient = useQueryClient()
  const [scheduling, setScheduling] = useState(false)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)

  const run = useMutation({
    mutationFn: async (step: Step): Promise<ArticleDto> => {
      const needsValidDraft = step.kind === "submit" || step.kind === "schedule"
      if (needsValidDraft && ctx.showAllErrors())
        throw new Error("Fix the marked fields first.")
      // Save pending edits so the request carries the latest version.
      const saved = await ctx.flush()
      if (needsValidDraft && !saved) throw new Error("Save your changes first.")
      const param = { id: record.id }
      const version = ctx.version()
      switch (step.kind) {
        case "submit":
          return (await unwrap(
            api.articles[":id"].submit.$post({ param, json: { version } })
          )) as ArticleDto
        case "schedule":
          return (await unwrap(
            api.articles[":id"].schedule.$post({
              param,
              json: { version, scheduledAt: step.at },
            })
          )) as ArticleDto
        case "unschedule":
          return (await unwrap(
            api.articles[":id"].unschedule.$post({ param, json: { version } })
          )) as ArticleDto
        case "unpublish":
          return (await unwrap(
            api.articles[":id"].unpublish.$post({ param, json: { version } })
          )) as ArticleDto
      }
    },
    onSuccess: (dto, step) => {
      ctx.accept(dto)
      setScheduling(false)
      setConfirmUnpublish(false)
      void queryClient.invalidateQueries({
        queryKey: ["revisions", "article", record.id],
      })
      // Lists refresh when shown again; the open editor keeps its state.
      void queryClient.invalidateQueries({
        queryKey: ["articles"],
        refetchType: "inactive",
      })
      toast.success(DONE[step.kind].title, {
        description: DONE[step.kind].description,
      })
    },
    onError: (err) => {
      toast.error("Not done", {
        description:
          err instanceof ApiError ? errorMessage(err) : (err as Error).message,
      })
    },
  })

  return (
    <>
      {permissions.submit && !permissions.publish ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={run.isPending}
          onClick={() => run.mutate({ kind: "submit" })}
        >
          <Inbox aria-hidden />
          Submit for review
        </Button>
      ) : null}
      {permissions.publish && record.status === "scheduled" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={run.isPending}
          onClick={() => run.mutate({ kind: "unschedule" })}
        >
          <CalendarX aria-hidden />
          Cancel schedule
        </Button>
      ) : null}
      {permissions.publish ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={run.isPending}
          onClick={() => setScheduling(true)}
        >
          <CalendarClock aria-hidden />
          {record.status === "scheduled" ? "Reschedule" : "Schedule"}
        </Button>
      ) : null}
      {permissions.publish && record.live ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={run.isPending}
          onClick={() => setConfirmUnpublish(true)}
        >
          <EyeOff aria-hidden />
          Unpublish
        </Button>
      ) : null}
      <ScheduleDialog
        open={scheduling}
        onOpenChange={setScheduling}
        initial={record.scheduledAt}
        pending={run.isPending}
        onConfirm={(at) => run.mutate({ kind: "schedule", at })}
      />
      <AlertDialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish {record.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from /blog and its page shows “not found”. The text
              stays here as a draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it live</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={run.isPending}
              onClick={() => run.mutate({ kind: "unpublish" })}
            >
              Unpublish
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

`components/admin/articles/article-settings.tsx`:

```tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import type { EditorActionContext } from "@/components/admin/editor/versioned-editor"
import { NativeSelect } from "@/components/admin/schema-form/widgets/basic"
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
import { Input } from "@/components/ui/input"
import { api, ApiError, errorMessage, unwrap } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import type { ArticleDto, ArticleOptions } from "@/lib/schemas/api/articles"
import { SLUG_PATTERN } from "@/lib/schemas/common"

type Ctx = EditorActionContext<ArticleDto>

/** Side panel of the article editor: placement, details, delete. */
export function ArticleSettings({ ctx }: { ctx: Ctx }) {
  const article = ctx.record
  const options = useQuery({
    queryKey: ["articles", "options"],
    queryFn: () => unwrap(api.articles.options.$get()),
  })
  return (
    <>
      <PlacementCard
        // Remount after a saved change so the inputs start from the new values.
        key={`${article.slug}|${article.category.id}|${article.author?.id ?? ""}`}
        ctx={ctx}
        options={options.data}
      />
      <DetailsCard article={article} />
      {article.permissions.delete ? <DeleteCard ctx={ctx} /> : null}
    </>
  )
}

function PlacementCard({
  ctx,
  options,
}: {
  ctx: Ctx
  options: ArticleOptions | undefined
}) {
  const article = ctx.record
  const editable = article.permissions.update
  const canChangeAuthor = editable && article.permissions.changeAuthor
  const [slug, setSlug] = useState(article.slug)
  const [categoryId, setCategoryId] = useState(article.category.id)
  const [authorId, setAuthorId] = useState(article.author?.id ?? "")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const categories = options?.categories ?? [article.category]
  const authors = options?.authors ?? []
  const bylines =
    article.author && !authors.some((a) => a.id === article.author?.id)
      ? [article.author, ...authors]
      : authors
  const changes = {
    ...(slug !== article.slug ? { slug } : {}),
    ...(categoryId !== article.category.id ? { categoryId } : {}),
    ...(canChangeAuthor && authorId !== (article.author?.id ?? "")
      ? { authorId: authorId || null }
      : {}),
  }
  const slugValid = SLUG_PATTERN.test(slug)
  const save = useMutation({
    mutationFn: async () => {
      await ctx.flush()
      return (await unwrap(
        api.articles[":id"].meta.$patch({
          param: { id: article.id },
          json: { version: ctx.version(), ...changes },
        })
      )) as ArticleDto
    },
    onSuccess: (dto) => {
      ctx.accept(dto)
      toast.success("Settings saved", {
        description: dto.live ? "The site uses them now." : undefined,
      })
    },
    onError: (err) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors)
      toast.error("Not saved", { description: errorMessage(err) })
    },
  })
  return (
    <section
      aria-labelledby="article-placement"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <h2 id="article-placement" className="text-sm font-bold">
        Address and category
      </h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="article-slug" className="text-xs font-medium">
          Address
        </label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">/blog/</span>
          <Input
            id="article-slug"
            value={slug}
            disabled={!editable}
            aria-invalid={!slugValid || !!errors.slug}
            aria-describedby="article-slug-help"
            onChange={(event) => {
              setSlug(event.target.value)
              setErrors({})
            }}
          />
        </div>
        <p
          id="article-slug-help"
          className={
            errors.slug || !slugValid
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {errors.slug?.[0] ??
            (!slugValid
              ? "Lowercase letters, numbers and single hyphens."
              : article.live
                ? "Changing it moves the live page immediately."
                : "Where the article will be published.")}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="article-category" className="text-xs font-medium">
          Category
        </label>
        <NativeSelect
          id="article-category"
          value={categoryId}
          disabled={!editable}
          invalid={!!errors.categoryId}
          onChange={(value) => {
            setCategoryId(value)
            setErrors({})
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {canChangeAuthor ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="article-author" className="text-xs font-medium">
            Byline
          </label>
          <NativeSelect
            id="article-author"
            value={authorId}
            invalid={!!errors.authorId}
            onChange={(value) => {
              setAuthorId(value)
              setErrors({})
            }}
          >
            <option value="">No byline</option>
            {bylines.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Byline: {article.author?.name ?? "none"}
        </p>
      )}
      {editable ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            Object.keys(changes).length === 0 || !slugValid || save.isPending
          }
          onClick={() => save.mutate()}
        >
          Save settings
        </Button>
      ) : null}
    </section>
  )
}

function DetailsCard({ article }: { article: ArticleDto }) {
  const rows: [string, string][] = [
    [
      "On the site",
      article.live && article.publishedAt
        ? `Since ${formatDateTime(article.publishedAt)}`
        : "Not published",
    ],
    ...(article.scheduledAt
      ? ([["Scheduled for", formatDateTime(article.scheduledAt)]] as [
          string,
          string,
        ][])
      : []),
    ...(article.live && article.readTimeMinutes !== null
      ? ([["Read time", `${article.readTimeMinutes} min`]] as [string, string][])
      : []),
    ["Created", formatDateTime(article.createdAt)],
    [
      "Last change",
      `${formatDateTime(article.updatedAt)}${article.updatedBy ? ` · ${article.updatedBy.name}` : ""}`,
    ],
  ]
  return (
    <section
      aria-labelledby="article-details"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <h2 id="article-details" className="text-sm font-bold">
        Details
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function DeleteCard({ ctx }: { ctx: Ctx }) {
  const article = ctx.record
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        api.articles[":id"].$delete({
          param: { id: article.id },
          query: { version: String(ctx.version()) },
        })
      ),
    onSuccess: async () => {
      toast.success(`${article.title} deleted`)
      await queryClient.invalidateQueries({ queryKey: ["articles"] })
      router.push("/admin/articles")
    },
    onError: (err) => {
      setOpen(false)
      toast.error("Not deleted", { description: errorMessage(err) })
    },
  })
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-card p-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-start text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete article
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {article.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              {article.live
                ? `It disappears from /blog and /blog/${article.slug} shows “not found”. `
                : ""}
              Its history is kept in the audit log only.
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
              Delete article
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
```

`components/admin/articles/article-editor.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"

import { VersionedEditor } from "@/components/admin/editor/versioned-editor"
import { articleStatusLabel } from "@/lib/admin/article-status"
import { api, unwrap } from "@/lib/api-client"
import type { ArticleDto } from "@/lib/schemas/api/articles"
import { previewHref } from "@/lib/schemas/api/preview"
import { articleContent } from "@/lib/schemas/content/article"

import { articleEditorMeta } from "./article-meta"
import { ArticleSettings } from "./article-settings"
import { WorkflowActions } from "./workflow-actions"

const asDto = (request: Promise<unknown>) => request as Promise<ArticleDto>

/**
 * Article editor (master 5.3): Phase 4's VersionedEditor with the article's
 * own rights (from the API), workflow actions and settings panel.
 */
export function ArticleEditor({ id }: { id: string }) {
  const queryKey = ["articles", id] as const
  const param = { id }
  const load = () => asDto(unwrap(api.articles[":id"].$get({ param })))
  // Same query as the editor's: re-renders with every record it accepts.
  const record = useQuery({ queryKey, queryFn: load })
  const permissions = record.data?.permissions
  return (
    <VersionedEditor<ArticleDto>
      title={record.data?.title ?? "Article"}
      backHref="/admin/articles"
      backLabel="All articles"
      queryKey={queryKey}
      load={load}
      saveDraft={(draft, version) =>
        asDto(
          unwrap(
            api.articles[":id"].draft.$put({ param, json: { draft, version } })
          )
        )
      }
      publish={(version) =>
        asDto(
          unwrap(api.articles[":id"].publish.$post({ param, json: { version } }))
        )
      }
      restore={(revisionId, version) =>
        asDto(
          unwrap(
            api.articles[":id"].restore.$post({
              param,
              json: { revisionId, version },
            })
          )
        )
      }
      schema={articleContent}
      meta={articleEditorMeta}
      revisions={{ entity: "article", id }}
      previewHref={previewHref("article", id)}
      publicHref={record.data?.live ? `/blog/${record.data.slug}` : undefined}
      canEdit={permissions?.update ?? false}
      canPublish={permissions?.publish ?? false}
      status={(dto, dirty) => articleStatusLabel({ ...dto, dirty })}
      actions={(ctx) => <WorkflowActions ctx={ctx} />}
      aside={(ctx) => <ArticleSettings ctx={ctx} />}
    />
  )
}
```

`app/(admin)/admin/(panel)/articles/[id]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"

import { ArticleEditor } from "@/components/admin/articles/article-editor"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Edit article" }

export default function EditArticlePage({
  params,
}: PageProps<"/admin/articles/[id]">) {
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({
  params,
}: Pick<PageProps<"/admin/articles/[id]">, "params">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  await requirePermission({ article: ["read"] })
  return <ArticleEditor id={id} />
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/format-dublin.test.ts tests/unit/format.test.ts`
Expected: PASS (4 new; Phase 3 date tests unchanged).

Run: `pnpm exec next typegen && pnpm exec vitest run --project dom tests/dom/schedule-dialog.test.tsx tests/dom/article-editor.test.tsx tests/dom/versioned-editor.test.tsx tests/dom/collections.test.tsx tests/dom/settings-editor.test.tsx`
Expected: PASS (4 + 3 new; the Phase 4 page/service/settings editor tests unchanged — plain `actions`/`aside` nodes still work).

Run: `pnpm test:integration tests/integration/api/article-preview.test.ts tests/integration/api/preview.test.ts`
Expected: PASS.

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0; `/admin/articles/[id]` is `◐`.

Run (port 3100 free, no other Playwright/build): `pnpm test:e2e`
Expected: all specs pass, including `tests/e2e/articles.spec.ts`: the author's draft autosaves, "Submit for review" → "In review", `POST …/publish` with the author's cookie → 403 `FORBIDDEN` (while the same request path accepts their draft save), the editor publishes from "Review queue", and an anonymous visitor sees "Night Patrol Checklist" as a card on `/blog` and as the `<h1>` of `/blog/night-patrol-checklist`.

Run: `pnpm test:visual`
Expected: `43 passed, 1 skipped` (the visual server reseeds sp_e2e; public pages unchanged).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write lib/format.ts components/admin/editor/versioned-editor.tsx components/admin/articles "app/(admin)/admin/(panel)/articles" lib/schemas/api/preview.ts server/modules/preview/service.ts tests/unit/format-dublin.test.ts tests/dom/schedule-dialog.test.tsx tests/dom/article-editor.test.tsx tests/integration/api/article-preview.test.ts tests/e2e/articles.spec.ts tests/e2e/fixtures.ts tests/e2e/seed.ts
git add lib/format.ts components/admin/editor/versioned-editor.tsx components/admin/articles "app/(admin)/admin/(panel)/articles" lib/schemas/api/preview.ts server/modules/preview/service.ts tests/unit/format-dublin.test.ts tests/dom/schedule-dialog.test.tsx tests/dom/article-editor.test.tsx tests/integration/api/article-preview.test.ts tests/e2e/articles.spec.ts tests/e2e/fixtures.ts tests/e2e/seed.ts
git commit -m "feat: add article editor with review, schedule and settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Scheduler — scheduled publish, revision pruning, internal revalidation (master Task 5.4)

**Files:**
- Create: `instrumentation.ts`, `server/lib/scheduler.ts`, `server/lib/internal-signature.ts`, `server/lib/jobs/{index.ts,publish-scheduled.ts,prune-revisions.ts}`, `server/modules/jobs/repo.ts`, `server/modules/internal/routes.ts`, `lib/schemas/api/internal.ts`
- Modify: `server/modules/articles/repo.ts` (`lockDueScheduledArticles`), `server/modules/articles/service.ts` (`publishDueArticles`), `server/modules/revisions/repo.ts` (`pruneRevisionRows`), `server/api/app.ts` (mount `/v1/internal`)
- Test: `tests/unit/internal-signature.test.ts`, `tests/unit/scheduler-start.test.ts`, `tests/unit/instrumentation.test.ts`, `tests/integration/scheduler/scheduler.test.ts`, `tests/integration/api/internal-revalidate.test.ts`, `tests/e2e/scheduled-publish.spec.ts`

**Interfaces:**
- Consumes: Phase 3 tables `jobs` (`key` unique, `attempts`, `locked_at`, `last_error`, `last_run_at`), `articles`, `revisions`; Phase 1 `deriveKey("cron")`, `getEnv`; Task 1 article service internals (`loadRow`, `applyTransition`, `PUBLISH`); `invalidate`/`tag`; Drizzle `.for("update", { skipLocked: true })` (notes §3); Next `register()` (skipped during `next build`, notes §6).
- Produces:

```ts
// server/lib/internal-signature.ts
export const TIMESTAMP_HEADER = "x-sp-timestamp"; export const SIGNATURE_HEADER = "x-sp-signature"; export const MAX_SKEW_SECONDS = 300
export function signInternalRequest(body: string, now?: number, secret?: string): { timestamp: string; signature: string }   // HMAC-SHA256(HKDF "cron"), "<timestamp>.<body>", base64url
export function verifyInternalRequest(req: { body; timestamp; signature }, now?: number, secret?: string): boolean
// server/lib/jobs/index.ts
export type JobContext = { now: Date; payload: unknown }
export type JobResult = { tags?: string[]; warning?: string }
export type JobDefinition = { name: string; key: string; everyMs: number; run(ctx: JobContext): Promise<JobResult> }
export const RECURRING_JOBS: readonly JobDefinition[]     // publish-scheduled (30 s → every tick), prune-revisions (24 h)
// server/lib/jobs/prune-revisions.ts
export const REVISIONS_KEPT = 50
// server/lib/scheduler.ts
export const TICK_INTERVAL_MS = 60_000, FIRST_TICK_DELAY_MS = 5_000, LOCK_TIMEOUT_MS = 600_000, RETRY_DELAY_MS = 60_000
export type TickResult = { name: string; key: string | null; ok: boolean; error: string | null; tags: string[] }
export async function ensureRecurringJobs(now?: Date, definitions?): Promise<void>
export async function tick(options?: { now?: Date; jobs?: readonly JobDefinition[]; revalidate?: (tags: string[]) => Promise<void> }): Promise<TickResult[]>
export async function revalidateViaApi(tags: string[]): Promise<void>     // POST http://127.0.0.1:$PORT/api/v1/internal/revalidate (signed)
export function startScheduler(): boolean; export function stopScheduler(): void
// server/modules/articles/service.ts
export async function publishDueArticles(now?: Date): Promise<{ published: string[]; failed: string[]; tags: string[] }>
// server/modules/revisions/repo.ts
export async function pruneRevisionRows(db, keep: number): Promise<number>
// HTTP
POST /api/v1/internal/revalidate  { tags: string[] }  signed → 200 { ok: true, count } | 401 | 422
// instrumentation.ts
export async function register(): Promise<void>    // Node runtime only → startScheduler()
```

Rules: a tick (every 60 s, first one 5 s after start; never overlapping) upserts the recurring job rows, claims due jobs in one `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` (a claim older than 10 min belongs to a crashed worker and is taken over), runs them, expires their cache tags through the signed internal route (the timer has no request context), and releases each row: success → next run `now + everyMs`, `last_error` = warning or null, `attempts` = 0; failure → `last_error`, retry in 60 s. Scheduled publish locks due articles `FOR UPDATE SKIP LOCKED` and publishes each in its own savepoint (audit actor null, revision actor null); a failing article stays scheduled and is named in `last_error`. Pruning keeps the newest 50 revisions per entity.

- [ ] **Step 1: Write the failing tests**

`tests/unit/internal-signature.test.ts`:

```ts
import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

import { deriveKey } from "@/server/lib/crypto"
import {
  MAX_SKEW_SECONDS,
  signInternalRequest,
  verifyInternalRequest,
} from "@/server/lib/internal-signature"

const SECRET = "s".repeat(40)
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0)
const BODY = '{"tags":["articles"]}'

describe("internal request signature (ledger: HKDF purpose cron)", () => {
  it("verifies its own signature within the time window", () => {
    const signed = signInternalRequest(BODY, NOW, SECRET)
    expect(signed.timestamp).toBe(String(NOW / 1000))
    expect(signed.signature).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(verifyInternalRequest({ body: BODY, ...signed }, NOW + 1_000, SECRET)).toBe(true)
  })

  it("rejects tampering, another secret, stale or future timestamps and junk", () => {
    const signed = signInternalRequest(BODY, NOW, SECRET)
    const verify = (
      req: Partial<{ body: string; timestamp: string | null; signature: string | null }>,
      now = NOW,
      secret = SECRET
    ) =>
      verifyInternalRequest({ body: BODY, ...signed, ...req }, now, secret)
    expect(verify({ body: '{"tags":["page:home"]}' })).toBe(false)
    expect(verify({}, NOW, "t".repeat(40))).toBe(false)
    expect(verify({}, NOW + (MAX_SKEW_SECONDS + 1) * 1000)).toBe(false)
    expect(verify({}, NOW - (MAX_SKEW_SECONDS + 1) * 1000)).toBe(false)
    expect(verify({ timestamp: null })).toBe(false)
    expect(verify({ signature: null })).toBe(false)
    expect(verify({ timestamp: "12abc" })).toBe(false)
    expect(verify({ signature: "short" })).toBe(false)
  })

  it("uses the cron key: an HMAC with the preview key does not verify", () => {
    const timestamp = String(NOW / 1000)
    const signature = createHmac("sha256", deriveKey("preview", SECRET))
      .update(`${timestamp}.${BODY}`)
      .digest("base64url")
    expect(
      verifyInternalRequest({ body: BODY, timestamp, signature }, NOW, SECRET)
    ).toBe(false)
  })
})
```

`tests/unit/scheduler-start.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  FIRST_TICK_DELAY_MS,
  startScheduler,
  stopScheduler,
  TICK_INTERVAL_MS,
} from "@/server/lib/scheduler"

const ENV = {
  DATABASE_URL: "postgres://sp:sp@127.0.0.1:5432/sp_test",
  BETTER_AUTH_SECRET: "s".repeat(40),
  BETTER_AUTH_URL: "http://localhost:3000",
}
const stubEnv = () => {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value)
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  stopScheduler()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("startScheduler (master 5.4)", () => {
  it("does not start during next build", () => {
    stubEnv()
    vi.stubEnv("NEXT_PHASE", "phase-production-build")
    expect(startScheduler()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("does not start without the app env (logged, not thrown)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(startScheduler()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(error).toHaveBeenCalled()
  })

  it("starts once per process: a first tick and a 60 s interval", () => {
    stubEnv()
    expect(startScheduler()).toBe(true)
    expect(vi.getTimerCount()).toBe(2)
    expect(startScheduler()).toBe(false)
    expect(vi.getTimerCount()).toBe(2)
    expect(TICK_INTERVAL_MS).toBe(60_000)
    expect(FIRST_TICK_DELAY_MS).toBeLessThan(TICK_INTERVAL_MS)
    stopScheduler()
    expect(vi.getTimerCount()).toBe(0)
  })
})
```

`tests/unit/instrumentation.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

const { startScheduler } = vi.hoisted(() => ({
  startScheduler: vi.fn(() => true),
}))
vi.mock("@/server/lib/scheduler", () => ({ startScheduler }))

import { register } from "@/instrumentation"

afterEach(() => {
  vi.unstubAllEnvs()
  startScheduler.mockClear()
})

describe("instrumentation register()", () => {
  it("starts the scheduler on the Node.js runtime only", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge")
    await register()
    expect(startScheduler).not.toHaveBeenCalled()
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    await register()
    expect(startScheduler).toHaveBeenCalledTimes(1)
  })
})
```

`tests/integration/scheduler/scheduler.test.ts`:

```ts
import { and, eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { ArticleDto } from "@/lib/schemas/api/articles"
import { getDb } from "@/server/db/client"
import {
  articleCategories,
  articles,
  auditLog,
  jobs,
  media,
  revisions,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { RECURRING_JOBS } from "@/server/lib/jobs"
import { publishScheduledJob } from "@/server/lib/jobs/publish-scheduled"
import {
  pruneRevisionsJob,
  REVISIONS_KEPT,
} from "@/server/lib/jobs/prune-revisions"
import {
  ensureRecurringJobs,
  LOCK_TIMEOUT_MS,
  RETRY_DELAY_MS,
  tick,
} from "@/server/lib/scheduler"
import { publishDueArticles } from "@/server/modules/articles/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let editor: string
let categoryId: string
let coverId: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  editor = (await signedInUser(["editor"])).cookie
  const db = getDb()
  const [category] = await db
    .select()
    .from(articleCategories)
    .where(eq(articleCategories.slug, "company-news"))
  categoryId = category.id
  const [hero] = await db
    .select()
    .from(media)
    .where(eq(media.key, "/images/hero.jpg"))
  coverId = hero.id
  revalidateTag.mockClear()
})

/** Creates an article through the API and schedules it `inMs` from now. */
async function scheduled(slug: string, inMs = 60_000) {
  const created = await adminRequest("/articles", {
    cookie: editor,
    method: "POST",
    json: {
      slug,
      categoryId,
      draft: {
        title: `Timed ${slug}`,
        excerpt: "Goes live by itself.",
        cover: { mediaId: coverId },
        lead: null,
        tags: [],
        body: null,
      },
    },
  })
  expect(created.status).toBe(201)
  const article = (await created.json()) as ArticleDto
  const res = await adminRequest(`/articles/${article.id}/schedule`, {
    cookie: editor,
    method: "POST",
    json: {
      version: 1,
      scheduledAt: new Date(Date.now() + inMs).toISOString(),
    },
  })
  expect(res.status).toBe(200)
  return article.id
}

/** A moment after every schedule above (the scheduler's clock is injected). */
const later = () => new Date(Date.now() + 5 * 60_000)

async function job(key: string) {
  const [row] = await getDb().select().from(jobs).where(eq(jobs.key, key))
  return row
}

async function article(id: string) {
  const [row] = await getDb().select().from(articles).where(eq(articles.id, id))
  return row
}

const publishedAudits = (id: string) =>
  getDb()
    .select({ actorId: auditLog.actorId })
    .from(auditLog)
    .where(
      and(eq(auditLog.entityId, id), eq(auditLog.action, "article.published"))
    )

describe("scheduler (master 5.4)", () => {
  it("two concurrent ticks publish a due article exactly once (FOR UPDATE SKIP LOCKED)", async () => {
    const id = await scheduled("timed-update")
    await ensureRecurringJobs(new Date())
    const revalidate = vi.fn(async () => undefined)
    const now = later()
    const [a, b] = await Promise.all([
      tick({ now, revalidate }),
      tick({ now, revalidate }),
    ])
    const runs = [...a, ...b].filter((r) => r.name === "publish-scheduled")
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      ok: true,
      error: null,
      tags: ["articles", "article:timed-update"],
    })
    expect(revalidate).toHaveBeenCalledTimes(1)
    expect(revalidate).toHaveBeenCalledWith(["articles", "article:timed-update"])

    const row = await article(id)
    expect(row).toMatchObject({ status: "published", scheduledAt: null })
    expect(row.published).toEqual(row.draft)
    expect(row.publishedAt?.getTime()).toBe(now.getTime())
    const audits = await publishedAudits(id)
    expect(audits).toEqual([{ actorId: null }])
    // The timer never calls revalidateTag itself (ledger ruling).
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("publishDueArticles run twice at once publishes each article once (row locks)", async () => {
    const ids = [await scheduled("first-timed"), await scheduled("second-timed")]
    const now = later()
    const results = await Promise.all([
      publishDueArticles(now),
      publishDueArticles(now),
    ])
    expect(results.flatMap((r) => r.published).sort()).toEqual([
      "first-timed",
      "second-timed",
    ])
    for (const id of ids) expect(await publishedAudits(id)).toHaveLength(1)
  })

  it("an article that cannot be published is reported; the others go live", async () => {
    const bad = await scheduled("broken-timed")
    await scheduled("good-timed")
    const row = await article(bad)
    await getDb()
      .update(articles)
      .set({ draft: { ...row.draft, title: "" } })
      .where(eq(articles.id, bad))
    const result = await publishScheduledJob.run({ now: later(), payload: null })
    expect(result.tags).toEqual(["articles", "article:good-timed"])
    expect(result.warning).toContain("broken-timed")
    expect((await article(bad)).status).toBe("scheduled")
  })

  it("records failures in jobs.last_error, retries in a minute, clears them on success", async () => {
    await ensureRecurringJobs(new Date())
    const now = later()
    const failing = {
      ...publishScheduledJob,
      run: async () => {
        throw new Error("boom")
      },
    }
    await tick({ now, jobs: [failing, pruneRevisionsJob], revalidate: vi.fn() })
    const failed = await job("publish-scheduled")
    expect(failed).toMatchObject({
      lastError: "boom",
      lockedAt: null,
      attempts: 1,
    })
    expect(failed.runAt.getTime()).toBe(now.getTime() + RETRY_DELAY_MS)

    const retry = new Date(now.getTime() + RETRY_DELAY_MS)
    await tick({ now: retry, revalidate: vi.fn() })
    const ok = await job("publish-scheduled")
    expect(ok).toMatchObject({ lastError: null, attempts: 0, lockedAt: null })
    expect(ok.lastRunAt?.getTime()).toBe(retry.getTime())
  })

  it("keeps one row per recurring job key and its schedule (ON CONFLICT (key))", async () => {
    await ensureRecurringJobs(new Date())
    const now = later()
    await tick({ now, revalidate: vi.fn() })
    const before = await job("prune-revisions")
    expect(before.runAt.getTime()).toBe(now.getTime() + pruneRevisionsJob.everyMs)
    await ensureRecurringJobs(new Date())
    const rows = await getDb().select().from(jobs)
    expect(rows.map((r) => r.key).sort()).toEqual(
      RECURRING_JOBS.map((j) => j.key).sort()
    )
    expect((await job("prune-revisions")).runAt).toEqual(before.runAt)
  })

  it("takes over a crashed worker's claim after the lock timeout, not before", async () => {
    await ensureRecurringJobs(new Date())
    const now = later()
    const lockAgo = (ms: number) =>
      getDb()
        .update(jobs)
        .set({ lockedAt: new Date(now.getTime() - ms) })
        .where(eq(jobs.key, "publish-scheduled"))
    await lockAgo(60_000)
    expect(
      (await tick({ now, revalidate: vi.fn() })).map((r) => r.name)
    ).not.toContain("publish-scheduled")
    await lockAgo(LOCK_TIMEOUT_MS + 1_000)
    expect(
      (await tick({ now, revalidate: vi.fn() })).map((r) => r.name)
    ).toContain("publish-scheduled")
  })

  it("revision pruning keeps the newest 50 per entity", async () => {
    const db = getDb()
    await db.insert(revisions).values([
      ...Array.from({ length: 55 }, (_, i) => ({
        entityType: "page",
        entityId: "prune-a",
        version: i + 1,
        data: {},
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        entityType: "page",
        entityId: "prune-b",
        version: i + 1,
        data: {},
      })),
    ])
    await pruneRevisionsJob.run({ now: new Date(), payload: null })
    const versions = async (entityId: string) =>
      (
        await db
          .select({ version: revisions.version })
          .from(revisions)
          .where(
            and(eq(revisions.entityType, "page"), eq(revisions.entityId, entityId))
          )
      )
        .map((r) => r.version)
        .sort((x, y) => x - y)
    expect(REVISIONS_KEPT).toBe(50)
    expect(await versions("prune-a")).toEqual(
      Array.from({ length: 50 }, (_, i) => i + 6)
    )
    expect(await versions("prune-b")).toEqual([1, 2, 3])
  })
})
```

`tests/integration/api/internal-revalidate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { app } from "@/server/api/app"
import {
  SIGNATURE_HEADER,
  signInternalRequest,
  TIMESTAMP_HEADER,
} from "@/server/lib/internal-signature"
import { revalidateViaApi } from "@/server/lib/scheduler"

const send = (body: string, headers: Record<string, string>) =>
  app.request("/api/v1/internal/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  })

const signed = (body: string, now = Date.now()) => {
  const { timestamp, signature } = signInternalRequest(body, now)
  return { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature }
}

beforeEach(() => {
  revalidateTag.mockClear()
  vi.unstubAllGlobals()
})

describe("POST /api/v1/internal/revalidate (ledger: scheduler → signed route)", () => {
  it("expires the signed tags", async () => {
    const body = JSON.stringify({ tags: ["articles", "article:x"] })
    const res = await send(body, signed(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, count: 2 })
    expect(revalidateTag.mock.calls).toEqual([
      ["articles", { expire: 0 }],
      ["article:x", { expire: 0 }],
    ])
  })

  it("refuses unsigned, forged, replayed and tampered requests (401)", async () => {
    const body = JSON.stringify({ tags: ["articles"] })
    expect((await send(body, {})).status).toBe(401)
    expect(
      (await send(body, { ...signed(body), [SIGNATURE_HEADER]: "x".repeat(43) }))
        .status
    ).toBe(401)
    expect(
      (await send(body, signed(body, Date.now() - 10 * 60_000))).status
    ).toBe(401)
    expect(
      (await send(JSON.stringify({ tags: ["page:home"] }), signed(body))).status
    ).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("validates the signed body (422)", async () => {
    const empty = JSON.stringify({ tags: [] })
    expect((await send(empty, signed(empty))).status).toBe(422)
    expect((await send("nope", signed("nope"))).status).toBe(422)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("is what the scheduler calls (revalidateViaApi → fetch → route)", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(new URL(String(input)).pathname, init)
    )
    await revalidateViaApi(["articles"])
    expect(revalidateTag).toHaveBeenCalledWith("articles", { expire: 0 })
  })
})
```

`tests/e2e/scheduled-publish.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"

import type {
  ArticleDto,
  ArticleOptions,
} from "@/lib/schemas/api/articles"
import type { Paginated } from "@/lib/schemas/api/list"
import type { MediaItem } from "@/lib/schemas/api/media"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Master 5.4: a scheduled article goes live on the server's own scheduler
// tick (60 s) and the cache is expired through the signed internal route.

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

test("a scheduled article goes live on the next scheduler tick", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000)
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const headers = { origin: BASE_URL }
  const options = (await (
    await page.request.get("/api/v1/admin/articles/options")
  ).json()) as ArticleOptions
  const images = (await (
    await page.request.get("/api/v1/admin/media?kind=image&pageSize=1")
  ).json()) as Paginated<MediaItem>
  const title = "Timed Patrol Update"
  const slug = "timed-patrol-update"
  const created = await page.request.post("/api/v1/admin/articles", {
    headers,
    data: {
      slug,
      categoryId: options.categories[0].id,
      draft: {
        title,
        excerpt: "Goes live by itself.",
        cover: { mediaId: images.items[0].id },
        lead: null,
        tags: [],
        body: null,
      },
    },
  })
  expect(created.status()).toBe(201)
  const article = (await created.json()) as ArticleDto
  const schedule = await page.request.post(
    `/api/v1/admin/articles/${article.id}/schedule`,
    {
      headers,
      data: {
        version: article.version,
        scheduledAt: new Date(Date.now() + 3_000).toISOString(),
      },
    }
  )
  expect(schedule.status()).toBe(200)
  expect(((await schedule.json()) as ArticleDto).status).toBe("scheduled")

  const context = await browser.newContext()
  const visitor = await context.newPage()
  // Not on the site yet (this also caches the article list without it)…
  await visitor.goto(`/blog/${slug}`)
  await expect(
    visitor.getByRole("heading", { level: 1, name: title })
  ).toHaveCount(0)
  // …until the scheduler publishes it and expires the cache.
  await expect(async () => {
    await visitor.goto(`/blog/${slug}`)
    await expect(
      visitor.getByRole("heading", { level: 1, name: title })
    ).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 180_000, intervals: [5_000] })
  await visitor.goto("/blog")
  await expect(
    visitor.getByRole("heading", { level: 3, name: title })
  ).toBeVisible()
  await context.close()

  const after = (await (
    await page.request.get(`/api/v1/admin/articles/${article.id}`)
  ).json()) as ArticleDto
  expect(after).toMatchObject({ status: "published", live: true })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit tests/unit/internal-signature.test.ts tests/unit/scheduler-start.test.ts tests/unit/instrumentation.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/internal-signature"`, `"@/server/lib/scheduler"`, `"@/instrumentation"`.

Run: `pnpm test:integration tests/integration/scheduler/scheduler.test.ts tests/integration/api/internal-revalidate.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/lib/jobs"` / `"@/server/lib/internal-signature"`.

- [ ] **Step 3: Signature, internal route, repos**

`server/lib/internal-signature.ts`:

```ts
import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { deriveKey } from "./crypto"

// Server-to-itself requests (scheduler → /api/v1/internal/*): HMAC-SHA256
// with the HKDF "cron" key over "<unix seconds>.<raw body>" (ledger ruling).

export const TIMESTAMP_HEADER = "x-sp-timestamp"
export const SIGNATURE_HEADER = "x-sp-signature"
/** Accepted clock skew, and how long a captured request could be replayed. */
export const MAX_SKEW_SECONDS = 300

const mac = (timestamp: string, body: string, secret?: string) =>
  createHmac("sha256", deriveKey("cron", secret))
    .update(`${timestamp}.${body}`)
    .digest("base64url")

export function signInternalRequest(
  body: string,
  now = Date.now(),
  secret?: string
): { timestamp: string; signature: string } {
  const timestamp = String(Math.floor(now / 1000))
  return { timestamp, signature: mac(timestamp, body, secret) }
}

export function verifyInternalRequest(
  req: {
    body: string
    timestamp: string | null | undefined
    signature: string | null | undefined
  },
  now = Date.now(),
  secret?: string
): boolean {
  const { body, timestamp, signature } = req
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > MAX_SKEW_SECONDS)
    return false
  const expected = Buffer.from(mac(timestamp, body, secret))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
```

`lib/schemas/api/internal.ts`:

```ts
import { z } from "zod"

/** POST /api/v1/internal/revalidate (scheduler → itself). */
export const revalidateInput = z.object({
  tags: z.array(z.string().min(1).max(200)).min(1).max(100),
})
```

`server/modules/internal/routes.ts`:

```ts
import "server-only"

import { Hono } from "hono"

import { revalidateInput } from "@/lib/schemas/api/internal"
import type { AppEnv } from "@/server/api/context"
import { invalidate } from "@/server/lib/cache-tags"
import { AppError, fieldErrorsFromIssues } from "@/server/lib/errors"
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyInternalRequest,
} from "@/server/lib/internal-signature"

/**
 * The scheduler runs on a timer, where revalidateTag throws (no request
 * context, notes §2): it asks this route handler to expire the tags.
 * Signed with the HKDF "cron" key; anything else is 401.
 */
export const internalRoutes = new Hono<AppEnv>().post(
  "/revalidate",
  async (c) => {
    const body = await c.req.text()
    if (
      !verifyInternalRequest({
        body,
        timestamp: c.req.header(TIMESTAMP_HEADER),
        signature: c.req.header(SIGNATURE_HEADER),
      })
    )
      throw new AppError("UNAUTHENTICATED", "Invalid internal signature")
    let json: unknown
    try {
      json = JSON.parse(body)
    } catch {
      throw new AppError("VALIDATION_FAILED", "The body must be JSON")
    }
    const parsed = revalidateInput.safeParse(json)
    if (!parsed.success)
      throw new AppError("VALIDATION_FAILED", "Invalid tags", {
        fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
      })
    invalidate(...parsed.data.tags)
    return c.json({ ok: true as const, count: parsed.data.tags.length }, 200)
  }
)
```

In `server/api/app.ts` add `import { internalRoutes } from "@/server/modules/internal/routes"` (alphabetical) and, in `createApp()`, directly above the `// 5. Health` comment (below the preview exit route), add:

```ts
  // Scheduler → cache expiry (HMAC, HKDF "cron"; ledger ruling). Not admin:
  // no session; the signature is the authentication.
  api.use("/v1/internal/*", limitBody("public"))
  api.route("/v1/internal", internalRoutes)
```

`server/modules/jobs/repo.ts`:

```ts
import "server-only"

import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { jobs } from "@/server/db/schema"

export type JobRow = typeof jobs.$inferSelect

/**
 * Keyed recurring job: inserted once; an existing row keeps its schedule,
 * lock and last error (ON CONFLICT (key) DO UPDATE refreshes the name only).
 */
export async function upsertRecurringJob(
  db: DbOrTx,
  job: { name: string; key: string; runAt: Date }
): Promise<void> {
  await db
    .insert(jobs)
    .values(job)
    .onConflictDoUpdate({ target: jobs.key, set: { name: job.name } })
}

/**
 * Claims due jobs in one statement: run_at reached and not locked (or the
 * lock is older than `staleBefore` — a crashed worker). The sub-select is
 * FOR UPDATE SKIP LOCKED, so concurrent ticks claim disjoint rows and a
 * claimed row is never claimed twice.
 */
export function claimDueJobs(
  db: DbOrTx,
  opts: { now: Date; staleBefore: Date; limit: number }
) {
  const due = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        lte(jobs.runAt, opts.now),
        or(isNull(jobs.lockedAt), lt(jobs.lockedAt, opts.staleBefore))
      )
    )
    .orderBy(asc(jobs.runAt))
    .limit(opts.limit)
    .for("update", { skipLocked: true })
  return db
    .update(jobs)
    .set({ lockedAt: opts.now, attempts: sql`${jobs.attempts} + 1` })
    .where(inArray(jobs.id, due))
    .returning()
}

/** Releases a claimed job (only while this claim still holds it). */
export async function finishJob(
  db: DbOrTx,
  id: string,
  claimedAt: Date,
  result: {
    runAt: Date
    lastRunAt: Date
    lastError: string | null
    succeeded: boolean
  }
): Promise<void> {
  await db
    .update(jobs)
    .set({
      lockedAt: null,
      runAt: result.runAt,
      lastRunAt: result.lastRunAt,
      lastError: result.lastError,
      ...(result.succeeded ? { attempts: 0 } : {}),
    })
    .where(and(eq(jobs.id, id), eq(jobs.lockedAt, claimedAt)))
}
```

Append to `server/modules/revisions/repo.ts` (and add `sql` to its `drizzle-orm` import):

```ts
/** Keeps the newest `keep` revisions of every entity (spec §12); returns rows deleted. */
export async function pruneRevisionRows(
  db: DbOrTx,
  keep: number
): Promise<number> {
  const result = await db.execute(sql`
    delete from ${revisions}
    where ${revisions.id} in (
      select ranked.id from (
        select ${revisions.id} as id,
          row_number() over (
            partition by ${revisions.entityType}, ${revisions.entityId}
            order by ${revisions.version} desc
          ) as position
        from ${revisions}
      ) ranked
      where ranked.position > ${keep}
    )`)
  return result.rowCount ?? 0
}
```

In `server/modules/articles/repo.ts` add `lte` to the `drizzle-orm` import and append:

```ts
/** Scheduled articles due at `now`, row-locked; rows another worker holds are skipped. */
export function lockDueScheduledArticles(db: DbOrTx, now: Date, limit = 20) {
  return db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(eq(articles.status, "scheduled"), lte(articles.scheduledAt, now))
    )
    .orderBy(asc(articles.scheduledAt))
    .limit(limit)
    .for("update", { skipLocked: true })
}
```

Append to `server/modules/articles/service.ts`:

```ts
/**
 * Scheduler job (spec §12): publishes every scheduled article whose time
 * has come. Due rows are locked FOR UPDATE SKIP LOCKED, so concurrent ticks
 * (several replicas) publish each article exactly once; each article runs
 * in its own savepoint, so one that no longer validates stays scheduled
 * without holding back the others. Returns the cache tags to expire — the
 * caller has no request context (ledger ruling).
 */
export async function publishDueArticles(
  now: Date = new Date()
): Promise<{ published: string[]; failed: string[]; tags: string[] }> {
  const published: string[] = []
  const failed: string[] = []
  await getDb().transaction(async (tx) => {
    for (const { id } of await repo.lockDueScheduledArticles(tx, now)) {
      let label = id
      try {
        await tx.transaction(async (savepoint) => {
          const row = await loadRow(savepoint, id)
          label = row.slug
          const updated = await applyTransition(
            savepoint,
            null,
            row,
            row.version,
            PUBLISH,
            now,
            { scheduled: true }
          )
          if (updated) published.push(updated.slug)
        })
      } catch (err) {
        failed.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })
  return {
    published,
    failed,
    tags:
      published.length > 0
        ? [tag.articles, ...published.map((slug) => tag.article(slug))]
        : [],
  }
}
```

- [ ] **Step 4: Jobs, scheduler, instrumentation**

`server/lib/jobs/index.ts`:

```ts
import "server-only"

import { publishScheduledJob } from "./publish-scheduled"
import { pruneRevisionsJob } from "./prune-revisions"

export type JobContext = { now: Date; payload: unknown }
/** `tags`: cache tags to expire; `warning`: recorded in jobs.last_error without failing the run. */
export type JobResult = { tags?: string[]; warning?: string }
export type JobDefinition = {
  name: string
  /** jobs.key: one row per recurring job. */
  key: string
  /** Next run = this long after a successful run. */
  everyMs: number
  run(ctx: JobContext): Promise<JobResult>
}

/** Spec §12 jobs owned by this phase (leads purge, backup, media migration come later). */
export const RECURRING_JOBS: readonly JobDefinition[] = [
  publishScheduledJob,
  pruneRevisionsJob,
]
```

`server/lib/jobs/publish-scheduled.ts`:

```ts
import "server-only"

import { publishDueArticles } from "@/server/modules/articles/service"

import type { JobDefinition } from "./index"

/** Due at every 60 s tick (30 s < tick interval absorbs timer drift). */
export const publishScheduledJob: JobDefinition = {
  name: "publish-scheduled",
  key: "publish-scheduled",
  everyMs: 30_000,
  async run({ now }) {
    const { tags, failed } = await publishDueArticles(now)
    return {
      tags,
      warning:
        failed.length > 0 ? `Not published: ${failed.join("; ")}` : undefined,
    }
  },
}
```

`server/lib/jobs/prune-revisions.ts`:

```ts
import "server-only"

import { getDb } from "@/server/db/client"
import { pruneRevisionRows } from "@/server/modules/revisions/repo"

import type { JobDefinition } from "./index"

/** Spec §12: revision pruning keeps the last 50 per entity. */
export const REVISIONS_KEPT = 50

export const pruneRevisionsJob: JobDefinition = {
  name: "prune-revisions",
  key: "prune-revisions",
  everyMs: 24 * 60 * 60_000,
  async run() {
    await pruneRevisionRows(getDb(), REVISIONS_KEPT)
    return {}
  },
}
```

`server/lib/scheduler.ts`:

```ts
import "server-only"

import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import {
  claimDueJobs,
  finishJob,
  upsertRecurringJob,
} from "@/server/modules/jobs/repo"

import {
  SIGNATURE_HEADER,
  signInternalRequest,
  TIMESTAMP_HEADER,
} from "./internal-signature"
import { type JobDefinition, RECURRING_JOBS } from "./jobs"

// In-process scheduler (spec §12): a 60 s tick in every server instance;
// the jobs table (FOR UPDATE SKIP LOCKED) makes replicas safe.

export const TICK_INTERVAL_MS = 60_000
export const FIRST_TICK_DELAY_MS = 5_000
/** A claim older than this belongs to a crashed worker and may be taken over. */
export const LOCK_TIMEOUT_MS = 10 * 60_000
export const RETRY_DELAY_MS = 60_000
const CLAIM_LIMIT = 10
const ERROR_MAX_LENGTH = 2_000

export type TickResult = {
  name: string
  key: string | null
  ok: boolean
  error: string | null
  tags: string[]
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

/** Inserts missing recurring job rows; existing rows keep their schedule. */
export async function ensureRecurringJobs(
  now = new Date(),
  definitions: readonly JobDefinition[] = RECURRING_JOBS
): Promise<void> {
  const db = getDb()
  for (const job of definitions)
    await upsertRecurringJob(db, { name: job.name, key: job.key, runAt: now })
}

/** Our own origin for server-to-itself calls (PORT is set by next start / server.js). */
export function internalOrigin(): string {
  return `http://127.0.0.1:${process.env.PORT ?? "3000"}`
}

/**
 * Expires cache tags through the signed internal route: revalidateTag
 * throws outside a request (ledger ruling, notes §2).
 */
export async function revalidateViaApi(tags: string[]): Promise<void> {
  const body = JSON.stringify({ tags })
  const { timestamp, signature } = signInternalRequest(body)
  const res = await fetch(`${internalOrigin()}/api/v1/internal/revalidate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [TIMESTAMP_HEADER]: timestamp,
      [SIGNATURE_HEADER]: signature,
    },
    body,
  })
  if (!res.ok) throw new Error(`Cache refresh answered ${res.status}`)
}

/** Claims and runs the due jobs once. Options exist for tests (clock, jobs, cache). */
export async function tick(
  options: {
    now?: Date
    jobs?: readonly JobDefinition[]
    revalidate?: (tags: string[]) => Promise<void>
  } = {}
): Promise<TickResult[]> {
  const now = options.now ?? new Date()
  const definitions = options.jobs ?? RECURRING_JOBS
  const revalidate = options.revalidate ?? revalidateViaApi
  const db = getDb()
  const claimed = await claimDueJobs(db, {
    now,
    staleBefore: new Date(now.getTime() - LOCK_TIMEOUT_MS),
    limit: CLAIM_LIMIT,
  })
  const results: TickResult[] = []
  for (const job of claimed) {
    const definition = definitions.find((d) => d.name === job.name)
    let ok = true
    let error: string | null = null
    let tags: string[] = []
    try {
      if (!definition) throw new Error(`No handler for job "${job.name}"`)
      const result = await definition.run({ now, payload: job.payload })
      tags = result.tags ?? []
      error = result.warning ?? null
      if (tags.length > 0)
        try {
          await revalidate(tags)
        } catch (err) {
          error = [error, `Cache refresh failed: ${message(err)}`]
            .filter(Boolean)
            .join("; ")
        }
    } catch (err) {
      ok = false
      error = message(err)
    }
    await finishJob(db, job.id, now, {
      runAt: new Date(
        now.getTime() +
          (ok && definition ? definition.everyMs : RETRY_DELAY_MS)
      ),
      lastRunAt: now,
      lastError: error?.slice(0, ERROR_MAX_LENGTH) ?? null,
      succeeded: ok,
    })
    results.push({ name: job.name, key: job.key, ok, error, tags })
  }
  return results
}

type SchedulerState = {
  first: NodeJS.Timeout
  interval: NodeJS.Timeout
  running: boolean
}
// On globalThis: one scheduler per process, even across dev HMR reloads.
const store = globalThis as unknown as { __spScheduler?: SchedulerState }

/**
 * Starts the tick (spec §12). Never during `next build`, never twice per
 * process, and not at all without the app env (logged). Returns whether it
 * started.
 */
export function startScheduler(): boolean {
  if (process.env.NEXT_PHASE === "phase-production-build") return false
  if (store.__spScheduler) return false
  try {
    getEnv()
  } catch (err) {
    console.error("[scheduler] not started:", message(err))
    return false
  }
  const run = async () => {
    const state = store.__spScheduler
    if (!state || state.running) return // a slow tick never overlaps the next
    state.running = true
    try {
      await ensureRecurringJobs()
      for (const result of await tick())
        if (result.error)
          console.error(`[scheduler] ${result.name}: ${result.error}`)
    } catch (err) {
      console.error("[scheduler] tick failed:", message(err))
    } finally {
      state.running = false
    }
  }
  const first = setTimeout(() => void run(), FIRST_TICK_DELAY_MS)
  const interval = setInterval(() => void run(), TICK_INTERVAL_MS)
  first.unref?.()
  interval.unref?.()
  store.__spScheduler = { first, interval, running: false }
  return true
}

/** Stops the tick (tests, graceful shutdown). */
export function stopScheduler(): void {
  const state = store.__spScheduler
  if (!state) return
  clearTimeout(state.first)
  clearInterval(state.interval)
  store.__spScheduler = undefined
}
```

`instrumentation.ts`:

```ts
// Next calls register() once per server instance, before it serves requests,
// and never during `next build` (notes §6). The in-process scheduler
// (spec §12) runs on the Node.js runtime only.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./server/lib/scheduler")
    startScheduler()
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit tests/unit/internal-signature.test.ts tests/unit/scheduler-start.test.ts tests/unit/instrumentation.test.ts tests/unit/server-only-guard.test.ts tests/unit/lint-boundaries.test.ts`
Expected: PASS (3 + 3 + 1 new; every new `server/` file starts with `import "server-only"`).

Run: `pnpm test:integration tests/integration/scheduler/scheduler.test.ts tests/integration/api/internal-revalidate.test.ts tests/integration/api/articles.test.ts`
Expected: PASS (7 + 4 new; Task 1 unchanged).

Run: `pnpm lint && pnpm typecheck && env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build`
Expected: exit 0 — the build output shows no `[scheduler]` line (register() is skipped during `next build`; `startScheduler()` also checks `NEXT_PHASE`).

Run (port 3100 free, no other Playwright/build): `pnpm test:e2e`
Expected: all specs pass, including `tests/e2e/scheduled-publish.spec.ts` (≈ 10–70 s wait for the server's own tick): the article scheduled 3 s ahead is not on `/blog/timed-patrol-update` at first, then appears as its `<h1>` and as a card on `/blog` without any admin action, and the API reports it `published`.

Run: `pnpm test:visual`
Expected: `43 passed, 1 skipped` (the scheduler runs in the visual server too; the seed has no scheduled article, so nothing changes).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write instrumentation.ts server/lib/scheduler.ts server/lib/internal-signature.ts server/lib/jobs server/modules/jobs server/modules/internal lib/schemas/api/internal.ts server/modules/articles server/modules/revisions/repo.ts server/api/app.ts tests/unit/internal-signature.test.ts tests/unit/scheduler-start.test.ts tests/unit/instrumentation.test.ts tests/integration/scheduler tests/integration/api/internal-revalidate.test.ts tests/e2e/scheduled-publish.spec.ts
git add instrumentation.ts server/lib/scheduler.ts server/lib/internal-signature.ts server/lib/jobs server/modules/jobs server/modules/internal lib/schemas/api/internal.ts server/modules/articles server/modules/revisions/repo.ts server/api/app.ts tests/unit/internal-signature.test.ts tests/unit/scheduler-start.test.ts tests/unit/instrumentation.test.ts tests/integration/scheduler tests/integration/api/internal-revalidate.test.ts tests/e2e/scheduled-publish.spec.ts
git commit -m "feat: add in-process scheduler for scheduled publishing and pruning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase gate (controller, after Task 6)

On a clean checkout of the branch HEAD, port 3100 free, only one agent running Playwright/build:

- `pnpm lint && pnpm typecheck && pnpm test` → exit 0 (unit + dom + integration).
- `env -u DATABASE_URL -u BETTER_AUTH_SECRET -u BETTER_AUTH_URL pnpm build` → exit 0, no `[scheduler]` output.
- `pnpm test:visual` (twice) → `43 passed, 1 skipped` both times (40 public baselines at 0 px incl. `/blog`, every `/blog/<slug>`, `/privacy`, `/terms`; admin shell baselines as re-captured in Task 4).
- `pnpm test:e2e` → all Phase 2–5 specs pass (incl. `articles.spec.ts`, `scheduled-publish.spec.ts`).
