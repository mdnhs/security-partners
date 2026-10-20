import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { CSV_BOM, CsvError, parseCsv, toCsv, unguardCell } from "@/lib/csv"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  REDIRECT_NOTE_MAX,
  type RedirectCode,
  redirectCode,
  type RedirectDto,
  type RedirectInput,
  type RedirectListQuery,
  type RedirectPatch,
} from "@/lib/schemas/api/redirects"
import {
  checkRedirectChain,
  fromPathProblem,
  noteProblem,
  REDIRECT_CODES,
  redirectTargetPath,
  toPathProblem,
} from "@/lib/seo/redirects"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { pgErrorCode, UNIQUE_VIOLATION } from "@/server/lib/pg-errors"
import { readPublishedSettings } from "@/server/modules/settings/service"
import { PAGE_PATHS } from "@/templates/registry"

import {
  deleteRedirectRow,
  findRedirectById,
  insertRedirect,
  isPublishedSlug,
  listAllRedirectRows,
  listPublishedSlugs,
  listRedirectEdges,
  listRedirectRows,
  lockRedirects,
  moveRedirects,
  type RedirectRow,
  updateRedirectRow,
  writeImportedRedirects,
} from "./repo"

const STATIC_PATHS = new Set<string>(Object.values(PAGE_PATHS))
const DETAIL = /^\/(services|blog)\/([^/]+)$/
/** Builder pages: /p/<slug> (D5.2). */
const BUILDER = /^\/p\/([^/]+)$/

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const invalid = (field: string, message: string) =>
  new AppError("VALIDATION_FAILED", message, {
    fieldErrors: { [field]: [message] },
  })

const duplicate = () =>
  new AppError("CONFLICT", "This address is already redirected", {
    fieldErrors: {
      fromPath: ["Already redirected — edit that redirect instead"],
    },
  })

function toDto(row: RedirectRow): RedirectDto {
  return {
    id: row.id,
    fromPath: row.fromPath,
    toPath: row.toPath,
    code: redirectCode(row.code),
    hits: row.hits,
    lastHitAt: row.lastHitAt?.toISOString() ?? null,
    isActive: row.isActive,
    note: row.note,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * The site's own origin (published settings.site.productionUrl), so
 * absolute links to the site count as its paths in chain checks; null when
 * unset.
 */
async function siteOrigin(db: DbOrTx): Promise<string | null> {
  const url = (await readPublishedSettings("site", db))?.productionUrl
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * A live page never redirects (proxy.ts serves it first). Sources never
 * hold %-escapes of unreserved characters (fromPathProblem), so the raw
 * path is the one compared with page paths and slugs.
 */
async function isLivePage(db: DbOrTx, fromPath: string): Promise<boolean> {
  if (STATIC_PATHS.has(fromPath)) return true
  const detail = DETAIL.exec(fromPath)
  return (
    detail !== null &&
    (await isPublishedSlug(
      db,
      detail[1] === "services" ? "service" : "article",
      detail[2]
    ))
  )
}

async function assertFromIsFree(db: DbOrTx, fromPath: string) {
  if (STATIC_PATHS.has(fromPath))
    throw invalid("fromPath", "This address is a live page of the site")
  if (await isLivePage(db, fromPath))
    throw invalid(
      "fromPath",
      "This address is a live page. Rename or unpublish it first."
    )
  const builder = BUILDER.exec(fromPath)
  if (builder && (await isPublishedSlug(db, "builder", builder[1])))
    throw invalid(
      "fromPath",
      "This address is a live page. Rename or unpublish it first."
    )
}

/**
 * Turning a redirect on runs the create-time live-page check: its address
 * may have become a page while it was Off (the page wins in proxy.ts).
 */
async function assertCanTurnOn(db: DbOrTx, fromPath: string) {
  if (await isLivePage(db, fromPath)) {
    const message = "That address is a live page now"
    throw new AppError("VALIDATION_FAILED", message, {
      fieldErrors: { isActive: [message] },
    })
  }
}

function assertChain(
  edges: Map<string, string>,
  from: string,
  to: string,
  origin: string | null
) {
  const check = checkRedirectChain(edges, from, to, origin)
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
      assertChain(
        await listRedirectEdges(tx),
        input.fromPath,
        input.toPath,
        await siteOrigin(tx)
      )
      const created = await insertRedirect(tx, input)
      await writeAudit(tx, actor, {
        action: "redirect.created",
        entityType: "redirect",
        entityId: created.id,
        diff: input,
      })
      return created
    })
    invalidate(tag.redirects)
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
        note: patch.note ?? existing.note,
        isActive: patch.isActive ?? existing.isActive,
      }
      // A new fromPath runs the create check, a superset of the turn-on
      // check (live pages), so the turn-on check is only needed otherwise.
      // Keep that coverage if this branch is ever split.
      if (next.fromPath !== existing.fromPath)
        await assertFromIsFree(tx, next.fromPath)
      else if (patch.isActive === true) await assertCanTurnOn(tx, next.fromPath)
      const edges = await listRedirectEdges(tx)
      edges.delete(existing.fromPath)
      assertChain(edges, next.fromPath, next.toPath, await siteOrigin(tx))
      // Turning on/off alone is not an edit: updatedAt stays, so the row
      // keeps its place in the default "Updated" sort (focus stays put).
      const edited =
        next.fromPath !== existing.fromPath ||
        next.toPath !== existing.toPath ||
        next.code !== existing.code ||
        next.note !== existing.note
      const updated = await updateRedirectRow(
        tx,
        id,
        edited ? next : { ...next, updatedAt: existing.updatedAt }
      )
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
            note: existing.note,
            isActive: existing.isActive,
          },
          to: next,
        },
      })
      return updated
    })
    invalidate(tag.redirects)
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
  invalidate(tag.redirects)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// CSV export / import (D1.8)

/** Data rows one import may hold (the file's header line not counted). */
export const REDIRECT_IMPORT_MAX_ROWS = 1000

export const REDIRECT_CSV_HEADER = [
  "from",
  "to",
  "code",
  "active",
  "note",
  "hits",
  "last_hit_at",
  "source",
] as const

export type ImportRow = {
  /** Physical line in the file (the header is line 1). */
  line: number
  from: string
  to: string
  /** 301 when the cell is empty, or when it is invalid (see message). */
  code: RedirectCode
  note: string
  /**
   * create / update an existing redirect / unchanged (the redirect already
   * says exactly this: nothing is written, its source and Updated stay).
   */
  status: "create" | "update" | "unchanged" | "error"
  message?: string
}

export type ImportResult = {
  rows: ImportRow[]
  created: number
  updated: number
  unchanged: number
}

type ImportPlan = {
  rows: ImportRow[]
  creates: (ImportRow & { isActive: boolean })[]
  updates: (ImportRow & { isActive: boolean; edited: boolean })[]
  unchanged: number
  errors: number
}

/**
 * Every redirect as CSV (BOM + CRLF, formula-guarded: a note starting with
 * = + - @ TAB CR | gets a leading "'"). Audited with the count only.
 */
export async function exportRedirectsCsv(actor: Actor): Promise<string> {
  assertCan(actor, { redirect: ["read"] })
  const db = getDb()
  const rows = await listAllRedirectRows(db)
  const csv =
    CSV_BOM +
    toCsv(
      REDIRECT_CSV_HEADER,
      rows.map((r) => [
        r.fromPath,
        r.toPath,
        r.code,
        r.isActive ? "yes" : "no",
        r.note,
        r.hits,
        r.lastHitAt?.toISOString() ?? null,
        r.source,
      ])
    )
  await writeAudit(db, actor, {
    action: "redirect.exported",
    entityType: "redirect",
    diff: { count: rows.length },
  })
  return csv
}

const fileError = (message: string) =>
  new AppError("VALIDATION_FAILED", message, {
    fieldErrors: { csv: [message] },
  })

/** The file's data rows as cells by column name (from, to, code, note). */
function readImportFile(
  csv: string
): { line: number; cell: (name: string) => string }[] {
  let parsed: ReturnType<typeof parseCsv>
  try {
    parsed = parseCsv(csv, { maxRows: REDIRECT_IMPORT_MAX_ROWS })
  } catch (err) {
    if (err instanceof CsvError) throw fileError(err.message)
    throw err
  }
  const columns = new Map<string, number>()
  parsed.header.forEach((name, index) => {
    const key = name.trim().toLowerCase()
    if (!columns.has(key)) columns.set(key, index)
  })
  if (!columns.has("from") || !columns.has("to"))
    throw fileError(
      "The first line must name the columns from and to (code, active and note are optional)."
    )
  if (parsed.rows.length === 0)
    throw fileError(
      "No redirects found in the file. Add one row per redirect under the from,to line."
    )
  return parsed.rows.map((cells, i) => ({
    line: parsed.lines[i],
    cell: (name) => {
      const index = columns.get(name)
      return index === undefined ? "" : (cells[index] ?? "")
    },
  }))
}

const CODE_TEXT = /^\d{3}$/

/** The `active` cell: yes/no (also true/false, 1/0); empty → undefined. */
function activeCell(text: string): boolean | undefined | "invalid" {
  const value = text.trim().toLowerCase()
  if (value === "") return undefined
  if (value === "yes" || value === "true" || value === "1") return true
  if (value === "no" || value === "false" || value === "0") return false
  return "invalid"
}

/**
 * The live service/article pages among the file's source addresses: one
 * query per kind (not one per row while the redirect lock is held).
 */
async function liveDetailPaths(
  db: DbOrTx,
  froms: readonly string[]
): Promise<Set<string>> {
  const slugs = { service: [] as string[], article: [] as string[] }
  for (const from of froms) {
    const detail = DETAIL.exec(from)
    if (detail)
      slugs[detail[1] === "services" ? "service" : "article"].push(detail[2])
  }
  const [services, articles] = await Promise.all([
    listPublishedSlugs(db, "service", slugs.service),
    listPublishedSlugs(db, "article", slugs.article),
  ])
  return new Set([
    ...[...services].map((s) => `/services/${s}`),
    ...[...articles].map((s) => `/blog/${s}`),
  ])
}

/**
 * Validates every row with the manual-create rules, in file order:
 * fromPathProblem, toPathProblem, code, note (length, control
 * characters), active (yes/no), a `from` already used earlier in the file,
 * the live-page check for new addresses and for Off ones turned on, and
 * checkRedirectChain over the existing redirects plus earlier valid rows.
 * Existing `from` → update (an empty `active` keeps its On/Off), or
 * unchanged when it already says exactly this; else create (On unless
 * `active` says no).
 */
async function planImport(db: DbOrTx, csv: string): Promise<ImportPlan> {
  const file = readImportFile(csv)
  const existing = new Map(
    (await listAllRedirectRows(db)).map((r) => [r.fromPath, r])
  )
  const edges = await listRedirectEdges(db)
  const origin = await siteOrigin(db)
  const live = await liveDetailPaths(
    db,
    file.map(({ cell }) => cell("from").trim())
  )
  const isLive = (from: string) => STATIC_PATHS.has(from) || live.has(from)
  const seen = new Map<string, number>()
  const plan: ImportPlan = {
    rows: [],
    creates: [],
    updates: [],
    unchanged: 0,
    errors: 0,
  }
  for (const { line, cell } of file) {
    const from = cell("from").trim()
    const to = cell("to").trim()
    const codeText = cell("code").trim()
    // Trimmed again after the unguard: "'\tx" is "x", as a manual note.
    const note = unguardCell(cell("note").trim()).trim()
    const active = activeCell(cell("active"))
    const code = codeText === "" ? 301 : redirectCode(Number(codeText))
    const fail = (message: string) => {
      plan.rows.push({ line, from, to, code, note, status: "error", message })
      plan.errors++
    }
    const fromProblem = fromPathProblem(from)
    if (fromProblem) {
      fail(fromProblem)
      continue
    }
    const earlier = seen.get(from)
    if (earlier !== undefined) {
      fail(`${from} is already in this file (line ${earlier})`)
      continue
    }
    seen.set(from, line)
    const toProblem = toPathProblem(to)
    if (toProblem) {
      fail(toProblem)
      continue
    }
    if (
      codeText !== "" &&
      !(
        CODE_TEXT.test(codeText) &&
        (REDIRECT_CODES as readonly number[]).includes(Number(codeText))
      )
    ) {
      fail("Use 301, 302, 307 or 308 as the code (empty means 301)")
      continue
    }
    if (note.length > REDIRECT_NOTE_MAX) {
      fail(`Keep the note to ${REDIRECT_NOTE_MAX} characters`)
      continue
    }
    const badNote = noteProblem(note)
    if (badNote) {
      fail(badNote)
      continue
    }
    if (active === "invalid") {
      fail("Use yes or no in the active column (empty keeps it as it is)")
      continue
    }
    const current = existing.get(from)
    if (!current && isLive(from)) {
      fail("This address is a live page. Rename or unpublish it first.")
      continue
    }
    const isActive = active ?? current?.isActive ?? true
    if (current && !current.isActive && isActive && isLive(from)) {
      fail("That address is a live page now: it can't be turned on")
      continue
    }
    const chain = checkRedirectChain(edges, from, to, origin)
    if (!chain.ok) {
      fail(
        chain.reason === "loop"
          ? `This would loop: ${chain.chain.join(" → ")}`
          : `Too many hops (${chain.chain.join(" → ")}). Point straight at the final address.`
      )
      continue
    }
    edges.set(from, to)
    if (!current) {
      const row = { line, from, to, code, note, status: "create" as const }
      plan.rows.push(row)
      plan.creates.push({ ...row, isActive })
      continue
    }
    const edited =
      current.toPath !== to || current.code !== code || current.note !== note
    if (!edited && current.isActive === isActive) {
      plan.rows.push({ line, from, to, code, note, status: "unchanged" })
      plan.unchanged++
      continue
    }
    const row = { line, from, to, code, note, status: "update" as const }
    plan.rows.push(row)
    plan.updates.push({ ...row, isActive, edited })
  }
  return plan
}

const importedValues = (row: ImportRow & { isActive: boolean }) => ({
  fromPath: row.from,
  toPath: row.to,
  code: row.code,
  note: row.note,
  isActive: row.isActive,
})

const resultOf = (plan: ImportPlan): ImportResult => ({
  rows: plan.rows,
  created: plan.creates.length,
  updated: plan.updates.length,
  unchanged: plan.unchanged,
})

/**
 * CSV import. `preview` reports every row (create / update / unchanged /
 * error with its message) and writes nothing. `commit` re-validates under
 * the redirect lock and, only when no row has an error, writes the creates
 * and updates in one transaction (source 'import'; unchanged rows are left
 * alone) with one audit entry holding counts, not contents; any error row
 * → 422 with every row in `error.current.rows`.
 */
export async function importRedirects(
  actor: Actor,
  input: { csv: string; mode: "preview" | "commit" }
): Promise<ImportResult> {
  assertCan(actor, { redirect: ["create", "update"] })
  if (input.mode === "preview")
    return resultOf(await planImport(getDb(), input.csv))
  try {
    const plan = await getDb().transaction(async (tx) => {
      await lockRedirects(tx)
      const planned = await planImport(tx, input.csv)
      if (planned.errors > 0)
        throw new AppError(
          "VALIDATION_FAILED",
          `${planned.errors} ${planned.errors === 1 ? "row needs" : "rows need"} fixing. Nothing was imported.`,
          { current: { rows: planned.rows } }
        )
      await writeImportedRedirects(
        tx,
        planned.creates.map(importedValues),
        planned.updates.map((row) => ({
          ...importedValues(row),
          edited: row.edited,
        }))
      )
      await writeAudit(tx, actor, {
        action: "redirect.imported",
        entityType: "redirect",
        diff: {
          created: planned.creates.length,
          updated: planned.updates.length,
          unchanged: planned.unchanged,
          rows: planned.rows.length,
        },
      })
      return planned
    })
    invalidate(tag.redirects)
    return resultOf(plan)
  } catch (err) {
    return mapUnique(err)
  }
}

/**
 * A published service/article/builder page (/p/<slug>) changed address or
 * was deleted: 301 the old
 * address (ledger ruling). Runs inside the caller's transaction, as a side
 * effect of an action the caller was allowed to take (editors have no
 * redirect permission of their own). Redirects that led to the old address
 * (also with a trailing slash or as an absolute link to the site) follow
 * it. Returns true when redirects changed: the caller then expires
 * tag.redirects after its transaction commits.
 */
export async function recordMove(
  tx: DbOrTx,
  actor: Actor,
  move: { from: string; to: string; reason: string }
): Promise<boolean> {
  if (move.from === move.to) return false
  await lockRedirects(tx)
  const origin = await siteOrigin(tx)
  // Targets with their own query or hash keep pointing where they did.
  const repoint = [...(await listRedirectEdges(tx))]
    .filter(
      ([source, target]) =>
        source !== move.to &&
        !/[?#]/.test(target) &&
        redirectTargetPath(target, origin) === move.from
    )
    .map(([source]) => source)
  const changed = await moveRedirects(tx, move.from, move.to, repoint)
  await writeAudit(tx, actor, {
    action: "redirect.auto_created",
    entityType: "redirect",
    diff: { ...move, ...changed },
  })
  return true
}
