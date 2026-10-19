import "server-only"

import { z } from "zod"

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { contactPlaceholders, type Placeholders } from "@/lib/interpolate"
import type {
  SeoEntry,
  SeoHealthDto,
  SeoIssueDto,
  SeoKind,
  SeoOverviewDto,
} from "@/lib/schemas/api/seo"
import {
  richText,
  type RichTextDoc,
  type Seo,
  seo as seoSchema,
} from "@/lib/schemas/common"
import type { ContactSettings } from "@/lib/schemas/settings/contact"
import type { SeoDefaultsSettings } from "@/lib/schemas/settings/seo-defaults"
import type { SiteSettings } from "@/lib/schemas/settings/site"
import { altTextMessage, type CheckResult, runChecks } from "@/lib/seo/checks"
import { effectiveSeo } from "@/lib/seo/effective"
import { countInternalLinks } from "@/lib/seo/internal-links"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import {
  AppError,
  fieldErrorsFromIssues,
  forbidden,
  notFound,
} from "@/server/lib/errors"
import { syncMediaUsages } from "@/server/lib/media-usages"
import { publicOrigin } from "@/server/lib/site-origin"
import { altSummary } from "@/server/modules/media/repo"
import { findSettingsRow } from "@/server/modules/settings/repo"
import { isPageKey, PAGE_PATHS, type PageKey } from "@/templates/registry"

import {
  listMissingAltUsages,
  listSeoRichText,
  listSeoRows,
  lockSeoMediaRow,
  mediaSizes,
  type SeoRow,
  updateSeoColumn,
} from "./repo"

type Context = {
  defaults: SeoDefaultsSettings
  values: Placeholders
  /** The public site's origin (absolute links in rich text count as internal). */
  origin: string
}

const LABEL: Record<SeoKind, string> = {
  page: "Page",
  service: "Service",
  article: "Article",
}

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const record = (value: unknown) =>
  (value && typeof value === "object" ? value : {}) as Record<string, unknown>

/** Name, URL and title/description fallbacks, mirroring templates/shared/page-meta.ts. */
function describeRow(row: SeoRow) {
  if (row.kind === "page") {
    const key = row.id as PageKey
    return {
      name: PAGE_LABELS[key],
      path: PAGE_PATHS[key],
      titleName: key === "home" ? null : (row.title ?? PAGE_LABELS[key]),
      fallbackDescription: null,
    }
  }
  const title = row.title ?? row.slug ?? row.id
  return {
    name: title,
    path: `/${row.kind === "service" ? "services" : "blog"}/${row.slug}`,
    titleName: title,
    fallbackDescription: row.description,
  }
}

/** What the live page renders with and without the record's own SEO fields. */
function effectiveOf(row: SeoRow, ctx: Context) {
  const d = describeRow(row)
  const base = {
    defaults: ctx.defaults,
    name: d.titleName,
    fallbackDescription: d.fallbackDescription,
    values: ctx.values,
  }
  return {
    own: effectiveSeo({ ...base, seo: row.seo }),
    fallback: effectiveSeo({ ...base, seo: {} }),
  }
}

/** `results`: the record's checks (published records list their failures). */
function toEntry(row: SeoRow, ctx: Context, results: CheckResult[]): SeoEntry {
  const d = describeRow(row)
  const { own, fallback } = effectiveOf(row, ctx)
  const published = row.published
  return {
    kind: row.kind,
    id: row.id,
    name: d.name,
    path: d.path,
    published,
    seo: row.seo,
    title: own.title,
    description: own.description,
    fallback: { title: fallback.title, description: fallback.description },
    image: row.seo.ogImage
      ? "own"
      : ctx.defaults.ogImage
        ? "default"
        : "generated",
    issues: published
      ? results
          .filter((r) => !r.ok)
          .map((r) => ({ check: r.id, message: r.message }))
      : [],
  }
}

async function loadContext(db: DbOrTx): Promise<Context> {
  const [defaults, contact, site] = await Promise.all([
    findSettingsRow(db, "seo.defaults"),
    findSettingsRow(db, "contact"),
    findSettingsRow(db, "site"),
  ])
  const siteValue = (site?.published ?? site?.draft) as SiteSettings | undefined
  return {
    defaults: (defaults?.published ?? defaults?.draft) as SeoDefaultsSettings,
    values: contactPlaceholders(
      (contact?.published ?? contact?.draft) as ContactSettings
    ),
    origin: publicOrigin(siteValue?.productionUrl ?? null),
  }
}

/** Title uniqueness ignores case and surrounding/repeated spaces. */
const titleKey = (title: string) =>
  title.trim().replace(/\s+/g, " ").toLowerCase()

const FIX_BASE: Record<SeoKind, string> = {
  page: "/admin/pages",
  service: "/admin/services",
  article: "/admin/insights",
}

/** Where to fix a record's SEO (spec §7.1): its editor's SEO tab. */
const fixHref = (kind: SeoKind, id: string) =>
  `${FIX_BASE[kind]}/${encodeURIComponent(id)}?tab=seo`

/** The site robots mode (seo.defaults.robots, D1.6); absent = index. */
const siteNoindex = (defaults: SeoDefaultsSettings) =>
  (defaults as { robots?: unknown }).robots === "noindex"

// Records whose rich text could not be read, already logged (bounded by the
// number of records; one line per record per server process).
const unreadableLogged = new Set<string>()
function warnUnreadableText(recordKey: string) {
  if (unreadableLogged.has(recordKey)) return
  unreadableLogged.add(recordKey)
  console.warn(
    `[seo] rich text of ${recordKey} could not be read; internal-link counts it as 0 links`
  )
}

/**
 * Runs the eight checks (lib/seo/checks.ts) on every page, service and
 * article, and collects the published records' failures with Fix links,
 * plus each image missing alt text that such a record uses (listed once).
 */
async function computeHealth(
  db: DbOrTx
): Promise<{ entries: SeoEntry[]; health: SeoHealthDto }> {
  const [rows, ctx, texts, missingAlt, alt] = await Promise.all([
    listSeoRows(db),
    loadContext(db),
    listSeoRichText(db),
    listMissingAltUsages(db),
    altSummary(db),
  ])
  const key = (kind: string, id: string) => `${kind}:${id}`

  const shareImageOf = (row: SeoRow) =>
    row.seo.ogImage?.mediaId ?? ctx.defaults.ogImage?.mediaId ?? null
  const sizes = await mediaSizes(db, [
    ...new Set(rows.map(shareImageOf).filter((id): id is string => !!id)),
  ])

  // No rich text (null) passes; rich text that does not parse counts as 0
  // links, so the check fails visibly instead of passing silently, and is
  // logged once per record (an unreadable body, not a missing link).
  const links = new Map<string, number>()
  for (const t of texts) {
    if (t.doc === null || t.doc === undefined) continue
    const k = key(t.kind, t.id)
    const parsed = richText.safeParse(t.doc)
    if (!parsed.success) warnUnreadableText(k)
    links.set(
      k,
      parsed.success
        ? countInternalLinks(parsed.data as RichTextDoc, ctx.origin)
        : 0
    )
  }

  const missingByRecord = new Map<string, number>()
  for (const u of missingAlt) {
    const k = key(u.entityType, u.entityId)
    missingByRecord.set(k, (missingByRecord.get(k) ?? 0) + 1)
  }

  const evaluated = rows.map((row) => ({
    row,
    seo: effectiveOf(row, ctx).own,
    d: describeRow(row),
  }))
  const titleCounts = new Map<string, number>()
  for (const { row, seo } of evaluated)
    if (row.published) {
      const t = titleKey(seo.title)
      titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1)
    }

  const robotsNoindex = siteNoindex(ctx.defaults)
  const entities: SeoHealthDto["entities"] = []
  const entries: SeoEntry[] = []
  const issues: SeoIssueDto[] = []
  let passed = 0
  let total = 0
  for (const { row, seo, d } of evaluated) {
    const k = key(row.kind, row.id)
    const imageId = shareImageOf(row)
    const size = imageId ? sizes.get(imageId) : undefined
    const others =
      (titleCounts.get(titleKey(seo.title)) ?? 0) - (row.published ? 1 : 0)
    const results = runChecks({
      title: seo.title,
      titleUnique: others === 0,
      description: seo.description,
      usesDefaultDescription: seo.usesDefaultDescription,
      ogImage: size
        ? { width: size.width ?? 0, height: size.height ?? 0 }
        : null,
      imagesMissingAlt: missingByRecord.get(k) ?? 0,
      // Fixed templates always render one (spec §7.1).
      hasH1: true,
      noindex: row.seo.noindex === true,
      siteNoindex: robotsNoindex,
      internalLinks: links.get(k) ?? null,
    })
    entities.push({
      kind: row.kind,
      id: row.id,
      title: d.name,
      path: d.path,
      published: row.published,
      results,
    })
    entries.push(toEntry(row, ctx, results))
    if (!row.published) continue
    total += results.length
    for (const r of results) {
      if (r.ok) passed++
      else
        issues.push({
          kind: row.kind,
          id: row.id,
          title: d.name,
          path: d.path,
          check: r.id,
          message: r.message,
          fixHref: fixHref(row.kind, row.id),
        })
    }
  }

  // Each image missing alt text that a published record uses, once.
  const live = new Set(
    rows.filter((r) => r.published).map((r) => key(r.kind, r.id))
  )
  const listed = new Set<string>()
  for (const u of missingAlt) {
    if (listed.has(u.mediaId) || !live.has(key(u.entityType, u.entityId)))
      continue
    listed.add(u.mediaId)
    issues.push({
      kind: "media",
      id: u.mediaId,
      title: u.name,
      path: null,
      check: "alt-text",
      message: altTextMessage(1),
      fixHref: `/admin/media?missingAlt=true&open=${u.mediaId}`,
    })
  }

  return {
    entries,
    health: {
      score: total === 0 ? 100 : Math.round((passed / total) * 100),
      passed,
      total,
      entities,
      issues,
      alt,
    },
  }
}

/** GET /seo/health: the eight checks, issues with Fix links, alt-text coverage. */
export async function getSeoHealth(actor: Actor): Promise<SeoHealthDto> {
  assertCan(actor, { seo: ["read"] })
  return (await computeHealth(getDb())).health
}

/** GET /seo/overview: every record's entry for the SEO sheet, and the check totals. */
export async function getSeoOverview(actor: Actor): Promise<SeoOverviewDto> {
  assertCan(actor, { seo: ["read"] })
  const { entries, health } = await computeHealth(getDb())
  return { entries, checks: { passed: health.passed, total: health.total } }
}

/** Blank values mean "use the fallback": they are dropped, never stored. */
function cleanSeo(input: unknown): Seo {
  const kept = Object.fromEntries(
    Object.entries(record(input)).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined
    )
  )
  const parsed = seoSchema.safeParse(kept)
  if (!parsed.success)
    throw new AppError("VALIDATION_FAILED", "Check the highlighted fields", {
      fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
    })
  return parsed.data
}

/** media_usages reports "seo.ogImage"; the SEO form's field is "ogImage". */
function withoutSeoPrefix(err: unknown): unknown {
  if (!(err instanceof AppError) || !err.details?.fieldErrors) return err
  const fieldErrors = Object.fromEntries(
    Object.entries(err.details.fieldErrors).map(([key, value]) => [
      key.replace(/^seo\./, ""),
      value,
    ])
  )
  return new AppError(err.code, err.message, { ...err.details, fieldErrors })
}

const changedFields = (before: Seo, after: Seo) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(
      (key) =>
        JSON.stringify(before[key as keyof Seo]) !==
        JSON.stringify(after[key as keyof Seo])
    )
    .sort()

function tagsFor(kind: SeoKind, id: string, slug: string | null): string[] {
  if (kind === "page") return [tag.page(id)]
  if (kind === "service") return [tag.services, tag.service(slug!)]
  return [tag.articles, tag.article(slug!)]
}

const validId = (kind: SeoKind, id: string) =>
  kind === "page" ? isPageKey(id) : z.uuid().safeParse(id).success

/**
 * Saves a record's SEO fields (the seo column): live at once, last write
 * wins, the record's version and draft are untouched. The share image is
 * kept in media_usages alongside the record's content images.
 */
export async function updateSeo(
  actor: Actor,
  kind: SeoKind,
  id: string,
  input: { seo: unknown }
): Promise<SeoEntry> {
  assertCan(actor, { seo: ["update"] })
  if (!validId(kind, id)) throw notFound(LABEL[kind])
  const seo = cleanSeo(input.seo)
  const db = getDb()
  // The row stays locked from this read to commit, so a concurrent draft
  // save cannot slip in between and lose its images' usage rows.
  const slug = await db.transaction(async (tx) => {
    const current = await lockSeoMediaRow(tx, kind, id)
    if (!current) throw notFound(LABEL[kind])
    await updateSeoColumn(tx, kind, id, seo)
    try {
      await syncMediaUsages(tx, kind, id, current.draft, current.published, {
        seo,
      })
    } catch (err) {
      throw withoutSeoPrefix(err)
    }
    await writeAudit(tx, actor, {
      action: `${kind}.seo_updated`,
      entityType: kind,
      entityId: id,
      diff: { fields: changedFields(current.seo, seo) },
    })
    return current.slug
  })
  invalidate(...tagsFor(kind, id, slug))
  // With its checks: they depend on the other records (title-unique).
  // Cost: a full health pass (every row, every rich-text body) per save.
  // Fine at this site's size (tens of records); if PUT latency ever
  // matters, compute only title-unique plus this record's own inputs.
  const entry = (await computeHealth(db)).entries.find(
    (e) => e.kind === kind && e.id === id
  )
  if (!entry) throw notFound(LABEL[kind])
  return entry
}
