import { isoDate, SITE_TIME_ZONE } from "@/lib/format"

// When a job is open (spec "Rules"): published (callers pass published jobs
// only), not marked filled, and its closing date is today or later on the
// Irish calendar. Isomorphic: the listing filters on the server, the apply
// page re-checks, the API refuses submissions to a closed role.

export type OpenFields = { closingDate: string; filled: boolean }

/** Today's date in Europe/Dublin as YYYY-MM-DD. */
export const dublinToday = (now: Date) => isoDate(now, SITE_TIME_ZONE)

export function isOpen(job: OpenFields, now: Date): boolean {
  return !job.filled && job.closingDate >= dublinToday(now)
}

type Listed = { content: OpenFields; publishedAt: Date | null }

/** Open jobs, the most recently posted first. */
export function openJobs<T extends Listed>(jobs: readonly T[], now: Date): T[] {
  return jobs
    .filter((job) => isOpen(job.content, now))
    .sort(
      (a, b) =>
        (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
    )
}

/** Filled or expired jobs, the latest closing date first, at most `limit`. */
export function previousJobs<T extends Listed>(
  jobs: readonly T[],
  now: Date,
  limit = 6
): T[] {
  return jobs
    .filter((job) => !isOpen(job.content, now))
    .sort((a, b) => b.content.closingDate.localeCompare(a.content.closingDate))
    .slice(0, limit)
}
