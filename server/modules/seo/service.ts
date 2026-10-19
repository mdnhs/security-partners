import "server-only"

import { z } from "zod"

import { PAGE_LABELS } from "@/lib/admin/page-labels"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { contactPlaceholders, type Placeholders } from "@/lib/interpolate"
import { BUILDER_ENTITY, builderPath } from "@/lib/schemas/api/builder-pages"
import type { SeoEntry, SeoKind, SeoOverviewDto } from "@/lib/schemas/api/seo"
import { type Seo, seo as seoSchema } from "@/lib/schemas/common"
import type { ContactSettings } from "@/lib/schemas/settings/contact"
import type { SeoDefaultsSettings } from "@/lib/schemas/settings/seo-defaults"
import { SEO_CHECK_COUNT, seoIssues } from "@/lib/seo/checks"
import { effectiveSeo } from "@/lib/seo/effective"
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
import { findSettingsRow } from "@/server/modules/settings/repo"
import { isPageKey, PAGE_PATHS, type PageKey } from "@/templates/registry"

import {
  findSeoRow,
  listSeoRows,
  lockSeoMediaRow,
  type SeoRow,
  updateSeoColumn,
} from "./repo"

type Context = { defaults: SeoDefaultsSettings; values: Placeholders }

const LABEL: Record<SeoKind, string> = {
  page: "Page",
  service: "Service",
  article: "Article",
  builder: "Page",
}

/** media_usages / audit entity type of a kind (builder pages: "builder-page"). */
const entityOf = (kind: SeoKind) => (kind === "builder" ? BUILDER_ENTITY : kind)

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
  if (row.kind === "builder")
    return {
      name: title,
      path: builderPath(row.slug ?? ""),
      titleName: title,
      fallbackDescription: row.description,
    }
  return {
    name: title,
    path: `/${row.kind === "service" ? "services" : "blog"}/${row.slug}`,
    titleName: title,
    fallbackDescription: row.description,
  }
}

function toEntry(row: SeoRow, ctx: Context): SeoEntry {
  const d = describeRow(row)
  const base = {
    defaults: ctx.defaults,
    name: d.titleName,
    fallbackDescription: d.fallbackDescription,
    values: ctx.values,
  }
  const own = effectiveSeo({ ...base, seo: row.seo })
  const fallback = effectiveSeo({ ...base, seo: {} })
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
      ? seoIssues({
          title: own.title,
          description: own.description,
          usesDefaultDescription: own.usesDefaultDescription,
          noindex: row.seo.noindex === true,
        })
      : [],
  }
}

async function loadContext(db: DbOrTx): Promise<Context> {
  const [defaults, contact] = await Promise.all([
    findSettingsRow(db, "seo.defaults"),
    findSettingsRow(db, "contact"),
  ])
  return {
    defaults: (defaults?.published ?? defaults?.draft) as SeoDefaultsSettings,
    values: contactPlaceholders(
      (contact?.published ?? contact?.draft) as ContactSettings
    ),
  }
}

export async function getSeoOverview(actor: Actor): Promise<SeoOverviewDto> {
  assertCan(actor, { seo: ["read"] })
  const db = getDb()
  const [rows, ctx] = await Promise.all([listSeoRows(db), loadContext(db)])
  const entries = rows.map((row) => toEntry(row, ctx))
  const live = entries.filter((entry) => entry.published)
  const total = live.length * SEO_CHECK_COUNT
  const failed = live.reduce((n, entry) => n + entry.issues.length, 0)
  return { entries, checks: { passed: total - failed, total } }
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
  if (kind === "builder") return [tag.builderPages, tag.builderPage(slug!)]
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
      await syncMediaUsages(
        tx,
        entityOf(kind),
        id,
        current.draft,
        current.published,
        { seo }
      )
    } catch (err) {
      throw withoutSeoPrefix(err)
    }
    await writeAudit(tx, actor, {
      action: `${entityOf(kind)}.seo_updated`,
      entityType: entityOf(kind),
      entityId: id,
      diff: { fields: changedFields(current.seo, seo) },
    })
    return current.slug
  })
  invalidate(...tagsFor(kind, id, slug))
  const [row, ctx] = await Promise.all([
    findSeoRow(db, kind, id),
    loadContext(db),
  ])
  if (!row) throw notFound(LABEL[kind])
  return toEntry(row, ctx)
}
