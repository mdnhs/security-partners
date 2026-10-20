import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { isoDate } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import { LEAD_STATUSES } from "@/lib/schemas/api/leads"
import type { AiConfig } from "@/lib/schemas/integrations"
import type { Seo } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { AppError, forbidden } from "@/server/lib/errors"
import * as articlesRepo from "@/server/modules/articles/repo"
import { getArticleAdmin } from "@/server/modules/articles/service"
import { trendDays } from "@/server/modules/dashboard/days"
import { getDashboard } from "@/server/modules/dashboard/service"
import { getPage } from "@/server/modules/pages/service"
import * as pagesRepo from "@/server/modules/pages/repo"
import { search } from "@/server/modules/search/service"
import { getSeoOverview } from "@/server/modules/seo/service"
import * as servicesRepo from "@/server/modules/services/repo"
import { getServiceAdmin } from "@/server/modules/services/service"
import { isPageKey } from "@/templates/registry"

import { oneLine } from "./prompt"
import { REDACT_LINE_MAX, redactContacts } from "./redact"
import {
  contentStatuses,
  leadCounts,
  recentLeadRows,
  serviceNames,
} from "./repo"

/**
 * What the assistant's read-only tools return (spec §6.3). Every reader
 * runs as the actor: the module services it calls check the actor's
 * permissions again, so a tool can never show more than the user's own
 * admin screens. Nothing here reads settings, integrations, users or
 * sessions. Text fields stay within TEXT_MAX characters in total.
 */
export type ToolResult = Record<string, unknown>

/** Budget for the text fields of one tool result. */
export const TEXT_MAX = 8000

const DAY = 86_400_000

const can = (actor: Actor, req: PermissionRequest) =>
  hasPermission(actor.roles, req)

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!can(actor, req)) throw forbidden()
}

const notFoundResult = (what: string): ToolResult => ({
  found: false,
  message: `No ${what} matches that.`,
})

const isNotFound = (error: unknown) =>
  error instanceof AppError && error.code === "NOT_FOUND"

function clip(text: string, max: number): string {
  const chars = [...text]
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text
}

// ------------------------------------------------------------ text

type Json = unknown

const isRecord = (value: Json): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Keys that hold references or presentation, not copy. */
const SKIP_KEYS = new Set(["mediaId", "id", "icon", "variant", "type"])

/** Plain text of a TipTap document: one line per block. */
function docText(node: Json): string {
  if (!isRecord(node)) return ""
  if (node.type === "text" && typeof node.text === "string") return node.text
  if (node.type === "hardBreak") return "\n"
  const children = Array.isArray(node.content) ? node.content : []
  const inner = children.map(docText)
  const block =
    node.type === "doc" ||
    node.type === "bulletList" ||
    node.type === "orderedList" ||
    node.type === "blockquote"
  const text = inner.join(block ? "\n" : "")
  return node.type === "listItem" ? `- ${text}` : text
}

const isDoc = (value: Json) =>
  isRecord(value) && value.type === "doc" && Array.isArray(value.content)

/**
 * A record's copy as "path: text" lines (template data, service and
 * article content), within TEXT_MAX. Ids, media references and numbers
 * are left out.
 */
export function flattenText(value: Json, max = TEXT_MAX): string {
  const lines: string[] = []
  const walk = (node: Json, path: string) => {
    if (typeof node === "string") {
      const text = node.trim()
      if (text && !isUuid(text)) lines.push(path ? `${path}: ${text}` : text)
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i + 1}]`))
      return
    }
    if (!isRecord(node)) return
    if (isDoc(node)) {
      const text = docText(node).trim()
      if (text) lines.push(path ? `${path}:\n${text}` : text)
      return
    }
    for (const [key, child] of Object.entries(node)) {
      if (SKIP_KEYS.has(key)) continue
      walk(child, path ? `${path}.${key}` : key)
    }
  }
  walk(value, "")
  return clip(lines.join("\n"), max)
}

/**
 * A record's own SEO fields, only for users who may read SEO. The admin
 * DTOs leave SEO out, so its row is read (a second time) only then (C8
 * review M7: no extra read for anyone else).
 */
async function seoRead(
  actor: Actor,
  find: () => Promise<{ seo: Seo | null } | null>
) {
  if (!can(actor, { seo: ["read"] })) return undefined
  const seo = (await find())?.seo
  return {
    title: seo?.title ?? null,
    description: seo?.description ?? null,
    noindex: seo?.noindex === true,
  }
}

// ------------------------------------------------------------ content

/** Pages, services and articles (drafts included) the actor may read. */
export async function searchContent(
  actor: Actor,
  query: string
): Promise<ToolResult> {
  if (
    !can(actor, { page: ["read"] }) &&
    !can(actor, { service: ["read"] }) &&
    !can(actor, { article: ["read"] })
  )
    throw forbidden()
  const { items } = await search(actor, query)
  // Leads, team and other collections are never part of this tool.
  const found = items.flatMap((item) =>
    item.type === "page" || item.type === "service" || item.type === "article"
      ? [{ ...item, type: item.type }]
      : []
  )
  const db = getDb()
  const statuses = new Map<string, string>()
  for (const kind of ["page", "service", "article"] as const) {
    const ids = found.filter((item) => item.type === kind).map((i) => i.id)
    for (const row of await contentStatuses(db, kind, ids))
      statuses.set(`${kind}:${row.id}`, row.status)
  }
  return {
    items: found.map((item) => ({
      kind: item.type,
      id: item.id,
      title: clip(item.title, 200),
      path: item.subtitle,
      status: statuses.get(`${item.type}:${item.id}`) ?? "draft",
    })),
  }
}

/** A fixed page: its draft copy, flattened from the template data. */
export async function readPage(actor: Actor, key: string): Promise<ToolResult> {
  assertCan(actor, { page: ["read"] })
  if (!isPageKey(key)) return notFoundResult("page")
  try {
    const page = await getPage(actor, key)
    return {
      found: true,
      key: page.key,
      title: page.label,
      path: page.path,
      status: page.status,
      live: page.published !== null,
      unpublishedChanges: page.dirty,
      text: flattenText(page.draft),
      seo: await seoRead(actor, () => pagesRepo.findPageForEdit(getDb(), key)),
    }
  } catch (error) {
    if (isNotFound(error)) return notFoundResult("page")
    throw error
  }
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Resolves an id or a slug to an id; null when nothing matches. */
async function idFrom(
  idOrSlug: string,
  bySlug: (slug: string) => Promise<{ id: string } | null>
): Promise<string | null> {
  const value = idOrSlug.trim()
  if (isUuid(value as unknown)) return value
  const slug = value.replace(/^\/?(services|blog)\//, "").replace(/\/$/, "")
  if (!SLUG.test(slug)) return null
  return (await bySlug(slug))?.id ?? null
}

export async function readService(
  actor: Actor,
  idOrSlug: string
): Promise<ToolResult> {
  assertCan(actor, { service: ["read"] })
  const db = getDb()
  const id = await idFrom(idOrSlug, (slug) =>
    servicesRepo.findServiceBySlug(db, slug)
  )
  if (!id) return notFoundResult("service")
  try {
    const service = await getServiceAdmin(actor, id)
    return {
      found: true,
      id: service.id,
      slug: service.slug,
      title: service.title,
      path: `/services/${service.slug}`,
      status: service.status,
      live: service.published !== null,
      unpublishedChanges: service.dirty,
      text: flattenText(service.draft),
      seo: await seoRead(actor, () => servicesRepo.findServiceForEdit(db, id)),
    }
  } catch (error) {
    if (isNotFound(error)) return notFoundResult("service")
    throw error
  }
}

export async function readArticle(
  actor: Actor,
  idOrSlug: string
): Promise<ToolResult> {
  assertCan(actor, { article: ["read"] })
  const db = getDb()
  const id = await idFrom(idOrSlug, (slug) =>
    articlesRepo.findArticleBySlug(db, slug)
  )
  if (!id) return notFoundResult("article")
  try {
    const article = await getArticleAdmin(actor, id)
    return {
      found: true,
      id: article.id,
      slug: article.slug,
      title: article.title,
      path: `/blog/${article.slug}`,
      status: article.status,
      live: article.live,
      category: article.category.name,
      // A staff byline, not enquiry data: sent whatever the owner's
      // enquiry-details switch says (accepted in the C8 review).
      author: article.author?.name ?? null,
      scheduledAt: article.scheduledAt,
      publishedAt: article.publishedAt,
      // Title, excerpt, lead, tags and body of the draft (capped).
      text: flattenText(article.draft),
      seo: await seoRead(actor, () => articlesRepo.findArticleForEdit(db, id)),
    }
  } catch (error) {
    if (isNotFound(error)) return notFoundResult("article")
    throw error
  }
}

// ------------------------------------------------------------ overviews

/** Published pages' SEO checks: a score and the open issues (seo:read). */
export async function seoHealth(actor: Actor): Promise<ToolResult> {
  const overview = await getSeoOverview(actor)
  const { passed, total } = overview.checks
  const issues = overview.entries.flatMap((entry) =>
    entry.issues.map((issue) => ({
      kind: entry.kind,
      id: entry.id,
      name: clip(entry.name, 120),
      path: entry.path,
      check: issue.check,
      message: issue.message,
    }))
  )
  return {
    score: total ? Math.round((passed / total) * 100) : 100,
    checks: { passed, total },
    issues: issues.slice(0, 50),
    moreIssues: Math.max(0, issues.length - 50),
  }
}

/**
 * The dashboard as the actor sees it (role-filtered by getDashboard).
 * Next-up items keep their titles only: descriptions can hold background
 * job errors, and the "Reply to …" title a lead's name (never shared
 * here, whatever the enquiry-details switch says).
 */
export async function dashboardSummary(actor: Actor): Promise<ToolResult> {
  // The cached SEO figures; no QA scan (only the KPIs and Next up go to the model).
  const dashboard = await getDashboard(actor, new Date(), { qa: false })
  const week = dashboard.enquiriesWeek
  return {
    kpis: dashboard.kpis,
    enquiriesThisWeek: week ? week.current : null,
    enquiriesLastWeek: week ? week.previous : null,
    enquiriesLastWeekToDate: week ? week.previousToDate : null,
    nextUp: dashboard.nextUp.map((item) => ({
      id: item.id,
      title:
        item.id === "reply" ? "Reply to the oldest new enquiry" : item.title,
      done: item.done,
    })),
  }
}

// ------------------------------------------------------------ enquiries

export const ENQUIRY_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const

export { redactContacts }

/** Service names (by slug or title, any case) → the service's title. */
export async function knownServices(): Promise<Map<string, string>> {
  const known = new Map<string, string>()
  for (const row of await serviceNames(getDb())) {
    known.set(row.slug.toLowerCase(), row.title)
    if (row.title) known.set(row.title.trim().toLowerCase(), row.title)
  }
  return known
}

/**
 * The public form's service field is free text: only names from the
 * services list pass, anything else is "Other" (never the typed text).
 */
export function serviceBucket(
  value: string | null | undefined,
  known: Map<string, string>
): string {
  const text = value?.trim() ?? ""
  return text ? (known.get(text.toLowerCase()) ?? "Other") : "Not given"
}

const RECENT_LIMIT = 10
const MESSAGE_MAX = 600

/**
 * Enquiry counts for the range (lead:read): by status (spam included), and
 * by service and week (spam left out). Names, companies and messages of
 * recent enquiries only when the owner shares enquiry details; never
 * email addresses or phone numbers. Service names come from the services
 * list: anything else typed into the form counts as "Other".
 */
export async function enquiryStats(
  actor: Actor,
  config: AiConfig,
  range: keyof typeof ENQUIRY_RANGES,
  now = new Date()
): Promise<ToolResult> {
  assertCan(actor, { lead: ["read"] })
  const days = ENQUIRY_RANGES[range]
  // The range in Irish calendar days, today included (as the dashboard).
  const dates = trendDays(now, days)
  // A day wider than the range (any DST offset); every count below keeps
  // only the exact Irish calendar days of the range (C8 review M4).
  const since = new Date(now.getTime() - (days + 1) * DAY)
  const db = getDb()
  const [counts, known] = await Promise.all([
    leadCounts(db, since),
    knownServices(),
  ])
  const inRange = new Set(dates)

  const byStatus = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, 0])
  ) as Record<string, number>
  for (const row of counts.byStatus)
    if (inRange.has(row.date)) byStatus[row.status] += row.n

  const byService: Record<string, number> = {}
  for (const row of counts.byService) {
    if (!inRange.has(row.date)) continue
    const label = serviceBucket(row.service, known)
    byService[label] = (byService[label] ?? 0) + row.n
  }

  const perDay = new Map(
    counts.byDay
      .filter((row) => inRange.has(row.date))
      .map((row) => [row.date, row.n])
  )
  // Weeks ending today, oldest first.
  const byWeek: { weekStart: string; count: number }[] = []
  for (let end = dates.length; end > 0; end -= 7) {
    const week = dates.slice(Math.max(0, end - 7), end)
    byWeek.unshift({
      weekStart: week[0]!,
      count: week.reduce((n, date) => n + (perDay.get(date) ?? 0), 0),
    })
  }
  const total = byWeek.reduce((n, week) => n + week.count, 0)

  const result: ToolResult = {
    range,
    from: dates[0],
    to: dates.at(-1),
    total,
    byStatus,
    byService,
    byWeek,
  }
  if (config.shareEnquiryDetails.enabled) {
    let budget = TEXT_MAX
    const recent: Record<string, string | null>[] = []
    for (const row of await recentLeadRows(db, since, RECENT_LIMIT)) {
      // Newest first: rows before the range only come at the end.
      if (!inRange.has(isoDate(row.createdAt))) break
      const item = {
        name: redactContacts(oneLine(row.name), REDACT_LINE_MAX),
        company: row.company
          ? redactContacts(oneLine(row.company), REDACT_LINE_MAX)
          : null,
        service: row.service
          ? redactContacts(oneLine(row.service), REDACT_LINE_MAX)
          : null,
        status: row.status,
        message: redactContacts(clip(row.message.trim(), MESSAGE_MAX)),
        createdAt: row.createdAt.toISOString(),
      }
      // Every text field counts toward the budget (C8 review M5).
      for (const value of Object.values(item))
        if (typeof value === "string") budget -= value.length
      if (budget < 0) break
      recent.push(item)
    }
    result.recent = recent
  }
  return result
}
