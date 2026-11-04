import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { openJobs, previousJobs } from "@/lib/careers/open"
import type { JobContent } from "@/lib/schemas/content/job"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { isPublishedSlug } from "@/server/modules/redirects/repo"

import * as repo from "./repo"

export type JobRecord = {
  id: string
  slug: string
  content: JobContent
  publishedAt: Date | null
}

type Row = NonNullable<Awaited<ReturnType<typeof repo.findJobBySlug>>>

function toRecord(row: Row, draft: boolean): JobRecord | null {
  const content = draft ? row.draft : row.published
  if (!content) return null
  return { id: row.id, slug: row.slug, content, publishedAt: row.publishedAt }
}

/**
 * Every published job, open or not. Open/closed depends on the date, so it
 * is decided per request (openJobs/previousJobs) from this cached list: a
 * closing date passing needs no cache expiry.
 */
export async function listPublishedJobs(): Promise<JobRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.jobs)
  const rows = await repo.listPublishedJobRows(getDb())
  return rows
    .map((row) => toRecord(row, false))
    .filter((r): r is JobRecord => r !== null)
}

/** Open positions, the most recently posted first. */
export async function listOpenJobs(now: Date = new Date()) {
  return openJobs(await listPublishedJobs(), now)
}

/** Previous openings (filled or expired), the latest closing date first. */
export async function listPreviousJobs(now: Date = new Date(), limit = 6) {
  return previousJobs(await listPublishedJobs(), now, limit)
}

/** One job by address: published, or its draft when `draft` (previewers). */
export async function getJobBySlug(
  slug: string,
  draft = false
): Promise<JobRecord | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.jobs, tag.job(slug))
  const row = await repo.findJobBySlug(getDb(), slug)
  return row ? toRecord(row, draft) : null
}

/** Is /careers/<slug> live? A plain read (not cached), shared with proxy.ts. */
export function isPublishedJobSlug(slug: string): Promise<boolean> {
  return isPublishedSlug(getDb(), "job", slug)
}
