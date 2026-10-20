import { z } from "zod"

/** settings.leads — notification recipients, retention (D6) and acknowledgement. */
export const leadsSettings = z.object({
  recipients: z.array(z.email()).min(1),
  retentionMonths: z.number().int().min(1).max(120),
  acknowledgement: z.boolean(),
})
export type LeadsSettings = z.infer<typeof leadsSettings>
