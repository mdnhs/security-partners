import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { isUuid } from "@/lib/ids"
import { LEAD_STATUSES } from "@/lib/schemas/api/leads"
import type { AiConfig } from "@/lib/schemas/integrations"
import type { Seo } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { AppError, forbidden } from "@/server/lib/errors"
import * as articlesRepo from "@/server/modules/articles/repo"
import { getArticleAdmin } from "@/server/modules/articles/service"
import { getDashboard, trendDays } from "@/server/modules/dashboard/service"
import { getPage } from "@/server/modules/pages/service"
import * as pagesRepo from "@/server/modules/pages/repo"
import { search } from "@/server/modules/search/service"
import { getSeoOverview } from "@/server/modules/seo/service"
import * as servicesRepo from "@/server/modules/services/repo"
import { getServiceAdmin } from "@/server/modules/services/service"
import { isPageKey } from "@/templates/registry"

import { oneLine } from "./prompt"
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

/** A record's own SEO fields, only for users who may read SEO. */
function seoOf(actor: Actor, seo: Seo | null | undefined) {
  if (!can(actor, { seo: ["read"] })) return undefined
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
  const page = await getPage(actor, key)
  const row = await pagesRepo.findPageForEdit(getDb(), key)
  return {
    found: true,
    key: page.key,
    title: page.label,
    path: page.path,
    status: page.status,
    live: page.published !== null,
    unpublishedChanges: page.dirty,
    text: flattenText(page.draft),
    seo: seoOf(actor, row?.seo),
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
    const row = await servicesRepo.findServiceForEdit(db, id)
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
      seo: seoOf(actor, row?.seo),
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
    const row = await articlesRepo.findArticleForEdit(db, id)
    return {
      found: true,
      id: article.id,
      slug: article.slug,
      title: article.title,
      path: `/blog/${article.slug}`,
      status: article.status,
      live: article.live,
      category: article.category.name,
      author: article.author?.name ?? null,
      scheduledAt: article.scheduledAt,
      publishedAt: article.publishedAt,
      // Title, excerpt, lead, tags and body of the draft (capped).
      text: flattenText(article.draft),
      seo: seoOf(actor, row?.seo),
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
 * job errors.
 */
export async function dashboardSummary(actor: Actor): Promise<ToolResult> {
  const dashboard = await getDashboard(actor)
  const trend = dashboard.leadsTrend
  return {
    kpis: dashboard.kpis,
    leadsLast7Days: trend
      ? trend.slice(-7).reduce((n, day) => n + day.count, 0)
      : null,
    nextUp: dashboard.nextUp.map((item) => ({
      id: item.id,
      title: item.title,
      done: item.done,
    })),
  }
}

// ------------------------------------------------------------ enquiries

export const ENQUIRY_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const

const EMAIL = /[^\s@<>()[\]",;:]+@[^\s@<>()[\]",;:]+/g
const PHONE_LIKE = /\+?\d[\d\s().\-/]{4,}\d/g

/**
 * Removes contact details typed into free text: email addresses, phone-like
 * digit runs (7+ digits), and any stray "@".
 */
export function redactContacts(text: string): string {
  return text
    .replace(EMAIL, "[email removed]")
    .replace(PHONE_LIKE, (match) =>
      match.replace(/\D/g, "").length >= 7 ? "[number removed]" : match
    )
    .replace(/\d{7,}/g, "[number removed]")
    .replaceAll("@", " ")
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
  const since = new Date(now.getTime() - (days + 1) * DAY)
  const db = getDb()
  const [counts, names] = await Promise.all([
    leadCounts(db, since),
    serviceNames(db),
  ])
  const inRange = new Set(dates)

  const byStatus = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, 0])
  ) as Record<string, number>
  // `since` is a day wider than the range; the per-day rows below are exact.
  for (const row of counts.byStatus) byStatus[row.status] += row.n

  const known = new Map<string, string>()
  for (const row of names) {
    known.set(row.slug.toLowerCase(), row.title)
    if (row.title) known.set(row.title.trim().toLowerCase(), row.title)
  }
  const byService: Record<string, number> = {}
  for (const row of counts.byService) {
    const value = row.service?.trim() ?? ""
    const label = value
      ? (known.get(value.toLowerCase()) ?? "Other")
      : "Not given"
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
      const item = {
        name: redactContacts(oneLine(row.name)),
        company: row.company ? redactContacts(oneLine(row.company)) : null,
        service: row.service ? redactContacts(oneLine(row.service)) : null,
        status: row.status,
        message: redactContacts(clip(row.message.trim(), MESSAGE_MAX)),
        createdAt: row.createdAt.toISOString(),
      }
      budget -= item.name.length + item.message.length
      if (budget < 0) break
      recent.push(item)
    }
    result.recent = recent
  }
  return result
}
