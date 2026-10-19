import "server-only"

import { isBuilderSlug } from "@/lib/builder-slug"
import { SLUG_PATTERN } from "@/lib/schemas/common"
import { FILE_EXTENSION } from "@/lib/seo/redirects"
import { getDb } from "@/server/db/client"
import { pgErrorCode } from "@/server/lib/pg-errors"
import { PAGE_PATHS } from "@/templates/registry"

import {
  findRedirectByFrom,
  incrementRedirectHits,
  isPublishedSlug,
} from "./repo"

/**
 * An unmatched path: app/(site)/[...notFound] answers it with notFound()
 * before anything streams, i.e. a real 404 (probed with Next 16.3.8).
 */
export const MISSING_PATH = "/_sp-missing"

export type PublicPathOutcome =
  | { kind: "pass" }
  | { kind: "missing" }
  | {
      kind: "redirect"
      to: string
      code: 301 | 302
      /** Counts the hit; proxy.ts runs it after responding (waitUntil). Never rejects. */
      recordHit: () => Promise<void>
    }

const PASS = { kind: "pass" } as const
const MISSING = { kind: "missing" } as const
const STATIC_PATHS = new Set<string>(Object.values(PAGE_PATHS))
const DETAIL = /^\/(services|blog)\/([^/]+)$/
/** A builder page address (app/(site)/p/[slug]); the slug is checked below. */
const BUILDER = /^\/p\/([^/]+)$/

/**
 * Only the SQLSTATE (or the error's class) is logged: a driver message can
 * carry connection details, and the path is visitor input.
 */
const errorCode = (error: unknown) =>
  pgErrorCode(error) ?? (error instanceof Error ? error.name : "unknown")

// ------------------------------------------------------------ hit counter

type Queued = { count: number; written: Promise<void> }

/** Per redirect id: the UPDATE in flight, and the hits waiting behind it. */
const inFlight = new Map<string, Promise<void>>()
const queued = new Map<string, Queued>()

function writeHits(id: string, count: number): Promise<void> {
  queued.delete(id)
  // Started inside a promise chain: a synchronous throw (e.g. getDb()
  // without DATABASE_URL) becomes a logged rejection, never an escape.
  const write = Promise.resolve()
    .then(() =>
      count === 1
        ? incrementRedirectHits(getDb(), id)
        : incrementRedirectHits(getDb(), id, count)
    )
    .catch((error: unknown) => {
      console.error(`[proxy] redirect hits not counted (${errorCode(error)})`)
    })
    .finally(() => {
      if (inFlight.get(id) === write) inFlight.delete(id)
    })
  inFlight.set(id, write)
  return write
}

/**
 * At most one UPDATE per redirect is in flight per process: hits that
 * arrive meanwhile are summed into the next one (`hits + n`). A flood of
 * requests to one redirect therefore costs one row write per round trip,
 * not one per request, and no hit is lost. Memory is bounded by the
 * number of redirect rows (entries are removed once written).
 */
function countHit(id: string): Promise<void> {
  const waiting = queued.get(id)
  if (waiting) {
    waiting.count += 1
    return waiting.written
  }
  const running = inFlight.get(id)
  if (!running) return writeHits(id, 1)
  const entry: Queued = {
    count: 1,
    written: running.then(() => writeHits(id, entry.count)),
  }
  queued.set(id, entry)
  return entry.written
}

// ---------------------------------------------------------------- resolve

/**
 * What proxy.ts does with a public GET: fixed pages and files pass without
 * a query; /services/:slug, /blog/:slug and builder pages /p/:slug pass
 * only when published (else a redirect, else a real 404 — also for a
 * draft-only or deleted builder page); any other path gets the redirect lookup
 * and otherwise reaches the catch-all 404. Previews (draft mode) skip the
 * slug check. A database failure never blocks the page (fail-open: the
 * page's own error boundary reports it).
 *
 * Cost: a live detail page is one indexed query (unique slug); an unknown
 * path is one indexed query (unique from_path); a missing detail page two.
 */
export async function resolvePublicPath(
  pathname: string,
  options: { draft: boolean }
): Promise<PublicPathOutcome> {
  if (
    STATIC_PATHS.has(pathname) ||
    pathname.startsWith("/_") ||
    FILE_EXTENSION.test(pathname)
  )
    return PASS
  const detail = DETAIL.exec(pathname)
  const builder = BUILDER.exec(pathname)
  if ((detail || builder) && options.draft) return PASS
  try {
    const db = getDb()
    if (detail) {
      const slug = detail[2]
      const kind = detail[1] === "services" ? "service" : "article"
      if (SLUG_PATTERN.test(slug) && (await isPublishedSlug(db, kind, slug)))
        return PASS
    }
    if (builder) {
      const slug = builder[1]
      if (isBuilderSlug(slug) && (await isPublishedSlug(db, "builder", slug)))
        return PASS
    }
    const redirect = await findRedirectByFrom(db, pathname)
    if (redirect)
      return {
        kind: "redirect",
        to: redirect.toPath,
        code: redirect.code === 302 ? 302 : 301,
        recordHit: () => countHit(redirect.id),
      }
    return detail || builder ? MISSING : PASS
  } catch (error) {
    console.error(`[proxy] public path lookup failed (${errorCode(error)})`)
    return PASS
  }
}
