import { z } from "zod"

import { slug } from "@/lib/schemas/common"
import type { JobContent } from "@/lib/schemas/content/job"

import type { VersionedDto } from "./content"

/** revisions / audit entity type of jobs. */
export const JOB_ENTITY = "job"

export const jobPath = (jobSlug: string) => `/careers/${jobSlug}`
/** The application form of a job. */
export const jobApplyPath = (jobSlug: string) => `${jobPath(jobSlug)}/apply`

/** POST /jobs — a new draft built from its title (the editor fills the rest). */
export const createJobInput = z.object({
  title: z.string().trim().min(1).max(120),
  slug: slug.max(80),
})

/** PATCH /jobs/:id/slug — changes the public address immediately. */
export const jobSlugInput = z.object({
  slug: slug.max(80),
  version: z.number().int().min(1),
})

export const jobVersionQuery = z.object({
  version: z.coerce.number().int().min(1),
})

export type JobDto = VersionedDto<JobContent> & {
  id: string
  slug: string
  path: string
  title: string
  createdAt: string
}

export type JobListItem = Omit<JobDto, "draft" | "published"> & {
  /** Of the published version; null when never published. */
  open: boolean | null
  closingDate: string
  category: string
}
