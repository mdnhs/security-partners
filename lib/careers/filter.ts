// The listing's client-side filters (components/careers/open-positions.tsx):
// every word of the search must appear in the job's text; the selects and
// the category chip match exactly. Empty filters match everything.

export type FilterableJob = {
  title: string
  category: string
  location: string
  licence: string
  shift: string
  pay: string
}

export type JobFilters = {
  q?: string
  location?: string
  licence?: string
  category?: string
}

export function filterJobs<T extends FilterableJob>(
  jobs: readonly T[],
  filters: JobFilters
): T[] {
  const words = (filters.q ?? "").toLowerCase().split(/\s+/).filter(Boolean)
  return jobs.filter((job) => {
    if (filters.location && job.location !== filters.location) return false
    if (filters.licence && job.licence !== filters.licence) return false
    if (filters.category && job.category !== filters.category) return false
    if (words.length === 0) return true
    const text = [job.title, job.category, job.location, job.shift, job.pay]
      .join(" ")
      .toLowerCase()
    return words.every((word) => text.includes(word))
  })
}
