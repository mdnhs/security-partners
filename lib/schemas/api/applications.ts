import { z } from "zod"

import { listQuery } from "./list"

/** Same order as the DB enum application_status (server/db/schema/job-applications.ts). */
export const APPLICATION_STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "interview",
  "offered",
  "hired",
  "rejected",
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offered: "Offered",
  hired: "Hired",
  rejected: "Rejected",
}

/** PSA licence: valid, applied for, none (the three `options.psaHeld` of the careers copy, in order). */
export const PSA_HELD = ["valid", "applied", "no"] as const

export const MAX_APPLICATION_FILE_BYTES = 5 * 1024 * 1024
export const MAX_HISTORY_PERIODS = 10

export const CV_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const
export const PSA_CARD_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const

const REQUIRED = "Required"
const required = (max: number) =>
  z.string().trim().min(1, REQUIRED).max(max, `At most ${max} characters`)
const optional = (max: number) =>
  z.string().trim().max(max, `At most ${max} characters`)
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker (YYYY-MM-DD)")
const optionalDate = z.union([z.literal(""), date])
/** "2024-05" (month inputs) or a full date. */
const month = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Use the date picker (YYYY-MM)")

export const historyPeriod = z.object({
  employer: required(120),
  role: required(120),
  from: month,
  /** "" = Present. */
  to: z.union([z.literal(""), month]),
  reason: optional(200),
})
export type HistoryPeriod = z.infer<typeof historyPeriod>

/**
 * The application form's answers (Figma 550:285, seven sections). Choice
 * fields hold the option text the applicant saw (the lists are editable in
 * the careers copy); the service checks them against the published copy.
 */
export const applicationAnswers = z
  .object({
    // 1. Personal details
    firstName: required(80),
    surname: required(80),
    email: z.email("Enter a valid email address").max(200),
    phone: required(40),
    address: required(200),
    town: required(120),
    eircode: optional(10),
    // 2. Right to work
    rightToWork: required(120),
    permissionExpiry: optionalDate,
    // 3. PSA licence
    psa: z.enum(PSA_HELD, { error: REQUIRED }),
    psaNumber: optional(40),
    psaCategory: optional(120),
    psaExpiry: optionalDate,
    qualifications: z.array(required(120)).max(20),
    // 4. Employment history
    history: z.array(historyPeriod).min(1, REQUIRED).max(MAX_HISTORY_PERIODS),
    gardaVetting: z.boolean({ error: REQUIRED }),
    livedAbroad: z.boolean({ error: REQUIRED }),
    // 5. Experience & availability
    experience: required(120),
    startDate: date,
    shifts: z.array(required(120)).min(1, REQUIRED).max(20),
    transport: z.boolean({ error: REQUIRED }),
    // 6. Cover note
    coverNote: optional(3000),
    heardFrom: optional(120),
    // 7. Declaration: true & complete, data processing, keep on file (optional)
    consents: z.tuple([
      z.literal(true, { error: REQUIRED }),
      z.literal(true, { error: REQUIRED }),
      z.boolean(),
    ]),
  })
  .superRefine((a, ctx) => {
    if (a.psa !== "valid") return
    for (const key of ["psaNumber", "psaCategory"] as const)
      if (a[key] === "")
        ctx.addIssue({ code: "custom", path: [key], message: REQUIRED })
    if (a.psaExpiry === "")
      ctx.addIssue({ code: "custom", path: ["psaExpiry"], message: REQUIRED })
  })
export type ApplicationAnswers = z.infer<typeof applicationAnswers>

/** Text fields of the multipart POST /api/v1/public/careers/applications (`answers` is JSON). */
export const applicationEnvelope = z.object({
  jobSlug: z.string().trim().min(1).max(80),
  /** One per mounted form: a retry or double submit stores one application. */
  submissionId: z.uuid(),
  answers: applicationAnswers,
  turnstileToken: z.string().max(4096).optional(),
  website: z.unknown().optional(),
})
export type ApplicationEnvelope = z.infer<typeof applicationEnvelope>

export type StoredFile = {
  key: string
  /** The applicant's file name, for the download. */
  name: string
  mime: string
  size: number
  driver: "disk" | "r2"
}

export type ApplicationFileKind = "cv" | "psa-card"
export const applicationFileParam = z.object({
  id: z.uuid(),
  kind: z.enum(["cv", "psa-card"]),
})

export const applicationListQuery = listQuery.extend({
  q: z.string().trim().max(200).optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  job: z.uuid().optional(),
})
export type ApplicationListQuery = z.output<typeof applicationListQuery>

export const updateApplicationInput = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    note: z.string().max(5000).optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, {
    message: "Nothing to change",
  })
export type UpdateApplicationInput = z.infer<typeof updateApplicationInput>

export type ApplicationListItem = {
  id: string
  name: string
  email: string
  phone: string
  status: ApplicationStatus
  job: { id: string | null; title: string; slug: string }
  createdAt: string
}

export type ApplicationDto = ApplicationListItem & {
  answers: ApplicationAnswers
  cv: { name: string; mime: string; size: number }
  psaCard: { name: string; mime: string; size: number } | null
  note: string
  updatedAt: string
}
