import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Paginated } from "@/lib/schemas/api/list"
import type {
  RedirectDto,
  RedirectInput,
  RedirectListQuery,
  RedirectPatch,
} from "@/lib/schemas/api/redirects"
import { checkRedirectChain, redirectTargetPath } from "@/lib/seo/redirects"
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
  listRedirectEdges,
  listRedirectRows,
  lockRedirects,
  moveRedirects,
  type RedirectRow,
  updateRedirectRow,
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
    code: row.code === 302 ? 302 : 301,
    hits: row.hits,
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
async function assertFromIsFree(db: DbOrTx, fromPath: string) {
  if (STATIC_PATHS.has(fromPath))
    throw invalid("fromPath", "This address is a live page of the site")
  const detail = DETAIL.exec(fromPath)
  if (
    detail &&
    (await isPublishedSlug(
      db,
      detail[1] === "services" ? "service" : "article",
      detail[2]
    ))
  )
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
      }
      if (next.fromPath !== existing.fromPath)
        await assertFromIsFree(tx, next.fromPath)
      const edges = await listRedirectEdges(tx)
      edges.delete(existing.fromPath)
      assertChain(edges, next.fromPath, next.toPath, await siteOrigin(tx))
      const updated = await updateRedirectRow(tx, id, next)
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
