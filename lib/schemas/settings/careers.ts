import { z } from "zod"

/** settings.careers — who hears about new job applications, and how long they are kept. */
export const careersSettings = z.object({
  recipients: z.array(z.email()).min(1),
  /** Applications (and their CVs) older than this are deleted by purge-applications. */
  retentionMonths: z.number().int().min(1).max(60),
  /** Instead, for an applicant who ticked “keep my details on file”. */
  keepOnFileMonths: z.number().int().min(1).max(60),
})
export type CareersSettings = z.infer<typeof careersSettings>
