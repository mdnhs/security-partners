import { z } from "zod"

import { slug } from "@/lib/schemas/common"
import type { JobContent } from "@/lib/schemas/content/job"

import type { VersionedDto } from "./content"

/** revisions / audit entity type of jobs. */
export const JOB_ENTITY = "job"

export const jobPath = (jobSlug: string) => `/careers/${jobSlug}`
/** The application form of a job. */
export const jobApplyPath = (jobSlug: string) => `${jobPath(jobSlug)}/apply`

/** The talent pool form ("Send Us Your CV"): the apply form without a job. */
export const TALENT_POOL_PATH = "/careers/apply"

/** A job's slug; "apply" is taken by the talent pool form. */
const jobSlug = slug
  .max(80)
  .refine((value) => value !== "apply", "This address is reserved")

/** POST /jobs — a new draft built from its title (the editor fills the rest). */
export const createJobInput = z.object({
  title: z.string().trim().min(1).max(120),
  slug: jobSlug,
})

/** PATCH /jobs/:id/slug — changes the public address immediately. */
export const jobSlugInput = z.object({
  slug: jobSlug,
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
